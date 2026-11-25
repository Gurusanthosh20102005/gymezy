import mongoose from 'mongoose';
import {
  Section,
  SECTION_CATEGORIES,
  DAYS_OF_WEEK,
  calculateScheduleEndDate,
  getSectionLifecycle,
  isTrainerAvailableForSchedule,
  checkTrainerSectionConflict,
  parseFlexibleDate,
} from '../models/section.model.js';
import { Employee } from '../models/employee.model.js';
import { Booking } from '../models/booking.model.js';
import { Gym } from '../models/gym.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { getSearchTerm, escapeRegex, parsePagination } from '../utils/searchHelper.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Helper to resolve gym context from req or inputs
 */
const resolveGymId = async (req, gymIdInput) => {
  if (gymIdInput && mongoose.isValidObjectId(gymIdInput)) {
    return new mongoose.Types.ObjectId(gymIdInput);
  }

  if (req.user?.gymId && mongoose.isValidObjectId(req.user.gymId)) {
    return new mongoose.Types.ObjectId(req.user.gymId);
  }

  const userId = req.user?.userId || req.user?._id || req.user?.id;
  if (userId || req.user?.email) {
    const gym = await Gym.findOne({
      $or: [
        userId ? { ownerId: userId } : null,
        userId ? { userId: userId } : null,
        req.user?.email ? { email: req.user.email } : null,
      ].filter(Boolean),
    }).select('_id');
    if (gym?._id) return gym._id;
  }

  if (gymIdInput && typeof gymIdInput === 'string') {
    const gym = await Gym.findOne({ partnerId: gymIdInput }).select('_id');
    if (gym?._id) return gym._id;
  }

  return null;
};

/**
 * @desc Get available trainers for a proposed section schedule
 * @route GET /api/v1/sections/available-trainers
 * @access Authenticated User / Gym Owner / Admin
 */
export const getAvailableTrainersForSection = asyncHandler(async (req, res) => {
  const {
    gymId: inputGymId,
    startDate,
    durationDays = 20,
    activeDays,
    startTime,
    endTime,
    excludeSectionId,
  } = req.query;

  const resolvedGymId = await resolveGymId(req, inputGymId);
  if (!resolvedGymId) {
    throw new ApiError(400, 'Gym ID is required to evaluate trainer availability.');
  }

  // Parse activeDays
  let parsedActiveDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (Array.isArray(activeDays)) {
    parsedActiveDays = activeDays;
  } else if (typeof activeDays === 'string' && activeDays.trim()) {
    parsedActiveDays = activeDays.split(',').map((d) => d.trim()).filter(Boolean);
  }

  const pStart = startDate ? parseFlexibleDate(startDate) : new Date();
  const pDuration = Math.max(1, Number(durationDays) || 20);
  const pEnd = calculateScheduleEndDate(pStart, pDuration, parsedActiveDays) || pStart;

  const proposedSchedule = {
    startDate: pStart,
    durationDays: pDuration,
    endDate: pEnd,
    activeDays: parsedActiveDays,
    startTime: startTime || '06:00 AM',
    endTime: endTime || '07:00 AM',
    excludeSectionId,
  };

  // 1. Fetch all gym trainers/coaches who are not deactivated
  const trainers = await Employee.find({
    gymId: { $in: [resolvedGymId, resolvedGymId.toString()] },
    status: { $ne: 'Deactivated' },
    $or: [
      { role: { $regex: /trainer|coach/i } },
      { role: { $exists: false } },
    ],
  }).select('name employeeId avatar phone role status schedule rating reviewsCount specialty specialization');

  // 2. Fetch all active sections for this gym to check conflict
  const existingSections = await Section.find({
    gymId: { $in: [resolvedGymId, resolvedGymId.toString()] },
    isActive: true,
    ...(excludeSectionId && mongoose.isValidObjectId(excludeSectionId)
      ? { _id: { $ne: new mongoose.Types.ObjectId(excludeSectionId) } }
      : {}),
  }).select('trainerId title startDate durationDays endDate startTime endTime activeDays isActive');

  // Group sections by trainerId
  const sectionsByTrainer = new Map();
  for (const sec of existingSections) {
    const tId = sec.trainerId?.toString();
    if (tId) {
      if (!sectionsByTrainer.has(tId)) {
        sectionsByTrainer.set(tId, []);
      }
      sectionsByTrainer.get(tId).push(sec);
    }
  }

  // 3. Evaluate availability for each trainer
  const referenceNow = new Date();
  const evaluatedTrainers = trainers.map((t) => {
    const tId = t._id.toString();
    const trainerSections = sectionsByTrainer.get(tId) || [];
    const avail = isTrainerAvailableForSchedule(t, proposedSchedule, trainerSections, referenceNow);
    return {
      _id: t._id,
      id: t._id,
      employeeId: t.employeeId,
      name: t.name,
      avatar: t.avatar,
      phone: t.phone,
      role: t.role,
      specialty: t.specialty || t.specialization || '',
      status: t.status,
      isAvailable: avail.isAvailable,
      reason: avail.reason || '',
      conflictingSection: avail.conflictingSection || '',
    };
  });

  const availableTrainers = evaluatedTrainers.filter((t) => t.isAvailable);

  return res.status(200).json(
    ApiResponse.success(
      {
        availableTrainers,
        allTrainers: evaluatedTrainers,
        totalAvailable: availableTrainers.length,
        totalTrainers: evaluatedTrainers.length,
      },
      'Available trainers evaluated successfully.'
    )
  );
});

