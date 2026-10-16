import { GaplehRules } from '../src/games/gapleh/GaplehRules';
import { GaplehGame } from '../src/games/gapleh/GaplehGame';
import { DominoCard, GaplehBoard } from '../src/games/gapleh/types';
import { BotProfileService, BOT_LEVEL_POINTS } from '../src/games/gapleh/BotProfileService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

console.log('================================================================');
console.log('--- RUNNING NGOPI GAPLEH: LEVEL 1 (KLASIK) & LEVEL 2 (RAME) ---');
console.log('================================================================');

// -----------------------------------------------------------------------------
// TEST 1: Penegasan Level 1 (Gapleh Klasik - Sistem Asli Tidak Dirubah Sama Sekali)
// -----------------------------------------------------------------------------
console.log('\nTest 1: Level 1 (Gapleh Klasik) - Aturan Asli Tidak Dirubah');
const emptyBoard: GaplehBoard = {
  leftEnd: null,
  rightEnd: null,
  placedCards: [],
};

const handWithBalaks: DominoCard[] = [[6, 6], [0, 0], [5, 5], [4, 3], [6, 1]];

// Level 1: Membuka dengan Balak 6 diperbolehkan (aturan lama)
const openBalak6L1 = GaplehRules.validateMove([6, 6], 'left', handWithBalaks, emptyBoard, 1);
assert(openBalak6L1.valid === true, 'Level 1: Membuka kartu awal dengan Balak 6 DIPERBOLEHKAN (asli)');

// Level 1: Membuka dengan Balak 0 diperbolehkan (aturan lama)
const openBalak0L1 = GaplehRules.validateMove([0, 0], 'left', handWithBalaks, emptyBoard, 1);
assert(openBalak0L1.valid === true, 'Level 1: Membuka kartu awal dengan Balak 0 DIPERBOLEHKAN (asli)');

// Level 1: getValidMoves pada papan kosong memuat semua kartu termasuk Balak 6 & 0
const movesL1 = GaplehRules.getValidMoves(handWithBalaks, emptyBoard, 1);
assert(movesL1.some((m) => m.card[0] === 6 && m.card[1] === 6), 'Level 1: Langkah awal memuat Balak 6');
assert(movesL1.some((m) => m.card[0] === 0 && m.card[1] === 0), 'Level 1: Langkah awal memuat Balak 0');

// Level 1: Balak 6 boleh dimainkan di tengah permainan kapanpun cocok
const activeBoard: GaplehBoard = {
  leftEnd: 6,
  rightEnd: 3,
  placedCards: [{ card: [6, 3], side: 'initial' }],
};
const handWithAlternatives: DominoCard[] = [[6, 6], [6, 2], [1, 1]];
const moveBalak6MidL1 = GaplehRules.validateMove([6, 6], 'left', handWithAlternatives, activeBoard, 1);
assert(moveBalak6MidL1.valid === true, 'Level 1: Balak 6 bebas dimainkan di tengah permainan (aturan asli)');

// -----------------------------------------------------------------------------
// TEST 2: Aturan Baru Khusus Level 2 (Gapleh Rame)
// -----------------------------------------------------------------------------
console.log('\nTest 2: Level 2 (Gapleh Rame) - Aturan Baru Balak 6 & 0');

// Level 2: Membuka kartu pertama tidak boleh Balak 6 & 0
const openBalak6L2 = GaplehRules.validateMove([6, 6], 'left', handWithBalaks, emptyBoard, 2);
assert(!openBalak6L2.valid, 'Level 2: Membuka kartu awal dengan Balak 6 DITOLAK');
assert(openBalak6L2.error?.includes('tidak boleh dibuka dengan Balak 6') === true, 'Pesan error Balak 6 sesuai aturan');

const openBalak0L2 = GaplehRules.validateMove([0, 0], 'left', handWithBalaks, emptyBoard, 2);
assert(!openBalak0L2.valid, 'Level 2: Membuka kartu awal dengan Balak 0 DITOLAK');

const openBalak5L2 = GaplehRules.validateMove([5, 5], 'left', handWithBalaks, emptyBoard, 2);
assert(openBalak5L2.valid === true, 'Level 2: Membuka kartu awal selain balak 6/0 (misal 5-5) DIPERBOLEHKAN');

