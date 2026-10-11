import { SnakeLadderBoard } from '../src/games/snake_ladder/SnakeLadderBoard';
import { SnakeLadderGame } from '../src/games/snake_ladder/SnakeLadderGame';
import { GamePlayerInfo } from '../src/games/engine/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

console.log('--- RUNNING SPRINT 2: ULAR TANGGA UNIT TESTS ---');

// 1. Board test
assert(SnakeLadderBoard.TOTAL_CELLS === 100, 'Board total cells is 100');
assert(Object.keys(SnakeLadderBoard.LADDERS).length === 10, 'There are exactly 10 official ladders');
assert(Object.keys(SnakeLadderBoard.SNAKES).length === 10, 'There are exactly 10 official snakes');

// 2. Specific ladders test
assert(SnakeLadderBoard.LADDERS[2] === 38, 'Ladder 2 climbs to 38');
assert(SnakeLadderBoard.LADDERS[28] === 84, 'Ladder 28 climbs to 84');
assert(SnakeLadderBoard.LADDERS[78] === 98, 'Ladder 78 climbs to 98');

// 3. Specific snakes test
assert(SnakeLadderBoard.SNAKES[16] === 6, 'Snake 16 bites down to 6');
assert(SnakeLadderBoard.SNAKES[62] === 19, 'Snake 62 bites down to 19');
assert(SnakeLadderBoard.SNAKES[99] === 80, 'Snake 99 bites down to 80');

// 4. Dice roll test
for (let i = 0; i < 50; i++) {
  const d = SnakeLadderBoard.rollDice();
  if (d < 1 || d > 6) throw new Error(`Invalid dice roll: ${d}`);
}
assert(true, 'Dice generator returns valid values between 1 and 6');

// 5. Normal move calculation
const normalMove = SnakeLadderBoard.calculateMove(10, 4);
assert(normalMove.finalPos === 14 && normalMove.transitionType === 'normal', 'Normal move calculates accurately (10 + 4 = 14)');
const normalMove2 = SnakeLadderBoard.calculateMove(20, 3);
assert(normalMove2.finalPos === 23 && normalMove2.transitionType === 'normal', 'Normal move calculates accurately (20 + 3 = 23)');

// 6. Ladder climb calculation
const ladderMove = SnakeLadderBoard.calculateMove(1, 1); // 1 + 1 = 2 -> 38
assert(ladderMove.finalPos === 38 && ladderMove.transitionType === 'ladder', 'Landing on ladder 2 climbs to 38');

// 7. Snake slide calculation
const snakeMove = SnakeLadderBoard.calculateMove(12, 4); // 12 + 4 = 16 -> 6
assert(snakeMove.finalPos === 6 && snakeMove.transitionType === 'snake', 'Landing on snake 16 slides down to 6');

// 8. Exact 100 victory calculation
const winMove = SnakeLadderBoard.calculateMove(96, 4);
assert(winMove.finalPos === 100 && winMove.targetPos === 100, 'Reaching exactly 100 wins');

// 9. Overshoot / bounce calculation
// From 97, roll 5 -> 100 - (102 - 100) = 98 -> ladder 78->98 or normal
const bounceMove = SnakeLadderBoard.calculateMove(97, 5); // 97 + 5 = 102 -> 100 - 2 = 98
assert(bounceMove.targetPos === 98 && bounceMove.transitionType === 'bounce', 'Overshoot past 100 bounces back (97 + 5 -> 98)');

// From 98, roll 3 -> 101 -> 99 -> snake 99 drops to 80!
const bounceSnakeMove = SnakeLadderBoard.calculateMove(98, 3); // 98 + 3 = 101 -> 100 - 1 = 99 -> snake to 80
assert(bounceSnakeMove.finalPos === 80 && bounceSnakeMove.transitionType === 'snake', 'Bouncing onto snake triggers snake slide');

// 10. Game instance tests
const mockPlayers: GamePlayerInfo[] = [
  { id: 'p1', user_id: 'user_alice', username: 'alice', display_name: 'Alice', seat_number: 0, is_ready: true, is_active: true },
  { id: 'p2', user_id: 'user_bob', username: 'bob', display_name: 'Bob', seat_number: 1, is_ready: true, is_active: true },
];

const game = new SnakeLadderGame(mockPlayers);
const p1State = game.getStateForPlayer('user_alice');
assert(p1State.boardSize === 100, 'Game board size is 100');
assert(p1State.players['user_alice'].position === 1, 'Player starts at position 1');
assert(p1State.currentTurn === 'user_alice', 'Alice has the initial turn');

// 11. Wrong turn rejected
const wrongTurnRes = game.handleAction('user_bob', 'roll', {});
assert(!wrongTurnRes.success, 'Bob cannot roll on Alice turn');

// 12. Valid roll action
const rollRes = game.handleAction('user_alice', 'roll', {});
assert(rollRes.success, 'Alice roll action succeeded');
assert(typeof rollRes.data?.roll === 'number', 'Dice roll result is returned');
assert(rollRes.data.playerState.position >= 1, 'Player position updated');

// 13. State for spectator
const specState = game.getStateForSpectator();
assert(specState.boardSize === 100 && !specState.isMyTurn, 'Spectator receives table state without active turn');

// 14. Bot player test
const botPlayers: GamePlayerInfo[] = [
  { id: 'p1', user_id: 'user_alice', username: 'alice', display_name: 'Alice', seat_number: 0, is_ready: true, is_active: true },
  { id: 'p2', user_id: 'bot_bambang', username: 'bot_bambang', display_name: 'Bot Bambang', seat_number: 1, is_ready: true, is_active: true, is_bot: true },
];
const botGame = new SnakeLadderGame(botPlayers);
assert(botGame.replacePlayer('bot_bambang', {
  id: 'p3',
  user_id: 'user_charlie',
  username: 'charlie',
  display_name: 'Charlie',
  seat_number: 1,
  is_ready: true,
  is_active: true,
  is_bot: false,
}), 'replacePlayer successfully swaps bot with Charlie');

const updatedState = botGame.getStateForPlayer('user_charlie');
assert(updatedState.players['user_charlie'] !== undefined, 'Charlie state is now active in game');

// 15. Results test
const results = game.getResults();
assert(results.pointsAwarded === 50, 'Standard 50 warkop points awarded for victory');
assert(results.winners.length === 1, 'Winners list populated');

console.log('\n--- TEST SUMMARY: ALL 15 SNAKE & LADDER TEST CASES PASSED ---');
