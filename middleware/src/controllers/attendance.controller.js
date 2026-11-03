import mongoose from 'mongoose';
import crypto from 'node:crypto';
import Attendance from '../models/attendance.model.js';
import Membership from '../models/membership.model.js';
import Booking from '../models/booking.model.js';
import MembershipSwitchRequest from '../models/membershipSwitchRequest.model.js';
import Gym from '../models/gym.model.js';
import { autoCheckoutStaleRecords } from '../services/attendanceCron.service.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

/**
 * Resolve Gym by ID or partnerId
 */
const resolveGym = async (gymId) => {
  if (!gymId) {
    throw ApiError.badRequest('Gym ID is required.');
  }
  const isObjectId = mongoose.Types.ObjectId.isValid(gymId);
  const gym = await Gym.findOne(
    isObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
  );
  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }
  return gym;
};

/**
 * Parse QR or code input to extract lookup criteria
 */
const parseCodePayload = (rawCode) => {
  if (!rawCode || typeof rawCode !== 'string') {
    return { otp: null, id: null, raw: rawCode };
  }

  const trimmed = rawCode.trim();

  // Try parsing JSON format
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        otp: parsed.entryOtp || parsed.otp || null,
        id: parsed.id || parsed.membershipId || parsed.bookingId || parsed._id || null,
        userId: parsed.userId || null,
        raw: trimmed,
      };
    } catch {
      // JSON parse fallback
    }
  }

  // 6 digit numeric OTP
  if (/^\d{6}$/.test(trimmed)) {
    return { otp: trimmed, id: null, raw: trimmed };
  }

  return { otp: null, id: trimmed, raw: trimmed };
};

/**
 * Find Membership matching code or OTP for a specific gym
 */
const findMembershipForEntry = async (gymDbId, parsedInfo) => {
  const { otp, id, raw } = parsedInfo;

  // 1. If OTP is provided, query by gymId and entryOtp
  if (otp) {
    const mem = await Membership.findOne({ gymId: gymDbId, entryOtp: otp })
      .populate('userId', 'fullName name phone email avatar profilePicture customerProfile customerId')
      .populate('gymId', 'name partnerId address');
    if (mem) return mem;
  }

  // 2. Query by MongoDB _id if valid
  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const mem = await Membership.findOne({ _id: id, gymId: gymDbId })
      .populate('userId', 'fullName name phone email avatar profilePicture customerProfile customerId')
      .populate('gymId', 'name partnerId address');
    if (mem) return mem;
  }

  // 3. Query by membershipId string (e.g. MEM001)
  if (id || raw) {
    const memId = id || raw;
    const mem = await Membership.findOne({ membershipId: memId, gymId: gymDbId })
      .populate('userId', 'fullName name phone email avatar profilePicture customerProfile customerId')
      .populate('gymId', 'name partnerId address');
    if (mem) return mem;
  }

  return null;
};

/**
 * Find Booking matching code or OTP for a specific gym
 */
const findBookingForEntry = async (gymDbId, parsedInfo) => {
  const { otp, id, raw } = parsedInfo;
  const sectionPopulate = 'title category startTime endTime durationDays activeDays startDate endDate';

  if (otp) {
    const booking = await Booking.findOne({
      gymId: gymDbId,
      $or: [{ entryOtp: otp }, { 'customDates.dailyOtp': otp }],
    })
      .populate('userId', 'fullName name phone email avatar profilePicture customerProfile customerId')
      .populate('gymId', 'name partnerId address')
      .populate('sectionId', sectionPopulate);
    if (booking) return booking;
  }

  if (id && mongoose.Types.ObjectId.isValid(id)) {
    const booking = await Booking.findOne({ _id: id, gymId: gymDbId })
      .populate('userId', 'fullName name phone email avatar profilePicture customerProfile customerId')
      .populate('gymId', 'name partnerId address')
      .populate('sectionId', sectionPopulate);
    if (booking) return booking;
  }

  if (id || raw) {
    const bId = id || raw;
    const booking = await Booking.findOne({ bookingId: bId, gymId: gymDbId })
      .populate('userId', 'fullName name phone email avatar profilePicture customerProfile customerId')
      .populate('gymId', 'name partnerId address')
      .populate('sectionId', sectionPopulate);
    if (booking) return booking;
  }

  return null;
};

