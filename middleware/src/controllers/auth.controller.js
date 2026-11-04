import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import { setAuthCookie, clearAuthCookie } from '../utils/cookieHelper.js';
import { sanitizeDocument } from '../utils/responseTransformer.js';
import { User, USER_ROLES } from '../models/user.model.js';
import Gym from '../models/gym.model.js';
import Employee from '../models/employee.model.js';
import { verifyGoogleIdToken } from '../services/firebase.service.js';

/**
 * Helper to determine expected role from body parameters
 */
const resolveExpectedRole = (body) => {
  if (body.expectedRole) return body.expectedRole;
  if (body.requiredRole) return body.requiredRole;
  if (body.portal === 'super-admin') return USER_ROLES.SUPER_ADMIN;
  if (body.portal === 'gym-owner') return USER_ROLES.GYM_OWNER;
  return null;
};

/**
 * Helper to retrieve gym associated with user
 */
const fetchUserGym = async (user) => {
  if (user.gymId) {
    const gym = await Gym.findById(user.gymId).select('-auditHistory -documents -galleryPhotos -images');
    if (gym) return gym;
  }
  if (user.role === USER_ROLES.GYM_OWNER) {
    return Gym.findOne({ ownerId: user._id }).select('-auditHistory -documents -galleryPhotos -images');
  }
  if (user.role === USER_ROLES.MANAGER || user.role === 'MANAGER') {
    const emp = await Employee.findOne({
      $or: [{ userId: user._id }, { email: user.email }, { phone: user.phone }],
    });
    if (emp?.gymId) {
      return Gym.findById(emp.gymId).select('-auditHistory -documents -galleryPhotos -images');
    }
  }
  if (user.role === USER_ROLES.SUPER_ADMIN) {
    return (
      (await Gym.findOne({ partnerId: 'GYM1' }).select('-auditHistory -documents -galleryPhotos -images')) ||
      (await Gym.findOne({}).select('-auditHistory -documents -galleryPhotos -images'))
    );
  }
  return null;
};

/**
 * Helper to validate gym partner active state
 */
const validateGymPartnerActiveState = (gym) => {
  if (!gym) return;

  if (gym.isActive === false) {
    throw ApiError.forbidden(
      'Your gym partner account is currently deactivated. Please contact GYMEZY support.'
    );
  }
};

/**
 * Unified Login Controller for all platform roles
 * Supports authentication via Email or Phone with Password
 * Sets secure HTTP-only JWT cookie
 */
export const login = asyncHandler(async (req, res) => {
  const { identifier, email, phone, password } = req.body;

  const loginIdentifier = (identifier || email || phone || '').trim();

  if (!loginIdentifier || !password) {
    throw ApiError.badRequest('Email/Phone and password are required.');
  }

  // Determine if identifier is email or phone
  const isEmail = loginIdentifier.includes('@');
  const query = isEmail
    ? { email: loginIdentifier.toLowerCase() }
    : { phone: loginIdentifier };

  // Fetch user including hidden password field
  const user = await User.findOne(query).select('+password');

  if (!user) {
    // Constant message to prevent account enumeration
    throw ApiError.unauthorized('Invalid credentials. Please verify your email/phone and password.');
  }

  // Check if account is active
  if (!user.isActive) {
    throw ApiError.forbidden('Your account is inactive or disabled. Please contact GYMEZY support.');
  }

  // Verify password using bcrypt comparison
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw ApiError.unauthorized('Invalid credentials. Please verify your email/phone and password.');
  }

  // Enforce portal-level role authorization
  const requestedRole = resolveExpectedRole(req.body);
  if (requestedRole) {
    if (requestedRole === USER_ROLES.SUPER_ADMIN && user.role !== USER_ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Access denied. Only Super Administrators are authorized to access the Super Admin Portal.');
    }
    if (
      requestedRole === USER_ROLES.GYM_OWNER &&
      user.role !== USER_ROLES.GYM_OWNER &&
      user.role !== USER_ROLES.SUPER_ADMIN &&
      user.role !== USER_ROLES.MANAGER &&
      user.role !== 'MANAGER'
    ) {
      throw ApiError.forbidden('Access denied. This portal is reserved for registered Gym Owners and Managers.');
    }
  }

  // Fetch gym profile if linked
  let gymDetails = null;
  const gym = await fetchUserGym(user);

  if (user.role !== USER_ROLES.SUPER_ADMIN) {
    validateGymPartnerActiveState(gym);
  }

  if (gym) {
    gymDetails = sanitizeDocument(gym.toJSON());
  }

  // Generate signed JWT token
  const token = user.generateAuthToken();

  // Set secure HTTP-only cookie
  setAuthCookie(res, token);

  // Return sanitized user object (strips _id, __v, password and outputs id)
  const sanitizedUser = sanitizeDocument(user.toJSON());

  return res.status(200).json(
    ApiResponse.success(
      {
        ...sanitizedUser,
        gym: gymDetails,
        token,
      },
      `Welcome back, ${user.fullName}! Login successful.`
    )
  );
});

