import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { prisma } from '../src/utils/prisma';
import { telecomService } from '../src/services/telecom.service';

// Isolate test storage in OS temp directory so workspace telecom_store.json is untouched
const tempStoreFile = path.join(os.tmpdir(), `ngopi_telecom_test_${Date.now()}.json`);
(telecomService as any).dataFilePath = tempStoreFile;
(telecomService as any).customNumbers = new Map();
(telecomService as any).customEmails = new Map();
(telecomService as any).vipUnlocked = new Map();
(telecomService as any).vipEmailsUnlocked = new Map();
(telecomService as any).orders = [];
(telecomService as any).vipRequests = [];
(telecomService as any).auditLogs = [];

// Mock prisma.user.findMany in-memory so unit tests never mutate production DB!
const mockUsers = [
  { id: 'u-ngopi', username: 'ngopi', display_name: 'founder', avatar_url: null, role: 'admin', bmc_id: 1 },
  { id: 'u-warung', username: 'warung', display_name: 'Warung Kopi', avatar_url: null, role: 'user', bmc_id: 2 },
  { id: 'u-budi', username: 'budi', display_name: 'Budi', avatar_url: null, role: 'user', bmc_id: 10 },
  { id: 'u-siti', username: 'siti', display_name: 'Siti', avatar_url: null, role: 'user', bmc_id: 11 },
];

(prisma.user as any).findMany = async () => mockUsers;
(prisma.user as any).findFirst = async (args: any) => {
  const orList = args?.where?.OR || [];
  for (const cond of orList) {
    if (cond.id) {
      const found = mockUsers.find((u) => u.id === cond.id);
      if (found) return found;
    }
    if (cond.username?.equals) {
      const target = String(cond.username.equals).toLowerCase();
      const found = mockUsers.find((u) => u.username.toLowerCase() === target);
      if (found) return found;
    }
  }
  return null;
};

