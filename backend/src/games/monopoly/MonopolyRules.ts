import { MonopolyBoard } from './MonopolyBoard';
import { MonopolyCard, MonopolyGameState, MonopolyPlayerState } from './types';

export class MonopolyRules {
  public static readonly STARTING_MONEY = 1500;
  public static readonly PASS_START_BONUS = 200;
  public static readonly JAIL_FINE = 50;

  public static doesPlayerOwnAllInGroup(
    state: MonopolyGameState,
    userId: string,
    group: string
  ): boolean {
    const groupSquares = MonopolyBoard.getGroupSquares(group);
    if (groupSquares.length === 0) return false;

    return groupSquares.every((sq) => {
      const prop = state.properties[sq.id];
      return prop && prop.ownerId === userId;
    });
  }

  public static getPlayerOwnedStationsCount(state: MonopolyGameState, userId: string): number {
    const stations = MonopolyBoard.getGroupSquares('station');
    return stations.filter((sq) => state.properties[sq.id]?.ownerId === userId).length;
  }

  public static checkBankrupt(player: MonopolyPlayerState, neededAmount: number): boolean {
    return player.money < neededAmount;
  }

  public static canBuildHouse(state: MonopolyGameState, userId: string, squareId: number): {
    canBuild: boolean;
    reason?: string;
  } {
    const square = MonopolyBoard.getSquare(squareId);
    if (square.type !== 'property' || !square.group) {
      return { canBuild: false, reason: 'Petak ini bukan properti yang bisa dibangun.' };
    }

    const prop = state.properties[squareId];
    if (!prop || prop.ownerId !== userId) {
      return { canBuild: false, reason: 'Anda bukan pemilik properti ini.' };
    }

    if (!this.doesPlayerOwnAllInGroup(state, userId, square.group)) {
      return { canBuild: false, reason: 'Anda harus memiliki semua properti dalam kelompok warna ini.' };
    }

    if (prop.houses >= 5) {
      return { canBuild: false, reason: 'Properti ini sudah memiliki Hotel (maksimal).' };
    }

    const cost = square.houseCost || 100;
    const player = state.players[userId];
    if (!player || player.money < cost) {
      return { canBuild: false, reason: `Uang Anda tidak cukup (butuh Rp ${cost}).` };
    }

    return { canBuild: true };
  }
}
