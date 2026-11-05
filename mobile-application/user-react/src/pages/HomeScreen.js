import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
  ImageBackground,
  Dimensions,
  Modal,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { AppColors, AppTheme } from '../theme/appTheme';
import { CustomFloatingNavBar } from '../widgets/CustomFloatingNavBar';
import { BrandWatermarkFooter } from '../widgets/BrandWatermarkFooter';
import { MyBookingsScreen } from './MyBookingsScreen';
import { MyMembershipsScreen } from './MyMembershipsScreen';
import { ProfileScreen } from './ProfileScreen';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import {
  locationService,
  searchChennaiLocationsDynamic,
  CHENNAI_LOCATIONS,
} from '../services/locationService';
import { gymService } from '../services/gymService';
import { apiService } from '../services/apiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const POPULAR_CHENNAI_AREAS = [
  'Anna Nagar',
  'T. Nagar',
  'Adyar',
  'Velachery',
  'Porur',
  'Besant Nagar',
  'Nungambakkam',
  'Mylapore',
  'Kilpauk',
  'Vadapalani',
  'OMR',
  'Alwarpet',
  'Thiruvanmiyur',
  'Guindy',
  'Mogappair',
  'Kodambakkam',
  'Ambattur',
  'Tambaram',
];

const CATEGORIES = [
  { name: 'All', icon: 'local-fire-department' },
  { name: 'Strength', icon: 'fitness-center' },
  { name: 'HIIT', icon: 'bolt' },
  { name: 'Yoga', icon: 'self-improvement' },
  { name: 'Boxing', icon: 'sports-mma' },
  { name: 'Zumba', icon: 'music-note' },
  { name: 'CrossFit', icon: 'timer' },
  { name: 'AC Gym', icon: 'ac-unit' },
  { name: 'Women Only', icon: 'female' },
];

const getGymCoverImage = (gym) => {
  if (!gym) return 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop';
  if (typeof gym.thumbnailImage === 'string' && gym.thumbnailImage.length > 0) return gym.thumbnailImage;
  if (typeof gym.imageUrl === 'string' && gym.imageUrl.length > 0) return gym.imageUrl;
  if (typeof gym.image === 'string' && gym.image.length > 0) return gym.image;
  if (gym.images && gym.images.length > 0 && typeof gym.images[0] === 'string') return gym.images[0];
  if (typeof gym.coverPhoto === 'string' && gym.coverPhoto.length > 0) return gym.coverPhoto;
  if (gym.coverPhoto?.fileData) return gym.coverPhoto.fileData;
  return 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop';
};

