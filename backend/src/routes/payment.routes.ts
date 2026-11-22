import { Router } from 'express';
import { approvePayment, completePayment, getPaymentHistory } from '../controllers/payment.controller';

const router = Router();

router.get('/history', getPaymentHistory);
router.post('/approve', approvePayment);
router.post('/complete', completePayment);

export default router;
