import mongoose from 'mongoose';
import Gym from '../models/gym.model.js';
import { Employee } from '../models/employee.model.js';
import User, { USER_ROLES } from '../models/user.model.js';
import Booking from '../models/booking.model.js';
import Membership from '../models/membership.model.js';
import Counter from '../models/counter.model.js';
import { syncGymTrainersFromEmployees } from './employee.controller.js';
import asyncHandler from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/apiError.js';
import {
  formatAndCompressFile,
} from '../utils/mediaCompressor.js';
import {
  sanitizeDocument,
} from '../utils/responseTransformer.js';
import { normalizeOpeningHours, getGymTimingStatus } from '../utils/gymTimingHelper.js';
import { computeTimeAgo } from './gymReviews.controller.js';
import { fetchTransactionsFleet } from './admin.controller.js';


/**
 * Helper to extract GPS coordinates from Google Maps URLs
 */
const AT_COORDS_REGEX = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const Q_COORDS_REGEX = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const D3D4_COORDS_REGEX = /!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/;
const LL_COORDS_REGEX = /(?:ll|loc:)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

const extractCoordinatesFromMapsUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  const atMatch = AT_COORDS_REGEX.exec(url);
  if (atMatch) {
    return { lat: Number.parseFloat(atMatch[1]), lng: Number.parseFloat(atMatch[2]) };
  }

  const qMatch = Q_COORDS_REGEX.exec(url);
  if (qMatch) {
    return { lat: Number.parseFloat(qMatch[1]), lng: Number.parseFloat(qMatch[2]) };
  }

  const d3d4Match = D3D4_COORDS_REGEX.exec(url);
  if (d3d4Match) {
    return { lat: Number.parseFloat(d3d4Match[1]), lng: Number.parseFloat(d3d4Match[2]) };
  }

  const llMatch = LL_COORDS_REGEX.exec(url);
  if (llMatch) {
    return { lat: Number.parseFloat(llMatch[1]), lng: Number.parseFloat(llMatch[2]) };
  }

  return null;
};

/**
 * Standard 4-Tier Membership Plans Builder
 * Generates/normalizes the 4 fixed standard tiers: Monthly, Quarterly, Half Yearly, Annual
 */
export const buildStandardCustomPricingPlans = (pricing = {}, customPlans = []) => {
  const monthlyPrice = Number(pricing.monthly || pricing.monthlyPrice || 1299);
  const quarterlyPrice = Number(pricing.quarterly || pricing.quarterlyPrice || 3299);
  const halfYearlyPrice = Number(pricing.halfYearly || pricing.halfYearlyPrice || 5999);
  const annualPrice = Number(pricing.annual || pricing.annualPrice || 11999);

  const planMap = {};
  if (Array.isArray(customPlans)) {
    customPlans.forEach((p) => {
      if (!p) return;
      const tId = p.tierId || (
        p.badge?.toLowerCase().includes('month') || p.duration?.includes('30') ? 'monthly' :
        p.badge?.toLowerCase().includes('quarter') || p.duration?.includes('90') ? 'quarterly' :
        p.badge?.toLowerCase().includes('half') || p.duration?.includes('180') ? 'half_yearly' :
        p.badge?.toLowerCase().includes('annual') || p.badge?.toLowerCase().includes('year') || p.duration?.includes('365') ? 'annual' : null
      );
      if (tId) planMap[tId] = p;
    });
  }

  const calcSavings = (price, months) => {
    const fullVal = monthlyPrice * months;
    const diff = fullVal - price;
    return diff > 0 ? `Save ₹${diff.toLocaleString('en-IN')}` : '';
  };

  const qPrice = planMap.quarterly?.price !== undefined ? Number(planMap.quarterly.price) : quarterlyPrice;
  const hPrice = (planMap.half_yearly?.price !== undefined ? Number(planMap.half_yearly.price) : (planMap.halfYearly?.price !== undefined ? Number(planMap.halfYearly.price) : halfYearlyPrice));
  const aPrice = planMap.annual?.price !== undefined ? Number(planMap.annual.price) : annualPrice;

  return [
    {
      id: 'plan-monthly',
      tierId: 'monthly',
      name: planMap.monthly?.name || 'Monthly Plan',
      badge: 'Monthly',
      price: planMap.monthly?.price !== undefined ? Number(planMap.monthly.price) : monthlyPrice,
      duration: '30 Days',
      months: 1,
      description: planMap.monthly?.description || 'Standard 30-day recurring membership.',
      features: Array.isArray(planMap.monthly?.features) && planMap.monthly.features.length > 0
        ? planMap.monthly.features
        : [
            'Access to all gym facilities',
            'Free group workout classes',
            'Locker and shower facility',
            'Trainer guidance on floor',
          ],
      popular: Boolean(planMap.monthly?.popular),
      savingsText: '',
      assignedTrainers: Array.isArray(planMap.monthly?.assignedTrainers) ? planMap.monthly.assignedTrainers : [],
    },
    {
      id: 'plan-quarterly',
      tierId: 'quarterly',
      name: planMap.quarterly?.name || 'Quarterly Plan',
      badge: 'Quarterly',
      price: qPrice,
      duration: '90 Days',
      months: 3,
      description: planMap.quarterly?.description || '3-month structured fitness package.',
      features: Array.isArray(planMap.quarterly?.features) && planMap.quarterly.features.length > 0
        ? planMap.quarterly.features
        : [
            'Access to all gym facilities',
            'Free group workout classes',
            'Locker and shower facility',
            '1 Guest pass per month',
            '2 Complimentary PT Sessions',
          ],
      popular: Boolean(planMap.quarterly?.popular),
      savingsText: calcSavings(qPrice, 3),
      assignedTrainers: Array.isArray(planMap.quarterly?.assignedTrainers) ? planMap.quarterly.assignedTrainers : [],
    },
    {
      id: 'plan-half-yearly',
      tierId: 'half_yearly',
      name: planMap.half_yearly?.name || planMap.halfYearly?.name || 'Half Yearly Plan',
      badge: 'Half Yearly',
      price: hPrice,
      duration: '180 Days',
      months: 6,
      description: planMap.half_yearly?.description || planMap.halfYearly?.description || '6-month transformation package.',
      features: Array.isArray(planMap.half_yearly?.features || planMap.halfYearly?.features) && (planMap.half_yearly?.features || planMap.halfYearly?.features).length > 0
        ? (planMap.half_yearly?.features || planMap.halfYearly?.features)
        : [
            'Access to all gym facilities',
            'Free group workout classes',
            'Locker and shower facility',
            '1 Guest pass per month',
            'Personalized nutrition guidance',
            '4 Complimentary PT Sessions',
          ],
      popular: Boolean(planMap.half_yearly?.popular || planMap.halfYearly?.popular),
      savingsText: calcSavings(hPrice, 6),
      assignedTrainers: Array.isArray(planMap.half_yearly?.assignedTrainers || planMap.halfYearly?.assignedTrainers)
        ? (planMap.half_yearly?.assignedTrainers || planMap.halfYearly?.assignedTrainers)
        : [],
    },
    {
      id: 'plan-annual',
      tierId: 'annual',
      name: planMap.annual?.name || 'Annual VIP Plan',
      badge: 'Annual',
      price: aPrice,
      duration: '365 Days',
      months: 12,
      description: planMap.annual?.description || 'All-inclusive annual membership with priority perks.',
      features: Array.isArray(planMap.annual?.features) && planMap.annual.features.length > 0
        ? planMap.annual.features
        : [
            'Access to all gym facilities',
            'Free group workout classes',
            'Locker and shower facility',
            '2 Guest passes per month',
            'Personalized nutrition guidance',
            'VIP Locker & Towel Service',
            'Unlimited Steam & Sauna',
          ],
      popular: planMap.annual?.popular !== undefined ? Boolean(planMap.annual.popular) : true,
      savingsText: calcSavings(aPrice, 12),
      assignedTrainers: Array.isArray(planMap.annual?.assignedTrainers) ? planMap.annual.assignedTrainers : [],
    },
  ];
};

/**
 * POST /api/v1/gyms/onboard
 * New Gym Partner Onboarding with Owner Account Creation and {gymname}_{filename} Media Base64 Compression
 */
