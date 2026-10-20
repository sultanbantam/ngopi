import { ChessProService, CHESS_BOTS } from '../src/services/chessPro.service';
import { PointsManager } from '../src/utils/pointsManager';

async function runChessProTests() {
  console.log('🧪 Starting Chess Pro & Stockfish Unit Tests...\n');

  // Test 1: Bot Configuration Checklist
  console.log('1. Testing 9 Bot Levels Configuration:');
  if (CHESS_BOTS.length !== 9) {
    throw new Error(`Expected 9 bots, got ${CHESS_BOTS.length}`);
  }

  const expectedStakes = [50, 75, 100, 125, 150, 175, 200, 500, 1000];
  const expectedNames = ['Tonah', "Pe'i", 'Juned', "To'ip", "Su'eb", 'Keting', 'Gudal', 'Petoak', 'Messi'];

  CHESS_BOTS.forEach((bot, idx) => {
    if (bot.level !== idx) throw new Error(`Bot index ${idx} has incorrect level ${bot.level}`);
    if (bot.name !== expectedNames[idx]) throw new Error(`Bot ${idx} expected name ${expectedNames[idx]}, got ${bot.name}`);
    if (bot.stake !== expectedStakes[idx]) throw new Error(`Bot ${idx} expected stake ${expectedStakes[idx]}, got ${bot.stake}`);
    console.log(`   ✓ Level ${bot.level}: ${bot.name} (${bot.className}) - ±${bot.stake} Poin (Elo ~${bot.eloEst})`);
  });

  // Test 2: Starting match with Level 0 (Tonah)
  console.log('\n2. Testing Start Match:');
  const testUserId = 'test_user_chess_123';
  const testUsername = 'pemain_catur_warkop';

  // Set user initial points to 0
  PointsManager.setPoints(testUsername, 0, true);
  PointsManager.setPoints(testUserId, 0, true);
  console.log(`   Initial points set to: ${PointsManager.getPoints(testUsername)}`);

  const startRes = await ChessProService.startMatch({
    userId: testUserId,
    username: testUsername,
    botLevel: 0,
    userColor: 'white',
  });

  if (!startRes.success || !startRes.match_id) {
    throw new Error('Failed to start chess pro match');
  }
  if (startRes.bot_info.name !== 'Tonah' || startRes.stake !== 50) {
    throw new Error(`Unexpected bot info: ${JSON.stringify(startRes.bot_info)}`);
  }
  console.log(`   ✓ Match started successfully (ID: ${startRes.match_id}) against ${startRes.bot_info.name}`);

  // Test 3: CRITICAL REQUIREMENT - User loses at Level 0, points become -50!
  console.log('\n3. Testing Negative Points on Loss (Level 0 Tonah, Stake 50):');
  const finishLoseRes = await ChessProService.finishMatch({
    matchId: startRes.match_id,
    userId: testUserId,
    username: testUsername,
    result: 'lose',
    durationSec: 45,
  });

  if (finishLoseRes.points_changed !== -50) {
    throw new Error(`Expected points_changed to be -50, got ${finishLoseRes.points_changed}`);
  }
  if (finishLoseRes.user_points_after !== -50) {
    throw new Error(`Expected user_points_after to be -50, got ${finishLoseRes.user_points_after}`);
  }
  if (!finishLoseRes.is_negative) {
    throw new Error('Expected is_negative to be true when balance is -50');
  }
  if (!finishLoseRes.warning_message?.includes('-50')) {
    throw new Error(`Expected warning message to mention -50, got ${finishLoseRes.warning_message}`);
  }
  console.log(`   ✓ User lost! Points changed: ${finishLoseRes.points_changed}`);
  console.log(`   ✓ User balance is now NEGATIVE: ${finishLoseRes.user_points_after} Poin`);
  console.log(`   ✓ Warning message: "${finishLoseRes.warning_message}"`);

  // Test 4: User recovers points by winning against Level 1 (Pe'i, Stake 75)
  console.log('\n4. Testing Points Recovery on Win (Level 1 Pe\'i, Stake 75):');
  const match2 = await ChessProService.startMatch({
    userId: testUserId,
    username: testUsername,
    botLevel: 1,
    userColor: 'white',
  });

  const finishWinRes = await ChessProService.finishMatch({
    matchId: match2.match_id,
    userId: testUserId,
    username: testUsername,
    result: 'win',
    durationSec: 120,
  });

  if (finishWinRes.points_changed !== 75) {
    throw new Error(`Expected points_changed to be +75, got ${finishWinRes.points_changed}`);
  }
  // -50 + 75 = 25
  if (finishWinRes.user_points_after !== 25) {
    throw new Error(`Expected user_points_after to be 25 (-50 + 75), got ${finishWinRes.user_points_after}`);
  }
  if (finishWinRes.is_negative) {
    throw new Error('Expected is_negative to be false when balance is +25');
  }
  console.log(`   ✓ User won! Points changed: +${finishWinRes.points_changed}`);
  console.log(`   ✓ User balance recovered to POSITIVE: ${finishWinRes.user_points_after} Poin`);

  // Test 5: Stockfish / Bot Move Engine Execution
  console.log('\n5. Testing Stockfish Bot Move Generation:');
  const match3 = await ChessProService.startMatch({
    userId: testUserId,
    username: testUsername,
    botLevel: 0,
    userColor: 'white',
  });

  // Play e2e4
  const moveRes = await ChessProService.handleMove({
    matchId: match3.match_id,
    userId: testUserId,
    username: testUsername,
    move: { from: 'e2', to: 'e4' },
  });

  if (!moveRes.success || !moveRes.bot_move) {
    throw new Error('Expected valid bot response move');
  }
  console.log(`   ✓ User move: e2e4 (${moveRes.user_move?.san})`);
  console.log(`   ✓ Bot move: ${moveRes.bot_move.from}${moveRes.bot_move.to} (${moveRes.bot_move.san})`);
  console.log(`   ✓ Bot comment: "${moveRes.bot_comment}"`);
  console.log(`   ✓ Updated FEN: ${moveRes.fen}`);

  console.log('\n🎉 ALL CHESS PRO TESTS PASSED SUCCESSFULLY!\n');
}

runChessProTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
