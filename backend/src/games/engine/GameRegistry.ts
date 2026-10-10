import { BaseGame } from './BaseGame';
import { GamePlayerInfo, GameType } from './types';

export type GameConstructor = new (players: GamePlayerInfo[], config: any) => BaseGame;

export class GameRegistry {
  private static games = new Map<string, GameConstructor>();

  public static register(gameType: string, gameClass: GameConstructor): void {
    this.games.set(gameType.toLowerCase(), gameClass);
  }

  public static create(gameType: string, players: GamePlayerInfo[], config: any): BaseGame {
    const GameClass = this.games.get(gameType.toLowerCase());
    if (!GameClass) {
      throw new Error(`Permainan jenis "${gameType}" belum terdaftar di GameRegistry.`);
    }
    return new GameClass(players, config);
  }

  public static has(gameType: string): boolean {
    return this.games.has(gameType.toLowerCase());
  }

  public static getSupportedGames(): string[] {
    return Array.from(this.games.keys());
  }
}
