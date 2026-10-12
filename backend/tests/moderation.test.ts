import assert from 'assert';
import { ModerationService } from '../src/services/moderation.service';

async function runModerationTests() {
  console.log('--- RUNNING SPRINT 9: ANTI-SPAM & AI MODERATION UNIT TESTS ---');

  const moderation = new ModerationService();
  moderation.resetForTesting();

  // ==========================================
  // TEST 1: Layer 1 - Message Rate Limiting
  // ==========================================
  console.log('Test 1: Layer 1 - Message Rate Limiting (10 msg/sec, 60 msg/min)');
  const testUser1 = 'user_speedy_01';

  // Send 10 messages within 1 second -> should all be allowed
  for (let i = 0; i < 10; i++) {
    const check = moderation.checkRateLimit(testUser1, 'message');
    assert.strictEqual(check.allowed, true, `Message ${i + 1} should be allowed`);
  }

  // 11th message in the same second -> should be rejected
  const burstReject = moderation.checkRateLimit(testUser1, 'message');
  assert.strictEqual(burstReject.allowed, false, '11th burst message should be blocked');
  assert.ok(burstReject.reason?.includes('Maksimum 10 pesan per detik'), 'Correct reason returned');
  console.log('  ✅ PASS: 10 msg/sec rate limit burst protection verified');

  // ==========================================
  // TEST 2: Layer 1 - Warung Join Rate Limiting
  // ==========================================
  console.log('Test 2: Layer 1 - Warung Join Rate Limiting (3 joins/min)');
  const testUser2 = 'user_hopper_02';
  for (let i = 0; i < 3; i++) {
    const check = moderation.checkRateLimit(testUser2, 'warung_join');
    assert.strictEqual(check.allowed, true, `Join ${i + 1} should be allowed`);
  }
  const hopReject = moderation.checkRateLimit(testUser2, 'warung_join');
  assert.strictEqual(hopReject.allowed, false, '4th join in 1 minute should be blocked');
  assert.ok(hopReject.reason?.includes('Maksimum 3 join per menit'), 'Correct reason returned');
  console.log('  ✅ PASS: Warung join throttling (3/min) verified');

  // ==========================================
  // TEST 3: Layer 2 - Pre-AI Heuristics & Rules
  // ==========================================
  console.log('Test 3: Layer 2 - Pre-AI Rules (Multi-link, Repetition, Zero-width, Mentions, Emojis)');
  const testUser3 = 'user_spammer_03';

  // 3a: Multi-link spam (>= 3 links)
  const linkSpam = moderation.checkPreAiRules('Kunjungi https://a.com dan https://b.com serta https://c.com sekarang!', testUser3);
  assert.strictEqual(linkSpam.isSpam, true, 'Multi-link message detected as spam');
  assert.ok(linkSpam.reason?.includes('multi-link'));

  // 3b: Character repetition (>= 20 identical characters)
  const charSpam = moderation.checkPreAiRules('Wooooooiiiiiiiiiiiiiiiiiiiiiii kopi mana?', testUser3);
  assert.strictEqual(charSpam.isSpam, true, 'Character repetition detected as spam');
  assert.ok(charSpam.reason?.includes('karakter berulang'));

  // 3c: Zero-width character hiding
  const zeroWidthSpam = moderation.checkPreAiRules('Halo\u200Bteman\u200Bsemua', testUser3);
  assert.strictEqual(zeroWidthSpam.isSpam, true, 'Zero-width character detected as spam');
  assert.ok(zeroWidthSpam.reason?.includes('zero-width'));

  // 3d: Word repetition (3+ times in sequence)
  const wordSpam = moderation.checkPreAiRules('promo promo promo besar besaran', testUser3);
  assert.strictEqual(wordSpam.isSpam, true, 'Word repetition detected as spam');

  // 3e: Mention spam (> 5 mentions)
  const mentionSpam = moderation.checkPreAiRules('@bambang @joko @tono @budi @siti @rani ayo ngopi', testUser3);
  assert.strictEqual(mentionSpam.isSpam, true, 'Mention flooding detected as spam');

  // 3f: Clean message passes pre-AI checks
  const cleanPreAi = moderation.checkPreAiRules('Halo kawan warkop, pesen kopi tubruk satu ya!', testUser3);
  assert.strictEqual(cleanPreAi.isSpam, false, 'Clean message passes pre-AI rules');
  console.log('  ✅ PASS: All Layer 2 heuristic rules accurately triggered');

  // ==========================================
  // TEST 4: Layer 2 - SHA-256 Hash Deduplication Flooding
  // ==========================================
  console.log('Test 4: Layer 2 - SHA-256 Hash Flooding Protection (> 3 identical messages)');
  const testUser4 = 'user_flooder_04';
  const identicalMsg = 'Ayo mampir ke warkop sebelah bro!';

  // First 3 times allowed
  for (let i = 0; i < 3; i++) {
    const res = moderation.checkPreAiRules(identicalMsg, testUser4);
    assert.strictEqual(res.isSpam, false, `Identical send ${i + 1} within threshold allowed`);
  }

  // 4th time triggers hash flood deduplication
  const res4 = moderation.checkPreAiRules(identicalMsg, testUser4);
  assert.strictEqual(res4.isSpam, true, '4th identical message detected as hash flooding');
  assert.ok(res4.reason?.includes('spam flooding > 3x'));
  console.log('  ✅ PASS: SHA-256 Hash deduplication prevents repeated flooding');

  // ==========================================
  // TEST 5: Layer 3 - AI Content Classifier
  // ==========================================
  console.log('Test 5: Layer 3 - AI Content Classification (Gambling, Hate, Sexual, Scam)');

  // 5a: Gambling / Slot Online
  const gamblingCheck = await moderation.classifyContent('Link daftar slot gacor malam ini pragmatic zeus slot!');
  assert.strictEqual(gamblingCheck.isHarmful, true, 'Slot online flagged harmful');
  assert.strictEqual(gamblingCheck.categories.gambling, true, 'Categorized as gambling');
  assert.strictEqual(gamblingCheck.recommended_action, 'ban', 'Recommended ban for online gambling');

  // 5b: Hate Speech
  const hateCheck = await moderation.classifyContent('Heh kamu dasar babi jangan ikut campur!');
  assert.strictEqual(hateCheck.isHarmful, true, 'Hate speech flagged harmful');
  assert.strictEqual(hateCheck.categories.hate_speech, true, 'Categorized as hate speech');

  // 5c: Sexual / Explicit Content
  const sexualCheck = await moderation.classifyContent('Sedia open bo dan vcs berbayar hubungi telegram');
  assert.strictEqual(sexualCheck.isHarmful, true, 'Sexual solicitation flagged harmful');
  assert.strictEqual(sexualCheck.categories.sexual, true, 'Categorized as sexual');

  // 5d: Safe normal warkop conversation
  const safeCheck = await moderation.classifyContent('Selamat malam kawan, main catur yuk di meja 3!');
  assert.strictEqual(safeCheck.isHarmful, false, 'Safe message is not harmful');
  assert.strictEqual(safeCheck.detected_by, 'CLEAN');
  console.log('  ✅ PASS: Layer 3 AI classifier accurately classifies hazardous content');

  // ==========================================
  // TEST 6: Layer 4 - Escalation Matrix (Warning -> Mute -> Kick -> Ban -> Blacklist)
  // ==========================================
  console.log('Test 6: Layer 4 - Escalation Matrix Progressive Penalties');
  const escalatingUser = 'user_rebel_05';

  // 1st violation -> warning
  const act1 = moderation.recordViolation(escalatingUser, 'warung_central', 'Pelanggaran spam ringan 1', 'medium');
  assert.strictEqual(act1.action_type, 'warning', '1st violation results in warning');

  // 2nd violation -> mute (1 hour)
  const act2 = moderation.recordViolation(escalatingUser, 'warung_central', 'Pelanggaran spam ringan 2', 'medium');
  assert.strictEqual(act2.action_type, 'mute', '2nd violation results in mute');
  assert.ok(act2.expires_at, 'Mute expiration set');
  const muteStatus = moderation.isUserMuted(escalatingUser);
  assert.strictEqual(muteStatus.muted, true, 'User is actively muted');

  // 3rd violation -> kick
  const act3 = moderation.recordViolation(escalatingUser, 'warung_central', 'Pelanggaran spam ringan 3', 'medium');
  assert.strictEqual(act3.action_type, 'kick', '3rd violation results in kick');

  // 4th violation -> ban (7 days)
  const act4 = moderation.recordViolation(escalatingUser, 'warung_central', 'Pelanggaran spam berulang 4', 'medium');
  assert.strictEqual(act4.action_type, 'ban', '4th violation results in ban');
  assert.ok(act4.expires_at, 'Ban expiration set');
  const banStatus = moderation.isUserBanned(escalatingUser);
  assert.strictEqual(banStatus.banned, true, 'User is actively banned');

  // Critical violation escalation to blacklist
  const botUser = 'bot_slot_spammer';
  const botAct1 = moderation.recordViolation(botUser, 'warung_central', 'Bot Judi Slot Liar', 'critical');
  assert.strictEqual(botAct1.action_type, 'ban', '1st critical violation direct ban');
  const botAct2 = moderation.recordViolation(botUser, 'warung_central', 'Bot Judi Slot Liar Kembali', 'critical');
  assert.strictEqual(botAct2.action_type, 'blacklist', 'Repeated critical violation escalates to permanent blacklist');
  assert.strictEqual(moderation.isUserBlacklisted(botUser), true, 'Bot user is on permanent blacklist');
  console.log('  ✅ PASS: 5-level escalation matrix works seamlessly');

  // ==========================================
  // TEST 7: Layer 5 - Server-Side Pipeline (moderateMessage)
  // ==========================================
  console.log('Test 7: Layer 5 - Complete moderateMessage Pipeline Execution');
  const regularUser = 'user_normal_06';

  // 7a: Clean message passes
  const cleanResult = await moderation.moderateMessage(regularUser, 'Halo bro, ada rokok surya ga?', 'warung_1');
  assert.strictEqual(cleanResult.allowed, true, 'Clean chat message allowed');

  // 7b: Blocked if blacklisted
  const blkResult = await moderation.moderateMessage(botUser, 'Halo bro', 'warung_1');
  assert.strictEqual(blkResult.allowed, false, 'Blacklisted user message blocked immediately');
  assert.ok(blkResult.reason?.includes('Blacklist'));

  // 7c: Gambling blocked and violation recorded
  const freshBadUser = 'user_bad_gambler_07';
  const badResult = await moderation.moderateMessage(freshBadUser, 'Daftar sekarang di zeus slot gacor maxwin!', 'warung_1');
  assert.strictEqual(badResult.allowed, false, 'Gambling message rejected');
  assert.ok(badResult.actionTaken, 'Action taken returned');
  console.log('  ✅ PASS: Layer 5 moderateMessage pipeline enforces all layers');

  // ==========================================
  // TEST 8: User Reports & Admin Review Queue
  // ==========================================
  console.log('Test 8: User Reports & Review Queue Resolution');
  const report = moderation.submitReport({
    reporterId: 'user_good_citizen',
    reporterName: 'Pak RT Warkop',
    reportedUserId: 'user_troll_08',
    reportedUserName: 'TrollUser',
    reason: 'Sering berkata kasar dan mengganggu meja catur',
    warungId: 'warung_1',
    messageContent: 'Lu semua bego main catur!',
  });

  assert.ok(report.id.startsWith('rep_'), 'Report ID assigned');
  assert.strictEqual(report.status, 'pending', 'Status is pending');

  const queue = moderation.getReviewQueue();
  assert.ok(queue.some(r => r.id === report.id), 'Report present in review queue');

  // Admin resolves report with mute
  const resolved = moderation.resolveReport(report.id, 'mute', 'admin_boss');
  assert.strictEqual(resolved, true, 'Report resolved successfully');
  assert.strictEqual(moderation.getReviewQueue().some(r => r.id === report.id), false, 'Report removed from pending queue');

  const historyTroll = moderation.getUserModerationHistory('user_troll_08');
  assert.ok(historyTroll.length > 0, 'Violation recorded on reported user history');
  console.log('  ✅ PASS: User report submission and admin review workflow verified');

  // ==========================================
  // TEST 9: Blacklist Management & Hash Cache Cleanup
  // ==========================================
  console.log('Test 9: Blacklist Management & Cache Maintenance');
  const manualBlk = moderation.addToBlacklist('user_manual_bad', 'DDoS suspect', '10.0.0.1');
  assert.strictEqual(moderation.isUserBlacklisted('user_manual_bad'), true, 'User is blacklisted');
  assert.strictEqual(moderation.isUserBlacklisted('other_user', '10.0.0.1'), true, 'IP is also blacklisted');
  assert.strictEqual(moderation.getBlacklist().length >= 2, true, 'Blacklist entries listed');

  const removed = moderation.removeFromBlacklist('user_manual_bad');
  assert.strictEqual(removed, true, 'User removed from blacklist');
  assert.strictEqual(moderation.isUserBlacklisted('user_manual_bad'), false, 'User no longer blacklisted');

  const cleanedHashes = moderation.cleanExpiredHashCache();
  assert.strictEqual(typeof cleanedHashes, 'number', 'Hash cache cleanup returns number');
  console.log('  ✅ PASS: Blacklist CRUD and maintenance routines operational');

  console.log('\n======================================================');
  console.log('🎉 ALL SPRINT 9 ANTI-SPAM & AI MODERATION TESTS PASSED!');
  console.log('======================================================\n');
}

runModerationTests().catch(err => {
  console.error('❌ Moderation tests failed:', err);
  process.exit(1);
});
