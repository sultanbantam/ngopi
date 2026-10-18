import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { PointsManager } from '../utils/pointsManager';
import { pointsEconomyService } from '../services/points.service';
import { TableManager } from '../games/TableManager';
import { BotProfileService } from '../games/gapleh/BotProfileService';
import { GameStatsService, recordGameMatch, updateGameStats, getTopGames } from '../services/gameStats.service';
import { AlbumService } from '../services/album.service';
import fs from 'fs';
import path from 'path';

export { recordGameMatch, updateGameStats, getTopGames };

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
        const ptsService = (pointsEconomyService && typeof pointsEconomyService.getUserPoints === 'function')
          ? (pointsEconomyService.getUserPoints(user.id)?.balance || 0)
          : 0;
        const totalPoints = Math.max(ptsByName, ptsById, ptsService);
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
    const topGames = GameStatsService.getTopGames();

    // 5. Top 10 Gapleh: Combined Human + Bot Leaderboard (Task 4 & Task 8.2)
    const bots = BotProfileService.getAllProfiles();
    const botEntries = bots.map((b) => {
      const botBadges = [...(b.badges || [])];
      if (b.level >= 5 && !botBadges.includes('Jagal Gapleh')) botBadges.push('Jagal Gapleh');
      if (b.level >= 4 && !botBadges.includes('Nutup Master')) botBadges.push('Nutup Master');
      if (!botBadges.includes('Digapleh Hunter')) botBadges.push('Digapleh Hunter');

      return {
        id: b.bot_id,
        username: b.bot_id,
        display_name: `${b.name} (${b.title})`,
        is_bot: true,
        bot_title: b.title,
        level: b.level,
        points: b.total_points,
        wins: b.total_wins,
        losses: b.total_losses,
        badges: botBadges,
        avatar_url: null,
      };
    });

    const humanEntries = allUsers.map((user: any) => {
      const ptsByName = PointsManager.getPoints(user.username);
      const ptsById = PointsManager.getPoints(user.id);
      const ptsService = (pointsEconomyService && typeof pointsEconomyService.getUserPoints === 'function')
        ? (pointsEconomyService.getUserPoints(user.id)?.balance || 0)
        : 0;
      const totalPoints = Math.max(ptsByName, ptsById, ptsService);

      const badges: string[] = [];
      if (totalPoints >= 500) badges.push('Jagal Gapleh');
      if (totalPoints >= 250) badges.push('Nutup Master');
      if (totalPoints >= 100) badges.push('Digapleh Hunter');

      return {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        is_bot: false,
        bot_title: undefined,
        level: totalPoints >= 500 ? 2 : 1,
        points: totalPoints,
        wins: Math.floor(totalPoints / 50),
        losses: 0,
        badges,
        avatar_url: user.avatar_url,
      };
    });

    const topGapleh = [...botEntries, ...humanEntries]
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));

    // 6. Top Compilation Albums (Paling Banyak Diputar & Royalti Poin)
    let topAlbums: any[] = [];
    try {
      topAlbums = AlbumService.getTopAlbums(25);
    } catch (e) {
      console.warn('Failed to get top albums for leaderboard:', e);
    }

    res.status(200).json({
      success: true,
      data: {
        top_points: topPoints,
        top_music: topMusic,
        top_radio: topRadio,
        top_games: topGames,
        top_gapleh: topGapleh,
        top_albums: topAlbums,
      },
    });
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: 'Gagal memuat data klasemen.' });
  }
});

