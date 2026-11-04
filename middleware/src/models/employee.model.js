import mongoose from 'mongoose';

const employeeAuditLogSchema = new mongoose.Schema(
  {
    changeType: {
      type: String,
      enum: ['ADD_EMPLOYEE', 'EDIT_EMPLOYEE', 'DEACTIVATE_EMPLOYEE', 'STATUS_CHANGE'],
      required: true,
    },
    changedBy: { type: String, trim: true, default: 'Gym Owner' },
    changedByRole: { type: String, trim: true, default: 'GYM_OWNER' },
    changedAt: { type: Date, default: Date.now },
    gymId: { type: mongoose.Schema.Types.Mixed, required: true, index: true },
    gymPartnerId: { type: String, trim: true, required: true, index: true },
    gymName: { type: String, trim: true, default: '' },
    editedFields: { type: mongoose.Schema.Types.Mixed, default: {} }, // Diffs e.g. { role: { old: 'Trainer', new: 'Manager' } }
    previousSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    newSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    approvalStatus: {
      type: String,
      enum: ['Pending Approval', 'Approved', 'Rejected'],
      default: 'Pending Approval',
      index: true,
    },
    adminRemarks: { type: String, trim: true, default: '' },
    reviewedBy: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: true }
);

const employeeSchema = new mongoose.Schema(
  {
    // Gym Association (Mandatory)
    gymId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Gym ID is required'],
      index: true,
    },
    gymPartnerId: {
      type: String,
      required: [true, 'Gym Partner ID is required'],
      trim: true,
      index: true,
    },
    gymName: {
      type: String,
      trim: true,
      default: '',
    },

    // Employee Identification
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
    role: {
      type: String,
      required: [true, 'Employee role is required'],
      trim: true,
      default: 'Trainer',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'All', 'Other'],
      default: 'All',
    },
    joinDate: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['Full-Time', 'Part-Time', 'Temporary'],
      default: 'Full-Time',
    },
    accessType: {
      type: String,
      enum: ['Admin', 'Employee', 'None'],
      default: 'Employee',
    },

    // Granular permissions for Manager roles (delegated by Gym Admin)
    managerPermissions: {
      requireStaffApproval: { type: Boolean, default: true },
      requirePlanSwitchApproval: { type: Boolean, default: true },
      requireCancellationApproval: { type: Boolean, default: true },
      requireProfileEditApproval: { type: Boolean, default: true },
    },

    // Status & Approval State
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended', 'On Leave'],
      default: 'Active',
      index: true,
    },
    attendance: {
      type: String,
      enum: ['Present', 'Absent', 'On Leave', '—'],
      default: 'Present',
    },
    approvalStatus: {
      type: String,
      enum: ['Pending Approval', 'Approved', 'Rejected'],
      default: 'Approved',
      index: true,
    },
    pendingAction: {
      type: String,
      enum: ['NEW_EMPLOYEE', 'EDIT_DETAILS', 'DEACTIVATION', 'NONE'],
      default: 'NONE',
    },
    pendingChanges: {
      type: mongoose.Schema.Types.Mixed,
      default: null, // Stores draft changes before Gym Admin approval
    },
    submittedByManager: {
      managerId: { type: mongoose.Schema.Types.Mixed, default: null },
      managerName: { type: String, default: '' },
      submittedAt: { type: Date, default: null },
    },
    adminRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    approvedBy: {
      type: String,
      trim: true,
      default: '',
    },
    approvedAt: {
      type: Date,
      default: null,
    },

    // Professional & Past Employment Details
    specialty: { type: String, trim: true, default: '' },
    experienceYears: { type: Number, default: 1, min: 0 },
    experience: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    aboutMe: { type: String, trim: true, default: '' },
    servicesOffered: [{ type: String, trim: true }],
    certifications: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    previousCompany: { type: String, trim: true, default: '' },
    previousDesignation: { type: String, trim: true, default: '' },
    previousExp: { type: String, trim: true, default: '' },
    previousEmployments: [
      {
        companyName: { type: String, trim: true, default: '' },
        designation: { type: String, trim: true, default: '' },
        experience: { type: String, trim: true, default: '' },
      },
    ],
    rating: { type: Number, default: 4.9, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    ratings: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: { type: String, trim: true, default: 'Member' },
        userImageUrl: { type: String, trim: true, default: '' },
        rating: { type: Number, min: 1, max: 5, default: 5 },
        comment: { type: String, trim: true, default: '' },
        bookingType: { type: String, trim: true, default: 'Personal Training' },
        date: { type: String, trim: true, default: 'Recent' },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Emergency Contact
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      relationship: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },

    // Schedule & Pay
    schedule: {
      workingDays: [{ type: String, trim: true }],
      workingTimeStart: { type: String, trim: true, default: '09:00 AM' },
      workingTimeEnd: { type: String, trim: true, default: '06:00 PM' },
      isDifferentDays: { type: Boolean, default: false },
      dayWiseHours: [
        {
          day: { type: String, trim: true },
          startTime: { type: String, trim: true },
          endTime: { type: String, trim: true },
        },
      ],
      startDate: { type: String, trim: true, default: '' },
      endDate: { type: String, trim: true, default: '' },
    },
    compensation: {
      payType: { type: String, enum: ['Hourly', 'Session', 'Daily', 'Weekly', 'Monthly'], default: 'Monthly' },
      payAmount: { type: Number, default: 0, min: 0 },
      payFreq: { type: String, enum: ['Daily', 'Weekly', 'Monthly', 'Per Session', 'Per Hour'], default: 'Monthly' },
    },
    // Standard Membership Tier Pricing Mapping & Trainer Fee (for trainers)
    trainerFee: { type: Number, default: 0, min: 0 },
    personalTrainingFee: { type: Number, default: 0, min: 0 },
    tierPricing: [
      {
        tier: { type: String, required: true, trim: true },
        fee: { type: Number, required: true, default: 0, min: 0 },
        durationDays: { type: Number, default: 30, min: 1 },
      },
    ],
    trainerPricing: {
      monthly: { type: Number, default: 0, min: 0 },
      quarterly: { type: Number, default: 0, min: 0 },
      halfYearly: { type: Number, default: 0, min: 0 },
      annual: { type: Number, default: 0, min: 0 },
      singleSession: { type: Number, default: 0, min: 0 },
    },
    notes: { type: String, trim: true, default: '' },

    // Uploaded Documents & Certificates
    documents: [
      {
        docType: { type: String, trim: true, default: 'Personal Document' },
        docNum: { type: String, trim: true, default: '' },
        fileName: { type: String, trim: true, default: '' },
        fileData: { type: String, default: '' },
        addedOn: { type: String, trim: true, default: '' },
      },
    ],
    trainerCerts: [
      {
        certType: { type: String, trim: true, default: 'Trainer Certificate' },
        certNum: { type: String, trim: true, default: '' },
        fileName: { type: String, trim: true, default: '' },
        fileData: { type: String, default: '' },
        addedOn: { type: String, trim: true, default: '' },
      },
    ],

    // Complete Audit Log of all additions & edits
    auditHistory: [employeeAuditLogSchema],
  },
  {
    timestamps: true,
  }
);

