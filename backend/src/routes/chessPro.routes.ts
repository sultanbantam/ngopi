import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { ChessProService, CHESS_BOTS } from '../services/chessPro.service';
import { PointsManager } from '../utils/pointsManager';
import { prisma } from '../utils/prisma';

const router = Router();

// Helper to extract user safely from JWT or header or body
const getUserFromReq = (req: Request) => {
  const user = (req as any).user;
  if (user?.id) {
    return {
      id: String(user.id),
      username: String(user.username || 'Pemain Catur'),
    };
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded: any = jwt.decode(token);
      if (decoded?.id) {
        return {
          id: String(decoded.id),
          username: String(decoded.username || 'Pemain Catur'),
        };
      }
    } catch (_) {}
  }

  const uid = (req.body?.user_id || req.query?.user_id || req.headers['x-user-id']) as string;
  const uname = (req.body?.username || req.query?.username || req.headers['x-user-name']) as string;

  if (uid) {
    return {
      id: String(uid),
      username: String(uname || uid),
    };
  }

  return {
    id: 'guest_' + (req.ip || 'local').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10),
    username: uname || 'Pemain Warkop',
  };
};

/**
 * GET /api/chess/pro/bots
 * List all 9 bots and current user points
 */
router.get('/bots', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUserFromReq(req);
    const data = ChessProService.getBotsList(user.username || user.id);
    res.json({
      success: true,
      ...data,
      user_id: user.id,
      username: user.username,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/chess/pro/start
 * Start a new match with one of the 9 bots.
 * NOTE: User with 0 or negative points CAN still play!
 */
router.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUserFromReq(req);
    const botLevel = Number(req.body.bot_level ?? 0);
    const userColor = req.body.user_color === 'black' ? 'black' : 'white';

    const matchData = await ChessProService.startMatch({
      userId: user.id,
      username: user.username,
      botLevel,
      userColor,
    });

    res.json(matchData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/chess/pro/move
 * Play a user move, and get Stockfish's response move
 */
router.post('/move', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUserFromReq(req);
    const { match_id, move } = req.body;

    if (!match_id || !move) {
      res.status(400).json({ success: false, error: 'match_id dan move wajib diisi.' });
      return;
    }

    const moveResult = await ChessProService.handleMove({
      matchId: match_id,
      userId: user.id,
      username: user.username,
      move,
    });

    res.json(moveResult);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/chess/pro/finish
 * Conclude a match manually (e.g. Resign / Surrender)
 */
router.post('/finish', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUserFromReq(req);
    const { match_id, result, pgn, duration_sec } = req.body;

    if (!match_id || !result) {
      res.status(400).json({ success: false, error: 'match_id dan result wajib diisi.' });
      return;
    }

    const finishResult = await ChessProService.finishMatch({
      matchId: match_id,
      userId: user.id,
      username: user.username,
      result: result as 'win' | 'lose' | 'draw',
      pgn,
      durationSec: duration_sec ? Number(duration_sec) : undefined,
    });

    res.json(finishResult);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/chess/pro/history
 * Match history for user
 */
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = getUserFromReq(req);
    let history: any[] = [];

    try {
      history = await prisma.chessProMatch.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        take: 20,
      });
    } catch (_) {}

    const balance = PointsManager.getPoints(user.username) || PointsManager.getPoints(user.id);

    res.json({
      success: true,
      user_id: user.id,
      username: user.username,
      balance,
      is_negative: balance < 0,
      history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
