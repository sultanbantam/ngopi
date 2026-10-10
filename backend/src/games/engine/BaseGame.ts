import { ActionResult, GamePlayerInfo, GameResult } from './types';

export abstract class BaseGame {
  abstract readonly gameType: string;
  abstract readonly minPlayers: number;
  abstract readonly maxPlayers: number;

  protected state: any;
  protected players: GamePlayerInfo[];

  constructor(players: GamePlayerInfo[], config: any) {
    this.players = players;
    this.state = this.initializeState(config);
  }

  abstract initializeState(config: any): any;
  abstract handleAction(userId: string, action: string, payload: any): ActionResult;
  abstract getStateForPlayer(userId: string): any; // Hides secret cards from opponents
  abstract getStateForSpectator(): any; // Spectator view (God view or public view)
  abstract isFinished(): boolean;
  abstract getResults(): GameResult;
  abstract getValidMoves(userId: string): any[];
  abstract handleTimeout(userId: string): ActionResult;
  abstract getBotAction?(userId: string): { action: string; payload: any } | null;

  public getRawState(): any {
    return this.state;
  }

  public getPlayers(): GamePlayerInfo[] {
    return this.players;
  }

  // Helper: check if it's currently the player's turn
  protected isPlayerTurn(userId: string): boolean {
    return this.state?.currentTurn === userId;
  }
}
