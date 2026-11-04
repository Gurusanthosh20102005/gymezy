import mongoose from 'mongoose';
import crypto from 'node:crypto';
import Booking from '../models/booking.model.js';
import { Section } from '../models/section.model.js';
import Gym from '../models/gym.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import Counter from '../models/counter.model.js';
import { Wallet } from '../models/wallet.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { findOrCreateWalkInCustomer } from '../utils/walkInHelper.js';

/**
 * Resolve User ID from token or request body
 */
const resolveUserId = async (req) => {
  let userId = null;
  const rawUserId = req.user?._id || req.user?.userId || req.user?.id || req.body?.userId || req.query?.userId || req.headers?.['x-user-id'];
  if (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId)) {
    userId = new mongoose.Types.ObjectId(rawUserId);
  } else if (req.user?.email || req.body?.email) {
    const foundUser = await User.findOne({
      $or: [
        { email: req.user?.email || req.body?.email },
        { phone: req.user?.phone || req.body?.phone || '' },
      ],
    }).maxTimeMS(4000);
    if (foundUser) userId = foundUser._id;
  }

  if (!userId) {
    const anyUser = await User.findOne().maxTimeMS(4000);
    userId = anyUser ? anyUser._id : new mongoose.Types.ObjectId();
  }

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const userDoc = await User.findById(userId);
    if (userDoc && !userDoc.customerId) {
      userDoc.customerId = await User.generateCustomerId();
      await userDoc.save();
    }
  }

  return userId;
};

/**
 * Resolve Gym by ID or partnerId
 */
const resolveGym = async (gymId) => {
  const normalizedGymId = typeof gymId === 'object' && gymId !== null
    ? (gymId._id || gymId.id || gymId.partnerId)
    : gymId;

  if (!normalizedGymId) {
    const anyGym = await Gym.findOne().lean().maxTimeMS(4000);
    if (anyGym) return anyGym;
    throw ApiError.badRequest('Gym ID is required.');
  }
  const isObjectId = mongoose.Types.ObjectId.isValid(normalizedGymId);
  const gym = await Gym.findOne(
    isObjectId ? { $or: [{ _id: normalizedGymId }, { partnerId: normalizedGymId }] } : { partnerId: normalizedGymId }
  );
  if (!gym) {
    const anyGym = await Gym.findOne().lean().maxTimeMS(4000);
    if (anyGym) return anyGym;
    throw ApiError.notFound('Gym not found.');
  }
  return gym;
};

const generateGymBookingId = async (gym) => {
  const gymSeqKey = `bkg_${gym.partnerId || gym._id}`;
  const seq = await Counter.getNextSequence(gymSeqKey, 100);
  return `BK${seq}`;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Parse time string (e.g., '09:00 AM', '18:30', '9:30 AM') into total minutes from midnight
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3] ? match[3].toUpperCase() : null;
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

/**
 * Check if a date matches a trainer's workingDays array
 */
const isDayWorking = (date, workingDays) => {
  if (!Array.isArray(workingDays) || workingDays.length === 0) return true;
  const dayIndex = date.getDay();
  const full = DAY_NAMES[dayIndex].toLowerCase();
  const short = DAY_SHORT[dayIndex].toLowerCase();
  return workingDays.some((w) => {
    const val = String(w).trim().toLowerCase();
    return val === full || val === short || val.startsWith(short);
  });
};

/**
 * Create a new Booking (Section / Group Class / Gym Session)
 * POST /api/v1/bookings
 */
