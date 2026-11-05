import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from './CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';

export const SESSION_TIERS = [
  { key: 'PER_DAY', label: '1 Day Pass', days: 1, desc: 'Single session pass' },
  { key: 'WEEKLY', label: '7 Days Pass', days: 7, desc: 'Consecutive week' },
  { key: 'CUSTOM', label: 'Custom Dates', days: null, desc: 'Pick specific dates' },
];

export const PAYMENT_METHODS = [
  { key: 'Cash', label: 'Cash at Desk', icon: 'payments' },
  { key: 'UPI', label: 'Counter UPI / QR', icon: 'qr-code-2' },
  { key: 'Card', label: 'Card / POS Swipe', icon: 'credit-card' },
];

export const ENTRY_STATUSES = [
  { key: 'Checked-in', label: 'Check-in Now', desc: 'Grant gate access immediately' },
  { key: 'Upcoming', label: 'Upcoming Slot', desc: 'Check-in upon arrival at desk' },
];

export const DEFAULT_TIME_SLOTS = [
  '06:00 AM',
  '07:00 AM',
  '08:00 AM',
  '09:00 AM',
  '10:00 AM',
  '11:00 AM',
  '04:00 PM',
  '05:00 PM',
  '06:00 PM',
  '07:00 PM',
  '08:00 PM',
  '09:00 PM',
];

const formatDateYYYYMMDD = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * AddWalkInBookingModal - Front Desk Walk-in Booking Creator
 * Implements the exact logic and schema from WALKIN_MODEL_AND_DESK_OPERATIONS.md & BookingsManagement.jsx
 */
