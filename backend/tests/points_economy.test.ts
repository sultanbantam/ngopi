import assert from 'assert';
import { PointsEconomyService, PREMIUM_CATALOG } from '../src/services/points.service';

function runPointsEconomyTests() {
  console.log('--- RUNNING SPRINT 7: EKONOMI BMC & POIN NGOPI UNIT TESTS ---');

  const economy = new PointsEconomyService();
  economy.resetForTesting();

  // TEST 1: Initial User Points & Welcome Bonus
  console.log('Test 1: User Points Creation & Welcome Bonus');
  const userA = economy.getOrCreateUserPoints('user_andi_01');
  assert.strictEqual(userA.user_id, 'user_andi_01', 'User ID matches');
  assert.strictEqual(userA.balance, 100, 'Initial starter balance is 100 points');
  assert.strictEqual(userA.lifetime, 100, 'Lifetime points is 100');
  console.log('  ✅ PASS: Initial user points and welcome bonus verified');

  // TEST 2: Chat Rewards & Daily Limit (Max 50/day)
  console.log('Test 2: Chat Activity Reward (+1, Max 50/hari)');
  const chat1 = economy.earnChatReward('user_andi_01');
  assert.strictEqual(chat1.awarded, true, 'First chat awarded');
  assert.strictEqual(chat1.pointsAdded, 1, '+1 point added');
  assert.strictEqual(chat1.newBalance, 101, 'Balance is now 101');

  // Fast forward to daily limit
  for (let i = 2; i <= 50; i++) {
    economy.earnChatReward('user_andi_01');
  }
  assert.strictEqual(economy.getOrCreateUserPoints('user_andi_01').balance, 150, '50 chat points accrued');

  // 51st chat attempt
  const chat51 = economy.earnChatReward('user_andi_01');
  assert.strictEqual(chat51.awarded, false, '51st chat rejected by daily cap');
  assert.strictEqual(chat51.pointsAdded, 0, 'No points added past 50/day');
  console.log('  ✅ PASS: Chat activity reward and 50/day cap enforced');

  // TEST 3: Reaction Rewards & Daily Limit (Max 20/day)
  console.log('Test 3: Reaction Reward (+2, Max 20/hari)');
  const react1 = economy.earnReactionReward('user_andi_01');
  assert.strictEqual(react1.awarded, true, 'First reaction awarded');
  assert.strictEqual(react1.pointsAdded, 2, '+2 points added');
  assert.strictEqual(react1.newBalance, 152, 'Balance is now 152');

  for (let i = 2; i <= 20; i++) {
    economy.earnReactionReward('user_andi_01');
  }
  assert.strictEqual(economy.getOrCreateUserPoints('user_andi_01').balance, 190, '20 reactions added 40 points');

  const react21 = economy.earnReactionReward('user_andi_01');
  assert.strictEqual(react21.awarded, false, '21st reaction rejected by daily cap');
  console.log('  ✅ PASS: Reaction reward and 20/day cap enforced');

  // TEST 4: Helper (+5), Game Played (+10), Game Won (+25)
  console.log('Test 4: Helper & Game Rewards');
  const helperRes = economy.earnHelperReward('user_andi_01', 'q_123');
  assert.strictEqual(helperRes.pointsAdded, 5, '+5 for helping user');

  const playedRes = economy.earnGamePlayed('user_andi_01', 'game_gapleh_01');
  assert.strictEqual(playedRes.pointsAdded, 10, '+10 for finishing game');

  const wonRes = economy.earnGameWon('user_andi_01', 'game_gapleh_01');
  assert.strictEqual(wonRes.pointsAdded, 25, '+25 for winning game');
  assert.strictEqual(wonRes.newBalance, 230, 'Balance is now 230');
  console.log('  ✅ PASS: Helper (+5), game played (+10), and game won (+25) verified');

  // TEST 5: Referral (+50) & Daily Mission (+20)
  console.log('Test 5: Referral & Daily Mission Rewards');
  const refRes = economy.earnReferralReward('user_andi_01', 'user_budi_02');
  assert.strictEqual(refRes.pointsAdded, 50, '+50 for referral');

  const missionRes = economy.claimDailyMission('user_andi_01', 'Ngopi Pagi 3 Chat');
  assert.strictEqual(missionRes.pointsAdded, 20, '+20 for daily mission');
  assert.strictEqual(missionRes.newBalance, 300, 'Balance reached 300');
  console.log('  ✅ PASS: Referral (+50) and mission (+20) rewards verified');

  // TEST 6: Daily Streak (+5 * streak)
  console.log('Test 6: Daily Streak Logic');
  // First claim today was already initialized with streak 1
  const streakClaim1 = economy.claimDailyStreak('user_andi_01');
  assert.strictEqual(streakClaim1.awarded, false, 'Duplicate streak claim on same day prevented');

  // Simulate user_budi logging in with yesterday as last login
  const budi = economy.getOrCreateUserPoints('user_budi_02');
  budi.last_login_date = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  budi.streak_days = 2;

  const streakClaimBudi = economy.claimDailyStreak('user_budi_02');
  assert.strictEqual(streakClaimBudi.awarded, true, 'Streak claimed for Budi');
  assert.strictEqual(streakClaimBudi.streak, 3, 'Streak incremented to 3');
  assert.strictEqual(streakClaimBudi.pointsAdded, 15, '+15 points awarded (5 * 3)');
  console.log('  ✅ PASS: Daily streak increment and point multiplier verified');

  // TEST 7: Premium Feature Purchase with Points
  console.log('Test 7: Purchase Feature with Points');
  // Try purchasing beta access (2000 pts) with only 300 pts -> Fail
  const failPurchase = economy.purchaseFeatureWithPoints('user_andi_01', 'beta_access');
  assert.strictEqual(failPurchase.success, false, 'Cannot buy expensive feature without enough points');
  assert.ok(failPurchase.error?.includes('tidak mencukupi'), 'Error mentions insufficient points');

  // Buy sticker pack (50 pts) with 300 pts -> Success
  const successPurchase = economy.purchaseFeatureWithPoints('user_andi_01', 'sticker_pack');
  assert.strictEqual(successPurchase.success, true, 'Sticker pack purchased');
  assert.strictEqual(successPurchase.newBalance, 250, '300 - 50 = 250 points left');

  const sub = economy.getSubscription('user_andi_01');
  assert.ok(sub?.active_features.includes('sticker_pack'), 'Sticker pack active in user subscription');
  console.log('  ✅ PASS: Feature purchasing and subscription tracking verified');

  // TEST 8: Points to BMC Conversion (1000 Poin = 1 BMC)
  console.log('Test 8: Points to BMC Conversion (On-Chain Bridge)');
  // Top up user points to 2250 to test conversion
  const andi = economy.getOrCreateUserPoints('user_andi_01');
  andi.balance += 2000; // 2250 points

  // 1. Invalid wallet address
  assert.throws(() => {
    economy.convertPointsToBmc({
      user_id: 'user_andi_01',
      points_to_convert: 1000,
      wallet_address: 'invalid_address',
    });
  }, /Alamat wallet/, 'Invalid wallet address rejected');

  // 2. Non-multiple of 1000
  assert.throws(() => {
    economy.convertPointsToBmc({
      user_id: 'user_andi_01',
      points_to_convert: 1500,
      wallet_address: '0x1234567890123456789012345678901234567890',
    });
  }, /kelipatan 1000/, 'Non-1000 multiple rejected');

  // 3. Valid conversion of 2000 points -> 2 BMC
  const convertRes = economy.convertPointsToBmc({
    user_id: 'user_andi_01',
    points_to_convert: 2000,
    wallet_address: '0x1234567890123456789012345678901234567890',
  });
  assert.strictEqual(convertRes.success, true, 'Conversion succeeded');
  assert.strictEqual(convertRes.points_deducted, 2000, '2000 points deducted');
  assert.strictEqual(convertRes.bmc_awarded, 2, '2 BMC awarded');
  assert.strictEqual(convertRes.new_points_balance, 250, '2250 - 2000 = 250 balance left');
  assert.ok(convertRes.tx_hash.startsWith('0x'), 'Valid on-chain transaction hash generated');
  console.log('  ✅ PASS: Points to BMC conversion ratio (1000 pts = 1 BMC) and tx verified');

  // TEST 9: Ruang Bioskop (Watch Party)
  console.log('Test 9: Watch Party (Ruang Bioskop)');
  // Andi has 250 points. Watch party rental costs 100 points.
  const party = economy.createWatchParty({
    hostId: 'user_andi_01',
    hostName: 'Andi Kopi',
    title: 'Nonton Cuplikan Persib Bareng',
    videoUrl: 'https://youtube.com/watch?v=persib_highlight',
  });
  assert.ok(party.id.startsWith('wp_'), 'Watch party ID created');
  assert.strictEqual(party.video_type, 'youtube', 'Detected youtube video');
  assert.strictEqual(party.participants.length, 1, 'Host is first participant');
  assert.strictEqual(economy.getOrCreateUserPoints('user_andi_01').balance, 150, '100 pts deducted for watch party rental');

  // Non-host attempts to control playback -> Fail
  assert.throws(() => {
    economy.updateWatchPartyPlayback({
      partyId: party.id,
      hostId: 'user_budi_02',
      currentTime: 45,
      isPlaying: true,
    });
  }, /Hanya Host/, 'Non-host playback control blocked');

  // Host controls playback -> Success
  const updatedParty = economy.updateWatchPartyPlayback({
    partyId: party.id,
    hostId: 'user_andi_01',
    currentTime: 72.5,
    isPlaying: true,
  });
  assert.strictEqual(updatedParty.current_time, 72.5, 'Current time synced to 72.5s');
  assert.strictEqual(updatedParty.is_playing, true, 'Playback is playing');

  // Participant joins and leaves
  economy.joinWatchParty(party.id, 'user_budi_02', 'Budi Santoso');
  const joinedParty = economy.getWatchParty(party.id);
  assert.strictEqual(joinedParty?.participants.length, 2, '2 participants in watch party');

  economy.leaveWatchParty(party.id, 'user_budi_02');
  const leftParty = economy.getWatchParty(party.id);
  assert.strictEqual(leftParty?.participants.length, 1, '1 participant left after leave');
  console.log('  ✅ PASS: Watch Party creation, host controls, and participant sync verified');

  // TEST 10: Transaction History & Catalog
  console.log('Test 10: Transaction History & Catalog Integrity');
  const txs = economy.getTransactions('user_andi_01');
  assert.ok(txs.length >= 6, 'User has multiple recorded transactions');
  assert.strictEqual(txs[0].created_at >= txs[txs.length - 1].created_at, true, 'Transactions sorted newest first');
  assert.strictEqual(PREMIUM_CATALOG.length, 8, 'Premium catalog has 8 items');
  console.log('  ✅ PASS: Transaction audit log and catalog verified');

  console.log('--- ALL SPRINT 7 EKONOMI BMC & POIN NGOPI UNIT TESTS PASSED (100% PASS) ---');
}

runPointsEconomyTests();
