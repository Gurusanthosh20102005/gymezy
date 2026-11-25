/**
 * Single Source of Truth (SSOT) for Gym Operating Hours & Timing Architecture on User Mobile App
 * Handles time parsing, live status determination, and dynamic slot generation.
 */

export const TIMING_MODES = Object.freeze({
  REGULAR: 'REGULAR',
  SPLIT_SHIFT: 'SPLIT_SHIFT',
  TWENTY_FOUR_HOURS: '24_HOURS',
  CLOSED: 'CLOSED',
});

export const DAYS_OF_WEEK = Object.freeze([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]);

export const DEFAULT_HOURS = Object.freeze({
  WEEKDAY_OPEN: '05:30 AM',
  WEEKDAY_CLOSE: '10:30 PM',
  WEEKEND_OPEN: '06:00 AM',
  WEEKEND_CLOSE: '09:00 PM',
  MORNING_OPEN: '05:30 AM',
  MORNING_CLOSE: '11:30 AM',
  EVENING_OPEN: '04:30 PM',
  EVENING_CLOSE: '10:30 PM',
});

/**
 * Parses time string (e.g., "05:30 AM", "5:30 AM", "17:30", "12:00 AM") to minutes from midnight (0..1439).
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const cleaned = timeStr.trim().toUpperCase();

  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (match12) {
    let hours = Number.parseInt(match12[1], 10);
    const minutes = Number.parseInt(match12[2] || '0', 10);
    const period = match12[3];

    if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null;
    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours < 12) hours += 12;

    return hours * 60 + minutes;
  }

  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = Number.parseInt(match24[1], 10);
    const minutes = Number.parseInt(match24[2], 10);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
  }

  return null;
};

/**
 * Formats minutes from midnight to "hh:mm A" (e.g. 330 -> "05:30 AM").
 */
export const formatMinutesToTime = (minutes) => {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '';
  const total = ((minutes % 1440) + 1440) % 1440;
  let hours = Math.floor(total / 60);
  const mins = total % 60;
  const period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const paddedH = String(hours).padStart(2, '0');
  const paddedM = String(mins).padStart(2, '0');
  return `${paddedH}:${paddedM} ${period}`;
};

/**
 * Standardizes time string into canonical "hh:mm A".
 */
export const normalizeTimeFormat = (timeStr, fallback = '06:00 AM') => {
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return fallback;
  return formatMinutesToTime(mins);
};

