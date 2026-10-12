import { Router, Request, Response } from 'express';
import { meshNetworkService } from '../services/mesh.service';
import { SyncBatchRequest } from '../models/mesh.types';

const router = Router();

// GET /api/mesh/peers — Get discovered peers in vicinity
router.get('/peers', (req: Request, res: Response) => {
  try {
    const peers = meshNetworkService.getPeers();
    res.json({ success: true, count: peers.length, peers });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/mesh/peers/announce — Announce device presence in mesh
router.post('/peers/announce', (req: Request, res: Response) => {
  try {
    const { peer_id, display_name, public_key, hop_count, signal_strength } = req.body;
    if (!peer_id || !display_name) {
      res.status(400).json({ error: 'peer_id and display_name are required' });
      return;
    }

    const peer = meshNetworkService.registerOrUpdatePeer({
      peer_id,
      display_name,
      public_key,
      hop_count: hop_count ?? 1,
      signal_strength: signal_strength ?? 85,
    });

    // Check if there are queued store-and-forward messages for this peer
    const queuedMessages = meshNetworkService.flushQueuedMessagesForPeer(peer_id);

    res.json({
      success: true,
      peer,
      queued_messages_delivered: queuedMessages.length,
      messages: queuedMessages,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/mesh/verify — Verify peer via QR code fingerprint
router.post('/verify', (req: Request, res: Response) => {
  try {
    const { peer_id, fingerprint } = req.body;
    if (!peer_id || !fingerprint) {
      res.status(400).json({ error: 'peer_id and fingerprint are required' });
      return;
    }

    const success = meshNetworkService.verifyPeer(peer_id, fingerprint);
    if (!success) {
      res.status(400).json({ error: 'Verification failed: fingerprint does not match peer public key' });
      return;
    }

    res.json({ success: true, verified: true, peer_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/mesh/packet — Process or forward mesh packet
router.post('/packet', (req: Request, res: Response) => {
  try {
    const { my_node_id, packet } = req.body;
    if (!my_node_id || !packet) {
      res.status(400).json({ error: 'my_node_id and packet are required' });
      return;
    }

    const result = meshNetworkService.processIncomingPacket(my_node_id, packet);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/mesh/sync — Auto-sync offline batch when online
router.post('/sync', async (req: Request, res: Response) => {
  try {
    const body = req.body as SyncBatchRequest;
    if (!body || !Array.isArray(body.messages)) {
      res.status(400).json({ error: 'Invalid sync payload: messages array required' });
      return;
    }

    const result = await meshNetworkService.syncOfflineBatch(body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/mesh/messages — Retrieve messages
router.get('/messages', (req: Request, res: Response) => {
  try {
    const peerId = req.query.peer_id as string | undefined;
    const messages = meshNetworkService.getMessages(peerId);
    res.json({ success: true, count: messages.length, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/mesh/stats — Mesh network status and diagnostics
router.get('/stats', (req: Request, res: Response) => {
  try {
    const peers = meshNetworkService.getPeers();
    const unsynced = meshNetworkService.getUnsyncedMessages();
    res.json({
      success: true,
      active_peers: peers.length,
      unsynced_offline_messages: unsynced.length,
      mode: 'BLE_P2P_MESH',
      max_hops: MeshNetworkService.MAX_HOPS,
      anti_spam_limit: '10 msg/min per peer',
      ttl_days: 7,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
