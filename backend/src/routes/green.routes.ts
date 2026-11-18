import { Router, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireDbRole } from '../middleware/rbac.middleware';
import { prisma } from '../utils/prisma';
import { pointsEconomyService } from '../services/points.service';
import { earnPoints, redeemPoints } from '../services/ngopinomic/ngopinomicEconomy.service';
import { ensureGreenSeeded } from '../services/green/greenCatalog.seed';
import {
  createGreenSubmission,
  verifyGreenSubmission,
} from '../services/green/greenSubmission.service';

const router = Router();

/** Convert Prisma Decimal ({ s, e, d }) objects into plain JS numbers recursively. */
function serializeDecimals<T>(val: T): T {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (val instanceof Date) return val;
  const anyVal = val as any;
  if (typeof anyVal.toNumber === 'function' && 's' in anyVal && 'e' in anyVal && Array.isArray(anyVal.d)) {
    return Number(anyVal.toString()) as unknown as T;
  }
  if ('s' in anyVal && 'e' in anyVal && Array.isArray(anyVal.d) && Object.keys(anyVal).length <= 4) {
    return Number(String(anyVal)) as unknown as T;
  }
  if (Array.isArray(val)) return val.map((item) => serializeDecimals(item)) as unknown as T;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(anyVal)) {
    out[k] = serializeDecimals(v);
  }
  return out as T;
}

router.get('/catalog', async (_req, res: Response) => {
  try {
    await ensureGreenSeeded(prisma);
    const [categories, activityTypes, emissionFactors, rewardRules, challenges] = await Promise.all([
      prisma.greenActivityCategory.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
      }),
      prisma.greenActivityType.findMany({
        where: { is_active: true },
        orderBy: { code: 'asc' },
      }),
      prisma.greenEmissionFactor.findMany({
        where: { is_active: true },
        orderBy: { code: 'asc' },
      }),
      prisma.greenRewardRule.findMany({
        where: { is_active: true },
        orderBy: { activity_type_code: 'asc' },
      }),
      prisma.greenChallenge.findMany({
        where: { is_active: true },
        orderBy: { start_date: 'desc' },
      }),
    ]);

    return res.json(
      serializeDecimals({
        ok: true,
        categories,
        activityTypes,
        emissionFactors,
        rewardRules,
        challenges,
      })
    );
  } catch (err: any) {
    console.error('GET /api/green/catalog error:', err);
    return res.status(500).json({ error: 'Failed to load NGOPI GREEN catalog' });
  }
});

