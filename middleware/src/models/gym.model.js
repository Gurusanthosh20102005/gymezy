import mongoose from 'mongoose';

const fileAttachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, trim: true, default: '' }, // Formatted as {gymname}_{filename} e.g. "titanium_fitness_pan.webp"
    fileData: { type: String, default: '' }, // Compressed Base64 Data URL (data:image/webp;base64,... or data:application/pdf;base64,...)
    mimeType: { type: String, trim: true, default: '' }, // "image/webp" | "application/pdf"
    fileSizeKb: { type: Number, default: 0 },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const shiftWindowSchema = new mongoose.Schema(
  {
    openTime: { type: String, trim: true, default: '' },
    closeTime: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const dayScheduleSchema = new mongoose.Schema(
  {
    day: { type: String, trim: true },
    isOpen: { type: Boolean, default: true },
    mode: {
      type: String,
      enum: ['REGULAR', 'SPLIT_SHIFT', '24_HOURS', 'CLOSED'],
      default: 'REGULAR',
    },
    openTime: { type: String, trim: true, default: '05:30 AM' },
    closeTime: { type: String, trim: true, default: '10:30 PM' },
    morningShift: {
      type: shiftWindowSchema,
      default: () => ({ openTime: '05:30 AM', closeTime: '11:30 AM' }),
    },
    eveningShift: {
      type: shiftWindowSchema,
      default: () => ({ openTime: '04:30 PM', closeTime: '10:30 PM' }),
    },
  },
  { _id: false }
);

const holidaySchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    date: { type: String, trim: true },
    title: { type: String, trim: true },
    type: { type: String, trim: true, default: 'Closed' },
    hours: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const openingHoursSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['REGULAR', 'SPLIT_SHIFT', '24_HOURS'],
      default: 'REGULAR',
    },
    weekdayOpen: { type: String, trim: true, default: '05:30 AM' },
    weekdayClose: { type: String, trim: true, default: '10:30 PM' },
    weekendOpen: { type: String, trim: true, default: '06:00 AM' },
    weekendClose: { type: String, trim: true, default: '09:00 PM' },
    morningOpen: { type: String, trim: true, default: '05:30 AM' },
    morningClose: { type: String, trim: true, default: '11:30 AM' },
    eveningOpen: { type: String, trim: true, default: '04:30 PM' },
    eveningClose: { type: String, trim: true, default: '10:30 PM' },
    displayText: { type: String, trim: true, default: '05:30 AM - 10:30 PM' },
    isSplitShift: { type: Boolean, default: false },
    isOpenHolidays: { type: Boolean, default: true },
    is24Hours: { type: Boolean, default: false },
    schedule: [dayScheduleSchema],
    holidays: [holidaySchema],
  },
  { _id: false }
);

const customPlanSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    tierId: { type: String, trim: true }, // 'monthly' | 'quarterly' | 'half_yearly' | 'annual'
    name: { type: String, required: true, trim: true },
    badge: { type: String, trim: true, default: 'Monthly' },
    price: { type: Number, required: true, min: 0 },
    duration: { type: String, trim: true, default: '30 Days' },
    months: { type: Number, default: 1, min: 1 },
    description: { type: String, trim: true, default: '' },
    features: [{ type: String, trim: true }],
    popular: { type: Boolean, default: false },
    savingsText: { type: String, trim: true, default: '' },
    assignedTrainers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
  },
  { _id: false }
);

const customFacilitySchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General' },
    status: { type: String, trim: true, default: 'Active' },
    count: { type: Number, default: 1, min: 0 },
  },
  { _id: false }
);

const socialLinksSchema = new mongoose.Schema(
  {
    instagram: { type: String, trim: true, default: '' },
    instagramHandle: { type: String, trim: true, default: '' },
    facebook: { type: String, trim: true, default: '' },
    youtube: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    googleBusinessUrl: { type: String, trim: true, default: '' },
    googleRating: { type: String, trim: true, default: '4.9' },
    googleReviewCount: { type: String, trim: true, default: '0' },
  },
  { _id: false }
);

const systemSettingsSchema = new mongoose.Schema(
  {
    turnstileTimeout: { type: Number, default: 5 },
    renewalGracePeriod: { type: Number, default: 3 },
    autoCheckoutHours: { type: Number, default: 2.5 },
    smsCheckInAlerts: { type: Boolean, default: true },
    whatsappAlerts: { type: Boolean, default: true },
    audioChimeEnabled: { type: Boolean, default: true },
    spotWalkInsAllowed: { type: Boolean, default: true },
  },
  { _id: false }
);