export const normalizeOpeningHours = (inputRaw = {}) => {
  let raw = inputRaw;
  if (!raw || typeof raw !== 'object') {
    if (typeof raw === 'string' && raw.trim()) {
      if (raw.toLowerCase().includes('24 hour')) {
        raw = { is24Hours: true, mode: TIMING_MODES.TWENTY_FOUR_HOURS, displayText: raw };
      } else {
        const parts = raw.split('-').map((s) => s.trim());
        raw = {
          weekdayOpen: parts[0] || DEFAULT_HOURS.WEEKDAY_OPEN,
          weekdayClose: parts[1] || DEFAULT_HOURS.WEEKDAY_CLOSE,
          weekendOpen: parts[0] || DEFAULT_HOURS.WEEKEND_OPEN,
          weekendClose: parts[1] || DEFAULT_HOURS.WEEKEND_CLOSE,
          displayText: raw,
        };
      }
    } else {
      raw = {};
    }
  }

  const is24Hours = Boolean(
    raw.is24Hours || raw.mode === TIMING_MODES.TWENTY_FOUR_HOURS
  );
  const isSplitShift = Boolean(
    !is24Hours && (raw.isSplitShift || raw.mode === TIMING_MODES.SPLIT_SHIFT || (raw.morningShift && raw.eveningShift))
  );

  let mode = TIMING_MODES.REGULAR;
  if (is24Hours) {
    mode = TIMING_MODES.TWENTY_FOUR_HOURS;
  } else if (isSplitShift) {
    mode = TIMING_MODES.SPLIT_SHIFT;
  }

  const weekdayOpen = normalizeTimeFormat(raw.weekdayOpen, DEFAULT_HOURS.WEEKDAY_OPEN);
  const weekdayClose = normalizeTimeFormat(raw.weekdayClose, DEFAULT_HOURS.WEEKDAY_CLOSE);
  const weekendOpen = normalizeTimeFormat(raw.weekendOpen, DEFAULT_HOURS.WEEKEND_OPEN);
  const weekendClose = normalizeTimeFormat(raw.weekendClose, DEFAULT_HOURS.WEEKEND_CLOSE);
  const morningOpen = normalizeTimeFormat(raw.morningShift?.open || raw.morningOpen, DEFAULT_HOURS.MORNING_OPEN);
  const morningClose = normalizeTimeFormat(raw.morningShift?.close || raw.morningClose, DEFAULT_HOURS.MORNING_CLOSE);
  const eveningOpen = normalizeTimeFormat(raw.eveningShift?.open || raw.eveningOpen, DEFAULT_HOURS.EVENING_OPEN);
  const eveningClose = normalizeTimeFormat(raw.eveningShift?.close || raw.eveningClose, DEFAULT_HOURS.EVENING_CLOSE);

  const existingScheduleMap = new Map();
  if (Array.isArray(raw.schedule)) {
    raw.schedule.forEach((item) => {
      if (item && item.day) existingScheduleMap.set(item.day.toLowerCase(), item);
    });
  }

  const schedule = DAYS_OF_WEEK.map((day) => {
    const existing = existingScheduleMap.get(day.toLowerCase());
    const isWeekend = day === 'Saturday' || day === 'Sunday';

    if (!existing) {
      return {
        day,
        isOpen: true,
        mode,
        openTime: isWeekend ? weekendOpen : weekdayOpen,
        closeTime: isWeekend ? weekendClose : weekdayClose,
        morningShift: { openTime: morningOpen, closeTime: morningClose },
        eveningShift: { openTime: eveningOpen, closeTime: eveningClose },
      };
    }

    const dayMode = existing.mode || mode;
    return {
      day,
      isOpen: existing.isOpen !== false,
      mode: dayMode,
      openTime: normalizeTimeFormat(existing.openTime, isWeekend ? weekendOpen : weekdayOpen),
      closeTime: normalizeTimeFormat(existing.closeTime, isWeekend ? weekendClose : weekdayClose),
      morningShift: {
        openTime: normalizeTimeFormat(existing.morningShift?.openTime || existing.morningShift?.open, morningOpen),
        closeTime: normalizeTimeFormat(existing.morningShift?.closeTime || existing.morningShift?.close, morningClose),
      },
      eveningShift: {
        openTime: normalizeTimeFormat(existing.eveningShift?.openTime || existing.eveningShift?.open, eveningOpen),
        closeTime: normalizeTimeFormat(existing.eveningShift?.closeTime || existing.eveningShift?.close, eveningClose),
      },
    };
  });

  let displayText = raw.displayText;
  if (!displayText || !displayText.trim()) {
    if (mode === TIMING_MODES.TWENTY_FOUR_HOURS) {
      displayText = 'Open 24 Hours';
    } else if (mode === TIMING_MODES.SPLIT_SHIFT) {
      displayText = `${morningOpen} - ${morningClose} & ${eveningOpen} - ${eveningClose}`;
    } else {
      displayText = `${weekdayOpen} - ${weekdayClose}`;
    }
  }

  return {
    mode,
    is24Hours,
    isSplitShift,
    weekdayOpen,
    weekdayClose,
    weekendOpen,
    weekendClose,
    morningOpen,
    morningClose,
    eveningOpen,
    eveningClose,
    displayText,
    isOpenHolidays: raw.isOpenHolidays !== false,
    schedule,
  };
};

/**
 * Calculates current live open/closed status for a gym.
 */
