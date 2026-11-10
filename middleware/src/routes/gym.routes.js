import { Router } from 'express';
import {
  onboardGym,
  getGymZones,
  getGyms,
  getGymOptions,
  getAdminGymsFleet,
  getGymById,
  getGymTrainers,
  updateGym,
  updateGymTrainerPricing,
  updateGymStatus,
  resubmitGymApplication,
  deleteGym,
  getGymTransactions,
  getGymDashboardStats,
  toggleBookmarkGym,
  getMyBookmarkedGyms,
  syncGuestBookmarks,
} from '../controllers/gym.controller.js';
import {
  getGymReviews,
  getTrainerReviews,
  addGymReview,
  addTrainerReview,
} from '../controllers/gymReviews.controller.js';
import { authenticate, optionalAuthenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/role.middleware.js';
import { USER_ROLES } from '../models/user.model.js';

const router = Router();

// ==================== PUBLIC / DISCOVERY ROUTES ====================
// Lightweight Gym Options / Dropdown with Infinite Scroll & Search
router.get('/options', optionalAuthenticate, getGymOptions);

// Public Partner Self-Registration endpoint (No JWT required, created with Pending Approval)
router.post('/register', onboardGym);

// Public City & Zone Chips aggregator endpoint
router.get('/zones', getGymZones);
router.get('/popular-cities', getGymZones);

// Public / Authenticated Gym Search & Proximity Discovery (Calculates distance via coordinates)
router.get('/', optionalAuthenticate, getGyms);

// Dedicated Super Admin Gym Fleet Endpoint (Full data, verification docs, logo URLs, audit records)
router.get('/admin/fleet', optionalAuthenticate, getAdminGymsFleet);
router.get('/admin/list', optionalAuthenticate, getAdminGymsFleet);

// ==================== REVIEWS & RATINGS SEPARATE APIS ====================
// Public: Get all ratings/reviews for a gym with reviewer user details and histograms
router.get('/:id/reviews', optionalAuthenticate, getGymReviews);
router.get('/:id/ratings', optionalAuthenticate, getGymReviews);

// Public: Get all reviews for a specific trainer in a gym with reviewer user details
router.get('/:id/trainers/:trainerId/reviews', optionalAuthenticate, getTrainerReviews);
router.get('/:id/trainers/:trainerId/ratings', optionalAuthenticate, getTrainerReviews);

// Authenticated: Submit a member rating/review for a gym
router.post('/:id/reviews', authenticate, addGymReview);
router.post('/:id/ratings', authenticate, addGymReview);

// Authenticated: Submit a review for a specific trainer in a gym
router.post('/:id/trainers/:trainerId/reviews', authenticate, addTrainerReview);
router.post('/:id/trainers/:trainerId/ratings', authenticate, addTrainerReview);

// Gym Owner & Admin: Scoped Financial Transactions & Payments Endpoint
router.get('/:id/transactions', optionalAuthenticate, getGymTransactions);
router.get('/:id/payments', optionalAuthenticate, getGymTransactions);

// Gym Owner & Admin: Scoped Overview Dashboard Statistics & Recent Activity
router.get('/:id/dashboard-stats', optionalAuthenticate, getGymDashboardStats);
router.get('/:id/dashboard', optionalAuthenticate, getGymDashboardStats);
router.get('/:id/overview', optionalAuthenticate, getGymDashboardStats);

// ==================== BOOKMARK ROUTES ====================
// Authenticated: Get my bookmarked gyms
router.get('/bookmarks/my', authenticate, getMyBookmarkedGyms);

// Authenticated: Sync guest / offline bookmarked gym IDs into MongoDB
router.post('/bookmarks/sync', authenticate, syncGuestBookmarks);

// Authenticated: Toggle bookmark status for a gym
router.post('/:id/bookmark', authenticate, toggleBookmarkGym);

// Public / Authenticated Single Gym Details
router.get('/:id', optionalAuthenticate, getGymById);

// Public / Authenticated Gym Trainers Endpoint (SSOT from Employee model)
router.get('/:id/trainers', optionalAuthenticate, getGymTrainers);

// ==================== PROTECTED / ADMIN & OWNER ROUTES ====================
// Onboard new gym partner (Authenticated via Super Admin JWT)
router.post('/onboard', authenticate, onboardGym);
router.post('/', authenticate, onboardGym);

// Update gym profile & application details (Owner or Super Admin)
router.put(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  updateGym
);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  updateGym
);

// Update trainer-membership tier pricing mapping for trainers
router.put(
  '/:id/trainer-pricing',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  updateGymTrainerPricing
);
router.patch(
  '/:id/trainer-pricing',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  updateGymTrainerPricing
);

// Partner Owner or Super Admin application resubmission
router.post(
  '/:id/resubmit',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  resubmitGymApplication
);
router.patch(
  '/:id/resubmit',
  authenticate,
  authorizeRoles(USER_ROLES.GYM_OWNER, USER_ROLES.SUPER_ADMIN),
  resubmitGymApplication
);

// Super Admin status updates
router.patch(
  '/:id/status',
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  updateGymStatus
);

// Super Admin delete gym
router.delete(
  '/:id',
  authenticate,
  authorizeRoles(USER_ROLES.SUPER_ADMIN),
  deleteGym
);

export default router;

