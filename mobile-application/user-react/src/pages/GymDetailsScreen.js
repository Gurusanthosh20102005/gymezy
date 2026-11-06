import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Share,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { gymService } from '../services/gymService';
import { apiService } from '../services/apiService';
import { getGymTimingStatus, normalizeOpeningHours, TIMING_MODES } from '../utils/gymTimingHelper';
import { formatTimeAgo } from '../utils/dateUtils';
import {
  FacilitiesPopup,
  AmenitiesPopup,
  WorkoutsPopup,
  TrainersPopup,
  TrainerReviewsPopup,
  AllReviewsPopup,
  RulesPopup,
  SafetyPopup,
} from '../widgets/DetailsPopups';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const GymDetailsScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const rawGym = route?.params?.gym || {};
  const canonicalId =
    rawGym._id ||
    rawGym.id ||
    rawGym.mongoId ||
    rawGym.partnerId ||
    route?.params?.gymId ||
    '';

  const [gym, setGym] = useState({
    ...rawGym,
    _id: canonicalId,
    id: canonicalId,
    mongoId: canonicalId,
  });
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const { isDark, colors } = useTheme();
  const { showToast } = useToast();

  const [isBookmarked, setIsBookmarked] = useState(rawGym.isBookmarked || false);

  // Popups state
  const [showFacilities, setShowFacilities] = useState(false);
  const [showAmenities, setShowAmenities] = useState(false);
  const [showWorkouts, setShowWorkouts] = useState(false);
  const [showTrainers, setShowTrainers] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [showTrainerReviews, setShowTrainerReviews] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSafety, setShowSafety] = useState(false);

  const [trainerReviewsList, setTrainerReviewsList] = useState([]);

  // Fetch full live document and dedicated reviews from DB on mount
  useEffect(() => {
    let isMounted = true;
    const gymId =
      gym._id ||
      gym.id ||
      gym.mongoId ||
      gym.partnerId ||
      canonicalId;

    if (gymId) {
      gymService
        .fetchGymById(gymId)
        .then((freshGym) => {
          if (isMounted && freshGym) {
            setGym((prev) => ({
              ...prev,
              ...freshGym,
              workouts:
                Array.isArray(freshGym.workouts) && freshGym.workouts.length > 0
                  ? freshGym.workouts
                  : prev.workouts || [],
              facilities:
                Array.isArray(freshGym.facilities) && freshGym.facilities.length > 0
                  ? freshGym.facilities
                  : prev.facilities || [],
              amenities:
                Array.isArray(freshGym.amenities) && freshGym.amenities.length > 0
                  ? freshGym.amenities
                  : prev.amenities || [],
              trainers:
                Array.isArray(freshGym.trainers) && freshGym.trainers.length > 0
                  ? freshGym.trainers
                  : prev.trainers || [],
            }));
          }
        })
        .catch((err) => {
          console.warn('[GYM DETAILS] Error loading live gym from DB:', err.message);
        });

      // Call dedicated ratings & reviews API
      apiService
        .getGymRatings(gymId)
        .then((revData) => {
          if (isMounted && revData && (Array.isArray(revData.ratings) || Array.isArray(revData.reviews))) {
            const list = revData.ratings || revData.reviews || [];
            setGym((prev) => ({
              ...prev,
              ratings: list,
              reviews: list,
              rating: revData.rating != null ? revData.rating : prev.rating,
              reviewsCount: revData.reviewsCount != null ? revData.reviewsCount : prev.reviewsCount,
            }));
          }
        })
        .catch(() => {
          // Graceful fallback to existing gym reviews
        });
    }

    return () => {
      // Memory Optimization: Clean up and dispose heavy objects, image buffers, and popups on screen exit
      isMounted = false;
      setGym({});
      setTrainerReviewsList([]);
      setSelectedTrainer(null);
    };
  }, [canonicalId]);

  const handleOpenTrainerReviews = (trainer) => {
    if (!trainer) return;
    setSelectedTrainer(trainer);
    setTrainerReviewsList(trainer.ratings || trainer.reviews || []);
    setShowTrainerReviews(true);

    const gymId = gym._id || gym.id || gym.partnerId || gym.mongoId;
    if (gymId && trainer.name) {
      apiService
        .getTrainerRatings(gymId, trainer.name)
        .then((data) => {
          if (data && (Array.isArray(data.ratings) || Array.isArray(data.reviews))) {
            setTrainerReviewsList(data.ratings || data.reviews || []);
          }
        })
        .catch(() => {
          // Keep existing ratings fallback
        });
    }
  };

  // Compute actual image gallery from DB data
  const photos = useMemo(() => {
    const list = [];
    if (Array.isArray(gym.images) && gym.images.length > 0) {
      gym.images.forEach((img) => {
        if (typeof img === 'string' && img.trim().length > 0) list.push(img.trim());
      });
    }
    if (Array.isArray(gym.galleryPhotos) && gym.galleryPhotos.length > 0) {
      gym.galleryPhotos.forEach((p) => {
        if (p?.fileData) list.push(p.fileData);
      });
    }
    if (gym.coverPhoto?.fileData) {
      list.push(gym.coverPhoto.fileData);
    }
    if (gym.image && typeof gym.image === 'string' && gym.image.trim().length > 0) {
      if (!list.includes(gym.image.trim())) list.push(gym.image.trim());
    }
    if (gym.imageUrl && typeof gym.imageUrl === 'string' && gym.imageUrl.trim().length > 0) {
      if (!list.includes(gym.imageUrl.trim())) list.push(gym.imageUrl.trim());
    }
    return list.length > 0
      ? list
      : ['https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop'];
  }, [gym]);

  // Real DB Arrays safely normalized to strings
  const workouts = Array.isArray(gym.workouts)
    ? gym.workouts.map((w) => (typeof w === 'string' ? w : w?.name || String(w))).filter(Boolean)
    : [];
  const facilities = Array.isArray(gym.facilities)
    ? gym.facilities.map((f) => (typeof f === 'string' ? f : f?.name || String(f))).filter(Boolean)
    : [];
  const amenities = Array.isArray(gym.amenities)
    ? gym.amenities.map((a) => (typeof a === 'string' ? a : a?.name || String(a))).filter(Boolean)
    : [];
  const trainers = Array.isArray(gym.trainers) ? gym.trainers : [];
  const rules = Array.isArray(gym.rules)
    ? gym.rules.map((r) => (typeof r === 'string' ? r : r?.rule || String(r))).filter(Boolean)
    : [];
  const safety = Array.isArray(gym.safetyMeasures)
    ? gym.safetyMeasures.map((s) => (typeof s === 'string' ? s : s?.measure || String(s))).filter(Boolean)
    : Array.isArray(gym.safety)
    ? gym.safety.map((s) => (typeof s === 'string' ? s : s?.measure || String(s))).filter(Boolean)
    : [];
  const reviews = Array.isArray(gym.reviews) ? gym.reviews : [];

  // Dynamic Review Statistics & Real Histogram Calculation
  const reviewStats = useMemo(() => {
    // If individual reviews are present in reviews array
    if (Array.isArray(reviews) && reviews.length > 0) {
      let sum = 0;
      const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach((r) => {
        const rVal = typeof r.rating === 'number' ? r.rating : 5;
        const star = Math.max(1, Math.min(5, Math.round(rVal)));
        counts[star] = (counts[star] || 0) + 1;
        sum += rVal;
      });
      const avg = (sum / reviews.length).toFixed(1);
      const hist = [5, 4, 3, 2, 1].map((s) => {
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
        rating: avg,
        ratingNum: Number(avg),
        total: reviews.length,
        histograms: hist,
        hasReviews: true,
      };
    }

    // Unrated gym with 0 reviews
    const zeroHist = [5, 4, 3, 2, 1].map((s) => ({
      stars: s,
      count: 0,
      ratio: 0,
      percent: '0%',
    }));

    return {
      rating: 'No ratings',
      ratingNum: 0,
      total: 0,
      histograms: zeroHist,
      hasReviews: false,
    };
  }, [reviews]);

  const locationDisplayText =
    typeof gym.location === 'string' && gym.location.trim().length > 0
      ? gym.location
      : gym.area
      ? `${gym.area}, ${gym.city || 'Chennai'}`
      : gym.city || 'Chennai, Tamil Nadu';

  const timingStatus = useMemo(() => {
    return getGymTimingStatus(gym.openingHours);
  }, [gym.openingHours]);

  const normalizedHours = useMemo(() => {
    return normalizeOpeningHours(gym.openingHours);
  }, [gym.openingHours]);

  const openingHoursText = normalizedHours.displayText || '05:30 AM - 10:30 PM';

  const fullAddressText =
    typeof gym.fullAddress === 'string' && gym.fullAddress.trim().length > 0
      ? gym.fullAddress
      : typeof gym.address === 'string' && gym.address.trim().length > 0
      ? gym.address
      : locationDisplayText;

  const isSingleSessionEnabled = gym?.singleSessionBookingEnabled !== false;
  const sessionPrice = Math.round(gym.singleSessionPrice || gym.pricePerSession || 199);
  const gymDistance = gym.distance !== undefined && gym.distance !== null ? `${gym.distance} km` : 'Near You';
  const badgeText = typeof gym.badgeText === 'string' && gym.badgeText.trim().length > 0 ? gym.badgeText : 'Verified Gym';

  const toggleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    showToast({
      message: !isBookmarked ? 'Added to bookmarked gyms' : 'Removed from bookmarks',
    });
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out ${gym.name} on GYMEZY! Book passes and memberships with instant QR entry.`,
      });
    } catch {
      // ignore
    }
  };

  const handleCall = () => {
    const phone = gym.phone;
    if (phone && phone.trim().length > 0) {
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {
        showToast({ message: `Contact: ${phone}`, isError: true });
      });
    } else {
      showToast({ message: 'No phone number listed for this gym.', isError: true });
    }
  };

  const handleDirections = () => {
    const lat = gym.location?.coordinates?.[1] || gym.coords?.latitude;
    const lng = gym.location?.coordinates?.[0] || gym.coords?.longitude;
    const mapsUrl =
      gym.googleMapsUrl ||
      (lat && lng
        ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressText)}`);

    Linking.openURL(mapsUrl).catch(() => {
      showToast({ message: 'Unable to open maps', isError: true });
    });
  };

  const cardColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
  const accentIconColor = isDark ? '#93C5FD' : '#003882';

  // Icon mapping helpers
  const getWorkoutIcon = (name = '') => {
    const n = String(name).toLowerCase();
    if (n.includes('hiit') || n.includes('interval')) return 'flash-on';
    if (n.includes('yoga') || n.includes('stretch') || n.includes('mobility')) return 'self-improvement';
    if (n.includes('zumba') || n.includes('dance') || n.includes('aerobic')) return 'music-note';
    if (n.includes('box') || n.includes('kickbox') || n.includes('mma') || n.includes('combat')) return 'sports-mma';
    if (n.includes('crossfit') || n.includes('functional')) return 'sports-kabaddi';
    if (n.includes('powerlift') || n.includes('deadlift')) return 'hardware';
    if (n.includes('calisthenic') || n.includes('gymnast') || n.includes('bodyweight')) return 'sports-gymnastics';
    if (n.includes('cardio') || n.includes('run')) return 'directions-run';
    if (n.includes('pilates')) return 'accessibility';
    if (n.includes('cycle') || n.includes('spin') || n.includes('bike')) return 'directions-bike';
    if (n.includes('core') || n.includes('abs')) return 'center-focus-strong';
    return 'fitness-center';
  };

  const getFacilityIcon = (name = '') => {
    const n = String(name).toLowerCase();
    if (n.includes('ac') || n.includes('air')) return 'ac-unit';
    if (n.includes('lock') || n.includes('safe')) return 'lock-outline';
    if (n.includes('show') || n.includes('bath')) return 'shower';
    if (n.includes('chang') || n.includes('dress') || n.includes('room')) return 'checkroom';
    if (n.includes('steam') || n.includes('sauna') || n.includes('spa')) return 'hot-tub';
    if (n.includes('park') || n.includes('valet')) return 'local-parking';
    if (n.includes('wifi') || n.includes('internet')) return 'wifi';
    if (n.includes('music') || n.includes('audio') || n.includes('sound')) return 'music-note';
    if (n.includes('dumbbell') || n.includes('weight') || n.includes('free weight')) return 'fitness-center';
    if (n.includes('cardio') || n.includes('deck') || n.includes('treadmill')) return 'directions-run';
    if (n.includes('olympic') || n.includes('platform') || n.includes('squat')) return 'sports-gymnastics';
    if (n.includes('aid') || n.includes('medical')) return 'medical-services';
    if (n.includes('water') || n.includes('drink')) return 'water-drop';
    return 'verified';
  };

  const getAmenityIcon = (name = '') => {
    const n = String(name).toLowerCase();
    if (n.includes('water') || n.includes('ro')) return 'water-drop';
    if (n.includes('towel')) return 'dry-cleaning';
    if (n.includes('protein') || n.includes('shake')) return 'local-bar';
    if (n.includes('juice') || n.includes('smoothie')) return 'local-cafe';
    if (n.includes('personal lock') || n.includes('locker')) return 'lock-outline';
    if (n.includes('inbody') || n.includes('bmi') || n.includes('weigh') || n.includes('scale')) return 'monitor-weight';
    if (n.includes('nutrition') || n.includes('diet')) return 'assignment-ind';
    if (n.includes('lounge') || n.includes('rest') || n.includes('relax')) return 'weekend';
    if (n.includes('park')) return 'local-parking';
    if (n.includes('wifi') || n.includes('internet')) return 'wifi';
    if (n.includes('mat') || n.includes('sanitiz')) return 'clean-hands';
    if (n.includes('aid') || n.includes('medic')) return 'medical-services';
    if (n.includes('shower')) return 'shower';
    if (n.includes('steam') || n.includes('sauna')) return 'hot-tub';
    if (n.includes('ac') || n.includes('air')) return 'ac-unit';
    return 'star';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 80 + (insets.bottom > 0 ? insets.bottom + 8 : 14) },
        ]}
      >
        {/* 1. TOP HERO IMAGE CAROUSEL & ACTIONS */}
        <View style={styles.heroContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => {
              const offset = e.nativeEvent.contentOffset.x;
              const idx = Math.round(offset / SCREEN_WIDTH);
              setActivePhotoIdx(idx);
            }}
            scrollEventThrottle={16}
          >
            {photos.map((uri, idx) => (
              <Image
                key={idx}
                source={{ uri }}
                style={{ width: SCREEN_WIDTH, height: 280 }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          {/* Gradient Scrim */}
          <LinearGradient
            colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.7)']}
            locations={[0.0, 0.5, 1.0]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Top Bar Floating Buttons */}
          <SafeAreaView edges={['top']} style={styles.topBarSafe}>
            <View style={styles.topBarRow}>
              {/* Back Button */}
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.8}
                style={[
                  styles.circleBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(30, 30, 30, 0.85)'
                      : 'rgba(255, 255, 255, 0.92)',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                  },
                ]}
              >
                <MaterialIcons
                  name="arrow-back"
                  size={20}
                  color={isDark ? '#FFFFFF' : '#0F172A'}
                />
              </TouchableOpacity>

              {/* Right Action Buttons */}
              <View style={styles.topRightActions}>
                {/* Share Button */}
                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.8}
                  style={[
                    styles.circleBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(30, 30, 30, 0.85)'
                        : 'rgba(255, 255, 255, 0.92)',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                      marginRight: 8,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="share"
                    size={18}
                    color={isDark ? '#FFFFFF' : '#0F172A'}
                  />
                </TouchableOpacity>

                {/* Bookmark Button */}
                <TouchableOpacity
                  onPress={toggleBookmark}
                  activeOpacity={0.8}
                  style={[
                    styles.circleBtn,
                    {
                      backgroundColor: isDark
                        ? 'rgba(30, 30, 30, 0.85)'
                        : 'rgba(255, 255, 255, 0.92)',
                      borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                    size={20}
                    color={isBookmarked ? '#00BF62' : isDark ? '#FFFFFF' : '#0F172A'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          {/* Photo Count Pill */}
          <View style={styles.photosPill}>
            <MaterialIcons name="photo-library" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={styles.photosPillText}>
              {activePhotoIdx + 1} / {photos.length} Photo{photos.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* 2. GYM HEADER & LOCATION */}
        <View style={styles.bodyContent}>
          {/* Gym Title & Verification */}
          <View style={styles.titleRow}>
            <Text style={[styles.gymTitle, { color: textColor }]}>{gym.name}</Text>
            <View style={styles.openNowBadge}>
              <View style={styles.openNowDot} />
              <Text style={styles.openNowText}>Open Now</Text>
            </View>
          </View>

          {/* Subtitle Location & Verified Gym */}
          <View style={styles.subtitleRow}>
            <MaterialIcons name="location-on" size={15} color={subtitleColor} />
            <Text style={[styles.locationText, { color: subtitleColor }]}>
              {locationDisplayText}
            </Text>
            <Text style={[styles.bulletText, { color: subtitleColor }]}>•</Text>
            <MaterialIcons name="verified" size={15} color="#00BF62" />
            <Text style={styles.verifiedText}>{badgeText}</Text>
          </View>

          {/* 3. HORIZONTAL SCROLLING QUICK METRICS BADGES */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metricsBadgeRow}
          >
            {/* Price Badge */}
            <View style={[styles.metricBadge, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <MaterialIcons
                name={isSingleSessionEnabled ? 'bolt' : 'card-membership'}
                size={16}
                color={isSingleSessionEnabled ? '#00BF62' : '#3B82F6'}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.metricBadgeBold, { color: textColor }]}>
                {isSingleSessionEnabled ? `₹${sessionPrice}` : 'Plans'}
              </Text>
              <Text style={[styles.metricBadgeSub, { color: subtitleColor }]}>
                {isSingleSessionEnabled ? ' /session' : ' available'}
              </Text>
            </View>

            {/* Rating Badge */}
            <View style={[styles.metricBadge, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <MaterialIcons name="star" size={16} color="#F59E0B" style={{ marginRight: 4 }} />
              <Text style={[styles.metricBadgeBold, { color: textColor }]}>
                {reviewStats.hasReviews ? `${reviewStats.rating} (${reviewStats.total})` : 'No ratings'}
              </Text>
            </View>

            {/* Distance Badge */}
            <View style={[styles.metricBadge, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <MaterialIcons name="near-me" size={14} color={accentIconColor} style={{ marginRight: 4 }} />
              <Text style={[styles.metricBadgeBold, { color: textColor }]}>
                {gymDistance}
              </Text>
            </View>

            {/* Instant Pass Badge */}
            <View style={[styles.metricBadge, { backgroundColor: 'rgba(0, 191, 98, 0.12)', borderColor: 'transparent' }]}>
              <MaterialIcons name="flash-on" size={14} color="#00BF62" style={{ marginRight: 4 }} />
              <Text style={[styles.metricBadgeBold, { color: '#00BF62' }]}>
                Instant Pass
              </Text>
            </View>
          </ScrollView>

          {/* 4. LOCATION & OPERATING HOURS CARD */}
          <View
            style={[
              styles.locationCard,
              { backgroundColor: cardColor, borderColor: borderColor },
            ]}
          >
            {/* Address Row */}
            <View style={styles.locationCardRow}>
              <View style={styles.locationIconBox}>
                <MaterialIcons name="location-on" size={24} color={accentIconColor} />
              </View>
              <View style={styles.locationDetailsCol}>
                <Text style={[styles.locationLabel, { color: subtitleColor }]}>Address</Text>
                <Text style={[styles.locationAddressText, { color: textColor }]}>
                  {fullAddressText}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleDirections}
                style={[styles.directionsBtn, { borderColor: accentIconColor }]}
              >
                <Text style={[styles.directionsBtnText, { color: accentIconColor }]}>Directions</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.cardDivider, { backgroundColor: borderColor }]} />

            {/* Operating Hours Row */}
            <View style={[styles.locationCardRow, { alignItems: 'flex-start' }]}>
              <View style={[styles.locationIconBox, { marginTop: 2 }]}>
                <MaterialIcons
                  name="access-time-filled"
                  size={24}
                  color={timingStatus.isOpen ? '#00BF62' : '#EF4444'}
                />
              </View>
              <View style={[styles.locationDetailsCol, { flex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                  <Text style={[styles.locationLabel, { color: subtitleColor }]}>Operating Hours</Text>
                  <View style={styles.operatingHoursBadge}>
                    <Text
                      style={{
                        color: timingStatus.badgeColor || '#00BF62',
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {timingStatus.badgeText}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.locationAddressText, { color: textColor, fontWeight: '700', marginTop: 3 }]}>
                  {timingStatus.statusText}
                </Text>

                {normalizedHours.mode === TIMING_MODES.SPLIT_SHIFT ? (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ color: subtitleColor, fontSize: 12 }}>
                      Morning: {normalizedHours.morningOpen} - {normalizedHours.morningClose}
                    </Text>
                    <Text style={{ color: subtitleColor, fontSize: 12, marginTop: 2 }}>
                      Evening: {normalizedHours.eveningOpen} - {normalizedHours.eveningClose}
                    </Text>
                  </View>
                ) : normalizedHours.mode === TIMING_MODES.TWENTY_FOUR_HOURS ? (
                  <Text style={{ color: subtitleColor, fontSize: 12, marginTop: 4 }}>
                    24 Hours Facility • Round the clock member access
                  </Text>
                ) : (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ color: subtitleColor, fontSize: 12 }}>
                      Weekday: {normalizedHours.weekdayOpen} - {normalizedHours.weekdayClose}
                    </Text>
                    <Text style={{ color: subtitleColor, fontSize: 12, marginTop: 2 }}>
                      Weekend: {normalizedHours.weekendOpen} - {normalizedHours.weekendClose}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* 5. WORKOUTS OFFERED (from DB) */}
          {workouts.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Workouts Offered</Text>
                {workouts.length > 3 && (
                  <TouchableOpacity onPress={() => setShowWorkouts(true)} activeOpacity={0.7}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.squircleCardsRow}>
                {workouts.slice(0, 3).map((w, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.squircleCard,
                      { backgroundColor: cardColor, borderColor: borderColor },
                    ]}
                  >
                    <View
                      style={[
                        styles.squircleIconCircle,
                        {
                          backgroundColor: isDark
                            ? 'rgba(30, 58, 138, 0.35)'
                            : 'rgba(0, 56, 130, 0.08)',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={getWorkoutIcon(w)}
                        size={22}
                        color={accentIconColor}
                      />
                    </View>
                    <Text
                      style={[styles.squircleCardText, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {w}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 6. FACILITIES SECTION (from DB) */}
          {facilities.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Facilities</Text>
                {facilities.length > 3 && (
                  <TouchableOpacity onPress={() => setShowFacilities(true)} activeOpacity={0.7}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.squircleCardsRow}>
                {facilities.slice(0, 3).map((f, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.squircleCard,
                      { backgroundColor: cardColor, borderColor: borderColor },
                    ]}
                  >
                    <View
                      style={[
                        styles.squircleIconCircle,
                        {
                          backgroundColor: isDark
                            ? 'rgba(30, 58, 138, 0.35)'
                            : 'rgba(0, 56, 130, 0.08)',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={getFacilityIcon(f)}
                        size={22}
                        color={accentIconColor}
                      />
                    </View>
                    <Text
                      style={[styles.squircleCardText, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {f}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 7. AMENITIES SECTION (from DB) */}
          {amenities.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Amenities</Text>
                {amenities.length > 3 && (
                  <TouchableOpacity onPress={() => setShowAmenities(true)} activeOpacity={0.7}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.squircleCardsRow}>
                {amenities.slice(0, 3).map((a, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.squircleCard,
                      { backgroundColor: cardColor, borderColor: borderColor },
                    ]}
                  >
                    <View
                      style={[
                        styles.squircleIconCircle,
                        {
                          backgroundColor: isDark
                            ? 'rgba(30, 58, 138, 0.35)'
                            : 'rgba(0, 56, 130, 0.08)',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={getAmenityIcon(a)}
                        size={22}
                        color={accentIconColor}
                      />
                    </View>
                    <Text
                      style={[styles.squircleCardText, { color: textColor }]}
                      numberOfLines={1}
                    >
                      {a}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 8. ABOUT SECTION (from DB) */}
          {Boolean(gym.aboutText && gym.aboutText.trim().length > 0) && (
            <View style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 8 }]}>
                About {gym.name}
              </Text>
              <Text style={[styles.aboutParagraph, { color: subtitleColor }]}>
                {gym.aboutText}
              </Text>
            </View>
          )}

          {/* 9. CERTIFIED TRAINERS SECTION (from DB) */}
          {trainers.length > 0 && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: textColor }]}>Certified Trainers</Text>
                {trainers.length > 2 && (
                  <TouchableOpacity onPress={() => setShowTrainers(true)} activeOpacity={0.7}>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.trainersRow}>
                {trainers.slice(0, 2).map((tr, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    onPress={() => handleOpenTrainerReviews(tr)}
                    style={[
                      styles.trainerCard,
                      { backgroundColor: cardColor, borderColor: borderColor },
                    ]}
                  >
                    <Image
                      source={{
                        uri:
                          tr.imageUrl ||
                          tr.image?.fileData ||
                          'https://images.unsplash.com/photo-1567013127542-490d757e51fc?q=80&w=400&auto=format&fit=crop',
                      }}
                      style={styles.trainerAvatar}
                      resizeMode="cover"
                    />
                    <View style={styles.trainerInfo}>
                      <Text
                        style={[styles.trainerName, { color: textColor }]}
                        numberOfLines={1}
                      >
                        {tr.name}
                      </Text>
                      <Text style={[styles.trainerExp, { color: subtitleColor }]}>
                        {tr.experienceYears || 1} Yrs Exp.
                      </Text>
                      <View style={styles.trainerRatingRow}>
                        {tr.rating !== undefined && tr.rating !== null && Number(tr.rating) > 0 ? (
                          <>
                            <MaterialIcons name="star" size={12} color="#F59E0B" />
                            <Text style={[styles.trainerRatingText, { color: textColor }]}>
                              {tr.rating}
                            </Text>
                          </>
                        ) : (
                          <Text style={[styles.trainerRatingText, { color: subtitleColor, fontSize: 11 }]}>
                            No ratings
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* 10. REVIEWS & RATINGS */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>Reviews & Ratings</Text>
              {reviews.length > 2 && (
                <TouchableOpacity onPress={() => setShowAllReviews(true)} activeOpacity={0.7}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              )}
            </View>

            {reviewStats.hasReviews ? (
              <>
                {/* Rating Overview Card */}
                <View
                  style={[
                    styles.reviewsOverviewCard,
                    { backgroundColor: cardColor, borderColor: borderColor },
                  ]}
                >
                  <View style={styles.reviewsOverviewLeft}>
                    <Text style={[styles.bigRatingText, { color: textColor }]}>
                      {reviewStats.rating}
                    </Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((s) => {
                        let iconName = 'star-border';
                        if (s <= Math.floor(reviewStats.ratingNum)) {
                          iconName = 'star';
                        } else if (s - reviewStats.ratingNum < 1) {
                          iconName = 'star-half';
                        }
                        return (
                          <MaterialIcons
                            key={s}
                            name={iconName}
                            size={16}
                            color="#F59E0B"
                          />
                        );
                      })}
                    </View>
                    <Text style={[styles.reviewsCountText, { color: subtitleColor }]}>
                      {reviewStats.total} review{reviewStats.total === 1 ? '' : 's'}
                    </Text>
                  </View>

                  <View style={styles.histogramCol}>
                    {reviewStats.histograms.map((row) => (
                      <View key={row.stars} style={styles.histogramRow}>
                        <Text style={[styles.histStarNum, { color: textColor }]}>{row.stars}</Text>
                        <MaterialIcons name="star" size={10} color="#F59E0B" style={{ marginHorizontal: 2 }} />
                        <View style={[styles.histBarTrack, { backgroundColor: isDark ? '#333333' : '#E2E8F0' }]}>
                          <View
                            style={[
                              styles.histBarFill,
                              {
                                width: `${row.ratio * 100}%`,
                                backgroundColor: isDark ? '#00BF62' : '#003882',
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.histPercent, { color: subtitleColor }]}>{row.percent}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Individual Reviews from DB */}
                {reviews.slice(0, 2).map((rev, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.reviewCard,
                      { backgroundColor: cardColor, borderColor: borderColor },
                    ]}
                  >
                    <View style={styles.reviewHeader}>
                      <Image
                        source={{
                          uri:
                            rev.userImageUrl ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop',
                        }}
                        style={styles.reviewAvatar}
                      />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={[styles.reviewAuthor, { color: textColor }]}>{rev.userName || 'Verified Member'}</Text>
                        <View style={styles.reviewStarsRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <MaterialIcons
                              key={s}
                              name={s <= Math.floor(rev.rating || 5) ? 'star' : 'star-border'}
                              size={11}
                              color="#F59E0B"
                            />
                          ))}
                        </View>
                      </View>
                      <View style={styles.reviewTypeCol}>
                        <View style={styles.bookingTypeBadge}>
                          <Text style={styles.bookingTypeText}>{rev.bookingType || 'Member'}</Text>
                        </View>
                        <Text style={[styles.reviewDate, { color: subtitleColor }]}>
                          {formatTimeAgo(rev.createdAt || rev.date)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.reviewComment, { color: textColor }]}>{rev.comment}</Text>
                  </View>
                ))}
              </>
            ) : (
              <View style={[styles.noReviewsBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
                <MaterialIcons name="rate-review" size={26} color={subtitleColor} />
                <Text style={[styles.noReviewsText, { color: subtitleColor, marginTop: 6 }]}>
                  No ratings yet. Be the first to review after your workout!
                </Text>
              </View>
            )}
          </View>

          {/* 11. RULES & SAFETY GUIDELINES (from DB) */}
          {(rules.length > 0 || safety.length > 0) && (
            <View style={styles.guidelinesRow}>
              {/* Rules */}
              {rules.length > 0 && (
                <View style={[styles.guidelineCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
                  <Text style={[styles.guidelineTitle, { color: textColor }]}>Gym Rules</Text>
                  {rules.slice(0, 3).map((r, i) => (
                    <View key={i} style={styles.guidelineItem}>
                      <MaterialIcons name="check-circle" size={13} color={accentIconColor} style={{ marginRight: 4, marginTop: 1 }} />
                      <Text style={[styles.guidelineText, { color: subtitleColor }]} numberOfLines={2}>
                        {r}
                      </Text>
                    </View>
                  ))}
                  {rules.length > 3 && (
                    <TouchableOpacity onPress={() => setShowRules(true)} activeOpacity={0.7}>
                      <Text style={[styles.viewRulesText, { color: accentIconColor }]}>View All Rules →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Safety */}
              {safety.length > 0 && (
                <View style={[styles.guidelineCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
                  <Text style={[styles.guidelineTitle, { color: textColor }]}>Safety Measures</Text>
                  {safety.slice(0, 3).map((s, i) => (
                    <View key={i} style={styles.guidelineItem}>
                      <MaterialIcons name="verified-user" size={13} color="#00BF62" style={{ marginRight: 4, marginTop: 1 }} />
                      <Text style={[styles.guidelineText, { color: subtitleColor }]} numberOfLines={2}>
                        {s}
                      </Text>
                    </View>
                  ))}
                  {safety.length > 3 && (
                    <TouchableOpacity onPress={() => setShowSafety(true)} activeOpacity={0.7}>
                      <Text style={[styles.viewRulesText, { color: '#00BF62' }]}>View All Safety →</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ============================================================ */}
      {/* 12. PERSISTENT BOTTOM ACTION BAR */}
      {/* ============================================================ */}
      <View
        style={[
          styles.bottomBarContainer,
          {
            backgroundColor: isDark
              ? 'rgba(18, 18, 18, 0.88)'
              : 'rgba(255, 255, 255, 0.88)',
            borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(226, 232, 240, 0.8)',
            paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 12,
          },
        ]}
      >
        {/* Phone Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCall}
          style={[
            styles.callBtn,
            {
              backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : '#FFFFFF',
              borderColor: borderColor,
            },
          ]}
        >
          <MaterialIcons name="phone" size={20} color={isDark ? '#FFFFFF' : '#003882'} />
        </TouchableOpacity>

        {/* Book Session Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('BookingSession', { gym })}
          style={[
            styles.bookSessionBtn,
            {
              borderColor: isDark ? '#93C5FD' : '#003882',
              backgroundColor: isDark ? 'rgba(30,30,30,0.5)' : '#FFFFFF',
            },
          ]}
        >
          <MaterialIcons
            name="calendar-today"
            size={16}
            color={isDark ? '#93C5FD' : '#003882'}
            style={{ marginRight: 6 }}
          />
          <Text
            style={[
              styles.bookSessionBtnText,
              { color: isDark ? '#93C5FD' : '#003882' },
            ]}
          >
            Book Session
          </Text>
        </TouchableOpacity>

        {/* Buy Membership Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate('BuyMembership', { gym })}
          style={styles.buyMembershipBtn}
        >
          <MaterialIcons name="workspace-premium" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.buyMembershipBtnText}>Buy Membership</Text>
        </TouchableOpacity>
      </View>

      {/* ============================================================ */}
      {/* POPUPS & MODALS */}
      {/* ============================================================ */}
      <FacilitiesPopup
        visible={showFacilities}
        onClose={() => setShowFacilities(false)}
        facilities={facilities}
      />
      <AmenitiesPopup
        visible={showAmenities}
        onClose={() => setShowAmenities(false)}
        amenities={amenities}
      />
      <WorkoutsPopup
        visible={showWorkouts}
        onClose={() => setShowWorkouts(false)}
        workouts={workouts}
      />
      <TrainersPopup
        visible={showTrainers}
        onClose={() => setShowTrainers(false)}
        trainers={trainers}
        onTrainerTap={(trainer) => {
          setShowTrainers(false);
          handleOpenTrainerReviews(trainer);
        }}
      />
      <TrainerReviewsPopup
        visible={showTrainerReviews}
        onClose={() => setShowTrainerReviews(false)}
        trainer={selectedTrainer}
        reviews={trainerReviewsList}
        onBack={() => {
          setShowTrainerReviews(false);
          setShowTrainers(true);
        }}
      />
      <AllReviewsPopup
        visible={showAllReviews}
        onClose={() => setShowAllReviews(false)}
        rating={reviewStats.rating}
        reviewsCount={reviewStats.total}
        reviews={reviews}
        histograms={reviewStats.histograms}
      />
      <RulesPopup
        visible={showRules}
        onClose={() => setShowRules(false)}
        rules={rules}
      />
      <SafetyPopup
        visible={showSafety}
        onClose={() => setShowSafety(false)}
        safety={safety}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  /* Hero Image */
  heroContainer: {
    width: '100%',
    height: 280,
    position: 'relative',
  },
  topBarSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photosPill: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  photosPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* Body Content */
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  gymTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    flex: 1,
    marginRight: 10,
  },
  openNowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  openNowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00BF62',
    marginRight: 5,
  },
  openNowText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00BF62',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 3,
  },
  bulletText: {
    fontSize: 13,
    marginHorizontal: 6,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00BF62',
    marginLeft: 3,
  },

  /* Metrics Badges */
  metricsBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  metricBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricBadgeBold: {
    fontSize: 13,
    fontWeight: '800',
  },
  metricBadgeSub: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Location Card */
  locationCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  locationCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: 'transparent',
  },
  operatingHoursBadge: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  locationDetailsCol: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationAddressText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  directionsBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 8,
  },
  directionsBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },

  /* Common Section Layout */
  sectionContainer: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00BF62',
  },

  /* Squircle Features Grid */
  squircleCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  squircleCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squircleIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  squircleCardText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* About */
  aboutParagraph: {
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '400',
  },

  /* Trainers */
  trainersRow: {
    flexDirection: 'row',
    gap: 10,
  },
  trainerCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  trainerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  trainerInfo: {
    flex: 1,
  },
  trainerName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  trainerExp: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 3,
  },
  trainerRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainerRatingText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 3,
  },

  /* Reviews */
  reviewsOverviewCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  reviewsOverviewLeft: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.08)',
  },
  bigRatingText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  starsRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  reviewsCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  histogramCol: {
    flex: 1,
    paddingLeft: 14,
  },
  histogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 1.5,
  },
  histStarNum: {
    fontSize: 10,
    fontWeight: '700',
    width: 8,
  },
  histBarTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginHorizontal: 6,
  },
  histBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  histPercent: {
    fontSize: 10,
    fontWeight: '600',
    width: 24,
    textAlign: 'right',
  },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewAuthor: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  reviewStarsRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  reviewTypeCol: {
    alignItems: 'flex-end',
  },
  bookingTypeBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookingTypeText: {
    color: AppColors.accentColor,
    fontSize: 8.5,
    fontWeight: '700',
  },
  reviewDate: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 3,
  },
  reviewComment: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  noReviewsBox: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noReviewsText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },

  /* Guidelines */
  guidelinesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  guidelineCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  guidelineTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  guidelineText: {
    fontSize: 11.5,
    lineHeight: 16,
    flex: 1,
  },
  viewRulesText: {
    fontSize: 11.5,
    fontWeight: '700',
    marginTop: 6,
  },

  /* Bottom Bar */
  bottomBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  callBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookSessionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookSessionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  buyMembershipBtn: {
    flex: 1.2,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#00BF62',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00BF62',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  buyMembershipBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
