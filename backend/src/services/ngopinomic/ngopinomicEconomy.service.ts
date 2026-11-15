import { prisma as defaultPrisma } from '../../utils/prisma';
import { telecomService } from '../telecom.service';
import {
  generateReferenceCode,
  postLedgerTransaction,
  reverseLedgerTransaction,
} from './ngopinomicLedger.service';

const RESERVED_PROFILE_SLUGS = new Set([
  'login',
  'register',
  'contacts',
  'warkop',
  'bambupedia',
  'chat',
  'admin',
  'help-center',
  'privacy',
  'terms',
  'test-payment',
  'index',
  'api',
]);

export function profileSlug(name: string): string {
  const slug =
    String(name || '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'pengguna';
  return RESERVED_PROFILE_SLUGS.has(slug) ? `${slug}-profil` : slug;
}

export interface CommissionRuleConfig {
  id?: string;
  code: string;
  direct_rate_bps: number;
  level2_rate_bps: number;
  ambassador_max_bps: number;
  promoter_min_bps: number;
  promoter_max_bps: number;
  max_total_cap_bps: number;
  tax_rate_bps: number;
  payment_fee_bps: number;
  infra_alloc_bps: number;
  refund_reserve_bps: number;
  other_ops_bps: number;
  settlement_days: number;
  bmc_utility_enabled: boolean;
}

export const DEFAULT_COMMISSION_RULE: CommissionRuleConfig = {
  code: 'default',
  direct_rate_bps: 2000, // 20%
  level2_rate_bps: 500, // 5%
  ambassador_max_bps: 500, // up to 5%
  promoter_min_bps: 500, // 5%
  promoter_max_bps: 1000, // 10%
  max_total_cap_bps: 3500, // 35% cap
  tax_rate_bps: 1100, // 11%
  payment_fee_bps: 200, // 2%
  infra_alloc_bps: 300, // 3%
  refund_reserve_bps: 400, // 4%
  other_ops_bps: 1000, // 10%
  settlement_days: 7,
  bmc_utility_enabled: false,
};

export interface NdrBreakdown {
  gross_amount_idr: number;
  deductions: {
    taxes_idr: number;
    payment_fees_idr: number;
    infrastructure_idr: number;
    refund_reserve_idr: number;
    other_ops_idr: number;
    total_deductions_idr: number;
  };
  net_distributable_idr: number;
}

/**
 * Computes Net Distributable Revenue (NDR) strictly from Gross Revenue minus approved,
 * non-duplicated cost allocations. Never returns negative NDR.
 */
export function calculateNetDistributableRevenue(
  grossAmountIdr: number,
  rule: Pick<
    CommissionRuleConfig,
    'tax_rate_bps' | 'payment_fee_bps' | 'infra_alloc_bps' | 'refund_reserve_bps' | 'other_ops_bps'
  >,
  explicitDeductions?: Partial<NdrBreakdown['deductions']>
): NdrBreakdown {
  if (!Number.isFinite(grossAmountIdr) || grossAmountIdr <= 0) {
    return {
      gross_amount_idr: Math.max(0, Math.floor(grossAmountIdr || 0)),
      deductions: {
        taxes_idr: 0,
        payment_fees_idr: 0,
        infrastructure_idr: 0,
        refund_reserve_idr: 0,
        other_ops_idr: 0,
        total_deductions_idr: 0,
      },
      net_distributable_idr: 0,
    };
  }

  const gross = Math.floor(grossAmountIdr);
  const taxes = explicitDeductions?.taxes_idr ?? Math.floor((gross * rule.tax_rate_bps) / 10000);
  const paymentFees = explicitDeductions?.payment_fees_idr ?? Math.floor((gross * rule.payment_fee_bps) / 10000);
  const infrastructure = explicitDeductions?.infrastructure_idr ?? Math.floor((gross * rule.infra_alloc_bps) / 10000);
  const refundReserve = explicitDeductions?.refund_reserve_idr ?? Math.floor((gross * rule.refund_reserve_bps) / 10000);
  const otherOps = explicitDeductions?.other_ops_idr ?? Math.floor((gross * rule.other_ops_bps) / 10000);

  const totalDeductions = Math.max(0, taxes + paymentFees + infrastructure + refundReserve + otherOps);
  const netDistributableIdr = Math.max(0, gross - totalDeductions);

  return {
    gross_amount_idr: gross,
    deductions: {
      taxes_idr: taxes,
      payment_fees_idr: paymentFees,
      infrastructure_idr: infrastructure,
      refund_reserve_idr: refundReserve,
      other_ops_idr: otherOps,
      total_deductions_idr: totalDeductions,
    },
    net_distributable_idr: netDistributableIdr,
  };
}

export interface CommissionAllocationInput {
  netDistributableIdr: number;
  directUserId?: string | null;
  level2UserId?: string | null;
  ambassadorUserId?: string | null;
  promoterUserId?: string | null;
  promoterRateBps?: number;
  rule: CommissionRuleConfig;
}

export interface CommissionAllocationItem {
  beneficiaryUserId: string;
  commissionType: 'direct' | 'level2' | 'ambassador' | 'promoter';
  rateBps: number;
  commissionAmountIdr: number;
}

/**
 * Allocates commissions strictly from Net Distributable Revenue and enforces the configured max_total_cap_bps.
 */
export function calculateAffiliateCommissions(input: CommissionAllocationInput): CommissionAllocationItem[] {
  const ndr = Math.floor(input.netDistributableIdr);
  if (ndr <= 0) return [];

  const candidates: Array<{ beneficiaryUserId: string; commissionType: CommissionAllocationItem['commissionType']; rateBps: number }> = [];

  if (input.directUserId && input.rule.direct_rate_bps > 0) {
    candidates.push({
      beneficiaryUserId: input.directUserId,
      commissionType: 'direct',
      rateBps: input.rule.direct_rate_bps,
    });
  }
  if (input.level2UserId && input.rule.level2_rate_bps > 0) {
    candidates.push({
      beneficiaryUserId: input.level2UserId,
      commissionType: 'level2',
      rateBps: input.rule.level2_rate_bps,
    });
  }
  if (input.ambassadorUserId && input.rule.ambassador_max_bps > 0) {
    candidates.push({
      beneficiaryUserId: input.ambassadorUserId,
      commissionType: 'ambassador',
      rateBps: input.rule.ambassador_max_bps,
    });
  }
  if (input.promoterUserId) {
    const rawPromoter = input.promoterRateBps ?? input.rule.promoter_min_bps;
    const boundedPromoter = Math.min(
      Math.max(rawPromoter, input.rule.promoter_min_bps),
      input.rule.promoter_max_bps
    );
    if (boundedPromoter > 0) {
      candidates.push({
        beneficiaryUserId: input.promoterUserId,
        commissionType: 'promoter',
        rateBps: boundedPromoter,
      });
    }
  }

  let remainingCapBps = Math.max(0, input.rule.max_total_cap_bps);
  const results: CommissionAllocationItem[] = [];

  for (const item of candidates) {
    if (remainingCapBps <= 0) break;
    const effectiveRateBps = Math.min(item.rateBps, remainingCapBps);
    const amountIdr = Math.floor((ndr * effectiveRateBps) / 10000);
    if (amountIdr > 0) {
      results.push({
        beneficiaryUserId: item.beneficiaryUserId,
        commissionType: item.commissionType,
        rateBps: effectiveRateBps,
        commissionAmountIdr: amountIdr,
      });
    }
    remainingCapBps -= effectiveRateBps;
  }

  return results;
}

export async function getActiveCommissionRule(db: any = defaultPrisma): Promise<CommissionRuleConfig> {
  const row = await db.commissionRule.findFirst({
    where: { is_active: true },
    orderBy: { updated_at: 'desc' },
  });
  if (row) return row;
  return db.commissionRule.create({
    data: { ...DEFAULT_COMMISSION_RULE, is_active: true },
  });
}

export async function ensureUserIdentity(
  db: any = defaultPrisma,
  user: { id: string; username: string; display_name?: string | null; bmc_id?: number | null }
) {
  const telecomNumber = telecomService.getNumberForUser(user);
  const telecomEmail = telecomService.formatEmail(user.username || user.id, user.id);
  const canonicalCode = profileSlug(user.display_name || user.username || user.id);

  let identity = await db.userIdentity.findUnique({ where: { user_id: user.id } });
  if (!identity) {
    identity = await db.userIdentity.create({
      data: {
        user_id: user.id,
        ngopi_id: telecomNumber,
        basic_email: telecomEmail,
        tier: 'basic',
        status: 'active',
      },
    });
  } else if (identity.ngopi_id !== telecomNumber || identity.basic_email !== telecomEmail) {
    try {
      identity = await db.userIdentity.update({
        where: { user_id: user.id },
        data: {
          ngopi_id: telecomNumber,
          basic_email: telecomEmail,
        },
      });
    } catch {
      // Keep existing row if unique collision occurs in synthetic test data
    }
  }

  // Ensure default affiliate profile is synced with Profile Link slug
  const existingAffiliate = await db.affiliateProfile.findUnique({ where: { user_id: user.id } });
  if (!existingAffiliate) {
    const taken = await db.affiliateProfile.findUnique({ where: { referral_code: canonicalCode } });
    const code = taken ? `${canonicalCode}-${user.id.slice(0, 4).toLowerCase()}` : canonicalCode;
    await db.affiliateProfile.create({
      data: { user_id: user.id, referral_code: code, payout_preference: 'rupiah' },
    });
  } else if (existingAffiliate.referral_code !== canonicalCode) {
    try {
      const taken = await db.affiliateProfile.findUnique({ where: { referral_code: canonicalCode } });
      if (!taken || taken.user_id === user.id) {
        await db.affiliateProfile.update({
          where: { user_id: user.id },
          data: { referral_code: canonicalCode },
        });
      }
    } catch {
      // Ignore if slug already claimed by another user
    }
  }

  const existingPoints = await db.pointsAccount.findUnique({ where: { user_id: user.id } });
  if (!existingPoints) {
    await db.pointsAccount.create({ data: { user_id: user.id, balance: 0 } });
  }

  const existingCommunity = await db.communityMembership.findUnique({ where: { user_id: user.id } });
  if (!existingCommunity) {
    await db.communityMembership.create({ data: { user_id: user.id, membership_tier: 'komunitas' } });
  }

  return identity;
}

export const DAILY_POINTS_EARN_CAP = 500;

export async function earnPoints(
  db: any = defaultPrisma,
  params: {
    userId: string;
    activityCode: string;
    amount: number;
    idempotencyKey: string;
    description: string;
    metadata?: Record<string, any>;
  }
) {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error('Points earn amount must be a positive integer');
  }

  const existingTx = await db.pointsTransaction.findUnique({
    where: { idempotency_key: params.idempotencyKey },
  });
  if (existingTx) {
    await db.fraudEvent.create({
      data: {
        user_id: params.userId,
        event_type: 'duplicate_points_request',
        severity: 'low',
        details: { idempotencyKey: params.idempotencyKey, activityCode: params.activityCode },
      },
    });
    return { transaction: existingTx, idempotent: true };
  }

  // Enforce daily points earn cap across all earn transactions
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const recentEarns = await db.pointsTransaction.findMany({
    where: { user_id: params.userId, tx_type: 'earn' },
  });
  const earnedToday = (recentEarns || [])
    .filter((t: any) => !t.created_at || new Date(t.created_at) >= startOfDay)
    .reduce((sum: number, t: any) => sum + (t.amount > 0 ? t.amount : 0), 0);

  if (earnedToday + params.amount > DAILY_POINTS_EARN_CAP) {
    await db.fraudEvent.create({
      data: {
        user_id: params.userId,
        event_type: 'daily_points_cap_exceeded',
        severity: 'medium',
        details: { earnedToday, attempted: params.amount, cap: DAILY_POINTS_EARN_CAP },
      },
    });
    throw new Error(`Batas perolehan Poin Ngopi harian (${DAILY_POINTS_EARN_CAP} poin) telah tercapai.`);
  }

  let account = await db.pointsAccount.findUnique({ where: { user_id: params.userId } });
  if (!account) {
    account = await db.pointsAccount.create({ data: { user_id: params.userId, balance: 0 } });
  }

  const nextBalance = account.balance + params.amount;
  await db.pointsAccount.update({
    where: { id: account.id },
    data: {
      balance: nextBalance,
      lifetime_earned: account.lifetime_earned + params.amount,
    },
  });

  const tx = await db.pointsTransaction.create({
    data: {
      account_id: account.id,
      user_id: params.userId,
      tx_type: 'earn',
      activity_code: params.activityCode,
      amount: params.amount,
      balance_after: nextBalance,
      reference_code: generateReferenceCode('PTS'),
      idempotency_key: params.idempotencyKey,
      description: params.description,
      metadata: params.metadata ?? undefined,
    },
  });

  return { transaction: tx, idempotent: false };
}