// GET /api/leaderboard/albums - Dedicated Top Albums Leaderboard
router.get('/albums', (_req: Request, res: Response) => {
  try {
    const topAlbums = AlbumService.getTopAlbums(50);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({ success: true, top_albums: topAlbums });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

// GET /api/leaderboard/gapleh - Dedicated Top 10 Gapleh Human + Bot
router.get('/gapleh', async (_req: Request, res: Response) => {
  try {
    const bots = BotProfileService.getAllProfiles();
    const botEntries = bots.map((b) => {
      const botBadges = [...(b.badges || [])];
      if (b.level >= 5 && !botBadges.includes('Jagal Gapleh')) botBadges.push('Jagal Gapleh');
      if (b.level >= 4 && !botBadges.includes('Nutup Master')) botBadges.push('Nutup Master');
      if (!botBadges.includes('Digapleh Hunter')) botBadges.push('Digapleh Hunter');

      return {
        id: b.bot_id,
        username: b.bot_id,
        display_name: `${b.name} (${b.title})`,
        is_bot: true,
        bot_title: b.title,
        level: b.level,
        points: b.total_points,
        wins: b.total_wins,
        losses: b.total_losses,
        badges: botBadges,
        avatar_url: null,
      };
    });

    // Fetch DB users or fallback to in-memory
    let dbUsers: any[] = [];
    try {
      dbUsers = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          display_name: true,
          avatar_url: true,
        },
        take: 25,
      });
    } catch {}

    const allUserList = dbUsers.length > 0 ? dbUsers : [
      { id: 'user_sultan', username: 'sultanbantam', display_name: 'Sultan Bantam', avatar_url: null },
      { id: 'user_ujang', username: 'ujang_warkop', display_name: 'Ujang Warkop', avatar_url: null },
      { id: 'user_jawara', username: 'jawara_gapleh', display_name: 'Jawara Gapleh', avatar_url: null },
      { id: 'user_ngopi', username: 'ngopikawan', display_name: 'Ngopi Kawan', avatar_url: null },
    ];

    const humanEntries = allUserList.map((user: any) => {
      const ptsByName = PointsManager.getPoints(user.username);
      const ptsById = PointsManager.getPoints(user.id);
      const ptsService = (pointsEconomyService && typeof pointsEconomyService.getUserPoints === 'function')
        ? (pointsEconomyService.getUserPoints(user.id)?.balance || 0)
        : 0;
      const pts = Math.max(ptsByName, ptsById, ptsService, 120);

      const badges: string[] = [];
      if (pts >= 500) badges.push('Jagal Gapleh');
      if (pts >= 250) badges.push('Nutup Master');
      if (pts >= 100) badges.push('Digapleh Hunter');

      return {
        id: user.id,
        username: user.username,
        display_name: user.display_name || user.username,
        is_bot: false,
        bot_title: undefined,
        level: pts >= 500 ? 2 : 1,
        points: pts,
        wins: Math.floor(pts / 50),
        losses: 0,
        badges,
        avatar_url: user.avatar_url || null,
      };
    });

    const topGapleh = [...botEntries, ...humanEntries]
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));

    res.status(200).json({
      success: true,
      leaderboard: topGapleh,
      bots,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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

// POST /api/leaderboard/radio/update - Update or set radio counts
router.post('/radio/update', (req: Request, res: Response) => {
  try {
    const { stationId, count, stats } = req.body;
    const current = loadJsonStats(RADIO_STATS_FILE, DEFAULT_RADIO_STATS);
    if (stats && typeof stats === 'object') {
      for (const [sId, c] of Object.entries(stats)) {
        if (typeof c === 'number') {
          if (current[sId]) current[sId].count = c;
          else current[sId] = { name: sId, frequency: 'Online', genre: 'Radio', icon: '📻', count: c };
        }
      }
    } else if (stationId && typeof count === 'number') {
      if (current[stationId]) current[stationId].count = count;
      else current[stationId] = { name: stationId, frequency: 'Online', genre: 'Radio', icon: '📻', count };
    } else {
      return res.status(400).json({ error: 'Berikan stationId & count atau objek stats.' });
    }
    saveJsonStats(RADIO_STATS_FILE, current);
    res.status(200).json({ success: true, data: current });
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

// POST /api/leaderboard/music/update - Update or set music play counts
router.post('/music/update', (req: Request, res: Response) => {
  try {
    const { title, artist, playCount, stats } = req.body;
    const current = loadJsonStats(MUSIC_STATS_FILE, {});
    if (stats && typeof stats === 'object') {
      for (const [key, c] of Object.entries(stats)) {
        if (typeof c === 'number') {
          if (current[key]) current[key].playCount = c;
          else {
            const [t = key, a = 'Warkop'] = key.split(':::');
            current[key] = { title: t, artist: a, thumbnail: null, playCount: c };
          }
        }
      }
    } else if (title && artist && typeof playCount === 'number') {
      const key = `${title}:::${artist}`.toLowerCase();
      current[key] = { title, artist, thumbnail: req.body.thumbnail || null, playCount };
    } else {
      return res.status(400).json({ error: 'Berikan title, artist & playCount atau objek stats.' });
    }
    saveJsonStats(MUSIC_STATS_FILE, current);
    res.status(200).json({ success: true, data: current });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/leaderboard/game/played - Record a match played for a game
router.post('/game/played', (req: Request, res: Response) => {
  try {
    const { gameType, count } = req.body;
    if (!gameType) {
      return res.status(400).json({ error: 'gameType wajib diisi.' });
    }
    const incrementBy = typeof count === 'number' && count > 0 ? count : 1;
    const matches = GameStatsService.recordGameMatch(gameType, incrementBy);
    res.status(200).json({ success: true, gameType, matches });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/leaderboard/game/update - Update or set match counts for games
router.post('/game/update', (req: Request, res: Response) => {
  try {
    const { gameType, matches, stats } = req.body;
    let updated;
    if (stats && typeof stats === 'object') {
      updated = GameStatsService.updateGameStats(stats);
    } else if (gameType && typeof matches === 'number') {
      updated = GameStatsService.updateGameStats({ [gameType]: matches });
    } else {
      return res.status(400).json({ error: 'Format data tidak valid. Berikan gameType & matches atau objek stats.' });
    }
    res.status(200).json({ success: true, data: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/leaderboard/game - Get game leaderboard directly
router.get('/game', (_req: Request, res: Response) => {
  try {
    const topGames = GameStatsService.getTopGames();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({ success: true, top_games: topGames });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