employeeSchema.index({ gymId: 1, approvalStatus: 1 });
employeeSchema.index({ gymPartnerId: 1, employeeId: 1 });

employeeSchema.pre('save', function () {
  if (this.role === 'Trainer') {
    const monthly = Number(this.trainerPricing?.monthly) || Number(this.trainerFee) || Number(this.personalTrainingFee) || 0;
    const quarterly = Number(this.trainerPricing?.quarterly) || 0;
    const halfYearly = Number(this.trainerPricing?.halfYearly) || 0;
    const annual = Number(this.trainerPricing?.annual) || 0;

    if (!this.trainerFee && monthly) this.trainerFee = monthly;
    if (!this.personalTrainingFee && monthly) this.personalTrainingFee = monthly;

    if (!this.trainerPricing) {
      this.trainerPricing = {
        monthly,
        quarterly,
        halfYearly,
        annual,
        singleSession: 0,
      };
    } else if (!this.trainerPricing.monthly && this.trainerFee) {
      this.trainerPricing.monthly = this.trainerFee;
    }

    if (!Array.isArray(this.tierPricing) || this.tierPricing.length === 0) {
      this.tierPricing = [
        { tier: 'Monthly', fee: monthly, durationDays: 30 },
        { tier: 'Quarterly', fee: quarterly, durationDays: 90 },
        { tier: 'Half-Yearly', fee: halfYearly, durationDays: 180 },
        { tier: 'Annual', fee: annual, durationDays: 365 },
      ];
    } else {
      const mTier = this.tierPricing.find((t) => t.tier === 'Monthly');
      const qTier = this.tierPricing.find((t) => t.tier === 'Quarterly');
      const hTier = this.tierPricing.find((t) => t.tier === 'Half-Yearly');
      const aTier = this.tierPricing.find((t) => t.tier === 'Annual');

      if (mTier) {
        this.trainerFee = mTier.fee;
        this.personalTrainingFee = mTier.fee;
        if (this.trainerPricing) this.trainerPricing.monthly = mTier.fee;
      }
      if (qTier && this.trainerPricing) this.trainerPricing.quarterly = qTier.fee;
      if (hTier && this.trainerPricing) this.trainerPricing.halfYearly = hTier.fee;
      if (aTier && this.trainerPricing) this.trainerPricing.annual = aTier.fee;
    }
  }
});

const sanitizeJsonTransform = (_doc, ret) => {
  if (ret._id) {
    ret.id = ret._id.toString();
    ret.key = ret._id.toString();
  }
  delete ret._id;
  delete ret.__v;
  return ret;
};

employeeSchema.set('toJSON', { transform: sanitizeJsonTransform });
employeeSchema.set('toObject', { transform: sanitizeJsonTransform });

export const Employee = mongoose.model('Employee', employeeSchema);
export default Employee;
