import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { PointsManager } from '../utils/pointsManager';
import { TableManager } from '../games/TableManager';
import fs from 'fs';
import path from 'path';

const router = Router();

const RADIO_STATS_FILE = path.join(__dirname, '../../uploads/warkop_radio_stats.json');
const MUSIC_STATS_FILE = path.join(__dirname, '../../uploads/warkop_music_stats.json');
const GAME_STATS_FILE = path.join(__dirname, '../../uploads/warkop_game_stats.json');

// Helper to load/save JSON stats safely
const loadJsonStats = (filePath: string, defaultData: Record<string, any>): Record<string, any> => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.warn(`Failed to read stats file ${filePath}:`, e);
  }
  return defaultData;
};

const saveJsonStats = (filePath: string, data: Record<string, any>) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn(`Failed to save stats file ${filePath}:`, e);
  }
};

// Default seed data for Radio so leaderboard is vibrant
const DEFAULT_RADIO_STATS: Record<string, { name: string; frequency: string; genre: string; icon: string; count: number }> = {
  'sonora-fm': { name: 'Sonora FM 92 Jakarta', frequency: '92.0 FM', genre: 'Pop & Berita', icon: '📻', count: 48 },
  'iradio-jakarta': { name: 'I-Radio 89.6 FM', frequency: '89.6 FM', genre: '100% Musik Indonesia', icon: '🎵', count: 62 },
  'dengerin-indo': { name: 'Dengerin Musik Indonesia', frequency: 'Online', genre: 'Pop & Top 40 Hits', icon: '🎧', count: 39 },
  'suara-surabaya': { name: 'Suara Surabaya 100 FM', frequency: '100.0 FM', genre: 'Informasi & Santai', icon: '☕', count: 35 },
  'alternatif-fm': { name: 'Radio Alternatif FM 98.1', frequency: '98.1 FM', genre: 'Rock & Pop Alternatif', icon: '🎸', count: 27 },
  'suara-soneta': { name: 'Radio Soneta Rhoma Irama', frequency: 'Online', genre: 'Dangdut Klasik', icon: '🎤', count: 21 },
};

// Default seed data for Games
const DEFAULT_GAME_STATS: Record<string, { name: string; icon: string; matches: number }> = {
  gapleh: { name: 'Gapleh Domino', icon: '🀥', matches: 124 },
  catur: { name: 'Catur Santai', icon: '♟️', matches: 86 },
  uno: { name: 'UNO Card Game', icon: '🎴', matches: 58 },
  remi: { name: 'Remi Klasik', icon: '🃏', matches: 42 },
  poker: { name: 'Poker Meja', icon: '♠️', matches: 31 },
  truf: { name: 'Truf PekaI', icon: '♦️', matches: 19 },
  bridge: { name: 'Bridge Warkop', icon: '🌉', matches: 12 },
  pokemon: { name: 'Monster TCG', icon: '🎴', matches: 25 },
  mahyong: { name: 'Mahjong Warkop', icon: '🀄', matches: 15 },
  halma: { name: 'Halma Bintang', icon: '🌟', matches: 14 },
  daku: { name: 'Daku Congklak', icon: '🪵', matches: 18 },
  karambol: { name: 'Karambol Warkop', icon: '⚪', matches: 22 },
  billiard: { name: 'Billiard 8-Ball', icon: '🎱', matches: 28 },
};

