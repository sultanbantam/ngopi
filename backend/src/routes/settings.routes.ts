import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(verifyJWT);
router.get('/', getSettings);
router.post('/', updateSettings);

export default router;