export const createBooking = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const {
    gymId,
    sectionId,
    trainerId,
    bookingType = 'SECTION',
    title,
    category,
    startDate,
    endDate,
    timeSlot,
    durationDays,
    sessionsCount = 1,
    pricing,
    payment,
    paymentMode,
    amount,
  } = body;

  const rawGymId = typeof gymId === 'object' && gymId !== null ? (gymId._id || gymId.id || gymId.partnerId) : gymId;
  const rawSectionId = typeof sectionId === 'object' && sectionId !== null ? (sectionId._id || sectionId.id) : sectionId;
  const rawTrainerId = typeof trainerId === 'object' && trainerId !== null ? (trainerId._id || trainerId.id) : trainerId;

  const resolvedUser = await resolveUserId(req);
  const gym = await resolveGym(rawGymId);

  let section = null;
  let allocatedTrainerId = rawTrainerId || null;

  // If sectionId is provided, perform atomic validation & enrollment
  if (rawSectionId) {
    if (!mongoose.Types.ObjectId.isValid(rawSectionId)) {
      throw ApiError.badRequest('Invalid Section ID format.');
    }

    section = await Section.findById(rawSectionId);
    if (!section) {
      throw ApiError.notFound('The selected Batch / Section was not found.');
    }

    if (!section.isActive) {
      throw ApiError.badRequest('This Batch / Section is currently inactive and not accepting bookings.');
    }

    // Check duplicate active booking for this user in this section
    const existingActiveBooking = await Booking.findOne({
      sectionId: section._id,
      userId: resolvedUser,
      status: { $in: ['Upcoming', 'Active'] },
    });

    if (existingActiveBooking) {
      throw ApiError.badRequest('You already have an active enrollment in this Batch.');
    }

    // Atomically increment enrolledCount only if below maxCapacity
    const updatedSection = await Section.findOneAndUpdate(
      {
        _id: section._id,
        $expr: { $lt: ['$enrolledCount', '$maxCapacity'] },
      },
      { $inc: { enrolledCount: 1 } },
      { returnDocument: 'after', new: true }
    );

    if (!updatedSection) {
      throw ApiError.badRequest('This batch is already full. No available slots remain.');
    }

    section = updatedSection;
    if (!allocatedTrainerId && section.trainerId) {
      allocatedTrainerId = section.trainerId;
    }
  }

  // Generate gymwise auto-increment Booking ID (BK100, BK101, ...) and 6-digit entry OTP
  const bookingId = await generateGymBookingId(gym);
  const entryOtp = crypto.randomInt(100000, 1000000).toString();

  let resolvedBookingType = bookingType || 'GYM_SESSION';
  if (section) {
    resolvedBookingType = bookingType === 'GROUP_CLASS' ? 'GROUP_CLASS' : 'SECTION';
  } else if (resolvedBookingType === 'GYM_SESSION') {
    if (gym.singleSessionBookingEnabled === false) {
      throw ApiError.badRequest('Per-session booking is currently disabled by this gym.');
    }
  }

  let sessionTrainer = null;
  if (allocatedTrainerId) {
    const isTrainerObjectId = mongoose.Types.ObjectId.isValid(allocatedTrainerId);
    sessionTrainer = await Employee.findOne(
      isTrainerObjectId
        ? { $or: [{ _id: allocatedTrainerId }, { employeeId: allocatedTrainerId }] }
        : { employeeId: allocatedTrainerId }
    );
    if (!sessionTrainer) {
      throw ApiError.badRequest('Selected personal trainer does not exist.');
    }
    if (sessionTrainer.status !== 'Active') {
      throw ApiError.badRequest('Selected personal trainer is currently inactive.');
    }
    const singleSessionFee = Number(sessionTrainer.trainerPricing?.singleSession || 0);
    if (singleSessionFee <= 0) {
      throw ApiError.badRequest('Selected personal trainer is not available for day pass or session bookings.');
    }
    allocatedTrainerId = sessionTrainer._id;
  }

  const rawCustomDates = Array.isArray(body.customDates) ? body.customDates : [];
  const isCustomDates = rawCustomDates.length > 0;
  let formattedCustomDates = [];

  let resolvedStartDate = startDate ? new Date(startDate) : (section?.startDate || new Date());
  let resolvedEndDate = endDate ? new Date(endDate) : (section?.endDate || null);

  if (isCustomDates) {
    const parsedDates = rawCustomDates
      .map((d) => (d?.date ? new Date(d.date) : new Date(d)))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (parsedDates.length > 0) {
      resolvedStartDate = parsedDates[0];
      resolvedEndDate = parsedDates[parsedDates.length - 1];
      formattedCustomDates = parsedDates.map((d) => ({
        date: d,
        status: 'Scheduled',
        dailyOtp: crypto.randomInt(100000, 1000000).toString(),
      }));
    }
  }

  const resolvedDuration = isCustomDates
    ? formattedCustomDates.length
    : (durationDays || section?.durationDays || 1);
  const resolvedSessionsCount = isCustomDates
    ? formattedCustomDates.length
    : (sessionsCount || resolvedDuration);
  const resolvedTimeSlot = timeSlot || (section ? `${section.startTime} - ${section.endTime}` : '');
  const resolvedTitle = title || (section ? section.title : 'Gym Session');
  const resolvedCategory = category || section?.category || 'general';

  // Strict Trainer Schedule & Engagement Boundaries Enforcement
  if (sessionTrainer) {
    const sched = sessionTrainer.schedule || {};

    // 1. Contract bounds validation (Temporary staff)
    if (sessionTrainer.type === 'Temporary') {
      if (sched.startDate) {
        const contractStart = new Date(sched.startDate);
        contractStart.setHours(0, 0, 0, 0);
        if (resolvedStartDate < contractStart) {
          throw ApiError.badRequest(
            `Selected trainer engagement starts on ${sched.startDate}. Please select dates within their engagement period.`
          );
        }
      }
      if (sched.endDate) {
        const contractEnd = new Date(sched.endDate);
        contractEnd.setHours(23, 59, 59, 999);

        if (isCustomDates && formattedCustomDates.length > 0) {
          const hasExceededDate = formattedCustomDates.some((item) => new Date(item.date) > contractEnd);
          if (hasExceededDate) {
            throw ApiError.badRequest(
              `Selected trainer contract ends on ${sched.endDate}. One or more selected dates exceed their engagement period.`
            );
          }
        } else if (resolvedEndDate && resolvedEndDate > contractEnd) {
          throw ApiError.badRequest(
            `Selected trainer contract ends on ${sched.endDate}. Please choose dates within their engagement period.`
          );
        } else if (resolvedStartDate > contractEnd) {
          throw ApiError.badRequest(
            `Selected trainer contract ends on ${sched.endDate}. Please choose dates within their engagement period.`
          );
        }
      }
    }

    // 2. Working days validation
    if (Array.isArray(sched.workingDays) && sched.workingDays.length > 0) {
      if (isCustomDates && formattedCustomDates.length > 0) {
        for (const item of formattedCustomDates) {
          const itemDate = new Date(item.date);
          if (!isDayWorking(itemDate, sched.workingDays)) {
            const dayName = DAY_NAMES[itemDate.getDay()];
            throw ApiError.badRequest(
              `Selected trainer does not work on ${dayName}. Available working days: ${sched.workingDays.join(', ')}.`
            );
          }
        }
      } else {
        if (!isDayWorking(resolvedStartDate, sched.workingDays)) {
          const dayName = DAY_NAMES[resolvedStartDate.getDay()];
          throw ApiError.badRequest(
            `Selected trainer does not work on ${dayName}. Available working days: ${sched.workingDays.join(', ')}.`
          );
        }
      }
    }

    // 3. Working hours / Slot matching validation
    if (resolvedTimeSlot) {
      const slotParts = resolvedTimeSlot.split('-').map((s) => s.trim());
      if (slotParts.length === 2) {
        const slotStartMins = parseTimeToMinutes(slotParts[0]);
        const slotEndMins = parseTimeToMinutes(slotParts[1]);

        let startWindowStr = sched.workingTimeStart || '09:00 AM';
        let endWindowStr = sched.workingTimeEnd || '06:00 PM';

        if (sched.isDifferentDays && Array.isArray(sched.dayWiseHours) && sched.dayWiseHours.length > 0) {
          const bookingDayFull = DAY_NAMES[resolvedStartDate.getDay()].toLowerCase();
          const bookingDayShort = DAY_SHORT[resolvedStartDate.getDay()].toLowerCase();
          const dayHour = sched.dayWiseHours.find((dh) => {
            const d = (dh.day || '').trim().toLowerCase();
            return d === bookingDayFull || d === bookingDayShort || d.startsWith(bookingDayShort);
          });
          if (dayHour && dayHour.startTime && dayHour.endTime) {
            startWindowStr = dayHour.startTime;
            endWindowStr = dayHour.endTime;
          }
        }

        const trainerStartMins = parseTimeToMinutes(startWindowStr);
        const trainerEndMins = parseTimeToMinutes(endWindowStr);

        if (slotStartMins !== null && trainerStartMins !== null && slotStartMins < trainerStartMins) {
          throw ApiError.badRequest(
            `Selected time slot (${resolvedTimeSlot}) starts before trainer working hours (${startWindowStr} - ${endWindowStr}).`
          );
        }
        if (slotEndMins !== null && trainerEndMins !== null && slotEndMins > trainerEndMins) {
          throw ApiError.badRequest(
            `Selected time slot (${resolvedTimeSlot}) ends after trainer working hours (${startWindowStr} - ${endWindowStr}).`
          );
        }
      }
    }
  }

  const baseDayPrice = Number(gym.singleSessionPrice || gym.pricingPlans?.singleSession || 199);
  const trainerDailyFee = sessionTrainer ? (Number(sessionTrainer.trainerPricing?.singleSession) || 0) : 0;
  const fallbackSessionSubtotal = (resolvedDuration * baseDayPrice) + (resolvedDuration * trainerDailyFee);

  const subtotalVal = Number(pricing?.subtotal ?? amount ?? (section ? section.cost : fallbackSessionSubtotal));
  const discountVal = Number(pricing?.discount ?? 0);
  const totalVal = Number(pricing?.totalAmount ?? (subtotalVal - discountVal));

  const now = new Date();
  const startDay = new Date(resolvedStartDate);
  startDay.setHours(0, 0, 0, 0);
  const endDay = resolvedEndDate ? new Date(resolvedEndDate) : null;
  if (endDay) endDay.setHours(23, 59, 59, 999);

  let initialStatus = 'Upcoming';
  if (startDay <= now && (!endDay || endDay >= now)) {
    initialStatus = 'Active';
  } else if (endDay && endDay < now) {
    initialStatus = 'Completed';
  }

  const resolvedPaymentMethod = payment?.method || paymentMode || 'UPI';
  const totalAmountPaise = Math.round(Math.max(0, totalVal) * 100);
  const { useWallet, applyWallet, appliedWalletAmount } = req.body;
  const isWalletMethod = (resolvedPaymentMethod || '').toLowerCase() === 'wallet';
  const isWalletRequested = Boolean(
    useWallet ||
    applyWallet ||
    payment?.useWallet ||
    payment?.applyWallet ||
    (payment?.walletAmountApplied && Number(payment.walletAmountApplied) > 0) ||
    isWalletMethod
  );

  let debitedWallet = null;
  let appliedWalletPaise = 0;

  // Gym-specific wallet payment & partial split debit handling
  if (isWalletRequested && totalAmountPaise > 0) {
    const userWallet = await Wallet.findOne({ userId: resolvedUser, gymId: gym._id });
    const currentWalletBalancePaise = userWallet?.balancePaise || 0;

    if (isWalletMethod && currentWalletBalancePaise < totalAmountPaise) {
      const availINR = (currentWalletBalancePaise / 100).toFixed(2);
      throw ApiError.badRequest(
        `Insufficient wallet balance at ${gym.name} to cover full payment. Required: ₹${Math.max(0, totalVal)}, Available: ₹${availINR}. Please select a secondary payment method for the remainder.`
      );
    }

    const requestedPaise = appliedWalletAmount !== undefined && appliedWalletAmount !== null
      ? Math.round(Number(appliedWalletAmount) * 100)
      : payment?.walletAmountApplied
      ? Math.round(Number(payment.walletAmountApplied) * 100)
      : currentWalletBalancePaise;

    appliedWalletPaise = Math.min(currentWalletBalancePaise, totalAmountPaise, Math.max(0, requestedPaise));

    if (appliedWalletPaise > 0 && userWallet) {
      const newBalancePaise = userWallet.balancePaise - appliedWalletPaise;
      userWallet.balancePaise = newBalancePaise;
      userWallet.history.push({
        transactionId: `WAL_BOOK_${Date.now()}_${crypto.randomInt(100, 999)}`,
        type: 'DEBIT',
        source: 'BOOKING_PAYMENT',
        amountPaise: appliedWalletPaise,
        balanceAfterPaise: newBalancePaise,
        description: `Payment towards booking (${resolvedTitle}) at ${gym.name}${appliedWalletPaise < totalAmountPaise ? ' (Partial Wallet Split)' : ''}`,
        createdAt: new Date(),
      });
      await userWallet.save();
      debitedWallet = userWallet;
    }
  }

  const newBooking = new Booking({
    bookingId,
    userId: resolvedUser,
    gymId: gym._id,
    sectionId: section ? section._id : null,
    trainerId: allocatedTrainerId,
    bookingType: resolvedBookingType,
    title: resolvedTitle,
    category: resolvedCategory,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    timeSlot: resolvedTimeSlot,
    durationDays: resolvedDuration,
    sessionsCount: resolvedSessionsCount,
    isCustomDates,
    customDates: formattedCustomDates,
    pricing: {
      subtotal: Math.max(0, subtotalVal),
      discount: Math.max(0, discountVal),
      totalAmount: Math.max(0, totalVal),
      currency: pricing?.currency || 'INR',
    },
    payment: {
      method: appliedWalletPaise >= totalAmountPaise ? 'Wallet' : resolvedPaymentMethod,
      status: payment?.status || 'Completed',
      walletAmountApplied: appliedWalletPaise / 100,
      transactionId: payment?.transactionId || (debitedWallet ? debitedWallet.history[debitedWallet.history.length - 1].transactionId : `TXN-${Date.now()}-${crypto.randomInt(1000, 9999)}`),
      paidAt: payment?.paidAt ? new Date(payment.paidAt) : new Date(),
    },
    entryOtp,
    status: initialStatus,
  });

  try {
    await newBooking.save();
  } catch (error) {
    // If saving the booking document fails, roll back section count and wallet deduction
    if (section) {
      await Section.findByIdAndUpdate(section._id, { $inc: { enrolledCount: -1 } });
    }
    if (debitedWallet && appliedWalletPaise > 0) {
      debitedWallet.balancePaise += appliedWalletPaise;
      debitedWallet.history.pop();
      await debitedWallet.save();
    }
    throw error;
  }

  // Populate references for client response
  const populated = await Booking.findById(newBooking._id)
    .populate('gymId', 'name partnerId address images imageUrl logo contactPhone location')
    .populate('sectionId', 'title category startTime endTime durationDays activeDays trainerId maxCapacity enrolledCount')
    .populate('trainerId', 'name specialty specialization avatar employeeId phone rating trainerPricing')
    .populate('userId', 'fullName name phone email customerId customerProfile');

  const enriched = enrichBookingWithCustomSchedule(populated.toObject ? populated.toObject() : populated);
  return res.status(201).json(ApiResponse.created(enriched, 'Booking created successfully'));
});

