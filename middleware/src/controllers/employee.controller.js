import mongoose from 'mongoose';
import { Employee } from '../models/employee.model.js';
import { Gym } from '../models/gym.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import User, { USER_ROLES } from '../models/user.model.js';
import { getSearchTerm, buildRegexSearchQuery } from '../utils/searchHelper.js';

/**
 * Synchronize approved trainers from Employee collection to the parent Gym's embedded trainers array
 */
export const syncGymTrainersFromEmployees = async (gymIdentifier) => {
  if (!gymIdentifier) return;
  try {
    const isObjectId = mongoose.isValidObjectId(gymIdentifier);
    const gym = await Gym.findOne({
      $or: [
        { partnerId: String(gymIdentifier) },
        ...(isObjectId ? [{ _id: gymIdentifier }] : []),
      ],
    });
    if (!gym) return;

    const approvedTrainers = await Employee.find({
      $or: [
        { gymPartnerId: gym.partnerId },
        { gymId: gym._id },
        { gymId: String(gym._id) },
      ].filter(Boolean),
      role: { $regex: /^trainer$/i },
      status: 'Active',
      approvalStatus: 'Approved',
    }).lean();

    const defaultAvatar = 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=400&auto=format&fit=crop';
    gym.trainers = approvedTrainers.map((emp) => {
      const tierPricingList = Array.isArray(emp.tierPricing) && emp.tierPricing.length > 0
        ? emp.tierPricing
        : [
            { tier: 'Monthly', fee: Number(emp.trainerPricing?.monthly) || Number(emp.personalTrainingFee) || 0, durationDays: 30 },
            { tier: 'Quarterly', fee: Number(emp.trainerPricing?.quarterly) || 0, durationDays: 90 },
            { tier: 'Half-Yearly', fee: Number(emp.trainerPricing?.halfYearly) || 0, durationDays: 180 },
            { tier: 'Annual', fee: Number(emp.trainerPricing?.annual) || 0, durationDays: 365 },
          ];

      const monthlyFee = tierPricingList.find((t) => t.tier === 'Monthly')?.fee
        || Number(emp.trainerPricing?.monthly)
        || Number(emp.personalTrainingFee)
        || Number(emp.compensation?.payAmount)
        || 0;

      const quarterlyFee = tierPricingList.find((t) => t.tier === 'Quarterly')?.fee || Number(emp.trainerPricing?.quarterly) || 0;
      const halfYearlyFee = tierPricingList.find((t) => t.tier === 'Half-Yearly')?.fee || Number(emp.trainerPricing?.halfYearly) || 0;
      const annualFee = tierPricingList.find((t) => t.tier === 'Annual')?.fee || Number(emp.trainerPricing?.annual) || 0;

      return {
        employeeId: emp.employeeId || emp._id?.toString() || '',
        name: emp.name,
        specialty: emp.specialty || emp.previousDesignation || 'Certified Fitness Trainer',
        experienceYears: Number(emp.experienceYears) || 2,
        experience: emp.experience || (emp.experienceYears ? `${emp.experienceYears}+ Years` : '2+ Years'),
        description: emp.description || emp.aboutMe || '',
        aboutMe: emp.aboutMe || emp.description || '',
        servicesOffered: Array.isArray(emp.servicesOffered) ? emp.servicesOffered : [],
        certifications: Array.isArray(emp.certifications) ? emp.certifications : [],
        languages: Array.isArray(emp.languages) ? emp.languages : (emp.languages ? [emp.languages] : ['English', 'Hindi']),
        rating: emp.rating || 4.9,
        reviewsCount: emp.reviewsCount || 0,
        ratings: Array.isArray(emp.ratings) ? emp.ratings : [],
        monthlyFee,
        personalTrainingFee: monthlyFee,
        tierPricing: tierPricingList,
        trainerPricing: {
          monthly: monthlyFee,
          quarterly: quarterlyFee,
          halfYearly: halfYearlyFee,
          annual: annualFee,
          singleSession: Number(emp.trainerPricing?.singleSession) || 0,
        },
        schedule: emp.schedule || {
          workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          workingTimeStart: '09:00 AM',
          workingTimeEnd: '06:00 PM',
        },
        imageUrl: emp.avatar || defaultAvatar,
      };
    });

    await gym.save();
  } catch (err) {
    console.error('[SYNC_GYM_TRAINERS] Error syncing trainers:', err?.message);
  }
};

