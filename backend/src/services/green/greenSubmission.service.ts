import crypto from 'crypto';
import { prisma as defaultPrisma } from '../../utils/prisma';
import { earnPoints } from '../ngopinomic/ngopinomicEconomy.service';
import { pointsEconomyService } from '../points.service';
import { calculateGreenImpact } from './greenImpact.service';

export interface EvidenceInput {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  sha256Hash?: string;
}

export interface CreateSubmissionInput {
  userId: string;
  activityTypeCode: string;
  title: string;
  description?: string;
  quantity: number;
  activityDate?: string;
  locationName?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationConsent?: boolean;
  isPublic?: boolean;
  metadata?: Record<string, any>;
  evidences?: EvidenceInput[];
}

const DISALLOWED_ECOBRICK_FILLERS = new Set(['paper', 'glass', 'metal', 'organic', 'hazardous']);

export function calculateEligibleRewardPoints(
  quantity: number,
  isGreenEligible: boolean,
  rule?: {
    base_points: number;
    unit_step: any;
    max_points_per_submission: number;
    is_active: boolean;
  } | null
): number {
  if (!isGreenEligible || !rule || !rule.is_active || rule.base_points <= 0) return 0;
  const step = Math.max(0.01, Number(rule.unit_step) || 1);
  const units = Math.floor(Math.max(0, quantity) / step);
  const raw = units * rule.base_points;
  return Math.max(0, Math.min(rule.max_points_per_submission, raw));
}

export async function createGreenSubmission(
  db: any = defaultPrisma,
  input: CreateSubmissionInput
) {
  if (!input.userId) throw new Error('Unauthorized');
  if (!input.title || input.title.trim().length < 3) {
    throw new Error('Title must be at least 3 characters.');
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error('Quantity must be a positive number.');
  }

  const activityType = await db.greenActivityType.findUnique({
    where: { code: input.activityTypeCode },
  });
  if (!activityType || !activityType.is_active) {
    throw new Error(`Unsupported or inactive activity type: ${input.activityTypeCode}`);
  }

  const evidences = Array.isArray(input.evidences) ? input.evidences : [];
  if (activityType.requires_evidence && evidences.length === 0) {
    throw new Error('Supporting evidence upload is required for this activity type.');
  }

  const meta = input.metadata || {};
  if (activityType.code === 'waste_ecobrick') {
    const filler = String(meta.material_type || '').toLowerCase().trim();
    if (DISALLOWED_ECOBRICK_FILLERS.has(filler)) {
      throw new Error('Paper, glass, metal, organic, or hazardous waste cannot be submitted as ecobrick filler.');
    }
    if (!meta.bottle_capacity_ml || Number(meta.bottle_capacity_ml) <= 0) {
      throw new Error('Ecobrick submission requires bottle capacity (ml) and measured plastic mass (grams).');
    }
  }

  // Check duplicate evidence SHA-256 hashes
  let duplicateWarning = false;
  const normalizedEvidences = evidences.map((ev) => {
    const hash =
      ev.sha256Hash ||
      crypto.createHash('sha256').update(`${ev.fileUrl}|${ev.fileName}|${ev.fileSize}`).digest('hex');
    return { ...ev, sha256Hash: hash };
  });

  if (normalizedEvidences.length > 0) {
    const existingDup = await db.greenEvidence.findFirst({
      where: {
        sha256_hash: { in: normalizedEvidences.map((e) => e.sha256Hash) },
      },
    });
    if (existingDup) {
      duplicateWarning = true;
    }
  }

  const factor = await db.greenEmissionFactor.findFirst({
    where: { activity_type_code: activityType.code, is_active: true },
    orderBy: { created_at: 'desc' },
  });

  const impact = calculateGreenImpact({
    categoryCode: activityType.category_code,
    activityTypeCode: activityType.code,
    quantity: input.quantity,
    unit: activityType.unit,
    metadata: meta,
    factor,
  });

  const created = await db.$transaction(async (tx: any) => {
    const submission = await tx.greenSubmission.create({
      data: {
        user_id: input.userId,
        category_code: activityType.category_code,
        activity_type_code: activityType.code,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        quantity: input.quantity.toFixed(3),
        unit: activityType.unit,
        activity_date: input.activityDate ? new Date(input.activityDate) : new Date(),
        location_name: input.locationConsent ? input.locationName?.trim() || null : null,
        latitude: input.locationConsent && input.latitude != null ? Number(input.latitude).toFixed(7) : null,
        longitude: input.locationConsent && input.longitude != null ? Number(input.longitude).toFixed(7) : null,
        location_consent: Boolean(input.locationConsent),
        is_public: Boolean(input.isPublic),
        metadata_json: meta,
        status: 'pending',
        awarded_points: 0,
        duplicate_warning: duplicateWarning,
      },
    });

    for (const ev of normalizedEvidences) {
      await tx.greenEvidence.create({
        data: {
          submission_id: submission.id,
          user_id: input.userId,
          file_url: ev.fileUrl,
          file_name: ev.fileName,
          mime_type: ev.mimeType,
          file_size: ev.fileSize,
          sha256_hash: ev.sha256Hash,
        },
      });
    }

    await tx.greenImpactRecord.create({
      data: {
        submission_id: submission.id,
        user_id: input.userId,
        ...impact,
      },
    });

    if (activityType.category_code === 'planting') {
      await tx.greenPlant.create({
        data: {
          user_id: input.userId,
          submission_id: submission.id,
          common_name: String(meta.common_name || input.title).slice(0, 120),
          scientific_name: meta.scientific_name ? String(meta.scientific_name).slice(0, 120) : null,
          species_group: String(meta.species_group || 'native'),
          quantity: Math.max(1, Math.round(input.quantity)),
          ecosystem_type: String(meta.ecosystem_type || 'urban'),
          location_name: input.locationConsent ? input.locationName || null : null,
          survival_status: 'planted',
        },
      });
    }

    if (activityType.category_code === 'eco_report') {
      await tx.greenEnvironmentReport.create({
        data: {
          submission_id: submission.id,
          user_id: input.userId,
          report_category: String(meta.report_category || 'waste_pollution'),
          subcategory: String(meta.subcategory || 'general'),
          title: input.title.trim(),
          description: input.description?.trim() || input.title.trim(),
          severity: String(meta.severity || 'medium'),
          status: 'submitted',
          is_anonymous: Boolean(meta.is_anonymous),
          public_area_label: input.locationName?.trim() || null,
          approx_lat:
            input.locationConsent && input.latitude != null
              ? Number(input.latitude).toFixed(2)
              : null,
          approx_lng:
            input.locationConsent && input.longitude != null
              ? Number(input.longitude).toFixed(2)
              : null,
        },
      });
    }

    return submission;
  });

  return created;
}

