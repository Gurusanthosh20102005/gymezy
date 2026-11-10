import { Router } from 'express';
import {
  login,
  googleLogin,
  toggleSso,
  linkGoogleAccount,
  registerCustomer,
  getCurrentUser,
  logoutUser,
  checkEmailAvailability,
  checkPhoneAvailability,
  updateProfile,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/google-login', googleLogin);
router.post('/register', registerCustomer);
router.post('/logout', logoutUser);
router.get('/check-email', checkEmailAvailability);
router.post('/check-email', checkEmailAvailability);
router.get('/check-phone', checkPhoneAvailability);
router.post('/check-phone', checkPhoneAvailability);

// Protected routes
router.get('/me', authenticate, getCurrentUser);
router.patch('/profile', authenticate, updateProfile);
router.put('/profile', authenticate, updateProfile);
router.patch('/toggle-sso', authenticate, toggleSso);
router.post('/link-google', authenticate, linkGoogleAccount);

export default router;

