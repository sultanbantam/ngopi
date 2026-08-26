import { Router } from 'express';
import { approvePayment, completePayment } from '../controllers/payment.controller';

const router = Router();

router.post('/approve', approvePayment);
router.post('/complete', completePayment);

export default router;