const prorationSettingsSchema = new mongoose.Schema(
  {
    downgradePolicy: {
      type: String,
      enum: ['WALLET', 'REFUND', 'EXTEND', 'SCHEDULED_END_OF_CYCLE'],
      default: 'WALLET',
    },
    allowMidCycleDowngrade: {
      type: Boolean,
      default: true,
    },
    requireGymApprovalForUpgrades: {
      type: Boolean,
      default: true,
    },
    requireGymApprovalForDowngrades: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

const gymAuditLogSchema = new mongoose.Schema(
  {
    changeType: { type: String, required: true },
    changedBy: { type: String, trim: true, default: 'Gym Owner' },
    changedByRole: { type: String, trim: true, default: 'GYM_OWNER' },
    changedAt: { type: Date, default: Date.now },
    field: { type: String, trim: true, default: 'General Update' },
    requestedOn: { type: String, trim: true, default: '' },
    editedFields: { type: mongoose.Schema.Types.Mixed, default: {} },
    previousSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    newSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
    approvalStatus: {
      type: String,
      enum: ['Pending Approval', 'Pending Admin Review', 'Approved', 'Rejected'],
      default: 'Pending Admin Review',
    },
    adminRemarks: { type: String, trim: true, default: '' },
    reviewedBy: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: true }
);

const pricingPlansSchema = new mongoose.Schema(
  {
    singleSession: { type: Number, default: 199, min: 0 },
    weeklyPass: { type: Number, default: 799, min: 0 },
    fiveSessions: { type: Number, default: 899, min: 0 },
    monthly: { type: Number, default: 1999, min: 0 },
    quarterly: { type: Number, default: 4999, min: 0 },
    halfYearly: { type: Number, default: 8999, min: 0 },
    annual: { type: Number, default: 14999, min: 0 },
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolder: { type: String, trim: true, default: '' },
    bankName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    ifscCode: { type: String, trim: true, default: '' },
    upiId: { type: String, trim: true, default: '' },
    accountType: { type: String, trim: true, default: 'Current Account' },
    branch: { type: String, trim: true, default: '' },
    payoutSchedule: { type: String, trim: true, default: 'Daily T+1 Automated Direct Bank Deposit' },
    gstInvoiceEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    userName: { type: String, trim: true, default: '' },
    userImageUrl: { type: String, trim: true, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
    comment: { type: String, required: true, trim: true },
    bookingType: { type: String, trim: true, default: 'Member' },
    date: { type: String, trim: true, default: 'Recent' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const trainerSchema = new mongoose.Schema(
  {
    employeeId: { type: String, trim: true, default: '' },
    specialty: { type: String, trim: true, default: 'General Fitness' },
    experienceYears: { type: Number, default: 1, min: 0 },
    experience: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    aboutMe: { type: String, trim: true, default: '' },
    servicesOffered: [{ type: String, trim: true }],
    certifications: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    rating: { type: Number, default: 4.9, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    ratings: { type: [reviewSchema], default: [] },
    monthlyFee: { type: Number, default: 0, min: 0 },
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
    schedule: {
      workingDays: [{ type: String, trim: true }],
      workingTimeStart: { type: String, trim: true, default: '09:00 AM' },
      workingTimeEnd: { type: String, trim: true, default: '06:00 PM' },
    },
    image: { type: fileAttachmentSchema, default: () => ({}) }, // { fileName: "{gymname}_trainer_{name}", fileData: "..." }
    imageUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const documentsSchema = new mongoose.Schema(
  {
    gstCertificate: { type: fileAttachmentSchema, default: () => ({}) },
    panCard: { type: fileAttachmentSchema, default: () => ({}) },
    tradeLicense: { type: fileAttachmentSchema, default: () => ({}) },
    bankProof: { type: fileAttachmentSchema, default: () => ({}) },
    fireSafetyCertificate: { type: fileAttachmentSchema, default: () => ({}) },
    fssaiCertificate: { type: fileAttachmentSchema, default: () => ({}) },
  },
  { _id: false }
);

const gymSchema = new mongoose.Schema(
  {
    partnerId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Gym name is required'],
      trim: true,
      index: true,
    },
    tagline: {
      type: String,
      trim: true,
      default: '',
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, 'Owner name is required'],
      trim: true,
    },
    businessType: {
      type: String,
      enum: ['Sole Proprietorship', 'Partnership', 'Private Limited', 'LLP', 'Other'],
      default: 'Private Limited',
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    yearEstablished: { type: String, trim: true, default: '' },
    gstNumber: { type: String, trim: true, uppercase: true, default: '' },
    panNumber: { type: String, trim: true, uppercase: true, default: '' },
    branches: { type: String, trim: true, default: '1' },

    // Location
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [80.2707, 13.0827],
      },
    },
    area: { type: String, trim: true, default: '' },
    city: { type: String, required: [true, 'City is required'], trim: true, index: true },
    state: { type: String, trim: true, default: 'Tamil Nadu' },
    pincode: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    address: { type: String, required: [true, 'Address is required'], trim: true },
    fullAddress: { type: String, trim: true, default: '' },
    googleMapsUrl: { type: String, trim: true, default: '' },

    // Facilities, Capacity & Media
    floorSpaceSqFt: { type: Number, default: 0, min: 0 },
    maxFloorCapacity: { type: Number, default: 0, min: 0 },
    logo: { type: fileAttachmentSchema, default: () => ({}) }, // { fileName: "{gymname}_logo.webp", fileData: "..." }
    coverPhoto: { type: fileAttachmentSchema, default: () => ({}) }, // Backwards compatibility
    image: { type: String, default: '' }, // String convenience field
    galleryPhotos: [fileAttachmentSchema], // Array of { fileName: "{gymname}_gallery_1.webp", fileData: "..." }
    images: [{ type: String }],

    facilities: [{ type: String, trim: true }],
    amenities: [{ type: String, trim: true }],
    workouts: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],
    badgeText: { type: String, trim: true, default: 'Verified' },
    aboutText: { type: String, trim: true, default: '' },

    // Trainers
    trainers: [trainerSchema],

    // Operational Hours & Slots
    openingHours: {
      type: openingHoursSchema,
      default: () => ({}),
    },
    slotDurationMinutes: { type: Number, default: 60, min: 15 },
    maxSlotCapacity: { type: Number, default: 25, min: 1 },
    slotsMorning: [{ type: String, trim: true }],
    slotsEvening: [{ type: String, trim: true }],

    // Pricing Plans
    singleSessionPrice: { type: Number, default: 199, min: 0 },
    singleSessionBookingEnabled: { type: Boolean, default: true },
    enabledSessionCategories: {
      type: [String],
      default: ['Gym Access', 'Group Classes', 'Yoga Classes', 'Zumba Sessions', 'Other Fitness Classes'],
    },
    pricingPlans: {
      type: pricingPlansSchema,
      default: () => ({}),
    },
    customPricingPlans: [customPlanSchema],
    customFacilities: [customFacilitySchema],
    socialLinks: {
      type: socialLinksSchema,
      default: () => ({}),
    },
    systemSettings: {
      type: systemSettingsSchema,
      default: () => ({}),
    },
    prorationSettings: {
      type: prorationSettingsSchema,
      default: () => ({}),
    },

    // Rules & Safety
    rules: [{ type: String, trim: true }],
    safetyMeasures: [{ type: String, trim: true }],
    freeCancellationHours: { type: Number, default: 2, min: 0 },
    refundPercentage: { type: Number, default: 100, min: 0, max: 100 },
    rescheduleAllowedCount: { type: Number, default: 2, min: 0 },

    // Subscription & Settlement
    subscriptionType: {
      type: String,
      enum: ['Hybrid', 'App Only', 'GMS', 'Listing Only'],
      default: 'Hybrid',
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: ['Active', 'Inactive', 'Trial', 'Expired'],
      default: 'Active',
    },
    commissionRate: { type: Number, default: 10, min: 0, max: 100 },
    settlementCycle: { type: String, default: 'Daily (T+1)', trim: true },
    bankDetails: {
      type: bankDetailsSchema,
      default: () => ({}),
    },
    documents: {
      type: documentsSchema,
      default: () => ({}),
    },

    // Audit & Change Requests
    pendingChanges: { type: mongoose.Schema.Types.Mixed, default: null },
    auditHistory: [gymAuditLogSchema],

    // Platform State
    status: {
      type: String,
      enum: ['Active', 'Pending', 'On Hold', 'Inactive', 'Suspended', 'Rejected'],
      default: 'Active',
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ['Approved', 'Pending Approval', 'On Hold', 'Rejected'],
      default: 'Approved',
      index: true,
    },
    changesCount: { type: Number, default: 0, min: 0 },
    rejectionReason: { type: String, trim: true, default: '' },
    remark: { type: String, trim: true, default: '' },
    rating: { type: Number, default: 4.9, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    ratings: { type: [reviewSchema], default: [] },
    reviews: { type: [reviewSchema], default: [] },
    membersCount: { type: Number, default: 0, min: 0 },
    monthlyRevenue: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

gymSchema.index({ location: '2dsphere' });
gymSchema.index({ city: 1, isActive: 1 });
gymSchema.index({ status: 1, approvalStatus: 1 });

const sanitizeJsonTransform = (_doc, ret) => {
  if (ret._id) {
    ret.mongoId = ret._id.toString();
    ret.id = ret.partnerId || ret._id.toString();
  }
  delete ret._id;
  delete ret.__v;
  return ret;
};

gymSchema.set('toJSON', { transform: sanitizeJsonTransform });
gymSchema.set('toObject', { transform: sanitizeJsonTransform });

export const Gym = mongoose.model('Gym', gymSchema);
export default Gym;
