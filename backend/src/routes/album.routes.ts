import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import multer from 'multer';
import crypto from 'crypto';
import { AlbumService } from '../services/album.service';
import { PointsManager } from '../utils/pointsManager';
import { pointsEconomyService } from '../services/points.service';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireDbUser } from '../middleware/rbac.middleware';
import { prisma } from '../utils/prisma';

const router = Router();

const mixtapeUploadDir = path.join(__dirname, '../../uploads/mixtape_songs');
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(mixtapeUploadDir)) fs.mkdirSync(mixtapeUploadDir, { recursive: true });
      cb(null, mixtapeUploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ['.mp3', '.m4a', '.wav', '.ogg'].includes(ext) ? ext : '.mp3';
      const trackId = `trk_ai_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      cb(null, `${trackId}${safeExt}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max per audio track
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    if (
      ['.mp3', '.m4a', '.wav', '.ogg'].includes(ext) ||
      mime.startsWith('audio/')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Format file audio harus MP3 (disarankan), M4A, WAV, atau OGG.'));
    }
  },
});

// POST /api/albums/upload-track - Upload AI / Indie song to mixtape catalog
router.post(
  '/upload-track',
  verifyJWT,
  requireDbUser,
  audioUpload.single('audio'),
  async (req: Request, res: Response) => {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, error: 'File audio (.mp3) wajib diunggah.' });
      }

      const title = String(req.body?.title || '').trim() || path.parse(file.originalname || 'Lagu AI').name;
      const artist = String(req.body?.artist || '').trim() || authUser.username || 'AI Creator';
      const genre = String(req.body?.genre || '').trim() || 'AI Music';
      const duration = Math.max(10, Math.min(3600, Number(req.body?.duration) || 180));
      const trackId = path.parse(file.filename).name;
      const baseUrl = process.env.PUBLIC_API_URL || 'https://api.ngopi.top';

      const track = AlbumService.addCustomTrack({
        id: trackId,
        title: title.slice(0, 120),
        artist: artist.slice(0, 80),
        genre: genre.slice(0, 50),
        era: 'ai',
        uri: `${baseUrl.replace(/\/$/, '')}/uploads/mixtape_songs/${file.filename}`,
        duration,
        thumbnail: null,
        is_full: true,
        uploaded_by: authUser.username,
        is_ai_generated: true,
      });

      return res.status(201).json({
        success: true,
        message: 'Lagu AI berhasil diunggah dan masuk ke katalog Album Mixtape!',
        track,
      });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Gagal mengunggah lagu.' });
    }
  }
);

// GET /api/albums/stream?url=...&trackId=... - Audio stream proxy & local cache server
router.get('/stream', async (req: Request, res: Response): Promise<void> => {
  const audioUrl = String(req.query.url || '').trim();
  const trackId = String(req.query.trackId || req.query.id || '').trim();

  // 1. If local cached file exists, serve directly with full range/seek support
  if (trackId) {
    const safeTrackId = trackId.replace(/[^a-zA-Z0-9_-]/g, '');
    const localPath = path.join(__dirname, '../../uploads/mixtape_songs', `${safeTrackId}.mp3`);
    if (fs.existsSync(localPath)) {
      res.sendFile(localPath);
      return;
    }
  }

  if (!audioUrl || !audioUrl.startsWith('http')) {
    res.status(400).send('Invalid audio URL');
    return;
  }

  // 2. Stream through proxy with range support and proper headers
  try {
    const rangeHeader = req.headers.range;
    const requestHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
    };
    if (rangeHeader) {
      requestHeaders['Range'] = rangeHeader;
    }

    const streamRes = await axios({
      method: 'GET',
      url: audioUrl,
      responseType: 'stream',
      timeout: 15000,
      headers: requestHeaders,
      validateStatus: (status) => status < 400,
    });

    const status = streamRes.status;
    res.status(status);

    const headersToForward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    headersToForward.forEach((h) => {
      if (streamRes.headers[h]) {
        res.setHeader(h, streamRes.headers[h]);
      }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    streamRes.data.pipe(res);

    req.on('close', () => {
      try {
        streamRes.data.destroy();
      } catch (_) {}
    });

    // 3. Asynchronously trigger caching in background if trackId provided
    if (trackId) {
      AlbumService.cacheTrackInBackground(trackId, audioUrl).catch(() => {});
    }
  } catch (err: any) {
    console.error('Album audio stream proxy error:', err?.message);
    res.status(502).send('Audio stream currently unavailable');
  }
});

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

// POST /api/albums - Create album with points deduction (authenticated + DB-backed user)
router.post('/', verifyJWT, requireDbUser, async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthRequest).user;
    if (!authUser?.id) {
      return res.status(401).json({
        success: false,
        error: 'Sesi login tidak valid. Silakan login terlebih dahulu untuk membuat album kompilasi.',
      });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, username: true, display_name: true },
    });
    if (!dbUser) {
      return res.status(401).json({
        success: false,
        error: 'Akun pengguna tidak ditemukan.',
      });
    }

    const { title, description, coverEmoji, capacity, tracks } = req.body;

    const result = AlbumService.createAlbum({
      userId: dbUser.id,
      username: dbUser.username || authUser.username,
      displayName: dbUser.display_name || dbUser.username || authUser.username,
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

// POST /api/albums/:id/play - Record album play & award royalties (authenticated + DB-backed user)
router.post('/:id/play', verifyJWT, requireDbUser, (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthRequest).user;
    if (!authUser?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const listener = { userId: authUser.id, username: authUser.username };
    const playCount = AlbumService.recordAlbumPlay(String(req.params.id || ''), listener);
    res.status(200).json({ success: true, playCount });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

export default router;
