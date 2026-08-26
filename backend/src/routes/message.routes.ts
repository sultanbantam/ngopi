import { Router } from 'express';
import { getMessagesByRoom, getUnreadCounts } from '../controllers/message.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { messageLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation';
import { roomParamsSchema } from '../utils/validation';

const router = Router();

router.use(verifyJWT);
router.get('/unread/counts', messageLimiter, getUnreadCounts);
router.get('/:room_id', messageLimiter, validateRequest({ params: roomParamsSchema }), getMessagesByRoom);

export default router;