/**
 * Check-In / Check-Out Member via QR Code or OTP
 * POST /api/v1/attendance/check-in
 */
export const checkInMember = async (req, res, next) => {
  try {
    const { gymId, code, otp, method = 'QR', area = 'General Workout', verifiedBy = 'Turnstile Scanner' } = req.body;

    const gym = await resolveGym(gymId);
    const lookupCode = (code || otp || '').toString().trim();
    if (!lookupCode) {
      throw ApiError.badRequest('Please enter or scan a valid QR code or 6-digit OTP.');
    }

    const parsedInfo = parseCodePayload(lookupCode);
    if (otp && !parsedInfo.otp) {
      parsedInfo.otp = otp.toString().trim();
    }

    // 1. Identify pass (Membership or Booking)
    const membership = await findMembershipForEntry(gym._id, parsedInfo);
    let booking = null;
    if (!membership) {
      booking = await findBookingForEntry(gym._id, parsedInfo);
    }

    if (!membership && !booking) {
      throw ApiError.notFound(
        'No active membership, session, or section pass found matching this Pass/OTP. Please try again or verify your booking code.'
      );
    }

    const targetUser = membership ? membership.userId : booking.userId;
    const targetUserId = targetUser?._id || targetUser;
    const now = new Date();

    // 2. CHECK FOR ACTIVE CHECK-IN (TAP-OUT / AUTO CHECKOUT ON RESCAN)
    const existingActive = await Attendance.findOne({
      userId: targetUserId,
      gymId: gym._id,
      status: 'Checked-In',
    }).sort({ checkInTime: -1 });

    if (existingActive) {
      const diffMs = now.getTime() - new Date(existingActive.checkInTime).getTime();
      const minDebounceMs = 2 * 60 * 1000; // 2 minutes debounce

      if (diffMs < minDebounceMs) {
        const waitSecs = Math.max(1, Math.ceil((minDebounceMs - diffMs) / 1000));
        throw ApiError.badRequest(
          `Member was checked in ${Math.floor(diffMs / 1000)} seconds ago. To prevent accidental double-scanning, please wait ${waitSecs} seconds before checking out.`
        );
      }

      // Record Check-Out
      existingActive.checkOutTime = now;
      existingActive.status = 'Completed';
      await existingActive.save();

      await existingActive.populate('userId', 'fullName name phone email avatar profilePicture customerProfile customerId');
      if (existingActive.membershipId) {
        await existingActive.populate('membershipId', 'membershipId membershipTier');
      }
      if (existingActive.bookingId) {
        await existingActive.populate('bookingId', 'bookingId title category sectionId');
      }

      const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      const durationStr = diffMins >= 60 ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m` : `${diffMins} mins`;

      const responseData = {
        action: 'CHECK_OUT',
        attendanceId: existingActive._id,
        status: 'Checked-Out',
        attendanceStatus: 'Completed',
        checkInTime: existingActive.checkInTime,
        checkOutTime: existingActive.checkOutTime,
        durationStr,
        method: method.toUpperCase() === 'OTP' ? 'OTP' : 'QR',
        area: existingActive.area,
        member: {
          id: targetUser?._id,
          name: targetUser?.fullName || targetUser?.name || 'Gym Member',
          phone: targetUser?.phone || 'N/A',
          avatar: targetUser?.avatar || targetUser?.profilePicture || null,
          membershipId: existingActive.membershipId?.membershipId || null,
          bookingId: existingActive.bookingId?.bookingId || null,
          tier: existingActive.membershipId?.membershipTier || null,
        },
      };

      return res.status(200).json(
        ApiResponse.success(
          responseData,
          `Check-out recorded successfully for ${targetUser?.fullName || targetUser?.name || 'Member'}! Duration: ${durationStr}`
        )
      );
    }

    // 3. PROCEED WITH CHECK-IN

    // --- CASE A: BOOKING PASS (SECTION / CUSTOM DATES / GYM PASS) ---
    if (booking) {
      if (booking.status === 'Cancelled') {
        throw ApiError.badRequest('This booking pass has been cancelled. Entry is not permitted.');
      }

      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
      let recordedArea = booking.title || area;

      // 3.1. SECTION & GROUP CLASS SPECIFIC VALIDATION & ATTENDANCE
      if (booking.bookingType === 'SECTION' || booking.bookingType === 'GROUP_CLASS') {
        const section = booking.sectionId;

        // Date window validation
        if (booking.startDate) {
          const startStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(booking.startDate));
          if (todayStr < startStr) {
            const startFmt = new Date(booking.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            throw ApiError.badRequest(`This section batch starts on ${startFmt}. Entry is not permitted before the batch start date.`);
          }
        }

        if (booking.endDate) {
          const endStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(booking.endDate));
          if (todayStr > endStr) {
            const endFmt = new Date(booking.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            throw ApiError.badRequest(`This section batch has ended on ${endFmt}. Pass is no longer valid.`);
          }
        }

        // Active days validation (e.g. Mon, Wed, Fri)
        const currentWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(now);
        if (section && Array.isArray(section.activeDays) && section.activeDays.length > 0) {
          const isDayActive = section.activeDays.some(
            (d) => d.toLowerCase().slice(0, 3) === currentWeekday.toLowerCase().slice(0, 3)
          );
          if (!isDayActive) {
            throw ApiError.badRequest(
              `Today (${currentWeekday}) is not an active session day for this section. Scheduled active days: ${section.activeDays.join(', ')}.`
            );
          }
        }

        // Check if member already attended this section batch today
        const alreadyAttendedToday = (booking.attendanceHistory || []).some((h) => {
          if (!h.attendedAt) return false;
          const hStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(h.attendedAt));
          return hStr === todayStr;
        });

        if (alreadyAttendedToday) {
          throw ApiError.badRequest('Member has already attended their scheduled session for this section today.');
        }

        // Increment attended sessions count and append to attendance history
        booking.attendedSessionsCount = (booking.attendedSessionsCount || 0) + 1;
        if (!Array.isArray(booking.attendanceHistory)) {
          booking.attendanceHistory = [];
        }
        booking.attendanceHistory.push({
          attendedAt: now,
          method: method.toUpperCase() === 'OTP' ? 'OTP' : 'QR',
          area: section?.title || booking.title,
        });

        if (booking.status === 'Upcoming') {
          booking.status = 'Active';
        }
        if (booking.durationDays && booking.attendedSessionsCount >= booking.durationDays) {
          booking.status = 'Completed';
        }
        await booking.save();

        recordedArea = booking.bookingType === 'GROUP_CLASS'
          ? `Group Class - ${section?.title || booking.title}`
          : `Section - ${section?.title || booking.title}`;
      }

      // 3.2. CUSTOM DATES BOOKING VALIDATION & ATTENDANCE
      else if (booking.isCustomDates || (Array.isArray(booking.customDates) && booking.customDates.length > 0)) {
        const todaySession = booking.customDates.find((item) => {
          if (!item.date) return false;
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(item.date));
          return dStr === todayStr;
        });

        if (!todaySession) {
          const futureSessions = booking.customDates
            .filter((item) => {
              if (!item.date || (item.status !== 'Scheduled' && item.status !== 'Rescheduled')) return false;
              const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(item.date));
              return dStr > todayStr;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const nextMsg = futureSessions.length > 0
            ? ` Your next booked session is on ${new Date(futureSessions[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
            : ' No further sessions are scheduled on this pass.';

          throw ApiError.badRequest(
            `This custom booking pass is not valid for today (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}).${nextMsg}`
          );
        }

        if (todaySession.status === 'Attended') {
          throw ApiError.badRequest('You have already attended your gym session for today.');
        }

        if (todaySession.status !== 'Scheduled' && todaySession.status !== 'Rescheduled') {
          throw ApiError.badRequest(
            `Your session for today is marked as ${todaySession.status}. Entry is not permitted.`
          );
        }

        todaySession.status = 'Attended';
        todaySession.attendedAt = now;
        booking.attendedSessionsCount = (booking.attendedSessionsCount || 0) + 1;
        if (!Array.isArray(booking.attendanceHistory)) {
          booking.attendanceHistory = [];
        }
        booking.attendanceHistory.push({
          attendedAt: now,
          method: method.toUpperCase() === 'OTP' ? 'OTP' : 'QR',
          area: booking.title,
        });
        booking.markModified('customDates');
        await booking.save();
      }

      // 3.3. REGULAR GYM SESSION PASS
      else {
        booking.attendedSessionsCount = (booking.attendedSessionsCount || 0) + 1;
        if (!Array.isArray(booking.attendanceHistory)) {
          booking.attendanceHistory = [];
        }
        booking.attendanceHistory.push({
          attendedAt: now,
          method: method.toUpperCase() === 'OTP' ? 'OTP' : 'QR',
          area: booking.title || area,
        });
        if (booking.status === 'Upcoming') {
          booking.status = 'Active';
        }
        await booking.save();
      }

      const attendance = await Attendance.create({
        userId: targetUserId,
        gymId: gym._id,
        bookingId: booking._id,
        membershipId: null,
        method: method.toUpperCase() === 'OTP' ? 'OTP' : 'QR',
        checkInTime: now,
        status: 'Checked-In',
        area: recordedArea,
        verifiedBy,
      });

      const responseData = {
        action: 'CHECK_IN',
        attendanceId: attendance._id,
        status: 'Granted',
        attendanceStatus: attendance.status,
        checkInTime: attendance.checkInTime,
        method: attendance.method,
        area: attendance.area,
        member: {
          id: targetUser?._id,
          name: targetUser?.fullName || targetUser?.name || 'Gym Member',
          phone: targetUser?.phone || 'N/A',
          avatar: targetUser?.avatar || targetUser?.profilePicture || null,
          bookingId: booking.bookingId,
          bookingType: booking.bookingType,
          title: booking.title,
          status: booking.status,
          entryOtp: booking.entryOtp,
          attendedSessionsCount: booking.attendedSessionsCount,
          durationDays: booking.durationDays,
        },
      };

      return res.status(201).json(ApiResponse.created(responseData, 'Check-in verified successfully. Access granted.'));
    }

    // --- CASE B: MEMBERSHIP PASS ---
    if (membership.status === 'Cancelled') {
      throw ApiError.badRequest('This membership pass has been cancelled. Entry is not permitted.');
    }

    const pendingReview = await MembershipSwitchRequest.findOne({
      membershipId: membership._id,
      status: { $in: ['PENDING_GYM_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL'] },
    }).lean();

    if (pendingReview) {
      throw ApiError.badRequest(
        'Your membership plan switch request is currently under review. Gym entry is paused until review completion.'
      );
    }

    if (membership.startDate && new Date(membership.startDate) > now) {
      const startStr = new Date(membership.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      throw ApiError.badRequest(`Membership pass is not active yet (Starts on ${startStr}). Entry is not permitted before the start date.`);
    }

    if (membership.endDate && new Date(membership.endDate) < now) {
      throw ApiError.badRequest('Membership has expired. Renewal required before entry.');
    }

    if (membership.status !== 'Active') {
      membership.status = 'Active';
      if (!membership.entryOtp) {
        membership.entryOtp = crypto.randomInt(100000, 1000000).toString();
      }
      await Membership.updateOne(
        { _id: membership._id },
        { status: 'Active', entryOtp: membership.entryOtp }
      );
    }

    const attendance = await Attendance.create({
      userId: targetUserId,
      gymId: gym._id,
      membershipId: membership._id,
      bookingId: null,
      method: method.toUpperCase() === 'OTP' ? 'OTP' : 'QR',
      checkInTime: now,
      status: 'Checked-In',
      area,
      verifiedBy,
    });

    const responseData = {
      action: 'CHECK_IN',
      attendanceId: attendance._id,
      status: 'Granted',
      attendanceStatus: attendance.status,
      checkInTime: attendance.checkInTime,
      method: attendance.method,
      area: attendance.area,
      member: {
        id: targetUser?._id,
        name: targetUser?.fullName || targetUser?.name || 'Gym Member',
        phone: targetUser?.phone || 'N/A',
        avatar: targetUser?.avatar || targetUser?.profilePicture || null,
        membershipId: membership.membershipId,
        tier: membership.membershipTier,
        endDate: membership.endDate,
        status: membership.status,
        entryOtp: membership.entryOtp,
      },
    };

    return res.status(201).json(ApiResponse.created(responseData, 'Check-in verified successfully. Access granted.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Check-Out Member
 * POST /api/v1/attendance/check-out
 */
export const checkOutMember = async (req, res, next) => {
  try {
    const { attendanceId, userId, gymId, membershipId } = req.body;

    let attendanceRecord = null;

    if (attendanceId && mongoose.Types.ObjectId.isValid(attendanceId)) {
      attendanceRecord = await Attendance.findById(attendanceId);
    } else if (userId && gymId) {
      const gym = await resolveGym(gymId);
      attendanceRecord = await Attendance.findOne({
        userId,
        gymId: gym._id,
        status: 'Checked-In',
      }).sort({ checkInTime: -1 });
    } else if (membershipId && gymId) {
      const gym = await resolveGym(gymId);
      attendanceRecord = await Attendance.findOne({
        membershipId,
        gymId: gym._id,
        status: 'Checked-In',
      }).sort({ checkInTime: -1 });
    }

    if (!attendanceRecord) {
      throw ApiError.notFound('No active check-in session found to check out.');
    }

    if (attendanceRecord.status === 'Completed') {
      return res.status(200).json(ApiResponse.success(attendanceRecord, 'Member is already checked out.'));
    }

    attendanceRecord.checkOutTime = new Date();
    attendanceRecord.status = 'Completed';
    await attendanceRecord.save();

    await attendanceRecord.populate('userId', 'fullName phone email avatar profilePicture');
    await attendanceRecord.populate('membershipId', 'membershipId membershipTier');

    return res.status(200).json(ApiResponse.success(attendanceRecord, 'Check-out completed successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Today's Attendance Logs for Gym
 * GET /api/v1/attendance/today?gymId=...
 */
export const getTodayAttendance = async (req, res, next) => {
  try {
    const { gymId, date } = req.query;
    if (!gymId) {
      throw ApiError.badRequest('Gym ID is required.');
    }

    const gym = await resolveGym(gymId);

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const logs = await Attendance.find({
      gymId: gym._id,
      checkInTime: { $gte: startOfDay, $lte: endOfDay },
    })
      .populate('userId', 'fullName phone email avatar profilePicture customerProfile customerId')
      .populate('membershipId', 'membershipId membershipTier startDate endDate status entryOtp')
      .populate('bookingId', 'bookingId title category sectionId entryOtp')
      .sort({ checkInTime: -1 })
      .lean();

    const formattedLogs = logs.map((log) => {
      const user = log.userId;
      const mem = log.membershipId;
      const bk = log.bookingId;

      const checkInDate = new Date(log.checkInTime);
      const timeStr = checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let checkOutStr = '-';
      let durationStr = '-';
      if (log.checkOutTime) {
        const outDate = new Date(log.checkOutTime);
        checkOutStr = outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const diffMins = Math.max(1, Math.round((outDate.getTime() - checkInDate.getTime()) / (1000 * 60)));
        durationStr = diffMins >= 60 ? `${Math.floor(diffMins / 60)}h ${diffMins % 60}m` : `${diffMins} mins`;
      }

      return {
        key: log._id.toString(),
        attendanceId: log._id.toString(),
        passId: mem?.membershipId || bk?.bookingId || 'PASS-' + log._id.toString().slice(-6),
        membershipId: mem?.membershipId || bk?.bookingId || 'N/A',
        userId: user?._id?.toString() || 'N/A',
        customerId: user?.customerId || user?._id?.toString().slice(-8) || 'N/A',
        memberName: user?.fullName || 'Gym Member',
        avatar: user?.avatar || user?.profilePicture || null,
        phone: user?.phone || 'N/A',
        plan: mem?.membershipTier || (bk ? `Section: ${bk.title}` : 'General Pass'),
        time: timeStr,
        checkInTime: log.checkInTime,
        checkOutTime: log.checkOutTime,
        checkOutStr,
        durationStr,
        otp: mem?.entryOtp || '------',
        status: log.status === 'Checked-In' ? 'GRANTED' : 'COMPLETED',
        attendanceStatus: log.status,
        method: log.method === 'OTP' ? 'OTP Entry' : 'QR Code',
        rawMethod: log.method,
        area: log.area || 'General Workout',
        gate: 'Main Turnstile 01',
      };
    });

    // Summary counts
    const totalToday = formattedLogs.length;
    const currentlyInside = formattedLogs.filter((l) => l.attendanceStatus === 'Checked-In').length;
    const completedSessions = totalToday - currentlyInside;

    return res.status(200).json(
      ApiResponse.success(
        {
          logs: formattedLogs,
          summary: {
            totalToday,
            currentlyInside,
            completedSessions,
          },
        },
        "Today's attendance logs retrieved successfully."
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Search active members of this gym for quick lookup
 * GET /api/v1/attendance/members?gymId=...&query=...
 */
export const searchGymMembersForCheckIn = async (req, res, next) => {
  try {
    const { gymId, query = '' } = req.query;
    if (!gymId) {
      throw ApiError.badRequest('Gym ID is required.');
    }

    const gym = await resolveGym(gymId);

    const memberships = await Membership.find({
      gymId: gym._id,
      status: { $in: ['Active', 'Upcoming', 'Expiring Soon'] },
    })
      .populate('userId', 'fullName phone email avatar profilePicture customerId')
      .sort({ createdAt: -1 })
      .lean();

    const q = query.trim().toLowerCase();
    const filtered = memberships
      .filter((m) => {
        if (!q) return true;
        const name = m.userId?.fullName?.toLowerCase() || '';
        const phone = m.userId?.phone || '';
        const memId = m.membershipId?.toLowerCase() || '';
        const otp = m.entryOtp || '';
        return name.includes(q) || phone.includes(q) || memId.includes(q) || otp.includes(q);
      })
      .map((m) => ({
        key: m._id.toString(),
        membershipDbId: m._id.toString(),
        name: m.userId?.fullName || 'Gym Member',
        phone: m.userId?.phone || 'N/A',
        userId: m.userId?._id?.toString() || 'N/A',
        customerId: m.userId?.customerId || m.userId?._id?.toString().slice(-8) || 'N/A',
        membershipId: m.membershipId,
        bookingId: 'BKG-' + m._id.toString().slice(-5).toUpperCase(),
        plan: `${m.membershipTier} Pass`,
        status: m.status.toUpperCase(),
        startDate: m.startDate,
        endDate: m.endDate,
        planExpiry: m.endDate ? new Date(m.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A',
        avatar: m.userId?.avatar || m.userId?.profilePicture || null,
        gymBranch: gym.name,
        entryOtp: m.entryOtp || null,
      }));

    return res.status(200).json(ApiResponse.success(filtered, 'Gym members retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Manually trigger attendance auto-checkout cron job
 * POST /api/v1/attendance/trigger-cron
 */
export const triggerAttendanceCron = async (req, res, next) => {
  try {
    const updatedCount = await autoCheckoutStaleRecords();
    return res.status(200).json(
      ApiResponse.success(
        { updatedCount },
        `Attendance auto-checkout completed. Processed ${updatedCount} stale check-in records.`
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get Attendance History for Logged-In User
 * GET /api/v1/attendance/my-history
 * Query params: userId, membershipId, bookingId, gymId
 */
export const getMyAttendanceHistory = async (req, res, next) => {
  try {
    const rawUserId = req.user?.userId || req.user?.id || req.user?._id || req.query?.userId;
    if (!rawUserId) {
      return res.status(200).json(
        ApiResponse.success(
          {
            logs: [],
            summary: { total: 0, thisMonth: 0, completed: 0, activeNow: 0 },
          },
          'Attendance history retrieved.'
        )
      );
    }

    const filter = {
      userId: mongoose.Types.ObjectId.isValid(rawUserId)
        ? new mongoose.Types.ObjectId(rawUserId)
        : rawUserId,
    };

    const { membershipId, bookingId, gymId } = req.query;

    if (membershipId) {
      if (mongoose.Types.ObjectId.isValid(membershipId)) {
        filter.membershipId = new mongoose.Types.ObjectId(membershipId);
      } else {
        const mem = await Membership.findOne({ membershipId }).select('_id');
        if (mem) {
          filter.membershipId = mem._id;
        } else {
          return res.status(200).json(
            ApiResponse.success(
              {
                logs: [],
                summary: { total: 0, thisMonth: 0, completed: 0, activeNow: 0 },
              },
              'No records found.'
            )
          );
        }
      }
    }

    if (bookingId) {
      if (mongoose.Types.ObjectId.isValid(bookingId)) {
        filter.bookingId = new mongoose.Types.ObjectId(bookingId);
      } else {
        const bk = await Booking.findOne({ bookingId }).select('_id');
        if (bk) {
          filter.bookingId = bk._id;
        } else {
          return res.status(200).json(
            ApiResponse.success(
              {
                logs: [],
                summary: { total: 0, thisMonth: 0, completed: 0, activeNow: 0 },
              },
              'No records found.'
            )
          );
        }
      }
    }

    if (gymId && mongoose.Types.ObjectId.isValid(gymId)) {
      filter.gymId = new mongoose.Types.ObjectId(gymId);
    }

    const rawLogs = await Attendance.find(filter)
      .populate('gymId', 'name partnerId address location logo image coverPhoto phone')
      .populate('membershipId', 'membershipId membershipTier startDate endDate status entryOtp')
      .populate('bookingId', 'bookingId title category bookingType startDate endDate status entryOtp attendedSessionsCount durationDays customDates attendanceHistory')
      .sort({ checkInTime: -1 })
      .lean();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const logs = (rawLogs || []).map((log) => {
      const checkInDate = new Date(log.checkInTime);
      const timeStr = checkInDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      let checkOutStr = null;
      let durationStr = null;
      let durationMinutes = 0;

      if (log.checkOutTime) {
        const outDate = new Date(log.checkOutTime);
        checkOutStr = outDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        durationMinutes = Math.max(1, Math.round((outDate.getTime() - checkInDate.getTime()) / (1000 * 60)));
        durationStr = durationMinutes >= 60
          ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
          : `${durationMinutes} mins`;
      }

      const mem = log.membershipId;
      const bk = log.bookingId;

      return {
        _id: log._id,
        key: log._id.toString(),
        checkInTime: log.checkInTime,
        checkOutTime: log.checkOutTime,
        timeStr,
        checkOutStr,
        durationStr,
        durationMinutes,
        status: log.status,
        method: log.method,
        area: log.area,
        verifiedBy: log.verifiedBy,
        type: mem ? 'MEMBERSHIP' : bk ? 'BOOKING' : 'GENERAL',
        gym: {
          id: log.gymId?._id,
          name: log.gymId?.name || 'GYMEZY Partner Gym',
          partnerId: log.gymId?.partnerId,
          address: log.gymId?.address,
          logo: log.gymId?.logo || log.gymId?.image,
        },
        membership: mem
          ? {
              id: mem._id,
              membershipId: mem.membershipId,
              tier: mem.membershipTier,
              status: mem.status,
            }
          : null,
        booking: bk
          ? {
              id: bk._id,
              bookingId: bk.bookingId,
              title: bk.title,
              category: bk.category,
              bookingType: bk.bookingType,
              status: bk.status,
            }
          : null,
      };
    });

    const total = logs.length;
    const thisMonth = logs.filter((l) => new Date(l.checkInTime) >= startOfMonth).length;
    const completed = logs.filter((l) => l.status === 'Completed').length;
    const activeNow = logs.filter((l) => l.status === 'Checked-In').length;

    return res.status(200).json(
      ApiResponse.success(
        {
          logs,
          summary: {
            total,
            thisMonth,
            completed,
            activeNow,
          },
        },
        'Attendance history retrieved successfully.'
      )
    );
  } catch (error) {
    next(error);
  }
};

