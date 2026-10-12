import { PokemonCatalog } from '../src/games/pokemon/PokemonCatalog';
import { PokemonRules } from '../src/games/pokemon/PokemonRules';
import { PokemonGame } from '../src/games/pokemon/PokemonGame';
import { PokemonService } from '../src/services/pokemon.service';
import { GamePlayerInfo } from '../src/games/engine/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✅ PASS: ${msg}`);
}

console.log('--- RUNNING SPRINT 4: POKEMON (KARTU KOLEKSI & BATTLE) UNIT TESTS ---');

// ==========================================
// 1. CATALOG & CARD INTEGRITY
// ==========================================
const catalog = PokemonCatalog.getAll();
assert(catalog.length === 18, 'Catalog has exactly 18 unique original creatures');
assert(catalog.filter((c) => c.rarity === 'common').length === 6, 'Has 6 common creatures');
assert(catalog.filter((c) => c.rarity === 'rare').length === 6, 'Has 6 rare creatures');
assert(catalog.filter((c) => c.rarity === 'epic').length === 4, 'Has 4 epic creatures');
assert(catalog.filter((c) => c.rarity === 'legendary').length === 2, 'Has 2 legendary creatures');

const kelinci = PokemonCatalog.getById('pk_01');
assert(kelinci?.name === 'Kelinci Petir', 'pk_01 is Kelinci Petir');
assert(kelinci?.type === 'electric', 'Kelinci Petir is electric type');

// ==========================================
// 2. CARD INSTANCE & SHINY MECHANIC
// ==========================================
const normalCard = PokemonCatalog.createInstance('pk_01', false);
const shinyCard = PokemonCatalog.createInstance('pk_01', true);
assert(normalCard.maxHp === kelinci!.hp, 'Normal card has base HP');
assert(shinyCard.isShiny === true, 'Shiny flag is true');
assert(shinyCard.maxHp > normalCard.maxHp, 'Shiny card has 10% bonus HP');
assert(shinyCard.attack > normalCard.attack, 'Shiny card has 10% bonus attack');

// ==========================================
// 3. STARTER TEAM & BOOSTER PACK RNG
// ==========================================
const starter = PokemonCatalog.getStarterTeam();
assert(starter.length === 3, 'Starter team has 3 cards');
assert(starter[0]?.type === 'fire', 'Starter has Fire creature');
assert(starter[1]?.type === 'water', 'Starter has Water creature');
assert(starter[2]?.type === 'electric', 'Starter has Electric creature');

const pack = PokemonCatalog.openBoosterPack();
assert(pack.length === 3, 'Booster pack yields 3 cards');
assert(pack.every((c) => c.maxHp > 0 && c.attack > 0), 'All booster cards have valid stats');

// ==========================================
// 4. ELEMENTAL ADVANTAGE RULES
// ==========================================
// Fire > Grass
assert(PokemonRules.getElementalMultiplier('fire', 'grass').multiplier === 1.5, 'Fire vs Grass is 1.5x super effective');
assert(PokemonRules.getElementalMultiplier('fire', 'grass').effectiveness === 'super', 'Effectiveness is super');

// Water > Fire
assert(PokemonRules.getElementalMultiplier('water', 'fire').multiplier === 1.5, 'Water vs Fire is 1.5x super effective');

// Grass < Fire (Weak)
assert(PokemonRules.getElementalMultiplier('grass', 'fire').multiplier === 0.7, 'Grass vs Fire is 0.7x weak');

// Same element
assert(PokemonRules.getElementalMultiplier('water', 'water').multiplier === 1.0, 'Water vs Water is 1.0x neutral');

// Psychic vs Earth
assert(PokemonRules.getElementalMultiplier('psychic', 'earth').multiplier === 1.5, 'Psychic penetrates Earth defense');

// ==========================================
// 5. DAMAGE CALCULATION FORMULA
// ==========================================
const fireMon = PokemonCatalog.createInstance('pk_05'); // Kucing Bara (Fire)
const grassMon = PokemonCatalog.createInstance('pk_02'); // Merpati Angin (Grass)