export const onboardGym = asyncHandler(async (req, res) => {
  const {
    gymName,
    name,
    tagline,
    ownerName,
    phone,
    email,
    password,
    businessType,
    yearEstablished,
    gstNumber,
    panNumber,
    branches,
    address,
    area,
    city,
    state,
    pincode,
    landmark,
    lat,
    lng,
    googleMapsUrl,
    floorSpaceSqFt,
    maxFloorCapacity,
    logo,
    coverPhoto,
    image,
    galleryPhotos,
    images,
    facilities,
    amenities,
    workouts,
    tags,
    badgeText,
    aboutText,
    trainers = [],
    openingHours,
    weekdayOpen,
    weekdayClose,
    weekendOpen,
    weekendClose,
    isSplitShift,
    isOpenHolidays,
    is24Hours,
    slotDurationMinutes,
    maxSlotCapacity,
    slotsMorning,
    slotsEvening,
    singleSessionPrice,
    weeklyPassPrice,
    fiveSessionPrice,
    monthlyPrice,
    quarterlyPrice,
    halfYearlyPrice,
    annualPrice,
    pricingPlans,
    customPricingPlans = [],
    rules,
    safetyMeasures,
    freeCancellationHours,
    refundPercentage,
    rescheduleAllowedCount,
    subscriptionType,
    commissionRate,
    settlementCycle,
    bankDetails,
    accountHolder,
    bankName,
    accountNumber,
    ifscCode,
    upiId,
    documents,
    gstCertificate,
    panCard,
    tradeLicense,
    bankProof,
    fireSafetyCertificate,
    fssaiCertificate,
    status,
    approvalStatus,
    initialApprovalStatus,
    authProvider,
    googleId,
    isSsoEnabled,
  } = req.body;

  const isGoogleAuth = authProvider === 'GOOGLE' || Boolean(googleId);
  const finalGymName = (gymName || name || '').trim();
  const finalOwnerName = (ownerName || '').trim();
  const finalEmail = (email || '').trim().toLowerCase();
  const finalPhone = (phone || '').trim();
  const finalCity = (city || '').trim();
  const finalAddress = (address || '').trim();

  // 1. Validation
  if (!finalGymName) {
    throw ApiError.badRequest('Gym name is required.');
  }
  if (!finalOwnerName) {
    throw ApiError.badRequest('Owner name is required.');
  }
  if (!finalEmail) {
    throw ApiError.badRequest('Email address is required.');
  }
  if (!finalPhone) {
    throw ApiError.badRequest('Phone number is required.');
  }

  // Password validation: mandatory for LOCAL accounts, optional for GOOGLE SSO
  if (!isGoogleAuth && !password) {
    throw ApiError.badRequest('Owner account password is required.');
  }
  if (password) {
    if (password.length < 8 || password.length > 16) {
      throw ApiError.badRequest('Password must be between 8 and 16 characters.');
    }
    if (!/[A-Z]/.test(password)) {
      throw ApiError.badRequest('Password must contain at least 1 uppercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      throw ApiError.badRequest('Password must contain at least 1 number.');
    }
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password)) {
      throw ApiError.badRequest('Password must contain at least 1 special character.');
    }
    if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|[^\x20-\x7E]/u.test(password)) {
      throw ApiError.badRequest('Emoji characters and non-standard symbols are not allowed in password.');
    }
  }
  if (!finalCity) {
    throw ApiError.badRequest('City is required.');
  }
  if (!finalAddress) {
    throw ApiError.badRequest('Gym address is required.');
  }

  // 2. Check for duplicate gym email or owner account
  const existingUser = await User.findOne({ email: finalEmail });
  if (existingUser) {
    throw ApiError.conflict('An account with this email address already exists.');
  }

  // 3. Compress Media (Images & PDFs) with high quality & {gymname}_{filename} formatting
  const primaryLogo = logo || '';
  const primaryCover = coverPhoto || image || logo || '';
  const structuredLogo = primaryLogo ? await formatAndCompressFile(finalGymName, 'logo', primaryLogo) : {};
  const structuredCover = primaryCover ? await formatAndCompressFile(finalGymName, 'cover', primaryCover) : structuredLogo;

  const rawGallery = Array.isArray(galleryPhotos) ? galleryPhotos : Array.isArray(images) ? images : [];
  const structuredGallery = (
    await Promise.all(
      rawGallery.map((img, i) => formatAndCompressFile(finalGymName, `gallery_${i + 1}`, img))
    )
  ).filter(Boolean);

  // Compress Trainer Images with {gymname}_trainer_{name} naming
  const structuredTrainers = await Promise.all(
    trainers.map(async (t) => {
      const sanitizedTrainerName = (t.name || 'coach').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const trainerImg = await formatAndCompressFile(finalGymName, `trainer_${sanitizedTrainerName}`, t.image);
      return {
        name: t.name,
        specialty: t.specialty || 'General Fitness',
        experienceYears: Number(t.experienceYears) || 1,
        rating: Number(t.rating) || 4.9,
        monthlyFee: Number(t.monthlyFee) || 0,
        image: trainerImg || {},
      };
    })
  );

  // Compress Verification Documents (PDFs or Images) with {gymname}_{filename} format
  const docsInput = documents || {};
  const [
    structuredGst,
    structuredPan,
    structuredTrade,
    structuredBankProof,
    structuredFireSafety,
    structuredFssai,
  ] = await Promise.all([
    formatAndCompressFile(finalGymName, 'gst_certificate', docsInput.gstCertificate || gstCertificate),
    formatAndCompressFile(finalGymName, 'pan', docsInput.panCard || panCard),
    formatAndCompressFile(finalGymName, 'trade_license', docsInput.tradeLicense || tradeLicense),
    formatAndCompressFile(finalGymName, 'bank_proof', docsInput.bankProof || bankProof),
    formatAndCompressFile(finalGymName, 'fire_safety', docsInput.fireSafetyCertificate || fireSafetyCertificate),
    formatAndCompressFile(finalGymName, 'fssai_certificate', docsInput.fssaiCertificate || fssaiCertificate),
  ]);

  // Coordinates (from direct lat/lng or parsed from googleMapsUrl)
  const parsedCoords = extractCoordinatesFromMapsUrl(googleMapsUrl);
  const latitude = Number(lat) || (parsedCoords ? parsedCoords.lat : 13.0827);
  const longitude = Number(lng) || (parsedCoords ? parsedCoords.lng : 80.2707);

  // Pricing Structure
  const resolvedPricing = pricingPlans || {
    singleSession: Number(singleSessionPrice) || 199,
    weeklyPass: Number(weeklyPassPrice) || 799,
    fiveSessions: Number(fiveSessionPrice) || 899,
    monthly: Number(monthlyPrice) || 1999,
    quarterly: Number(quarterlyPrice) || 4999,
    halfYearly: Number(halfYearlyPrice) || 8999,
    annual: Number(annualPrice) || 14999,
  };

  // Bank Details
  const resolvedBankDetails = bankDetails || {
    accountHolder: accountHolder || '',
    bankName: bankName || '',
    accountNumber: accountNumber || '',
    ifscCode: ifscCode || '',
    upiId: upiId || '',
  };

  // Operational Hours
  const rawOpeningHours = openingHours || {
    mode: is24Hours ? '24_HOURS' : (isSplitShift ? 'SPLIT_SHIFT' : 'REGULAR'),
    weekdayOpen: weekdayOpen || '05:30 AM',
    weekdayClose: weekdayClose || '10:30 PM',
    weekendOpen: weekendOpen || '06:00 AM',
    weekendClose: weekendClose || '09:00 PM',
    morningOpen: req.body.morningOpen || '05:30 AM',
    morningClose: req.body.morningClose || '11:30 AM',
    eveningOpen: req.body.eveningOpen || '04:30 PM',
    eveningClose: req.body.eveningClose || '10:30 PM',
    isSplitShift: Boolean(isSplitShift),
    isOpenHolidays: isOpenHolidays !== false,
    is24Hours: Boolean(is24Hours),
  };
  const resolvedOpeningHours = normalizeOpeningHours(rawOpeningHours);

  // 4. Determine Initial Status and Sequential Partner ID
  const resolvedApprovalStatus =
    approvalStatus ||
    initialApprovalStatus ||
    (req.user?.role === USER_ROLES.SUPER_ADMIN ? 'Approved' : 'Pending Approval');
  const resolvedStatus =
    status || (resolvedApprovalStatus === 'Approved' ? 'Active' : 'Pending');

  // Only generate sequential partner ID if directly approved at creation (e.g. by Super Admin)
  let partnerId = undefined;
  if (resolvedApprovalStatus === 'Approved') {
    const partnerSeq = await Counter.getNextSequence('gym_partner_id');
    partnerId = `GYM${partnerSeq}`;
  }

  // 5. Create Gym in MongoDB
  const newGym = new Gym({
    partnerId,
    name: finalGymName,
    tagline: tagline || '',
    slug: finalGymName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    ownerName: finalOwnerName,
    businessType: businessType || 'Private Limited',
    phone: finalPhone,
    email: finalEmail,
    yearEstablished: yearEstablished || '',
    gstNumber: gstNumber || '',
    panNumber: panNumber || '',
    branches: branches || '1',
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    area: area || '',
    city: finalCity,
    state: state || 'Tamil Nadu',
    pincode: pincode || '',
    landmark: landmark || '',
    address: finalAddress,
    fullAddress: `${finalAddress}, ${area ? area + ', ' : ''}${finalCity}, ${state || 'Tamil Nadu'} - ${pincode || ''}`,
    googleMapsUrl: googleMapsUrl || `https://maps.google.com/?q=${latitude},${longitude}`,
    floorSpaceSqFt: Number(floorSpaceSqFt) || 0,
    maxFloorCapacity: Number(maxFloorCapacity) || 0,
    logo: structuredLogo || {},
    coverPhoto: structuredCover || {},
    image: structuredCover?.fileData || structuredLogo?.fileData || '',
    galleryPhotos: structuredGallery,
    images: structuredGallery.map((g) => g.fileData),
    facilities: Array.isArray(facilities) ? facilities : [],
    amenities: Array.isArray(amenities) ? amenities : [],
    workouts: Array.isArray(workouts) ? workouts : [],
    tags: Array.isArray(tags) ? tags : [],
    badgeText: badgeText || 'Verified',
    aboutText: aboutText || '',
    trainers: [],
    openingHours: resolvedOpeningHours,
    slotDurationMinutes: Number(slotDurationMinutes) || 60,
    maxSlotCapacity: Number(maxSlotCapacity) || 25,
    slotsMorning: Array.isArray(slotsMorning) ? slotsMorning : [],
    slotsEvening: Array.isArray(slotsEvening) ? slotsEvening : [],
    singleSessionPrice: Number(singleSessionPrice) || resolvedPricing.singleSession || 199,
    pricingPlans: resolvedPricing,
    customPricingPlans: buildStandardCustomPricingPlans(resolvedPricing, customPricingPlans),
    rules: Array.isArray(rules) ? rules : [],
    safetyMeasures: Array.isArray(safetyMeasures) ? safetyMeasures : [],
    freeCancellationHours: Number(freeCancellationHours) || 2,
    refundPercentage: Number(refundPercentage) || 100,
    rescheduleAllowedCount: Number(rescheduleAllowedCount) || 2,
    subscriptionType: subscriptionType || 'Hybrid',
    commissionRate: Number(commissionRate) || 10,
    settlementCycle: settlementCycle || 'Daily (T+1)',
    bankDetails: resolvedBankDetails,
    documents: {
      gstCertificate: structuredGst || {},
      panCard: structuredPan || {},
      tradeLicense: structuredTrade || {},
      bankProof: structuredBankProof || {},
      fireSafetyCertificate: structuredFireSafety || {},
      fssaiCertificate: structuredFssai || {},
    },
    status: resolvedStatus,
    approvalStatus: resolvedApprovalStatus,
    remark: req.body.remark || '',
  });

  await newGym.save();

  // Save any onboarded trainers directly into the Employee collection (SSOT)
  if (Array.isArray(structuredTrainers) && structuredTrainers.length > 0) {
    for (const t of structuredTrainers) {
      if (!t || !t.name) continue;
      const seq = await Counter.getNextSequence(`emp_${newGym.partnerId || newGym._id}`);
      const employeeId = `TR${String(seq).padStart(3, '0')}`;
      await Employee.create({
        gymId: newGym._id,
        gymPartnerId: newGym.partnerId || '',
        gymName: newGym.name,
        employeeId,
        name: t.name.trim(),
        role: 'Trainer',
        avatar: t.image?.fileData || t.imageUrl || '',
        specialty: t.specialty || 'General Fitness',
        experienceYears: Number(t.experienceYears) || 1,
        rating: Number(t.rating) || 4.9,
        monthlyFee: Number(t.monthlyFee) || 0,
        status: 'Active',
        attendance: 'Present',
        approvalStatus: resolvedApprovalStatus === 'Approved' ? 'Approved' : 'Pending Approval',
        pendingAction: 'NONE',
        type: 'Full-Time',
        accessType: 'Employee',
        joinDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        approvedBy: resolvedApprovalStatus === 'Approved' ? (req.user?.email || 'Super Admin') : '',
        approvedAt: resolvedApprovalStatus === 'Approved' ? new Date() : null,
      });
    }
  }

  // 5. Create Gym Owner User Account
  const gymOwnerUser = new User({
    fullName: finalOwnerName,
    email: finalEmail,
    phone: finalPhone,
    password: password || undefined, // Pre-save hook hashes with bcryptjs if present
    role: USER_ROLES.GYM_OWNER,
    gymId: newGym._id,
    authProvider: isGoogleAuth ? 'GOOGLE' : 'LOCAL',
    googleId: isGoogleAuth ? (googleId || null) : null,
    isSsoEnabled: isSsoEnabled !== undefined ? Boolean(isSsoEnabled) : true,
    isActive: true,
    isVerified: true,
  });

  await gymOwnerUser.save();

  // Link Owner ID in Gym
  newGym.ownerId = gymOwnerUser._id;
  await newGym.save();

  const sanitizedGym = sanitizeDocument(newGym);
  const sanitizedOwner = sanitizeDocument(gymOwnerUser);

  clearFleetCache();

  return res.status(201).json(
    ApiResponse.created(
      {
        gym: sanitizedGym,
        owner: sanitizedOwner,
      },
      `Gym "${finalGymName}" and Partner Owner account onboarded successfully!`
    )
  );
});

/**
 * Calculate distance in km between two GPS coordinates using Haversine formula
 */
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/**
 * GET /api/v1/gyms/zones
 * GET /api/v1/gyms/popular-cities
 * Aggregate distinct cities & zones from active database gyms and combine with key metro zones
 */
