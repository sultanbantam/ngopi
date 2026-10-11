import { GaplehRules } from '../src/games/gapleh/GaplehRules';
import { GaplehGame } from '../src/games/gapleh/GaplehGame';
import { DominoCard } from '../src/games/gapleh/types';
import { GamePlayerInfo } from '../src/games/engine/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

console.log('--- RUNNING GAPLEH BERPASANGAN & INDIVIDU UNIT TESTS ---');

// 1. Deck generation and pip calculation
const deck = GaplehRules.generateDeck();
assert(deck.length === 28, 'Standard deck has exactly 28 domino cards');

assert(GaplehRules.calculateHandPips([[6, 6]]) === 12, '6-6 = 12 pips');
assert(GaplehRules.calculateHandPips([[6, 2]]) === 8, '6-2 = 8 pips');
assert(GaplehRules.calculateHandPips([[3, 4]]) === 7, '3-4 = 7 pips');
assert(GaplehRules.calculateHandPips([[0, 5]]) === 5, '0-5 = 5 pips');
assert(GaplehRules.calculateHandPips([[0, 0]]) === 0, '0-0 = 0 pips');

// 2. Team pips calculation
const sampleHands: Record<string, DominoCard[]> = {
  a1: [[6, 2], [3, 3]], // 8 + 6 = 14
  b1: [[6, 6], [2, 0]], // 12 + 2 = 14
  a2: [[0, 0]],         // 0
  b2: [[4, 4]],         // 8
};
const sampleTeams: Record<string, 'A' | 'B'> = {
  a1: 'A',
  b1: 'B',
  a2: 'A',
  b2: 'B',
};
const calculatedTeamPips = GaplehRules.calculateTeamPips(sampleHands, sampleTeams);
assert(calculatedTeamPips.A === 14, 'Team A pips = 14 (14 + 0)');
assert(calculatedTeamPips.B === 22, 'Team B pips = 22 (14 + 8)');

// 3. MANDATORY CASE 1 (gaplehpasangan.md Sec 16):
// Kampung, Tim A menang karena batu habis; Tim B tersisa 18 mata -> A1 +50, A2 +50, B1 +0, B2 +0
const c1Hands: Record<string, DominoCard[]> = {
  a1: [], // batu habis
  b1: [[6, 4]], // 10
  a2: [[2, 1]], // 3 (sisa rekan A2)
  b2: [[5, 3]], // 8 -> total Tim B = 18
};
const c1PlayerIds = ['a1', 'b1', 'a2', 'b2'];
const c1Result = GaplehRules.resolvePartnershipKampung(c1Hands, sampleTeams, c1PlayerIds, 'a1');
assert(c1Result.winnerTeam === 'A', 'Case 1: Tim A is winning team');
assert(c1Result.winReason === 'cards_cleared', 'Case 1: Win reason is cards_cleared');
assert(c1Result.pointsAwarded === 50, 'Case 1: Points awarded is 50');
assert(c1Result.winners.includes('a1') && c1Result.winners.includes('a2'), 'Case 1: Winners include both A1 and A2');
assert(!c1Result.winners.includes('b1') && !c1Result.winners.includes('b2'), 'Case 1: Winners do not include B1 or B2');
assert(c1Result.teamPips.B === 18, 'Case 1: Tim B pips is 18');

// 4. MANDATORY CASE 2 (gaplehpasangan.md Sec 16):
// Kampung, buntu: Tim A 14 mata, Tim B 22 mata -> Tim A menang, kedua anggota Tim A masing-masing +50
const c2Hands: Record<string, DominoCard[]> = {
  a1: [[5, 5]], // 10
  b1: [[6, 6]], // 12
  a2: [[2, 2]], // 4 -> total Tim A = 14
  b2: [[5, 5]], // 10 -> total Tim B = 22
};
const c2Result = GaplehRules.resolvePartnershipKampung(c2Hands, sampleTeams, c1PlayerIds, null);
assert(c2Result.winnerTeam === 'A', 'Case 2: Tim A wins deadlock with lower pips (14 vs 22)');
assert(c2Result.winReason === 'deadlock', 'Case 2: Win reason is deadlock');
assert(c2Result.pointsAwarded === 50, 'Case 2: Points awarded is 50 for Tim A members');
assert(c2Result.winners.includes('a1') && c2Result.winners.includes('a2'), 'Case 2: Both A1 and A2 are winners');

