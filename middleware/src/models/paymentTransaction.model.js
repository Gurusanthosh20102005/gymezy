import mongoose from 'mongoose';

const refundRecordSchema = new mongoose.Schema(
  {
    refundId: { type: String, trim: true, required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED'],
      default: 'PENDING',
    },
    reason: { type: String, trim: true, default: '' },
    initiatedBy: { type: String, trim: true, default: 'SYSTEM' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const paymentTransactionSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    paymentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    signature: {
      type: String,
      trim: true,
      default: '',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
      default: '',
    },
    flowType: {
      type: String,
      enum: [
        'MEMBERSHIP_PURCHASE',
        'MEMBERSHIP_EXTEND',
        'PLAN_SWITCH_UPGRADE',
        'BOOKING_PASS',
        'WALLET_TOPUP',
      ],
      required: true,
      index: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    referenceModel: {
      type: String,
      enum: ['Membership', 'Booking', 'MembershipSwitchRequest', 'Wallet', ''],
      default: '',
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    walletAppliedPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    status: {
      type: String,
      enum: ['CREATED', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      default: 'CREATED',
      index: true,
    },
    failureReason: {
      type: String,
      trim: true,
      default: '',
    },
    draftPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    refunds: {
      type: [refundRecordSchema],
      default: [],
    },
    routeTransfer: {
      transferId: { type: String, trim: true, default: '' },
      linkedAccountId: { type: String, trim: true, default: '' },
      grossAmountPaise: { type: Number, default: 0 },
      commissionPaise: { type: Number, default: 0 },
      netAmountPaise: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['PENDING', 'TRANSFERRED', 'FAILED'],
        default: 'PENDING',
      },
      approvedBy: { type: String, trim: true, default: '' },
      transferredAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

export const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
