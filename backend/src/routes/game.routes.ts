import { Request, Response, Router } from 'express';
import { TableManager } from '../games/TableManager';
import { GameType } from '../games/engine/types';
import { PointsManager } from '../utils/pointsManager';
import { pointsEconomyService } from '../services/points.service';
import { BotProfileService } from '../games/gapleh/BotProfileService';
import { GaplehShareService } from '../games/gapleh/GaplehShareService';
import { PointsService } from '../services/points.service';
import { prisma } from '../utils/prisma';
import jwt from 'jsonwebtoken';

const router = Router();

// Middleware to extract user info from header/auth or request
const getUserFromReq = (req: Request) => {
  const user = (req as any).user;
  if (user?.id) {
    return {
      id: String(user.id),
      username: String(user.username || 'Pemain'),
      display_name: String(user.display_name || user.username || 'Pemain'),
      avatar_url: user.avatar_url ? String(user.avatar_url) : null,
    };
  }

  // Check Bearer token if present
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded: any = jwt.decode(token);
      if (decoded?.id) {
        return {
          id: String(decoded.id),
          username: String(decoded.username || 'Pemain'),
          display_name: String(decoded.display_name || decoded.username || 'Pemain'),
          avatar_url: decoded.avatar_url ? String(decoded.avatar_url) : null,
        };
      }
    } catch (_) {}
  }

  // Fallback for casual guest or development token
  const guestId = (req.headers['x-user-id'] as string) || (req.body?.userId as string) || (req.query.userId as string) || 'guest_user';
  const guestName = (req.headers['x-user-name'] as string) || (req.body?.username as string) || (req.query.username as string) || 'Ngopikawan';
  return {
    id: String(guestId),
    username: String(guestName),
    display_name: String(guestName),
    avatar_url: null,
  };
};

// GET /api/games/points
router.get('/points', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  if (user.id && user.id !== 'guest_user') {
    pointsEconomyService.syncWithPointsManager(user.id, user.username);
  }
  const ptsEconomy = pointsEconomyService.getUserPoints(user.id)?.balance || 0;
  const ptsManager = PointsManager.getPoints(user.username) || PointsManager.getPoints(user.id);
  const points = Math.max(ptsEconomy, ptsManager);
  res.status(200).json({ success: true, points, username: user.username });
});

// GET /api/games/tables
router.get('/tables', (req: Request, res: Response) => {
  const gameType = typeof req.query.type === 'string' ? req.query.type : undefined;
  const warungId = typeof req.query.warungId === 'string' ? req.query.warungId : undefined;

  const tables = TableManager.listTables({ gameType, warungId } as any);
  res.status(200).json({ success: true, tables });
});

