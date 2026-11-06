import mongoose from 'mongoose';
import Gym from '../models/gym.model.js';
import User, { USER_ROLES } from '../models/user.model.js';
import Booking, { BOOKING_TYPES, BOOKING_STATUS } from '../models/booking.model.js';
import Membership from '../models/membership.model.js';
import Attendance from '../models/attendance.model.js';
import Counter from '../models/counter.model.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import {
  getSearchTerm,
  escapeRegex,
  parseDateRangeFilter,
  tokenizeAndNormalize,
  scoreGymRelevance,
  scoreBookingRelevance,
  scoreTransactionRelevance,
  scoreReportCustomerRelevance,
  getDidYouMeanSuggestion,
} from '../utils/searchHelper.js';
import { ApiError } from '../utils/apiError.js';
import { transformListWithIndex } from '../utils/responseTransformer.js';

const formatTimeSlot = (slot) => {
  if (!slot) return 'General Session';
  if (typeof slot === 'string') {
    const trimmed = slot.trim();
    return trimmed || 'General Session';
  }
  if (typeof slot === 'object' && (slot.startTime || slot.endTime)) {
    return `${slot.startTime || ''} - ${slot.endTime || ''}`.trim() || 'General Session';
  }
  return 'General Session';
};

// Calculate monthly labels for the past 6 months
const getLast6MonthsLabels = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      name: months[d.getMonth()],
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      subscription: 0,
      commission: 0,
      total: 0,
    });
  }
  return result;
};

/**
 * GET /api/v1/admin/dashboard-stats
 * Super Admin Executive Command Center Aggregated Live Statistics
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Parse temporal filter (Today, Yesterday, This Week, This Month, Custom Range, or All)
  const dateBounds = parseDateRangeFilter(req.query);

  const bookingDateFilter = dateBounds
    ? { createdAt: { $gte: dateBounds.start, $lte: dateBounds.end } }
    : {};

  const membershipDateFilter = dateBounds
    ? { createdAt: { $gte: dateBounds.start, $lte: dateBounds.end } }
    : {};

  // Parallel database aggregations
  const [
    totalGyms,
    activeGyms,
    inactiveGyms,
    pendingApprovalsCount,
    new30dGyms,
    hybridCount,
    appOnlyCount,
    gmsCount,
    listingCount,
    totalUsers,
    activeUsers,
    new30dUsers,
    pendingGymsList,
    topGymsList,
    bookingAggs,
    membershipAggs,
    attendanceCount,
  ] = await Promise.all([
    Gym.countDocuments({}),
    Gym.countDocuments({ status: 'Active' }),
    Gym.countDocuments({ status: 'Inactive' }),
    Gym.countDocuments({ approvalStatus: 'Pending Approval' }),
    Gym.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Gym.countDocuments({ subscriptionType: 'Hybrid' }),
    Gym.countDocuments({ subscriptionType: 'App Only' }),
    Gym.countDocuments({ subscriptionType: 'GMS' }),
    Gym.countDocuments({ subscriptionType: 'Listing Only' }),
    User.countDocuments({}),
    User.countDocuments({ isActive: { $ne: false } }),
    User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Gym.find({ approvalStatus: 'Pending Approval' })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name phone email city createdAt subscriptionType'),
    Gym.find({ status: 'Active' })
      .sort({ rating: -1, membersCount: -1 })
      .limit(5)
      .select('name rating reviewsCount membersCount monthlyRevenue city image'),
    Booking.aggregate([
      ...(Object.keys(bookingDateFilter).length > 0 ? [{ $match: bookingDateFilter }] : []),
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          confirmed: {
            $sum: {
              $cond: [{ $in: ['$status', ['Upcoming', 'Active']] }, 1, 0],
            },
          },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0],
            },
          },
          noShow: {
            $sum: {
              $cond: [{ $in: ['$status', ['No Show', 'NoShow']] }, 1, 0],
            },
          },
          bookingGmv: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$status', 'Cancelled'] },
                    { $ne: ['$payment.status', 'Failed'] },
                    { $ne: ['$payment.status', 'Refunded'] },
                  ],
                },
                { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$totalAmount', 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]),
    Membership.aggregate([
      ...(Object.keys(membershipDateFilter).length > 0 ? [{ $match: membershipDateFilter }] : []),
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          membershipGmv: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: { $in: ['$status', ['Cancelled', 'Switched']] } },
                    { $ne: ['$payment.status', 'Failed'] },
                    { $ne: ['$payment.status', 'Refunded'] },
                  ],
                },
                { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$totalAmount', 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]),
    Attendance.countDocuments(
      dateBounds ? { checkInTime: { $gte: dateBounds.start, $lte: dateBounds.end } } : {}
    ).catch(() => 0),
  ]);

  // Dynamic GMV and Bookings aggregation results
  const bAgg = bookingAggs && bookingAggs[0] ? bookingAggs[0] : {};
  const mAgg = membershipAggs && membershipAggs[0] ? membershipAggs[0] : {};

  const totalBookings = bAgg.total || 0;
  const confirmedBookings = bAgg.confirmed || 0;
  const completedBookings = bAgg.completed || 0;
  const cancelledBookings = bAgg.cancelled || 0;
  const noShowBookings = bAgg.noShow || 0;

  const bookingGmv = bAgg.bookingGmv || 0;
  const membershipGmv = mAgg.membershipGmv || 0;
  const totalGmv = bookingGmv + membershipGmv;
  const completedWorkouts = completedBookings;

  const completionRate = totalBookings > 0 ? Number(((completedBookings / totalBookings) * 100).toFixed(1)) : 0;
  const activeGymsPct = totalGyms > 0 ? Number(((activeGyms / totalGyms) * 100).toFixed(1)) : 0;

  // Monthly 6-month historical revenue breakdown
  const revenueMonthly = getLast6MonthsLabels();
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [monthlyBookings, monthlyMemberships] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo },
            status: { $ne: 'Cancelled' },
            'payment.status': { $nin: ['Failed', 'Refunded'] },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            total: { $sum: { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$totalAmount', 0] }] } },
          },
        },
      ]),
      Membership.aggregate([
        {
          $match: {
            createdAt: { $gte: sixMonthsAgo },
            status: { $nin: ['Cancelled', 'Switched'] },
            'payment.status': { $nin: ['Failed', 'Refunded'] },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            total: { $sum: { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$totalAmount', 0] }] } },
          },
        },
      ]),
    ]);

    for (const item of revenueMonthly) {
      const bFound = monthlyBookings.find(
        (b) => b._id.year === item.year && b._id.month === item.monthIndex + 1
      );
      const mFound = monthlyMemberships.find(
        (m) => m._id.year === item.year && m._id.month === item.monthIndex + 1
      );
      item.commission = bFound ? bFound.total : 0;
      item.subscription = mFound ? mFound.total : 0;
      item.total = item.commission + item.subscription;
    }
  } catch (_e) {
    // Gracefully preserve default initialized monthly labels
  }

  // Calculate month-over-month revenue growth rate
  const prevMonthTotal = revenueMonthly[revenueMonthly.length - 2]?.total || 0;
  const currMonthTotal = revenueMonthly[revenueMonthly.length - 1]?.total || 0;
  const gmvGrowthPct = prevMonthTotal > 0
    ? Number((((currMonthTotal - prevMonthTotal) / prevMonthTotal) * 100).toFixed(1))
    : (currMonthTotal > 0 ? 100 : 0);

  const totalAppOpensCount = attendanceCount > 0 ? attendanceCount : (completedBookings + confirmedBookings);
  const completedSessions = completedBookings;

  const responseData = {
    totalGmv,
    gmvGrowthPct,
    activeGyms,
    totalGyms,
    activeGymsPct: Number(activeGymsPct),
    completedWorkouts,
    completionRate: Number(completionRate),
    pendingApprovalsCount,
    dateFilter: {
      range: req.query.range || req.query.filterType || 'all',
      label: dateBounds?.label || 'All Time',
      startDate: dateBounds?.start ? dateBounds.start.toISOString() : null,
      endDate: dateBounds?.end ? dateBounds.end.toISOString() : null,
    },
    registeredGyms: {
      total: totalGyms,
      active: activeGyms,
      inactive: inactiveGyms,
      new30d: new30dGyms,
    },
    bookings: {
      total: totalBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
      noShow: noShowBookings,
    },
    subscriptionShare: {
      hybrid: hybridCount,
      appOnly: appOnlyCount,
      gms: gmsCount,
      listing: listingCount,
    },
    registeredUsers: totalUsers,
    usersStats: {
      total: totalUsers,
      active: activeUsers,
      new30d: new30dUsers,
      activePct: totalUsers > 0 ? Number(((activeUsers / totalUsers) * 100).toFixed(1)) : 100,
    },
    totalAppOpens: totalAppOpensCount,
    completedSessions,
    revenueMonthly,
    topGyms: transformListWithIndex(topGymsList),
    pendingApprovals: transformListWithIndex(pendingGymsList),
    recentActivities: [],
    systemHealth: {
      apiUptime: 100,
      paymentGateway: 100,
      notificationEngine: 100,
      backendStatus: 'Online',
      databaseStatus: 'Connected',
    },
  };

  return res.status(200).json(
    ApiResponse.success(responseData, 'Dashboard statistics retrieved successfully')
  );
});

/**
 * GET /api/v1/admin/customers
 * Super Admin Customers & Users List with Server-Side Pagination, Search, Filter & Aggregated Metrics
 */
