import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Counter from './counter.model.js';
import { generateToken } from '../utils/jwtHelper.js';

export const USER_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  GYM_OWNER: 'GYM_OWNER',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
  TRAINER: 'TRAINER',
  CUSTOMER: 'CUSTOMER',
};

export const AUTH_PROVIDERS = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
};

export const GENDER_ENUM = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

const customerProfileSchema = new mongoose.Schema(
  {
    heightCm: { type: Number, min: 0, default: null },
    weightKg: { type: Number, min: 0, default: null },
    targetWeightKg: { type: Number, min: 0, default: null },
    fitnessGoal: {
      type: String,
      trim: true,
      default: 'General Fitness & Mobility',
    },
    bmi: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const employeeProfileSchema = new mongoose.Schema(
  {
    staffRole: {
      type: String,
      enum: ['FRONT_DESK', 'TRAINER', 'MANAGER', 'STAFF', 'CLEANING', 'OTHER'],
      default: 'STAFF',
    },
    specialties: [{ type: String, trim: true }],
    experienceYears: { type: Number, default: 0, min: 0 },
    monthlyRate: { type: Number, default: 0, min: 0 },
    shift: { type: String, trim: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },
    phone: {
      type: String,
      required: [
        function () {
          return this.authProvider === 'LOCAL';
        },
        'Phone number is required',
      ],
      trim: true,
      index: true,
      default: '',
    },
    password: {
      type: String,
      required: [
        function () {
          return this.authProvider === 'LOCAL' || !this.authProvider;
        },
        'Password is required for local accounts',
      ],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Never return password in standard queries
    },
    authProvider: {
      type: String,
      enum: Object.values(AUTH_PROVIDERS),
      default: AUTH_PROVIDERS.LOCAL,
      index: true,
    },
    googleId: {
      type: String,
      sparse: true,
      index: true,
      default: null,
    },
    isSsoEnabled: {
      type: Boolean,
      default: true,
    },
    fcmTokens: [
      {
        type: String,
        trim: true,
      },
    ],
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.CUSTOMER,
      index: true,
    },
    customerId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    profilePicture: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: GENDER_ENUM,
      default: 'PREFER_NOT_TO_SAY',
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    biometricEnabled: {
      type: Boolean,
      default: false,
    },
    preferences: {
      workoutReminders: { type: Boolean, default: false },
      passExpiryAlerts: { type: Boolean, default: false },
      biometricLogin: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Reference to Gym (applicable for GYM_OWNER, EMPLOYEE, and TRAINER)
    gymId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      default: null,
      index: true,
    },

    // Role-specific embedded profiles
    customerProfile: {
      type: customerProfileSchema,
      default: () => ({}),
    },
    employeeProfile: {
      type: employeeProfileSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Static method to generate next sequential customer ID
userSchema.statics.generateCustomerId = async function () {
  const seq = await Counter.getNextSequence('customer_id', 1);
  return `GYZ${String(seq).padStart(4, '0')}`;
};

// Pre-save hook: Hash password securely if modified, and assign customerId if needed
userSchema.pre('save', async function () {
  if (!this.customerId && this.role === USER_ROLES.CUSTOMER) {
    this.customerId = await mongoose.model('User').generateCustomerId();
  }

  if (!this.password || !this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare hashed password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT Auth Token method
userSchema.methods.generateAuthToken = function () {
  return generateToken({
    userId: this._id.toString(),
    email: this.email,
    role: this.role,
    fullName: this.fullName,
    gymId: this.gymId ? this.gymId.toString() : null,
  });
};

// Transform output JSON: Mask _id to id and remove sensitive fields
const sanitizeJsonTransform = (_doc, ret) => {
  if (ret._id) {
    ret.id = ret._id.toString();
  }
  delete ret._id;
  delete ret.__v;
  delete ret.password;
  return ret;
};

userSchema.set('toJSON', { transform: sanitizeJsonTransform });
userSchema.set('toObject', { transform: sanitizeJsonTransform });

export const User = mongoose.model('User', userSchema);
export default User;