/**
 * Compute system access level automatically based on employee role (Automatic RBAC)
 * Manager -> Admin
 * Trainer / Front Desk / Support / Head Trainer / Physio / Nutritionist -> Employee
 * Housekeeping / Maintenance / Security -> None
 */
export const computeAccessTypeFromRole = (role) => {
  if (!role) return 'Employee';
  const norm = String(role).trim().toLowerCase();
  if (norm.includes('front desk') || norm.includes('reception')) return 'Employee';
  if (norm.includes('manager')) return 'Admin';
  if (
    norm.includes('trainer') ||
    norm.includes('support') ||
    norm.includes('physio') ||
    norm.includes('nutrition')
  ) {
    return 'Employee';
  }
  return 'None';
};

/**
 * Deep-clean objects and subdocuments to remove internal Mongoose fields (_id, __v, dates) for accurate diffing
 */
const cleanForDiff = (val) => {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object') {
    if (typeof val === 'string') return val.trim();
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(cleanForDiff).filter((item) => item !== null && item !== undefined && item !== '');
  }
  const cleaned = {};
  const ignoredSubKeys = new Set(['_id', 'id', '__v', 'createdAt', 'updatedAt']);
  Object.keys(val).forEach((k) => {
    if (!ignoredSubKeys.has(k)) {
      cleaned[k] = cleanForDiff(val[k]);
    }
  });
  return cleaned;
};

/**
 * Calculate precise field-level differences between previous and updated objects
 */
export const calculateFieldDiff = (previous, updated) => {
  const diff = {};
  const ignoredKeys = new Set(['_id', 'id', 'key', 'updatedAt', 'createdAt', 'auditHistory', '__v', 'gymId', 'gymPartnerId', 'gymName']);

  Object.keys(updated).forEach((key) => {
    if (ignoredKeys.has(key)) return;
    const oldCleaned = cleanForDiff(previous[key]);
    const newCleaned = cleanForDiff(updated[key]);

    if (JSON.stringify(oldCleaned) !== JSON.stringify(newCleaned) && updated[key] !== undefined) {
      diff[key] = {
        oldValue: previous[key] !== undefined ? previous[key] : null,
        newValue: updated[key],
      };
    }
  });

  return diff;
};

/**
 * Resolve Gym ID and Partner ID for employee operation
 */
const resolveGymContext = async (req, gymIdInput, gymPartnerIdInput) => {
  let gym = null;

  try {
    if (gymIdInput && typeof gymIdInput === 'string' && gymIdInput.match(/^[0-9a-fA-F]{24}$/)) {
      gym = await Gym.findById(gymIdInput);
    }
    if (!gym && (gymPartnerIdInput || gymIdInput)) {
      gym = await Gym.findOne({
        $or: [
          { partnerId: gymPartnerIdInput || gymIdInput },
          { _id: gymIdInput && gymIdInput.match(/^[0-9a-fA-F]{24}$/) ? gymIdInput : null },
        ].filter(Boolean),
      });
    }
    if (!gym && req.user?.gymId && String(req.user.gymId).match(/^[0-9a-fA-F]{24}$/)) {
      gym = await Gym.findById(req.user.gymId);
    }
    if (!gym && req.user?.userId) {
      gym = await Gym.findOne({
        $or: [
          { ownerId: req.user.userId },
          { userId: req.user.userId },
          { email: req.user.email },
        ],
      });
    }
  } catch {
    // Non-critical error during DB query
  }

  if (gym) {
    return {
      gymId: gym._id,
      gymPartnerId: gym.partnerId || `GYM${String(gym._id).slice(-4).toUpperCase()}`,
      gymName: gym.name,
    };
  }

  // Graceful fallback when gym record is passed from request context
  if (gymIdInput || gymPartnerIdInput || req.body?.gymName || req.user?.gymName) {
    return {
      gymId: gymIdInput || req.user?.gymId || req.user?.userId || 'GYM_DIRECT',
      gymPartnerId: gymPartnerIdInput || (typeof gymIdInput === 'string' && !gymIdInput.match(/^[0-9a-fA-F]{24}$/) ? gymIdInput : 'GP-ACTIVE'),
      gymName: req.body?.gymName || req.user?.gymName || 'Fitness Center',
    };
  }

  throw ApiError.badRequest('Unable to identify gym association. Please provide a valid Gym ID or Partner ID.');
};

