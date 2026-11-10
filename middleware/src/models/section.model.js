import mongoose from 'mongoose';

export const SECTION_CATEGORIES = [
  'gym',
  'yoga',
  'zumba',
  'crossfit',
  'hiit',
  'pilates',
  'boxing',
  'other',
];

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const sectionSchema = new mongoose.Schema(
  {
    // Gym Association - By ID Only
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: [true, 'Gym ID is required'],
      index: true,
    },

    // Assigned Trainer - By ID Only
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: [true, 'Trainer ID is required'],
      index: true,
    },

    // Section Title (e.g. "Basic Yoga 20 Days")
    title: {
      type: String,
      required: [true, 'Section name is required'],
      trim: true,
      maxlength: 120,
    },

    // Category
    category: {
      type: String,
      enum: SECTION_CATEGORIES,
      default: 'yoga',
      index: true,
    },

    // Cost / Pricing
    cost: {
      type: Number,
      required: [true, 'Section cost is required'],
      min: [0, 'Cost cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },

    // Schedule: Start Date & Duration in Days
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    durationDays: {
      type: Number,
      required: [true, 'Duration in days is required'],
      min: [1, 'Duration must be at least 1 day'],
      default: 20,
    },
    endDate: {
      type: Date,
    },

    // Daily Timings
    startTime: {
      type: String, // e.g. "06:00 AM"
      required: [true, 'Start time is required'],
      trim: true,
    },
    endTime: {
      type: String, // e.g. "07:00 AM"
      required: [true, 'End time is required'],
      trim: true,
    },

    // Weekly Recurrence (Selected Days)
    activeDays: {
      type: [
        {
          type: String,
          enum: DAYS_OF_WEEK,
        },
      ],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one active day of the week must be selected',
      },
    },

    // Max Student/Member Capacity
    maxCapacity: {
      type: Number,
      default: 25,
      min: [1, 'Capacity must be at least 1'],
    },
    enrolledCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Program Description & Guidelines
    description: {
      type: String,
      trim: true,
      default: '',
    },
    inclusions: {
      type: [{ type: String, trim: true }],
      default: [],
    },
    instructions: {
      type: String,
      trim: true,
      default: '',
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Calculates the exact end date based on active days of the week in schedule.
 * If 20 sessions are specified on [Mon, Wed, Fri, Sat], it counts 20 occurrences of those days.
 */
export const calculateScheduleEndDate = (startDateInput, durationDaysInput, activeDaysInput) => {
  if (!startDateInput) return null;
  const d = new Date(startDateInput);
  if (Number.isNaN(d.getTime())) return null;

  const targetSessions = Math.max(1, Number(durationDaysInput) || 1);
  const activeDaysSet = new Set(
    Array.isArray(activeDaysInput) && activeDaysInput.length > 0
      ? activeDaysInput
      : DAYS_OF_WEEK
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let current = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let sessionsCounted = 0;
  let safetyLimit = 365 * 5;

  while (safetyLimit > 0) {
    const dayName = dayNames[current.getDay()];
    if (activeDaysSet.has(dayName)) {
      sessionsCounted += 1;
      if (sessionsCounted >= targetSessions) {
        return current;
      }
    }
    current.setDate(current.getDate() + 1);
    safetyLimit -= 1;
  }
  return current;
};

export const parseTimeStringToHoursMinutes = (timeStr, defaultHours = 0, defaultMins = 0) => {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hours: defaultHours, minutes: defaultMins };
  }
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const numbersOnly = clean.replace(/[^\d:]/g, '');
  const [hStr, mStr] = numbersOnly.split(':');
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr || '0', 10);
  if (Number.isNaN(h)) h = defaultHours;
  if (Number.isNaN(m)) m = defaultMins;
  if (isPM && h < 12) h += 12;
  if (isAM && h === 12) h = 0;
  return { hours: h, minutes: m };
};

/**
 * Single Source of Truth (SSOT) Lifecycle Calculator for Section / Group Class Batches
 * Computes exact start and end datetimes, determine if the batch has started, is ongoing,
 * is completed, or is paused, and whether it is currently accepting user bookings.
 *
 * @param {Object} section
 * @param {Date|string} [referenceDate=new Date()]
 * @returns {Object} lifecycle info
 */
