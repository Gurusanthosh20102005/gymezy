import mongoose from 'mongoose';
import crypto from 'node:crypto';

export const MEMBERSHIP_TIERS = ['Monthly', 'Quarterly', 'Half Yearly', 'Annual'];
export const MEMBERSHIP_SOURCES = ['APP', 'WALK_IN'];
export const MEMBERSHIP_STATUS = [
  'Active',
  'Upcoming',
  'Expiring Soon',
  'Expired',
  'Cancelled',
  'Switched',
  'PendingDowngrade',
];
export const PAYMENT_METHODS = ['UPI', 'Card', 'Net Banking', 'Cash', 'Wallet', 'Online', 'GPay', 'POS', 'COD'];
export const PAYMENT_STATUS = ['Completed', 'Pending', 'Failed', 'Refunded'];

const pauseHistorySchema = new mongoose.Schema(
  {
    pausedAt: { type: Date, required: true },
    resumedAt: { type: Date, default: null },
    daysPaused: { type: Number, default: 0 },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const switchMetadataSchema = new mongoose.Schema(
  {
    switchType: {
      type: String,
      enum: ['UPGRADE', 'DOWNGRADE', 'RENEWAL'],
      required: true,
    },
    switchedAt: { type: Date, default: Date.now },
    previousMembershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
    },
    replacedByMembershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
    },
    daysUsed: { type: Number, default: 0 },
    daysRemaining: { type: Number, default: 0 },
    dailyRatePaise: { type: Number, default: 0 },
    proRatedCreditPaise: { type: Number, default: 0 },
    creditAppliedPaise: { type: Number, default: 0 },
    leftoverCreditPaise: { type: Number, default: 0 },
    leftoverActionTaken: {
      type: String,
      enum: ['NONE', 'WALLET_CREDITED', 'REFUNDED', 'EXTENDED_DAYS', 'PENDING'],
      default: 'NONE',
    },
    extraDaysAwarded: { type: Number, default: 0 },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    basePrice: { type: Number, required: true, min: 0 },
    trainerFee: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR', trim: true },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'UPI',
    },
    status: {
      type: String,
      enum: PAYMENT_STATUS,
      default: 'Completed',
    },
    transactionId: { type: String, required: true, trim: true },
    walletAmountApplied: { type: Number, default: 0, min: 0 },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cancellationSchema = new mongoose.Schema(
  {
    cancelledAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true, default: 'Cancelled by gym owner' },
    refundAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, trim: true, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledByName: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const membershipSchema = new mongoose.Schema(
  {
    membershipId: {
      type: String,
      required: true,
      trim: true,
      index: true,
      // Scoped per gym: MEM00{counter} (e.g. MEM001, MEM002)
    },
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    gymPartnerId: {
      type: String,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trainerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    hasTrainer: {
      type: Boolean,
      default: false,
    },
    trainerSlot: {
      type: String,
      default: null,
      trim: true,
    },
    membershipTier: {
      type: String,
      required: true,
      trim: true,
      set: (val) => {
        if (!val) return val;
        const clean = String(val).trim().toLowerCase();
        if (clean.includes('month')) return 'Monthly';
        if (clean.includes('quarter')) return 'Quarterly';
        if (clean.includes('half')) return 'Half Yearly';
        if (clean.includes('annual') || clean.includes('year')) return 'Annual';
        return val;
      },
      enum: MEMBERSHIP_TIERS,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    pricing: {
      type: pricingSchema,
      required: true,
    },
    payment: {
      type: paymentSchema,
      required: true,
    },
    status: {
      type: String,
      enum: MEMBERSHIP_STATUS,
      default: 'Active',
      index: true,
    },
    source: {
      type: String,
      enum: MEMBERSHIP_SOURCES,
      default: 'APP',
      index: true,
    },
    walkInDetails: {
      bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
      bookedByName: { type: String, trim: true, default: '' },
      notes: { type: String, trim: true, default: '' },
    },
    cancellation: {
      type: cancellationSchema,
      default: null,
    },
    entryOtp: {
      type: String,
      trim: true,
      index: true,
    },
    pauseHistory: [pauseHistorySchema],
    switchMetadata: {
      type: switchMetadataSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate 6-digit entry OTP and synchronize status based on date window
membershipSchema.pre('save', function () {
  const now = new Date();
  const isFuture = this.startDate && new Date(this.startDate) > now;
  const isPast = this.endDate && new Date(this.endDate) < now;

  if (
    this.status !== 'Cancelled' &&
    this.status !== 'Switched' &&
    this.status !== 'PendingDowngrade'
  ) {
    if (isFuture) {
      this.status = 'Upcoming';
    } else if (isPast) {
      this.status = 'Expired';
    } else {
      this.status = 'Active';
    }
  }

  const isStrictlyActive = this.status === 'Active' && !isFuture && !isPast;
  if (isStrictlyActive) {
    if (!this.entryOtp) {
      this.entryOtp = crypto.randomInt(100000, 1000000).toString();
    }
  } else {
    this.entryOtp = null;
  }
});

// Compound index guaranteeing uniqueness of membershipId per gym
membershipSchema.index({ gymId: 1, membershipId: 1 }, { unique: true });

// Compound partial index guaranteeing only ONE active or upcoming plan per user per gym
membershipSchema.index(
  { gymId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['Active', 'Upcoming', 'PendingDowngrade'] },
    },
    name: 'unique_active_user_gym_membership',
  }
);

export const Membership = mongoose.model('Membership', membershipSchema);
export default Membership;
