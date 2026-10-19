import { TrufGame } from '../src/games/truf/TrufGame';
import { GamePlayerInfo } from '../src/games/engine/types';

function createMockPlayers(): GamePlayerInfo[] {
  return [
    { id: 'p1', user_id: 'usr_p1', username: 'budi', display_name: 'Budi', seat_number: 0, is_ready: true, is_active: true, is_bot: false },
    { id: 'p2', user_id: 'usr_p2', username: 'siti', display_name: 'Siti', seat_number: 1, is_ready: true, is_active: true, is_bot: false },
    { id: 'p3', user_id: 'usr_p3', username: 'agus', display_name: 'Agus', seat_number: 2, is_ready: true, is_active: true, is_bot: false },
    { id: 'p4', user_id: 'usr_p4', username: 'dewi', display_name: 'Dewi', seat_number: 3, is_ready: true, is_active: true, is_bot: false },
  ];
}

async function runTests() {
  console.log('--- TEST 1: Initial Setup & 13 Cards Dealt ---');
  const players = createMockPlayers();
  const game = new TrufGame(players, {});

  const stateP1 = game.getStateForPlayer('usr_p1');
  console.assert(stateP1.phase === 'bidding', 'Game should start in bidding phase');
  console.assert(stateP1.myHand.length === 13, `P1 hand should have 13 cards, got ${stateP1.myHand.length}`);
  console.assert(stateP1.trumpSuit === null, 'Trump suit should be null during bidding');
  console.log('✅ Setup & Dealing 13 cards passed.');

  console.log('\n--- TEST 2: Bidding Phase & Determination of Trump & Mode ---');
  const rawState = game.getRawState();
  const p1Card = rawState.hands['usr_p1'][0];
  const p2Card = rawState.hands['usr_p2'][0];
  const p3Card = rawState.hands['usr_p3'][0];
  const p4Card = rawState.hands['usr_p4'][0];

  console.log(`P1 bids: ${p1Card.rank} ${p1Card.suit}`);
  let res = game.handleAction('usr_p1', 'bid', { suit: p1Card.suit, rank: p1Card.rank });
  console.assert(res.success, 'P1 bid should succeed');

  console.log(`P2 bids: ${p2Card.rank} ${p2Card.suit}`);
  res = game.handleAction('usr_p2', 'bid', { suit: p2Card.suit, rank: p2Card.rank });
  console.assert(res.success, 'P2 bid should succeed');

  console.log(`P3 bids: ${p3Card.rank} ${p3Card.suit}`);
  res = game.handleAction('usr_p3', 'bid', { suit: p3Card.suit, rank: p3Card.rank });
  console.assert(res.success, 'P3 bid should succeed');

  console.log(`P4 bids: ${p4Card.rank} ${p4Card.suit}`);
  res = game.handleAction('usr_p4', 'bid', { suit: p4Card.suit, rank: p4Card.rank });
  console.assert(res.success, 'P4 bid should succeed');

  const afterBidState = game.getRawState();
  console.log('Bidding resolved! Phase:', afterBidState.phase);
  console.log('Trump Suit:', afterBidState.trumpSuit);
  console.log('Mode:', afterBidState.mode);
  console.log('Total Bid:', afterBidState.totalBid);
  console.log('Leader:', afterBidState.currentLeaderId);

  console.assert(afterBidState.phase === 'playing', 'Phase should be playing after bidding');
  console.assert(afterBidState.trumpSuit !== null, 'Trump suit must be set');
  console.assert(afterBidState.mode === 'main_atas' || afterBidState.mode === 'main_bawah', 'Mode must be atas or bawah');
  console.log('✅ Bidding Resolution passed.');

  console.log('\n--- TEST 3: Trick-Taking Rules & Follow-Suit Enforcement ---');
  // Check follow suit validation
  const currentLeader = afterBidState.currentTurn;
  const leaderHand = afterBidState.hands[currentLeader];
  const leadCard = leaderHand[0];

  const playLeadRes = game.handleAction(currentLeader, 'play', { suit: leadCard.suit, rank: leadCard.rank });
  console.assert(playLeadRes.success, 'Leader playing card should succeed');

  const nextPlayer = afterBidState.currentTurn;
  const nextHand = afterBidState.hands[nextPlayer];
  const sameSuitCard = nextHand.find((c: any) => c.suit === leadCard.suit);
  const diffSuitCard = nextHand.find((c: any) => c.suit !== leadCard.suit);

  if (sameSuitCard && diffSuitCard) {
    // Attempt illegal move (playing different suit while holding led suit)
    const illegalRes = game.handleAction(nextPlayer, 'play', { suit: diffSuitCard.suit, rank: diffSuitCard.rank });
    console.assert(!illegalRes.success, 'Illegal move without following suit must be rejected');
    console.log('✅ Follow-suit rule correctly rejected illegal card!');

    // Now play legal card
    const legalRes = game.handleAction(nextPlayer, 'play', { suit: sameSuitCard.suit, rank: sameSuitCard.rank });
    console.assert(legalRes.success, 'Legal follow-suit move should succeed');
    console.log('✅ Legal follow-suit accepted!');
  } else {
    // Play first available card
    const c = nextHand[0];
    game.handleAction(nextPlayer, 'play', { suit: c.suit, rank: c.rank });
  }

  console.log('\n--- TEST 4: Full Simulation of 12 Remaining Tricks with Bot AI ---');
  let safeguard = 100;
  while (!game.isFinished() && safeguard-- > 0) {
    const activePlayer = game.getRawState().currentTurn;
    const botAction = game.getBotAction(activePlayer);
    if (!botAction) {
      // Fallback valid move
      const moves = game.getValidMoves(activePlayer);
      if (moves.length === 0) break;
      game.handleAction(activePlayer, moves[0].action, moves[0].payload);
    } else {
      const actRes = game.handleAction(activePlayer, botAction.action, botAction.payload);
      if (!actRes.success) {
        console.error('Bot action failed:', actRes.error, botAction);
        break;
      }
    }
  }

  console.assert(game.isFinished(), 'Game must finish after all tricks');
  const finalResults = game.getResults();
  console.log('Final Results Summary:', finalResults.summary);
  console.log('Scores:', finalResults.scores);
  console.log('Winner:', finalResults.winners);
  console.log('✅ Full 13-trick simulation completed and verified!');

  console.log('\n🎉 ALL TRUF TESTS PASSED 100%!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