export const getSectionLifecycle = (section, referenceDate = new Date()) => {
  if (!section) {
    return {
      status: 'COMPLETED',
      isBookable: false,
      isStarted: true,
      isCompleted: true,
      isPaused: false,
      isCapacityFull: false,
      startDateTime: null,
      endDateTime: null,
    };
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  // 1. Resolve start datetime
  const sDate = section.startDate ? new Date(section.startDate) : new Date();
  const { hours: sH, minutes: sM } = parseTimeStringToHoursMinutes(section.startTime, 0, 0);
  const startDateTime = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate(), sH, sM, 0, 0);

  // 2. Resolve end datetime
  let effectiveEnd = section.endDate;
  if (!effectiveEnd && section.startDate && section.durationDays) {
    effectiveEnd = calculateScheduleEndDate(section.startDate, section.durationDays, section.activeDays);
  }
  if (!effectiveEnd) {
    effectiveEnd = section.startDate || now;
  }
  const eDate = new Date(effectiveEnd);
  const { hours: eH, minutes: eM } = parseTimeStringToHoursMinutes(section.endTime, 23, 59);
  const endDateTime = new Date(eDate.getFullYear(), eDate.getMonth(), eDate.getDate(), eH, eM, 59, 999);

  // 3. Evaluate lifecycle state
  const isStarted = now >= startDateTime;
  const isCompleted = now > endDateTime;
  const isPaused = section.isActive === false;
  const isCapacityFull = (Number(section.enrolledCount) || 0) >= (Number(section.maxCapacity) || 25);

  let status = 'UPCOMING';
  if (isCompleted) {
    status = 'COMPLETED';
  } else if (isPaused) {
    status = 'PAUSED';
  } else if (isStarted) {
    status = 'ONGOING';
  } else {
    status = 'UPCOMING';
  }

  // Strict cut-off: Can ONLY be booked before startDateTime, when active and not full
  const isBookable = status === 'UPCOMING' && !isPaused && !isCapacityFull;

  return {
    status,
    isBookable,
    isStarted,
    isCompleted,
    isPaused,
    isCapacityFull,
    startDateTime,
    endDateTime,
  };
};

/**
 * Converts a time string (e.g. '06:30 AM', '18:45') to total minutes since midnight
 */
export const timeStringToMinutes = (timeStr, defaultMinutes = 0) => {
  const { hours, minutes } = parseTimeStringToHoursMinutes(timeStr, Math.floor(defaultMinutes / 60), defaultMinutes % 60);
  return hours * 60 + minutes;
};

/**
 * Checks whether an existing active section conflicts with a proposed schedule for the same trainer
 * @param {Object} existingSection
 * @param {Object} proposedSchedule - { startDate, endDate, startTime, endTime, activeDays, excludeSectionId }
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ hasConflict: boolean, reason?: string, sectionId?: any, sectionTitle?: string }}
 */
export const checkTrainerSectionConflict = (existingSection, proposedSchedule, referenceDate = new Date()) => {
  if (!existingSection || !proposedSchedule) {
    return { hasConflict: false };
  }

  // Skip self if editing
  const existingId = (existingSection._id || existingSection.id)?.toString();
  const excludeId = (proposedSchedule.excludeSectionId?._id || proposedSchedule.excludeSectionId)?.toString();
  if (existingId && excludeId && existingId === excludeId) {
    return { hasConflict: false };
  }

  // Skip paused/inactive sections
  if (existingSection.isActive === false) {
    return { hasConflict: false };
  }

  // Skip completed sections
  const existingLifecycle = getSectionLifecycle(existingSection, referenceDate);
  if (existingLifecycle.isCompleted) {
    return { hasConflict: false };
  }

  // 1. Date Range Overlap Check
  const pStart = new Date(proposedSchedule.startDate);
  let pEnd = proposedSchedule.endDate ? new Date(proposedSchedule.endDate) : null;
  if (!pEnd && proposedSchedule.durationDays) {
    pEnd = calculateScheduleEndDate(pStart, proposedSchedule.durationDays, proposedSchedule.activeDays);
  }
  if (!pEnd) pEnd = pStart;

  const eStart = new Date(existingSection.startDate);
  let eEnd = existingSection.endDate ? new Date(existingSection.endDate) : null;
  if (!eEnd && existingSection.durationDays) {
    eEnd = calculateScheduleEndDate(eStart, existingSection.durationDays, existingSection.activeDays);
  }
  if (!eEnd) eEnd = eStart;

  // Set to day bounds
  const pStartMidnight = new Date(pStart.getFullYear(), pStart.getMonth(), pStart.getDate());
  const pEndMidnight = new Date(pEnd.getFullYear(), pEnd.getMonth(), pEnd.getDate(), 23, 59, 59, 999);
  const eStartMidnight = new Date(eStart.getFullYear(), eStart.getMonth(), eStart.getDate());
  const eEndMidnight = new Date(eEnd.getFullYear(), eEnd.getMonth(), eEnd.getDate(), 23, 59, 59, 999);

  const datesOverlap = pStartMidnight <= eEndMidnight && pEndMidnight >= eStartMidnight;
  if (!datesOverlap) {
    return { hasConflict: false };
  }

  // 2. Active Days Overlap Check (e.g. ['Mon', 'Wed'] vs ['Mon', 'Fri'])
  const pDays = new Set((proposedSchedule.activeDays || []).map((d) => String(d).trim().toLowerCase().slice(0, 3)));
  const eDays = (existingSection.activeDays || []).map((d) => String(d).trim().toLowerCase().slice(0, 3));
  const commonDays = eDays.filter((d) => pDays.has(d));
  if (commonDays.length === 0) {
    return { hasConflict: false };
  }

  // 3. Time Slot Overlap Check
  const pStartMin = timeStringToMinutes(proposedSchedule.startTime, 0);
  const pEndMin = timeStringToMinutes(proposedSchedule.endTime, 1439);
  const eStartMin = timeStringToMinutes(existingSection.startTime, 0);
  const eEndMin = timeStringToMinutes(existingSection.endTime, 1439);

  const timesOverlap = eStartMin < pEndMin && eEndMin > pStartMin;
  if (!timesOverlap) {
    return { hasConflict: false };
  }

  return {
    hasConflict: true,
    reason: `Trainer already has batch "${existingSection.title || 'Untitled'}" scheduled (${existingSection.startTime} - ${existingSection.endTime}) on overlapping days`,
    sectionId: existingSection._id,
    sectionTitle: existingSection.title,
  };
};