// Level 2: getValidMoves pada papan kosong otomatis memfilter Balak 6 & 0
const movesL2 = GaplehRules.getValidMoves(handWithBalaks, emptyBoard, 2);
assert(!movesL2.some((m) => m.card[0] === 6 && m.card[1] === 6), 'Level 2: Langkah awal otomatis tidak memuat Balak 6');
assert(!movesL2.some((m) => m.card[0] === 0 && m.card[1] === 0), 'Level 2: Langkah awal otomatis tidak memuat Balak 0');
assert(movesL2.some((m) => m.card[0] === 5 && m.card[1] === 5), 'Level 2: Langkah awal memuat Balak 5');

// Level 2: Di tengah permainan, Balak 6 & 0 terkunci jika masih ada pilihan kartu lain
const moveBalak6LockedL2 = GaplehRules.validateMove([6, 6], 'left', handWithAlternatives, activeBoard, 2);
assert(!moveBalak6LockedL2.valid, 'Level 2: Balak 6 ditolak saat masih ada kartu lain yang cocok ([6, 2])');

// Level 2: Diperbolehkan jika tidak ada pilihan lain atau kartu terakhir (nutup)
const handNoAlternatives: DominoCard[] = [[6, 6], [1, 1], [2, 2]];
const moveBalak6AllowedL2 = GaplehRules.validateMove([6, 6], 'left', handNoAlternatives, activeBoard, 2);
assert(moveBalak6AllowedL2.valid === true, 'Level 2: Balak 6 diperbolehkan jika tidak ada pilihan kartu lain');

const singleCardHand: DominoCard[] = [[6, 6]];
const nutupBalak6L2 = GaplehRules.validateMove([6, 6], 'left', singleCardHand, activeBoard, 2);
assert(nutupBalak6L2.valid === true, 'Level 2: Balak 6 diperbolehkan sebagai kartu terakhir (Nutup)');

// -----------------------------------------------------------------------------
// TEST 3: Perhitungan Sistem Poin Khusus Level 2 (50 / 75 / 500 / bonus / multipliers)
// -----------------------------------------------------------------------------
console.log('\nTest 3: Sistem Poin Level 2 (Gapleh Rame)');

// Skenario 1.5 update1.md: Gapleh Biasa, lawan sisa 3 & 5 kartu -> 50 + (3*5) + (5*5) = 90 poin
const calcBiasa = GaplehRules.calculatePoints({
  winType: 'gapleh_biasa',
  winnerId: 'winner_p1',
  opponentHands: {
    winner_p1: [],
    opp_p2: [[1, 2], [3, 4], [5, 6]], // 3 kartu -> 15 poin
    opp_p3: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], // 5 kartu -> 25 poin
  },
});
assert(calcBiasa.basePoints === 50, 'Level 2: Gapleh biasa base poin = 50');
assert(calcBiasa.bonusPoints === 40, 'Level 2: Bonus sisa kartu lawan (3*5 + 5*5) = 40');
assert(calcBiasa.totalPoints === 90, 'Level 2: Total poin Gapleh biasa sesuai contoh update1.md (90 poin)');

// Skenario bonus lawan > 5 kartu (+10 poin bonus)
const calcLawanLebih5 = GaplehRules.calculatePoints({
  winType: 'gapleh_biasa',
  winnerId: 'winner_p1',
  opponentHands: {
    winner_p1: [],
    opp_heavy: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6]], // 6 kartu: 6*5 = 30 + bonus 10 = 40 poin
  },
});
assert(calcLawanLebih5.bonusPoints === 40, 'Level 2: Lawan >5 kartu bonus +10 (total bonus 40)');
assert(calcLawanLebih5.totalPoints === 90, 'Level 2: Total poin = 50 + 40 = 90 poin');

// Skenario Digapleh (buntu): Flat 75 poin
const calcDigapleh = GaplehRules.calculatePoints({
  winType: 'digapleh',
  winnerId: 'winner_p1',
});
assert(calcDigapleh.basePoints === 75, 'Level 2: Digapleh base poin = 75');
assert(calcDigapleh.totalPoints === 75, 'Level 2: Digapleh total poin = 75 (flat)');