export const getGymZones = asyncHandler(async (_req, res) => {
  const PRESET_METRO_ZONES = [
    { name: 'Anna Nagar, Chennai', area: 'Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.085, lon: 80.2101 },
    { name: 'T. Nagar, Chennai', area: 'T. Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0418, lon: 80.2341 },
    { name: 'Adyar, Chennai', area: 'Adyar', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0012, lon: 80.2565 },
    { name: 'Besant Nagar, Chennai', area: 'Besant Nagar', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9996, lon: 80.2678 },
    { name: 'Velachery, Chennai', area: 'Velachery', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9815, lon: 80.218 },
    { name: 'Nungambakkam, Chennai', area: 'Nungambakkam', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0569, lon: 80.2425 },
    { name: 'Porur, Chennai', area: 'Porur', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0382, lon: 80.1585 },
    { name: 'OMR, Chennai', area: 'OMR', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9698, lon: 80.2376 },
    { name: 'Guindy, Chennai', area: 'Guindy', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0067, lon: 80.203 },
    { name: 'Alwarpet, Chennai', area: 'Alwarpet', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0334, lon: 80.2508 },
    { name: 'Kilpauk, Chennai', area: 'Kilpauk', city: 'Chennai', state: 'Tamil Nadu', lat: 13.0784, lon: 80.2412 },
    { name: 'Tambaram, Chennai', area: 'Tambaram', city: 'Chennai', state: 'Tamil Nadu', lat: 12.9249, lon: 80.1275 },
  ];

  // Aggregate active gym counts grouped by city and area from MongoDB
  const dbZones = await Gym.aggregate([
    {
      $match: {
        status: 'Active',
        isActive: true,
        $or: [
          { approvalStatus: 'Approved' },
          { partnerId: { $exists: true, $ne: null } },
        ],
      },
    },
    {
      $group: {
        _id: {
          city: { $trim: { input: '$city' } },
          area: { $trim: { input: { $ifNull: ['$area', ''] } } },
        },
        gymCount: { $sum: 1 },
        state: { $first: '$state' },
        lat: { $avg: { $arrayElemAt: ['$location.coordinates', 1] } },
        lon: { $avg: { $arrayElemAt: ['$location.coordinates', 0] } },
      },
    },
    { $sort: { gymCount: -1 } },
  ]);

  const zonesMap = new Map();

  for (const item of dbZones) {
    const cityName = item._id.city || 'Chennai';
    const areaName = item._id.area || '';
    const displayName = areaName ? `${areaName}, ${cityName}` : cityName;
    zonesMap.set(displayName.toLowerCase(), {
      name: displayName,
      area: areaName || cityName,
      city: cityName,
      state: item.state || 'Tamil Nadu',
      lat: Number(item.lat) || 13.085,
      lon: Number(item.lon) || 80.2101,
      gymCount: item.gymCount || 1,
      isPopular: true,
    });
  }

  for (const preset of PRESET_METRO_ZONES) {
    const key = preset.name.toLowerCase();
    if (!zonesMap.has(key)) {
      zonesMap.set(key, {
        ...preset,
        gymCount: 0,
        isPopular: true,
      });
    }
  }

  const zonesList = Array.from(zonesMap.values());

  return res.status(200).json(
    ApiResponse.success(
      {
        zones: zonesList,
        total: zonesList.length,
      },
      'Popular cities and gym zones retrieved successfully'
    )
  );
});

/**
 * Helper to reliably resolve web-ready URLs/Base64 strings for gym media
 */
export const resolveGymMediaUrls = (gym) => {
  const defaultFallbackImage =
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop';

  let resolvedLogo = '';
  if (gym?.logo) {
    if (typeof gym.logo === 'string' && gym.logo.trim()) {
      resolvedLogo = gym.logo.trim();
    } else if (
      typeof gym.logo === 'object' &&
      gym.logo.fileData &&
      typeof gym.logo.fileData === 'string' &&
      gym.logo.fileData.trim()
    ) {
      resolvedLogo = gym.logo.fileData.trim();
    }
  }

  let resolvedCover = '';
  if (gym?.coverPhoto) {
    if (typeof gym.coverPhoto === 'string' && gym.coverPhoto.trim()) {
      resolvedCover = gym.coverPhoto.trim();
    } else if (
      typeof gym.coverPhoto === 'object' &&
      gym.coverPhoto.fileData &&
      typeof gym.coverPhoto.fileData === 'string' &&
      gym.coverPhoto.fileData.trim()
    ) {
      resolvedCover = gym.coverPhoto.fileData.trim();
    }
  }

  let resolvedImage = '';
  if (typeof gym?.image === 'string' && gym.image.trim()) {
    resolvedImage = gym.image.trim();
  } else if (
    Array.isArray(gym?.images) &&
    gym.images.length > 0 &&
    typeof gym.images[0] === 'string' &&
    gym.images[0].trim()
  ) {
    resolvedImage = gym.images[0].trim();
  } else if (
    Array.isArray(gym?.galleryPhotos) &&
    gym.galleryPhotos.length > 0 &&
    gym.galleryPhotos[0]?.fileData
  ) {
    resolvedImage = gym.galleryPhotos[0].fileData.trim();
  }

  const finalLogoUrl = resolvedLogo || resolvedCover || resolvedImage || defaultFallbackImage;
  const finalCoverUrl = resolvedCover || resolvedLogo || resolvedImage || defaultFallbackImage;
  const finalImageUrl = resolvedImage || resolvedCover || resolvedLogo || defaultFallbackImage;

  return {
    logoUrl: finalLogoUrl,
    coverPhotoUrl: finalCoverUrl,
    imageUrl: finalImageUrl,
    thumbnailImage: finalImageUrl,
  };
};

// Fast in-memory cache for public customer discovery queries (30s TTL)
const discoveryCache = new Map();
const DISCOVERY_CACHE_TTL_MS = 30 * 1000;

/**
 * GET /api/v1/gyms
 * List gyms with geospatial proximity sorting, category filter, facilities, search, and pagination
 */
export const getGyms = asyncHandler(async (req, res) => {
  const {
    status,
    approvalStatus,
    subscriptionType,
    city,
    area,
    category,
    type,
    genderAllowed,
    facility,
    workout,
    search,
    lat,
    lng,
    latitude,
    longitude,
    radius,
    radius_km,
    sortBy,
    page = 1,
    limit = 50,
  } = req.query;

  const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;
  const userLat = Number(lat || latitude);
  const userLng = Number(lng || longitude);
  const hasCoordinates = !Number.isNaN(userLat) && !Number.isNaN(userLng);
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;
  const maxRadius = Number(radius_km || radius);

  // Fast in-memory cache lookup for public customer queries
  const cacheKey = JSON.stringify({
    role: req.user?.role || 'public',
    status: status || '',
    approvalStatus: approvalStatus || '',
    city: city || '',
    area: area || '',
    category: category || '',
    type: type || '',
    genderAllowed: genderAllowed || '',
    facility: facility || '',
    workout: workout || '',
    search: (search || '').trim().toLowerCase(),
    lat: hasCoordinates ? userLat.toFixed(2) : '',
    lng: hasCoordinates ? userLng.toFixed(2) : '',
    radius: !Number.isNaN(maxRadius) && maxRadius > 0 ? maxRadius : '',
    sortBy: sortBy || 'nearest',
    page: pageNum,
    limit: limitNum,
    subscriptionType: subscriptionType || '',
  });

  const cached = discoveryCache.get(cacheKey);
  const now = Date.now();
  if (cached && (now - cached.timestamp < DISCOVERY_CACHE_TTL_MS)) {
    return res.status(200).json(cached.payload);
  }

  const query = {};

  // Status filtering: Public customers discovery gets all Active verified gyms (even if edits are pending review)
  if (!isSuperAdmin) {
    query.status = 'Active';
    query.isActive = true;
    query.$or = [
      { approvalStatus: 'Approved' },
      { partnerId: { $exists: true, $ne: null } },
    ];
  } else {
    if (status && status !== 'All') query.status = status;
    if (approvalStatus && approvalStatus !== 'All') query.approvalStatus = approvalStatus;
  }

  if (subscriptionType && subscriptionType !== 'All') {
    query.subscriptionType = subscriptionType;
  }

  // City & Area Filters
  if (city && city !== 'All') {
    query.city = new RegExp(city.trim(), 'i');
  }
  if (area && area !== 'All') {
    query.area = new RegExp(area.trim(), 'i');
  }

  // Category Filter
  if (category && category !== 'All') {
    const cat = category.trim().toLowerCase();
    if (cat === 'ac gym') {
      query.facilities = { $regex: /ac|air condition/i };
    } else if (cat === 'women only') {
      query.$or = [
        { tags: { $regex: /women only/i } },
        { name: { $regex: /women|female/i } },
        { genderAllowed: { $regex: /women/i } },
      ];
    } else if (cat === 'strength') {
      query.$or = [
        { tags: { $regex: /strength|bodybuilding|weights/i } },
        { workouts: { $regex: /strength|bodybuilding/i } },
      ];
    } else if (cat === 'hiit') {
      query.$or = [
        { tags: { $regex: /hiit|cardio/i } },
        { workouts: { $regex: /hiit|cardio/i } },
      ];
    } else if (cat === 'yoga') {
      query.$or = [
        { tags: { $regex: /yoga|pilates/i } },
        { workouts: { $regex: /yoga|pilates/i } },
      ];
    } else if (cat === 'boxing') {
      query.$or = [
        { tags: { $regex: /boxing|mma|kickboxing/i } },
        { workouts: { $regex: /boxing|mma/i } },
      ];
    } else if (cat === 'zumba') {
      query.$or = [
        { tags: { $regex: /zumba|dance|aerobics/i } },
        { workouts: { $regex: /zumba|dance/i } },
      ];
    } else if (cat === 'crossfit') {
      query.$or = [
        { tags: { $regex: /crossfit|functional/i } },
        { workouts: { $regex: /crossfit|functional/i } },
      ];
    } else {
      query.$or = [
        { tags: { $regex: new RegExp(cat, 'i') } },
        { workouts: { $regex: new RegExp(cat, 'i') } },
      ];
    }
  }

  // Type / Gender Filter
  const gymType = type || genderAllowed;
  if (gymType && gymType !== 'All Gyms' && gymType !== 'All') {
    query.$or = [
      { tags: { $regex: new RegExp(gymType, 'i') } },
      { genderAllowed: { $regex: new RegExp(gymType, 'i') } },
    ];
  }

  // Specific Facility Filter
  if (facility && facility !== 'All Facilities' && facility !== 'All') {
    query.facilities = { $regex: new RegExp(facility.trim(), 'i') };
  }

  // Specific Workout Filter
  if (workout && workout !== 'All') {
    query.workouts = { $regex: new RegExp(workout.trim(), 'i') };
  }

  // Keyword Search
  if (search && search.trim()) {
    const s = search.trim();
    const searchRegex = new RegExp(s, 'i');
    query.$or = [
      { partnerId: searchRegex },
      { name: searchRegex },
      { ownerName: searchRegex },
      { city: searchRegex },
      { area: searchRegex },
      { address: searchRegex },
      { tags: searchRegex },
      { workouts: searchRegex },
      { facilities: searchRegex },
    ];
  }

  // Optimized lean projection: fetch only essential card fields (exclude heavy photos, gallery, trainers, reviews, rules, documents)
  const cardProjection =
    'partnerId slug name location area city state address fullAddress phone email ownerName rating reviewsCount singleSessionPrice singleSessionBookingEnabled enabledSessionCategories pricingPlans.singleSession pricingPlans.monthly monthlyPrice logo coverPhoto image images badgeText tags workouts businessType facilities subscriptionType status approvalStatus createdAt';

  const [totalCount, rawGyms] = await Promise.all([
    Gym.countDocuments(query),
    Gym.find(query).select(cardProjection).lean(),
  ]);

  // Transform and calculate distance dynamically
  let processedGyms = rawGyms.map((g, index) => {
    const gymLat = g.location?.coordinates ? g.location.coordinates[1] : 13.0827;
    const gymLng = g.location?.coordinates ? g.location.coordinates[0] : 80.2707;

    const distance = hasCoordinates
      ? calculateDistanceKm(userLat, userLng, gymLat, gymLng)
      : calculateDistanceKm(13.085, 80.2101, gymLat, gymLng);

    const sessionPrice = g.singleSessionPrice || g.pricingPlans?.singleSession || 199;
    const monthlyPrice = g.monthlyPrice || g.pricingPlans?.monthly || sessionPrice * 10;
    const displayLocation = g.area ? `${g.area}, ${g.city}` : (g.city || 'Chennai');
    const mediaUrls = resolveGymMediaUrls(g);

    return {
      index: skip + index + 1,
      id: g.partnerId || g._id.toString(),
      _id: g._id.toString(),
      mongoId: g._id.toString(),
      partnerId: g.partnerId || '',
      name: g.name,
      location: displayLocation,
      place: displayLocation,
      area: g.area || '',
      city: g.city || '',
      state: g.state || 'Tamil Nadu',
      address: g.address || g.fullAddress || displayLocation,
      fullAddress: g.fullAddress || g.address || displayLocation,
      phone: g.phone || '',
      email: g.email || '',
      ownerName: g.ownerName || '',
      distance,
      distanceText: `${distance} km`,
      coords: { latitude: gymLat, longitude: gymLng },
      rating: g.rating || 0,
      reviewsCount: g.reviewsCount || 0,
      singleSessionPrice: sessionPrice,
      pricePerSession: sessionPrice,
      singleSessionBookingEnabled: g.singleSessionBookingEnabled !== false,
      enabledSessionCategories: Array.isArray(g.enabledSessionCategories) ? g.enabledSessionCategories : null,
      monthlyPrice: monthlyPrice,
      membershipPrice: monthlyPrice,
      logo: g.logo || mediaUrls.logoUrl,
      coverPhoto: g.coverPhoto || mediaUrls.coverPhotoUrl,
      logoUrl: mediaUrls.logoUrl,
      coverPhotoUrl: mediaUrls.coverPhotoUrl,
      imageUrl: mediaUrls.imageUrl,
      thumbnailImage: mediaUrls.thumbnailImage,
      badgeText: g.badgeText || (g.rating >= 4.8 ? 'Top Rated' : ''),
      tags: g.tags || [],
      workouts: g.workouts || [],
      facilities: g.facilities || [],
      openingHours: g.openingHours || null,
      timingStatus: getGymTimingStatus(g.openingHours),
      subscriptionType: g.subscriptionType || 'Standard',
      status: g.status,
      approvalStatus: g.approvalStatus,
      createdAt: g.createdAt,
    };
  });

  // Filter by radius if provided
  if (!Number.isNaN(maxRadius) && maxRadius > 0 && hasCoordinates) {
    processedGyms = processedGyms.filter((g) => g.distance <= maxRadius);
  }

  // Sorting
  if (sortBy === 'rating') {
    processedGyms.sort((a, b) => b.rating - a.rating);
  } else if (sortBy === 'price_low') {
    processedGyms.sort((a, b) => a.pricePerSession - b.pricePerSession);
  } else if (sortBy === 'price_high') {
    processedGyms.sort((a, b) => b.pricePerSession - a.pricePerSession);
  } else {
    // Default: nearest distance first
    processedGyms.sort((a, b) => a.distance - b.distance);
  }

  // Pagination slice
  const paginatedGyms = processedGyms.slice(skip, skip + limitNum);

  const payload = ApiResponse.success(
    {
      gyms: paginatedGyms,
      pagination: {
        total: processedGyms.length,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(processedGyms.length / limitNum) || 1,
      },
    },
    'Gyms retrieved successfully'
  );

  discoveryCache.set(cacheKey, {
    timestamp: Date.now(),
    payload,
  });

  return res.status(200).json(payload);
});

// Fast in-memory cache for Super Admin Fleet queries with automatic TTL and cache invalidation
const fleetCache = new Map();
const FLEET_CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

export const clearFleetCache = () => {
  fleetCache.clear();
  discoveryCache.clear();
};

/**
 * GET /api/v1/gyms/admin/fleet (or GET /api/v1/admin/gyms)
 * Dedicated Super Admin Fleet Management API
 * Returns all gyms with complete administrative details, verification info, and resolved media URLs
 */
export const getAdminGymsFleet = asyncHandler(async (req, res) => {
  const {
    tab = 'all',
    status,
    approvalStatus,
    subscriptionType,
    search,
    city,
    page = 1,
    limit = 100,
    force,
  } = req.query;

  const cacheKey = JSON.stringify({ tab, status, approvalStatus, subscriptionType, search, city, page, limit });
  const cached = fleetCache.get(cacheKey);
  const now = Date.now();

  if (!force && cached && (now - cached.timestamp < FLEET_CACHE_TTL_MS)) {
    return res.status(200).json(cached.data);
  }

  const query = {};

  // Tab filtering for Super Admin Dashboard
  const activeTab = (tab || '').toLowerCase().trim();
  if (activeTab === 'pending') {
    query.approvalStatus = {
      $in: ['Pending Approval', 'Pending Admin Review', 'On Hold', 'pending', 'under_review'],
    };
  } else if (activeTab === 'approved') {
    query.approvalStatus = 'Approved';
  } else if (activeTab === 'rejected') {
    query.approvalStatus = 'Rejected';
  } else if (activeTab === 'changes') {
    query.$or = [
      { changesCount: { $gt: 0 } },
      { 'auditHistory.0': { $exists: true } },
      { pendingChanges: { $exists: true, $ne: {} } },
    ];
  }

  // Explicit status override
  if (status && status !== 'All') {
    query.status = status;
  }
  if (approvalStatus && approvalStatus !== 'All') {
    query.approvalStatus = approvalStatus;
  }
  if (subscriptionType && subscriptionType !== 'All') {
    query.subscriptionType = subscriptionType;
  }
  if (city && city !== 'All') {
    query.city = new RegExp(city.trim(), 'i');
  }

  // Search filter across partner ID, gym name, owner name, email, phone, city, area
  if (search && search.trim()) {
    const s = search.trim();
    const searchRegex = new RegExp(s, 'i');
    query.$or = [
      { partnerId: searchRegex },
      { name: searchRegex },
      { ownerName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { city: searchRegex },
      { area: searchRegex },
      { address: searchRegex },
    ];
  }

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 100));
  const skip = (pageNum - 1) * limitNum;

  const [totalCount, rawGyms] = await Promise.all([
    Gym.countDocuments(query),
    Gym.find(query)
      .select('-documents -galleryPhotos -auditHistory -images')
      .sort({ createdAt: -1, partnerId: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  const gyms = rawGyms.map((g) => {
    const media = resolveGymMediaUrls(g);
    const gymId = g.partnerId || g._id.toString();
    const displayLocation = g.area ? `${g.area}, ${g.city}` : (g.city || 'Chennai');
    const fullLocation = g.fullAddress || g.address || displayLocation;

    return {
      ...g,
      id: gymId,
      _id: g._id.toString(),
      mongoId: g._id.toString(),
      partnerId: g.partnerId || gymId,
      location: displayLocation,
      fullAddress: fullLocation,
      address: g.address || fullLocation,
      logoUrl: media.logoUrl,
      coverPhotoUrl: media.coverPhotoUrl,
      imageUrl: media.imageUrl,
      thumbnailImage: media.thumbnailImage,
    };
  });

  const responsePayload = ApiResponse.success(
    {
      gyms,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalCount / limitNum) || 1,
      },
    },
    'Super Admin Gyms Fleet retrieved successfully'
  );

  fleetCache.set(cacheKey, {
    timestamp: now,
    data: responsePayload,
  });

  return res.status(200).json(responsePayload);
});


/**
 * GET /api/v1/gyms/:id
 * Retrieve a specific gym by its Mongo ID, partnerId, slug, ownerId, or 'me'
 */
export const getGymById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let gym;

  // Handle owner alias 'me' or 'my-gym' or 'profile'
  if (id === 'me' || id === 'my-gym' || id === 'profile') {
    if (req.user?.gymId) {
      gym = await Gym.findById(req.user.gymId);
    }
    if (!gym && req.user?._id) {
      gym = await Gym.findOne({ ownerId: req.user._id });
    }
    if (!gym && req.user?.role === USER_ROLES.SUPER_ADMIN) {
      gym = (await Gym.findOne({ partnerId: 'GYM1' })) || (await Gym.findOne({}));
    }
  }

  // Handle Mongo ID (Gym _id or Owner _id)
  if (!gym && mongoose.Types.ObjectId.isValid(id)) {
    gym = await Gym.findById(id);
    if (!gym) {
      gym = await Gym.findOne({ ownerId: id });
    }
    if (!gym && req.user?.role === USER_ROLES.SUPER_ADMIN && String(req.user._id) === String(id)) {
      if (req.user?.gymId) {
        gym = await Gym.findById(req.user.gymId);
      }
      if (!gym) {
        gym = (await Gym.findOne({ partnerId: 'GYM1' })) || (await Gym.findOne({}));
      }
    }
  }

  // Handle partnerId or slug
  if (!gym) {
    gym = await Gym.findOne({
      $or: [{ partnerId: id }, { slug: id }],
    });
  }

  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  const media = resolveGymMediaUrls(gym);
  const sanitized = sanitizeDocument(gym);

  const isSuperAdmin = req.user?.role === USER_ROLES.SUPER_ADMIN;
  const isOwner = req.user && (
    (gym.ownerId && String(gym.ownerId) === String(req.user._id)) ||
    (req.user.gymId && String(gym._id) === String(req.user.gymId))
  );

  if (!isSuperAdmin && !isOwner) {
    delete sanitized.pendingChanges;
    delete sanitized.auditHistory;
  } else if (Array.isArray(sanitized.auditHistory)) {
    sanitized.auditHistory = sanitized.auditHistory.slice(-15).map((log) => ({
      _id: log._id,
      changeType: log.changeType,
      changedBy: log.changedBy,
      changedByRole: log.changedByRole,
      changedAt: log.changedAt,
      field: log.field,
      requestedOn: log.requestedOn,
      approvalStatus: log.approvalStatus,
      adminRemarks: log.adminRemarks,
      reviewedBy: log.reviewedBy,
      reviewedAt: log.reviewedAt,
      editedFields: sanitizeSnapshotForAudit(log.editedFields || {}),
    }));
  }

  // Merge & ensure active approved employee trainers are populated
  try {
    const isObjectId = mongoose.Types.ObjectId.isValid(gym._id);
    const approvedEmployeeTrainers = await Employee.find({
      $or: [
        { gymPartnerId: gym.partnerId },
        { gymId: isObjectId ? gym._id : null },
        { gymId: String(gym._id) },
      ].filter(Boolean),
      role: 'Trainer',
      status: 'Active',
      approvalStatus: 'Approved',
    }).lean();

    if (approvedEmployeeTrainers && approvedEmployeeTrainers.length > 0) {
      const defaultAvatar = 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=400&auto=format&fit=crop';
      sanitized.trainers = approvedEmployeeTrainers.map((emp) => ({
        id: emp.id || emp.employeeId || emp._id,
        _id: emp._id,
        employeeId: emp.employeeId,
        name: emp.name,
        specialty: emp.specialty || emp.previousDesignation || 'Certified Fitness Trainer',
        experienceYears: Number(emp.experienceYears) || 2,
        experience: emp.experience || (emp.experienceYears ? `${emp.experienceYears}+ Years` : '2+ Years'),
        description: emp.description || emp.aboutMe || '',
        aboutMe: emp.aboutMe || emp.description || '',
        servicesOffered: Array.isArray(emp.servicesOffered) ? emp.servicesOffered : [],
        certifications: Array.isArray(emp.certifications) ? emp.certifications : [],
        languages: Array.isArray(emp.languages) ? emp.languages : (emp.languages ? [emp.languages] : ['English', 'Hindi']),
        rating: Number(emp.rating) || 4.9,
        reviewsCount: Number(emp.reviewsCount) || 0,
        ratings: Array.isArray(emp.ratings) ? emp.ratings : [],
        monthlyFee: emp.trainerPricing?.monthly || emp.compensation?.payAmount || 0,
        tierPricing: Array.isArray(emp.tierPricing) && emp.tierPricing.length > 0 ? emp.tierPricing : [],
        trainerPricing: {
          monthly: Number(emp.trainerPricing?.monthly) || 0,
          quarterly: Number(emp.trainerPricing?.quarterly) || 0,
          halfYearly: Number(emp.trainerPricing?.halfYearly) || 0,
          annual: Number(emp.trainerPricing?.annual) || 0,
          singleSession: Number(emp.trainerPricing?.singleSession) || 0,
        },
        schedule: emp.schedule || {
          workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          workingTimeStart: '09:00 AM',
          workingTimeEnd: '06:00 PM',
        },
        avatar: emp.avatar || defaultAvatar,
        imageUrl: emp.avatar || defaultAvatar,
      }));
    } else if (!Array.isArray(sanitized.trainers)) {
      sanitized.trainers = [];
    }
  } catch (err) {
    console.error('[GET_GYM_BY_ID] Error pulling employee trainers from SSOT:', err?.message);
  }

  // Format reviews and ratings with dynamic relative time and bookingType
  if (Array.isArray(sanitized.reviews)) {
    sanitized.reviews = sanitized.reviews.map((rev) => ({
      ...rev,
      date: computeTimeAgo(rev.createdAt || rev.date),
      bookingType: rev.bookingType || 'Member',
    }));
  }
  if (Array.isArray(sanitized.ratings)) {
    sanitized.ratings = sanitized.ratings.map((rev) => ({
      ...rev,
      date: computeTimeAgo(rev.createdAt || rev.date),
      bookingType: rev.bookingType || 'Member',
    }));
  }

  return res.status(200).json(
    ApiResponse.success(
      {
        ...sanitized,
        logoUrl: media.logoUrl,
        coverPhotoUrl: media.coverPhotoUrl,
        imageUrl: media.imageUrl,
        thumbnailImage: media.thumbnailImage,
      },
      'Gym details retrieved successfully'
    )
  );
});

/**
 * Helper to calculate field-level diff between previous gym snapshot and new updates
 */
const calculateGymFieldDiff = (previous, updated) => {
  const diff = {};
  const ignoredKeys = new Set(['_id', 'id', 'key', 'updatedAt', 'createdAt', 'auditHistory', '__v', 'pendingChanges', 'changesCount']);

  Object.keys(updated).forEach((key) => {
    if (ignoredKeys.has(key)) return;
    const oldVal = previous[key];
    const newVal = updated[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal) && newVal !== undefined) {
      diff[key] = {
        oldValue: oldVal !== undefined ? oldVal : null,
        newValue: newVal,
      };
    }
  });

  return diff;
};

