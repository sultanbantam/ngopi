import { Router, Request, Response } from 'express';
import { AlbumService } from '../services/album.service';
import { PointsManager } from '../utils/pointsManager';
import { pointsEconomyService } from '../services/points.service';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'bamboochat-super-secret-key-change-in-production-min32chars';

// Helper to extract user from Authorization header or body
const extractUser = (req: Request): { id: string; username: string; display_name: string } | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1] || '';
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded && (decoded.id || decoded.userId)) {
        return {
          id: decoded.id || decoded.userId,
          username: decoded.username || decoded.name || 'WargaWarkop',
          display_name: decoded.display_name || decoded.displayName || decoded.username || 'Warga Warkop',
        };
      }
    } catch {}
  }

  // Fallback to body/query if provided
  if (req.body?.userId || req.body?.username) {
    return {
      id: req.body.userId || req.body.username,
      username: req.body.username || req.body.userId,
      display_name: req.body.displayName || req.body.username || 'Warga Warkop',
    };
  }

  return null;
};

// GET /api/albums/search-tracks - Search full-length tracks for mixtape
router.get('/search-tracks', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || req.query.term || '').trim();
    const era = req.query.era ? String(req.query.era).trim() : undefined;
    const tracks = await AlbumService.searchFullTracks(q, era);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({ success: true, tracks });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Gagal mencari lagu utuh.' });
  }
});

// GET /api/albums - List compilation albums
router.get('/', (req: Request, res: Response) => {
  try {
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const albums = AlbumService.getAlbums(userId);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({ success: true, albums });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Gagal memuat album.' });
  }
});

// GET /api/albums/:id - Get specific album
router.get('/:id', (req: Request, res: Response) => {
  try {
    const album = AlbumService.getAlbumById(String(req.params.id || ''));
    if (!album) {
      return res.status(404).json({ success: false, error: 'Album kompilasi tidak ditemukan.' });
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json({ success: true, album });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Gagal mengambil detail album.' });
  }
});

// POST /api/albums - Create album with points deduction
router.post('/', (req: Request, res: Response) => {
  try {
    const user = extractUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Sesi login tidak valid. Silakan login terlebih dahulu untuk membuat album kompilasi.',
      });
    }

    const { title, description, coverEmoji, capacity, tracks } = req.body;

    const result = AlbumService.createAlbum({
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
      title,
      description,
      coverEmoji,
      capacity: Number(capacity) || 10,
      tracks: Array.isArray(tracks) ? tracks : [],
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Gagal membuat album kompilasi.' });
  }
});

// POST /api/albums/:id/play - Record album play & award royalties
router.post('/:id/play', (req: Request, res: Response) => {
  try {
    const user = extractUser(req);
    const listenerId = user?.id || (req.body?.listenerId ? String(req.body.listenerId) : undefined);
    const listenerUsername = user?.username || (req.body?.listenerUsername ? String(req.body.listenerUsername) : undefined);

    const listener = listenerId ? { userId: listenerId, username: listenerUsername } : undefined;
    const playCount = AlbumService.recordAlbumPlay(String(req.params.id || ''), listener);
    res.status(200).json({ success: true, playCount });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

export default router;
