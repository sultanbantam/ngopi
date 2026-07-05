import { Router } from 'express';
import { getMessagesByRoom } from '../controllers/message.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyJWT);
router.get('/:room_id', getMessagesByRoom);

export default router;
