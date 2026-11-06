/**
 * Booking Proration & Completion Lifecycle Service (Single Source of Truth)
 * Centralizes all date evaluation, session completion, and proration math.
 */

/**
 * Get end-of-day Date object (23:59:59.999) for a given date
 * @param {Date|string} dateInput
 * @returns {Date}
 */
export function getEndOfDay(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Get start-of-day Date object (00:00:00.000) for a given date
 * @param {Date|string} dateInput
 * @returns {Date}
 */
export function getStartOfDay(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Determines whether a booking has completely elapsed and should be marked Completed.
 * E.g., single day session on Nov 5 ends Nov 5 at 23:59:59.999. On Nov 6, it is completed.
 * @param {Object} booking
 * @param {Date} [referenceDate=new Date()]
 * @returns {boolean}
 */
export function isBookingCompleted(booking, referenceDate = new Date()) {
  if (!booking) return false;
  if (booking.status === 'Completed') return true;
  if (booking.status === 'Cancelled') return false;

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  // Check custom dates
  if (booking.isCustomDates && Array.isArray(booking.customDates) && booking.customDates.length > 0) {
    const allCustomDatesPassed = booking.customDates.every((cd) => {
      if (!cd || !cd.date) return true;
      const endOfDay = getEndOfDay(cd.date);
      return now > endOfDay || cd.status === 'Attended' || cd.status === 'Missed';
    });
    return allCustomDatesPassed;
  }

  // Standard booking: check endDate (or startDate + durationDays)
  let effectiveEnd = null;
  if (booking.endDate) {
    effectiveEnd = getEndOfDay(booking.endDate);
  } else if (booking.startDate) {
    const duration = Math.max(1, Number(booking.durationDays || booking.sessionsCount || 1));
    const start = new Date(booking.startDate);
    start.setDate(start.getDate() + (duration - 1));
    effectiveEnd = getEndOfDay(start);
  }

  if (effectiveEnd && now > effectiveEnd) {
    return true;
  }

  return false;
}

/**
 * Evaluates the dynamic status of a booking based on dates and existing status.
 * @param {Object} booking
 * @param {Date} [referenceDate=new Date()]
 * @returns {string}
 */
export function evaluateBookingStatus(booking, referenceDate = new Date()) {
  if (!booking) return 'Upcoming';
  if (booking.status === 'Cancelled' || booking.status === 'Cancellation_Requested') {
    return booking.status;
  }
  if (booking.status === 'Completed') {
    return 'Completed';
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  if (isBookingCompleted(booking, now)) {
    return 'Completed';
  }

  if (booking.startDate) {
    const startOfDay = getStartOfDay(booking.startDate);
    if (now >= startOfDay) {
      return 'Active';
    }
  }

  return booking.status || 'Upcoming';
}

/**
 * Calculates the Single Source of Truth cancellation and refund quote.
 * - Before start date: 100% full refund, no gym owner approval required.
 * - After start date with remaining days: Prorated deduction for consumed days, requires gym owner approval.
 * - All sessions elapsed / completed: Cancellation blocked.
 * 
 * @param {Object} booking
 * @param {Date} [referenceDate=new Date()]
 * @returns {{
 *   canCancel: boolean,
 *   totalDays: number,
 *   consumedDays: number,
 *   remainingDays: number,
 *   totalAmount: number,
 *   deductedAmount: number,
 *   refundAmount: number,
 *   requiresGymApproval: boolean,
 *   policyNotice: string
 * }}
 */
export function calculateBookingCancellationQuote(booking, referenceDate = new Date()) {
  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const totalAmount = Number(booking.pricing?.totalAmount ?? booking.amountPaid ?? 0);

  // Total session/day count
  let totalDays = 1;
  if (booking.isCustomDates && Array.isArray(booking.customDates) && booking.customDates.length > 0) {
    totalDays = booking.customDates.length;
  } else {
    totalDays = Math.max(1, Number(booking.sessionsCount || booking.durationDays || 1));
  }

  // Already completed or elapsed check
  if (booking.status === 'Completed' || isBookingCompleted(booking, now)) {
    return {
      canCancel: false,
      totalDays,
      consumedDays: totalDays,
      remainingDays: 0,
      totalAmount,
      deductedAmount: totalAmount,
      refundAmount: 0,
      requiresGymApproval: false,
      policyNotice: 'This session has already ended or completed and cannot be cancelled.',
    };
  }

  const startDate = booking.startDate ? new Date(booking.startDate) : null;
  const startOfDay = startDate ? getStartOfDay(startDate) : null;

  // Case 1: Prior to start date (Pre-start cancellation -> 100% Full Refund)
  if (startOfDay && now < startOfDay) {
    return {
      canCancel: true,
      totalDays,
      consumedDays: 0,
      remainingDays: totalDays,
      totalAmount,
      deductedAmount: 0,
      refundAmount: totalAmount,
      requiresGymApproval: false,
      policyNotice: '100% full refund will be reversed to your original payment method in 5-7 business days.',
    };
  }

  // Case 2: In-progress / partially consumed
  let consumedDays = 1;
  if (booking.isCustomDates && Array.isArray(booking.customDates) && booking.customDates.length > 0) {
    // Count custom dates where end-of-day <= now or status is Attended/Missed
    const passedCount = booking.customDates.filter((cd) => {
      if (!cd || !cd.date) return false;
      const endOfDay = getEndOfDay(cd.date);
      return now > endOfDay || cd.status === 'Attended' || cd.status === 'Missed';
    }).length;
    // If today is one of the custom dates and has arrived, count it
    const todayMatch = booking.customDates.some((cd) => {
      if (!cd || !cd.date) return false;
      const start = getStartOfDay(cd.date);
      const end = getEndOfDay(cd.date);
      return now >= start && now <= end;
    });
    consumedDays = Math.min(totalDays, Math.max(todayMatch ? passedCount + 1 : passedCount, 1));
  } else if (startOfDay) {
    const msDiff = Math.max(0, now.getTime() - startOfDay.getTime());
    const daysElapsed = Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 1;
    consumedDays = Math.min(totalDays, Math.max(1, daysElapsed));
  }

  const remainingDays = Math.max(0, totalDays - consumedDays);

  if (remainingDays === 0) {
    // Single-day session that is on the day of session or all days consumed
    return {
      canCancel: false,
      totalDays,
      consumedDays,
      remainingDays: 0,
      totalAmount,
      deductedAmount: totalAmount,
      refundAmount: 0,
      requiresGymApproval: false,
      policyNotice: 'All days/sessions for this booking have been consumed or completed.',
    };
  }

  // Prorated refund calculation
  const perDayRate = totalAmount / totalDays;
  const deductedAmount = Math.round(consumedDays * perDayRate * 100) / 100;
  const refundAmount = Math.max(0, Math.round((totalAmount - deductedAmount) * 100) / 100);

  return {
    canCancel: true,
    totalDays,
    consumedDays,
    remainingDays,
    totalAmount,
    deductedAmount,
    refundAmount,
    requiresGymApproval: true,
    policyNotice: `Prorated deduction of ₹${deductedAmount.toLocaleString('en-IN')} for ${consumedDays} consumed day(s). The net refund of ₹${refundAmount.toLocaleString('en-IN')} will be reversed to your original payment method upon Gym Owner approval.`,
  };
}

