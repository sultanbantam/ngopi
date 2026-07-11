import { Router } from 'express';
import { requireStaff, verifyJWT } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation';
import {
  adminTicketQuerySchema,
  assignTicketSchema,
  faqUpsertSchema,
  idParamsSchema,
  ticketMessageSchema,
  ticketStatusSchema,
} from '../utils/validation';
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
router.get('/tickets', validateRequest({ query: adminTicketQuerySchema }), listAdminTickets);
router.get('/tickets/stats', getTicketStats);
router.patch('/tickets/:id/status', validateRequest({ params: idParamsSchema, body: ticketStatusSchema }), updateTicketStatus);
router.patch('/tickets/:id/assign', validateRequest({ params: idParamsSchema, body: assignTicketSchema }), assignTicket);
router.post('/tickets/:id/messages', validateRequest({ params: idParamsSchema, body: ticketMessageSchema }), addAdminTicketMessage);
router.post('/faqs', validateRequest({ body: faqUpsertSchema }), upsertAdminFaq);

export default router;