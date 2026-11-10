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

// Pre-save hook: auto-calculate endDate based on Weekly Schedule if not provided
sectionSchema.pre('save', function () {
  if (this.startDate && this.durationDays && !this.endDate) {
    this.endDate = calculateScheduleEndDate(this.startDate, this.durationDays, this.activeDays);
  }
});

export const Section = mongoose.model('Section', sectionSchema);
export default Section;
