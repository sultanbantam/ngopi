import { Router, Request, Response } from 'express';
import { moderationService } from '../services/moderation.service';
import { verifyJWT } from '../middleware/auth.middleware';
import { ModerationActionType } from '../models/moderation.types';

const router = Router();

// Protect all moderation endpoints with verifyJWT
router.use(verifyJWT);

// 1. POST /api/moderation/check - Check a message for violations
router.post('/check', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || req.body.user_id;
    const { content, warung_id } = req.body;

    if (!userId || !content) {
      res.status(400).json({ error: 'User ID and content are required' });
      return;
    }

    const result = await moderationService.moderateMessage(userId, content, warung_id);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 2. POST /api/moderation/report - Submit a user report
router.post('/report', (req: Request, res: Response) => {
  try {
    const reporterId = (req as any).user?.id;
    const reporterName = (req as any).user?.username;
    const { reported_user_id, reported_user_name, reason, warung_id, message_content } = req.body;

    if (!reporterId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!reported_user_id || !reason) {
      res.status(400).json({ error: 'reported_user_id and reason are required' });
      return;
    }

    const report = moderationService.submitReport({
      reporterId,
      reporterName,
      reportedUserId: reported_user_id,
      reportedUserName: reported_user_name,
      reason,
      warungId: warung_id,
      messageContent: message_content,
    });

    res.status(201).json({ success: true, report });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 3. GET /api/moderation/status/me - Get current user's moderation status
router.get('/status/me', (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const isBlacklisted = moderationService.isUserBlacklisted(userId);
    const banStatus = moderationService.isUserBanned(userId);
    const muteStatus = moderationService.isUserMuted(userId);
    const history = moderationService.getUserModerationHistory(userId);

    res.json({
      success: true,
      user_id: userId,
      is_blacklisted: isBlacklisted,
      ban_status: banStatus,
      mute_status: muteStatus,
      recent_actions: history.slice(0, 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 4. GET /api/moderation/status/:userId - Get moderation status for a user
router.get('/status/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const isBlacklisted = moderationService.isUserBlacklisted(userId);
    const banStatus = moderationService.isUserBanned(userId);
    const muteStatus = moderationService.isUserMuted(userId);
    const history = moderationService.getUserModerationHistory(userId);

    res.json({
      success: true,
      user_id: userId,
      is_blacklisted: isBlacklisted,
      ban_status: banStatus,
      mute_status: muteStatus,
      recent_actions: history,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 5. GET /api/moderation/queue - Review queue (pending reports)
router.get('/queue', (_req: Request, res: Response) => {
  try {
    const queue = moderationService.getReviewQueue();
    res.json({ success: true, count: queue.length, queue });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 6. POST /api/moderation/queue/:id/resolve - Resolve report
router.post('/queue/:id/resolve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.body as { action: ModerationActionType | 'dismiss' };
    const reviewerId = (req as any).user?.id;

    if (!action) {
      res.status(400).json({ error: 'Action is required (warning, mute, kick, ban, blacklist, dismiss)' });
      return;
    }

    const resolved = moderationService.resolveReport(id, action, reviewerId);
    if (!resolved) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json({ success: true, message: `Report ${id} resolved with action: ${action}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 7. GET /api/moderation/blacklist - Get all blacklisted users
router.get('/blacklist', (_req: Request, res: Response) => {
  try {
    const blacklist = moderationService.getBlacklist();
    res.json({ success: true, count: blacklist.length, blacklist });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 8. POST /api/moderation/blacklist - Add user to blacklist
router.post('/blacklist', (req: Request, res: Response) => {
  try {
    const { user_id, reason, ip_address } = req.body;
    if (!user_id || !reason) {
      res.status(400).json({ error: 'user_id and reason are required' });
      return;
    }

    const entry = moderationService.addToBlacklist(user_id, reason, ip_address);
    res.status(201).json({ success: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// 9. DELETE /api/moderation/blacklist/:userId - Remove user from blacklist
router.delete('/blacklist/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const removed = moderationService.removeFromBlacklist(userId);
    res.json({ success: true, removed });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

export default router;
