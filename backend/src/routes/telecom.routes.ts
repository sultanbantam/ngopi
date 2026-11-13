import { Router, Request, Response } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';
import { telecomService } from '../services/telecom.service';
import { getSocketIO } from '../sockets';

const router = Router();

// GET /api/telecom/directory — Resilient public member & telecom directory for Web & Mobile
router.get('/directory', async (_req: Request, res: Response): Promise<void> => {
  try {
    const allUsers = await prisma.user.findMany({
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
        bmc_id: true,
        role: true,
        is_online: true,
        status: true,
        last_seen: true,
        created_at: true,
      },
    });
    const dir = telecomService.buildDirectoryMap(allUsers);
    const enriched = allUsers.map((u: any) => {
      const meta = dir.get(u.id) || {
        number: telecomService.getNumberForUser(u),
        email: telecomService.formatEmail(u.username, u.id),
      };
      return {
        ...u,
        ngopi_number: meta.number,
        ngopi_email: meta.email,
      };
    });
    res.status(200).json({
      total: enriched.length,
      members: enriched,
      premium_config: telecomService.getPremiumConfig(),
    });
  } catch (err) {
    console.error('[TelecomRoutes] /directory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/public-lookup/:identifier — Fast Dialpad / Email lookup
router.get('/public-lookup/:identifier', async (req: Request, res: Response): Promise<void> => {
  try {
    const identifier = String(req.params.identifier || '').trim();
    const resolved = await telecomService.resolveUserByIdentifier(identifier);
    if (!resolved) {
      res.status(404).json({ error: `Nomor atau alamat "${identifier}" belum terdaftar.` });
      return;
    }
    res.status(200).json(resolved);
  } catch (err) {
    console.error('[TelecomRoutes] /public-lookup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
      message: `Nomor Ngopi kamu berhasil diubah menjadi ${result.number}!`,
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

// GET /api/telecom/mail/inbox?filter=all|unread
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
    const filterParam = String(req.query.filter || 'all').toLowerCase() === 'unread' ? 'unread' : 'all';
    const inbox = telecomService.getInboxForUser(user, ngopiNumber, ngopiEmail, filterParam);
    const unreadCount = telecomService.getUnreadCountForUser(user, ngopiNumber, ngopiEmail);
    res.status(200).json({
      ngopi_number: ngopiNumber,
      ngopi_email: ngopiEmail,
      unread_count: unreadCount,
      mails: inbox,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /mail/inbox error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/mail/unread-count
router.get('/mail/unread-count', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const resolved = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolved?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolved?.ngopi_email || telecomService.formatEmail(user.username, user.id);
    const unreadCount = telecomService.getUnreadCountForUser(user, ngopiNumber, ngopiEmail);
    res.status(200).json({ unread_count: unreadCount });
  } catch (err) {
    console.error('[TelecomRoutes] /mail/unread-count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/mail/bulk-read-status
router.post('/mail/bulk-read-status', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { mail_ids, is_read } = req.body || {};
    if (!Array.isArray(mail_ids) || typeof is_read !== 'boolean') {
      res.status(400).json({ error: 'mail_ids (array) dan is_read (boolean) wajib diisi.' });
      return;
    }
    const resolved = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolved?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolved?.ngopi_email || telecomService.formatEmail(user.username, user.id);
    const result = telecomService.bulkUpdateMailReadStatus(user, ngopiNumber, ngopiEmail, mail_ids, is_read);
    try {
      const io = getSocketIO();
      if (io) {
        io.to(user.id).emit('telecom_unread_count', { unread_count: result.unread_count });
      }
    } catch {}
    res.status(200).json(result);
  } catch (err) {
    console.error('[TelecomRoutes] /mail/bulk-read-status error:', err);
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

// GET /api/telecom/mail/:id
router.get('/mail/:id', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const resolved = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolved?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolved?.ngopi_email || telecomService.formatEmail(user.username, user.id);
    const mail = telecomService.getMailDetailForUser(user, ngopiNumber, ngopiEmail, String(req.params.id || ''));
    if (!mail) {
      res.status(404).json({ error: 'Pesan tidak ditemukan atau kamu tidak memiliki akses.' });
      return;
    }
    res.status(200).json({ mail });
  } catch (err) {
    console.error('[TelecomRoutes] GET /mail/:id error:', err);
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
    const { to, subject, body, attachments } = req.body || {};
    const result = await telecomService.sendMail(
      user,
      String(to ?? ''),
      String(subject ?? ''),
      String(body ?? ''),
      Array.isArray(attachments) ? attachments : undefined
    );
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    if (result.mail) {
      try {
        const io = getSocketIO();
        if (io) {
          io.to(result.mail.to_user_id).emit('telecom_new_mail', result.mail);
          const recipientResolved = await telecomService.resolveUserByIdentifier(result.mail.to_user_id);
          if (recipientResolved) {
            const recipientUnread = telecomService.getUnreadCountForUser(
              { id: recipientResolved.id, username: recipientResolved.username, role: recipientResolved.role, bmc_id: recipientResolved.bmc_id },
              recipientResolved.ngopi_number,
              recipientResolved.ngopi_email
            );
            io.to(result.mail.to_user_id).emit('telecom_unread_count', { unread_count: recipientUnread });
          }
        }
      } catch {}
    }
    res.status(201).json({
      message: 'Pesan berhasil dikirim!',
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
    const resolved = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolved?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolved?.ngopi_email || telecomService.formatEmail(user.username, user.id);
    const result = telecomService.markMailRead(user, ngopiNumber, ngopiEmail, String(req.params.id || ''));
    if (!result.success) {
      res.status(404).json({ error: 'Pesan tidak ditemukan atau bukan milik akun kamu.' });
      return;
    }
    try {
      const io = getSocketIO();
      if (io) {
        io.to(user.id).emit('telecom_unread_count', { unread_count: result.unread_count });
      }
    } catch {}
    res.status(200).json({ ok: true, changed: result.changed, mail: result.mail, unread_count: result.unread_count });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/mail/:id/unread
router.post('/mail/:id/unread', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const resolved = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolved?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolved?.ngopi_email || telecomService.formatEmail(user.username, user.id);
    const result = telecomService.markMailUnread(user, ngopiNumber, ngopiEmail, String(req.params.id || ''));
    if (!result.success) {
      res.status(404).json({ error: 'Pesan tidak ditemukan atau bukan milik akun kamu.' });
      return;
    }
    try {
      const io = getSocketIO();
      if (io) {
        io.to(user.id).emit('telecom_unread_count', { unread_count: result.unread_count });
      }
    } catch {}
    res.status(200).json({ ok: true, changed: result.changed, mail: result.mail, unread_count: result.unread_count });
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

// =========================================================================
// IDENTITAS NGOPI: PACKAGES, RECOMMENDATIONS, ORDERS, WEBHOOK & VIP REQUEST
// =========================================================================

// GET /api/telecom/packages
router.get('/packages', verifyJWT, async (_req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      packages: telecomService.getPackages(),
      premium_config: telecomService.getPremiumConfig(),
    });
  } catch (err) {
    console.error('[TelecomRoutes] /packages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/recommendations
router.get('/recommendations', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const recommendations = await telecomService.getAvailableRecommendations(user);
    res.status(200).json(recommendations);
  } catch (err) {
    console.error('[TelecomRoutes] /recommendations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/orders/checkout
router.post('/orders/checkout', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { package_code, requested_number, requested_email, payment_method } = req.body || {};
    const result = await telecomService.createOrderCheckout(user, {
      package_code: String(package_code || ''),
      requested_number: requested_number !== undefined ? String(requested_number) : undefined,
      requested_email: requested_email !== undefined ? String(requested_email) : undefined,
      payment_method: payment_method !== undefined ? String(payment_method) : undefined,
    });
    if (!result.success) {
      res.status(result.statusCode || 400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      message: 'Pesanan berhasil dibuat dan identitas direservasi selama 30 menit.',
      order: result.order,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /orders/checkout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/orders/:id/submit-proof
router.post('/orders/:id/submit-proof', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { proof_url, payment_reference, bank_sender_name } = req.body || {};
    const result = await telecomService.submitOrderProof(user, String(req.params.id || ''), {
      proof_url: proof_url !== undefined ? String(proof_url) : undefined,
      payment_reference: payment_reference !== undefined ? String(payment_reference) : undefined,
      bank_sender_name: bank_sender_name !== undefined ? String(bank_sender_name) : undefined,
    });
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({
      message: result.message,
      order: result.order,
      auto_activated: Boolean(result.autoActivated),
    });
  } catch (err) {
    console.error('[TelecomRoutes] /orders/:id/submit-proof error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/orders/webhook (HMAC-SHA256 verified)
router.post('/orders/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = String(req.headers['x-ngopi-signature'] || req.headers['x-webhook-signature'] || '');
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const result = await telecomService.processPaymentWebhook(req.body || {}, rawBody, signature);
    if (!result.success) {
      res.status(result.statusCode || 400).json({ error: result.error });
      return;
    }
    res.status(200).json({
      ok: true,
      already_activated: Boolean(result.alreadyActivated),
      order: result.order,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /orders/webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/orders/my
router.get('/orders/my', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.status(200).json({ orders: telecomService.getMyOrders(user.id) });
  } catch (err) {
    console.error('[TelecomRoutes] /orders/my error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/vip-requests
router.post('/vip-requests', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { requested_number, requested_email, notes } = req.body || {};
    const result = telecomService.createVipRequest(user, {
      requested_number: requested_number !== undefined ? String(requested_number) : undefined,
      requested_email: requested_email !== undefined ? String(requested_email) : undefined,
      notes: notes !== undefined ? String(notes) : undefined,
    });
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(201).json({
      message: 'Permintaan identitas khusus telah dikirim ke Tim Ngopi.',
      request: result.request,
    });
  } catch (err) {
    console.error('[TelecomRoutes] /vip-requests error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/vip-requests
router.get('/vip-requests', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.status(200).json({ requests: telecomService.listVipRequests(user) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/admin/orders
router.get('/admin/orders', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user || !telecomService.isFounderUser(user)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.status(200).json({ orders: telecomService.getAllOrdersForAdmin(user) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/telecom/admin/orders/:id/approve
router.post('/admin/orders/:id/approve', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user || !telecomService.isFounderUser(user)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { action, admin_note } = req.body || {};
    const act = action === 'reject' ? 'reject' : 'approve';
    const result = await telecomService.approveOrderByAdmin(user, String(req.params.id || ''), act, admin_note);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({
      message: act === 'approve' ? 'Pesanan disetujui dan Identitas Ngopi diaktifkan.' : 'Pesanan ditolak.',
      order: result.order,
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/telecom/admin/packages/:code
router.put('/admin/packages/:code', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user || !telecomService.isFounderUser(user)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const result = telecomService.updatePackageByAdmin(user, String(req.params.code || ''), req.body || {});
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({ package: result.package });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/telecom/admin/vip-requests/:id
router.put('/admin/vip-requests/:id', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user || !telecomService.isFounderUser(user)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const { status, admin_note } = req.body || {};
    const validStatus = status === 'approved' || status === 'rejected' ? status : 'reviewed';
    const result = telecomService.adminUpdateVipRequest(user, String(req.params.id || ''), validStatus, admin_note);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.status(200).json({ request: result.request });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/telecom/admin/audit-logs
router.get('/admin/audit-logs', verifyJWT, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await getAuthenticatedDbUser(req);
    if (!user || !telecomService.isFounderUser(user)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    res.status(200).json({ audit_logs: telecomService.getAdminAuditLogs(user) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