const normalDmg = PokemonRules.calculateDamage(fireMon, grassMon, false);
const skillDmg = PokemonRules.calculateDamage(fireMon, grassMon, true);

assert(normalDmg.damage > 0, 'Normal damage > 0');
assert(normalDmg.effectiveness === 'super', 'Fire vs Grass damage is super effective');
assert(skillDmg.damage > normalDmg.damage, 'Skill damage is higher than normal attack');

// ==========================================
// 6. POKEMON BATTLE ENGINE (PokemonGame)
// ==========================================
const p1: GamePlayerInfo = {
  id: 'p1',
  user_id: 'user_ash',
  username: 'AshKetchum',
  display_name: 'Ash',
  seat_number: 0,
  is_ready: true,
  is_active: true,
};

const p2: GamePlayerInfo = {
  id: 'p2',
  user_id: 'user_gary',
  username: 'GaryOak',
  display_name: 'Gary',
  seat_number: 1,
  is_ready: true,
  is_active: true,
};

const battle = new PokemonGame([p1, p2], { turnTimeLimitSec: 30 });
const state = battle.getStateForPlayer('user_ash');

assert(state.status === 'in_progress', 'Battle is in_progress');
assert(state.playerOrder.length === 2, 'Battle has 2 players');
assert(state.currentTurn === 'user_ash', 'First turn is user_ash');
assert(state.players['user_ash'].team.length === 3, 'Ash has 3 monsters');
assert(state.players['user_gary'].team.length === 3, 'Gary has 3 monsters');
assert(state.players['user_ash'].activeIndex === 0, 'Ash active index is 0');

// Wrong turn rejection
const wrongTurnRes = battle.handleAction('user_gary', 'attack', {});
assert(wrongTurnRes.success === false, 'Action rejected when not player turn');

// Player 1 attacks Player 2
const garyActiveMonBefore = state.players['user_gary'].team[0];
const initialGaryHp = garyActiveMonBefore.currentHp;

const attackRes = battle.handleAction('user_ash', 'attack', {});
assert(attackRes.success === true, 'Ash attack executed successfully');
assert(garyActiveMonBefore.currentHp < initialGaryHp, 'Gary active monster took damage');
assert(battle.getStateForPlayer('user_gary').currentTurn === 'user_gary', 'Turn passed to Gary');

// Gary counters with skill
const ashActiveMonBefore = state.players['user_ash'].team[0];
const initialAshHp = ashActiveMonBefore.currentHp;

const skillRes = battle.handleAction('user_gary', 'skill', {});
assert(skillRes.success === true, 'Gary skill attack executed successfully');
assert(ashActiveMonBefore.currentHp < initialAshHp, 'Ash active monster took skill damage');
assert(battle.getStateForPlayer('user_ash').currentTurn === 'user_ash', 'Turn passed back to Ash');

// ==========================================
// 7. MONSTER SWITCH MECHANIC
// ==========================================
// Cannot switch to current active monster (index 0)
const invalidSwitch = battle.handleAction('user_ash', 'switch', { index: 0 });
assert(invalidSwitch.success === false, 'Cannot switch to currently active monster');

// Switch to bench monster (index 1)
const validSwitch = battle.handleAction('user_ash', 'switch', { index: 1 });
assert(validSwitch.success === true, 'Ash successfully switched to bench monster 1');
assert(battle.getStateForPlayer('user_ash').players['user_ash'].activeIndex === 1, 'Ash active index updated to 1');

// ==========================================
// 8. KNOCKOUT & AUTO-SWITCH / VICTORY MECHANIC
// ==========================================
// Create game where opponent monster has 5 HP
const pBot: GamePlayerInfo = {
  id: 'p_bot',
  user_id: 'bot_oak',
  username: 'Prof Oak Bot',
  display_name: 'Prof Oak Bot',
  seat_number: 1,
  is_ready: true,
  is_active: true,
  is_bot: true,
};

const customTeamGary = [
  { ...PokemonCatalog.createInstance('pk_01'), currentHp: 5 },
  { ...PokemonCatalog.createInstance('pk_02'), currentHp: 5 },
  { ...PokemonCatalog.createInstance('pk_03'), currentHp: 5 },
];