export const getGymTimingStatus = (openingHours, targetDate = new Date()) => {
  if (!openingHours) {
    return {
      isOpen: true,
      statusText: 'Open',
      badgeText: 'Open',
      badgeVariant: 'success',
      badgeColor: '#10B981',
      mode: TIMING_MODES.REGULAR,
    };
  }

  const normalized = normalizeOpeningHours(openingHours);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[targetDate.getDay()];
  const currentMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();

  const daySchedule = normalized.schedule.find(
    (s) => s.day.toLowerCase() === currentDayName.toLowerCase()
  );

  if (!daySchedule || !daySchedule.isOpen) {
    return {
      isOpen: false,
      statusText: 'Closed Today',
      badgeText: 'Closed Today',
      badgeVariant: 'danger',
      badgeColor: '#EF4444',
      mode: TIMING_MODES.CLOSED,
      closesAt: null,
    };
  }

  const activeMode = daySchedule.mode || normalized.mode;

  if (activeMode === TIMING_MODES.TWENTY_FOUR_HOURS) {
    return {
      isOpen: true,
      statusText: 'Open 24/7',
      badgeText: 'Open 24/7',
      badgeVariant: 'success',
      badgeColor: '#10B981',
      mode: TIMING_MODES.TWENTY_FOUR_HOURS,
      closesAt: null,
    };
  }

  if (activeMode === TIMING_MODES.SPLIT_SHIFT) {
    const mOpen = parseTimeToMinutes(daySchedule.morningShift?.openTime || normalized.morningOpen);
    const mClose = parseTimeToMinutes(daySchedule.morningShift?.closeTime || normalized.morningClose);
    const eOpen = parseTimeToMinutes(daySchedule.eveningShift?.openTime || normalized.eveningOpen);
    const eClose = parseTimeToMinutes(daySchedule.eveningShift?.closeTime || normalized.eveningClose);

    if (currentMinutes < mOpen) {
      return {
        isOpen: false,
        statusText: `Closed • Opens ${daySchedule.morningShift?.openTime || normalized.morningOpen}`,
        badgeText: 'Closed',
        badgeVariant: 'warning',
        badgeColor: '#F59E0B',
        mode: TIMING_MODES.SPLIT_SHIFT,
      };
    }
    if (currentMinutes >= mOpen && currentMinutes < mClose) {
      return {
        isOpen: true,
        statusText: `Open Now • Closes ${daySchedule.morningShift?.closeTime || normalized.morningClose}`,
        badgeText: 'Open Now',
        badgeVariant: 'success',
        badgeColor: '#10B981',
        activeShift: 'morning',
        closesAt: daySchedule.morningShift?.closeTime || normalized.morningClose,
        mode: TIMING_MODES.SPLIT_SHIFT,
      };
    }
    if (currentMinutes >= mClose && currentMinutes < eOpen) {
      return {
        isOpen: false,
        statusText: `Closed • Reopens ${daySchedule.eveningShift?.openTime || normalized.eveningOpen}`,
        badgeText: 'Closed for Break',
        badgeVariant: 'warning',
        badgeColor: '#F59E0B',
        mode: TIMING_MODES.SPLIT_SHIFT,
      };
    }
    if (currentMinutes >= eOpen && currentMinutes < eClose) {
      return {
        isOpen: true,
        statusText: `Open Now • Closes ${daySchedule.eveningShift?.closeTime || normalized.eveningClose}`,
        badgeText: 'Open Now',
        badgeVariant: 'success',
        badgeColor: '#10B981',
        activeShift: 'evening',
        closesAt: daySchedule.eveningShift?.closeTime || normalized.eveningClose,
        mode: TIMING_MODES.SPLIT_SHIFT,
      };
    }
    return {
      isOpen: false,
      statusText: 'Closed for the day',
      badgeText: 'Closed',
      badgeVariant: 'secondary',
      badgeColor: '#64748B',
      mode: TIMING_MODES.SPLIT_SHIFT,
    };
  }

  // Regular single continuous shift
  const openMins = parseTimeToMinutes(daySchedule.openTime || normalized.weekdayOpen);
  const closeMins = parseTimeToMinutes(daySchedule.closeTime || normalized.weekdayClose);

  if (currentMinutes < openMins) {
    return {
      isOpen: false,
      statusText: `Closed • Opens ${daySchedule.openTime || normalized.weekdayOpen}`,
      badgeText: 'Closed',
      badgeVariant: 'warning',
      badgeColor: '#F59E0B',
      mode: TIMING_MODES.REGULAR,
    };
  }
  if (currentMinutes >= openMins && currentMinutes < closeMins) {
    return {
      isOpen: true,
      statusText: `Open Now • Closes ${daySchedule.closeTime || normalized.weekdayClose}`,
      badgeText: 'Open Now',
      badgeVariant: 'success',
      badgeColor: '#10B981',
      closesAt: daySchedule.closeTime || normalized.weekdayClose,
      mode: TIMING_MODES.REGULAR,
    };
  }

  return {
    isOpen: false,
    statusText: 'Closed for the day',
    badgeText: 'Closed',
    badgeVariant: 'secondary',
    badgeColor: '#64748B',
    mode: TIMING_MODES.REGULAR,
  };
};