export async function reversePointsTransaction(
  db: any = defaultPrisma,
  params: { originalTxId: string; idempotencyKey: string; reason: string }
) {
  const existing = await db.pointsTransaction.findUnique({
    where: { idempotency_key: params.idempotencyKey },
  });
  if (existing) {
    return { transaction: existing, idempotent: true };
  }

  const orig = await db.pointsTransaction.findUnique({ where: { id: params.originalTxId } });
  if (!orig) {
    throw new Error('Transaksi Poin Ngopi asal tidak ditemukan.');
  }

  const account = await db.pointsAccount.findUnique({ where: { user_id: orig.user_id } });
  if (!account) {
    throw new Error('Akun Poin Ngopi tidak ditemukan.');
  }

  const delta = -orig.amount;
  const nextBalance = Math.max(0, account.balance + delta);
  await db.pointsAccount.update({
    where: { id: account.id },
    data: { balance: nextBalance },
  });

  const revTx = await db.pointsTransaction.create({
    data: {
      account_id: account.id,
      user_id: orig.user_id,
      tx_type: 'reversal',
      activity_code: `rev_${orig.activity_code}`,
      amount: delta,
      balance_after: nextBalance,
      reference_code: generateReferenceCode('REVPTS'),
      idempotency_key: params.idempotencyKey,
      reversal_of_id: orig.id,
      description: `Reversal ${orig.reference_code}: ${params.reason}`,
      metadata: { original_reference: orig.reference_code, reason: params.reason },
    },
  });

  return { transaction: revTx, idempotent: false };
}

