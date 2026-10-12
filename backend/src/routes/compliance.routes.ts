import { Router, Request, Response } from 'express';
import { complianceService, CURRENT_POLICY_VERSION, CURRENT_TERMS_VERSION, DPO_EMAIL, CONTROLLER_NAME } from '../services/compliance.service';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

// --- PUBLIC COMPLIANCE INFO & METADATA ---
router.get('/summary', (_req: Request, res: Response) => {
  res.json({
    success: true,
    controller: CONTROLLER_NAME,
    regulatory_frameworks: [
      'UU No. 27/2022 tentang Perlindungan Data Pribadi (UU PDP)',
      'PP No. 71/2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik (PSTE)',
      'Pendaftaran PSE Kominfo Lingkup Privat (https://pse.kominfo.go.id)',
      'SNI ISO/IEC 27001:2022 Sistem Manajemen Keamanan Informasi (SMKI)',
    ],
    dpo_contact: DPO_EMAIL,
    policy_version: CURRENT_POLICY_VERSION,
    terms_version: CURRENT_TERMS_VERSION,
    data_retention_policy: {
      account_deletion_grace_period_days: 30,
      offline_mesh_message_ttl_days: 7,
      e2ee_encryption: 'X25519 + AES-256-GCM',
    },
  });
});

// Protect user-specific endpoints with verifyJWT
router.use(verifyJWT);

// GET /api/compliance/consent/status
router.get('/consent/status', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req.query.user_id as string);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const status = complianceService.getConsentStatus(userId);
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/compliance/consent
router.post('/consent', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);
    const userAgent = req.headers['user-agent'];

    const record = complianceService.recordConsent({
      userId,
      policyVersion: req.body.policy_version,
      termsVersion: req.body.terms_version,
      ipAddress,
      userAgent,
    });

    res.json({ success: true, message: 'Persetujuan kebijakan privasi berhasil disimpan.', record });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/user/export — Hak Portabilitas & Akses Data (UU PDP)
router.get('/export', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req.query.user_id as string);
    const username = (req as any).user?.username || (req.query.username as string);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);
    const data = await complianceService.exportUserData(userId, username, ipAddress);

    // Provide downloadable JSON attachment header
    res.setHeader('Content-Disposition', `attachment; filename="ngopi_data_export_${userId}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Export failed' });
  }
});

// DELETE /api/user/delete — Hak Penghapusan Data / Right to be Forgotten (Grace Period 30 Hari)
router.delete('/delete', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);
    const request = complianceService.requestAccountDeletion({
      userId,
      reason: req.body.reason,
      ipAddress,
    });

    res.json({
      success: true,
      message: 'Permintaan penghapusan akun telah dicatat. Data Anda akan disimpan selama masa tenggang (grace period) 30 hari sebelum dihapus permanen. Anda dapat membatalkan kapan saja sebelum batas waktu.',
      deletion_request: request,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Deletion request failed' });
  }
});

// POST /api/user/cancel-deletion — Batalkan penghapusan dalam masa grace period 30 hari
router.post('/cancel-deletion', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ipAddress = req.ip || (req.headers['x-forwarded-for'] as string);
    const success = complianceService.cancelAccountDeletion(userId, ipAddress);

    if (!success) {
      res.status(400).json({ error: 'Tidak ada permintaan penghapusan akun yang sedang aktif untuk dibatalkan.' });
      return;
    }

    res.json({ success: true, message: 'Permintaan penghapusan akun berhasil dibatalkan. Akun Anda kembali aktif normal.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Cancellation failed' });
  }
});

// GET /api/user/deletion-status
router.get('/deletion-status', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req.query.user_id as string);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const status = complianceService.getDeletionStatus(userId);
    res.json({ success: true, is_pending_deletion: status?.status === 'pending_deletion', status });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/compliance/audit
router.get('/audit', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req.query.user_id as string);
    const logs = complianceService.getAuditLogs(userId);
    res.json({ success: true, count: logs.length, audit_logs: logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/compliance/incident (Security Incident / Breach notification)
router.post('/incident', (req: Request, res: Response) => {
  try {
    const { severity, description, affected_count } = req.body;
    if (!severity || !description) {
      res.status(400).json({ error: 'severity and description are required' });
      return;
    }

    const alert = complianceService.reportSecurityIncident({
      severity,
      description,
      affectedCount: Number(affected_count || 1),
      reporterUserId: (req as any).user?.id,
    });

    res.status(201).json({ success: true, alert });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to report incident' });
  }
});

export default router;