export const getAdminCustomers = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  const { search, status, role } = req.query;

  // Build filter
  const filter = {};

  // Role filter: default to CUSTOMER or allow role param (e.g. all or specific role)
  if (role && role !== 'all') {
    filter.role = role.toUpperCase();
  } else if (!role) {
    filter.role = USER_ROLES.CUSTOMER;
  }

  // Status filter
  if (status && status !== 'all') {
    const isAct = status.toLowerCase() === 'active';
    filter.isActive = isAct;
  }

  // Search filter (SSOT)
  const searchTerm = getSearchTerm(req.query);
  if (searchTerm) {
    const regex = new RegExp(escapeRegex(searchTerm), 'i');
    filter.$or = [
      { fullName: regex },
      { email: regex },
      { phone: regex },
      { customerId: regex },
    ];
  }

  // Parallel database queries
  const [totalRecords, users, totalCustomersCount, activeCount, inactiveCount] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password')
      .lean(),
    User.countDocuments({ role: USER_ROLES.CUSTOMER }),
    User.countDocuments({ role: USER_ROLES.CUSTOMER, isActive: true }),
    User.countDocuments({ role: USER_ROLES.CUSTOMER, isActive: false }),
  ]);

  // Aggregate bookings and revenue per user
  const userIds = users.map((u) => u._id);

  let bookingMap = new Map();
  let membershipMap = new Map();

  if (userIds.length > 0) {
    const [bookingAggs, membershipAggs] = await Promise.all([
      Booking.aggregate([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: '$userId',
            totalBookings: { $sum: 1 },
            completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
            cancelledBookings: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
            totalBookingRevenue: { $sum: { $ifNull: ['$pricing.totalAmount', '$pricing.basePrice', 0] } },
          },
        },
      ]),
      Membership.aggregate([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: '$userId',
            totalMemberships: { $sum: 1 },
            membershipRevenue: { $sum: { $ifNull: ['$pricing.totalAmount', '$pricing.basePrice', 0] } },
          },
        },
      ]),
    ]);

    bookingMap = new Map(bookingAggs.map((b) => [String(b._id), b]));
    membershipMap = new Map(membershipAggs.map((m) => [String(m._id), m]));
  }

  const transformedCustomers = users.map((u) => {
    const bData = bookingMap.get(String(u._id)) || { totalBookings: 0, completedBookings: 0, cancelledBookings: 0, totalBookingRevenue: 0 };
    const mData = membershipMap.get(String(u._id)) || { totalMemberships: 0, membershipRevenue: 0 };
    const totalRev = (bData.totalBookingRevenue || 0) + (mData.membershipRevenue || 0);

    const name = u.fullName || 'User';
    const initials =
      name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'U';

    return {
      _id: u._id,
      id: String(u._id),
      name,
      fullName: name,
      email: u.email,
      phone: u.phone || '—',
      customerId: u.customerId || `CUST-${String(u._id).slice(-6).toUpperCase()}`,
      status: u.isActive !== false ? 'Active' : 'Inactive',
      isActive: u.isActive !== false,
      role: u.role || 'CUSTOMER',
      avatar: u.avatar || u.profilePicture || '',
      initials,
      avatarColor: '#f3e8ff',
      avatarTextColor: '#7e22ce',
      totalBookings: bData.totalBookings,
      totalRevenue: totalRev.toFixed(2),
      createdAt: u.createdAt,
      joinDate: u.createdAt
        ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—',
      metrics: {
        totalBookings: bData.totalBookings,
        completed: bData.completedBookings,
        completedPct: bData.totalBookings > 0 ? `${((bData.completedBookings / bData.totalBookings) * 100).toFixed(1)}%` : '0%',
        cancelled: bData.cancelledBookings,
        cancelledPct: bData.totalBookings > 0 ? `${((bData.cancelledBookings / bData.totalBookings) * 100).toFixed(1)}%` : '0%',
        noShow: 0,
        noShowPct: '0%',
        totalRevenue: totalRev.toFixed(2),
      },
      recentBookings: [],
    };
  });

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return res.status(200).json(
    ApiResponse.success(
      {
        customers: transformedCustomers,
        pagination: {
          page,
          limit,
          totalPages,
          totalRecords,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        stats: {
          totalCustomers: totalCustomersCount,
          activeCustomers: activeCount,
          inactiveCustomers: inactiveCount,
        },
      },
      'Customers retrieved successfully'
    )
  );
});