/**
 * Enrich booking with custom dates daily schedule, next session date, and OTP status
 */
export const enrichBookingWithCustomSchedule = (b) => {
  if (!b) return b;
  const isCustom = Boolean(b.isCustomDates || (Array.isArray(b.customDates) && b.customDates.length > 0));
  if (!isCustom) {
    return { ...b, isTodayValid: true };
  }

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  let isTodayValid = false;
  let activeDailyOtp = null;
  let nextSession = null;

  const enrichedCustomDates = (b.customDates || []).map((session) => {
    if (!session || !session.date) return session;
    const sStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(session.date));
    let status = session.status || 'Scheduled';

    // If past scheduled date without attendance, mark as Missed
    if (sStr < todayStr && status === 'Scheduled') {
      status = 'Missed';
    }

    if (sStr === todayStr && (status === 'Scheduled' || status === 'Rescheduled')) {
      isTodayValid = true;
      activeDailyOtp = session.dailyOtp || b.entryOtp;
    }

    if (sStr > todayStr && (status === 'Scheduled' || status === 'Rescheduled')) {
      if (!nextSession || new Date(session.date) < new Date(nextSession.date)) {
        nextSession = session;
      }
    }

    return {
      ...(session.toObject ? session.toObject() : session),
      status,
    };
  });

  const nextSessionDateFormatted = nextSession
    ? new Date(nextSession.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  return {
    ...b,
    isTodayValid,
    entryOtp: isTodayValid ? (activeDailyOtp || b.entryOtp) : null,
    nextSessionDateFormatted,
    customDates: enrichedCustomDates,
  };
};

