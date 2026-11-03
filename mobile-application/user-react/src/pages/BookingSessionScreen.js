import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useBookingRepository } from '../data/BookingContext';
import { MonthlyGridCalendar } from '../widgets/CustomCalendar';
import { TrainerReviewsPopup } from '../widgets/DetailsPopups';
import { SessionBookingFlow, SESSION_CONFIGS } from '../widgets/SessionBookingFlow';
import apiService from '../services/apiService';
import { generateAvailableSlots, generateTrainerAvailableSlots } from '../utils/gymTimingHelper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALL_WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatToDDMMYYYY = (val) => {
  if (!val) return '';
  const dt = new Date(val);
  if (Number.isNaN(dt.getTime())) return String(val);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}-${month}-${year}`;
};

const getCategoryBadgeStyle = (category, isDark) => {
  const cat = (category || '').toLowerCase();
  switch (cat) {
    case 'yoga':
      return {
        bg: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)',
        text: isDark ? '#C4B5FD' : '#7C3AED',
        icon: 'self-improvement',
      };
    case 'zumba':
      return {
        bg: isDark ? 'rgba(244,114,182,0.2)' : 'rgba(219,39,119,0.12)',
        text: isDark ? '#F472B6' : '#DB2777',
        icon: 'music-note',
      };
    case 'crossfit':
      return {
        bg: isDark ? 'rgba(239,68,68,0.2)' : 'rgba(220,38,38,0.12)',
        text: isDark ? '#FCA5A5' : '#DC2626',
        icon: 'fitness-center',
      };
    case 'hiit':
      return {
        bg: isDark ? 'rgba(245,158,11,0.2)' : 'rgba(217,119,6,0.12)',
        text: isDark ? '#FCD34D' : '#D97706',
        icon: 'bolt',
      };
    case 'pilates':
      return {
        bg: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(5,150,105,0.12)',
        text: isDark ? '#6EE7B7' : '#059669',
        icon: 'spa',
      };
    case 'boxing':
      return {
        bg: isDark ? 'rgba(244,63,94,0.2)' : 'rgba(225,29,72,0.12)',
        text: isDark ? '#FDA4AF' : '#E11D48',
        icon: 'sports-mma',
      };
    default:
      return {
        bg: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(79,70,229,0.12)',
        text: isDark ? '#A5B4FC' : '#4F46E5',
        icon: 'groups',
      };
  }
};

const OTHER_CLASSES = [
  {
    name: 'HIIT',
    title: 'HIIT (High Intensity)',
    desc: 'Intense interval cardio & calorie burn',
    icon: 'bolt',
  },
  {
    name: 'CrossFit',
    title: 'CrossFit Training',
    desc: 'Functional strength & conditioning',
    icon: 'fitness-center',
  },
  {
    name: 'Pilates',
    title: 'Pilates Core',
    desc: 'Core strength, posture & flexibility',
    icon: 'self-improvement',
  },
  {
    name: 'Dance Fitness',
    title: 'Dance Fitness',
    desc: 'Fun energetic dance workout',
    icon: 'music-note',
  },
  {
    name: 'Kickboxing',
    title: 'Kickboxing Cardio',
    desc: 'Strength, agility & martial arts cardio',
    icon: 'sports-mma',
  },
];

export const BookingSessionScreen = ({ route, navigation }) => {
  const { gym: initialGym, initialCategory } = route.params;
  const { isDark, colors } = useTheme();
  const { bookings, refreshBookings } = useBookingRepository();

  const [activeGym, setActiveGym] = useState(initialGym || {});
  const gym = activeGym;

  useEffect(() => {
    if (initialGym && typeof initialGym === 'object') {
      setActiveGym((prev) => ({ ...prev, ...initialGym }));
    }
  }, [initialGym]);

  useEffect(() => {
    refreshBookings?.();
  }, [refreshBookings]);

  // Fetch full and latest gym details (to get updated enabledSessionCategories)
  useEffect(() => {
    const gymLookupId = initialGym?._id || initialGym?.id || initialGym?.partnerId;
    if (!gymLookupId) return;

    let isMounted = true;
    apiService
      .getGymDetails(gymLookupId)
      .then((freshGym) => {
        if (isMounted && freshGym && typeof freshGym === 'object') {
          setActiveGym((prev) => ({ ...prev, ...freshGym }));
        }
      })
      .catch((err) => {
        console.warn('Could not refresh gym details for booking:', err?.message);
      });

    return () => {
      isMounted = false;
    };
  }, [initialGym?._id, initialGym?.id, initialGym?.partnerId]);

  const getSectionBooking = (sec) => {
    if (!sec || !bookings || bookings.length === 0) return null;
    const secId = (sec._id || sec.id)?.toString();
    return bookings.find((b) => {
      const bSecId =
        (b.sectionId?._id || b.sectionId || b.rawBackendBooking?.sectionId)?._id?.toString?.() ||
        (b.sectionId?._id || b.sectionId || b.rawBackendBooking?.sectionId)?.toString?.() ||
        '';
      const matchesSec = Boolean(bSecId && secId && bSecId === secId);
      const isActiveOrUpcoming =
        b.status === 'Active' || b.status === 'Upcoming' || b.status === 'Confirmed';
      return matchesSec && isActiveOrUpcoming;
    });
  };

  const gymId = gym?._id || gym?.id;

  // Resolve initial session key from route params
  const resolveInitialSessionKey = (cat) => {
    if (!cat) return null;
    if (cat === 'Gym') return 'Gym Access';
    if (cat === 'Group Classes') return 'Group Classes';
    if (cat === 'Yoga') return 'Yoga Classes';
    if (cat === 'Zumba') return 'Zumba Sessions';
    if (SESSION_CONFIGS[cat]) return cat;
    return null;
  };

  const initialSessionKey = resolveInitialSessionKey(initialCategory);

  // Navigation views: 'categories', 'session_booking', 'other_classes', 'group_classes', 'group_class_detail'
  const [currentView, setCurrentView] = useState(
    initialSessionKey
      ? 'session_booking'
      : initialCategory === 'Other Classes'
      ? 'other_classes'
      : 'categories'
  );
  const [activeSessionKey, setActiveSessionKey] = useState(initialSessionKey || 'Gym Access');
  const [sessionSubView, setSessionSubView] = useState('plan_select'); // 'plan_select' | 'weekly_plan' | 'custom_dates'
  const [selectedCategory, setSelectedCategory] = useState(initialCategory || null);

  // Group Classes State (Owner-created sections/batches)
  const [sections, setSections] = useState([]);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [sectionsError, setSectionsError] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedGroupCategory, setSelectedGroupCategory] = useState('all');
  const [showTrainerModal, setShowTrainerModal] = useState(false);
  const [selectedTrainerData, setSelectedTrainerData] = useState(null);
  const [trainerReviewsList, setTrainerReviewsList] = useState([]);

  // Gym Booking State
  const isSingleSessionEnabled = gym?.singleSessionBookingEnabled !== false;
  const sessionBasePrice = Number(gym?.singleSessionPrice ?? gym?.pricePerSession ?? 199);

  // Enabled Categories configured by Gym Owner / Super Admin
  const enabledCategories = useMemo(() => {
    if (Array.isArray(gym?.enabledSessionCategories)) {
      return new Set(gym.enabledSessionCategories);
    }
    // Default: all categories enabled
    return new Set([
      'Gym Access',
      'Group Classes',
      'Yoga Classes',
      'Zumba Sessions',
      'HIIT',
      'CrossFit',
      'Pilates',
      'Kickboxing',
      'Dance Fitness',
    ]);
  }, [gym?.enabledSessionCategories]);

  // Filter OTHER_CLASSES based on admin-enabled categories
  const filteredOtherClasses = useMemo(() => {
    // If specific sub-classes are present in enabledCategories, strictly obey them!
    const hasSpecificSubClass = OTHER_CLASSES.some((c) => enabledCategories.has(c.name));
    if (hasSpecificSubClass) {
      return OTHER_CLASSES.filter((c) => enabledCategories.has(c.name));
    }
    // Fallback only if legacy 'Other Fitness Classes' / 'Other Classes' was saved
    if (enabledCategories.has('Other Fitness Classes') || enabledCategories.has('Other Classes')) {
      return OTHER_CLASSES;
    }
    return [];
  }, [enabledCategories]);

  // Check if any sub-class within Other Fitness Classes is enabled
  const hasOtherClassesEnabled = useMemo(() => {
    return filteredOtherClasses.length > 0;
  }, [filteredOtherClasses]);

  const [gymBookingType, setGymBookingType] = useState(
    isSingleSessionEnabled ? 'Per Session' : 'Weekly Plan'
  ); // 'Per Session', 'Weekly Plan', 'Custom Dates'
  const [selectedStartDate, setSelectedStartDate] = useState(new Date());
  const [customSelectedDates, setCustomSelectedDates] = useState([
    new Date(),
    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
  ]);

  // Personal Trainer Selection for Session Bookings
  const [selectedSessionTrainer, setSelectedSessionTrainer] = useState(null);
  const [gymTrainers, setGymTrainers] = useState(Array.isArray(gym?.trainers) ? gym.trainers : []);

  useEffect(() => {
    if (!isSingleSessionEnabled && gymBookingType === 'Per Session') {
      setGymBookingType('Weekly Plan');
    }
  }, [isSingleSessionEnabled, gymBookingType]);

  useEffect(() => {
    const targetGymId = gym?._id || gym?.id || gym?.partnerId;
    if (!targetGymId) return;
    let isMounted = true;
    apiService
      .getGymTrainers(targetGymId)
      .then((fetched) => {
        if (isMounted && Array.isArray(fetched) && fetched.length > 0) {
          setGymTrainers(fetched);
        }
      })
      .catch((err) => {
        console.warn('Failed to load gym trainers for booking:', err?.message);
      });
    return () => {
      isMounted = false;
    };
  }, [gym?._id, gym?.id, gym?.partnerId]);

  // Trainers who offer Single Session pass (price > 0)
  const availableSessionTrainers = useMemo(() => {
    return (gymTrainers || []).filter((tr) => Number(tr.trainerPricing?.singleSession || 0) > 0);
  }, [gymTrainers]);

  // Auto-reset selectedSessionTrainer if they do not offer session passes
  useEffect(() => {
    if (selectedSessionTrainer) {
      const selectedId = selectedSessionTrainer._id || selectedSessionTrainer.id || selectedSessionTrainer.employeeId;
      const isValid = availableSessionTrainers.some((tr) => {
        const trId = tr._id || tr.id || tr.employeeId;
        return trId === selectedId;
      });
      if (!isValid) {
        setSelectedSessionTrainer(null);
      }
    }
  }, [availableSessionTrainers, selectedSessionTrainer]);

  const trainerDailyFee = selectedSessionTrainer
    ? Number(selectedSessionTrainer?.trainerPricing?.singleSession || 0)
    : 0;
  const singleSessionTotalPerDay = sessionBasePrice + trainerDailyFee;

  // Class Booking State (Yoga, Zumba, HIIT, etc.)
  const [selectedClassName, setSelectedClassName] = useState('Yoga Classes');
  const [selectedClassType, setSelectedClassType] = useState('Hatha Yoga');
  const [selectedClassPrice, setSelectedClassPrice] = useState(249.0);
  const [selectedClassDate, setSelectedClassDate] = useState(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('07:00 AM');

  const targetClassDateObj = useMemo(() => {
    return selectedClassDate ? new Date(selectedClassDate) : new Date();
  }, [selectedClassDate]);

  const classSlotsData = useMemo(() => {
    if (selectedSessionTrainer) {
      return generateTrainerAvailableSlots(gym?.openingHours, targetClassDateObj, selectedSessionTrainer);
    }
    return generateAvailableSlots(gym?.openingHours, targetClassDateObj);
  }, [gym?.openingHours, targetClassDateObj, selectedSessionTrainer]);

  const dynamicMorningSlots = classSlotsData.morningSlots || [];
  const dynamicEveningSlots = classSlotsData.eveningSlots || [];
  const isGymOpenOnSelectedDate = classSlotsData.isOpen;

  // Auto-select valid slot when date changes or current selectedTimeSlot is invalid
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

  const primaryNavy = isDark ? '#93C5FD' : '#003882';
  const cardColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';

  const loadSections = async () => {
    if (!gymId) return;
    try {
      setIsLoadingSections(true);
      setSectionsError(null);
      const data = await apiService.getGymSections(gymId);
      const list = Array.isArray(data) ? data : [];
      setSections(list);
      if (list.length > 0 && !selectedSection) {
        setSelectedSection(list[0]);
      }
    } catch (err) {
      console.warn('Failed to load gym sections:', err?.message);
      setSectionsError(err?.message || 'Failed to load group classes');
    } finally {
      setIsLoadingSections(false);
    }
  };

  useEffect(() => {
    loadSections();
  }, [gymId]);

  const selectCategory = (cat) => {
    setSelectedCategory(cat);
    if (cat === 'Gym') {
      setActiveSessionKey('Gym Access');
      setSessionSubView('plan_select');
      setCurrentView('session_booking');
    } else if (cat === 'Group Classes') {
      setActiveSessionKey('Group Classes');
      setSessionSubView('plan_select');
      setCurrentView('session_booking');
      if (sections.length === 0) {
        loadSections();
      }
    } else if (cat === 'Yoga') {
      setActiveSessionKey('Yoga Classes');
      setSessionSubView('plan_select');
      setCurrentView('session_booking');
    } else if (cat === 'Zumba') {
      setActiveSessionKey('Zumba Sessions');
      setSessionSubView('plan_select');
      setCurrentView('session_booking');
    } else if (cat === 'Other Classes') {
      setCurrentView('other_classes');
    }
  };

  const selectOtherClass = (name) => {
    setActiveSessionKey(name);
    setSessionSubView('plan_select');
    setCurrentView('session_booking');
  };

  const handleOpenTrainerProfile = (specificTrainer = null) => {
    const tr = specificTrainer || selectedSection?.trainerId;
    if (!tr) return;

    const trainerData = {
      ...tr,
      name: tr.name || 'Trainer',
      imageUrl: tr.avatar || tr.imageUrl,
      avatar: tr.avatar || tr.imageUrl,
      specialty: tr.specialty || tr.specialization || 'Trainer',
      specialization: tr.specialization || tr.specialty || 'Head Fitness Instructor',
      experience: tr.experience || (tr.experienceYears ? `${tr.experienceYears}+ Years` : '1+ Years'),
      rating: tr.rating !== undefined ? tr.rating : 4.8,
      reviewsCount: tr.reviewsCount !== undefined ? tr.reviewsCount : 2,
      aboutMe: tr.aboutMe || tr.description || tr.bio || `${tr.name || 'This trainer'} is a certified fitness coach specialized in ${tr.specialization || tr.specialty || 'personal fitness coaching'}.`,
      servicesOffered: Array.isArray(tr.specializations) && tr.specializations.length > 0
        ? tr.specializations
        : (tr.specialty || tr.specialization ? [tr.specialty || tr.specialization, 'Personal Training', 'Fitness Assessment'] : undefined),
      certifications: tr.trainerCerts?.map?.((c) => c.certType || c.fileName) || tr.certifications,
    };
    setSelectedTrainerData(trainerData);
    setTrainerReviewsList(tr.ratings || tr.reviews || []);
    setShowTrainerModal(true);

    const targetGymId = gym?._id || gym?.id || gym?.partnerId || selectedSection?.gymId;
    if (targetGymId && tr.name) {
      apiService
        .getTrainerRatings(targetGymId, tr.name)
        .then((data) => {
          if (data && (Array.isArray(data.ratings) || Array.isArray(data.reviews))) {
            setTrainerReviewsList(data.ratings || data.reviews || []);
          }
        })
        .catch(() => {});
    }
  };

  const getBatchInclusions = (sec, gymData) => {
    if (Array.isArray(sec?.inclusions) && sec.inclusions.length > 0) {
      return sec.inclusions.filter((x) => typeof x === 'string' && x.trim());
    }
    if (typeof sec?.inclusions === 'string' && sec.inclusions.trim()) {
      return sec.inclusions.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    }

    const cat = (sec?.category || 'workout').toLowerCase();
    const coachName = sec?.trainerId?.name ? `Coach ${sec.trainerId.name}` : 'Certified Coach';
    const duration = sec?.durationDays || 20;

    const categoryFeatures = {
      yoga: [
        `Guided yoga postures, pranayama & meditation led by ${coachName}`,
        'Dedicated studio space with yoga mats & stretching props provided',
        `Structured ${duration}-session flexibility & posture progression roadmap`,
      ],
      zumba: [
        `High-energy cardio dance & group choreography led by ${coachName}`,
        'Studio sound system access with curated dance playlist',
        `Progressive endurance & calorie-burn routine across ${duration} active sessions`,
      ],
      boxing: [
        `Heavy bags, focus pads & striking drills coached by ${coachName}`,
        'Footwork, endurance & combat conditioning circuits',
        `Complete ${duration}-session agility, speed & strength training`,
      ],
      crossfit: [
        `Functional fitness, kettlebells & Olympic weight training led by ${coachName}`,
        'Reserved functional training turf & pull-up rig zone',
        `Daily WOD programming tailored for ${duration} structured sessions`,
      ],
      hiit: [
        `High-intensity interval training & circuit intervals led by ${coachName}`,
        'Metabolic conditioning & heart-rate stamina drills',
        `Progressive stamina roadmap spanning ${duration} training sessions`,
      ],
      pilates: [
        `Core stability, spinal alignment & reformer/mat work led by ${coachName}`,
        'Low-impact resistance equipment & stability props reserved',
        `Structured ${duration}-session posture & tone development`,
      ],
      gym: [
        `Personalized workout guidance & form correction by ${coachName}`,
        'Dedicated access to gym machines, free weights & dumbbells',
        `Comprehensive ${duration}-session structured strength roadmap`,
      ],
    };

    const specificList = categoryFeatures[cat] || [
      `Full trainer-guided batch training led by ${coachName}`,
      'Reserved equipment & dedicated workout area',
      `${duration} structured training sessions included`,
    ];

    return [
      ...specificList,
      'Full access to locker rooms & shower facilities',
      'Daily batch attendance & personal progress tracking',
    ];
  };

  const getBatchNotice = (sec, gymData) => {
    if (sec?.instructions && typeof sec.instructions === 'string' && sec.instructions.trim()) {
      return sec.instructions.trim();
    }
    if (sec?.notice && typeof sec.notice === 'string' && sec.notice.trim()) {
      return sec.notice.trim();
    }

    const gymTitle = gymData?.name || gym?.name || 'the gym';
    const timeSlot = sec?.startTime ? sec.startTime : 'the batch time';
    const activeDays = Array.isArray(sec?.activeDays) && sec.activeDays.length > 0
      ? sec.activeDays.join(', ')
      : 'all scheduled days';

    return `Please arrive 10 minutes before ${timeSlot} on active days (${activeDays}). Batch schedule & attendance is managed by ${gymTitle}.`;
  };

  const formatDate = (dt) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[(dt.getDay() + 6) % 7];
    return `${dayName}, ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const monthName = (m) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[m];
  };

  const goToCheckout = (sectionOverride = null) => {
    let title = '';
    let datesSummary = '';
    let timeSlot = null;
    let sessions = 1;
    let subtotal = 0;

    const activeSection = sectionOverride || selectedSection;

    if ((currentView === 'group_classes' || currentView === 'group_class_detail') && activeSection) {
      title = `Group Class: ${activeSection.title}`;
      const startStr = formatToDDMMYYYY(activeSection.startDate);
      const endStr = formatToDDMMYYYY(activeSection.endDate);
      datesSummary = `${startStr} to ${endStr} (${activeSection.durationDays || 20} Days Batch)`;
      timeSlot = `${activeSection.startTime} - ${activeSection.endTime}`;
      sessions = activeSection.durationDays || 20;
      subtotal = Number(activeSection.cost) || 0;
    } else if (currentView === 'gym_booking' && gymBookingType === 'Per Session') {
      title = selectedSessionTrainer
        ? `Gym Access + Coach ${selectedSessionTrainer.name || ''}`.trim()
        : 'Gym Access (Single Session)';
      datesSummary = 'Valid for today / next 24 hrs';
      sessions = 1;
      subtotal = singleSessionTotalPerDay;
    } else if (currentView === 'weekly_plan' || (currentView === 'gym_booking' && gymBookingType === 'Weekly Plan')) {
      title = selectedSessionTrainer
        ? `Weekly Unlimited Gym Pass + Coach ${selectedSessionTrainer.name || ''}`.trim()
        : 'Weekly Unlimited Gym Pass';
      const end = new Date(selectedStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);
      datesSummary = `${formatDate(selectedStartDate)} to ${formatDate(end)} (7 Days)`;
      sessions = 7;
      subtotal = 999.0 + (selectedSessionTrainer ? trainerDailyFee * 7 : 0);
    } else if (currentView === 'custom_dates' || (currentView === 'gym_booking' && gymBookingType === 'Custom Dates')) {
      title = selectedSessionTrainer
        ? `Gym Access + Coach ${selectedSessionTrainer.name || ''} (Custom Dates)`.trim()
        : 'Gym Access (Custom Dates)';
      sessions = customSelectedDates.length;
      const sortedDates = [...customSelectedDates].sort((a, b) => a.getTime() - b.getTime());
      datesSummary = sortedDates.map((d) => `${d.getDate()} ${monthName(d.getMonth())}`).join(', ');
      subtotal = singleSessionTotalPerDay * sessions;
    } else if (currentView === 'class_booking') {
      title = `${selectedClassName} (${selectedClassType})`;
      datesSummary = formatDate(selectedClassDate);
      timeSlot = selectedTimeSlot;
      sessions = 1;
      subtotal = selectedClassPrice;
    }

    navigation.navigate('PaymentSummary', {
      type: 'booking',
      gym,
      bookingTitle: title,
      datesSummary,
      timeSlot,
      sessionsCount: sessions,
      subtotal,
      discount: 0.0,
      amount: subtotal,
      sectionId: activeSection?._id || null,
      bookingType: (currentView === 'group_classes' || currentView === 'group_class_detail') ? 'GROUP_CLASS' : 'GYM_SESSION',
      startDate: (currentView === 'custom_dates' || (currentView === 'gym_booking' && gymBookingType === 'Custom Dates'))
        ? [...customSelectedDates].sort((a, b) => a.getTime() - b.getTime())[0] || new Date()
        : (activeSection?.startDate || selectedStartDate || new Date()),
      endDate: (currentView === 'custom_dates' || (currentView === 'gym_booking' && gymBookingType === 'Custom Dates'))
        ? [...customSelectedDates].sort((a, b) => a.getTime() - b.getTime())[customSelectedDates.length - 1] || null
        : (activeSection?.endDate || null),
      durationDays: activeSection?.durationDays || sessions,
      customDates: (currentView === 'custom_dates' || (currentView === 'gym_booking' && gymBookingType === 'Custom Dates'))
        ? customSelectedDates.map((d) => d.toISOString())
        : null,
      category: activeSection?.category || 'general',
      trainerId: (currentView === 'group_classes' || currentView === 'group_class_detail')
        ? (activeSection?.trainerId?._id || activeSection?.trainerId || null)
        : (selectedSessionTrainer?._id || selectedSessionTrainer?.employeeId || null),
    });
  };

  const handleUnifiedSessionCheckout = (bookingDetails) => {
    navigation.navigate('PaymentSummary', {
      type: 'booking',
      gym,
      bookingTitle: bookingDetails.title,
      datesSummary: bookingDetails.datesSummary,
      timeSlot: 'Full Day Access',
      sessionsCount: bookingDetails.sessions,
      subtotal: bookingDetails.subtotal,
      discount: 0.0,
      amount: bookingDetails.subtotal,
      sectionId: null,
      bookingType: 'GYM_SESSION',
      startDate: bookingDetails.startDate,
      endDate: bookingDetails.endDate,
      durationDays: bookingDetails.sessions,
      customDates: bookingDetails.customDates,
      category: bookingDetails.category || 'general',
      trainerId: bookingDetails.trainerId,
    });
  };

  const getAppBarTitle = () => {
    if (currentView === 'session_booking') {
      const activeConfig = SESSION_CONFIGS[activeSessionKey] || SESSION_CONFIGS['Gym Access'];
      if (sessionSubView === 'trainer_select') return 'Select Personal Coach';
      if (sessionSubView === 'single_session') return 'Select Date & Slot';
      if (sessionSubView === 'weekly_plan') return 'Select Start Date';
      if (sessionSubView === 'custom_dates') return 'Select Custom Dates';
      return `Book ${activeConfig?.title || 'Session'}`;
    }
    switch (currentView) {
      case 'group_classes':
        return 'Group Classes & Batches';
      case 'group_class_detail':
        return 'Batch Details';
      case 'other_classes':
        return 'Other Fitness Classes';
      default:
        return 'Book Session';
    }
  };

  const handleBackPress = () => {
    if (currentView === 'session_booking') {
      if (
        sessionSubView === 'single_session' ||
        sessionSubView === 'weekly_plan' ||
        sessionSubView === 'custom_dates'
      ) {
        if (gymTrainers && gymTrainers.some((t) => Number(t.trainerPricing?.singleSession || 0) > 0)) {
          setSessionSubView('trainer_select');
        } else {
          setSessionSubView('plan_select');
        }
        return;
      }
      if (sessionSubView === 'trainer_select') {
        setSessionSubView('plan_select');
        return;
      }
      if (
        activeSessionKey === 'HIIT' ||
        activeSessionKey === 'CrossFit' ||
        activeSessionKey === 'Pilates' ||
        activeSessionKey === 'Kickboxing' ||
        activeSessionKey === 'Dance Fitness'
      ) {
        setCurrentView('other_classes');
        return;
      }
      setCurrentView('categories');
      return;
    }
    if (currentView === 'group_class_detail') {
      setCurrentView('group_classes');
      return;
    }
    if (currentView === 'group_classes') {
      setCurrentView('session_booking');
      setActiveSessionKey('Group Classes');
      setSessionSubView('plan_select');
      return;
    }
    if (currentView === 'other_classes') {
      setCurrentView('categories');
      return;
    }
    navigation.goBack();
  };

  // Hardware Back Handler for Android devices
  useEffect(() => {
    const onHardwareBack = () => {
      if (currentView === 'session_booking') {
        if (
          sessionSubView === 'single_session' ||
          sessionSubView === 'weekly_plan' ||
          sessionSubView === 'custom_dates'
        ) {
          if (gymTrainers && gymTrainers.some((t) => Number(t.trainerPricing?.singleSession || 0) > 0)) {
            setSessionSubView('trainer_select');
          } else {
            setSessionSubView('plan_select');
          }
          return true;
        }
        if (sessionSubView === 'trainer_select') {
          setSessionSubView('plan_select');
          return true;
        }
      }
      if (currentView === 'session_booking' || currentView === 'group_classes' || currentView === 'other_classes') {
        if (
          activeSessionKey === 'HIIT' ||
          activeSessionKey === 'CrossFit' ||
          activeSessionKey === 'Pilates' ||
          activeSessionKey === 'Kickboxing' ||
          activeSessionKey === 'Dance Fitness'
        ) {
          setCurrentView('other_classes');
          return true;
        }
        if (currentView !== 'categories') {
          setCurrentView('categories');
          return true;
        }
      }
      return false;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [currentView, sessionSubView, activeSessionKey]);

  const filteredSections =
    selectedGroupCategory === 'all'
      ? sections
      : sections.filter(
          (s) => (s.category || '').toLowerCase() === selectedGroupCategory.toLowerCase()
        );

  const renderTrainerSelector = (bookingMode = 'session') => {
    const isWeekly = bookingMode === 'weekly';
    const isCustom = bookingMode === 'custom';
    const customCount = customSelectedDates.length || 1;

    const subText = isWeekly
      ? 'Train with a dedicated personal coach for your 7-day pass'
      : isCustom
      ? `Add personal coaching across your ${customCount} selected dates`
      : 'Work out independently or add 1-on-1 coaching for your visit';

    const freeText = isWeekly
      ? 'Included in Weekly Pass'
      : isCustom
      ? 'Included in Custom Pass'
      : 'Included in Day Pass';

    return (
      <View style={styles.trainerSelectorSection}>
        <View style={styles.trainerSelectorHeader}>
          <Text style={[styles.trainerSelectorTitle, { color: textColor }]}>
            Add Personal Trainer (Optional)
          </Text>
          <Text style={[styles.trainerSelectorSub, { color: subtitleColor }]}>
            {subText}
          </Text>
        </View>

        {/* Option: No Trainer */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setSelectedSessionTrainer(null)}
          style={[
            styles.trainerSelectCard,
            {
              backgroundColor: selectedSessionTrainer === null
                ? (isDark ? '#262626' : '#F1F5F9')
                : cardColor,
              borderColor: selectedSessionTrainer === null
                ? (isDark ? '#60A5FA' : '#003882')
                : borderColor,
              borderWidth: selectedSessionTrainer === null ? 1.5 : 1,
            },
          ]}
        >
          <View style={[styles.trainerAvatarFallback, { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(0,56,130,0.1)' }]}>
            <MaterialIcons name="person-outline" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.trainerSelectName, { color: textColor }]}>
              Without Personal Trainer
            </Text>
            <Text style={[styles.trainerSelectDesc, { color: subtitleColor }]}>
              Standard gym floor and equipment access
            </Text>
            <Text style={styles.trainerSelectFreePrice}>{freeText}</Text>
          </View>
          <MaterialIcons
            name={selectedSessionTrainer === null ? 'radio-button-checked' : 'radio-button-unchecked'}
            size={20}
            color={selectedSessionTrainer === null ? (isDark ? '#60A5FA' : '#003882') : subtitleColor}
          />
        </TouchableOpacity>

        {/* Trainer Options */}
        {availableSessionTrainers.length === 0 ? (
          <View
            style={[
              styles.noTrainerNoticeCard,
              {
                backgroundColor: isDark ? '#262626' : '#F8FAFC',
                borderColor: borderColor,
              },
            ]}
          >
            <MaterialIcons name="info-outline" size={18} color={subtitleColor} />
            <Text style={[styles.noTrainerNoticeText, { color: subtitleColor }]}>
              No personal trainers available for day/session passes
            </Text>
          </View>
        ) : (
          availableSessionTrainers.map((tr) => {
            const trId = tr._id || tr.id || tr.employeeId;
            const isSelected = Boolean(
              selectedSessionTrainer && (
                (selectedSessionTrainer._id && tr._id && selectedSessionTrainer._id === tr._id) ||
                (selectedSessionTrainer.employeeId && tr.employeeId && selectedSessionTrainer.employeeId === tr.employeeId) ||
                selectedSessionTrainer === tr
              )
            );
            const trFee = Number(tr.trainerPricing?.singleSession || 0);

            let feeText = `+₹${trFee} / Day`;
            if (isWeekly) {
              feeText = `+₹${trFee * 7} / Week (7 Days)`;
            } else if (isCustom) {
              feeText = `+₹${trFee * customCount} (${customCount} Days)`;
            }

            return (
              <TouchableOpacity
                key={String(trId || tr.name)}
                activeOpacity={0.85}
                onPress={() => setSelectedSessionTrainer(tr)}
                style={[
                  styles.trainerSelectCard,
                  {
                    backgroundColor: isSelected
                      ? (isDark ? '#262626' : '#F1F5F9')
                      : cardColor,
                    borderColor: isSelected
                      ? (isDark ? '#60A5FA' : '#003882')
                      : borderColor,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleOpenTrainerProfile(tr)}
                >
                  {tr.avatar ? (
                    <Image source={{ uri: tr.avatar }} style={styles.trainerAvatarImg} />
                  ) : (
                    <View style={[styles.trainerAvatarFallback, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                      <Text style={[styles.trainerInitials, { color: textColor }]}>
                        {(tr.name || 'T').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.trainerSelectName, { color: textColor }]} numberOfLines={1}>
                      {tr.name ? `Coach ${tr.name}` : 'Personal Trainer'}
                    </Text>
                    {tr.rating ? (
                      <View style={styles.trainerRatingBadge}>
                        <MaterialIcons name="star" size={12} color="#F59E0B" />
                        <Text style={styles.trainerRatingText}>{tr.rating}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.trainerSelectDesc, { color: subtitleColor }]} numberOfLines={1}>
                    {tr.specialization || tr.specialty || 'Fitness Trainer'}
                  </Text>

                  <View style={styles.trainerDetailsRow}>
                    <Text style={styles.trainerSelectAddonPrice}>
                      {feeText}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        handleOpenTrainerProfile(tr);
                      }}
                      style={styles.viewTrainerDetailsBtn}
                    >
                      <Text style={[styles.viewTrainerDetailsText, { color: isDark ? '#93C5FD' : '#003882' }]}>
                        View Details
                      </Text>
                      <MaterialIcons name="chevron-right" size={14} color={isDark ? '#93C5FD' : '#003882'} />
                    </TouchableOpacity>
                  </View>
                </View>

                <MaterialIcons
                  name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={20}
                  color={isSelected ? (isDark ? '#60A5FA' : '#003882') : subtitleColor}
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App Bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: textColor }]}>{getAppBarTitle()}</Text>
        </View>
      </SafeAreaView>

      {/* VIEW 1: CATEGORIES */}
      {currentView === 'categories' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={[styles.chooseTitle, { color: textColor }]}>
            Choose What You Want to Book
          </Text>

          {/* 1. Gym Access */}
          {enabledCategories.has('Gym Access') && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => selectCategory('Gym')}
              style={[styles.categoryCard, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: isDark ? 'rgba(96,165,250,0.2)' : 'rgba(0,56,130,0.1)' }]}>
                <MaterialIcons name="fitness-center" size={26} color={isDark ? '#60A5FA' : '#003882'} />
              </View>
              <View style={styles.categoryContent}>
                <Text style={[styles.categoryTitle, { color: textColor }]}>Gym Access</Text>
                <Text style={[styles.categoryDesc, { color: subtitleColor }]}>
                  Book gym access by session, weekly or custom dates
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
            </TouchableOpacity>
          )}

          {/* 2. Group Classes (Owner Created Sections/Batches) */}
          {enabledCategories.has('Group Classes') && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => selectCategory('Group Classes')}
              style={[styles.categoryCard, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.2)' : 'rgba(79,70,229,0.12)' }]}>
                <MaterialIcons name="groups" size={26} color={isDark ? '#818CF8' : '#4F46E5'} />
              </View>
              <View style={styles.categoryContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.categoryTitle, { color: textColor }]}>Group Classes</Text>
                  {sections.length > 0 && (
                    <View style={[styles.batchCountBadge, { backgroundColor: isDark ? 'rgba(99,102,241,0.25)' : 'rgba(79,70,229,0.12)' }]}>
                      <Text style={[styles.batchCountBadgeText, { color: isDark ? '#A5B4FC' : '#4F46E5' }]}>
                        {sections.length} {sections.length === 1 ? 'Batch' : 'Batches'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.categoryDesc, { color: subtitleColor }]}>
                  Book trainer-led batches & scheduled workout sections
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
            </TouchableOpacity>
          )}

          {/* 3. Yoga Classes */}
          {enabledCategories.has('Yoga Classes') && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => selectCategory('Yoga')}
              style={[styles.categoryCard, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: isDark ? 'rgba(167,139,250,0.2)' : 'rgba(124,58,237,0.12)' }]}>
                <MaterialIcons name="self-improvement" size={26} color={isDark ? '#A78BFA' : '#7C3AED'} />
              </View>
              <View style={styles.categoryContent}>
                <Text style={[styles.categoryTitle, { color: textColor }]}>Yoga Classes</Text>
                <Text style={[styles.categoryDesc, { color: subtitleColor }]}>
                  Book yoga classes with certified expert trainers
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
            </TouchableOpacity>
          )}

          {/* 4. Zumba Sessions */}
          {enabledCategories.has('Zumba Sessions') && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => selectCategory('Zumba')}
              style={[styles.categoryCard, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: isDark ? 'rgba(244,114,182,0.2)' : 'rgba(219,39,119,0.12)' }]}>
                <MaterialIcons name="music-note" size={26} color={isDark ? '#F472B6' : '#DB2777'} />
              </View>
              <View style={styles.categoryContent}>
                <Text style={[styles.categoryTitle, { color: textColor }]}>Zumba Sessions</Text>
                <Text style={[styles.categoryDesc, { color: subtitleColor }]}>
                  Book fun, high-energy dance workout sessions
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
            </TouchableOpacity>
          )}

          {/* 5. Other Classes */}
          {hasOtherClassesEnabled ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => selectCategory('Other Classes')}
              style={[styles.categoryCard, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: isDark ? 'rgba(52,211,153,0.2)' : 'rgba(0,191,98,0.12)' }]}>
                <MaterialIcons name="grid-view" size={26} color={isDark ? '#34D399' : '#00BF62'} />
              </View>
              <View style={styles.categoryContent}>
                <Text style={[styles.categoryTitle, { color: textColor }]}>Other Fitness Classes</Text>
                <Text style={[styles.categoryDesc, { color: subtitleColor }]}>
                  Explore HIIT, CrossFit, Pilates, Kickboxing & more
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
            </TouchableOpacity>
          ) : null}

          {/* Info notice */}
          <View style={styles.infoNoticeRow}>
            <MaterialIcons name="info-outline" size={14} color={subtitleColor} style={{ marginRight: 6 }} />
            <Text style={[styles.infoNoticeText, { color: subtitleColor }]}>
              All sessions are subject to gym slot availability
            </Text>
          </View>
        </ScrollView>
      )}

      {/* UNIFIED SESSION BOOKING FLOW (Gym Access, Group Classes, Yoga, Zumba, HIIT, CrossFit, Pilates, Kickboxing, Dance Fitness) */}
      {currentView === 'session_booking' && (
        <SessionBookingFlow
          sessionConfig={SESSION_CONFIGS[activeSessionKey] || SESSION_CONFIGS['Gym Access']}
          gym={gym}
          gymTrainers={gymTrainers}
          isDark={isDark}
          subView={sessionSubView}
          onSubViewChange={setSessionSubView}
          onContinueToCheckout={handleUnifiedSessionCheckout}
          extraTopBanner={
            activeSessionKey === 'Group Classes' && sections.length > 0 ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setCurrentView('group_classes')}
                style={[
                  styles.batchesBannerPill,
                  {
                    backgroundColor: isDark ? 'rgba(99,102,241,0.18)' : '#EEF2FF',
                    borderColor: isDark ? 'rgba(99,102,241,0.35)' : '#C7D2FE',
                  },
                ]}
              >
                <View style={[styles.batchesBannerIcon, { backgroundColor: isDark ? '#4338CA' : '#4F46E5' }]}>
                  <MaterialIcons name="groups" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.batchesBannerTitle, { color: isDark ? '#C7D2FE' : '#312E81' }]}>
                    {sections.length} Scheduled Batches Available
                  </Text>
                  <Text style={[styles.batchesBannerSub, { color: isDark ? '#A5B4FC' : '#4338CA' }]}>
                    Prefer scheduled trainer-led batches? Tap to view
                  </Text>
                </View>
                <MaterialIcons name="arrow-forward" size={18} color={isDark ? '#C7D2FE' : '#4F46E5'} />
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      {/* VIEW: GROUP CLASSES / OWNER CREATED SECTIONS */}
      {currentView === 'group_classes' && (
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero Banner */}
            <ImageBackground
              source={{
                uri: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=800&auto=format&fit=crop',
              }}
              style={styles.heroBanner}
              imageStyle={{ borderRadius: 20 }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(15,23,42,0.88)', 'rgba(30,27,75,0.72)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.heroBannerGradient}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.groupHeroBadge}>
                    <MaterialIcons name="groups" size={16} color="#FFFFFF" />
                  </View>
                  <Text style={styles.heroBannerTitle}>Group Classes & Batches</Text>
                </View>
                <Text style={styles.heroBannerSubtitle}>
                  Structured training batches scheduled & led by gym trainers
                </Text>
              </LinearGradient>
            </ImageBackground>

            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.groupFilterScroll}
            >
              {[
                { key: 'all', label: 'All Batches' },
                { key: 'yoga', label: 'Yoga' },
                { key: 'zumba', label: 'Zumba' },
                { key: 'crossfit', label: 'CrossFit' },
                { key: 'hiit', label: 'HIIT' },
                { key: 'pilates', label: 'Pilates' },
                { key: 'boxing', label: 'Boxing' },
                { key: 'other', label: 'Other' },
              ].map((tab) => {
                const isActive = selectedGroupCategory === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    activeOpacity={0.8}
                    onPress={() => setSelectedGroupCategory(tab.key)}
                    style={[
                      styles.groupFilterChip,
                      {
                        backgroundColor: isActive
                          ? '#003882'
                          : isDark
                          ? 'rgba(255,255,255,0.06)'
                          : '#F1F5F9',
                        borderColor: isActive ? '#003882' : borderColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.groupFilterChipText,
                        {
                          color: isActive ? '#FFFFFF' : textColor,
                          fontWeight: isActive ? 'bold' : '500',
                        },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Loading Indicator */}
            {isLoadingSections && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#003882" />
                <Text style={[styles.loadingText, { color: subtitleColor }]}>
                  Loading available batches from {gym.name || 'gym'}...
                </Text>
              </View>
            )}

            {/* Error Banner */}
            {!isLoadingSections && sectionsError && (
              <View style={styles.errorNoticeBox}>
                <MaterialIcons name="error-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
                <Text style={styles.errorNoticeText}>{sectionsError}</Text>
                <TouchableOpacity onPress={loadSections} style={styles.retryPill}>
                  <Text style={styles.retryPillText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Empty State */}
            {!isLoadingSections && !sectionsError && filteredSections.length === 0 && (
              <View style={[styles.emptyBatchCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
                <View style={[styles.emptyIconBox, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(79,70,229,0.08)' }]}>
                  <MaterialIcons name="event-busy" size={36} color={isDark ? '#A5B4FC' : '#4F46E5'} />
                </View>
                <Text style={[styles.emptyBatchTitle, { color: textColor }]}>
                  No Batches Available
                </Text>
                <Text style={[styles.emptyBatchDesc, { color: subtitleColor }]}>
                  {selectedGroupCategory === 'all'
                    ? 'The gym owner has not scheduled any active batches yet.'
                    : `No active batches found for category "${selectedGroupCategory}". Try selecting another category.`}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={loadSections}
                  style={styles.refreshBatchesBtn}
                >
                  <MaterialIcons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.refreshBatchesBtnText}>Refresh Batches</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Batch Listing Cards (Clean Master Listing) */}
            {!isLoadingSections &&
              filteredSections.map((sec) => {
                const catStyle = getCategoryBadgeStyle(sec.category, isDark);
                const trainerName = sec.trainerId?.name || 'Assigned Coach';
                const trainerAvatar = sec.trainerId?.avatar;
                const trainerSpec = sec.trainerId?.specialization;
                const enrolled = sec.enrolledCount || 0;
                const capacity = sec.maxCapacity || 25;
                const remaining = Math.max(0, capacity - enrolled);
                const isFilled = remaining <= 0;

                return (
                  <TouchableOpacity
                    key={sec._id}
                    activeOpacity={0.88}
                    onPress={() => {
                      setSelectedSection(sec);
                      setCurrentView('group_class_detail');
                    }}
                    style={[
                      styles.sectionListCard,
                      {
                        backgroundColor: cardColor,
                        borderColor: borderColor,
                      },
                      isFilled && styles.sectionListCardFilled,
                    ]}
                  >
                    {/* Top: Category Pill & Capacity */}
                    <View style={styles.sectionCardHeader}>
                      <View style={styles.sectionCatBadge}>
                        <MaterialIcons name={catStyle.icon} size={15} color={catStyle.text} style={{ marginRight: 4 }} />
                        <Text style={[styles.sectionCatBadgeText, { color: catStyle.text }]}>
                          {(sec.category || 'workout').toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        {Boolean(getSectionBooking(sec)) && (
                          <View
                            style={[
                              styles.sectionCapacityPill,
                              {
                                backgroundColor: 'rgba(0, 191, 98, 0.12)',
                                borderColor: 'rgba(0, 191, 98, 0.3)',
                                borderWidth: 1,
                              },
                            ]}
                          >
                            <MaterialIcons name="check-circle" size={13} color="#00BF62" style={{ marginRight: 3 }} />
                            <Text style={[styles.sectionCapacityText, { color: '#00BF62', fontWeight: '800' }]}>
                              Enrolled
                            </Text>
                          </View>
                        )}
                        <View style={styles.sectionCapacityPill}>
                          <MaterialIcons
                            name={isFilled ? 'block' : 'person'}
                            size={13}
                            color={isFilled ? '#EF4444' : remaining <= 3 ? '#EF4444' : '#00BF62'}
                            style={{ marginRight: 3 }}
                          />
                          <Text
                            style={[
                              styles.sectionCapacityText,
                              { color: isFilled ? '#EF4444' : remaining <= 3 ? '#EF4444' : '#00BF62' },
                              isFilled && { fontWeight: '700' },
                            ]}
                          >
                            {isFilled ? 'Slot Full' : remaining <= 3 ? `Only ${remaining} left` : `${enrolled}/${capacity} Enrolled`}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Section Title */}
                    <Text style={[styles.sectionTitleText, { color: textColor }]}>
                      {sec.title}
                    </Text>

                    {/* Trainer Row */}
                    <View style={styles.sectionTrainerRow}>
                      {trainerAvatar ? (
                        <Image source={{ uri: trainerAvatar }} style={styles.trainerAvatarImg} />
                      ) : (
                        <View style={[styles.trainerAvatarFallback, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                          <Text style={[styles.trainerInitials, { color: textColor }]}>
                            {trainerName.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.trainerLabel, { color: subtitleColor }]}>Trainer</Text>
                        <Text style={[styles.trainerName, { color: textColor }]}>{trainerName}</Text>
                      </View>
                      {trainerSpec ? (
                        <View style={[styles.trainerSpecBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC' }]}>
                          <Text style={[styles.trainerSpecText, { color: subtitleColor }]}>
                            {trainerSpec}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Quick Timing & Duration Info */}
                    <View style={styles.listQuickInfoRow}>
                      <View style={styles.listInfoChip}>
                        <MaterialIcons name="schedule" size={14} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 5 }} />
                        <Text style={[styles.listInfoChipText, { color: textColor }]}>
                          {sec.startTime} - {sec.endTime}
                        </Text>
                      </View>
                      <View style={styles.listInfoChip}>
                        <MaterialIcons name="date-range" size={14} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 5 }} />
                        <Text style={[styles.listInfoChipText, { color: textColor }]}>
                          {sec.durationDays || 20} Days Batch
                        </Text>
                      </View>
                    </View>

                    {/* Footer Row: Fee & View Details */}
                    <View style={styles.listCardFooter}>
                      <View>
                        <Text style={[styles.sectionFeeLabel, { color: subtitleColor }]}>Batch Fee</Text>
                        <Text style={[styles.sectionFeeValue, { color: textColor }]}>
                          ₹{Math.round(Number(sec.cost) || 0)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.viewDetailsBtn,
                          isFilled
                            ? { backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.1)' }
                            : { backgroundColor: isDark ? 'rgba(96,165,250,0.15)' : 'rgba(0,56,130,0.08)' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.viewDetailsBtnText,
                            {
                              color: isFilled ? '#EF4444' : (isDark ? '#93C5FD' : '#003882'),
                              fontWeight: isFilled ? '700' : '600',
                            },
                          ]}
                        >
                          {isFilled ? 'Slot Full' : 'View Details'}
                        </Text>
                        <MaterialIcons
                          name={isFilled ? 'block' : 'arrow-forward'}
                          size={14}
                          color={isFilled ? '#EF4444' : (isDark ? '#93C5FD' : '#003882')}
                          style={{ marginLeft: 4 }}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
          </ScrollView>
        </View>
      )}

      {/* VIEW: GROUP CLASS DETAILS (Next Screen) */}
      {currentView === 'group_class_detail' && selectedSection && (
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Class Hero Banner */}
            <ImageBackground
              source={{
                uri: selectedSection.category?.toLowerCase() === 'yoga'
                  ? 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=800&auto=format&fit=crop'
                  : selectedSection.category?.toLowerCase() === 'zumba'
                  ? 'https://images.unsplash.com/photo-1518611012118-696072aa579a?q=80&w=800&auto=format&fit=crop'
                  : 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?q=80&w=800&auto=format&fit=crop',
              }}
              style={styles.detailHeroBanner}
              imageStyle={{ borderRadius: 20 }}
              resizeMode="cover"
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.4)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.detailHeroGradient}
              >
                <View style={[styles.sectionCatBadge, { alignSelf: 'flex-start' }]}>
                  <MaterialIcons
                    name={getCategoryBadgeStyle(selectedSection.category, isDark).icon}
                    size={14}
                    color="#FFFFFF"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.sectionCatBadgeText, { color: '#FFFFFF', letterSpacing: 0.8 }]}>
                    {(selectedSection.category || 'workout').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.detailHeroBottomContent}>
                  <Text style={styles.detailHeroTitle}>{selectedSection.title}</Text>
                  <Text style={styles.detailHeroSubtitle}>
                    {gym.name || 'GYMEZY Fitness'} • {selectedSection.durationDays || 20} Days Batch
                    {selectedSection.startTime ? ` • ${selectedSection.startTime} - ${selectedSection.endTime}` : ''}
                  </Text>
                </View>
              </LinearGradient>
            </ImageBackground>

            {/* Capacity & Availability Box */}
            <View style={[styles.detailCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={styles.detailCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailSectionHeading, { color: textColor }]}>Batch Capacity</Text>
                  <Text style={[styles.detailSubtext, { color: subtitleColor }]}>
                    {Boolean(getSectionBooking(selectedSection))
                      ? 'You are enrolled in this batch! Tap "View Your Pass" below to view entry details.'
                      : (selectedSection.enrolledCount || 0) >= (selectedSection.maxCapacity || 25)
                      ? 'All slots filled! Admissions are currently closed.'
                      : (selectedSection.maxCapacity || 25) - (selectedSection.enrolledCount || 0) <= 3
                      ? 'Filling fast! Limited seats remaining.'
                      : 'Open for admissions'}
                  </Text>
                </View>
                <View style={styles.detailCapacityBadge}>
                  <MaterialIcons
                    name={(selectedSection.enrolledCount || 0) >= (selectedSection.maxCapacity || 25) ? 'block' : 'groups'}
                    size={16}
                    color={(selectedSection.enrolledCount || 0) >= (selectedSection.maxCapacity || 25) ? '#EF4444' : '#00BF62'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.detailCapacityBadgeText,
                      (selectedSection.enrolledCount || 0) >= (selectedSection.maxCapacity || 25) && { color: '#EF4444' },
                    ]}
                  >
                    {(selectedSection.enrolledCount || 0) >= (selectedSection.maxCapacity || 25)
                      ? 'Slot Full'
                      : `${selectedSection.enrolledCount || 0} / ${selectedSection.maxCapacity || 25} Enrolled`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Trainer Profile Card */}
            <View style={[styles.detailCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={styles.detailCardHeader}>
                <Text style={[styles.detailSectionHeading, { color: textColor }]}>
                  Assigned Trainer
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={selectedSection.trainerId ? 0.7 : 1}
                onPress={handleOpenTrainerProfile}
                style={[styles.trainerDetailRow, { marginTop: 12 }]}
              >
                {selectedSection.trainerId?.avatar ? (
                  <Image source={{ uri: selectedSection.trainerId?.avatar }} style={styles.trainerDetailAvatar} />
                ) : (
                  <View style={[styles.trainerDetailAvatarFallback, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <Text style={[styles.trainerDetailInitials, { color: textColor }]}>
                      {(selectedSection.trainerId?.name || 'T').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={[styles.trainerDetailName, { color: textColor }]}>
                    {selectedSection.trainerId?.name || 'Certified Gym Coach'}
                  </Text>
                  <Text style={[styles.trainerDetailRole, { color: subtitleColor }]}>
                    {selectedSection.trainerId?.specialization || 'Head Fitness Instructor'}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={subtitleColor}
                  style={{ opacity: 0.6 }}
                />
              </TouchableOpacity>
            </View>

            {/* Schedule & Routine Card */}
            <View style={[styles.detailCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <Text style={[styles.detailSectionHeading, { color: textColor, marginBottom: 14 }]}>
                Batch Schedule & Timing
              </Text>

              {/* Date Range */}
              <View style={styles.detailScheduleItem}>
                <MaterialIcons
                  name="date-range"
                  size={18}
                  color={isDark ? '#93C5FD' : '#003882'}
                  style={{ marginTop: 2, marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailScheduleLabel, { color: subtitleColor }]}>Date Range</Text>
                  <Text style={[styles.detailScheduleValue, { color: textColor }]}>
                    {formatToDDMMYYYY(selectedSection.startDate)} to {formatToDDMMYYYY(selectedSection.endDate)}
                  </Text>
                  <Text style={[styles.detailScheduleNote, { color: subtitleColor }]}>
                    {selectedSection.durationDays || 20} Active Training Sessions
                  </Text>
                </View>
              </View>

              {/* Daily Timing */}
              <View style={[styles.detailScheduleItem, { marginTop: 14 }]}>
                <MaterialIcons
                  name="schedule"
                  size={18}
                  color={isDark ? '#93C5FD' : '#003882'}
                  style={{ marginTop: 2, marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailScheduleLabel, { color: subtitleColor }]}>Daily Time Slot</Text>
                  <Text style={[styles.detailScheduleValue, { color: textColor }]}>
                    {selectedSection.startTime} - {selectedSection.endTime}
                  </Text>
                </View>
              </View>

              {/* Weekly Recurring Days */}
              <View style={[styles.detailScheduleItem, { marginTop: 14 }]}>
                <MaterialIcons
                  name="repeat"
                  size={18}
                  color={isDark ? '#93C5FD' : '#003882'}
                  style={{ marginTop: 2, marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailScheduleLabel, { color: subtitleColor, marginBottom: 8 }]}>
                    Weekly Active Days
                  </Text>
                  <View style={styles.daysPillRow}>
                    {ALL_WEEK_DAYS.map((d) => {
                      const isDayActive = Array.isArray(selectedSection.activeDays) && selectedSection.activeDays.includes(d);
                      return (
                        <View
                          key={d}
                          style={[
                            styles.detailDayPill,
                            isDayActive && {
                              backgroundColor: isDark ? 'rgba(96,165,250,0.18)' : 'rgba(0,56,130,0.08)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.detailDayPillText,
                              {
                                color: isDayActive
                                  ? (isDark ? '#93C5FD' : '#003882')
                                  : (isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'),
                                fontWeight: isDayActive ? 'bold' : 'normal',
                              },
                            ]}
                          >
                            {d}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* About / Description if available */}
            {selectedSection.description ? (
              <View style={[styles.detailCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
                <Text style={[styles.detailSectionHeading, { color: textColor, marginBottom: 8 }]}>
                  About This Batch
                </Text>
                <Text style={[styles.detailAboutText, { color: subtitleColor }]}>
                  {selectedSection.description}
                </Text>
              </View>
            ) : null}

            {/* Batch Inclusions */}
            <View style={[styles.detailCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <Text style={[styles.detailSectionHeading, { color: textColor, marginBottom: 10 }]}>
                What's Included
              </Text>
              {getBatchInclusions(selectedSection, gym).map((inc, i) => (
                <View key={i} style={styles.inclusionRow}>
                  <MaterialIcons name="check-circle" size={16} color="#00BF62" style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={[styles.inclusionText, { color: textColor, flex: 1 }]}>{inc}</Text>
                </View>
              ))}
            </View>

            {/* Notice Banner */}
            <View style={styles.detailNoticeBanner}>
              <MaterialIcons name="info-outline" size={16} color="#64748B" style={{ marginRight: 8, marginTop: 2 }} />
              <Text style={[styles.detailNoticeText, { flex: 1 }]}>
                {getBatchNotice(selectedSection, gym)}
              </Text>
            </View>
          </ScrollView>

          {/* Bottom Bar: Price & CTA */}
          {(() => {
            const bookedPass = getSectionBooking(selectedSection);
            const isAlreadyBooked = Boolean(bookedPass);
            const isSlotFull = (selectedSection.enrolledCount || 0) >= (selectedSection.maxCapacity || 25);

            return (
              <View
                style={[
                  styles.bottomBar,
                  {
                    backgroundColor: isDark
                      ? 'rgba(18, 18, 18, 0.95)'
                      : 'rgba(255, 255, 255, 0.95)',
                    borderTopColor: isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(226, 232, 240, 0.8)',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bottomPriceLabel, { color: subtitleColor }]}>
                    {isAlreadyBooked ? 'Enrollment Status' : 'Total Batch Fee'}
                  </Text>
                  <Text
                    style={[
                      styles.bottomPriceValue,
                      { color: isAlreadyBooked ? '#00BF62' : textColor },
                    ]}
                  >
                    {isAlreadyBooked
                      ? 'Enrolled'
                      : `₹${Math.round(Number(selectedSection.cost) || 0)}`}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={!isAlreadyBooked && isSlotFull}
                  onPress={() => {
                    if (isAlreadyBooked) {
                      navigation.navigate('BookingDetails', { booking: bookedPass });
                    } else {
                      goToCheckout(selectedSection);
                    }
                  }}
                  style={[
                    styles.continueBtn,
                    isAlreadyBooked && {
                      backgroundColor: '#00BF62',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    },
                    !isAlreadyBooked && isSlotFull && {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  {isAlreadyBooked && (
                    <MaterialIcons name="confirmation-number" size={18} color="#FFFFFF" />
                  )}
                  <Text
                    style={[
                      styles.continueBtnText,
                      !isAlreadyBooked && isSlotFull && {
                        color: '#EF4444',
                      },
                    ]}
                  >
                    {isAlreadyBooked
                      ? 'View Your Pass'
                      : isSlotFull
                      ? 'Slot Full'
                      : 'Continue to Payment'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      )}

      {/* VIEW 6: OTHER CLASSES DIRECTORY */}
      {currentView === 'other_classes' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={[styles.chooseTitle, { color: textColor }]}>Explore Special Classes</Text>
          <Text style={[styles.subTitleSmall, { color: subtitleColor }]}>
            Find the perfect specialized workout class for you
          </Text>

          <View style={{ marginTop: 16 }}>
            {filteredOtherClasses.map((c) => (
              <TouchableOpacity
                key={c.name}
                activeOpacity={0.85}
                onPress={() => selectOtherClass(c.name)}
                style={[styles.otherClassCard, { backgroundColor: cardColor, borderColor: borderColor }]}
              >
                <View style={[styles.otherClassIconBox, { backgroundColor: 'rgba(0,56,130,0.08)' }]}>
                  <MaterialIcons name={c.icon} size={22} color={isDark ? '#93C5FD' : '#003882'} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.categoryTitle, { color: textColor }]}>{c.title}</Text>
                  <Text style={[styles.categoryDesc, { color: subtitleColor }]}>{c.desc}</Text>
                </View>
                <Text style={styles.otherClassPrice}>₹{Math.round(sessionBasePrice)}</Text>
                <MaterialIcons name="chevron-right" size={20} color={subtitleColor} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Trainer Profile / Reviews Modal */}
      <TrainerReviewsPopup
        visible={showTrainerModal}
        onClose={() => setShowTrainerModal(false)}
        trainer={selectedTrainerData}
        reviews={trainerReviewsList}
        onBack={() => setShowTrainerModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    padding: 4,
    marginRight: 12,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  chooseTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  subTitleSmall: {
    fontSize: 12,
    marginTop: 4,
  },

  /* Categories */
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 14,
  },
  categoryIconBox: {
    padding: 12,
    borderRadius: 16,
  },
  categoryContent: {
    flex: 1,
    marginLeft: 14,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryDesc: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  infoNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  infoNoticeText: {
    fontSize: 11,
  },

  batchesBannerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  batchesBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchesBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  batchesBannerSub: {
    fontSize: 11,
    marginTop: 1,
  },

  /* Hero Banner */
  heroBanner: {
    height: 115,
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    marginBottom: 10,
  },
  heroBannerGradient: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
  },
  heroBannerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  heroBannerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 4,
  },
  chooseTypeHeading: {
    fontSize: 17,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },

  /* Type Option Cards */
  typeOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 12,
  },
  typeIconBox: {
    padding: 10,
    borderRadius: 12,
  },
  typeContent: {
    flex: 1,
    marginLeft: 12,
  },
  typeTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  typeSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  typePrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00BF62',
    marginTop: 4,
  },

  /* Weekly Plan */
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  planIconBox: {
    padding: 10,
    borderRadius: 14,
  },
  planBannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  planBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  planPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00BF62',
  },
  planIncludesTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  inclusionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inclusionText: {
    fontSize: 13,
  },
  validityNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,191,98,0.08)',
    padding: 12,
    borderRadius: 14,
    marginTop: 16,
  },
  validityNoticeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00BF62',
    flex: 1,
  },

  /* Custom Dates */
  customDatesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  selectedCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,191,98,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#00BF62',
  },
  selectedCalcText: {
    fontSize: 12,
  },

  /* Class Booking */
  classTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  classTypeName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  classTypeRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classTypePrice: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00BF62',
  },
  slotCategoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slotPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  slotPillText: {
    fontSize: 12,
  },

  /* Other Classes */
  otherClassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  otherClassIconBox: {
    padding: 10,
    borderRadius: 12,
  },
  otherClassPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#00BF62',
  },

  /* Bottom Bar */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  bottomPriceLabel: {
    fontSize: 11,
  },
  bottomPriceValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  continueBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#003882',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },

  /* Group Classes View */
  batchCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  batchCountBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  groupHeroBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  groupFilterScroll: {
    paddingVertical: 12,
    gap: 8,
  },
  groupFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  groupFilterChipText: {
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
  },
  errorNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 12,
    borderRadius: 14,
    marginVertical: 12,
  },
  errorNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#EF4444',
  },
  retryPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  retryPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyBatchCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 16,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyBatchTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptyBatchDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  refreshBatchesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003882',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  refreshBatchesBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  /* Listing Cards */
  sectionListCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 14,
  },
  sectionListCardFilled: {
    opacity: 0.52,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionCatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCatBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  sectionCapacityPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionCapacityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitleText: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 10,
    lineHeight: 22,
  },
  sectionTrainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  trainerAvatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  trainerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerInitials: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  trainerLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trainerName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  trainerSpecBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trainerSpecText: {
    fontSize: 11,
  },
  listQuickInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  listInfoChip: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listInfoChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  sectionFeeLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionFeeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00BF62',
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  viewDetailsBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },

  /* Detail Screen Styles */
  detailHeroBanner: {
    height: 140,
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
  detailHeroGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  detailHeroBottomContent: {
    justifyContent: 'flex-end',
  },
  detailHeroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  detailHeroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  detailCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailSectionHeading: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  detailSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  detailCapacityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailCapacityBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#00BF62',
  },
  trainerDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainerDetailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  trainerDetailAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerDetailInitials: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  trainerDetailName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  trainerDetailRole: {
    fontSize: 12,
    marginTop: 2,
  },
  trainerDetailCode: {
    fontSize: 11,
    marginTop: 2,
  },
  trainerDetailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  trainerDetailActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailScheduleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailScheduleLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailScheduleValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  detailScheduleNote: {
    fontSize: 11,
    marginTop: 2,
  },
  daysPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailDayPill: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailDayPillText: {
    fontSize: 11,
  },
  detailAboutText: {
    fontSize: 13,
    lineHeight: 18,
  },
  detailNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100,116,139,0.08)',
    padding: 12,
    borderRadius: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  detailNoticeText: {
    fontSize: 11,
    color: '#64748B',
    flex: 1,
    lineHeight: 15,
  },
  disabledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  disabledBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    textTransform: 'uppercase',
  },
  trainerSelectorSection: {
    marginTop: 20,
    marginBottom: 10,
  },
  trainerSelectorHeader: {
    marginBottom: 12,
  },
  trainerSelectorTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  trainerSelectorSub: {
    fontSize: 12,
    marginTop: 2,
  },
  trainerSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
  },
  trainerSelectName: {
    fontSize: 14,
    fontWeight: '600',
  },
  trainerSelectDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  trainerSelectFreePrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00BF62',
    marginTop: 3,
  },
  trainerSelectAddonPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00BF62',
    marginTop: 3,
  },
  trainerRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  trainerRatingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
  trainerDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  viewTrainerDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  viewTrainerDetailsText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noTrainerNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  noTrainerNoticeText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});