export async function redeemPoints(
  db: any = defaultPrisma,
  params: {
    userId: string;
    activityCode: string;
    amount: number;
    idempotencyKey: string;
    description: string;
    metadata?: Record<string, any>;
  }
) {
  if (!Number.isInteger(params.amount) || params.amount <= 0) {
    throw new Error('Points redeem amount must be a positive integer');
  }

  const existingTx = await db.pointsTransaction.findUnique({
    where: { idempotency_key: params.idempotencyKey },
  });
  if (existingTx) {
    return { transaction: existingTx, idempotent: true };
  }

  const account = await db.pointsAccount.findUnique({ where: { user_id: params.userId } });
  if (!account || account.balance < params.amount) {
    throw new Error('Poin Ngopi tidak mencukupi.');
  }

  const nextBalance = account.balance - params.amount;
  await db.pointsAccount.update({
    where: { id: account.id },
    data: {
      balance: nextBalance,
      lifetime_redeemed: account.lifetime_redeemed + params.amount,
    },
  });

  const tx = await db.pointsTransaction.create({
    data: {
      account_id: account.id,
      user_id: params.userId,
      tx_type: 'redeem',
      activity_code: params.activityCode,
      amount: -params.amount,
      balance_after: nextBalance,
      reference_code: generateReferenceCode('RDM'),
      idempotency_key: params.idempotencyKey,
      description: params.description,
      metadata: params.metadata ?? undefined,
    },
  });

  return { transaction: tx, idempotent: false };
}

