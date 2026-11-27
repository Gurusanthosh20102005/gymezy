import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Image,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { apiService } from '../services/apiService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALL_FACILITIES = [
  'Air Conditioned',
  'Locker Facility',
  'Shower Available',
  'Changing Rooms',
  'Free Wi-Fi',
  'Sound & Music System',
  'Steam & Sauna',
  'Ice Bath Recovery',
  'Dedicated Parking',
  'Turnstile Gate Access',
  'First Aid Kit',
  '24/7 CCTV Security',
  'Biometric Entry',
  'Personal Trainers Available',
  'Cardio Theater',
  'Olympic Barbells Area',
];

const AMENITY_OPTIONS = [
  'RO Drinking Water',
  'Towel Service',
  'Protein Shake Bar',
  'Juice & Smoothie Bar',
  'Personal Locker Rental',
  'InBody BMI Scanner',
  'Nutritionist Desk',
  'Lounge / Rest Area',
  'Free Sanitizer Stations',
  'Locker Key Padlocks',
];

const ALL_WORKOUTS = [
  'Strength & Weights',
  'Cardio & Endurance',
  'CrossFit Studio',
  'HIIT Functional Training',
  'Powerlifting',
  'Bodybuilding',
  'Yoga & Flexibility',
  'Zumba / Dance Fitness',
  'Boxing / MMA / Kickboxing',
  'Calisthenics Floor',
  'Pilates & Core',
  'Aerobics',
];

