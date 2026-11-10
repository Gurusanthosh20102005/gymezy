import mongoose from 'mongoose';
import Gym from '../models/gym.model.js';
import { Employee } from '../models/employee.model.js';
import { ApiError } from '../utils/apiError.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Helper to locate a gym by Mongo ID, partnerId, or slug (returns Mongoose query for chaining)
 */
export const findGymByParam = (param) => {
  if (mongoose.Types.ObjectId.isValid(param)) {
    return Gym.findById(param);
  }
  return Gym.findOne({
    $or: [{ partnerId: param }, { slug: param }],
  });
};

/**
 * Helper to calculate star histograms and average rating
 */
const calculateReviewMetrics = (reviews = []) => {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    const zeroHist = [5, 4, 3, 2, 1].map((s) => ({
      stars: s,
      count: 0,
      ratio: 0,
      percent: '0%',
    }));
    return {
      averageRating: '0.0',
      numericRating: 0,
      totalReviews: 0,
      histograms: zeroHist,
      hasReviews: false,
    };
  }

  let sum = 0;
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  reviews.forEach((rev) => {
    const rVal = typeof rev.rating === 'number' ? rev.rating : 5;
    const star = Math.max(1, Math.min(5, Math.round(rVal)));
    counts[star] = (counts[star] || 0) + 1;
    sum += rVal;
  });

  const avgNum = sum / reviews.length;
  const avgStr = avgNum.toFixed(1);

  const histograms = [5, 4, 3, 2, 1].map((s) => {
    const count = counts[s] || 0;
    const ratio = count / reviews.length;
    return {
      stars: s,
      count,
      ratio,
      percent: `${Math.round(ratio * 100)}%`,
    };
  });

  return {
    averageRating: avgStr,
    numericRating: Number(avgStr),
    totalReviews: reviews.length,
    histograms,
    hasReviews: true,
  };
};

/**
 * Helper to compute relative time string
 */
export const computeTimeAgo = (dateInput) => {
  if (!dateInput) return 'Just now';
  if (typeof dateInput === 'string' && dateInput.includes('ago') && !dateInput.toLowerCase().includes('just now')) {
    return dateInput;
  }
  if (
    typeof dateInput === 'string' &&
    (dateInput.trim().toLowerCase() === 'recent' ||
      dateInput.trim().toLowerCase() === 'today' ||
      dateInput.trim().toLowerCase() === 'just now')
  ) {
    return 'Just now';
  }
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return typeof dateInput === 'string' && dateInput.trim() ? dateInput : 'Just now';
  }
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60 * 1000) return 'Just now';

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hr' : 'hrs'} ago`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
  return `${diffYears} ${diffYears === 1 ? 'year' : 'years'} ago`;
};

/**
 * Helper to format review item with populated user details
 */
const formatReviewItem = (rev) => {
  const userObj = rev.userId && typeof rev.userId === 'object' ? rev.userId : null;
  const rawDate = rev.createdAt || rev.date;
  return {
    userId: userObj?._id || userObj?.id || rev.userId || null,
    userName: userObj?.fullName || rev.userName || 'Verified Member',
    userImageUrl: userObj?.avatar || rev.userImageUrl || '',
    userPhone: userObj?.phone || '',
    rating: typeof rev.rating === 'number' ? rev.rating : 5,
    comment: rev.comment || '',
    bookingType: rev.bookingType || 'Member',
    date: computeTimeAgo(rawDate),
    createdAt: rev.createdAt || new Date(),
  };
};

/**
 * GET /api/v1/gyms/:id/reviews & GET /api/v1/gyms/:id/ratings
 * Dedicated API to get all member ratings and reviews for a specific gym with populated User profiles
 */
export const getGymReviews = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const gym = await findGymByParam(id)
    .populate({
      path: 'ratings.userId',
      select: 'fullName avatar email phone',
    })
    .populate({
      path: 'reviews.userId',
      select: 'fullName avatar email phone',
    })
    .select('name partnerId slug rating reviewsCount ratings reviews');

  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  let rawReviews = [];
  if (Array.isArray(gym.ratings) && gym.ratings.length > 0) {
    rawReviews = gym.ratings;
  } else if (Array.isArray(gym.reviews)) {
    rawReviews = gym.reviews;
  }

  const metrics = calculateReviewMetrics(rawReviews);
  const formattedReviews = rawReviews.map(formatReviewItem);

  return res.status(200).json(
    ApiResponse.success(
      {
        gymId: gym.partnerId || gym._id,
        gymName: gym.name,
        rating: metrics.averageRating,
        numericRating: metrics.numericRating,
        reviewsCount: metrics.totalReviews,
        hasReviews: metrics.hasReviews,
        histograms: metrics.histograms,
        reviews: formattedReviews,
        ratings: formattedReviews,
      },
      'Gym ratings & reviews retrieved successfully'
    )
  );
});

