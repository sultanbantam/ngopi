import { Router, Request, Response } from 'express';
import { getBalance } from '../controllers/bmc.controller';
import { claimAirdrop, getAirdropHistory } from '../controllers/airdrop.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation';
import { walletParamsSchema } from '../utils/validation';
import { pointsEconomyService, PREMIUM_CATALOG } from '../services/points.service';

const router = Router();

// Public / Auth middleware applied
router.use(verifyJWT);

// Existing wallet endpoints
router.get('/balance/:wallet_address', validateRequest({ params: walletParamsSchema }), getBalance);
router.post('/airdrop/claim', claimAirdrop);
router.get('/airdrop/history', getAirdropHistory);

// --- 7.2 POIN NGOPI ENDPOINTS ---

// GET /api/bmc/points/me — Get user point balance & streak stats
router.get('/points/me', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req.query.user_id as string);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID required' });
      return;
    }
    const up = pointsEconomyService.getOrCreateUserPoints(userId);
    const sub = pointsEconomyService.getSubscription(userId);
    res.json({ success: true, points: up, subscription: sub });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/bmc/points/transactions — Get point transaction history
router.get('/points/transactions', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req.query.user_id as string);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID required' });
      return;
    }
    const txs = pointsEconomyService.getTransactions(userId);
    res.json({ success: true, count: txs.length, transactions: txs });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/bmc/points/streak/claim — Claim daily login streak bonus (+5 * streak)
router.post('/points/streak/claim', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID required' });
      return;
    }
    const result = pointsEconomyService.claimDailyStreak(userId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/bmc/points/earn — Trigger activity reward
router.post('/points/earn', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    const { activity_type, reference } = req.body;
    if (!userId || !activity_type) {
      res.status(400).json({ error: 'userId and activity_type are required' });
      return;
    }

    let result: any;
    switch (activity_type) {
      case 'chat':
        result = pointsEconomyService.earnChatReward(userId);
        break;
      case 'reaction':
        result = pointsEconomyService.earnReactionReward(userId);
        break;
      case 'helper':
        result = pointsEconomyService.earnHelperReward(userId, reference);
        break;
      case 'game_played':
        result = pointsEconomyService.earnGamePlayed(userId, reference);
        break;
      case 'game_won':
        result = pointsEconomyService.earnGameWon(userId, reference);
        break;
      case 'referral':
        result = pointsEconomyService.earnReferralReward(userId, reference || 'friend');
        break;
      case 'daily_mission':
        result = pointsEconomyService.claimDailyMission(userId, reference || 'Misi Warkop');
        break;
      default:
        res.status(400).json({ error: `Unknown activity_type: ${activity_type}` });
        return;
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// --- 7.3 & 7.4 FITUR PREMIUM & CATALOG ---

// GET /api/bmc/premium/catalog — List premium features
router.get('/premium/catalog', (_req: Request, res: Response) => {
  res.json({ success: true, catalog: PREMIUM_CATALOG });
});

// POST /api/bmc/premium/buy — Buy premium feature with Points
router.post('/premium/buy', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    const { feature_id } = req.body;
    if (!userId || !feature_id) {
      res.status(400).json({ error: 'userId and feature_id are required' });
      return;
    }

    const result = pointsEconomyService.purchaseFeatureWithPoints(userId, feature_id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/bmc/points/convert — Convert points to BMC token (1000 Poin = 1 BMC)
router.post('/points/convert', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    const { points_to_convert, wallet_address } = req.body;

    if (!userId || !points_to_convert || !wallet_address) {
      res.status(400).json({ error: 'userId, points_to_convert, and wallet_address are required' });
      return;
    }

    const result = pointsEconomyService.convertPointsToBmc({
      user_id: userId,
      points_to_convert: Number(points_to_convert),
      wallet_address,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Conversion failed' });
  }
});

// --- 7.5 RUANG BIOSKOP (WATCH PARTY) ---

// POST /api/bmc/watch-party/create — Host creates a watch party
router.post('/watch-party/create', (req: Request, res: Response) => {
  try {
    const hostId = (req as any).user?.id || req.body.host_id;
    const hostName = (req as any).user?.display_name || req.body.host_name || 'Host Warkop';
    const { title, video_url, video_type, warung_id } = req.body;

    if (!hostId || !title || !video_url) {
      res.status(400).json({ error: 'hostId, title, and video_url are required' });
      return;
    }

    const party = pointsEconomyService.createWatchParty({
      hostId,
      hostName,
      title,
      videoUrl: video_url,
      videoType: video_type,
      warungId: warung_id,
    });

    res.status(201).json({ success: true, party });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create watch party' });
  }
});

// GET /api/bmc/watch-party/list — List active watch parties
router.get('/watch-party/list', (_req: Request, res: Response) => {
  try {
    const parties = pointsEconomyService.getActiveWatchParties();
    res.json({ success: true, count: parties.length, parties });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/bmc/watch-party/:id — Detail watch party
router.get('/watch-party/:id', (req: Request, res: Response) => {
  try {
    const party = pointsEconomyService.getWatchParty(req.params.id);
    if (!party) {
      res.status(404).json({ error: 'Ruang Bioskop tidak ditemukan' });
      return;
    }
    res.json({ success: true, party });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/bmc/watch-party/:id/control — Playback control (play/pause/seek)
router.post('/watch-party/:id/control', (req: Request, res: Response) => {
  try {
    const hostId = (req as any).user?.id || req.body.host_id;
    const { current_time, is_playing } = req.body;

    const party = pointsEconomyService.updateWatchPartyPlayback({
      partyId: req.params.id,
      hostId,
      currentTime: Number(current_time ?? 0),
      isPlaying: Boolean(is_playing),
    });

    res.json({ success: true, party });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Playback update failed' });
  }
});

// POST /api/bmc/watch-party/:id/join — Join watch party
router.post('/watch-party/:id/join', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    const userName = (req as any).user?.display_name || req.body.user_name || 'Penonton';

    const party = pointsEconomyService.joinWatchParty(req.params.id, userId, userName);
    res.json({ success: true, party });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to join watch party' });
  }
});

// POST /api/bmc/watch-party/:id/leave — Leave watch party
router.post('/watch-party/:id/leave', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    const party = pointsEconomyService.leaveWatchParty(req.params.id, userId);
    res.json({ success: true, party });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to leave watch party' });
  }
});

export default router;