router.get('/dashboard', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await ensureGreenSeeded(prisma);

    const [dbUser, pointsAcc, submissions, plants, memberships, challenges] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
      prisma.pointsAccount.findUnique({ where: { user_id: userId } }),
      prisma.greenSubmission.findMany({
        where: { user_id: userId },
        include: { evidences: true, impactRecords: true, verifications: true },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
      prisma.greenPlant.findMany({
        where: { user_id: userId },
        include: { monitorings: { orderBy: { recorded_at: 'desc' }, take: 3 } },
        orderBy: { planted_at: 'desc' },
      }),
      prisma.greenChallengeMember.findMany({ where: { user_id: userId } }),
      prisma.greenChallenge.findMany({ where: { is_active: true } }),
    ]);

    // Sync canonical balance with Warkop pointsEconomyService
    pointsEconomyService.syncWithPointsManager(userId, req.user?.username);
    const legacyPts = pointsEconomyService.getUserPoints(userId)?.balance ?? 0;
    const canonicalBalance = Math.max(pointsAcc?.balance ?? 0, legacyPts);

    const counts = {
      total: submissions.length,
      pending: submissions.filter((s) => s.status === 'pending' || s.status === 'under_review').length,
      verified: submissions.filter((s) => s.status === 'verified').length,
      rejected: submissions.filter((s) => s.status === 'rejected').length,
      needs_info: submissions.filter((s) => s.status === 'needs_info').length,
    };

    // Aggregate ONLY verified impact records
    let avoidedCo2e = 0;
    let wasteManagedKg = 0;
    let waterSavedLiters = 0;
    let energySavedKwh = 0;
    let greenPointsEarned = 0;

    for (const sub of submissions) {
      if (sub.status !== 'verified') continue;
      greenPointsEarned += sub.awarded_points || 0;
      for (const imp of sub.impactRecords) {
        if (imp.avoided_emissions_kgco2e) avoidedCo2e += Number(imp.avoided_emissions_kgco2e);
        if (imp.waste_prevented_kg) wasteManagedKg += Number(imp.waste_prevented_kg);
        if (imp.water_saved_liters) waterSavedLiters += Number(imp.water_saved_liters);
        if (imp.energy_saved_kwh) energySavedKwh += Number(imp.energy_saved_kwh);
      }
    }

    const totalPlantsCount = plants.reduce((acc, p) => acc + (p.quantity || 0), 0);
    const ecoLevel =
      greenPointsEarned >= 500
        ? 'Eco Guardian'
        : greenPointsEarned >= 150
        ? 'Eco Steward'
        : greenPointsEarned >= 30
        ? 'Eco Explorer'
        : 'Eco Starter';

    return res.json({
      ok: true,
      userRole: (dbUser?.role || req.user?.role || 'user').toLowerCase(),
      pointsBalance: canonicalBalance,
      greenPointsEarned,
      ecoLevel,
      counts,
      impact: {
        avoided_emissions_kgco2e: Number(avoidedCo2e.toFixed(4)),
        waste_prevented_kg: Number(wasteManagedKg.toFixed(4)),
        water_saved_liters: Number(waterSavedLiters.toFixed(2)),
        energy_saved_kwh: Number(energySavedKwh.toFixed(4)),
        plants_count: totalPlantsCount,
      },
      recentSubmissions: submissions.slice(0, 15),
      plants,
      joinedChallengeIds: memberships.map((m) => m.challenge_id),
      challenges,
    });
  } catch (err: any) {
    console.error('GET /api/green/dashboard error:', err);
    return res.status(500).json({ error: 'Failed to load NGOPI GREEN dashboard' });
  }
});

router.get('/submissions', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const where: any = { user_id: userId };
    if (category && category !== 'all') where.category_code = category;
    if (status && status !== 'all') where.status = status;

    const items = await prisma.greenSubmission.findMany({
      where,
      include: { evidences: true, verifications: true, impactRecords: true },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return res.json({ ok: true, items: serializeDecimals(items) });
  } catch (err: any) {
    console.error('GET /api/green/submissions error:', err);
    return res.status(500).json({ error: 'Failed to load submissions' });
  }
});

router.post('/submissions', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await ensureGreenSeeded(prisma);

    const {
      activityTypeCode,
      title,
      description,
      quantity,
      activityDate,
      locationName,
      latitude,
      longitude,
      locationConsent,
      isPublic,
      metadata,
      evidences,
    } = req.body || {};

    const submission = await createGreenSubmission(prisma, {
      userId,
      activityTypeCode: String(activityTypeCode || ''),
      title: String(title || ''),
      description: description ? String(description) : undefined,
      quantity: Number(quantity),
      activityDate: activityDate ? String(activityDate) : undefined,
      locationName: locationName ? String(locationName) : undefined,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      locationConsent: Boolean(locationConsent),
      isPublic: Boolean(isPublic),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
      evidences: Array.isArray(evidences) ? evidences : [],
    });

    return res.status(201).json({ ok: true, submission });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to submit activity' });
  }
});

router.delete('/submissions/:id', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = String(req.params.id || '');
    const sub = await prisma.greenSubmission.findUnique({ where: { id } });
    if (!sub || sub.user_id !== userId) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (sub.status !== 'pending' && sub.status !== 'needs_info') {
      return res.status(400).json({ error: 'Only pending or needs_info submissions can be deleted' });
    }
    await prisma.greenSubmission.delete({ where: { id } });
    return res.json({ ok: true, deletedId: id });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete submission' });
  }
});

