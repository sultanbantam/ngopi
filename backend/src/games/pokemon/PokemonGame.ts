import crypto from 'crypto';
import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { PokemonCatalog } from './PokemonCatalog';
import { PokemonRules } from './PokemonRules';
import {
  PokemonBattleLogEntry,
  PokemonCardInstance,
  PokemonGameState,
  PokemonPlayerState,
} from './types';

export class PokemonGame extends BaseGame {
  readonly gameType = 'pokemon';
  readonly minPlayers = 2;
  readonly maxPlayers = 2;

  protected declare state: PokemonGameState;

  constructor(players: GamePlayerInfo[], config?: any) {
    super(players, config);
  }

  public initializeState(config: any): PokemonGameState {
    const effectivePlayers = this.players.slice(0, 2);
    const playerOrder = effectivePlayers.map((p) => p.user_id);
    const playersMap: Record<string, PokemonPlayerState> = {};

    for (const p of effectivePlayers) {
      // Check if custom team passed in config
      let team: PokemonCardInstance[] = [];
      if (config?.customTeams?.[p.user_id] && Array.isArray(config.customTeams[p.user_id])) {
        team = config.customTeams[p.user_id].slice(0, 3);
      }

      // Fallback: If not enough cards, grant starter team or randomized starter
      if (team.length < 3) {
        team = PokemonCatalog.getStarterTeam();
      }

      playersMap[p.user_id] = {
        userId: p.user_id,
        username: p.display_name || p.username || 'Pelatih',
        team,
        activeIndex: 0,
        isReady: true,
      };
    }

    const firstPlayerId = playerOrder[0] || '';
    const initialTurnDeadline = Date.now() + (config?.turnTimeLimitSec || 30) * 1000;

    return {
      players: playersMap,
      playerOrder,
      currentTurn: firstPlayerId,
      turnNumber: 1,
      turnDeadline: initialTurnDeadline,
      status: 'in_progress',
      winner: null,
      battleLog: [
        {
          id: `log_${Date.now()}`,
          turn: 1,
          actorId: 'system',
          actorName: 'Wasit Warkop',
          action: 'victory',
          message: 'Pertarungan Kartu Monster dimulai! Silakan pilih aksi.',
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.status === 'finished') {
      return { success: false, error: 'Pertandingan sudah selesai.' };
    }

    if (this.state.currentTurn !== userId) {
      return { success: false, error: 'Bukan giliran Anda!' };
    }

    const player = this.state.players[userId];
    const opponentId = this.state.playerOrder.find((id) => id !== userId);
    const opponent = opponentId ? this.state.players[opponentId] : null;

    if (!player || !opponent) {
      return { success: false, error: 'Data pemain tidak lengkap.' };
    }

    const activeMonster = player.team[player.activeIndex];
    const opponentMonster = opponent.team[opponent.activeIndex];

    if (!activeMonster || activeMonster.isFainted || activeMonster.currentHp <= 0) {
      // Force switch if active monster is already fainted
      if (action !== 'switch') {
        return { success: false, error: 'Monster aktif Anda pingsan! Silakan ganti monster.' };
      }
    }

    switch (action) {
      case 'attack':
      case 'skill': {
        const isSkill = action === 'skill';
        if (!opponentMonster || opponentMonster.isFainted) {
          return { success: false, error: 'Monster lawan tidak dapat diserang.' };
        }

        const calc = PokemonRules.calculateDamage(activeMonster, opponentMonster, isSkill);
        opponentMonster.currentHp = Math.max(0, opponentMonster.currentHp - calc.damage);

        const moveName = isSkill ? activeMonster.skillName : 'Serangan Cepat';
        let effectText = '';
        if (calc.effectiveness === 'super') effectText = ' (Super Efektif! 💥)';
        else if (calc.effectiveness === 'weak') effectText = ' (Kurang Efektif... 🛡️)';

        const logMsg = `${player.username} memerintahkan ${activeMonster.name} menggunakan ${moveName}! Menghasilkan ${calc.damage} damage${effectText}.`;
        this.addLog(userId, player.username, action, logMsg, calc.damage, calc.effectiveness);

        // Check if opponent monster fainted
        if (opponentMonster.currentHp <= 0) {
          opponentMonster.isFainted = true;
          this.addLog(opponent.userId, opponent.username, 'faint', `💀 ${opponentMonster.name} milik ${opponent.username} pingsan!`);

          // Check if opponent team completely defeated
          if (PokemonRules.isTeamDefeated(opponent.team)) {
            return this.finishGame(userId, `${player.username} memenangkan pertarungan dengan mengalahkan seluruh monster lawan!`);
          }

          // Auto-switch opponent to next available monster
          const nextIdx = PokemonRules.getNextAvailableIndex(opponent.team);
          if (nextIdx !== null) {
            opponent.activeIndex = nextIdx;
            const newMonster = opponent.team[nextIdx];
            this.addLog(opponent.userId, opponent.username, 'switch', `🔄 ${opponent.username} menurunkan ${newMonster?.name}!`);
          }
        }

        this.passTurn();
        return {
          success: true,
          action,
          data: {
            damage: calc.damage,
            effectiveness: calc.effectiveness,
            opponentHp: opponentMonster.currentHp,
          },
          nextTurn: this.state.currentTurn,
        };
      }

      case 'switch': {
        const targetIndex = typeof payload?.index === 'number' ? payload.index : -1;
        if (targetIndex < 0 || targetIndex >= player.team.length) {
          return { success: false, error: 'Indeks monster tidak valid.' };
        }

        if (targetIndex === player.activeIndex) {
          return { success: false, error: 'Monster tersebut sudah aktif di arena.' };
        }

        const targetMonster = player.team[targetIndex];
        if (!targetMonster || targetMonster.isFainted || targetMonster.currentHp <= 0) {
          return { success: false, error: 'Monster yang dipilih sudah pingsan.' };
        }

        player.activeIndex = targetIndex;
        const switchMsg = `🔄 ${player.username} menarik kembali monster dan menurunkan ${targetMonster.name} (${targetMonster.type.toUpperCase()})!`;
        this.addLog(userId, player.username, 'switch', switchMsg);

        this.passTurn();
        return {
          success: true,
          action: 'switch',
          data: { activeIndex: targetIndex, monster: targetMonster },
          nextTurn: this.state.currentTurn,
        };
      }

      case 'surrender': {
        return this.finishGame(opponent.userId, `${player.username} menyerah!`);
      }

      default:
        return { success: false, error: `Aksi ${action} tidak dikenal.` };
    }
  }

  private addLog(
    actorId: string,
    actorName: string,
    action: 'attack' | 'skill' | 'switch' | 'faint' | 'victory',
    message: string,
    damage?: number,
    effectiveness?: 'super' | 'weak' | 'normal'
  ) {
    const entry: PokemonBattleLogEntry = {
      id: `log_${Date.now()}_${crypto.randomUUID().slice(0, 4)}`,
      turn: this.state.turnNumber,
      actorId,
      actorName,
      action,
      message,
      damage,
      effectiveness,
      timestamp: new Date().toISOString(),
    };
    this.state.battleLog.unshift(entry);
    if (this.state.battleLog.length > 50) this.state.battleLog.pop();

    this.state.lastAction = { actorId, action, message };
  }

  private passTurn() {
    const currentIndex = this.state.playerOrder.indexOf(this.state.currentTurn);
    const nextIndex = (currentIndex + 1) % this.state.playerOrder.length;
    this.state.currentTurn = this.state.playerOrder[nextIndex] || '';
    this.state.turnNumber += 1;
    this.state.turnDeadline = Date.now() + (this.config?.turnTimeLimitSec || 30) * 1000;
  }

  private finishGame(winnerId: string, summary: string): ActionResult {
    const loserId = this.state.playerOrder.find((id) => id !== winnerId) || '';
    this.state.status = 'finished';
    this.state.winner = winnerId;

    const winnerName = this.state.players[winnerId]?.username || 'Pemenang';
    this.addLog(winnerId, winnerName, 'victory', `🏆 ${summary}`);

    const results: GameResult = {
      winners: [winnerId],
      losers: loserId ? [loserId] : [],
      scores: {
        [winnerId]: 50,
        [loserId]: 10,
      },
      summary,
      pointsAwarded: 50,
    };

    return {
      success: true,
      finished: true,
      results,
      data: { winnerId, summary },
    };
  }

  public getStateForPlayer(userId: string): any {
    // Both players can see arena cards and bench HP for fair tactical play
    return {
      ...this.state,
      isMyTurn: this.state.currentTurn === userId,
    };
  }

  public getSpectatorState(): any {
    return {
      ...this.state,
      isSpectator: true,
    };
  }

  public determineBotAction(botUserId: string): { action: string; payload: any } | null {
    if (this.state.currentTurn !== botUserId || this.state.status !== 'in_progress') {
      return null;
    }

    const bot = this.state.players[botUserId];
    const opponentId = this.state.playerOrder.find((id) => id !== botUserId);
    const opponent = opponentId ? this.state.players[opponentId] : null;

    if (!bot || !opponent) return null;

    const botMonster = bot.team[bot.activeIndex];
    const opponentMonster = opponent.team[opponent.activeIndex];

    if (!botMonster || botMonster.isFainted || botMonster.currentHp <= 0) {
      const nextIdx = PokemonRules.getNextAvailableIndex(bot.team);
      if (nextIdx !== null) {
        return { action: 'switch', payload: { index: nextIdx } };
      }
      return null;
    }

    // Check if bot active monster is in critical HP (< 30%) and bench has an advantaged creature
    if (botMonster.currentHp < botMonster.maxHp * 0.3 && opponentMonster) {
      for (let i = 0; i < bot.team.length; i++) {
        if (i !== bot.activeIndex) {
          const benchMon = bot.team[i];
          if (benchMon && !benchMon.isFainted && benchMon.currentHp > benchMon.maxHp * 0.5) {
            const { effectiveness } = PokemonRules.getElementalMultiplier(benchMon.type, opponentMonster.type);
            if (effectiveness === 'super') {
              return { action: 'switch', payload: { index: i } };
            }
          }
        }
      }
    }

    // Use skill if elemental advantage or every 2nd turn, otherwise regular attack
    if (opponentMonster) {
      const { effectiveness } = PokemonRules.getElementalMultiplier(botMonster.type, opponentMonster.type);
      if (effectiveness === 'super' || Math.random() < 0.6) {
        return { action: 'skill', payload: {} };
      }
    }

    return { action: 'attack', payload: {} };
  }

  public handleTimeout(): ActionResult | null {
    // Current player timed out -> auto surrender or pass turn
    const opponentId = this.state.playerOrder.find((id) => id !== this.state.currentTurn);
    if (!opponentId) return null;

    const timedOutPlayer = this.state.players[this.state.currentTurn];
    const msg = `${timedOutPlayer?.username || 'Pemain'} kehabisan waktu giliran!`;
    return this.finishGame(opponentId, msg);
  }
}
