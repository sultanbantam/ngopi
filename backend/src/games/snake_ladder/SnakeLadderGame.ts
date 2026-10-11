import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GameResult, GamePlayerInfo } from '../engine/types';
import { SnakeLadderGameState, SnakeLadderPlayerState } from './types';
import { SnakeLadderBoard } from './SnakeLadderBoard';

export class SnakeLadderGame extends BaseGame {
  readonly gameType = 'snake_ladder';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  protected override state!: SnakeLadderGameState;

  constructor(players: GamePlayerInfo[], config?: any) {
    super(players, config);
  }

  public initializeState(_config: any): SnakeLadderGameState {
    const playerStates: Record<string, SnakeLadderPlayerState> = {};
    const turnOrder = this.players.map((p) => p.user_id);

    for (const p of this.players) {
      playerStates[p.user_id] = {
        userId: p.user_id,
        position: 1, // Memulai dari kotak 1
        previousPosition: 1,
        lastRoll: null,
        movesCount: 0,
      };
    }

    return {
      boardSize: SnakeLadderBoard.TOTAL_CELLS,
      currentTurn: turnOrder[0] || '',
      turnOrder,
      players: playerStates,
      ladders: SnakeLadderBoard.LADDERS,
      snakes: SnakeLadderBoard.SNAKES,
      lastAction: null,
      isFinished: false,
      winnerId: null,
    };
  }

  public handleAction(userId: string, action: string, _payload: any): ActionResult {
    if (this.state.isFinished) {
      return { success: false, error: 'Permainan sudah selesai.' };
    }

    if (this.state.currentTurn !== userId) {
      return { success: false, error: 'Bukan giliran Anda untuk melempar dadu!' };
    }

    if (action === 'roll') {
      const player = this.state.players[userId];
      if (!player) {
        return { success: false, error: 'Pemain tidak ditemukan di meja ini.' };
      }

      // Lempar dadu via server (Server-Authoritative Anti-Cheat)
      const roll = SnakeLadderBoard.rollDice();
      const moveResult = SnakeLadderBoard.calculateMove(player.position, roll);

      player.previousPosition = player.position;
      player.position = moveResult.finalPos;
      player.lastRoll = roll;
      player.movesCount += 1;

      const playerName = this.players.find((p) => p.user_id === userId)?.display_name || 'Pemain';

      this.state.lastAction = {
        userId,
        roll,
        from: player.previousPosition,
        to: moveResult.targetPos,
        transitionType: moveResult.transitionType,
        finalPosition: moveResult.finalPos,
        message: `${playerName} melempar dadu [${roll}]. ${moveResult.message}`,
      };

      // Cek apakah mencapai kemenangan (kotak 100)
      if (player.position === SnakeLadderBoard.TOTAL_CELLS) {
        this.state.isFinished = true;
        this.state.winnerId = userId;

        const results = this.getResults();
        return {
          success: true,
          action: 'roll',
          data: {
            roll,
            moveResult,
            playerState: player,
            lastAction: this.state.lastAction,
          },
          finished: true,
          results,
        };
      }

      // Aturan giliran: jika dapat angka 6, dapat bonus 1 kali lempar lagi!
      const getsBonusRoll = roll === 6;
      if (!getsBonusRoll) {
        this.advanceTurn();
      } else {
        this.state.lastAction.message += ` (Dadu 6! Mendapat kesempatan melempar lagi 🎲)`;
      }

      return {
        success: true,
        action: 'roll',
        data: {
          roll,
          moveResult,
          playerState: player,
          lastAction: this.state.lastAction,
          bonusRoll: getsBonusRoll,
        },
        nextTurn: this.state.currentTurn,
      };
    }

    return { success: false, error: `Aksi "${action}" tidak dikenal di Ular Tangga.` };
  }

  private advanceTurn(): void {
    const currentIdx = this.state.turnOrder.indexOf(this.state.currentTurn);
    const nextIdx = (currentIdx + 1) % this.state.turnOrder.length;
    this.state.currentTurn = this.state.turnOrder[nextIdx] || '';
  }

  public getValidMoves(userId: string): any[] {
    if (this.state.isFinished || this.state.currentTurn !== userId) return [];
    return [{ action: 'roll' }];
  }

  public handleTimeout(userId: string): ActionResult {
    // Timeout auto-rolls the dice so game never gets stuck
    return this.handleAction(userId, 'roll', {});
  }

  public getBotAction(userId: string): { action: string; payload: any } | null {
    if (this.state.isFinished || this.state.currentTurn !== userId) return null;
    return { action: 'roll', payload: {} };
  }

  public isFinished(): boolean {
    return this.state.isFinished;
  }

  public getStateForPlayer(userId: string): any {
    return {
      gameType: 'snake_ladder',
      boardSize: this.state.boardSize,
      currentTurn: this.state.currentTurn,
      turnOrder: this.state.turnOrder,
      players: this.state.players,
      ladders: this.state.ladders,
      snakes: this.state.snakes,
      lastAction: this.state.lastAction,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      isMyTurn: this.state.currentTurn === userId,
    };
  }

  public getStateForSpectator(): any {
    return {
      gameType: 'snake_ladder',
      boardSize: this.state.boardSize,
      currentTurn: this.state.currentTurn,
      turnOrder: this.state.turnOrder,
      players: this.state.players,
      ladders: this.state.ladders,
      snakes: this.state.snakes,
      lastAction: this.state.lastAction,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      isMyTurn: false,
    };
  }

  public getResults(): GameResult {
    const winnerId = this.state.winnerId || this.players[0]?.user_id || '';
    const losers = this.players.map((p) => p.user_id).filter((id) => id !== winnerId);

    const scores: Record<string, number> = {};
    for (const p of this.players) {
      scores[p.user_id] = this.state.players[p.user_id]?.position || 1;
    }

    const winnerName = this.players.find((p) => p.user_id === winnerId)?.display_name || 'Pemain';

    return {
      winners: [winnerId],
      losers,
      scores,
      summary: `🎉 ${winnerName} berhasil mencapai puncak kotak 100 dan memenangkan Ular Tangga Warkop!`,
      pointsAwarded: 50,
    };
  }

  public override replacePlayer(oldUserId: string, newPlayer: GamePlayerInfo): boolean {
    const playerIdx = this.players.findIndex((p) => p.user_id === oldUserId);
    if (playerIdx === -1) return false;

    this.players[playerIdx] = newPlayer;

    const turnIdx = this.state.turnOrder.indexOf(oldUserId);
    if (turnIdx !== -1) {
      this.state.turnOrder[turnIdx] = newPlayer.user_id;
    }

    if (this.state.currentTurn === oldUserId) {
      this.state.currentTurn = newPlayer.user_id;
    }

    if (this.state.players[oldUserId]) {
      const existing = this.state.players[oldUserId]!;
      delete this.state.players[oldUserId];
      this.state.players[newPlayer.user_id] = {
        ...existing,
        userId: newPlayer.user_id,
      };
    }

    return true;
  }
}
