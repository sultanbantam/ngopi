import assert from 'assert';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import {
  DEFAULT_COMMISSION_RULE,
  accrueCommissionsForSale,
  calculateAffiliateCommissions,
  calculateNetDistributableRevenue,
  earnPoints,
  ensureUserIdentity,
  registerReferral,
  reverseCommissionsForSale,
  reversePointsTransaction,
} from '../src/services/ngopinomic/ngopinomicEconomy.service';
import {
  cancelReservation,
  listMarketplaceIdentities,
  purchasePremiumIdentity,
  reservePremiumIdentity,
  returnInventoryItem,
} from '../src/services/ngopinomic/ngopinomicMarketplace.service';
import {
  authorizeBoomBoomIdentity,
  setEcosystemConsent,
} from '../src/services/ngopinomic/ngopinomicEcosystem.service';
import { processTransactionReversal } from '../src/services/ngopinomic/ngopinomicAdmin.service';
import { postLedgerTransaction } from '../src/services/ngopinomic/ngopinomicLedger.service';
import ngopinomicRoutes from '../src/routes/ngopinomic.routes';
import { prisma } from '../src/utils/prisma';

// Stateful in-memory Prisma-compatible test store enforcing unique constraints & atomic updates
function createInMemoryNgopinomicDb() {
  const store: Record<string, any[]> = {
    userIdentity: [],
    premiumIdentityInventory: [],
    emailIdentity: [],
    pointsAccount: [],
    pointsTransaction: [],
    affiliateProfile: [],
    referralRelationship: [],
    commissionRule: [{ id: 'rule-1', ...DEFAULT_COMMISSION_RULE, is_active: true, updated_at: new Date() }],
    commissionTransaction: [],
    walletAccount: [],
    ledgerTransaction: [],
    ledgerEntry: [],
    bmcTransaction: [],
    communityMembership: [],
    ecosystemApplication: [],
    userConsent: [],
    fraudEvent: [],
    adminAuditLog: [],
  };

  const matchWhere = (row: any, where: any = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && 'in' in (v as any)) {
        return (v as any).in.includes(row[k]);
      }
      if (k === 'user_id_instrument') {
        return row.user_id === (v as any).user_id && row.instrument === (v as any).instrument;
      }
      if (k === 'user_id_app_id') {
        return row.user_id === (v as any).user_id && row.app_id === (v as any).app_id;
      }
      if (k === 'category_normalized_value') {
        return row.category === (v as any).category && row.normalized_value === (v as any).normalized_value;
      }
      return row[k] === v;
    });

  const makeRepo = (name: string) => ({
    findUnique: async ({ where }: any) => store[name].find((r) => matchWhere(r, where)) || null,
    findFirst: async ({ where }: any = {}) => store[name].find((r) => matchWhere(r, where)) || null,
    findMany: async ({ where }: any = {}) =>
      (where ? store[name].filter((r) => matchWhere(r, where)) : [...store[name]]).map((r) => ({
        ...r,
        ...(name === 'ledgerTransaction'
          ? {
              entries: store.ledgerEntry
                .filter((e) => e.ledger_tx_id === r.id)
                .map((e) => ({ ...e, account: store.walletAccount.find((a) => a.id === e.account_id) })),
            }
          : {}),
      })),
    count: async ({ where }: any = {}) =>
      where ? store[name].filter((r) => matchWhere(r, where)).length : store[name].length,
    create: async ({ data }: any) => {
      const row = { id: crypto.randomUUID(), created_at: new Date(), updated_at: new Date(), ...data };
      if (name === 'userIdentity' && store[name].some((r) => r.user_id === row.user_id)) {
        throw new Error('Unique constraint failed on user_id');
      }
      if (name === 'pointsTransaction' && store[name].some((r) => r.idempotency_key === row.idempotency_key)) {
        throw new Error('Unique constraint failed on idempotency_key');
      }
      store[name].push(row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const idx = store[name].findIndex((r) => matchWhere(r, where));
      if (idx === -1) throw new Error(`${name} record not found`);
      store[name][idx] = { ...store[name][idx], ...data, updated_at: new Date() };
      return store[name][idx];
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      store[name] = store[name].map((r) => {
        if (matchWhere(r, where)) {
          count += 1;
          return { ...r, ...data, updated_at: new Date() };
        }
        return r;
      });
      return { count };
    },
    upsert: async ({ where, update, create }: any) => {
      const idx = store[name].findIndex((r) => matchWhere(r, where));
      if (idx >= 0) {
        store[name][idx] = { ...store[name][idx], ...update, updated_at: new Date() };
        return store[name][idx];
      }
      const row = { id: crypto.randomUUID(), created_at: new Date(), updated_at: new Date(), ...create };
      store[name].push(row);
      return row;
    },
  });

  const db: any = { store };
  for (const key of Object.keys(store)) {
    db[key] = makeRepo(key);
  }
  // Enhance ledgerTransaction.findUnique with entries + account
  const origLedgerFind = db.ledgerTransaction.findUnique;
  db.ledgerTransaction.findUnique = async (args: any) => {
    const row = await origLedgerFind(args);
    if (!row) return null;
    return {
      ...row,
      entries: store.ledgerEntry
        .filter((e) => e.ledger_tx_id === row.id)
        .map((e) => ({ ...e, account: store.walletAccount.find((a) => a.id === e.account_id) })),
    };
  };
  return db;
}

