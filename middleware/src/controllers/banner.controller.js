import mongoose from 'mongoose';
import { Banner } from '../models/banner.model.js';
import { Gym } from '../models/gym.model.js';
import { formatAndCompressFile } from '../utils/mediaCompressor.js';
import {
  tokenizeAndNormalize,
  scoreBannerRelevance,
  getDidYouMeanSuggestion,
} from '../utils/fuzzySearchEngine.js';

/**
 * Calculates Haversine distance between two coordinates in Kilometers
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const numLat1 = Number(lat1);
  const numLon1 = Number(lon1);
  const numLat2 = Number(lat2);
  const numLon2 = Number(lon2);
  if (isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2)) return null;

  const R = 6371; // Earth radius in km
  const dLat = ((numLat2 - numLat1) * Math.PI) / 180;
  const dLon = ((numLon2 - numLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((numLat1 * Math.PI) / 180) *
      Math.cos((numLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
};

/**
 * Public Endpoint: Get sorted promotional banners based on user coordinates & priority
 * Route: GET /api/v1/banners?lat=...&lng=...
 */
export const getPublicBanners = async (req, res) => {
  try {
    const userLat = req.query.lat ? parseFloat(req.query.lat) : null;
    const userLng = req.query.lng ? parseFloat(req.query.lng) : null;

    // Fetch active banners with full gym details
    const banners = await Banner.find({ isActive: true })
      .populate('gymId', 'name slug area city state address fullAddress location coverPhoto logo images photos pricing singleSessionPrice monthlyPrice rating reviewCount reviewsCount facilities workouts amenities openingHours badgeText isVerified partnerId phone email ownerName')
      .lean();

    if (!banners || banners.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        total: 0,
      });
    }

    // Enrich banners with distance and verified coordinates
    const enrichedBanners = banners.map((banner) => {
      let coords = banner.gymLocation?.coordinates;
      if (!coords || !Array.isArray(coords) || coords.length < 2) {
        coords = banner.gymId?.location?.coordinates || [80.2707, 13.0827];
      }

      const gymLng = coords[0];
      const gymLat = coords[1];
      const distanceKm = calculateDistanceKm(userLat, userLng, gymLat, gymLng);

      let populatedGym = null;
      if (banner.gymId && typeof banner.gymId === 'object') {
        const g = banner.gymId;
        const sessionPrice = g.singleSessionPrice || g.pricing?.singleSession || 199;
        const monthlyPrice = g.monthlyPrice || g.pricing?.monthly || sessionPrice * 10;
        const displayLocation = g.area ? `${g.area}, ${g.city || 'Chennai'}` : (g.city || 'Chennai');
        populatedGym = {
          ...g,
          id: g.partnerId || g._id?.toString(),
          _id: g._id?.toString(),
          mongoId: g._id?.toString(),
          partnerId: g.partnerId || '',
          location: displayLocation,
          place: displayLocation,
          area: g.area || '',
          city: g.city || '',
          state: g.state || 'Tamil Nadu',
          address: g.address || g.fullAddress || displayLocation,
          fullAddress: g.fullAddress || g.address || displayLocation,
          distance: distanceKm,
          distanceText: distanceKm != null ? `${distanceKm} km away` : 'Near You',
          rating: g.rating || 0,
          reviewsCount: g.reviewsCount || 0,
          singleSessionPrice: sessionPrice,
          pricePerSession: sessionPrice,
          monthlyPrice,
          badgeText: g.badgeText || (g.rating >= 4.8 ? 'Top Rated' : 'Verified Gym'),
          workouts: Array.isArray(g.workouts) ? g.workouts : [],
          facilities: Array.isArray(g.facilities) ? g.facilities : [],
          amenities: Array.isArray(g.amenities) ? g.amenities : [],
          openingHours: g.openingHours || null,
        };
      }

      // Return unified banner payload
      return {
        _id: banner._id,
        title: banner.title,
        subtitle: banner.subtitle || '',
        badgeText: banner.badgeText || 'FEATURED DEAL',
        image: banner.image?.fileData || banner.imageUrl || '',
        imageUrl: banner.imageUrl || banner.image?.fileData || '',
        isPriority: Boolean(banner.isPriority),
        gymId: banner.gymId?._id || banner.gymId,
        gymSlug: banner.gymSlug || banner.gymId?.slug || '',
        gymName: banner.gymName || banner.gymId?.name || '',
        gymArea: banner.gymArea || banner.gymId?.area || '',
        gymLocation: {
          coordinates: [gymLng, gymLat],
        },
        distanceKm,
        gym: populatedGym || banner.gymId || null,
        createdAt: banner.createdAt,
      };
    });

    // Partition: Priority Banners vs Regular Banners
    const priorityBanners = enrichedBanners.filter((b) => b.isPriority === true);
    const regularBanners = enrichedBanners.filter((b) => b.isPriority !== true);

    // Sort priority banners: closest to user first if coordinates provided, else newest first
    priorityBanners.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Sort regular banners: strictly by closest distance to user
    regularBanners.sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) {
        return a.distanceKm - b.distanceKm;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // Priority banners appear at the very front
    const sortedBanners = [...priorityBanners, ...regularBanners];

    return res.status(200).json({
      success: true,
      data: sortedBanners,
      total: sortedBanners.length,
    });
  } catch (error) {
    console.error('Error fetching public banners:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch promotional banners',
      error: error.message,
    });
  }
};

