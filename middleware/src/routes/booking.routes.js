import { Router } from 'express';
import {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getSectionEnrollments,
  requestReschedule,
  reviewReschedule,
  respondRescheduleProposal,
  getGymBookings,
  createWalkInBooking,
} from '../controllers/booking.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Create booking (Section, Group Class, or Gym Session)
router.post('/', optionalAuthenticate, createBooking);

// Get bookings for the logged-in user
router.get('/my', optionalAuthenticate, getMyBookings);

// Get all bookings for a gym (Gym Owner portal)
router.get('/gym/:gymId', optionalAuthenticate, getGymBookings);

// Create walk-in booking at the desk (Gym Owner / Manager / Staff)
router.post('/gym/:gymId/walk-in', optionalAuthenticate, createWalkInBooking);

// Get section enrollments roster (Gym Owner & Staff)
router.get('/section/:sectionId', optionalAuthenticate, getSectionEnrollments);

// Custom dates reschedule endpoints
router.post('/:id/request-reschedule', optionalAuthenticate, requestReschedule);
router.post('/:id/review-reschedule', optionalAuthenticate, reviewReschedule);
router.post('/:id/respond-proposal', optionalAuthenticate, respondRescheduleProposal);

// Get single booking details
router.get('/:id', optionalAuthenticate, getBookingById);

// Cancel booking
router.patch('/:id/cancel', optionalAuthenticate, cancelBooking);

export default router;