export const ApplicationStatusScreen = ({ navigation }) => {
  const { isDark, toggleTheme } = useTheme();
  const { user, gym, updateGym, logout } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [refreshing, setRefreshing] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTab, setEditTab] = useState('business');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editResubmitFlag, setEditResubmitFlag] = useState(true);
  const [editResubmitNotes, setEditResubmitNotes] = useState('');

  // Edit Form Fields
  const [formName, setFormName] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBusinessType, setFormBusinessType] = useState('Private Limited');
  const [formYearEstablished, setFormYearEstablished] = useState('');
  const [formSubscriptionType, setFormSubscriptionType] = useState('Hybrid');
  const [formGstNumber, setFormGstNumber] = useState('');
  const [formPanNumber, setFormPanNumber] = useState('');

  const [formAddress, setFormAddress] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formPincode, setFormPincode] = useState('');
  const [formGoogleMapsUrl, setFormGoogleMapsUrl] = useState('');

  const [formTimingMode, setFormTimingMode] = useState('REGULAR');
  const [formWeekdayOpen, setFormWeekdayOpen] = useState('05:30 AM');
  const [formWeekdayClose, setFormWeekdayClose] = useState('10:30 PM');
  const [formWeekendOpen, setFormWeekendOpen] = useState('06:00 AM');
  const [formWeekendClose, setFormWeekendClose] = useState('09:00 PM');
  const [formMorningOpen, setFormMorningOpen] = useState('05:30 AM');
  const [formMorningClose, setFormMorningClose] = useState('11:30 AM');
  const [formEveningOpen, setFormEveningOpen] = useState('04:30 PM');
  const [formEveningClose, setFormEveningClose] = useState('10:30 PM');

  const [formSinglePrice, setFormSinglePrice] = useState('199');
  const [formMonthlyPrice, setFormMonthlyPrice] = useState('1999');
  const [formQuarterlyPrice, setFormQuarterlyPrice] = useState('4999');
  const [formAnnualPrice, setFormAnnualPrice] = useState('14999');

  const [formFacilities, setFormFacilities] = useState([]);
  const [formAmenities, setFormAmenities] = useState([]);
  const [formWorkouts, setFormWorkouts] = useState([]);

  const [formAccountHolder, setFormAccountHolder] = useState('');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formIfscCode, setFormIfscCode] = useState('');
  const [formUpiId, setFormUpiId] = useState('');

  const currentGym = gym || {};
  const galleryPhotos = Array.isArray(currentGym.galleryPhotos)
    ? currentGym.galleryPhotos
        .filter(Boolean)
        .map((photo) => (typeof photo === 'string' ? { fileName: '', fileData: photo } : photo))
    : [];
  const partnerIdDisplay =
    currentGym.partnerId && !/^[0-9a-fA-F]{24}$/.test(currentGym.partnerId) && currentGym.partnerId !== '-'
      ? currentGym.partnerId
      : '-';
  const approvalStatus = currentGym.approvalStatus || 'Pending Approval';
  const isApproved = approvalStatus === 'Approved';
  const isOnHold = approvalStatus === 'On Hold';
  const isRejected = approvalStatus === 'Rejected';
  const isPending = approvalStatus === 'Pending Approval' || (!isApproved && !isOnHold && !isRejected);
  const adminRemark = currentGym.remark || currentGym.rejectionReason || '';

  useEffect(() => {
    let isMounted = true;
    const syncFromDb = async () => {
      try {
        const sessionData = await apiService.getCurrentUser();
        if (isMounted && sessionData?.gym) {
          updateGym(sessionData.gym);
          if (sessionData.gym.approvalStatus === 'Approved') {
            navigation.replace('Dashboard');
          }
        }
      } catch {
        // Silent background sync; user can also tap Refresh
      }
    };
    syncFromDb();
    return () => {
      isMounted = false;
    };
  }, [navigation, updateGym]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const sessionData = await apiService.getCurrentUser();
      if (sessionData?.gym) {
        updateGym(sessionData.gym);
        const newStatus = sessionData.gym.approvalStatus || 'Pending Approval';
        if (newStatus === 'Approved') {
          showToast({ message: 'Gym partner account approved!', isSuccess: true });
          navigation.replace('Dashboard');
        } else {
          showToast({ message: `Status refreshed: ${newStatus}`, isInfo: true });
        }
      }
    } catch (err) {
      showToast({ message: err.message || 'Could not refresh status.', isError: true });
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenEdit = (tabKey = 'business') => {
    setEditTab(tabKey);
    setEditResubmitFlag(isOnHold || isRejected);
    setEditResubmitNotes('');

    setFormName(currentGym.name || '');
    setFormTagline(currentGym.tagline || '');
    setFormOwnerName(currentGym.ownerName || user?.fullName || '');
    setFormPhone(currentGym.phone || user?.phone || '');
    setFormEmail(currentGym.email || user?.email || '');
    setFormBusinessType(currentGym.businessType || 'Private Limited');
    setFormYearEstablished(String(currentGym.yearEstablished || ''));
    setFormSubscriptionType(currentGym.subscriptionType || 'Hybrid');
    setFormGstNumber(currentGym.gstNumber || '');
    setFormPanNumber(currentGym.panNumber || '');

    setFormAddress(currentGym.address || '');
    setFormArea(currentGym.area || '');
    setFormCity(currentGym.city || 'Chennai');
    setFormState(currentGym.state || 'Tamil Nadu');
    setFormPincode(currentGym.pincode || '');
    setFormGoogleMapsUrl(currentGym.googleMapsUrl || '');

    const opHours = currentGym.openingHours || {};
    const mode = opHours.mode || (opHours.is24Hours ? '24_HOURS' : (opHours.morningShift ? 'SPLIT_SHIFT' : 'REGULAR'));
    setFormTimingMode(mode);
    setFormWeekdayOpen(opHours.weekdayOpen || '05:30 AM');
    setFormWeekdayClose(opHours.weekdayClose || '10:30 PM');
    setFormWeekendOpen(opHours.weekendOpen || '06:00 AM');
    setFormWeekendClose(opHours.weekendClose || '09:00 PM');
    setFormMorningOpen(opHours.morningShift?.open || '05:30 AM');
    setFormMorningClose(opHours.morningShift?.close || '11:30 AM');
    setFormEveningOpen(opHours.eveningShift?.open || '04:30 PM');
    setFormEveningClose(opHours.eveningShift?.close || '10:30 PM');

    setFormSinglePrice(String(currentGym.singleSessionPrice || currentGym.pricingPlans?.singleSession || 199));
    setFormMonthlyPrice(String(currentGym.pricingPlans?.monthly || 1999));
    setFormQuarterlyPrice(String(currentGym.pricingPlans?.quarterly || 4999));
    setFormAnnualPrice(String(currentGym.pricingPlans?.annual || 14999));

    setFormFacilities(Array.isArray(currentGym.facilities) ? [...currentGym.facilities] : []);
    setFormAmenities(Array.isArray(currentGym.amenities) ? [...currentGym.amenities] : []);
    setFormWorkouts(Array.isArray(currentGym.workouts) ? [...currentGym.workouts] : []);

    setFormAccountHolder(currentGym.bankDetails?.accountHolder || '');
    setFormBankName(currentGym.bankDetails?.bankName || '');
    setFormAccountNumber(currentGym.bankDetails?.accountNumber || '');
    setFormIfscCode(currentGym.bankDetails?.ifscCode || '');
    setFormUpiId(currentGym.bankDetails?.upiId || '');

    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    const gymId = currentGym.id || currentGym._id;
    if (!gymId) {
      showToast({ message: 'Gym ID not found. Please log in again.', isError: true });
      return;
    }

    if (!formName.trim()) {
      showToast({ message: 'Gym name is required.', isError: true });
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        name: formName.trim(),
        tagline: formTagline.trim(),
        ownerName: formOwnerName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        businessType: formBusinessType,
        yearEstablished: formYearEstablished ? Number(formYearEstablished) : undefined,
        subscriptionType: formSubscriptionType,
        gstNumber: formGstNumber.trim(),
        panNumber: formPanNumber.trim(),

        address: formAddress.trim(),
        area: formArea.trim(),
        city: formCity.trim(),
        state: formState.trim(),
        pincode: formPincode.trim(),
        googleMapsUrl: formGoogleMapsUrl.trim(),

        openingHours: {
          mode: formTimingMode,
          weekdayOpen: formTimingMode === 'SPLIT_SHIFT' ? formMorningOpen : (formTimingMode === '24_HOURS' ? '12:00 AM' : formWeekdayOpen),
          weekdayClose: formTimingMode === 'SPLIT_SHIFT' ? formEveningClose : (formTimingMode === '24_HOURS' ? '11:59 PM' : formWeekdayClose),
          weekendOpen: formTimingMode === 'SPLIT_SHIFT' ? formMorningOpen : (formTimingMode === '24_HOURS' ? '12:00 AM' : formWeekendOpen),
          weekendClose: formTimingMode === 'SPLIT_SHIFT' ? formEveningClose : (formTimingMode === '24_HOURS' ? '11:59 PM' : formWeekendClose),
          is24Hours: formTimingMode === '24_HOURS',
          morningShift: formTimingMode === 'SPLIT_SHIFT' ? { open: formMorningOpen, close: formMorningClose } : undefined,
          eveningShift: formTimingMode === 'SPLIT_SHIFT' ? { open: formEveningOpen, close: formEveningClose } : undefined,
          displayText: formTimingMode === '24_HOURS' ? 'Open 24 Hours' : formTimingMode === 'SPLIT_SHIFT' ? `${formMorningOpen} - ${formMorningClose} & ${formEveningOpen} - ${formEveningClose}` : `${formWeekdayOpen} - ${formWeekdayClose}`,
        },

        singleSessionPrice: Number(formSinglePrice) || 199,
        pricingPlans: {
          singleSession: Number(formSinglePrice) || 199,
          monthly: Number(formMonthlyPrice) || 1999,
          quarterly: Number(formQuarterlyPrice) || 4999,
          annual: Number(formAnnualPrice) || 14999,
        },

        facilities: formFacilities,
        amenities: formAmenities,
        workouts: formWorkouts,

        bankDetails: {
          accountHolder: formAccountHolder.trim(),
          bankName: formBankName.trim(),
          accountNumber: formAccountNumber.trim(),
          ifscCode: formIfscCode.trim(),
          upiId: formUpiId.trim(),
        },

        resubmit: editResubmitFlag,
        resubmitNotes: editResubmitNotes.trim(),
        resubmissionNote: editResubmitNotes.trim(),
      };

      const updated = await apiService.updateGym(gymId, payload);
      updateGym(updated);
      setIsEditModalOpen(false);
      showToast({
        message: editResubmitFlag
          ? 'Application updated and resubmitted for verification!'
          : 'Gym details saved successfully.',
        isSuccess: true,
      });
      await handleRefresh();
    } catch (err) {
      showToast({ message: err.message || 'Failed to save changes.', isError: true });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResubmitApplication = async () => {
    const gymId = currentGym.id || currentGym._id;
    if (!gymId) {
      showToast({ message: 'Gym ID missing.', isError: true });
      return;
    }

    setResubmitting(true);
    try {
      await apiService.resubmitGym(gymId, resubmitNotes, resubmitNotes);
      showToast({ message: 'Application resubmitted to Super Admin for verification.', isSuccess: true });
      setResubmitModalOpen(false);
      setResubmitNotes('');
      await handleRefresh();
    } catch (err) {
      showToast({ message: err.message || 'Resubmit failed.', isError: true });
    } finally {
      setResubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigation.replace('Login');
  };

  const toggleFacility = (item) => {
    setFormFacilities((prev) =>
      prev.includes(item) ? prev.filter((f) => f !== item) : [...prev, item]
    );
  };

  const toggleAmenity = (item) => {
    setFormAmenities((prev) =>
      prev.includes(item) ? prev.filter((a) => a !== item) : [...prev, item]
    );
  };

  const toggleWorkout = (item) => {
    setFormWorkouts((prev) =>
      prev.includes(item) ? prev.filter((w) => w !== item) : [...prev, item]
    );
  };

  // Color tokens
  const pageBg = isDark ? '#000000' : '#FFFFFF';
  const cardBg = isDark ? '#0D0D0D' : '#F8FAFC';
  const borderCol = isDark ? '#222222' : '#E2E8F0';
  const textPrimary = isDark ? '#FFFFFF' : '#0F172A';
  const textSecondary = isDark ? '#94A3B8' : '#64748B';
  const textMuted = isDark ? '#64748B' : '#94A3B8';

  const getStatusColor = () => {
    if (isApproved) return '#10B981';
    if (isOnHold) return '#F59E0B';
    if (isRejected) return '#EF4444';
    return '#F59E0B';
  };

  const getStatusLabel = () => {
    if (isApproved) return 'Approved';
    if (isOnHold) return 'On Hold';
    if (isRejected) return 'Changes Requested';
    return 'Pending Approval';
  };

  const submissionDateStr = currentGym.createdAt
    ? new Date(currentGym.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={pageBg}
      />

      {/* HEADER BAR */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: pageBg,
            borderBottomColor: borderCol,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Image
            source={require('../../assets/logo/gymezy.png')}
            style={{
              width: 28,
              height: 28,
              tintColor: isDark ? '#FFFFFF' : undefined,
            }}
            resizeMode="contain"
          />
          <Text style={[styles.headerTitle, { color: textPrimary }]}>GYMEZY</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.themeBtn, { borderColor: borderCol }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Icon
              name={isDark ? 'nightlight-round' : 'wb-sunny'}
              size={16}
              color={isDark ? '#FACC15' : '#F97316'}
            />
            <Text style={[styles.themeBtnText, { color: textSecondary }]}>
              {isDark ? 'Night' : 'Day'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: borderCol }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Icon name="logout" size={16} color={textSecondary} />
            <Text style={[styles.signOutBtnText, { color: textSecondary }]}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* SUBTITLE */}
        <Text style={[styles.partnerTag, { color: textMuted }]}>PARTNER REGISTRATION</Text>

        {/* GYM TITLE & STATUS */}
        <View style={styles.titleRow}>
          <Text style={[styles.gymNameTitle, { color: textPrimary }]}>
            {currentGym.name || 'Your Gym'}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <View style={[styles.statusPill, { borderColor: borderCol, backgroundColor: cardBg }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
              <Text style={[styles.statusPillText, { color: textPrimary }]}>{getStatusLabel()}</Text>
            </View>

            <View style={[styles.statusPill, { borderColor: borderCol, backgroundColor: cardBg }]}>
              <Text style={[styles.statusPillText, { color: textSecondary }]}>
                ID: {partnerIdDisplay}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.statusSubtext, { color: textSecondary }]}>
          {isApproved
            ? 'Your gym partner account is approved and active. You can manage your gym in the Owner Console.'
            : isRejected
            ? 'Review is complete and changes are required before activation. Please check the administrator note below, make the necessary updates, and resubmit.'
            : isOnHold
            ? 'Your application is currently on hold. Please review the administrator notes below, edit any required information, and resubmit when ready.'
            : `Submitted on ${submissionDateStr} by ${user?.fullName || currentGym.ownerName || 'Partner'}. The GYMEZY operations team is currently reviewing your registration.`}
        </Text>

        {/* TOP ACTIONS ROW */}
        <View style={styles.topActionsRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              {
                borderColor: '#2563EB',
                backgroundColor: isDark ? 'rgba(37,99,235,0.12)' : '#EFF6FF',
              },
            ]}
            onPress={() => handleOpenEdit('business')}
            activeOpacity={0.8}
          >
            <Icon name="edit" size={15} color="#2563EB" />
            <Text style={[styles.actionBtnText, { color: '#2563EB', fontWeight: '700' }]}>
              Edit Application
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: borderCol, backgroundColor: cardBg }]}
            onPress={handleRefresh}
            activeOpacity={0.8}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <>
                <Icon name="refresh" size={15} color={textPrimary} />
                <Text style={[styles.actionBtnText, { color: textPrimary }]}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: borderCol, backgroundColor: cardBg }]}
            onPress={() => setSupportModalOpen(true)}
            activeOpacity={0.8}
          >
            <Icon name="help-outline" size={15} color={textPrimary} />
            <Text style={[styles.actionBtnText, { color: textPrimary }]}>Support</Text>
          </TouchableOpacity>

          {(isOnHold || isRejected) && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isOnHold ? '#FA8C16' : '#2563EB',
                  borderColor: isOnHold ? '#FA8C16' : '#2563EB',
                },
              ]}
              onPress={() => setResubmitModalOpen(true)}
              activeOpacity={0.85}
            >
              <Icon name="send" size={14} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>
                Resubmit Application
              </Text>
            </TouchableOpacity>
          )}

          {isApproved && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                {
                  backgroundColor: '#003882',
                  borderColor: '#003882',
                },
              ]}
              onPress={() => navigation.replace('Dashboard')}
              activeOpacity={0.85}
            >
              <Icon name="arrow-forward" size={15} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>
                Dashboard
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* PROGRESS TIMELINE */}
        <View style={[styles.timelineCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
          <View style={styles.timelineStep}>
            <View style={styles.stepHeader}>
              <Icon name="check-circle" size={14} color="#10B981" />
              <Text style={[styles.stepTitle, { color: '#10B981' }]}>1. Submitted</Text>
            </View>
            <Text style={[styles.stepSub, { color: textMuted }]}>{submissionDateStr}</Text>
          </View>

          <View style={styles.timelineDivider} />

          <View style={styles.timelineStep}>
            <View style={styles.stepHeader}>
              <Icon
                name={isApproved ? 'check-circle' : 'pending'}
                size={14}
                color={isApproved ? '#10B981' : isRejected ? '#EF4444' : '#F59E0B'}
              />
              <Text
                style={[
                  styles.stepTitle,
                  { color: isApproved ? '#10B981' : isRejected ? '#EF4444' : '#F59E0B' },
                ]}
              >
                2. Review
              </Text>
            </View>
            <Text style={[styles.stepSub, { color: textMuted }]}>
              {isApproved ? 'Completed' : isRejected ? 'Action Needed' : 'In Progress'}
            </Text>
          </View>

          <View style={styles.timelineDivider} />

          <View style={styles.timelineStep}>
            <View style={styles.stepHeader}>
              <Icon
                name={isApproved ? 'verified' : 'radio-button-unchecked'}
                size={14}
                color={isApproved ? '#10B981' : textMuted}
              />
              <Text style={[styles.stepTitle, { color: isApproved ? '#10B981' : textMuted }]}>
                3. Activation
              </Text>
            </View>
            <Text style={[styles.stepSub, { color: textMuted }]}>
              {isApproved ? 'Live on GYMEZY' : 'Pending Review'}
            </Text>
          </View>
        </View>

        {/* 1. ADMIN REJECTION / HOLD FEEDBACK BANNER */}
        {Boolean(
          currentGym.rejectionReason ||
          currentGym.rejectionNote ||
          isOnHold ||
          isRejected ||
          (adminRemark && adminRemark !== 'Approved and published by Super Admin')
        ) && (
          <View
            style={[
              styles.adminNoteBanner,
              {
                backgroundColor: isDark ? '#1C1917' : (isOnHold ? '#FFFBEB' : '#FEF2F2'),
                borderColor: isOnHold ? '#F59E0B' : '#EF4444',
              },
            ]}
          >
            <View style={styles.adminNoteHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text
                  style={[
                    styles.adminNoteTitle,
                    { color: isOnHold ? '#F59E0B' : '#EF4444' },
                  ]}
                >
                  {isOnHold
                    ? 'ADMINISTRATOR NOTE — ON HOLD'
                    : isRejected
                    ? 'ADMINISTRATOR NOTE — CHANGES REQUIRED'
                    : 'ADMINISTRATOR NOTE'}
                </Text>

                {Boolean(currentGym.rejectionReason) && (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: isOnHold ? '#FEF3C7' : '#FEE2E2',
                      borderColor: isOnHold ? '#FDE68A' : '#FECACA',
                      borderWidth: 1,
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isOnHold ? '#B45309' : '#DC2626' }}>
                      Reason: {currentGym.rejectionReason}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.adminNoteActions}>
                <TouchableOpacity
                  style={[styles.smallEditBtn, { borderColor: isDark ? '#444' : '#CBD5E1' }]}
                  onPress={() => handleOpenEdit('business')}
                >
                  <Icon name="edit" size={13} color={textPrimary} />
                  <Text style={[styles.smallEditBtnText, { color: textPrimary }]}>Edit Info</Text>
                </TouchableOpacity>

                {(isOnHold || isRejected) && (
                  <TouchableOpacity
                    style={[styles.smallResubmitBtn, { backgroundColor: isRejected ? '#2563EB' : '#F59E0B' }]}
                    onPress={() => setResubmitModalOpen(true)}
                  >
                    <Icon name="send" size={13} color="#FFFFFF" />
                    <Text style={styles.smallResubmitBtnText}>Resubmit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 6,
                backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)',
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: isOnHold ? '#FDE68A' : '#FECACA',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: isOnHold ? '#D97706' : '#DC2626', marginBottom: 2 }}>
                Admin Note & Instructions:
              </Text>
              <Text style={[styles.adminNoteBody, { color: textPrimary }]}>
                {currentGym.rejectionNote || currentGym.remark || adminRemark || 'Please review requested updates and resubmit.'}
              </Text>
            </View>
          </View>
        )}

        {/* 2. OWNER RESUBMISSION NOTES BANNER */}
        {Boolean(currentGym.resubmissionNote) && (
          <View
            style={[
              styles.adminNoteBanner,
              {
                backgroundColor: isDark ? '#0F172A' : '#EFF6FF',
                borderColor: '#3B82F6',
              },
            ]}
          >
            <View style={styles.adminNoteHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="check-circle" size={16} color="#2563EB" />
                <Text style={[styles.adminNoteTitle, { color: '#2563EB' }]}>
                  YOUR RESUBMISSION EXPLANATION
                </Text>
              </View>
              {Boolean(currentGym.resubmittedAt) && (
                <Text style={{ fontSize: 11, color: textMuted }}>
                  {new Date(currentGym.resubmittedAt).toLocaleDateString()}
                </Text>
              )}
            </View>
            <View
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 6,
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderWidth: 1,
                borderColor: '#DBEAFE',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginBottom: 2, textTransform: 'uppercase' }}>
                Changes Submitted by You:
              </Text>
              <Text style={[styles.adminNoteBody, { color: textPrimary }]}>
                {currentGym.resubmissionNote}
              </Text>
            </View>
          </View>
        )}

        {/* SECTION 1: GYM DETAILS */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>GYM DETAILS</Text>
            <TouchableOpacity
              style={styles.editSectionBtn}
              onPress={() => handleOpenEdit('business')}
              activeOpacity={0.7}
            >
              <Icon name="edit" size={14} color="#2563EB" />
              <Text style={styles.editSectionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Owner Name</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.ownerName || user?.fullName || '—'}
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Email</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.email || user?.email || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Phone</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.phone || user?.phone || '—'}
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Established</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.yearEstablished || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Plan Model</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.subscriptionType || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>GST Number</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.gstNumber || '—'}
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>PAN Number</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.panNumber || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 2: LOCATION & SCHEDULE */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>LOCATION & SCHEDULE</Text>
            <TouchableOpacity
              style={styles.editSectionBtn}
              onPress={() => handleOpenEdit('location')}
              activeOpacity={0.7}
            >
              <Icon name="edit" size={14} color="#2563EB" />
              <Text style={styles.editSectionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={{ marginBottom: 14 }}>
              <Text style={[styles.fieldLabel, { color: textMuted }]}>Address</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 }}>
                <Icon name="place" size={16} color={textSecondary} style={{ marginTop: 2 }} />
                <Text style={[styles.fieldValue, { color: textPrimary, flex: 1, lineHeight: 19 }]}>
                  {[
                    currentGym.address,
                    currentGym.area,
                    currentGym.city,
                    currentGym.state,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  {currentGym.pincode ? ` - ${currentGym.pincode}` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Coordinates</Text>
                <Text style={[styles.fieldValue, { color: textPrimary, fontSize: 12 }]}>
                  {Array.isArray(currentGym.location?.coordinates) &&
                  currentGym.location.coordinates.length >= 2 &&
                  Number.isFinite(Number(currentGym.location.coordinates[0])) &&
                  Number.isFinite(Number(currentGym.location.coordinates[1]))
                    ? `${Number(currentGym.location.coordinates[1]).toFixed(4)}, ${Number(currentGym.location.coordinates[0]).toFixed(4)}`
                    : '—'}
                </Text>
              </View>

              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Floor Space & Capacity</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.floorSpaceSqFt || currentGym.maxFloorCapacity
                    ? `${currentGym.floorSpaceSqFt ?? '—'} sq.ft / ${currentGym.maxFloorCapacity ?? '—'} people`
                    : '—'}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 4 }}>
              <Text style={[styles.fieldLabel, { color: textMuted }]}>Opening Hours & Timing Model</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 4,
                    backgroundColor:
                      currentGym.openingHours?.mode === '24_HOURS' || currentGym.openingHours?.is24Hours
                        ? 'rgba(16, 185, 129, 0.14)'
                        : currentGym.openingHours?.mode === 'SPLIT_SHIFT' || currentGym.openingHours?.morningShift
                        ? 'rgba(147, 51, 234, 0.14)'
                        : 'rgba(37, 99, 235, 0.14)',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color:
                        currentGym.openingHours?.mode === '24_HOURS' || currentGym.openingHours?.is24Hours
                          ? '#10B981'
                          : currentGym.openingHours?.mode === 'SPLIT_SHIFT' || currentGym.openingHours?.morningShift
                          ? '#9333EA'
                          : '#2563EB',
                    }}
                  >
                    {currentGym.openingHours?.mode === '24_HOURS' || currentGym.openingHours?.is24Hours
                      ? '24/7 Access'
                      : currentGym.openingHours?.mode === 'SPLIT_SHIFT' || currentGym.openingHours?.morningShift
                      ? 'Split Shift'
                      : 'Single Shift'}
                  </Text>
                </View>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.openingHours?.displayText ||
                    (currentGym.openingHours?.mode === '24_HOURS' || currentGym.openingHours?.is24Hours
                      ? 'Open 24 Hours'
                      : currentGym.openingHours?.mode === 'SPLIT_SHIFT' || currentGym.openingHours?.morningShift
                      ? [
                          currentGym.openingHours?.morningShift?.open && currentGym.openingHours?.morningShift?.close
                            ? `${currentGym.openingHours.morningShift.open} - ${currentGym.openingHours.morningShift.close}`
                            : null,
                          currentGym.openingHours?.eveningShift?.open && currentGym.openingHours?.eveningShift?.close
                            ? `${currentGym.openingHours.eveningShift.open} - ${currentGym.openingHours.eveningShift.close}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' & ') || '—'
                      : currentGym.openingHours?.weekdayOpen && currentGym.openingHours?.weekdayClose
                      ? `${currentGym.openingHours.weekdayOpen} - ${currentGym.openingHours.weekdayClose}`
                      : '—')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 3: PRICING & PASSES */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>PRICING & PASSES</Text>
            <TouchableOpacity
              style={styles.editSectionBtn}
              onPress={() => handleOpenEdit('pricing')}
              activeOpacity={0.7}
            >
              <Icon name="edit" size={14} color="#2563EB" />
              <Text style={styles.editSectionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.pricingGrid}>
              <View style={[styles.priceBox, { borderColor: borderCol }]}>
                <Text style={[styles.priceTierName, { color: textMuted }]}>Single Session</Text>
                <Text style={[styles.priceAmount, { color: '#16A34A' }]}>
                  {(currentGym.singleSessionPrice ?? currentGym.pricingPlans?.singleSession) != null
                    ? `₹${currentGym.singleSessionPrice ?? currentGym.pricingPlans?.singleSession}`
                    : '—'}
                </Text>
              </View>
              <View style={[styles.priceBox, { borderColor: borderCol }]}>
                <Text style={[styles.priceTierName, { color: textMuted }]}>Monthly Pass</Text>
                <Text style={[styles.priceAmount, { color: textPrimary }]}>
                  {currentGym.pricingPlans?.monthly != null
                    ? `₹${currentGym.pricingPlans.monthly}`
                    : '—'}
                </Text>
              </View>
              <View style={[styles.priceBox, { borderColor: borderCol }]}>
                <Text style={[styles.priceTierName, { color: textMuted }]}>Quarterly (3M)</Text>
                <Text style={[styles.priceAmount, { color: textPrimary }]}>
                  {currentGym.pricingPlans?.quarterly != null
                    ? `₹${currentGym.pricingPlans.quarterly}`
                    : '—'}
                </Text>
              </View>
              <View style={[styles.priceBox, { borderColor: borderCol }]}>
                <Text style={[styles.priceTierName, { color: textMuted }]}>Annual Pass</Text>
                <Text style={[styles.priceAmount, { color: textPrimary }]}>
                  {currentGym.pricingPlans?.annual != null
                    ? `₹${currentGym.pricingPlans.annual}`
                    : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 4: FACILITIES & WORKOUT DISCIPLINES */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>
              FACILITIES & WORKOUT DISCIPLINES
            </Text>
            <TouchableOpacity
              style={styles.editSectionBtn}
              onPress={() => handleOpenEdit('facilities')}
              activeOpacity={0.7}
            >
              <Icon name="edit" size={14} color="#2563EB" />
              <Text style={styles.editSectionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.fieldLabel, { color: textMuted, textTransform: 'uppercase', marginBottom: 8 }]}>
              Active Facilities ({currentGym.facilities?.length || 0})
            </Text>
            {Array.isArray(currentGym.facilities) && currentGym.facilities.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {currentGym.facilities.map((f) => (
                  <View
                    key={f}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                      backgroundColor: isDark ? 'rgba(37,99,235,0.16)' : '#EFF6FF',
                      borderWidth: 1,
                      borderColor: isDark ? '#1D4ED8' : '#BFDBFE',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#93C5FD' : '#1D4ED8' }}>
                      {f}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: textMuted, marginBottom: 14 }}>None selected</Text>
            )}

            <Text style={[styles.fieldLabel, { color: textMuted, textTransform: 'uppercase', marginBottom: 8 }]}>
              Active Amenities ({currentGym.amenities?.length || 0})
            </Text>
            {Array.isArray(currentGym.amenities) && currentGym.amenities.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {currentGym.amenities.map((a) => (
                  <View
                    key={a}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                      backgroundColor: isDark ? 'rgba(6,182,212,0.16)' : '#ECFEFF',
                      borderWidth: 1,
                      borderColor: isDark ? '#0891B2' : '#A5F3FC',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#67E8F9' : '#0E7490' }}>
                      {a}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: textMuted, marginBottom: 14 }}>None selected</Text>
            )}

            <Text style={[styles.fieldLabel, { color: textMuted, textTransform: 'uppercase', marginBottom: 8 }]}>
              Workout Disciplines ({currentGym.workouts?.length || 0})
            </Text>
            {Array.isArray(currentGym.workouts) && currentGym.workouts.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {currentGym.workouts.map((w) => (
                  <View
                    key={w}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                      backgroundColor: isDark ? 'rgba(147,51,234,0.16)' : '#FAF5FF',
                      borderWidth: 1,
                      borderColor: isDark ? '#7E22CE' : '#E9D5FF',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#D8B4FE' : '#7E22CE' }}>
                      {w}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: textMuted }}>None selected</Text>
            )}
          </View>
        </View>

        {/* SECTION 4: SETTLEMENT BANK ACCOUNT */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: textPrimary }]}>SETTLEMENT BANK ACCOUNT</Text>
            <TouchableOpacity
              style={styles.editSectionBtn}
              onPress={() => handleOpenEdit('bank')}
              activeOpacity={0.7}
            >
              <Icon name="edit" size={14} color="#2563EB" />
              <Text style={styles.editSectionText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Account Holder</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.bankDetails?.accountHolder || '—'}
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Bank Name</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.bankDetails?.bankName || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>Account Number</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.bankDetails?.accountNumber
                    ? `•••• •••• ${currentGym.bankDetails.accountNumber.slice(-4)}`
                    : 'Not configured'}
                </Text>
              </View>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>IFSC Code</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.bankDetails?.ifscCode || '—'}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text style={[styles.fieldLabel, { color: textMuted }]}>UPI ID</Text>
                <Text style={[styles.fieldValue, { color: textPrimary }]}>
                  {currentGym.bankDetails?.upiId || '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* SECTION 6: FACILITY PHOTOS */}
        {galleryPhotos.length > 0 && (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>
                FACILITY PHOTOS ({galleryPhotos.length})
              </Text>
              <TouchableOpacity
                style={styles.editSectionBtn}
                onPress={() => handleOpenEdit('facilities')}
                activeOpacity={0.7}
              >
                <Icon name="edit" size={14} color="#2563EB" />
                <Text style={styles.editSectionText}>Manage Photos</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {galleryPhotos.map((photo, index) => {
                const src = typeof photo === 'string' ? photo : photo.fileData;
                if (!src) return null;
                return (
                  <View
                    key={photo.fileName || index}
                    style={{
                      width: 104,
                      height: 76,
                      borderRadius: 6,
                      overflow: 'hidden',
                      borderWidth: 1,
                      borderColor: borderCol,
                      backgroundColor: cardBg,
                    }}
                  >
                    <Image
                      source={{ uri: src }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* FOOTER */}
        <View
          style={{
            marginTop: 12,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: borderCol,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <Text style={{ fontSize: 11, color: textMuted }}>
            Need help? partners@gymezy.com · +91 98765 43210
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: textMuted }}>
            GYMEZY Partner Portal
          </Text>
        </View>
      </ScrollView>

      {/* =========================================================================
          COMPREHENSIVE EDIT MODAL / SHEET
      ========================================================================= */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={[styles.modalScreen, { backgroundColor: pageBg, paddingTop: insets.top }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderCol }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={[styles.modalCloseBtn, { borderColor: borderCol }]}
              >
                <Icon name="close" size={20} color={textPrimary} />
              </TouchableOpacity>
              <View>
                <Text style={[styles.modalHeaderTitle, { color: textPrimary }]}>Edit Gym Details</Text>
                <Text style={[styles.modalHeaderSubtitle, { color: textMuted }]}>
                  {currentGym.name || 'Gym Application'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveHeaderBtn, { backgroundColor: '#2563EB' }]}
              onPress={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveHeaderBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Modal Navigation Tabs */}
          <View style={[styles.modalTabsBar, { borderBottomColor: borderCol }]}>
            {[
              { key: 'business', label: 'Details', icon: 'storefront' },
              { key: 'location', label: 'Location', icon: 'place' },
              { key: 'pricing', label: 'Pricing', icon: 'attach-money' },
              { key: 'facilities', label: 'Facilities', icon: 'fitness-center' },
              { key: 'bank', label: 'Bank', icon: 'account-balance' },
            ].map((tab) => {
              const active = editTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.modalTabItem,
                    active && { borderBottomColor: '#2563EB', borderBottomWidth: 2 },
                  ]}
                  onPress={() => setEditTab(tab.key)}
                >
                  <Icon
                    name={tab.icon}
                    size={16}
                    color={active ? '#2563EB' : textMuted}
                  />
                  <Text
                    style={[
                      styles.modalTabText,
                      { color: active ? '#2563EB' : textSecondary, fontWeight: active ? '700' : '500' },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Modal Tab Content */}
          <ScrollView
            contentContainerStyle={[styles.modalFormContent, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* TAB 1: BUSINESS DETAILS */}
            {editTab === 'business' && (
              <View style={styles.tabSection}>
                <Text style={[styles.inputLabel, { color: textSecondary }]}>Gym Name *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g. Super Max Gym"
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Tagline / Slogan</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formTagline}
                  onChangeText={setFormTagline}
                  placeholder="e.g. Elevate Your Strength"
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Owner Full Name *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formOwnerName}
                  onChangeText={setFormOwnerName}
                  placeholder="Owner Name"
                  placeholderTextColor={textMuted}
                />

                <View style={styles.formTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>Phone Number</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formPhone}
                      onChangeText={setFormPhone}
                      keyboardType="phone-pad"
                      placeholder="e.g. 9876543210"
                      placeholderTextColor={textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>Official Email</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formEmail}
                      onChangeText={setFormEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="gym@example.com"
                      placeholderTextColor={textMuted}
                    />
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Established Year</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formYearEstablished}
                  onChangeText={setFormYearEstablished}
                  keyboardType="numeric"
                  placeholder="e.g. 2024"
                  placeholderTextColor={textMuted}
                />

                <View style={styles.formTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>GST Number</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formGstNumber}
                      maxLength={15}
                      onChangeText={(val) => setFormGstNumber((val || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                      autoCapitalize="characters"
                      placeholder="15-digit GSTIN"
                      placeholderTextColor={textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>PAN Number</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formPanNumber}
                      maxLength={10}
                      onChangeText={(val) => setFormPanNumber((val || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                      autoCapitalize="characters"
                      placeholder="10-digit PAN"
                      placeholderTextColor={textMuted}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* TAB 2: LOCATION & HOURS */}
            {editTab === 'location' && (
              <View style={styles.tabSection}>
                <Text style={[styles.inputLabel, { color: textSecondary }]}>Street Address / Building *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formAddress}
                  onChangeText={setFormAddress}
                  placeholder="Door No, Street Name, Landmark"
                  placeholderTextColor={textMuted}
                />

                <View style={styles.formTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>Locality / Area</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formArea}
                      onChangeText={setFormArea}
                      placeholder="e.g. Kundrathur"
                      placeholderTextColor={textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>City</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formCity}
                      onChangeText={setFormCity}
                      placeholder="e.g. Chennai"
                      placeholderTextColor={textMuted}
                    />
                  </View>
                </View>

                <View style={styles.formTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>State</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formState}
                      onChangeText={setFormState}
                      placeholder="e.g. Tamil Nadu"
                      placeholderTextColor={textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>Pincode</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formPincode}
                      onChangeText={setFormPincode}
                      keyboardType="numeric"
                      placeholder="602101"
                      placeholderTextColor={textMuted}
                    />
                  </View>
                </View>

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Google Maps Link</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formGoogleMapsUrl}
                  onChangeText={setFormGoogleMapsUrl}
                  placeholder="https://maps.google.com/?q=..."
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.sectionDividerText, { color: textPrimary }]}>Operating Hours</Text>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                  {[
                    { key: 'REGULAR', label: 'Single Shift' },
                    { key: 'SPLIT_SHIFT', label: 'Split Shift' },
                    { key: '24_HOURS', label: '24 Hours' },
                  ].map((modeOpt) => {
                    const isSel = formTimingMode === modeOpt.key;
                    return (
                      <TouchableOpacity
                        key={modeOpt.key}
                        onPress={() => setFormTimingMode(modeOpt.key)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          borderRadius: 8,
                          backgroundColor: isSel ? '#FF6B00' : (cardBg),
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: isSel ? '#FF6B00' : borderCol,
                        }}
                      >
                        <Text style={{
                          color: isSel ? '#FFFFFF' : textSecondary,
                          fontSize: 12,
                          fontWeight: '700',
                        }}>
                          {modeOpt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {formTimingMode === '24_HOURS' ? (
                  <View style={{ padding: 12, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', marginBottom: 10 }}>
                    <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 13, marginBottom: 2 }}>Open 24/7 Facility</Text>
                    <Text style={{ color: textSecondary, fontSize: 12 }}>Gym is open round the clock every day.</Text>
                  </View>
                ) : formTimingMode === 'SPLIT_SHIFT' ? (
                  <View>
                    <View style={styles.formTwoCols}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Morning Open</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formMorningOpen}
                          onChangeText={setFormMorningOpen}
                          placeholder="05:30 AM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Morning Close</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formMorningClose}
                          onChangeText={setFormMorningClose}
                          placeholder="11:30 AM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                    </View>
                    <View style={styles.formTwoCols}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Evening Open</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formEveningOpen}
                          onChangeText={setFormEveningOpen}
                          placeholder="04:30 PM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Evening Close</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formEveningClose}
                          onChangeText={setFormEveningClose}
                          placeholder="10:30 PM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View>
                    <View style={styles.formTwoCols}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Weekday Open</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formWeekdayOpen}
                          onChangeText={setFormWeekdayOpen}
                          placeholder="05:30 AM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Weekday Close</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formWeekdayClose}
                          onChangeText={setFormWeekdayClose}
                          placeholder="10:30 PM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                    </View>

                    <View style={styles.formTwoCols}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Weekend Open</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formWeekendOpen}
                          onChangeText={setFormWeekendOpen}
                          placeholder="06:00 AM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.inputLabel, { color: textSecondary }]}>Weekend Close</Text>
                        <TextInput
                          style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                          value={formWeekendClose}
                          onChangeText={setFormWeekendClose}
                          placeholder="09:00 PM"
                          placeholderTextColor={textMuted}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: PRICING */}
            {editTab === 'pricing' && (
              <View style={styles.tabSection}>
                <Text style={[styles.inputLabel, { color: textSecondary }]}>Single Session Pass (₹) *</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formSinglePrice}
                  onChangeText={setFormSinglePrice}
                  keyboardType="numeric"
                  placeholder="199"
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Monthly Membership (₹)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formMonthlyPrice}
                  onChangeText={setFormMonthlyPrice}
                  keyboardType="numeric"
                  placeholder="1999"
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Quarterly Membership (₹)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formQuarterlyPrice}
                  onChangeText={setFormQuarterlyPrice}
                  keyboardType="numeric"
                  placeholder="4999"
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Annual Membership (₹)</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formAnnualPrice}
                  onChangeText={setFormAnnualPrice}
                  keyboardType="numeric"
                  placeholder="14999"
                  placeholderTextColor={textMuted}
                />
              </View>
            )}

            {/* TAB 4: FACILITIES */}
            {editTab === 'facilities' && (
              <View style={styles.tabSection}>
                <Text style={[styles.sectionDividerText, { color: textPrimary }]}>Gym Amenities & Facilities</Text>
                <View style={styles.chipsContainer}>
                  {ALL_FACILITIES.map((fac) => {
                    const selected = formFacilities.includes(fac);
                    return (
                      <TouchableOpacity
                        key={fac}
                        style={[
                          styles.chipItem,
                          { borderColor: selected ? '#2563EB' : borderCol },
                          selected && { backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF' },
                        ]}
                        onPress={() => toggleFacility(fac)}
                      >
                        <Icon
                          name={selected ? 'check' : 'add'}
                          size={14}
                          color={selected ? '#2563EB' : textSecondary}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: selected ? '#2563EB' : textSecondary, fontWeight: selected ? '700' : '500' },
                          ]}
                        >
                          {fac}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.sectionDividerText, { color: textPrimary, marginTop: 24 }]}>
                  Member Amenities & Perks
                </Text>
                <View style={styles.chipsContainer}>
                  {AMENITY_OPTIONS.map((am) => {
                    const selected = formAmenities.includes(am);
                    return (
                      <TouchableOpacity
                        key={am}
                        style={[
                          styles.chipItem,
                          { borderColor: selected ? '#0891B2' : borderCol },
                          selected && { backgroundColor: isDark ? 'rgba(6,182,212,0.2)' : '#ECFEFF' },
                        ]}
                        onPress={() => toggleAmenity(am)}
                      >
                        <Icon
                          name={selected ? 'check' : 'add'}
                          size={14}
                          color={selected ? '#0891B2' : textSecondary}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: selected ? '#0891B2' : textSecondary, fontWeight: selected ? '700' : '500' },
                          ]}
                        >
                          {am}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.sectionDividerText, { color: textPrimary, marginTop: 24 }]}>
                  Workout Disciplines Offered
                </Text>
                <View style={styles.chipsContainer}>
                  {ALL_WORKOUTS.map((wk) => {
                    const selected = formWorkouts.includes(wk);
                    return (
                      <TouchableOpacity
                        key={wk}
                        style={[
                          styles.chipItem,
                          { borderColor: selected ? '#16A34A' : borderCol },
                          selected && { backgroundColor: isDark ? 'rgba(22,163,74,0.2)' : '#F0FDF4' },
                        ]}
                        onPress={() => toggleWorkout(wk)}
                      >
                        <Icon
                          name={selected ? 'check' : 'add'}
                          size={14}
                          color={selected ? '#16A34A' : textSecondary}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: selected ? '#16A34A' : textSecondary, fontWeight: selected ? '700' : '500' },
                          ]}
                        >
                          {wk}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* TAB 5: BANK DETAILS */}
            {editTab === 'bank' && (
              <View style={styles.tabSection}>
                <Text style={[styles.inputLabel, { color: textSecondary }]}>Account Holder Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formAccountHolder}
                  onChangeText={setFormAccountHolder}
                  placeholder="e.g. Thaingasaami"
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Bank Name</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formBankName}
                  onChangeText={setFormBankName}
                  placeholder="e.g. HDFC Bank"
                  placeholderTextColor={textMuted}
                />

                <Text style={[styles.inputLabel, { color: textSecondary }]}>Account Number</Text>
                <TextInput
                  style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                  value={formAccountNumber}
                  onChangeText={setFormAccountNumber}
                  keyboardType="numeric"
                  placeholder="Account Number"
                  placeholderTextColor={textMuted}
                />

                <View style={styles.formTwoCols}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>IFSC Code</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formIfscCode}
                      onChangeText={setFormIfscCode}
                      autoCapitalize="characters"
                      placeholder="e.g. HDFC0001234"
                      placeholderTextColor={textMuted}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: textSecondary }]}>Settlement UPI ID</Text>
                    <TextInput
                      style={[styles.formInput, { backgroundColor: cardBg, borderColor: borderCol, color: textPrimary }]}
                      value={formUpiId}
                      onChangeText={setFormUpiId}
                      autoCapitalize="none"
                      placeholder="e.g. gym@upi"
                      placeholderTextColor={textMuted}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* RESUBMIT TOGGLE ON SAVE */}
            <View style={[styles.resubmitToggleBox, { backgroundColor: cardBg, borderColor: borderCol, flexDirection: 'column', alignItems: 'stretch' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={[styles.toggleTitle, { color: textPrimary }]}>
                    Save & Resubmit to Super Admin
                  </Text>
                  <Text style={[styles.toggleSubtitle, { color: textMuted }]}>
                    Instantly sends your updated application back to Super Admin for verification.
                  </Text>
                </View>
                <Switch
                  value={editResubmitFlag}
                  onValueChange={setEditResubmitFlag}
                  trackColor={{ false: '#475569', true: '#2563EB' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {editResubmitFlag && (
                <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: borderCol }}>
                  <Text style={[styles.inputLabel, { color: textPrimary, marginTop: 0 }]}>
                    Explanation of Changes / Resubmission Note:
                  </Text>
                  <TextInput
                    style={[
                      styles.resubmitTextArea,
                      { backgroundColor: pageBg, borderColor: borderCol, color: textPrimary, marginTop: 4 },
                    ]}
                    multiline
                    numberOfLines={3}
                    value={editResubmitNotes}
                    onChangeText={setEditResubmitNotes}
                    placeholder="e.g. Uploaded clear trade license copy and updated morning opening slot..."
                    placeholderTextColor={textMuted}
                  />
                </View>
              )}
            </View>

            {/* SAVE BUTTON AT BOTTOM */}
            <TouchableOpacity
              style={[styles.saveBottomBtn, { backgroundColor: '#2563EB' }]}
              onPress={handleSaveEdit}
              disabled={savingEdit}
              activeOpacity={0.85}
            >
              {savingEdit ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Icon name="save" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBottomBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* SUPPORT MODAL */}
      <Modal
        visible={supportModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setSupportModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.dialogTitle, { color: textPrimary }]}>Partner Support Desk</Text>
            <Text style={[styles.dialogSubtitle, { color: textSecondary }]}>
              Reach our partner verification team for onboarding queries:
            </Text>

            <View style={styles.supportRow}>
              <Icon name="phone" size={18} color="#16A34A" />
              <Text style={[styles.supportText, { color: textPrimary }]}>+91 98765 43210 (Toll Free)</Text>
            </View>

            <View style={styles.supportRow}>
              <Icon name="email" size={18} color="#2563EB" />
              <Text style={[styles.supportText, { color: textPrimary }]}>partners@gymezy.com</Text>
            </View>

            <TouchableOpacity
              style={[styles.dialogCloseBtn, { backgroundColor: '#2563EB' }]}
              onPress={() => setSupportModalOpen(false)}
            >
              <Text style={styles.dialogCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* RESUBMIT MODAL */}
      <Modal
        visible={resubmitModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setResubmitModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.dialogCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <Text style={[styles.dialogTitle, { color: textPrimary }]}>Resubmit Application</Text>
            <Text style={[styles.dialogSubtitle, { color: textSecondary }]}>
              Please describe the changes or clarifications made to resolve the administrator's feedback:
            </Text>

            <TextInput
              style={[
                styles.resubmitTextArea,
                { backgroundColor: pageBg, borderColor: borderCol, color: textPrimary },
              ]}
              multiline
              numberOfLines={4}
              value={resubmitNotes}
              onChangeText={setResubmitNotes}
              placeholder="e.g. Uploaded revised license document with seal, updated weekend operating hours..."
              placeholderTextColor={textMuted}
            />

            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={[styles.dialogCancelBtn, { borderColor: borderCol }]}
                onPress={() => setResubmitModalOpen(false)}
              >
                <Text style={[styles.dialogCancelBtnText, { color: textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dialogConfirmBtn, { backgroundColor: '#2563EB' }]}
                onPress={handleResubmitApplication}
                disabled={resubmitting}
              >
                {resubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogConfirmBtnText}>Confirm Resubmit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  themeBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  signOutBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
  },
  partnerTag: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  gymNameTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusSubtext: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  topActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
    borderWidth: 1,
  },
  editAppBtn: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  editAppBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnText: {
    fontWeight: '600',
    fontSize: 13,
  },
  fullResubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  fullResubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  timelineCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  timelineStep: {
    flex: 1,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  stepTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  timelineDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  adminNoteBanner: {
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 24,
  },
  adminNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  adminNoteTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adminNoteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
  },
  smallEditBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  smallResubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  smallResubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  adminNoteBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionBlock: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  editSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  editSectionText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 12,
  },
  infoCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pricingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priceBox: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  priceTierName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalScreen: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
  },
  saveHeaderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveHeaderBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  modalTabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  modalTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  modalTabText: {
    fontSize: 12,
  },
  modalFormContent: {
    padding: 16,
  },
  tabSection: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 8,
  },
  formInput: {
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  formTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionDividerText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  resubmitToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 18,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  saveBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  saveBottomBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  dialogSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  supportText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dialogCloseBtn: {
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  dialogCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  resubmitTextArea: {
    height: 100,
    borderRadius: 6,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dialogConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  dialogConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ApplicationStatusScreen;
