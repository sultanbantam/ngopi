import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import {
  addUserTicketMessage,
  closeMyTicket,
  createTicket,
  getTicketMessages,
  listMyTickets,
} from '../controllers/ticket.controller';
import { validateRequest } from '../middleware/validation';
import { createTicketSchema, idParamsSchema, ticketMessageSchema } from '../utils/validation';

const router = Router();

router.use(verifyJWT);
router.post('/', validateRequest({ body: createTicketSchema }), createTicket);
router.get('/my', listMyTickets);
router.get('/:id/messages', validateRequest({ params: idParamsSchema }), getTicketMessages);
router.post('/:id/messages', validateRequest({ params: idParamsSchema, body: ticketMessageSchema }), addUserTicketMessage);
router.patch('/:id/close', validateRequest({ params: idParamsSchema }), closeMyTicket);

export default router;