import { Router, Request, Response } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';
import { telecomService } from '../services/telecom.service';

const router = Router();

const getAuthenticatedDbUser = async (req: Request) => {
  const userId = (req as any).user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      display_name: true,
      avatar_url: true,
      bmc_id: true,
      role: true,
    },
  });
};

// GET /api/telecom/me
router.get('/me', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const resolved = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolved?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolved?.ngopi_email || telecomService.formatEmail(user.username, user.id);
    const isFounder = telecomService.isFounderUser(user);
    const inbox = telecomService.getInboxForUser(user, ngopiNumber, ngopiEmail);
    const unreadMailCount = inbox.filter((m) => !m.is_read).length;

    res.status(200).json({
      user_id: user.id,
      username: user.username,
      display_name: user.display_name,
      ngopi_number: ngopiNumber,
      ngopi_email: ngopiEmail,
      number_alias_email: `${ngopiNumber}@ngopi.top`,
      is_founder: isFounder,
      unread_mail_count: unreadMailCount,
      locked_email_prefixes: telecomService.getLockedEmailPrefixes(),
      premium_config: telecomService.getPremiumConfig(),
    });
  } catch (err) {
    console.error('[TelecomRoutes] /me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/lookup/:identifier
router.get('/lookup/:identifier', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const identifier = String(req.params.identifier || '').trim();
    const resolved = await telecomService.resolveUserByIdentifier(identifier);
    if (!resolved) {
      res.status(404).json({ error: `Nomor atau alamat "${identifier}" belum terdaftar.` });
      return;
    }
    res.status(200).json(resolved);
  } catch (err) {
    console.error('[TelecomRoutes] /lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/number/check
router.post('/number/check', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { number } = req.body || {};
    const result = await telecomService.checkNumberAvailability(String(number ?? ''), user);
    res.status(200).json(result);
  } catch (err) {
    console.error('[TelecomRoutes] /number/check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/number/claim
router.post('/number/claim', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { number } = req.body || {};
    const result = await telecomService.claimNumber(user, String(number ?? ''));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({
      message: `Nomor Ngopi Anda berhasil diubah menjadi ${result.number}!`,
      ngopi_number: result.number,
      number_alias_email: `${result.number}@ngopi.top`,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /number/claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/email/check
router.post('/email/check', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { email } = req.body || {};
    const result = await telecomService.checkEmailAvailability(String(email ?? ''), user);
    res.status(200).json(result);
  } catch (err) {
    console.error('[TelecomRoutes] /email/check error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/email/claim
router.post('/email/claim', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { email } = req.body || {};
    const result = await telecomService.claimCustomEmail(user, String(email ?? ''));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({
      message: `Alamat Email Resmi Anda berhasil diubah menjadi ${result.email}!`,
      ngopi_email: result.email,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /email/claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/number/assign-vip (Founder only)
router.post('/number/assign-vip', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { target_username, number } = req.body || {};
    const result = await telecomService.assignVipNumberByFounder(
      user,
      String(target_username ?? ''),
      String(number ?? '')
    );
    if (!result.success) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.status(200).json({
      message: `Nomor VIP #${result.number} berhasil diberikan kepada @${result.targetUsername}!`,
      ngopi_number: result.number,
      target_username: result.targetUsername,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /number/assign-vip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/email/manage-lock (Founder only)
router.post('/email/manage-lock', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { action, email_prefix, target_username } = req.body || {};
    const result = await telecomService.manageEmailLockByFounder(
      user,
      action === 'unlock_assign' ? 'unlock_assign' : 'lock',
      String(email_prefix ?? ''),
      target_username ? String(target_username) : undefined
    );
    if (!result.success) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    console.error('[TelecomRoutes] /email/manage-lock error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/premium-config (Founder only)
router.post('/premium-config', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = telecomService.updatePremiumConfigByFounder(user, req.body || {});
    if (!result.success) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.status(200).json({
      message: 'Konfigurasi Fitur Premium berhasil diperbarui!',
      premium_config: result.config,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /premium-config error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/mail/inbox
router.get('/mail/inbox', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const resolved = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolved?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolved?.ngopi_email || telecomService.formatEmail(user.username, user.id);
    const inbox = telecomService.getInboxForUser(user, ngopiNumber, ngopiEmail);
    res.status(200).json({
      ngopi_number: ngopiNumber,
      ngopi_email: ngopiEmail,
      mails: inbox,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /mail/inbox error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/mail/sent
router.get('/mail/sent', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sent = telecomService.getSentForUser(user.id);
    res.status(200).json({ mails: sent });
  } catch (err) {
    console.error('[TelecomRoutes] /mail/sent error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/mail/send
router.post('/mail/send', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { to, subject, body } = req.body || {};
    const result = await telecomService.sendMail(user, String(to ?? ''), String(subject ?? ''), String(body ?? ''));
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      message: 'Email berhasil dikirim!',
      mail: result.mail,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /mail/send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/mail/:id/read
router.post('/mail/:id/read', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    telecomService.markMailRead(user.id, String(req.params.id || ''));
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/telecom/mail/:id
router.delete('/mail/:id', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    telecomService.deleteMail(user.id, String(req.params.id || ''));
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
