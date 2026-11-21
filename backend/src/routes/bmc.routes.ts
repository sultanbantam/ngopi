import { Router, Request, Response } from 'express';
import { getBalance } from '../controllers/bmc.controller';
import { claimAirdrop, getAirdropHistory } from '../controllers/airdrop.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation';
import { walletParamsSchema } from '../utils/validation';
import { pointsEconomyService, PREMIUM_CATALOG } from '../services/points.service';
import { telecomService } from '../services/telecom.service';
import { PointsManager } from '../utils/pointsManager';
import { prisma } from '../utils/prisma';

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
    const username = (req as any).user?.username || (req.query.username as string);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User ID required' });
      return;
    }
    pointsEconomyService.syncWithPointsManager(userId, username);
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
    const userId = (req as any).user?.id;
    const { activity_type, reference } = req.body;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized: User authentication required' });
      return;
    }
    if (!activity_type) {
      res.status(400).json({ error: 'activity_type is required' });
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
      case 'daily_mission':
        result = pointsEconomyService.claimDailyMission(userId, reference || 'Misi Warkop');
        break;
      case 'game_won':
      case 'game_played':
        res.status(403).json({ error: 'Poin permainan hanya dapat diberikan secara otomatis oleh server meja permainan (anti-cheat).' });
        return;
      case 'referral':
        res.status(403).json({ error: 'Poin referral hanya diproses saat teman mendaftar melalui tautan resmi.' });
        return;
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

// POST /api/bmc/points/transfer — Peer-to-peer Ngopi Points transfer (terpisah dari BMC)
router.post('/points/transfer', async (req: Request, res: Response) => {
  try {
    const senderId = (req as any).user?.id;
    const senderUsername = (req as any).user?.username;
    if (!senderId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const rawRecipient = String(req.body?.recipient || req.body?.to || '').trim();
    const amount = Math.floor(Number(req.body?.amount || 0));
    const note = String(req.body?.note || '').trim().slice(0, 120);

    if (!rawRecipient) {
      res.status(400).json({ error: 'Masukkan username, Nomor ID Ngopi, atau email @ngopi.top penerima.' });
      return;
    }
    if (!Number.isFinite(amount) || amount < 10 || amount > 100000) {
      res.status(400).json({ error: 'Jumlah transfer minimal 10 Poin dan maksimal 100.000 Poin per transaksi.' });
      return;
    }

    let recipientUser = await telecomService.resolveUserByIdentifier(rawRecipient);
    if (!recipientUser) {
      const cleanU = rawRecipient.replace(/^@/, '').replace(/@ngopi\.top$/i, '').trim();
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: rawRecipient },
            { username: { equals: cleanU, mode: 'insensitive' } },
          ],
        },
        select: { id: true, username: true, display_name: true, role: true, bmc_id: true },
      });
      if (dbUser) {
        recipientUser = await telecomService.resolveUserByIdentifier(dbUser.id);
      }
    }

    if (!recipientUser) {
      res.status(404).json({ error: `Penerima "${rawRecipient}" tidak ditemukan.` });
      return;
    }
    if (recipientUser.id === senderId) {
      res.status(400).json({ error: 'Tidak dapat mentransfer Poin Ngopi ke akun sendiri.' });
      return;
    }

    pointsEconomyService.syncWithPointsManager(senderId, senderUsername);
    const senderStats = pointsEconomyService.getOrCreateUserPoints(senderId);
    const currentBalance = senderStats?.balance ?? 0;

    if (currentBalance < amount) {
      res.status(400).json({
        error: `Saldo Poin Ngopi tidak mencukupi. Saldo Anda: ${currentBalance.toLocaleString('id-ID')} Poin.`,
      });
      return;
    }

    const reference = `TRF-${Date.now().toString(36).toUpperCase()}`;
    const noteSuffix = note ? ` — "${note}"` : '';

    const senderNewBalance = pointsEconomyService.addDirectPoints(
      senderId,
      -amount,
      'purchase_badge' as any,
      `Transfer Poin ke @${recipientUser.username} (#${recipientUser.ngopi_number})${noteSuffix}`,
      reference
    );
    PointsManager.setPoints(senderId, senderNewBalance, true, true);
    if (senderUsername) PointsManager.setPoints(senderUsername, senderNewBalance, true, true);

    pointsEconomyService.syncWithPointsManager(recipientUser.id, recipientUser.username);
    const recipientNewBalance = pointsEconomyService.addDirectPoints(
      recipientUser.id,
      amount,
      'daily_mission',
      `Terima Poin dari @${senderUsername || senderId}${noteSuffix}`,
      reference
    );
    PointsManager.setPoints(recipientUser.id, recipientNewBalance, true, true);
    PointsManager.setPoints(recipientUser.username, recipientNewBalance, true, true);

    res.json({
      success: true,
      reference,
      amount,
      sender_balance: senderNewBalance,
      recipient: {
        id: recipientUser.id,
        username: recipientUser.username,
        display_name: recipientUser.display_name,
        ngopi_number: recipientUser.ngopi_number,
        ngopi_email: recipientUser.ngopi_email,
      },
      message: `Berhasil mengirim ${amount.toLocaleString('id-ID')} Poin Ngopi ke @${recipientUser.username}!`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Gagal melakukan transfer poin.' });
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