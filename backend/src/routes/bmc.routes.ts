import { Router } from 'express';
import { getBalance } from '../controllers/bmc.controller';
import { claimAirdrop, getAirdropHistory } from '../controllers/airdrop.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation';
import { walletParamsSchema } from '../utils/validation';

const router = Router();

router.use(verifyJWT);
router.get('/balance/:wallet_address', validateRequest({ params: walletParamsSchema }), getBalance);
router.post('/airdrop/claim', claimAirdrop);
router.get('/airdrop/history', getAirdropHistory);

export default router;