// GET /api/leaderboard - Get full klasemen
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1. Top Points (Klasemen Peraih Poin Terbanyak)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
        bmc_id: true,
      },
    });

    const topPoints = allUsers
      .map((user) => {
        const ptsByName = PointsManager.getPoints(user.username);
        const ptsById = PointsManager.getPoints(user.id);
        const totalPoints = Math.max(ptsByName, ptsById);
        return {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          bmc_id: user.bmc_id,
          points: totalPoints,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 25);

    // 2. Top Music (Lagu yang Paling Banyak Didengar)
    const musicStats = loadJsonStats(MUSIC_STATS_FILE, {});
    let dbTracks: any[] = [];
    try {
      dbTracks = await (prisma as any).jukeboxTrack.findMany({
        take: 50,
        orderBy: { created_at: 'desc' },
      });
    } catch {}

    const musicMap: Record<string, { title: string; artist: string; thumbnail?: string | null; playCount: number }> = {};

    // Populate from db tracks
    for (const t of dbTracks) {
      const key = `${t.title}:::${t.artist}`.toLowerCase();
      if (!musicMap[key]) {
        musicMap[key] = {
          title: t.title,
          artist: t.artist,
          thumbnail: t.thumbnail,
          playCount: 1,
        };
      } else {
        musicMap[key]!.playCount++;
      }
    }

    // Merge persistent stats
    for (const [key, item] of Object.entries(musicStats)) {
      if (musicMap[key]) {
        musicMap[key]!.playCount += (item.playCount || 0);
      } else {
        musicMap[key] = item as any;
      }
    }

    // Seed defaults if empty
    if (Object.keys(musicMap).length === 0) {
      musicMap['kopi dangdut:::fahmi shahab'] = {
        title: 'Kopi Dangdut',
        artist: 'Fahmi Shahab',
        thumbnail: null,
        playCount: 78,
      };
      musicMap['menghitung hari:::krisdayanti'] = {
        title: 'Menghitung Hari',
        artist: 'Krisdayanti',
        thumbnail: null,
        playCount: 54,
      };
      musicMap['dan:::sheila on 7'] = {
        title: 'Dan...',
        artist: 'Sheila on 7',
        thumbnail: null,
        playCount: 47,
      };
      musicMap['kangen:::dewa 19'] = {
        title: 'Kangen',
        artist: 'Dewa 19',
        thumbnail: null,
        playCount: 42,
      };
    }

    const topMusic = Object.values(musicMap)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 20);

    // 3. Top Radio (Radio yang Paling Banyak Dipilih)
    const radioStats = loadJsonStats(RADIO_STATS_FILE, DEFAULT_RADIO_STATS);
    const topRadio = Object.entries(radioStats).map(([id, info]) => ({
      id,
      name: info.name,
      frequency: info.frequency,
      genre: info.genre,
      icon: info.icon,
      selectedCount: info.count,
    })).sort((a, b) => b.selectedCount - a.selectedCount);

    // 4. Top Games (Game yang Banyak Dimainkan)
    const gameStats = loadJsonStats(GAME_STATS_FILE, DEFAULT_GAME_STATS);
    // Count history from DB if available
    try {
      const history = await prisma.gameHistory.groupBy({
        by: ['game_type'],
        _count: { id: true },
      });
      for (const h of history) {
        if (gameStats[h.game_type]) {
          gameStats[h.game_type].matches += h._count.id;
        } else {
          gameStats[h.game_type] = {
            name: h.game_type.toUpperCase(),
            icon: '🎮',
            matches: h._count.id,
          };
        }
      }
    } catch {}

    const topGames = Object.entries(gameStats).map(([id, info]) => ({
      id,
      name: info.name,
      icon: info.icon,
      matchesPlayed: info.matches,
    })).sort((a, b) => b.matchesPlayed - a.matchesPlayed);

    res.status(200).json({
      success: true,
      data: {
        top_points: topPoints,
        top_music: topMusic,
        top_radio: topRadio,
        top_games: topGames,
      },
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: 'Gagal memuat data klasemen.' });
  }
});

// POST /api/leaderboard/radio/select - Record radio selection
router.post('/radio/select', (req: Request, res: Response) => {
  try {
    const { stationId, name, genre, icon, frequency } = req.body;
    if (!stationId) {
      return res.status(400).json({ error: 'stationId wajib diisi.' });
    }
    const current = loadJsonStats(RADIO_STATS_FILE, DEFAULT_RADIO_STATS);
    if (!current[stationId]) {
      current[stationId] = {
        name: name || stationId,
        frequency: frequency || 'Online',
        genre: genre || 'Musik',
        icon: icon || '📻',
        count: 1,
      };
    } else {
      current[stationId].count++;
    }
    saveJsonStats(RADIO_STATS_FILE, current);
    res.status(200).json({ success: true, count: current[stationId].count });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/leaderboard/music/played - Record music played
router.post('/music/played', (req: Request, res: Response) => {
  try {
    const { title, artist, thumbnail } = req.body;
    if (!title || !artist) {
      return res.status(400).json({ error: 'title and artist required.' });
    }
    const current = loadJsonStats(MUSIC_STATS_FILE, {});
    const key = `${title}:::${artist}`.toLowerCase();
    if (!current[key]) {
      current[key] = {
        title,
        artist,
        thumbnail,
        playCount: 1,
      };
    } else {
      current[key].playCount++;
    }
    saveJsonStats(MUSIC_STATS_FILE, current);
    res.status(200).json({ success: true, playCount: current[key].playCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