export async function registerReferral(
  db: any = defaultPrisma,
  params: { referredUserId: string; referralCode: string }
) {
  const raw = params.referralCode.trim();
  const referrerProfile =
    (await db.affiliateProfile.findUnique({ where: { referral_code: raw } })) ||
    (await db.affiliateProfile.findUnique({ where: { referral_code: raw.toLowerCase() } })) ||
    (await db.affiliateProfile.findUnique({ where: { referral_code: raw.toUpperCase() } }));
  const code = referrerProfile?.referral_code || raw;
  if (!referrerProfile) {
    throw new Error('Kode undangan tidak ditemukan.');
  }
  if (referrerProfile.user_id === params.referredUserId) {
    await db.fraudEvent.create({
      data: {
        user_id: params.referredUserId,
        event_type: 'self_referral_attempt',
        severity: 'high',
        details: { referralCode: code },
      },
    });
    throw new Error('Tidak dapat menggunakan kode undangan milik sendiri.');
  }

  const existing = await db.referralRelationship.findUnique({
    where: { referred_user_id: params.referredUserId },
  });
  if (existing) {
    throw new Error('Akun ini sudah terdaftar dengan pengundang sebelumnya.');
  }

  // Prevent circular referral (if referredUser already referred referrerUser)
  const reverseCheck = await db.referralRelationship.findUnique({
    where: { referred_user_id: referrerProfile.user_id },
  });
  if (reverseCheck && reverseCheck.referrer_user_id === params.referredUserId) {
    await db.fraudEvent.create({
      data: {
        user_id: params.referredUserId,
        event_type: 'circular_referral_attempt',
        severity: 'high',
        details: { referrerUserId: referrerProfile.user_id },
      },
    });
    throw new Error('Relasi referral melingkar tidak diizinkan.');
  }

  const level2ReferrerId = reverseCheck ? reverseCheck.referrer_user_id : null;

  return db.referralRelationship.create({
    data: {
      referred_user_id: params.referredUserId,
      referrer_user_id: referrerProfile.user_id,
      level2_referrer_id: level2ReferrerId,
      referral_code_used: code,
      status: 'verified',
    },
  });
}