/**
 * Get all Bookings for Logged-In User
 * GET /api/v1/bookings/my
 */
export const getMyBookings = asyncHandler(async (req, res) => {
  const rawUserId = req.user?.userId || req.user?.id || req.user?._id || req.query?.userId || req.headers?.['x-user-id'];
  if (!rawUserId) {
    return res.status(200).json(ApiResponse.success([], 'My bookings retrieved successfully'));
  }

  const filter = mongoose.Types.ObjectId.isValid(rawUserId)
    ? { userId: new mongoose.Types.ObjectId(rawUserId) }
    : { userId: rawUserId };

  const bookings = await Booking.find(filter)
    .populate('gymId', 'name partnerId address images imageUrl logo contactPhone location')
    .populate({
      path: 'sectionId',
      select: 'title category startTime endTime durationDays activeDays trainerId maxCapacity enrolledCount inclusions instructions',
      populate: {
        path: 'trainerId',
        select: 'name specialty specialization avatar employeeId phone rating trainerPricing',
      },
    })
    .populate('trainerId', 'name specialty specialization avatar employeeId phone rating trainerPricing')
    .sort({ createdAt: -1 })
    .lean()
    .maxTimeMS(8000);

  const now = new Date();
  const resolvedBookings = (bookings || []).map((b) => {
    if (b.status === 'Upcoming' && b.startDate) {
      const sDay = new Date(b.startDate);
      sDay.setHours(0, 0, 0, 0);
      const eDay = b.endDate ? new Date(b.endDate) : null;
      if (eDay) eDay.setHours(23, 59, 59, 999);
      if (sDay <= now && (!eDay || eDay >= now)) {
        b.status = 'Active';
      }
    }
    return enrichBookingWithCustomSchedule(b);
  });

  return res.status(200).json(ApiResponse.success(resolvedBookings, 'My bookings retrieved successfully'));
});

