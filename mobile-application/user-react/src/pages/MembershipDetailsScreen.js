import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors, AppTheme } from '../theme/appTheme';
import { DigitalQrPassCard } from '../widgets/DigitalQrPassCard';
import { useBookingRepository } from '../data/BookingContext';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { calculateMembershipProgress } from '../utils/dateUtils';
import { membershipService } from '../services/membershipService';
import { apiService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

const SmoothGradientStar = ({
  size = 24,
  filled = true,
  id = 'star',
  isDark = false,
  style,
}) => {
  const gradientId = `smoothStarGrad-${id}`;
  const inactiveStroke = isDark ? '#475569' : '#CBD5E1';
  const inactiveFill = isDark ? 'rgba(71, 85, 105, 0.15)' : 'rgba(203, 213, 225, 0.25)';

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFE066" stopOpacity="1" />
            <Stop offset="40%" stopColor="#FFAA00" stopOpacity="1" />
            <Stop offset="100%" stopColor="#FF6F00" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d="M12 2.9C12.3 2.9 12.56 3.08 12.7 3.35L14.98 7.97C15.12 8.26 15.39 8.46 15.71 8.51L20.81 9.25C21.43 9.34 21.68 10.11 21.23 10.55L17.54 14.15C17.31 14.37 17.2 14.7 17.26 15.02L18.13 20.09C18.24 20.71 17.58 21.19 17.03 20.9L12.47 18.5C12.18 18.35 11.82 18.35 11.53 18.5L6.97 20.9C6.42 21.19 5.76 20.71 5.87 20.09L6.74 15.02C6.8 14.7 6.69 14.37 6.46 14.15L2.77 10.55C2.32 10.11 2.57 9.34 3.19 9.25L8.29 8.51C8.61 8.46 8.88 8.26 9.02 7.97L11.3 3.35C11.44 3.08 11.7 2.9 12 2.9Z"
          fill={filled ? `url(#${gradientId})` : inactiveFill}
          stroke={filled ? `url(#${gradientId})` : inactiveStroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const QuillWriteIcon = ({ size = 18, color = '#64748B', style }) => (
  <View style={style}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19.07 4.93a5.5 5.5 0 0 0-7.78 0L3 13.22V21h7.78l8.29-8.29a5.5 5.5 0 0 0 0-7.78z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 9l-9 9"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 5l3 3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const SadIcon = ({ size = 18, color = '#64748B', style }) => (
  <View style={style}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 16c-.8-1.2-2.2-2-4-2s-3.2.8-4 2"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 9h.01M15 9h.01"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const SendIcon = ({ size = 18, color = '#FFFFFF', style }) => (
  <View style={style}>
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22 2L11 13"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M22 2L15 22L11 13L2 9L22 2z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  </View>
);

const CANCEL_REASONS = [
  'Relocating / Moving away',
  'Medical reasons / Injury',
  'Financial constraints',
  'Dissatisfied with facilities',
  'Other',
];

const resolvePlanDescription = (mbr) => {
  if (mbr?.planDescription && typeof mbr.planDescription === 'string' && mbr.planDescription.trim()) {
    return mbr.planDescription.trim();
  }
  const gym = mbr?.gym || mbr?.gymId;
  const tier = mbr?.membershipTier || mbr?.planName?.replace(/ Membership$/i, '') || '';
  if (gym && tier) {
    const tierClean = String(tier).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (Array.isArray(gym.customPricingPlans) && gym.customPricingPlans.length > 0) {
      const match = gym.customPricingPlans.find((p) => {
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
      if (match?.description && match.description.trim()) {
        return match.description.trim();
      }
    }
    if (gym.pricingPlans) {
      const directMatch = gym.pricingPlans[tierClean] || gym.pricingPlans[tier];
      if (typeof directMatch === 'object' && directMatch?.description) {
        return directMatch.description.trim();
      }
    }
  }
  return 'Enjoy unlimited access to all gym facilities during your membership period.';
};

const getPlanActionConfig = (tierOrName) => {
  const t = String(tierOrName || '').toLowerCase();
  if (t.includes('month')) {
    return {
      label: 'Upgrade Plan',
      icon: 'arrow-circle-up',
    };
  }
  if (t.includes('quarter') || t.includes('half')) {
    return {
      label: 'Change Plan',
      icon: 'sync-alt',
    };
  }
  if (t.includes('annual') || t.includes('year')) {
    return {
      label: 'Downgrade Plan',
      icon: 'arrow-circle-down',
    };
  }
  return {
    label: 'Upgrade Plan',
    icon: 'arrow-circle-up',
  };
};

const getAvailableSwitchPlans = (gym, currentTier) => {
  const currentTierClean = String(currentTier || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  if (Array.isArray(gym?.customPricingPlans) && gym.customPricingPlans.length > 0) {
    const customFiltered = gym.customPricingPlans.filter((p) => {
      const pTierClean = String(p.tierId || p.badge || p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return pTierClean !== currentTierClean;
    });
    if (customFiltered.length > 0) {
      return customFiltered.map((p) => ({
        tierId: p.tierId || p.name,
        planId: p.id || p.tierId,
        name: p.name || `${p.tierId} Plan`,
        badge: p.badge || p.name,
        price: p.price,
        durationDays: p.durationDays || (p.months ? p.months * 30 : 30),
        duration: p.duration || `${p.durationDays || 30} Days`,
        description: p.description || '',
      }));
    }
  }

  const standardTiers = [
    { tierId: 'Monthly', planId: 'plan-monthly', name: 'Monthly Plan', badge: 'Monthly', price: Number(gym?.pricingPlans?.monthly) || 0, durationDays: 30, duration: '30 Days', description: 'Standard 30-day recurring membership.' },
    { tierId: 'Quarterly', planId: 'plan-quarterly', name: 'Quarterly Plan', badge: 'Quarterly', price: Number(gym?.pricingPlans?.quarterly) || 0, durationDays: 90, duration: '90 Days', description: '3-month structured fitness package.' },
    { tierId: 'Half Yearly', planId: 'plan-half-yearly', name: 'Half Yearly Plan', badge: 'Half Yearly', price: Number(gym?.pricingPlans?.halfYearly) || 0, durationDays: 180, duration: '180 Days', description: '6-month transformation package.' },
    { tierId: 'Annual', planId: 'plan-annual', name: 'Annual VIP Plan', badge: 'Annual', price: Number(gym?.pricingPlans?.annual) || 0, durationDays: 365, duration: '365 Days', description: 'All-inclusive annual membership with priority perks.' },
  ];

  return standardTiers.filter((p) => {
    const pTierClean = String(p.tierId).toLowerCase().replace(/[^a-z0-9]/g, '');
    return pTierClean !== currentTierClean && p.price > 0;
  });
};

export const MembershipDetailsScreen = ({ route, navigation }) => {
  const { membership: initialMbr } = route.params;
  const { isDark, colors } = useTheme();
  const { memberships, cancelMembership, updateMembership } = useBookingRepository();
  const { showToast } = useToast();
  const { user } = useAuth();

  const membership =
    memberships.find(
      (m) =>
        (m._id && initialMbr._id && String(m._id) === String(initialMbr._id)) ||
        (m.id && initialMbr.id && String(m.id) === String(initialMbr.id))
    ) || initialMbr;

  const { daysRemaining } = calculateMembershipProgress(membership);

  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0]);
  const [cancellationNegotiation, setCancellationNegotiation] = useState(null);

  useEffect(() => {
    let active = true;
    const membershipKey = String(membership._id || membership.id || '');
    const loadCancellationNegotiation = async () => {
      try {
        const negotiations = await membershipService.fetchMyCancellationNegotiations();
        const membershipKey = String(membership._id || membership.id || '');
        const current = negotiations.find((item) => {
          const negotiationMembershipId =
            typeof item.membershipId === 'object'
              ? item.membershipId._id || item.membershipId.id || item.membershipId.membershipId
              : item.membershipId;
          return String(negotiationMembershipId) === membershipKey && item.status !== 'CANCELLED_BY_USER';
        });
        if (active) setCancellationNegotiation(current || null);
      } catch (error) {
        console.warn('[CANCELLATION NEGOTIATION]', error.message);
      }
    };
    if (membershipKey) loadCancellationNegotiation();
    const refreshInterval = membershipKey ? setInterval(loadCancellationNegotiation, 5000) : null;
    return () => {
      active = false;
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [membership._id, membership.id, membership.status]);

  // Plan Switch & Proration States
  const [showSwitchSheet, setShowSwitchSheet] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedTargetPlan, setSelectedTargetPlan] = useState(null);
  const [switchQuote, setSwitchQuote] = useState(null);
  const [downgradeOption, setDowngradeOption] = useState('WALLET'); // 'WALLET' | 'REFUND' | 'EXTEND'
  const [quoteError, setQuoteError] = useState(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [isSubmittingSwitch, setIsSubmittingSwitch] = useState(false);
  const [pendingSwitchRequest, setPendingSwitchRequest] = useState(null);

  // Rating & Review State
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [gymRating, setGymRating] = useState(membership.userRating || 5);
  const [gymComment, setGymComment] = useState('');
  const [trainerRating, setTrainerRating] = useState(5);
  const [trainerComment, setTrainerComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [hasRatedGym, setHasRatedGym] = useState(
    Boolean(membership.hasRatedGym || membership.userRating)
  );
  const [hasRatedTrainer, setHasRatedTrainer] = useState(false);
  const [activeRatingTab, setActiveRatingTab] = useState('GYM'); // 'GYM' | 'TRAINER'

  const hasPersonalTrainer = Boolean(
    membership.hasPersonalTrainer ||
    (typeof membership.trainerName === 'string' &&
      membership.trainerName.trim().length > 0 &&
      membership.trainerName.toLowerCase() !== 'not selected')
  );
  const trainerName = membership.trainerName || 'Assigned Personal Trainer';
  const gymIdentifier =
    membership.gym?.partnerId ||
    membership.gym?._id ||
    membership.gymId ||
    membership.gym?.id ||
    membership.gymName ||
    'gym';
  const trainerIdentifier = membership.trainerId || membership.trainerName || 'trainer';

  const getRatingLabel = (stars) => {
    switch (stars) {
      case 1:
        return 'Poor';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Very Good';
      case 5:
        return 'Excellent!';
      default:
        return '';
    }
  };

  const handleSubmitRatings = async () => {
    if (!gymRating || gymRating < 1) {
      showToast({ message: 'Please select a star rating for the gym.', isError: true });
      return;
    }

    try {
      setIsSubmittingRating(true);

      // 1. Submit Gym Rating & Review
      await apiService.submitGymRating(gymIdentifier, {
        rating: Number(gymRating),
        comment: gymComment.trim(),
        bookingType: membership.planName || 'Member',
      });
      setHasRatedGym(true);

      // 2. Submit Trainer Rating & Review (if applicable)
      if (hasPersonalTrainer && trainerRating > 0) {
        await apiService.submitTrainerRating(gymIdentifier, trainerIdentifier, {
          rating: Number(trainerRating),
          comment: trainerComment.trim(),
          bookingType: 'Personal Training',
        });
        setHasRatedTrainer(true);
      }

      showToast({
        message: hasPersonalTrainer
          ? 'Thank you! Your ratings for the gym & trainer have been submitted.'
          : 'Thank you! Your rating for the gym has been submitted.',
        isSuccess: true,
      });

      setShowRatingModal(false);
    } catch (err) {
      console.warn('[RATING SUBMISSION ERROR]:', err.message);
      showToast({
        message: err.message || 'Failed to submit rating. Please try again.',
        isError: true,
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const primaryNavy = isDark ? '#93C5FD' : AppColors.primaryColor;

  // Check for any active pending switch requests for this membership
  useEffect(() => {
    let isMounted = true;
    const checkPendingRequests = async () => {
      try {
        const requests = await membershipService.fetchMySwitchRequests();
        if (isMounted && Array.isArray(requests)) {
          const currentMemId = String(membership._id || membership.id || membership.membershipId);
          const activeReq = requests.find((r) => {
            const reqMemId = String(
              r.membershipId?._id || r.membershipId?.id || r.membershipId?.membershipId || r.membershipId
            );
            return (
              reqMemId === currentMemId &&
              (r.status === 'PENDING_GYM_APPROVAL' || r.status === 'PENDING_SUPER_ADMIN_APPROVAL')
            );
          });
          setPendingSwitchRequest(activeReq || null);
        }
      } catch (err) {
        console.warn('[SWITCH REQ CHECK ERROR]:', err.message);
      }
    };

    void checkPendingRequests();
    return () => {
      isMounted = false;
    };
  }, [membership._id, membership.id]);

  // Check if current user has already submitted a review/rating for this gym
  useEffect(() => {
    let isMounted = true;
    const checkUserRatings = async () => {
      try {
        if (!gymIdentifier) return;
        const res = await apiService.getGymRatings(gymIdentifier);
        if (isMounted && res && Array.isArray(res.ratings)) {
          const currentUserId = String(user?._id || user?.id || user?.userId || '');
          const currentUserPhone = String(user?.phone || '').trim();
          const currentUserName = String(user?.fullName || '').trim().toLowerCase();

          const myRating = res.ratings.find((r) => {
            const rUserId = String(r.userId?._id || r.userId?.id || r.userId || '');
            const rPhone = String(r.userPhone || '').trim();
            const rName = String(r.userName || '').trim().toLowerCase();
            return (
              (currentUserId && rUserId === currentUserId) ||
              (currentUserPhone && rPhone && rPhone === currentUserPhone) ||
              (currentUserName && rName && rName === currentUserName)
            );
          });

          if (myRating) {
            setHasRatedGym(true);
            if (myRating.rating) setGymRating(myRating.rating);
            if (myRating.comment) setGymComment(myRating.comment);
          }
        }
      } catch (err) {
        // Silently catch background rating check error
      }
    };

    void checkUserRatings();
    return () => {
      isMounted = false;
    };
  }, [gymIdentifier, user?._id, user?.id, user?.phone, user?.fullName]);

  const copyToClipboard = async (text, label) => {
    await Clipboard.setStringAsync(text);
    showToast({
      message: `${label} copied to clipboard`,
      isSuccess: true,
    });
  };

  const computeInstantQuote = (targetPlan, option = downgradeOption) => {
    if (!targetPlan || !targetPlan.price || Number(targetPlan.price) <= 0) return null;
    const gym = membership.gym || membership.gymId;
    const tier = String(membership.membershipTier || membership.planName || '').toLowerCase();
    const currentPrice =
      Number(membership.amountPaid) ||
      Number(membership.pricing?.totalAmount) ||
      Number(membership.pricing?.basePrice) ||
      Number(membership.price) ||
      (gym?.pricingPlans
        ? (tier.includes('month') ? Number(gym.pricingPlans.monthly) :
           tier.includes('quarter') ? Number(gym.pricingPlans.quarterly) :
           tier.includes('half') ? Number(gym.pricingPlans.halfYearly) :
           Number(gym.pricingPlans.annual))
        : 0);

    if (!currentPrice || currentPrice <= 0) {
      return null;
    }

    const totalDays = Number(membership.durationDays) || (membership.duration ? parseInt(membership.duration, 10) : 30) || 30;
    const remDays = Math.max(0, daysRemaining ?? 0);
    const usedDays = Math.max(0, totalDays - remDays);
    const perDayCost = totalDays > 0 ? currentPrice / totalDays : 0;
    const proRatedCredit = Math.min(currentPrice, Math.round(remDays * perDayCost * 100) / 100);
    const newPrice = Number(targetPlan.price || 0);
    const isUpgrade = newPrice >= proRatedCredit;
    const netPayable = Math.max(0, Math.round((newPrice - proRatedCredit) * 100) / 100);
    const leftoverCredit = Math.max(0, Math.round((proRatedCredit - newPrice) * 100) / 100);

    const newDurationDays = targetPlan.durationDays || 30;
    const newPerDayCost = newDurationDays > 0 ? newPrice / newDurationDays : 0;
    let extraDays = 0;
    let leftoverWalletCredit = 0;
    let leftoverRefund = 0;

    if (!isUpgrade && leftoverCredit > 0) {
      if (option === 'EXTEND' && newPerDayCost > 0) {
        extraDays = Math.floor(leftoverCredit / newPerDayCost);
        leftoverWalletCredit = Math.max(0, Math.round((leftoverCredit - extraDays * newPerDayCost) * 100) / 100);
      } else if (option === 'REFUND') {
        leftoverRefund = leftoverCredit;
      } else {
        leftoverWalletCredit = leftoverCredit;
      }
    }

    return {
      switchType: isUpgrade ? 'UPGRADE' : 'DOWNGRADE',
      currentPlan: {
        daysRemaining: remDays,
        daysUsed: usedDays,
        priceINR: currentPrice,
        price: currentPrice,
        perDayCostINR: perDayCost,
      },
      newPlan: {
        name: targetPlan.name,
        tier: targetPlan.tierId || targetPlan.name,
        priceINR: newPrice,
        price: newPrice,
        pricePaise: Math.round(newPrice * 100),
        baseDurationDays: newDurationDays,
        extraDaysAwarded: extraDays,
        effectiveDurationDays: newDurationDays + extraDays,
      },
      financialBreakdown: {
        proRatedCreditINR: proRatedCredit,
        proRatedCredit: proRatedCredit,
        proRatedCreditPaise: Math.round(proRatedCredit * 100),
        netAmountToPayINR: netPayable,
        netAmountToPay: netPayable,
        netAmountToPayPaise: Math.round(netPayable * 100),
        leftoverCreditINR: leftoverCredit,
        leftoverCredit: leftoverCredit,
        leftoverCreditPaise: Math.round(leftoverCredit * 100),
        leftoverWalletCreditINR: leftoverWalletCredit,
        leftoverRefundINR: leftoverRefund,
        policyApplied: option,
        grossPayableINR: netPayable,
      },
    };
  };

  const fetchQuoteForTargetPlan = async (targetPlan, option = downgradeOption) => {
    if (!targetPlan) return;
    setQuoteError(null);
    const localQuote = computeInstantQuote(targetPlan, option);
    setSwitchQuote(localQuote);

    setIsCalculatingQuote(true);
    try {
      const quote = await membershipService.previewSwitchPlan(membership._id || membership.id, {
        targetTier: targetPlan.tierId || targetPlan.name,
        targetPlanId: targetPlan.planId || targetPlan.tierId,
        downgradeSettlementPreference: option,
        useWalletBalance: true,
      });
      if (quote && quote.financialBreakdown) {
        setSwitchQuote(quote);
        setQuoteError(null);
      } else {
        throw new Error('Unable to calculate prorated switch quote.');
      }
    } catch (err) {
      console.warn('[QUOTE PREVIEW ERROR]:', err.message);
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to calculate switch quote: Membership pricing information is missing or invalid. Please try again or contact gym support.';
      setQuoteError(message);
      if (!localQuote) {
        setSwitchQuote(null);
      }
    } finally {
      setIsCalculatingQuote(false);
    }
  };

  const openPlanSwitchSheet = () => {
    const plans = getAvailableSwitchPlans(
      membership.gym || membership.gymId,
      membership.membershipTier || membership.planName
    );
    setAvailablePlans(plans);
    if (plans.length > 0) {
      const initialTarget = plans[0];
      setSelectedTargetPlan(initialTarget);
      setSwitchQuote(computeInstantQuote(initialTarget, downgradeOption));
      setShowSwitchSheet(true);
      fetchQuoteForTargetPlan(initialTarget, downgradeOption);
    } else {
      showToast({
        message: 'No alternative plans available for this gym.',
        isSuccess: false,
      });
    }
  };

  const handleSelectTargetPlan = (plan) => {
    setSelectedTargetPlan(plan);
    setSwitchQuote(computeInstantQuote(plan, downgradeOption));
    fetchQuoteForTargetPlan(plan, downgradeOption);
  };

  const handleSelectDowngradeOption = (option) => {
    setDowngradeOption(option);
    if (selectedTargetPlan) {
      setSwitchQuote(computeInstantQuote(selectedTargetPlan, option));
      fetchQuoteForTargetPlan(selectedTargetPlan, option);
    }
  };

  const handleConfirmSwitchRequest = async () => {
    if (!selectedTargetPlan) return;
    setIsSubmittingSwitch(true);
    try {
      const result = await membershipService.requestSwitchPlan(membership._id || membership.id, {
        targetTier: selectedTargetPlan.tierId || selectedTargetPlan.name,
        targetPlanId: selectedTargetPlan.planId || selectedTargetPlan.tierId,
        downgradeSettlementPreference: downgradeOption,
        paymentMethod: 'UPI',
        transactionId: `TXN_SW_${Date.now()}`,
        useWalletBalance: true,
      });
      setPendingSwitchRequest(result);
      setShowSwitchSheet(false);
      showToast({
        message: 'Plan switch request submitted! Awaiting Gym Owner & Super Admin review.',
        isSuccess: true,
      });
    } catch (err) {
      showToast({
        message: err.message || 'Failed to submit switch request.',
        isSuccess: false,
      });
    } finally {
      setIsSubmittingSwitch(false);
    }
  };

  const handleConfirmCancel = async () => {
    try {
      await cancelMembership(membership._id || membership.id, selectedReason);
      const negotiations = await membershipService.fetchMyCancellationNegotiations();
      setCancellationNegotiation(negotiations.find((item) =>
        String(typeof item.membershipId === 'object' ? item.membershipId._id : item.membershipId) ===
        String(membership._id || membership.id || '')
      ) || null);
      setShowCancelSheet(false);
      showToast({
        message: 'Cancellation negotiation submitted successfully',
        isSuccess: true,
      });
    } catch (error) {
      showToast({
        message: error.message || 'Failed to submit cancellation negotiation.',
        isSuccess: false,
      });
    }
  };

  const respondToCancellationQuote = async (action) => {
    if (!cancellationNegotiation) return;
    try {
      const updated = await membershipService.respondToCancellationOffer(cancellationNegotiation._id, action);
      setCancellationNegotiation(updated);
      if (action === 'ACCEPT') {
        updateMembership({
          ...membership,
          status: 'Cancelled',
          cancellationNegotiation: updated,
          cancellationStatus: 'COMPLETED',
        });
      }
      showToast({
        message: action === 'ACCEPT' ? 'Refund offer accepted. Cancellation is complete.' : 'Quote declined. The gym owner can send a new refund quote.',
        isSuccess: true,
      });
    } catch (error) {
      showToast({ message: error.message || 'Unable to respond to refund quote.', isSuccess: false });
    }
  };

  const shouldShowNoticeBanner =
    membership.status === 'Active' || membership.status === 'Upcoming';

  const planActionConfig = getPlanActionConfig(
    membership.membershipTier || membership.planName
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* App Bar */}
      <SafeAreaView style={{ backgroundColor: colors.background }}>
        <View style={styles.appBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back-ios" size={18} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.appBarTitle, { color: colors.text }]}>Membership Details</Text>

          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => setShowMoreMenu(true)}
            activeOpacity={0.7}
          >
            <MaterialIcons name="more-vert" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Gym Profile Card with Logo & Name */}
        <View
          style={[
            styles.gymProfileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.gymImageBox,
              {
                backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)',
                borderColor: colors.border,
              },
            ]}
          >
            {membership.gymImageUrl ? (
              <Image
                source={{ uri: membership.gymImageUrl }}
                style={styles.gymImage}
                resizeMode="cover"
              />
            ) : (
              <MaterialIcons name="fitness-center" size={28} color={AppColors.primaryColor} />
            )}
          </View>

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.gymNameText, { color: colors.text }]}>
              {membership.gymName}
            </Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.planBadge,
                  {
                    backgroundColor: isDark ? 'rgba(30, 58, 138, 0.6)' : AppColors.primaryColor,
                    borderColor: isDark ? 'rgba(59, 130, 246, 0.4)' : undefined,
                    borderWidth: isDark ? 1 : 0,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.planBadgeText,
                    { color: isDark ? '#93C5FD' : '#FFFFFF' },
                  ]}
                >
                  {membership.planName}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      membership.status === 'Active'
                        ? '#E6F7EF'
                        : isDark
                        ? '#262626'
                        : '#F1F5F9',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    {
                      color:
                        membership.status === 'Active' ? '#16A34A' : colors.subtitle,
                    },
                  ]}
                >
                  {membership.status}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 1.5 Pending Plan Switch Status Banner (Dual-Tier Review Tracker) */}
        {pendingSwitchRequest && (
          <View
            style={[
              styles.switchReviewBanner,
              {
                backgroundColor: isDark ? 'rgba(30, 58, 138, 0.2)' : '#F0F9FF',
                borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BAE6FD',
              },
            ]}
          >
            <View style={styles.switchReviewHeader}>
              <View style={styles.switchReviewTitleRow}>
                <MaterialIcons
                  name="sync"
                  size={20}
                  color={isDark ? '#93C5FD' : AppColors.primaryColor}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.switchReviewTitle,
                    { color: isDark ? '#FFFFFF' : AppColors.primaryColor },
                  ]}
                >
                  Plan Switch In Review
                </Text>
              </View>

              <View
                style={[
                  styles.switchStageBadge,
                  {
                    backgroundColor: 'transparent',
                    borderWidth: 0,
                    borderColor: 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.switchStageBadgeText,
                    {
                      color:
                        pendingSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                          ? isDark ? '#FDE68A' : '#D97706'
                          : isDark ? '#BFDBFE' : '#1D4ED8',
                    },
                  ]}
                >
                  {pendingSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                    ? 'Stage 1/2: Gym Review'
                    : 'Stage 2/2: Admin Approval'}
                </Text>
              </View>
            </View>

            {/* Request Summary */}
            <View style={styles.switchReviewBody}>
              <View style={styles.switchReviewDetailRow}>
                <Text style={[styles.switchReviewLabel, { color: colors.subtitle }]}>
                  Requested Plan:
                </Text>
                <Text style={[styles.switchReviewValue, { color: colors.text }]}>
                  {pendingSwitchRequest.targetTier} Plan
                </Text>
              </View>

              {pendingSwitchRequest.quoteSnapshot?.proRatedCreditPaise != null && (
                <View style={styles.switchReviewDetailRow}>
                  <Text style={[styles.switchReviewLabel, { color: colors.subtitle }]}>
                    Unused Days Credit Applied:
                  </Text>
                  <Text style={[styles.switchReviewValue, { color: '#00BF62', fontWeight: '800' }]}>
                    - ₹{(pendingSwitchRequest.quoteSnapshot.proRatedCreditPaise / 100).toFixed(2)}
                  </Text>
                </View>
              )}

              {pendingSwitchRequest.quoteSnapshot?.netAmountToPayPaise != null && (
                <View style={styles.switchReviewDetailRow}>
                  <Text style={[styles.switchReviewLabel, { color: colors.subtitle }]}>
                    Net Amount:
                  </Text>
                  <Text style={[styles.switchReviewValue, { color: colors.text, fontWeight: '800' }]}>
                    ₹{(pendingSwitchRequest.quoteSnapshot.netAmountToPayPaise / 100).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.switchReviewFooter}>
              <MaterialIcons
                name="info-outline"
                size={14}
                color={isDark ? '#94A3B8' : '#64748B'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.switchReviewNote, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Pass access is paused while your plan change request is under review.
              </Text>
            </View>
          </View>
        )}

        {/* 2. Soft Rating Quick Bar Directly Before QR Card (Only shown if gym not yet rated) */}
        {!hasRatedGym && (
          <TouchableOpacity
            onPress={() => setShowRatingModal(true)}
            style={[
              styles.softRateBar,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: colors.border,
                marginTop: 16,
              },
            ]}
            activeOpacity={0.85}
          >
            <View style={styles.softRateLeft}>
              <SmoothGradientStar
                size={20}
                filled={true}
                id="softrate-badge"
                isDark={isDark}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.softRateLabel, { color: colors.text }]}>
                Rate Us
              </Text>
              {hasPersonalTrainer && (
                <Text style={[styles.softRateSubLabel, { color: colors.subtitle }]}>
                  • Gym & Trainer
                </Text>
              )}
            </View>

            <View style={styles.softStarsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={`soft-star-btn-${star}`}
                  onPress={() => {
                    setGymRating(star);
                    setShowRatingModal(true);
                  }}
                  style={styles.softStarBtn}
                  activeOpacity={0.7}
                >
                  <SmoothGradientStar
                    size={24}
                    filled={star <= gymRating}
                    id={`soft-bar-${star}`}
                    isDark={isDark}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        )}

        {/* 2.5 Digital Entry Pass QR & OTP */}
        <View style={{ marginTop: 16 }}>
          <DigitalQrPassCard
            passId={membership.membershipId || membership.id}
            customerId={membership.customerId}
            otp={pendingSwitchRequest ? null : membership.otp}
            gymName={membership.gymName}
            subtitle={membership.planName}
            primaryDateLabel="VALID FROM"
            primaryDateValue={membership.startDate}
            secondaryDateLabel="EXPIRES ON"
            secondaryDateValue={membership.endDate}
            status={pendingSwitchRequest ? 'IN REVIEW' : membership.status}
            isInReview={Boolean(pendingSwitchRequest)}
            iconName="workspace-premium"
            accentColor={primaryNavy}
          />
        </View>

        {/* 2.6 Check-in & Attendance History for this Membership */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate('AttendanceHistory', {
              membershipId: membership.membershipId || membership.id,
              title: `${membership.planName || 'Membership'} Attendance`,
              contextName: `${membership.gymName || 'Gym'} • ${membership.membershipId || membership.id}`,
            })
          }
          style={[
            styles.attendanceActionTile,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <View style={[styles.attendanceIconBox, { backgroundColor: isDark ? '#1E293B' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="history" size={22} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.attendanceTileContent}>
            <Text style={[styles.attendanceTileTitle, { color: colors.text }]}>Check-in & Attendance History</Text>
            <Text style={[styles.attendanceTileSubtitle, { color: colors.subtitle }]}>
              View all turnstile check-ins for this membership
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={colors.subtitle} />
        </TouchableOpacity>

        {/* 3. Membership Details Key-Value List Card */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          {/* Membership ID */}
          <View style={styles.detailRow}>
            <View style={styles.labelRow}>
              <MaterialIcons
                name="person-outline"
                size={18}
                color={colors.subtitle}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Membership ID</Text>
            </View>
            <TouchableOpacity
              onPress={() => copyToClipboard(membership.membershipId || membership.id, 'Membership ID')}
              style={styles.copyIdRow}
              activeOpacity={0.7}
            >
              <Text style={[styles.idValueText, { color: primaryNavy }]}>{membership.membershipId || membership.id}</Text>
              <MaterialIcons
                name="content-copy"
                size={14}
                color={primaryNavy}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Start Date */}
          <View style={styles.detailRow}>
            <View style={styles.labelRow}>
              <MaterialIcons
                name="calendar-today"
                size={17}
                color={colors.subtitle}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Start Date</Text>
            </View>
            <Text style={[styles.detailValue, { color: colors.text }]}>{membership.startDate}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* End Date */}
          <View style={styles.detailRow}>
            <View style={styles.labelRow}>
              <MaterialIcons
                name="event-available"
                size={18}
                color={colors.subtitle}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.detailLabel, { color: colors.subtitle }]}>End Date</Text>
            </View>
            <Text style={[styles.detailValue, { color: colors.text }]}>{membership.endDate}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Days Remaining */}
          <View style={styles.detailRow}>
            <View style={styles.labelRow}>
              <MaterialIcons
                name="access-time"
                size={18}
                color={colors.subtitle}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Days Remaining</Text>
            </View>
            <Text style={[styles.detailValue, { color: '#16A34A', fontWeight: '900' }]}>
              {daysRemaining}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Personal Trainer */}
          <View style={styles.detailRow}>
            <View style={styles.labelRow}>
              <MaterialIcons
                name="sports"
                size={18}
                color={colors.subtitle}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Personal Trainer</Text>
            </View>
            <Text
              style={[
                styles.detailValue,
                {
                  color: membership.hasPersonalTrainer ? colors.text : '#EF4444',
                },
              ]}
            >
              {membership.hasPersonalTrainer
                ? membership.trainerName || 'Assigned'
                : 'Not Selected'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Amount Paid */}
          <View style={styles.detailRow}>
            <View style={styles.labelRow}>
              <MaterialIcons
                name="payments"
                size={18}
                color={colors.subtitle}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Amount Paid</Text>
            </View>
            <Text style={[styles.detailValue, { color: colors.text, fontWeight: '800' }]}>
              ₹{Math.round(membership.amountPaid)}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Payment Method */}
          <View style={styles.detailRow}>
            <View style={styles.labelRow}>
              <MaterialIcons
                name="account-balance-wallet"
                size={18}
                color={colors.subtitle}
                style={{ marginRight: 10 }}
              />
              <Text style={[styles.detailLabel, { color: colors.subtitle }]}>Payment Method</Text>
            </View>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {membership.paymentMode}
            </Text>
          </View>
        </View>

        {/* 4. Info Notice Banner */}
        {shouldShowNoticeBanner && (
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: 'rgba(0, 56, 130, 0.07)',
                borderColor: 'rgba(0, 56, 130, 0.2)',
              },
            ]}
          >
            <MaterialIcons name="info-outline" size={20} color={AppColors.primaryColor} />
            <Text
              style={[
                styles.infoBannerText,
                { color: isDark ? '#E2E8F0' : AppColors.primaryColor },
              ]}
            >
              {resolvePlanDescription(membership)}
            </Text>
          </View>
        )}

        {cancellationNegotiation && (
          <View style={[
            styles.infoBanner,
            {
              marginTop: 12,
              alignItems: 'flex-start',
              backgroundColor: isDark ? '#2A2115' : '#FFF7ED',
              borderColor: isDark ? '#9A5D23' : '#FDBA74',
            },
          ]}>
            <View style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? '#EA580C26' : '#FFEDD5',
              marginRight: 10,
            }}>
              <Text style={{ fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#EA580C' }}>₹</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[
                styles.infoBannerText,
                {
                  color: isDark ? '#FED7AA' : '#9A3412',
                  fontWeight: cancellationNegotiation.status === 'PENDING_MEMBER_APPROVAL' ? '700' : '500',
                },
              ]}>
                {cancellationNegotiation.status === 'PENDING_GYM_APPROVAL'
                  ? 'Cancellation requested. The gym owner is preparing your refund quote.'
                  : cancellationNegotiation.status === 'PENDING_MEMBER_APPROVAL'
                  ? `Refund quote: ₹${Number(cancellationNegotiation.currentOffer?.refundAmount || 0).toLocaleString('en-IN')}`
                  : cancellationNegotiation.status === 'COMPLETED'
                  ? `Cancellation complete. Approved refund: ₹${Number(cancellationNegotiation.approvedRefundAmount || 0).toLocaleString('en-IN')}`
                  : `Cancellation status: ${cancellationNegotiation.status}`}
              </Text>
              {cancellationNegotiation.status === 'PENDING_MEMBER_APPROVAL' && (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity onPress={() => respondToCancellationQuote('REJECT')} style={[styles.cancelModalBtn, { height: 44, backgroundColor: isDark ? '#334155' : '#E2E8F0', flex: 1 }]}>
                    <Text style={[styles.cancelModalBtnText, { color: isDark ? '#FFFFFF' : '#475569' }]}>Re-request</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => respondToCancellationQuote('ACCEPT')} style={[styles.cancelModalBtn, { height: 44, backgroundColor: '#93C5FD', flex: 1 }]}>
                    <Text style={[styles.cancelModalBtnText, { color: '#1E3A8A' }]}>Approve Refund</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 5. Actions: Upgrade Membership & Cancel Membership */}
        {membership.status === 'Active' && (
          <View style={{ marginTop: 24 }}>
            {/* Plan Action: Upgrade Plan / Change Plan / Downgrade Plan */}
            {pendingSwitchRequest ? (
              <View
                style={[
                  styles.actionOutlineBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: isDark ? '#262626' : '#F1F5F9',
                    opacity: 0.8,
                  },
                ]}
              >
                <MaterialIcons
                  name="hourglass-top"
                  size={20}
                  color={colors.subtitle}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.actionOutlineText, { color: colors.subtitle }]}>
                  Plan Switch Under Review
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={openPlanSwitchSheet}
                style={[
                  styles.actionOutlineBtn,
                  { borderColor: primaryNavy },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={planActionConfig.icon}
                  size={20}
                  color={primaryNavy}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.actionOutlineText, { color: primaryNavy }]}>
                  {planActionConfig.label}
                </Text>
              </TouchableOpacity>
            )}

            {/* Request Cancel Membership */}
            <TouchableOpacity
              onPress={() => setShowCancelSheet(true)}
              style={[
                styles.actionOutlineBtn,
                {
                  borderColor: 'rgba(248, 113, 113, 0.6)',
                  marginTop: 12,
                },
              ]}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="cancel"
                size={20}
                color="#F87171"
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.actionOutlineText, { color: '#F87171' }]}>
                Request to Cancel Membership
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ========================================== */}
      {/* PLAN SWITCH / UPGRADE / DOWNGRADE MODAL    */}
      {/* ========================================== */}
      <Modal
        visible={showSwitchSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSwitchSheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={[
              styles.sheetContainer,
              { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', maxHeight: '90%' },
            ]}
          >
            {/* Header */}
            <View style={styles.sheetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons
                  name="swap-horiz"
                  size={24}
                  color={primaryNavy}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  Switch Membership Plan
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSwitchSheet(false)}>
                <MaterialIcons name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetDescription, { color: colors.subtitle }]}>
              Your unused days credit will be automatically calculated and applied towards your new plan.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Target Plan Selector */}
              <Text style={[styles.sectionSubtitle, { color: colors.text, marginTop: 6 }]}>
                Select Target Plan
              </Text>

              <View style={styles.plansContainer}>
                {availablePlans.map((plan) => {
                  const isSelected =
                    selectedTargetPlan?.tierId === plan.tierId ||
                    selectedTargetPlan?.planId === plan.planId;
                  return (
                    <TouchableOpacity
                      key={plan.planId || plan.tierId}
                      onPress={() => handleSelectTargetPlan(plan)}
                      style={[
                        styles.planSelectionCard,
                        {
                          backgroundColor: isSelected
                            ? isDark ? 'rgba(30, 58, 138, 0.25)' : '#F0F9FF'
                            : colors.card,
                          borderColor: isSelected ? primaryNavy : colors.border,
                          borderWidth: isSelected ? 2 : 1.2,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.planCardHeader}>
                        <Text style={[styles.planCardName, { color: colors.text }]}>
                          {plan.name}
                        </Text>
                        <Text style={[styles.planCardPrice, { color: primaryNavy }]}>
                          ₹{plan.price}
                        </Text>
                      </View>

                      <View style={styles.planCardFooter}>
                        <View style={styles.planDurationBadge}>
                          <MaterialIcons
                            name="calendar-today"
                            size={12}
                            color={colors.subtitle}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.planDurationText, { color: colors.subtitle }]}>
                            {plan.duration || `${plan.durationDays} Days`}
                          </Text>
                        </View>

                        {isSelected && (
                          <View style={[styles.selectedCheckBadge, { backgroundColor: primaryNavy }]}>
                            <MaterialIcons name="check" size={12} color="#FFFFFF" />
                            <Text style={styles.selectedCheckText}>Selected</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Price & Credit Breakdown */}
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.sectionSubtitle, { color: colors.text }]}>
                  Price & Credit Summary
                </Text>

                {isCalculatingQuote ? (
                  <View style={[styles.quoteLoadingBox, { borderColor: colors.border }]}>
                    <ActivityIndicator size="small" color={primaryNavy} />
                    <Text style={[styles.quoteLoadingText, { color: colors.subtitle }]}>
                      Calculating your unused days credit & savings...
                    </Text>
                  </View>
                ) : quoteError ? (
                  <View
                    style={[
                      styles.quoteErrorBox,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.4)' : '#FCA5A5',
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="error-outline"
                      size={20}
                      color="#EF4444"
                      style={{ marginRight: 8, marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.quoteErrorText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>
                        {quoteError}
                      </Text>
                      {selectedTargetPlan && (
                        <TouchableOpacity
                          onPress={() => fetchQuoteForTargetPlan(selectedTargetPlan)}
                          style={[
                            styles.quoteRetryBtn,
                            { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2' },
                          ]}
                          activeOpacity={0.7}
                        >
                          <MaterialIcons name="refresh" size={14} color={isDark ? '#FCA5A5' : '#B91C1C'} />
                          <Text style={[styles.quoteRetryText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                            Try Again
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ) : (switchQuote || selectedTargetPlan) ? (() => {
                  const activeQuote = switchQuote || computeInstantQuote(selectedTargetPlan);
                  if (!activeQuote) return null;

                  const displayCredit =
                    activeQuote.financialBreakdown?.proRatedCreditINR ??
                    activeQuote.financialBreakdown?.proRatedCredit ??
                    (activeQuote.financialBreakdown?.proRatedCreditPaise != null
                      ? activeQuote.financialBreakdown.proRatedCreditPaise / 100
                      : 0);

                  const displayNewPrice =
                    activeQuote.newPlan?.priceINR ??
                    activeQuote.newPlan?.price ??
                    (activeQuote.newPlan?.pricePaise != null
                      ? activeQuote.newPlan.pricePaise / 100
                      : selectedTargetPlan?.price ?? 0);

                  const displayNetPayable =
                    activeQuote.financialBreakdown?.netAmountToPayINR ??
                    activeQuote.financialBreakdown?.netAmountToPay ??
                    (activeQuote.financialBreakdown?.netAmountToPayPaise != null
                      ? activeQuote.financialBreakdown.netAmountToPayPaise / 100
                      : Math.max(0, displayNewPrice - displayCredit));

                  const displayLeftoverCredit =
                    activeQuote.financialBreakdown?.leftoverCreditINR ??
                    activeQuote.financialBreakdown?.leftoverCredit ??
                    (activeQuote.financialBreakdown?.leftoverCreditPaise != null
                      ? activeQuote.financialBreakdown.leftoverCreditPaise / 100
                      : Math.max(0, displayCredit - displayNewPrice));

                  const displayRemainingDays =
                    activeQuote.currentPlan?.daysRemaining ?? daysRemaining ?? 0;

                  return (
                    <React.Fragment>
                      <View
                        style={[
                          styles.quoteCard,
                          {
                            backgroundColor: isDark ? '#262626' : '#F8FAFC',
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        {/* Current Plan Credit Row */}
                        <View style={styles.quoteRow}>
                          <Text style={[styles.quoteLabel, { color: colors.subtitle }]}>
                            Unused Days Credit ({displayRemainingDays} days left):
                          </Text>
                          <Text style={[styles.quoteValue, { color: '#00BF62', fontWeight: '800' }]}>
                            - ₹{displayCredit.toFixed(2)}
                          </Text>
                        </View>

                        {/* Target Plan Price Row */}
                        <View style={styles.quoteRow}>
                          <Text style={[styles.quoteLabel, { color: colors.subtitle }]}>
                            New Plan Price:
                          </Text>
                          <Text style={[styles.quoteValue, { color: colors.text }]}>
                            ₹{displayNewPrice.toFixed(2)}
                          </Text>
                        </View>

                        {/* Switch Type */}
                        <View style={styles.quoteRow}>
                          <Text style={[styles.quoteLabel, { color: colors.subtitle }]}>
                            Plan Change Type:
                          </Text>
                          <Text
                            style={[
                              styles.quoteValue,
                              {
                                color:
                                  activeQuote.switchType === 'UPGRADE'
                                    ? '#00BF62'
                                    : '#D97706',
                                fontWeight: '800',
                              },
                            ]}
                          >
                            {activeQuote.switchType === 'UPGRADE' ? 'Plan Upgrade' : 'Plan Downgrade'}
                          </Text>
                        </View>

                        <View style={[styles.quoteDivider, { backgroundColor: colors.border }]} />

                        {/* Downgrade Policy specifics */}
                        {activeQuote.switchType === 'DOWNGRADE' && (
                          <View style={{ marginBottom: 8 }}>
                            {displayLeftoverCredit > 0 && (
                              <View style={styles.quoteRow}>
                                <Text style={[styles.quoteLabel, { color: colors.subtitle }]}>
                                  {downgradeOption === 'WALLET'
                                    ? 'Balance Added to Gym Wallet:'
                                    : downgradeOption === 'REFUND'
                                    ? 'Refund to Source Account:'
                                    : 'Converted Unused Credit:'}
                                </Text>
                                <Text
                                  style={[
                                    styles.quoteValue,
                                    { color: AppColors.primaryColor, fontWeight: '800' },
                                  ]}
                                >
                                  {downgradeOption === 'EXTEND'
                                    ? `₹${displayLeftoverCredit.toFixed(2)}`
                                    : `+ ₹${displayLeftoverCredit.toFixed(2)}`}
                                </Text>
                              </View>
                            )}
                            {downgradeOption === 'EXTEND' && (activeQuote.newPlan?.extraDaysAwarded > 0 || (displayNewPrice > 0 && displayLeftoverCredit > 0)) && (
                              <View style={styles.quoteRow}>
                                <Text style={[styles.quoteLabel, { color: colors.subtitle }]}>
                                  Extra Bonus Days Awarded:
                                </Text>
                                <Text
                                  style={[
                                    styles.quoteValue,
                                    { color: '#00BF62', fontWeight: '800' },
                                  ]}
                                >
                                  + {activeQuote.newPlan?.extraDaysAwarded || Math.floor(displayLeftoverCredit / ((displayNewPrice || 1) / (selectedTargetPlan?.durationDays || 30)))} Days
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Net Amount to Pay */}
                        <View style={styles.quoteRow}>
                          <Text style={[styles.quoteTotalLabel, { color: colors.text }]}>
                            {activeQuote.switchType === 'UPGRADE' ? 'Amount to Pay Today:' : 'Net Payable:'}
                          </Text>
                          <Text style={[styles.quoteTotalValue, { color: primaryNavy }]}>
                            ₹{displayNetPayable.toFixed(2)}
                          </Text>
                        </View>
                      </View>

                      {/* Downgrade Balance Crediting Method Selector */}
                      {activeQuote.switchType === 'DOWNGRADE' && displayLeftoverCredit > 0 && (
                        <View style={{ marginTop: 14 }}>
                          <Text style={[styles.sectionSubtitle, { color: colors.text }]}>
                            Balance Amount Crediting Method
                          </Text>
                          <Text style={[styles.settlementSubtext, { color: colors.subtitle }]}>
                            Choose how you want to receive your leftover balance of ₹{displayLeftoverCredit.toFixed(2)}:
                          </Text>

                          {/* Option 1: Gym Wallet */}
                          <TouchableOpacity
                            onPress={() => handleSelectDowngradeOption('WALLET')}
                            style={[
                              styles.settlementOptionCard,
                              {
                                backgroundColor:
                                  downgradeOption === 'WALLET'
                                    ? isDark
                                      ? 'rgba(30, 58, 138, 0.25)'
                                      : '#F0F9FF'
                                    : colors.card,
                                borderColor: downgradeOption === 'WALLET' ? primaryNavy : colors.border,
                                borderWidth: downgradeOption === 'WALLET' ? 2 : 1.2,
                              },
                            ]}
                            activeOpacity={0.8}
                          >
                            <View style={styles.settlementRow}>
                              <MaterialIcons
                                name="account-balance-wallet"
                                size={22}
                                color={downgradeOption === 'WALLET' ? primaryNavy : colors.subtitle}
                                style={{ marginRight: 10, marginTop: 2 }}
                              />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={[styles.settlementOptionTitle, { color: colors.text }]}>
                                    Gym Wallet Balance
                                  </Text>
                                  <View style={[styles.settlementBadge, { backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE' }]}>
                                    <Text style={[styles.settlementBadgeText, { color: primaryNavy }]}>Instant</Text>
                                  </View>
                                </View>
                                <Text style={[styles.settlementOptionDesc, { color: colors.subtitle }]}>
                                  Instant credit to your Gym Wallet. Spendable on renewals, personal trainers, or café.
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>

                          {/* Option 2: Payment Refund */}
                          <TouchableOpacity
                            onPress={() => handleSelectDowngradeOption('REFUND')}
                            style={[
                              styles.settlementOptionCard,
                              {
                                backgroundColor:
                                  downgradeOption === 'REFUND'
                                    ? isDark
                                    ? 'rgba(30, 58, 138, 0.25)'
                                    : '#F0F9FF'
                                  : colors.card,
                                borderColor: downgradeOption === 'REFUND' ? primaryNavy : colors.border,
                                borderWidth: downgradeOption === 'REFUND' ? 2 : 1.2,
                              },
                            ]}
                            activeOpacity={0.8}
                          >
                            <View style={styles.settlementRow}>
                              <MaterialIcons
                                name="credit-card"
                                size={22}
                                color={downgradeOption === 'REFUND' ? primaryNavy : colors.subtitle}
                                style={{ marginRight: 10, marginTop: 2 }}
                              />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={[styles.settlementOptionTitle, { color: colors.text }]}>
                                    Original Payment Refund
                                  </Text>
                                  <View style={[styles.settlementBadge, { backgroundColor: isDark ? '#334155' : '#F1F5F9' }]}>
                                    <Text style={[styles.settlementBadgeText, { color: colors.subtitle }]}>5-7 Days</Text>
                                  </View>
                                </View>
                                <Text style={[styles.settlementOptionDesc, { color: colors.subtitle }]}>
                                  Refund directly to your original bank/UPI payment source.
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>

                          {/* Option 3: Extend Extra Days */}
                          <TouchableOpacity
                            onPress={() => handleSelectDowngradeOption('EXTEND')}
                            style={[
                              styles.settlementOptionCard,
                              {
                                backgroundColor:
                                  downgradeOption === 'EXTEND'
                                    ? isDark
                                      ? 'rgba(30, 58, 138, 0.25)'
                                      : '#F0F9FF'
                                    : colors.card,
                                borderColor: downgradeOption === 'EXTEND' ? primaryNavy : colors.border,
                                borderWidth: downgradeOption === 'EXTEND' ? 2 : 1.2,
                              },
                            ]}
                            activeOpacity={0.8}
                          >
                            <View style={styles.settlementRow}>
                              <MaterialIcons
                                name="event-available"
                                size={22}
                                color={downgradeOption === 'EXTEND' ? primaryNavy : colors.subtitle}
                                style={{ marginRight: 10, marginTop: 2 }}
                              />
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={[styles.settlementOptionTitle, { color: colors.text }]}>
                                    Extra Membership Days
                                  </Text>
                                  <View style={[styles.settlementBadge, { backgroundColor: isDark ? 'rgba(0, 191, 98, 0.2)' : '#DCFCE7' }]}>
                                    <Text style={[styles.settlementBadgeText, { color: '#00BF62' }]}>
                                      +{activeQuote.newPlan?.extraDaysAwarded || Math.floor(displayLeftoverCredit / ((displayNewPrice || 1) / (selectedTargetPlan?.durationDays || 30)))} Days
                                    </Text>
                                  </View>
                                </View>
                                <Text style={[styles.settlementOptionDesc, { color: colors.subtitle }]}>
                                  Convert leftover credit into extra days on your new plan.
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        </View>
                      )}
                    </React.Fragment>
                  );
                })() : null}
              </View>

              {/* 2-Tier Governance Notice */}
              <View
                style={[
                  styles.governanceNoteBox,
                  {
                    backgroundColor: isDark ? 'rgba(30, 58, 138, 0.15)' : '#F0F9FF',
                    borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BAE6FD',
                  },
                ]}
              >
                <MaterialIcons
                  name="verified-user"
                  size={16}
                  color={AppColors.primaryColor}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <Text
                  style={[
                    styles.governanceNoteText,
                    { color: isDark ? '#E2E8F0' : '#1E293B' },
                  ]}
                >
                  <Text style={{ fontWeight: '800' }}>Dual-Approval Workflow: </Text>
                  Once submitted, your request is reviewed by Gym Management and approved by Super Admin.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.switchModalActionsRow}>
              <TouchableOpacity
                onPress={() => setShowSwitchSheet(false)}
                style={[
                  styles.cancelModalBtn,
                  {
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelModalBtnText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmSwitchRequest}
                disabled={isSubmittingSwitch || isCalculatingQuote || !selectedTargetPlan || Boolean(quoteError) || !switchQuote}
                style={[
                  styles.cancelModalBtn,
                  {
                    backgroundColor: (quoteError || !switchQuote) ? (isDark ? '#334155' : '#CBD5E1') : primaryNavy,
                    marginLeft: 12,
                    opacity: isSubmittingSwitch ? 0.7 : 1,
                  },
                ]}
                activeOpacity={0.85}
              >
                {isSubmittingSwitch ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.cancelModalBtnText, { color: '#FFFFFF' }]}>
                    Submit Switch Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* CANCEL MEMBERSHIP BOTTOM SHEET             */}
      {/* ========================================== */}
      <Modal
        visible={showCancelSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelSheet(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={[
              styles.sheetContainer,
              { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF' },
            ]}
          >
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Cancel Membership</Text>
              <TouchableOpacity onPress={() => setShowCancelSheet(false)}>
                <MaterialIcons name="close" size={24} color={colors.subtitle} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sheetDescription, { color: colors.subtitle }]}>
              Please select a reason for cancellation. Note that cancellation requests are subject to gym refund policies.
            </Text>

            {/* Reason Radio List */}
            <View style={styles.reasonsList}>
              {CANCEL_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setSelectedReason(reason)}
                    style={styles.reasonRadioRow}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={isSelected ? '#EF4444' : colors.subtitle}
                    />
                    <Text
                      style={[
                        styles.reasonRadioText,
                        {
                          color: colors.text,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {reason}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons: Keep vs Confirm Cancel */}
            <View style={styles.cancelSheetActionsRow}>
              <TouchableOpacity
                onPress={() => setShowCancelSheet(false)}
                style={[
                  styles.cancelModalBtn,
                  {
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelModalBtnText, { color: colors.text }]}>
                  Keep Membership
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirmCancel}
                style={[
                  styles.cancelModalBtn,
                  {
                    backgroundColor: '#EF4444',
                    marginLeft: 12,
                  },
                ]}
                activeOpacity={0.85}
              >
                <Text style={[styles.cancelModalBtnText, { color: '#FFFFFF' }]}>
                  Confirm Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================== */}
      {/* RATE & REVIEW MODAL (GYM & TRAINER)        */}
      {/* ========================================== */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.sheetBackdropDismissArea}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View
                  style={[
                    styles.sheetContainer,
                    { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', maxHeight: '90%' },
                  ]}
                >
                  {/* Header with Gym Name in Onboarding Typography */}
                  <View style={styles.sheetHeader}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text
                        style={[
                          styles.modalGymHeaderTitle,
                          { color: colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {membership.gymName || 'Gym'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowRatingModal(false)}
                      style={[
                        styles.modalCloseBtn,
                        { backgroundColor: isDark ? '#262626' : '#F1F5F9' },
                      ]}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialIcons name="close" size={20} color={colors.subtitle} />
                    </TouchableOpacity>
                  </View>

                  {/* If personal trainer exists, show Tab switch */}
                  {hasPersonalTrainer && (
                    <View
                      style={[
                        styles.ratingTabContainer,
                        { backgroundColor: isDark ? '#262626' : '#F1F5F9', borderColor: colors.border },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => setActiveRatingTab('GYM')}
                        style={[
                          styles.ratingTabBtn,
                          activeRatingTab === 'GYM' && [
                            styles.ratingTabBtnActive,
                            { backgroundColor: isDark ? '#374151' : '#FFFFFF' },
                          ],
                        ]}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name="fitness-center"
                          size={16}
                          color={activeRatingTab === 'GYM' ? primaryNavy : colors.subtitle}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.ratingTabText,
                            { color: activeRatingTab === 'GYM' ? (isDark ? '#FFFFFF' : '#0F172A') : colors.subtitle },
                          ]}
                        >
                          Gym
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => setActiveRatingTab('TRAINER')}
                        style={[
                          styles.ratingTabBtn,
                          activeRatingTab === 'TRAINER' && [
                            styles.ratingTabBtnActive,
                            { backgroundColor: isDark ? '#374151' : '#FFFFFF' },
                          ],
                        ]}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons
                          name="person"
                          size={16}
                          color={activeRatingTab === 'TRAINER' ? primaryNavy : colors.subtitle}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.ratingTabText,
                            { color: activeRatingTab === 'TRAINER' ? (isDark ? '#FFFFFF' : '#0F172A') : colors.subtitle },
                          ]}
                          numberOfLines={1}
                        >
                          {`Trainer (${trainerName})`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 16 }}
                  >
                    {/* GYM RATING FORM */}
                    {(!hasPersonalTrainer || activeRatingTab === 'GYM') && (
                      <View style={styles.ratingFormSection}>
                        <View style={styles.ratingEntityCard}>
                          {/* Star Rating Interactive Selector */}
                          <View style={styles.modalStarsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <TouchableOpacity
                                key={`modal-gym-star-${star}`}
                                onPress={() => setGymRating(star)}
                                style={styles.modalStarBtn}
                                activeOpacity={0.7}
                              >
                                <SmoothGradientStar
                                  size={38}
                                  filled={star <= gymRating}
                                  id={`modal-gym-${star}`}
                                  isDark={isDark}
                                />
                              </TouchableOpacity>
                            ))}
                          </View>

                          {Boolean(getRatingLabel(gymRating)) && (
                            <Text style={[styles.starBadgeLabel, { color: '#F59E0B' }]}>
                              {getRatingLabel(gymRating)}
                            </Text>
                          )}
                        </View>

                        {/* Review Text Input (Optional) */}
                        <View style={{ marginTop: 14 }}>
                          <View style={styles.reviewLabelRow}>
                            <QuillWriteIcon size={16} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 6 }} />
                            <Text style={[styles.reviewInputLabel, { color: colors.text }]}>
                              Review
                            </Text>
                          </View>
                          <TextInput
                            style={[
                              styles.reviewTextInput,
                              {
                                backgroundColor: isDark ? '#262626' : '#F8FAFC',
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Write your review (optional)..."
                            placeholderTextColor={isDark ? '#6B7280' : '#94A3B8'}
                            value={gymComment}
                            onChangeText={setGymComment}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        </View>
                      </View>
                    )}

                    {/* TRAINER RATING FORM */}
                    {hasPersonalTrainer && activeRatingTab === 'TRAINER' && (
                      <View style={styles.ratingFormSection}>
                        <View style={styles.ratingEntityCard}>
                          {/* Star Rating Interactive Selector */}
                          <View style={styles.modalStarsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <TouchableOpacity
                                key={`modal-trainer-star-${star}`}
                                onPress={() => setTrainerRating(star)}
                                style={styles.modalStarBtn}
                                activeOpacity={0.7}
                              >
                                <SmoothGradientStar
                                  size={38}
                                  filled={star <= trainerRating}
                                  id={`modal-tr-${star}`}
                                  isDark={isDark}
                                />
                              </TouchableOpacity>
                            ))}
                          </View>

                          {Boolean(getRatingLabel(trainerRating)) && (
                            <Text style={[styles.starBadgeLabel, { color: '#F59E0B' }]}>
                              {getRatingLabel(trainerRating)}
                            </Text>
                          )}
                        </View>

                        {/* Review Text Input (Optional) */}
                        <View style={{ marginTop: 14 }}>
                          <View style={styles.reviewLabelRow}>
                            <QuillWriteIcon size={16} color={isDark ? '#94A3B8' : '#64748B'} style={{ marginRight: 6 }} />
                            <Text style={[styles.reviewInputLabel, { color: colors.text }]}>
                              Review
                            </Text>
                          </View>
                          <TextInput
                            style={[
                              styles.reviewTextInput,
                              {
                                backgroundColor: isDark ? '#262626' : '#F8FAFC',
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            placeholder="Write your review for trainer (optional)..."
                            placeholderTextColor={isDark ? '#6B7280' : '#94A3B8'}
                            value={trainerComment}
                            onChangeText={setTrainerComment}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        </View>
                      </View>
                    )}
                  </ScrollView>

                  {/* Modal Actions */}
                  <View style={styles.switchModalActionsRow}>
                    <TouchableOpacity
                      onPress={() => setShowRatingModal(false)}
                      style={[
                        styles.cancelModalBtn,
                        {
                          borderColor: colors.border,
                          borderWidth: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <SadIcon size={18} color={colors.text} style={{ marginRight: 6 }} />
                      <Text style={[styles.cancelModalBtnText, { color: colors.text }]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSubmitRatings}
                      disabled={isSubmittingRating}
                      style={[
                        styles.cancelModalBtn,
                        {
                          backgroundColor: primaryNavy,
                          marginLeft: 12,
                          opacity: isSubmittingRating ? 0.7 : 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                      activeOpacity={0.85}
                    >
                      {isSubmittingRating ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Text style={[styles.cancelModalBtnText, { color: '#FFFFFF', marginRight: 6 }]}>
                            Submit
                          </Text>
                          <SendIcon size={16} color="#FFFFFF" />
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================== */}
      {/* 3-DOTS MORE OPTIONS POPUP MODAL            */}
      {/* ========================================== */}
      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowMoreMenu(false)}
        >
          <View
            style={[
              styles.menuCard,
              { backgroundColor: isDark ? '#1E1E1E' : '#FFFFFF', borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                setShowMoreMenu(false);
                setShowRatingModal(true);
              }}
              style={styles.menuItemRow}
              activeOpacity={0.7}
            >
              <SmoothGradientStar
                size={20}
                filled={true}
                id="menu-rate-star"
                isDark={isDark}
                style={{ marginRight: 12 }}
              />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                {hasPersonalTrainer ? 'Rate Gym & Trainer' : 'Rate Gym'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              onPress={() => {
                setShowMoreMenu(false);
                navigation.navigate('AttendanceHistory', {
                  membershipId: membership.membershipId || membership.id,
                  title: `${membership.planName || 'Membership'} Attendance`,
                  contextName: `${membership.gymName || 'Gym'} • ${membership.membershipId || membership.id}`,
                });
              }}
              style={styles.menuItemRow}
              activeOpacity={0.7}
            >
              <MaterialIcons name="history" size={20} color={primaryNavy} style={{ marginRight: 12 }} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Attendance History
              </Text>
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              onPress={() => {
                setShowMoreMenu(false);
                void copyToClipboard(membership.membershipId || membership.id, 'Membership ID');
              }}
              style={styles.menuItemRow}
              activeOpacity={0.7}
            >
              <MaterialIcons name="content-copy" size={20} color={primaryNavy} style={{ marginRight: 12 }} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>
                Copy Membership ID
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  moreBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  gymProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    borderWidth: 1.2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.03,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  gymImageBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymImage: {
    width: '100%',
    height: '100%',
  },
  gymNameText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Review Banner */
  switchReviewBanner: {
    borderRadius: 20,
    borderWidth: 1.2,
    padding: 16,
    marginTop: 16,
  },
  switchReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  switchReviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchReviewTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  switchStageBadge: {
    paddingHorizontal: 0,
    paddingVertical: 2,
  },
  switchStageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  switchReviewBody: {
    marginBottom: 8,
  },
  switchReviewDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  switchReviewLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  switchReviewValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchReviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.8,
    borderTopColor: 'rgba(148, 163, 184, 0.2)',
  },
  switchReviewNote: {
    fontSize: 11.5,
    flex: 1,
    lineHeight: 16,
  },

  detailsCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1.2,
    marginTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  copyIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idValueText: {
    fontSize: 14,
    fontWeight: '900',
  },
  divider: {
    height: 0.8,
    marginVertical: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginLeft: 10,
  },
  actionOutlineBtn: {
    width: '100%',
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOutlineText: {
    fontSize: 15,
    fontWeight: '800',
  },

  /* Sheets & Modals */
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetBackdropDismissArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  sheetDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  plansContainer: {
    marginBottom: 10,
  },
  planSelectionCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  planCardName: {
    fontSize: 15,
    fontWeight: '800',
  },
  planCardPrice: {
    fontSize: 16,
    fontWeight: '900',
  },
  planCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planDurationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectedCheckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  selectedCheckText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 3,
  },

  /* Proration Quote Box */
  quoteLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  quoteLoadingText: {
    fontSize: 13,
    marginLeft: 10,
    fontWeight: '500',
  },
  quoteErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 8,
  },
  quoteErrorText: {
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 17,
  },
  quoteRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  quoteRetryText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  quoteCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 6,
  },
  quoteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  quoteLabel: {
    fontSize: 12.5,
    fontWeight: '500',
    flex: 1,
  },
  quoteValue: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  switchTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  switchTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  quoteDivider: {
    height: 1,
    marginVertical: 8,
  },
  quoteTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  quoteTotalValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  settlementSubtext: {
    fontSize: 12.5,
    marginBottom: 8,
    lineHeight: 17,
  },
  settlementOptionCard: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  settlementOptionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  settlementBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  settlementBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  settlementOptionDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },

  governanceNoteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 8,
  },
  governanceNoteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },

  switchModalActionsRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  reasonsList: {
    marginBottom: 20,
  },
  reasonRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  reasonRadioText: {
    fontSize: 14,
    marginLeft: 10,
  },
  cancelSheetActionsRow: {
    flexDirection: 'row',
  },
  cancelModalBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },

  /* Soft Rate Us Bar Styles */
  softRateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1.2,
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  softRateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  softRateLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  softRateSubLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  softStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  softStarBtn: {
    padding: 3,
  },

  /* Rating Modal & Tabs */
  modalGymHeaderTitle: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingTabContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 16,
  },
  ratingTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  ratingTabBtnActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  ratingTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ratingFormSection: {
    marginBottom: 8,
  },
  ratingEntityCard: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  modalStarBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  starBadgeLabel: {
    fontSize: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  reviewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewInputLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  reviewTextInput: {
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13.5,
  },

  /* 3-Dots Menu */
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 90 : 50,
    paddingRight: 16,
  },
  menuCard: {
    width: 220,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 6,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    marginHorizontal: 12,
  },

  /* Attendance Action Tile */
  attendanceActionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  attendanceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendanceTileContent: {
    flex: 1,
  },
  attendanceTileTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  attendanceTileSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
});