/**
 * Generate sequential Employee / Trainer ID strictly isolated per Gym
 * Format: TR001, TR002 for Trainers; EMP001, EMP002 for other staff.
 * Scoped strictly to the specific gym (gymId / gymPartnerId) and calculates the highest
 * existing sequence number so numbering never clashes across gyms or gets messed up by deletions/roles.
 */
const generateSequentialEmpId = async (gymId, gymPartnerId, role) => {
  const rolePrefix = role?.toLowerCase().includes('trainer') ? 'TR' : 'EMP';
  const prefixRegex = new RegExp(`^${rolePrefix}(\\d+)$`, 'i');

  const gymFilters = [];
  if (gymId) gymFilters.push({ gymId });
  if (gymPartnerId) gymFilters.push({ gymPartnerId });

  // Query all employees belonging strictly to this gym
  const existingEmployees = await Employee.find(
    gymFilters.length > 0 ? { $or: gymFilters } : {},
    { employeeId: 1 }
  ).lean();

  let maxNum = 0;
  for (const emp of existingEmployees) {
    if (emp.employeeId) {
      const match = String(emp.employeeId).match(prefixRegex);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const nextSeq = maxNum + 1;
  return `${rolePrefix}${String(nextSeq).padStart(3, '0')}`;
};

/**
 * Create a new employee / trainer
 * Route: POST /api/v1/employees
 */
export const createEmployee = asyncHandler(async (req, res) => {
  const {
    gymId: inputGymId,
    gymPartnerId: inputPartnerId,
    name,
    role,
    phone,
    email,
    avatar,
    gender,
    joinDate,
    type,
    accessType,
    status,
    attendance,
    specialty,
    experienceYears,
    experience,
    description,
    aboutMe,
    servicesOffered,
    certifications,
    languages,
    previousCompany,
    previousDesignation,
    previousExp,
    emergencyContact,
    schedule,
    compensation,
    notes,
    documents,
    trainerCerts,
  } = req.body;

  if (!name) {
    throw ApiError.badRequest('Employee name is required.');
  }

  const { gymId, gymPartnerId, gymName } = await resolveGymContext(req, inputGymId, inputPartnerId);

  // Generate sequential Employee / Trainer ID strictly isolated for this Gym
  const generatedEmpId = await generateSequentialEmpId(gymId, gymPartnerId, role);

  const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;
  const isGymOwner = req.user?.role === USER_ROLES.GYM_OWNER || req.user?.accessType === 'Admin';
  const isPartTimeOrTemp = type === 'Part-Time' || type === 'Temporary';

  // Check if caller is a Manager with delegated staff permissions
  let isManagerWithoutApproval = false;
  if (!isSuperAdmin && !isGymOwner) {
    const callerEmployee = await Employee.findOne({
      $or: [{ phone: req.user?.phone }, { email: req.user?.email }, { userId: req.user?._id }],
      gymId,
    });
    if (callerEmployee?.managerPermissions?.requireStaffApproval === false) {
      isManagerWithoutApproval = true;
    }
  }

  const initialApprovalStatus = (isSuperAdmin || isGymOwner || isPartTimeOrTemp || isManagerWithoutApproval)
    ? 'Approved'
    : 'Pending Approval';
  const initialPendingAction = (isSuperAdmin || isGymOwner || isPartTimeOrTemp || isManagerWithoutApproval)
    ? 'NONE'
    : 'NEW_EMPLOYEE';

  // If role is Manager, ensure User account exists with role-based auth credentials
  let createdManagerUserId = null;
  if ((role || '').trim() === 'Manager') {
    const managerEmail = email ? email.trim().toLowerCase() : '';
    const managerPhone = phone ? phone.trim() : '';
    const managerPassword = req.body.password ? String(req.body.password).trim() : '';

    if (!managerPassword) {
      throw ApiError.badRequest('Password is required for Manager to enable portal login.');
    }
    if (managerPassword.length < 6) {
      throw ApiError.badRequest('Manager password must be at least 6 characters long.');
    }
    if (!managerEmail) {
      throw ApiError.badRequest('Email is required for Manager to enable portal login.');
    }

    let existingUser = await User.findOne({
      $or: [{ email: managerEmail }, ...(managerPhone ? [{ phone: managerPhone }] : [])],
    });

    if (existingUser) {
      existingUser.fullName = name.trim();
      existingUser.role = USER_ROLES.MANAGER;
      existingUser.gymId = gymId;
      existingUser.password = managerPassword;
      existingUser.isActive = true;
      existingUser.isVerified = true;
      existingUser.employeeProfile = { staffRole: 'MANAGER' };
      await existingUser.save();
      createdManagerUserId = existingUser._id;
    } else {
      const newUser = await User.create({
        fullName: name.trim(),
        email: managerEmail,
        phone: managerPhone || '0000000000',
        password: managerPassword,
        role: USER_ROLES.MANAGER,
        gymId: gymId,
        isActive: true,
        isVerified: true,
        employeeProfile: { staffRole: 'MANAGER' },
      });
      createdManagerUserId = newUser._id;
    }
  }

  const newEmployeeData = {
    gymId,
    gymPartnerId,
    gymName,
    employeeId: req.body.employeeId || generatedEmpId,
    userId: createdManagerUserId,
    name: name.trim(),
    role: role || 'Trainer',
    phone: phone || '',
    email: email ? email.trim().toLowerCase() : '',
    avatar: avatar || '',
    gender: gender || 'All',
    joinDate: joinDate || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    type: type || 'Full-Time',
    accessType: computeAccessTypeFromRole(role || 'Trainer'),
    managerPermissions: {
      requireStaffApproval: req.body.managerPermissions?.requireStaffApproval !== false,
      requirePlanSwitchApproval: req.body.managerPermissions?.requirePlanSwitchApproval !== false,
      requireCancellationApproval: req.body.managerPermissions?.requireCancellationApproval !== false,
      requireProfileEditApproval: req.body.managerPermissions?.requireProfileEditApproval !== false,
    },
    status: status || 'Active',
    attendance: attendance || 'Present',
    approvalStatus: initialApprovalStatus,
    pendingAction: initialPendingAction,
    submittedByManager: initialApprovalStatus === 'Pending Approval' ? {
      managerId: req.user?._id || null,
      managerName: req.user?.fullName || req.user?.name || req.user?.email || 'Gym Manager',
      submittedAt: new Date(),
    } : null,
    specialty: specialty || '',
    experienceYears: Number(experienceYears) || 1,
    experience: experience || (experienceYears ? `${experienceYears}+ Years` : ''),
    description: description || aboutMe || '',
    aboutMe: aboutMe || description || '',
    servicesOffered: Array.isArray(servicesOffered) ? servicesOffered : (servicesOffered ? [servicesOffered] : []),
    certifications: Array.isArray(certifications) ? certifications : (certifications ? [certifications] : []),
    languages: Array.isArray(languages) ? languages : (languages ? [languages] : ['English', 'Hindi']),
    previousCompany: previousCompany || '',
    previousDesignation: previousDesignation || '',
    previousExp: previousExp || '',
    emergencyContact: emergencyContact || {},
    schedule: schedule || {},
    compensation: compensation || {},
    trainerPricing: req.body.trainerPricing || {},
    notes: notes || '',
    documents: Array.isArray(documents) ? documents : [],
    trainerCerts: Array.isArray(trainerCerts) ? trainerCerts : [],
    approvedBy: (isSuperAdmin || isGymOwner) ? (req.user?.fullName || req.user?.name || req.user?.email || 'Gym Admin') : '',
    approvedAt: (isSuperAdmin || isGymOwner) ? new Date() : null,
  };

  // Build initial Audit History Entry (clean non-circular snapshot)
  const cleanSnapshot = { ...newEmployeeData };

  const initialAuditLog = {
    changeType: 'ADD_EMPLOYEE',
    changedBy: req.user?.fullName || req.user?.name || req.user?.email || 'Gym Owner',
    changedByRole: req.user?.role || 'GYM_OWNER',
    changedAt: new Date(),
    gymId,
    gymPartnerId,
    gymName,
    editedFields: {
      initialCreation: {
        oldValue: null,
        newValue: `Created ${newEmployeeData.role} (${newEmployeeData.name})`,
      },
    },
    previousSnapshot: null,
    newSnapshot: cleanSnapshot,
    approvalStatus: initialApprovalStatus,
    reviewedBy: isSuperAdmin ? req.user.email : '',
    reviewedAt: isSuperAdmin ? new Date() : null,
  };

  newEmployeeData.auditHistory = [initialAuditLog];

  const createdEmployee = await Employee.create(newEmployeeData);

  if (createdEmployee.approvalStatus === 'Approved' && createdEmployee.role === 'Trainer') {
    await syncGymTrainersFromEmployees(gymPartnerId || gymId);
  }

  return res.status(201).json(
    ApiResponse.created(
      createdEmployee,
      createdEmployee.approvalStatus === 'Approved'
        ? 'Employee created and active.'
        : 'Employee submitted successfully. Pending approval by Gym Admin.'
    )
  );
});

/**
 * Get all employees with filtering and server-side pagination
 * Route: GET /api/v1/employees
 */
export const getEmployees = asyncHandler(async (req, res) => {
  const {
    gymId,
    gymPartnerId,
    role,
    approvalStatus,
    status,
    type,
    search,
    page = 1,
    limit = 8,
    pageSize,
  } = req.query;
  const andConditions = [];

  const targetIdentifier = gymId || gymPartnerId;
  if (targetIdentifier) {
    let matchingGym = null;
    try {
      if (typeof targetIdentifier === 'string' && targetIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
        matchingGym = await Gym.findById(targetIdentifier);
      }
      if (!matchingGym) {
        matchingGym = await Gym.findOne({ partnerId: targetIdentifier });
      }
    } catch {
      // Non-critical
    }

    const orConditions = [
      { gymPartnerId: targetIdentifier },
      { gymId: targetIdentifier },
    ];
    if (matchingGym) {
      orConditions.push({ gymId: matchingGym._id });
      if (matchingGym.partnerId) {
        orConditions.push({ gymPartnerId: matchingGym.partnerId });
      }
    }

    andConditions.push({ $or: orConditions });
  } else if (req.user?.role === USER_ROLES.GYM_OWNER) {
    const ownerGym = await Gym.findOne({
      $or: [
        { ownerId: req.user._id || req.user.userId },
        { userId: req.user._id || req.user.userId },
        { email: req.user.email },
      ].filter(Boolean),
    });
    if (ownerGym) {
      andConditions.push({
        $or: [
          { gymId: ownerGym._id },
          { gymPartnerId: ownerGym.partnerId },
        ],
      });
    }
  }

  if (role && role !== 'ALL') andConditions.push({ role });
  if (approvalStatus && approvalStatus !== 'ALL') andConditions.push({ approvalStatus });
  if (status && status !== 'ALL') andConditions.push({ status });
  if (type && type !== 'ALL') andConditions.push({ type });

  const searchTerm = getSearchTerm(req.query);
  if (searchTerm) {
    const searchQuery = buildRegexSearchQuery(searchTerm, [
      'name',
      'phone',
      'email',
      'employeeId',
      'role',
      'specialty',
    ]);
    if (searchQuery) {
      andConditions.push(searchQuery);
    }
  }

  const finalFilter = andConditions.length > 0 ? { $and: andConditions } : {};

  // Count total matching records in database
  const totalEmployees = await Employee.countDocuments(finalFilter);

  // Pagination calculations
  const rawLimit = pageSize || limit;
  const isFetchAll = rawLimit === 'all' || rawLimit === '0';
  const parsedLimit = isFetchAll ? 0 : Math.max(1, Number.parseInt(rawLimit, 10) || 8);
  const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const skip = parsedLimit > 0 ? (parsedPage - 1) * parsedLimit : 0;
  const totalPages = parsedLimit > 0 ? Math.ceil(totalEmployees / parsedLimit) : 1;

  let query = Employee.find(finalFilter).sort({ createdAt: -1 });
  if (parsedLimit > 0) {
    query = query.skip(skip).limit(parsedLimit);
  }

  const employees = await query;

  const gymCondition = andConditions.length > 0 ? andConditions[0] : {};
  const [totalGymStaff, trainersCount, pendingCount] = await Promise.all([
    Employee.countDocuments(gymCondition),
    Employee.countDocuments({ ...gymCondition, role: /trainer|coach/i }),
    Employee.countDocuments({ ...gymCondition, approvalStatus: 'Pending Approval' }),
  ]);
  const staffCount = Math.max(0, totalGymStaff - trainersCount);

  return res.status(200).json(
    ApiResponse.success(
      {
        employees,
        summary: {
          trainersCount,
          staffCount,
          pendingCount,
          totalEmployees: totalGymStaff,
        },
        pagination: {
          total: totalEmployees,
          page: parsedPage,
          limit: parsedLimit || totalEmployees,
          totalPages,
          hasNextPage: parsedPage < totalPages,
          hasPrevPage: parsedPage > 1,
        },
        count: employees.length,
        total: totalEmployees,
        totalPages,
        currentPage: parsedPage,
        pageSize: parsedLimit || totalEmployees,
      },
      'Employees retrieved successfully.'
    )
  );
});

/**
 * Get all pending approvals across gyms for Super Admin
 * Route: GET /api/v1/employees/approvals
 */
export const getPendingApprovals = asyncHandler(async (req, res) => {
  const { gymId, gymPartnerId } = req.query;
  const andConditions = [{ approvalStatus: 'Pending Approval' }];

  const targetIdentifier = gymId || gymPartnerId;
  if (targetIdentifier) {
    let matchingGym = null;
    try {
      if (typeof targetIdentifier === 'string' && targetIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
        matchingGym = await Gym.findById(targetIdentifier);
      }
      if (!matchingGym) {
        matchingGym = await Gym.findOne({ partnerId: targetIdentifier });
      }
    } catch {
      // Non-critical
    }

    const orConditions = [
      { gymPartnerId: targetIdentifier },
      { gymId: targetIdentifier },
    ];
    if (matchingGym) {
      orConditions.push({ gymId: matchingGym._id });
      if (matchingGym.partnerId) {
        orConditions.push({ gymPartnerId: matchingGym.partnerId });
      }
    }
    andConditions.push({ $or: orConditions });
  }

  const pendingEmployees = await Employee.find({ $and: andConditions })
    .sort({ updatedAt: -1 });

  return res.status(200).json(
    ApiResponse.success(
      {
        count: pendingEmployees.length,
        pendingApprovals: pendingEmployees,
      },
      'Pending employee approvals retrieved.'
    )
  );
});

/**
 * Edit employee details with field diff & audit logging
 * Route: PUT /api/v1/employees/:id
 */
export const updateEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const employee = await Employee.findById(id);

  if (!employee) {
    throw ApiError.notFound('Employee not found.');
  }

  const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;
  const previousSnapshot = employee.toObject();

  const allowedUpdates = [
    'name',
    'role',
    'phone',
    'email',
    'avatar',
    'gender',
    'type',
    'accessType',
    'status',
    'attendance',
    'specialty',
    'experienceYears',
    'experience',
    'description',
    'aboutMe',
    'servicesOffered',
    'certifications',
    'languages',
    'previousCompany',
    'previousDesignation',
    'previousExp',
    'emergencyContact',
    'schedule',
    'compensation',
    'trainerPricing',
    'notes',
    'documents',
    'trainerCerts',
  ];

  const updatedFieldsPayload = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      updatedFieldsPayload[field] = req.body[field];
    }
  });

  // Automatic RBAC: if role is updated, synchronize system access level accordingly
  if (req.body.role) {
    updatedFieldsPayload.accessType = computeAccessTypeFromRole(req.body.role);
  }

  // Calculate detailed diff of changed fields
  const editedDiff = calculateFieldDiff(previousSnapshot, updatedFieldsPayload);

  if (Object.keys(editedDiff).length === 0 && !req.body.password) {
    return res.status(200).json(ApiResponse.success(employee, 'No changes detected.'));
  }

  const isGymOwner = req.user?.role === USER_ROLES.GYM_OWNER || req.user?.accessType === 'Admin';

  // Check if caller is a Manager with delegated staff permissions
  let isManagerWithoutApproval = false;
  if (!isSuperAdmin && !isGymOwner) {
    const callerEmployee = await Employee.findOne({
      $or: [{ phone: req.user?.phone }, { email: req.user?.email }, { userId: req.user?._id }],
      gymId: employee.gymId,
    });
    if (callerEmployee?.managerPermissions?.requireStaffApproval === false) {
      isManagerWithoutApproval = true;
    }
  }

  const shouldDirectApply = isSuperAdmin || isGymOwner || isManagerWithoutApproval;
  const changedByName = req.user?.fullName || req.user?.name || req.user?.email || (isGymOwner ? 'Gym Admin' : 'Gym Manager');

  if (shouldDirectApply) {
    // Direct update: instantly apply changes
    Object.assign(employee, updatedFieldsPayload);
    employee.approvalStatus = 'Approved';
    employee.pendingAction = 'NONE';
    employee.pendingChanges = null;
    employee.approvedBy = changedByName;
    employee.approvedAt = new Date();

    employee.auditHistory.push({
      changeType: 'EDIT_EMPLOYEE',
      changedBy: changedByName,
      changedByRole: req.user?.role || (isGymOwner ? 'GYM_OWNER' : 'MANAGER'),
      changedAt: new Date(),
      gymId: employee.gymId,
      gymPartnerId: employee.gymPartnerId,
      gymName: employee.gymName,
      editedFields: editedDiff,
      previousSnapshot,
      newSnapshot: employee.toObject(),
      approvalStatus: 'Approved',
      reviewedBy: changedByName,
      reviewedAt: new Date(),
    });
  } else {
    // Manager update requiring Gym Admin approval
    const onlyChangedFields = {};
    Object.entries(editedDiff).forEach(([field, diffItem]) => {
      onlyChangedFields[field] = diffItem.newValue;
    });

    employee.approvalStatus = 'Pending Approval';
    employee.pendingAction = 'EDIT_DETAILS';
    employee.pendingChanges = onlyChangedFields;
    employee.submittedByManager = {
      managerId: req.user?._id || null,
      managerName: changedByName,
      submittedAt: new Date(),
    };

    employee.auditHistory.push({
      changeType: 'EDIT_EMPLOYEE',
      changedBy: changedByName,
      changedByRole: 'MANAGER',
      changedAt: new Date(),
      gymId: employee.gymId,
      gymPartnerId: employee.gymPartnerId,
      gymName: employee.gymName,
      editedFields: editedDiff,
      previousSnapshot,
      newSnapshot: onlyChangedFields,
      approvalStatus: 'Pending Approval',
    });
  }

  // If employee is or became a Manager, synchronize their User account & portal credentials
  const isManagerRole = (req.body.role || employee.role) === 'Manager';
  if (isManagerRole) {
    const managerEmail = (req.body.email || employee.email || '').trim().toLowerCase();
    const managerPhone = (req.body.phone || employee.phone || '').trim();
    const managerPassword = req.body.password ? String(req.body.password).trim() : '';

    let linkedUser = null;
    if (employee.userId) {
      linkedUser = await User.findById(employee.userId);
    }
    if (!linkedUser && (managerEmail || managerPhone)) {
      linkedUser = await User.findOne({
        $or: [
          ...(managerEmail ? [{ email: managerEmail }] : []),
          ...(managerPhone ? [{ phone: managerPhone }] : []),
        ],
      });
    }

    if (linkedUser) {
      if (req.body.name) linkedUser.fullName = req.body.name.trim();
      if (managerEmail) linkedUser.email = managerEmail;
      if (managerPhone) linkedUser.phone = managerPhone;
      linkedUser.role = USER_ROLES.MANAGER;
      linkedUser.gymId = employee.gymId;
      if (req.body.status) {
        linkedUser.isActive = req.body.status === 'Active';
      }
      if (managerPassword && managerPassword.length >= 6) {
        linkedUser.password = managerPassword;
      }
      await linkedUser.save();
      employee.userId = linkedUser._id;
    } else if (managerPassword && managerPassword.length >= 6 && managerEmail) {
      const newUser = await User.create({
        fullName: (req.body.name || employee.name || '').trim(),
        email: managerEmail,
        phone: managerPhone || '0000000000',
        password: managerPassword,
        role: USER_ROLES.MANAGER,
        gymId: employee.gymId,
        isActive: req.body.status ? req.body.status === 'Active' : true,
        isVerified: true,
        employeeProfile: { staffRole: 'MANAGER' },
      });
      employee.userId = newUser._id;
    }
  }

  await employee.save();

  return res.status(200).json(
    ApiResponse.success(
      employee,
      shouldDirectApply
        ? 'Employee details updated and applied successfully.'
        : 'Employee edits submitted successfully. Pending Gym Admin approval.'
    )
  );
});

