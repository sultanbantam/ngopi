import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireDbRole } from '../middleware/rbac.middleware';
import { prisma } from '../utils/prisma';
import { pointsEconomyService } from '../services/points.service';
import { telecomService } from '../services/telecom.service';
import {
  earnPoints,
  ensureUserIdentity,
  getActiveCommissionRule,
  profileSlug,
  registerReferral,
} from '../services/ngopinomic/ngopinomicEconomy.service';
import {
  cancelReservation,
  listMarketplaceIdentities,
  purchasePremiumIdentity,
  reservePremiumIdentity,
  returnInventoryItem,
} from '../services/ngopinomic/ngopinomicMarketplace.service';
import {
  authorizeBoomBoomIdentity,
  getBmcGatewayStatus,
  setEcosystemConsent,
} from '../services/ngopinomic/ngopinomicEcosystem.service';
import {
  processTransactionReversal,
  updateCommissionRuleConfig,
  upsertPremiumInventoryItem,
} from '../services/ngopinomic/ngopinomicAdmin.service';

const router = Router();

const ngopinomicWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: false,
  message: { error: 'Terlalu banyak permintaan NGOPINOMIC. Silakan tunggu sebentar.' },
});

const getDbUser = async (req: AuthRequest) => {
  const userId = req.user?.id;
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, display_name: true, role: true, bmc_id: true },
  });
};