/**
 * Get Single Booking Details
 * GET /api/v1/bookings/:id
 */
export const getBookingById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const booking = await Booking.findOne(
    isObjectId ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id }
  )
    .populate('gymId', 'name partnerId address images imageUrl logo contactPhone location')
    .populate('sectionId', 'title category startTime endTime durationDays activeDays trainerId maxCapacity enrolledCount inclusions instructions')
    .populate('trainerId', 'name specialization avatar employeeId phone')
    .populate('userId', 'fullName name phone email customerId customerProfile');

  if (!booking) {
    throw ApiError.notFound('Booking not found.');
  }

  const bObj = booking.toObject ? booking.toObject() : booking;
  const now = new Date();
  if (bObj.status === 'Upcoming' && bObj.startDate) {
    const sDay = new Date(bObj.startDate);
    sDay.setHours(0, 0, 0, 0);
    const eDay = bObj.endDate ? new Date(bObj.endDate) : null;
    if (eDay) eDay.setHours(23, 59, 59, 999);
    if (sDay <= now && (!eDay || eDay >= now)) {
      bObj.status = 'Active';
    }
  }

  const enriched = enrichBookingWithCustomSchedule(bObj);
  return res.status(200).json(ApiResponse.success(enriched, 'Booking retrieved successfully'));
});

/**
 * Get all bookings for a gym (Gym Owner portal)
 * GET /api/v1/bookings/gym/:gymId
 */
export const getGymBookings = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  const { source, status } = req.query;
  const isObjectId = mongoose.Types.ObjectId.isValid(gymId);

  const gym = await Gym.findOne(
    isObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
  );
  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  const filter = { gymId: gym._id };
  if (source && source !== 'ALL') {
    filter.source = source.toUpperCase();
  }
  if (status && status !== 'ALL') {
    filter.status = status;
  }

  const bookings = await Booking.find(filter)
    .populate('userId', 'fullName name email phone avatar customerId')
    .sort({ createdAt: -1 });

  const enriched = bookings.map((b) => enrichBookingWithCustomSchedule(b));
  return res.status(200).json(ApiResponse.success(enriched, 'Gym bookings retrieved successfully'));
});

/**
 * Create Walk-in Booking at the Gym Counter (Desk POS)
 * POST /api/v1/bookings/gym/:gymId/walk-in
 */