/**
 * Super Admin Decision Engine: Approve or Reject Employee addition / edit
 * Route: PATCH /api/v1/employees/:id/approval
 */
export const reviewEmployeeApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const rawDecision = req.body?.decision || req.body?.action;
  let decision = rawDecision;
  if (typeof rawDecision === 'string') {
    const lower = rawDecision.toLowerCase().trim();
    if (lower === 'approve' || lower === 'approved') decision = 'Approved';
    if (lower === 'reject' || lower === 'rejected') decision = 'Rejected';
  }
  const adminRemarks = req.body?.adminRemarks || req.body?.rejectionReason || req.body?.remarks || '';

  if (!decision || !['Approved', 'Rejected'].includes(decision)) {
    throw ApiError.badRequest('Decision must be either "Approved" or "Rejected".');
  }

  const employee = await Employee.findById(id);

  if (!employee) {
    throw ApiError.notFound('Employee not found.');
  }

  const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;
  const isGymOwner = req.user?.role === USER_ROLES.GYM_OWNER || req.user?.accessType === 'Admin';

  if (!isSuperAdmin && !isGymOwner) {
    throw ApiError.forbidden('Only Gym Admin or Super Admin can review staff approvals.');
  }

  const reviewerName = req.user?.fullName || req.user?.name || req.user?.email || (isGymOwner ? 'Gym Admin' : 'Super Admin');

  if (decision === 'Approved') {
    if (employee.pendingChanges && typeof employee.pendingChanges === 'object') {
      Object.entries(employee.pendingChanges).forEach(([key, val]) => {
        if (key && !key.startsWith('_')) {
          employee.set(key, val);
          employee.markModified(key);
        }
      });
      // Align attendance if status was changed
      if (employee.pendingChanges.status === 'Inactive' || employee.pendingChanges.status === 'Suspended') {
        employee.attendance = '—';
      } else if (employee.pendingChanges.status === 'Active' && employee.attendance === '—') {
        employee.attendance = 'Present';
      }
      employee.pendingChanges = null;
    }
    employee.approvalStatus = 'Approved';
    employee.pendingAction = 'NONE';
    employee.approvedBy = reviewerName;
    employee.approvedAt = new Date();
    employee.adminRemarks = adminRemarks || 'Approved by Super Administrator';
  } else {
    employee.approvalStatus = 'Rejected';
    employee.pendingAction = 'NONE';
    employee.pendingChanges = null;
    employee.adminRemarks = adminRemarks || 'Rejected during Super Admin inspection';
  }

  // Update latest audit history record
  if (employee.auditHistory && employee.auditHistory.length > 0) {
    const latestAudit = employee.auditHistory[employee.auditHistory.length - 1];
    latestAudit.approvalStatus = decision;
    latestAudit.adminRemarks = employee.adminRemarks;
    latestAudit.reviewedBy = reviewerName;
    latestAudit.reviewedAt = new Date();
  }

  await employee.save();

  if (employee.role === 'Trainer') {
    await syncGymTrainersFromEmployees(employee.gymPartnerId || employee.gymId);
  }

  return res.status(200).json(
    ApiResponse.success(
      employee,
      `Employee request has been ${decision.toLowerCase()} successfully.`
    )
  );
});

