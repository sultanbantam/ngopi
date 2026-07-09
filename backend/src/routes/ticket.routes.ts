import { Router } from 'express';
import { verifyJWT } from '../middleware/auth.middleware';
import {
  addUserTicketMessage,
  closeMyTicket,
  createTicket,
  getTicketMessages,
  listMyTickets,
} from '../controllers/ticket.controller';

const router = Router();

router.use(verifyJWT);
router.post('/', createTicket);
router.get('/my', listMyTickets);
router.get('/:id/messages', getTicketMessages);
router.post('/:id/messages', addUserTicketMessage);
router.patch('/:id/close', closeMyTicket);

export default router;