/**
 * Generates available 1-hour booking slots for a given day according to gym's timing configuration.
 */
export const generateAvailableSlots = (openingHours, targetDate = new Date(), slotDurationMinutes = 60) => {
  const emptyResult = {
    morningSlots: [],
    eveningSlots: [],
    allSlots: [],
    isOpen: false,
    reason: 'Closed',
  };

  if (!openingHours) return emptyResult;
  const normalized = normalizeOpeningHours(openingHours);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[targetDate.getDay()];

  const daySchedule = normalized.schedule.find(
    (s) => s.day.toLowerCase() === dayName.toLowerCase()
  );

  if (!daySchedule || !daySchedule.isOpen) {
    return { ...emptyResult, reason: 'Gym is closed on this day' };
  }

  const activeMode = daySchedule.mode || normalized.mode;
  const duration = Math.max(15, Math.min(240, Number(slotDurationMinutes) || 60));

  const morningSlots = [];
  const eveningSlots = [];

  const addSlots = (startMins, endMins, targetArray) => {
    if (startMins === null || endMins === null || startMins >= endMins) return;
    for (let current = startMins; current + duration <= endMins; current += duration) {
      targetArray.push(formatMinutesToTime(current));
    }
  };

  if (activeMode === TIMING_MODES.TWENTY_FOUR_HOURS) {
    addSlots(0, 720, morningSlots);
    addSlots(720, 1440, eveningSlots);
  } else if (activeMode === TIMING_MODES.SPLIT_SHIFT) {
    const mOpen = parseTimeToMinutes(daySchedule.morningShift?.openTime || normalized.morningOpen);
    const mClose = parseTimeToMinutes(daySchedule.morningShift?.closeTime || normalized.morningClose);
    const eOpen = parseTimeToMinutes(daySchedule.eveningShift?.openTime || normalized.eveningOpen);
    const eClose = parseTimeToMinutes(daySchedule.eveningShift?.closeTime || normalized.eveningClose);

    addSlots(mOpen, mClose, morningSlots);
    addSlots(eOpen, eClose, eveningSlots);
  } else {
    const openMins = parseTimeToMinutes(daySchedule.openTime || normalized.weekdayOpen);
    const closeMins = parseTimeToMinutes(daySchedule.closeTime || normalized.weekdayClose);

    // Split at 12:00 PM (720 min)
    if (openMins < 720) {
      addSlots(openMins, Math.min(closeMins, 720), morningSlots);
    }
    if (closeMins > 720) {
      addSlots(Math.max(openMins, 720), closeMins, eveningSlots);
    }
  }

  // If targetDate is today, filter out past time slots (strict same-day slot cutoff)
  const now = new Date();
  const isToday =
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate();

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const filterPastSlots = (slotList) => {
    if (!isToday) return slotList;
    return slotList.filter((timeStr) => {
      const slotMins = parseTimeToMinutes(timeStr);
      return slotMins !== null && slotMins > currentMinutes;
    });
  };

  const filteredMorning = filterPastSlots(morningSlots);
  const filteredEvening = filterPastSlots(eveningSlots);
  const allFiltered = [...filteredMorning, ...filteredEvening];

  return {
    morningSlots: filteredMorning,
    eveningSlots: filteredEvening,
    allSlots: allFiltered,
    isOpen: isToday ? allFiltered.length > 0 : true,
    mode: activeMode,
    reason: isToday && allFiltered.length === 0 ? 'All time slots for today have completed' : null,
  };
};

/**
 * Checks if a trainer is available on a specific calendar date (contract dates & active weekdays)
 */