// Skenario Nutup Balak 6 standar: 500 poin
const calcNutupStandard = GaplehRules.calculatePoints({
  winType: 'nutup_balak6',
  streakCount: 0,
  isFirstNutup: false,
});
assert(calcNutupStandard.totalPoints === 500, 'Level 2: Nutup Balak 6 standar = 500 poin');

// Skenario Nutup Balak 6 + Streak 3x: 500 * 1.5 = 750 poin
const calcNutupStreak = GaplehRules.calculatePoints({
  winType: 'nutup_balak6',
  streakCount: 3,
  isFirstNutup: false,
});
assert(calcNutupStreak.multiplier === 1.5, 'Level 2: Multiplier streak 3x = 1.5');
assert(calcNutupStreak.totalPoints === 750, 'Level 2: Nutup Balak 6 + Streak 3x = 750 poin (500 * 1.5)');

// Skenario First Time Nutup Balak 0: 500 * 3 = 1500 poin
const calcFirstNutup0 = GaplehRules.calculatePoints({
  winType: 'nutup_balak0',
  isFirstNutup: true,
});
assert(calcFirstNutup0.multiplier === 3, 'Level 2: Multiplier First Time Nutup = 3');
assert(calcFirstNutup0.totalPoints === 1500, 'Level 2: First Time Nutup Balak 0 = 1500 poin (500 * 3)');

// -----------------------------------------------------------------------------
// TEST 4: checkDigapleh() dan determineDigaplehWinner()
// -----------------------------------------------------------------------------
console.log('\nTest 4: checkDigapleh() dan determineDigaplehWinner()');

const lockedBoard: GaplehBoard = {
  leftEnd: 1,
  rightEnd: 2,
  placedCards: [{ card: [1, 2], side: 'initial' }],
};

const deadlockHands: Record<string, DominoCard[]> = {
  playerA: [[3, 3], [4, 4]], // 2 kartu, 14 pips (played 5 cards)
  playerB: [[5, 5], [6, 6], [5, 6]], // 3 kartu, 33 pips (played 4 cards)
};

const isDeadlock = GaplehRules.checkDigapleh(deadlockHands, lockedBoard);
assert(isDeadlock === true, 'checkDigapleh() mendeteksi permainan buntu');

const digaplehResult = GaplehRules.determineDigaplehWinner(deadlockHands, ['playerA', 'playerB']);
assert(digaplehResult.winnerId === 'playerA', 'Pemenang digapleh adalah playerA (sisa kartu paling sedikit)');

// Tiebreaker check: both have 2 cards, but player C has lower pip sum
const tiedCardHands: Record<string, DominoCard[]> = {
  playerC: [[3, 0], [1, 0]], // 2 kartu, sum = 4
  playerD: [[5, 4], [6, 3]], // 2 kartu, sum = 18
};
const digaplehTieResult = GaplehRules.determineDigaplehWinner(tiedCardHands, ['playerC', 'playerD']);
assert(digaplehTieResult.winnerId === 'playerC', 'Tiebreaker digapleh: pips 4 vs 18 memenangkan playerC');

// -----------------------------------------------------------------------------
// TEST 5: Bot Profile, Bot Leveling & Bot Points
// -----------------------------------------------------------------------------
console.log('\nTest 5: Bot Profile, Bot Leveling & Bot Points (Task 4 & 5)');

BotProfileService.initProfiles();

const budi = BotProfileService.getBotProfile('gapleh_2_budi');
assert(budi.name === 'Budi', 'Bot Budi terdaftar');
assert(budi.level === 1, 'Bot Budi awal di Level 1 (Kelas Bulu)');

const budiWin1 = BotProfileService.recordBotMatch('gapleh_2_budi', 'win');
assert(budiWin1.pointsAwarded === BOT_LEVEL_POINTS[1]!.win, 'Budi Level 1 menang dapat 10 poin');
assert(budiWin1.profile.total_points === 10, 'Total poin Budi = 10');

const maestro = BotProfileService.getBotProfile('gapleh_2_maestro');
assert(maestro.level === 6, 'Sang Maestro awal di Level 6 (Kelas Dunia)');
const maestroWin = BotProfileService.recordBotMatch('gapleh_2_maestro', 'win');
assert(maestroWin.pointsAwarded === 1000, 'Sang Maestro menang dapat 1000 poin');