export const createWalkInBooking = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  const {
    name,
    customerName,
    phone,
    email,
    bookingType = 'GYM_SESSION',
    title,
    sectionId = null,
    trainerId = null,
    startDate,
    endDate,
    timeSlot,
    price = 0,
    amount = 0,
    customDates = [],
    isCustomDates = false,
    paymentMethod = 'Cash',
    paymentStatus = 'Completed',
    checkInNow = false,
    notes = '',
  } = req.body;

  if (!phone) {
    throw ApiError.badRequest('Customer phone number is required for walk-in booking.');
  }

  const targetName = name || customerName || 'Walk-in Visitor';

  // Resolve Gym
  const isObjectId = mongoose.Types.ObjectId.isValid(gymId);
  const gym = await Gym.findOne(
    isObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
  );
  if (!gym) {
    throw ApiError.notFound('Gym facility not found.');
  }

  // Find or create User by phone
  const user = await findOrCreateWalkInCustomer({ fullName: targetName, phone, email });

  // Generate Booking ID: BK{counter}
  const nextSeq = await Counter.getNextSequence(`booking_${gym._id}`, 100);
  const bookingId = `BK${nextSeq}`;

  // Generate 6-digit entry OTP & QR code data
  const entryOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const qrCodeData = `GYMEZY:${gym.partnerId || gym._id}:${bookingId}:${entryOtp}`;

  const finalPrice = Math.max(0, Number(price || amount) || 0);
  const now = new Date();
  const sessionStartDate = startDate ? new Date(startDate) : now;
  const sessionEndDate = endDate ? new Date(endDate) : sessionStartDate;

  const initialStatus = checkInNow ? 'Active' : 'Upcoming';
  const attendanceHistory = checkInNow
    ? [{ attendedAt: now, method: 'Front Desk Walk-In', area: 'Main Gate' }]
    : [];

  const hasCustomDates = Boolean(isCustomDates || (Array.isArray(customDates) && customDates.length > 0));
  const parsedCustomDates = Array.isArray(customDates)
    ? customDates.map((d) => ({
        date: typeof d === 'string' ? new Date(d) : (d.date ? new Date(d.date) : new Date()),
        status: 'Scheduled',
        dailyOtp: Math.floor(100000 + Math.random() * 900000).toString(),
      }))
    : [];

  const normalizePayment = (method) => {
    if (!method) return 'Cash';
    const s = String(method).toLowerCase();
    if (s.includes('card') || s === 'pos' || s === 'online') return 'Card';
    if (s.includes('upi') || s === 'gpay') return 'UPI';
    if (s.includes('cash') || s === 'cod') return 'Cash';
    if (s.includes('wallet')) return 'Wallet';
    if (s.includes('net') || s.includes('bank')) return 'Net Banking';
    return method;
  };

  const newBooking = await Booking.create({
    bookingId,
    userId: user._id,
    gymId: gym._id,
    sectionId: sectionId && mongoose.Types.ObjectId.isValid(sectionId) ? sectionId : null,
    trainerId: trainerId && mongoose.Types.ObjectId.isValid(trainerId) ? trainerId : null,
    bookingType: bookingType === 'GROUP_CLASS' ? 'GROUP_CLASS' : 'GYM_SESSION',
    title: title || (bookingType === 'GROUP_CLASS' ? 'Group Class Walk-In' : 'Gym Session Walk-In'),
    startDate: sessionStartDate,
    endDate: sessionEndDate,
    timeSlot: timeSlot || 'General Access',
    isCustomDates: hasCustomDates,
    customDates: parsedCustomDates,
    pricing: {
      subtotal: finalPrice,
      discount: 0,
      totalAmount: finalPrice,
      currency: 'INR',
    },
    payment: {
      method: normalizePayment(paymentMethod),
      status: paymentStatus || 'Completed',
      transactionId: `WALK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      paidAt: now,
    },
    entryOtp,
    qrCodeData,
    status: initialStatus,
    source: 'WALK_IN',
    walkInDetails: {
      bookedBy: req.user?._id || null,
      bookedByName: req.user?.fullName || req.user?.name || 'Front Desk Staff',
      notes: notes || '',
    },
    attendedSessionsCount: checkInNow ? 1 : 0,
    attendanceHistory,
  });

  const populated = await Booking.findById(newBooking._id)
    .populate('userId', 'fullName name email phone avatar customerId')
    .lean();

  return res.status(201).json(
    ApiResponse.success(
      enrichBookingWithCustomSchedule(populated),
      checkInNow
        ? 'Walk-in booking created and customer checked in successfully.'
        : 'Walk-in booking created successfully.'
    )
  );
});

/**
 * Cancel Booking
 * PATCH /api/v1/bookings/:id/cancel
 */
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason = 'Cancelled by member' } = req.body;
  const isObjectId = mongoose.Types.ObjectId.isValid(id);

  const booking = await Booking.findOne(
    isObjectId ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id }
  );

  if (!booking) {
    throw ApiError.notFound('Booking not found.');
  }

  if (booking.status === 'Cancelled') {
    throw ApiError.badRequest('This booking is already cancelled.');
  }

  booking.status = 'Cancelled';
  booking.cancellation = {
    cancelledAt: new Date(),
    reason: (reason || '').trim(),
  };

  await booking.save();

  // Atomically decrement section enrolledCount if this was a section booking
  if (booking.sectionId) {
    await Section.findOneAndUpdate(
      { _id: booking.sectionId, enrolledCount: { $gt: 0 } },
      { $inc: { enrolledCount: -1 } }
    );
  }

  const updatedBooking = await Booking.findById(booking._id)
    .populate('gymId', 'name partnerId address images imageUrl logo contactPhone location')
    .populate('sectionId', 'title category startTime endTime durationDays activeDays trainerId maxCapacity enrolledCount')
    .populate('trainerId', 'name specialization avatar employeeId phone');

  return res.status(200).json(ApiResponse.success(updatedBooking, 'Booking cancelled successfully'));
});

/**
 * Get Section Enrollments Roster (Gym Owner & Admin)
 * GET /api/v1/bookings/section/:sectionId
 */
export const getSectionEnrollments = asyncHandler(async (req, res) => {
  const { sectionId } = req.params;

  if (!sectionId || !mongoose.Types.ObjectId.isValid(sectionId)) {
    throw ApiError.badRequest('Valid Section ID is required.');
  }

  const section = await Section.findById(sectionId)
    .populate('trainerId', 'name specialization avatar employeeId phone')
    .populate('gymId', 'name partnerId');

  if (!section) {
    throw ApiError.notFound('Section not found.');
  }

  const enrollments = await Booking.find({ sectionId })
    .populate('userId', 'fullName name phone email avatar customerId customerProfile profilePicture')
    .sort({ createdAt: -1 });

  const activeCount = enrollments.filter((b) => b.status === 'Upcoming' || b.status === 'Active').length;
  const cancelledCount = enrollments.filter((b) => b.status === 'Cancelled').length;

  return res.status(200).json(ApiResponse.success({
    section,
    summary: {
      maxCapacity: section.maxCapacity || 25,
      enrolledCount: section.enrolledCount || 0,
      activeCount,
      cancelledCount,
      availableSlots: Math.max(0, (section.maxCapacity || 25) - (section.enrolledCount || 0)),
    },
    enrollments,
  }, 'Section enrollments retrieved successfully'));
});

/**
 * Request to reschedule a missed or upcoming session in a custom booking
 * POST /api/v1/bookings/:id/request-reschedule
 */
export const requestReschedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sessionIndex, sessionDate, requestedDate, reason } = req.body;
  const resolvedUser = await resolveUserId(req);

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const booking = await Booking.findOne(
    isObjectId ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id }
  );

  if (!booking) {
    throw ApiError.notFound('Booking not found.');
  }

  if (booking.userId.toString() !== resolvedUser.toString()) {
    throw ApiError.forbidden('You are not authorized to modify this booking.');
  }

  if (!booking.isCustomDates || !Array.isArray(booking.customDates) || booking.customDates.length === 0) {
    throw ApiError.badRequest('Rescheduling individual sessions is only available for custom date bookings.');
  }

  // Find target session
  let targetSession = null;
  if (typeof sessionIndex === 'number' && booking.customDates[sessionIndex]) {
    targetSession = booking.customDates[sessionIndex];
  } else if (sessionDate) {
    const targetDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(sessionDate));
    targetSession = booking.customDates.find((s) => {
      const sStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(s.date));
      return sStr === targetDateStr;
    });
  }

  if (!targetSession) {
    throw ApiError.notFound('Selected session not found in this booking.');
  }

  if (targetSession.status === 'Attended') {
    throw ApiError.badRequest('Attended sessions cannot be rescheduled.');
  }

  const reqDateObj = new Date(requestedDate);
  if (Number.isNaN(reqDateObj.getTime())) {
    throw ApiError.badRequest('Invalid requested date format.');
  }
  const reqDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(reqDateObj);

  // Check if requested date is already in booking
  const duplicate = booking.customDates.some((s) => {
    const sStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(s.date));
    return sStr === reqDateStr;
  });
  if (duplicate) {
    throw ApiError.badRequest('You already have a gym session booked on this requested date.');
  }

  // Validate requested date against trainer contract and working days if personal trainer is assigned
  if (booking.trainerId) {
    const assignedTrainer = await Employee.findById(booking.trainerId);
    if (assignedTrainer) {
      const sched = assignedTrainer.schedule || {};
      if (assignedTrainer.type === 'Temporary' && sched.endDate) {
        const contractEnd = new Date(sched.endDate);
        contractEnd.setHours(23, 59, 59, 999);
        if (reqDateObj > contractEnd) {
          throw ApiError.badRequest(
            `Requested reschedule date exceeds assigned trainer engagement period ending on ${sched.endDate}.`
          );
        }
      }
      if (Array.isArray(sched.workingDays) && sched.workingDays.length > 0) {
        if (!isDayWorking(reqDateObj, sched.workingDays)) {
          const dayName = DAY_NAMES[reqDateObj.getDay()];
          throw ApiError.badRequest(
            `Assigned trainer does not work on ${dayName}. Available working days: ${sched.workingDays.join(', ')}.`
          );
        }
      }
    }
  }

  // Find the next scheduled date after targetSession.date
  const targetDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(targetSession.date));
  const laterSessions = booking.customDates
    .filter((s) => {
      const sStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(s.date));
      return sStr > targetDateStr && (s.status === 'Scheduled' || s.status === 'Rescheduled');
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (laterSessions.length > 0) {
    const nextDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(laterSessions[0].date));
    if (reqDateStr >= nextDateStr) {
      throw ApiError.badRequest(
        `Reschedule must be set to a date before your next booked session on ${new Date(laterSessions[0].date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
      );
    }
  }

  targetSession.status = 'Reschedule_Requested';
  targetSession.requestedDate = reqDateObj;
  targetSession.reason = reason || '';
  booking.markModified('customDates');
  await booking.save();

  const enriched = enrichBookingWithCustomSchedule(booking.toObject ? booking.toObject() : booking);
  return res.status(200).json(ApiResponse.success(enriched, 'Reschedule request submitted to gym owner for review.'));
});

