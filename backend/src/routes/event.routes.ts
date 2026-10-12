import { Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { EventService } from '../services/event.service';

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

// POST /api/events - Create new game event
router.post('/', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const result = EventService.createEvent(user.id, user.display_name || user.username, req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.status(201).json({ success: true, event: result.event });
});

// GET /api/events/my - List events hosted by user
router.get('/my', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const events = EventService.getMyEvents(user.id);
  res.status(200).json({ success: true, events });
});

// GET /api/events/invited - List invitations received by user
router.get('/invited', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const list = EventService.getInvitedEvents(user.id);
  res.status(200).json({ success: true, invitations: list });
});

// GET /api/events/:id - Get single event detail
router.get('/:id', (req: Request, res: Response) => {
  const event = EventService.getEventById(req.params.id);
  if (!event) {
    return res.status(404).json({ success: false, error: 'Event tidak ditemukan.' });
  }
  res.status(200).json({ success: true, event });
});

// PATCH /api/events/:id/respond - Respond to an invitation (accept or decline)
router.patch('/:id/respond', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const { status } = req.body;
  if (status !== 'accepted' && status !== 'declined') {
    return res.status(400).json({ success: false, error: 'Status harus "accepted" atau "declined".' });
  }

  const result = EventService.respondInvitation(req.params.id, user.id, status);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.status(200).json({ success: true, event: result.event, invitation: result.invitation });
});

// POST /api/events/:id/start - Host starts event (auto-creates GameTable)
router.post('/:id/start', async (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const result = await EventService.startEvent(req.params.id, user.id);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.status(200).json({ success: true, tableId: result.tableId, event: result.event });
});

// DELETE /api/events/:id - Cancel event
router.delete('/:id', (req: Request, res: Response) => {
  const user = getUserFromReq(req);
  const result = EventService.cancelEvent(req.params.id, user.id);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error });
  }
  res.status(200).json({ success: true, event: result.event });
});

export default router;