router.get('/reports', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

    const where: any = {};
    if (category && category !== 'all') where.report_category = category;
    if (status && status !== 'all') where.status = status;

    const reports = await prisma.greenEnvironmentReport.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    // Strip private user_id from public-safe report list when anonymous
    const safeReports = reports.map((r) => ({
      id: r.id,
      report_category: r.report_category,
      subcategory: r.subcategory,
      title: r.title,
      description: r.description,
      severity: r.severity,
      status: r.status,
      is_anonymous: r.is_anonymous,
      public_area_label: r.public_area_label,
      approx_lat: r.approx_lat != null ? Number(r.approx_lat) : null,
      approx_lng: r.approx_lng != null ? Number(r.approx_lng) : null,
      created_at: r.created_at,
    }));

    return res.json({ ok: true, reports: safeReports });
  } catch (err: any) {
    console.error('GET /api/green/reports error:', err);
    return res.status(500).json({ error: 'Failed to load environmental reports' });
  }
});

router.post('/plants/:id/monitor', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const plantId = String(req.params.id || '');
    const plant = await prisma.greenPlant.findUnique({ where: { id: plantId } });
    if (!plant || plant.user_id !== userId) {
      return res.status(404).json({ error: 'Plant record not found' });
    }

    const healthStatus = String(req.body?.healthStatus || 'healthy');
    const notes = req.body?.notes ? String(req.body.notes).slice(0, 300) : null;

    const [monitoring, updatedPlant] = await prisma.$transaction([
      prisma.greenPlantMonitoring.create({
        data: {
          plant_id: plant.id,
          user_id: userId,
          health_status: healthStatus,
          notes,
        },
      }),
      prisma.greenPlant.update({
        where: { id: plant.id },
        data: { survival_status: healthStatus === 'dead' ? 'dead' : 'alive' },
      }),
    ]);

    return res.status(201).json({ ok: true, monitoring, plant: updatedPlant });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to record monitoring' });
  }
});

router.post('/challenges/:id/join', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const challengeId = String(req.params.id || '');
    const challenge = await prisma.greenChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || !challenge.is_active) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    const member = await prisma.greenChallengeMember.upsert({
      where: { challenge_id_user_id: { challenge_id: challengeId, user_id: userId } },
      create: {
        challenge_id: challengeId,
        user_id: userId,
        opt_in_board: Boolean(req.body?.optInBoard),
      },
      update: { opt_in_board: Boolean(req.body?.optInBoard) },
    });
    return res.json({ ok: true, member });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Failed to join challenge' });
  }
});

// ============================================================================
// ADMIN / MODERATION ENDPOINTS (Server-side RBAC: admin / superadmin)
// ============================================================================

router.get(
  '/admin/submissions',
  verifyJWT,
  requireDbRole('admin', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
      const where: any = {};
      if (status && status !== 'all') where.status = status;

      const items = await prisma.greenSubmission.findMany({
        where,
        include: { evidences: true, verifications: true, impactRecords: true },
        orderBy: { created_at: 'desc' },
        take: 100,
      });

      const userIds = Array.from(new Set(items.map((i) => i.user_id)));
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, username: true, display_name: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const enriched = items.map((item) => ({
        ...item,
        user: userMap.get(item.user_id) || { id: item.user_id, username: 'unknown', display_name: 'User' },
      }));

      return res.json({ ok: true, items: serializeDecimals(enriched) });
    } catch (err: any) {
      console.error('GET /api/green/admin/submissions error:', err);
      return res.status(500).json({ error: 'Failed to load admin queue' });
    }
  }
);

router.post(
  '/admin/submissions/:id/verify',
  verifyJWT,
  requireDbRole('admin', 'superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const reviewerId = req.user?.id;
      if (!reviewerId) return res.status(401).json({ error: 'Unauthorized' });

      const decision = String(req.body?.decision || '');
      const reason = String(req.body?.reason || '');
      if (!['verified', 'rejected', 'needs_info', 'reversed'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid verification decision' });
      }

      const result = await verifyGreenSubmission(prisma, {
        submissionId: String(req.params.id || ''),
        reviewerUserId: reviewerId,
        decision: decision as 'verified' | 'rejected' | 'needs_info' | 'reversed',
        reason,
      });

      return res.json({ ok: true, ...result });
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Verification failed' });
    }
  }
);