/**
 * Deactivate or Delete an Employee
 * Route: DELETE /api/v1/employees/:id
 */
export const deleteEmployee = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const employee = await Employee.findById(id);

  if (!employee) {
    throw ApiError.notFound('Employee not found.');
  }

  const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;

  if (isSuperAdmin) {
    const gymIdentifier = employee.gymPartnerId || employee.gymId;
    const isTrainer = employee.role === 'Trainer';
    await Employee.findByIdAndDelete(id);
    if (isTrainer) {
      await syncGymTrainersFromEmployees(gymIdentifier);
    }
    return res.status(200).json(ApiResponse.success(null, 'Employee deleted permanently.'));
  }

  // If Gym Owner: marks as Inactive and creates deactivation audit record
  employee.status = 'Inactive';
  employee.attendance = '—';
  employee.approvalStatus = 'Pending Approval';
  employee.pendingAction = 'DEACTIVATION';

  employee.auditHistory.push({
    changeType: 'DEACTIVATE_EMPLOYEE',
    changedBy: req.user?.fullName || req.user?.name || req.user?.email || 'Gym Owner',
    changedByRole: 'GYM_OWNER',
    changedAt: new Date(),
    gymId: employee.gymId,
    gymPartnerId: employee.gymPartnerId,
    gymName: employee.gymName,
    editedFields: { status: { oldValue: 'Active', newValue: 'Inactive' } },
    approvalStatus: 'Pending Approval',
  });

  await employee.save();

  return res.status(200).json(
    ApiResponse.success(employee, 'Employee deactivation requested. Pending Super Admin approval.')
  );
});
