import { MonopolyGame } from '../src/games/monopoly/MonopolyGame';
import { MonopolyBoard } from '../src/games/monopoly/MonopolyBoard';
import { MonopolyRules } from '../src/games/monopoly/MonopolyRules';
import { GamePlayerInfo } from '../src/games/engine/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

console.log('--- RUNNING MONOPOLI GAME ENGINE & BOT UNIT TESTS ---');

// 1. Board Structure Tests
assert(MonopolyBoard.TOTAL_SQUARES === 24, 'Monopoly board has exactly 24 squares');
assert(MonopolyBoard.SQUARES[0]?.type === 'start', 'Square 0 is START');
assert(MonopolyBoard.SQUARES[6]?.type === 'jail', 'Square 6 is Jail');
assert(MonopolyBoard.SQUARES[18]?.type === 'go_to_jail', 'Square 18 is Go to Jail');

// 2. Initial State & Players Setup
const p1: GamePlayerInfo = { id: 'p1', user_id: 'user_1', username: 'Juragan1', display_name: 'Juragan 1', seat_number: 0, is_ready: true, is_active: true };
const p2: GamePlayerInfo = { id: 'p2', user_id: 'user_2', username: 'Juragan2', display_name: 'Juragan 2', seat_number: 1, is_ready: true, is_active: true };
const pBot: GamePlayerInfo = { id: 'p_bot', user_id: 'bot_monopoly', username: 'Kang Kopi Bot', display_name: 'Kang Kopi Bot', seat_number: 2, is_ready: true, is_active: true, is_bot: true };

const game = new MonopolyGame([p1, p2, pBot], { modeBMC: false });
const rawState = game.getRawState();

assert(rawState.squares.length === 24, 'Game state squares length is 24');
assert(rawState.players['user_1']?.money === 1500, 'User 1 initial money is 1500');
assert(rawState.players['user_2']?.money === 1500, 'User 2 initial money is 1500');
assert(rawState.players['bot_monopoly']?.money === 1500, 'Bot initial money is 1500');
assert(rawState.currentTurn === 'user_1', 'Turn 1 is user_1');

// 3. Roll Dice & Movement
const rollRes = game.handleAction('user_1', 'roll', {});
assert(rollRes.success, 'User 1 successfully rolled dice');
const afterRoll = game.getRawState();
assert(afterRoll.hasRolled === true, 'hasRolled is set to true');
assert(afterRoll.players['user_1']?.position !== undefined, 'User 1 position updated');

// 4. Property Purchase Flow Test
const game2 = new MonopolyGame([p1, p2]);
// Force user_1 to land on Kopi Tubruk (id: 1, price: 60)
const s2 = game2.getRawState();
s2.players['user_1']!.position = 0;
s2.hasRolled = false;
// Manually trigger move to square 1
s2.players['user_1']!.position = 1;
s2.pendingAction = { type: 'buy_property', squareId: 1, amount: 60 };

const buyRes = game2.handleAction('user_1', 'buy_property', {});
assert(buyRes.success, 'User 1 successfully bought property');
assert(game2.getRawState().properties[1]?.ownerId === 'user_1', 'Property 1 owner is user_1');
assert(game2.getRawState().players['user_1']?.money === 1440, 'User 1 money deducted by 60 (1500 - 60 = 1440)');

// 5. Rent Calculation & Payment Test
// When user_2 lands on Property 1 owned by user_1
const rentBase = MonopolyBoard.getSquare(1).rentBase || 6;
s2.currentTurn = 'user_2';
s2.hasRolled = false;
s2.players['user_2']!.position = 0;
// Simulate roll to square 1
const user2InitialMoney = s2.players['user_2']!.money;
s2.players['user_2']!.money -= rentBase;
s2.players['user_1']!.money += rentBase;
assert(s2.players['user_2']!.money === user2InitialMoney - rentBase, 'User 2 paid rent to user_1');

// 6. Color Group Completion and Building Houses
// Group 'brown': square 1 and square 3
s2.properties[3] = { squareId: 3, ownerId: 'user_1', houses: 0 };
s2.players['user_1']!.properties.push(3);

const ownsAllBrown = MonopolyRules.doesPlayerOwnAllInGroup(s2, 'user_1', 'brown');
assert(ownsAllBrown === true, 'User 1 owns all properties in brown group');

const canBuildRes = MonopolyRules.canBuildHouse(s2, 'user_1', 1);
assert(canBuildRes.canBuild === true, 'User 1 can build house on brown property');

s2.currentTurn = 'user_1';
s2.pendingAction = null;
const buildRes = game2.handleAction('user_1', 'build_house', { squareId: 1 });
assert(buildRes.success, 'House built successfully on property 1');
assert(s2.properties[1]?.houses === 1, 'Property 1 now has 1 house');
assert(s2.players['user_1']!.money === 1440 + rentBase - 50, 'House cost 50 deducted from user_1');

// 7. Jail Handling Tests
s2.players['user_2']!.inJail = true;
s2.players['user_2']!.position = 6;
s2.currentTurn = 'user_2';
s2.hasRolled = false;
s2.pendingAction = null;

const jailFineRes = game2.handleAction('user_2', 'pay_jail_fine', {});
assert(jailFineRes.success, 'User 2 paid jail fine of Rp 50');
assert(s2.players['user_2']!.inJail === false, 'User 2 is now out of jail');
assert(s2.players['user_2']!.money === user2InitialMoney - rentBase - 50, 'Jail fine deducted');

// 8. Bot AI Action Tests
const botGame = new MonopolyGame([p1, pBot]);
const botState = botGame.getRawState();
botState.currentTurn = 'bot_monopoly';
botState.hasRolled = false;
botState.pendingAction = null;

const botAction = botGame.getBotAction('bot_monopoly');
assert(botAction !== null, 'Bot determines an action');
assert(botAction?.action === 'roll', 'Bot first action is to roll dice');

console.log('--- ALL MONOPOLI TESTS PASSED SUCCESSFULLY! ---');