/**
 * Gym Owner Review Reschedule Request (Approve, Propose different date, or Reject)
 * POST /api/v1/bookings/:id/review-reschedule
 */
export const reviewReschedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sessionIndex, sessionDate, action, proposedDate, ownerNotes } = req.body;

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const booking = await Booking.findOne(
    isObjectId ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id }
  );

  if (!booking) {
    throw ApiError.notFound('Booking not found.');
  }

  // Find target session
  let targetSession = null;
  if (typeof sessionIndex === 'number' && booking.customDates[sessionIndex]) {
    targetSession = booking.customDates[sessionIndex];
  } else if (sessionDate) {
    const targetDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(sessionDate));
    targetSession = booking.customDates.find((s) => {
      const sStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(s.date));
      return sStr === targetDateStr;
    });
  }

  if (!targetSession) {
    throw ApiError.notFound('Selected session not found.');
  }

  if (action === 'APPROVE') {
    targetSession.date = targetSession.requestedDate || targetSession.date;
    targetSession.status = 'Rescheduled';
    targetSession.rescheduledTo = targetSession.date;
    targetSession.dailyOtp = crypto.randomInt(100000, 1000000).toString();
    targetSession.reason = ownerNotes || 'Approved by gym owner';
    booking.markModified('customDates');
    await booking.save();

    const enriched = enrichBookingWithCustomSchedule(booking.toObject ? booking.toObject() : booking);
    return res.status(200).json(ApiResponse.success(enriched, 'Reschedule approved successfully.'));
  }

  if (action === 'PROPOSE') {
    if (!proposedDate) {
      throw ApiError.badRequest('Please specify the proposed date.');
    }
    const propDateObj = new Date(proposedDate);
    if (Number.isNaN(propDateObj.getTime())) {
      throw ApiError.badRequest('Invalid proposed date format.');
    }

    if (booking.trainerId) {
      const assignedTrainer = await Employee.findById(booking.trainerId);
      if (assignedTrainer) {
        const sched = assignedTrainer.schedule || {};
        if (assignedTrainer.type === 'Temporary' && sched.endDate) {
          const contractEnd = new Date(sched.endDate);
          contractEnd.setHours(23, 59, 59, 999);
          if (propDateObj > contractEnd) {
            throw ApiError.badRequest(
              `Proposed reschedule date exceeds assigned trainer engagement period ending on ${sched.endDate}.`
            );
          }
        }
        if (Array.isArray(sched.workingDays) && sched.workingDays.length > 0) {
          if (!isDayWorking(propDateObj, sched.workingDays)) {
            const dayName = DAY_NAMES[propDateObj.getDay()];
            throw ApiError.badRequest(
              `Assigned trainer does not work on ${dayName}. Available working days: ${sched.workingDays.join(', ')}.`
            );
          }
        }
      }
    }

    targetSession.proposedDate = propDateObj;
    targetSession.status = 'Reschedule_Proposed';
    targetSession.reason = ownerNotes || '';
    booking.markModified('customDates');
    await booking.save();

    const enriched = enrichBookingWithCustomSchedule(booking.toObject ? booking.toObject() : booking);
    return res.status(200).json(ApiResponse.success(enriched, 'Proposed date sent to member for approval.'));
  }

  if (action === 'REJECT') {
    targetSession.status = 'Missed';
    targetSession.reason = ownerNotes || 'Declined by gym owner';
    booking.markModified('customDates');
    await booking.save();

    const enriched = enrichBookingWithCustomSchedule(booking.toObject ? booking.toObject() : booking);
    return res.status(200).json(ApiResponse.success(enriched, 'Reschedule request declined.'));
  }

  throw ApiError.badRequest('Invalid review action. Allowed: APPROVE, PROPOSE, REJECT.');
});

