import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { Membership, MEMBERSHIP_TIERS } from '../models/membership.model.js';
import { MembershipSwitchRequest } from '../models/membershipSwitchRequest.model.js';
import { Wallet } from '../models/wallet.model.js';
import Gym from '../models/gym.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import Counter from '../models/counter.model.js';
import { ProrationEngine } from '../services/proration.service.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';

const TIER_DURATION_DAYS = {
  Monthly: 30,
  Quarterly: 90,
  'Half Yearly': 180,
  Annual: 365,
};

const TIER_PRICE_KEYS = {
  Monthly: 'monthly',
  Quarterly: 'quarterly',
  'Half Yearly': 'halfYearly',
  Annual: 'annual',
};

/**
 * Helper to calculate base gym price for a given tier
 */
const getGymBasePrice = (gym, tier) => {
  const priceKey = TIER_PRICE_KEYS[tier];
  if (gym?.pricingPlans && typeof gym.pricingPlans[priceKey] === 'number' && gym.pricingPlans[priceKey] > 0) {
    return Number(gym.pricingPlans[priceKey]);
  }
  return 0;
};

/**
 * Helper to calculate trainer fee for a given tier (0 means not available)
 */
const getTrainerTierFee = (trainer, tier) => {
  if (!trainer) return 0;
  const priceKey = TIER_PRICE_KEYS[tier];
  const tierFee = trainer.trainerPricing?.[priceKey];
  if (typeof tierFee === 'number' && tierFee > 0) {
    return tierFee;
  }
  return 0;
};

/**
 * Generate sequential membership ID formatted as MEM00{counter} scoped to the gym
 */
const generateGymMembershipId = async (gym) => {
  const gymSeqKey = `mem_${gym.partnerId || gym._id}`;
  const seq = await Counter.getNextSequence(gymSeqKey);
  return `MEM00${seq}`;
};

/**
 * Purchase/Create Membership
 * POST /api/v1/memberships
 */
