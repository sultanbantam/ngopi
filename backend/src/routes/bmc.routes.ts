import { Router } from 'express';
import { getBalance } from '../controllers/bmc.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyJWT);
router.get('/balance/:wallet_address', getBalance);

export default router;