export const getGymRatings = getGymReviews;

/**
 * GET /api/v1/gyms/:id/trainers/:trainerId/reviews
 * Dedicated API to get all reviews and ratings for a specific trainer
 */
export const getTrainerReviews = asyncHandler(async (req, res) => {
  const { id, trainerId } = req.params;

  const gym = await findGymByParam(id)
    .populate({
      path: 'trainers.ratings.userId',
      select: 'fullName avatar email phone',
    })
    .select('name partnerId trainers');

  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  const decodedTrainerId = decodeURIComponent(trainerId).trim().toLowerCase();
  const isObjectId = mongoose.Types.ObjectId.isValid(trainerId);

  // 1. Search in Employee collection (SSOT)
  const employeeTrainer = await Employee.findOne({
    $and: [
      { $or: [{ gymPartnerId: gym.partnerId }, { gymId: gym._id }] },
      { role: 'Trainer' },
      {
        $or: [
          { name: new RegExp(`^${decodedTrainerId}$`, 'i') },
          { employeeId: new RegExp(`^${decodedTrainerId}$`, 'i') },
          { _id: isObjectId ? trainerId : null },
        ].filter(Boolean),
      },
    ],
  }).populate({
    path: 'ratings.userId',
    select: 'fullName avatar email phone',
  });

  // 2. Fallback to embedded gym.trainers if employee not found
  let trainer = null;
  if (employeeTrainer) {
    trainer = {
      name: employeeTrainer.name,
      specialty: employeeTrainer.specialty || 'Certified Fitness Trainer',
      experienceYears: employeeTrainer.experienceYears || 2,
      rating: employeeTrainer.rating || 4.9,
      reviewsCount: employeeTrainer.reviewsCount || 0,
      ratings: employeeTrainer.ratings || [],
      imageUrl: employeeTrainer.avatar || '',
    };
  } else {
    const trainers = Array.isArray(gym.trainers) ? gym.trainers : [];
    trainer = trainers.find((t) => {
      if (!t) return false;
      const nameMatch = t.name && t.name.trim().toLowerCase() === decodedTrainerId;
      const idMatch = t._id && t._id.toString() === trainerId;
      return nameMatch || idMatch;
    });
  }

  if (!trainer) {
    throw ApiError.notFound(`Trainer '${trainerId}' not found in this gym.`);
  }

  const rawRatings = Array.isArray(trainer.ratings) ? trainer.ratings : [];
  const metrics = calculateReviewMetrics(rawRatings);
  const formattedRatings = rawRatings.map(formatReviewItem);

  return res.status(200).json(
    ApiResponse.success(
      {
        gymId: gym.partnerId || gym._id,
        gymName: gym.name,
        trainer: {
          name: trainer.name,
          specialty: trainer.specialty,
          experienceYears: trainer.experienceYears,
          rating: metrics.hasReviews ? metrics.averageRating : (trainer.rating || 0),
          reviewsCount: metrics.hasReviews ? metrics.totalReviews : (trainer.reviewsCount || 0),
          imageUrl: trainer.imageUrl || '',
        },
        hasReviews: metrics.hasReviews,
        rating: metrics.averageRating,
        numericRating: metrics.numericRating,
        reviewsCount: metrics.totalReviews,
        histograms: metrics.histograms,
        reviews: formattedRatings,
        ratings: formattedRatings,
      },
      'Trainer reviews retrieved successfully'
    )
  );
});

export const getTrainerRatings = getTrainerReviews;

/**
 * POST /api/v1/gyms/:id/reviews & POST /api/v1/gyms/:id/ratings
 * Dedicated API to submit a new member review for a gym
 */
export const addGymReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment, bookingType } = req.body;

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    throw ApiError.badRequest('Rating must be a number between 1 and 5.');
  }

  const cleanComment = typeof comment === 'string' ? comment.trim() : '';

  const gym = await findGymByParam(id);
  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  const numericRating = Number(rating);
  const userId = req.user?._id || req.user?.id || null;

  const newReview = {
    userId,
    userName: req.user?.fullName || 'Verified Member',
    userImageUrl: req.user?.avatar || '',
    rating: numericRating,
    comment: cleanComment,
    bookingType: bookingType || 'Member',
    date: 'Just now',
    createdAt: new Date(),
  };

  if (!Array.isArray(gym.ratings)) {
    gym.ratings = [];
  }
  if (!Array.isArray(gym.reviews)) {
    gym.reviews = [];
  }

  gym.ratings.unshift(newReview);
  gym.reviews.unshift(newReview);

  // Recalculate average gym rating and count
  const sum = gym.ratings.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
  gym.reviewsCount = gym.ratings.length;
  gym.rating = Number((sum / gym.ratings.length).toFixed(1));

  await gym.save();

  return res.status(201).json(
    ApiResponse.success(
      {
        gymId: gym.partnerId || gym._id,
        rating: gym.rating.toFixed(1),
        reviewsCount: gym.reviewsCount,
        review: newReview,
      },
      'Gym review submitted successfully'
    )
  );
});

