import mongoose from 'mongoose';

export const SWITCH_REQUEST_STATUS = [
  'PENDING_GYM_APPROVAL',
  'PENDING_GYM_ADMIN_APPROVAL',
  'PENDING_SUPER_ADMIN_APPROVAL',
  'APPROVED_AND_EXECUTED',
  'REJECTED_BY_GYM',
  'REJECTED_BY_SUPER_ADMIN',
  'CANCELLED_BY_USER',
];

const approvalAuditSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewerName: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
    remarks: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const quoteSnapshotSchema = new mongoose.Schema(
  {
    switchType: { type: String, enum: ['UPGRADE', 'DOWNGRADE'], required: true },
    currentPricePaise: { type: Number, required: true },
    currentDurationDays: { type: Number, required: true },
    daysUsed: { type: Number, required: true },
    daysRemaining: { type: Number, required: true },
    dailyRatePaise: { type: Number, required: true },
    proRatedCreditPaise: { type: Number, required: true },
    newPricePaise: { type: Number, required: true },
    newDurationDays: { type: Number, required: true },
    grossPayablePaise: { type: Number, required: true },
    walletDeductionPaise: { type: Number, default: 0 },
    netAmountToPayPaise: { type: Number, required: true },
    leftoverCreditPaise: { type: Number, default: 0 },
    extraDaysAwarded: { type: Number, default: 0 },
    effectiveNewDurationDays: { type: Number, required: true },
    downgradePolicy: { type: String, required: true },
  },
  { _id: false }
);

const membershipSwitchRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    membershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      required: true,
    },
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetTier: {
      type: String,
      required: true,
      trim: true,
    },
    targetPlanId: {
      type: String,
      required: true,
      trim: true,
    },
    quoteSnapshot: {
      type: quoteSnapshotSchema,
      required: true,
    },
    paymentDetails: {
      method: { type: String, default: 'UPI' },
      transactionId: { type: String, trim: true, default: '' },
      isPrepaid: { type: Boolean, default: false },
    },
    gymApproval: {
      type: approvalAuditSchema,
      default: () => ({ status: 'PENDING' }),
    },
    superAdminApproval: {
      type: approvalAuditSchema,
      default: () => ({ status: 'PENDING' }),
    },
    status: {
      type: String,
      enum: SWITCH_REQUEST_STATUS,
      default: 'PENDING_GYM_APPROVAL',
      index: true,
    },
    executedNewMembershipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Membership',
      default: null,
    },
    executedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

membershipSwitchRequestSchema.index(
  { membershipId: 1 },
  {
    partialFilterExpression: {
      status: { $in: ['PENDING_GYM_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL'] },
    },
    unique: true,
  }
);

export const MembershipSwitchRequest = mongoose.model(
  'MembershipSwitchRequest',
  membershipSwitchRequestSchema
);
export default MembershipSwitchRequest;
