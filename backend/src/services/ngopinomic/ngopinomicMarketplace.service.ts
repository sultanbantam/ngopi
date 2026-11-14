import crypto from 'crypto';
import { prisma as defaultPrisma } from '../../utils/prisma';
import {
  accrueCommissionsForSale,
  ensureUserIdentity,
  redeemPoints,
} from './ngopinomicEconomy.service';
import { generateReferenceCode, postLedgerTransaction } from './ngopinomicLedger.service';

export const DEFAULT_PREMIUM_SEED = [
  { category: 'premium_id', display_value: 'kopi', rarity_tier: 'Gold', price_idr: 250000, price_points: 25000 },
  { category: 'premium_id', display_value: 'warung', rarity_tier: 'Gold', price_idr: 250000, price_points: 25000 },
  { category: 'premium_id', display_value: 'sultan', rarity_tier: 'Platinum', price_idr: 750000, price_points: null },
  { category: 'premium_id', display_value: 'banten', rarity_tier: 'Platinum', price_idr: 750000, price_points: null },
  { category: 'premium_id', display_value: 'ngopi_pro', rarity_tier: 'Regular', price_idr: 25000, price_points: 2500 },
  { category: 'premium_email', display_value: 'kopi@ngopi.top', rarity_tier: 'Gold', price_idr: 250000, price_points: 25000 },
  { category: 'premium_email', display_value: 'warung@ngopi.top', rarity_tier: 'Gold', price_idr: 250000, price_points: 25000 },
  { category: 'premium_email', display_value: 'sultan@ngopi.top', rarity_tier: 'Platinum', price_idr: 750000, price_points: null },
  { category: 'premium_email', display_value: 'barista@ngopi.top', rarity_tier: 'Silver', price_idr: 75000, price_points: 7500 },
];

export async function seedDefaultMarketplaceInventory(db: any = defaultPrisma) {
  const count = await db.premiumIdentityInventory.count();
  if (count > 0) return;

  for (const item of DEFAULT_PREMIUM_SEED) {
    await db.premiumIdentityInventory.create({
      data: {
        category: item.category,
        display_value: item.display_value,
        normalized_value: item.display_value.trim().toLowerCase(),
        rarity_tier: item.rarity_tier,
        price_idr: item.price_idr,
        price_points: item.price_points,
        status: 'Available',
      },
    });
  }
}