// Test Level 6 bot reaching 100 wins -> gets "Bot Legendaris" badge (Task 4.2)
maestro.total_wins = 99;
const maestroWin100 = BotProfileService.recordBotMatch('gapleh_2_maestro', 'win');
assert(maestroWin100.profile.total_wins === 100, 'Sang Maestro mencapai 100 kemenangan');
assert(maestroWin100.profile.badges.includes('Bot Legendaris'), 'Sang Maestro mendapatkan badge "Bot Legendaris"');

// -----------------------------------------------------------------------------
// TEST 6: Game Simulation via GaplehGame (Level 1 vs Level 2)
// -----------------------------------------------------------------------------
console.log('\nTest 6: Perbandingan Gameplay Nyata Level 1 (Klasik) vs Level 2 (Rame)');

const testPlayers = [
  { id: 'p1', user_id: 'user_andi', username: 'andi', display_name: 'Andi', seat_number: 0, is_ready: true, is_active: true, is_bot: false },
  { id: 'p2', user_id: 'gapleh_2_budi', username: 'budi_bot', display_name: 'Budi Bot', seat_number: 1, is_ready: true, is_active: true, is_bot: true },
];

// 6.1 Level 1 Match: Aturan asli tidak berubah, poin selalu 50 poin standar
const gameL1 = new GaplehGame(testPlayers, { gaplehMode: 'individual', level: 1 });
const rawStateL1 = gameL1.getRawState();
assert(rawStateL1.level === 1, 'Game Level 1 terinisialisasi');

rawStateL1.board.leftEnd = 6;
rawStateL1.board.rightEnd = 2;
rawStateL1.board.placedCards = [{ card: [6, 2], side: 'initial' }];
rawStateL1.hands.user_andi = [[6, 6]];
rawStateL1.hands.gapleh_2_budi = [[1, 3], [4, 4], [5, 5]];
rawStateL1.currentTurn = 'user_andi';

const actionL1 = gameL1.handleAction('user_andi', 'play', { card: [6, 6], side: 'left' });
assert(actionL1.success === true, 'Level 1: Andi memainkan kartu terakhir');
assert(actionL1.finished === true, 'Level 1: Permainan selesai');

const resultsL1 = gameL1.getResults();
assert(resultsL1.pointsAwarded === 50, 'Level 1: Poin kemenangan tetap 50 poin standar (aturan lama tidak berubah)');
assert(resultsL1.summary.includes('Selamat! Andi berhasil menghabiskan semua kartu!'), 'Level 1: Summary menggunakan format standar lama');

// 6.2 Level 2 Match: Menggunakan aturan v3 & poin dinamis (nutup 500 x 3 = 1500)
const gameL2 = new GaplehGame(testPlayers, {
  gaplehMode: 'individual',
  level: 2,
  playerStats: {
    user_andi: { streakCount: 3, hasNutupBefore: false },
  },
});
const rawStateL2 = gameL2.getRawState();
assert(rawStateL2.level === 2, 'Game Level 2 terinisialisasi');

rawStateL2.board.leftEnd = 6;
rawStateL2.board.rightEnd = 2;
rawStateL2.board.placedCards = [{ card: [6, 2], side: 'initial' }];
rawStateL2.hands.user_andi = [[6, 6]];
rawStateL2.hands.gapleh_2_budi = [[1, 3], [4, 4], [5, 5]];
rawStateL2.currentTurn = 'user_andi';

const actionL2 = gameL2.handleAction('user_andi', 'play', { card: [6, 6], side: 'left' });
assert(actionL2.success === true, 'Level 2: Andi berhasil nutup Balak 6');
assert(actionL2.finished === true, 'Level 2: Permainan selesai');

const resultsL2 = gameL2.getResults();
assert(resultsL2.pointsAwarded === 1500, 'Level 2: Nutup Balak 6 pertama kali mendapatkan 500 x 3 = 1500 poin!');
assert(resultsL2.summary.includes('Nutup Balak 6'), 'Level 2: Summary khusus Nutup Balak 6');

console.log('\n================================================================');
console.log('🎉 ALL LEVEL 1 (UNCHANGED) & LEVEL 2 TESTS PASSED SUCCESSFULLY!');
console.log('================================================================\n');
