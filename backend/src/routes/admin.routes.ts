import { Router } from 'express';
import { requireStaff, verifyJWT } from '../middleware/auth.middleware';
import {
  addAdminTicketMessage,
  assignTicket,
  getTicketStats,
  listAdminTickets,
  updateTicketStatus,
  upsertAdminFaq,
} from '../controllers/ticket.controller';

const router = Router();

router.use(verifyJWT, requireStaff);
router.get('/tickets', listAdminTickets);
router.get('/tickets/stats', getTicketStats);
router.patch('/tickets/:id/status', updateTicketStatus);
router.patch('/tickets/:id/assign', assignTicket);
router.post('/tickets/:id/messages', addAdminTicketMessage);
router.post('/faqs', upsertAdminFaq);

export default router;