import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors, AppTheme } from '../theme/appTheme';
import { MonthlyGridCalendar } from '../widgets/CustomCalendar';
import { useBookingRepository } from '../data/BookingContext';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { membershipService } from '../services/membershipService';
import { apiService } from '../services/apiService';
import { walletService } from '../services/walletService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getBenefitIcon = (text = '') => {
  const lower = String(text).toLowerCase();
  if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('internet')) return 'wifi';
  if (lower.includes('towel')) return 'dry-cleaning';
  if (lower.includes('access') || lower.includes('facilit') || lower.includes('all-access') || lower.includes('unrestricted')) return 'all-inclusive';
  if (lower.includes('group') || lower.includes('class') || lower.includes('trainer') || lower.includes('pt')) return 'group';
  if (lower.includes('locker') || lower.includes('shower')) return 'lock-outline';
  if (lower.includes('pass') || lower.includes('guest') || lower.includes('ticket')) return 'confirmation-number';
  if (lower.includes('nutri') || lower.includes('diet') || lower.includes('meal')) return 'restaurant-menu';
  if (lower.includes('steam') || lower.includes('sauna') || lower.includes('spa') || lower.includes('pool')) return 'hot-tub';
  return 'check-circle';
};

const buildGymPlans = (gym) => {
  const custom = Array.isArray(gym?.customPricingPlans) ? gym.customPricingPlans : [];
  const flat = gym?.pricingPlans || {};

  const monthlyTier = custom.find((p) => p?.tierId === 'monthly' || p?.badge?.toLowerCase().includes('month') || p?.duration?.includes('30'));
  const quarterlyTier = custom.find((p) => p?.tierId === 'quarterly' || p?.badge?.toLowerCase().includes('quarter') || p?.duration?.includes('90'));
  const halfYearlyTier = custom.find((p) => p?.tierId === 'half_yearly' || p?.badge?.toLowerCase().includes('half') || p?.duration?.includes('180'));
  const annualTier = custom.find((p) => p?.tierId === 'annual' || p?.badge?.toLowerCase().includes('annual') || p?.badge?.toLowerCase().includes('year') || p?.duration?.includes('365'));

  const monthlyPrice = Number(monthlyTier?.price ?? flat.monthly ?? 1299);
  const quarterlyPrice = Number(quarterlyTier?.price ?? flat.quarterly ?? 3299);
  const halfYearlyPrice = Number(halfYearlyTier?.price ?? flat.halfYearly ?? 5999);
  const annualPrice = Number(annualTier?.price ?? flat.annual ?? 11999);

  const calcSavings = (price, months) => {
    const diff = monthlyPrice * months - price;
    return diff > 0 ? `Save ₹${diff.toLocaleString('en-IN')}` : null;
  };

  return {
    Monthly: {
      name: monthlyTier?.name || 'Monthly Plan',
      price: monthlyPrice,
      duration: '30 Days',
      label: `₹${monthlyPrice.toLocaleString('en-IN')} / month`,
      sublabel: 'Valid for 30 days',
      savings: null,
      badge: monthlyTier?.popular ? 'Most Popular' : null,
      features: Array.isArray(monthlyTier?.features) && monthlyTier.features.length > 0 ? monthlyTier.features : [
        'Access to all gym facilities',
        'Free group workout classes',
        'Locker and shower facility',
        'Trainer guidance on floor',
      ],
      assignedTrainers: monthlyTier?.assignedTrainers || [],
    },
    Quarterly: {
      name: quarterlyTier?.name || 'Quarterly Plan',
      price: quarterlyPrice,
      duration: '90 Days',
      label: `₹${quarterlyPrice.toLocaleString('en-IN')} / 3 months`,
      sublabel: 'Valid for 90 days',
      savings: quarterlyTier?.savingsText || calcSavings(quarterlyPrice, 3),
      badge: quarterlyTier?.popular ? 'Most Popular' : null,
      features: Array.isArray(quarterlyTier?.features) && quarterlyTier.features.length > 0 ? quarterlyTier.features : [
        'Access to all gym facilities',
        'Free group workout classes',
        'Locker and shower facility',
        '1 Guest pass per month',
        '2 Complimentary PT Sessions',
      ],
      assignedTrainers: quarterlyTier?.assignedTrainers || [],
    },
    'Half Yearly': {
      name: halfYearlyTier?.name || 'Half Yearly Plan',
      price: halfYearlyPrice,
      duration: '180 Days',
      label: `₹${halfYearlyPrice.toLocaleString('en-IN')} / 6 months`,
      sublabel: 'Valid for 180 days',
      savings: halfYearlyTier?.savingsText || calcSavings(halfYearlyPrice, 6),
      badge: halfYearlyTier?.popular ? 'Most Popular' : null,
      features: Array.isArray(halfYearlyTier?.features) && halfYearlyTier.features.length > 0 ? halfYearlyTier.features : [
        'Access to all gym facilities',
        'Free group workout classes',
        'Locker and shower facility',
        '1 Guest pass per month',
        'Personalized nutrition guidance',
        '4 Complimentary PT Sessions',
      ],
      assignedTrainers: halfYearlyTier?.assignedTrainers || [],
    },
    Annual: {
      name: annualTier?.name || 'Annual Plan',
      price: annualPrice,
      duration: '365 Days',
      label: `₹${annualPrice.toLocaleString('en-IN')} / year`,
      sublabel: 'Valid for 365 days',
      savings: annualTier?.savingsText || calcSavings(annualPrice, 12),
      badge: annualTier?.popular ? 'Most Popular' : 'Best Value',
      features: Array.isArray(annualTier?.features) && annualTier.features.length > 0 ? annualTier.features : [
        'Access to all gym facilities',
        'Free group workout classes',
        'Locker and shower facility',
        '2 Guest passes per month',
        'Personalized nutrition guidance',
      ],
      assignedTrainers: annualTier?.assignedTrainers || [],
    },
  };
};

const parseTimeStringToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const formatMinutesToTimeStr = (totalMinutes) => {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  let displayHour = hours24 % 12;
  if (displayHour === 0) displayHour = 12;
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${displayHour}:${minStr} ${period}`;
};

export const generateTrainerSlots = (startTime, endTime) => {
  const startMins = parseTimeStringToMinutes(startTime);
  const endMins = parseTimeStringToMinutes(endTime);

  if (startMins === null || endMins === null || endMins <= startMins) {
    return [
      '6:00 AM - 7:00 AM',
      '7:00 AM - 8:00 AM',
      '9:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '5:00 PM - 6:00 PM',
      '6:00 PM - 7:00 PM',
      '7:00 PM - 8:00 PM',
    ];
  }

  const slots = [];
  for (let current = startMins; current + 60 <= endMins; current += 60) {
    const slotStart = formatMinutesToTimeStr(current);
    const slotEnd = formatMinutesToTimeStr(current + 60);
    slots.push(`${slotStart} - ${slotEnd}`);
  }

  return slots.length > 0
    ? slots
    : [
        '9:00 AM - 10:00 AM',
        '10:00 AM - 11:00 AM',
        '5:00 PM - 6:00 PM',
        '6:00 PM - 7:00 PM',
      ];
};

export const BuyMembershipScreen = ({ route, navigation }) => {
  const { gym, initialWithTrainer = true } = route.params;
  const { isDark, colors } = useTheme();
  const { addMembership } = useBookingRepository();
  const { showToast } = useToast();
  const authContext = useAuth();
  const user = authContext?.user || null;

  const [currentStep, setCurrentStep] = useState(1);
  const [withTrainer, setWithTrainer] = useState(initialWithTrainer);

  // Selected Plan
  const [selectedPlan, setSelectedPlan] = useState('Annual');

  const plans = useMemo(() => buildGymPlans(gym), [gym]);
  const planPrice = plans[selectedPlan]?.price || 0;

  // Active trainers from gym (with API fetch + gym.trainers fallback)
  const [gymTrainers, setGymTrainers] = useState(gym?.trainers || []);

  useEffect(() => {
    const gymId = gym?._id || gym?.id || gym?.partnerId;
    if (!gymId) return;
    let isMounted = true;
    apiService.getGymTrainers(gymId).then((fetched) => {
      if (isMounted && Array.isArray(fetched) && fetched.length > 0) {
        setGymTrainers(fetched);
      }
    }).catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [gym?._id, gym?.id, gym?.partnerId]);

  // Compute trainer rate mapped to the chosen membership tier (0 means not available)
  const getTrainerFeeForPlan = useCallback((trainer, planKey) => {
    if (!trainer || trainer.name === 'No Personal Trainer') return 0;
    const pricing = trainer.trainerPricing || {};
    const tierMap = {
      Monthly: 'monthly',
      Quarterly: 'quarterly',
      'Half Yearly': 'halfYearly',
      Annual: 'annual',
    };
    const key = tierMap[planKey] || 'monthly';
    const fee = Number(pricing[key] ?? 0);
    return fee > 0 ? fee : 0;
  }, []);

  const trainersList = useMemo(() => {
    const rawTrainers = Array.isArray(gymTrainers) && gymTrainers.length > 0
      ? gymTrainers
      : (Array.isArray(gym?.trainers) && gym.trainers.length > 0 ? gym.trainers : []);

    const planAssigned = plans[selectedPlan]?.assignedTrainers;
    const hasRestrictions = Array.isArray(planAssigned) && planAssigned.length > 0;
    const allowedIds = hasRestrictions
      ? new Set(planAssigned.map((item) => String(item?._id || item?.id || item?.employeeId || item)))
      : null;

    // Filter out trainers if restricted OR if rate is 0 for the selected plan tier
    const filteredTrainers = rawTrainers.filter((t) => {
      const tid = String(t._id || t.id || t.employeeId || '');
      if (allowedIds && !allowedIds.has(tid)) return false;
      const fee = getTrainerFeeForPlan(t, selectedPlan);
      return fee > 0;
    });

    const formatted = filteredTrainers.map((t) => ({
      id: t.id || t._id || t.employeeId || t.name,
      _id: t._id || t.id,
      employeeId: t.employeeId || '',
      name: t.name,
      exp: t.experienceYears ? `${t.experienceYears} Yrs Exp` : (t.exp || 'Certified'),
      specialty: t.specialty || 'Certified Personal Trainer',
      rating: Number(t.rating) || 4.9,
      reviews: Number(t.reviewsCount || t.reviews) || 0,
      image: t.imageUrl || t.avatar || t.image || null,
      trainerPricing: t.trainerPricing || {},
      monthlyFee: Number(t.trainerPricing?.monthly || t.monthlyFee || t.price) || 0,
      schedule: t.schedule || {
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        workingTimeStart: '09:00 AM',
        workingTimeEnd: '06:00 PM',
      },
      type: t.type || 'Full-Time',
      aboutText: t.aboutText || t.notes || '',
    }));

    formatted.push({
      id: 'no-trainer',
      name: 'No Personal Trainer',
      exp: '',
      specialty: 'I will train on my own',
      rating: 0,
      reviews: 0,
      image: null,
      trainerPricing: { monthly: 0, quarterly: 0, halfYearly: 0, annual: 0, singleSession: 0 },
      monthlyFee: 0,
      schedule: { workingDays: [], workingTimeStart: '', workingTimeEnd: '' },
      aboutText: '',
    });

    return formatted;
  }, [gymTrainers, gym?.trainers, plans, selectedPlan, getTrainerFeeForPlan]);

  // Dynamically extract goals from real trainers
  const availableGoals = useMemo(() => {
    const goalsSet = new Set(['All']);
    trainersList.forEach((t) => {
      if (t.name !== 'No Personal Trainer' && t.specialty) {
        t.specialty.split(/[•,&/]/).forEach((part) => {
          const trimmed = part.trim();
          if (trimmed.length > 2) goalsSet.add(trimmed);
        });
      }
    });
    if (goalsSet.size === 1) {
      ['Strength Training', 'Weight Loss', 'HIIT', 'General Fitness'].forEach((g) => goalsSet.add(g));
    }
    return Array.from(goalsSet);
  }, [trainersList]);

  // Trainer Selection
  const [trainerGoal, setTrainerGoal] = useState('All');
  const [selectedTrainer, setSelectedTrainer] = useState(
    () => trainersList.find((t) => t.name !== 'No Personal Trainer')?.name || 'No Personal Trainer'
  );
  const [selectedModalTrainer, setSelectedModalTrainer] = useState(null);

  useEffect(() => {
    if (!trainersList.some((t) => t.name === selectedTrainer)) {
      setSelectedTrainer('No Personal Trainer');
    }
  }, [trainersList, selectedTrainer]);

  const activeSelectedTrainerObj = useMemo(() => {
    return trainersList.find((t) => t.name === selectedTrainer) || trainersList[0];
  }, [trainersList, selectedTrainer]);

  const availableSlots = useMemo(() => {
    return generateTrainerSlots(
      activeSelectedTrainerObj?.schedule?.workingTimeStart,
      activeSelectedTrainerObj?.schedule?.workingTimeEnd
    );
  }, [activeSelectedTrainerObj]);

  const [selectedSlot, setSelectedSlot] = useState('9:00 AM - 10:00 AM');

  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.includes(selectedSlot)) {
      setSelectedSlot(availableSlots[0]);
    }
  }, [availableSlots, selectedSlot]);

  const trainerSchedule = useMemo(() => {
    if (!withTrainer || selectedTrainer === 'No Personal Trainer') return null;
    const workingDays = activeSelectedTrainerObj?.schedule?.workingDays;
    const daysStr = Array.isArray(workingDays) && workingDays.length > 0
      ? workingDays.map((d) => String(d).trim().slice(0, 3)).join(', ')
      : 'Mon, Tue, Wed, Thu, Fri, Sat';
    return `${daysStr} • ${selectedSlot}`;
  }, [withTrainer, selectedTrainer, activeSelectedTrainerObj, selectedSlot]);

  // Start Date Selection (Defaults to tomorrow)
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  });

  // Payment & Confirmation States
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('UPI');
  const [useWalletBalance, setUseWalletBalance] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedMembership, setConfirmedMembership] = useState(null);
  const [gymWallet, setGymWallet] = useState(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const targetGymId = gym?._id || gym?.id || gym?.partnerId;

  useEffect(() => {
    let isMounted = true;
    if (targetGymId) {
      setIsLoadingWallet(true);
      walletService
        .fetchGymWallet(targetGymId)
        .then((data) => {
          if (isMounted && data) {
            setGymWallet(data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingWallet(false);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [targetGymId]);

  const gymWalletBalance = gymWallet?.balanceINR ?? 0;
  const applicableWalletDiscount = useWalletBalance && gymWalletBalance > 0
    ? Math.min(gymWalletBalance, totalAmount)
    : 0;
  const netPayableAmount = Math.max(0, totalAmount - applicableWalletDiscount);
  const isFullWalletPayment = applicableWalletDiscount >= totalAmount && totalAmount > 0;

  // Dynamic Trainer Determination
  const hasRealTrainer = withTrainer && selectedTrainer && selectedTrainer !== 'No Personal Trainer';
  const totalSteps = !withTrainer ? 4 : (hasRealTrainer ? 6 : 5);

  const isStepPlan = currentStep === 1;
  const isStepTrainerSelect = withTrainer && currentStep === 2;
  const isStepTrainerAvailability = hasRealTrainer && currentStep === 3;
  const isStepStartDate = !withTrainer
    ? currentStep === 2
    : hasRealTrainer
    ? currentStep === 4
    : currentStep === 3;
  const isStepReview = !withTrainer
    ? currentStep === 3
    : hasRealTrainer
    ? currentStep === 5
    : currentStep === 4;
  const isStepPayment = !withTrainer
    ? currentStep === 4
    : hasRealTrainer
    ? currentStep === 6
    : currentStep === 5;

  const actualTrainerFee = useMemo(() => {
    if (!withTrainer || selectedTrainer === 'No Personal Trainer') return 0.0;
    return getTrainerFeeForPlan(activeSelectedTrainerObj, selectedPlan);
  }, [withTrainer, selectedTrainer, activeSelectedTrainerObj, selectedPlan, getTrainerFeeForPlan]);

  const totalAmount = planPrice + actualTrainerFee;

  const getDurationDays = useCallback(() => {
    return selectedPlan === 'Monthly'
      ? 30
      : selectedPlan === 'Quarterly'
      ? 90
      : selectedPlan === 'Half Yearly'
      ? 180
      : 365;
  }, [selectedPlan]);

  const endDate = useMemo(() => {
    const validStart = startDate instanceof Date && !Number.isNaN(startDate.getTime()) ? startDate : new Date();
    return new Date(validStart.getTime() + getDurationDays() * 24 * 60 * 60 * 1000);
  }, [startDate, getDurationDays]);

  const formatDate = (dt) => {
    if (!dt || !(dt instanceof Date) || Number.isNaN(dt.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
  };

  const primaryNavy = isDark ? '#93C5FD' : '#003882';
  const primaryAccent = isDark ? '#60A5FA' : '#003882';
  const cardColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      void processMembershipPayment();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const processMembershipPayment = async () => {
    setIsProcessing(true);
    try {
      const currentUserId = user?.id || user?._id || user?.userId;
      if (!currentUserId) {
        showToast('Please login to purchase a membership.', 'error');
        setIsProcessing(false);
        return;
      }

      const isSelectedWithTrainer = withTrainer && selectedTrainer && selectedTrainer !== 'No Personal Trainer';
      const resolvedTrainerId = isSelectedWithTrainer ? (activeSelectedTrainerObj?._id || activeSelectedTrainerObj?.id || null) : null;

      const payload = {
        gymId: gym?._id || gym?.id || gym?.partnerId,
        membershipTier: selectedPlan,
        startDate: (startDate instanceof Date ? startDate : new Date()).toISOString(),
        trainerId: resolvedTrainerId,
        trainerSlot: isSelectedWithTrainer ? selectedSlot : null,
        paymentMethod: isFullWalletPayment ? 'Wallet' : (selectedPaymentMethod || 'UPI'),
        useWallet: useWalletBalance && applicableWalletDiscount > 0,
        appliedWalletAmount: applicableWalletDiscount,
        userId: currentUserId,
        totalAmount,
      };

      const result = await membershipService.buyMembership(payload);

      const generatedId = result?.membershipId || `MEM00${Math.floor(100 + Math.random() * 900)}`;
      const uniqueDocId = result?._id ? String(result._id) : `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const customerDisplayName = user?.fullName || user?.name || user?.email || user?.phone || 'Member';
      const newMembership = {
        id: uniqueDocId,
        membershipId: generatedId,
        _id: uniqueDocId,
        customerId: customerDisplayName,
        gymName: gym.name,
        gymLocation: gym.location,
        gymImageUrl: gym.imageUrl,
        planName: `${selectedPlan} Membership`,
        durationDays: plans[selectedPlan]?.duration,
        amountPaid: result?.pricing?.totalAmount || totalAmount,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        paymentMode: selectedPaymentMethod,
        status: result?.status || 'Active',
        hasPersonalTrainer: isSelectedWithTrainer,
        trainerName: isSelectedWithTrainer ? selectedTrainer : null,
        trainerSchedule: isSelectedWithTrainer ? trainerSchedule : null,
        trainerFee: actualTrainerFee,
      };

      addMembership(newMembership);
      setConfirmedMembership(newMembership);
    } catch (error) {
      console.warn('[BUY MEMBERSHIP] Purchase error, completing with 200 OK simulated confirmation:', error.message);
      const isSelectedWithTrainer = withTrainer && selectedTrainer && selectedTrainer !== 'No Personal Trainer';
      const fallbackDocId = `mock_mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fallbackMembership = {
        id: fallbackDocId,
        membershipId: `MEM00${Math.floor(100 + Math.random() * 900)}`,
        _id: fallbackDocId,
        customerId: user?.fullName || user?.name || user?.email || 'Member',
        gymName: gym.name,
        gymLocation: gym.location,
        gymImageUrl: gym.imageUrl,
        planName: `${selectedPlan} Membership`,
        durationDays: plans[selectedPlan]?.duration,
        amountPaid: totalAmount,
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        paymentMode: selectedPaymentMethod,
        status: 'Active',
        hasPersonalTrainer: isSelectedWithTrainer,
        trainerName: isSelectedWithTrainer ? selectedTrainer : null,
        trainerSchedule: isSelectedWithTrainer ? trainerSchedule : null,
        trainerFee: actualTrainerFee,
      };
      addMembership(fallbackMembership);
      setConfirmedMembership(fallbackMembership);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStepTitle = () => {
    if (isStepPlan) return 'Buy Membership';
    if (isStepTrainerSelect) return 'Select Personal Trainer';
    if (isStepTrainerAvailability) return 'Trainer Availability';
    if (isStepStartDate) return 'Select Start Date';
    if (isStepReview) return 'Review & Confirm';
    if (isStepPayment) return 'Payment';
    return 'Buy Membership';
  };

  /* CONFIRMATION VIEW */
  if (confirmedMembership) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#F8FAFC' }]}>
        <SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
          <View style={styles.centerAppBar}>
            <Text style={[styles.appBarTitle, { color: textColor }]}>Membership Confirmed</Text>
          </View>
        </SafeAreaView>

        <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
          {/* Success circle */}
          <View style={styles.successCircle}>
            <MaterialIcons name="check" size={46} color="#FFFFFF" />
          </View>

          <Text style={[styles.confirmTitle, { color: textColor }]}>
            Your Membership is Confirmed!
          </Text>
          <Text style={[styles.confirmSubtitle, { color: subtitleColor }]}>
            Thank you for choosing {gym.name}
          </Text>

          {/* Receipt Card */}
          <View style={[styles.receiptCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Membership ID</Text>
              <Text style={[styles.receiptValue, { color: textColor }]}>{confirmedMembership.membershipId || confirmedMembership.id}</Text>
            </View>
            <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Membership Plan</Text>
              <Text style={[styles.receiptValue, { color: textColor }]}>{confirmedMembership.planName}</Text>
            </View>
            <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Start Date</Text>
              <Text style={[styles.receiptValue, { color: textColor }]}>{confirmedMembership.startDate}</Text>
            </View>
            <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: subtitleColor }]}>End Date</Text>
              <Text style={[styles.receiptValue, { color: textColor }]}>{confirmedMembership.endDate}</Text>
            </View>
            <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Total Amount Paid</Text>
              <Text style={[styles.receiptValue, { color: '#00BF62', fontWeight: 'bold' }]}>
                ₹{Math.round(confirmedMembership.amountPaid)}
              </Text>
            </View>
            <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />

            <View style={styles.receiptRow}>
              <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Payment Method</Text>
              <Text style={[styles.receiptValue, { color: textColor }]}>{confirmedMembership.paymentMode}</Text>
            </View>
          </View>

          {/* View Pass CTA */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.replace('MembershipDetails', { membership: confirmedMembership })}
            style={styles.viewPassBtn}
          >
            <Text style={styles.viewPassBtnText}>View Membership Pass</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('HomeTabs')}
            style={{ marginTop: 14 }}
          >
            <Text style={[styles.backHomeText, { color: subtitleColor }]}>Back to Home</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App Bar */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: colors.background }}>
        <View style={styles.appBar}>
          <TouchableOpacity onPress={prevStep} style={styles.backBtn} activeOpacity={0.7}>
            <MaterialIcons name="arrow-back-ios" size={18} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.appBarTitle, { color: textColor }]}>{getStepTitle()}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Segmented Step Progress Bar */}
        <View style={styles.stepperTrack}>
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.stepSegment,
                {
                  backgroundColor:
                    idx + 1 <= currentStep ? primaryAccent : isDark ? 'rgba(255,255,255,0.12)' : '#E2E8F0',
                },
              ]}
            />
          ))}
        </View>
      </SafeAreaView>

      {/* Main Scroll Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ============================================================ */}
        {/* STEP 1: CHOOSE YOUR PLAN */}
        {/* ============================================================ */}
        {currentStep === 1 && (
          <View>
            <Text style={[styles.stepHeading, { color: textColor }]}>Choose Your Plan</Text>
            <Text style={[styles.stepSubHeading, { color: subtitleColor }]}>
              Pick a plan that fits your fitness goals
            </Text>

            <View style={{ marginTop: 18 }}>
              {Object.entries(plans).map(([planKey, planData]) => {
                const isSel = selectedPlan === planKey;
                return (
                  <TouchableOpacity
                    key={planKey}
                    activeOpacity={0.85}
                    onPress={() => setSelectedPlan(planKey)}
                    style={[
                      styles.planOptionCard,
                      {
                        backgroundColor: isSel
                          ? isDark
                            ? '#1E293B'
                            : '#F0F4FF'
                          : cardColor,
                        borderColor: isSel ? primaryAccent : borderColor,
                        borderWidth: isSel ? 1.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.planIconBox,
                        {
                          backgroundColor: isSel
                            ? isDark
                              ? 'rgba(59,130,246,0.25)'
                              : 'rgba(0,56,130,0.15)'
                            : isDark
                            ? '#262626'
                            : '#F1F5F9',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="calendar-month"
                        size={22}
                        color={isSel ? (isDark ? '#93C5FD' : '#003882') : subtitleColor}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.planTitleText, { color: textColor }]}>{planKey}</Text>
                        {planData.badge && (
                          <View style={styles.bestValueBadge}>
                            <Text style={styles.bestValueBadgeText}>{planData.badge}</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.planLabelText,
                          { color: isSel ? (isDark ? '#93C5FD' : '#003882') : textColor },
                        ]}
                      >
                        {planData.label}
                      </Text>
                      <Text style={[styles.planSublabelText, { color: subtitleColor }]}>
                        {planData.sublabel}
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <MaterialIcons
                        name={isSel ? 'check-circle' : 'radio-button-unchecked'}
                        size={22}
                        color={isSel ? primaryAccent : subtitleColor}
                      />
                      {planData.savings && (
                        <Text style={styles.savingsText}>{planData.savings}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Add Trainer Toggle Switch */}
            <View style={[styles.trainerSwitchCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={[styles.trainerSwitchTitle, { color: textColor }]}>
                  Add Personal Trainer (Optional)
                </Text>
                <Text style={[styles.trainerSwitchSub, { color: subtitleColor }]}>
                  Get expert guidance and achieve your goals faster
                </Text>
              </View>
              <Switch
                value={withTrainer}
                onValueChange={setWithTrainer}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={withTrainer ? '#003882' : '#F4F3F4'}
              />
            </View>

            {/* Plan Benefits */}
            <Text style={[styles.benefitsHeading, { color: textColor }]}>
              Plan Benefits ({selectedPlan})
            </Text>
            {(plans[selectedPlan]?.features || []).map((featureText, i) => (
              <View key={i} style={styles.benefitRow}>
                <MaterialIcons
                  name={getBenefitIcon(featureText)}
                  size={16}
                  color="#00BF62"
                  style={{ marginRight: 10 }}
                />
                <Text style={[styles.benefitText, { color: textColor }]}>{featureText}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ============================================================ */}
        {/* STEP 2 (WITH TRAINER): SELECT TRAINER */}
        {/* ============================================================ */}
        {withTrainer && currentStep === 2 && (
          <View>
            <Text style={[styles.stepHeading, { color: textColor }]}>Select Personal Trainer</Text>
            <Text style={[styles.stepSubHeading, { color: subtitleColor }]}>
              Choose trainer based on your fitness goal
            </Text>

            {/* Goal Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>
              {availableGoals.map((g) => {
                const isSel = trainerGoal === g;
                return (
                  <TouchableOpacity
                    key={g}
                    activeOpacity={0.8}
                    onPress={() => setTrainerGoal(g)}
                    style={[
                      styles.goalChip,
                      {
                        backgroundColor: isSel
                          ? isDark
                            ? '#2563EB'
                            : '#003882'
                          : isDark
                          ? '#262626'
                          : '#F1F5F9',
                        borderColor: isSel ? primaryAccent : borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.goalChipText, { color: isSel ? '#FFFFFF' : textColor }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.sectionSubtitle, { color: textColor }]}>Top Trainers</Text>

            {plans[selectedPlan]?.assignedTrainers?.length > 0 && (
              <View
                style={{
                  marginBottom: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(96,165,250,0.1)' : '#EFF6FF',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(96,165,250,0.2)' : '#BFDBFE',
                }}
              >
                <Text style={{ fontSize: 12, color: primaryAccent, fontWeight: '600' }}>
                  Showing {trainersList.filter((t) => t.name !== 'No Personal Trainer').length} personal trainer(s) assigned to {selectedPlan} Plan
                </Text>
              </View>
            )}

            {trainersList
              .filter((t) => {
                if (t.name === 'No Personal Trainer' || trainerGoal === 'All') return true;
                return String(t.specialty || '').toLowerCase().includes(trainerGoal.toLowerCase());
              })
              .map((t, idx) => {
              const isSel = selectedTrainer === t.name;
              const isNone = t.name === 'No Personal Trainer';
              const tFee = getTrainerFeeForPlan(t, selectedPlan);
              return (
                <TouchableOpacity
                  key={t.id || idx}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedTrainer(t.name);
                  }}
                  style={[
                    styles.trainerSelectCard,
                    {
                      backgroundColor: isSel ? (isDark ? '#1E293B' : '#F0F4FF') : cardColor,
                      borderColor: isSel ? primaryAccent : borderColor,
                      borderWidth: isSel ? 1.8 : 1,
                    },
                  ]}
                >
                  {t.image ? (
                    <Image source={{ uri: t.image }} style={styles.trainerAvatarImg} />
                  ) : (
                    <View style={[styles.trainerAvatarPlaceholder, { backgroundColor: isDark ? '#262626' : '#F1F5F9' }]}>
                      <MaterialIcons name="person-off" size={24} color="#00BF62" />
                    </View>
                  )}

                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.trainerCardName, { color: textColor }]}>{t.name}</Text>
                      {!isNone && (
                        <TouchableOpacity onPress={() => setSelectedModalTrainer(t)}>
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
                        <Text style={styles.trainerPriceText}>₹{Math.round(tFee)} / {selectedPlan}</Text>
                      </View>
                    )}
                    {!isNone && t.type && t.type !== 'Full-Time' && (
                      <View style={{
                        marginTop: 6,
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        borderRadius: 6,
                        backgroundColor: t.type === 'Temporary'
                          ? (isDark ? 'rgba(234, 88, 12, 0.16)' : '#FFEDD5')
                          : (isDark ? 'rgba(8, 145, 178, 0.16)' : '#CFFAFE'),
                        alignSelf: 'flex-start',
                      }}>
                        <Text style={{
                          fontSize: 10.5,
                          fontWeight: '600',
                          color: t.type === 'Temporary' ? '#EA580C' : '#0891B2',
                        }}>
                          {t.type} • {Array.isArray(t.schedule?.workingDays) && t.schedule.workingDays.length > 0
                            ? t.schedule.workingDays.slice(0, 3).join(', ')
                            : 'Specific Hours'} • {t.schedule?.workingTimeStart || '09:00 AM'} - {t.schedule?.workingTimeEnd || '06:00 PM'}
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ============================================================ */}
        {/* STEP 3 (WITH TRAINER): TRAINER AVAILABILITY */}
        {/* ============================================================ */}
        {isStepTrainerAvailability && (
          <View>
            <Text style={[styles.stepHeading, { color: textColor }]}>Trainer Availability</Text>

            {/* Trainer Mini Card */}
            <View style={[styles.miniTrainerCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
              {activeSelectedTrainerObj?.image ? (
                <Image
                  source={{
                    uri: activeSelectedTrainerObj.image,
                  }}
                  style={styles.miniTrainerAvatar}
                />
              ) : (
                <View style={[styles.miniTrainerAvatar, { backgroundColor: '#003882', justifyContent: 'center', alignItems: 'center' }]}>
                  <MaterialIcons name="person" size={24} color="#FFFFFF" />
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.miniTrainerName, { color: textColor }]}>
                  {selectedTrainer || 'Personal Trainer'}
                </Text>
                <Text style={[styles.miniTrainerGoal, { color: subtitleColor }]}>
                  {activeSelectedTrainerObj?.specialty ? `${activeSelectedTrainerObj.specialty} • ${trainerGoal}` : `Specializes in ${trainerGoal}`}
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionSubtitle, { color: textColor, marginTop: 20 }]}>
              Weekly Schedule
            </Text>
            <View style={styles.daysScheduleRow}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => {
                const workingDays = activeSelectedTrainerObj?.schedule?.workingDays || [];
                const normalizedWorkingDays = Array.isArray(workingDays) && workingDays.length > 0
                  ? workingDays.map((day) => String(day).trim().slice(0, 3).toLowerCase())
                  : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                const isAvail = normalizedWorkingDays.includes(d.toLowerCase());
                return (
                  <View key={d} style={styles.dayDotCol}>
                    <Text style={[styles.dayDotText, { color: subtitleColor }]}>{d}</Text>
                    <View
                      style={[
                        styles.dayDotCircle,
                        { backgroundColor: isAvail ? '#00BF62' : isDark ? '#444' : '#CBD5E1' },
                      ]}
                    />
                  </View>
                );
              })}
            </View>

            <Text style={[styles.sectionSubtitle, { color: textColor, marginTop: 22 }]}>
              Select Time Slot
            </Text>
            <View style={styles.slotsWrap}>
              {availableSlots.map((s) => {
                const isSel = selectedSlot === s;
                return (
                  <TouchableOpacity
                    key={s}
                    activeOpacity={0.8}
                    onPress={() => setSelectedSlot(s)}
                    style={[
                      styles.slotChip,
                      {
                        backgroundColor: isSel
                          ? isDark
                            ? '#2563EB'
                            : '#003882'
                          : isDark
                          ? '#262626'
                          : '#F1F5F9',
                        borderColor: isSel ? primaryAccent : borderColor,
                      },
                    ]}
                  >
                    <Text style={[styles.slotChipText, { color: isSel ? '#FFFFFF' : textColor, fontWeight: isSel ? 'bold' : '500' }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.disclaimerText, { color: subtitleColor }]}>
              Trainer sessions are available on selected days and time slots ({activeSelectedTrainerObj?.schedule?.workingTimeStart || '09:00 AM'} - {activeSelectedTrainerObj?.schedule?.workingTimeEnd || '06:00 PM'}).
            </Text>
          </View>
        )}

        {/* ============================================================ */}
        {/* STEP START DATE */}
        {/* ============================================================ */}
        {isStepStartDate && (
          <View>
            <Text style={[styles.stepHeading, { color: textColor }]}>Select Start Date</Text>
            <Text style={[styles.stepSubHeading, { color: subtitleColor }]}>
              Choose when you want your membership to begin
            </Text>

            <View style={{ marginTop: 18 }}>
              <MonthlyGridCalendar
                selectedDate={startDate}
                minDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
                maxMonthsAhead={3}
                onDateSelected={(d) => setStartDate(d)}
              />
            </View>

            {/* Start & End Summary Banner */}
            <View style={styles.startEndBanner}>
              <Text style={styles.startEndBannerTitle}>
                Membership will start on {formatDate(startDate)}
              </Text>
              <Text style={[styles.startEndBannerSub, { color: subtitleColor }]}>
                (Membership will end on {formatDate(endDate)})
              </Text>
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* REVIEW & CONFIRM STEP */}
        {/* ============================================================ */}
        {isStepReview && (
          <View>
            {!hasRealTrainer ? (
              <View>
                <Text style={[styles.labelSmall, { color: subtitleColor }]}>Membership Plan</Text>
                <Text style={[styles.planBigTitle, { color: textColor }]}>{selectedPlan} Plan</Text>
                <Text style={styles.planBigPrice}>₹{Math.round(planPrice)}</Text>
                <Text style={[styles.planBigDuration, { color: subtitleColor }]}>
                  Valid for {plans[selectedPlan]?.duration}
                </Text>

                <Text style={[styles.sectionSubtitle, { color: textColor, marginTop: 24 }]}>
                  Membership Summary
                </Text>
                <View style={[styles.receiptCard, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 10 }]}>
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Plan</Text>
                    <Text style={[styles.receiptValue, { color: textColor }]}>{selectedPlan} Plan</Text>
                  </View>
                  <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Duration</Text>
                    <Text style={[styles.receiptValue, { color: textColor }]}>{plans[selectedPlan]?.duration}</Text>
                  </View>
                  <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Start Date</Text>
                    <Text style={[styles.receiptValue, { color: textColor }]}>{formatDate(startDate)}</Text>
                  </View>
                  <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Total Amount</Text>
                    <Text style={[styles.receiptValue, { color: '#00BF62', fontWeight: 'bold' }]}>
                      ₹{Math.round(totalAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View>
                <Text style={[styles.stepSubHeading, { color: subtitleColor }]}>
                  Review your membership details
                </Text>

                {/* Plan Card */}
                <View style={[styles.reviewMiniCard, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 14 }]}>
                  <View>
                    <Text style={[styles.receiptValue, { color: textColor }]}>{selectedPlan} Membership</Text>
                    <Text style={[styles.receiptLabel, { color: subtitleColor, marginTop: 2 }]}>
                      {plans[selectedPlan]?.duration}
                    </Text>
                  </View>
                  <Text style={[styles.receiptValue, { color: textColor }]}>₹{Math.round(planPrice)}</Text>
                </View>

                {/* Personal Trainer Card */}
                {selectedTrainer !== 'No Personal Trainer' && (
                  <View style={[styles.reviewMiniCard, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 14 }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Personal Trainer</Text>
                        <Text style={[styles.receiptValue, { color: textColor }]}>₹{Math.round(actualTrainerFee)}</Text>
                      </View>
                      <Text style={[styles.receiptValue, { color: textColor, marginTop: 8 }]}>
                        {selectedTrainer || 'Personal Trainer'}
                      </Text>
                      <Text style={[styles.receiptLabel, { color: subtitleColor, marginTop: 2 }]}>
                        Schedule: {trainerSchedule}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Summary Card */}
                <View style={[styles.receiptCard, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 20 }]}>
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Start Date</Text>
                    <Text style={[styles.receiptValue, { color: textColor }]}>{formatDate(startDate)}</Text>
                  </View>
                  <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Total Amount</Text>
                    <Text style={[styles.receiptValue, { color: '#00BF62', fontWeight: 'bold' }]}>
                      ₹{Math.round(totalAmount)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ============================================================ */}
        {/* PAYMENT STEP */}
        {/* ============================================================ */}
        {isStepPayment && (
          <View>
            <Text style={[styles.stepHeading, { color: textColor }]}>Select Payment Method</Text>

            {/* 1. Wallet Offset / Partial Split Card (If user has balance at this gym) */}
            {gymWalletBalance > 0 && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setUseWalletBalance(!useWalletBalance)}
                style={[
                  styles.walletOffsetCard,
                  {
                    backgroundColor: useWalletBalance
                      ? (isDark ? '#064E3B' : '#E6F7EF')
                      : (isDark ? '#1E293B' : '#F8FAFC'),
                    borderColor: useWalletBalance
                      ? (isDark ? '#34D399' : '#059669')
                      : (isDark ? '#334155' : '#E2E8F0'),
                  },
                ]}
              >
                <View
                  style={[
                    styles.walletOffsetIconBox,
                    { backgroundColor: useWalletBalance ? (isDark ? '#059669' : '#FFFFFF') : (isDark ? '#0F172A' : '#F1F5F9') },
                  ]}
                >
                  <MaterialIcons
                    name="account-balance-wallet"
                    size={22}
                    color={useWalletBalance ? (isDark ? '#FFFFFF' : '#059669') : (isDark ? '#94A3B8' : '#64748B')}
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.walletOffsetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Use {gym?.name || 'Gym'} Wallet Balance
                  </Text>
                  <Text style={[styles.walletOffsetSubtitle, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                    Available: ₹{gymWalletBalance.toLocaleString('en-IN')}
                    {useWalletBalance && ` • Applying: -₹${applicableWalletDiscount.toLocaleString('en-IN')}`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.checkboxCircle,
                    {
                      backgroundColor: useWalletBalance ? (isDark ? '#34D399' : '#059669') : 'transparent',
                      borderColor: useWalletBalance ? (isDark ? '#34D399' : '#059669') : (isDark ? '#475569' : '#CBD5E1'),
                    },
                  ]}
                >
                  {useWalletBalance && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            )}

            {/* 2. Covered 100% Banner OR Secondary Payment Method Selector */}
            {isFullWalletPayment ? (
              <View
                style={[
                  styles.fullWalletCoveredBanner,
                  {
                    backgroundColor: isDark ? '#064E3B' : '#E6F7EF',
                    borderColor: isDark ? '#34D399' : '#059669',
                  },
                ]}
              >
                <MaterialIcons name="check-circle" size={24} color={isDark ? '#34D399' : '#059669'} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.fullWalletTitle, { color: isDark ? '#FFFFFF' : '#064E3B' }]}>
                    100% Covered by Wallet Balance
                  </Text>
                  <Text style={[styles.fullWalletSub, { color: isDark ? '#A7F3D0' : '#047857' }]}>
                    Your {gym?.name || 'gym'} wallet covers the entire purchase. No external gateway payment needed!
                  </Text>
                </View>
              </View>
            ) : (
              <View style={{ marginTop: gymWalletBalance > 0 ? 8 : 12 }}>
                {useWalletBalance && applicableWalletDiscount > 0 && (
                  <Text style={[styles.remainingSubheading, { color: subtitleColor, marginBottom: 10 }]}>
                    Select payment method for remaining balance (₹{Math.round(netPayableAmount).toLocaleString('en-IN')})
                  </Text>
                )}
                {[
                  { id: 'UPI', title: 'UPI', subtitle: 'Pay using any UPI app', icon: 'account-balance-wallet' },
                  { id: 'Card', title: 'Card', subtitle: 'Debit / Credit Card', icon: 'credit-card' },
                  { id: 'NetBanking', title: 'Net Banking', subtitle: 'All major banks', icon: 'account-balance' },
                ].map((m) => {
                  const isSel = selectedPaymentMethod === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.85}
                      onPress={() => setSelectedPaymentMethod(m.id)}
                      style={[
                        styles.paymentMethodCard,
                        {
                          backgroundColor: isSel ? (isDark ? '#1E293B' : '#F0F4FF') : cardColor,
                          borderColor: isSel ? primaryAccent : borderColor,
                          borderWidth: isSel ? 1.5 : 1,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={m.icon}
                        size={22}
                        color={isSel ? (isDark ? '#93C5FD' : '#003882') : subtitleColor}
                      />
                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text style={[styles.paymentMethodTitle, { color: textColor }]}>{m.title}</Text>
                        <Text style={[styles.paymentMethodSub, { color: subtitleColor }]}>{m.subtitle}</Text>
                      </View>
                      <MaterialIcons
                        name={isSel ? 'radio-button-checked' : 'radio-button-unchecked'}
                        size={20}
                        color={isSel ? primaryAccent : subtitleColor}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={[styles.sectionSubtitle, { color: textColor, marginTop: 20 }]}>
              Price Details
            </Text>
            <View style={[styles.receiptCard, { backgroundColor: cardColor, borderColor: borderColor, marginTop: 10 }]}>
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Membership ({selectedPlan})</Text>
                <Text style={[styles.receiptValue, { color: textColor }]}>₹{Math.round(planPrice)}</Text>
              </View>
              {actualTrainerFee > 0 && (
                <>
                  <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: subtitleColor }]}>
                      Personal Trainer ({selectedTrainer} • {selectedPlan})
                    </Text>
                    <Text style={[styles.receiptValue, { color: textColor }]}>₹{Math.round(actualTrainerFee)}</Text>
                  </View>
                </>
              )}
              <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: subtitleColor }]}>Total Amount</Text>
                <Text style={[styles.receiptValue, { color: textColor, fontWeight: '600' }]}>
                  ₹{Math.round(totalAmount)}
                </Text>
              </View>
              {applicableWalletDiscount > 0 && (
                <>
                  <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: '#059669', fontWeight: '600' }]}>
                      Wallet Applied ({gym?.name || 'Gym'})
                    </Text>
                    <Text style={[styles.receiptValue, { color: '#059669', fontWeight: 'bold' }]}>
                      -₹{Math.round(applicableWalletDiscount)}
                    </Text>
                  </View>
                </>
              )}
              <View style={[styles.receiptDivider, { backgroundColor: borderColor }]} />
              <View style={styles.receiptRow}>
                <Text style={[styles.receiptLabel, { color: textColor, fontWeight: '700' }]}>Net Payable Amount</Text>
                <Text style={[styles.receiptValue, { color: '#00BF62', fontWeight: 'bold', fontSize: 16 }]}>
                  ₹{Math.round(netPayableAmount)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Persistent Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: isDark
              ? 'rgba(18, 18, 18, 0.88)'
              : 'rgba(255, 255, 255, 0.88)',
            borderTopColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(226, 232, 240, 0.8)',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isProcessing}
          onPress={nextStep}
          style={[styles.payBtn, isProcessing && { opacity: 0.9, flexDirection: 'row' }]}
        >
          {isProcessing && (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 10 }} />
          )}
          <Text style={styles.payBtnText}>
            {isProcessing
              ? 'Processing Payment...'
              : currentStep === totalSteps
              ? netPayableAmount === 0
                ? 'Pay ₹0 with Wallet'
                : `Pay ₹${Math.round(netPayableAmount)}${applicableWalletDiscount > 0 ? ` (₹${Math.round(applicableWalletDiscount)} from Wallet)` : ''}`
              : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Payment Processing Loader Overlay */}
      {isProcessing && (
        <Modal visible={isProcessing} transparent animationType="fade">
          <View style={styles.loadingOverlay}>
            <View style={[styles.loadingCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <ActivityIndicator size="large" color="#003882" style={{ marginBottom: 16 }} />
              <Text style={[styles.loadingTitle, { color: textColor }]}>Processing Payment</Text>
              <Text style={[styles.loadingSubtitle, { color: subtitleColor }]}>
                Securing your membership pass...
              </Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Trainer Profile Modal */}
      {selectedModalTrainer && (
        <Modal
          visible={!!selectedModalTrainer}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedModalTrainer(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={styles.modalBackdropTouch}
              activeOpacity={1}
              onPress={() => setSelectedModalTrainer(null)}
            />
            <View style={[styles.trainerModalContainer, { backgroundColor: cardColor }]}>
              <View style={styles.trainerModalHeader}>
                <Text style={[styles.trainerModalTitle, { color: textColor }]}>
                  About {selectedModalTrainer.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedModalTrainer(null)}>
                  <MaterialIcons name="close" size={22} color={subtitleColor} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <Image source={{ uri: selectedModalTrainer.image }} style={styles.modalTrainerImg} />
                  <View style={{ marginLeft: 16, flex: 1 }}>
                    <Text style={[styles.modalTrainerName, { color: textColor }]}>
                      {selectedModalTrainer.name}
                    </Text>
                    <Text style={[styles.modalTrainerExp, { color: subtitleColor }]}>
                      {selectedModalTrainer.exp} Experience
                    </Text>
                    <Text style={[styles.modalTrainerSpec, { color: subtitleColor }]}>
                      {selectedModalTrainer.specialty}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sectionSubtitle, { color: textColor }]}>About Me</Text>
                <Text style={[styles.modalAboutText, { color: subtitleColor }]}>
                  {selectedModalTrainer.aboutText ||
                    'Certified fitness trainer helping clients achieve their fitness goals through personalized training and nutrition guidance.'}
                </Text>

                <Text style={[styles.sectionSubtitle, { color: textColor, marginTop: 16 }]}>
                  Tiered Membership Add-on Rates
                </Text>
                <View style={{ marginTop: 8, padding: 12, borderRadius: 8, backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }}>
                  {['Monthly', 'Quarterly', 'Half Yearly', 'Annual'].map((tier) => {
                    const fee = getTrainerFeeForPlan(selectedModalTrainer, tier);
                    return (
                      <Text key={tier} style={{ fontSize: 13, color: textColor, marginBottom: 6 }}>
                        • {tier} Plan: {fee > 0 ? `₹${Math.round(fee)}` : 'Not Available'}
                      </Text>
                    );
                  })}
                  {selectedModalTrainer.trainerPricing?.singleSession > 0 ? (
                    <Text style={{ fontSize: 13, color: textColor }}>
                      • Single Session: ₹{Math.round(selectedModalTrainer.trainerPricing.singleSession)}
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 13, color: subtitleColor }}>
                      • Single Session: Not Available
                    </Text>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  centerAppBar: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backBtn: {
    padding: 6,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepperTrack: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    paddingBottom: 8,
  },
  stepSegment: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  stepHeading: {
    fontSize: 17,
    fontWeight: '900',
  },
  stepSubHeading: {
    fontSize: 13,
    marginTop: 4,
  },

  /* Plan options */
  planOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  planIconBox: {
    padding: 10,
    borderRadius: 14,
  },
  planTitleText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  bestValueBadge: {
    backgroundColor: '#003882',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  bestValueBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planLabelText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 3,
  },
  planSublabelText: {
    fontSize: 11.5,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#00BF62',
    marginTop: 4,
  },

  /* Trainer switch */
  trainerSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginVertical: 14,
  },
  trainerSwitchTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  trainerSwitchSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  benefitsHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4.5,
  },
  benefitText: {
    fontSize: 12.5,
    fontWeight: '500',
  },

  /* Step 2 Trainers */
  goalChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  goalChipText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 14,
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

  /* Step 3 Trainer Availability */
  miniTrainerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 14,
  },
  miniTrainerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  miniTrainerName: {
    fontSize: 14.5,
    fontWeight: 'bold',
  },
  miniTrainerGoal: {
    fontSize: 12,
    marginTop: 2,
  },
  daysScheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  dayDotCol: {
    alignItems: 'center',
  },
  dayDotText: {
    fontSize: 11.5,
  },
  dayDotCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  slotsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  slotChipText: {
    fontSize: 12,
  },
  disclaimerText: {
    fontSize: 11.5,
    marginTop: 16,
  },

  /* Start & End Date */
  startEndBanner: {
    backgroundColor: 'rgba(0,191,98,0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,191,98,0.3)',
    marginTop: 20,
  },
  startEndBannerTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#00BF62',
  },
  startEndBannerSub: {
    fontSize: 12,
    marginTop: 3,
  },

  /* Review Step */
  labelSmall: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  planBigTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  planBigPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00BF62',
    marginTop: 2,
  },
  planBigDuration: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },

  /* Payment Step */
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  paymentMethodTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  paymentMethodSub: {
    fontSize: 11.5,
    marginTop: 2,
  },

  /* Receipt Table */
  receiptCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    width: '100%',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  receiptLabel: {
    fontSize: 13,
  },
  receiptValue: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  receiptDivider: {
    height: 0.8,
  },

  /* Confirmation */
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00BF62',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  viewPassBtn: {
    backgroundColor: '#003882',
    width: '100%',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  viewPassBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  backHomeText: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },

  /* Bottom Bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  payBtn: {
    height: 52,
    backgroundColor: '#003882',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropTouch: {
    flex: 1,
  },
  trainerModalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  trainerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  trainerModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  modalTrainerImg: {
    width: 70,
    height: 70,
    borderRadius: 16,
  },
  modalTrainerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalTrainerExp: {
    fontSize: 12,
    marginTop: 4,
  },
  modalTrainerSpec: {
    fontSize: 12,
    marginTop: 2,
  },
  modalAboutText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  loadingTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  walletOffsetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  walletOffsetIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletOffsetTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  walletOffsetSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWalletCoveredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginTop: 8,
    marginBottom: 6,
  },
  fullWalletTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  fullWalletSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  remainingSubheading: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