export async function listMarketplaceIdentities(
  db: any = defaultPrisma,
  filter?: { category?: string; status?: string }
) {
  await seedDefaultMarketplaceInventory(db);
  return db.premiumIdentityInventory.findMany({
    where: {
      ...(filter?.category ? { category: filter.category } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: [{ rarity_tier: 'asc' }, { price_idr: 'asc' }],
  });
}

export async function reservePremiumIdentity(
  db: any = defaultPrisma,
  params: { inventoryId: string; userId: string; ttlMinutes?: number }
) {
  const now = new Date();
  const ttl = params.ttlMinutes ?? 15;
  const reservedUntil = new Date(now.getTime() + ttl * 60 * 1000);

  const item = await db.premiumIdentityInventory.findUnique({
    where: { id: params.inventoryId },
  });
  if (!item) {
    throw new Error('Identitas premium tidak ditemukan.');
  }

  const isExpiredReservation =
    item.status === 'Reserved' && item.reserved_until && new Date(item.reserved_until) < now;

  if (item.status !== 'Available' && !isExpiredReservation) {
    throw new Error(`Identitas "${item.display_value}" sedang tidak tersedia (status: ${item.status}).`);
  }

  return db.premiumIdentityInventory.update({
    where: { id: item.id },
    data: {
      status: 'Reserved',
      reserved_by_user_id: params.userId,
      reserved_until: reservedUntil,
    },
  });
}

export async function cancelReservation(
  db: any = defaultPrisma,
  params: { inventoryId: string; userId: string }
) {
  const item = await db.premiumIdentityInventory.findUnique({ where: { id: params.inventoryId } });
  if (!item || item.status !== 'Reserved' || item.reserved_by_user_id !== params.userId) {
    throw new Error('Reservasi aktif milik Anda tidak ditemukan.');
  }
  return db.premiumIdentityInventory.update({
    where: { id: item.id },
    data: { status: 'Available', reserved_by_user_id: null, reserved_until: null },
  });
}

export async function returnInventoryItem(
  db: any = defaultPrisma,
  params: { inventoryId: string; actorUserId: string; reason: string }
) {
  if (!params.reason || params.reason.trim().length < 3) {
    throw new Error('Alasan pengembalian inventaris wajib diisi.');
  }
  const item = await db.premiumIdentityInventory.findUnique({ where: { id: params.inventoryId } });
  if (!item) throw new Error('Identitas premium tidak ditemukan.');

  const updated = await db.premiumIdentityInventory.update({
    where: { id: item.id },
    data: {
      status: 'Returned',
      owner_user_id: null,
      reserved_by_user_id: null,
      reserved_until: null,
    },
  });

  await db.adminAuditLog.create({
    data: {
      actor_user_id: params.actorUserId,
      action: 'return_premium_inventory',
      target_entity: 'PremiumIdentityInventory',
      target_id: item.id,
      previous_value: { status: item.status, owner_user_id: item.owner_user_id },
      new_value: { status: 'Returned' },
      reason: params.reason.trim(),
    },
  });

  return updated;
}

export interface PaymentConfirmation {
  provider: string;
  provider_tx_id: string;
  signature?: string;
}

export function verifyRupiahPaymentConfirmation(
  confirmation: PaymentConfirmation | undefined,
  expectedAmountIdr: number,
  userId: string
) {
  if (!confirmation || !confirmation.provider || !confirmation.provider_tx_id) {
    throw new Error('Pembayaran Rupiah belum tersedia: penyedia jasa pembayaran (PJP) resmi belum terhubung.');
  }

  const allowMock =
    process.env.NGOPINOMIC_ALLOW_MOCK_PAYMENT === 'true' || process.env.NODE_ENV === 'test';

  if (confirmation.provider === 'mock_test_provider') {
    if (!allowMock) {
      throw new Error('Mock payment provider hanya diizinkan pada lingkungan pengujian/staging.');
    }
    return { verified: true, mode: 'mock_test_provider_not_real_payment' };
  }

  const secret = process.env.NGOPINOMIC_PAYMENT_SECRET;
  if (!secret || !confirmation.signature) {
    throw new Error('Tanda tangan konfirmasi pembayaran PJP tidak valid atau belum dikonfigurasi.');
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${confirmation.provider}:${confirmation.provider_tx_id}:${userId}:${expectedAmountIdr}`)
    .digest('hex');

  if (
    confirmation.signature.length !== expectedSig.length ||
    !crypto.timingSafeEqual(Buffer.from(confirmation.signature), Buffer.from(expectedSig))
  ) {
    throw new Error('Verifikasi tanda tangan pembayaran PJP gagal.');
  }

  return { verified: true, mode: 'verified_pjp' };
}

export async function purchasePremiumIdentity(
  db: any = defaultPrisma,
  params: {
    inventoryId: string;
    user: { id: string; username: string; bmc_id?: number };
    paymentMethod: 'rupiah' | 'points';
    idempotencyKey: string;
    paymentConfirmation?: PaymentConfirmation;
  }
) {
  const existingLedger = await db.ledgerTransaction.findUnique({
    where: { idempotency_key: params.idempotencyKey },
  });
  if (existingLedger) {
    const item = await db.premiumIdentityInventory.findUnique({ where: { id: params.inventoryId } });
    return { idempotent: true, inventory: item, ledgerTx: existingLedger, commissions: [] };
  }

  const now = new Date();
  const item = await db.premiumIdentityInventory.findUnique({
    where: { id: params.inventoryId },
  });
  if (!item) {
    throw new Error('Identitas premium tidak ditemukan.');
  }

  const isReservedByCaller =
    item.status === 'Reserved' &&
    item.reserved_by_user_id === params.user.id &&
    (!item.reserved_until || new Date(item.reserved_until) >= now);
  const isExpiredReservation =
    item.status === 'Reserved' && item.reserved_until && new Date(item.reserved_until) < now;

  if (item.status !== 'Available' && !isReservedByCaller && !isExpiredReservation) {
    throw new Error(`Identitas "${item.display_value}" sudah terjual atau tidak tersedia.`);
  }

  if (params.paymentMethod === 'rupiah') {
    verifyRupiahPaymentConfirmation(params.paymentConfirmation, item.price_idr, params.user.id);
  } else {
    if (!item.price_points || item.price_points <= 0) {
      throw new Error('Identitas ini tidak mendukung penukaran dengan Poin Ngopi.');
    }
  }

  await ensureUserIdentity(db, params.user);
  const txRef = generateReferenceCode('IDP');

  // Atomic conditional lock FIRST to prevent double-selling under race conditions
  const updatedCount = await db.premiumIdentityInventory.updateMany({
    where: {
      id: item.id,
      status: item.status,
    },
    data: {
      status: 'Active',
      owner_user_id: params.user.id,
      reserved_by_user_id: null,
      reserved_until: null,
      sold_at: now,
      activated_at: now,
    },
  });

  if (updatedCount.count === 0) {
    throw new Error('Identitas baru saja dipesan atau dibeli pengguna lain.');
  }

  if (params.paymentMethod === 'points') {
    await redeemPoints(db, {
      userId: params.user.id,
      activityCode: 'premium_identity_redeem',
      amount: item.price_points,
      idempotencyKey: `pts:${params.idempotencyKey}`,
      description: `Penukaran ${item.display_value} (${item.rarity_tier})`,
      metadata: { inventory_id: item.id, source_tx_ref: txRef },
    });
  }

  const updatedItem = await db.premiumIdentityInventory.findUnique({ where: { id: item.id } });

  if (item.category === 'premium_email') {
    await db.emailIdentity.create({
      data: {
        user_id: params.user.id,
        email_address: item.normalized_value,
        inventory_id: item.id,
        is_primary: false,
        status: 'active',
      },
    });
  } else if (item.category === 'premium_id') {
    await db.userIdentity.update({
      where: { user_id: params.user.id },
      data: { tier: 'premium' },
    });
  }

  const ledgerResult = await postLedgerTransaction(db, {
    idempotencyKey: params.idempotencyKey,
    referenceCode: txRef,
    txType: 'identity_purchase',
    instrument: params.paymentMethod === 'points' ? 'POINTS' : 'IDR',
    description: `Aktivasi ${item.category === 'premium_email' ? 'Email' : 'ID'} Premium: ${item.display_value}`,
    metadata: {
      inventory_id: item.id,
      rarity_tier: item.rarity_tier,
      payment_method: params.paymentMethod,
      amount: params.paymentMethod === 'points' ? item.price_points : item.price_idr,
    },
    entries: [
      {
        userId: 'PLATFORM_TREASURY',
        direction: 'credit',
        amount: params.paymentMethod === 'points' ? (item.price_points || 1) : item.price_idr,
        bucket: 'available',
      },
    ],
  });

  // Affiliate commissions only originate from genuine Rupiah transactions, calculated from Net Distributable Revenue
  let commissionResult: any = { ndr: null, commissions: [] };
  if (params.paymentMethod === 'rupiah' && item.price_idr > 0) {
    commissionResult = await accrueCommissionsForSale(db, {
      buyerUserId: params.user.id,
      sourceTxRef: txRef,
      grossAmountIdr: item.price_idr,
    });
  }

  return {
    idempotent: false,
    inventory: updatedItem,
    ledgerTx: ledgerResult.transaction,
    ndr: commissionResult.ndr,
    commissions: commissionResult.commissions,
  };
}

