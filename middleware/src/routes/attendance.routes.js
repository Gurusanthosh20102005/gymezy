import { Router } from 'express';
import {
  checkInMember,
  checkOutMember,
  getTodayAttendance,
  searchGymMembersForCheckIn,
  triggerAttendanceCron,
  getMyAttendanceHistory,
} from '../controllers/attendance.controller.js';
import { optionalAuthenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Check-in via QR or OTP
router.post('/check-in', checkInMember);

// Check-out
router.post('/check-out', checkOutMember);

// Today's attendance logs (Gym Portal)
router.get('/today', getTodayAttendance);

// User's attendance history (All, or filtered by membershipId or bookingId)
router.get('/my-history', optionalAuthenticate, getMyAttendanceHistory);

// Search members for quick manual check-in
router.get('/members', searchGymMembersForCheckIn);

// Manually trigger auto-checkout cron
router.post('/trigger-cron', triggerAttendanceCron);

export default router;