/**
 * Helper to recursively sanitize snapshot objects for audit history (strips large media base64)
 */
const sanitizeSnapshotForAudit = (obj = {}) => {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = Array.isArray(obj) ? [] : {};
  const binaryKeys = new Set([
    'logo', 'coverPhoto', 'image', 'images', 'galleryPhotos', 'documents',
    'logoUrl', 'coverPhotoUrl', 'imageUrl', 'thumbnailImage', 'fileData',
  ]);

  Object.entries(obj).forEach(([k, v]) => {
    if (binaryKeys.has(k)) {
      clean[k] = v ? '[Media Asset]' : null;
    } else if (typeof v === 'string' && v.length > 500) {
      clean[k] = v.startsWith('data:') ? '[Media Base64]' : v.substring(0, 200) + '...';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitizeSnapshotForAudit(v);
    } else {
      clean[k] = v;
    }
  });
  return clean;
};

/**
 * Apply sanitized changes into a live gym mongoose document
 */
const applyChangesToGymDocument = async (gym, changes) => {
  if (!changes || typeof changes !== 'object') return;

  // Basic Information
  if (changes.name || changes.gymName) gym.name = (changes.name || changes.gymName).trim();
  if (changes.tagline !== undefined) gym.tagline = changes.tagline;
  if (changes.ownerName) gym.ownerName = changes.ownerName.trim();
  if (changes.phone) gym.phone = changes.phone.trim();
  if (changes.email) gym.email = changes.email.trim().toLowerCase();
  if (changes.businessType) gym.businessType = changes.businessType;
  if (changes.yearEstablished !== undefined) gym.yearEstablished = changes.yearEstablished;
  if (changes.gstNumber !== undefined) gym.gstNumber = changes.gstNumber.trim().toUpperCase();
  if (changes.panNumber !== undefined) gym.panNumber = changes.panNumber.trim().toUpperCase();
  if (changes.subscriptionType) gym.subscriptionType = changes.subscriptionType;
  if (changes.commissionRate !== undefined) gym.commissionRate = Number(changes.commissionRate);
  if (changes.settlementCycle) gym.settlementCycle = changes.settlementCycle;
  if (changes.branches) gym.branches = changes.branches;

  // Location & Address
  if (changes.address) gym.address = changes.address.trim();
  if (changes.area !== undefined) gym.area = changes.area.trim();
  if (changes.city) gym.city = changes.city.trim();
  if (changes.state !== undefined) gym.state = changes.state.trim();
  if (changes.pincode !== undefined) gym.pincode = changes.pincode.trim();
  if (changes.landmark !== undefined) gym.landmark = changes.landmark.trim();
  if (changes.fullAddress !== undefined) gym.fullAddress = changes.fullAddress;
  if (changes.googleMapsUrl) gym.googleMapsUrl = changes.googleMapsUrl;

  if (changes.lat !== undefined || changes.lng !== undefined || changes.googleMapsUrl) {
    const parsedCoords = extractCoordinatesFromMapsUrl(changes.googleMapsUrl || gym.googleMapsUrl);
    const latitude = Number(changes.lat) || (parsedCoords ? parsedCoords.lat : (gym.location?.coordinates ? gym.location.coordinates[1] : 13.0827));
    const longitude = Number(changes.lng) || (parsedCoords ? parsedCoords.lng : (gym.location?.coordinates ? gym.location.coordinates[0] : 80.2707));
    gym.location = {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
  }

  // Facility, Capacity & Specs
  if (changes.floorSpaceSqFt !== undefined) gym.floorSpaceSqFt = Number(changes.floorSpaceSqFt);
  if (changes.maxFloorCapacity !== undefined) gym.maxFloorCapacity = Number(changes.maxFloorCapacity);
  if (changes.genderAllowed) gym.genderAllowed = changes.genderAllowed;
  if (changes.facilities !== undefined) {
    gym.facilities = changes.facilities;
    gym.customFacilities = (Array.isArray(changes.facilities) ? changes.facilities : []).map((f, idx) => ({
      id: `fac-${idx}`,
      name: typeof f === 'string' ? f : f?.name || String(f),
      category: 'General',
      status: 'Active',
      count: 1,
    }));
  } else if (changes.customFacilities !== undefined) {
    gym.customFacilities = changes.customFacilities;
  }
  if (changes.slotDurationMinutes !== undefined) gym.slotDurationMinutes = Number(changes.slotDurationMinutes);
  if (changes.maxSlotCapacity !== undefined) gym.maxSlotCapacity = Number(changes.maxSlotCapacity);
  if (changes.slotsMorning !== undefined) gym.slotsMorning = changes.slotsMorning;
  if (changes.slotsEvening !== undefined) gym.slotsEvening = changes.slotsEvening;
  if (changes.freeCancellationHours !== undefined) gym.freeCancellationHours = Number(changes.freeCancellationHours);
  if (changes.refundPercentage !== undefined) gym.refundPercentage = Number(changes.refundPercentage);
  if (changes.rescheduleAllowedCount !== undefined) gym.rescheduleAllowedCount = Number(changes.rescheduleAllowedCount);

  // Pricing Plans (4 Standardized Tiers: Monthly, Quarterly, Half-Yearly, Annual)
  if (changes.customPricingPlans !== undefined && Array.isArray(changes.customPricingPlans)) {
    const standardCustomPlans = buildStandardCustomPricingPlans(gym.pricingPlans || {}, changes.customPricingPlans);
    gym.customPricingPlans = standardCustomPlans;

    const mPlan = standardCustomPlans.find((p) => p.tierId === 'monthly');
    const qPlan = standardCustomPlans.find((p) => p.tierId === 'quarterly');
    const hPlan = standardCustomPlans.find((p) => p.tierId === 'half_yearly');
    const aPlan = standardCustomPlans.find((p) => p.tierId === 'annual');

    gym.pricingPlans = {
      ...(gym.pricingPlans || {}),
      monthly: mPlan ? mPlan.price : (gym.pricingPlans?.monthly || 1299),
      quarterly: qPlan ? qPlan.price : (gym.pricingPlans?.quarterly || 3299),
      halfYearly: hPlan ? hPlan.price : (gym.pricingPlans?.halfYearly || 5999),
      annual: aPlan ? aPlan.price : (gym.pricingPlans?.annual || 11999),
    };
  } else if (changes.pricingPlans && typeof changes.pricingPlans === 'object') {
    gym.pricingPlans = { ...(gym.pricingPlans || {}), ...changes.pricingPlans };
    gym.customPricingPlans = buildStandardCustomPricingPlans(gym.pricingPlans, gym.customPricingPlans);
  }

  if (changes.singleSessionBookingEnabled !== undefined) {
    gym.singleSessionBookingEnabled = Boolean(changes.singleSessionBookingEnabled);
  }
  if (changes.enabledSessionCategories !== undefined) {
    gym.enabledSessionCategories = Array.isArray(changes.enabledSessionCategories)
      ? changes.enabledSessionCategories
      : [];
  }
  if (changes.singleSessionPrice !== undefined) {
    gym.singleSessionPrice = Number(changes.singleSessionPrice);
    if (!gym.pricingPlans) gym.pricingPlans = {};
    gym.pricingPlans.singleSession = Number(changes.singleSessionPrice);
  }

  // Operations & Schedule
  if (
    changes.openingHours ||
    changes.schedule ||
    changes.holidays ||
    changes.weekdayOpen ||
    changes.weekdayClose ||
    changes.weekendOpen ||
    changes.weekendClose ||
    changes.morningOpen ||
    changes.morningClose ||
    changes.eveningOpen ||
    changes.eveningClose ||
    changes.mode ||
    changes.isSplitShift !== undefined ||
    changes.is24Hours !== undefined
  ) {
    const existingHours = gym.openingHours?.toObject
      ? gym.openingHours.toObject()
      : (gym.openingHours || {});
    const incomingHours = changes.openingHours || {};

    const rawHours = {
      ...existingHours,
      ...incomingHours,
    };

    if (changes.weekdayOpen) rawHours.weekdayOpen = changes.weekdayOpen;
    if (changes.weekdayClose) rawHours.weekdayClose = changes.weekdayClose;
    if (changes.weekendOpen) rawHours.weekendOpen = changes.weekendOpen;
    if (changes.weekendClose) rawHours.weekendClose = changes.weekendClose;
    if (changes.morningOpen) rawHours.morningOpen = changes.morningOpen;
    if (changes.morningClose) rawHours.morningClose = changes.morningClose;
    if (changes.eveningOpen) rawHours.eveningOpen = changes.eveningOpen;
    if (changes.eveningClose) rawHours.eveningClose = changes.eveningClose;
    if (changes.mode) rawHours.mode = changes.mode;
    if (changes.isSplitShift !== undefined) rawHours.isSplitShift = Boolean(changes.isSplitShift);
    if (changes.is24Hours !== undefined) rawHours.is24Hours = Boolean(changes.is24Hours);
    if (changes.isOpenHolidays !== undefined) rawHours.isOpenHolidays = Boolean(changes.isOpenHolidays);
    if (changes.schedule !== undefined) rawHours.schedule = changes.schedule;
    if (changes.holidays !== undefined) rawHours.holidays = changes.holidays;

    gym.openingHours = normalizeOpeningHours(rawHours);
  }

  // Bank Details
  if (changes.bankDetails || changes.accountHolder || changes.bankName || changes.accountNumber || changes.ifscCode || changes.upiId || changes.accountType || changes.branch) {
    const rawBank = changes.bankDetails || {};
    gym.bankDetails = {
      ...(gym.bankDetails || {}),
      accountHolder: changes.accountHolder !== undefined ? changes.accountHolder : (rawBank.accountHolder !== undefined ? rawBank.accountHolder : gym.bankDetails?.accountHolder),
      bankName: changes.bankName !== undefined ? changes.bankName : (rawBank.bankName !== undefined ? rawBank.bankName : gym.bankDetails?.bankName),
      accountNumber: changes.accountNumber !== undefined ? changes.accountNumber : (rawBank.accountNumber !== undefined ? rawBank.accountNumber : gym.bankDetails?.accountNumber),
      ifscCode: changes.ifscCode !== undefined ? changes.ifscCode : (rawBank.ifscCode !== undefined ? rawBank.ifscCode : gym.bankDetails?.ifscCode),
      upiId: changes.upiId !== undefined ? changes.upiId : (rawBank.upiId !== undefined ? rawBank.upiId : gym.bankDetails?.upiId),
      accountType: changes.accountType !== undefined ? changes.accountType : (rawBank.accountType !== undefined ? rawBank.accountType : gym.bankDetails?.accountType),
      branch: changes.branch !== undefined ? changes.branch : (rawBank.branch !== undefined ? rawBank.branch : gym.bankDetails?.branch),
      payoutSchedule: changes.payoutSchedule !== undefined ? changes.payoutSchedule : (rawBank.payoutSchedule !== undefined ? rawBank.payoutSchedule : gym.bankDetails?.payoutSchedule),
      gstInvoiceEnabled: changes.gstInvoiceEnabled !== undefined ? Boolean(changes.gstInvoiceEnabled) : (rawBank.gstInvoiceEnabled !== undefined ? Boolean(rawBank.gstInvoiceEnabled) : gym.bankDetails?.gstInvoiceEnabled),
    };
  }

  // Social Links
  if (changes.socialLinks || changes.instagram || changes.instagramHandle || changes.facebook || changes.youtube || changes.whatsapp || changes.website || changes.googleBusinessUrl) {
    const rawSocial = changes.socialLinks || {};
    gym.socialLinks = {
      ...(gym.socialLinks || {}),
      instagram: changes.instagram !== undefined ? changes.instagram : (rawSocial.instagram !== undefined ? rawSocial.instagram : gym.socialLinks?.instagram),
      instagramHandle: changes.instagramHandle !== undefined ? changes.instagramHandle : (rawSocial.instagramHandle !== undefined ? rawSocial.instagramHandle : gym.socialLinks?.instagramHandle),
      facebook: changes.facebook !== undefined ? changes.facebook : (rawSocial.facebook !== undefined ? rawSocial.facebook : gym.socialLinks?.facebook),
      youtube: changes.youtube !== undefined ? changes.youtube : (rawSocial.youtube !== undefined ? rawSocial.youtube : gym.socialLinks?.youtube),
      whatsapp: changes.whatsapp !== undefined ? changes.whatsapp : (rawSocial.whatsapp !== undefined ? rawSocial.whatsapp : gym.socialLinks?.whatsapp),
      website: changes.website !== undefined ? changes.website : (rawSocial.website !== undefined ? rawSocial.website : gym.socialLinks?.website),
      googleBusinessUrl: changes.googleBusinessUrl !== undefined ? changes.googleBusinessUrl : (rawSocial.googleBusinessUrl !== undefined ? rawSocial.googleBusinessUrl : gym.socialLinks?.googleBusinessUrl),
      googleRating: changes.googleRating !== undefined ? changes.googleRating : (rawSocial.googleRating !== undefined ? rawSocial.googleRating : gym.socialLinks?.googleRating),
      googleReviewCount: changes.googleReviewCount !== undefined ? changes.googleReviewCount : (rawSocial.googleReviewCount !== undefined ? rawSocial.googleReviewCount : gym.socialLinks?.googleReviewCount),
    };
  }

  // System Settings
  if (changes.systemSettings && typeof changes.systemSettings === 'object') {
    gym.systemSettings = { ...(gym.systemSettings || {}), ...changes.systemSettings };
  }

  // Media
  if (changes.logo) {
    if (typeof changes.logo === 'object' && changes.logo.fileData) {
      gym.logo = changes.logo;
    } else {
      gym.logo = await formatAndCompressFile(gym.name, 'logo', changes.logo);
    }
  }
  if (changes.coverPhoto) {
    if (typeof changes.coverPhoto === 'object' && changes.coverPhoto.fileData) {
      gym.coverPhoto = changes.coverPhoto;
    } else {
      gym.coverPhoto = await formatAndCompressFile(gym.name, 'cover', changes.coverPhoto);
    }
  }
  if (changes.galleryPhotos && Array.isArray(changes.galleryPhotos)) {
    const rawNewGallery = changes.galleryPhotos;
    const structured = (
      await Promise.all(
        rawNewGallery.map((img, i) => {
          if (typeof img === 'object' && img.fileData) return img;
          return formatAndCompressFile(gym.name, `gallery_${i + 1}`, img);
        })
      )
    ).filter(Boolean);
    gym.galleryPhotos = structured;
  }
};

/**
 * PUT /api/v1/gyms/:id
 * PATCH /api/v1/gyms/:id
 * Update general gym profile with mandatory Super Admin approval requirement for Partner Owners
 */
export const updateGym = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let gym;
  if (id === 'me' || id === 'my-gym' || id === 'profile') {
    if (req.user?.gymId) {
      gym = await Gym.findById(req.user.gymId);
    }
    if (!gym && req.user?._id) {
      gym = await Gym.findOne({ ownerId: req.user._id });
    }
  }

  if (!gym && mongoose.Types.ObjectId.isValid(id)) {
    gym = await Gym.findById(id);
    if (!gym) {
      gym = await Gym.findOne({ ownerId: id });
    }
  }

  if (!gym) {
    gym = await Gym.findOne({
      $or: [{ partnerId: id }, { slug: id }],
    });
  }

  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  // Check authorization for Gym Owner
  const isSuperAdmin = req.user.role === USER_ROLES.SUPER_ADMIN;
  console.log(`[DEBUG updateGym] User: ${req.user.email}, Role: "${req.user.role}", isSuperAdmin: ${isSuperAdmin}, USER_ROLES.SUPER_ADMIN: "${USER_ROLES.SUPER_ADMIN}"`);
  if (!isSuperAdmin) {
    const isOwner =
      (gym.ownerId && String(gym.ownerId) === String(req.user._id)) ||
      (req.user.gymId && String(gym._id) === String(req.user.gymId));
    if (!isOwner) {
      throw ApiError.forbidden('You are not authorized to update this gym.');
    }
  }

  const isGymOwner =
    (gym.ownerId && String(gym.ownerId) === String(req.user._id)) ||
    (req.user.gymId && String(gym._id) === String(req.user.gymId)) ||
    req.user.role === USER_ROLES.GYM_OWNER ||
    req.user.accessType === 'Admin';

  // Check if caller is a Manager with delegated profile edit permissions
  let isManagerWithoutApproval = false;
  if (!isSuperAdmin && !isGymOwner) {
    const callerEmployee = await Employee.findOne({
      $or: [{ phone: req.user?.phone }, { email: req.user?.email }, { userId: req.user?._id }],
      gymId: gym._id,
    });
    if (callerEmployee?.managerPermissions?.requireProfileEditApproval === false) {
      isManagerWithoutApproval = true;
    }
  }

  const shouldDirectApply = isSuperAdmin || isGymOwner || isManagerWithoutApproval;
  const updates = req.body;
  const currentSnapshot = gym.toObject();

  if (shouldDirectApply) {
    // Direct edit: apply changes immediately and preserve Approved status
    await applyChangesToGymDocument(gym, updates);
    gym.pendingChanges = null;
    gym.approvalStatus = 'Approved';
    gym.status = gym.status || 'Active';
    gym.changesCount = 0;

    const changedByName = req.user.fullName || req.user.name || (isSuperAdmin ? 'Super Admin' : 'Gym Admin');

    if (!gym.auditHistory) gym.auditHistory = [];
    gym.auditHistory.unshift({
      changeType: isSuperAdmin ? 'SUPER_ADMIN_DIRECT_EDIT' : 'GYM_ADMIN_DIRECT_EDIT',
      changedBy: changedByName,
      changedByRole: req.user.role || 'GYM_OWNER',
      changedAt: new Date(),
      requestedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      field: 'Direct Gym Profile Update',
      editedFields: { directUpdate: { oldValue: null, newValue: `Updated directly by ${changedByName}` } },
      previousSnapshot: {},
      newSnapshot: {},
      approvalStatus: 'Approved',
      reviewedBy: req.user.email || changedByName,
      reviewedAt: new Date(),
      adminRemarks: `Directly applied by ${changedByName}`,
    });
    gym.auditHistory = gym.auditHistory.slice(0, 10);

    await gym.save();
    clearFleetCache();

    return res.status(200).json(
      ApiResponse.success(sanitizeDocument(gym), 'Gym details updated successfully.')
    );
  }

  // Manager edit requiring Gym Admin approval
  const proposedChanges = { ...updates };
  const changedByName = req.user.fullName || req.user.name || 'Gym Manager';

  gym.pendingManagerEdits = {
    submittedBy: req.user._id,
    submittedByName: changedByName,
    submittedAt: new Date(),
    edits: proposedChanges,
    status: 'PENDING_ADMIN_APPROVAL',
    adminRemarks: '',
  };

  await gym.save();
  clearFleetCache();

  return res.status(200).json(
    ApiResponse.success(
      sanitizeDocument(gym),
      'Gym profile changes submitted successfully. Pending Gym Admin approval.'
    )
  );
});