router.get(
  '/admin/audit-logs',
  verifyJWT,
  requireDbRole('admin', 'superadmin'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const logs = await prisma.greenAuditLog.findMany({
        orderBy: { created_at: 'desc' },
        take: 100,
      });
      return res.json({ ok: true, logs });
    } catch (err: any) {
      return res.status(500).json({ error: 'Failed to load audit logs' });
    }
  }
);

// =========================================================================
// ADMIN APPLICATION (DEPOSIT 500,000 NGOPI POINTS OR 500 BMC) & SUPERADMIN
// =========================================================================

const ADMIN_DEPOSIT_POINTS = 500_000;
const ADMIN_DEPOSIT_BMC = 500;

router.get('/admin-application/me', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const [dbUser, pointsAcc, applications] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { role: true, username: true } }),
      prisma.pointsAccount.findUnique({ where: { user_id: userId } }),
      prisma.greenAdminApplication.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
    ]);

    pointsEconomyService.syncWithPointsManager(userId, req.user?.username);
    const legacyPts = pointsEconomyService.getUserPoints(userId)?.balance ?? 0;
    const pointsBalance = Math.max(pointsAcc?.balance ?? 0, legacyPts);

    return res.json({
      ok: true,
      role: (dbUser?.role || 'user').toLowerCase(),
      pointsBalance,
      requiredPoints: ADMIN_DEPOSIT_POINTS,
      requiredBmc: ADMIN_DEPOSIT_BMC,
      applications,
    });
  } catch (err: any) {
    console.error('GET /api/green/admin-application/me error:', err);
    return res.status(500).json({ error: 'Failed to load admin application status' });
  }
});