export const isTrainerAvailableOnDate = (trainer, targetDate = new Date()) => {
  if (!trainer) return { available: true, reason: null };
  const sched = trainer.schedule || {};

  // Check Temporary contract dates
  if (trainer.type === 'Temporary') {
    if (sched.startDate) {
      const cStart = new Date(sched.startDate);
      cStart.setHours(0, 0, 0, 0);
      const checkDate = new Date(targetDate);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate < cStart) {
        return {
          available: false,
          reason: `Engagement starts on ${sched.startDate}`,
        };
      }
    }
    if (sched.endDate) {
      const cEnd = new Date(sched.endDate);
      cEnd.setHours(23, 59, 59, 999);
      const checkDate = new Date(targetDate);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate > cEnd) {
        return {
          available: false,
          reason: `Contract ended on ${sched.endDate}`,
        };
      }
    }
  }

  // Check working days
  if (Array.isArray(sched.workingDays) && sched.workingDays.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIdx = targetDate.getDay();
    const full = dayNames[dayIdx].toLowerCase();
    const short = dayShorts[dayIdx].toLowerCase();

    const worksToday = sched.workingDays.some((w) => {
      const val = String(w).trim().toLowerCase();
      return val === full || val === short || val.startsWith(short);
    });

    if (!worksToday) {
      return {
        available: false,
        reason: `Does not work on ${dayNames[dayIdx]}`,
      };
    }
  }

  return { available: true, reason: null };
};

/**
 * Generates available booking slots intersecting gym operating hours and trainer working hours.
 */
export const generateTrainerAvailableSlots = (
  openingHours,
  targetDate = new Date(),
  trainer = null,
  slotDurationMinutes = 60
) => {
  const gymSlots = generateAvailableSlots(openingHours, targetDate, slotDurationMinutes);
  if (!gymSlots.isOpen) return gymSlots;
  if (!trainer) return gymSlots;

  const trainerDateCheck = isTrainerAvailableOnDate(trainer, targetDate);
  if (!trainerDateCheck.available) {
    return {
      morningSlots: [],
      eveningSlots: [],
      allSlots: [],
      isOpen: false,
      reason: trainerDateCheck.reason,
    };
  }

  const sched = trainer.schedule || {};
  let tStartStr = sched.workingTimeStart || '09:00 AM';
  let tEndStr = sched.workingTimeEnd || '06:00 PM';

  if (sched.isDifferentDays && Array.isArray(sched.dayWiseHours) && sched.dayWiseHours.length > 0) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIdx = targetDate.getDay();
    const full = dayNames[dayIdx].toLowerCase();
    const short = dayShorts[dayIdx].toLowerCase();

    const dayHour = sched.dayWiseHours.find((dh) => {
      const d = (dh.day || '').trim().toLowerCase();
      return d === full || d === short || d.startsWith(short);
    });
    if (dayHour && dayHour.startTime && dayHour.endTime) {
      tStartStr = dayHour.startTime;
      tEndStr = dayHour.endTime;
    }
  }

  const trainerStartMins = parseTimeToMinutes(tStartStr);
  const trainerEndMins = parseTimeToMinutes(tEndStr);
  const duration = Math.max(15, Math.min(240, Number(slotDurationMinutes) || 60));

  const filterSlots = (slotList) =>
    slotList.filter((slotStr) => {
      const slotMins = parseTimeToMinutes(slotStr);
      if (slotMins === null) return false;
      if (trainerStartMins !== null && slotMins < trainerStartMins) return false;
      if (trainerEndMins !== null && slotMins + duration > trainerEndMins) return false;
      return true;
    });

  const morningSlots = filterSlots(gymSlots.morningSlots);
  const eveningSlots = filterSlots(gymSlots.eveningSlots);
  const allSlots = [...morningSlots, ...eveningSlots];

  return {
    morningSlots,
    eveningSlots,
    allSlots,
    isOpen: allSlots.length > 0,
    mode: gymSlots.mode,
    reason: allSlots.length === 0 ? `Trainer hours (${tStartStr} - ${tEndStr}) outside gym slots` : null,
  };
};