/**
 * @desc Create a new Workout/Class Section
 * @route POST /api/v1/sections
 * @access Gym Owner / Super Admin
 */
export const createSection = asyncHandler(async (req, res) => {
  const {
    gymId: inputGymId,
    trainerId,
    title,
    category = 'yoga',
    cost,
    currency = 'INR',
    startDate,
    durationDays = 20,
    startTime,
    endTime,
    activeDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    maxCapacity = 25,
    description = '',
    inclusions = [],
    instructions = '',
    isActive = true,
  } = req.body;

  // 1. Resolve Gym ID (By ID only)
  const resolvedGymId = await resolveGymId(req, inputGymId);
  if (!resolvedGymId) {
    throw new ApiError(400, 'A valid Gym ID is required to create a section.');
  }

  // 2. Validate Required Fields
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Section title/name is required.');
  }

  if (!trainerId || !mongoose.isValidObjectId(trainerId)) {
    throw new ApiError(400, 'A valid Trainer ID is required.');
  }

  if (cost === undefined || cost === null || Number.isNaN(Number(cost)) || Number(cost) < 0) {
    throw new ApiError(400, 'A valid section cost is required.');
  }

  if (!startDate) {
    throw new ApiError(400, 'Start date is required.');
  }

  if (!startTime || !endTime) {
    throw new ApiError(400, 'Both start time and end time are required.');
  }

  if (!Array.isArray(activeDays) || activeDays.length === 0) {
    throw new ApiError(400, 'At least one active recurring day must be selected.');
  }

  const invalidDays = activeDays.filter((d) => !DAYS_OF_WEEK.includes(d));
  if (invalidDays.length > 0) {
    throw new ApiError(400, `Invalid days provided: ${invalidDays.join(', ')}.`);
  }

  if (category && !SECTION_CATEGORIES.includes(category)) {
    throw new ApiError(400, `Invalid category. Must be one of: ${SECTION_CATEGORIES.join(', ')}.`);
  }

  // 3. Verify Trainer exists and belongs to Gym (By ID only)
  const trainer = await Employee.findById(trainerId);
  if (!trainer) {
    throw new ApiError(404, 'Selected trainer was not found in gym staff records.');
  }

  // 4. Create Section Document (Strictly by IDs)
  const parsedStartDate = new Date(startDate);
  const parsedDuration = Math.max(1, Number(durationDays) || 20);
  const calculatedEndDate = calculateScheduleEndDate(parsedStartDate, parsedDuration, activeDays);

  // Validate Trainer Availability & Absence of Schedule Conflicts
  const proposedSchedule = {
    startDate: parsedStartDate,
    durationDays: parsedDuration,
    endDate: calculatedEndDate,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    activeDays,
  };

  const existingTrainerSections = await Section.find({
    trainerId: new mongoose.Types.ObjectId(trainerId),
    isActive: true,
  });

  const availCheck = isTrainerAvailableForSchedule(trainer, proposedSchedule, existingTrainerSections);
  if (!availCheck.isAvailable) {
    throw new ApiError(400, `Selected trainer is not available: ${availCheck.reason}`);
  }

  const formattedInclusions = Array.isArray(inclusions)
    ? inclusions.map((i) => String(i).trim()).filter(Boolean)
    : typeof inclusions === 'string' && inclusions.trim()
    ? inclusions.split(/[\n,]/).map((i) => i.trim()).filter(Boolean)
    : [];

  const section = await Section.create({
    gymId: resolvedGymId,
    trainerId: new mongoose.Types.ObjectId(trainerId),
    title: title.trim(),
    category,
    cost: Number(cost),
    currency,
    startDate: parsedStartDate,
    durationDays: parsedDuration,
    endDate: calculatedEndDate,
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    activeDays,
    maxCapacity: Math.max(1, Number(maxCapacity) || 25),
    enrolledCount: 0,
    description: description.trim(),
    inclusions: formattedInclusions,
    instructions: typeof instructions === 'string' ? instructions.trim() : '',
    isActive: Boolean(isActive),
  });

  // Populate trainer details for response
  const populatedSection = await Section.findById(section._id).populate(
    'trainerId',
    'name employeeId phone avatar specialization specialty experienceYears experience description aboutMe servicesOffered certifications languages rating reviewsCount'
  );

  return res
    .status(201)
    .json(ApiResponse.created(populatedSection, 'Workout section created successfully.'));
});