export async function verifyGreenSubmission(
  db: any = defaultPrisma,
  params: {
    submissionId: string;
    reviewerUserId: string;
    decision: 'verified' | 'rejected' | 'needs_info' | 'reversed';
    reason: string;
  }
) {
  if (!params.reason || params.reason.trim().length < 3) {
    throw new Error('Verification reason is required (min 3 characters).');
  }

  const submission = await db.greenSubmission.findUnique({
    where: { id: params.submissionId },
  });
  if (!submission) {
    throw new Error('Submission not found.');
  }

  // Idempotent guard against repeated approval
  if (params.decision === 'verified' && (submission.status === 'verified' || submission.points_tx_id)) {
    return { submission, idempotent: true, awardedPoints: submission.awarded_points };
  }

  if (params.decision === 'reversed') {
    if (submission.status !== 'verified') {
      throw new Error('Only verified submissions can be reversed.');
    }
    const result = await db.$transaction(async (tx: any) => {
      const pointsToReverse = submission.awarded_points || 0;
      if (pointsToReverse > 0) {
        let account = await tx.pointsAccount.findUnique({ where: { user_id: submission.user_id } });
        if (account) {
          const nextBalance = Math.max(0, account.balance - pointsToReverse);
          await tx.pointsAccount.update({
            where: { id: account.id },
            data: { balance: nextBalance },
          });
          await tx.pointsTransaction.create({
            data: {
              user_id: submission.user_id,
              tx_type: 'reversal',
              activity_code: `green_reverse_${submission.activity_type_code}`,
              amount: -pointsToReverse,
              balance_after: nextBalance,
              idempotency_key: `green_reverse_${submission.id}`,
              description: `Reversal NGOPI GREEN: ${params.reason.trim()}`,
              metadata: { submissionId: submission.id, reviewerUserId: params.reviewerUserId },
            },
          });
        }
      }

      const updated = await tx.greenSubmission.update({
        where: { id: submission.id },
        data: { status: 'reversed' },
      });
      await tx.greenVerification.create({
        data: {
          submission_id: submission.id,
          reviewer_user_id: params.reviewerUserId,
          decision: 'reversed',
          reason: params.reason.trim(),
          awarded_points: -pointsToReverse,
        },
      });
      await tx.greenAuditLog.create({
        data: {
          actor_user_id: params.reviewerUserId,
          action: 'reverse_submission',
          target_entity: 'green_submission',
          target_id: submission.id,
          previous_value: { status: submission.status, awarded_points: submission.awarded_points },
          new_value: { status: 'reversed', awarded_points: 0 },
          reason: params.reason.trim(),
        },
      });
      return updated;
    });
    return { submission: result, idempotent: false, awardedPoints: 0 };
  }

  if (params.decision === 'rejected' || params.decision === 'needs_info') {
    const updated = await db.$transaction(async (tx: any) => {
      const sub = await tx.greenSubmission.update({
        where: { id: submission.id },
        data: { status: params.decision },
      });
      await tx.greenVerification.create({
        data: {
          submission_id: submission.id,
          reviewer_user_id: params.reviewerUserId,
          decision: params.decision,
          reason: params.reason.trim(),
          awarded_points: 0,
        },
      });
      await tx.greenAuditLog.create({
        data: {
          actor_user_id: params.reviewerUserId,
          action: `${params.decision}_submission`,
          target_entity: 'green_submission',
          target_id: submission.id,
          previous_value: { status: submission.status },
          new_value: { status: params.decision },
          reason: params.reason.trim(),
        },
      });
      if (submission.category_code === 'eco_report') {
        await tx.greenEnvironmentReport.updateMany({
          where: { submission_id: submission.id },
          data: { status: params.decision === 'rejected' ? 'rejected' : 'under_review' },
        });
      }
      return sub;
    });
    return { submission: updated, idempotent: false, awardedPoints: 0 };
  }

  // Approve & credit canonical Ngopi Points ledger server-side
  const activityType = await db.greenActivityType.findUnique({
    where: { code: submission.activity_type_code },
  });
  const rule = await db.greenRewardRule.findUnique({
    where: { activity_type_code: submission.activity_type_code },
  });

  const eligiblePoints = calculateEligibleRewardPoints(
    Number(submission.quantity),
    Boolean(activityType?.is_green_eligible),
    rule
  );

  // Enforce per-activity daily cap
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const todaySameType = await db.greenSubmission.findMany({
    where: {
      user_id: submission.user_id,
      activity_type_code: submission.activity_type_code,
      status: 'verified',
      updated_at: { gte: startOfDay },
    },
  });
  const earnedTypeToday = todaySameType.reduce((s: number, r: any) => s + (r.awarded_points || 0), 0);
  const dailyCap = rule?.daily_cap_points ?? 40;
  const finalPoints = Math.max(0, Math.min(eligiblePoints, dailyCap - earnedTypeToday));

  const verifiedResult = await db.$transaction(async (tx: any) => {
    let pointsTxId: string | null = null;
    if (finalPoints > 0) {
      const earnRes = await earnPoints(tx, {
        userId: submission.user_id,
        activityCode: `green_${submission.activity_type_code}`,
        amount: finalPoints,
        idempotencyKey: `green_approve_${submission.id}`,
        description: `NGOPI GREEN: ${submission.title}`,
        metadata: {
          submissionId: submission.id,
          category: submission.category_code,
          reviewerUserId: params.reviewerUserId,
        },
      });
      pointsTxId = earnRes.transaction?.id ?? null;
    }

    const updated = await tx.greenSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'verified',
        awarded_points: finalPoints,
        points_tx_id: pointsTxId,
      },
    });

    await tx.greenVerification.create({
      data: {
        submission_id: submission.id,
        reviewer_user_id: params.reviewerUserId,
        decision: 'verified',
        reason: params.reason.trim(),
        awarded_points: finalPoints,
      },
    });

    await tx.greenAuditLog.create({
      data: {
        actor_user_id: params.reviewerUserId,
        action: 'verify_submission',
        target_entity: 'green_submission',
        target_id: submission.id,
        previous_value: { status: submission.status, awarded_points: 0 },
        new_value: { status: 'verified', awarded_points: finalPoints, points_tx_id: pointsTxId },
        reason: params.reason.trim(),
      },
    });

    if (submission.category_code === 'eco_report') {
      await tx.greenEnvironmentReport.updateMany({
        where: { submission_id: submission.id },
        data: { status: 'verified' },
      });
    }

    return updated;
  });

  // Sync canonical Warkop / legacy PointsManager balance
  if (finalPoints > 0) {
    try {
      pointsEconomyService.syncExternalCredit(
        submission.user_id,
        finalPoints,
        `NGOPI GREEN: ${submission.title}`,
        `green_approve_${submission.id}`
      );
    } catch {
      // Non-fatal if in-memory cache isn't initialized in test mode
    }
  }

  return { submission: verifiedResult, idempotent: false, awardedPoints: finalPoints };
}