// GET /api/ngopinomic/rules — Public transparency & rules center
router.get('/rules', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rule = await getActiveCommissionRule(prisma);
    res.status(200).json({
      success: true,
      title: 'Pusat Aturan & Transparansi NGOPINOMIC',
      disclosures: [
        'Poin Ngopi adalah poin loyalitas dalam aplikasi dan bukan uang tunai ataupun token BMC.',
        'Manfaat BMC berjalan dalam mode terkendali dan terpisah dari Poin Ngopi serta Rupiah.',
        'Komisi dihitung dari Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih) setelah dikurangi pajak, biaya layanan, infrastruktur, cadangan atau penyesuaian refund tanpa pemotongan ganda, dan biaya operasional yang berlaku.',
        'Tidak ada jaminan pendapatan tetap, kenaikan nilai token, atau hasil komisi tertentu.',
      ],
      commission_policy: {
        direct_percent: rule.direct_rate_bps / 100,
        level2_percent: rule.level2_rate_bps / 100,
        ambassador_max_percent: rule.ambassador_max_bps / 100,
        promoter_range_percent: [rule.promoter_min_bps / 100, rule.promoter_max_bps / 100],
        max_total_cap_percent: rule.max_total_cap_bps / 100,
        settlement_days: rule.settlement_days,
        bmc_utility_enabled: rule.bmc_utility_enabled,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// All endpoints below require verified JWT
router.use(verifyJWT);

// GET /api/ngopinomic/dashboard — Simple Indonesian user-facing dashboard summary
router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const identity = await prisma.$transaction(async (tx: any) => ensureUserIdentity(tx, user));
    pointsEconomyService.syncWithPointsManager(user.id, user.username);
    const econPoints = pointsEconomyService.getOrCreateUserPoints(user.id);

    const [pointsAccount, affiliateProfile, walletIdr, community, premiumEmails, commissions, pointsHistory, bmcStatus] =
      await Promise.all([
        prisma.pointsAccount.findUnique({ where: { user_id: user.id } }),
        prisma.affiliateProfile.findUnique({ where: { user_id: user.id } }),
        prisma.walletAccount.findUnique({ where: { user_id_instrument: { user_id: user.id, instrument: 'IDR' } } }),
        prisma.communityMembership.findUnique({ where: { user_id: user.id } }),
        prisma.emailIdentity.findMany({ where: { user_id: user.id, status: 'active' } }),
        prisma.commissionTransaction.findMany({
          where: { beneficiary_user_id: user.id },
          orderBy: { created_at: 'desc' },
          take: 15,
        }),
        prisma.pointsTransaction.findMany({
          where: { user_id: user.id },
          orderBy: { created_at: 'desc' },
          take: 15,
        }),
        getBmcGatewayStatus(prisma, user.id),
      ]);

    const ngopiBalance = pointsAccount?.balance ?? 0;
    const unifiedBalance = Math.max(ngopiBalance, econPoints.balance);
    if (pointsAccount && econPoints.balance > ngopiBalance) {
      await prisma.pointsAccount.update({
        where: { user_id: user.id },
        data: { balance: econPoints.balance },
      });
    } else if (ngopiBalance > econPoints.balance) {
      pointsEconomyService.syncExternalCredit(
        user.id,
        ngopiBalance - econPoints.balance,
        'Sinkronisasi saldo NGOPINOMIC <-> Ekonomi Ngopi'
      );
    }

    const telecomNumber = telecomService.getNumberForUser(user);
    const telecomEmail = telecomService.formatEmail(user.username, user.id);
    const canonicalCode = affiliateProfile?.referral_code || profileSlug(user.display_name || user.username);
    const profileLink = `https://ngopi.top/${encodeURIComponent(canonicalCode)}`;

    let latestMou: any = null;
    try {
      if ((prisma as any).digitalMouAgreement) {
        latestMou = await (prisma as any).digitalMouAgreement.findFirst({
          where: { user_id: user.id },
          orderBy: { signed_at: 'desc' },
        });
      }
    } catch {
      latestMou = null;
    }

    const referralCount = await prisma.referralRelationship.count({
      where: { referrer_user_id: user.id },
    });

    res.status(200).json({
      success: true,
      welcome: {
        title: 'Selamat datang di NGOPINOMIC',
        subtitle:
          'Gunakan identitas Ngopi untuk terhubung dengan berbagai layanan dalam ekosistem BaMbooChain. Kumpulkan Poin Ngopi, undang teman, nikmati manfaat, dan dapatkan komisi dari transaksi yang memenuhi ketentuan.',
      },
      my_identity: {
        ...identity,
        ngopi_number: telecomNumber,
        ngopi_email: telecomEmail,
        synced_with_identitas_ngopi: true,
      },
      my_emails: [
        { email_address: telecomEmail, is_primary: true, type: 'basic' },
        ...premiumEmails
          .filter((e: any) => e.email_address !== telecomEmail)
          .map((e: any) => ({ email_address: e.email_address, is_primary: e.is_primary, type: 'premium' })),
      ],
      my_points: {
        label: 'Poin Ngopi',
        balance: unifiedBalance,
        lifetime_earned: Math.max(pointsAccount?.lifetime_earned ?? 0, econPoints.lifetime),
        lifetime_redeemed: Math.max(pointsAccount?.lifetime_redeemed ?? 0, econPoints.spent),
        streak_days: econPoints.streak_days || 0,
        synced_with_economy: true,
      },
      my_commissions: {
        label: 'Komisi Saya',
        available_idr: walletIdr?.available_balance ?? 0,
        pending_idr: walletIdr?.pending_balance ?? 0,
        payout_preference: affiliateProfile?.payout_preference ?? 'rupiah',
        explanation:
          'Komisi dihitung dari Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih) setelah dikurangi pajak, biaya layanan, infrastruktur, refund, dan biaya operasional yang berlaku.',
        recent: commissions,
      },
      my_bmc_benefits: {
        label: 'Manfaat BMC',
        ...bmcStatus,
      },
      my_referral: {
        label: 'Undang Teman',
        referral_code: canonicalCode,
        profile_link: profileLink,
        referral_link: `https://ngopi.top/register?ref=${encodeURIComponent(canonicalCode)}`,
        total_invited: referralCount,
        synced_with_profile_link: true,
      },
      my_community: community,
      my_mou: latestMou,
      transaction_history: pointsHistory,
    });
  } catch (err: any) {
    console.error('[Ngopinomic] dashboard error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/ngopinomic/marketplace/identities
router.get('/marketplace/identities', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const items = await listMarketplaceIdentities(prisma, { category, status });
    res.status(200).json({ success: true, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/ngopinomic/marketplace/reserve
router.post('/marketplace/reserve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { inventory_id } = req.body || {};
    if (!inventory_id || typeof inventory_id !== 'string') {
      res.status(400).json({ error: 'inventory_id wajib diisi.' });
      return;
    }
    const reserved = await prisma.$transaction(async (tx: any) =>
      reservePremiumIdentity(tx, { inventoryId: inventory_id, userId: user.id })
    );
    res.status(200).json({ success: true, inventory: reserved });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal mereservasi identitas.' });
  }
});

// POST /api/ngopinomic/marketplace/cancel-reservation
router.post('/marketplace/cancel-reservation', ngopinomicWriteLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { inventory_id } = req.body || {};
    if (!inventory_id || typeof inventory_id !== 'string') {
      res.status(400).json({ error: 'inventory_id wajib diisi.' });
      return;
    }
    const released = await prisma.$transaction(async (tx: any) =>
      cancelReservation(tx, { inventoryId: inventory_id, userId: user.id })
    );
    res.status(200).json({ success: true, inventory: released });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal membatalkan reservasi.' });
  }
});

// POST /api/ngopinomic/marketplace/purchase
router.post('/marketplace/purchase', ngopinomicWriteLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { inventory_id, payment_method, idempotency_key, payment_confirmation } = req.body || {};
    if (!inventory_id || typeof inventory_id !== 'string') {
      res.status(400).json({ error: 'inventory_id wajib diisi.' });
      return;
    }
    const method = payment_method === 'points' ? 'points' : 'rupiah';
    const idemKey =
      typeof idempotency_key === 'string' && idempotency_key.trim()
        ? idempotency_key.trim()
        : `buy:${user.id}:${inventory_id}`;

    const result = await prisma.$transaction(async (tx: any) =>
      purchasePremiumIdentity(tx, {
        inventoryId: inventory_id,
        user,
        paymentMethod: method,
        idempotencyKey: idemKey,
        paymentConfirmation: payment_confirmation,
      })
    );
    res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal memproses pembelian identitas.' });
  }
});

// POST /api/ngopinomic/points/claim — Server-determined reward only (no client-controlled amount)
router.post('/points/claim', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { activity_code } = req.body || {};
    if (activity_code !== 'daily_checkin') {
      res.status(400).json({ error: 'Aktivitas klaim langsung yang didukung saat ini hanya daily_checkin.' });
      return;
    }

    // Check-in harian menggunakan aturan tunggal Ekonomi Ngopi & BMC Token (Siklus 07.00-07.00 WIB, streak 1..20 poin)
    pointsEconomyService.syncWithPointsManager(user.id, user.username);
    const streakResult = pointsEconomyService.claimDailyStreak(user.id);
    const today = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `checkin:${user.id}:${today}`;

    if (!streakResult.awarded) {
      const existingTx = await prisma.pointsTransaction.findUnique({
        where: { idempotency_key: idempotencyKey },
      });
      res.status(200).json({
        success: true,
        idempotent: true,
        awarded: false,
        streak: streakResult.streak,
        pointsAdded: 0,
        newBalance: streakResult.newBalance,
        message: streakResult.message,
        transaction: existingTx,
      });
      return;
    }

    const result = await prisma.$transaction(async (tx: any) =>
      earnPoints(tx, {
        userId: user.id,
        activityCode: 'daily_checkin',
        amount: streakResult.pointsAdded,
        idempotencyKey,
        description: streakResult.message,
        metadata: { date: today, streak: streakResult.streak, source: 'ekonomi_ngopi_streak' },
      })
    );

    res.status(200).json({
      success: true,
      ...result,
      awarded: true,
      streak: streakResult.streak,
      pointsAdded: streakResult.pointsAdded,
      newBalance: streakResult.newBalance,
      message: streakResult.message,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal mengklaim poin.' });
  }
});

// POST /api/ngopinomic/referral/register
router.post('/referral/register', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { referral_code } = req.body || {};
    if (!referral_code || typeof referral_code !== 'string') {
      res.status(400).json({ error: 'referral_code wajib diisi.' });
      return;
    }
    const rel = await prisma.$transaction(async (tx: any) =>
      registerReferral(tx, { referredUserId: user.id, referralCode: referral_code })
    );
    res.status(200).json({ success: true, relationship: rel });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal mendaftarkan referral.' });
  }
});