router.post('/admin-application/apply', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const depositMethod = String(req.body?.depositMethod || '').trim().toLowerCase();
    const bmcTxRef = String(req.body?.bmcTxRef || '').trim();
    const notes = String(req.body?.notes || '').trim() || undefined;

    if (depositMethod !== 'points' && depositMethod !== 'bmc') {
      return res.status(400).json({ error: 'Pilih metode deposit: points (500.000) atau bmc (500).' });
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, username: true } });
    if (!dbUser) return res.status(404).json({ error: 'User tidak ditemukan.' });
    const currentRole = (dbUser.role || 'user').toLowerCase();
    if (currentRole === 'admin' || currentRole === 'superadmin') {
      return res.status(400).json({ error: `Akun Anda sudah memiliki role ${currentRole}.` });
    }

    const existingPending = await prisma.greenAdminApplication.findFirst({
      where: { user_id: userId, status: 'pending' },
    });
    if (existingPending) {
      return res.status(400).json({ error: 'Anda masih memiliki pengajuan admin yang menunggu persetujuan Founder.' });
    }

    if (depositMethod === 'points') {
      pointsEconomyService.syncWithPointsManager(userId, dbUser.username);
      const legacyPts = pointsEconomyService.getUserPoints(userId)?.balance ?? 0;
      const pointsAcc = await prisma.pointsAccount.findUnique({ where: { user_id: userId } });
      const currentBalance = Math.max(pointsAcc?.balance ?? 0, legacyPts);

      if (currentBalance < ADMIN_DEPOSIT_POINTS) {
        return res.status(400).json({
          error: `Saldo Poin Ngopi belum cukup (${currentBalance.toLocaleString('id-ID')} / ${ADMIN_DEPOSIT_POINTS.toLocaleString('id-ID')} poin).`,
        });
      }

      // Ensure PointsAccount has canonical balance before atomic redeemPoints
      if (!pointsAcc || pointsAcc.balance < ADMIN_DEPOSIT_POINTS) {
        const diff = currentBalance - (pointsAcc?.balance ?? 0);
        if (diff > 0) {
          await earnPoints(prisma, {
            userId,
            activityCode: 'legacy_balance_sync',
            amount: diff,
            idempotencyKey: `sync-before-admin-apply-${userId}-${Date.now()}`,
            description: 'Sinkronisasi saldo poin sebelum deposit pengajuan admin',
          });
        }
      }

      const idempKey = `green-admin-deposit-pts-${userId}-${Date.now()}`;
      const redeemRes = await redeemPoints(prisma, {
        userId,
        activityCode: 'admin_deposit_500k',
        amount: ADMIN_DEPOSIT_POINTS,
        idempotencyKey: idempKey,
        description: 'Deposit 500.000 Poin Ngopi untuk pengajuan Admin NGOPI GREEN',
        metadata: { deposit_method: 'points', required: ADMIN_DEPOSIT_POINTS },
      });

      pointsEconomyService.syncExternalSpend(
        userId,
        ADMIN_DEPOSIT_POINTS,
        'Deposit pengajuan Admin NGOPI GREEN',
        idempKey
      );

      const app = await prisma.greenAdminApplication.create({
        data: {
          user_id: userId,
          deposit_method: 'points',
          deposit_amount: ADMIN_DEPOSIT_POINTS,
          points_tx_id: redeemRes.txId,
          notes,
          status: 'pending',
        },
      });

      return res.status(201).json({ ok: true, application: app });
    }

    // depositMethod === 'bmc'
    if (bmcTxRef.length < 8) {
      return res.status(400).json({
        error: 'Masukkan hash/referensi transaksi deposit 500 Token BMC (minimal 8 karakter).',
      });
    }

    const bmcIdemp = `green-admin-deposit-bmc-${userId}-${Date.now()}`;
    await prisma.bmcTransaction.create({
      data: {
        user_id: userId,
        utility_code: 'admin_deposit_500bmc',
        amount_bmc: ADMIN_DEPOSIT_BMC,
        mode: 'controlled_live',
        status: 'recorded',
        reference_code: `BMC-ADM-${Date.now()}`,
        idempotency_key: bmcIdemp,
        metadata: { bmc_tx_ref: bmcTxRef, notes: notes || null },
      },
    });

    const app = await prisma.greenAdminApplication.create({
      data: {
        user_id: userId,
        deposit_method: 'bmc',
        deposit_amount: ADMIN_DEPOSIT_BMC,
        bmc_tx_ref: bmcTxRef,
        notes,
        status: 'pending',
      },
    });

    return res.status(201).json({ ok: true, application: app });
  } catch (err: any) {
    console.error('POST /api/green/admin-application/apply error:', err);
    return res.status(400).json({ error: err?.message || 'Gagal mengajukan admin' });
  }
});

router.get(
  '/superadmin/overview',
  verifyJWT,
  requireDbRole('superadmin'),
  async (_req: AuthRequest, res: Response) => {
    try {
      const [admins, applications] = await Promise.all([
        prisma.user.findMany({
          where: { role: { in: ['admin', 'superadmin'] } },
          select: { id: true, username: true, display_name: true, role: true, created_at: true },
          orderBy: { created_at: 'asc' },
        }),
        prisma.greenAdminApplication.findMany({
          orderBy: { created_at: 'desc' },
          take: 50,
        }),
      ]);

      const applicantIds = Array.from(new Set(applications.map((a) => a.user_id)));
      const applicants = applicantIds.length
        ? await prisma.user.findMany({
            where: { id: { in: applicantIds } },
            select: { id: true, username: true, display_name: true, role: true },
          })
        : [];
      const userMap = new Map(applicants.map((u) => [u.id, u]));

      return res.json({
        ok: true,
        admins,
        applications: applications.map((a) => ({
          ...a,
          applicant: userMap.get(a.user_id) || null,
        })),
      });
    } catch (err: any) {
      console.error('GET /api/green/superadmin/overview error:', err);
      return res.status(500).json({ error: 'Failed to load superadmin overview' });
    }
  }
);

