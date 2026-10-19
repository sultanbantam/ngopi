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

  // Test 5: Register New Cafe Partner
  console.log('Test 5: registerOrUpdateProfile()');
  const merchantUserId = `merchant_owner_${Date.now()}`;
  const regRes = await MerchantService.registerOrUpdateProfile(merchantUserId, {
    cafe_name: 'Kopi Santai Antigravity',
    address: 'Jl. Merdeka No. 45',
    description: 'Cafe modern tempat ngoding dan ngopi santai',
    phone: '0812-9988-7766',
    reward_points: 60,
  });
  assert.strictEqual(regRes.success, true, 'Registration must succeed');
  assert(regRes.profile, 'Profile must be returned');
  assert(regRes.profile.qr_code_token.includes('NGOPI_KOPI_SANTAI'), 'Token should have cafe slug');
  assert(regRes.profile.qr_code_data_url?.startsWith('data:image/png;base64,'), 'QR data URL must be generated');
  console.log('✓ Test 5 passed: New cafe partner registered with QR token.');

  // Test 6: Merchant Dashboard Data
  console.log('Test 6: getDashboard()');
  const dashboard = await MerchantService.getDashboard(regRes.profile.id);
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

  console.log('\n🎉 ALL 7 MERCHANT TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch((err) => {
  console.error('Merchant test failed:', err);
  process.exit(1);
});