/**
 * Super Admin Endpoint: Get all banners with fuzzy search & server-side pagination
 * Route: GET /api/v1/banners/admin/all
 */
export const getAllBannersAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      q,
      priority,
      status,
    } = req.query;

    const searchQuery = (search || q || '').trim();
    const searchTokens = tokenizeAndNormalize(searchQuery);
    const didYouMean = searchTokens.length > 0 ? getDidYouMeanSuggestion(searchQuery) : null;

    const query = {};

    if (priority && priority !== 'ALL') {
      if (priority === 'PRIORITY') query.isPriority = true;
      if (priority === 'NORMAL') query.isPriority = false;
    }

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE' || status === 'true') query.isActive = true;
      if (status === 'INACTIVE' || status === 'false') query.isActive = false;
    }

    const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    let totalCount = 0;
    let paginatedBanners = [];

    if (searchTokens.length > 0) {
      // Professional Multi-Field Typo-Tolerant Search & Relevance Scoring
      const candidates = await Banner.find(query)
        .populate('gymId', 'name slug area city address location coverPhoto logo')
        .lean();

      const scored = candidates
        .map((b) => {
          const relevanceScore = scoreBannerRelevance(b, searchTokens);
          return {
            ...b,
            relevanceScore,
          };
        })
        .filter((b) => b.relevanceScore > 0);

      // Sort by highest relevance first, then priority, then newest
      scored.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        if (Boolean(b.isPriority) !== Boolean(a.isPriority)) {
          return Boolean(b.isPriority) ? 1 : -1;
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });

      totalCount = scored.length;
      paginatedBanners = scored.slice(skip, skip + limitNum);
    } else {
      // Direct DB pagination & sorting
      const [count, rawBanners] = await Promise.all([
        Banner.countDocuments(query),
        Banner.find(query)
          .populate('gymId', 'name slug area city address location coverPhoto logo')
          .sort({ isPriority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
      ]);

      totalCount = count;
      paginatedBanners = rawBanners;
    }

    // Global counts for lifecycle badges
    const [totalAll, totalPriority, totalActive] = await Promise.all([
      Banner.countDocuments({}),
      Banner.countDocuments({ isPriority: true }),
      Banner.countDocuments({ isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: paginatedBanners,
      banners: paginatedBanners,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalCount / limitNum) || 1,
        hasMore: skip + limitNum < totalCount,
      },
      counts: {
        total: totalAll,
        priority: totalPriority,
        active: totalActive,
      },
      didYouMean,
      total: totalCount,
    });
  } catch (error) {
    console.error('Error fetching admin banners:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch admin banners',
      error: error.message,
    });
  }
};

/**
 * Super Admin Endpoint: Create new banner with WebP image compression
 * Route: POST /api/v1/banners/admin
 */
