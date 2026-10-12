import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { PokemonService } from '../services/pokemon.service';
import { TableManager } from '../games/TableManager';

const router = Router();

// Helper to extract user info from token/headers
const getUserFromReq = (req: Request) => {
  const user = (req as any).user;
  if (user?.id) {
    return {
      id: String(user.id),
      username: String(user.username || 'Pemain'),
      display_name: String(user.display_name || user.username || 'Pemain'),
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
          username: String(decoded.username || 'Pemain'),
          display_name: String(decoded.display_name || decoded.username || 'Pemain'),
        };
      }
    } catch (_) {}
  }

  const guestId = (req.headers['x-user-id'] as string) || (req.body?.userId as string) || (req.query.userId as string) || 'guest_user';
  const guestName = (req.headers['x-user-name'] as string) || (req.body?.username as string) || (req.query.username as string) || 'Ngopikawan';
  return {
    id: String(guestId),
    username: String(guestName),
    display_name: String(guestName),
  };
};

// GET /api/pokemon/cards - Catalog of all creatures
router.get('/cards', (_req: Request, res: Response) => {
  const catalog = PokemonService.getCatalog();
  res.status(200).json({ success: true, count: catalog.length, cards: catalog });
});

// GET /api/pokemon/collection - User's card collection
router.get('/collection', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const data = PokemonService.getUserCollection(user.id, user.username);
  res.status(200).json({ success: true, ...data });
});

// POST /api/pokemon/packs/open - Open booster pack (100 points)
router.post('/packs/open', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const result = PokemonService.openBoosterPack(user.id, user.username);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.status(200).json({ success: true, cards: result.cards, remainingPoints: result.remainingPoints });
});

// GET /api/pokemon/trades - List trades
router.get('/trades', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const trades = PokemonService.getTrades(user.id);
  res.status(200).json({ success: true, trades });
});

// POST /api/pokemon/trade/create - Create trade offer
router.post('/trade/create', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { offerCardDefIds, requestCardDefIds, receiverId, receiverName } = req.body;
  const result = PokemonService.createTrade(
    user.id,
    user.display_name || user.username,
    offerCardDefIds || [],
    requestCardDefIds || [],
    receiverId,
    receiverName
  );

  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.status(201).json({ success: true, trade: result.trade });
});

// PATCH /api/pokemon/trade/:id/respond - Accept or decline trade
router.patch('/trade/:id/respond', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const tradeId = req.params.id;
  const { accept } = req.body;

  const result = PokemonService.respondTrade(tradeId, user.id, Boolean(accept));
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.status(200).json({ success: true, trade: result.trade });
});

// POST /api/pokemon/battle/challenge - Create a battle challenge / table
router.post('/battle/challenge', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { targetUserId, warungId } = req.body;

  const table = TableManager.createTable({
    gameType: 'pokemon',
    name: `Duel Monster: @${user.username}`,
    maxPlayers: 2,
    minPlayers: 2,
    isPrivate: false,
    warungId,
    host: {
      id: user.id,
      user_id: user.id,
      username: user.username,
      display_name: user.display_name,
      seat_number: 0,
      is_ready: true,
      is_active: true,
    },
  });

  // If playing against bot or instant challenge
  if (req.body.vsBot) {
    TableManager.addBotToTable(table.id);
  }

  res.status(201).json({ success: true, tableId: table.id, table });
});

// POST /api/pokemon/battle/:id/action - Perform battle action
router.post('/battle/:id/action', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const tableId = req.params.id;
  const { action, payload } = req.body;

  const result = TableManager.handleGameAction(tableId, user.id, action, payload);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }

  const table = TableManager.getTable(tableId);
  res.status(200).json({ success: true, result, table });
});

export default router;
