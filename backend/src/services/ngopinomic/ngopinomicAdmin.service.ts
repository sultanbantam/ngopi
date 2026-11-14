import { prisma as defaultPrisma } from '../../utils/prisma';
import { getActiveCommissionRule, reverseCommissionsForSale } from './ngopinomicEconomy.service';
import { reverseLedgerTransaction } from './ngopinomicLedger.service';

export async function updateCommissionRuleConfig(
  db: any = defaultPrisma,
  params: {
    actorUserId: string;
    reason: string;
    updates: Partial<{
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
    }>;
  }
) {
  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error('Alasan perubahan aturan ekonomi wajib diisi (minimal 5 karakter).');
  }

  const current = await getActiveCommissionRule(db);

  // Validate bounds
  if (params.updates.max_total_cap_bps !== undefined && params.updates.max_total_cap_bps > 5000) {
    throw new Error('Plafon maksimal total komisi tidak boleh melebihi 50% (5000 bps).');
  }

  const updated = await db.commissionRule.update({
    where: { id: current.id },
    data: {
      ...params.updates,
      updated_by: params.actorUserId,
    },
  });

  await db.adminAuditLog.create({
    data: {
      actor_user_id: params.actorUserId,
      action: 'update_commission_rule',
      target_entity: 'CommissionRule',
      target_id: current.id,
      previous_value: current,
      new_value: updated,
      reason: params.reason.trim(),
    },
  });

  return updated;
}

export async function upsertPremiumInventoryItem(
  db: any = defaultPrisma,
  params: {
    actorUserId: string;
    reason: string;
    category: 'premium_id' | 'premium_email';
    display_value: string;
    rarity_tier: 'Regular' | 'Silver' | 'Gold' | 'Platinum' | 'Signature';
    price_idr: number;
    price_points?: number | null;
  }
) {
  if (!params.reason || params.reason.trim().length < 3) {
    throw new Error('Alasan perubahan inventaris wajib diisi.');
  }
  const normalized = params.display_value.trim().toLowerCase();
  const existing = await db.premiumIdentityInventory.findUnique({
    where: { category_normalized_value: { category: params.category, normalized_value: normalized } },
  });

  const saved = existing
    ? await db.premiumIdentityInventory.update({
        where: { id: existing.id },
        data: {
          rarity_tier: params.rarity_tier,
          price_idr: params.price_idr,
          price_points: params.price_points ?? null,
        },
      })
    : await db.premiumIdentityInventory.create({
        data: {
          category: params.category,
          display_value: params.display_value.trim(),
          normalized_value: normalized,
          rarity_tier: params.rarity_tier,
          price_idr: params.price_idr,
          price_points: params.price_points ?? null,
          status: 'Available',
        },
      });

  await db.adminAuditLog.create({
    data: {
      actor_user_id: params.actorUserId,
      action: existing ? 'update_premium_inventory' : 'create_premium_inventory',
      target_entity: 'PremiumIdentityInventory',
      target_id: saved.id,
      previous_value: existing ?? null,
      new_value: saved,
      reason: params.reason.trim(),
    },
  });

  return saved;
}

export async function processTransactionReversal(
  db: any = defaultPrisma,
  params: { actorUserId: string; ledgerTxId: string; reason: string }
) {
  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error('Alasan pembatalan/refund wajib diisi.');
  }

  const origTx = await db.ledgerTransaction.findUnique({ where: { id: params.ledgerTxId } });
  if (!origTx) {
    throw new Error('Transaksi ledger tidak ditemukan.');
  }

  const reversalLedger = await reverseLedgerTransaction(db, {
    originalTxId: origTx.id,
    idempotencyKey: `adminrev:${origTx.id}`,
    reason: params.reason.trim(),
    bucket: 'available',
  });

  const reversedCommissions = await reverseCommissionsForSale(db, {
    sourceTxRef: origTx.reference_code,
    reason: params.reason.trim(),
  });

  await db.adminAuditLog.create({
    data: {
      actor_user_id: params.actorUserId,
      action: 'reverse_transaction_and_commissions',
      target_entity: 'LedgerTransaction',
      target_id: origTx.id,
      previous_value: { reference_code: origTx.reference_code, status: origTx.status },
      new_value: { reversal_reference: reversalLedger.transaction.reference_code, reversed_commissions: reversedCommissions.length },
      reason: params.reason.trim(),
    },
  });

  return { reversalLedger, reversedCommissions };
}

