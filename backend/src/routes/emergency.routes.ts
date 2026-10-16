import { Router, Request, Response } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { emergencyService } from '../services/emergency.service';

const router = Router();

// Authentication middleware applied
router.use(verifyJWT);

// POST /api/emergency/sos - Trigger automated SOS procedure (Task 7.2)
router.post('/sos', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'anon_user';
    const username = (req as any).user?.username || 'Warga Warkop';
    const { type, latitude, longitude, description } = req.body;

    const result = emergencyService.triggerSOS({
      userId,
      username,
      type,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      description,
    });

    res.json({
      success: true,
      message: 'Sinyal SOS darurat berhasil disiarkan di 145.000 MHz dan grup Warung Kopi Darurat!',
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memicu sinyal SOS' });
  }
});

// GET /api/emergency/contacts - List user's emergency contacts
router.get('/contacts', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const contacts = emergencyService.getContacts(userId);
    res.json({ success: true, count: contacts.length, contacts });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil kontak darurat' });
  }
});

// POST /api/emergency/contacts - Add emergency contact
router.post('/contacts', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { name, phone, relation, is_primary } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!name || !phone) {
      res.status(400).json({ error: 'Nama dan nomor telepon wajib diisi' });
      return;
    }

    const contact = emergencyService.addContact(userId, {
      name,
      phone,
      relation: relation || 'Keluarga / Teman',
      is_primary: Boolean(is_primary),
    });

    res.status(201).json({ success: true, contact });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menambahkan kontak darurat' });
  }
});

// DELETE /api/emergency/contacts/:id - Remove emergency contact
router.delete('/contacts/:id', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const contactId = req.params.id;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const deleted = emergencyService.deleteContact(userId, contactId);
    if (!deleted) {
      res.status(404).json({ error: 'Kontak tidak ditemukan' });
      return;
    }

    res.json({ success: true, message: 'Kontak darurat berhasil dihapus' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal menghapus kontak darurat' });
  }
});

// GET /api/emergency/logs - List active emergency logs
router.get('/logs', (_req: Request, res: Response) => {
  try {
    const logs = emergencyService.getActiveLogs();
    res.json({ success: true, count: logs.length, logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal mengambil log darurat' });
  }
});

// POST /api/emergency/logs/:id/resolve - Mark emergency as resolved
router.post('/logs/:id/resolve', (req: Request, res: Response) => {
  try {
    const username = (req as any).user?.username || 'Relawan';
    const logId = req.params.id;

    const resolved = emergencyService.resolveLog(logId, username);
    if (!resolved) {
      res.status(404).json({ error: 'Log darurat tidak ditemukan' });
      return;
    }

    res.json({ success: true, message: 'Insiden darurat ditandai selesai' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memperbarui log darurat' });
  }
});

export default router;