/**
 * @desc Get all sections for gym with optional filters
 * @route GET /api/v1/sections
 * @access Gym Owner / Super Admin / Authenticated User
 */
export const getSections = asyncHandler(async (req, res) => {
  const { gymId: inputGymId, category, isActive, search, bookableOnly, lifecycleFilter, status: queryStatus } = req.query;

  const resolvedGymId = await resolveGymId(req, inputGymId);
  if (!resolvedGymId) {
    throw new ApiError(400, 'Gym ID is required to fetch sections.');
  }

  const query = { gymId: resolvedGymId };

  if (category && category !== 'all') {
    query.category = category;
  }

  if (isActive !== undefined && isActive !== '') {
    query.isActive = isActive === 'true' || isActive === true;
  }

  const searchTerm = getSearchTerm(req.query);
  if (searchTerm) {
    const escaped = escapeRegex(searchTerm);
    const regex = new RegExp(escaped, 'i');

    const matchingTrainers = await Employee.find({
      $or: [{ name: regex }, { phone: regex }, { employeeId: regex }],
    }).select('_id').lean();
    const trainerIds = matchingTrainers.map((t) => t._id);

    query.$or = [
      { title: regex },
      { category: regex },
      { batchCode: regex },
      { trainerId: { $in: trainerIds } },
    ];
  }

  const { page, limit, skip, isFetchAll } = parsePagination(req.query, 10);
  const totalSections = await Section.countDocuments(query);
  const totalPages = limit > 0 ? Math.ceil(totalSections / limit) : 1;

  let queryBuilder = Section.find(query)
    .populate('trainerId', 'name employeeId phone avatar specialization specialty experienceYears experience description aboutMe servicesOffered certifications languages rating reviewsCount')
    .sort({ createdAt: -1 });

  // If filtering lifecycle in-memory or fetching all, handle pagination gracefully
  const isPostFiltered = Boolean(
    bookableOnly === 'true' ||
    bookableOnly === true ||
    lifecycleFilter ||
    queryStatus
  );

  if (!isFetchAll && limit > 0 && !isPostFiltered) {
    queryBuilder = queryBuilder.skip(skip).limit(limit);
  }

  const rawSections = await queryBuilder.lean();
  const now = new Date();

  // Auto-heal enrolledCount against actual active/upcoming bookings in database
  if (rawSections.length > 0) {
    const sectionIds = rawSections.map((s) => s._id);
    const bookingCounts = await Booking.aggregate([
      {
        $match: {
          sectionId: { $in: sectionIds },
          status: { $in: ['Upcoming', 'Active'] },
        },
      },
      {
        $group: {
          _id: '$sectionId',
          count: { $sum: 1 },
        },
      },
    ]);
    const realCountMap = new Map(bookingCounts.map((b) => [b._id.toString(), b.count]));
    for (const sec of rawSections) {
      const realCount = realCountMap.get(sec._id.toString()) || 0;
      if (sec.enrolledCount !== realCount) {
        sec.enrolledCount = realCount;
        Section.updateOne({ _id: sec._id }, { enrolledCount: realCount }).catch(() => {});
      }
    }
  }

  // Attach SSOT computed lifecycle fields to every section
  let sections = rawSections.map((sec) => {
    const lifecycle = getSectionLifecycle(sec, now);
    return {
      ...sec,
      lifecycleStatus: lifecycle.status, // 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'PAUSED'
      isBookable: lifecycle.isBookable,
      isStarted: lifecycle.isStarted,
      isCompleted: lifecycle.isCompleted,
      startDateTime: lifecycle.startDateTime,
      endDateTime: lifecycle.endDateTime,
    };
  });

  // 1. Filter by bookableOnly (Used by User App booking flow)
  if (bookableOnly === 'true' || bookableOnly === true) {
    sections = sections.filter((s) => s.isBookable);
  }

  // 2. Filter by lifecycle filter / status
  const effectiveFilter = (lifecycleFilter || queryStatus || '').toLowerCase();
  if (effectiveFilter && effectiveFilter !== 'all') {
    if (effectiveFilter === 'upcoming') {
      sections = sections.filter((s) => s.lifecycleStatus === 'UPCOMING');
    } else if (effectiveFilter === 'ongoing') {
      sections = sections.filter((s) => s.lifecycleStatus === 'ONGOING');
    } else if (effectiveFilter === 'active') {
      sections = sections.filter((s) => s.lifecycleStatus === 'UPCOMING' || s.lifecycleStatus === 'ONGOING');
    } else if (effectiveFilter === 'completed') {
      sections = sections.filter((s) => s.lifecycleStatus === 'COMPLETED');
    } else if (effectiveFilter === 'paused') {
      sections = sections.filter((s) => s.lifecycleStatus === 'PAUSED');
    }
  }

  // Auto-sort: Upcoming first, then Ongoing, then Paused, then Completed
  const statusPriority = { UPCOMING: 1, ONGOING: 2, PAUSED: 3, COMPLETED: 4 };
  sections.sort((a, b) => {
    const prioA = statusPriority[a.lifecycleStatus] || 99;
    const prioB = statusPriority[b.lifecycleStatus] || 99;
    if (prioA !== prioB) return prioA - prioB;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  // Apply pagination if post-filtered
  const finalTotal = isPostFiltered ? sections.length : totalSections;
  const finalTotalPages = limit > 0 ? Math.ceil(finalTotal / limit) : 1;
  const paginatedSections = isPostFiltered && !isFetchAll && limit > 0
    ? sections.slice(skip, skip + limit)
    : sections;

  return res
    .status(200)
    .json(
      ApiResponse.success(
        paginatedSections,
        'Sections retrieved successfully.',
        200,
        {
          total: finalTotal,
          page,
          limit,
          totalPages: finalTotalPages,
          hasNextPage: page < finalTotalPages,
          hasPrevPage: page > 1,
        }
      )
    );
});

/**
 * @desc Get single section by ID
 * @route GET /api/v1/sections/:id
 * @access Authenticated User
 */
export const getSectionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid section ID format.');
  }

  const rawSection = await Section.findById(id).populate(
    'trainerId',
    'name employeeId phone avatar specialization specialty experienceYears experience description aboutMe servicesOffered certifications languages rating reviewsCount'
  ).lean();

  if (!rawSection) {
    throw new ApiError(404, 'Section not found.');
  }

  // Auto-heal enrolledCount against actual active bookings
  const realCount = await Booking.countDocuments({
    sectionId: id,
    status: { $in: ['Upcoming', 'Active'] },
  });
  if (rawSection.enrolledCount !== realCount) {
    rawSection.enrolledCount = realCount;
    Section.updateOne({ _id: id }, { enrolledCount: realCount }).catch(() => {});
  }

  const lifecycle = getSectionLifecycle(rawSection, new Date());
  const section = {
    ...rawSection,
    lifecycleStatus: lifecycle.status,
    isBookable: lifecycle.isBookable,
    isStarted: lifecycle.isStarted,
    isCompleted: lifecycle.isCompleted,
    startDateTime: lifecycle.startDateTime,
    endDateTime: lifecycle.endDateTime,
  };

  return res
    .status(200)
    .json(ApiResponse.success(section, 'Section details retrieved successfully.'));
});

