import { CaturGame } from '../src/games/catur/CaturGame';
import { GamePlayerInfo } from '../src/games/engine/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

console.log('--- RUNNING CATUR BOT & GAME ENGINE TESTS ---');

const pWhite: GamePlayerInfo = { id: 'p1', user_id: 'user_1', username: 'PlayerOne', display_name: 'Player One', seat_number: 0, is_ready: true, is_active: true };
const pBot: GamePlayerInfo = { id: 'p_bot', user_id: 'bot_catur', username: 'Kang Kopi Bot', display_name: 'Kang Kopi Bot', seat_number: 1, is_ready: true, is_active: true };

// 1. Initial State Check (User White)
const gameWhite = new CaturGame([pWhite, pBot], { preferredColor: 'white', botDifficulty: 'medium' });
const stateWhite = gameWhite.getRawState();
assert(stateWhite.whitePlayerId === 'user_1', 'user_1 is assigned White when preferredColor is white');
assert(stateWhite.blackPlayerId === 'bot_catur', 'bot_catur is assigned Black');
assert(stateWhite.currentTurn === 'user_1', 'White plays first turn');

// 2. Test User selecting Black
const gameBlack = new CaturGame([pWhite, pBot], { preferredColor: 'black', botDifficulty: 'hard' });
const stateBlack = gameBlack.getRawState();
assert(stateBlack.blackPlayerId === 'user_1', 'user_1 is assigned Black when preferredColor is black');
assert(stateBlack.whitePlayerId === 'bot_catur', 'bot_catur is assigned White');
assert(stateBlack.currentTurn === 'bot_catur', 'bot_catur has the first turn as White');

// 3. Test Bot makes valid opening move as White
const botMove = gameBlack.getBotAction('bot_catur');
assert(botMove !== null, 'Bot as White calculates an opening move');
if (botMove) {
  const moveRes = gameBlack.handleAction('bot_catur', botMove.action, botMove.payload);
  assert(moveRes.success === true, 'Bot opening move is executed successfully');
  assert(gameBlack.getRawState().currentTurn === 'user_1', 'Turn passed to user_1 after bot move');
}

// 4. Test Bot responds to player move on Medium difficulty
const gameMenengah = new CaturGame([pWhite, pBot], { preferredColor: 'white', botDifficulty: 'medium' });
// User plays 1. e4 (from [6,4] to [4,4])
const userMove = gameMenengah.handleAction('user_1', 'move', { fromRow: 6, fromCol: 4, toRow: 4, toCol: 4 });
assert(userMove.success === true, 'User 1. e4 move succeeded');
assert(gameMenengah.getRawState().currentTurn === 'bot_catur', 'Current turn transferred to bot');

const botResp = gameMenengah.getBotAction('bot_catur');
assert(botResp !== null, 'Menengah bot calculated a valid response move');
if (botResp) {
  const botMoveRes = gameMenengah.handleAction('bot_catur', botResp.action, botResp.payload);
  assert(botMoveRes.success === true, 'Menengah bot response executed successfully');
  assert(gameMenengah.getRawState().currentTurn === 'user_1', 'Current turn back to user');
}

// 5. Test all difficulties generate moves without error
(['easy', 'medium', 'hard'] as const).forEach(diff => {
  const g = new CaturGame([pWhite, pBot], { preferredColor: 'white', botDifficulty: diff });
  const m = g.getBotAction('bot_catur');
  // At start, currentTurn is white (user_1), so bot has no moves yet
  const userM = g.handleAction('user_1', 'move', { fromRow: 6, fromCol: 4, toRow: 4, toCol: 4 });
  assert(userM.success === true, `User move succeeded for diff ${diff}`);
  const botM = g.getBotAction('bot_catur');
  assert(botM !== null, `Difficulty ${diff} evaluated a valid bot move`);
});

console.log('--- ALL CATUR TESTS PASSED SUCCESSFULLY! ---');
