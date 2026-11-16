import { Router, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireDbRole } from '../middleware/rbac.middleware';
import { prisma } from '../utils/prisma';
import { pointsEconomyService } from '../services/points.service';
import { ensureGreenSeeded } from '../services/green/greenCatalog.seed';
import {
  createGreenSubmission,
  verifyGreenSubmission,
} from '../services/green/greenSubmission.service';

const router = Router();

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

    return res.json({
      ok: true,
      categories,
      activityTypes,
      emissionFactors,
      rewardRules,
      challenges,
    });
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

    const [pointsAcc, submissions, plants, memberships, challenges] = await Promise.all([
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

    return res.json({ ok: true, items });
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
      approx_lat: r.approx_lat,
      approx_lng: r.approx_lng,
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

      return res.json({ ok: true, items: enriched });
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

export default router;