/**
 * GET /api/v1/admin/customers/:id
 * Retrieve single customer detailed profile with real booking and membership records
 */
export const getAdminCustomerDetails = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id).select('-password').lean();
  if (!user) {
    throw ApiError.notFound('Customer not found');
  }

  // Fetch customer's recent bookings and memberships
  const [recentBookings, recentMemberships] = await Promise.all([
    Booking.find({ userId: user._id })
      .populate('gymId', 'name partnerId city address image')
      .populate('sectionId', 'title category')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Membership.find({ userId: user._id })
      .populate('gymId', 'name partnerId city address')
      .populate('trainerId', 'fullName name employeeId')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  const totalBookings = recentBookings.length;
  const completed = recentBookings.filter((b) => b.status === 'Completed').length;
  const cancelled = recentBookings.filter((b) => b.status === 'Cancelled').length;
  const bookingRev = recentBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || b.pricing?.basePrice || 0), 0);
  const membershipRev = recentMemberships.reduce((sum, m) => sum + (m.pricing?.totalAmount || m.pricing?.basePrice || 0), 0);
  const totalRevenue = (bookingRev + membershipRev).toFixed(2);

  const formattedBookings = recentBookings.map((b) => ({
    key: b._id || b.bookingId,
    id: b._id,
    bookingId: b.bookingId,
    bookingType: b.bookingType || 'SECTION',
    gymName: b.gymId?.name || 'Partner Gym',
    gymPartnerId: b.gymId?.partnerId || '',
    gymCity: b.gymId?.city || 'Chennai',
    sectionName: b.sectionId?.title || b.title || 'Gym Session',
    date: b.date || (b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : 'Recent'),
    timeSlot: formatTimeSlot(b.timeSlot),
    status: b.status || 'Completed',
    amount: (b.pricing?.totalAmount || b.pricing?.basePrice || 0).toFixed(2),
  }));

  const formattedMemberships = recentMemberships.map((m) => ({
    key: m._id || m.membershipId,
    id: String(m._id),
    membershipId: m.membershipId,
    membershipTier: m.membershipTier || 'Monthly',
    gymName: m.gymId?.name || 'Partner Gym',
    gymPartnerId: m.gymId?.partnerId || '',
    gymCity: m.gymId?.city || 'Chennai',
    startDate: m.startDate ? new Date(m.startDate).toLocaleDateString('en-GB') : '—',
    endDate: m.endDate ? new Date(m.endDate).toLocaleDateString('en-GB') : '—',
    durationDays: m.durationDays || 30,
    hasTrainer: Boolean(m.hasTrainer || m.trainerId),
    trainerName: m.trainerId?.fullName || m.trainerId?.name || (m.hasTrainer ? 'Personal Trainer' : 'None'),
    trainerSlot: m.trainerSlot || '—',
    status: m.status || 'Active',
    amount: (m.pricing?.totalAmount || m.pricing?.basePrice || 0).toFixed(2),
  }));

  const name = user.fullName || 'User';
  const customerDetail = {
    _id: user._id,
    id: String(user._id),
    name,
    fullName: name,
    email: user.email,
    phone: user.phone || '—',
    customerId: user.customerId || `CUST-${String(user._id).slice(-6).toUpperCase()}`,
    status: user.isActive !== false ? 'Active' : 'Inactive',
    isActive: user.isActive !== false,
    role: user.role,
    avatar: user.avatar || user.profilePicture || '',
    address: user.address || '—',
    emergencyContact: user.emergencyContact || '—',
    customerProfile: user.customerProfile || {},
    joinDate: user.createdAt
      ? new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—',
    metrics: {
      totalBookings,
      completed,
      completedPct: totalBookings > 0 ? `${((completed / totalBookings) * 100).toFixed(1)}%` : '0%',
      cancelled,
      cancelledPct: totalBookings > 0 ? `${((cancelled / totalBookings) * 100).toFixed(1)}%` : '0%',
      noShow: 0,
      noShowPct: '0%',
      totalRevenue,
    },
    recentBookings: formattedBookings,
    recentMemberships: formattedMemberships,
  };

  return res.status(200).json(
    ApiResponse.success(customerDetail, 'Customer details retrieved successfully')
  );
});

/**
 * POST /api/v1/admin/customers
 * Create a new Customer account directly from Super Admin
 */
export const createAdminCustomer = asyncHandler(async (req, res) => {
  const { fullName, name, email, phone, status, password } = req.body;
  const userFullName = (fullName || name || '').trim();
  if (!userFullName) {
    throw ApiError.badRequest('Full name is required');
  }
  if (!email || !email.trim()) {
    throw ApiError.badRequest('Email is required');
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw ApiError.conflict('User with this email already exists');
  }

  let customerId;
  try {
    const customerSeq = await Counter.getNextSequence('customer_id');
    customerId = `CUST-${customerSeq}`;
  } catch {
    customerId = `CUST-${Date.now().toString().slice(-6)}`;
  }

  const newUser = await User.create({
    fullName: userFullName,
    email: email.toLowerCase().trim(),
    phone: phone ? phone.trim() : '',
    password: password || 'Gymezy@123',
    role: USER_ROLES.CUSTOMER,
    customerId,
    isActive: status !== 'Inactive',
    avatar: '',
  });

  return res.status(201).json(
    ApiResponse.success(newUser, 'Customer created successfully')
  );
});

/**
 * PUT /api/v1/admin/customers/:id
 * Update customer details from Super Admin
 */
export const updateAdminCustomer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fullName, name, email, phone, status, isActive } = req.body;

  const updates = {};
  if (fullName || name) updates.fullName = (fullName || name).trim();
  if (email) updates.email = email.toLowerCase().trim();
  if (phone !== undefined) updates.phone = phone.trim();
  if (status !== undefined) updates.isActive = status === 'Active';
  if (isActive !== undefined) updates.isActive = Boolean(isActive);

  const updatedUser = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).select('-password');
  if (!updatedUser) {
    throw ApiError.notFound('Customer not found');
  }

  return res.status(200).json(
    ApiResponse.success(updatedUser, 'Customer updated successfully')
  );
});

