import { Router, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';

const router = Router();

/**
 * GET /api/cekkes/state
 * Fetch the authenticated user's persisted ceKKes profile, telemetry, active findings, and daily checklist.
 */
router.get('/state', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const record = await prisma.cekkesUserRecord.findUnique({
      where: { user_id: userId },
    });
    return res.json({
      ok: true,
      data: record
        ? {
            profile: record.profile_json,
            telemetry: record.telemetry_json,
            findings: record.findings_json,
            checklist: record.checklist_json,
            checklistDate: record.checklist_date,
            updatedAt: record.updated_at,
          }
        : null,
    });
  } catch (err: any) {
    console.error('GET /api/cekkes/state error:', err);
    return res.status(500).json({ error: 'Failed to load ceKKes state' });
  }
});

/**
 * PUT /api/cekkes/state
 * Upsert the authenticated user's ceKKes profile, telemetry, active findings, and daily checklist.
 */
router.put('/state', verifyJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { profile, telemetry, findings, checklist, checklistDate } = req.body || {};

    const updateData: Record<string, any> = {};
    if (profile !== undefined) updateData.profile_json = profile;
    if (telemetry !== undefined) updateData.telemetry_json = telemetry;
    if (findings !== undefined) updateData.findings_json = findings;
    if (checklist !== undefined) updateData.checklist_json = checklist;
    if (typeof checklistDate === 'string') updateData.checklist_date = checklistDate;

    const saved = await prisma.cekkesUserRecord.upsert({
      where: { user_id: userId },
      create: {
        user_id: userId,
        profile_json: profile ?? null,
        telemetry_json: telemetry ?? null,
        findings_json: findings ?? null,
        checklist_json: checklist ?? null,
        checklist_date: typeof checklistDate === 'string' ? checklistDate : null,
      },
      update: updateData,
    });

    return res.json({
      ok: true,
      updatedAt: saved.updated_at,
    });
  } catch (err: any) {
    console.error('PUT /api/cekkes/state error:', err);
    return res.status(500).json({ error: 'Failed to save ceKKes state' });
  }
});

export default router;