async function runTests() {
  let passed = 0;
  const check = (name: string, fn: () => Promise<void> | void) =>
    Promise.resolve()
      .then(fn)
      .then(() => {
        passed += 1;
        console.log(`✅ [PASS] ${name}`);
      });

  // Test 0: Founder @ngopi exclusively holds #0 and @warung gets 100
  await check('0. Founder @ngopi exclusively holds #0 and dialing 0 resolves to @ngopi (not @warung)', async () => {
    const dir = telecomService.buildDirectoryMap(mockUsers);
    assert.strictEqual(dir.get('u-ngopi')?.number, '0');
    assert.strictEqual(dir.get('u-warung')?.number, '100');
    const resolvedZero = await telecomService.resolveUserByIdentifier('0');
    assert.strictEqual(resolvedZero?.username, 'ngopi');
  });

  // 1. User baru / lama mendapat nomor otomatis 10 digit & email otomatis
  await check('1. Regular user gets 10-digit automatic number and @ngopi.top automatic email', async () => {
    const dir = telecomService.buildDirectoryMap(mockUsers);
    const budi = dir.get('u-budi')!;
    assert.match(budi.number, /^\d{10}$/);
    assert.match(budi.email, /@ngopi\.top$/);
  });

  // 2. User cek nomor pilihan yang tersedia
  await check('2. Check available custom number returns available=true', async () => {
    const res = await telecomService.checkNumberAvailability('1945', mockUsers[2]);
    assert.strictEqual(res.available, true);
    assert.strictEqual(res.normalized, '1945');
  });

  // 3. User cek nomor yang sudah dipakai user lain
  await check('3. Check number owned by another user returns available=false', async () => {
    const dir = telecomService.buildDirectoryMap(mockUsers);
    const sitiNum = dir.get('u-siti')!.number;
    const res = await telecomService.checkNumberAvailability(sitiNum, mockUsers[2]);
    assert.strictEqual(res.available, false);
  });

  // 4. User cek nomor resmi 0..100 -> ditolak sebagai alokasi resmi Ngopi
  await check('4. Official numbers 0 and 1..100 are protected for non-founder users', async () => {
    const res0 = await telecomService.checkNumberAvailability('0', mockUsers[2]);
    const res7 = await telecomService.checkNumberAvailability('7', mockUsers[2]);
    assert.strictEqual(res0.available, false);
    assert.strictEqual(res7.available, false);
    assert.ok(res7.reason?.includes('Tim Ngopi'));
  });

  // 5. User cek email resmi yang direserve sistem
  await check('5. Reserved system email prefixes (admin, support, warung, ngopi) are protected', async () => {
    const res = await telecomService.checkEmailAvailability('admin@ngopi.top', mockUsers[2]);
    assert.strictEqual(res.available, false);
    assert.strictEqual(res.lockedVip, true);
  });

  // 6. User checkout nomor pilihan reguler -> harga dihitung server (Rp 35.000)
  let regularOrderId = '';
  await check('6. Checkout regular 4-6 digit number enforces server price Rp 35.000 and 30m reservation', async () => {
    const res = await telecomService.createOrderCheckout(mockUsers[2], {
      package_code: 'number_regular',
      requested_number: '2407',
    });
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.order?.amount_idr, 35000);
    assert.strictEqual(res.order?.status, 'pending_payment');
    regularOrderId = res.order!.id;
  });

  // 7. User lain mencoba checkout nomor yang sedang direservasi -> ditolak (409)
  await check('7. Concurrent reservation conflict on same number is rejected (409)', async () => {
    const res = await telecomService.createOrderCheckout(mockUsers[3], {
      package_code: 'number_regular',
      requested_number: '2407',
    });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.statusCode, 409);
  });

  // 8. Checkout bundling -> validasi kedua identitas (gagal jika salah satu bentrok)
  await check('8. Bundle checkout rejects if email or number is already reserved/taken', async () => {
    const badBundle = await telecomService.createOrderCheckout(mockUsers[3], {
      package_code: 'bundle_identity',
      requested_number: '2407', // reserved by budi
      requested_email: 'siti.kopi',
    });
    assert.strictEqual(badBundle.success, false);

    const goodBundle = await telecomService.createOrderCheckout(mockUsers[3], {
      package_code: 'bundle_identity',
      requested_number: '8080',
      requested_email: 'siti.kopi',
    });
    assert.strictEqual(goodBundle.success, true);
    assert.strictEqual(goodBundle.order?.amount_idr, 49000);
    assert.strictEqual(goodBundle.order?.requested_number, '8080');
    assert.strictEqual(goodBundle.order?.requested_email, 'siti.kopi@ngopi.top');
  });

  // 9 & 10. Webhook payment valid -> aktivasi otomatis + idempotensi
  await check('9 & 10. Valid HMAC webhook activates order and second call is idempotent', async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret-ngopi';
    const order = telecomService.getMyOrders(mockUsers[2].id).find((o) => o.id === regularOrderId)!;
    const payload = {
      order_code: order.order_code,
      status: 'paid',
      amount_idr: order.total_transfer_idr,
      payment_reference: 'BRI-MUT-9991',
    };
    const raw = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET).update(raw).digest('hex');

    const w1 = await telecomService.processPaymentWebhook(payload, raw, sig);
    assert.strictEqual(w1.success, true);
    assert.strictEqual(w1.alreadyActivated, false);
    assert.strictEqual(w1.order?.status, 'activated');
    assert.strictEqual(telecomService.getNumberForUser(mockUsers[2]), '2407');

    // Replay same webhook -> idempotent
    const w2 = await telecomService.processPaymentWebhook(payload, raw, sig);
    assert.strictEqual(w2.success, true);
    assert.strictEqual(w2.alreadyActivated, true);
  });

  // 11. Webhook invalid signature -> ditolak 401
  await check('11. Invalid HMAC webhook signature is rejected with 401', async () => {
    const payload = { order_code: 'FAKE', status: 'paid' };
    const res = await telecomService.processPaymentWebhook(payload, JSON.stringify(payload), 'bad-signature');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.statusCode, 401);
  });

  // 12. Submit proof without bank mutation API moves order to verifying (NOT fake-activated)
  await check('12. Submit BRI transfer proof moves order to verifying without fake activation', async () => {
    const sitiOrder = telecomService.getMyOrders(mockUsers[3].id)[0];
    const proofRes = await telecomService.submitOrderProof(mockUsers[3], sitiOrder.id, {
      payment_reference: 'TRX-BRI-12345',
      bank_sender_name: 'Siti Aminah',
    });
    assert.strictEqual(proofRes.success, true);
    assert.strictEqual(proofRes.autoActivated, false);
    assert.strictEqual(proofRes.order?.status, 'verifying');
  });

  // 13. Admin approve activates bundle atomically (both number + email)
  await check('13. Admin approval activates bundle (number + email) atomically and logs audit trail', async () => {
    const sitiOrder = telecomService.getMyOrders(mockUsers[3].id)[0];
    const appr = await telecomService.approveOrderByAdmin(mockUsers[0], sitiOrder.id, 'approve', 'Mutasi BRI cocok');
    assert.strictEqual(appr.success, true);
    assert.strictEqual(appr.order?.status, 'activated');
    assert.strictEqual(telecomService.getNumberForUser(mockUsers[3]), '8080');
    assert.strictEqual(telecomService.formatEmail(mockUsers[3].username, mockUsers[3].id), 'siti.kopi@ngopi.top');
  });

  // 14. Reservasi expired -> nomor kembali tersedia
  await check('14. Expired pending_payment reservation is released automatically', async () => {
    const chkOrder = await telecomService.createOrderCheckout(mockUsers[2], {
      package_code: 'number_regular',
      requested_number: '5656',
    });
    assert.strictEqual(chkOrder.success, true);
    // Force reserved_until to the past
    chkOrder.order!.reserved_until = new Date(Date.now() - 60_000).toISOString();
    const avail = await telecomService.checkNumberAvailability('5656', mockUsers[3]);
    assert.strictEqual(avail.available, true);
  });

  // 15. VIP request + Audit log + Recommendations
  await check('15. VIP request logged, audit logs recorded, and recommendations return verified available options', async () => {
    const vip = telecomService.createVipRequest(mockUsers[2], {
      requested_number: '7',
      notes: 'Ingin nomor 7 untuk komunitas',
    });
    assert.strictEqual(vip.success, true);
    assert.strictEqual(vip.request?.status, 'pending');

    const logs = telecomService.getAdminAuditLogs(mockUsers[0]);
    assert.ok(logs.length >= 4);

    const recs = await telecomService.getAvailableRecommendations(mockUsers[2]);
    assert.ok(recs.regular_numbers.length > 0);
    assert.ok(recs.special_numbers.length > 0);
    assert.ok(recs.emails.length > 0);
  });

  console.log(`\n🎉 ALL ${passed} TESTS PASSED SUCCESSFULLY!`);
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