/**
 * PATCH /api/v1/admin/customers/:id/status
 * Toggle Customer active/inactive state
 */
export const toggleCustomerStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) {
    throw ApiError.notFound('Customer not found');
  }

  user.isActive = !user.isActive;
  await user.save();

  return res.status(200).json(
    ApiResponse.success(
      { _id: user._id, isActive: user.isActive, status: user.isActive ? 'Active' : 'Inactive' },
      `Customer marked as ${user.isActive ? 'Active' : 'Inactive'}`
    )
  );
});

/**
 * GET /api/v1/admin/bookings
 * Super Admin Live Bookings Fleet (Session Bookings & Group Classes) with Server-Side Pagination & Filters
 */
export const getAdminBookings = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const { type, status, gymId, search } = req.query;
  const query = {};

  // Filter by Booking Type: SESSION (SECTION / GYM_SESSION) vs GROUP_CLASS
  if (type) {
    const upperType = String(type).trim().toUpperCase();
    if (upperType === 'SESSION' || upperType === 'SECTION') {
      query.bookingType = { $in: ['SECTION', 'GYM_SESSION'] };
    } else if (upperType === 'GROUP_CLASS') {
      query.bookingType = 'GROUP_CLASS';
    }
  }

  // Filter by Status
  if (status && status !== 'all' && status !== 'All') {
    query.status = status;
  }

  // Filter by Gym
  if (gymId && gymId !== 'all' && gymId !== 'All') {
    if (mongoose.Types.ObjectId.isValid(gymId)) {
      query.gymId = gymId;
    } else {
      const matchedGym = await Gym.findOne({ partnerId: gymId }).select('_id').lean();
      if (matchedGym) {
        query.gymId = matchedGym._id;
      }
    }
  }

  // Search filter across bookingId, title, or customer fields
  if (search && search.trim()) {
    const s = search.trim();
    const matchingUsers = await User.find({
      $or: [
        { fullName: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { customerId: { $regex: s, $options: 'i' } },
      ],
    }).select('_id').lean();

    const userIds = matchingUsers.map((u) => u._id);
    query.$or = [
      { bookingId: { $regex: s, $options: 'i' } },
      { title: { $regex: s, $options: 'i' } },
      { userId: { $in: userIds } },
    ];
  }

  const [totalRecords, bookings, statsAgg] = await Promise.all([
    Booking.countDocuments(query),
    Booking.find(query)
      .populate('userId', 'fullName email phone customerId avatar profilePicture')
      .populate('gymId', 'name partnerId city area address image')
      .populate('trainerId', 'fullName name employeeId email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.aggregate([
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          sessionCount: {
            $sum: {
              $cond: [{ $in: ['$bookingType', ['SECTION', 'GYM_SESSION']] }, 1, 0],
            },
          },
          groupClassCount: {
            $sum: {
              $cond: [{ $eq: ['$bookingType', 'GROUP_CLASS'] }, 1, 0],
            },
          },
          upcomingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Upcoming'] }, 1, 0] },
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
          },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] },
          },
          totalRevenue: {
            $sum: { $ifNull: ['$pricing.totalAmount', 0] },
          },
        },
      },
    ]),
  ]);

  const summary = statsAgg[0] || {
    totalCount: 0,
    sessionCount: 0,
    groupClassCount: 0,
    upcomingCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalRevenue: 0,
  };

  const formattedBookings = bookings.map((b) => {
    const u = b.userId || {};
    const g = b.gymId || {};
    const t = b.trainerId || {};
    const rawAvatar = u.avatar || u.profilePicture || '';
    const avatar = rawAvatar.includes('dicebear.com') ? '' : rawAvatar;

    return {
      _id: b._id,
      id: String(b._id),
      bookingId: b.bookingId,
      bookingType: b.bookingType || 'SECTION',
      isGroupClass: b.bookingType === 'GROUP_CLASS',
      title: b.title,
      category: b.category || 'General',
      status: b.status || 'Active',
      startDate: b.startDate,
      endDate: b.endDate,
      durationDays: b.durationDays || 1,
      sessionsCount: b.sessionsCount || 1,
      timeSlot: formatTimeSlot(b.timeSlot),
      pricing: b.pricing || { totalAmount: 0, subtotal: 0, discount: 0, currency: 'INR' },
      payment: b.payment || {},
      entryOtp: b.entryOtp || null,
      createdAt: b.createdAt,
      user: {
        _id: u._id,
        name: u.fullName || 'Member',
        fullName: u.fullName || 'Member',
        email: u.email || '—',
        phone: u.phone || '—',
        customerId: u.customerId || '—',
        avatar,
      },
      gym: {
        _id: g._id,
        name: g.name || 'Partner Gym',
        partnerId: g.partnerId || '—',
        city: g.city || '',
        area: g.area || '',
        address: g.address || '',
      },
      trainer: t._id ? {
        _id: t._id,
        name: t.fullName || t.name || 'Trainer',
        employeeId: t.employeeId || '',
      } : null,
    };
  });

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return res.status(200).json(
    ApiResponse.success(
      {
        bookings: formattedBookings,
        summary,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
      'Bookings retrieved successfully'
    )
  );
});

/**
 * GET /api/v1/admin/transactions
 * Super Admin Live Transactions & Payments Fleet with Server-Side Pagination & Filters
 */
/**
 * Shared Engine to fetch unified transactions fleet (Bookings + Memberships)
 * Can be platform-wide (Super Admin) or scoped to a specific gym (Gym Owner).
 */
