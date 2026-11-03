import { Router } from 'express';
import {
  getMyWallet,
  getGymWallet,
  topUpWallet,
  withdrawWallet,
} from '../controllers/wallet.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Get logged-in user wallet balance & transaction ledger (all gyms or ?gymId=)
router.get('/my', optionalAuthenticate, getMyWallet);

// Get user's wallet for a specific gym
router.get('/gym/:gymId', optionalAuthenticate, getGymWallet);

// Top-up wallet balance for a specific gym
router.post('/top-up', optionalAuthenticate, topUpWallet);

// Request wallet balance withdrawal / refund from a specific gym
router.post('/withdraw', optionalAuthenticate, withdrawWallet);

export default router;
