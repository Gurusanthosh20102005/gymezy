import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { MonthlyGridCalendar } from './CustomCalendar';
import { TrainerReviewsPopup } from './DetailsPopups';
import { generateAvailableSlots, generateTrainerAvailableSlots } from '../utils/gymTimingHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatDate = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]}`;
};

const monthName = (m) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[m] || '';
};

export const SESSION_CONFIGS = {
  'Gym Access': {
    id: 'gym_access',
    title: 'Gym Access',
    icon: 'fitness-center',
    category: 'gym',
    heroImage: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop',
  },
  'Group Classes': {
    id: 'group_classes',
    title: 'Group Classes',
    icon: 'groups',
    category: 'group',
    heroImage: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=800&auto=format&fit=crop',
  },
  'Yoga Classes': {
    id: 'yoga',
    title: 'Yoga Classes',
    icon: 'self-improvement',
    category: 'yoga',
    heroImage: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800&auto=format&fit=crop',
  },
  'Zumba Sessions': {
    id: 'zumba',
    title: 'Zumba Sessions',
    icon: 'music-note',
    category: 'zumba',
    heroImage: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop',
  },
  'HIIT': {
    id: 'hiit',
    title: 'HIIT (High Intensity)',
    icon: 'bolt',
    category: 'hiit',
    heroImage: 'https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?q=80&w=800&auto=format&fit=crop',
  },
  'CrossFit': {
    id: 'crossfit',
    title: 'CrossFit Training',
    icon: 'fitness-center',
    category: 'crossfit',
    heroImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=800&auto=format&fit=crop',
  },
  'Pilates': {
    id: 'pilates',
    title: 'Pilates Core',
    icon: 'spa',
    category: 'pilates',
    heroImage: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop',
  },
  'Kickboxing': {
    id: 'kickboxing',
    title: 'Kickboxing Cardio',
    icon: 'sports-mma',
    category: 'kickboxing',
    heroImage: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=800&auto=format&fit=crop',
  },
  'Dance Fitness': {
    id: 'dance_fitness',
    title: 'Dance Fitness',
    icon: 'music-note',
    category: 'dance',
    heroImage: 'https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?q=80&w=800&auto=format&fit=crop',
  },
};

/**
 * Builds dynamic facility inclusions based on the active gym's real configuration
 */
export const getDynamicInclusions = (gym, categoryTitle = 'Gym Access') => {
  const gymTitle = gym?.name || 'the facility';
  const list = [
    `Full access to ${categoryTitle.toLowerCase()} & workout floor at ${gymTitle}`,
  ];

  if (Array.isArray(gym?.facilities) && gym.facilities.length > 0) {
    const amenities = gym.facilities.slice(0, 3).join(', ');
    list.push(`Included amenities: ${amenities}`);
  } else if (Array.isArray(gym?.customFacilities) && gym.customFacilities.length > 0) {
    const activeCustom = gym.customFacilities
      .filter((f) => f.status !== 'Inactive')
      .map((f) => f.name)
      .slice(0, 3);
    if (activeCustom.length > 0) {
      list.push(`Included amenities: ${activeCustom.join(', ')}`);
    }
  } else {
    list.push('Locker room & shower facility access');
  }

  list.push('Floor guidance & equipment support from certified trainers');
  list.push('Flexible workout timing within gym operating hours');

  return list;
};

/**
 * Reusable SessionBookingFlow component:
 * Provides the identical, high-converting Gym Access booking experience
 * (Per Session, Weekly Plan, Custom Dates + Trainer Add-on)
 * across ALL session types.
 */