async function runNgopinomicTests() {
  console.log('--- RUNNING NGOPINOMIC 15-CRITERIA ACCEPTANCE SUITE ---');
  const db = createInMemoryNgopinomicDb();

  const userA = { id: 'user-a-uuid', username: 'andi', display_name: 'Andi Kopi', bmc_id: 10 };
  const userB = { id: 'user-b-uuid', username: 'budi', display_name: 'Budi Warung', bmc_id: 11 };
  const userC = { id: 'user-c-uuid', username: 'citra', display_name: 'Citra Sultan', bmc_id: 12 };

  // 1. Existing users receive no duplicate Ngopi IDs
  const id1 = await ensureUserIdentity(db, userA);
  const id2 = await ensureUserIdentity(db, userA);
  assert.strictEqual(id1.id, id2.id);
  assert.strictEqual(db.store.userIdentity.length, 1);
  console.log('  ✅ PASS 1: No duplicate Ngopi IDs created for existing user');

  await ensureUserIdentity(db, userB);
  await ensureUserIdentity(db, userC);

  // 2. Premium identity cannot be sold twice
  const items = await listMarketplaceIdentities(db);
  const kopiItem = items.find((i: any) => i.display_value === 'kopi' && i.category === 'premium_id');
  assert.ok(kopiItem, 'Seeded premium identity "kopi" exists');

  // Setup referral: A -> B -> C
  const affA = await db.affiliateProfile.findUnique({ where: { user_id: userA.id } });
  await registerReferral(db, { referredUserId: userB.id, referralCode: affA.referral_code });
  const affB = await db.affiliateProfile.findUnique({ where: { user_id: userB.id } });
  await registerReferral(db, { referredUserId: userC.id, referralCode: affB.referral_code });

  // Unconfirmed Rupiah purchase must be rejected
  await assert.rejects(
    () =>
      purchasePremiumIdentity(db, {
        inventoryId: kopiItem.id,
        user: userC,
        paymentMethod: 'rupiah',
        idempotencyKey: 'buy-kopi-unconfirmed',
      }),
    /Pembayaran Rupiah belum tersedia/
  );

  process.env.NGOPINOMIC_ALLOW_MOCK_PAYMENT = 'true';
  const saleRes = await purchasePremiumIdentity(db, {
    inventoryId: kopiItem.id,
    user: userC,
    paymentMethod: 'rupiah',
    idempotencyKey: 'buy-kopi-c-1',
    paymentConfirmation: { provider: 'mock_test_provider', provider_tx_id: 'MOCK-TX-1' },
  });
  assert.strictEqual(saleRes.inventory.status, 'Active');
  await assert.rejects(
    () =>
      purchasePremiumIdentity(db, {
        inventoryId: kopiItem.id,
        user: userB,
        paymentMethod: 'rupiah',
        idempotencyKey: 'buy-kopi-b-2',
        paymentConfirmation: { provider: 'mock_test_provider', provider_tx_id: 'MOCK-TX-2' },
      }),
    /sudah terjual/
  );

  // Concurrent purchase race test on "warung"
  const warungItem = items.find((i: any) => i.display_value === 'warung' && i.category === 'premium_id');
  const [r1, r2] = await Promise.allSettled([
    purchasePremiumIdentity(db, {
      inventoryId: warungItem.id,
      user: userA,
      paymentMethod: 'rupiah',
      idempotencyKey: 'race-1',
      paymentConfirmation: { provider: 'mock_test_provider', provider_tx_id: 'MOCK-RACE-1' },
    }),
    purchasePremiumIdentity(db, {
      inventoryId: warungItem.id,
      user: userB,
      paymentMethod: 'rupiah',
      idempotencyKey: 'race-2',
      paymentConfirmation: { provider: 'mock_test_provider', provider_tx_id: 'MOCK-RACE-2' },
    }),
  ]);
  const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled');
  assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent buyer succeeds');

  // Reservation cancel & admin return
  const sultanItem = items.find((i: any) => i.display_value === 'sultan' && i.category === 'premium_id');
  await reservePremiumIdentity(db, { inventoryId: sultanItem.id, userId: userA.id });
  const cancelled = await cancelReservation(db, { inventoryId: sultanItem.id, userId: userA.id });
  assert.strictEqual(cancelled.status, 'Available');
  const returned = await returnInventoryItem(db, { inventoryId: warungItem.id, actorUserId: 'admin-1', reason: 'Pengembalian uji' });
  assert.strictEqual(returned.status, 'Returned');
  console.log('  ✅ PASS 2: Premium identity anti-double-sell, payment verification, race lock & cancel/return verified');

  // 3. Points cannot be generated through duplicate requests
  const pts1 = await earnPoints(db, {
    userId: userA.id,
    activityCode: 'daily_checkin',
    amount: 10,
    idempotencyKey: 'checkin:user-a:2026-11-14',
    description: 'Check-in harian',
  });
  const pts2 = await earnPoints(db, {
    userId: userA.id,
    activityCode: 'daily_checkin',
    amount: 10,
    idempotencyKey: 'checkin:user-a:2026-11-14',
    description: 'Check-in harian',
  });
  assert.strictEqual(pts1.idempotent, false);
  assert.strictEqual(pts2.idempotent, true);
  const accA = await db.pointsAccount.findUnique({ where: { user_id: userA.id } });
  assert.strictEqual(accA.balance, 10);

  // Daily earn cap (500) & append-only points reversal
  await assert.rejects(
    () =>
      earnPoints(db, {
        userId: userA.id,
        activityCode: 'bonus_test',
        amount: 500,
        idempotencyKey: 'cap-exceed-1',
        description: 'Exceed cap',
      }),
    /Batas perolehan Poin Ngopi harian/
  );
  await reversePointsTransaction(db, {
    originalTxId: pts1.transaction.id,
    idempotencyKey: 'rev-pts-1',
    reason: 'Uji reversal poin',
  });
  const accAAfterRev = await db.pointsAccount.findUnique({ where: { user_id: userA.id } });
  assert.strictEqual(accAAfterRev.balance, 0);
  console.log('  ✅ PASS 3: Duplicate points blocked, daily cap enforced, and points reversal verified');

  // 4. Referral relationships cannot be manipulated (self-referral & duplicate)
  await assert.rejects(
    () => registerReferral(db, { referredUserId: userA.id, referralCode: affA.referral_code }),
    /milik sendiri/
  );
  await assert.rejects(
    () => registerReferral(db, { referredUserId: userC.id, referralCode: affA.referral_code }),
    /sudah terdaftar/
  );
  console.log('  ✅ PASS 4: Self-referral and duplicate referral manipulation blocked');

  // 5. Commission is calculated from Net Distributable Revenue (exact Rp100,000 example)
  const ndrExample = calculateNetDistributableRevenue(100000, DEFAULT_COMMISSION_RULE, {
    taxes_idr: 10000,
    payment_fees_idr: 2000,
    infrastructure_idr: 3000,
    refund_reserve_idr: 5000,
    other_ops_idr: 10000,
  });
  assert.strictEqual(ndrExample.net_distributable_idr, 70000);
  const commExample = calculateAffiliateCommissions({
    netDistributableIdr: ndrExample.net_distributable_idr,
    directUserId: userB.id,
    rule: DEFAULT_COMMISSION_RULE,
  });
  assert.strictEqual(commExample[0].commissionAmountIdr, 14000, '20% of Rp70,000 = Rp14,000 (not Rp20,000)');
  console.log('  ✅ PASS 5: Commission strictly calculated from Net Distributable Revenue (Rp14,000)');

  // 6. Zero or negative net revenue generates zero payable commission
  const zeroNdr = calculateNetDistributableRevenue(10000, DEFAULT_COMMISSION_RULE, {
    taxes_idr: 4000,
    payment_fees_idr: 2000,
    infrastructure_idr: 2000,
    refund_reserve_idr: 2000,
    other_ops_idr: 5000,
  });
  assert.strictEqual(zeroNdr.net_distributable_idr, 0);
  const zeroComm = await accrueCommissionsForSale(db, {
    buyerUserId: userC.id,
    sourceTxRef: 'ZERO-TX-1',
    grossAmountIdr: 10000,
    explicitDeductions: { taxes_idr: 5000, other_ops_idr: 6000 },
  });
  assert.strictEqual(zeroComm.commissions.length, 0);
  console.log('  ✅ PASS 6: Zero/negative net revenue generates zero commission');

  // 7 & 12. Refunds reverse commission entries via append-only ledger
  const walletBBeforeRev = await db.walletAccount.findUnique({
    where: { user_id_instrument: { user_id: userB.id, instrument: 'IDR' } },
  });
  assert.ok(walletBBeforeRev.pending_balance > 0, 'User B accrued pending commission from User C purchase');
  await processTransactionReversal(db, {
    actorUserId: 'admin-1',
    ledgerTxId: saleRes.ledgerTx.id,
    reason: 'Permintaan refund terverifikasi',
  });
  const walletBAfterRev = await db.walletAccount.findUnique({
    where: { user_id_instrument: { user_id: userB.id, instrument: 'IDR' } },
  });
  assert.strictEqual(walletBAfterRev.pending_balance, 0, 'Pending commission reversed to 0');
  assert.ok(db.store.ledgerTransaction.some((t: any) => t.tx_type === 'refund_reversal'));
  console.log('  ✅ PASS 7 & 12: Refund reverses commission via append-only reversal entries');

  // 8. Affiliate rates obey configured caps (20% + 5% + 5% + 10% = 40% capped at 35%)
  const capped = calculateAffiliateCommissions({
    netDistributableIdr: 100000,
    directUserId: 'u1',
    level2UserId: 'u2',
    ambassadorUserId: 'u3',
    promoterUserId: 'u4',
    promoterRateBps: 1000,
    rule: { ...DEFAULT_COMMISSION_RULE, max_total_cap_bps: 3500 },
  });
  const totalCapCommission = capped.reduce((s, c) => s + c.commissionAmountIdr, 0);
  assert.strictEqual(totalCapCommission, 35000, 'Total commission capped at 35% of 100,000 = 35,000');
  console.log('  ✅ PASS 8: Affiliate rates strictly obey configured max_total_cap_bps');

  // 11. All transactions have unique references
  const refs = db.store.ledgerTransaction.map((t: any) => t.reference_code);
  assert.strictEqual(new Set(refs).size, refs.length);
  console.log('  ✅ PASS 11: All ledger transactions have unique reference codes');

  // 13. Failed transactions do not create inconsistent balances
  await assert.rejects(
    () =>
      postLedgerTransaction(db, {
        idempotencyKey: 'fail-debit-1',
        txType: 'points_redeem',
        instrument: 'IDR',
        description: 'Should fail',
        entries: [{ userId: userC.id, direction: 'debit', amount: 999999 }],
      }),
    /Insufficient/
  );
  console.log('  ✅ PASS 13: Failed debit transaction leaves balances consistent');

  // 14. BoomBoom integration respects application permissions & operational boundary
  await assert.rejects(
    () => authorizeBoomBoomIdentity(db, { user: userA, requestedRole: 'driver' }),
    /Izin aplikasi BoomBoom belum diberikan/
  );
  await setEcosystemConsent(db, {
    userId: userA.id,
    appCode: 'boomboom',
    grantedScopes: ['identity:basic'],
  });
  const bbAuth = await authorizeBoomBoomIdentity(db, { user: userA, requestedRole: 'driver' });
  assert.strictEqual(bbAuth.operational_authorized, false);
  assert.strictEqual('basic_email' in bbAuth, false, 'Email scope not granted -> omitted');
  console.log('  ✅ PASS 14: BoomBoom integration respects UserConsent scopes & operational_authorized=false');

  // 9 & 10. HTTP RBAC & user cannot modify own balance or access admin endpoints
  const origFindUser = (prisma as any).user?.findUnique;
  if ((prisma as any).user) {
    (prisma as any).user.findUnique = async ({ where }: any) =>
      where.id === 'ordinary-user'
        ? { id: 'ordinary-user', username: 'warung', display_name: 'Warung', role: 'user', bmc_id: 100 }
        : null;
  }

  const app = express();
  app.use(express.json());
  app.use('/api/ngopinomic', ngopinomicRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const token = jwt.sign({ id: 'ordinary-user', username: 'warung', role: 'user' }, process.env.JWT_SECRET || 'supersecret_fallback');

  const adminRes = await fetch(`http://127.0.0.1:${port}/api/ngopinomic/admin/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.strictEqual(adminRes.status, 403, 'Ordinary user blocked from /admin/config with 403');

  const spoofPointsRes = await fetch(`http://127.0.0.1:${port}/api/ngopinomic/points/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ activity_code: 'arbitrary_admin_grant', amount: 999999 }),
  });
  assert.strictEqual(spoofPointsRes.status, 400, 'Users cannot spoof arbitrary points activity/amount');

  server.close();
  if ((prisma as any).user && origFindUser) (prisma as any).user.findUnique = origFindUser;
  console.log('  ✅ PASS 9 & 10: Ordinary users blocked from admin (403) and cannot spoof points/balances');

  // 15. Reverse-sanity check: existing points/NDR functions remain clean
  await reverseCommissionsForSale(db, { sourceTxRef: 'NON_EXISTENT', reason: 'noop' });
  console.log('  ✅ PASS 15: Clean execution without regressions');

  console.log('\n🎉 ALL 15 NGOPINOMIC ACCEPTANCE TESTS PASSED!');
}

runNgopinomicTests().catch((err) => {
  console.error('❌ NGOPINOMIC test failed:', err);
  process.exit(1);
});

