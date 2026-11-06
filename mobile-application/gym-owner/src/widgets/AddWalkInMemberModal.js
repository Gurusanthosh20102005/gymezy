import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from './CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { pickImageFromDevice, capturePhotoFromCamera } from '../utils/filePickerUtils';

export const DEFAULT_MEMBERSHIP_PLANS = [
  { key: 'monthly', tier: 'Monthly', name: 'Silver (1 Month)', durationDays: 30, price: 1599, features: ['Gym Access', 'Locker Room', 'Floor Guidance'] },
  { key: 'quarterly', tier: 'Quarterly', name: 'Gold (3 Months)', durationDays: 90, price: 4499, features: ['All Facilities', 'Diet Consultation', 'Free Steam Bath'] },
  { key: 'half_yearly', tier: 'Half Yearly', name: 'Platinum (6 Months)', durationDays: 180, price: 7999, features: ['VIP Access', 'Trainer Guidance', 'Free Locker'] },
  { key: 'annual', tier: 'Annual', name: 'Annual VIP (12 Months)', durationDays: 365, price: 14999, features: ['Unlimited VIP', 'Personalized Diet', 'Priority Slots'] },
];

export const PAYMENT_METHODS = [
  { key: 'Cash', label: 'Cash at Desk', icon: 'payments' },
  { key: 'UPI', label: 'Counter UPI / QR', icon: 'qr-code-2' },
  { key: 'Card', label: 'Card / POS Swipe', icon: 'credit-card' },
];

const formatDateYYYYMMDD = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * AddWalkInMemberModal - Front-Desk Walk-in Member Registration
 * Replicates the exact registration feature from the Gym Owner Web Console (MembersManagement.jsx)
 */
