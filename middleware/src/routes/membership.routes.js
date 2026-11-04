import { Router } from 'express';
import {
  createMembership,
  createWalkInMembership,
  getMyMemberships,
  getMembershipById,
  getGymMemberships,
  cancelMembership,
  previewSwitchPlan,
  requestSwitchPlan,
  getMySwitchRequests,
  getGymSwitchRequests,
  gymActionReviewSwitchRequest,
  requestCancellationNegotiation,
  getMyCancellationNegotiations,
  getGymCancellationNegotiations,
  gymOfferCancellationRefund,
  gymAcceptCancellation,
  gymRejectCancellation,
  memberRespondCancellationOffer,
} from '../controllers/membership.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Purchase / Create Membership
router.post('/', optionalAuthenticate, createMembership);

// Get Memberships for Logged-In User
router.get('/my', optionalAuthenticate, getMyMemberships);

// Get User's Switch Requests History
router.get('/my/switch-requests', optionalAuthenticate, getMySwitchRequests);

// Get Switch Requests for a Gym (Gym Owner)
router.get('/gym/:gymId/switch-requests', optionalAuthenticate, getGymSwitchRequests);

// Gym Owner Review Action (ACCEPT / REJECT)
router.patch('/switch-requests/:requestId/gym-action', optionalAuthenticate, gymActionReviewSwitchRequest);

// Membership cancellation negotiation
router.get('/my/cancellation-negotiations', optionalAuthenticate, getMyCancellationNegotiations);
router.get('/gym/:gymId/cancellation-negotiations', optionalAuthenticate, getGymCancellationNegotiations);
router.post('/cancellation-negotiations/:requestId/gym-offer', optionalAuthenticate, gymOfferCancellationRefund);
router.patch('/cancellation-negotiations/:requestId/gym-accept', optionalAuthenticate, gymAcceptCancellation);
router.patch('/cancellation-negotiations/:requestId/gym-reject', optionalAuthenticate, gymRejectCancellation);
router.patch('/cancellation-negotiations/:requestId/member-response', optionalAuthenticate, memberRespondCancellationOffer);
router.post('/:id/cancellation-negotiation', optionalAuthenticate, requestCancellationNegotiation);

// Get Memberships for a Gym (Gym Owner Portal & Gym Owner Mobile)
router.get('/gym/:gymId', optionalAuthenticate, getGymMemberships);

// Create Walk-in Membership for a Gym (Gym Owner Portal / Desk)
router.post('/gym/:gymId/walk-in', optionalAuthenticate, createWalkInMembership);

// Preview Plan Switch (Prorated Quote Dry-Run)
router.post('/:id/preview-switch', optionalAuthenticate, previewSwitchPlan);

// Request Plan Switch (User Application -> PENDING_GYM_APPROVAL)
router.post('/:id/request-switch', optionalAuthenticate, requestSwitchPlan);

// Get Single Membership Details
router.get('/:id', optionalAuthenticate, getMembershipById);

// Cancel Membership
router.patch('/:id/cancel', optionalAuthenticate, cancelMembership);

export default router;