/**
 * Get currently authenticated user details
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw ApiError.unauthorized('Authentication session is invalid.');
  }

  const user = await User.findById(userId);

  if (!user) {
    throw ApiError.notFound('User account not found.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('Account has been deactivated.');
  }

  let gymDetails = null;
  const gym = await fetchUserGym(user);

  if (user.role !== USER_ROLES.SUPER_ADMIN) {
    validateGymPartnerActiveState(gym);
  }

  if (gym) {
    gymDetails = sanitizeDocument(gym.toJSON());
  }

  const sanitizedUser = sanitizeDocument(user.toJSON());

  return res.status(200).json(
    ApiResponse.success(
      {
        ...sanitizedUser,
        gym: gymDetails,
      },
      'Current user profile retrieved successfully.'
    )
  );
});

/**
 * Log out user and clear HTTP-only auth cookie
 */
export const logoutUser = asyncHandler(async (_req, res) => {
  clearAuthCookie(res);
  return res.status(200).json(
    ApiResponse.success(null, 'User logged out successfully. Auth cookie cleared.')
  );
});

/**
 * GET / POST /api/v1/auth/check-email
 * Check if an email is already registered across User or Gym collections
 */
export const checkEmailAvailability = asyncHandler(async (req, res) => {
  const emailParam = req.query.email || req.body.email || '';
  const email = String(emailParam).trim().toLowerCase();

  if (!email) {
    throw ApiError.badRequest('Email parameter is required.');
  }

  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw ApiError.badRequest('Invalid email address format.');
  }

  const [existingUser, existingGym] = await Promise.all([
    User.findOne({ email }),
    Gym.findOne({ email }),
  ]);

  const isTaken = Boolean(existingUser || existingGym);

  return res.status(200).json(
    ApiResponse.success(
      {
        email,
        isAvailable: !isTaken,
        isExisting: isTaken,
      },
      isTaken
        ? 'An account with this email address already exists.'
        : 'Email address is available.'
    )
  );
});

/**
 * POST /api/v1/auth/register
 * Customer Self-Registration Endpoint
 */
