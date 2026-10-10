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

  public static addPoints(key: string, amount: number): number {
    if (!key) return 0;
    const current = userPoints.get(key) || 0;
    const updated = Math.max(0, current + amount);
    userPoints.set(key, updated);
    savePoints(userPoints);
    return updated;
  }

  public static getAllPoints(): Record<string, number> {
    return Object.fromEntries(userPoints);
  }
}