// GET /api/ngopinomic/points/history — Append-only points transaction history
router.get('/points/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const transactions = await prisma.pointsTransaction.findMany({
      where: { user_id: user.id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.status(200).json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/ngopinomic/affiliate/commissions — Transparent commission breakdown
router.get('/affiliate/commissions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const commissions = await prisma.commissionTransaction.findMany({
      where: { beneficiary_user_id: user.id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.status(200).json({
      success: true,
      basis_label: 'Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih)',
      commissions,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// PATCH /api/ngopinomic/affiliate/preference
router.patch('/affiliate/preference', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { payout_preference } = req.body || {};
    if (payout_preference !== 'rupiah' && payout_preference !== 'points') {
      res.status(400).json({ error: 'payout_preference harus "rupiah" atau "points".' });
      return;
    }
    await ensureUserIdentity(prisma, user);
    const updated = await prisma.affiliateProfile.update({
      where: { user_id: user.id },
      data: { payout_preference },
    });
    res.status(200).json({ success: true, affiliate_profile: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal mengubah preferensi komisi.' });
  }
});

// POST /api/ngopinomic/ecosystem/consent
router.post('/ecosystem/consent', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { app_code, scopes, revoke } = req.body || {};
    if (!app_code || typeof app_code !== 'string') {
      res.status(400).json({ error: 'app_code wajib diisi.' });
      return;
    }
    const consent = await setEcosystemConsent(prisma, {
      userId: user.id,
      appCode: app_code,
      grantedScopes: Array.isArray(scopes) ? scopes : ['identity:basic'],
      revoke: Boolean(revoke),
    });
    res.status(200).json({ success: true, consent });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menyimpan persetujuan ekosistem.' });
  }
});

// POST /api/ngopinomic/boomboom/authorize-identity
router.post('/boomboom/authorize-identity', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { requested_role, required_scope } = req.body || {};
    const validRoles = ['passenger', 'driver', 'courier', 'sender', 'receiver', 'logistics_partner'];
    if (!validRoles.includes(requested_role)) {
      res.status(400).json({ error: 'requested_role BoomBoom tidak valid.' });
      return;
    }
    const authPayload = await authorizeBoomBoomIdentity(prisma, {
      user,
      requestedRole: requested_role,
      requiredScope: typeof required_scope === 'string' ? required_scope : 'identity:basic',
    });
    res.status(200).json({ success: true, ...authPayload });
  } catch (err: any) {
    res.status(403).json({ error: err.message || 'Otorisasi identitas BoomBoom ditolak.' });
  }
});

// ============================================================
// ADMIN CONTROL CENTER (/api/ngopinomic/admin/*)
// Strictly protected by database-backed RBAC (admin/superadmin)
// ============================================================

router.get('/admin/config', requireDbRole('admin', 'superadmin'), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [rule, inventory, auditLogs, fraudEvents, ledgerTransactions] = await Promise.all([
      getActiveCommissionRule(prisma),
      listMarketplaceIdentities(prisma),
      prisma.adminAuditLog.findMany({ orderBy: { created_at: 'desc' }, take: 25 }),
      prisma.fraudEvent.findMany({ orderBy: { created_at: 'desc' }, take: 25 }),
      prisma.ledgerTransaction.findMany({ orderBy: { created_at: 'desc' }, take: 25 }),
    ]);
    res.status(200).json({
      success: true,
      rule,
      inventory,
      audit_logs: auditLogs,
      fraud_events: fraudEvents,
      ledger_transactions: ledgerTransactions,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.put('/admin/commission-rules', requireDbRole('admin', 'superadmin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actor = await getDbUser(req);
    if (!actor) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { reason, ...updates } = req.body || {};
    const updated = await prisma.$transaction(async (tx: any) =>
      updateCommissionRuleConfig(tx, { actorUserId: actor.id, reason, updates })
    );
    res.status(200).json({ success: true, rule: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal memperbarui aturan komisi.' });
  }
});

router.post('/admin/inventory', requireDbRole('admin', 'superadmin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actor = await getDbUser(req);
    if (!actor) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { category, display_value, rarity_tier, price_idr, price_points, reason } = req.body || {};
    const saved = await prisma.$transaction(async (tx: any) =>
      upsertPremiumInventoryItem(tx, {
        actorUserId: actor.id,
        reason,
        category,
        display_value,
        rarity_tier,
        price_idr: Number(price_idr),
        price_points: price_points ? Number(price_points) : null,
      })
    );
    res.status(200).json({ success: true, inventory: saved });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menyimpan inventaris premium.' });
  }
});

router.post('/admin/inventory/:id/return', requireDbRole('admin', 'superadmin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actor = await getDbUser(req);
    if (!actor) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { reason } = req.body || {};
    const updated = await prisma.$transaction(async (tx: any) =>
      returnInventoryItem(tx, {
        inventoryId: String(req.params.id),
        actorUserId: actor.id,
        reason,
      })
    );
    res.status(200).json({ success: true, inventory: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal mengembalikan inventaris.' });
  }
});

// GET /api/ngopinomic/mou — Draft MoU Digital Kemitraan Ekosistem & riwayat MoU user
router.get('/mou', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const signedMous = (prisma as any).digitalMouAgreement
      ? await (prisma as any).digitalMouAgreement.findMany({
          where: { user_id: user.id },
          orderBy: { signed_at: 'desc' },
        })
      : [];

    res.status(200).json({
      success: true,
      version: 'v1.0-2026',
      title: 'MoU Digital Kemitraan Ekosistem ngopi.top & BaMbooChain',
      clauses: [
        '1. Ruang Lingkup Kerja Sama: Mitra berperan aktif membangun komunitas, memperkenalkan identitas Ngopi (@ngopi.top), merchant warkop, atau kampanye resmi ekosistem ngopi.top.',
        '2. Dasar Perhitungan Komisi (NDR): Seluruh komisi afiliasi (Direct 20%, Level-2 5%, Ambassador maks. 5%, Campaign Promoter 5-10%, dengan batas total 35%) dihitung murni dari Pendapatan Bersih yang Dapat Dibagikan (NDR) atas transaksi sah.',
        '3. Transparansi Poin & BMC: Poin Ngopi adalah poin loyalitas dalam aplikasi (bukan uang tunai), dan manfaat token BMC tunduk pada mode terkendali serta regulasi Republik Indonesia.',
        '4. Integritas & Kepatuhan: Mitra dilarang melakukan spam, akun ganda, self-referral, transaksi fiktif, atau klaim sepihak yang menjanjikan keuntungan pasti. Pelanggaran berakibat pembatalan komisi dan pencabutan MoU.',
        '5. Kepatuhan UU PDP & Hubungan Independen: Mitra wajib menjaga privasi data pengguna sesuai UU PDP No. 27 Tahun 2022. Kerja sama ini bersifat kemitraan independen, bukan hubungan ketenagakerjaan.',
      ],
      signed_mous: signedMous,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal memuat MoU Digital.' });
  }
});

// POST /api/ngopinomic/mou/sign — Penandatanganan MoU Digital secara eksplisit
router.post('/mou/sign', ngopinomicWriteLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getDbUser(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { full_name, partnership_role, signature_text, agreed_to_terms } = req.body || {};
    if (agreed_to_terms !== true) {
      res.status(400).json({ error: 'Anda wajib mencentang persetujuan isi MoU sebelum menandatangani.' });
      return;
    }
    if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 3) {
      res.status(400).json({ error: 'Nama lengkap minimal 3 karakter wajib diisi.' });
      return;
    }
    if (!signature_text || typeof signature_text !== 'string' || signature_text.trim().length < 3) {
      res.status(400).json({ error: 'Tanda tangan digital (ketik nama lengkap) minimal 3 karakter wajib diisi.' });
      return;
    }
    const allowedRoles = ['affiliate_partner', 'community_ambassador', 'merchant_partner', 'ecosystem_builder'];
    const role = allowedRoles.includes(partnership_role) ? partnership_role : 'affiliate_partner';

    const ngopiNumber = telecomService.getNumberForUser(user);
    const mouVersion = 'v1.0-2026';
    const signedAt = new Date();
    const dateStamp = signedAt.toISOString().slice(0, 10).replace(/-/g, '');
    const mouNumber = `MOU-NGP-${dateStamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const signatureHash = crypto
      .createHash('sha256')
      .update(`${user.id}|${ngopiNumber}|${mouVersion}|${role}|${signature_text.trim()}|${signedAt.toISOString()}`)
      .digest('hex');

    const created = await (prisma as any).digitalMouAgreement.create({
      data: {
        user_id: user.id,
        ngopi_id: ngopiNumber,
        full_name: full_name.trim(),
        partnership_role: role,
        mou_version: mouVersion,
        mou_number: mouNumber,
        signature_text: signature_text.trim(),
        signature_hash: signatureHash,
        status: 'signed',
        signed_at: signedAt,
      },
    });

    res.status(200).json({ success: true, mou: created });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal menandatangani MoU Digital.' });
  }
});

router.post('/admin/transactions/:txId/reverse', requireDbRole('admin', 'superadmin'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const actor = await getDbUser(req);
    if (!actor) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { reason } = req.body || {};
    const result = await prisma.$transaction(async (tx: any) =>
      processTransactionReversal(tx, {
        actorUserId: actor.id,
        ledgerTxId: String(req.params.txId),
        reason,
      })
    );
    res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Gagal membalik transaksi.' });
  }
});

export default router;