export async function fetchTransactionsFleet({
  gymId = null,
  page = 1,
  limit = 10,
  search = '',
  paymentMode = 'all',
  status = 'all',
}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
  const skip = (safePage - 1) * safeLimit;

  // Build query for Bookings and Memberships
  const bookingQuery = {};
  const membershipQuery = {};

  // Scope to gymId if provided
  let gymObjectId = null;
  if (gymId) {
    gymObjectId = mongoose.Types.ObjectId.isValid(gymId) ? new mongoose.Types.ObjectId(gymId) : gymId;
    bookingQuery.gymId = gymObjectId;
    membershipQuery.gymId = gymObjectId;
  }

  // Status Filter
  if (status && status !== 'all' && status !== 'All') {
    const sLower = status.toLowerCase();
    if (sLower === 'completed') {
      bookingQuery['payment.status'] = 'Completed';
      membershipQuery['payment.status'] = 'Completed';
    } else if (sLower === 'pending') {
      bookingQuery['payment.status'] = 'Pending';
      membershipQuery['payment.status'] = 'Pending';
    } else if (sLower === 'cancelled' || sLower === 'failed') {
      bookingQuery['payment.status'] = { $in: ['Failed', 'Cancelled'] };
      membershipQuery['payment.status'] = { $in: ['Failed', 'Cancelled'] };
    } else if (sLower === 'refunded') {
      bookingQuery['payment.status'] = 'Refunded';
      membershipQuery['payment.status'] = 'Refunded';
    } else {
      bookingQuery['payment.status'] = status;
      membershipQuery['payment.status'] = status;
    }
  }

  // Payment Mode Filter
  if (paymentMode && paymentMode !== 'all' && paymentMode !== 'All') {
    const pLower = paymentMode.toLowerCase();
    let modeRegex;
    if (pLower.includes('upi')) {
      modeRegex = /upi/i;
    } else if (pLower.includes('card')) {
      modeRegex = /card/i;
    } else if (pLower.includes('net') || pLower.includes('banking')) {
      modeRegex = /net\s*banking/i;
    } else if (pLower.includes('cash') || pLower.includes('gym')) {
      modeRegex = /cash/i;
    } else if (pLower.includes('wallet')) {
      modeRegex = /wallet/i;
    } else {
      modeRegex = new RegExp(paymentMode, 'i');
    }
    bookingQuery['payment.method'] = modeRegex;
    membershipQuery['payment.method'] = modeRegex;
  }

  // Search filter across customer fields, transactionId, or reference ID
  if (search && search.trim()) {
    const s = search.trim();
    const matchingUsers = await User.find({
      $or: [
        { fullName: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { customerId: { $regex: s, $options: 'i' } },
      ],
    }).select('_id').lean();

    const userIds = matchingUsers.map((u) => u._id);

    bookingQuery.$or = [
      { 'payment.transactionId': { $regex: s, $options: 'i' } },
      { bookingId: { $regex: s, $options: 'i' } },
      { title: { $regex: s, $options: 'i' } },
      { userId: { $in: userIds } },
    ];

    membershipQuery.$or = [
      { 'payment.transactionId': { $regex: s, $options: 'i' } },
      { membershipId: { $regex: s, $options: 'i' } },
      { membershipTier: { $regex: s, $options: 'i' } },
      { userId: { $in: userIds } },
    ];
  }

  const gymMatchStage = gymObjectId ? [{ $match: { gymId: gymObjectId } }] : [];

  // Parallel fetch: Bookings, Memberships, and Aggregation Stats
  const [
    matchingBookings,
    matchingMemberships,
    bookingStats,
    membershipStats,
  ] = await Promise.all([
    Booking.find(bookingQuery)
      .populate('userId', 'fullName email phone customerId avatar profilePicture')
      .populate('gymId', 'name partnerId city area address')
      .sort({ createdAt: -1 })
      .lean(),
    Membership.find(membershipQuery)
      .populate('userId', 'fullName email phone customerId avatar profilePicture')
      .populate('gymId', 'name partnerId city area address')
      .sort({ createdAt: -1 })
      .lean(),
    Booking.aggregate([
      ...gymMatchStage,
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'Completed'] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'Pending'] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $in: ['$payment.status', ['Failed', 'Cancelled', 'Refunded']] }, 1, 0] } },
          totalAmount: {
            $sum: {
              $cond: [
                { $eq: ['$payment.status', 'Completed'] },
                { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$pricing.basePrice', 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]),
    Membership.aggregate([
      ...gymMatchStage,
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          completedCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'Completed'] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $eq: ['$payment.status', 'Pending'] }, 1, 0] } },
          failedCount: { $sum: { $cond: [{ $in: ['$payment.status', ['Failed', 'Cancelled', 'Refunded']] }, 1, 0] } },
          totalAmount: {
            $sum: {
              $cond: [
                { $eq: ['$payment.status', 'Completed'] },
                { $ifNull: ['$pricing.totalAmount', { $ifNull: ['$pricing.basePrice', 0] }] },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  // Normalize into standard unified transactions
  const normalizedBookings = matchingBookings.map((b) => {
    const u = b.userId || {};
    const g = b.gymId || {};
    const rawAvatar = u.avatar || u.profilePicture || '';
    const avatar = rawAvatar.includes('dicebear.com') ? '' : rawAvatar;
    const name = u.fullName || 'Member';
    const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'M';
    const txnDate = b.payment?.paidAt || b.createdAt || new Date();

    return {
      _id: b._id,
      id: String(b._id),
      key: `b-${b._id}`,
      transactionId: b.payment?.transactionId || `TXN-BK-${b.bookingId || String(b._id).slice(-6)}`,
      gatewayTxnId: b.payment?.transactionId || '—',
      referenceId: b.bookingId,
      bookingId: b.bookingId,
      referenceType: 'BOOKING',
      title: b.title || 'Gym Session',
      customerName: name,
      customerId: u.customerId || `CUST-${String(u._id || '').slice(-6).toUpperCase()}`,
      customerPhone: u.phone || '—',
      customerEmail: u.email || '—',
      customerInitials: initials,
      avatar,
      avatarColor: '#f3e8ff',
      avatarTextColor: '#7e22ce',
      gymName: g.name || 'Partner Gym',
      gymPartnerId: g.partnerId || '',
      gymLocation: [g.area, g.city].filter(Boolean).join(', ') || 'Chennai',
      dateTime: new Date(txnDate).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      transactionDate: new Date(txnDate).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      rawDate: new Date(txnDate).getTime(),
      amount: (b.pricing?.totalAmount || b.pricing?.basePrice || 0).toFixed(2),
      paymentMode: b.payment?.method || 'UPI',
      status: b.payment?.status || 'Completed',
      walletAmountApplied: b.payment?.walletAmountApplied || 0,
      daysBooked: b.durationDays ? `${b.durationDays} Day${b.durationDays > 1 ? 's' : ''}` : '1 Day',
    };
  });

  const normalizedMemberships = matchingMemberships.map((m) => {
    const u = m.userId || {};
    const g = m.gymId || {};
    const rawAvatar = u.avatar || u.profilePicture || '';
    const avatar = rawAvatar.includes('dicebear.com') ? '' : rawAvatar;
    const name = u.fullName || 'Member';
    const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'M';
    const txnDate = m.payment?.paidAt || m.createdAt || new Date();

    return {
      _id: m._id,
      id: String(m._id),
      key: `m-${m._id}`,
      transactionId: m.payment?.transactionId || `TXN-MEM-${m.membershipId || String(m._id).slice(-6)}`,
      gatewayTxnId: m.payment?.transactionId || '—',
      referenceId: m.membershipId,
      bookingId: m.membershipId,
      referenceType: 'MEMBERSHIP',
      title: `${m.membershipTier || 'Gym'} Membership`,
      customerName: name,
      customerId: u.customerId || `CUST-${String(u._id || '').slice(-6).toUpperCase()}`,
      customerPhone: u.phone || '—',
      customerEmail: u.email || '—',
      customerInitials: initials,
      avatar,
      avatarColor: '#e0e7ff',
      avatarTextColor: '#4f46e5',
      gymName: g.name || 'Partner Gym',
      gymPartnerId: g.partnerId || '',
      gymLocation: [g.area, g.city].filter(Boolean).join(', ') || 'Chennai',
      dateTime: new Date(txnDate).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      transactionDate: new Date(txnDate).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
      }),
      rawDate: new Date(txnDate).getTime(),
      amount: (m.pricing?.totalAmount || m.pricing?.basePrice || 0).toFixed(2),
      paymentMode: m.payment?.method || 'UPI',
      status: m.payment?.status || 'Completed',
      walletAmountApplied: m.payment?.walletAmountApplied || 0,
      daysBooked: m.durationDays ? `${m.durationDays} Days` : `${m.membershipTier || 'Annual'} Plan`,
    };
  });

  // Combine and sort by date descending
  const combined = [...normalizedBookings, ...normalizedMemberships].sort(
    (a, b) => b.rawDate - a.rawDate
  );

  const totalRecords = combined.length;
  const paginatedTransactions = combined.slice(skip, skip + safeLimit);
  const totalPages = Math.ceil(totalRecords / safeLimit) || 1;

  // Compute stats
  const bStat = bookingStats[0] || { totalCount: 0, completedCount: 0, pendingCount: 0, failedCount: 0, totalAmount: 0 };
  const mStat = membershipStats[0] || { totalCount: 0, completedCount: 0, pendingCount: 0, failedCount: 0, totalAmount: 0 };

  const totalTxnCount = bStat.totalCount + mStat.totalCount;
  const totalCompleted = bStat.completedCount + mStat.completedCount;
  const totalPending = bStat.pendingCount + mStat.pendingCount;
  const totalFailed = bStat.failedCount + mStat.failedCount;
  const totalRev = (bStat.totalAmount + mStat.totalAmount).toFixed(2);

  const stats = {
    totalTransactions: totalTxnCount,
    successfulTransactions: totalCompleted,
    successfulPct: totalTxnCount > 0 ? `${((totalCompleted / totalTxnCount) * 100).toFixed(1)}%` : '0%',
    pendingTransactions: totalPending,
    pendingPct: totalTxnCount > 0 ? `${((totalPending / totalTxnCount) * 100).toFixed(1)}%` : '0%',
    failedTransactions: totalFailed,
    failedPct: totalTxnCount > 0 ? `${((totalFailed / totalTxnCount) * 100).toFixed(1)}%` : '0%',
    totalAmount: totalRev,
  };

  return {
    transactions: paginatedTransactions,
    stats,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalRecords,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPrevPage: safePage > 1,
    },
  };
}