export const createMembership = async (req, res, next) => {
  try {
    const {
      gymId,
      membershipTier,
      startDate,
      trainerId,
      trainerSlot,
      paymentMethod = 'UPI',
      transactionId,
    } = req.body;

    // 1. Validate required fields
    if (!gymId) {
      throw ApiError.badRequest('Gym ID is required.');
    }
    if (!membershipTier || !MEMBERSHIP_TIERS.includes(membershipTier)) {
      throw ApiError.badRequest(`Invalid membership tier. Allowed values: ${MEMBERSHIP_TIERS.join(', ')}.`);
    }
    if (!startDate) {
      throw ApiError.badRequest('Start date is required.');
    }

    // 2. Resolve User ID (from JWT authenticated user or request)
    const rawUserId = req.user?.userId || req.user?.id || req.body.userId;
    let resolvedUserId = null;

    if (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId)) {
      resolvedUserId = rawUserId;
    } else {
      const foundUser = await User.findOne({
        $or: [
          { email: req.user?.email || req.body.email || '' },
          { phone: req.user?.phone || req.body.phone || '' },
        ],
      });
      if (foundUser) {
        resolvedUserId = foundUser._id;
      } else {
        const anyUser = await User.findOne();
        resolvedUserId = anyUser ? anyUser._id : new mongoose.Types.ObjectId();
      }
    }

    if (resolvedUserId && mongoose.Types.ObjectId.isValid(resolvedUserId)) {
      const userDoc = await User.findById(resolvedUserId);
      if (userDoc && !userDoc.customerId) {
        userDoc.customerId = await User.generateCustomerId();
        await userDoc.save();
      }
    }

    // 3. Validate Gym
    const isObjectId = mongoose.Types.ObjectId.isValid(gymId);
    const gym = await Gym.findOne(
      isObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
    );
    if (!gym) {
      throw ApiError.notFound('Gym not found.');
    }

    // 4. Validate Trainer (if selected)
    let trainer = null;
    let trainerFee = 0;
    if (trainerId && trainerId !== 'No Personal Trainer') {
      const isTrainerObjectId = mongoose.Types.ObjectId.isValid(trainerId);
      trainer = await Employee.findOne(
        isTrainerObjectId
          ? { $or: [{ _id: trainerId }, { employeeId: trainerId }] }
          : { employeeId: trainerId }
      );
      if (!trainer) {
        throw ApiError.badRequest('Selected personal trainer does not exist.');
      }
      if (trainer.status !== 'Active') {
        throw ApiError.badRequest('Selected trainer is currently inactive.');
      }

      // If the plan has restricted assigned trainers, ensure this trainer is allowed
      const matchingPlan = gym.customPricingPlans?.find(
        (p) => (p.tierId || '').toLowerCase() === membershipTier.toLowerCase()
      );
      if (matchingPlan && Array.isArray(matchingPlan.assignedTrainers) && matchingPlan.assignedTrainers.length > 0) {
        const allowedTrainerIds = matchingPlan.assignedTrainers.map((t) => String(t._id || t));
        if (!allowedTrainerIds.includes(String(trainer._id))) {
          throw ApiError.badRequest('Selected trainer is not assigned to this membership plan.');
        }
      }

      trainerFee = getTrainerTierFee(trainer, membershipTier);
      if (trainerFee <= 0) {
        throw ApiError.badRequest('Selected personal trainer is not available for this membership plan tier.');
      }
    }

    // 5. Calculate Pricing & Dates
    const durationDays = TIER_DURATION_DAYS[membershipTier] || 30;
    const basePrice = getGymBasePrice(gym, membershipTier);
    const totalAmount = basePrice + trainerFee;

    const parsedStart = new Date(startDate);
    if (Number.isNaN(parsedStart.getTime())) {
      throw ApiError.badRequest('Invalid start date format.');
    }
    parsedStart.setHours(0, 0, 0, 0);

    const parsedEnd = new Date(parsedStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // Contract Duration Safeguard for Temporary Trainers
    if (trainer && trainer.type === 'Temporary' && trainer.schedule?.endDate) {
      const contractEnd = new Date(trainer.schedule.endDate);
      contractEnd.setHours(23, 59, 59, 999);
      if (parsedEnd > contractEnd) {
        const contractEndFormatted = contractEnd.toISOString().split('T')[0];
        throw ApiError.badRequest(
          `Selected trainer is on a temporary contract ending on ${contractEndFormatted}. The ${durationDays}-day membership plan extends beyond their available period.`
        );
      }
    }

    const now = new Date();
    const status = parsedStart > now ? 'Upcoming' : 'Active';

    // 6. Generate sequential Membership ID
    const membershipId = await generateGymMembershipId(gym);

    const totalAmountPaise = Math.round(totalAmount * 100);
    const { applyWallet, useWallet, appliedWalletAmount } = req.body;
    const isWalletMethod = (paymentMethod || '').toLowerCase() === 'wallet';
    const isWalletRequested = Boolean(applyWallet || useWallet || isWalletMethod);

    let appliedWalletPaise = 0;
    let debitedWallet = null;

    // Gym-specific wallet payment & partial split debit handling
    if (isWalletRequested && totalAmountPaise > 0) {
      const userWallet = await Wallet.findOne({ userId: resolvedUserId, gymId: gym._id });
      const currentWalletBalancePaise = userWallet?.balancePaise || 0;

      if (isWalletMethod && currentWalletBalancePaise < totalAmountPaise) {
        const availINR = (currentWalletBalancePaise / 100).toFixed(2);
        throw ApiError.badRequest(
          `Insufficient wallet balance at ${gym.name} to cover full payment. Required: ₹${totalAmount}, Available: ₹${availINR}. Please select a secondary payment method for the remainder.`
        );
      }

      const requestedPaise = appliedWalletAmount !== undefined && appliedWalletAmount !== null
        ? Math.round(Number(appliedWalletAmount) * 100)
        : currentWalletBalancePaise;

      appliedWalletPaise = Math.min(currentWalletBalancePaise, totalAmountPaise, Math.max(0, requestedPaise));

      if (appliedWalletPaise > 0 && userWallet) {
        const newBalancePaise = userWallet.balancePaise - appliedWalletPaise;
        userWallet.balancePaise = newBalancePaise;
        const walletTxnId = `WAL_MEM_${Date.now()}_${crypto.randomInt(100, 999)}`;
        userWallet.history.push({
          transactionId: walletTxnId,
          type: 'DEBIT',
          source: 'MEMBERSHIP_PURCHASE',
          amountPaise: appliedWalletPaise,
          balanceAfterPaise: newBalancePaise,
          description: `Payment towards ${membershipTier} Membership at ${gym.name}${appliedWalletPaise < totalAmountPaise ? ' (Partial Wallet Split)' : ''}`,
          createdAt: new Date(),
        });
        await userWallet.save();
        debitedWallet = userWallet;
      }
    }

    // 7. Create Membership Record
    const membership = new Membership({
      membershipId,
      gymId: gym._id,
      gymPartnerId: gym.partnerId || '',
      userId: resolvedUserId,
      trainerId: trainer ? trainer._id : null,
      hasTrainer: Boolean(trainer),
      trainerSlot: trainer ? trainerSlot || 'General Slot' : null,
      membershipTier,
      durationDays,
      startDate: parsedStart,
      endDate: parsedEnd,
      pricing: {
        basePrice,
        trainerFee,
        totalAmount,
        currency: 'INR',
      },
      payment: {
        method: appliedWalletPaise >= totalAmountPaise ? 'Wallet' : (paymentMethod || 'UPI'),
        status: 'Completed',
        walletAmountApplied: appliedWalletPaise / 100,
        transactionId: transactionId || (debitedWallet ? debitedWallet.history[debitedWallet.history.length - 1].transactionId : `TXN${Date.now()}${Math.floor(100 + Math.random() * 900)}`),
        paidAt: new Date(),
      },
      status,
    });

    try {
      await membership.save();
    } catch (saveErr) {
      if (debitedWallet && appliedWalletPaise > 0) {
        debitedWallet.balancePaise += appliedWalletPaise;
        debitedWallet.history.pop();
        await debitedWallet.save();
      }
      throw saveErr;
    }

    const populatedMembership = await Membership.findById(membership._id)
      .populate('gymId', 'name partnerId address location images phone email')
      .populate('trainerId', 'name employeeId specialty profilePicture rating reviewsCount')
      .populate('userId', 'fullName email phone avatar profilePicture');

    return res.status(201).json(ApiResponse.created(populatedMembership, 'Membership purchased successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to extract primary logo/image for a gym document
 */
const resolveGymLogo = (gym) => {
  if (!gym) return null;
  if (typeof gym.logo === 'string' && gym.logo.trim()) return gym.logo.trim();
  if (gym.logo?.fileData && typeof gym.logo.fileData === 'string') return gym.logo.fileData.trim();
  if (gym.logoUrl && typeof gym.logoUrl === 'string') return gym.logoUrl.trim();
  if (gym.coverPhoto?.fileData && typeof gym.coverPhoto.fileData === 'string') return gym.coverPhoto.fileData.trim();
  if (gym.coverPhotoUrl && typeof gym.coverPhotoUrl === 'string') return gym.coverPhotoUrl.trim();
  if (gym.image && typeof gym.image === 'string') return gym.image.trim();
  if (Array.isArray(gym.images) && gym.images.length > 0) return gym.images[0];
  return null;
};

/**
 * Helper to resolve plan description from gym pricing plans
 */
const resolvePlanDescription = (gym, tier) => {
  if (!gym || !tier) return 'Enjoy unlimited access to all gym facilities during your membership period.';
  const tierClean = String(tier).toLowerCase().replace(/[^a-z0-9]/g, '');

  if (Array.isArray(gym.customPricingPlans) && gym.customPricingPlans.length > 0) {
    const customMatch = gym.customPricingPlans.find((p) => {
      const pTierId = String(p.tierId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const pName = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const pBadge = String(p.badge || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        pTierId === tierClean ||
        pName.includes(tierClean) ||
        tierClean.includes(pTierId) ||
        pBadge === tierClean
      );
    });
    if (customMatch?.description && customMatch.description.trim()) {
      return customMatch.description.trim();
    }
  }

  if (gym.pricingPlans) {
    const directMatch = gym.pricingPlans[tierClean] || gym.pricingPlans[tier];
    if (typeof directMatch === 'object' && directMatch?.description) {
      return directMatch.description.trim();
    }
  }

  return 'Enjoy unlimited access to all gym facilities during your membership period.';
};

/**
 * Get Memberships for Logged-In User
 * GET /api/v1/memberships/my
 */
export const getMyMemberships = async (req, res, next) => {
  try {
    const rawUserId = req.user?.userId || req.user?.id || req.user?._id || req.query?.userId;
    if (!rawUserId) {
      return res.status(200).json(ApiResponse.success([], 'My memberships retrieved successfully.'));
    }

    const filter = mongoose.Types.ObjectId.isValid(rawUserId)
      ? { userId: new mongoose.Types.ObjectId(rawUserId) }
      : { userId: rawUserId };

    const memberships = await Membership.find(filter)
      .populate('gymId', 'name partnerId address location logo coverPhoto image images phone email pricingPlans customPricingPlans')
      .populate('trainerId', 'name employeeId specialty profilePicture rating reviewsCount')
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(8000);

    const membershipIds = (memberships || []).map((m) => m._id);
    const pendingReviews = await MembershipSwitchRequest.find({
      membershipId: { $in: membershipIds },
      status: { $in: ['PENDING_GYM_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL'] },
    })
      .select('membershipId')
      .lean();

    const pendingMembershipIdSet = new Set(
      pendingReviews
        .filter((r) => r.membershipId)
        .map((r) => r.membershipId.toString())
    );

    const now = new Date();
    const formattedMemberships = (memberships || []).map((m) => {
      const logoUrl = resolveGymLogo(m.gymId);
      const planDesc = resolvePlanDescription(m.gymId, m.membershipTier);
      const isNonStandardStatus = ['Cancelled', 'Switched', 'PendingDowngrade', 'Terminated', 'Completed'].includes(m.status);
      const isFuture = m.startDate && new Date(m.startDate) > now;
      const isPast = m.endDate && new Date(m.endDate) < now;
      const isUnderReview = pendingMembershipIdSet.has(m._id?.toString());

      let currentStatus = m.status;
      if (!isNonStandardStatus) {
        if (isFuture) {
          currentStatus = 'Upcoming';
        } else if (isPast) {
          currentStatus = 'Expired';
        } else {
          currentStatus = 'Active';
        }
      }

      const isStrictlyActive = currentStatus === 'Active' && !isFuture && !isPast && !isUnderReview;

      let otp = null;
      if (isStrictlyActive) {
        otp = m.entryOtp;
        if (!otp && m._id) {
          otp = crypto.randomInt(100000, 1000000).toString();
          Membership.updateOne({ _id: m._id }, { status: 'Active', entryOtp: otp }).catch(() => {});
        } else if (m.status !== 'Active' && m._id) {
          Membership.updateOne({ _id: m._id }, { status: 'Active' }).catch(() => {});
        }
      } else if (m.entryOtp && m._id) {
        Membership.updateOne({ _id: m._id }, { status: currentStatus, entryOtp: null }).catch(() => {});
      } else if (m.status !== currentStatus && m._id && !isNonStandardStatus) {
        Membership.updateOne({ _id: m._id }, { status: currentStatus }).catch(() => {});
      }

      return {
        ...m,
        status: currentStatus,
        isUnderReview,
        entryOtp: isUnderReview ? null : otp,
        gymLogo: logoUrl,
        gymImageUrl: logoUrl || (m.gymId?.images?.[0] || null),
        planDescription: planDesc,
      };
    });

    return res.status(200).json(ApiResponse.success(formattedMemberships, 'My memberships retrieved successfully.'));
  } catch (error) {
    console.warn('[GET MY MEMBERSHIPS ERROR]:', error.message);
    return res.status(200).json(ApiResponse.success([], 'My memberships retrieved successfully.'));
  }
};

/**
 * Get Single Membership Details
 * GET /api/v1/memberships/:id
 */
export const getMembershipById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isObjectId = mongoose.Types.ObjectId.isValid(id);

    const query = isObjectId ? { $or: [{ _id: id }, { membershipId: id }] } : { membershipId: id };
    const membership = await Membership.findOne(query)
      .populate('gymId', 'name partnerId address location logo coverPhoto image images phone email pricingPlans customPricingPlans')
      .populate('trainerId', 'name employeeId specialty profilePicture rating reviewsCount')
      .populate('userId', 'fullName email phone avatar profilePicture customerProfile')
      .lean();

    if (!membership) {
      throw ApiError.notFound('Membership not found.');
    }

    const pendingReview = await MembershipSwitchRequest.findOne({
      membershipId: membership._id,
      status: { $in: ['PENDING_GYM_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL'] },
    }).lean();

    const isUnderReview = Boolean(pendingReview);

    const now = new Date();
    const isNonStandardStatus = ['Cancelled', 'Switched', 'PendingDowngrade', 'Terminated', 'Completed'].includes(membership.status);
    const isFuture = membership.startDate && new Date(membership.startDate) > now;
    const isPast = membership.endDate && new Date(membership.endDate) < now;

    let currentStatus = membership.status;
    if (!isNonStandardStatus) {
      if (isFuture) {
        currentStatus = 'Upcoming';
      } else if (isPast) {
        currentStatus = 'Expired';
      } else {
        currentStatus = 'Active';
      }
    }

    const isStrictlyActive = currentStatus === 'Active' && !isFuture && !isPast && !isUnderReview;

    let otp = null;
    if (isStrictlyActive) {
      otp = membership.entryOtp;
      if (!otp && membership._id) {
        otp = crypto.randomInt(100000, 1000000).toString();
        Membership.updateOne({ _id: membership._id }, { status: 'Active', entryOtp: otp }).catch(() => {});
      } else if (membership.status !== 'Active' && membership._id) {
        Membership.updateOne({ _id: membership._id }, { status: 'Active' }).catch(() => {});
      }
    } else if (membership.entryOtp && membership._id) {
      Membership.updateOne({ _id: membership._id }, { status: currentStatus, entryOtp: null }).catch(() => {});
    } else if (membership.status !== currentStatus && membership._id && !isNonStandardStatus) {
      Membership.updateOne({ _id: membership._id }, { status: currentStatus }).catch(() => {});
    }

    const logoUrl = resolveGymLogo(membership.gymId);
    const planDesc = resolvePlanDescription(membership.gymId, membership.membershipTier);
    const formatted = {
      ...membership,
      status: currentStatus,
      isUnderReview,
      entryOtp: isUnderReview ? null : otp,
      gymLogo: logoUrl,
      gymImageUrl: logoUrl || (membership.gymId?.images?.[0] || null),
      planDescription: planDesc,
    };

    return res.status(200).json(ApiResponse.success(formatted, 'Membership details retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Memberships for a Gym (Gym Owner Portal & Gym Owner Mobile App)
 * GET /api/v1/memberships/gym/:gymId
 */
export const getGymMemberships = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    const { status, tier, search, startDate, endDate, page = 1, limit = 50 } = req.query;

    const isObjectId = mongoose.Types.ObjectId.isValid(gymId);
    const gym = await Gym.findOne(
      isObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
    );

    if (!gym) {
      throw ApiError.notFound('Gym not found.');
    }

    // Build filter
    const filter = { gymId: gym._id };
    if (status && status !== 'All' && status !== 'ALL') {
      filter.status = status;
    }
    if (tier && tier !== 'All' && tier !== 'ALL') {
      filter.membershipTier = tier;
    }
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingUsers = await User.find({
        $or: [
          { fullName: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
        ],
      }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { membershipId: searchRegex },
        { userId: { $in: userIds } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Membership.countDocuments(filter);

    const memberships = await Membership.find(filter)
      .populate('userId', 'fullName email phone avatar profilePicture')
      .populate('trainerId', 'name employeeId specialty profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalMembers, activeMembers, expiringThisMonth, expiredMembers] = await Promise.all([
      Membership.countDocuments({ gymId: gym._id }),
      Membership.countDocuments({ gymId: gym._id, status: 'Active' }),
      Membership.countDocuments({
        gymId: gym._id,
        $or: [
          { status: 'Expiring Soon' },
          {
            status: 'Active',
            endDate: { $gte: now, $lte: in30Days },
          },
        ],
      }),
      Membership.countDocuments({ gymId: gym._id, status: 'Expired' }),
    ]);

    return res.status(200).json(ApiResponse.success({
      memberships,
      total,
      summary: {
        total: totalMembers,
        active: activeMembers,
        expiringSoon: expiringThisMonth,
        expired: expiredMembers,
      },
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    }, 'Gym memberships retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin: Get All Gym Memberships Across Entire Platform
 * GET /api/v1/admin/memberships
 */
export const getAdminAllGymMemberships = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      gymId = 'All',
      status = 'All',
      tier = 'All',
      type = 'all',
    } = req.query;

    const filter = {};

    // 1. Gym Filter
    if (gymId && gymId !== 'All' && gymId !== 'ALL') {
      if (mongoose.Types.ObjectId.isValid(gymId)) {
        filter.gymId = new mongoose.Types.ObjectId(gymId);
      } else {
        const foundGym = await Gym.findOne({ partnerId: gymId });
        if (foundGym) filter.gymId = foundGym._id;
      }
    }

    // 2. Status Filter
    if (status && status !== 'All' && status !== 'ALL') {
      filter.status = status;
    }

    // 3. Tier Filter
    if (tier && tier !== 'All' && tier !== 'ALL') {
      filter.membershipTier = tier;
    }

    // 4. Booking Type / Source
    if (type && type !== 'all') {
      if (type === 'app') {
        filter.$or = [{ purchaseType: 'APP' }, { purchaseType: { $exists: false } }, { isWalkIn: false }];
      } else if (type === 'walkin') {
        filter.$or = [{ purchaseType: 'WALK_IN' }, { isWalkIn: true }];
      }
    }

    // 5. Search across User (Name, Phone, Email), Gym Name, and Membership ID
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');

      const [matchingUsers, matchingGyms] = await Promise.all([
        User.find({
          $or: [
            { fullName: searchRegex },
            { phone: searchRegex },
            { email: searchRegex },
          ],
        }).select('_id'),
        Gym.find({
          $or: [
            { name: searchRegex },
            { partnerId: searchRegex },
            { 'address.city': searchRegex },
          ],
        }).select('_id'),
      ]);

      const userIds = matchingUsers.map((u) => u._id);
      const gymIds = matchingGyms.map((g) => g._id);

      filter.$or = [
        { membershipId: searchRegex },
        { userId: { $in: userIds } },
        { gymId: { $in: gymIds } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Membership.countDocuments(filter);

    const memberships = await Membership.find(filter)
      .populate('userId', 'fullName email phone avatar profilePicture')
      .populate('gymId', 'name partnerId address location logo phone email')
      .populate('trainerId', 'name employeeId specialty profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [totalCount, activeCount, expiringSoonCount, expiredCount, switchedCount, cancelledCount] = await Promise.all([
      Membership.countDocuments(),
      Membership.countDocuments({ status: 'Active' }),
      Membership.countDocuments({
        $or: [
          { status: 'Expiring Soon' },
          { status: 'Active', endDate: { $gte: now, $lte: in30Days } },
        ],
      }),
      Membership.countDocuments({ status: 'Expired' }),
      Membership.countDocuments({ status: 'Switched' }),
      Membership.countDocuments({ status: 'Cancelled' }),
    ]);

    return res.status(200).json(
      ApiResponse.success(
        {
          memberships,
          total,
          summary: {
            total: totalCount,
            active: activeCount,
            expiringSoon: expiringSoonCount,
            expired: expiredCount,
            switched: switchedCount,
            cancelled: cancelledCount,
          },
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)) || 1,
        },
        'All gym memberships retrieved successfully for Super Admin.'
      )
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel Membership
 * PATCH /api/v1/memberships/:id/cancel
 */
export const cancelMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason = 'Cancelled by member' } = req.body;

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ _id: id }, { membershipId: id }] } : { membershipId: id };

    const membership = await Membership.findOne(query);
    if (!membership) {
      throw ApiError.notFound('Membership not found.');
    }

    if (membership.status === 'Cancelled') {
      throw ApiError.badRequest('Membership is already cancelled.');
    }

    membership.status = 'Cancelled';
    membership.cancellation = {
      cancelledAt: new Date(),
      reason,
    };

    await membership.save();

    return res.status(200).json(ApiResponse.success(membership, 'Membership cancelled successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Helper to resolve target plan details from gym
 */
const resolveTargetPlanDetails = (gym, targetTier, targetPlanId) => {
  const tierClean = String(targetTier || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (Array.isArray(gym?.customPricingPlans) && gym.customPricingPlans.length > 0) {
    const match = gym.customPricingPlans.find((p) => {
      const pId = String(p.id || '').toLowerCase();
      const pTierId = String(p.tierId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const pName = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        (targetPlanId && pId === String(targetPlanId).toLowerCase()) ||
        pTierId === tierClean ||
        pName.includes(tierClean)
      );
    });
    if (match) {
      return {
        tierId: match.tierId || targetTier,
        name: match.name,
        price: match.price,
        durationDays: match.durationDays || (match.months ? match.months * 30 : 30),
      };
    }
  }

  const defaultPrice = getGymBasePrice(gym, targetTier);
  if (!defaultPrice || defaultPrice <= 0) {
    throw ApiError.badRequest(
      `Pricing for ${targetTier} plan is not configured for this gym. Please contact gym support.`
    );
  }
  const defaultDuration = TIER_DURATION_DAYS[targetTier] || 30;
  return {
    tierId: targetTier,
    name: `${targetTier} Plan`,
    price: defaultPrice,
    durationDays: defaultDuration,
  };
};

/**
 * Preview Plan Switch (Prorated Quote Dry-Run)
 * POST /api/v1/memberships/:id/preview-switch
 */
export const previewSwitchPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      targetTier,
      targetPlanId,
      downgradeSettlementPreference = 'WALLET',
      useWalletBalance = true,
    } = req.body;

    if (!targetTier) {
      throw ApiError.badRequest('Target plan tier is required.');
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ _id: id }, { membershipId: id }] } : { membershipId: id };

    const membership = await Membership.findOne(query)
      .populate('gymId')
      .populate('userId');

    if (!membership) {
      throw ApiError.notFound('Membership not found.');
    }
    if (membership.status !== 'Active') {
      throw ApiError.badRequest(`Cannot switch plan. Current membership status is '${membership.status}'.`);
    }

    const gym = membership.gymId;
    if (!gym) {
      throw ApiError.notFound('Associated gym not found.');
    }

    const currentTierClean = String(membership.membershipTier).toLowerCase().replace(/[^a-z0-9]/g, '');
    const targetTierClean = String(targetTier).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (currentTierClean === targetTierClean) {
      throw ApiError.badRequest('Cannot switch to the same plan tier. Use renewal flow instead.');
    }

    const targetPlan = resolveTargetPlanDetails(gym, targetTier, targetPlanId);

    let walletBalancePaise = 0;
    if (useWalletBalance && membership.userId) {
      const userWallet = await Wallet.findOne({
        userId: membership.userId._id || membership.userId,
        gymId: gym._id,
      });
      walletBalancePaise = userWallet?.balancePaise || 0;
    }

    const gymSettings = {
      ...(gym.prorationSettings ? (typeof gym.prorationSettings.toObject === 'function' ? gym.prorationSettings.toObject() : gym.prorationSettings) : {}),
      pricingPlans: gym.pricingPlans,
    };

    const quote = ProrationEngine.calculateSwitchQuote({
      currentMembership: membership,
      newPlan: targetPlan,
      gymSettings,
      userWalletBalancePaise: walletBalancePaise,
      downgradeSettlementPreference,
      switchDate: new Date(),
    });

    return res.status(200).json(ApiResponse.success(quote, 'Proration quote calculated successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Submit Plan Switch Request (User Action -> PENDING_GYM_APPROVAL)
 * POST /api/v1/memberships/:id/request-switch
 */
export const requestSwitchPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      targetTier,
      targetPlanId,
      downgradeSettlementPreference = 'WALLET',
      paymentMethod = 'UPI',
      transactionId = '',
      useWalletBalance = true,
    } = req.body;

    if (!targetTier) {
      throw ApiError.badRequest('Target plan tier is required.');
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(id);
    const query = isObjectId ? { $or: [{ _id: id }, { membershipId: id }] } : { membershipId: id };

    const membership = await Membership.findOne(query)
      .populate('gymId')
      .populate('userId');

    if (!membership) {
      throw ApiError.notFound('Membership not found.');
    }
    if (membership.status !== 'Active') {
      throw ApiError.badRequest(`Cannot switch plan. Current membership status is '${membership.status}'.`);
    }

    const existingPending = await MembershipSwitchRequest.findOne({
      membershipId: membership._id,
      status: { $in: ['PENDING_GYM_APPROVAL', 'PENDING_SUPER_ADMIN_APPROVAL'] },
    });
    if (existingPending) {
      throw ApiError.badRequest(
        `A plan switch request (${existingPending.requestId}) is already in review for this membership.`
      );
    }

    const gym = membership.gymId;
    const targetPlan = resolveTargetPlanDetails(gym, targetTier, targetPlanId);

    let walletBalancePaise = 0;
    if (useWalletBalance && membership.userId) {
      const userWallet = await Wallet.findOne({
        userId: membership.userId._id || membership.userId,
        gymId: gym._id,
      });
      walletBalancePaise = userWallet?.balancePaise || 0;
    }

    const gymSettings = {
      ...(gym.prorationSettings ? (typeof gym.prorationSettings.toObject === 'function' ? gym.prorationSettings.toObject() : gym.prorationSettings) : {}),
      pricingPlans: gym.pricingPlans,
    };

    const quote = ProrationEngine.calculateSwitchQuote({
      currentMembership: membership,
      newPlan: targetPlan,
      gymSettings,
      userWalletBalancePaise: walletBalancePaise,
      downgradeSettlementPreference,
      switchDate: new Date(),
    });

    const requestId = await ProrationEngine.generateRequestId(gym._id);

    const switchRequest = await MembershipSwitchRequest.create({
      requestId,
      membershipId: membership._id,
      gymId: gym._id,
      userId: membership.userId?._id || membership.userId,
      targetTier: ProrationEngine.normalizeTier(targetTier),
      targetPlanId: targetPlan.tierId || targetPlanId || targetTier,
      quoteSnapshot: {
        switchType: quote.switchType,
        currentPricePaise: quote.currentPlan.pricePaise,
        currentDurationDays: quote.currentPlan.durationDays,
        daysUsed: quote.currentPlan.daysUsed,
        daysRemaining: quote.currentPlan.daysRemaining,
        dailyRatePaise: quote.currentPlan.perDayCostPaise,
        proRatedCreditPaise: quote.financialBreakdown.proRatedCreditPaise,
        newPricePaise: quote.newPlan.pricePaise,
        newDurationDays: quote.newPlan.baseDurationDays,
        grossPayablePaise: quote.financialBreakdown.grossPayablePaise,
        walletDeductionPaise: quote.financialBreakdown.walletDeductionPaise,
        netAmountToPayPaise: quote.financialBreakdown.netAmountToPayPaise,
        leftoverCreditPaise: quote.financialBreakdown.leftoverCreditPaise,
        extraDaysAwarded: quote.newPlan.extraDaysAwarded,
        effectiveNewDurationDays: quote.newPlan.effectiveDurationDays,
        downgradePolicy: quote.financialBreakdown.policyApplied,
      },
      paymentDetails: {
        method: paymentMethod,
        transactionId: transactionId || `TXN_${Date.now()}`,
        isPrepaid: Boolean(transactionId),
      },
      status: 'PENDING_GYM_APPROVAL',
    });

    // Clear membership entryOtp immediately while in review
    await Membership.updateOne({ _id: membership._id }, { entryOtp: null });

    return res.status(201).json(ApiResponse.success(switchRequest, 'Plan switch request submitted successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Switch Requests for Logged-In User
 * GET /api/v1/memberships/my/switch-requests
 */
export const getMySwitchRequests = async (req, res, next) => {
  try {
    const rawUserId = req.user?.userId || req.user?.id || req.query.userId;
    if (!rawUserId) {
      return res.status(200).json(ApiResponse.success([], 'Switch requests retrieved.'));
    }

    const filter = mongoose.Types.ObjectId.isValid(rawUserId)
      ? { userId: new mongoose.Types.ObjectId(rawUserId) }
      : { userId: rawUserId };

    const requests = await MembershipSwitchRequest.find(filter)
      .populate('gymId', 'name partnerId logo address')
      .populate('membershipId', 'membershipId membershipTier startDate endDate')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(ApiResponse.success(requests, 'User switch requests retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Get Switch Requests for a Gym (Gym Owner Portal)
 * GET /api/v1/memberships/gym/:gymId/switch-requests
 */
export const getGymSwitchRequests = async (req, res, next) => {
  try {
    const { gymId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;

    const isObjectId = mongoose.Types.ObjectId.isValid(gymId);
    const gym = await Gym.findOne(
      isObjectId ? { $or: [{ _id: gymId }, { partnerId: gymId }] } : { partnerId: gymId }
    );

    if (!gym) {
      throw ApiError.notFound('Gym not found.');
    }

    const filter = { gymId: gym._id };
    if (status && status !== 'All') {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await MembershipSwitchRequest.countDocuments(filter);

    const requests = await MembershipSwitchRequest.find(filter)
      .populate('userId', 'fullName email phone avatar profilePicture')
      .populate('membershipId', 'membershipId membershipTier startDate endDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json(ApiResponse.success({
      requests,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    }, 'Gym switch requests retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Gym Owner Action on Switch Request (ACCEPT -> PENDING_SUPER_ADMIN_APPROVAL | REJECT -> REJECTED_BY_GYM)
 * PATCH /api/v1/membership-switch-requests/:requestId/gym-action
 */
export const gymActionReviewSwitchRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action, remarks = '' } = req.body;

    if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
      throw ApiError.badRequest("Valid action ('ACCEPT' or 'REJECT') is required.");
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(requestId);
    const query = isObjectId ? { $or: [{ _id: requestId }, { requestId }] } : { requestId };

    const request = await MembershipSwitchRequest.findOne(query);
    if (!request) {
      throw ApiError.notFound('Switch request not found.');
    }

    if (request.status !== 'PENDING_GYM_APPROVAL') {
      throw ApiError.badRequest(
        `Cannot perform gym action. Request is in status '${request.status}', expected 'PENDING_GYM_APPROVAL'.`
      );
    }

    const reviewerName = req.user?.fullName || 'Gym Owner';
    const reviewerId = req.user?.userId || req.user?.id || null;

    if (action === 'ACCEPT') {
      request.status = 'PENDING_SUPER_ADMIN_APPROVAL';
      request.gymApproval = {
        status: 'ACCEPTED',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: new Date(),
        remarks: remarks || 'Accepted by Gym Owner',
      };
    } else {
      request.status = 'REJECTED_BY_GYM';
      request.gymApproval = {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: new Date(),
        remarks: remarks || 'Rejected by Gym Owner',
      };
    }

    await request.save();

    return res.status(200).json(ApiResponse.success(request, `Switch request ${action === 'ACCEPT' ? 'accepted and forwarded to Super Admin' : 'rejected'}.`));
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Switch Requests for Super Admin
 * GET /api/v1/admin/membership-switch-requests
 */
export const getAdminSwitchRequests = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'All') {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await MembershipSwitchRequest.countDocuments(filter);

    const requests = await MembershipSwitchRequest.find(filter)
      .populate('gymId', 'name partnerId logo address city')
      .populate('userId', 'fullName email phone avatar profilePicture')
      .populate('membershipId', 'membershipId membershipTier startDate endDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json(ApiResponse.success({
      requests,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)) || 1,
    }, 'Admin switch requests retrieved successfully.'));
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Action on Switch Request (APPROVE -> Execute ACID Transaction | REJECT -> REJECTED_BY_SUPER_ADMIN)
 * PATCH /api/v1/admin/membership-switch-requests/:requestId/admin-action
 */
export const superAdminActionReviewSwitchRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action, remarks = '' } = req.body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      throw ApiError.badRequest("Valid action ('APPROVE' or 'REJECT') is required.");
    }

    const isObjectId = mongoose.Types.ObjectId.isValid(requestId);
    const query = isObjectId ? { $or: [{ _id: requestId }, { requestId }] } : { requestId };

    const request = await MembershipSwitchRequest.findOne(query);
    if (!request) {
      throw ApiError.notFound('Switch request not found.');
    }

    if (request.status !== 'PENDING_SUPER_ADMIN_APPROVAL') {
      throw ApiError.badRequest(
        `Cannot perform admin action. Request is in status '${request.status}', expected 'PENDING_SUPER_ADMIN_APPROVAL'.`
      );
    }

    const reviewerName = req.user?.fullName || 'Super Admin';
    const reviewerId = req.user?.userId || req.user?.id || null;

    if (action === 'APPROVE') {
      const result = await ProrationEngine.executeApprovedSwitchTransaction({
        switchRequestId: request._id,
        superAdminUser: { _id: reviewerId, fullName: reviewerName },
        remarks,
      });

      return res.status(200).json(ApiResponse.success(result, 'Switch request approved and atomically executed.'));
    } else {
      request.status = 'REJECTED_BY_SUPER_ADMIN';
      request.superAdminApproval = {
        status: 'REJECTED',
        reviewedBy: reviewerId,
        reviewerName,
        reviewedAt: new Date(),
        remarks: remarks || 'Rejected by Super Admin',
      };
      await request.save();

      return res.status(200).json(ApiResponse.success(request, 'Switch request rejected by Super Admin.'));
    }
  } catch (error) {
    next(error);
  }
};