// 5. MANDATORY CASE 3 (gaplehpasangan.md Sec 16):
// Kampung, buntu: Tim A 18 mata, Tim B 18 mata -> seri, 0 poin kemenangan
const c3Hands: Record<string, DominoCard[]> = {
  a1: [[6, 3]], // 9
  b1: [[5, 5]], // 10
  a2: [[5, 4]], // 9 -> total Tim A = 18
  b2: [[4, 4]], // 8 -> total Tim B = 18
};
const c3Result = GaplehRules.resolvePartnershipKampung(c3Hands, sampleTeams, c1PlayerIds, null);
assert(c3Result.winnerTeam === null, 'Case 3: Winner team is null on equal pips (18 vs 18)');
assert(c3Result.winReason === 'seri', 'Case 3: Win reason is seri');
assert(c3Result.pointsAwarded === 0, 'Case 3: 0 points awarded on draw');
assert(c3Result.winners.length === 0, 'Case 3: Winners list is empty');

// 6. MANDATORY CASE 4 (gaplehpasangan.md Sec 16):
// Turnamen, Tim A menang dengan menghabiskan batu, Tim B tersisa 26 mata -> Tim A +26 skor putaran
const c4Hands: Record<string, DominoCard[]> = {
  a1: [], // Habis batu
  b1: [[6, 6], [2, 2]], // 12 + 4 = 16
  a2: [[1, 1]],         // 2
  b2: [[5, 5]],         // 10 -> total Tim B = 26
};
const c4Result = GaplehRules.resolvePartnershipTournament(
  c4Hands,
  sampleTeams,
  c1PlayerIds,
  { A: 0, B: 0 },
  250,
  'a1'
);
assert(c4Result.winnerTeam === 'A', 'Case 4: Tim A wins tournament round on card clear');
assert(c4Result.roundPoints.A === 26, 'Case 4: Tim A gets +26 round points (opponent remaining pips)');
assert(c4Result.roundPoints.B === 0, 'Case 4: Tim B gets 0 round points');
assert(c4Result.newMatchScores.A === 26, 'Case 4: Tim A accumulated match score is 26');

// 7. MANDATORY CASE 5 (gaplehpasangan.md Sec 16):
// Turnamen, buntu: Tim A 12 mata, Tim B 20 mata -> Tim A +8 skor putaran
const c5Hands: Record<string, DominoCard[]> = {
  a1: [[6, 0]], // 6
  b1: [[5, 5]], // 10
  a2: [[3, 3]], // 6 -> total Tim A = 12
  b2: [[6, 4]], // 10 -> total Tim B = 20
};
const c5Result = GaplehRules.resolvePartnershipTournament(
  c5Hands,
  sampleTeams,
  c1PlayerIds,
  { A: 50, B: 30 },
  250,
  null
);
assert(c5Result.winnerTeam === 'A', 'Case 5: Tim A wins tournament deadlock (12 vs 20)');
assert(c5Result.roundPoints.A === 8, 'Case 5: Tim A gets +8 round points (20 - 12)');
assert(c5Result.roundPoints.B === 0, 'Case 5: Tim B gets 0 round points');
assert(c5Result.newMatchScores.A === 58, 'Case 5: Tim A accumulated match score is 50 + 8 = 58');

// 8. MANDATORY CASE 6 (gaplehpasangan.md Sec 16):
// Turnamen, buntu: kedua tim 16 mata -> skor putaran 0
const c6Hands: Record<string, DominoCard[]> = {
  a1: [[5, 3]], // 8
  b1: [[6, 2]], // 8
  a2: [[4, 4]], // 8 -> total Tim A = 16
  b2: [[5, 3]], // 8 -> total Tim B = 16
};
const c6Result = GaplehRules.resolvePartnershipTournament(
  c6Hands,
  sampleTeams,
  c1PlayerIds,
  { A: 100, B: 100 },
  250,
  null
);
assert(c6Result.winnerTeam === null, 'Case 6: Winner team is null on equal tournament deadlock');
assert(c6Result.roundPoints.A === 0 && c6Result.roundPoints.B === 0, 'Case 6: Both teams get 0 round points');
assert(c6Result.newMatchScores.A === 100 && c6Result.newMatchScores.B === 100, 'Case 6: Match scores remain unchanged');

// 9. TOURNAMENT MATCH WIN TARGET CASE:
// Target 250 points, current match score Tim A = 240, Tim A wins +15 -> match finishes!
const cTargetResult = GaplehRules.resolvePartnershipTournament(
  c5Hands, // diff 8
  sampleTeams,
  c1PlayerIds,
  { A: 245, B: 180 },
  250,
  null
);
assert(cTargetResult.isMatchOver === true, 'Tournament match is marked over when reaching target');
assert(cTargetResult.matchWinnerTeam === 'A', 'Tim A is tournament match winner');
assert(cTargetResult.pointsAwarded === 50, 'Tournament champion receives 50 leaderboard points');

