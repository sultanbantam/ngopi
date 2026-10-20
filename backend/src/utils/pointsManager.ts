import fs from 'fs';
import path from 'path';

const POINTS_FILE = path.join(__dirname, '../../uploads/warkop_points.json');

const loadPoints = (): Map<string, number> => {
  const map = new Map<string, number>();
  try {
    if (fs.existsSync(POINTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(POINTS_FILE, 'utf-8'));
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'number') map.set(k, v);
      }
    }
  } catch (e) {
    console.warn('Failed to load warkop points:', e);
  }
  return map;
};

const savePoints = (map: Map<string, number>) => {
  try {
    const dir = path.dirname(POINTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj = Object.fromEntries(map);
    fs.writeFileSync(POINTS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Failed to save warkop points:', e);
  }
};

const userPoints = loadPoints();

export class PointsManager {
  public static getPoints(key: string): number {
    if (!key) return 0;
    return userPoints.get(key) || 0;
  }

  public static setPoints(key: string, balance: number, allowNegative: boolean = true): number {
    if (!key) return 0;
    const finalBalance = allowNegative ? balance : Math.max(0, balance);
    userPoints.set(key, finalBalance);
    savePoints(userPoints);
    return finalBalance;
  }

  public static addPoints(key: string, amount: number, allowNegative: boolean = true): number {
    if (!key) return 0;
    const current = userPoints.get(key) || 0;
    const updated = allowNegative ? current + amount : Math.max(0, current + amount);
    userPoints.set(key, updated);
    savePoints(userPoints);

    // Sync to pointsEconomyService if available
    try {
      const { pointsEconomyService } = require('../services/points.service');
      if (pointsEconomyService && typeof pointsEconomyService.addDirectPoints === 'function') {
        pointsEconomyService.addDirectPoints(
          key,
          amount,
          amount > 0 ? 'game_won' : 'custom_reward',
          amount > 0 ? 'Poin aktivitas permainan/tebak-tebakan warkop' : 'Penyesuaian poin tanding catur strategi'
        );
      }
    } catch (_) {}

    return updated;
  }

  public static getAllPoints(): Record<string, number> {
    return Object.fromEntries(userPoints);
  }
}