export const registerCustomer = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, gender, fitnessGoal } = req.body;

  const cleanName = (fullName || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').trim();
  const cleanPassword = password || '';

  if (!cleanName || cleanName.length < 2) {
    throw ApiError.badRequest('Full name is required and must be at least 2 characters.');
  }

  if (!cleanEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
    throw ApiError.badRequest('A valid email address is required.');
  }

  if (!cleanPhone || cleanPhone.length < 7) {
    throw ApiError.badRequest('A valid phone number is required.');
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    throw ApiError.badRequest('Password must be at least 6 characters long.');
  }

  // Check if user with same email or phone already exists
  const existingUser = await User.findOne({
    $or: [{ email: cleanEmail }, { phone: cleanPhone }],
  });

  if (existingUser) {
    const field = existingUser.email === cleanEmail ? 'Email address' : 'Phone number';
    throw ApiError.conflict(`${field} is already registered. Please sign in or use a different one.`);
  }

  // Create new customer user
  const newUser = await User.create({
    fullName: cleanName,
    email: cleanEmail,
    phone: cleanPhone,
    password: cleanPassword,
    role: USER_ROLES.CUSTOMER,
    gender: gender || 'PREFER_NOT_TO_SAY',
    isActive: true,
    isVerified: true,
    customerProfile: {
      fitnessGoal: fitnessGoal || 'GENERAL_FITNESS',
    },
  });

  // Generate signed JWT auth token
  const token = newUser.generateAuthToken();

  // Set secure HTTP-only cookie
  setAuthCookie(res, token);

  const sanitizedUser = sanitizeDocument(newUser.toJSON());

  return res.status(201).json(
    ApiResponse.created(
      {
        ...sanitizedUser,
        token,
      },
      `Welcome to GYMEZY, ${newUser.fullName}! Account created successfully.`
    )
  );
});

/**
 * PATCH /api/v1/auth/profile
 * Update user profile details (avatar, name, phone, emergency contact, etc.)
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw ApiError.unauthorized('Authentication session is invalid.');
  }

  const { fullName, email, phone, avatar, profilePicture, gender, emergencyContact, address } = req.body;
  const updates = {};
  if (fullName !== undefined) updates.fullName = String(fullName).trim();
  if (email !== undefined) updates.email = String(email).trim().toLowerCase();
  if (phone !== undefined) updates.phone = String(phone).trim();
  if (avatar !== undefined) {
    updates.avatar = String(avatar).trim();
    updates.profilePicture = String(avatar).trim();
  } else if (profilePicture !== undefined) {
    updates.avatar = String(profilePicture).trim();
    updates.profilePicture = String(profilePicture).trim();
  }
  if (gender !== undefined) updates.gender = gender;
  if (emergencyContact !== undefined) updates.emergencyContact = String(emergencyContact).trim();
  if (address !== undefined) updates.address = String(address).trim();
  if (req.body.biometricEnabled !== undefined) {
    updates.biometricEnabled = Boolean(req.body.biometricEnabled);
  }
  if (req.body.preferences && typeof req.body.preferences === 'object') {
    updates.preferences = req.body.preferences;
    if (req.body.preferences.biometricLogin !== undefined) {
      updates.biometricEnabled = Boolean(req.body.preferences.biometricLogin);
    }
  }

  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true });
  if (!user) {
    throw ApiError.notFound('User account not found.');
  }

  const sanitizedUser = sanitizeDocument(user.toJSON());
  return res.status(200).json(
    ApiResponse.success(sanitizedUser, 'Profile updated successfully.')
  );
});

/**
 * POST /api/v1/auth/google-login
 * Authenticates user using Firebase Google ID Token
 * If user exists: checks SSO status & portal role, logs them in with JWT.
 * If user does NOT exist: returns { exists: false, isNewUser: true, profile: { ... } } WITHOUT saving to DB.
 */