// 10. MANDATORY CASE 7 (gaplehpasangan.md Sec 16):
// REGRESSION TEST: Mode individu lama tetap berfungsi 100%
const mockIndividualPlayers: GamePlayerInfo[] = [
  { id: 'p1', user_id: 'u1', username: 'andi', display_name: 'Andi', seat_number: 0, is_ready: true, is_active: true },
  { id: 'p2', user_id: 'u2', username: 'budi', display_name: 'Budi', seat_number: 1, is_ready: true, is_active: true },
  { id: 'p3', user_id: 'u3', username: 'caca', display_name: 'Caca', seat_number: 2, is_ready: true, is_active: true },
  { id: 'p4', user_id: 'u4', username: 'dani', display_name: 'Dani', seat_number: 3, is_ready: true, is_active: true },
];

const individualGame = new GaplehGame(mockIndividualPlayers, { gaplehMode: 'individual' });
const indivState = individualGame.getRawState();
assert(indivState.gameMode === 'individual', 'Individual game initializes with gameMode individual');

// Test individual deadlock resolution
const indivHands: Record<string, DominoCard[]> = {
  u1: [[6, 6]], // 12
  u2: [[1, 2]], // 3  -> lowest!
  u3: [[4, 4]], // 8
  u4: [[5, 3]], // 8
};
const indivDeadlock = GaplehRules.resolveDeadlock(indivHands, ['u1', 'u2', 'u3', 'u4']);
assert(indivDeadlock.winnerId === 'u2', 'Individual deadlock picks player with lowest individual pips');
assert(indivDeadlock.scores['u2'] === 3, 'Individual deadlock score for u2 is 3');

// 11. SEATING AND ALTERNATION TEST:
const mockPartnershipPlayers: GamePlayerInfo[] = [
  { id: 'p1', user_id: 'host', username: 'host_user', display_name: 'Host A1', seat_number: 0, is_ready: true, is_active: true },
  { id: 'p2', user_id: 'opp1', username: 'opp1_user', display_name: 'Opp B1', seat_number: 1, is_ready: true, is_active: true },
  { id: 'p3', user_id: 'part', username: 'partner_user', display_name: 'Partner A2', seat_number: 2, is_ready: true, is_active: true },
  { id: 'p4', user_id: 'opp2', username: 'opp2_user', display_name: 'Opp B2', seat_number: 3, is_ready: true, is_active: true },
];

const partnershipGame = new GaplehGame(mockPartnershipPlayers, { gaplehMode: 'partnership', gaplehRuleset: 'kampung' });
const partState = partnershipGame.getRawState();
assert(partState.gameMode === 'partnership', 'Game mode is partnership');
assert(partState.teams['host'] === 'A', 'Seat 0 is Team A');
assert(partState.teams['opp1'] === 'B', 'Seat 1 is Team B');
assert(partState.teams['part'] === 'A', 'Seat 2 is Team A');
assert(partState.teams['opp2'] === 'B', 'Seat 3 is Team B');
assert(
  partState.turnOrder[0] === 'host' &&
  partState.turnOrder[1] === 'opp1' &&
  partState.turnOrder[2] === 'part' &&
  partState.turnOrder[3] === 'opp2',
  'Turn order is alternating: A1 (seat 0) -> B1 (seat 1) -> A2 (seat 2) -> B2 (seat 3)'
);

// 12. PASS VALIDATION TEST:
// Player with valid moves CANNOT pass
const testBoard = {
  leftEnd: 3,
  rightEnd: 5,
  placedCards: [],
};
const testHandWithMove: DominoCard[] = [[3, 6], [0, 1]];
const validMoves = GaplehRules.getValidMoves(testHandWithMove, testBoard);
assert(validMoves.length === 1 && validMoves[0]?.card[0] === 3, 'Valid move found for card matching board');

const testHandWithoutMove: DominoCard[] = [[1, 2], [0, 4]];
const noMoves = GaplehRules.getValidMoves(testHandWithoutMove, testBoard);
assert(noMoves.length === 0, 'No valid moves found when cards do not match board ends');

console.log('--- ALL GAPLEH BERPASANGAN & INDIVIDU UNIT TESTS PASSED SUCCESSFULLY! ---');