export async function accrueCommissionsForSale(
  db: any = defaultPrisma,
  params: {
    buyerUserId: string;
    sourceTxRef: string;
    grossAmountIdr: number;
    explicitDeductions?: Partial<NdrBreakdown['deductions']>;
  }
) {
  const rule = await getActiveCommissionRule(db);
  const ndr = calculateNetDistributableRevenue(params.grossAmountIdr, rule, params.explicitDeductions);
  if (ndr.net_distributable_idr <= 0) {
    return { ndr, commissions: [] };
  }

  const rel = await db.referralRelationship.findUnique({
    where: { referred_user_id: params.buyerUserId },
  });
  if (!rel || rel.status !== 'verified') {
    return { ndr, commissions: [] };
  }

  const directAffiliate = await db.affiliateProfile.findUnique({
    where: { user_id: rel.referrer_user_id },
  });

  const allocations = calculateAffiliateCommissions({
    netDistributableIdr: ndr.net_distributable_idr,
    directUserId: rel.referrer_user_id,
    level2UserId: rel.level2_referrer_id,
    ambassadorUserId: directAffiliate?.is_ambassador ? rel.referrer_user_id : null,
    promoterUserId: directAffiliate?.is_campaign_promoter ? rel.referrer_user_id : null,
    promoterRateBps: directAffiliate?.promoter_rate_bps,
    rule,
  });

  const createdCommissions = [];
  for (const item of allocations) {
    const idempotencyKey = `comm:${params.sourceTxRef}:${item.commissionType}:${item.beneficiaryUserId}`;
    const existing = await db.commissionTransaction.findUnique({
      where: { idempotency_key: idempotencyKey },
    });
    if (existing) {
      createdCommissions.push(existing);
      continue;
    }

    const beneficiaryProfile = await db.affiliateProfile.findUnique({
      where: { user_id: item.beneficiaryUserId },
    });

    const commTx = await db.commissionTransaction.create({
      data: {
        beneficiary_user_id: item.beneficiaryUserId,
        source_user_id: params.buyerUserId,
        source_tx_ref: params.sourceTxRef,
        commission_type: item.commissionType,
        gross_amount_idr: ndr.gross_amount_idr,
        deductions_json: ndr.deductions,
        net_distributable_idr: ndr.net_distributable_idr,
        rate_bps: item.rateBps,
        commission_amount_idr: item.commissionAmountIdr,
        payout_preference: beneficiaryProfile?.payout_preference || 'rupiah',
        status: 'pending',
        reference_code: generateReferenceCode('COM'),
        idempotency_key: idempotencyKey,
      },
    });

    await postLedgerTransaction(db, {
      idempotencyKey: `ldg:${idempotencyKey}`,
      referenceCode: generateReferenceCode('LDG'),
      txType: 'commission_accrual',
      instrument: 'IDR',
      description: `Pending komisi ${item.commissionType} atas transaksi ${params.sourceTxRef}`,
      metadata: { commission_id: commTx.id, source_tx_ref: params.sourceTxRef },
      entries: [
        {
          userId: item.beneficiaryUserId,
          direction: 'credit',
          amount: item.commissionAmountIdr,
          bucket: 'pending',
        },
      ],
    });

    createdCommissions.push(commTx);
  }

  return { ndr, commissions: createdCommissions };
}