/**
 * PUT /api/v1/gyms/:id/trainer-pricing
 * Update trainer-to-membership tier pricing mapping for active trainers in a gym
 */
export const updateGymTrainerPricing = asyncHandler(async (req, res) => {
  const id = req.params.id || req.params.gymId;
  const { trainerPricing, trainers } = req.body;

  let gym = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    gym = await Gym.findById(id);
  }
  if (!gym) {
    gym = await Gym.findOne({ partnerId: id });
  }
  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  // Authorization check: Owner or Super Admin
  const isSuperAdmin =
    req.user?.role === USER_ROLES.SUPER_ADMIN ||
    req.user?.role === 'Super Admin' ||
    req.user?.role === 'SUPER_ADMIN';

  if (!isSuperAdmin) {
    const isOwner =
      (gym.ownerId && String(gym.ownerId) === String(req.user?.userId || req.user?._id)) ||
      (req.user?.gymId && (String(req.user.gymId) === String(gym._id) || req.user.gymId === gym.partnerId)) ||
      req.user?.role === USER_ROLES.GYM_OWNER ||
      req.user?.role === 'Gym Owner' ||
      req.user?.role === 'GYM_OWNER';
    if (!isOwner) {
      throw ApiError.forbidden('You do not have permission to update trainer pricing for this gym.');
    }
  }

  const items = Array.isArray(trainerPricing) ? trainerPricing : (Array.isArray(trainers) ? trainers : []);
  if (items.length === 0) {
    throw ApiError.badRequest('No trainer pricing updates provided.');
  }

  const updatedTrainers = [];
  for (const item of items) {
    const empIdentifier = item.employeeId || item.id || item._id;
    if (!empIdentifier) continue;

    const empQueryOr = [{ employeeId: String(empIdentifier) }];
    if (mongoose.Types.ObjectId.isValid(empIdentifier)) {
      empQueryOr.push({ _id: empIdentifier });
    }

    const gymQueryOr = [{ gymId: gym._id }, { gymId: String(gym._id) }];
    if (gym.partnerId) {
      gymQueryOr.push({ gymPartnerId: gym.partnerId });
    }

    const employee = await Employee.findOne({
      $or: empQueryOr,
      $and: [{ $or: gymQueryOr }],
    });
    if (!employee) continue;

    const pricingObj = item.trainerPricing || item.pricing || {};
    employee.trainerPricing = {
      monthly: Number(pricingObj.monthly) >= 0 ? Number(pricingObj.monthly) : (employee.trainerPricing?.monthly || 0),
      quarterly: Number(pricingObj.quarterly) >= 0 ? Number(pricingObj.quarterly) : (employee.trainerPricing?.quarterly || 0),
      halfYearly: Number(pricingObj.halfYearly) >= 0 ? Number(pricingObj.halfYearly) : (employee.trainerPricing?.halfYearly || 0),
      annual: Number(pricingObj.annual) >= 0 ? Number(pricingObj.annual) : (employee.trainerPricing?.annual || 0),
      singleSession: Number(pricingObj.singleSession) >= 0 ? Number(pricingObj.singleSession) : (employee.trainerPricing?.singleSession || 0),
    };

    employee.markModified('trainerPricing');
    await employee.save();
    updatedTrainers.push(employee);
  }

  await syncGymTrainersFromEmployees(gym.partnerId || gym._id);

  const freshGym = await Gym.findById(gym._id).lean();
  return res.status(200).json(
    ApiResponse.success(
      {
        trainers: freshGym?.trainers || [],
        count: updatedTrainers.length,
      },
      'Trainer tier pricing updated and synchronized successfully.'
    )
  );
});

