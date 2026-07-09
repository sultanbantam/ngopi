import { Router } from 'express';
import { getBalance } from '../controllers/bmc.controller';
import { claimAirdrop, getAirdropHistory } from '../controllers/airdrop.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyJWT);
router.get('/balance/:wallet_address', getBalance);
router.post('/airdrop/claim', claimAirdrop);
router.get('/airdrop/history', getAirdropHistory);

export default router;

