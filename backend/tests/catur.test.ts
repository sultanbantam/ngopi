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

// 6. Test Castling (Lokir / Rokade) Kingside (O-O) & Queenside (O-O-O)
const p2: GamePlayerInfo = { id: 'p2', user_id: 'user_2', username: 'PlayerTwo', display_name: 'Player Two', seat_number: 1, is_ready: true, is_active: true };
const gameCastle = new CaturGame([pWhite, p2], { preferredColor: 'white' });
const rawB = gameCastle.getRawState().board;

// Clear path for White Kingside: clear (7, 5) Bishop and (7, 6) Knight
rawB[7][5] = null;
rawB[7][6] = null;

// Generate valid moves for White King at (7, 4)
const validMovesW = gameCastle.getValidMoves('user_1');
const canCastleKingside = validMovesW.some(m => m.fromRow === 7 && m.fromCol === 4 && m.toRow === 7 && m.toCol === 6);
assert(canCastleKingside === true, 'White King can perform Kingside Castling (O-O) when path is clear');

// Execute Kingside Castling
const castleRes = gameCastle.handleAction('user_1', 'move', { fromRow: 7, fromCol: 4, toRow: 7, toCol: 6 });
assert(castleRes.success === true, 'Kingside Castling executed successfully');
assert(gameCastle.getRawState().board[7][6] === 'wK', 'White King moved to (7, 6)');
assert(gameCastle.getRawState().board[7][5] === 'wR', 'White Rook moved to (7, 5)');
assert(gameCastle.getRawState().board[7][4] === null, 'Starting King square (7, 4) is now empty');
assert(gameCastle.getRawState().board[7][7] === null, 'Starting Rook square (7, 7) is now empty');

// 7. Test Black Queenside Castling (O-O-O)
// Clear Black Queenside path: (0, 1), (0, 2), (0, 3)
const rawBBlack = gameCastle.getRawState().board;
rawBBlack[0][1] = null;
rawBBlack[0][2] = null;
rawBBlack[0][3] = null;

const validMovesB = gameCastle.getValidMoves('user_2');
const canCastleQueensideBlack = validMovesB.some(m => m.fromRow === 0 && m.fromCol === 4 && m.toRow === 0 && m.toCol === 2);
assert(canCastleQueensideBlack === true, 'Black King can perform Queenside Castling (O-O-O) when path is clear');

const blackCastleRes = gameCastle.handleAction('user_2', 'move', { fromRow: 0, fromCol: 4, toRow: 0, toCol: 2 });
assert(blackCastleRes.success === true, 'Black Queenside Castling executed successfully');
assert(gameCastle.getRawState().board[0][2] === 'bK', 'Black King moved to (0, 2)');
assert(gameCastle.getRawState().board[0][3] === 'bR', 'Black Rook moved to (0, 3)');
assert(gameCastle.getRawState().board[0][4] === null, 'Black King start square (0, 4) is now empty');
assert(gameCastle.getRawState().board[0][0] === null, 'Black Rook start square (0, 0) is now empty');

console.log('--- ALL CATUR TESTS PASSED SUCCESSFULLY! ---');