/**
 * PATCH /api/v1/gyms/:id/status
 * Super Admin Decision Engine: Approve, Hold, or Reject Gym Registration / Edits
 */
export const updateGymStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, approvalStatus, rejectionReason, remark, notes } = req.body;

  let gym;
  if (mongoose.Types.ObjectId.isValid(id)) {
    gym = await Gym.findById(id);
  }
  if (!gym) {
    gym = await Gym.findOne({
      $or: [{ partnerId: id }, { slug: id }],
    });
  }

  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  let finalRemark = rejectionReason;
  if (notes !== undefined) finalRemark = notes;
  if (remark !== undefined) finalRemark = remark;
  const reviewerName = req.user?.fullName || req.user?.name || req.user?.email || 'Super Admin';

  if (approvalStatus === 'Approved') {
    // 1. If there are pending changes submitted by owner, apply them to the live gym document
    if (gym.pendingChanges && typeof gym.pendingChanges === 'object') {
      await applyChangesToGymDocument(gym, gym.pendingChanges);
      gym.pendingChanges = null;
    }

    gym.approvalStatus = 'Approved';
    gym.status = 'Active';
    gym.changesCount = 0;
    gym.remark = finalRemark || 'Approved and published by Super Admin';

    if (!gym.partnerId) {
      const partnerSeq = await Counter.getNextSequence('gym_partner_id');
      gym.partnerId = `GYM${partnerSeq}`;
    }

    // Mark all pending audit records as Approved
    if (gym.auditHistory && Array.isArray(gym.auditHistory)) {
      gym.auditHistory.forEach((log) => {
        if (log.approvalStatus === 'Pending Approval' || log.approvalStatus === 'Pending Admin Review') {
          log.approvalStatus = 'Approved';
          log.reviewedBy = reviewerName;
          log.reviewedAt = new Date();
          log.adminRemarks = finalRemark || 'Approved by Super Administrator';
        }
      });
    }
  } else if (approvalStatus === 'Rejected') {
    // Reject pending changes
    gym.pendingChanges = null;
    gym.changesCount = 0;
    gym.remark = finalRemark || 'Rejected during Super Admin inspection';
    gym.rejectionReason = finalRemark || 'Rejected during Super Admin inspection';

    if (gym.partnerId) {
      // Existing active partner: keep status active but discard the rejected edits
      gym.approvalStatus = 'Approved';
      gym.status = 'Active';
    } else {
      // New onboard application rejected
      gym.approvalStatus = 'Rejected';
      gym.status = 'Rejected';
    }

    // Mark pending audit records as Rejected
    if (gym.auditHistory && Array.isArray(gym.auditHistory)) {
      gym.auditHistory.forEach((log) => {
        if (log.approvalStatus === 'Pending Approval' || log.approvalStatus === 'Pending Admin Review') {
          log.approvalStatus = 'Rejected';
          log.reviewedBy = reviewerName;
          log.reviewedAt = new Date();
          log.adminRemarks = finalRemark || 'Rejected by Super Administrator';
        }
      });
    }
  } else if (approvalStatus === 'On Hold') {
    gym.approvalStatus = 'On Hold';
    gym.status = 'On Hold';
    if (finalRemark !== undefined) {
      gym.remark = finalRemark;
    }
  } else if (approvalStatus === 'Pending Approval') {
    gym.approvalStatus = 'Pending Approval';
    gym.status = 'Pending';
  } else if (status && !approvalStatus) {
    gym.status = status;
  }

  try {
    await gym.save();
  } catch (saveErr) {
    if (saveErr.name === 'VersionError') {
      const freshDoc = await Gym.findById(gym._id);
      if (freshDoc) {
        freshDoc.status = gym.status;
        freshDoc.approvalStatus = gym.approvalStatus;
        if (gym.partnerId) freshDoc.partnerId = gym.partnerId;
        if (gym.remark !== undefined) freshDoc.remark = gym.remark;
        if (gym.rejectionReason !== undefined) freshDoc.rejectionReason = gym.rejectionReason;
        freshDoc.pendingChanges = gym.pendingChanges;
        freshDoc.changesCount = gym.changesCount;
        freshDoc.auditHistory = gym.auditHistory;
        await freshDoc.save();
        gym = freshDoc;
      }
    } else {
      throw saveErr;
    }
  }
  clearFleetCache();

  return res.status(200).json(
    ApiResponse.success(
      sanitizeDocument(gym),
      `Gym status updated to ${gym.status} (${gym.approvalStatus}). Changes synchronized.`
    )
  );
});

