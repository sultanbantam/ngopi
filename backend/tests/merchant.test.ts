import assert from 'assert';
import { MerchantService } from '../src/services/merchant.service';
import { PointsManager } from '../src/utils/pointsManager';

async function runTests() {
  console.log('--- Starting Merchant & Cafe Partner Tests ---');

  // Test 1: List Partners
  console.log('Test 1: listPartners()');
  const partners = await MerchantService.listPartners();
  assert(Array.isArray(partners), 'Partners must be an array');
  assert(partners.length >= 3, 'Must have initial cafe partners');
  const warkop = partners.find((p) => p.qr_code_token === 'NGOPI_WARKOP_SEDUH');
  assert(warkop, 'Should find Warkop Seduh Sahabat');
  assert(warkop.qr_code_data_url && warkop.qr_code_data_url.startsWith('data:image/png;base64,'), 'QR data URL must be generated');
  console.log('✓ Test 1 passed: Default cafe partners and QR data URLs loaded.');

  // Test 2: Get Cafe Details
  console.log('Test 2: getProfileByTokenOrId()');
  const cafe = await MerchantService.getProfileByTokenOrId('NGOPI_WARKOP_SEDUH');
  assert(cafe !== null, 'Cafe must exist');
  assert.strictEqual(cafe?.cafe_name, 'Warkop Seduh Sahabat');
  assert(cafe?.promos.length > 0, 'Cafe should have active promos');
  console.log('✓ Test 2 passed: Cafe details and promos retrieved.');

  // Test 3: Check-in & Points Awarding
  console.log('Test 3: processCheckin() awards 50 points');
  const testUserId = `test_user_${Date.now()}`;
  const testUsername = `user_tester_${Date.now()}`;
  const initialPoints = PointsManager.getPoints(testUsername);

  const checkinRes = await MerchantService.processCheckin(
    'NGOPI_WARKOP_SEDUH',
    testUserId,
    testUsername
  );
  assert.strictEqual(checkinRes.success, true, 'Checkin must succeed');
  assert.strictEqual(checkinRes.pointsAwarded, 50, 'Must award 50 points');
  const newPoints = PointsManager.getPoints(testUsername);
  assert.strictEqual(newPoints, initialPoints + 50, 'Points balance must increase by 50');
  console.log('✓ Test 3 passed: User checked in and gained 50 points.');

  // Test 4: 1x Daily Limit Rule
  console.log('Test 4: processCheckin() rejects multiple check-ins on same day');
  const repeatCheckinRes = await MerchantService.processCheckin(
    'NGOPI_WARKOP_SEDUH',
    testUserId,
    testUsername
  );
  assert.strictEqual(repeatCheckinRes.success, false, 'Repeat checkin must fail');
  assert.strictEqual(repeatCheckinRes.alreadyCheckedIn, true, 'Flag alreadyCheckedIn must be true');
  assert(repeatCheckinRes.error?.includes('sudah check-in'), 'Error must inform already checked in today');
  console.log('✓ Test 4 passed: Daily check-in limit enforced.');

  // Test 5: Submit Application -> Admin Approve -> Update Profile (Stage B1B Lifecycle)
  console.log('Test 5: submitApplication() -> approveApplication() -> registerOrUpdateProfile()');
  const { prisma } = await import('../src/utils/prisma');
  const merchantUserId = `merchant_owner_${Date.now()}`;
  const adminUserId = 'admin_reviewer_test';
  const mockUsers = new Map<string, any>([
    [merchantUserId, { id: merchantUserId, role: 'user', name: 'Owner Test' }],
    [adminUserId, { id: adminUserId, role: 'admin', name: 'Admin Test' }],
  ]);
  const mockProfiles = new Map<string, any>();
  const mockAudits: any[] = [];

  const origUser = (prisma as any).user;
  const origMp = (prisma as any).merchantProfile;
  const origAudit = (prisma as any).merchantReviewAudit;
  const origTx = (prisma as any).$transaction;
  const origCheckin = (prisma as any).merchantCheckin;
  const origPromo = (prisma as any).merchantPromo;

  (prisma as any).user = {
    findUnique: async ({ where }: any) => mockUsers.get(where.id) || null,
    update: async ({ where, data }: any) => {
      const u = mockUsers.get(where.id);
      if (!u) throw new Error('User not found');
      const updated = { ...u, ...data };
      mockUsers.set(where.id, updated);
      return updated;
    },
  };
  (prisma as any).merchantProfile = {
    findUnique: async ({ where }: any) => {
      if (where.user_id) return mockProfiles.get(where.user_id) || null;
      if (where.id) {
        for (const p of mockProfiles.values()) if (p.id === where.id) return p;
      }
      return null;
    },
    create: async ({ data }: any) => {
      const created = { id: `m_${data.user_id}`, ...data, created_at: new Date(), updated_at: new Date() };
      mockProfiles.set(data.user_id, created);
      return created;
    },
    update: async ({ where, data }: any) => {
      const existing = where.user_id
        ? mockProfiles.get(where.user_id)
        : Array.from(mockProfiles.values()).find((p) => p.id === where.id);
      if (!existing) throw new Error('Profile not found');
      const updated = { ...existing, ...data, updated_at: new Date() };
      mockProfiles.set(existing.user_id, updated);
      return updated;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      for (const [uid, p] of mockProfiles.entries()) {
        if (where.id && p.id !== where.id) continue;
        if (where.review_status && p.review_status !== where.review_status) continue;
        if (where.is_showcase !== undefined && p.is_showcase !== where.is_showcase) continue;
        mockProfiles.set(uid, { ...p, ...data, updated_at: new Date() });
        count++;
      }
      return { count };
    },
  };
  (prisma as any).merchantReviewAudit = {
    create: async ({ data }: any) => {
      const row = { id: `aud_${mockAudits.length + 1}`, ...data, created_at: new Date() };
      mockAudits.push(row);
      return row;
    },
    findMany: async ({ where }: any) => mockAudits.filter((a) => a.merchant_id === where.merchant_id),
  };
  (prisma as any).$transaction = async (fn: any) => fn(prisma);
  (prisma as any).merchantCheckin = { findMany: async () => [] };
  (prisma as any).merchantPromo = {
    findMany: async () => [],
    create: async ({ data }: any) => data,
    deleteMany: async () => ({ count: 1 }),
  };

  try {
    const appRes = await MerchantService.submitApplication(merchantUserId, {
      cafe_name: 'Kopi Santai Antigravity',
      business_category: 'Coffee Shop',
      address: 'Jl. Merdeka No. 45',
      description: 'Cafe modern tempat ngoding dan ngopi santai',
      phone: '0812-9988-7766',
      reward_points: 60,
    });
    assert.strictEqual(appRes.success, true, 'Application submission must succeed');
    assert.strictEqual(appRes.status, 'pending', 'Application must start pending');

    const approveRes = await MerchantService.approveApplication(appRes.profile!.id, adminUserId);
    assert.strictEqual(approveRes.success, true, 'Admin approval must succeed');
    assert.strictEqual(mockUsers.get(merchantUserId)?.role, 'merchant', 'User role must be promoted to merchant');

    const regRes = await MerchantService.registerOrUpdateProfile(merchantUserId, {
      cafe_name: 'Kopi Santai Antigravity',
      address: 'Jl. Merdeka No. 45',
      description: 'Cafe modern tempat ngoding dan ngopi santai',
      phone: '0812-9988-7766',
      reward_points: 60,
    });
    assert.strictEqual(regRes.success, true, 'Approved merchant profile update must succeed');
    assert(regRes.profile, 'Profile must be returned');
    assert(regRes.profile.qr_code_token.includes('NGOPI_KOPI_SANTAI'), 'Token should have cafe slug');
    assert(regRes.profile.qr_code_data_url?.startsWith('data:image/png;base64,'), 'QR data URL must be generated');
    console.log('✓ Test 5 passed: Application -> Admin Approval -> Profile update verified.');

    // Test 6: Merchant Dashboard Data
    console.log('Test 6: getDashboard()');
    const dashboard = await MerchantService.getDashboard(merchantUserId);
    assert(dashboard !== null, 'Dashboard must exist');
    assert.strictEqual(dashboard?.profile.cafe_name, 'Kopi Santai Antigravity');
    assert(dashboard?.stats !== undefined, 'Stats must exist');
    assert(dashboard?.standingTableUrl.includes('ngopi.top/warung/'), 'Standing table URL must be valid');
    console.log('✓ Test 6 passed: Dashboard data, statistics, and standing card generated.');

    // Test 7: Add & Delete Promo
    console.log('Test 7: addPromo() and deletePromo()');
    const promoRes = await MerchantService.addPromo(regRes.profile.id, {
      title: 'Diskon 30% Kopi Cold Brew',
      description: 'Khusus member Ngopi yang check-in di meja',
      discount: '30%',
      valid_until: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
    assert.strictEqual(promoRes.success, true, 'Add promo must succeed');
    assert(promoRes.promo, 'Promo object returned');

    const delRes = await MerchantService.deletePromo(regRes.profile.id, promoRes.promo!.id);
    assert.strictEqual(delRes.success, true, 'Delete promo must succeed');
    console.log('✓ Test 7 passed: Promo creation and deletion verified.');
  } finally {
    (prisma as any).user = origUser;
    (prisma as any).merchantProfile = origMp;
    (prisma as any).merchantReviewAudit = origAudit;
    (prisma as any).$transaction = origTx;
    (prisma as any).merchantCheckin = origCheckin;
    (prisma as any).merchantPromo = origPromo;
  }

  console.log('\n🎉 ALL 7 MERCHANT TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch((err) => {
  console.error('Merchant test failed:', err);
  process.exit(1);
});