export const addGymRating = addGymReview;

/**
 * POST /api/v1/gyms/:id/trainers/:trainerId/reviews & POST /api/v1/gyms/:id/trainers/:trainerId/ratings
 * Dedicated API to submit a new member review for a specific trainer
 */
export const addTrainerReview = asyncHandler(async (req, res) => {
  const { id, trainerId } = req.params;
  const { rating, comment, bookingType } = req.body;

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    throw ApiError.badRequest('Rating must be a number between 1 and 5.');
  }

  const cleanComment = typeof comment === 'string' ? comment.trim() : '';

  const gym = await findGymByParam(id);
  if (!gym) {
    throw ApiError.notFound('Gym not found.');
  }

  const decodedTrainerId = decodeURIComponent(trainerId).trim().toLowerCase();
  const isObjectId = mongoose.Types.ObjectId.isValid(trainerId);

  // 1. Find in Employee collection (SSOT)
  const employeeTrainer = await Employee.findOne({
    $and: [
      { $or: [{ gymPartnerId: gym.partnerId }, { gymId: gym._id }] },
      { role: 'Trainer' },
      {
        $or: [
          { name: new RegExp(`^${decodedTrainerId}$`, 'i') },
          { employeeId: new RegExp(`^${decodedTrainerId}$`, 'i') },
          { _id: isObjectId ? trainerId : null },
        ].filter(Boolean),
      },
    ],
  });

  // 2. Find in gym.trainers
  const trainerInGym = gym.trainers?.find((t) => {
    if (!t) return false;
    const nameMatch = t.name && t.name.trim().toLowerCase() === decodedTrainerId;
    const idMatch = t._id && t._id.toString() === trainerId;
    return nameMatch || idMatch;
  });

  if (!employeeTrainer && !trainerInGym) {
    throw ApiError.notFound(`Trainer '${trainerId}' not found in this gym.`);
  }

  const numericRating = Number(rating);
  const userId = req.user?._id || req.user?.id || null;

  const newReview = {
    userId,
    userName: req.user?.fullName || 'Verified Member',
    userImageUrl: req.user?.avatar || '',
    rating: numericRating,
    comment: cleanComment,
    bookingType: bookingType || 'Personal Training',
    date: 'Just now',
    createdAt: new Date(),
  };

  let targetTrainerName = '';
  let finalRating = 5;
  let finalReviewsCount = 1;

  if (employeeTrainer) {
    targetTrainerName = employeeTrainer.name;
    if (!Array.isArray(employeeTrainer.ratings)) {
      employeeTrainer.ratings = [];
    }
    employeeTrainer.ratings.unshift(newReview);
    const sum = employeeTrainer.ratings.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    employeeTrainer.reviewsCount = employeeTrainer.ratings.length;
    employeeTrainer.rating = Number((sum / employeeTrainer.ratings.length).toFixed(1));
    await employeeTrainer.save();
    finalRating = employeeTrainer.rating;
    finalReviewsCount = employeeTrainer.reviewsCount;
  }

  if (trainerInGym) {
    targetTrainerName = targetTrainerName || trainerInGym.name;
    if (!Array.isArray(trainerInGym.ratings)) {
      trainerInGym.ratings = [];
    }
    trainerInGym.ratings.unshift(newReview);
    const sum = trainerInGym.ratings.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    trainerInGym.reviewsCount = trainerInGym.ratings.length;
    trainerInGym.rating = Number((sum / trainerInGym.ratings.length).toFixed(1));
    await gym.save();
    finalRating = trainerInGym.rating;
    finalReviewsCount = trainerInGym.reviewsCount;
  }

  return res.status(201).json(
    ApiResponse.success(
      {
        trainerName: targetTrainerName,
        rating: typeof finalRating === 'number' ? finalRating.toFixed(1) : finalRating,
        reviewsCount: finalReviewsCount,
        review: newReview,
      },
      'Trainer review submitted successfully'
    )
  );
});

export const addTrainerRating = addTrainerReview;