/**
 * POST /api/v1/gyms/:id/resubmit
 * Partner Owner resubmits their application back into "Pending Approval"
 */
export const resubmitGymApplication = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, remark } = req.body;

  let gym;
  if (mongoose.Types.ObjectId.isValid(id)) {
    gym = await Gym.findById(id);
  }
  if (!gym) {
    gym = await Gym.findOne({
      $or: [{ partnerId: id }, { slug: id }],
    });
  }

  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  // Authorization check for Gym Owner
  if (req.user.role === USER_ROLES.GYM_OWNER) {
    const isOwner =
      (gym.ownerId && String(gym.ownerId) === String(req.user._id)) ||
      (req.user.gymId && String(gym._id) === String(req.user.gymId));
    if (!isOwner) {
      throw ApiError.forbidden('You are not authorized to resubmit this gym application.');
    }
  }

  gym.approvalStatus = 'Pending Approval';
  gym.status = 'Pending';
  if (notes !== undefined || remark !== undefined) {
    gym.remark = notes || remark || '';
    gym.rejectionReason = notes || remark || '';
  }

  await gym.save();
  clearFleetCache();

  return res.status(200).json(
    ApiResponse.success(
      sanitizeDocument(gym),
      'Gym application resubmitted successfully. It is now awaiting review.'
    )
  );
});

/**
 * DELETE /api/v1/gyms/:id
 * Delete a gym and its associated owner account
 */
export const deleteGym = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let gym;
  if (mongoose.Types.ObjectId.isValid(id)) {
    gym = await Gym.findById(id);
  }
  if (!gym) {
    gym = await Gym.findOne({
      $or: [{ partnerId: id }, { slug: id }],
    });
  }

  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  const gymName = gym.name;
  const ownerId = gym.ownerId;

  await Gym.findByIdAndDelete(gym._id);
  if (ownerId) {
    await User.findByIdAndDelete(ownerId);
  }
  clearFleetCache();

  return res.status(200).json(
    ApiResponse.success(null, `Gym "${gymName}" and associated partner account deleted successfully`)
  );
});

/**
 * Get active approved trainers for a gym (from Employee SSOT with embedded fallback)
 * GET /api/v1/gyms/:id/trainers
 */