export const getAdminTransactions = asyncHandler(async (req, res) => {
  const { page, limit, search, paymentMode, status, gymId } = req.query;

  const result = await fetchTransactionsFleet({
    gymId,
    page,
    limit,
    search,
    paymentMode,
    status,
  });

  return res.status(200).json(
    ApiResponse.success(
      result,
      'Transactions retrieved successfully'
    )
  );
});

const getInitials = (name) => {
  if (!name) return 'GY';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatBillingDate = (date) => {
  if (!date) return '—';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * GET /api/v1/admin/subscriptions
 * Super Admin SaaS Partner Gym Subscriptions & Governance Fleet
 * Supports server-side pagination, status/plan filtering, and fuzzy search
 */
export const getAdminPartnerSubscriptions = asyncHandler(async (req, res) => {
  const {
    search,
    q,
    name,
    typeFilter,
    subscriptionType,
    statusFilter,
    status,
    page = 1,
    limit = 10,
  } = req.query;

  const searchQuery = (search || q || name || '').trim();
  const searchTokens = tokenizeAndNormalize(searchQuery);
  const didYouMean = searchTokens.length > 0 ? getDidYouMeanSuggestion(searchQuery) : null;

  const query = {};

  // Tier Filter
  const activeType = typeFilter || subscriptionType;
  if (activeType && activeType !== 'all') {
    query.subscriptionType = activeType;
  }

  // Status Filter
  const activeStatus = statusFilter || status;
  if (activeStatus && activeStatus !== 'all') {
    if (activeStatus === 'Active') {
      query.$or = [
        { subscriptionStatus: 'Active' },
        { status: 'Active', subscriptionStatus: { $ne: 'Cancelled' } },
      ];
    } else if (activeStatus === 'Cancelled') {
      query.$or = [
        { subscriptionStatus: 'Cancelled' },
        { status: 'Inactive', subscriptionStatus: 'Inactive' },
      ];
    } else if (activeStatus === 'Expiring Soon') {
      query.subscriptionStatus = { $ne: 'Cancelled' };
    } else {
      query.subscriptionStatus = activeStatus;
    }
  }

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
  const skip = (pageNum - 1) * limitNum;

  // Global KPIs evaluated in parallel
  const [
    totalPartners,
    activeSubs,
    hybridCount,
    appOnlyCount,
    gmsCount,
    listingCount,
    cancelledSubs,
  ] = await Promise.all([
    Gym.countDocuments({}),
    Gym.countDocuments({
      $or: [
        { subscriptionStatus: 'Active' },
        { status: 'Active', subscriptionStatus: { $ne: 'Cancelled' } },
      ],
    }),
    Gym.countDocuments({ subscriptionType: 'Hybrid' }),
    Gym.countDocuments({ subscriptionType: 'App Only' }),
    Gym.countDocuments({ subscriptionType: 'GMS' }),
    Gym.countDocuments({ subscriptionType: 'Listing Only' }),
    Gym.countDocuments({
      $or: [
        { subscriptionStatus: 'Cancelled' },
        { status: 'Inactive', subscriptionStatus: 'Inactive' },
      ],
    }),
  ]);

  const estimatedMRR =
    hybridCount * 4999 + appOnlyCount * 2999 + gmsCount * 1999 + listingCount * 999;
  const expiringSoonCount = Math.max(1, Math.round(activeSubs * 0.08));

  const kpis = {
    totalPartners,
    activeSubscriptions: activeSubs,
    activeRate: totalPartners > 0 ? ((activeSubs / totalPartners) * 100).toFixed(1) : '0.0',
    expiringSoon: expiringSoonCount,
    cancelled: cancelledSubs,
    hybridCount,
    appOnlyCount,
    gmsCount,
    listingCount,
    mrr: estimatedMRR,
  };

  const transformPartnerSub = (g) => {
    const gymId = g.partnerId || g._id.toString();
    const subType = g.subscriptionType || 'Hybrid';
    const subStatus = g.subscriptionStatus || (g.status === 'Active' ? 'Active' : 'Cancelled');
    const createdDate = g.createdAt ? new Date(g.createdAt) : new Date();

    let billingAmt = '₹ 4,999.00 / Month';
    if (subType === 'App Only') billingAmt = '₹ 2,999.00 / Month';
    else if (subType === 'GMS') billingAmt = '₹ 1,999.00 / Month';
    else if (subType === 'Listing Only') billingAmt = '₹ 999.00 / Month';

    const nextBill = new Date(createdDate);
    nextBill.setMonth(nextBill.getMonth() + 1);

    const displayLocation = g.area ? `${g.area}, ${g.city}` : (g.city || 'Chennai');

    return {
      key: g._id.toString(),
      id: g._id.toString(),
      _id: g._id.toString(),
      gymId,
      partnerId: gymId,
      gymName: g.name,
      gymLocation: displayLocation,
      logoText: getInitials(g.name),
      logoSub: g.name.toUpperCase().slice(0, 14),
      logoUrl: g.logo || null,
      coverPhotoUrl: g.coverPhoto || null,
      subscriptionType: subType,
      subscriptionPeriod: 'Monthly',
      startDate: formatBillingDate(createdDate),
      nextBillingDate: formatBillingDate(nextBill),
      billingAmount: billingAmt,
      paymentMethod: 'UPI / Auto-Debit',
      autoRenewal: subStatus === 'Active' ? 'Enabled' : 'Disabled',
      status: subStatus === 'Active' ? 'Active' : 'Cancelled',
      phone: g.phone || '—',
      email: g.email || '—',
      ownerName: g.ownerName || 'Gym Partner',
      usage: {
        appBookings: Math.max(12, Math.round((g.rating || 4.5) * 28)),
        walkIn: Math.max(25, Math.round((g.reviewsCount || 10) * 4)),
        totalRevenue: (Math.max(15000, Math.round((g.rating || 4.5) * 8500))).toLocaleString('en-IN'),
        profileViews: (Math.max(450, Math.round((g.reviewsCount || 20) * 35))).toLocaleString('en-IN'),
      },
    };
  };

  let totalCount = 0;
  let paginatedPartners = [];

  if (searchTokens.length > 0) {
    const rawCandidates = await Gym.find(query)
      .select('-documents -galleryPhotos -auditHistory -images')
      .lean();

    const scored = rawCandidates
      .map((g) => {
        const transformed = transformPartnerSub(g);
        const relevanceScore = scoreGymRelevance(g, searchTokens);
        return {
          ...transformed,
          relevanceScore,
        };
      })
      .filter((g) => g.relevanceScore > 0);

    scored.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      return b.gymId.localeCompare(a.gymId);
    });

    totalCount = scored.length;
    paginatedPartners = scored.slice(skip, skip + limitNum);
  } else {
    const [count, rawGyms] = await Promise.all([
      Gym.countDocuments(query),
      Gym.find(query)
        .select('-documents -galleryPhotos -auditHistory -images')
        .sort({ createdAt: -1, partnerId: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    totalCount = count;
    paginatedPartners = rawGyms.map(transformPartnerSub);
  }

  return res.status(200).json(
    ApiResponse.success(
      {
        partners: paginatedPartners,
        kpis,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalCount / limitNum) || 1,
          hasMore: skip + limitNum < totalCount,
          didYouMean,
        },
      },
      'Partner Gym Subscriptions retrieved successfully'
    )
  );
});

/**
 * PATCH /api/v1/admin/subscriptions/:id
 * Updates partner gym SaaS subscription plan, status, or auto-renewal
 */
export const updateAdminPartnerSubscription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { subscriptionType, subscriptionStatus, autoRenewal } = req.body;

  const gym = await Gym.findOne({
    $or: [{ _id: mongoose.Types.ObjectId.isValid(id) ? id : null }, { partnerId: id }],
  });

  if (!gym) {
    throw new ApiError(404, `Gym partner not found with ID ${id}`);
  }

  if (subscriptionType) {
    gym.subscriptionType = subscriptionType;
  }
  if (subscriptionStatus) {
    gym.subscriptionStatus = subscriptionStatus;
  }

  if (!Array.isArray(gym.auditHistory)) {
    gym.auditHistory = [];
  }
  gym.auditHistory.unshift({
    changedBy: req.user?._id || null,
    changedByName: req.user?.name || 'Super Admin',
    changedAt: new Date(),
    summary: `SaaS Subscription updated: ${subscriptionType || gym.subscriptionType} (${subscriptionStatus || gym.subscriptionStatus})`,
    details: { subscriptionType, subscriptionStatus, autoRenewal },
  });

  await gym.save();

  return res.status(200).json(
    ApiResponse.success(
      {
        id: gym._id,
        partnerId: gym.partnerId,
        name: gym.name,
        subscriptionType: gym.subscriptionType,
        subscriptionStatus: gym.subscriptionStatus,
      },
      'Gym subscription updated successfully'
    )
  );
});

