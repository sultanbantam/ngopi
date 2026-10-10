import { Request, Response, Router } from 'express';
import { TableManager } from '../games/TableManager';
import { GameType } from '../games/engine/types';

const router = Router();

// Middleware to extract user info from header/auth or request
const getUserFromReq = (req: Request) => {
  const user = (req as any).user;
  if (user?.id) {
    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name || user.username,
      avatar_url: user.avatar_url,
    };
  }

  // Fallback for casual guest or development token
  const guestId = (req.headers['x-user-id'] as string) || (req.query.userId as string) || 'guest_user';
  const guestName = (req.headers['x-user-name'] as string) || (req.query.username as string) || 'Ngopikawan';
  return {
    id: guestId,
    username: guestName,
    display_name: guestName,
    avatar_url: null,
  };
};

// GET /api/games/tables
router.get('/tables', (req: Request, res: Response) => {
  const gameType = req.query.type as string | undefined;
  const warungId = req.query.warungId as string | undefined;

  const tables = TableManager.listTables({ gameType, warungId });
  res.status(200).json({ success: true, tables });
});

// POST /api/games/tables
router.post('/tables', async (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { gameType, name, maxPlayers, minPlayers, isPrivate, password, warungId, config } = req.body;

  try {
    const table = await TableManager.createTable({
      gameType: (gameType as GameType) || 'gapleh',
      name: name || `Meja ${gameType || 'Gapleh'} Warkop`,
      host: user,
      maxPlayers: maxPlayers ? Number(maxPlayers) : undefined,
      minPlayers: minPlayers ? Number(minPlayers) : undefined,
      isPrivate: !!isPrivate,
      password,
      warungId,
      config,
    });

    res.status(201).json({ success: true, table });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/games/tables/:id
router.get('/tables/:id', (req: Request, res: Response) => {
  const table = TableManager.getTable(req.params.id);
  if (!table) {
    return res.status(404).json({ success: false, error: 'Meja tidak ditemukan.' });
  }
  res.status(200).json({ success: true, table });
});

// POST /api/games/tables/:id/join
router.post('/tables/:id/join', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { password } = req.body;

  const result = TableManager.joinTable(req.params.id, user, password);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// POST /api/games/tables/:id/bot
router.post('/tables/:id/bot', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const result = TableManager.addBot(req.params.id, user.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// POST /api/games/tables/:id/ready
router.post('/tables/:id/ready', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { isReady } = req.body;

  const result = TableManager.setReady(req.params.id, user.id, isReady !== false);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// POST /api/games/tables/:id/start
router.post('/tables/:id/start', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const result = TableManager.startGame(req.params.id, user.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// GET /api/games/tables/:id/state
router.get('/tables/:id/state', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const isSpectator = req.query.spectator === 'true';

  const state = TableManager.getGameState(req.params.id, user.id, isSpectator);
  const table = TableManager.getTable(req.params.id);

  if (!table) {
    return res.status(404).json({ success: false, error: 'Meja tidak ditemukan.' });
  }

  res.status(200).json({ success: true, table, state });
});

// POST /api/games/tables/:id/action
router.post('/tables/:id/action', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { action, payload } = req.body;

  const result = TableManager.handleAction(req.params.id, user.id, action, payload);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.status(200).json(result);
});

// POST /api/games/tables/:id/leave
router.post('/tables/:id/leave', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const result = TableManager.leaveTable(req.params.id, user.id);
  res.status(200).json(result);
});

// DELETE /api/games/tables/:id
router.delete('/tables/:id', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const table = TableManager.getTable(req.params.id);
  if (!table) {
    return res.status(404).json({ success: false, error: 'Meja tidak ditemukan.' });
  }
  if (table.host_id !== user.id) {
    return res.status(403).json({ success: false, error: 'Hanya host yang bisa menghapus meja.' });
  }

  TableManager.leaveTable(req.params.id, user.id);
  res.status(200).json({ success: true, message: 'Meja berhasil ditutup.' });
});

export default router;