/**
 * Checks if a trainer is available for a proposed section schedule
 * @param {Object} trainer - Employee document or object
 * @param {Object} proposedSchedule - { startDate, durationDays, endDate, startTime, endTime, activeDays, excludeSectionId }
 * @param {Array} existingTrainerSections - Active sections currently assigned to this trainer
 * @param {Date} [referenceDate=new Date()]
 * @returns {{ isAvailable: boolean, reason?: string }}
 */
export const isTrainerAvailableForSchedule = (
  trainer,
  proposedSchedule,
  existingTrainerSections = [],
  referenceDate = new Date()
) => {
  if (!trainer) {
    return { isAvailable: false, reason: 'Trainer record not found' };
  }

  // 1. Trainer Status Check
  const status = trainer.status || 'Active';
  if (status !== 'Active') {
    return { isAvailable: false, reason: `Trainer is currently ${status}` };
  }

  // 2. Working Days Check
  const workingDays = trainer.schedule?.workingDays;
  if (Array.isArray(workingDays) && workingDays.length > 0) {
    const normalizedWorkingDays = new Set(
      workingDays.map((w) => String(w).trim().toLowerCase().slice(0, 3))
    );
    const proposedDays = (proposedSchedule.activeDays || []).map((d) =>
      String(d).trim().toLowerCase().slice(0, 3)
    );
    const offDays = proposedDays.filter((d) => !normalizedWorkingDays.has(d));
    if (offDays.length > 0) {
      return {
        isAvailable: false,
        reason: `Trainer does not work on ${offDays.map((d) => d.toUpperCase()).join(', ')}`,
      };
    }
  }

  // 3. Working Hours Check
  const tStartStr = trainer.schedule?.workingTimeStart;
  const tEndStr = trainer.schedule?.workingTimeEnd;
  if (tStartStr && tEndStr && proposedSchedule.startTime && proposedSchedule.endTime) {
    const tStartMin = timeStringToMinutes(tStartStr, 0);
    const tEndMin = timeStringToMinutes(tEndStr, 1439);
    const pStartMin = timeStringToMinutes(proposedSchedule.startTime, 0);
    const pEndMin = timeStringToMinutes(proposedSchedule.endTime, 1439);

    if (pStartMin < tStartMin || pEndMin > tEndMin) {
      return {
        isAvailable: false,
        reason: `Section time (${proposedSchedule.startTime} - ${proposedSchedule.endTime}) is outside trainer's working hours (${tStartStr} - ${tEndStr})`,
      };
    }
  }

  // 4. Existing Section Conflict Check
  if (Array.isArray(existingTrainerSections) && existingTrainerSections.length > 0) {
    for (const sec of existingTrainerSections) {
      const conflict = checkTrainerSectionConflict(sec, proposedSchedule, referenceDate);
      if (conflict.hasConflict) {
        return {
          isAvailable: false,
          reason: conflict.reason,
          conflictingSection: conflict.sectionTitle,
        };
      }
    }
  }

  return { isAvailable: true };
};

// Pre-save hook: auto-calculate endDate based on Weekly Schedule if not provided
sectionSchema.pre('save', function () {
  if (this.startDate && this.durationDays && !this.endDate) {
    this.endDate = calculateScheduleEndDate(this.startDate, this.durationDays, this.activeDays);
  }
});

export const Section = mongoose.model('Section', sectionSchema);
export default Section;