// POST /api/games/tables
router.post('/tables', async (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { gameType, name, maxPlayers, minPlayers, isPrivate, password, warungId, config } = req.body;

  try {
    const finalConfig = config
      ? { ...config, level: config.level !== undefined ? Number(config.level) : undefined }
      : undefined;

    const table = await TableManager.createTable({
      gameType: (gameType as GameType) || 'gapleh',
      name: name || `Meja ${gameType || 'Gapleh'} Warkop`,
      host: user,
      maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
      minPlayers: minPlayers ? Number(minPlayers) : undefined,
      isPrivate: !!isPrivate,
      password: password || undefined,
      warungId: warungId || undefined,
      config: finalConfig as any,
    } as any);

    res.status(201).json({ success: true, table });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/games/tables/:id
router.get('/tables/:id', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const table = TableManager.getTable(tableId);
  if (!table) {
    return res.status(404).json({ success: false, error: 'Meja tidak ditemukan.' });
  }
  res.status(200).json({ success: true, table });
});

// POST /api/games/tables/:id/join
router.post('/tables/:id/join', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const { password } = req.body;

  const result = TableManager.joinTable(tableId, user, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// GET /api/games/gapleh/bots - List bots for Level 2 (Gapleh Rame) selection
router.get('/gapleh/bots', (_req: Request, res: Response) => {
  const bots = BotProfileService.getAllProfiles();
  res.status(200).json({ success: true, bots });
});

// POST /api/games/gapleh/share or POST /api/gapleh/share (Task 3.4)
router.post(['/gapleh/share', '/share'], (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const {
    win_type = 'gapleh_biasa',
    username = user.username,
    points = 50,
    streak = 0,
    is_first_nutup = false,
    hook_template_id,
    design_template = 'neon_cyberpunk',
  } = req.body;

  const shareData = GaplehShareService.generateShareContent({
    winType: win_type,
    username: String(username || 'Ngopikawan'),
    points: Number(points) || 50,
    streakCount: Number(streak) || 0,
    isFirstNutup: Boolean(is_first_nutup),
    hookTemplateId: hook_template_id,
    designTemplate: design_template,
  });

  res.status(200).json({
    success: true,
    caption: shareData.caption,
    hooks: shareData.hooks,
    hashtags: shareData.hashtags,
    share_links: shareData.shareLinks,
    design_template: shareData.designTemplate,
    target_url: shareData.targetUrl,
  });
});

// POST /api/games/gapleh/share/claim-referral (Claim referral when player joins via victory share link)
router.post(['/gapleh/share/claim-referral', '/share/claim-referral'], async (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { referrerUsername } = req.body;

  if (!referrerUsername) {
    return res.status(400).json({ success: false, error: 'Username referral tidak valid.' });
  }

  const cleanRef = String(referrerUsername).trim().replace(/^@/, '');
  try {
    const referrer = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: cleanRef, mode: 'insensitive' } },
          { id: cleanRef },
        ],
      },
    });

    if (!referrer) {
      return res.status(404).json({ success: false, error: 'User pengajak tidak ditemukan.' });
    }

    if (referrer.id === user.id) {
      return res.status(400).json({ success: false, error: 'Tidak dapat mengklaim referral dari diri sendiri.' });
    }

    const result = PointsService.getInstance().earnReferralReward(referrer.id, user.id);
    return res.status(200).json({
      success: true,
      message: `Poin referral (+50 Poin) berhasil diberikan kepada @${referrer.username}!`,
      pointsAwarded: 50,
      referrerUsername: referrer.username,
      newBalance: result.newBalance,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Gagal memproses referral.' });
  }
});

// POST /api/games/tables/:id/bot
router.post('/tables/:id/bot', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const { botProfileId } = req.body;
  const result = TableManager.addBot(tableId, user.id, botProfileId);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// POST /api/games/tables/:id/ready
router.post('/tables/:id/ready', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const { isReady } = req.body;

  const result = TableManager.setReady(tableId, user.id, isReady !== false);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// POST /api/games/tables/:id/start
router.post('/tables/:id/start', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const result = TableManager.startGame(tableId, user.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// GET /api/games/tables/:id/state
router.get('/tables/:id/state', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const isSpectator = req.query.spectator === 'true';

  const state = TableManager.getGameState(tableId, user.id, isSpectator);
  const table = TableManager.getTable(tableId);

  if (!table) {
    return res.status(404).json({ success: false, error: 'Meja tidak ditemukan.' });
  }

  res.status(200).json({ success: true, table, state });
});

// POST /api/games/tables/:id/action
router.post('/tables/:id/action', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const { action, payload } = req.body;

  const result = TableManager.handleAction(tableId, user.id, action, payload);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// POST /api/games/tables/:id/leave
router.post('/tables/:id/leave', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const result = TableManager.leaveTable(tableId, user.id);
  res.status(200).json(result);
});

// DELETE /api/games/tables/:id
router.delete('/tables/:id', (req: Request, res: Response) => {
  const tableId = String(req.params.id || '');
  const user = getUserFromReq(req);
  const table = TableManager.getTable(tableId);
  if (!table) {
    return res.status(404).json({ success: false, error: 'Meja tidak ditemukan.' });
  }
  if (table.host_id !== user.id) {
    return res.status(403).json({ success: false, error: 'Hanya host yang bisa menghapus meja.' });
  }

  TableManager.leaveTable(tableId, user.id);
  res.status(200).json({ success: true, message: 'Meja berhasil ditutup.' });
});

export default router;