export const AddWalkInMemberModal = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { gym, user } = useAuth();

  const targetGymId = gym?._id || gym?.id || user?.gymId;

  // Form Fields
  const [photoUri, setPhotoUri] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');

  // Plan Selection
  const [selectedPlanKey, setSelectedPlanKey] = useState('monthly');
  const [startDate, setStartDate] = useState(formatDateYYYYMMDD(new Date()));

  // Personal Trainer Selection
  const [gymTrainers, setGymTrainers] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState('none');

  // Payment & Pricing
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [manualPriceOverride, setManualPriceOverride] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load available plans from gym profile or defaults
  const activePlans = useMemo(() => {
    if (Array.isArray(gym?.pricingPlans) && gym.pricingPlans.length > 0) {
      return gym.pricingPlans.map((p, idx) => {
        const tierName = p.tier || p.name || `Plan ${idx + 1}`;
        const tierLower = tierName.toLowerCase();
        let days = 30;
        let cleanTier = 'Monthly';
        if (tierLower.includes('annual') || tierLower.includes('year') || (p.duration && p.duration.includes('12'))) {
          days = 365;
          cleanTier = 'Annual';
        } else if (tierLower.includes('half') || (p.duration && p.duration.includes('6'))) {
          days = 180;
          cleanTier = 'Half Yearly';
        } else if (tierLower.includes('quarter') || (p.duration && p.duration.includes('3'))) {
          days = 90;
          cleanTier = 'Quarterly';
        }
        return {
          key: p._id || p.id || `plan-${idx}`,
          tier: cleanTier,
          name: p.name || tierName,
          durationDays: p.durationDays || days,
          price: Number(p.offerPrice || p.price || p.basePrice || 1599),
          features: Array.isArray(p.features) && p.features.length > 0
            ? p.features
            : ['Unlimited Gym Access', 'All Facilities', 'Floor Guidance'],
        };
      });
    }
    return DEFAULT_MEMBERSHIP_PLANS;
  }, [gym?.pricingPlans]);

  // Selected Plan Object
  const selectedPlanObj = useMemo(() => {
    return activePlans.find((p) => p.key === selectedPlanKey) || activePlans[0] || DEFAULT_MEMBERSHIP_PLANS[0];
  }, [activePlans, selectedPlanKey]);

  // Calculate validity end date
  const calculatedEndDate = useMemo(() => {
    try {
      const start = new Date(startDate);
      const days = selectedPlanObj?.durationDays || 30;
      return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    } catch {
      return new Date();
    }
  }, [startDate, selectedPlanObj]);

  // Fetch employees/trainers
  const loadTrainers = useCallback(async () => {
    try {
      const employees = await apiService.getEmployees().catch(() => []);
      if (Array.isArray(employees)) {
        const trainers = employees.filter(
          (e) => (e.role || '').toLowerCase().includes('trainer') || (e.role || '').toLowerCase().includes('coach')
        );
        setGymTrainers(trainers.length > 0 ? trainers : employees);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadTrainers();
    }
  }, [visible, loadTrainers]);

  // Active selected trainer
  const activeSelectedTrainer = useMemo(() => {
    if (selectedTrainerId === 'none') return null;
    return gymTrainers.find((t) => String(t._id || t.id || t.employeeId) === String(selectedTrainerId));
  }, [selectedTrainerId, gymTrainers]);

  // Trainer fee for the selected plan tier
  const trainerFee = useMemo(() => {
    if (!activeSelectedTrainer) return 0;
    const tier = (selectedPlanObj?.tier || 'Monthly').toLowerCase();
    const pricing = activeSelectedTrainer.trainerPricing || {};
    if (tier.includes('annual')) return Number(pricing.yearly || pricing.annual || 15000);
    if (tier.includes('half')) return Number(pricing.halfYearly || 8000);
    if (tier.includes('quarter')) return Number(pricing.quarterly || 4500);
    return Number(pricing.monthly || 1800);
  }, [activeSelectedTrainer, selectedPlanObj]);

  // Auto-calculated total price
  const basePlanPrice = selectedPlanObj?.price || 1599;
  const calculatedTotal = basePlanPrice + trainerFee;
  const effectiveAmount = manualPriceOverride !== '' ? Number(manualPriceOverride) : calculatedTotal;

  // Handle Photo Picker
  const handleSelectPhoto = () => {
    Alert.alert('Member Profile Photo', 'Upload photo for offline walk-in member', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Take Photo',
        onPress: async () => {
          try {
            const photo = await capturePhotoFromCamera();
            if (photo?.uri) setPhotoUri(photo.uri);
          } catch (e) {
            console.warn('Camera error:', e.message);
          }
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const photo = await pickImageFromDevice();
            if (photo?.uri) setPhotoUri(photo.uri);
          } catch (e) {
            console.warn('Gallery error:', e.message);
          }
        },
      },
    ]);
  };

  // Reset form
  const handleReset = () => {
    setPhotoUri(null);
    setCustomerName('');
    setPhone('');
    setEmail('');
    setSelectedPlanKey(activePlans[0]?.key || 'monthly');
    setStartDate(formatDateYYYYMMDD(new Date()));
    setSelectedTrainerId('none');
    setPaymentMethod('Cash');
    setManualPriceOverride('');
    setNotes('');
  };

  // Submit Registration
  const handleSubmit = async () => {
    if (!customerName.trim()) {
      showToast({ message: 'Please enter customer full name.', isError: true });
      return;
    }

    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.length < 10) {
      showToast({ message: 'Please enter a valid 10-digit phone number.', isError: true });
      return;
    }

    if (!targetGymId) {
      showToast({ message: 'Gym information missing. Please re-login.', isError: true });
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        name: customerName.trim(),
        customerName: customerName.trim(),
        phone: `${countryCode} ${cleanPhone.slice(-10)}`.trim(),
        email: email.trim() || undefined,
        avatar: photoUri || undefined,
        tier: selectedPlanObj?.tier || 'Monthly',
        price: basePlanPrice,
        amount: effectiveAmount,
        startDate: startDate,
        endDate: formatDateYYYYMMDD(calculatedEndDate),
        trainerId: activeSelectedTrainer ? (activeSelectedTrainer._id || activeSelectedTrainer.id) : null,
        trainerFee: trainerFee,
        paymentMethod: paymentMethod,
        paymentStatus: 'Completed',
        notes: notes.trim() || undefined,
      };

      const result = await apiService.createWalkInMembership(targetGymId, payload);

      showToast({
        message: `Walk-in member ${customerName.trim()} registered successfully!`,
        isSuccess: true,
      });

      handleReset();
      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      showToast({
        message: err.message || 'Failed to register walk-in member.',
        isError: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerTitleBox}>
              <View style={[styles.headerIconBadge, { backgroundColor: 'rgba(0, 56, 130, 0.12)' }]}>
                <MaterialIcons name="person-add" size={20} color={AppColors.primaryColor} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  New Walk-in Member
                </Text>
                <Text style={[styles.modalSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Desk POS • Register recurring membership
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          {/* Form Content */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Member Photo Upload Box */}
            <View style={styles.photoRow}>
              <TouchableOpacity
                onPress={handleSelectPhoto}
                style={[
                  styles.photoUploadBox,
                  {
                    backgroundColor: isDark ? '#141414' : '#F8FAFC',
                    borderColor: photoUri ? AppColors.primaryColor : isDark ? '#333333' : '#CBD5E1',
                  },
                ]}
                activeOpacity={0.8}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.uploadedPhoto} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <MaterialIcons name="add-a-photo" size={24} color={AppColors.primaryColor} />
                    <Text style={[styles.photoUploadText, { color: AppColors.primaryColor }]}>Upload Photo</Text>
                    <Text style={[styles.photoUploadSub, { color: isDark ? '#888888' : '#94A3B8' }]}>Camera / Gallery</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.photoInfoBox}>
                <Text style={[styles.sectionLabel, { color: isDark ? '#E2E8F0' : '#1E293B', marginBottom: 2 }]}>
                  Member Profile Picture
                </Text>
                <Text style={[styles.inputSubNote, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Optional photo for front-desk turnstile verification & member roster card.
                </Text>
                {photoUri && (
                  <TouchableOpacity onPress={() => setPhotoUri(null)} style={{ marginTop: 6 }}>
                    <Text style={{ color: '#EF4444', fontSize: 11.5, fontWeight: '700' }}>Remove Photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 2. Customer Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                Customer Full Name <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? '#141414' : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                  },
                ]}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={customerName}
                onChangeText={setCustomerName}
              />
            </View>

            {/* 3. Phone Number */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                Phone Number <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.phoneInputRow}>
                <View
                  style={[
                    styles.countryCodeBadge,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
                      borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                    },
                  ]}
                >
                  <Text style={[styles.countryCodeText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {countryCode}
                  </Text>
                </View>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      flex: 1,
                      backgroundColor: isDark ? '#141414' : '#F8FAFC',
                      borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                      color: isDark ? '#FFFFFF' : '#0F172A',
                    },
                  ]}
                  placeholder="9876543210"
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
            </View>

            {/* 4. Email Address */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                Email Address (Optional)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? '#141414' : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                  },
                ]}
                placeholder="ramesh@gmail.com"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {/* 5. Membership Plan Selector */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                Select Membership Plan <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.planCardsGrid}>
                {activePlans.map((plan) => {
                  const isSelected = plan.key === selectedPlanKey;
                  return (
                    <TouchableOpacity
                      key={plan.key}
                      style={[
                        styles.planCard,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(0, 56, 130, 0.28)'
                              : '#EDF4FE'
                            : isDark
                            ? '#141414'
                            : '#F8FAFC',
                          borderColor: isSelected ? AppColors.primaryColor : isDark ? AppColors.darkBorder : '#E2E8F0',
                        },
                      ]}
                      onPress={() => setSelectedPlanKey(plan.key)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.planCardTop}>
                        <Text
                          style={[
                            styles.planCardTitle,
                            { color: isSelected ? AppColors.primaryColor : isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                          numberOfLines={1}
                        >
                          {plan.name}
                        </Text>
                        {isSelected && (
                          <MaterialIcons name="check-circle" size={16} color={AppColors.primaryColor} />
                        )}
                      </View>
                      <Text style={[styles.planCardPrice, { color: isDark ? '#93C5FD' : '#003882' }]}>
                        ₹{plan.price.toLocaleString('en-IN')}
                      </Text>
                      <Text style={[styles.planCardDuration, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        {plan.durationDays} Days Access
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Plan Perks Banner */}
              <View
                style={[
                  styles.perksBanner,
                  {
                    backgroundColor: isDark ? 'rgba(0, 56, 130, 0.12)' : '#EDF4FE',
                    borderColor: isDark ? 'rgba(0, 56, 130, 0.25)' : '#BFDBFE',
                  },
                ]}
              >
                <Ionicons name="sparkles" size={15} color={AppColors.primaryColor} style={{ marginTop: 1 }} />
                <Text style={[styles.perksText, { color: isDark ? '#BFDBFE' : '#003882' }]}>
                  {selectedPlanObj?.features?.join('  •  ')}
                </Text>
              </View>
            </View>

            {/* 6. Start Date & Validity Banner */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                Membership Start Date
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? '#141414' : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                  },
                ]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={startDate}
                onChangeText={setStartDate}
              />

              {/* Auto Validity Summary */}
              <View
                style={[
                  styles.validitySummaryBanner,
                  {
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
                    borderColor: isDark ? 'rgba(16, 185, 129, 0.25)' : '#A7F3D0',
                  },
                ]}
              >
                <MaterialIcons name="event-available" size={18} color="#10B981" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[styles.validityTitle, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                    Starts on {formatDateDisplay(startDate)}
                  </Text>
                  <Text style={[styles.validitySub, { color: isDark ? '#6EE7B7' : '#047857' }]}>
                    Valid until {formatDateDisplay(calculatedEndDate)} ({selectedPlanObj?.durationDays || 30} Days)
                  </Text>
                </View>
              </View>
            </View>

            {/* 7. Personal Trainer (Optional Add-on) */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                Personal Trainer Add-on (Optional)
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.trainerChip,
                    selectedTrainerId === 'none' && styles.trainerChipActive,
                    {
                      backgroundColor: selectedTrainerId === 'none'
                        ? (isDark ? 'rgba(0, 56, 130, 0.25)' : '#EDF4FE')
                        : (isDark ? '#141414' : '#F8FAFC'),
                      borderColor: selectedTrainerId === 'none' ? AppColors.primaryColor : isDark ? AppColors.darkBorder : '#E2E8F0',
                    },
                  ]}
                  onPress={() => setSelectedTrainerId('none')}
                >
                  <MaterialIcons
                    name="fitness-center"
                    size={16}
                    color={selectedTrainerId === 'none' ? AppColors.primaryColor : isDark ? '#94A3B8' : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.trainerChipText,
                      { color: selectedTrainerId === 'none' ? AppColors.primaryColor : isDark ? '#FFFFFF' : '#0F172A' },
                    ]}
                  >
                    No Trainer (General)
                  </Text>
                </TouchableOpacity>

                {gymTrainers.map((tr) => {
                  const trId = String(tr._id || tr.id || tr.employeeId);
                  const isSelected = selectedTrainerId === trId;
                  return (
                    <TouchableOpacity
                      key={trId}
                      style={[
                        styles.trainerChip,
                        isSelected && styles.trainerChipActive,
                        {
                          backgroundColor: isSelected
                            ? (isDark ? 'rgba(0, 56, 130, 0.25)' : '#EDF4FE')
                            : (isDark ? '#141414' : '#F8FAFC'),
                          borderColor: isSelected ? AppColors.primaryColor : isDark ? AppColors.darkBorder : '#E2E8F0',
                        },
                      ]}
                      onPress={() => setSelectedTrainerId(trId)}
                    >
                      <MaterialIcons
                        name="person"
                        size={16}
                        color={isSelected ? AppColors.primaryColor : isDark ? '#94A3B8' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.trainerChipText,
                          { color: isSelected ? AppColors.primaryColor : isDark ? '#FFFFFF' : '#0F172A' },
                        ]}
                      >
                        {tr.name} (+₹{trainerFee})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 8. Payment Method */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#1E293B' }]}>
                Payment Mode <Text style={styles.requiredAsterisk}>*</Text>
              </Text>
              <View style={styles.paymentRow}>
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method.key;
                  return (
                    <TouchableOpacity
                      key={method.key}
                      style={[
                        styles.paymentCard,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(0, 56, 130, 0.25)'
                              : '#EDF4FE'
                            : isDark
                            ? '#141414'
                            : '#F8FAFC',
                          borderColor: isSelected ? AppColors.primaryColor : isDark ? AppColors.darkBorder : '#E2E8F0',
                        },
                      ]}
                      onPress={() => setPaymentMethod(method.key)}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={method.icon}
                        size={20}
                        color={isSelected ? AppColors.primaryColor : isDark ? '#94A3B8' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.paymentCardText,
                          { color: isSelected ? AppColors.primaryColor : isDark ? '#FFFFFF' : '#0F172A' },
                        ]}
                      >
                        {method.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 9. Live Pricing Breakdown Banner */}
            <View
              style={[
                styles.pricingBanner,
                {
                  backgroundColor: isDark ? '#141414' : '#F1F5F9',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.pricingRow}>
                <Text style={[styles.pricingLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Base Plan Fee ({selectedPlanObj?.name}):
                </Text>
                <Text style={[styles.pricingVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  ₹{basePlanPrice.toLocaleString('en-IN')}
                </Text>
              </View>
              {trainerFee > 0 && (
                <View style={styles.pricingRow}>
                  <Text style={[styles.pricingLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Personal Trainer Add-on ({activeSelectedTrainer?.name}):
                  </Text>
                  <Text style={[styles.pricingVal, { color: '#2563EB' }]}>
                    +₹{trainerFee.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.pricingDivider,
                  { backgroundColor: isDark ? AppColors.darkBorder : '#E2E8F0' },
                ]}
              />
              <View style={styles.pricingRow}>
                <Text style={[styles.totalLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Total Fee Payable:
                </Text>
                <Text style={[styles.totalVal, { color: AppColors.primaryColor }]}>
                  ₹{effectiveAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Price Override (Optional) */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputSubNote, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4 }]}>
                Manual Price Override (Optional):
              </Text>
              <TextInput
                style={[
                  styles.textInputSmall,
                  {
                    backgroundColor: isDark ? '#141414' : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                  },
                ]}
                placeholder={`Leave blank for auto ₹${calculatedTotal}`}
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                keyboardType="numeric"
                value={manualPriceOverride}
                onChangeText={setManualPriceOverride}
              />
            </View>
          </ScrollView>

          {/* Sticky Bottom Actions */}
          <View
            style={[
              styles.footerRow,
              {
                borderTopColor: isDark ? AppColors.darkBorder : '#F1F5F9',
                paddingBottom: insets.bottom > 0 ? insets.bottom + 10 : 16,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                { borderColor: isDark ? AppColors.darkBorder : '#CBD5E1' },
              ]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={[styles.cancelBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="how-to-reg" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.submitBtnText}>Register Member</Text>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 30,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  photoUploadBox: {
    width: 90,
    height: 90,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  uploadedPhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  photoUploadText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  photoUploadSub: {
    fontSize: 9,
    marginTop: 1,
  },
  photoInfoBox: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  requiredAsterisk: {
    color: '#EF4444',
  },
  inputSubNote: {
    fontSize: 11.5,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13.5,
    fontWeight: '500',
  },
  textInputSmall: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 12.5,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCodeBadge: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  planCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  planCard: {
    width: '48.5%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  planCardPrice: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  planCardDuration: {
    fontSize: 10.5,
    marginTop: 2,
  },
  perksBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  perksText: {
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
  },
  validitySummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  validityTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  validitySub: {
    fontSize: 11,
    marginTop: 2,
  },
  trainerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  trainerChipActive: {
    borderWidth: 1.5,
  },
  trainerChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  paymentCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 4,
  },
  paymentCardText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  pricingBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  pricingLabel: {
    fontSize: 12,
  },
  pricingVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  pricingDivider: {
    height: 1,
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  totalVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 2,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});

