import { BaseGame } from './BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from './types';

export class GenericWarkopGame extends BaseGame {
  readonly gameType: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  constructor(players: GamePlayerInfo[], config: any, gameType = 'generic', minP = 2, maxP = 4) {
    super(players, config);
    this.gameType = gameType;
    this.minPlayers = minP;
    this.maxPlayers = maxP;
  }

  public initializeState(config: any): any {
    const playerOrder = this.players.map((p) => p.user_id);
    const scores: Record<string, number> = {};
    for (const p of this.players) {
      scores[p.user_id] = 0;
    }

    return {
      gameType: config?.gameType || 'generic',
      playerOrder,
      currentTurn: playerOrder[0] || '',
      turnNumber: 1,
      scores,
      status: 'playing',
      winner: null,
      history: [],
      boardData: {
        round: 1,
        activeStones: 7,
        cueBallPosition: { x: 50, y: 50 },
        tilesRemaining: 136,
      },
    };
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.status === 'finished') {
      return { success: false, error: 'Permainan telah selesai.' };
    }

    if (this.state.currentTurn !== userId) {
      return { success: false, error: 'Bukan giliran Anda!' };
    }

    const curScore = this.state.scores[userId] || 0;
    const gained = Math.floor(Math.random() * 10) + 5;
    this.state.scores[userId] = curScore + gained;
    this.state.history.push({
      userId,
      action,
      payload,
      timestamp: Date.now(),
      score: this.state.scores[userId],
    });

    // Check winning threshold (e.g., reaches 50 points or 10 turns)
    if (this.state.scores[userId] >= 50 || this.state.turnNumber >= 20) {
      this.state.status = 'finished';
      this.state.winner = userId;
      return {
        success: true,
        finished: true,
        results: this.getResults(),
      };
    }

    // Pass turn to next player
    const curIdx = this.state.playerOrder.indexOf(userId);
    const nextIdx = (curIdx + 1) % this.state.playerOrder.length;
    this.state.currentTurn = this.state.playerOrder[nextIdx];
    this.state.turnNumber += 1;

    return {
      success: true,
      action,
      data: { score: this.state.scores[userId], currentTurn: this.state.currentTurn },
      nextTurn: this.state.currentTurn,
    };
  }

  public getStateForPlayer(userId: string): any {
    return {
      ...this.state,
      isMyTurn: this.state.currentTurn === userId,
      myScore: this.state.scores[userId] || 0,
    };
  }

  public getStateForSpectator(): any {
    return this.state;
  }

  public isFinished(): boolean {
    return this.state.status === 'finished';
  }

  public getResults(): GameResult {
    const sorted = [...this.players].sort((a, b) => {
      const sA = this.state.scores[a.user_id] || 0;
      const sB = this.state.scores[b.user_id] || 0;
      return sB - sA;
    });

    const winnerId = this.state.winner || sorted[0]?.user_id || '';
    const losers = this.players.filter((p) => p.user_id !== winnerId).map((p) => p.user_id);

    return {
      winners: [winnerId],
      losers,
      scores: this.state.scores,
      pointsAwarded: 50,
      summary: `Pertandingan ${this.gameType.toUpperCase()} Selesai!`,
    };
  }

  public getValidMoves(_userId: string): any[] {
    return ['play', 'strike', 'move', 'take'];
  }

  public handleTimeout(userId: string): ActionResult {
    return this.handleAction(userId, 'pass', {});
  }

  public getBotAction(userId: string): { action: string; payload: any } | null {
    if (this.state.currentTurn !== userId) return null;
    return { action: 'play', payload: { power: 75, angle: 45 } };
  }
}

export class MahyongGame extends GenericWarkopGame {
  constructor(players: GamePlayerInfo[], config: any) {
    super(players, config, 'mahyong', 2, 4);
  }
}

export class HalmaGame extends GenericWarkopGame {
  constructor(players: GamePlayerInfo[], config: any) {
    super(players, config, 'halma', 2, 4);
  }
}

export class DakuGame extends GenericWarkopGame {
  constructor(players: GamePlayerInfo[], config: any) {
    super(players, config, 'daku', 2, 2);
  }
}

export class KarambolGame extends GenericWarkopGame {
  constructor(players: GamePlayerInfo[], config: any) {
    super(players, config, 'karambol', 2, 4);
  }
}

export class BilliardGame extends GenericWarkopGame {
  constructor(players: GamePlayerInfo[], config: any) {
    super(players, config, 'billiard', 2, 2);
  }
}