export const AddWalkInBookingModal = ({
  visible,
  onClose,
  onSuccess,
  initialDate,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { gym, user } = useAuth();

  const targetGymId = gym?._id || gym?.id || user?.gymId;

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');

  // Session & Pass Configuration
  const [sessionTier, setSessionTier] = useState('PER_DAY'); // 'PER_DAY' | 'WEEKLY' | 'CUSTOM'
  const [startDate, setStartDate] = useState(formatDateYYYYMMDD(new Date()));
  const [timeSlot, setTimeSlot] = useState('07:00 AM');
  const [customDatesList, setCustomDatesList] = useState([]);
  const [newCustomDateInput, setNewCustomDateInput] = useState(formatDateYYYYMMDD(new Date()));

  // Activity / Section & Trainer Add-on
  const [gymSections, setGymSections] = useState([]);
  const [gymTrainers, setGymTrainers] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('general'); // 'general' or section _id
  const [selectedTrainerId, setSelectedTrainerId] = useState('none'); // 'none' or trainer employeeId

  // Payment & Entry
  const [amount, setAmount] = useState('150');
  const [isPriceCustomized, setIsPriceCustomized] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [entryStatus, setEntryStatus] = useState('Checked-in'); // 'Checked-in' | 'Upcoming'

  // Loading States
  const [isLoadingCatalogs, setIsLoadingCatalogs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default Single Session Base Price
  const gymBasePrice = useMemo(() => {
    if (gym?.pricingPlans?.singleSession) return Number(gym.pricingPlans.singleSession);
    if (gym?.singleSessionPrice) return Number(gym.singleSessionPrice);
    if (gym?.customPricingPlans?.find?.((p) => p.name?.toLowerCase().includes('day') || p.name?.toLowerCase().includes('walk'))) {
      const match = gym.customPricingPlans.find(
        (p) => p.name?.toLowerCase().includes('day') || p.name?.toLowerCase().includes('walk')
      );
      return Number(match.price) || 150;
    }
    return 150;
  }, [gym]);

  // Load Sections and Trainers catalogs when modal opens
  useEffect(() => {
    if (visible && targetGymId) {
      let isMounted = true;
      setIsLoadingCatalogs(true);

      Promise.all([
        apiService.getSections({ gymId: targetGymId }).catch(() => []),
        apiService.getEmployees().catch(() => []),
      ])
        .then(([sectionsData, employeesData]) => {
          if (!isMounted) return;
          if (Array.isArray(sectionsData)) {
            setGymSections(sectionsData.filter((s) => s.isActive !== false));
          }
          if (Array.isArray(employeesData)) {
            setGymTrainers(
              employeesData.filter(
                (e) => (e.role || '').toLowerCase().includes('train') || (e.role || '').toLowerCase().includes('coach')
              )
            );
          }
        })
        .finally(() => {
          if (isMounted) setIsLoadingCatalogs(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [visible, targetGymId]);

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      setCustomerName('');
      setPhone('');
      setEmail('');
      setCountryCode('+91');
      setSessionTier('PER_DAY');
      const todayStr = initialDate ? formatDateYYYYMMDD(initialDate) : formatDateYYYYMMDD(new Date());
      setStartDate(todayStr);
      setNewCustomDateInput(todayStr);
      setTimeSlot('07:00 AM');
      setCustomDatesList([todayStr]);
      setSelectedSectionId('general');
      setSelectedTrainerId('none');
      setPaymentMethod('Cash');
      setEntryStatus('Checked-in');
      setIsPriceCustomized(false);
      setAmount(String(gymBasePrice));
    }
  }, [visible, initialDate, gymBasePrice]);

  // Selected Activity Object
  const selectedSection = useMemo(() => {
    if (selectedSectionId === 'general') return null;
    return gymSections.find((s) => String(s._id || s.id) === String(selectedSectionId)) || null;
  }, [selectedSectionId, gymSections]);

  // Selected Trainer Object
  const selectedTrainer = useMemo(() => {
    if (selectedTrainerId === 'none') return null;
    return (
      gymTrainers.find(
        (t) => String(t._id || t.id || t.employeeId) === String(selectedTrainerId)
      ) || null
    );
  }, [selectedTrainerId, gymTrainers]);

  // Auto-calculate fee based on session tier, section cost, trainer add-on rate & days count
  useEffect(() => {
    if (isPriceCustomized) return; // Respect manual desk override

    const baseUnitCost = selectedSection
      ? Number(selectedSection.cost || gymBasePrice)
      : gymBasePrice;

    const trainerDailyFee = selectedTrainer
      ? Number(selectedTrainer.trainerPricing?.singleSession || 0)
      : 0;

    let total = baseUnitCost + trainerDailyFee;

    if (sessionTier === 'WEEKLY') {
      total = (baseUnitCost + trainerDailyFee) * 7;
    } else if (sessionTier === 'CUSTOM') {
      const daysCount = Math.max(1, customDatesList.length);
      total = (baseUnitCost + trainerDailyFee) * daysCount;
    }

    setAmount(String(Math.round(total)));
  }, [
    sessionTier,
    selectedSection,
    selectedTrainer,
    customDatesList.length,
    gymBasePrice,
    isPriceCustomized,
  ]);

  // Add custom date to list
  const handleAddCustomDate = () => {
    if (!newCustomDateInput) return;
    if (customDatesList.includes(newCustomDateInput)) {
      showToast({ message: 'Date is already added to schedule.', isError: true });
      return;
    }
    const updated = [...customDatesList, newCustomDateInput].sort();
    setCustomDatesList(updated);
  };

  const handleRemoveCustomDate = (dateToRemove) => {
    setCustomDatesList((prev) => prev.filter((d) => d !== dateToRemove));
  };

  // Add preset days to new custom date
  const handleAddPresetDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dStr = formatDateYYYYMMDD(d);
    if (!customDatesList.includes(dStr)) {
      setCustomDatesList((prev) => [...prev, dStr].sort());
    }
  };

  // Submission handler
  const handleSubmit = async () => {
    const cleanName = customerName.trim();
    const cleanPhone = phone.trim().replace(/\D/g, '');

    if (!cleanName) {
      showToast({ message: 'Customer full name is required', isError: true });
      return;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      showToast({ message: 'Valid 10-digit mobile number is required', isError: true });
      return;
    }
    if (sessionTier === 'CUSTOM' && customDatesList.length === 0) {
      showToast({ message: 'Please select at least one date for custom schedule', isError: true });
      return;
    }
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      showToast({ message: 'Please enter a valid pass fee', isError: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const isGroupClass = !!selectedSection;

      let calculatedStartDate = startDate || formatDateYYYYMMDD(new Date());
      let calculatedEndDate = calculatedStartDate;

      if (sessionTier === 'WEEKLY') {
        const start = new Date(calculatedStartDate);
        const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        calculatedEndDate = formatDateYYYYMMDD(end);
      } else if (sessionTier === 'CUSTOM' && customDatesList.length > 0) {
        const sorted = [...customDatesList].sort();
        calculatedStartDate = sorted[0];
        calculatedEndDate = sorted[sorted.length - 1];
      }

      const passTitle = selectedSection
        ? selectedSection.title
        : sessionTier === 'WEEKLY'
        ? 'Weekly Gym Access Pass'
        : sessionTier === 'CUSTOM'
        ? `Custom ${customDatesList.length}-Days Pass`
        : 'Gym Session Access';

      const payload = {
        customerName: cleanName,
        phone: cleanPhone,
        email: email.trim() || undefined,
        bookingType: isGroupClass ? 'GROUP_CLASS' : 'GYM_SESSION',
        title: passTitle,
        sectionId: selectedSection ? selectedSection._id || selectedSection.id : undefined,
        trainerId: selectedTrainer
          ? selectedTrainer._id || selectedTrainer.id || selectedTrainer.employeeId
          : selectedSection?.trainerId?._id || undefined,
        startDate: calculatedStartDate,
        endDate: calculatedEndDate,
        timeSlot: selectedSection
          ? `${selectedSection.startTime || '06:00 AM'} - ${selectedSection.endTime || '07:00 AM'}`
          : timeSlot || '07:00 AM',
        amount: numericAmount,
        price: numericAmount,
        paymentMethod,
        paymentStatus: 'Completed',
        checkInNow: entryStatus === 'Checked-in',
        isCustomDates: sessionTier === 'CUSTOM',
        customDates: sessionTier === 'CUSTOM' ? customDatesList : undefined,
      };

      const result = await apiService.createWalkInBooking(targetGymId, payload);
      showToast({
        message: `Walk-in booking created for ${cleanName}!`,
        isSuccess: true,
      });

      onSuccess?.(result);
      onClose?.();
    } catch (err) {
      showToast({
        message: err.message || 'Failed to create walk-in booking',
        isError: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              maxHeight: '92%',
              paddingBottom: Math.max(insets.bottom, 24) + 8,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconWrap}>
                <MaterialIcons name="confirmation-number" size={20} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Create Walk-in Booking
                </Text>
                <Text
                  style={[
                    styles.sheetSubtitle,
                    { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                  ]}
                >
                  Issue single session, weekly pass, or class access at front-desk
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeBtn}
            >
              <MaterialIcons name="close" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
          </View>

          {/* Scrollable Form Body */}
          <ScrollView
            style={{ flexGrow: 1, flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
          >
            {/* Section 1: Customer Details */}
            <View style={styles.formGroup}>
              <Text style={[styles.groupHeading, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Customer Details
              </Text>

              {/* Full Name */}
              <View style={styles.inputWrap}>
                <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                  Customer Full Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  value={customerName}
                  onChangeText={setCustomerName}
                  placeholder="e.g. Arun Kumar"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      color: isDark ? '#FFFFFF' : '#0F172A',
                    },
                  ]}
                />
              </View>

              {/* Phone and Email */}
              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1.1 }}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                    Phone Number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.phoneInputRow,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.countryCodeBox}>
                      <Text style={[styles.countryCodeText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {countryCode}
                      </Text>
                    </View>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      maxLength={10}
                      placeholder="9876543210"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[styles.phoneTextInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                    Email (Optional)
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="name@mail.com"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Section 2: Session Duration & Pass Type */}
            <View style={styles.formGroup}>
              <Text style={[styles.groupHeading, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Pass Type & Duration <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.tierSelectorRow}>
                {SESSION_TIERS.map((tier) => {
                  const isSelected = sessionTier === tier.key;
                  return (
                    <TouchableOpacity
                      key={tier.key}
                      style={[
                        styles.tierCard,
                        isSelected
                          ? {
                              backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : '#F5F3FF',
                              borderColor: '#7C3AED',
                            }
                          : {
                              backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                            },
                      ]}
                      onPress={() => setSessionTier(tier.key)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.tierCardTop}>
                        <MaterialIcons
                          name={
                            tier.key === 'PER_DAY'
                              ? 'today'
                              : tier.key === 'WEEKLY'
                              ? 'date-range'
                              : 'event-repeat'
                          }
                          size={18}
                          color={isSelected ? '#7C3AED' : '#94A3B8'}
                        />
                        <Text
                          style={[
                            styles.tierTitle,
                            {
                              color: isSelected
                                ? '#7C3AED'
                                : isDark
                                ? '#FFFFFF'
                                : '#0F172A',
                            },
                          ]}
                        >
                          {tier.label}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.tierSub,
                          { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' },
                        ]}
                      >
                        {tier.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Custom Multi-Date Selector (Shown only when CUSTOM is selected) */}
            {sessionTier === 'CUSTOM' && (
              <View
                style={[
                  styles.customDatesBox,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.08)' : '#FAF5FF',
                    borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#E9D5FF',
                  },
                ]}
              >
                <View style={styles.customDatesHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialIcons name="event-available" size={17} color="#7C3AED" />
                    <Text style={[styles.customDatesTitle, { color: isDark ? '#DDD6FE' : '#6B21A8' }]}>
                      Pick Custom Session Dates
                    </Text>
                  </View>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>
                      {customDatesList.length} date{customDatesList.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                {/* Add Date Input Row */}
                <View style={styles.addDateInputRow}>
                  <TextInput
                    value={newCustomDateInput}
                    onChangeText={setNewCustomDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    style={[
                      styles.customDateInput,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                  />
                  <TouchableOpacity
                    style={[styles.addDateBtn, { backgroundColor: '#7C3AED' }]}
                    onPress={handleAddCustomDate}
                  >
                    <MaterialIcons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addDateBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Add Presets */}
                <View style={styles.presetChipsRow}>
                  <Text style={[styles.presetLabel, { color: isDark ? '#CBD5E1' : '#64748B' }]}>
                    Quick Presets:
                  </Text>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleAddPresetDays(1)}
                  >
                    <Text style={styles.presetChipText}>+ Tomorrow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleAddPresetDays(2)}
                  >
                    <Text style={styles.presetChipText}>+ 2 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() => handleAddPresetDays(3)}
                  >
                    <Text style={styles.presetChipText}>+ 3 Days</Text>
                  </TouchableOpacity>
                </View>

                {/* Selected Dates Badges */}
                <View style={styles.datesChipsContainer}>
                  {customDatesList.length === 0 ? (
                    <Text style={{ fontSize: 12, color: AppColors.warningAmber }}>
                      No dates selected yet. Enter a date and tap Add.
                    </Text>
                  ) : (
                    customDatesList.map((dStr) => (
                      <View key={dStr} style={styles.dateTag}>
                        <Text style={styles.dateTagText}>{dStr}</Text>
                        <TouchableOpacity
                          onPress={() => handleRemoveCustomDate(dStr)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <MaterialIcons name="close" size={14} color="#6B21A8" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* Section 3: Activity / Ongoing Section Selector */}
            <View style={styles.formGroup}>
              <Text style={[styles.groupHeading, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Activity / Workout Program <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.activityOptionsList}>
                {/* General Gym Floor Access */}
                <TouchableOpacity
                  style={[
                    styles.activityCard,
                    selectedSectionId === 'general'
                      ? {
                          backgroundColor: isDark ? 'rgba(0, 56, 130, 0.15)' : '#EFF6FF',
                          borderColor: AppColors.primaryColor,
                        }
                      : {
                          backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        },
                  ]}
                  onPress={() => setSelectedSectionId('general')}
                  activeOpacity={0.8}
                >
                  <View style={styles.activityCardLeft}>
                    <View
                      style={[
                        styles.activityIconWrap,
                        {
                          backgroundColor:
                            selectedSectionId === 'general'
                              ? 'rgba(0, 56, 130, 0.2)'
                              : isDark
                              ? 'rgba(255,255,255,0.06)'
                              : '#E2E8F0',
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="fitness-center"
                        size={18}
                        color={selectedSectionId === 'general' ? AppColors.primaryColor : '#64748B'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.activityCardTitle,
                          {
                            color:
                              selectedSectionId === 'general'
                                ? AppColors.primaryColor
                                : isDark
                                ? '#FFFFFF'
                                : '#0F172A',
                          },
                        ]}
                      >
                        General Gym Access (Floor & Machines)
                      </Text>
                      <Text
                        style={[
                          styles.activityCardSub,
                          { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' },
                        ]}
                      >
                        Standard day pass • ₹{gymBasePrice} / session
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.radioCircle,
                      selectedSectionId === 'general' && {
                        borderColor: AppColors.primaryColor,
                        backgroundColor: AppColors.primaryColor,
                      },
                    ]}
                  >
                    {selectedSectionId === 'general' && (
                      <View style={styles.radioInnerDot} />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Configured Classes / Sections */}
                {gymSections.map((sec) => {
                  const secId = String(sec._id || sec.id);
                  const isSelected = selectedSectionId === secId;
                  const secCost = Number(sec.cost || gymBasePrice);
                  return (
                    <TouchableOpacity
                      key={secId}
                      style={[
                        styles.activityCard,
                        isSelected
                          ? {
                              backgroundColor: isDark ? 'rgba(0, 56, 130, 0.15)' : '#EFF6FF',
                              borderColor: AppColors.primaryColor,
                            }
                          : {
                              backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                            },
                      ]}
                      onPress={() => setSelectedSectionId(secId)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.activityCardLeft}>
                        <View
                          style={[
                            styles.activityIconWrap,
                            {
                              backgroundColor: isSelected
                                ? 'rgba(0, 56, 130, 0.2)'
                                : isDark
                                ? 'rgba(255,255,255,0.06)'
                                : '#E2E8F0',
                            },
                          ]}
                        >
                          <MaterialIcons
                            name="groups"
                            size={18}
                            color={isSelected ? AppColors.primaryColor : '#64748B'}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.activityCardTitle,
                              {
                                color: isSelected
                                  ? AppColors.primaryColor
                                  : isDark
                                  ? '#FFFFFF'
                                  : '#0F172A',
                              },
                            ]}
                          >
                            {sec.title}
                          </Text>
                          <Text
                            style={[
                              styles.activityCardSub,
                              { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' },
                            ]}
                          >
                            {sec.startTime} - {sec.endTime} • ₹{secCost} / session
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.radioCircle,
                          isSelected && {
                            borderColor: AppColors.primaryColor,
                            backgroundColor: AppColors.primaryColor,
                          },
                        ]}
                      >
                        {isSelected && <View style={styles.radioInnerDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Section 4: Personal Trainer Add-On */}
            <View style={styles.formGroup}>
              <Text style={[styles.groupHeading, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Personal Trainer Add-on (Optional)
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trainersScroll}>
                {/* No Trainer Option */}
                <TouchableOpacity
                  style={[
                    styles.trainerChipCard,
                    selectedTrainerId === 'none'
                      ? {
                          backgroundColor: isDark ? 'rgba(0, 56, 130, 0.15)' : '#EFF6FF',
                          borderColor: AppColors.primaryColor,
                        }
                      : {
                          backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        },
                  ]}
                  onPress={() => setSelectedTrainerId('none')}
                >
                  <MaterialIcons
                    name="person-outline"
                    size={16}
                    color={selectedTrainerId === 'none' ? AppColors.primaryColor : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.trainerChipText,
                      {
                        color:
                          selectedTrainerId === 'none'
                            ? AppColors.primaryColor
                            : isDark
                            ? '#FFFFFF'
                            : '#0F172A',
                        fontWeight: selectedTrainerId === 'none' ? '700' : '500',
                      },
                    ]}
                  >
                    No Trainer
                  </Text>
                </TouchableOpacity>

                {/* Available Trainers */}
                {gymTrainers.map((tr) => {
                  const trId = String(tr._id || tr.id || tr.employeeId);
                  const isSelected = selectedTrainerId === trId;
                  const fee = Number(tr.trainerPricing?.singleSession || 0);
                  return (
                    <TouchableOpacity
                      key={trId}
                      style={[
                        styles.trainerChipCard,
                        isSelected
                          ? {
                              backgroundColor: isDark ? 'rgba(0, 56, 130, 0.15)' : '#EFF6FF',
                              borderColor: AppColors.primaryColor,
                            }
                          : {
                              backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                            },
                      ]}
                      onPress={() => setSelectedTrainerId(trId)}
                    >
                      <MaterialIcons
                        name="sports"
                        size={16}
                        color={isSelected ? AppColors.primaryColor : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.trainerChipText,
                          {
                            color: isSelected
                              ? AppColors.primaryColor
                              : isDark
                              ? '#FFFFFF'
                              : '#0F172A',
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {tr.name} {fee > 0 ? `(+₹${fee})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Section 5: Date & Slot Details */}
            {sessionTier !== 'CUSTOM' && (
              <View style={styles.formGroup}>
                <View style={styles.rowTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                      {sessionTier === 'WEEKLY' ? 'Pass Start Date' : 'Session Date'}
                    </Text>
                    <TextInput
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                        },
                      ]}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                      Slot Time
                    </Text>
                    <TextInput
                      value={timeSlot}
                      onChangeText={setTimeSlot}
                      placeholder="07:00 AM"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Quick Time Slots Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {DEFAULT_TIME_SLOTS.map((slot) => {
                    const isSelected = timeSlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        style={[
                          styles.timeSlotChip,
                          isSelected
                            ? { backgroundColor: AppColors.primaryColor, borderColor: AppColors.primaryColor }
                            : {
                                backgroundColor: isDark ? AppColors.darkSurface : '#F1F5F9',
                                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                              },
                        ]}
                        onPress={() => setTimeSlot(slot)}
                      >
                        <Text
                          style={[
                            styles.timeSlotChipText,
                            { color: isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569' },
                          ]}
                        >
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Section 6: Payment Method & Fee */}
            <View style={styles.formGroup}>
              <Text style={[styles.groupHeading, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                Payment & Gate Entry
              </Text>

              {/* Amount and Payment Method */}
              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                    Pass Fee (₹) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    value={amount}
                    onChangeText={(val) => {
                      setIsPriceCustomized(true);
                      setAmount(val);
                    }}
                    keyboardType="numeric"
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        fontWeight: '800',
                        fontSize: 16,
                      },
                    ]}
                  />
                </View>

                <View style={{ flex: 1.2 }}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                    Payment Channel
                  </Text>
                  <View style={styles.payMethodsRow}>
                    {PAYMENT_METHODS.map((pm) => {
                      const isSelected = paymentMethod === pm.key;
                      return (
                        <TouchableOpacity
                          key={pm.key}
                          style={[
                            styles.payMethodBtn,
                            isSelected
                              ? {
                                  backgroundColor: '#10B981',
                                  borderColor: '#10B981',
                                }
                              : {
                                  backgroundColor: isDark ? AppColors.darkSurface : '#F1F5F9',
                                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                                },
                          ]}
                          onPress={() => setPaymentMethod(pm.key)}
                        >
                          <MaterialIcons
                            name={pm.icon}
                            size={15}
                            color={isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.payMethodText,
                              { color: isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569' },
                            ]}
                          >
                            {pm.key}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Live Price Breakdown Banner (Exact Web Console Feature) */}
              <View
                style={[
                  styles.priceBreakdownBanner,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#F0FDF4',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#BBF7D0',
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.priceBreakdownTitle, { color: isDark ? '#86EFAC' : '#15803D' }]}>
                    Price Breakdown:
                  </Text>
                  <Text style={[styles.priceBreakdownSub, { color: isDark ? '#A7F3D0' : '#166534' }]}>
                    {sessionTier === 'PER_DAY'
                      ? '1 Day Single Session'
                      : sessionTier === 'WEEKLY'
                      ? '7 Consecutive Days Access'
                      : `${customDatesList.length || 1} Selected Session Date(s)`}
                    {selectedTrainer ? ` + ${selectedTrainer.name} Add-on` : ''}
                  </Text>
                </View>
                <View style={styles.autoCalcTag}>
                  <Text style={styles.autoCalcTagText}>₹{amount}</Text>
                </View>
              </View>

              {/* Entry Status Switch */}
              <Text style={[styles.fieldLabel, { color: isDark ? '#CBD5E1' : '#475569', marginTop: 12 }]}>
                Initial Entry Status <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.statusOptionsRow}>
                {ENTRY_STATUSES.map((st) => {
                  const isSelected = entryStatus === st.key;
                  return (
                    <TouchableOpacity
                      key={st.key}
                      style={[
                        styles.statusCard,
                        isSelected
                          ? {
                              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#F0FDF4',
                              borderColor: '#10B981',
                            }
                          : {
                              backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                            },
                      ]}
                      onPress={() => setEntryStatus(st.key)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.statusCardTop}>
                        <MaterialIcons
                          name={st.key === 'Checked-in' ? 'check-circle' : 'schedule'}
                          size={17}
                          color={isSelected ? '#10B981' : '#94A3B8'}
                        />
                        <Text
                          style={[
                            styles.statusCardTitle,
                            { color: isSelected ? '#10B981' : isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                        >
                          {st.label}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.statusCardSub,
                          { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' },
                        ]}
                      >
                        {st.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Sticky Bottom Footer Actions */}
          <View
            style={[
              styles.actionFooter,
              {
                borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? AppColors.darkSurface : '#F1F5F9',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: AppColors.primaryColor, opacity: isSubmitting ? 0.75 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="add-task" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Confirm & Create</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  scrollBody: {
    paddingBottom: 16,
  },
  formGroup: {
    marginTop: 14,
  },
  groupHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputWrap: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 5,
  },
  requiredStar: {
    color: '#EF4444',
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13.5,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
  },
  countryCodeBox: {
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(148, 163, 184, 0.25)',
  },
  countryCodeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  phoneTextInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 10,
    fontSize: 13.5,
  },
  tierSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tierCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  tierCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  tierTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  tierSub: {
    fontSize: 10,
  },
  customDatesBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  customDatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  customDatesTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  addDateInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  customDateInput: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  addDateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 8,
    gap: 4,
  },
  addDateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  presetChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
  },
  presetChipText: {
    color: '#7C3AED',
    fontSize: 10.5,
    fontWeight: '600',
  },
  datesChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 6,
  },
  dateTagText: {
    fontSize: 11.5,
    color: '#6B21A8',
    fontWeight: '600',
  },
  activityOptionsList: {
    gap: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  activityCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activityIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityCardTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  activityCardSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  trainersScroll: {
    flexDirection: 'row',
  },
  trainerChipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  trainerChipText: {
    fontSize: 12,
  },
  timeSlotChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
  },
  timeSlotChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  payMethodsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  payMethodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  payMethodText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  priceBreakdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  priceBreakdownTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  priceBreakdownSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  autoCalcTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  autoCalcTagText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  statusOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statusCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 2,
  },
  statusCardTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusCardSub: {
    fontSize: 10,
  },
  actionFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 3,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

