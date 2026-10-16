import assert from 'assert';
import { TableManager } from '../src/games/TableManager';
import { BotProfileService } from '../src/games/gapleh/BotProfileService';
import { GaplehGame } from '../src/games/gapleh/GaplehGame';

console.log('================================================================');
console.log('--- RUNNING SPRINT 2: SISTEM LEVEL GAPLEH & BOT SELECTION ---');
console.log('================================================================\n');

async function runTests() {
  // Test 1: Level 1 Table Creation (Gapleh Klasik)
  console.log('Test 1: Meja Gapleh Level 1 (Gapleh Klasik - Sistem Lama Tidak Berubah)');
  const hostUser = { id: 'user_host_1', username: 'ujang_warkop', display_name: 'Kang Ujang' };
  const tableLvl1 = await TableManager.createTable({
    gameType: 'gapleh',
    name: 'Meja Klasik Warkop',
    host: hostUser,
    config: { level: 1 },
  });

  assert.strictEqual(tableLvl1.config?.level, 1, 'Config level harus 1');
  assert.strictEqual(tableLvl1.min_players, 2, 'Level 1 min_players harus 2');
  assert.strictEqual(tableLvl1.max_players, 4, 'Level 1 max_players harus 4');
  assert.strictEqual(tableLvl1.players.length, 1, 'Hanya host yang duduk di awal');
  console.log('  ✅ PASS: Level 1 min/max players = 2-4 (fleksibel warkop klasik)');

  // Test 2: Level 2 Table Creation (Gapleh Rame - 4 Pemain WAJIB)
  console.log('\nTest 2: Meja Gapleh Level 2 (Gapleh Rame - 4 Pemain WAJIB & Pilihan Bot)');
  const tableLvl2 = await TableManager.createTable({
    gameType: 'gapleh',
    name: 'Meja Rame 4 Pemain',
    host: hostUser,
    config: {
      level: 2,
      selectedBotIds: ['gapleh_2_budi', 'gapleh_2_asep', 'gapleh_2_deni'],
    },
  });

  assert.strictEqual(tableLvl2.config?.level, 2, 'Config level harus 2');
  assert.strictEqual(tableLvl2.min_players, 4, 'Level 2 min_players WAJIB 4');
  assert.strictEqual(tableLvl2.max_players, 4, 'Level 2 max_players WAJIB 4');
  assert.strictEqual(tableLvl2.players.length, 4, 'Level 2 otomatis terisi 4 pemain (1 host + 3 bot pilihan)');
  console.log('  ✅ PASS: Level 2 terkunci WAJIB 4 pemain');
  console.log('  ✅ PASS: 3 bot pilihan otomatis masuk mengisi kursi meja');

  // Verify bot identity in table
  const botBudi = tableLvl2.players.find((p) => p.user_id === 'gapleh_2_budi');
  const botAsep = tableLvl2.players.find((p) => p.user_id === 'gapleh_2_asep');
  const botDeni = tableLvl2.players.find((p) => p.user_id === 'gapleh_2_deni');

  assert(botBudi, 'Bot Budi harus duduk di meja');
  assert(botAsep, 'Bot Asep harus duduk di meja');
  assert(botDeni, 'Bot Deni harus duduk di meja');
  assert(botBudi.display_name.includes('Budi (Kelas Bulu)'), 'Display name Budi memuat title');
  assert(botAsep.display_name.includes('Asep (Kelas Warung)'), 'Display name Asep memuat title');
  assert(botDeni.display_name.includes('Deni (Kelas Kota)'), 'Display name Deni memuat title');
  console.log('  ✅ PASS: Nama dan title karakter bot tampil sempurna di kursi');

  // Test 3: Pembagian 28 Kartu Habis (7 Kartu per Pemain, 0 Deck Sisa)
  console.log('\nTest 3: Validasi Pembagian Kartu Level 2 (28 Kartu ÷ 4 = 7 Kartu, Deck Habis)');
  const startResult = TableManager.startGame(tableLvl2.id, hostUser.id);
  assert(startResult.success, 'Game Level 2 berhasil dimulai');

  const gameState = TableManager.getGameState(tableLvl2.id, hostUser.id);
  assert.strictEqual(gameState.turnOrder.length, 4, 'Turn order berisi 4 pemain');
  
  // Check cards for each player
  for (const player of tableLvl2.players) {
    const hand = TableManager.getGameState(tableLvl2.id, player.user_id);
    assert.strictEqual(hand.myHand.length, 7, `Pemain ${player.display_name} harus memegang tepat 7 kartu`);
  }
  console.log('  ✅ PASS: Semua 4 pemain menerima tepat 7 kartu');
  console.log('  ✅ PASS: Seluruh 28 kartu terbagi habis tanpa sisa');

  // Test 4: Custom Add Bot Character
  console.log('\nTest 4: Menambahkan Bot Karakter Tertentu (Bang Jago & Sang Maestro)');
  const tableManualBot = await TableManager.createTable({
    gameType: 'gapleh',
    name: 'Meja Lawan Jagal',
    host: hostUser,
    config: { level: 2 },
  });

  const addJago = TableManager.addBot(tableManualBot.id, hostUser.id, 'gapleh_2_jago');
  assert(addJago.success, 'Berhasil menambahkan Bang Jago');
  assert.strictEqual(addJago.bot?.user_id, 'gapleh_2_jago');
  assert(addJago.bot?.display_name.includes('Bang Jago (Kelas Jagal)'));

  const addMaestro = TableManager.addBot(tableManualBot.id, hostUser.id, 'gapleh_2_maestro');
  assert(addMaestro.success, 'Berhasil menambahkan Sang Maestro');
  assert.strictEqual(addMaestro.bot?.user_id, 'gapleh_2_maestro');
  assert(addMaestro.bot?.display_name.includes('Sang Maestro (Kelas Dunia)'));
  console.log('  ✅ PASS: Host dapat memilih spesifik karakter bot (Bang Jago, Sang Maestro)');

  // Test 5: Bot Banter & Personality
  console.log('\nTest 5: Validasi Bot Banter & Emote Berdasarkan Karakter');
  const jagoWinQuote = BotProfileService.getRandomBanter('gapleh_2_jago', 'win');
  assert(typeof jagoWinQuote === 'string' && jagoWinQuote.length > 0, 'Bang Jago punya kutipan menang');
  assert(jagoWinQuote.includes('JAGAL') || jagoWinQuote.includes('gapleh'), 'Kutipan Bang Jago agresif');

  const budiTurnQuote = BotProfileService.getRandomBanter('gapleh_2_budi', 'turn');
  assert(typeof budiTurnQuote === 'string' && budiTurnQuote.length > 0, 'Budi punya kutipan giliran');

  const asepTurnQuote = BotProfileService.getRandomBanter('gapleh_2_asep', 'turn');
  assert(typeof asepTurnQuote === 'string' && asepTurnQuote.length > 0, 'Asep punya kutipan kopi warkop');

  const maestroEmote = BotProfileService.getRandomEmote('gapleh_2_maestro');
  assert(['👑', '🎯', '☕'].includes(maestroEmote), 'Emote Sang Maestro berkelas');

  console.log(`  ✅ PASS: Bang Jago Banter: "${jagoWinQuote}"`);
  console.log(`  ✅ PASS: Budi Banter: "${budiTurnQuote}"`);
  console.log(`  ✅ PASS: Asep Banter: "${asepTurnQuote}"`);
  console.log(`  ✅ PASS: Sang Maestro Emote: "${maestroEmote}"`);

  // Test 6: Daftar Semua Bot Profiles
  console.log('\nTest 6: Validasi BotProfileService.getAllProfiles()');
  const allProfiles = BotProfileService.getAllProfiles();
  assert.strictEqual(allProfiles.length, 6, 'Harus ada tepat 6 karakter bot');
  const botIds = allProfiles.map((b) => b.bot_id);
  assert(botIds.includes('gapleh_2_budi'));
  assert(botIds.includes('gapleh_2_asep'));
  assert(botIds.includes('gapleh_2_rudi'));
  assert(botIds.includes('gapleh_2_deni'));
  assert(botIds.includes('gapleh_2_jago'));
  assert(botIds.includes('gapleh_2_maestro'));
  console.log('  ✅ PASS: 6 Karakter Bot terdaftar lengkap: Budi, Asep, Rudi, Deni, Bang Jago, Sang Maestro');

  console.log('\n================================================================');
  console.log('🎉 SPRINT 2 (LEVEL 1 & LEVEL 2 SYSTEM + BOT SELECTION) 100% PASS!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