export const googleLogin = asyncHandler(async (req, res) => {
  const { idToken, portal, expectedRole } = req.body;

  if (!idToken) {
    throw ApiError.badRequest('Google ID token is required.');
  }

  // 1. Verify Google ID token securely via Firebase Admin
  const googleProfile = await verifyGoogleIdToken(idToken);
  const { uid, email, name, picture } = googleProfile;

  if (!email) {
    throw ApiError.badRequest('Google account must have an associated email address.');
  }

  // 2. Query DB to check if user already exists (by email or googleId)
  const user = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { googleId: uid }],
  }).select('+password');

  // 3. Case A: User does NOT exist in DB
  if (!user) {
    // CRITICAL: DO NOT save user to DB here. Gym owner or customer must complete onboarding first!
    return res.status(200).json(
      ApiResponse.success(
        {
          exists: false,
          isNewUser: true,
          profile: {
            email: email.toLowerCase(),
            fullName: name || '',
            avatar: picture || '',
            googleUid: uid,
          },
        },
        'Google token verified. User does not exist in the database yet.'
      )
    );
  }

  // 4. Case B: User exists in DB
  if (!user.isActive) {
    throw ApiError.forbidden('Your account is inactive or disabled. Please contact GYMEZY support.');
  }

  // Validate SSO permission toggle
  if (user.isSsoEnabled === false) {
    throw ApiError.forbidden(
      'Google Single Sign-On (SSO) is currently disabled for your account. Please log in with your password or enable SSO in your security settings.'
    );
  }

  // Role validation
  const resolvedRole = resolveExpectedRole({ portal, expectedRole });
  if (resolvedRole && user.role !== resolvedRole) {
    throw ApiError.forbidden(`Unauthorized. Access is restricted for ${resolvedRole} role.`);
  }

  // Link googleId if not yet linked
  let isModified = false;
  if (!user.googleId) {
    user.googleId = uid;
    isModified = true;
  }
  if (!user.avatar && picture) {
    user.avatar = picture;
    user.profilePicture = picture;
    isModified = true;
  }
  if (isModified) {
    await user.save();
  }

  // Fetch gym details if gym owner
  const gym = await fetchUserGym(user);
  validateGymPartnerActiveState(gym);

  const token = user.generateAuthToken();
  setAuthCookie(res, token);

  const sanitizedUser = sanitizeDocument(user.toJSON());
  let sanitizedGym = null;
  if (gym) {
    const rawGym = typeof gym.toJSON === 'function' ? gym.toJSON() : gym;
    sanitizedGym = sanitizeDocument(rawGym);
  }

  return res.status(200).json(
    ApiResponse.success(
      {
        exists: true,
        isNewUser: false,
        token,
        user: {
          ...sanitizedUser,
          role: user.role,
          gym: sanitizedGym,
        },
        gym: sanitizedGym,
      },
      `Welcome back, ${user.fullName}!`
    )
  );
});

/**
 * PATCH /api/v1/auth/toggle-sso
 * Enables or disables Google SSO login for the authenticated user
 */
export const toggleSso = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  const { enabled } = req.body;

  if (typeof enabled !== 'boolean') {
    throw ApiError.badRequest('The "enabled" boolean field is required.');
  }

  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw ApiError.notFound('User account not found.');
  }

  // If disabling SSO, verify user has a password so they don't get locked out
  if (!enabled && !user.password) {
    throw ApiError.badRequest(
      'You must set a password for your account before disabling Google SSO to prevent lockout.'
    );
  }

  user.isSsoEnabled = enabled;
  await user.save();

  return res.status(200).json(
    ApiResponse.success(
      { isSsoEnabled: user.isSsoEnabled },
      `Google SSO has been ${enabled ? 'enabled' : 'disabled'} successfully.`
    )
  );
});

/**
 * POST /api/v1/auth/link-google
 * Links a Google account to an existing authenticated user
 */
export const linkGoogleAccount = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  const { idToken } = req.body;

  if (!idToken) {
    throw ApiError.badRequest('Google ID token is required.');
  }

  const googleProfile = await verifyGoogleIdToken(idToken);
  const { uid, email, picture } = googleProfile;

  // Check if this googleId is already linked to another account
  const existingLinked = await User.findOne({ googleId: uid, _id: { $ne: userId } });
  if (existingLinked) {
    throw ApiError.conflict('This Google account is already linked to another user.');
  }

  const user = await User.findById(userId);
  if (!user) {
    throw ApiError.notFound('User account not found.');
  }

  user.googleId = uid;
  user.isSsoEnabled = true;
  if (!user.avatar && picture) {
    user.avatar = picture;
    user.profilePicture = picture;
  }
  await user.save();

  return res.status(200).json(
    ApiResponse.success(
      {
        googleId: user.googleId,
        isSsoEnabled: user.isSsoEnabled,
        email: user.email,
        googleEmail: email,
      },
      'Google account linked successfully.'
    )
  );
});


