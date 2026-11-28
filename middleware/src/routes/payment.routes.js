import { Router } from 'express';
import {
  createPaymentOrder,
  verifyPaymentAndFulfill,
  handleRazorpayWebhook,
} from '../controllers/payment.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create-order', optionalAuthenticate, createPaymentOrder);
router.post('/verify', optionalAuthenticate, verifyPaymentAndFulfill);
router.post('/webhook', handleRazorpayWebhook);

export default router;