const koBattle = new PokemonGame([p1, pBot], {
  customTeams: {
    bot_oak: customTeamGary,
  },
});

// Ash attacks first weak monster -> knock out
const koRes1 = koBattle.handleAction('user_ash', 'skill', {});
assert(koRes1.success === true, 'Ash knocked out Oak first monster');
const oakStateAfterKO1 = koBattle.getStateForPlayer('user_ash').players['bot_oak'];
assert(oakStateAfterKO1.team[0].isFainted === true, 'Oak first monster is fainted');
assert(oakStateAfterKO1.activeIndex === 1, 'Oak auto-switched to second monster');

// Oak's turn -> Oak attacks
const oakTurn1 = koBattle.handleAction('bot_oak', 'attack', {});
assert(oakTurn1.success === true, 'Oak took turn after switch');

// Ash attacks second weak monster -> knock out
const koRes2 = koBattle.handleAction('user_ash', 'skill', {});
assert(koRes2.success === true, 'Ash attacked Oak second monster');
const oakStateAfterKO2 = koBattle.getStateForPlayer('user_ash').players['bot_oak'];
assert(oakStateAfterKO2.team[1].isFainted === true, 'Oak second monster is fainted');
assert(oakStateAfterKO2.activeIndex === 2, 'Oak auto-switched to third monster');

// Oak's turn -> Oak attacks
const oakTurn2 = koBattle.handleAction('bot_oak', 'attack', {});
assert(oakTurn2.success === true, 'Oak took second turn');

// Ash attacks third and final monster -> Match finishes with Ash Victory
const finalKORes = koBattle.handleAction('user_ash', 'skill', {});
assert(finalKORes.finished === true, 'Match finished after all 3 monsters fainted');
assert(finalKORes.results?.winners.includes('user_ash') === true, 'Ash is declared winner');
assert(finalKORes.results?.pointsAwarded === 50, 'Winner awarded 50 points');

// ==========================================
// 9. BOT AI DECISION MAKING
// ==========================================
const botBattle = new PokemonGame([pBot, p1], {});
const botAction = botBattle.determineBotAction('bot_oak');
assert(botAction !== null, 'Bot generates autonomous action');
assert(botAction?.action === 'skill' || botAction?.action === 'attack', 'Bot chooses skill or attack move');

// ==========================================
// 10. POKEMON SERVICE: COLLECTION, GACHA & TRADING
// ==========================================
const testUser = 'user_test_tcg_' + Date.now();
const collectionData = PokemonService.getUserCollection(testUser, 'Tester');
assert(collectionData.cards.length === 3, 'New user receives 3 starter cards');

// Open booster pack
const packResult = PokemonService.openBoosterPack(testUser, 'Tester');
assert(packResult.success === true, 'User opens booster pack');
assert(packResult.cards?.length === 3, 'Booster pack returns 3 cards');

const updatedCollection = PokemonService.getUserCollection(testUser, 'Tester');
const totalCardsCount = updatedCollection.cards.reduce((sum, c) => sum + (c.quantity || 1), 0);
assert(totalCardsCount >= 6, 'Collection expanded after booster pack');

// Trade flow
const testTrader = 'user_trader_' + Date.now();
PokemonService.getUserCollection(testTrader, 'Trader');

const offerCardId = updatedCollection.cards[0]!.defId;
const tradeRes = PokemonService.createTrade(testUser, 'Tester', [offerCardId], ['pk_01']);
assert(tradeRes.success === true, 'Trade offer created successfully');
assert(tradeRes.trade?.status === 'pending', 'Trade status is pending');

// Respond: cancel by initiator
const cancelRes = PokemonService.respondTrade(tradeRes.trade!.id, testUser, false);
assert(cancelRes.success === true, 'Initiator can cancel trade');
assert(cancelRes.trade?.status === 'cancelled', 'Trade status updated to cancelled');

console.log('--- ALL SPRINT 4 POKEMON TESTS PASSED SUCCESSFULLY! (100% PASS) ---');