/**
 * Member response to Gym Owner's proposed date (Accept or Decline)
 * POST /api/v1/bookings/:id/respond-proposal
 */
export const respondRescheduleProposal = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sessionIndex, sessionDate, decision } = req.body;
  const resolvedUser = await resolveUserId(req);

  const isObjectId = mongoose.Types.ObjectId.isValid(id);
  const booking = await Booking.findOne(
    isObjectId ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id }
  );

  if (!booking) {
    throw ApiError.notFound('Booking not found.');
  }

  if (booking.userId.toString() !== resolvedUser.toString()) {
    throw ApiError.forbidden('You are not authorized to respond to this booking.');
  }

  // Find target session
  let targetSession = null;
  if (typeof sessionIndex === 'number' && booking.customDates[sessionIndex]) {
    targetSession = booking.customDates[sessionIndex];
  } else if (sessionDate) {
    const targetDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(sessionDate));
    targetSession = booking.customDates.find((s) => {
      const sStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(s.date));
      return sStr === targetDateStr;
    });
  }

  if (!targetSession) {
    throw ApiError.notFound('Selected session not found.');
  }

  if (decision === 'ACCEPT') {
    targetSession.date = targetSession.proposedDate || targetSession.date;
    targetSession.status = 'Rescheduled';
    targetSession.rescheduledTo = targetSession.date;
    targetSession.dailyOtp = crypto.randomInt(100000, 1000000).toString();
    targetSession.proposedDate = null;
    booking.markModified('customDates');
    await booking.save();

    const enriched = enrichBookingWithCustomSchedule(booking.toObject ? booking.toObject() : booking);
    return res.status(200).json(ApiResponse.success(enriched, 'Proposed date accepted and session rescheduled.'));
  }

  if (decision === 'DECLINE') {
    targetSession.status = 'Missed';
    targetSession.proposedDate = null;
    booking.markModified('customDates');
    await booking.save();

    const enriched = enrichBookingWithCustomSchedule(booking.toObject ? booking.toObject() : booking);
    return res.status(200).json(ApiResponse.success(enriched, 'Proposed date declined.'));
  }

  throw ApiError.badRequest('Invalid decision. Allowed: ACCEPT, DECLINE.');
});