export const getGymTrainers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  let gym;
  if (mongoose.Types.ObjectId.isValid(id)) {
    gym = await Gym.findById(id);
  }
  if (!gym) {
    gym = await Gym.findOne({ $or: [{ partnerId: id }, { slug: id }] });
  }
  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  const isObjectId = mongoose.Types.ObjectId.isValid(gym._id);
  const approvedEmployeeTrainers = await Employee.find({
    $or: [
      { gymPartnerId: gym.partnerId },
      { gymId: isObjectId ? gym._id : null },
      { gymId: String(gym._id) },
    ].filter(Boolean),
    role: { $regex: /^trainer$/i },
    status: 'Active',
    approvalStatus: 'Approved',
  }).lean();

  const defaultAvatar = 'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=400&auto=format&fit=crop';
  let trainers = [];

  if (approvedEmployeeTrainers && approvedEmployeeTrainers.length > 0) {
    trainers = approvedEmployeeTrainers.map((emp) => ({
      id: emp.id || emp.employeeId || emp._id,
      _id: emp._id,
      employeeId: emp.employeeId,
      name: emp.name,
      specialty: emp.specialty || emp.previousDesignation || 'Certified Fitness Trainer',
      experienceYears: Number(emp.experienceYears) || 2,
      experience: emp.experience || (emp.experienceYears ? `${emp.experienceYears}+ Years` : '2+ Years'),
      description: emp.description || emp.aboutMe || '',
      aboutMe: emp.aboutMe || emp.description || '',
      servicesOffered: Array.isArray(emp.servicesOffered) ? emp.servicesOffered : [],
      certifications: Array.isArray(emp.certifications) ? emp.certifications : [],
      languages: Array.isArray(emp.languages) ? emp.languages : (emp.languages ? [emp.languages] : ['English', 'Hindi']),
      rating: Number(emp.rating) || 4.9,
      reviewsCount: Number(emp.reviewsCount) || 0,
      ratings: Array.isArray(emp.ratings) ? emp.ratings : [],
      monthlyFee: emp.trainerPricing?.monthly || emp.compensation?.payAmount || 0,
      tierPricing: Array.isArray(emp.tierPricing) && emp.tierPricing.length > 0 ? emp.tierPricing : [],
      trainerPricing: {
        monthly: Number(emp.trainerPricing?.monthly) || 0,
        quarterly: Number(emp.trainerPricing?.quarterly) || 0,
        halfYearly: Number(emp.trainerPricing?.halfYearly) || 0,
        annual: Number(emp.trainerPricing?.annual) || 0,
        singleSession: Number(emp.trainerPricing?.singleSession) || 0,
      },
      schedule: emp.schedule || {
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        workingTimeStart: '09:00 AM',
        workingTimeEnd: '06:00 PM',
      },
      avatar: emp.avatar || defaultAvatar,
      imageUrl: emp.avatar || defaultAvatar,
      image: emp.avatar || defaultAvatar,
    }));
  } else if (Array.isArray(gym.trainers) && gym.trainers.length > 0) {
    trainers = gym.trainers.map((t) => ({
      id: t.employeeId || t.name,
      _id: t.employeeId || t.name,
      employeeId: t.employeeId || '',
      name: t.name,
      specialty: t.specialty || 'Certified Fitness Trainer',
      experienceYears: t.experienceYears || 2,
      experience: t.experience || (t.experienceYears ? `${t.experienceYears}+ Years` : '2+ Years'),
      description: t.description || t.aboutMe || '',
      aboutMe: t.aboutMe || t.description || '',
      servicesOffered: Array.isArray(t.servicesOffered) ? t.servicesOffered : [],
      certifications: Array.isArray(t.certifications) ? t.certifications : [],
      languages: Array.isArray(t.languages) ? t.languages : (t.languages ? [t.languages] : ['English', 'Hindi']),
      rating: t.rating || 4.9,
      reviewsCount: t.reviewsCount || 0,
      monthlyFee: t.monthlyFee || 0,
      tierPricing: t.tierPricing || [],
      trainerPricing: t.trainerPricing || {},
      schedule: t.schedule || {
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        workingTimeStart: '09:00 AM',
        workingTimeEnd: '06:00 PM',
      },
      avatar: t.imageUrl || defaultAvatar,
      imageUrl: t.imageUrl || defaultAvatar,
      image: t.imageUrl || defaultAvatar,
    }));
  }

  return res.status(200).json(
    ApiResponse.success(trainers, 'Gym trainers retrieved successfully.')
  );
});

/**
 * GET /api/v1/gyms/options or /api/v1/admin/gyms/options
 * Separate, lightweight lookup API for gym dropdowns with search and pagination support
 */
export const getGymOptions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search = '', status } = req.query;

  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = {};

  if (status && status !== 'All') {
    query.status = status;
  }

  if (search && search.trim()) {
    const s = search.trim();
    const searchRegex = new RegExp(s, 'i');
    query.$or = [
      { name: searchRegex },
      { partnerId: searchRegex },
      { city: searchRegex },
      { area: searchRegex },
    ];
  }

  const [total, gyms] = await Promise.all([
    Gym.countDocuments(query),
    Gym.find(query)
      .select('_id partnerId name city area address status approvalStatus')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  const hasMore = skip + gyms.length < total;

  return res.status(200).json(
    ApiResponse.success(
      {
        gyms,
        page: pageNum,
        limit: limitNum,
        total,
        hasMore,
      },
      'Gym options retrieved successfully.'
    )
  );
});

/**
 * Gym Owner: Scoped Financial Transactions & Payments Endpoint
 * Retrieves paginated transactions & summary statistics for this gym alone.
 */
export const getGymTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, search, paymentMode, status } = req.query;

  let targetGym = null;

  // Handle owner alias 'me' or 'my-gym' or 'profile'
  if (id === 'me' || id === 'my-gym' || id === 'profile') {
    if (req.user?.gymId) {
      targetGym = await Gym.findById(req.user.gymId);
    }
    if (!targetGym && req.user?._id) {
      targetGym = await Gym.findOne({ ownerId: req.user._id });
    }
  } else if (mongoose.Types.ObjectId.isValid(id)) {
    targetGym = await Gym.findById(id);
    if (!targetGym) {
      targetGym = await Gym.findOne({ ownerId: id });
    }
  } else {
    targetGym = await Gym.findOne({ partnerId: id });
  }

  const gymId = targetGym ? targetGym._id : (mongoose.Types.ObjectId.isValid(id) ? id : null);
  if (!gymId) {
    throw new ApiError(404, 'Gym partner not found');
  }

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
      {
        ...result,
        gym: {
          id: targetGym?._id || gymId,
          name: targetGym?.name || 'Partner Gym',
          partnerId: targetGym?.partnerId || '',
          city: targetGym?.city || '',
        },
      },
      'Gym transactions retrieved successfully'
    )
  );
});

/**
 * Gym Owner: Scoped Overview Dashboard Statistics & Recent Activity
 * Computes live metrics and maps recent bookings & memberships for this gym alone.
 */
export const getGymDashboardStats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { range } = req.query;

  let targetGym = null;

  // Resolve gym: handle 'me', 'my-gym', 'profile', ObjectId, partnerId
  if (id === 'me' || id === 'my-gym' || id === 'profile') {
    if (req.user?.gymId) {
      targetGym = await Gym.findById(req.user.gymId);
    }
    if (!targetGym && req.user?._id) {
      targetGym = await Gym.findOne({ ownerId: req.user._id });
    }
  } else if (mongoose.Types.ObjectId.isValid(id)) {
    targetGym = await Gym.findById(id);
    if (!targetGym) {
      targetGym = await Gym.findOne({ ownerId: id });
    }
  } else {
    targetGym = await Gym.findOne({ partnerId: id });
  }

  const gymId = targetGym ? targetGym._id : (mongoose.Types.ObjectId.isValid(id) ? id : null);
  if (!gymId) {
    throw new ApiError(404, 'Gym partner not found');
  }

  const gymObjectId = new mongoose.Types.ObjectId(gymId);

  // Parallel database queries
  const [gymDoc, bookings, memberships] = await Promise.all([
    targetGym ? targetGym : Gym.findById(gymObjectId).lean(),
    Booking.find({ gymId: gymObjectId })
      .populate('userId', 'fullName name email phone avatar profilePicture customerId')
      .sort({ createdAt: -1 })
      .lean(),
    Membership.find({ gymId: gymObjectId })
      .populate('userId', 'fullName name email phone avatar profilePicture customerId')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // Aggregate metrics
  let memberRevenue = 0;
  let activeMembersCount = 0;
  const userIdsSet = new Set();

  for (const m of memberships) {
    if (m.userId) {
      const uId = m.userId._id || m.userId.id || m.userId;
      if (uId) userIdsSet.add(String(uId));
    }
    // Only active plan subscriptions (excludes Switched and Cancelled)
    if (['Active', 'Upcoming', 'Expiring Soon'].includes(m.status)) {
      activeMembersCount++;
      if (m.payment?.status !== 'Failed' && m.payment?.status !== 'Refunded') {
        const amt = Number(m.pricing?.totalAmount || m.totalAmount || 0);
        memberRevenue += amt;
      }
    }
  }

  let appBookingRevenue = 0;
  let completedBookingsCount = 0;

  for (const b of bookings) {
    if (b.userId) {
      const uId = b.userId._id || b.userId.id || b.userId;
      if (uId) userIdsSet.add(String(uId));
    }
    if (b.payment?.status !== 'Failed' && b.payment?.status !== 'Refunded' && b.status !== 'Cancelled') {
      const amt = Number(b.pricing?.totalAmount || b.totalAmount || 0);
      appBookingRevenue += amt;
    }
    if (b.status === 'Completed') {
      completedBookingsCount++;
    }
  }

  const totalRevenue = memberRevenue + appBookingRevenue;
  // Option A: Real App Users (unique customer accounts who have booked or bought passes at this gym)
  const totalActiveUsers = userIdsSet.size;

  const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop';

  // Map Recent Bookings (top 4)
  const recentBookings = bookings.slice(0, 4).map((b) => {
    const user = b.userId || {};
    const userName = user.fullName || user.name || 'Member';
    const userPhone = user.phone || '—';
    const avatar = user.avatar || user.profilePicture || defaultAvatar;

    let timeDisplay = b.timeSlot;
    if (!timeDisplay || timeDisplay.trim() === '') {
      timeDisplay = b.startDate
        ? new Date(b.startDate).toLocaleDateString('en-GB')
        : 'Full Day Access';
    }

    let typeDisplay = 'App Booking';
    if (b.bookingType === 'GROUP_CLASS') typeDisplay = 'Group Class';
    else if (b.bookingType === 'GYM_SESSION') typeDisplay = 'Gym Session';

    let statusDisplay = b.status || 'Completed';
    if (statusDisplay === 'Active') statusDisplay = 'Checked In';

    return {
      key: String(b._id),
      id: b.bookingId || String(b._id),
      name: userName,
      phone: userPhone,
      avatar,
      time: timeDisplay,
      date: b.startDate ? new Date(b.startDate).toLocaleDateString('en-GB') : 'Today',
      type: typeDisplay,
      status: statusDisplay,
      amount: Number(b.pricing?.totalAmount || 0),
    };
  });

  // Map Recent Memberships (top 4)
  const recentMembers = memberships.slice(0, 4).map((m) => {
    const user = m.userId || {};
    const userName = user.fullName || user.name || 'Member';
    const avatar = user.avatar || user.profilePicture || defaultAvatar;

    let planDisplay = m.tier || '';
    if (!planDisplay && m.startDate && m.endDate) {
      const diffDays = Math.round((new Date(m.endDate) - new Date(m.startDate)) / (1000 * 60 * 60 * 24));
      if (diffDays >= 300) planDisplay = 'Annual Membership';
      else if (diffDays >= 150) planDisplay = 'Half-Yearly Membership';
      else if (diffDays >= 80) planDisplay = 'Quarterly Membership';
      else planDisplay = 'Monthly Membership';
    }
    if (!planDisplay) planDisplay = 'Active Membership';

    const endFormatted = m.endDate
      ? new Date(m.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    return {
      key: String(m._id),
      id: m.membershipId || String(m._id),
      name: userName,
      avatar,
      plan: planDisplay,
      endDate: endFormatted,
      status: m.status || 'Active',
      amount: Number(m.pricing?.totalAmount || 0),
    };
  });

  return res.status(200).json(
    ApiResponse.success(
      {
        gym: {
          id: gymDoc?._id || gymId,
          name: gymDoc?.name || 'Partner Gym',
          partnerId: gymDoc?.partnerId || '',
          city: gymDoc?.city || '',
        },
        metrics: {
          totalRevenue,
          memberRevenue,
          appBookingRevenue,
          totalActiveUsers,
          activeMembersCount,
          completedBookingsCount,
          totalBookingsCount: bookings.length,
          totalMembersCount: memberships.length,
        },
        recentBookings,
        recentMembers,
      },
      'Gym dashboard statistics retrieved successfully'
    )
  );
});


