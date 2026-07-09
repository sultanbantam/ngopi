import { Router } from 'express';
import { getPlatforms } from '../controllers/platform.controller';

const router = Router();

router.get('/', getPlatforms);

export default router;