export const createBanner = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      badgeText,
      gymId,
      isPriority,
      isActive,
      image,
      imageUrl,
      validUntil,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Banner title is required' });
    }

    if (!gymId || !mongoose.Types.ObjectId.isValid(gymId)) {
      return res.status(400).json({ success: false, message: 'Valid Gym selection is required' });
    }

    // Verify gym exists and extract metadata
    const gym = await Gym.findById(gymId);
    if (!gym) {
      return res.status(404).json({ success: false, message: 'Selected Gym not found' });
    }

    let compressedImageObj = {
      fileName: '',
      fileData: '',
      mimeType: 'image/webp',
      fileSizeKb: 0,
      uploadedAt: new Date(),
    };

    // Compress uploaded base64 image if provided
    if (image) {
      const fileRes = await formatAndCompressFile(gym.slug || gym.name, 'banner', image);
      if (fileRes) {
        compressedImageObj = fileRes;
      }
    }

    const banner = new Banner({
      title: title.trim(),
      subtitle: subtitle ? subtitle.trim() : '',
      badgeText: badgeText ? badgeText.trim() : 'FEATURED DEAL',
      image: compressedImageObj,
      imageUrl: imageUrl || compressedImageObj.fileData || '',
      gymId: gym._id,
      gymSlug: gym.slug || (gym.name ? gym.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : ''),
      gymName: gym.name,
      gymArea: gym.area || '',
      gymLocation: {
        type: 'Point',
        coordinates: gym.location?.coordinates || [80.2707, 13.0827],
      },
      isPriority: Boolean(isPriority),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      validUntil: validUntil ? new Date(validUntil) : null,
    });

    await banner.save();

    return res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner,
    });
  } catch (error) {
    console.error('Error creating banner:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create promotional banner',
      error: error.message,
    });
  }
};

/**
 * Super Admin Endpoint: Update banner
 * Route: PUT /api/v1/banners/admin/:id
 */
export const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      subtitle,
      badgeText,
      gymId,
      isPriority,
      isActive,
      image,
      imageUrl,
      validUntil,
    } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    if (title) banner.title = title.trim();
    if (subtitle !== undefined) banner.subtitle = subtitle.trim();
    if (badgeText !== undefined) banner.badgeText = badgeText.trim();
    if (isPriority !== undefined) banner.isPriority = Boolean(isPriority);
    if (isActive !== undefined) banner.isActive = Boolean(isActive);
    if (validUntil !== undefined) banner.validUntil = validUntil ? new Date(validUntil) : null;
    if (imageUrl !== undefined) banner.imageUrl = imageUrl;

    // If gym changed, re-map
    if (gymId && gymId.toString() !== banner.gymId.toString()) {
      const gym = await Gym.findById(gymId);
      if (gym) {
        banner.gymId = gym._id;
        banner.gymSlug = gym.slug;
        banner.gymName = gym.name;
        banner.gymArea = gym.area || '';
        banner.gymLocation = {
          type: 'Point',
          coordinates: gym.location?.coordinates || [80.2707, 13.0827],
        };
      }
    }

    // If image replaced and is a new base64 string, compress it
    if (image && typeof image === 'string' && image.startsWith('data:image')) {
      const fileRes = await formatAndCompressFile(banner.gymSlug || 'gym', 'banner', image);
      if (fileRes) {
        banner.image = fileRes;
        banner.imageUrl = fileRes.fileData;
      }
    }

    await banner.save();

    return res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner,
    });
  } catch (error) {
    console.error('Error updating banner:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update promotional banner',
      error: error.message,
    });
  }
};

/**
 * Super Admin Endpoint: Toggle Banner Priority
 * Route: PATCH /api/v1/banners/admin/:id/priority
 */
export const toggleBannerPriority = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    banner.isPriority = !banner.isPriority;
    await banner.save();

    return res.status(200).json({
      success: true,
      message: `Banner priority ${banner.isPriority ? 'enabled' : 'disabled'} successfully`,
      isPriority: banner.isPriority,
      data: banner,
    });
  } catch (error) {
    console.error('Error toggling banner priority:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle banner priority',
      error: error.message,
    });
  }
};

/**
 * Super Admin Endpoint: Delete banner
 * Route: DELETE /api/v1/banners/admin/:id
 */
export const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete promotional banner',
      error: error.message,
    });
  }
};