export const HomeScreen = ({ navigation }) => {
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const { user, isAuthenticated, isRestoringSession } = useAuth();
  const [currentTab, setCurrentTab] = useState(0);

  // Price Display Preference: 'session' | 'membership'
  const [priceDisplayMode, setPriceDisplayMode] = useState('session');

  // Load saved price display preference from local store
  useEffect(() => {
    AsyncStorage.getItem('@gymezy_price_display_mode')
      .then((savedMode) => {
        if (savedMode === 'membership' || savedMode === 'session') {
          setPriceDisplayMode(savedMode);
        }
      })
      .catch(() => {});
  }, []);

  const handleTogglePriceDisplayMode = async (mode) => {
    setPriceDisplayMode(mode);
    try {
      await AsyncStorage.setItem('@gymezy_price_display_mode', mode);
      showToast(mode === 'membership' ? 'Showing Monthly Membership Prices' : 'Showing Single Session Prices');
    } catch (err) {
      console.warn('[HOME] Error saving price display preference:', err);
    }
  };

  // Auto-redirect to Login if session expires or user is logged out
  useEffect(() => {
    if (!isRestoringSession && !isAuthenticated) {
      navigation.replace('Login');
    }
  }, [isAuthenticated, isRestoringSession, navigation]);

  // Location State (defaults to memory/saved location or Anna Nagar)
  const [userLocation, setUserLocation] = useState(locationService.currentLocation);
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Sync saved location on mount
  useEffect(() => {
    locationService
      .getLastSavedLocation()
      .then((savedLoc) => {
        if (
          savedLoc &&
          (savedLoc.latitude !== userLocation.latitude || savedLoc.longitude !== userLocation.longitude)
        ) {
          setUserLocation(savedLoc);
        }
      })
      .catch(() => {});
  }, []);

  const PAGE_SIZE = 15;

  // Gyms State: Initialize synchronously from in-memory cache so no loading spinner appears after splashscreen
  const [gyms, setGyms] = useState(() => {
    const cached = gymService?.getCachedGyms?.({
      lat: locationService?.currentLocation?.latitude,
      lng: locationService?.currentLocation?.longitude,
      page: 1,
      limit: PAGE_SIZE,
    });
    return cached?.gyms || [];
  });
  const [isLoadingGyms, setIsLoadingGyms] = useState(() => {
    const cached = gymService?.getCachedGyms?.({
      lat: locationService?.currentLocation?.latitude,
      lng: locationService?.currentLocation?.longitude,
      page: 1,
      limit: PAGE_SIZE,
    });
    return Boolean(!cached?.gyms || cached.gyms.length === 0);
  });

  // Server-side infinite scroll pagination state
  const [gymsPage, setGymsPage] = useState(1);
  const [hasMoreGyms, setHasMoreGyms] = useState(true);
  const [totalGymsCount, setTotalGymsCount] = useState(() => {
    const cached = gymService?.getCachedGyms?.({
      lat: locationService?.currentLocation?.latitude,
      lng: locationService?.currentLocation?.longitude,
      page: 1,
      limit: PAGE_SIZE,
    });
    return cached?.pagination?.total || 0;
  });
  const [isLoadingMoreGyms, setIsLoadingMoreGyms] = useState(false);
  const gymsPageRef = React.useRef(1);
  gymsPageRef.current = gymsPage;

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedType, setSelectedType] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [bookmarkedGymNames, setBookmarkedGymNames] = useState(new Set());

  // Promotional Banners State (Location-aware, Priority-sorted & Auto-scrolling)
  const [promotionalBanners, setPromotionalBanners] = useState([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const bannerScrollRef = React.useRef(null);
  const bannerScrollX = React.useRef(new Animated.Value(0)).current;
  const isUserTouchingRef = React.useRef(false);
  const activeBannerIndexRef = React.useRef(0);
  activeBannerIndexRef.current = activeBannerIndex;

  // Separate Animated.Value for dot animation — spring-driven with useNativeDriver:true
  const activeDotAnim = React.useRef(new Animated.Value(0)).current;
  const springDot = React.useCallback((idx) => {
    Animated.spring(activeDotAnim, {
      toValue: idx,
      useNativeDriver: true,
      tension: 280,
      friction: 26,
    }).start();
  }, [activeDotAnim]);

  const fetchPromotionalBanners = React.useCallback(async () => {
    try {
      const bannerList = await apiService.getPromotionalBanners(
        userLocation?.latitude,
        userLocation?.longitude
      );
      if (Array.isArray(bannerList)) {
        setPromotionalBanners(bannerList);
      }
    } catch (err) {
      console.warn('[HOME] Error fetching promotional banners:', err?.message);
    }
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    void fetchPromotionalBanners();
  }, [fetchPromotionalBanners]);

  const bannersToDisplay = useMemo(() => {
    if (promotionalBanners.length > 0) return promotionalBanners;
    return [
      {
        _id: 'default_banner_1',
        title: gyms[0]?.name || 'GYMEZY Partner Gym',
        subtitle: gyms[0]?.location || 'Exclusive Membership Deal',
        badgeText: '30% OFF PASS',
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop',
        gymName: gyms[0]?.name || 'GYMEZY Partner Gym',
        gymArea: gyms[0]?.area || 'Near You',
        gym: gyms[0] || null,
        isPriority: false,
      },
    ];
  }, [promotionalBanners, gyms]);

  const handleBannerChange = React.useCallback(
    (index) => {
      const total = bannersToDisplay?.length || 0;
      if (total > 0 && index >= 0 && index < total && index !== activeBannerIndexRef.current) {
        activeBannerIndexRef.current = index;
        setActiveBannerIndex(index);
        springDot(index);
      }
    },
    [bannersToDisplay, springDot]
  );

  // Smooth Auto-scroll Timer: advances to next banner every 3.8 seconds
  useEffect(() => {
    if (bannersToDisplay.length <= 1) return;

    const interval = setInterval(() => {
      if (isUserTouchingRef.current) return;

      const nextIndex = (activeBannerIndexRef.current + 1) % bannersToDisplay.length;
      const cardStep = SCREEN_WIDTH - 32 + 12;
      bannerScrollRef.current?.scrollTo({
        x: nextIndex * cardStep,
        animated: true,
      });
      handleBannerChange(nextIndex);
    }, 3800);

    return () => clearInterval(interval);
  }, [bannersToDisplay.length, handleBannerChange]);

  // Check location permission on launch
  useEffect(() => {
    locationService
      .getPermissionStatus()
      .then((status) => {
        if (status === 'undetermined') {
          const timer = setTimeout(() => {
            setShowLocationModal(true);
          }, 1500);
          return () => clearTimeout(timer);
        } else if (status === 'granted') {
          void handleDetectLocation(false);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Nearest Gyms on location/filter/search changes with instant cache reuse
  useEffect(() => {
    let isMounted = true;
    setGymsPage(1);
    gymsPageRef.current = 1;

    // Check synchronous cache first
    const cached = gymService?.getCachedGyms?.({
      lat: userLocation.latitude,
      lng: userLocation.longitude,
      category: selectedCategory,
      search: searchQuery,
      type: selectedType,
      facility: selectedFacility,
      workout: selectedWorkout,
      page: 1,
      limit: PAGE_SIZE,
    });

    if (cached?.gyms?.length > 0) {
      setGyms(cached.gyms);
      setTotalGymsCount(cached.pagination?.total || cached.gyms.length);
      const more = cached.pagination?.hasMore ?? (cached.pagination?.page < cached.pagination?.pages);
      setHasMoreGyms(Boolean(more));
      setIsLoadingGyms(false);
    } else {
      setIsLoadingGyms(true);
    }

    const delay = searchQuery.trim().length > 0 ? 350 : 0;
    const timer = setTimeout(() => {
      gymService
        .fetchGyms({
          lat: userLocation.latitude,
          lng: userLocation.longitude,
          category: selectedCategory,
          search: searchQuery,
          type: selectedType,
          facility: selectedFacility,
          workout: selectedWorkout,
          page: 1,
          limit: PAGE_SIZE,
        })
        .then((res) => {
          if (isMounted) {
            const fetchedGyms = res.gyms || [];
            setGyms(fetchedGyms);
            const total = res.pagination?.total || fetchedGyms.length;
            setTotalGymsCount(total);
            const more = res.pagination?.hasMore ?? (res.pagination?.page < res.pagination?.pages);
            setHasMoreGyms(Boolean(more && fetchedGyms.length >= PAGE_SIZE));
            setIsLoadingGyms(false);
          }
        })
        .catch((_err) => {
          if (isMounted) {
            setIsLoadingGyms(false);
          }
        });
    }, delay);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [
    userLocation.latitude ? Number(userLocation.latitude).toFixed(2) : '',
    userLocation.longitude ? Number(userLocation.longitude).toFixed(2) : '',
    selectedCategory,
    searchQuery,
    selectedType,
    selectedFacility,
    selectedWorkout,
  ]);

  // Server-Side Infinite Scroll: Load Next Page
  const loadMoreGyms = async () => {
    if (isLoadingMoreGyms || isLoadingGyms || !hasMoreGyms) return;

    setIsLoadingMoreGyms(true);
    const nextPage = gymsPageRef.current + 1;

    try {
      const res = await gymService.fetchGyms({
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        category: selectedCategory,
        search: searchQuery,
        type: selectedType,
        facility: selectedFacility,
        workout: selectedWorkout,
        page: nextPage,
        limit: PAGE_SIZE,
      });

      const newGyms = res?.gyms || [];
      if (newGyms.length > 0) {
        setGyms((prev) => {
          const existingIds = new Set(prev.map((g) => (g.id || g._id || g.partnerId)?.toString()));
          const uniqueNew = newGyms.filter((g) => !existingIds.has((g.id || g._id || g.partnerId)?.toString()));
          return [...prev, ...uniqueNew];
        });
        setGymsPage(nextPage);
        gymsPageRef.current = nextPage;
      }

      const total = res?.pagination?.total ?? totalGymsCount;
      setTotalGymsCount(total);
      const more = res?.pagination?.hasMore ?? (res?.pagination?.page < res?.pagination?.pages);
      setHasMoreGyms(Boolean(more && newGyms.length > 0));
    } catch (err) {
      console.warn('[HOME] Failed to load more gyms:', err.message);
    } finally {
      setIsLoadingMoreGyms(false);
    }
  };

  const handleHomeScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 400;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    if (isCloseToBottom && hasMoreGyms && !isLoadingMoreGyms && !isLoadingGyms) {
      loadMoreGyms();
    }
  };

  const handleDetectLocation = async (showFeedback = true) => {
    setIsLocating(true);
    try {
      const res = await locationService.requestLocationWithNativeGps();
      if (res?.location) {
        setUserLocation(res.location);
        setShowLocationModal(false);
        if (res.success && showFeedback) {
          showToast({
            message: `Located at ${res.location.name}!`,
            isSuccess: true,
          });
        }
      }
    } catch (err) {
      console.warn('[HOME] Location detection note:', err?.message);
      const fallbackLoc = await locationService.getLastSavedLocation();
      setUserLocation(fallbackLoc);
      setShowLocationModal(false);
    } finally {
      setIsLocating(false);
    }
  };

  // Custom Location Search State & Suggestions (Dynamic Fast Geocoding)
  const [locationSearchText, setLocationSearchText] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const trimmed = locationSearchText.trim();
    if (!trimmed) {
      setLocationSuggestions([]);
      setIsSearchingLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    const timer = setTimeout(() => {
      searchChennaiLocationsDynamic(trimmed)
        .then((results) => {
          if (isMounted) {
            setLocationSuggestions(results || []);
            setIsSearchingLocation(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsSearchingLocation(false);
        });
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [locationSearchText]);

  const handleSelectCustomLocation = async (loc) => {
    const locationData = {
      latitude: loc.lat,
      longitude: loc.lon,
      name: loc.name,
      city: loc.city || 'Chennai',
      isGps: false,
    };
    await locationService.saveLocation(locationData);
    setUserLocation(locationData);
    setShowLocationModal(false);
    setLocationSearchText('');
    showToast({
      message: `Location set to ${loc.name}`,
      isSuccess: true,
    });
  };

  // Top Rated Gyms: Rating >= 4.5, sorted by highest rating first with nearest distance tiebreaker (top 8)
  const topRatedGyms = useMemo(() => {
    if (!Array.isArray(gyms) || gyms.length === 0) return [];

    return [...gyms]
      .filter((g) => Number(g.rating || 0) >= 4.5)
      .sort((a, b) => {
        const ratingA = Number(a.rating || 0);
        const ratingB = Number(b.rating || 0);
        if (ratingB !== ratingA) {
          return ratingB - ratingA; // Highest rating first (5.0 -> 4.9 -> 4.8 -> ...)
        }
        const distA = a.distance != null ? Number(a.distance) : 9999;
        const distB = b.distance != null ? Number(b.distance) : 9999;
        return distA - distB; // Nearest distance tiebreaker
      })
      .slice(0, 8);
  }, [gyms]);

  // Filtered Gyms are the backend-computed and processed gyms
  const filteredGyms = gyms;

  const toggleBookmark = (gymName) => {
    setBookmarkedGymNames((prev) => {
      const next = new Set(prev);
      if (next.has(gymName)) {
        next.delete(gymName);
      } else {
        next.add(gymName);
      }
      return next;
    });
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedType(null);
    setSelectedFacility(null);
    setSelectedWorkout(null);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedCategory !== 'All' ||
    selectedType !== null ||
    selectedFacility !== null ||
    selectedWorkout !== null;

  // 1. Explore Tab View matching Flutter 1:1
  const renderExploreTab = () => {
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.exploreScroll}
        onScroll={handleHomeScroll}
        scrollEventThrottle={16}
      >
        {/* 1. Header Bar: Dynamic Greeting + Location */}
        <View style={styles.headerBar}>
          <View>
            <View style={styles.greetingRow}>
              <Text style={[styles.greetingText, { color: colors.text }]}>
                Hello {user?.fullName ? user.fullName.split(' ')[0] : 'Fitness Pro'}
              </Text>
                          </View>
            <TouchableOpacity
              style={styles.locationPillRow}
              activeOpacity={0.7}
              onPress={() => setShowLocationModal(true)}
            >
              <MaterialIcons
                name="location-on"
                size={14}
                color={AppColors.secondaryColor}
              />
              <Text style={[styles.locationCityText, { color: colors.subtitle }]}>
                {userLocation.name}
              </Text>
              {isLocating ? (
                <ActivityIndicator
                  size="small"
                  color={AppColors.primaryColor}
                  style={{ marginLeft: 6 }}
                />
              ) : (
                <MaterialIcons
                  name="keyboard-arrow-down"
                  size={16}
                  color={colors.subtitle}
                  style={{ marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Wallet Button */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Wallet')}
            style={[
              styles.notificationBtn,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#F8FAFC',
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.7}
          >
            <Ionicons name="wallet-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* 2. Search & Filter Bar */}
        <View style={styles.searchBarRow}>
          <View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#F8FAFC',
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialIcons
              name="search"
              size={22}
              color={isDark ? 'rgba(255,255,255,0.7)' : AppColors.primaryColor}
              style={{ marginLeft: 12, marginRight: 8 }}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search gyms, workouts, locations..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8'}
              style={[styles.searchInput, { color: colors.text }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 8 }}>
                <MaterialIcons name="close" size={18} color={colors.subtitle} />
              </TouchableOpacity>
            )}
          </View>

          {/* Solid Gradient Filter Button */}
          <TouchableOpacity
            onPress={() => setShowFilterModal(true)}
            style={styles.filterBtnWrapper}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[AppColors.primaryColor, '#1E40AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.filterBtn}
            >
              <MaterialIcons name="tune" size={22} color="#FFFFFF" />
              {(selectedType || selectedFacility || selectedWorkout) && (
                <View style={styles.activeFilterDot} />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 3. High-Impact Promotional Flash Banner Carousel (Location-aware & Priority-sorted) */}
        <View style={styles.promoBannerWrapper}>
          <Animated.ScrollView
            ref={bannerScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={SCREEN_WIDTH - 32 + 12}
            snapToAlignment="start"
            contentContainerStyle={styles.promoCarouselScroll}
            onScrollBeginDrag={() => {
              isUserTouchingRef.current = true;
            }}
            onScrollEndDrag={() => {
              setTimeout(() => {
                isUserTouchingRef.current = false;
              }, 2500);
            }}
            onMomentumScrollEnd={(e) => {
              isUserTouchingRef.current = false;
              const offsetX = e.nativeEvent.contentOffset.x;
              const cardStep = SCREEN_WIDTH - 32 + 12;
              const index = Math.round(offsetX / cardStep);
              handleBannerChange(index);
            }}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: bannerScrollX } } }],
              {
                useNativeDriver: false,
                listener: (e) => {
                  const offsetX = e.nativeEvent.contentOffset.x;
                  const cardStep = SCREEN_WIDTH - 32 + 12;
                  const index = Math.round(offsetX / cardStep);
                  handleBannerChange(index);
                },
              }
            )}
            scrollEventThrottle={16}
          >
            {bannersToDisplay.map((banner, index) => {
              let bannerImg = null;
              if (typeof banner.image === 'string' && banner.image.trim().length > 0) {
                bannerImg = banner.image.trim();
              } else if (banner.image?.fileData && banner.image.fileData.trim().length > 50) {
                bannerImg = banner.image.fileData.trim();
              } else if (typeof banner.imageUrl === 'string' && banner.imageUrl.trim().length > 0) {
                bannerImg = banner.imageUrl.trim();
              } else if (banner.image?.fileUrl && banner.image.fileUrl.trim().length > 0) {
                bannerImg = banner.image.fileUrl.trim();
              }
              if (!bannerImg) {
                bannerImg = getGymCoverImage(banner.gym);
              }
              const isPriority = Boolean(banner.isPriority);
              const gymName = banner.gymName || banner.gym?.name || 'GYMEZY Partner Gym';
              const bannerTitle = banner.title || gymName;
              const gymArea = banner.gymArea || banner.gym?.area || '';
              const distanceText = banner.distanceKm != null ? `${banner.distanceKm} km away` : (gymArea || 'Near You');
              const badgeLabel = banner.badgeText || (isPriority ? 'PRIORITY DEAL' : '30% OFF PASS');

              return (
                <TouchableOpacity
                  key={banner._id || `banner_${index}`}
                  activeOpacity={0.92}
                  onPress={() => {
                    const rawGymId =
                      banner.gym?._id ||
                      banner.gym?.id ||
                      banner.gym?.mongoId ||
                      banner.gymId?._id ||
                      banner.gymId?.id ||
                      banner.gymId;
                    const targetIdStr = String(rawGymId || '');

                    const matchedGym = gyms.find(
                      (g) => String(g._id || g.id || g.mongoId || '') === targetIdStr
                    );

                    const targetGym = matchedGym
                      ? { ...(banner.gym || {}), ...matchedGym }
                      : (banner.gym && typeof banner.gym === 'object'
                        ? {
                            ...banner.gym,
                            _id: banner.gym._id || targetIdStr,
                            id: banner.gym.id || banner.gym._id || targetIdStr,
                            mongoId: banner.gym.mongoId || banner.gym._id || targetIdStr,
                          }
                        : {
                            _id: targetIdStr,
                            id: targetIdStr,
                            mongoId: targetIdStr,
                            name: gymName,
                            slug: banner.gymSlug,
                            area: gymArea,
                            location: gymArea,
                          });

                    navigation.navigate('GymDetails', { gym: targetGym });
                  }}
                  style={[styles.promoBannerContainer, { width: SCREEN_WIDTH - 32 }]}
                >
                  <ImageBackground
                    source={{ uri: bannerImg }}
                    style={styles.promoBannerBackground}
                    imageStyle={styles.promoBannerImageStyle}
                    resizeMode="cover"
                  >
                    <LinearGradient
                      colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.85)']}
                      locations={[0, 0.45, 1]}
                      style={styles.promoContentOverlay}
                    >
                    {/* Top Row: Flash Badge & Priority Tag / Proximity */}
                    <View style={styles.promoTopRow}>
                      <View
                        style={[
                          styles.flashBadge,
                          isPriority && { backgroundColor: '#F59E0B' },
                        ]}
                      >
                        <MaterialIcons
                          name={isPriority ? 'star' : 'bolt'}
                          size={14}
                          color="#FFFFFF"
                        />
                        <Text style={styles.flashBadgeText}>{badgeLabel}</Text>
                      </View>

                      <View style={styles.countdownBadge}>
                        <MaterialIcons
                          name={banner.distanceKm != null ? 'near-me' : 'place'}
                          size={12}
                          color="rgba(255,255,255,0.9)"
                        />
                        <Text style={styles.countdownText}>{distanceText}</Text>
                      </View>
                    </View>

                    {/* Bottom Row: Title, Subtitle, Claim Button */}
                    <View style={styles.promoBottomRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.promoGymTitle} numberOfLines={1}>
                          {bannerTitle}
                        </Text>
                        <Text style={styles.promoGymSubtitle} numberOfLines={1}>
                          {gymName} {gymArea ? `• ${gymArea}` : ''}
                        </Text>
                      </View>

                      <View style={styles.claimOfferBtn}>
                        <Text style={styles.claimOfferText}>Explore</Text>
                        <MaterialIcons
                          name="arrow-forward"
                          size={14}
                          color={AppColors.primaryColor}
                          style={{
                            marginLeft: 4,
                            transform: [{ rotate: '-45deg' }],
                          }}
                        />
                      </View>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
              );
            })}
          </Animated.ScrollView>

          {/* Pagination Dots — activeDotAnim spring on UI thread (useNativeDriver:true) */}
          {bannersToDisplay.length > 1 && (
            <View style={styles.bannerDotsOverlay} pointerEvents="none">
              {bannersToDisplay.map((_, dotIdx) => {
                // inputRange is index-based (not scroll offset), fully decoupled from JS scroll
                const inputRange = [dotIdx - 1, dotIdx, dotIdx + 1];

                // Uniform scale keeps active dot as a proper circle while highlighting it
                const dotScale = activeDotAnim.interpolate({
                  inputRange,
                  outputRange: [1, 1.35, 1],
                  extrapolate: 'clamp',
                });

                const dotOpacity = activeDotAnim.interpolate({
                  inputRange,
                  outputRange: [0.4, 1, 0.4],
                  extrapolate: 'clamp',
                });

                return (
                  <Animated.View
                    key={`banner_dot_${dotIdx}`}
                    style={[
                      styles.bannerDot,
                      {
                        opacity: dotOpacity,
                        transform: [{ scale: dotScale }],
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}
        </View>


        {/* 4. Curated Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsScroll}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => setSelectedCategory(cat.name)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSelected
                      ? AppColors.primaryColor
                      : isDark
                      ? '#1E1E1E'
                      : '#F1F5F9',
                    borderColor: isSelected
                      ? 'transparent'
                      : isDark
                      ? 'rgba(255,255,255,0.1)'
                      : '#E2E8F0',
                  },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={cat.icon}
                  size={16}
                  color={
                    isSelected
                      ? '#FFFFFF'
                      : isDark
                      ? 'rgba(255,255,255,0.7)'
                      : AppColors.primaryColor
                  }
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : isDark
                        ? 'rgba(255,255,255,0.7)'
                        : colors.text,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. Spotlight Section: "⭐ Top Rated Near You" Horizontal Carousel */}
        {searchQuery.length === 0 && selectedCategory === 'All' && topRatedGyms.length > 0 && (
          <View style={styles.spotlightSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleWithIcon}>
                <MaterialIcons name="star" size={22} color="#F59E0B" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Top Rated Near You
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedCategory('All')}>
                <Text style={styles.seeAllText}>See all</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.spotlightScroll}
            >
              {topRatedGyms.map((gym) => {
                const isBookmarked = bookmarkedGymNames.has(gym.name);
                return (
                  <TouchableOpacity
                    key={gym._id || gym.id || gym.name}
                    onPress={() => navigation.navigate('GymDetails', { gym })}
                    activeOpacity={0.88}
                    style={[
                      styles.spotlightCard,
                      {
                        backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                      },
                    ]}
                  >
                    {/* Image Stack */}
                    <View style={styles.spotlightImageWrapper}>
                      <Image
                        source={{ uri: getGymCoverImage(gym) }}
                        style={styles.spotlightImage}
                        resizeMode="cover"
                      />
                      {/* Rating Badge */}
                      <View style={styles.spotlightRatingBadge}>
                        {gym.rating && Number(gym.rating) > 0 ? (
                          <>
                            <MaterialIcons name="star" size={14} color="#F59E0B" />
                            <Text style={styles.spotlightRatingText}>{gym.rating}</Text>
                          </>
                        ) : (
                          <Text style={styles.spotlightRatingText}>No ratings</Text>
                        )}
                      </View>

                      {/* Bookmark Button */}
                      <TouchableOpacity
                        onPress={() => toggleBookmark(gym.name)}
                        style={styles.spotlightBookmarkBtn}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                          size={16}
                          color={isBookmarked ? AppColors.secondaryColor : '#FFFFFF'}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Details */}
                    <View style={styles.spotlightDetailsPadding}>
                      <Text
                        style={[styles.spotlightGymName, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {gym.name}
                      </Text>

                      <View style={styles.spotlightLocationRow}>
                        <MaterialIcons
                          name="location-on"
                          size={13}
                          color={colors.subtitle}
                        />
                        <Text
                          style={[styles.spotlightLocationText, { color: colors.subtitle }]}
                          numberOfLines={1}
                        >
                          {gym.location} • {gym.distance} km
                        </Text>
                      </View>

                      <View style={styles.spotlightBottomRow}>
                        <Text style={styles.spotlightPriceText}>
                          <Text style={[styles.spotlightPriceVal, { color: colors.text }]}>
                            ₹{priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false
                              ? (gym.monthlyPrice || gym.membershipPrice || (gym.singleSessionPrice || 199) * 10).toFixed(0)
                              : (gym.singleSessionPrice || gym.pricePerSession || 199).toFixed(0)}
                          </Text>
                          <Text style={[styles.spotlightPriceSub, { color: colors.subtitle }]}>
                            {' '}
                            {priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false ? '/month' : '/session'}
                          </Text>
                        </Text>

                        <View style={styles.spotlightBookSlotPill}>
                          <Text style={styles.spotlightBookSlotText}>
                            {priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false ? 'View Plan' : 'Book Slot'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 6. Nearby Gyms Header */}
        <View style={styles.nearbyHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.nearbySectionTitle, { color: colors.text }]}>
              {selectedCategory === 'All' ? 'Nearby Gyms' : `${selectedCategory} Gyms`}
            </Text>
            <View style={styles.gymsCountBadge}>
              <Text style={styles.gymsCountText}>
                {totalGymsCount > 0 ? totalGymsCount : filteredGyms.length}
              </Text>
            </View>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={styles.resetFiltersText}>Reset Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 7. Gym List Cards */}
        {isLoadingGyms ? (
          <View style={styles.gymsLoadingContainer}>
            <ActivityIndicator size="large" color={AppColors.primaryColor} />
            <Text style={[styles.gymsLoadingText, { color: colors.subtitle }]}>
              Finding nearest gyms in {userLocation.name}...
            </Text>
          </View>
        ) : filteredGyms.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={48} color={colors.subtitle} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No gyms found</Text>
            <Text style={[styles.emptySub, { color: colors.subtitle }]}>
              Try adjusting your search or filters to see more results
            </Text>
          </View>
        ) : (
          filteredGyms.map((gym, index) => {
            const isBookmarked = bookmarkedGymNames.has(gym.name);


            return (
              <View key={gym.id || gym.name} style={{ marginHorizontal: 16, marginBottom: 16 }}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('GymDetails', { gym })}
                  activeOpacity={0.9}
                  style={[
                    styles.gymCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {/* Gym Hero Image with Badges */}
                  <View style={styles.gymCardImageContainer}>
                    <Image
                      source={{ uri: getGymCoverImage(gym) }}
                      style={styles.gymCardImage}
                      resizeMode="cover"
                    />

                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.6)']}
                      style={styles.gymCardGradient}
                    />

                    {/* Popular / Best Badge */}
                    {gym.badgeText && (
                      <View style={styles.cardPopularBadge}>
                        <MaterialIcons name="local-fire-department" size={13} color="#FFFFFF" />
                        <Text style={styles.cardPopularBadgeText}>{gym.badgeText}</Text>
                      </View>
                    )}

                    {/* Bookmark Button */}
                    <TouchableOpacity
                      onPress={() => toggleBookmark(gym.name)}
                      style={styles.cardBookmarkBtn}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                        size={18}
                        color={isBookmarked ? AppColors.secondaryColor : '#FFFFFF'}
                      />
                    </TouchableOpacity>

                    {/* Image Bottom Info Overlay */}
                    <View style={styles.cardImageBottomInfo}>
                      <View style={styles.cardRatingPill}>
                        {gym.rating && Number(gym.rating) > 0 ? (
                          <>
                            <MaterialIcons name="star" size={13} color="#F59E0B" />
                            <Text style={styles.cardRatingText}>{gym.rating}</Text>
                            {gym.reviewsCount ? (
                              <Text style={styles.cardReviewsCountText}>({gym.reviewsCount})</Text>
                            ) : null}
                          </>
                        ) : (
                          <Text style={styles.cardRatingText}>No ratings</Text>
                        )}
                      </View>

                      <View style={styles.cardDistancePill}>
                        <MaterialIcons name="near-me" size={12} color="#FFFFFF" />
                        <Text style={styles.cardDistanceText}>{gym.distance} km</Text>
                      </View>
                    </View>
                  </View>

                  {/* Gym Card Details Content */}
                  <View style={styles.gymCardDetailsContent}>
                    <View style={styles.gymTitleRow}>
                      <Text
                        style={[styles.cardGymNameTitle, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {gym.name}
                      </Text>
                      <Text style={[styles.cardPerSessionPrice, { color: colors.text }]}>
                        ₹{priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false
                          ? (gym.monthlyPrice || gym.membershipPrice || (gym.singleSessionPrice || 199) * 10).toFixed(0)
                          : (gym.singleSessionPrice || gym.pricePerSession || 199).toFixed(0)}
                        <Text style={[styles.cardPerSessionSub, { color: colors.subtitle }]}>
                          {priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false ? ' /mo' : ' /session'}
                        </Text>
                      </Text>
                    </View>

                    <Text
                      style={[styles.cardGymAddressText, { color: colors.subtitle }]}
                      numberOfLines={1}
                    >
                      {gym.location}
                    </Text>

                    {/* Tags Row */}
                    <View style={styles.tagsContainer}>
                      {(gym.tags || ['Strength', 'Cardio']).slice(0, 3).map((tag, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.tagChip,
                            {
                              backgroundColor: isDark ? '#262626' : '#F1F5F9',
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Text style={[styles.tagChipText, { color: colors.subtitle }]}>
                            {tag}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Bottom Action Strip */}
                    <View style={styles.gymCardBottomStrip}>
                      <View>
                        <Text style={[styles.pricePrefix, { color: colors.subtitle }]}>
                          {priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false ? 'Monthly Plan from' : 'Pass starts from'}
                        </Text>
                        <Text style={[styles.cardPriceText, { color: colors.text }]}>
                          ₹{priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false
                            ? (gym.monthlyPrice || gym.membershipPrice || (gym.singleSessionPrice || 199) * 10).toFixed(0)
                            : (gym.singleSessionPrice || gym.pricePerSession || 199).toFixed(0)}{' '}
                          <Text style={styles.cardPerSession}>
                            {priceDisplayMode === 'membership' || gym.singleSessionBookingEnabled === false ? '/ month' : '/ day'}
                          </Text>
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => navigation.navigate('GymDetails', { gym })}
                        style={[styles.viewGymBtn, { backgroundColor: AppColors.primaryColor }]}
                      >
                        <Text style={styles.viewGymText}>
                          {priceDisplayMode === 'membership' ? 'View Plans' : 'Book Now'}
                        </Text>
                        <MaterialIcons name="arrow-forward" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}

        {/* Infinite Scroll Footer: Loading indicator & End of list message */}
        {isLoadingMoreGyms && (
          <View style={styles.loadingMoreContainer}>
            <ActivityIndicator size="small" color={AppColors.primaryColor} />
            <Text style={[styles.loadingMoreText, { color: colors.subtitle }]}>
              Loading more gyms near {userLocation.name}...
            </Text>
          </View>
        )}

        {!hasMoreGyms && filteredGyms.length > 0 && !isLoadingGyms && (
          <View style={styles.endOfListContainer}>
            <View style={[styles.endOfListDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.endOfListText, { color: colors.subtitle }]}>
              You've explored all {totalGymsCount || filteredGyms.length} gyms near you
            </Text>
            <View style={[styles.endOfListDivider, { backgroundColor: colors.border }]} />
          </View>
        )}

        {/* 8. 'GYMEZY for you' and Watermark Branding Section at the bottom of the feed */}
        {!isLoadingGyms && (
          <View style={styles.gymezyForYouSection}>
            <View style={styles.forYouHeader}>
              <Text style={[styles.forYouTitle, { color: colors.text }]}>
                GYMEZY for you
              </Text>
              <View style={styles.exclusiveBadge}>
                <Text style={styles.exclusiveBadgeText}>Exclusive</Text>
              </View>
            </View>

            {/* 2-Column Cards Grid */}
            <View style={styles.forYouGrid}>
              <TouchableOpacity
                onPress={() => navigation.navigate('BuyMembership', { gym: gyms[0] || {} })}
                style={[
                  styles.forYouCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.forYouIconBox,
                    { backgroundColor: 'rgba(0, 56, 130, 0.1)' },
                  ]}
                >
                  <MaterialIcons
                    name="card-membership"
                    size={24}
                    color={AppColors.primaryColor}
                  />
                </View>
                <Text style={[styles.forYouCardTitle, { color: colors.text }]}>
                  All-Access Pass
                </Text>
                <Text style={[styles.forYouCardSub, { color: colors.subtitle }]}>
                  Work out at any partner gym across Chennai
                </Text>
                <View style={styles.forYouLinkRow}>
                  <Text
                    style={[
                      styles.forYouLinkText,
                      { color: isDark ? '#93C5FD' : AppColors.primaryColor },
                    ]}
                  >
                    Get pass
                  </Text>
                  <MaterialIcons
                    name="arrow-outward"
                    size={14}
                    color={isDark ? '#93C5FD' : AppColors.primaryColor}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('BookingSession', { gym: gyms[0] || {} })}
                style={[
                  styles.forYouCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.forYouIconBox,
                    { backgroundColor: 'rgba(0, 191, 98, 0.12)' },
                  ]}
                >
                  <MaterialIcons
                    name="fitness-center"
                    size={24}
                    color={AppColors.secondaryColor}
                  />
                </View>
                <Text style={[styles.forYouCardTitle, { color: colors.text }]}>
                  Certified Trainers
                </Text>
                <Text style={[styles.forYouCardSub, { color: colors.subtitle }]}>
                  Book 1-on-1 personal coaches at special rates
                </Text>
                <View style={styles.forYouLinkRow}>
                  <Text
                    style={[
                      styles.forYouLinkText,
                      { color: AppColors.secondaryColor },
                    ]}
                  >
                    Book trainer
                  </Text>
                  <MaterialIcons
                    name="arrow-outward"
                    size={14}
                    color={AppColors.secondaryColor}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Watermark Branding */}
            <BrandWatermarkFooter />
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        {currentTab === 0 && renderExploreTab()}
        {currentTab === 1 && <MyBookingsScreen navigation={navigation} />}
        {currentTab === 2 && <MyMembershipsScreen navigation={navigation} />}
        {currentTab === 3 && (
          <ProfileScreen
            navigation={navigation}
            onNavigateToBookings={() => setCurrentTab(1)}
            onNavigateToMemberships={() => setCurrentTab(2)}
          />
        )}
      </SafeAreaView>

      {/* Floating Bottom Navigation Bar */}
      <CustomFloatingNavBar
        currentIndex={currentTab}
        onTap={(index) => setCurrentTab(index)}
      />

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.filterModalOverlay}>
          <View
            style={[
              styles.filterModalContent,
              { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' },
            ]}
          >
            <View style={styles.filterModalHeader}>
              <Text style={[styles.filterModalTitle, { color: colors.text }]}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <MaterialIcons name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Gym Type */}
              <Text style={[styles.filterGroupTitle, { color: colors.text }]}>Gym Type</Text>
              <View style={styles.filterChipsRow}>
                {['All Gyms', 'Unisex', 'Women Only', 'Men Only'].map((type) => {
                  const isSel = (selectedType === null && type === 'All Gyms') || selectedType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setSelectedType(type === 'All Gyms' ? null : type)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSel
                            ? AppColors.primaryColor
                            : isDark
                            ? '#262626'
                            : '#F1F5F9',
                          borderColor: isSel ? AppColors.primaryColor : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isSel ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Facility */}
              <Text style={[styles.filterGroupTitle, { color: colors.text, marginTop: 16 }]}>
                Facilities
              </Text>
              <View style={styles.filterChipsRow}>
                {['All Facilities', 'AC', 'Locker', 'Shower', 'Parking'].map((fac) => {
                  const isSel = (selectedFacility === null && fac === 'All Facilities') || selectedFacility === fac;
                  return (
                    <TouchableOpacity
                      key={fac}
                      onPress={() => setSelectedFacility(fac === 'All Facilities' ? null : fac)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: isSel
                            ? AppColors.primaryColor
                            : isDark
                            ? '#262626'
                            : '#F1F5F9',
                          borderColor: isSel ? AppColors.primaryColor : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: isSel ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {fac}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {/* Price Display Preference */}
              <Text style={[styles.filterGroupTitle, { color: colors.text, marginTop: 16 }]}>
                Price Display Preference
              </Text>
              <View style={styles.pricePreferenceContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleTogglePriceDisplayMode('session')}
                  style={[
                    styles.priceOptionCard,
                    {
                      backgroundColor:
                        priceDisplayMode === 'session'
                          ? isDark
                            ? 'rgba(79, 70, 229, 0.15)'
                            : '#EEF2FF'
                          : isDark
                          ? '#262626'
                          : '#F8FAFC',
                      borderColor:
                        priceDisplayMode === 'session'
                          ? AppColors.primaryColor
                          : colors.border,
                    },
                  ]}
                >
                  <View style={styles.checkboxRow}>
                    <MaterialIcons
                      name={
                        priceDisplayMode === 'session'
                          ? 'radio-button-checked'
                          : 'radio-button-unchecked'
                      }
                      size={20}
                      color={
                        priceDisplayMode === 'session'
                          ? AppColors.primaryColor
                          : colors.subtitle
                      }
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.priceOptionTitle, { color: colors.text }]}>
                        Show Session Price
                      </Text>
                      <Text
                        style={[styles.priceOptionSubtitle, { color: colors.subtitle }]}
                      >
                        Displays single session rate (e.g. ₹199 / session)
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleTogglePriceDisplayMode('membership')}
                  style={[
                    styles.priceOptionCard,
                    {
                      marginTop: 10,
                      backgroundColor:
                        priceDisplayMode === 'membership'
                          ? isDark
                            ? 'rgba(79, 70, 229, 0.15)'
                            : '#EEF2FF'
                          : isDark
                          ? '#262626'
                          : '#F8FAFC',
                      borderColor:
                        priceDisplayMode === 'membership'
                          ? AppColors.primaryColor
                          : colors.border,
                    },
                  ]}
                >
                  <View style={styles.checkboxRow}>
                    <MaterialIcons
                      name={
                        priceDisplayMode === 'membership'
                          ? 'radio-button-checked'
                          : 'radio-button-unchecked'
                      }
                      size={20}
                      color={
                        priceDisplayMode === 'membership'
                          ? AppColors.primaryColor
                          : colors.subtitle
                      }
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.priceOptionTitle, { color: colors.text }]}>
                        Show Membership Price
                      </Text>
                      <Text
                        style={[styles.priceOptionSubtitle, { color: colors.subtitle }]}
                      >
                        Displays monthly membership rate (e.g. ₹1,999 / month)
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.filterActionsRow}>
              <TouchableOpacity
                onPress={clearAllFilters}
                style={[styles.filterResetBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.filterResetText, { color: colors.text }]}>Reset</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.filterApplyBtn}
              >
                <Text style={styles.filterApplyText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================== LOCATION PERMISSION & CUSTOM PLACE MODAL ==================== */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowLocationModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.filterModalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdropFlex}
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setShowLocationModal(false);
            }}
          />
          <View
            style={[
              styles.locationModalContent,
              { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' },
            ]}
          >
            {/* Header: Title + Close Button */}
            <View style={styles.locationModalHeaderRow}>
              <View style={styles.locationHeaderLeft}>
                <View style={styles.locationSmallIconBadge}>
                  <MaterialIcons name="location-on" size={18} color="#FFFFFF" />
                </View>
                <Text style={[styles.locationModalTitleText, { color: colors.text }]}>
                  Choose Location
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  Keyboard.dismiss();
                  setShowLocationModal(false);
                }}
                style={[
                  styles.locationModalCloseBtn,
                  { backgroundColor: isDark ? '#2D2D2D' : '#F1F5F9' },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Custom Location Search Input (Top priority so keyboard never hides it) */}
            <View
              style={[
                styles.locationSearchInputWrapper,
                {
                  backgroundColor: isDark ? '#2A2A2A' : '#F8FAFC',
                  borderColor: isDark ? '#3D3D3D' : colors.border,
                },
              ]}
            >
              <MaterialIcons name="search" size={20} color={AppColors.primaryColor} />
              <TextInput
                style={[styles.locationSearchInput, { color: colors.text }]}
                placeholder="Search Chennai area (e.g. Anna Nagar, Porur)..."
                placeholderTextColor={colors.subtitle}
                value={locationSearchText}
                onChangeText={setLocationSearchText}
                autoCorrect={false}
                returnKeyType="search"
              />
              {isSearchingLocation ? (
                <ActivityIndicator size="small" color={AppColors.primaryColor} />
              ) : (
                locationSearchText.length > 0 && (
                  <TouchableOpacity onPress={() => setLocationSearchText('')}>
                    <MaterialIcons name="cancel" size={18} color={colors.subtitle} />
                  </TouchableOpacity>
                )
              )}
            </View>

            {/* GPS Enable Button (Solid Navy Blue Pill) */}
            <TouchableOpacity
              style={styles.gpsEnableActionBtn}
              onPress={() => {
                Keyboard.dismiss();
                void handleDetectLocation(true);
              }}
              disabled={isLocating}
              activeOpacity={0.85}
            >
              {isLocating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.gpsBtnRow}>
                  <MaterialIcons name="my-location" size={18} color="#FFFFFF" />
                  <Text style={styles.gpsEnableBtnText}>Use Current Location (GPS)</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Section: Popular Areas (when search is empty) OR Dynamic Live Results (when typing) */}
            {locationSearchText.trim().length === 0 ? (
              <View style={styles.popularLocalitiesSection}>
                <Text style={[styles.locationSectionHeader, { color: colors.subtitle }]}>
                  POPULAR LOCALITIES
                </Text>
                <ScrollView
                  style={styles.popularLocalitiesScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.popularLocalitiesWrap}
                  keyboardShouldPersistTaps="handled"
                >
                  {POPULAR_CHENNAI_AREAS.map((areaName) => {
                    const locObj =
                      CHENNAI_LOCATIONS.find((l) => l.area === areaName) || {
                        name: `${areaName}, Chennai`,
                        area: areaName,
                        city: 'Chennai',
                        lat: 13.0827,
                        lon: 80.2707,
                      };
                    const isSelected = userLocation.name
                      ?.toLowerCase()
                      .includes(areaName.toLowerCase());
                    return (
                      <TouchableOpacity
                        key={areaName}
                        style={[
                          styles.popularAreaPill,
                          {
                            backgroundColor: isSelected
                              ? AppColors.primaryColor
                              : isDark
                              ? '#2A2A2A'
                              : '#F1F5F9',
                            borderColor: isSelected
                              ? AppColors.primaryColor
                              : isDark
                              ? '#3A3A3A'
                              : '#E2E8F0',
                          },
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          void handleSelectCustomLocation(locObj);
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="place"
                          size={13}
                          color={isSelected ? '#FFFFFF' : AppColors.primaryColor}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.popularAreaPillText,
                            {
                              color: isSelected ? '#FFFFFF' : colors.text,
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {areaName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <View style={styles.searchResultsSection}>
                <Text style={[styles.locationSectionHeader, { color: colors.subtitle }]}>
                  SEARCH RESULTS
                </Text>
                <ScrollView
                  style={styles.locationSuggestionsList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {locationSuggestions.map((item) => {
                    const isSelected =
                      userLocation.name?.toLowerCase() === item.name.toLowerCase() ||
                      userLocation.name?.toLowerCase().startsWith(item.area.toLowerCase());
                    return (
                      <TouchableOpacity
                        key={item.name}
                        style={[
                          styles.locationSuggestionItem,
                          {
                            borderBottomColor: isDark ? '#2D2D2D' : '#F1F5F9',
                            backgroundColor: isSelected
                              ? isDark
                                ? 'rgba(255, 107, 0, 0.12)'
                                : 'rgba(255, 107, 0, 0.08)'
                              : 'transparent',
                          },
                        ]}
                        onPress={() => {
                          Keyboard.dismiss();
                          void handleSelectCustomLocation(item);
                        }}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.locationItemPinCircle,
                            {
                              backgroundColor: isSelected
                                ? AppColors.primaryColor
                                : isDark
                                ? '#2D2D2D'
                                : '#E2E8F0',
                            },
                          ]}
                        >
                          <MaterialIcons
                            name="place"
                            size={16}
                            color={isSelected ? '#FFFFFF' : AppColors.secondaryColor}
                          />
                        </View>
                        <View style={styles.locationItemTextCol}>
                          <Text
                            style={[
                              styles.locationItemName,
                              {
                                color: isSelected ? AppColors.primaryColor : colors.text,
                                fontWeight: isSelected ? '700' : '600',
                              },
                            ]}
                          >
                            {item.name}
                          </Text>
                          <Text style={[styles.locationItemSub, { color: colors.subtitle }]}>
                            {item.area} • Chennai, Tamil Nadu
                          </Text>
                        </View>
                        {isSelected && (
                          <MaterialIcons
                            name="check-circle"
                            size={20}
                            color={AppColors.primaryColor}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  {locationSuggestions.length === 0 && !isSearchingLocation && (
                    <View style={styles.emptyLocationSearchBox}>
                      <MaterialIcons name="location-off" size={28} color={colors.subtitle} />
                      <Text style={[styles.emptyLocationSearchText, { color: colors.subtitle }]}>
                        No matching Chennai area found
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  exploreScroll: {
    paddingBottom: 120,
  },

  /* Header Bar */
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greetingText: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  waveEmoji: {
    fontSize: 20,
  },
  locationPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationCityText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  notifRedDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  /* Search & Filter Bar */
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  searchInputContainer: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    height: '100%',
  },
  filterBtnWrapper: {
    marginLeft: 10,
    borderRadius: 16,
  },
  filterBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeFilterDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.secondaryColor,
  },

  /* High-Impact Promotional Flash Banner Carousel */
  promoBannerWrapper: {
    marginTop: 18,
    position: 'relative',
  },
  promoCarouselScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  bannerDotsOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  // Circular pagination dots with 1:1 aspect ratio
  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    marginHorizontal: 4,
  },
  promoBannerContainer: {
    height: 185,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  promoBannerBackground: {
    width: '100%',
    height: '100%',
  },
  promoBannerImageStyle: {
    borderRadius: 22,
  },
  promoContentOverlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
    justifyContent: 'space-between',
  },
  promoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.secondaryColor,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  flashBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 3,
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  promoBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  promoGymTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  promoGymSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  claimOfferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  claimOfferText: {
    color: AppColors.primaryColor,
    fontSize: 12,
    fontWeight: 'bold',
  },

  /* Category Pills */
  categoryPillsScroll: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 4,
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 13,
    marginLeft: 6,
  },

  /* Spotlight Section */
  spotlightSection: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: AppColors.secondaryColor,
  },
  spotlightScroll: {
    paddingHorizontal: 16,
  },
  spotlightCard: {
    width: 250,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 14,
    overflow: 'hidden',
  },
  spotlightImageWrapper: {
    height: 120,
    width: '100%',
    position: 'relative',
  },
  spotlightImage: {
    width: '100%',
    height: '100%',
  },
  spotlightRatingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  spotlightRatingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  spotlightBookmarkBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightDetailsPadding: {
    padding: 12,
  },
  spotlightGymName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  spotlightLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  spotlightLocationText: {
    fontSize: 11,
    marginLeft: 2,
  },
  spotlightBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  spotlightPriceText: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spotlightPriceVal: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  spotlightPriceSub: {
    fontSize: 10,
  },
  spotlightBookSlotPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 56, 130, 0.08)',
  },
  spotlightBookSlotText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: AppColors.primaryColor,
  },

  /* Nearby Gyms Header */
  nearbyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 14,
  },
  nearbySectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  gymsCountBadge: {
    backgroundColor: 'rgba(0, 56, 130, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  gymsCountText: {
    color: AppColors.primaryColor,
    fontSize: 12,
    fontWeight: 'bold',
  },
  resetFiltersText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: 'bold',
  },

  /* Gym Card */
  gymCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  gymCardImageContainer: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  gymCardImage: {
    width: '100%',
    height: '100%',
  },
  gymCardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  cardPopularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.secondaryColor,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  cardPopularBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  cardBookmarkBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageBottomInfo: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardRatingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  cardReviewsCountText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginLeft: 2,
  },
  cardDistancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  cardDistanceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  gymCardDetailsContent: {
    padding: 16,
  },
  gymTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardGymNameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  cardPerSessionPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardPerSessionSub: {
    fontSize: 11,
    fontWeight: 'normal',
  },
  cardGymAddressText: {
    fontSize: 12.5,
    marginTop: 3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
  },
  gymCardBottomStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 0.8,
    borderTopColor: '#E2E8F0',
  },
  pricePrefix: {
    fontSize: 10,
  },
  cardPriceText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  cardPerSession: {
    fontSize: 11,
    fontWeight: 'normal',
  },
  viewGymBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewGymText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },

  /* 'GYMEZY for you' Section */
  gymezyForYouSection: {
    marginTop: 20,
    marginBottom: 10,
    marginHorizontal: 16,
  },
  forYouHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  forYouTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  exclusiveBadge: {
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  exclusiveBadgeText: {
    color: AppColors.secondaryColor,
    fontSize: 10,
    fontWeight: 'bold',
  },
  forYouGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  forYouCard: {
    flex: 1,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  forYouIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  forYouCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  forYouCardSub: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
  },
  forYouLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  forYouLinkText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },
  watermarkSection: {
    marginTop: 24,
    marginBottom: 10,
  },
  watermarkLogo: {
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 2,
  },
  watermarkTagline: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.5,
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    marginTop: 4,
  },

  /* Filter Modal */
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  filterModalContent: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '80%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterGroupTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  filterActionsRow: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  filterResetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterResetText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  filterApplyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: AppColors.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  /* Location Modal Styles */
  modalBackdropFlex: {
    flex: 1,
  },
  locationModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  locationModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  locationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationSmallIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: AppColors.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationModalTitleText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  locationModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsEnableActionBtn: {
    height: 48,
    borderRadius: 14,
    backgroundColor: AppColors.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  gpsBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gpsEnableBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  locationDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  locationDividerLine: {
    flex: 1,
    height: 1,
  },
  locationDividerText: {
    fontSize: 11,
    fontWeight: '700',
    marginHorizontal: 10,
    letterSpacing: 0.8,
  },
  locationSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  locationSearchInput: {
    flex: 1,
    fontSize: 13.5,
    marginLeft: 8,
    paddingVertical: 0,
  },
  locationSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  popularLocalitiesSection: {
    marginTop: 4,
    maxHeight: 240,
  },
  popularLocalitiesScroll: {
    maxHeight: 220,
  },
  popularLocalitiesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 8,
  },
  popularAreaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  popularAreaPillText: {
    fontSize: 12.5,
  },
  searchResultsSection: {
    marginTop: 4,
    maxHeight: 240,
  },
  locationSuggestionsList: {
    maxHeight: 220,
  },
  locationSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 1,
  },
  locationItemPinCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  locationItemTextCol: {
    flex: 1,
  },
  locationItemName: {
    fontSize: 13.5,
  },
  locationItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyLocationSearchBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLocationSearchText: {
    fontSize: 13,
    marginTop: 8,
  },

  gymsLoadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymsLoadingText: {
    marginTop: 12,
    fontSize: 13.5,
    fontWeight: '600',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  endOfListContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  endOfListDivider: {
    flex: 1,
    height: 1,
  },
  endOfListText: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Price Preference Styles */
  pricePreferenceContainer: {
    marginTop: 6,
    marginBottom: 4,
  },
  priceOptionCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceOptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  priceOptionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
});


