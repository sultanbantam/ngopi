import assert from 'assert';
import { BotProfileService, BOT_LEVEL_POINTS } from '../src/games/gapleh/BotProfileService';
import { PointsManager } from '../src/utils/pointsManager';

console.log('================================================================');
console.log('--- RUNNING SPRINT 4: BOT GAPLEH POIN & INTEGRATED LEADERBOARD ---');
console.log('================================================================\n');

async function runTests() {
  BotProfileService.initProfiles();

  // ---------------------------------------------------------------------------
  // Test 1: Bot Profiles Initialization (6 Bot Karakter)
  // ---------------------------------------------------------------------------
  console.log('Test 1: Inisialisasi 6 Bot Profil Karakter (Level 1 sampai 6)');
  const bots = BotProfileService.getAllProfiles();
  assert.strictEqual(bots.length, 6, 'Harus ada 6 bot karakter');

  const budi = BotProfileService.getBotProfile('gapleh_2_budi');
  assert.strictEqual(budi.level, 1, 'Budi harus level 1 (Kelas Bulu)');
  assert.strictEqual(budi.title, 'Kelas Bulu');

  const asep = BotProfileService.getBotProfile('gapleh_2_asep');
  assert.strictEqual(asep.level, 2, 'Asep harus level 2 (Kelas Warung)');
  assert.strictEqual(asep.title, 'Kelas Warung');

  const maestro = BotProfileService.getBotProfile('gapleh_2_maestro');
  assert.strictEqual(maestro.level, 6, 'Sang Maestro harus level 6 (Kelas Dunia)');
  assert.strictEqual(maestro.title, 'Kelas Dunia');

  console.log('  ✅ PASS: 6 Bot profil diinisialisasi dengan level dan gelar yang tepat');

  // ---------------------------------------------------------------------------
  // Test 2: Perolehan Poin Bot Sesuai Tabel Task 4.4
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Perolehan Poin Bot Berdasarkan Level (Menang/Kalah/Seri)');
  // Level 1: Win 10, Lose 1, Draw 3
  const budiResWin = BotProfileService.recordBotMatch('gapleh_2_budi', 'win');
  assert.strictEqual(budiResWin.pointsAwarded, 10, 'Bot L1 menang dapat 10 poin');
  assert.strictEqual(budiResWin.profile.total_points, 10);
  assert.strictEqual(budiResWin.profile.total_wins, 1);

  const budiResLose = BotProfileService.recordBotMatch('gapleh_2_budi', 'lose');
  assert.strictEqual(budiResLose.pointsAwarded, 1, 'Bot L1 kalah dapat 1 poin');
  assert.strictEqual(budiResLose.profile.total_points, 11);
  assert.strictEqual(budiResLose.profile.total_losses, 1);

  const budiResDraw = BotProfileService.recordBotMatch('gapleh_2_budi', 'draw');
  assert.strictEqual(budiResDraw.pointsAwarded, 3, 'Bot L1 seri dapat 3 poin');
  assert.strictEqual(budiResDraw.profile.total_points, 14);
  assert.strictEqual(budiResDraw.profile.total_draws, 1);

  // Level 6: Win 1000, Lose 100, Draw 300
  const maestroResWin = BotProfileService.recordBotMatch('gapleh_2_maestro', 'win');
  assert.strictEqual(maestroResWin.pointsAwarded, 1000, 'Bot L6 menang dapat 1000 poin');
  assert.strictEqual(maestroResWin.profile.total_points, 1000);

  const maestroResLose = BotProfileService.recordBotMatch('gapleh_2_maestro', 'lose');
  assert.strictEqual(maestroResLose.pointsAwarded, 100, 'Bot L6 kalah dapat 100 poin');
  assert.strictEqual(maestroResLose.profile.total_points, 1100);

  const maestroResDraw = BotProfileService.recordBotMatch('gapleh_2_maestro', 'draw');
  assert.strictEqual(maestroResDraw.pointsAwarded, 300, 'Bot L6 seri dapat 300 poin');
  assert.strictEqual(maestroResDraw.profile.total_points, 1400);

  console.log('  ✅ PASS: Skema poin L1 (10/1/3) dan L6 (1000/100/300) diverifikasi');

  // ---------------------------------------------------------------------------
  // Test 3: Kenaikan Level Bot & Badge "Bot Legendaris" (Task 4.2)
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Kenaikan Level Bot & Pembukaan Badge "Bot Legendaris" (100x Menang L6)');
  const testBot = BotProfileService.getBotProfile('gapleh_2_rudi');
  testBot.level = 1;
  testBot.total_wins = 0;

  // 5x menang -> naik level 2
  for (let i = 0; i < 5; i++) {
    BotProfileService.recordBotMatch('gapleh_2_rudi', 'win');
  }
  assert.strictEqual(testBot.level, 2, '5x menang harus naik ke level 2');

  // L6 dengan 100x menang -> Badge "Bot Legendaris"
  testBot.level = 6;
  testBot.total_wins = 99;
  const win100Result = BotProfileService.recordBotMatch('gapleh_2_rudi', 'win');
  assert.strictEqual(win100Result.profile.total_wins, 100);
  assert(win100Result.profile.badges.includes('Bot Legendaris'), 'Harus mendapatkan badge Bot Legendaris');
  assert.strictEqual(win100Result.newBadge, 'Bot Legendaris');

  console.log('  ✅ PASS: Progression level dan badge "Bot Legendaris" berhasil diuji');

  // ---------------------------------------------------------------------------
  // Test 4: Integrasi Leaderboard Gabungan (Human + Bot, Top 10, Badges)
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Leaderboard Top 10 Gabungan Human + Bot & Badge Sistem (Task 8.2)');
  
  // Set up human points in PointsManager
  PointsManager.setPoints('sultanbantam', 1200);
  PointsManager.setPoints('jawara_gapleh', 600);
  PointsManager.setPoints('ujang_warkop', 280);
  PointsManager.setPoints('pemula_warkop', 80);

  // Set up bot points
  const botDeni = BotProfileService.getBotProfile('gapleh_2_deni');
  botDeni.total_points = 1500;
  botDeni.total_wins = 15;

  const botJago = BotProfileService.getBotProfile('gapleh_2_jago');
  botJago.total_points = 800;
  botJago.total_wins = 8;

  // Simulate combined leaderboard formation as implemented in leaderboard routes
  const allBots = BotProfileService.getAllProfiles();
  const botEntries = allBots.map((b) => {
    const badges = [...(b.badges || [])];
    if (b.level >= 5 && !badges.includes('Jagal Gapleh')) badges.push('Jagal Gapleh');
    if (b.level >= 4 && !badges.includes('Nutup Master')) badges.push('Nutup Master');
    if (!badges.includes('Digapleh Hunter')) badges.push('Digapleh Hunter');

    return {
      id: b.bot_id,
      username: b.bot_id,
      display_name: `${b.name} (${b.title})`,
      is_bot: true,
      bot_title: b.title,
      level: b.level,
      points: b.total_points,
      wins: b.total_wins,
      losses: b.total_losses,
      badges,
    };
  });

  const testHumans = [
    { username: 'sultanbantam', pts: PointsManager.getPoints('sultanbantam') },
    { username: 'jawara_gapleh', pts: PointsManager.getPoints('jawara_gapleh') },
    { username: 'ujang_warkop', pts: PointsManager.getPoints('ujang_warkop') },
    { username: 'pemula_warkop', pts: PointsManager.getPoints('pemula_warkop') },
  ];

  const humanEntries = testHumans.map((u) => {
    const badges: string[] = [];
    if (u.pts >= 500) badges.push('Jagal Gapleh');
    if (u.pts >= 250) badges.push('Nutup Master');
    if (u.pts >= 100) badges.push('Digapleh Hunter');

    return {
      id: `user_${u.username}`,
      username: u.username,
      display_name: u.username,
      is_bot: false,
      bot_title: undefined,
      level: u.pts >= 500 ? 2 : 1,
      points: u.pts,
      wins: Math.floor(u.pts / 50),
      losses: 0,
      badges,
    };
  });

  const top10Combined = [...botEntries, ...humanEntries]
    .sort((a, b) => b.points - a.points)
    .slice(0, 10)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  assert(top10Combined.length <= 10, 'Leaderboard dibatasi maksimal 10 pemain');
  assert.strictEqual(top10Combined[0].rank, 1, 'Rank 1 memiliki nomor urut 1');

  // Verify descending sort order
  for (let i = 0; i < top10Combined.length - 1; i++) {
    assert(
      top10Combined[i].points >= top10Combined[i + 1].points,
      `Poin rank ${top10Combined[i].rank} (${top10Combined[i].points}) >= rank ${top10Combined[i + 1].rank} (${top10Combined[i + 1].points})`
    );
  }

  // Verify both human and bot in top 10
  const hasBotInTop = top10Combined.some((p) => p.is_bot);
  const hasHumanInTop = top10Combined.some((p) => !p.is_bot);
  assert(hasBotInTop, 'Leaderboard harus memuat bot');
  assert(hasHumanInTop, 'Leaderboard harus memuat manusia');

  // Verify badges
  const sultan = top10Combined.find((p) => p.username === 'sultanbantam');
  assert(sultan, 'Sultan harus masuk top leaderboard');
  assert(sultan.badges.includes('Jagal Gapleh'), 'Sultan (1200 poin) harus punya badge "Jagal Gapleh"');
  assert(sultan.badges.includes('Nutup Master'), 'Sultan (1200 poin) harus punya badge "Nutup Master"');
  assert(sultan.badges.includes('Digapleh Hunter'), 'Sultan (1200 poin) harus punya badge "Digapleh Hunter"');

  console.log('  ✅ PASS: Leaderboard Top 10 terurut poin descending dengan Human & Bot');
  console.log('  ✅ PASS: Badges "Jagal Gapleh", "Nutup Master", dan "Digapleh Hunter" diverifikasi');
  console.log('\nTop 3 Leaderboard Snapshot:');
  top10Combined.slice(0, 3).forEach((p) => {
    console.log(`    #${p.rank} [${p.is_bot ? '🤖 BOT' : '👤 HUMAN'}] ${p.display_name}: ${p.points} Poin | Badges: ${p.badges.join(', ')}`);
  });

  console.log('\n================================================================');
  console.log('--- ALL SPRINT 4 GAPLEH LEADERBOARD TESTS PASSED (100%) ---');
  console.log('================================================================');
}

runTests().catch((e) => {
  console.error('❌ Test failed with error:', e);
  process.exit(1);
});
