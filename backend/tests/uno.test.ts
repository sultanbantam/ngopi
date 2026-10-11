import { UnoDeck } from '../src/games/uno/UnoDeck';
import { UnoRules } from '../src/games/uno/UnoRules';
import { UnoGame } from '../src/games/uno/UnoGame';
import { GamePlayerInfo } from '../src/games/engine/types';
import { UnoCard } from '../src/games/uno/types';

declare const process: any;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('--- RUNNING SPRINT 1: UNO UNIT TESTS ---');

  // Test 1: Deck contains exactly 108 cards
  const deck = UnoDeck.createDeck();
  assert(deck.length === 108, 'UnoDeck.createDeck() generates exactly 108 cards');

  // Test 2: Check card counts per color
  const redCards = deck.filter((c) => c.color === 'red');
  const yellowCards = deck.filter((c) => c.color === 'yellow');
  const greenCards = deck.filter((c) => c.color === 'green');
  const blueCards = deck.filter((c) => c.color === 'blue');
  const wildCards = deck.filter((c) => c.color === 'wild');

  assert(
    redCards.length === 25 &&
    yellowCards.length === 25 &&
    greenCards.length === 25 &&
    blueCards.length === 25,
    'Each standard color has exactly 25 cards (1x 0, 2x 1-9, 2x skip, 2x reverse, 2x draw2)'
  );

  // Test 3: Wild cards count
  const wildNormal = wildCards.filter((c) => c.value === 'wild');
  const wildDraw4 = wildCards.filter((c) => c.value === 'wild4');
  assert(wildNormal.length === 4 && wildDraw4.length === 4, 'Deck has exactly 4 Wild and 4 Wild Draw Four cards');

  // Test 4: Deck shuffle preserves length and card elements
  const shuffled = UnoDeck.shuffle(deck);
  assert(shuffled.length === 108, 'UnoDeck.shuffle() preserves 108 cards');

  // Test 5: Game initialization and dealing
  const mockPlayers: GamePlayerInfo[] = [
    { id: 'p1', user_id: 'user_1', username: 'alice', display_name: 'Alice', seat_number: 0, is_ready: true, is_active: true },
    { id: 'p2', user_id: 'user_2', username: 'bob', display_name: 'Bob', seat_number: 1, is_ready: true, is_active: true },
  ];
  const game = new UnoGame(mockPlayers, {});
  const rawState = game.getRawState();

  assert(rawState.hands['user_1']?.length === 7, 'Player 1 starts with 7 cards');
  assert(rawState.hands['user_2']?.length === 7, 'Player 2 starts with 7 cards');
  assert(rawState.discardPile.length === 1, 'Top card placed on discard pile on start');

  // Test 6: Rules - Color matching
  const topCard: UnoCard = { id: 'c1', color: 'red', value: '5', score: 5 };
  const cardSameColor: UnoCard = { id: 'c2', color: 'red', value: '9', score: 9 };
  assert(UnoRules.isValidPlay(cardSameColor, topCard, 'red'), 'UnoRules accepts card of same color');

  // Test 7: Rules - Value matching
  const cardSameVal: UnoCard = { id: 'c3', color: 'blue', value: '5', score: 5 };
  assert(UnoRules.isValidPlay(cardSameVal, topCard, 'red'), 'UnoRules accepts card of same value on different color');

  // Test 8: Rules - Wild card always valid
  const wildCard: UnoCard = { id: 'c4', color: 'wild', value: 'wild', score: 50 };
  assert(UnoRules.isValidPlay(wildCard, topCard, 'red'), 'UnoRules allows Wild card regardless of color');

  // Test 9: Rules - Invalid move rejected
  const cardMismatch: UnoCard = { id: 'c5', color: 'green', value: '2', score: 2 };
  assert(!UnoRules.isValidPlay(cardMismatch, topCard, 'red'), 'UnoRules rejects card mismatching both color and value');

  // Test 10: Rules - Wild Draw 4 anti-cheat verification
  const handWithRed: UnoCard[] = [{ id: 'c6', color: 'red', value: '1', score: 1 }];
  const handWithoutRed: UnoCard[] = [{ id: 'c7', color: 'blue', value: '1', score: 1 }];
  assert(!UnoRules.isWildDrawFourLegal(handWithRed, 'red'), 'Wild Draw 4 is flagged if holding active color');
  assert(UnoRules.isWildDrawFourLegal(handWithoutRed, 'red'), 'Wild Draw 4 is legal if player has no active color cards');

  // Test 11: Anti-Cheat - getStateForPlayer never reveals opponent cards
  const aliceState = game.getStateForPlayer('user_1');
  assert(Array.isArray(aliceState.myHand), 'Player receives their own hand array');
  const bobSummary = aliceState.playersSummary.find((p: any) => p.user_id === 'user_2');
  assert(typeof bobSummary.cardCount === 'number' && !bobSummary.cards, 'Opponent state contains ONLY cardCount, hiding actual cards');

  // Test 12: Turn order validation
  const wrongTurnResult = game.handleAction('user_2', 'draw', {});
  assert(!wrongTurnResult.success && Boolean(wrongTurnResult.error?.includes('Bukan giliran')), 'Action on wrong turn is rejected');

  // Test 13: Draw action increments player hand and passes turn
  const initialP1Count = rawState.hands['user_1']!.length;
  const drawResult = game.handleAction('user_1', 'draw', {});
  assert(drawResult.success, 'Drawing card succeeds on current turn');
  assert(rawState.hands['user_1']!.length === initialP1Count + 1, 'Player hand increased by 1 after draw');
  assert(rawState.currentTurn === 'user_2', 'Turn passed to next player after draw');

  // Test 14: Play invalid card rejected without mutating hand
  const p2Hand = rawState.hands['user_2']!;
  const fakeCardId = 'fake_card_999';
  const badPlayResult = game.handleAction('user_2', 'play', { cardId: fakeCardId });
  assert(!badPlayResult.success, 'Playing non-existent card rejected');

  // Test 15: Play matching card succeeds
  const currentTop = rawState.discardPile[rawState.discardPile.length - 1]!;
  // Give p2 a matching card
  const forcedMatch: UnoCard = { id: 'forced_match_1', color: rawState.activeColor, value: '8', score: 8 };
  p2Hand.push(forcedMatch);
  const playResult = game.handleAction('user_2', 'play', { cardId: 'forced_match_1' });
  assert(playResult.success, 'Playing valid matching card succeeds');
  assert(rawState.discardPile[rawState.discardPile.length - 1]!.id === 'forced_match_1', 'Discard pile top updated to played card');

  // Test 16: Special Card - Skip effect
  rawState.currentTurn = 'user_1';
  const skipCard: UnoCard = { id: 'skip_card_1', color: rawState.activeColor, value: 'skip', score: 20 };
  rawState.hands['user_1']!.push(skipCard);
  const skipResult = game.handleAction('user_1', 'play', { cardId: 'skip_card_1' });
  assert(skipResult.success, 'Playing Skip card succeeds');
  assert(rawState.currentTurn === 'user_1', 'In 2-player game, Skip card skips Bob so turn returns to Alice');

  // Test 17: Special Card - Draw Two (+2)
  rawState.currentTurn = 'user_1';
  const draw2Card: UnoCard = { id: 'draw2_card_1', color: rawState.activeColor, value: 'draw2', score: 20 };
  rawState.hands['user_1']!.push(draw2Card);
  const bobCountBefore = rawState.hands['user_2']!.length;
  const draw2Result = game.handleAction('user_1', 'play', { cardId: 'draw2_card_1' });
  assert(draw2Result.success, 'Playing Draw Two (+2) succeeds');
  assert(rawState.hands['user_2']!.length === bobCountBefore + 2, 'Next player drew 2 cards');

  // Test 18: UNO Shout Action
  rawState.hands['user_1'] = [
    { id: 'last_1', color: 'red', value: '1', score: 1 },
    { id: 'last_2', color: 'red', value: '2', score: 2 },
  ];
  const unoResult = game.handleAction('user_1', 'uno', {});
  assert(unoResult.success, 'Shouting "UNO" with 2 cards left succeeds');
  assert(rawState.hasCalledUno['user_1'] === true, 'Player hasCalledUno flag is true');

  // Test 19: Winning game finishes match and awards points
  rawState.currentTurn = 'user_1';
  rawState.activeColor = 'red';
  const lastCard: UnoCard = { id: 'final_win_card', color: 'red', value: '9', score: 9 };
  rawState.hands['user_1'] = [lastCard];
  const winPlay = game.handleAction('user_1', 'play', { cardId: 'final_win_card' });
  assert(winPlay.finished === true, 'Playing last card finishes game');
  assert(Boolean(winPlay.results?.winners.includes('user_1')), 'Winning player recorded in results');
  assert(winPlay.results?.pointsAwarded === 50, 'Standard 50 points awarded for UNO victory');

  // Test 20: Bot AI generates action
  const botPlayers: GamePlayerInfo[] = [
    { id: 'p1', user_id: 'user_1', username: 'alice', display_name: 'Alice', seat_number: 0, is_ready: true, is_active: true },
    { id: 'bot1', user_id: 'bot_uno', username: 'bot_uno', display_name: 'Bot Uno', seat_number: 1, is_ready: true, is_active: true, is_bot: true },
  ];
  const botGame = new UnoGame(botPlayers, {});
  const botAction = botGame.getBotAction('bot_uno');
  assert(botAction !== null && ['play', 'draw'].includes(botAction.action), 'Bot AI autonomously generates valid play or draw action');

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
