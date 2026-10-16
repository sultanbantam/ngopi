import { Router, Request, Response } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { htManagerService } from '../ht/htManager.service';
import { serialHTService } from '../ht/serialHT.service';
import { AcousticModem } from '../ht/acousticModem.service';
import { APRSService } from '../ht/aprs.service';

const router = Router();

// Authentication middleware applied
router.use(verifyJWT);

// GET /api/ht/profile - Get HT radio profile
router.get('/profile', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID required' });
      return;
    }
    const profile = htManagerService.getOrCreateProfile(userId, `YD0${(username || 'USER').slice(0, 4).toUpperCase()}`);
    res.json({ success: true, profile });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/ht/profile - Update HT profile & license compliance
router.post('/profile', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID required' });
      return;
    }
    const updated = htManagerService.updateProfile(userId, req.body);
    res.json({ success: true, profile: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/ht/transmit - Transmit message via HT (modulates to AFSK 1200/2200Hz audio & logs)
router.post('/transmit', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { content, freq, protocol, recipient_callsign, recipient_id, latitude, longitude, is_emergency } = req.body;

    if (!userId || !content) {
      res.status(400).json({ error: 'userId and content are required' });
      return;
    }

    const result = htManagerService.prepareTransmission({
      userId,
      content,
      freq: freq ? Number(freq) : undefined,
      protocol: protocol || 'AFSK',
      recipientId: recipient_id,
      recipientCallsign: recipient_callsign,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      isEmergency: Boolean(is_emergency),
    });

    res.json({
      success: true,
      message: result.message,
      audio_data_url: result.audioDataUrl,
      raw_packet: result.rawPacket,
      log: result.log,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Transmission failed' });
  }
});

// POST /api/ht/receive - Demodulate or record incoming radio message
router.post('/receive', (req: Request, res: Response) => {
  try {
    const { content, freq, protocol, sender_callsign, rssi } = req.body;
    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const message = htManagerService.receiveIncomingRadioMessage({
      content,
      freq: freq ? Number(freq) : 144.390,
      protocol,
      senderCallsign: sender_callsign,
      rssi: rssi ? Number(rssi) : -80,
    });

    res.json({ success: true, message });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process received packet' });
  }
});

// GET /api/ht/messages - List recent HT radio messages
router.get('/messages', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const freq = req.query.freq ? Number(req.query.freq) : undefined;
    const isEmergency = req.query.emergency === 'true';

    const messages = htManagerService.getMessages({ userId, freq, isEmergency });
    res.json({ success: true, count: messages.length, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get messages' });
  }
});

// POST /api/ht/sync - Store-and-Forward sync when device returns online
router.post('/sync', (req: Request, res: Response) => {
  try {
    const body = req.body;
    let messages: any[] = [];

    if (Array.isArray(body)) {
      messages = body;
    } else if (Array.isArray(body.offline_messages)) {
      messages = body.offline_messages;
    } else if (body && (body.text || body.content)) {
      messages = [body];
    } else {
      res.status(400).json({ error: 'offline_messages array or message object is required' });
      return;
    }

    const syncResult = htManagerService.syncOfflineBatch(messages);
    res.json({ success: true, ...syncResult });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// GET /api/ht/groups - List Warung HT channels
router.get('/groups', (_req: Request, res: Response) => {
  try {
    const groups = htManagerService.listGroups();
    res.json({ success: true, count: groups.length, groups });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to list groups' });
  }
});

// POST /api/ht/groups - Create a new Warung HT channel
router.post('/groups', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { name, freq, ctcss, protocol, description } = req.body;

    if (!userId || !name || !freq) {
      res.status(400).json({ error: 'name and freq are required' });
      return;
    }

    const group = htManagerService.createGroup({
      name,
      freq: Number(freq),
      ctcss,
      protocol,
      creatorId: userId,
      description,
    });

    res.status(201).json({ success: true, group });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create group' });
  }
});

// POST /api/ht/emergency - Broadcast Emergency SOS
router.post('/emergency', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { message, latitude, longitude } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = htManagerService.prepareTransmission({
      userId,
      content: message || 'EMERGENCY SOS: Butuh bantuan darurat segera!',
      freq: 145.000, // Standard Emergency Frequency
      protocol: 'APRS',
      latitude: latitude ? Number(latitude) : -6.2088,
      longitude: longitude ? Number(longitude) : 106.8456,
      isEmergency: true,
    });

    res.json({
      success: true,
      alert: 'Emergency SOS Broadcasted over 145.000 MHz',
      message: result.message,
      audio_data_url: result.audioDataUrl,
      raw_packet: result.rawPacket,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to broadcast emergency' });
  }
});

// GET /api/ht/logs - Transmission audit logs
router.get('/logs', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const logs = htManagerService.getTransmissionLogs(userId);
    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get logs' });
  }
});

// POST /api/ht/serial/command - Execute hardware serial command (kv4p dongle)
router.post('/serial/command', (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command) {
      res.status(400).json({ error: 'command string is required' });
      return;
    }

    const result = serialHTService.processCommand(command);
    res.json({ success: result.success, reply: result.reply, state: result.state });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Serial command execution failed' });
  }
});

// GET /api/ht/serial/status - Get hardware serial dongle status
router.get('/serial/status', (_req: Request, res: Response) => {
  try {
    const state = serialHTService.getState();
    const commandLog = serialHTService.getCommandLog();
    res.json({ success: true, state, commandLog });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get serial status' });
  }
});

export default router;