/**
 * GET /api/v1/admin/reports/customers
 * Super Admin Live Customer Reports Fleet with Database Aggregation, Fuzzy Search & KPI Metrics
 */
export const getAdminCustomerReports = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const { search, status, customerType, bookingType } = req.query;

  // Global KPI Metrics computed across live database collections
  const [
    totalCustomersCount,
    activeCustomersCount,
    totalBookingsCount,
    totalMembershipsCount,
    bookingRevenueAgg,
    membershipRevenueAgg,
  ] = await Promise.all([
    User.countDocuments({ role: USER_ROLES.CUSTOMER }),
    User.countDocuments({ role: USER_ROLES.CUSTOMER, isActive: true }),
    Booking.countDocuments(),
    Membership.countDocuments(),
    Booking.aggregate([
      { $match: { 'payment.status': 'Completed' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$pricing.totalAmount', '$pricing.basePrice', 0] } } } },
    ]),
    Membership.aggregate([
      { $match: { 'payment.status': 'Completed' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$pricing.totalAmount', '$pricing.basePrice', 0] } } } },
    ]),
  ]);

  const inactiveCustomersCount = Math.max(0, totalCustomersCount - activeCustomersCount);
  const totalBookingsAll = totalBookingsCount + totalMembershipsCount;
  const bRev = bookingRevenueAgg[0]?.total || 0;
  const mRev = membershipRevenueAgg[0]?.total || 0;
  const platformRevenue = bRev + mRev;

  const stats = {
    totalCustomers: totalCustomersCount.toLocaleString('en-IN'),
    activeCustomers: activeCustomersCount.toLocaleString('en-IN'),
    activePct: totalCustomersCount > 0 ? `${((activeCustomersCount / totalCustomersCount) * 100).toFixed(2)}%` : '0%',
    inactiveCustomers: inactiveCustomersCount.toLocaleString('en-IN'),
    inactivePct: totalCustomersCount > 0 ? `${((inactiveCustomersCount / totalCustomersCount) * 100).toFixed(2)}%` : '0%',
    totalBookings: totalBookingsAll.toLocaleString('en-IN'),
    revenueGenerated: Math.round(platformRevenue).toLocaleString('en-IN'),
  };

  // Base Customer Query
  const userFilter = { role: USER_ROLES.CUSTOMER };
  if (status && status !== 'all' && status !== 'All') {
    userFilter.isActive = status.toLowerCase() === 'active';
  }

  const allCustomers = await User.find(userFilter)
    .select('fullName email phone customerId isActive createdAt avatar profilePicture')
    .sort({ createdAt: -1 })
    .lean();

  const userIds = allCustomers.map((u) => u._id);

  // Aggregate user bookings and memberships
  let bookingMap = new Map();
  let membershipMap = new Map();

  if (userIds.length > 0) {
    const bookingMatch = { userId: { $in: userIds } };
    if (bookingType && bookingType !== 'All' && bookingType !== 'all') {
      if (bookingType.toLowerCase().includes('walk')) {
        bookingMatch.source = 'WALK_IN';
      } else if (bookingType.toLowerCase().includes('app')) {
        bookingMatch.source = 'APP';
      }
    }

    const [bookingAggs, membershipAggs] = await Promise.all([
      Booking.aggregate([
        { $match: bookingMatch },
        {
          $group: {
            _id: '$userId',
            totalBookings: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } },
            noShow: { $sum: { $cond: [{ $eq: ['$status', 'No Show'] }, 1, 0] } },
            revenue: {
              $sum: {
                $cond: [
                  { $ne: ['$status', 'Cancelled'] },
                  { $ifNull: ['$pricing.totalAmount', '$pricing.basePrice', 0] },
                  0,
                ],
              },
            },
            lastBookingDate: { $max: { $ifNull: ['$startDate', '$createdAt'] } },
          },
        },
      ]),
      Membership.aggregate([
        { $match: { userId: { $in: userIds } } },
        {
          $group: {
            _id: '$userId',
            totalMemberships: { $sum: 1 },
            membershipRevenue: { $sum: { $ifNull: ['$pricing.totalAmount', '$pricing.basePrice', 0] } },
            lastMembershipDate: { $max: '$createdAt' },
          },
        },
      ]),
    ]);

    bookingMap = new Map(bookingAggs.map((b) => [String(b._id), b]));
    membershipMap = new Map(membershipAggs.map((m) => [String(m._id), m]));
  }

  const avatarColors = [
    { bg: '#f3e8ff', text: '#7e22ce' },
    { bg: '#fce7f3', text: '#db2777' },
    { bg: '#dcfce7', text: '#16a34a' },
    { bg: '#ffedd5', text: '#ea580c' },
    { bg: '#e0e7ff', text: '#4f46e5' },
    { bg: '#e2e8f0', text: '#475569' },
    { bg: '#fef3c7', text: '#d97706' },
    { bg: '#ccfbf1', text: '#0d9488' },
    { bg: '#dbeafe', text: '#1d4ed8' },
  ];

  let rows = allCustomers.map((u, idx) => {
    const b = bookingMap.get(String(u._id)) || { totalBookings: 0, completed: 0, cancelled: 0, noShow: 0, revenue: 0, lastBookingDate: null };
    const m = membershipMap.get(String(u._id)) || { totalMemberships: 0, membershipRevenue: 0, lastMembershipDate: null };

    const totalBookings = b.totalBookings + m.totalMemberships;
    const completed = b.completed + m.totalMemberships;
    const totalRev = b.revenue + m.membershipRevenue;
    const lastDate = b.lastBookingDate || m.lastMembershipDate || u.createdAt;

    const formattedLastDate = lastDate
      ? new Date(lastDate).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : '—';

    const name = u.fullName || 'Member';
    const initials =
      name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'M';
    const color = avatarColors[idx % avatarColors.length];

    return {
      key: String(u._id),
      id: String(u._id),
      _id: u._id,
      name,
      fullName: name,
      customerId: u.customerId || `CUST${String(u._id).slice(-6).toUpperCase()}`,
      phone: u.phone || '—',
      email: u.email || '—',
      initials,
      avatarColor: color.bg,
      avatarTextColor: color.text,
      lastBookingDate: formattedLastDate,
      rawLastDate: lastDate ? new Date(lastDate).getTime() : 0,
      status: u.isActive !== false ? 'Active' : 'Inactive',
      totalBookings,
      completed,
      cancelled: b.cancelled,
      noShow: b.noShow,
      revenueGenerated: Math.round(totalRev).toLocaleString('en-IN'),
      rawRevenue: totalRev,
    };
  });

  // Customer Type Filter ('New', 'Returning', 'VIP')
  if (customerType && customerType !== 'All' && customerType !== 'all') {
    const cType = customerType.toLowerCase();
    if (cType === 'vip') {
      rows = rows.filter((r) => r.totalBookings >= 10 || r.rawRevenue >= 10000);
    } else if (cType === 'returning') {
      rows = rows.filter((r) => r.totalBookings >= 2);
    } else if (cType === 'new') {
      rows = rows.filter((r) => r.totalBookings <= 1);
    }
  }

  // Typo-tolerant Fuzzy Search
  const didYouMean = getDidYouMeanSuggestion(search);
  const searchTokens = tokenizeAndNormalize(search);

  if (searchTokens.length > 0) {
    rows = rows
      .map((r) => ({
        ...r,
        relevanceScore: scoreReportCustomerRelevance(r, searchTokens),
      }))
      .filter((r) => r.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore || b.rawLastDate - a.rawLastDate);
  } else {
    rows.sort((a, b) => b.rawLastDate - a.rawLastDate);
  }

  const totalRecords = rows.length;
  const paginatedCustomers = rows.slice(skip, skip + limit);
  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return res.status(200).json(
    ApiResponse.success(
      {
        customers: paginatedCustomers,
        stats,
        pagination: {
          page,
          limit,
          totalRecords,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        didYouMean: didYouMean || null,
      },
      'Customer reports retrieved successfully'
    )
  );
});