/**
 * @desc Update a section
 * @route PUT /api/v1/sections/:id
 * @access Gym Owner / Super Admin
 */
export const updateSection = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid section ID format.');
  }

  // Prevent modifying gymId directly
  delete updateData.gymId;

  // If updating trainerId, verify validity
  if (updateData.trainerId) {
    if (!mongoose.isValidObjectId(updateData.trainerId)) {
      throw new ApiError(400, 'Invalid trainer ID format.');
    }
    const trainerExists = await Employee.exists({ _id: updateData.trainerId });
    if (!trainerExists) {
      throw new ApiError(404, 'Assigned trainer not found in employee records.');
    }
    updateData.trainerId = new mongoose.Types.ObjectId(updateData.trainerId);
  }

  // Find existing section to merge schedule and validate conflicts
  const existing = await Section.findById(id);
  if (!existing) {
    throw new ApiError(404, 'Section not found.');
  }

  // Recalculate end date if start date, duration, or activeDays is updated
  const start = updateData.startDate ? new Date(updateData.startDate) : existing.startDate;
  const duration = updateData.durationDays ? Number(updateData.durationDays) : existing.durationDays;
  const days = updateData.activeDays || existing.activeDays;
  if (updateData.startDate || updateData.durationDays || updateData.activeDays) {
    updateData.endDate = calculateScheduleEndDate(start, duration, days);
  }

  // Validate Trainer Availability & Absence of Schedule Conflicts
  const effectiveTrainerId = updateData.trainerId || existing.trainerId;
  const effectiveTrainer = await Employee.findById(effectiveTrainerId);
  if (!effectiveTrainer) {
    throw new ApiError(404, 'Assigned trainer not found in employee records.');
  }

  const effectiveSchedule = {
    startDate: start,
    durationDays: duration,
    endDate: updateData.endDate || existing.endDate,
    startTime: updateData.startTime ? updateData.startTime.trim() : existing.startTime,
    endTime: updateData.endTime ? updateData.endTime.trim() : existing.endTime,
    activeDays: days,
    excludeSectionId: id,
  };

  const existingTrainerSections = await Section.find({
    _id: { $ne: new mongoose.Types.ObjectId(id) },
    trainerId: effectiveTrainerId,
    isActive: true,
  });

  const availCheck = isTrainerAvailableForSchedule(
    effectiveTrainer,
    effectiveSchedule,
    existingTrainerSections
  );
  if (!availCheck.isAvailable) {
    throw new ApiError(400, `Selected trainer is not available: ${availCheck.reason}`);
  }

  const updatedSection = await Section.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  }).populate('trainerId', 'name employeeId phone avatar specialization');

  if (!updatedSection) {
    throw new ApiError(404, 'Section not found to update.');
  }

  return res
    .status(200)
    .json(ApiResponse.success(updatedSection, 'Section updated successfully.'));
});