export const SessionBookingFlow = ({
  sessionConfig,
  gym,
  gymTrainers = [],
  isDark = false,
  subView = 'plan_select', // 'plan_select' | 'weekly_plan' | 'custom_dates'
  onSubViewChange,
  onContinueToCheckout,
  extraTopBanner,
}) => {
  const insets = useSafeAreaInsets();
  // Theme colors
  const primaryNavy = isDark ? '#93C5FD' : '#003882';
  const cardColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';

  // Dynamic Pricing strictly derived from Gym Document (SSOT)
  const isSingleSessionEnabled = gym?.singleSessionBookingEnabled !== false;
  const sessionBasePrice = Number(
    gym?.singleSessionPrice ??
    gym?.pricingPlans?.singleSession ??
    gym?.pricePerSession ??
    199
  );
  const weeklyPassPrice = Number(
    gym?.weeklyPassPrice ??
    gym?.pricingPlans?.weeklyPass ??
    Math.round(sessionBasePrice * 5)
  );

  // Dynamic Inclusions derived from Gym Amenities & Facilities
  const dynamicInclusions = useMemo(() => {
    return getDynamicInclusions(gym, sessionConfig?.title);
  }, [gym, sessionConfig?.title]);

  // Dynamic Subtitle
  const dynamicSubtitle = sessionConfig?.title === 'Gym Access'
    ? `Full facility access • ${gym?.name || 'GYMEZY Partner'}`
    : `Specialized ${sessionConfig?.title || 'Class'} • ${gym?.name || 'GYMEZY Partner'}`;

  // Booking mode state
  const [bookingType, setBookingType] = useState('Per Session'); // 'Per Session' | 'Weekly Plan' | 'Custom Dates'
  const [selectedSingleDate, setSelectedSingleDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [selectedStartDate, setSelectedStartDate] = useState(new Date());
  const [customSelectedDates, setCustomSelectedDates] = useState([
    new Date(),
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
  ]);

  // Personal Trainer Selection
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [modalTrainer, setModalTrainer] = useState(null);

  // Available trainers offering session pass (Membership listing architecture)
  const formattedTrainersList = useMemo(() => {
    const list = (gymTrainers || [])
      .filter((tr) => Number(tr.trainerPricing?.singleSession || 0) > 0)
      .map((t) => ({
        id: t.id || t._id || t.employeeId || t.name,
        _id: t._id || t.id,
        employeeId: t.employeeId || '',
        name: t.name || 'Personal Trainer',
        rawName: t.name || 'Trainer',
        exp: t.experienceYears ? `${t.experienceYears} Yrs Exp` : (t.experience || t.exp || 'Certified'),
        specialty: t.specialization || t.specialty || 'Personal Trainer',
        rating: Number(t.rating) || 4.9,
        reviews: Number(t.reviewsCount || t.reviews?.length || 0),
        image: t.imageUrl || t.avatar || t.image || null,
        fee: Number(t.trainerPricing?.singleSession || 0),
        raw: t,
        isNone: false,
      }));

    list.push({
      id: 'no-trainer',
      _id: null,
      employeeId: null,
      name: 'No Personal Trainer',
      rawName: 'No Personal Trainer',
      exp: '',
      specialty: 'I will train on my own',
      rating: 0,
      reviews: 0,
      image: null,
      fee: 0,
      raw: null,
      isNone: true,
    });

    return list;
  }, [gymTrainers]);

  const availableTrainers = useMemo(() => {
    return formattedTrainersList.filter((t) => !t.isNone);
  }, [formattedTrainersList]);

  // Dynamic slot calculation for Per Session view
  const targetSingleDateObj = useMemo(() => {
    return selectedSingleDate ? new Date(selectedSingleDate) : new Date();
  }, [selectedSingleDate]);

  const singleSlotsData = useMemo(() => {
    if (selectedTrainer) {
      return generateTrainerAvailableSlots(gym?.openingHours, targetSingleDateObj, selectedTrainer);
    }
    return generateAvailableSlots(gym?.openingHours, targetSingleDateObj);
  }, [gym?.openingHours, targetSingleDateObj, selectedTrainer]);

  const dynamicMorningSlots = singleSlotsData.morningSlots || [];
  const dynamicEveningSlots = singleSlotsData.eveningSlots || [];
  const isGymOpenOnSelectedDate = singleSlotsData.isOpen;

  // Auto-select first available slot when slots change
  useEffect(() => {
    if (!isGymOpenOnSelectedDate) {
      setSelectedTimeSlot('');
      return;
    }
    const allValid = [...dynamicMorningSlots, ...dynamicEveningSlots];
    if (allValid.length > 0 && !allValid.includes(selectedTimeSlot)) {
      setSelectedTimeSlot(allValid[0]);
    }
  }, [isGymOpenOnSelectedDate, dynamicMorningSlots, dynamicEveningSlots]);

  const trainerDailyFee = Number(selectedTrainer?.trainerPricing?.singleSession || 0);
  const singleSessionTotalPerDay = sessionBasePrice + trainerDailyFee;
  const weeklyTotal = weeklyPassPrice + (selectedTrainer ? trainerDailyFee * 7 : 0);
  const customTotal = (sessionBasePrice + trainerDailyFee) * customSelectedDates.length;

  const handleCheckoutPress = () => {
    let title = '';
    let datesSummary = '';
    let timeSlot = null;
    let sessions = 1;
    let subtotal = 0;

    if (bookingType === 'Per Session') {
      title = selectedTrainer
        ? `${sessionConfig.title} + Coach ${selectedTrainer.name || ''}`.trim()
        : `${sessionConfig.title} (Single Session)`;
      datesSummary = `${formatDate(selectedSingleDate)}${selectedTimeSlot ? ` • ${selectedTimeSlot}` : ''}`;
      timeSlot = selectedTimeSlot || 'General Access';
      sessions = 1;
      subtotal = singleSessionTotalPerDay;
    } else if (bookingType === 'Weekly Plan') {
      title = selectedTrainer
        ? `${sessionConfig.title} + Coach ${selectedTrainer.name || ''} (Weekly)`.trim()
        : `${sessionConfig.title} (Weekly Plan)`;
      const endD = new Date(selectedStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      datesSummary = `${formatDate(selectedStartDate)} - ${formatDate(endD)} (7 Days)`;
      timeSlot = 'Full Day Access';
      sessions = 7;
      subtotal = weeklyTotal;
    } else if (bookingType === 'Custom Dates') {
      title = selectedTrainer
        ? `${sessionConfig.title} + Coach ${selectedTrainer.name || ''} (Custom Dates)`.trim()
        : `${sessionConfig.title} (Custom Dates)`;
      sessions = customSelectedDates.length;
      const sortedDates = [...customSelectedDates].sort((a, b) => a.getTime() - b.getTime());
      datesSummary = sortedDates.map((d) => `${d.getDate()} ${monthName(d.getMonth())}`).join(', ');
      timeSlot = 'Full Day Access';
      subtotal = customTotal;
    }

    onContinueToCheckout?.({
      bookingType,
      title,
      datesSummary,
      timeSlot,
      sessions,
      subtotal,
      startDate: bookingType === 'Weekly Plan'
        ? selectedStartDate
        : bookingType === 'Custom Dates'
        ? [...customSelectedDates].sort((a, b) => a.getTime() - b.getTime())[0] || new Date()
        : selectedSingleDate,
      endDate: bookingType === 'Weekly Plan'
        ? new Date(selectedStartDate.getTime() + 6 * 24 * 60 * 60 * 1000)
        : bookingType === 'Custom Dates'
        ? [...customSelectedDates].sort((a, b) => a.getTime() - b.getTime())[customSelectedDates.length - 1] || null
        : selectedSingleDate,
      customDates: bookingType === 'Custom Dates' ? customSelectedDates.map((d) => d.toISOString()) : null,
      category: sessionConfig.category || 'general',
      trainerId: selectedTrainer?._id || selectedTrainer?.employeeId || null,
      selectedTrainer,
    });
  };

  const renderTrainerSelector = (mode = 'session') => {
    if (availableTrainers.length === 0) return null;
    const customCount = customSelectedDates.length || 1;

    return (
      <View style={{ marginTop: 20 }}>
        <Text style={[styles.sectionSubtitle, { color: textColor }]}>Top Trainers</Text>

        {formattedTrainersList.map((t) => {
          const isNone = !!t.isNone;
          const isSel = isNone
            ? !selectedTrainer
            : (selectedTrainer?._id || selectedTrainer?.id || selectedTrainer?.employeeId) ===
              (t._id || t.id || t.employeeId);

          let priceLabel = '';
          if (!isNone) {
            if (mode === 'weekly') {
              priceLabel = `₹${Math.round(t.fee * 7)} / Weekly`;
            } else if (mode === 'custom') {
              priceLabel = `₹${Math.round(t.fee * customCount)} / ${customCount} Sessions`;
            } else {
              priceLabel = `₹${Math.round(t.fee)} / Session`;
            }
          }

          return (
            <TouchableOpacity
              key={t.id}
              activeOpacity={0.85}
              onPress={() => {
                if (isNone) {
                  setSelectedTrainer(null);
                } else {
                  setSelectedTrainer(t.raw || t);
                }
              }}
              style={[
                styles.trainerSelectCard,
                {
                  backgroundColor: isSel ? (isDark ? '#1E293B' : '#F0F4FF') : cardColor,
                  borderColor: isSel ? (isDark ? '#60A5FA' : '#003882') : borderColor,
                  borderWidth: isSel ? 1.8 : 1,
                },
              ]}
            >
              {t.image ? (
                <Image source={{ uri: t.image }} style={styles.trainerAvatarImg} />
              ) : (
                <View
                  style={[
                    styles.trainerAvatarPlaceholder,
                    {
                      backgroundColor: isNone
                        ? (isDark ? 'rgba(0, 191, 98, 0.12)' : '#E8F5E9')
                        : (isDark ? '#262626' : '#F1F5F9'),
                    },
                  ]}
                >
                  <MaterialIcons
                    name={isNone ? 'person-off' : 'person'}
                    size={24}
                    color={isNone ? '#00BF62' : (isDark ? '#93C5FD' : '#003882')}
                  />
                </View>
              )}

              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={[styles.trainerCardName, { color: textColor }]}>{t.name}</Text>
                  {!isNone && (
                    <TouchableOpacity
                      onPress={() => {
                        setModalTrainer(t.raw || t);
                        setShowTrainerModal(true);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.aboutTrainerLink, { color: isDark ? '#93C5FD' : '#003882' }]}>
                        Rates & Bio
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.trainerSpecialtyText, { color: subtitleColor }]}>
                  {isNone ? t.specialty : `${t.exp} • ${t.specialty}`}
                </Text>

                {!isNone && (
                  <View style={styles.trainerStatsRow}>
                    <MaterialIcons name="star" size={14} color="#F59E0B" />
                    <Text style={[styles.trainerRatingScore, { color: textColor }]}>
                      {t.rating} ({t.reviews})
                    </Text>
                    <Text style={styles.trainerPriceText}>{priceLabel}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* SUBVIEW 1: PLAN SELECTOR (Per Session / Weekly Plan / Custom Dates) */}
      {subView === 'plan_select' && (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 90 + (insets.bottom > 0 ? insets.bottom + 8 : 20) },
          ]}>
            {/* Optional extra banner (e.g. Group Class batches switch) */}
            {extraTopBanner}

            {/* Hero Banner */}
            <ImageBackground
              source={{ uri: sessionConfig.heroImage || gym?.imageUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=800&auto=format&fit=crop' }}
              style={styles.heroBanner}
              imageStyle={{ borderRadius: 20 }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.30)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.heroBannerGradient}
              >
                <Text style={styles.heroBannerTitle}>{sessionConfig.title}</Text>
                <Text style={styles.heroBannerSubtitle}>{dynamicSubtitle}</Text>
              </LinearGradient>
            </ImageBackground>

            <Text style={[styles.chooseTypeHeading, { color: textColor }]}>
              Choose Booking Type
            </Text>

            {/* Option 1: Per Session */}
            <TouchableOpacity
              activeOpacity={isSingleSessionEnabled ? 0.85 : 1}
              onPress={() => {
                if (isSingleSessionEnabled) {
                  setBookingType('Per Session');
                }
              }}
              style={[
                styles.typeOptionCard,
                {
                  backgroundColor: !isSingleSessionEnabled
                    ? (isDark ? '#1C1C1E' : '#F8FAFC')
                    : bookingType === 'Per Session'
                    ? (isDark ? '#262626' : '#F1F5F9')
                    : cardColor,
                  borderColor: !isSingleSessionEnabled
                    ? (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0')
                    : bookingType === 'Per Session'
                    ? (isDark ? '#60A5FA' : '#003882')
                    : borderColor,
                  borderWidth: bookingType === 'Per Session' && isSingleSessionEnabled ? 1.5 : 1,
                  opacity: isSingleSessionEnabled ? 1 : 0.65,
                },
              ]}
            >
              <View style={[styles.typeIconBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(0,56,130,0.1)' }]}>
                <MaterialIcons name="calendar-today" size={22} color={isDark ? '#93C5FD' : '#003882'} />
              </View>
              <View style={styles.typeContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.typeTitle, { color: textColor }]}>Per Session</Text>
                  {!isSingleSessionEnabled && (
                    <View style={styles.disabledBadge}>
                      <Text style={styles.disabledBadgeText}>Disabled by Gym</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.typeSubtitle, { color: subtitleColor }]}>
                  {isSingleSessionEnabled ? 'Book for a single visit' : 'Single session bookings disabled'}
                </Text>
                <Text style={[styles.typePrice, !isSingleSessionEnabled && { color: subtitleColor }]}>
                  ₹{Math.round(sessionBasePrice)} / Session
                </Text>
              </View>
              {isSingleSessionEnabled ? (
                <MaterialIcons
                  name={bookingType === 'Per Session' ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={bookingType === 'Per Session' ? (isDark ? '#60A5FA' : '#003882') : subtitleColor}
                />
              ) : (
                <MaterialIcons name="block" size={18} color={subtitleColor} />
              )}
            </TouchableOpacity>

            {/* Option 2: Weekly Plan */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setBookingType('Weekly Plan');
              }}
              style={[
                styles.typeOptionCard,
                {
                  backgroundColor: bookingType === 'Weekly Plan'
                    ? (isDark ? '#262626' : '#F1F5F9')
                    : cardColor,
                  borderColor: bookingType === 'Weekly Plan' ? (isDark ? '#60A5FA' : '#003882') : borderColor,
                  borderWidth: bookingType === 'Weekly Plan' ? 1.5 : 1,
                },
              ]}
            >
              <View style={[styles.typeIconBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(0,56,130,0.1)' }]}>
                <MaterialIcons name="date-range" size={22} color={isDark ? '#93C5FD' : '#003882'} />
              </View>
              <View style={styles.typeContent}>
                <Text style={[styles.typeTitle, { color: textColor }]}>Weekly Plan</Text>
                <Text style={[styles.typeSubtitle, { color: subtitleColor }]}>
                  Unlimited access for 7 days
                </Text>
                <Text style={styles.typePrice}>₹{Math.round(weeklyPassPrice)} / Week</Text>
              </View>
              <MaterialIcons
                name={bookingType === 'Weekly Plan' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20}
                color={bookingType === 'Weekly Plan' ? (isDark ? '#60A5FA' : '#003882') : subtitleColor}
              />
            </TouchableOpacity>

            {/* Option 3: Custom Dates */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setBookingType('Custom Dates');
              }}
              style={[
                styles.typeOptionCard,
                {
                  backgroundColor: bookingType === 'Custom Dates'
                    ? (isDark ? '#262626' : '#F1F5F9')
                    : cardColor,
                  borderColor: bookingType === 'Custom Dates' ? (isDark ? '#60A5FA' : '#003882') : borderColor,
                  borderWidth: bookingType === 'Custom Dates' ? 1.5 : 1,
                },
              ]}
            >
              <View style={[styles.typeIconBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(0,56,130,0.1)' }]}>
                <MaterialIcons name="event-note" size={22} color={isDark ? '#93C5FD' : '#003882'} />
              </View>
              <View style={styles.typeContent}>
                <Text style={[styles.typeTitle, { color: textColor }]}>Custom Dates</Text>
                <Text style={[styles.typeSubtitle, { color: subtitleColor }]}>Select multiple custom workout days</Text>
                <Text style={styles.typePrice}>Custom Pricing</Text>
              </View>
              <MaterialIcons
                name={bookingType === 'Custom Dates' ? 'radio-button-checked' : 'radio-button-unchecked'}
                size={20}
                color={bookingType === 'Custom Dates' ? (isDark ? '#60A5FA' : '#003882') : subtitleColor}
              />
            </TouchableOpacity>
          </ScrollView>

          {/* Bottom Bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderTopColor: borderColor,
                paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 14,
              },
            ]}
          >
            <View>
              <Text style={[styles.bottomPriceLabel, { color: subtitleColor }]}>Price</Text>
              <Text style={[styles.bottomPriceValue, { color: textColor }]}>
                {bookingType === 'Per Session'
                  ? `₹${Math.round(singleSessionTotalPerDay)}`
                  : bookingType === 'Weekly Plan'
                  ? `₹${Math.round(weeklyTotal)}`
                  : 'Custom'}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (availableTrainers.length > 0) {
                  onSubViewChange?.('trainer_select');
                } else {
                  if (bookingType === 'Per Session') {
                    onSubViewChange?.('single_session');
                  } else if (bookingType === 'Weekly Plan') {
                    onSubViewChange?.('weekly_plan');
                  } else {
                    onSubViewChange?.('custom_dates');
                  }
                }
              }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>
                {availableTrainers.length > 0 ? 'Continue to Choose Coach' : 'Continue to Select Date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SUBVIEW 1B: DEDICATED TRAINER SELECTION PAGE (BEFORE DATE SELECTION) */}
      {subView === 'trainer_select' && (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 90 + (insets.bottom > 0 ? insets.bottom + 8 : 20) },
          ]}>
            {/* Plan Info Banner */}
            <View style={[styles.planBanner, { backgroundColor: cardColor, borderColor }]}>
              <View style={[styles.planIconBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(0,56,130,0.1)' }]}>
                <MaterialIcons name={sessionConfig.icon || 'fitness-center'} size={24} color={isDark ? '#93C5FD' : '#003882'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.planBannerTitle, { color: textColor }]}>
                  {bookingType} • {sessionConfig.title}
                </Text>
                <Text style={[styles.planBannerSub, { color: subtitleColor }]}>
                  {gym?.name || 'GYMEZY Partner'}
                </Text>
              </View>
              <Text style={styles.planPriceText}>
                ₹{Math.round(bookingType === 'Weekly Plan' ? weeklyPassPrice : sessionBasePrice)}
              </Text>
            </View>

            {/* Top Trainers Section */}
            {renderTrainerSelector(bookingType === 'Weekly Plan' ? 'weekly' : bookingType === 'Custom Dates' ? 'custom' : 'session')}
          </ScrollView>

          {/* Bottom Bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderTopColor: borderColor,
                paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 14,
              },
            ]}
          >
            <View>
              <Text style={[styles.bottomPriceLabel, { color: subtitleColor }]}>Price</Text>
              <Text style={[styles.bottomPriceValue, { color: textColor }]}>
                {bookingType === 'Per Session'
                  ? `₹${Math.round(singleSessionTotalPerDay)}`
                  : bookingType === 'Weekly Plan'
                  ? `₹${Math.round(weeklyTotal)}`
                  : `₹${Math.round(customTotal)}`}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                if (bookingType === 'Per Session') {
                  onSubViewChange?.('single_session');
                } else if (bookingType === 'Weekly Plan') {
                  onSubViewChange?.('weekly_plan');
                } else {
                  onSubViewChange?.('custom_dates');
                }
              }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue to Select Date</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SUBVIEW 1B: SINGLE SESSION (DATE, TIME SLOTS & COACH SELECTION) */}
      {subView === 'single_session' && (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 90 + (insets.bottom > 0 ? insets.bottom + 8 : 20) },
          ]}>
            {/* Plan Banner */}
            <View style={[styles.planBanner, { backgroundColor: cardColor, borderColor }]}>
              <View style={[styles.planIconBox, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(0,56,130,0.1)' }]}>
                <MaterialIcons name={sessionConfig.icon || 'fitness-center'} size={24} color={isDark ? '#93C5FD' : '#003882'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.planBannerTitle, { color: textColor }]}>
                  {sessionConfig.title} (Single Session)
                </Text>
                <Text style={[styles.planBannerSub, { color: subtitleColor }]}>
                  1-day session pass at {gym?.name}
                  {selectedTrainer ? ` • Coach ${selectedTrainer.name}` : ''}
                </Text>
              </View>
              <Text style={styles.planPriceText}>₹{Math.round(singleSessionTotalPerDay)}</Text>
            </View>

            {/* Inclusions */}
            <Text style={[styles.planIncludesTitle, { color: textColor }]}>Session Inclusions</Text>
            {dynamicInclusions.map((inc, i) => (
              <View key={i} style={styles.inclusionRow}>
                <MaterialIcons name="check-circle" size={16} color="#00BF62" style={{ marginRight: 8 }} />
                <Text style={[styles.inclusionText, { color: textColor }]}>{inc}</Text>
              </View>
            ))}

            {/* Date Selection Calendar */}
            <Text style={[styles.sectionHeading, { color: textColor, marginTop: 18 }]}>
              Select Date
            </Text>
            <View style={{ marginTop: 8 }}>
              <MonthlyGridCalendar
                selectedDate={selectedSingleDate}
                minDate={new Date()}
                maxMonthsAhead={3}
                wrapInCard={true}
                showMonthHeader={true}
                onDateSelected={setSelectedSingleDate}
              />
            </View>

            {/* Time Slot Selection */}
            <Text style={[styles.sectionHeading, { color: textColor, marginTop: 20 }]}>
              Select Time Slot
            </Text>

            {!isGymOpenOnSelectedDate ? (
              <View style={styles.closedWarningBox}>
                <MaterialIcons name="event-busy" size={22} color="#EF4444" style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.closedWarningTitle}>
                    {selectedTrainer ? 'Trainer Unavailable on this Day' : 'Gym Closed on this Day'}
                  </Text>
                  <Text style={[styles.closedWarningSub, { color: textColor }]}>
                    {singleSlotsData.reason || `${gym?.name || 'This gym'} is closed on ${targetSingleDateObj.toLocaleDateString('en-US', { weekday: 'long' })}. Please select another date on the calendar.`}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: 10 }}>
                {dynamicMorningSlots.length > 0 && (
                  <View style={{ marginBottom: 14 }}>
                    <Text style={[styles.slotCategoryLabel, { color: subtitleColor }]}>Morning Slots</Text>
                    <View style={styles.slotsRow}>
                      {dynamicMorningSlots.map((slot) => {
                        const isSel = selectedTimeSlot === slot;
                        return (
                          <TouchableOpacity
                            key={slot}
                            activeOpacity={0.8}
                            onPress={() => setSelectedTimeSlot(slot)}
                            style={[
                              styles.slotPill,
                              {
                                backgroundColor: isSel ? (isDark ? '#2563EB' : '#003882') : isDark ? '#262626' : '#F1F5F9',
                                borderColor: isSel ? 'transparent' : borderColor,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.slotPillText,
                                { color: isSel ? '#FFFFFF' : textColor, fontWeight: isSel ? '700' : '500' },
                              ]}
                            >
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {dynamicEveningSlots.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[styles.slotCategoryLabel, { color: subtitleColor }]}>Evening Slots</Text>
                    <View style={styles.slotsRow}>
                      {dynamicEveningSlots.map((slot) => {
                        const isSel = selectedTimeSlot === slot;
                        return (
                          <TouchableOpacity
                            key={slot}
                            activeOpacity={0.8}
                            onPress={() => setSelectedTimeSlot(slot)}
                            style={[
                              styles.slotPill,
                              {
                                backgroundColor: isSel ? (isDark ? '#2563EB' : '#003882') : isDark ? '#262626' : '#F1F5F9',
                                borderColor: isSel ? 'transparent' : borderColor,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.slotPillText,
                                { color: isSel ? '#FFFFFF' : textColor, fontWeight: isSel ? '700' : '500' },
                              ]}
                            >
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Bottom Bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderTopColor: borderColor,
                paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 14,
              },
            ]}
          >
            <View>
              <Text style={[styles.bottomPriceLabel, { color: subtitleColor }]}>Price</Text>
              <Text style={[styles.bottomPriceValue, { color: textColor }]}>
                ₹{Math.round(singleSessionTotalPerDay)}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={!isGymOpenOnSelectedDate || !selectedTimeSlot}
              onPress={handleCheckoutPress}
              style={[
                styles.continueBtn,
                (!isGymOpenOnSelectedDate || !selectedTimeSlot) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles.continueBtnText}>
                {!isGymOpenOnSelectedDate ? 'Facility Closed' : 'Continue to Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SUBVIEW 2: WEEKLY PLAN CALENDAR */}
      {subView === 'weekly_plan' && (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 90 + (insets.bottom > 0 ? insets.bottom + 8 : 20) },
          ]}>
            {/* Plan Banner */}
            <View style={[styles.planBanner, { backgroundColor: cardColor, borderColor }]}>
              <View style={[styles.planIconBox, { backgroundColor: 'rgba(0,191,98,0.12)' }]}>
                <MaterialIcons name="date-range" size={24} color="#00BF62" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.planBannerTitle, { color: textColor }]}>
                  Weekly Unlimited {sessionConfig.title}
                </Text>
                <Text style={[styles.planBannerSub, { color: subtitleColor }]}>
                  7 days access at {gym?.name || 'the gym'}
                  {selectedTrainer ? ` • Coach ${selectedTrainer.name}` : ''}
                </Text>
              </View>
              <Text style={styles.planPriceText}>₹{Math.round(weeklyTotal)}</Text>
            </View>

            <Text style={[styles.planIncludesTitle, { color: textColor }]}>Plan Includes</Text>
            {dynamicInclusions.map((inc, i) => (
              <View key={i} style={styles.inclusionRow}>
                <MaterialIcons name="check-circle" size={16} color="#00BF62" style={{ marginRight: 8 }} />
                <Text style={[styles.inclusionText, { color: textColor }]}>{inc}</Text>
              </View>
            ))}

            <View style={{ marginTop: 20 }}>
              <MonthlyGridCalendar
                selectedDate={selectedStartDate}
                minDate={new Date()}
                maxMonthsAhead={3}
                wrapInCard={true}
                showMonthHeader={true}
                onDateSelected={setSelectedStartDate}
              />
            </View>

            {/* Validity notice banner */}
            <View style={styles.validityNoticeBanner}>
              <MaterialIcons name="info-outline" size={16} color="#00BF62" style={{ marginRight: 8 }} />
              <Text style={styles.validityNoticeText}>
                Valid from {formatDate(selectedStartDate)} to{' '}
                {formatDate(new Date(selectedStartDate.getTime() + 6 * 24 * 60 * 60 * 1000))}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderTopColor: borderColor,
                paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 14,
              },
            ]}
          >
            <View>
              <Text style={[styles.bottomPriceLabel, { color: subtitleColor }]}>Price</Text>
              <Text style={[styles.bottomPriceValue, { color: textColor }]}>
                ₹{Math.round(weeklyTotal)}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleCheckoutPress}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue to Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SUBVIEW 3: CUSTOM DATES CALENDAR */}
      {subView === 'custom_dates' && (
        <View style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 90 + (insets.bottom > 0 ? insets.bottom + 8 : 20) },
          ]}>
            {/* Top Header Card */}
            <View style={[styles.planBanner, { backgroundColor: cardColor, borderColor }]}>
              <View style={[styles.planIconBox, { backgroundColor: 'rgba(0,56,130,0.1)' }]}>
                <MaterialIcons name="event-available" size={24} color={isDark ? '#93C5FD' : '#003882'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.planBannerTitle, { color: textColor }]}>
                  Custom Dates Booking
                </Text>
                <Text style={[styles.planBannerSub, { color: subtitleColor }]}>
                  Pick any dates for {sessionConfig.title}
                  {selectedTrainer ? ` • Coach ${selectedTrainer.name}` : ''}
                </Text>
              </View>
              <Text style={styles.planPriceText}>₹{Math.round(customTotal)}</Text>
            </View>

            <View style={styles.customDatesHeaderRow}>
              <Text style={[styles.planIncludesTitle, { color: textColor }]}>
                Select Dates ({customSelectedDates.length})
              </Text>
              {customSelectedDates.length > 0 && (
                <TouchableOpacity onPress={() => setCustomSelectedDates([])}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Monthly grid calendar */}
            <MonthlyGridCalendar
              multiSelectedDates={customSelectedDates}
              maxMonthsAhead={3}
              onDateToggled={(date) => {
                const isSel = customSelectedDates.some(
                  (d) => d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear()
                );
                if (isSel) {
                  setCustomSelectedDates(
                    customSelectedDates.filter(
                      (d) => !(d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear())
                    )
                  );
                } else {
                  setCustomSelectedDates([...customSelectedDates, date]);
                }
              }}
            />

            {/* Selected Count Pill */}
            <View style={styles.selectedCountPill}>
              <Text style={styles.selectedCountText}>
                {customSelectedDates.length} Dates Selected
              </Text>
              <Text style={[styles.selectedCalcText, { color: textColor }]}>
                ₹{Math.round(singleSessionTotalPerDay)} × {customSelectedDates.length} Sessions
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Bar */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: isDark ? 'rgba(18, 18, 18, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderTopColor: borderColor,
                paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 14,
              },
            ]}
          >
            <View>
              <Text style={[styles.bottomPriceLabel, { color: subtitleColor }]}>Price</Text>
              <Text style={[styles.bottomPriceValue, { color: textColor }]}>
                ₹{Math.round(customTotal)}
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={customSelectedDates.length === 0}
              onPress={handleCheckoutPress}
              style={[styles.continueBtn, { opacity: customSelectedDates.length === 0 ? 0.5 : 1 }]}
            >
              <Text style={styles.continueBtnText}>Continue to Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Trainer Reviews Popup */}
      <TrainerReviewsPopup
        visible={showTrainerModal}
        onClose={() => setShowTrainerModal(false)}
        trainer={modalTrainer}
        reviews={[]}
        onBack={() => setShowTrainerModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  heroBanner: {
    width: '100%',
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroBannerGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  heroBannerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroBannerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 3,
  },
  chooseTypeHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  typeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeContent: {
    flex: 1,
    marginLeft: 14,
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  disabledBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  disabledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#EF4444',
  },
  typeSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  typePrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00BF62',
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  trainerSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
  },
  trainerAvatarImg: {
    width: 50,
    height: 50,
    borderRadius: 14,
  },
  trainerAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerCardName: {
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  aboutTrainerLink: {
    fontSize: 11.5,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  trainerSpecialtyText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  trainerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  trainerRatingScore: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  trainerPriceText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#00BF62',
    marginLeft: 'auto',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  bottomPriceLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bottomPriceValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 1,
  },
  continueBtn: {
    backgroundColor: '#003882',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  planIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  planPriceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00BF62',
  },
  planIncludesTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  inclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inclusionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  validityNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,191,98,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  validityNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00BF62',
  },
  customDatesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  selectedCountPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,56,130,0.06)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#003882',
  },
  selectedCalcText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  closedWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  closedWarningTitle: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  closedWarningSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  slotCategoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
  slotPillText: {
    fontSize: 13,
  },
});

