import fs from 'fs';
import path from 'path';

export interface GameStatItem {
  name: string;
  icon: string;
  matches: number;
}

export interface TopGameDisplay {
  id: string;
  name: string;
  icon: string;
  matchesPlayed: number;
}

const GAME_STATS_FILE = path.join(__dirname, '../../uploads/warkop_game_stats.json');

export const DEFAULT_GAME_STATS: Record<string, GameStatItem> = {
  gapleh: { name: 'Gapleh Domino', icon: '🀥', matches: 124 },
  catur: { name: 'Catur Santai', icon: '♟️', matches: 86 },
  uno: { name: 'UNO Card Game', icon: '🎴', matches: 58 },
  snake_ladder: { name: 'Ular Tangga', icon: '🎲', matches: 49 },
  remi: { name: 'Remi Klasik', icon: '🃏', matches: 42 },
  monopoly: { name: 'Monopoli Warkop', icon: '🏠', matches: 36 },
  poker: { name: 'Poker Meja', icon: '♠️', matches: 31 },
  billiard: { name: 'Billiard 8-Ball', icon: '🎱', matches: 28 },
  pokemon: { name: 'Monster TCG', icon: '🎴', matches: 25 },
  karambol: { name: 'Karambol Warkop', icon: '⚪', matches: 22 },
  truf: { name: 'Truf Pekai', icon: '♦️', matches: 19 },
  daku: { name: 'Daku Congklak', icon: '🪵', matches: 18 },
  mahyong: { name: 'Mahjong Warkop', icon: '🀄', matches: 15 },
  halma: { name: 'Halma Bintang', icon: '🌟', matches: 14 },
  bridge: { name: 'Bridge Warkop', icon: '🌉', matches: 12 },
};

export class GameStatsService {
  private static loadStats(): Record<string, GameStatItem> {
    try {
      if (fs.existsSync(GAME_STATS_FILE)) {
        const raw = fs.readFileSync(GAME_STATS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // Merge with defaults to ensure all games exist
        return {
          ...DEFAULT_GAME_STATS,
          ...parsed,
        };
      }
    } catch (e) {
      console.warn(`Failed to read stats file ${GAME_STATS_FILE}:`, e);
    }
    return { ...DEFAULT_GAME_STATS };
  }

  private static saveStats(data: Record<string, GameStatItem>): void {
    try {
      const dir = path.dirname(GAME_STATS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(GAME_STATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`Failed to save stats file ${GAME_STATS_FILE}:`, e);
    }
  }

  public static recordGameMatch(gameType: string, count = 1): number {
    try {
      const current = this.loadStats();
      const key = (gameType || 'gapleh').toLowerCase().trim();
      const incrementBy = typeof count === 'number' && count > 0 ? count : 1;

      if (!current[key]) {
        const defaultInfo = DEFAULT_GAME_STATS[key] || {
          name: key.toUpperCase(),
          icon: '🎮',
          matches: 0,
        };
        current[key] = {
          ...defaultInfo,
          matches: (defaultInfo.matches || 0) + incrementBy,
        };
      } else {
        current[key].matches = (current[key].matches || 0) + incrementBy;
      }

      this.saveStats(current);
      return current[key].matches;
    } catch (e) {
      console.warn('Failed to record game match:', e);
      return 0;
    }
  }

  public static updateGameStats(stats: Record<string, number>): Record<string, GameStatItem> {
    const current = this.loadStats();
    for (const [rawKey, matches] of Object.entries(stats)) {
      const key = rawKey.toLowerCase().trim();
      if (typeof matches === 'number' && !isNaN(matches)) {
        if (current[key]) {
          current[key].matches = matches;
        } else {
          const defaultInfo = DEFAULT_GAME_STATS[key] || {
            name: key.toUpperCase(),
            icon: '🎮',
            matches: 0,
          };
          current[key] = { ...defaultInfo, matches };
        }
      }
    }
    this.saveStats(current);
    return current;
  }

  public static getTopGames(): TopGameDisplay[] {
    const stats = this.loadStats();
    return Object.entries(stats)
      .map(([id, info]) => ({
        id,
        name: info.name,
        icon: info.icon,
        matchesPlayed: info.matches,
      }))
      .sort((a, b) => b.matchesPlayed - a.matchesPlayed);
  }
}

export const recordGameMatch = (gameType: string, count = 1) => GameStatsService.recordGameMatch(gameType, count);
export const updateGameStats = (stats: Record<string, number>) => GameStatsService.updateGameStats(stats);
export const getTopGames = () => GameStatsService.getTopGames();
