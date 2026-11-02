import mongoose from 'mongoose';

export const CANCELLATION_NEGOTIATION_STATUS = [
  'PENDING_GYM_APPROVAL',
  'PENDING_MEMBER_APPROVAL',
  'COMPLETED',
  'REJECTED_BY_GYM',
  'CANCELLED_BY_USER',
];

const offerSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true, min: 1 },
    deductionAmount: { type: Number, required: true, min: 0 },
    refundAmount: { type: Number, required: true, min: 0 },
    message: { type: String, trim: true, default: '' },
    offeredAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const responseSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true, min: 1 },
    action: { type: String, enum: ['ACCEPTED', 'REJECTED'], required: true },
    respondedAt: { type: Date, default: Date.now },
    message: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const membershipCancellationSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
    gymId: { type: mongoose.Schema.Types.ObjectId, ref: 'Gym', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true, trim: true },
    originalAmount: { type: Number, required: true, min: 0 },
    maximumRefundAmount: { type: Number, required: true, min: 0 },
    currentOffer: {
      type: offerSchema,
      default: null,
    },
    offers: [offerSchema],
    memberResponses: [responseSchema],
    status: {
      type: String,
      enum: CANCELLATION_NEGOTIATION_STATUS,
      default: 'PENDING_GYM_APPROVAL',
      index: true,
    },
    approvedRefundAmount: { type: Number, default: 0, min: 0 },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

membershipCancellationSchema.index(
  { membershipId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['PENDING_GYM_APPROVAL', 'PENDING_MEMBER_APPROVAL'] },
    },
  }
);

export const MembershipCancellation = mongoose.model(
  'MembershipCancellation',
  membershipCancellationSchema
);
export default MembershipCancellation;