export async function reverseCommissionsForSale(
  db: any = defaultPrisma,
  params: { sourceTxRef: string; reason: string }
) {
  const commissions = await db.commissionTransaction.findMany({
    where: { source_tx_ref: params.sourceTxRef, status: { in: ['pending', 'settled'] } },
  });

  const reversed = [];
  for (const comm of commissions) {
    const revIdempotency = `revcomm:${comm.id}`;
    const existingRev = await db.commissionTransaction.findUnique({
      where: { idempotency_key: revIdempotency },
    });
    if (existingRev) {
      reversed.push(existingRev);
      continue;
    }

    const revComm = await db.commissionTransaction.create({
      data: {
        beneficiary_user_id: comm.beneficiary_user_id,
        source_user_id: comm.source_user_id,
        source_tx_ref: comm.source_tx_ref,
        commission_type: comm.commission_type,
        gross_amount_idr: comm.gross_amount_idr,
        deductions_json: comm.deductions_json,
        net_distributable_idr: comm.net_distributable_idr,
        rate_bps: comm.rate_bps,
        commission_amount_idr: -comm.commission_amount_idr,
        payout_preference: comm.payout_preference,
        status: 'reversed',
        reversal_of_id: comm.id,
        reference_code: generateReferenceCode('REVCOM'),
        idempotency_key: revIdempotency,
      },
    });

    await db.commissionTransaction.update({
      where: { id: comm.id },
      data: { status: 'reversed' },
    });

    const origLedgerTx = await db.ledgerTransaction.findUnique({
      where: { idempotency_key: `ldg:${comm.idempotency_key}` },
    });
    if (origLedgerTx && origLedgerTx.status !== 'reversed') {
      await reverseLedgerTransaction(db, {
        originalTxId: origLedgerTx.id,
        idempotencyKey: `revldg:${comm.id}`,
        reason: params.reason,
        bucket: comm.status === 'settled' ? 'available' : 'pending',
      });
    }

    reversed.push(revComm);
  }

  return reversed;
}