router.post(
  '/superadmin/promote',
  verifyJWT,
  requireDbRole('superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const actorId = req.user!.id;
      const username = String(req.body?.username || '').trim();
      const action = String(req.body?.action || 'promote').trim().toLowerCase();
      const reason = String(req.body?.reason || 'Keputusan Superadmin Founder').trim();

      if (!username) return res.status(400).json({ error: 'Username wajib diisi.' });
      if (action !== 'promote' && action !== 'demote') {
        return res.status(400).json({ error: 'Action harus promote atau demote.' });
      }

      const target = await prisma.user.findFirst({
        where: { username: { equals: username, mode: 'insensitive' } },
        select: { id: true, username: true, display_name: true, role: true },
      });
      if (!target) return res.status(404).json({ error: `User '${username}' tidak ditemukan.` });
      if (target.role.toLowerCase() === 'superadmin') {
        return res.status(400).json({ error: 'Akun Superadmin Founder tidak dapat diubah.' });
      }

      const nextRole = action === 'promote' ? 'admin' : 'user';
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: target.id },
          data: { role: nextRole },
          select: { id: true, username: true, display_name: true, role: true },
        });
        await tx.greenAuditLog.create({
          data: {
            actor_user_id: actorId,
            action: action === 'promote' ? 'superadmin_promote_admin' : 'superadmin_demote_admin',
            target_entity: 'User',
            target_id: target.id,
            previous_value: { role: target.role },
            new_value: { role: nextRole },
            reason,
          },
        });
        return u;
      });

      return res.json({ ok: true, user: updated });
    } catch (err: any) {
      console.error('POST /api/green/superadmin/promote error:', err);
      return res.status(400).json({ error: err?.message || 'Gagal mengubah role user' });
    }
  }
);

router.post(
  '/superadmin/applications/:id/review',
  verifyJWT,
  requireDbRole('superadmin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const actorId = req.user!.id;
      const appId = String(req.params.id || '');
      const decision = String(req.body?.decision || '').trim().toLowerCase();
      const reason = String(req.body?.reason || '').trim() || `Review Founder: ${decision}`;

      if (decision !== 'approved' && decision !== 'rejected') {
        return res.status(400).json({ error: 'Decision harus approved atau rejected.' });
      }

      const app = await prisma.greenAdminApplication.findUnique({ where: { id: appId } });
      if (!app) return res.status(404).json({ error: 'Pengajuan tidak ditemukan.' });
      if (app.status !== 'pending') {
        return res.status(400).json({ error: `Pengajuan sudah berstatus ${app.status}.` });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const reviewedApp = await tx.greenAdminApplication.update({
          where: { id: appId },
          data: {
            status: decision,
            reviewed_by: actorId,
            review_reason: reason,
            reviewed_at: new Date(),
          },
        });

        if (decision === 'approved') {
          await tx.user.update({
            where: { id: app.user_id },
            data: { role: 'admin' },
          });
        } else if (app.deposit_method === 'points') {
          const refundKey = `green-admin-refund-pts-${app.id}`;
          await earnPoints(tx, {
            userId: app.user_id,
            activityCode: 'admin_deposit_refund',
            amount: Math.round(app.deposit_amount),
            idempotencyKey: refundKey,
            description: `Pengembalian deposit pengajuan Admin NGOPI GREEN (${reason})`,
          });
        }

        await tx.greenAuditLog.create({
          data: {
            actor_user_id: actorId,
            action: `superadmin_application_${decision}`,
            target_entity: 'GreenAdminApplication',
            target_id: app.id,
            previous_value: { status: 'pending' },
            new_value: { status: decision },
            reason,
          },
        });

        return reviewedApp;
      });

      if (decision === 'rejected' && app.deposit_method === 'points') {
        pointsEconomyService.syncExternalCredit(
          app.user_id,
          Math.round(app.deposit_amount),
          `Refund deposit pengajuan Admin NGOPI GREEN (${reason})`,
          `green-admin-refund-pts-${app.id}`
        );
      }

      return res.json({ ok: true, application: updated });
    } catch (err: any) {
      console.error('POST /api/green/superadmin/applications/:id/review error:', err);
      return res.status(400).json({ error: err?.message || 'Gagal memproses pengajuan admin' });
    }
  }
);

export default router;
