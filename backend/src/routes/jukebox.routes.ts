import { Router, Request, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';
import axios from 'axios';

const router = Router();

// GET /api/jukebox/search?term=...
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const term = String(req.query.term || req.query.q || req.query.query || '').trim();
    if (!term) {
      res.status(200).json({ success: true, results: [] });
      return;
    }

    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=30`;
    const response = await axios.get(itunesUrl, { timeout: 8000 });

    if (response.data?.results && Array.isArray(response.data.results)) {
      const results = response.data.results
        .filter((item: any) => Boolean(item.previewUrl))
        .map((item: any) => ({
          title: item.trackName || 'Lagu',
          artist: item.artistName || 'Artis',
          genre: item.primaryGenreName || 'Musik',
          uri: item.previewUrl,
          duration: Math.round((item.trackTimeMillis || 180000) / 1000),
          thumbnail: item.artworkUrl100 || item.artworkUrl60 || null,
        }));

      res.status(200).json({ success: true, results });
      return;
    }

    res.status(200).json({ success: true, results: [] });
  } catch (error: any) {
    console.error('Jukebox music search proxy error:', error?.message);
    res.status(500).json({ success: false, error: 'Gagal mencari musik' });
  }
});

// GET /api/jukebox/radio/stream?url=...
router.get('/radio/stream', async (req: Request, res: Response): Promise<void> => {
  const streamUrl = String(req.query.url || '');
  if (!streamUrl || !streamUrl.startsWith('http')) {
    res.status(400).send('Invalid stream url');
    return;
  }

  try {
    const streamRes = await axios({
      method: 'GET',
      url: streamUrl,
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    res.setHeader('Content-Type', streamRes.headers['content-type'] || 'audio/mpeg');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store');

    streamRes.data.pipe(res);

    req.on('close', () => {
      try {
        streamRes.data.destroy();
      } catch (_) {}
    });
  } catch (err: any) {
    console.error('Radio proxy stream error:', err?.message);
    res.status(502).send('Radio stream currently unavailable');
  }
});

// GET /api/jukebox/:warungId/now-playing
router.get('/:warungId/now-playing', verifyJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warungId } = req.params;
    
    // Find current active/playing track
    let playing = await (prisma as any).jukeboxTrack.findFirst({
      where: { warung_id: warungId, is_playing: true },
      orderBy: { started_at: 'desc' },
    });

    // If none currently playing, get top item in queue
    if (!playing) {
      playing = await (prisma as any).jukeboxTrack.findFirst({
        where: { warung_id: warungId },
        orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
      });
      if (playing) {
        playing = await (prisma as any).jukeboxTrack.update({
          where: { id: playing.id },
          data: { is_playing: true, started_at: new Date() },
        });
      }
    }

    // Get queue
    const queue = await (prisma as any).jukeboxTrack.findMany({
      where: { warung_id: warungId, id: playing ? { not: playing.id } : undefined },
      orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
      take: 20,
    });

    // Get vote statistics if playing
    let votes = { skips: 0, likes: 0, userVoted: null as string | null };
    if (playing) {
      const allVotes = await (prisma as any).jukeboxVote.findMany({
        where: { track_id: playing.id },
      });
      votes.skips = allVotes.filter((v: any) => v.vote_type === 'skip').length;
      votes.likes = allVotes.filter((v: any) => v.vote_type === 'like').length;
      const myVote = allVotes.find((v: any) => v.user_id === req.user?.id);
      if (myVote) votes.userVoted = myVote.vote_type;
    }

    res.status(200).json({
      playing: playing || null,
      queue,
      votes,
    });
  } catch (error: any) {
    console.error('Error fetching jukebox now-playing:', error);
    res.status(500).json({ error: 'Gagal memuat status Jukebox Warung' });
  }
});

// POST /api/jukebox/:warungId/queue
router.post('/:warungId/queue', verifyJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warungId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { track_uri, title, artist, thumbnail, duration } = req.body;
    if (!track_uri || !title || !artist) {
      res.status(400).json({ error: 'Data lagu (uri, title, artist) wajib diisi' });
      return;
    }

    // Get count of existing items to determine position
    const count = await (prisma as any).jukeboxTrack.count({
      where: { warung_id: warungId },
    });

    const isFirst = count === 0;

    const track = await (prisma as any).jukeboxTrack.create({
      data: {
        warung_id: warungId as string,
        track_uri: String(track_uri).trim(),
        title: String(title).trim(),
        artist: String(artist).trim(),
        thumbnail: thumbnail ? String(thumbnail).trim() : null,
        duration: Number(duration) || 180,
        added_by: userId,
        position: count,
        is_playing: isFirst,
        started_at: isFirst ? new Date() : null,
      },
    });

    res.status(201).json({
      success: true,
      track,
      message: 'Lagu berhasil ditambahkan ke antrian Warkop',
    });
  } catch (error: any) {
    console.error('Error adding track to jukebox queue:', error);
    res.status(500).json({ error: 'Gagal menambahkan lagu ke antrian' });
  }
});

// POST /api/jukebox/:warungId/vote
router.post('/:warungId/vote', verifyJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { warungId } = req.params;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { track_id, vote_type } = req.body;
    if (!track_id || !['skip', 'like'].includes(vote_type)) {
      res.status(400).json({ error: 'Parameter vote_type harus "skip" atau "like"' });
      return;
    }

    // Upsert vote
    const vote = await (prisma as any).jukeboxVote.upsert({
      where: {
        track_id_user_id_vote_type: {
          track_id,
          user_id: userId,
          vote_type,
        },
      },
      update: {},
      create: {
        track_id,
        user_id: userId,
        vote_type,
      },
    });

    // Check skip vote threshold (> 50% or >= 3 skips skips track)
    let skipped = false;
    if (vote_type === 'skip') {
      const skipCount = await (prisma as any).jukeboxVote.count({
        where: { track_id, vote_type: 'skip' },
      });

      if (skipCount >= 3) {
        // Mark current track as finished
        await (prisma as any).jukeboxTrack.delete({
          where: { id: track_id },
        }).catch(() => {});

        // Advance to next track
        const nextTrack = await (prisma as any).jukeboxTrack.findFirst({
          where: { warung_id: warungId },
          orderBy: [{ position: 'asc' }, { created_at: 'asc' }],
        });

        if (nextTrack) {
          await (prisma as any).jukeboxTrack.update({
            where: { id: nextTrack.id },
            data: { is_playing: true, started_at: new Date() },
          });
        }
        skipped = true;
      }
    }

    res.status(200).json({
      success: true,
      vote,
      skipped,
      message: skipped ? 'Lagu dilewati berdasarkan vote warkop' : 'Vote berhasil dicatat',
    });
  } catch (error: any) {
    console.error('Error recording jukebox vote:', error);
    res.status(500).json({ error: 'Gagal memproses vote' });
  }
});

export default router;