/**
 * @desc Toggle active status of a section
 * @route PATCH /api/v1/sections/:id/status
 * @access Gym Owner / Super Admin
 */
export const toggleSectionStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid section ID format.');
  }

  const section = await Section.findById(id);
  if (!section) {
    throw new ApiError(404, 'Section not found.');
  }

  const targetActive = isActive !== undefined ? Boolean(isActive) : !section.isActive;

  // If activating, verify trainer has no conflicting active section
  if (targetActive) {
    const lifecycle = getSectionLifecycle(section, new Date());
    if (lifecycle.isCompleted) {
      throw new ApiError(400, 'This batch schedule has already ended. Edit the schedule dates to reopen it.');
    }

    const trainer = await Employee.findById(section.trainerId);
    if (!trainer) {
      throw new ApiError(404, 'Assigned trainer not found in employee records.');
    }

    const existingTrainerSections = await Section.find({
      _id: { $ne: section._id },
      trainerId: section.trainerId,
      isActive: true,
    });

    const availCheck = isTrainerAvailableForSchedule(trainer, section, existingTrainerSections);
    if (!availCheck.isAvailable) {
      throw new ApiError(400, `Cannot activate section: ${availCheck.reason}`);
    }
  }

  section.isActive = targetActive;
  await section.save();

  return res
    .status(200)
    .json(ApiResponse.success(section, `Section ${section.isActive ? 'activated' : 'paused'} successfully.`));
});

/**
 * @desc Delete a section
 * @route DELETE /api/v1/sections/:id
 * @access Gym Owner / Super Admin
 */
export const deleteSection = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid section ID format.');
  }

  const deleted = await Section.findByIdAndDelete(id);
  if (!deleted) {
    throw new ApiError(404, 'Section not found to delete.');
  }

  return res
    .status(200)
    .json(ApiResponse.success(null, 'Section deleted successfully.'));
});
