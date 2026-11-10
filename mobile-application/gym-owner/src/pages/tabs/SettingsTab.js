import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Dimensions,
  AppState,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/appTheme';
import { useToast } from '../../widgets/CustomScaffoldMessage';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import { notificationService } from '../../services/notificationService';
import { getSafeImageUri, getGymLogoUri } from '../../utils/mediaUtils';
import { pickImageFromDevice, capturePhotoFromCamera } from '../../utils/filePickerUtils';
import { AddEmployeeModal } from '../../widgets/AddEmployeeModal';
import { SectionsSubView } from './SectionsSubView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ALL_FACILITIES = [
  'AC Gym',
  'Locker Facility',
  'Shower Available',
  'Changing Room',
  'Free Wi-Fi',
  'Music System',
  'Steam & Sauna',
  'Ice Bath & Recovery',
  'Dedicated Parking (2W/4W)',
  'Turnstile Access Control',
  'First Aid Kit',
  'CCTV 24/7',
  'Biometric Entry',
  'Personal Trainers',
  'Cardio Theater',
  'Olympic Barbells Area',
];

const ALL_WORKOUTS = [
  'GYM / Strength',
  'Cardio Fitness',
  'HIIT (High Intensity)',
  'CrossFit',
  'Yoga & Mobility',
  'Zumba & Dance',
  'Boxing & Kickboxing',
  'Pilates',
  'Calisthenics',
  'MMA & Martial Arts',
];

const ALL_AMENITIES = [
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


const getNormalizedPricingPlans = (data) => {
  if (!data) return [];
  if (Array.isArray(data.customPricingPlans) && data.customPricingPlans.length > 0) {
    return data.customPricingPlans;
  }
  if (Array.isArray(data.pricingPlans) && data.pricingPlans.length > 0) {
    return data.pricingPlans;
  }
  if (data.pricingPlans && typeof data.pricingPlans === 'object') {
    const p = data.pricingPlans;
    const plansList = [];
    if (p.singleSession !== undefined) {
      plansList.push({
        id: 'plan-single',
        name: 'Walk-In Day Pass',
        badge: 'Walk-In',
        price: Number(p.singleSession) || 199,
        duration: '1 Day',
      });
    }
    if (p.weeklyPass !== undefined) {
      plansList.push({
        id: 'plan-weekly',
        name: 'Weekly Workout Pass',
        badge: 'Weekly',
        price: Number(p.weeklyPass) || 799,
        duration: '7 Days',
      });
    }
    if (p.monthly !== undefined) {
      plansList.push({
        id: 'plan-monthly',
        name: '1-Month Membership',
        badge: 'Monthly',
        price: Number(p.monthly) || 1999,
        duration: '30 Days',
      });
    }
    if (p.quarterly !== undefined) {
      plansList.push({
        id: 'plan-quarterly',
        name: '3-Month Membership',
        badge: 'Quarterly',
        price: Number(p.quarterly) || 4999,
        duration: '90 Days',
      });
    }
    if (p.halfYearly !== undefined) {
      plansList.push({
        id: 'plan-halfYearly',
        name: '6-Month Membership',
        badge: 'Half-Yearly',
        price: Number(p.halfYearly) || 8999,
        duration: '180 Days',
      });
    }
    if (p.annual !== undefined) {
      plansList.push({
        id: 'plan-annual',
        name: '1-Year Annual Pass',
        badge: 'Annual',
        price: Number(p.annual) || 14999,
        duration: '365 Days',
      });
    }
    return plansList;
  }
  return [];
};

export const SettingsTab = ({ topInset, navigation, onBack }) => {
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const modalSheetBottomPadding = insets.bottom > 0 ? insets.bottom + 16 : 24;
  const { showToast } = useToast();
  const { user, gym, logout, updateGym, refreshGymProfile } = useAuth();

  const targetGymId = gym?._id || gym?.id || user?.gymId;

  // Active subview navigation:
  // 'MAIN' | 'GYM_PROFILE' | 'BASIC_PROFILE' | 'BANK_DETAILS' | 'TRAINER_PROFILE' | 'ADD_TRAINER' | 'EMPLOYEES' | 'ADD_EMPLOYEE'
  const [activeSection, setActiveSection] = useState('MAIN');

  // Backend Gym Data State
  const [gymData, setGymData] = useState(gym || null);
  const normalizedPricingPlans = useMemo(() => getNormalizedPricingPlans(gymData), [gymData]);
  const [isLoadingGym, setIsLoadingGym] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [auditHistory, setAuditHistory] = useState([]);

  // Backend Employees & Trainers State
  const [employeesList, setEmployeesList] = useState([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [trainerTabType, setTrainerTabType] = useState('All');
  const [staffTabRole, setStaffTabRole] = useState('All');

  // Trainer Membership Tier Pricing Mapping (Matches Web App)
  const [gymTrainersPricing, setGymTrainersPricing] = useState([]);
  const [isSavingTrainerPricing, setIsSavingTrainerPricing] = useState(false);

  // Operational Toggles
  const [audioBeep, setAudioBeep] = useState(true);
  const [smsReminders, setSmsReminders] = useState(true);

  // Native Notification Permission State
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);

  const checkNotifications = useCallback(async () => {
    const granted = await notificationService.checkNotificationPermission();
    setIsNotificationsEnabled(granted);
  }, []);

  useEffect(() => {
    checkNotifications();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkNotifications();
      }
    });
    return () => subscription.remove();
  }, [checkNotifications]);

  const handleToggleNotifications = async (targetValue) => {
    if (targetValue) {
      const res = await notificationService.requestNotificationPermission();
      if (res.granted) {
        setIsNotificationsEnabled(true);
        showToast({ message: 'Notifications enabled successfully!', isSuccess: true });
      } else {
        setIsNotificationsEnabled(false);
        Alert.alert(
          'Notification Permission Required',
          'GYMEZY Gym Owner notifications are disabled in device settings. Would you like to open settings to allow notifications?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => notificationService.openNotificationSettings(),
            },
          ]
        );
      }
    } else {
      Alert.alert(
        'Disable Notifications',
        'To silence or turn off notifications, please adjust permission in your device system settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => notificationService.openNotificationSettings(),
          },
        ]
      );
    }
  };

  // Modals
  const [showPendingRequestsModal, setShowPendingRequestsModal] = useState(false);
  const [showAuditHistoryModal, setShowAuditHistoryModal] = useState(false);
  const [showEditTimingsModal, setShowEditTimingsModal] = useState(false);
  const [showEditBankModal, setShowEditBankModal] = useState(false);
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [showFacilitiesModal, setShowFacilitiesModal] = useState(false);
  const [showWorkoutsModal, setShowWorkoutsModal] = useState(false);
  const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [selectedEmpDetail, setSelectedEmpDetail] = useState(null);
  const [detailModalTab, setDetailModalTab] = useState('details'); // 'details' | 'documents'

  // Basic Profile Form Fields
  const [basicName, setBasicName] = useState('');
  const [basicTagline, setBasicTagline] = useState('');
  const [basicOwnerName, setBasicOwnerName] = useState('');
  const [basicPhone, setBasicPhone] = useState('');
  const [basicEmail, setBasicEmail] = useState('');
  const [basicBusinessType, setBasicBusinessType] = useState('Private Limited');
  const [basicYearEstablished, setBasicYearEstablished] = useState('');
  const [basicAddress, setBasicAddress] = useState('');
  const [basicArea, setBasicArea] = useState('');
  const [basicCity, setBasicCity] = useState('');
  const [basicState, setBasicState] = useState('Tamil Nadu');
  const [basicPincode, setBasicPincode] = useState('');
  const [basicGst, setBasicGst] = useState('');
  const [basicPan, setBasicPan] = useState('');
  const [basicFloorSpace, setBasicFloorSpace] = useState('');
  const [basicCapacity, setBasicCapacity] = useState('');
  const [basicMapsUrl, setBasicMapsUrl] = useState('');
  const [basicAbout, setBasicAbout] = useState('');
  const [isSavingBasic, setIsSavingBasic] = useState(false);

  // Timings Form Fields
  const [timingMode, setTimingMode] = useState('REGULAR');
  const [weekdayOpen, setWeekdayOpen] = useState('05:30 AM');
  const [weekdayClose, setWeekdayClose] = useState('10:30 PM');
  const [weekendOpen, setWeekendOpen] = useState('06:00 AM');
  const [weekendClose, setWeekendClose] = useState('09:00 PM');
  const [morningOpen, setMorningOpen] = useState('05:30 AM');
  const [morningClose, setMorningClose] = useState('11:30 AM');
  const [eveningOpen, setEveningOpen] = useState('04:30 PM');
  const [eveningClose, setEveningClose] = useState('10:30 PM');
  const [is24Hours, setIs24Hours] = useState(false);

  // Bank Form Fields
  const [accountHolder, setAccountHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  // Add Pricing Plan Fields
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDuration, setPlanDuration] = useState('30 Days');
  const [planBadge, setPlanBadge] = useState('Monthly');
  const [planFeatures, setPlanFeatures] = useState('');

  // Selected Facilities, Workouts, Amenities, Rules & Safety
  const [selectedFacilities, setSelectedFacilities] = useState([]);
  const [selectedWorkouts, setSelectedWorkouts] = useState([]);
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [gymRules, setGymRules] = useState([
    'Carry clean indoor training shoes',
    'Mandatory personal gym towel on workout benches',
    'Re-rack dumbbells and plates after set completion',
    'No outside food or beverages allowed on gym floor',
  ]);
  const [safetyMeasures, setSafetyMeasures] = useState([
    'Daily multi-session equipment sanitization',
    'Certified First Aid & CPR staff available on floor',
    '24/7 CCTV surveillance coverage',
    'Emergency exits clearly marked and accessible',
  ]);
  const [newRuleText, setNewRuleText] = useState('');
  const [newSafetyText, setNewSafetyText] = useState('');

  // =========================================================================
  // ADD TRAINER / ADD EMPLOYEE MODAL STATE (REUSABLE COMPONENT)
  // =========================================================================
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [addEmpModalDefaultRole, setAddEmpModalDefaultRole] = useState('Trainer');


  // -------------------------------------------------------------------------
  // FETCH GYM & EMPLOYEES
  // -------------------------------------------------------------------------
  const fetchGymProfileData = useCallback(async () => {
    if (!targetGymId) return;
    setIsLoadingGym(true);
    try {
      const data = await apiService.getGym(targetGymId);
      if (data) {
        setGymData(data);
        if (Array.isArray(data.auditHistory)) {
          setAuditHistory(data.auditHistory);
          const pending = data.auditHistory.filter(
            (l) => l.approvalStatus === 'Pending Approval' || l.approvalStatus === 'Pending Admin Review'
          );
          setPendingRequests(pending);
        } else if (data.pendingChanges) {
          setPendingRequests([{ id: 'REQ-1', field: 'Profile Edits', approvalStatus: 'Pending Approval' }]);
        }

        // Pre-fill form values
        setBasicName(data.name || '');
        setBasicTagline(data.tagline || '');
        setBasicOwnerName(data.ownerName || '');
        setBasicPhone(data.phone || '');
        setBasicEmail(data.email || '');
        setBasicBusinessType(data.businessType || 'Private Limited');
        setBasicYearEstablished(String(data.yearEstablished || ''));
        setBasicAddress(data.address || data.fullAddress || '');
        setBasicArea(data.area || '');
        setBasicCity(data.city || '');
        setBasicState(data.state || 'Tamil Nadu');
        setBasicPincode(data.pincode || '');
        setBasicGst(data.gstNumber || '');
        setBasicPan(data.panNumber || '');
        setBasicFloorSpace(String(data.floorSpaceSqFt || ''));
        setBasicCapacity(String(data.maxFloorCapacity || ''));
        setBasicMapsUrl(data.googleMapsUrl || '');
        setBasicAbout(data.aboutText || '');

        setSelectedFacilities(Array.isArray(data.facilities) ? data.facilities : []);
        setSelectedWorkouts(Array.isArray(data.workouts) ? data.workouts : []);
        setSelectedAmenities(Array.isArray(data.amenities) ? data.amenities : []);
        if (Array.isArray(data.rules) && data.rules.length > 0) setGymRules(data.rules);
        if (Array.isArray(data.safetyMeasures) && data.safetyMeasures.length > 0) setSafetyMeasures(data.safetyMeasures);

        if (data.openingHours) {
          const mode = data.openingHours.mode || (data.openingHours.is24Hours ? '24_HOURS' : (data.openingHours.morningShift ? 'SPLIT_SHIFT' : 'REGULAR'));
          setTimingMode(mode);
          setWeekdayOpen(data.openingHours.weekdayOpen || '05:30 AM');
          setWeekdayClose(data.openingHours.weekdayClose || '10:30 PM');
          setWeekendOpen(data.openingHours.weekendOpen || '06:00 AM');
          setWeekendClose(data.openingHours.weekendClose || '09:00 PM');
          setIs24Hours(Boolean(data.openingHours.is24Hours || mode === '24_HOURS'));
          if (data.openingHours.morningShift) {
            setMorningOpen(data.openingHours.morningShift.open || '05:30 AM');
            setMorningClose(data.openingHours.morningShift.close || '11:30 AM');
          }
          if (data.openingHours.eveningShift) {
            setEveningOpen(data.openingHours.eveningShift.open || '04:30 PM');
            setEveningClose(data.openingHours.eveningShift.close || '10:30 PM');
          }
        }

        if (data.bankDetails) {
          setAccountHolder(data.bankDetails.accountHolderName || data.bankDetails.accountHolder || '');
          setBankName(data.bankDetails.bankName || '');
          setAccountNumber(data.bankDetails.accountNumber || '');
          setIfscCode(data.bankDetails.ifscCode || '');
          setUpiId(data.bankDetails.upiId || '');
        }

        if (Array.isArray(data.trainers) && data.trainers.length > 0) {
          setGymTrainersPricing(
            data.trainers.map((t) => ({
              employeeId: t.employeeId || t.id || t._id,
              name: t.name || t.fullName,
              specialty: t.specialty,
              imageUrl: t.imageUrl || t.image?.fileData,
              trainerPricing: {
                monthly: String(t.trainerPricing?.monthly || t.monthlyFee || 0),
                quarterly: String(t.trainerPricing?.quarterly || 0),
                halfYearly: String(t.trainerPricing?.halfYearly || 0),
                annual: String(t.trainerPricing?.annual || 0),
                singleSession: String(t.trainerPricing?.singleSession || 0),
              },
            }))
          );
        }
      }
    } catch (err) {
      console.warn('Gym profile fetch error:', err.message);
    } finally {
      setIsLoadingGym(false);
    }
  }, [targetGymId]);

  const fetchEmployeesData = useCallback(async () => {
    if (!targetGymId) return;
    setIsLoadingEmployees(true);
    try {
      const data = await apiService.getEmployees({ gymId: targetGymId, limit: 'all' });
      const list = data?.employees || (Array.isArray(data) ? data : []);
      setEmployeesList(list);
    } catch (err) {
      console.warn('Employees fetch notice:', err.message);
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [targetGymId]);

  useEffect(() => {
    fetchGymProfileData();
    fetchEmployeesData();
  }, [fetchGymProfileData, fetchEmployeesData]);

  // Derived Trainer & Staff lists
  const trainers = useMemo(() => {
    return employeesList.filter(
      (e) =>
        e.role?.toLowerCase().includes('trainer') ||
        e.accessType?.toLowerCase().includes('trainer') ||
        e.specialty
    );
  }, [employeesList]);

  // Sync trainers pricing with trainers from employees if not populated
  useEffect(() => {
    if (gymTrainersPricing.length === 0 && trainers.length > 0) {
      setGymTrainersPricing(
        trainers.map((t) => ({
          employeeId: t.employeeId || t.id || t._id,
          name: t.name || t.fullName,
          specialty: t.specialty || 'Personal Trainer',
          imageUrl: t.imageUrl || t.profilePicture || t.image?.fileData,
          trainerPricing: {
            monthly: String(t.trainerPricing?.monthly || t.monthlyFee || 0),
            quarterly: String(t.trainerPricing?.quarterly || 0),
            halfYearly: String(t.trainerPricing?.halfYearly || 0),
            annual: String(t.trainerPricing?.annual || 0),
            singleSession: String(t.trainerPricing?.singleSession || 0),
          },
        }))
      );
    }
  }, [trainers, gymTrainersPricing.length]);

  const handleUpdateTrainerTierRate = (index, tierKey, val) => {
    const clean = val.replace(/[^0-9]/g, '');
    setGymTrainersPricing((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        trainerPricing: {
          ...copy[index].trainerPricing,
          [tierKey]: clean,
        },
      };
      return copy;
    });
  };

  const handleSaveTrainerPricing = async () => {
    if (!targetGymId) {
      Alert.alert('Error', 'Gym ID not found');
      return;
    }
    setIsSavingTrainerPricing(true);
    try {
      const payload = {
        trainerPricing: gymTrainersPricing.map((t) => ({
          employeeId: t.employeeId,
          trainerPricing: {
            monthly: Number(t.trainerPricing?.monthly || 0),
            quarterly: Number(t.trainerPricing?.quarterly || 0),
            halfYearly: Number(t.trainerPricing?.halfYearly || 0),
            annual: Number(t.trainerPricing?.annual || 0),
            singleSession: Number(t.trainerPricing?.singleSession || 0),
          },
        })),
      };

      await apiService.updateTrainerPricing(targetGymId, payload);
      showToast({ message: 'Trainer Membership Tier Pricing updated successfully!', isSuccess: true });
      fetchGymProfileData();
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Unable to save trainer pricing.');
    } finally {
      setIsSavingTrainerPricing(false);
    }
  };

  const staffEmployees = useMemo(() => {
    return employeesList.filter(
      (e) =>
        !e.role?.toLowerCase().includes('trainer') &&
        !e.accessType?.toLowerCase().includes('trainer') &&
        !e.specialty
    );
  }, [employeesList]);

  const hasPendingGymChanges = Boolean(
    (gymData?.pendingChanges && Object.keys(gymData.pendingChanges).length > 0) ||
      pendingRequests.length > 0 ||
      gymData?.approvalStatus === 'Pending Approval'
  );

  // -------------------------------------------------------------------------
  // MEDIA UPLOADS: BRAND LOGO, COVER PHOTO & GALLERY
  // -------------------------------------------------------------------------
  const handleSaveGymUpdate = async (payload, successMsg = 'Changes submitted for Super Admin review.') => {
    if (!targetGymId) {
      showToast({ message: 'Gym ID not found. Please log in again.', isError: true });
      return;
    }
    try {
      const res = await apiService.updateGym(targetGymId, payload);
      showToast({ message: res.message || successMsg, isSuccess: true });
      await fetchGymProfileData();
      if (refreshGymProfile) refreshGymProfile();
    } catch (err) {
      showToast({ message: err.message || 'Failed to update gym profile.', isError: true });
    }
  };

  const handlePickGymLogo = async () => {
    Alert.alert(
      'Update Gym Logo',
      'Choose image source for brand logo:',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const picked = await capturePhotoFromCamera({ maxWidth: 1000, maxHeight: 1000 });
            if (picked?.fileData) {
              uploadLogoData(picked);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const picked = await pickImageFromDevice({ maxWidth: 1000, maxHeight: 1000 });
            if (picked?.fileData) {
              uploadLogoData(picked);
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const uploadLogoData = async (picked) => {
    setIsUploadingMedia(true);
    try {
      const logoPayload = {
        fileName: picked.fileName || 'gym_logo.jpg',
        fileData: picked.fileData,
      };
      await handleSaveGymUpdate({ logo: logoPayload }, 'Brand logo updated successfully!');
      updateGym({ logo: logoPayload });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handlePickGymCover = async () => {
    const picked = await pickImageFromDevice({ maxWidth: 1600, maxHeight: 900 });
    if (picked?.fileData) {
      setIsUploadingMedia(true);
      try {
        const coverPayload = {
          fileName: picked.fileName || 'gym_cover.jpg',
          fileData: picked.fileData,
        };
        await handleSaveGymUpdate({ coverPhoto: coverPayload }, 'Cover photo updated successfully!');
        updateGym({ coverPhoto: coverPayload });
      } finally {
        setIsUploadingMedia(false);
      }
    }
  };

  const handleAddGalleryPhoto = async () => {
    const picked = await pickImageFromDevice({ maxWidth: 1200, maxHeight: 800 });
    if (picked?.fileData) {
      setIsUploadingMedia(true);
      try {
        const currentGallery = Array.isArray(gymData?.galleryPhotos) ? gymData.galleryPhotos : [];
        const newPhotoObj = {
          fileName: picked.fileName || 'gallery_photo.jpg',
          fileData: picked.fileData,
        };
        const updated = [...currentGallery, newPhotoObj];
        await handleSaveGymUpdate({ galleryPhotos: updated }, 'Photo added to gym gallery!');
        updateGym({ galleryPhotos: updated });
      } finally {
        setIsUploadingMedia(false);
      }
    }
  };

  const handleDeleteGalleryPhoto = async (indexToDelete) => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove this photo from your gallery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const currentGallery = Array.isArray(gymData?.galleryPhotos) ? gymData.galleryPhotos : [];
          const updated = currentGallery.filter((_, idx) => idx !== indexToDelete);
          await handleSaveGymUpdate({ galleryPhotos: updated }, 'Photo removed from gallery.');
          updateGym({ galleryPhotos: updated });
        },
      },
    ]);
  };

  // -------------------------------------------------------------------------
  // BASIC PROFILE & LEGAL HANDLERS
  // -------------------------------------------------------------------------
  const handleSaveBasicProfile = async () => {
    if (!basicName.trim()) {
      showToast({ message: 'Gym name is required', isError: true });
      return;
    }
    setIsSavingBasic(true);
    try {
      const payload = {
        name: basicName.trim(),
        tagline: basicTagline.trim(),
        ownerName: basicOwnerName.trim(),
        phone: basicPhone.trim(),
        email: basicEmail.trim(),
        businessType: basicBusinessType,
        yearEstablished: Number(basicYearEstablished) || undefined,
        address: basicAddress.trim(),
        area: basicArea.trim(),
        city: basicCity.trim(),
        state: basicState.trim(),
        pincode: basicPincode.trim(),
        gstNumber: basicGst.trim(),
        panNumber: basicPan.trim(),
        floorSpaceSqFt: Number(basicFloorSpace) || 0,
        maxFloorCapacity: Number(basicCapacity) || 0,
        googleMapsUrl: basicMapsUrl.trim(),
        aboutText: basicAbout.trim(),
      };
      await handleSaveGymUpdate(payload, 'Gym profile details submitted for Super Admin review.');
      setActiveSection('MAIN');
    } finally {
      setIsSavingBasic(false);
    }
  };

  const handleSaveOperatingHours = async () => {
    let displayText = `${weekdayOpen} - ${weekdayClose}`;
    if (timingMode === '24_HOURS') {
      displayText = 'Open 24 Hours';
    } else if (timingMode === 'SPLIT_SHIFT') {
      displayText = `${morningOpen} - ${morningClose} & ${eveningOpen} - ${eveningClose}`;
    }

    const payload = {
      openingHours: {
        mode: timingMode,
        weekdayOpen: timingMode === 'SPLIT_SHIFT' ? morningOpen : (timingMode === '24_HOURS' ? '12:00 AM' : weekdayOpen),
        weekdayClose: timingMode === 'SPLIT_SHIFT' ? eveningClose : (timingMode === '24_HOURS' ? '11:59 PM' : weekdayClose),
        weekendOpen: timingMode === 'SPLIT_SHIFT' ? morningOpen : (timingMode === '24_HOURS' ? '12:00 AM' : weekendOpen),
        weekendClose: timingMode === 'SPLIT_SHIFT' ? eveningClose : (timingMode === '24_HOURS' ? '11:59 PM' : weekendClose),
        is24Hours: timingMode === '24_HOURS',
        morningShift: timingMode === 'SPLIT_SHIFT' ? { open: morningOpen, close: morningClose } : undefined,
        eveningShift: timingMode === 'SPLIT_SHIFT' ? { open: eveningOpen, close: eveningClose } : undefined,
        displayText,
      },
    };
    await handleSaveGymUpdate(payload, 'Operating hours submitted for Super Admin review.');
    setShowEditTimingsModal(false);
  };

  const handleSaveBankDetails = async () => {
    if (!accountNumber.trim() || !ifscCode.trim()) {
      showToast({ message: 'Account number and IFSC code are required', isError: true });
      return;
    }
    const payload = {
      bankDetails: {
        accountHolderName: accountHolder.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim(),
        upiId: upiId.trim(),
      },
    };
    await handleSaveGymUpdate(payload, 'Bank details submitted for Super Admin review.');
    setShowEditBankModal(false);
  };

  const handleSaveFacilities = async () => {
    await handleSaveGymUpdate({ facilities: selectedFacilities }, 'Gym facilities updated successfully.');
    setShowFacilitiesModal(false);
  };

  const handleSaveWorkouts = async () => {
    await handleSaveGymUpdate({ workouts: selectedWorkouts }, 'Workout disciplines updated successfully.');
    setShowWorkoutsModal(false);
  };

  const handleSaveAmenities = async () => {
    await handleSaveGymUpdate({ amenities: selectedAmenities }, 'Gym amenities updated successfully.');
    setShowAmenitiesModal(false);
  };

  const handleSaveRules = async () => {
    await handleSaveGymUpdate({ rules: gymRules }, 'Gym rules updated successfully.');
    setShowRulesModal(false);
  };

  const handleSaveSafety = async () => {
    await handleSaveGymUpdate({ safetyMeasures }, 'Safety measures updated successfully.');
    setShowSafetyModal(false);
  };

  const handleAddPricingPlan = async () => {
    if (!planName.trim() || !planPrice.trim()) {
      showToast({ message: 'Plan name and price are required', isError: true });
      return;
    }
    const newPlanObj = {
      id: `plan-${Date.now()}`,
      name: planName.trim(),
      price: Number(planPrice) || 0,
      duration: planDuration,
      badge: planBadge,
      description: planFeatures,
      features: planFeatures ? planFeatures.split('\n').filter(Boolean) : [],
    };
    const currentPlans = normalizedPricingPlans;
    const updatedPlans = [...currentPlans, newPlanObj];
    await handleSaveGymUpdate({ customPricingPlans: updatedPlans }, `Plan "${planName}" submitted for approval.`);
    setShowAddPlanModal(false);
    setPlanName('');
    setPlanPrice('');
    setPlanFeatures('');
  };

  // -------------------------------------------------------------------------
  // ADD TRAINER / EMPLOYEE (REUSABLE MODAL FLOW)
  // -------------------------------------------------------------------------
  const openAddTrainerFlow = () => {
    setAddEmpModalDefaultRole('Trainer');
    setShowAddEmpModal(true);
  };

  const openAddStaffFlow = () => {
    setAddEmpModalDefaultRole('Front Desk Manager');
    setShowAddEmpModal(true);
  };

  const handleToggleEmpStatus = async (emp) => {
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiService.updateEmployee(emp._id || emp.id, { status: newStatus });
      showToast({ message: `Status updated to ${newStatus}. Pending approval.`, isSuccess: true });
      await fetchEmployeesData();
      if (selectedEmpDetail) {
        setSelectedEmpDetail({ ...selectedEmpDetail, status: newStatus });
      }
    } catch (err) {
      showToast({ message: err.message || 'Failed to update status', isError: true });
    }
  };

  const handleDeleteEmployee = async (emp) => {
    Alert.alert(
      'Deactivate Employee',
      `Are you sure you want to deactivate ${emp.name}? This will submit a request for Super Admin approval.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteEmployee(emp._id || emp.id);
              showToast({ message: 'Deactivation request submitted for Super Admin review.', isSuccess: true });
              await fetchEmployeesData();
              setSelectedEmpDetail(null);
            } catch (err) {
              showToast({ message: err.message || 'Failed to delete', isError: true });
            }
          },
        },
      ]
    );
  };

  // -------------------------------------------------------------------------
  // 1. MAIN HUB VIEW
  // -------------------------------------------------------------------------
  const renderMainHub = () => (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: topInset + 12, paddingBottom: 170 + Math.max(insets.bottom, 24) },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoadingGym}
          onRefresh={() => {
            fetchGymProfileData();
            fetchEmployeesData();
          }}
          tintColor={AppColors.primaryColor}
        />
      }
    >
      {/* Top Back Header (when navigated from top-right corner) */}
      {onBack && (
        <View style={styles.topBackHeaderRow}>
          <TouchableOpacity
            style={[
              styles.topBackBtn,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.topBackHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Settings & Preferences
            </Text>
            <Text style={[styles.topBackHeaderSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              Gym facility, operating hours & account
            </Text>
          </View>
        </View>
      )}

      {/* Gym Profile Hero Card with Logo & Quick Change */}
      <View
        style={[
          styles.profileHeroCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.profileTopRow}>
          <TouchableOpacity
            style={[
              styles.gymLogoWrapper,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={handlePickGymLogo}
            activeOpacity={0.8}
          >
            {getGymLogoUri(gymData) ? (
              <Image
                source={{ uri: getGymLogoUri(gymData) }}
                style={styles.gymLogo}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.gymInitialBadge, { backgroundColor: AppColors.primaryColor }]}>
                <Text style={styles.gymInitialText}>
                  {(gymData?.name || user?.fullName || 'Gym')
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase() || 'GY'}
                </Text>
              </View>
            )}
            <View style={styles.cameraIconBadge}>
              <MaterialIcons name="photo-camera" size={12} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <View style={styles.profileNameRow}>
            <Text
              style={[
                styles.profileGymName,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
              numberOfLines={1}
            >
              {gymData?.name || user?.fullName || 'Gym Facility'}
            </Text>

            <View style={styles.idStatusRow}>
              <View
                style={[
                  styles.partnerIdTag,
                  { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' },
                ]}
              >
                <Text
                  style={[
                    styles.partnerIdText,
                    { color: isDark ? '#93C5FD' : AppColors.primaryColor },
                  ]}
                >
                  ID: {(gymData?.partnerId && !/^[0-9a-fA-F]{24}$/.test(gymData.partnerId) && gymData.partnerId !== '-') ? gymData.partnerId : '-'}
                </Text>
              </View>

              <View
                style={[
                  styles.statusTagPill,
                  {
                    backgroundColor:
                      gymData?.approvalStatus === 'Approved'
                        ? 'rgba(22, 163, 74, 0.12)'
                        : 'rgba(245, 158, 11, 0.15)',
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        gymData?.approvalStatus === 'Approved' ? '#16a34a' : '#d97706',
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusTagText,
                    {
                      color:
                        gymData?.approvalStatus === 'Approved' ? '#16a34a' : '#d97706',
                    },
                  ]}
                >
                  {gymData?.approvalStatus || 'Approved'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <Text
          style={[
            styles.profileGymAddress,
            { color: isDark ? 'rgba(255,255,255,0.65)' : '#64748B' },
          ]}
          numberOfLines={1}
        >
          {gymData?.area
            ? `${gymData.area}, ${gymData.city}`
            : gymData?.address || 'Mangadu, Kundrathur'}
        </Text>
      </View>

      {/* SECTION 1: MANAGE YOUR GYM */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Manage Your Gym
        </Text>
        <Text style={[styles.sectionSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
          Update profile, schedules, media, trainers and staff
        </Text>

        <View
          style={[
            styles.menuListCard,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          {/* Gym Profile */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => setActiveSection('GYM_PROFILE')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.1)' }]}>
              <MaterialIcons name="fitness-center" size={20} color="#6366F1" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Gym Profile
              </Text>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                Media, Timings, Pricing, Facilities & Equipment
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          </TouchableOpacity>

          <View style={[styles.menuDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

          {/* Basic Profile */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => setActiveSection('BASIC_PROFILE')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
              <MaterialIcons name="storefront" size={20} color="#3B82F6" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Basic Profile & Legal
              </Text>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                Address, Owner details, GST, PAN & About Bio
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          </TouchableOpacity>

          <View style={[styles.menuDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

          {/* Trainers */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => setActiveSection('TRAINER_PROFILE')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
              <MaterialIcons name="sports" size={20} color="#EC4899" />
            </View>
            <View style={styles.menuTextBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Trainer Profile & Certifications
                </Text>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{trainers.length}</Text>
                </View>
              </View>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                Manage trainers, certificates, shifts & specialties
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          </TouchableOpacity>

          <View style={[styles.menuDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

          {/* Employees & Staff */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => setActiveSection('EMPLOYEES')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}>
              <MaterialIcons name="people" size={20} color="#A855F7" />
            </View>
            <View style={styles.menuTextBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Employees & Staff
                </Text>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{staffEmployees.length}</Text>
                </View>
              </View>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                Receptionists, floor managers & staff verification
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          </TouchableOpacity>

          <View style={[styles.menuDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

          {/* Workout Sections & Batches */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => setActiveSection('SECTIONS')}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(0, 56, 130, 0.1)' }]}>
              <MaterialIcons name="event-available" size={20} color="#003882" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Workout Sections & Batches
              </Text>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                Yoga, Gym & Zumba classes, trainer assignments & timings
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          </TouchableOpacity>

          <View style={[styles.menuDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

          {/* Bank & Settlements */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => setShowEditBankModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <MaterialIcons name="account-balance" size={20} color="#10B981" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Bank & Instant Settlements
              </Text>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                Payout bank account & direct UPI settlement ID
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          </TouchableOpacity>

          <View style={[styles.menuDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

          {/* Audit Log History */}
          <TouchableOpacity
            style={styles.menuItemRow}
            onPress={() => setShowAuditHistoryModal(true)}
            activeOpacity={0.7}
          >
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
              <MaterialIcons name="history" size={20} color="#0EA5E9" />
            </View>
            <View style={styles.menuTextBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Audit Log History
                </Text>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{auditHistory.length}</Text>
                </View>
              </View>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                Inspect complete audit trail of submitted changes
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SECTION 2: APPEARANCE & PREFERENCES */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Preferences
        </Text>
        <View
          style={[
            styles.menuListCard,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          {/* Push Notifications Row */}
          <View style={styles.menuItemRow}>
            <View
              style={[
                styles.menuIconBox,
                {
                  backgroundColor: isNotificationsEnabled
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                },
              ]}
            >
              <MaterialIcons
                name={isNotificationsEnabled ? 'notifications-active' : 'notifications-off'}
                size={20}
                color={isNotificationsEnabled ? '#10B981' : '#EF4444'}
              />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Push Notifications
              </Text>
              <Text
                style={[
                  styles.menuSubText,
                  { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' },
                ]}
              >
                {isNotificationsEnabled
                  ? 'Real-time alerts for bookings & check-ins'
                  : 'Notifications are turned off'}
              </Text>
            </View>
            <Switch
              value={isNotificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#CBD5E1', true: AppColors.primaryColor }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
              marginHorizontal: 16,
            }}
          />

          {/* Dark Mode Row */}
          <View style={styles.menuItemRow}>
            <View style={[styles.menuIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={20} color="#F59E0B" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Dark Mode
              </Text>
              <Text style={[styles.menuSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                {isDark ? 'Dark theme active' : 'Light theme active'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#CBD5E1', true: AppColors.primaryColor }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </View>

      {/* LOGOUT */}
      <TouchableOpacity
        style={[
          styles.logoutBtn,
          {
            backgroundColor: isDark ? '#450a0a' : '#FEF2F2',
            borderColor: isDark ? '#991b1b' : '#FECACA',
          },
        ]}
        onPress={() => {
          Alert.alert('Sign Out', 'Are you sure you want to sign out from your gym portal?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign Out',
              style: 'destructive',
              onPress: async () => {
                try {
                  await logout();
                } catch {
                  // ignore
                }
                if (typeof navigation?.replace === 'function') {
                  navigation.replace('Login');
                } else if (typeof navigation?.reset === 'function') {
                  navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                } else if (typeof navigation?.navigate === 'function') {
                  navigation.navigate('Login');
                }
              },
            },
          ]);
        }}
      >
        <MaterialIcons name="logout" size={20} color="#DC2626" />
        <Text style={styles.logoutBtnText}>Sign Out from Partner Portal</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // -------------------------------------------------------------------------
  // 2. GYM PROFILE SUB-VIEW (MEDIA, TIMINGS, PRICING, FACILITIES)
  // -------------------------------------------------------------------------
  const renderGymProfileSubView = () => (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: topInset + 12, paddingBottom: 170 + Math.max(insets.bottom, 24) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.subHeaderRow}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' },
          ]}
          onPress={() => setActiveSection('MAIN')}
        >
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Gym Profile & Media
        </Text>
        <View style={{ width: 42 }} />
      </View>

      {/* 1. Brand Assets & Media Uploads Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' },
        ]}
      >
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="photo-library" size={20} color={AppColors.primaryColor} />
            <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Brand Media & Photos
            </Text>
          </View>
        </View>

        {/* Logo Section */}
        <View style={styles.mediaRow}>
          <View style={styles.mediaPreviewCol}>
            <Text style={[styles.mediaLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Brand Logo</Text>
            <View style={styles.logoThumbnailBox}>
              {getGymLogoUri(gymData) ? (
                <Image source={{ uri: getGymLogoUri(gymData) }} style={styles.logoThumbnail} resizeMode="cover" />
              ) : (
                <View style={[styles.logoThumbnailFallback, { backgroundColor: AppColors.primaryColor }]}>
                  <Text style={{ color: '#FFF', fontWeight: 'bold', fontSize: 16 }}>GY</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.mediaActionBtn, { borderColor: AppColors.primaryColor }]}
            onPress={handlePickGymLogo}
            disabled={isUploadingMedia}
          >
            <MaterialIcons name="upload" size={16} color={AppColors.primaryColor} />
            <Text style={[styles.mediaActionBtnText, { color: AppColors.primaryColor }]}>Change Logo</Text>
          </TouchableOpacity>
        </View>

        {/* Cover Photo Section */}
        <View style={[styles.mediaRow, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]}>
          <View style={styles.mediaPreviewCol}>
            <Text style={[styles.mediaLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Cover Photo</Text>
            <View style={styles.coverThumbnailBox}>
              {getSafeImageUri(gymData?.coverPhoto) ? (
                <Image source={{ uri: getSafeImageUri(gymData.coverPhoto) }} style={styles.coverThumbnail} resizeMode="cover" />
              ) : (
                <View style={[styles.coverThumbnailFallback, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                  <MaterialIcons name="image" size={20} color="#94A3B8" />
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={[styles.mediaActionBtn, { borderColor: AppColors.primaryColor }]}
            onPress={handlePickGymCover}
            disabled={isUploadingMedia}
          >
            <MaterialIcons name="upload" size={16} color={AppColors.primaryColor} />
            <Text style={[styles.mediaActionBtnText, { color: AppColors.primaryColor }]}>Change Cover</Text>
          </TouchableOpacity>
        </View>

        {/* Gallery Section */}
        <View style={[styles.mediaRowCol, { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={[styles.mediaLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Gym Floor Gallery ({Array.isArray(gymData?.galleryPhotos) ? gymData.galleryPhotos.length : 0})
            </Text>
            <TouchableOpacity
              style={[styles.mediaActionBtnSmall, { backgroundColor: AppColors.primaryColor }]}
              onPress={handleAddGalleryPhoto}
              disabled={isUploadingMedia}
            >
              <MaterialIcons name="add-photo-alternate" size={15} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>+ Add Photo</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {(Array.isArray(gymData?.galleryPhotos) ? gymData.galleryPhotos : []).map((photo, index) => {
              const photoUri = getSafeImageUri(photo);
              if (!photoUri) return null;
              return (
                <View key={index} style={styles.galleryThumbWrapper}>
                  <Image source={{ uri: photoUri }} style={styles.galleryThumb} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.deletePhotoBtn}
                    onPress={() => handleDeleteGalleryPhoto(index)}
                  >
                    <MaterialIcons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {(!gymData?.galleryPhotos || gymData.galleryPhotos.length === 0) && (
              <Text style={{ fontSize: 12, color: '#94A3B8', paddingVertical: 10 }}>
                No gallery photos added yet. Tap "+ Add Photo" to showcase your gym floor.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>

      {/* 2. Gym Timings Card */}
      <View style={[styles.card, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="schedule" size={20} color={AppColors.accentColor} />
            <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Gym Timings & Shifts
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editPillBtn}
            onPress={() => setShowEditTimingsModal(true)}
          >
            <Text style={styles.editPillText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
            <View style={{
              backgroundColor: timingMode === '24_HOURS' ? 'rgba(16, 185, 129, 0.15)' : timingMode === 'SPLIT_SHIFT' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
            }}>
              <Text style={{
                color: timingMode === '24_HOURS' ? '#10B981' : timingMode === 'SPLIT_SHIFT' ? '#3B82F6' : '#F59E0B',
                fontSize: 11,
                fontWeight: '700',
              }}>
                {timingMode === '24_HOURS' ? '24 Hours Open' : timingMode === 'SPLIT_SHIFT' ? 'Split Shift (Morning + Evening)' : 'Single Continuous Shift'}
              </Text>
            </View>
          </View>
          {timingMode === '24_HOURS' ? (
            <Text style={[styles.timingsDays, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }]}>
              Gym facility operates 24 hours round the clock, 7 days a week.
            </Text>
          ) : timingMode === 'SPLIT_SHIFT' ? (
            <View>
              <Text style={[styles.timingsDays, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }]}>
                Morning Shift: {gymData?.openingHours?.morningShift?.open || morningOpen} - {gymData?.openingHours?.morningShift?.close || morningClose}
              </Text>
              <Text style={[styles.timingsDays, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155', marginTop: 4 }]}>
                Evening Shift: {gymData?.openingHours?.eveningShift?.open || eveningOpen} - {gymData?.openingHours?.eveningShift?.close || eveningClose}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={[styles.timingsDays, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }]}>
                Weekday: {gymData?.openingHours?.weekdayOpen || weekdayOpen} - {gymData?.openingHours?.weekdayClose || weekdayClose}
              </Text>
              <Text style={[styles.timingsDays, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155', marginTop: 4 }]}>
                Weekend: {gymData?.openingHours?.weekendOpen || weekendOpen} - {gymData?.openingHours?.weekendClose || weekendClose}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 3. Pricing Plans Card */}
      <View style={[styles.card, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="card-membership" size={20} color={AppColors.secondaryColor} />
            <View>
              <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Membership Plans
              </Text>
              <Text style={[styles.cardSubText, { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' }]}>
                {normalizedPricingPlans.length} active platform plan(s)
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.editPillBtn}
            onPress={() => setShowAddPlanModal(true)}
          >
            <Text style={styles.editPillText}>+ Add Plan</Text>
          </TouchableOpacity>
        </View>

        {normalizedPricingPlans.map((plan, i) => (
          <View
            key={plan.id || i}
            style={[
              styles.priceRowItem,
              i === normalizedPricingPlans.length - 1 && { borderBottomWidth: 0 },
            ]}
          >
            <View>
              <Text style={[styles.priceDurationLabel, { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' }]}>
                {plan.name || plan.badge}
              </Text>
              <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }}>
                {plan.duration || '30 Days'}
              </Text>
            </View>
            <Text style={[styles.priceAmountVal, { color: '#16a34a' }]}>
              ₹ {Number(plan.price || 0).toLocaleString('en-IN')}
            </Text>
          </View>
        ))}
      </View>

      {/* 3B. Trainer Membership Tier Pricing Mapping (Matches Web Console) */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="fitness-center" size={20} color="#722ED1" />
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text
                style={[
                  styles.cardHeaderTitleText,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                Trainer Membership Tier Pricing ({gymTrainersPricing.length})
              </Text>
              <Text
                style={[
                  styles.cardSubText,
                  { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' },
                ]}
              >
                Configure specific rates charged to members for each membership tier.
              </Text>
            </View>
          </View>
          {gymTrainersPricing.length > 0 && (
            <TouchableOpacity
              style={[
                styles.saveTrainerBtn,
                { backgroundColor: AppColors.primaryColor },
              ]}
              onPress={handleSaveTrainerPricing}
              disabled={isSavingTrainerPricing}
              activeOpacity={0.8}
            >
              {isSavingTrainerPricing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MaterialIcons name="save" size={14} color="#FFFFFF" />
                  <Text style={styles.saveTrainerBtnText}>Save</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {gymTrainersPricing.length === 0 ? (
          <Text style={{ fontSize: 12, color: '#94A3B8', paddingVertical: 8 }}>
            No personal trainers found. Add trainers in Staff / Employees tab to configure tier pricing.
          </Text>
        ) : (
          gymTrainersPricing.map((item, idx) => (
            <View
              key={item.employeeId || idx}
              style={[
                styles.trainerPricingItem,
                {
                  borderColor: isDark ? AppColors.darkBorder : '#F1F5F9',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                },
              ]}
            >
              <View style={styles.trainerHeaderRow}>
                {getSafeImageUri(item.imageUrl) ? (
                  <Image source={{ uri: getSafeImageUri(item.imageUrl) }} style={styles.trainerAvatar} />
                ) : (
                  <View
                    style={[
                      styles.trainerAvatarFallback,
                      { backgroundColor: '#722ED1' },
                    ]}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>
                      {(item.name || 'T').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text
                    style={[
                      styles.trainerName,
                      { color: isDark ? '#FFFFFF' : '#0F172A' },
                    ]}
                  >
                    {item.name || 'Trainer'}
                  </Text>
                  <Text style={styles.trainerSpecialty}>
                    {item.specialty || 'Personal Trainer'}
                  </Text>
                </View>
              </View>

              {/* 5-Tier Pricing Input Grid */}
              <View style={styles.tierInputsGrid}>
                <View style={styles.tierInputCol}>
                  <Text style={styles.tierInputLabel}>Monthly (₹)</Text>
                  <TextInput
                    style={[
                      styles.tierInput,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                    keyboardType="numeric"
                    value={String(item.trainerPricing?.monthly || '')}
                    onChangeText={(val) => handleUpdateTrainerTierRate(idx, 'monthly', val)}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.tierInputCol}>
                  <Text style={styles.tierInputLabel}>Quarterly (₹)</Text>
                  <TextInput
                    style={[
                      styles.tierInput,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                    keyboardType="numeric"
                    value={String(item.trainerPricing?.quarterly || '')}
                    onChangeText={(val) => handleUpdateTrainerTierRate(idx, 'quarterly', val)}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.tierInputCol}>
                  <Text style={styles.tierInputLabel}>Half-Yearly (₹)</Text>
                  <TextInput
                    style={[
                      styles.tierInput,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                    keyboardType="numeric"
                    value={String(item.trainerPricing?.halfYearly || '')}
                    onChangeText={(val) => handleUpdateTrainerTierRate(idx, 'halfYearly', val)}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.tierInputCol}>
                  <Text style={styles.tierInputLabel}>Annual (₹)</Text>
                  <TextInput
                    style={[
                      styles.tierInput,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                    keyboardType="numeric"
                    value={String(item.trainerPricing?.annual || '')}
                    onChangeText={(val) => handleUpdateTrainerTierRate(idx, 'annual', val)}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.tierInputCol}>
                  <Text style={styles.tierInputLabel}>Single Session (₹)</Text>
                  <TextInput
                    style={[
                      styles.tierInput,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                    keyboardType="numeric"
                    value={String(item.trainerPricing?.singleSession || '')}
                    onChangeText={(val) => handleUpdateTrainerTierRate(idx, 'singleSession', val)}
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 4. Facilities & Equipment */}
      <View style={[styles.card, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="verified" size={20} color="#8B5CF6" />
            <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Facilities & Amenities ({selectedFacilities.length})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editPillBtn}
            onPress={() => setShowFacilitiesModal(true)}
          >
            <Text style={styles.editPillText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          {selectedFacilities.map((f, i) => (
            <View key={i} style={[styles.amenityChip, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
              <MaterialIcons name="check-circle" size={14} color="#10B981" />
              <Text style={[styles.amenityChipText, { color: isDark ? '#E2E8F0' : '#334155' }]}>{f}</Text>
            </View>
          ))}
          {selectedFacilities.length === 0 && (
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>No facilities configured. Tap Manage to add.</Text>
          )}
        </View>
      </View>

      {/* 5. Workouts & Disciplines */}
      <View style={[styles.card, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="fitness-center" size={20} color="#EC4899" />
            <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Workouts Offered ({selectedWorkouts.length})
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editPillBtn}
            onPress={() => setShowWorkoutsModal(true)}
          >
            <Text style={styles.editPillText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          {selectedWorkouts.map((w, i) => (
            <View key={i} style={[styles.amenityChip, { backgroundColor: isDark ? '#1E293B' : '#FDF2F8' }]}>
              <MaterialIcons name="local-fire-department" size={14} color="#EC4899" />
              <Text style={[styles.amenityChipText, { color: isDark ? '#E2E8F0' : '#831843' }]}>{w}</Text>
            </View>
          ))}
          {selectedWorkouts.length === 0 && (
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>No workouts configured. Tap Manage to add.</Text>
          )}
        </View>
      </View>

      {/* 6. Amenities */}
      <View style={[styles.card, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="star" size={20} color="#F59E0B" />
            <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Amenities ({selectedAmenities.length})
            </Text>
          </View>
          <TouchableOpacity style={styles.editPillBtn} onPress={() => setShowAmenitiesModal(true)}>
            <Text style={styles.editPillText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.chipRow}>
          {selectedAmenities.map((a, i) => (
            <View key={i} style={[styles.amenityChip, { backgroundColor: isDark ? '#1E293B' : '#FFFBEB' }]}>
              <MaterialIcons name="star" size={14} color="#F59E0B" />
              <Text style={[styles.amenityChipText, { color: isDark ? '#E2E8F0' : '#92400E' }]}>{a}</Text>
            </View>
          ))}
          {selectedAmenities.length === 0 && (
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>No amenities configured. Tap Manage to add.</Text>
          )}
        </View>
      </View>

      {/* 7. Gym Rules */}
      <View style={[styles.card, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="rule" size={20} color="#6366F1" />
            <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Gym Rules ({gymRules.length})
            </Text>
          </View>
          <TouchableOpacity style={styles.editPillBtn} onPress={() => setShowRulesModal(true)}>
            <Text style={styles.editPillText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={{ gap: 6 }}>
          {gymRules.slice(0, 3).map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="check" size={14} color="#6366F1" />
              <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#475569', flex: 1 }}>{r}</Text>
            </View>
          ))}
          {gymRules.length > 3 && (
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>+{gymRules.length - 3} more rules. Tap Manage to view.</Text>
          )}
        </View>
      </View>

      {/* 8. Safety Measures */}
      <View style={[styles.card, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        <View style={styles.cardHeaderWithEdit}>
          <View style={styles.cardHeaderLeft}>
            <MaterialIcons name="security" size={20} color="#10B981" />
            <Text style={[styles.cardHeaderTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Safety Measures ({safetyMeasures.length})
            </Text>
          </View>
          <TouchableOpacity style={styles.editPillBtn} onPress={() => setShowSafetyModal(true)}>
            <Text style={styles.editPillText}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={{ gap: 6 }}>
          {safetyMeasures.slice(0, 3).map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="check-circle" size={14} color="#10B981" />
              <Text style={{ fontSize: 12, color: isDark ? '#CBD5E1' : '#166534', flex: 1 }}>{s}</Text>
            </View>
          ))}
          {safetyMeasures.length > 3 && (
            <Text style={{ fontSize: 11, color: '#94A3B8' }}>+{safetyMeasures.length - 3} more. Tap Manage to view all.</Text>
          )}
        </View>
      </View>
    </ScrollView>
  );

  // -------------------------------------------------------------------------
  // 3. BASIC PROFILE SUB-VIEW (FULL INPUTS MATCHING WEB)
  // -------------------------------------------------------------------------
  const renderBasicProfileSubView = () => (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: topInset + 12, paddingBottom: 170 + Math.max(insets.bottom, 24) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.subHeaderRow}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' },
          ]}
          onPress={() => setActiveSection('MAIN')}
        >
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>
        <Text style={[styles.subHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Basic Profile & Legal
        </Text>
        <View style={{ width: 42 }} />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' },
        ]}
      >
        <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Gym Brand Name *</Text>
        <TextInput
          value={basicName}
          onChangeText={setBasicName}
          placeholder="e.g. Super Max Gym"
          placeholderTextColor="#94A3B8"
          style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
        />

        <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>Tagline / Slogan</Text>
        <TextInput
          value={basicTagline}
          onChangeText={setBasicTagline}
          placeholder="e.g. Transform Your Life"
          placeholderTextColor="#94A3B8"
          style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
        />

        <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>Owner / Contact Person *</Text>
        <TextInput
          value={basicOwnerName}
          onChangeText={setBasicOwnerName}
          placeholder="Owner Full Name"
          placeholderTextColor="#94A3B8"
          style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Phone Number *</Text>
            <TextInput
              value={basicPhone}
              onChangeText={setBasicPhone}
              placeholder="+91 98765 43210"
              keyboardType="phone-pad"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Email Address *</Text>
            <TextInput
              value={basicEmail}
              onChangeText={setBasicEmail}
              placeholder="gym@domain.com"
              keyboardType="email-address"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>GST Number</Text>
            <TextInput
              value={basicGst}
              maxLength={15}
              onChangeText={(val) => setBasicGst((val || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
              placeholder="33AAAAA0000A1Z5"
              autoCapitalize="characters"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>PAN Number</Text>
            <TextInput
              value={basicPan}
              maxLength={10}
              onChangeText={(val) => setBasicPan((val || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
              placeholder="ABCDE1234F"
              autoCapitalize="characters"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>Street Address *</Text>
        <TextInput
          value={basicAddress}
          onChangeText={setBasicAddress}
          placeholder="No. 12, Main Road, Landmark"
          placeholderTextColor="#94A3B8"
          style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Area / Locality</Text>
            <TextInput
              value={basicArea}
              onChangeText={setBasicArea}
              placeholder="e.g. Mangadu"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>City *</Text>
            <TextInput
              value={basicCity}
              onChangeText={setBasicCity}
              placeholder="e.g. Chennai"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>State</Text>
            <TextInput
              value={basicState}
              onChangeText={setBasicState}
              placeholder="Tamil Nadu"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Pincode</Text>
            <TextInput
              value={basicPincode}
              onChangeText={setBasicPincode}
              placeholder="600122"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Floor Space (Sq. Ft.)</Text>
            <TextInput
              value={basicFloorSpace}
              onChangeText={setBasicFloorSpace}
              placeholder="e.g. 3500"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Max Floor Capacity</Text>
            <TextInput
              value={basicCapacity}
              onChangeText={setBasicCapacity}
              placeholder="e.g. 100"
              keyboardType="number-pad"
              placeholderTextColor="#94A3B8"
              style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            />
          </View>
        </View>

        <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>Google Maps Link</Text>
        <TextInput
          value={basicMapsUrl}
          onChangeText={setBasicMapsUrl}
          placeholder="https://maps.google.com/..."
          placeholderTextColor="#94A3B8"
          style={[styles.formInput, { color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
        />

        <Text style={[styles.inputLabel, { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 12 }]}>About Gym & Description</Text>
        <TextInput
          value={basicAbout}
          onChangeText={setBasicAbout}
          placeholder="State of the art gym equipment, professional certified trainers..."
          multiline
          numberOfLines={3}
          placeholderTextColor="#94A3B8"
          style={[styles.formInput, { height: 80, textAlignVertical: 'top', color: isDark ? '#FFFFFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
        />

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 18 }]}
          onPress={handleSaveBasicProfile}
          disabled={isSavingBasic}
        >
          {isSavingBasic ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Changes for Super Admin Approval</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  // -------------------------------------------------------------------------
  // 4. TRAINER PROFILE SUB-VIEW (LIST & FILTER)
  // -------------------------------------------------------------------------
  const renderTrainerProfileSubView = () => {
    const filterTabs = [
      { key: 'All', label: `All (${trainers.length})` },
      { key: 'Full-Time', label: `Full-Time` },
      { key: 'Part-Time', label: `Part-Time` },
    ];

    const filteredTrainers = trainers.filter((t) => {
      if (trainerTabType === 'All') return true;
      return t.type === trainerTabType;
    });

    return (
      <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
        <View style={[styles.subHeaderRow, { paddingTop: topInset + 10, paddingHorizontal: 18 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            onPress={() => setActiveSection('MAIN')}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.subHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Trainers & Coaches
          </Text>
          <TouchableOpacity
            style={styles.addPillTopBtn}
            onPress={openAddTrainerFlow}
          >
            <MaterialIcons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addPillTopBtnText}>Add Trainer</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={[styles.docTabsContainer, { borderBottomColor: isDark ? AppColors.darkBorder : '#E2E8F0', paddingHorizontal: 12 }]}>
          {filterTabs.map((tab) => {
            const isSelected = trainerTabType === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.docTabItem,
                  isSelected && { borderBottomColor: AppColors.primaryColor, borderBottomWidth: 2.5 },
                ]}
                onPress={() => setTrainerTabType(tab.key)}
              >
                <Text
                  style={[
                    styles.docTabText,
                    {
                      color: isSelected ? (isDark ? '#93C5FD' : AppColors.primaryColor) : isDark ? 'rgba(255,255,255,0.5)' : '#64748B',
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 14, paddingBottom: 170 + Math.max(insets.bottom, 24) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingEmployees}
              onRefresh={fetchEmployeesData}
              tintColor={AppColors.primaryColor}
            />
          }
        >
          {filteredTrainers.map((trainer) => {
            const isApproved = trainer.approvalStatus === 'Approved';
            const isPending = trainer.approvalStatus === 'Pending Approval';
            const avatarUri = getSafeImageUri(trainer.avatar);

            return (
              <TouchableOpacity
                key={trainer._id || trainer.id}
                style={[
                  styles.trainerCardRow,
                  {
                    backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                  },
                ]}
                onPress={() => {
                  setSelectedEmpDetail(trainer);
                  setDetailModalTab('details');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.trainerAvatarWrapper}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.trainerCardAvatar} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: AppColors.primaryColor }]}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                        {trainer.name ? trainer.name.slice(0, 2).toUpperCase() : 'TR'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.trainerCenterInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.trainerCardName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {trainer.name}
                    </Text>
                    <View style={styles.empIdTag}>
                      <Text style={styles.empIdTagText}>{trainer.employeeId || 'TR'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.trainerSpecText, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    {trainer.specialty || trainer.role} • {trainer.type || 'Full-Time'}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8', marginTop: 2 }}>
                    {trainer.phone || 'No phone'}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View
                    style={[
                      styles.approvalStatusPill,
                      {
                        backgroundColor: isApproved
                          ? 'rgba(22, 163, 74, 0.12)'
                          : isPending
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(239, 68, 68, 0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.approvalStatusText,
                        {
                          color: isApproved
                            ? '#16a34a'
                            : isPending
                            ? '#d97706'
                            : '#ef4444',
                        },
                      ]}
                    >
                      {trainer.approvalStatus || 'Approved'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
                </View>
              </TouchableOpacity>
            );
          })}

          {filteredTrainers.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialIcons name="sports" size={40} color="#94A3B8" />
              <Text style={{ marginTop: 10, color: '#94A3B8', fontSize: 14 }}>
                No trainers registered yet. Tap "Add Trainer" to onboard.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // 5. EMPLOYEES & STAFF SUB-VIEW
  // -------------------------------------------------------------------------
  const renderEmployeesSubView = () => {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
        <View style={[styles.subHeaderRow, { paddingTop: topInset + 10, paddingHorizontal: 18 }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            onPress={() => setActiveSection('MAIN')}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.subHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Staff & Employees
          </Text>
          <TouchableOpacity
            style={styles.addPillTopBtn}
            onPress={openAddStaffFlow}
          >
            <MaterialIcons name="add" size={16} color="#FFFFFF" />
            <Text style={styles.addPillTopBtnText}>Add Staff</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 14, paddingBottom: 170 + Math.max(insets.bottom, 24) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isLoadingEmployees}
              onRefresh={fetchEmployeesData}
              tintColor={AppColors.primaryColor}
            />
          }
        >
          {staffEmployees.map((emp) => {
            const isApproved = emp.approvalStatus === 'Approved';
            const isPending = emp.approvalStatus === 'Pending Approval';
            const avatarUri = getSafeImageUri(emp.avatar);
            const isSelf = Boolean(
              (user?.email && emp.email && user.email.toLowerCase() === emp.email.toLowerCase()) ||
              (user?.phone && emp.phone && user.phone.replace(/[^0-9]/g, '') === String(emp.phone).replace(/[^0-9]/g, '')) ||
              (user?.employeeId && emp.employeeId && user.employeeId === emp.employeeId) ||
              (user?.name && emp.name && user.name.toLowerCase() === emp.name.toLowerCase()) ||
              (user?.id && (emp._id === user.id || emp.id === user.id || emp.userId === user.id))
            );

            return (
              <TouchableOpacity
                key={emp._id || emp.id}
                style={[
                  styles.trainerCardRow,
                  {
                    backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                    borderColor: isSelf
                      ? '#A855F7'
                      : isDark
                      ? AppColors.darkBorder
                      : '#E2E8F0',
                    borderWidth: isSelf ? 1.5 : 1,
                  },
                ]}
                onPress={() => {
                  setSelectedEmpDetail(emp);
                  setDetailModalTab('details');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.trainerAvatarWrapper}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.trainerCardAvatar} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: '#A855F7' }]}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                        {emp.name ? emp.name.slice(0, 2).toUpperCase() : 'ST'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.trainerCenterInfo}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.trainerCardName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {emp.name}
                    </Text>
                    {isSelf && (
                      <View
                        style={{
                          backgroundColor: isDark ? 'rgba(168, 85, 247, 0.22)' : '#F3E8FF',
                          borderColor: isDark ? 'rgba(168, 85, 247, 0.5)' : '#D8B4FE',
                          borderWidth: 1,
                          borderRadius: 6,
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          marginRight: 4,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#9333EA' }}>You</Text>
                      </View>
                    )}
                    <View style={styles.empIdTag}>
                      <Text style={styles.empIdTagText}>{emp.employeeId || 'ST'}</Text>
                    </View>
                  </View>
                  <Text style={[styles.trainerSpecText, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    {emp.role} • {emp.accessType || 'Employee'}
                  </Text>
                  <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8', marginTop: 2 }}>
                    {emp.phone || 'No phone'}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View
                    style={[
                      styles.approvalStatusPill,
                      {
                        backgroundColor: isApproved
                          ? 'rgba(22, 163, 74, 0.12)'
                          : isPending
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(239, 68, 68, 0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.approvalStatusText,
                        {
                          color: isApproved
                            ? '#16a34a'
                            : isPending
                            ? '#d97706'
                            : '#ef4444',
                        },
                      ]}
                    >
                      {emp.approvalStatus || 'Approved'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
                </View>
              </TouchableOpacity>
            );
          })}

          {staffEmployees.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <MaterialIcons name="people" size={40} color="#94A3B8" />
              <Text style={{ marginTop: 10, color: '#94A3B8', fontSize: 14 }}>
                No general staff registered yet. Tap "Add Staff" to onboard.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // 6. UNIFIED SINGLE-PAGE ADD TRAINER / STAFF FORM (MATCHING WEB LOGIC)
  // -------------------------------------------------------------------------
  return (
    <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
      {activeSection === 'MAIN' && renderMainHub()}
      {activeSection === 'GYM_PROFILE' && renderGymProfileSubView()}
      {activeSection === 'BASIC_PROFILE' && renderBasicProfileSubView()}
      {activeSection === 'TRAINER_PROFILE' && renderTrainerProfileSubView()}
      {activeSection === 'EMPLOYEES' && renderEmployeesSubView()}
      {activeSection === 'SECTIONS' && (
        <SectionsSubView
          topInset={topInset}
          onBack={() => setActiveSection('MAIN')}
          gymId={targetGymId}
        />
      )}

      {/* ==================== REUSABLE ADD EMPLOYEE / TRAINER MODAL ==================== */}
      <AddEmployeeModal
        visible={showAddEmpModal}
        defaultRole={addEmpModalDefaultRole}
        onClose={() => setShowAddEmpModal(false)}
        onSuccess={() => {
          fetchEmployeesData();
        }}
      />

      {/* ==================== MODAL: EMPLOYEE / TRAINER DETAILS ==================== */}
      <Modal
        visible={!!selectedEmpDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEmpDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 620, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {selectedEmpDetail?.name}
                </Text>
                {Boolean(
                  (user?.email && selectedEmpDetail?.email && user.email.toLowerCase() === selectedEmpDetail.email.toLowerCase()) ||
                  (user?.phone && selectedEmpDetail?.phone && user.phone.replace(/[^0-9]/g, '') === String(selectedEmpDetail.phone).replace(/[^0-9]/g, '')) ||
                  (user?.employeeId && selectedEmpDetail?.employeeId && user.employeeId === selectedEmpDetail.employeeId) ||
                  (user?.name && selectedEmpDetail?.name && user.name.toLowerCase() === selectedEmpDetail.name.toLowerCase()) ||
                  (user?.id && (selectedEmpDetail?._id === user.id || selectedEmpDetail?.id === user.id || selectedEmpDetail?.userId === user.id))
                ) && (
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(168, 85, 247, 0.22)' : '#F3E8FF',
                      borderColor: isDark ? 'rgba(168, 85, 247, 0.5)' : '#D8B4FE',
                      borderWidth: 1,
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                    }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#9333EA' }}>You</Text>
                  </View>
                )}
                <View style={styles.empIdTag}>
                  <Text style={styles.empIdTagText}>{selectedEmpDetail?.employeeId || 'EMP'}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedEmpDetail(null)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.docTabsContainer, { borderBottomColor: isDark ? AppColors.darkBorder : '#E2E8F0', paddingHorizontal: 0, marginVertical: 8 }]}>
              <TouchableOpacity
                style={[styles.docTabItem, detailModalTab === 'details' && { borderBottomColor: AppColors.primaryColor, borderBottomWidth: 2.5 }]}
                onPress={() => setDetailModalTab('details')}
              >
                <Text style={[styles.docTabText, { color: detailModalTab === 'details' ? AppColors.primaryColor : isDark ? '#888' : '#64748B', fontWeight: '700' }]}>
                  Overview
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.docTabItem, detailModalTab === 'documents' && { borderBottomColor: AppColors.primaryColor, borderBottomWidth: 2.5 }]}
                onPress={() => setDetailModalTab('documents')}
              >
                <Text style={[styles.docTabText, { color: detailModalTab === 'documents' ? AppColors.primaryColor : isDark ? '#888' : '#64748B', fontWeight: '700' }]}>
                  Docs & Certs ({((selectedEmpDetail?.documents || []).length) + ((selectedEmpDetail?.trainerCerts || []).length)})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {detailModalTab === 'details' && (
                <View style={{ gap: 10, paddingVertical: 6 }}>
                  <View style={styles.infoRowBetween}>
                    <Text style={{ fontSize: 12, color: isDark ? '#888' : '#64748B' }}>Role</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFF' : '#0F172A' }}>
                      {selectedEmpDetail?.specialty || selectedEmpDetail?.role}
                    </Text>
                  </View>

                  <View style={styles.infoRowBetween}>
                    <Text style={{ fontSize: 12, color: isDark ? '#888' : '#64748B' }}>Approval Status</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selectedEmpDetail?.approvalStatus === 'Approved' ? '#16A34A' : '#D97706' }}>
                      {selectedEmpDetail?.approvalStatus || 'Approved'}
                    </Text>
                  </View>

                  <View style={styles.infoRowBetween}>
                    <Text style={{ fontSize: 12, color: isDark ? '#888' : '#64748B' }}>Phone</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFF' : '#0F172A' }}>
                      {selectedEmpDetail?.phone || '—'}
                    </Text>
                  </View>

                  <View style={styles.infoRowBetween}>
                    <Text style={{ fontSize: 12, color: isDark ? '#888' : '#64748B' }}>Email</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFF' : '#0F172A' }}>
                      {selectedEmpDetail?.email || '—'}
                    </Text>
                  </View>

                  <View style={styles.infoRowBetween}>
                    <Text style={{ fontSize: 12, color: isDark ? '#888' : '#64748B' }}>Shift Hours</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFF' : '#0F172A' }}>
                      {selectedEmpDetail?.schedule?.shiftHours || `${selectedEmpDetail?.schedule?.workingTimeStart || '06:00 AM'} - ${selectedEmpDetail?.schedule?.workingTimeEnd || '02:00 PM'}`}
                    </Text>
                  </View>

                  <View style={styles.infoRowBetween}>
                    <Text style={{ fontSize: 12, color: isDark ? '#888' : '#64748B' }}>Monthly Pay</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#16A34A' }}>
                      ₹{Number(selectedEmpDetail?.compensation?.payAmount || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>

                  <View style={styles.infoRowBetween}>
                    <Text style={{ fontSize: 12, color: isDark ? '#888' : '#64748B' }}>Emergency Contact</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFF' : '#0F172A' }}>
                      {selectedEmpDetail?.emergencyContact?.name ? `${selectedEmpDetail.emergencyContact.name} (${selectedEmpDetail.emergencyContact.phone})` : '—'}
                    </Text>
                  </View>

                  {/* Contact Actions */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <TouchableOpacity
                      style={[styles.actionBtnRow, { backgroundColor: '#10B981' }]}
                      onPress={() => {
                        if (selectedEmpDetail?.phone) {
                          Linking.openURL(`tel:${selectedEmpDetail.phone}`);
                        }
                      }}
                    >
                      <MaterialIcons name="phone" size={16} color="#FFFFFF" />
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtnRow, { backgroundColor: '#25D366' }]}
                      onPress={() => {
                        if (selectedEmpDetail?.phone) {
                          const clean = selectedEmpDetail.phone.replace(/[^0-9]/g, '');
                          Linking.openURL(`whatsapp://send?phone=${clean}`);
                        }
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Deactivate Button */}
                  <TouchableOpacity
                    style={[styles.deactivateBtn, { borderColor: '#EF4444', marginTop: 10 }]}
                    onPress={() => handleDeleteEmployee(selectedEmpDetail)}
                  >
                    <MaterialIcons name="block" size={16} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Deactivate Employee</Text>
                  </TouchableOpacity>
                </View>
              )}

              {detailModalTab === 'documents' && (
                <View style={{ gap: 10, paddingVertical: 6 }}>
                  {/* Government Verification ID Proofs */}
                  <Text style={[styles.subSectionTitle, { color: '#722ED1' }]}>Government ID Proofs</Text>
                  {(selectedEmpDetail?.documents || []).map((doc, idx) => (
                    <View key={idx} style={[styles.docListItem, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                      <MaterialIcons name="verified-user" size={20} color="#10B981" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docListTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{doc.docType}</Text>
                        <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }}>
                          Number: {doc.docNum} • {doc.fileName}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(!selectedEmpDetail?.documents || selectedEmpDetail.documents.length === 0) && (
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>No government ID documents attached.</Text>
                  )}

                  {/* Trainer Certifications */}
                  <Text style={[styles.subSectionTitle, { color: '#722ED1', marginTop: 10 }]}>Trainer Certifications</Text>
                  {(selectedEmpDetail?.trainerCerts || []).map((cert, idx) => (
                    <View key={idx} style={[styles.docListItem, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                      <MaterialIcons name="card-membership" size={20} color="#F59E0B" />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.docListTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{cert.certType}</Text>
                        <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }}>
                          Cert ID: {cert.certNum} • {cert.fileName}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {(!selectedEmpDetail?.trainerCerts || selectedEmpDetail.trainerCerts.length === 0) && (
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>No trainer certifications attached.</Text>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: TIMINGS ==================== */}
      <Modal
        visible={showEditTimingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditTimingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 540, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Edit Gym Operating Hours
              </Text>
              <TouchableOpacity onPress={() => setShowEditTimingsModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginBottom: 6 }]}>Timing Model</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                {[
                  { key: 'REGULAR', label: 'Single Shift' },
                  { key: 'SPLIT_SHIFT', label: 'Split Shift' },
                  { key: '24_HOURS', label: '24 Hours' },
                ].map((modeOption) => {
                  const isSelected = timingMode === modeOption.key;
                  return (
                    <TouchableOpacity
                      key={modeOption.key}
                      onPress={() => setTimingMode(modeOption.key)}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: isSelected ? AppColors.primaryColor : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: isSelected ? AppColors.primaryColor : (isDark ? AppColors.darkBorder : '#E2E8F0'),
                      }}
                    >
                      <Text style={{
                        color: isSelected ? '#FFFFFF' : (isDark ? '#94A3B8' : '#64748B'),
                        fontSize: 12,
                        fontWeight: '700',
                      }}>
                        {modeOption.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {timingMode === '24_HOURS' ? (
                <View style={{
                  padding: 14,
                  borderRadius: 8,
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  marginBottom: 10,
                }}>
                  <Text style={{ color: '#10B981', fontWeight: '700', fontSize: 13, marginBottom: 2 }}>
                    Open 24/7 Facility
                  </Text>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#334155', fontSize: 12 }}>
                    Members can book slots and access the gym at any hour of the day or night.
                  </Text>
                </View>
              ) : timingMode === 'SPLIT_SHIFT' ? (
                <View>
                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A' }]}>Morning Shift - Open</Text>
                  <TextInput
                    value={morningOpen}
                    onChangeText={setMorningOpen}
                    placeholder="05:30 AM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />

                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Morning Shift - Close</Text>
                  <TextInput
                    value={morningClose}
                    onChangeText={setMorningClose}
                    placeholder="11:30 AM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />

                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Evening Shift - Open</Text>
                  <TextInput
                    value={eveningOpen}
                    onChangeText={setEveningOpen}
                    placeholder="04:30 PM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />

                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Evening Shift - Close</Text>
                  <TextInput
                    value={eveningClose}
                    onChangeText={setEveningClose}
                    placeholder="10:30 PM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />
                </View>
              ) : (
                <View>
                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A' }]}>Weekday Open Time</Text>
                  <TextInput
                    value={weekdayOpen}
                    onChangeText={setWeekdayOpen}
                    placeholder="05:30 AM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />

                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Weekday Close Time</Text>
                  <TextInput
                    value={weekdayClose}
                    onChangeText={setWeekdayClose}
                    placeholder="10:30 PM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />

                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Weekend Open Time</Text>
                  <TextInput
                    value={weekendOpen}
                    onChangeText={setWeekendOpen}
                    placeholder="06:00 AM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />

                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Weekend Close Time</Text>
                  <TextInput
                    value={weekendClose}
                    onChangeText={setWeekendClose}
                    placeholder="09:00 PM"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 14 }]}
                onPress={handleSaveOperatingHours}
              >
                <Text style={styles.submitBtnText}>Submit Timings for Approval</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: BANK & SETTLEMENTS ==================== */}
      <Modal
        visible={showEditBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 520, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Bank & Instant Settlements
              </Text>
              <TouchableOpacity onPress={() => setShowEditBankModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A' }]}>Account Holder Name *</Text>
              <TextInput
                value={accountHolder}
                onChangeText={setAccountHolder}
                placeholder="Name as in Bank Account"
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              />

              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Bank Name</Text>
              <TextInput
                value={bankName}
                onChangeText={setBankName}
                placeholder="e.g. HDFC Bank / ICICI Bank"
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              />

              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Account Number *</Text>
              <TextInput
                value={accountNumber}
                onChangeText={setAccountNumber}
                placeholder="Bank Account Number"
                keyboardType="number-pad"
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              />

              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>IFSC Code *</Text>
              <TextInput
                value={ifscCode}
                onChangeText={setIfscCode}
                placeholder="HDFC0001234"
                autoCapitalize="characters"
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              />

              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Instant Settlement UPI ID</Text>
              <TextInput
                value={upiId}
                onChangeText={setUpiId}
                placeholder="gym@okhdfcbank"
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 14 }]}
                onPress={handleSaveBankDetails}
              >
                <Text style={styles.submitBtnText}>Submit Bank Details for Approval</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: ADD PRICING PLAN ==================== */}
      <Modal
        visible={showAddPlanModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddPlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 480, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Add Membership Plan
              </Text>
              <TouchableOpacity onPress={() => setShowAddPlanModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A' }]}>Plan Name *</Text>
              <TextInput
                value={planName}
                onChangeText={setPlanName}
                placeholder="e.g. 1-Month Fitness Pass"
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A' }]}>Price (₹) *</Text>
                  <TextInput
                    value={planPrice}
                    onChangeText={setPlanPrice}
                    placeholder="1999"
                    keyboardType="number-pad"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A' }]}>Duration</Text>
                  <TextInput
                    value={planDuration}
                    onChangeText={setPlanDuration}
                    placeholder="30 Days"
                    placeholderTextColor="#94A3B8"
                    style={[styles.modalInput, { color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: isDark ? '#FFF' : '#0F172A', marginTop: 8 }]}>Features (One per line)</Text>
              <TextInput
                value={planFeatures}
                onChangeText={setPlanFeatures}
                placeholder="Full Gym Floor Access&#10;Locker & Shower Included&#10;Free Trainer Guidance"
                multiline
                numberOfLines={3}
                placeholderTextColor="#94A3B8"
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top', color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              />

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 14 }]}
                onPress={handleAddPricingPlan}
              >
                <Text style={styles.submitBtnText}>Save Plan for Approval</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: FACILITIES CHECKLIST ==================== */}
      <Modal
        visible={showFacilitiesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFacilitiesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 560, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Manage Gym Facilities
              </Text>
              <TouchableOpacity onPress={() => setShowFacilitiesModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {ALL_FACILITIES.map((fac) => {
                const isSelected = selectedFacilities.includes(fac);
                return (
                  <TouchableOpacity
                    key={fac}
                    style={[
                      styles.checklistRow,
                      {
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : isDark ? '#1E293B' : '#F8FAFC',
                        borderColor: isSelected ? '#10B981' : isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedFacilities(selectedFacilities.filter((f) => f !== fac));
                      } else {
                        setSelectedFacilities([...selectedFacilities, fac]);
                      }
                    }}
                  >
                    <MaterialIcons
                      name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={isSelected ? '#10B981' : '#94A3B8'}
                    />
                    <Text style={[styles.checklistText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{fac}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 14 }]}
                onPress={handleSaveFacilities}
              >
                <Text style={styles.submitBtnText}>Save Facilities</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: WORKOUTS CHECKLIST ==================== */}
      <Modal
        visible={showWorkoutsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWorkoutsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 560, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Manage Workouts Offered
              </Text>
              <TouchableOpacity onPress={() => setShowWorkoutsModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {ALL_WORKOUTS.map((wk) => {
                const isSelected = selectedWorkouts.includes(wk);
                return (
                  <TouchableOpacity
                    key={wk}
                    style={[
                      styles.checklistRow,
                      {
                        backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.1)' : isDark ? '#1E293B' : '#F8FAFC',
                        borderColor: isSelected ? '#EC4899' : isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedWorkouts(selectedWorkouts.filter((w) => w !== wk));
                      } else {
                        setSelectedWorkouts([...selectedWorkouts, wk]);
                      }
                    }}
                  >
                    <MaterialIcons
                      name={isSelected ? 'check-box' : 'check-box-outline-blank'}
                      size={22}
                      color={isSelected ? '#EC4899' : '#94A3B8'}
                    />
                    <Text style={[styles.checklistText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{wk}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 14 }]}
                onPress={handleSaveWorkouts}
              >
                <Text style={styles.submitBtnText}>Save Workout Disciplines</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: AMENITIES CHECKLIST ==================== */}
      <Modal
        visible={showAmenitiesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAmenitiesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 520, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Manage Gym Amenities</Text>
              <TouchableOpacity onPress={() => setShowAmenitiesModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {ALL_AMENITIES.map((amen) => {
                const isSelected = selectedAmenities.includes(amen);
                return (
                  <TouchableOpacity
                    key={amen}
                    style={[styles.checklistRow, {
                      backgroundColor: isSelected ? 'rgba(245, 158, 11, 0.1)' : isDark ? '#1E293B' : '#F8FAFC',
                      borderColor: isSelected ? '#F59E0B' : isDark ? AppColors.darkBorder : '#E2E8F0',
                    }]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedAmenities(selectedAmenities.filter((a) => a !== amen));
                      } else {
                        setSelectedAmenities([...selectedAmenities, amen]);
                      }
                    }}
                  >
                    <MaterialIcons name={isSelected ? 'check-box' : 'check-box-outline-blank'} size={22} color={isSelected ? '#F59E0B' : '#94A3B8'} />
                    <Text style={[styles.checklistText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{amen}</Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 14 }]}
                onPress={handleSaveAmenities}
              >
                <Text style={styles.submitBtnText}>Save Amenities</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: GYM RULES ==================== */}
      <Modal
        visible={showRulesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRulesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 580, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Gym Rules & Guidelines</Text>
              <TouchableOpacity onPress={() => setShowRulesModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {gymRules.map((rule, idx) => (
                <View key={idx} style={[styles.checklistRow, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0', justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <MaterialIcons name="check" size={18} color="#6366F1" />
                    <Text style={[styles.checklistText, { color: isDark ? '#FFFFFF' : '#0F172A', flex: 1 }]}>{rule}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setGymRules(gymRules.filter((_, i) => i !== idx))}>
                    <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1, height: 40, color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  placeholder="Add new rule..."
                  placeholderTextColor="#94A3B8"
                  value={newRuleText}
                  onChangeText={setNewRuleText}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, { paddingHorizontal: 14, paddingVertical: 0, height: 40, justifyContent: 'center', backgroundColor: '#6366F1' }]}
                  onPress={() => {
                    if (newRuleText.trim()) {
                      setGymRules([...gymRules, newRuleText.trim()]);
                      setNewRuleText('');
                    }
                  }}
                >
                  <Text style={styles.submitBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 12 }]}
                onPress={handleSaveRules}
              >
                <Text style={styles.submitBtnText}>Save Rules</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: SAFETY MEASURES ==================== */}
      <Modal
        visible={showSafetyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSafetyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 580, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>Safety Measures & Protocols</Text>
              <TouchableOpacity onPress={() => setShowSafetyModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {safetyMeasures.map((measure, idx) => (
                <View key={idx} style={[styles.checklistRow, { backgroundColor: isDark ? '#1E293B' : '#F0FDF4', borderColor: isDark ? AppColors.darkBorder : '#BBF7D0', justifyContent: 'space-between' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <MaterialIcons name="check-circle" size={18} color="#10B981" />
                    <Text style={[styles.checklistText, { color: isDark ? '#FFFFFF' : '#166534', flex: 1 }]}>{measure}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSafetyMeasures(safetyMeasures.filter((_, i) => i !== idx))}>
                    <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1, height: 40, color: isDark ? '#FFF' : '#0F172A', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
                  placeholder="Add safety measure..."
                  placeholderTextColor="#94A3B8"
                  value={newSafetyText}
                  onChangeText={setNewSafetyText}
                />
                <TouchableOpacity
                  style={[styles.submitBtn, { paddingHorizontal: 14, paddingVertical: 0, height: 40, justifyContent: 'center', backgroundColor: '#10B981' }]}
                  onPress={() => {
                    if (newSafetyText.trim()) {
                      setSafetyMeasures([...safetyMeasures, newSafetyText.trim()]);
                      setNewSafetyText('');
                    }
                  }}
                >
                  <Text style={styles.submitBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 12 }]}
                onPress={handleSaveSafety}
              >
                <Text style={styles.submitBtnText}>Save Safety Measures</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL: AUDIT LOG HISTORY ==================== */}
      <Modal
        visible={showAuditHistoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAuditHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerModalCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: 560, paddingBottom: modalSheetBottomPadding }]}>
            <View style={styles.pickerModalHeader}>
              <Text style={[styles.pickerModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Audit Log History ({auditHistory.length})
              </Text>
              <TouchableOpacity onPress={() => setShowAuditHistoryModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {auditHistory.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.docListItem,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      borderWidth: 1,
                    },
                  ]}
                >
                  <MaterialIcons name="history" size={20} color="#0EA5E9" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.docListTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {item.field || item.changeType || 'Profile Update'}
                    </Text>
                    <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }}>
                      Status: {item.approvalStatus || 'Pending Approval'} • {item.changedAt ? new Date(item.changedAt).toLocaleDateString() : 'Recent'}
                    </Text>
                  </View>
                </View>
              ))}
              {auditHistory.length === 0 && (
                <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', paddingVertical: 20 }}>
                  No audit log records found.
                </Text>
              )}
            </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 16,
  },
  profileHeroCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gymLogoWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gymLogo: {
    width: '100%',
    height: '100%',
  },
  gymInitialBadge: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymInitialText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileNameRow: {
    flex: 1,
  },
  profileGymName: {
    fontSize: 17,
    fontWeight: '800',
  },
  idStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  partnerIdTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  partnerIdText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileGymAddress: {
    fontSize: 12,
    marginTop: 8,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 10,
  },
  menuListCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextBox: {
    flex: 1,
  },
  menuTitleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  menuDivider: {
    height: 1,
    marginLeft: 64,
  },
  badgePill: {
    backgroundColor: '#722ED1',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginVertical: 10,
  },
  logoutBtnText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 14,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  addPillTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: AppColors.primaryColor,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addPillTopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeaderWithEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardHeaderTitleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  editPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  editPillText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mediaRowCol: {
    flexDirection: 'column',
  },
  mediaPreviewCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mediaLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  logoThumbnailBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  logoThumbnail: {
    width: '100%',
    height: '100%',
  },
  logoThumbnailFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverThumbnailBox: {
    width: 70,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  coverThumbnail: {
    width: '100%',
    height: '100%',
  },
  coverThumbnailFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  mediaActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mediaActionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  galleryThumbWrapper: {
    width: 80,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timingsDays: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  priceDurationLabel: {
    fontSize: 13,
  },
  priceAmountVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  amenityChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 13.5,
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  docTabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  docTabItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  docTabText: {
    fontSize: 13,
  },
  trainerCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 10,
  },
  trainerAvatarWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  trainerCardAvatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerCenterInfo: {
    flex: 1,
  },
  trainerCardName: {
    fontSize: 14,
    fontWeight: '800',
  },
  empIdTag: {
    marginLeft: 4,
  },
  empIdTagText: {
    color: '#722ED1',
    fontSize: 10,
    fontWeight: '800',
  },
  trainerSpecText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  approvalStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  approvalStatusText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  wizardProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  stepPillActive: {
    backgroundColor: '#722ED1',
  },
  stepPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  stepPillTextActive: {
    color: '#FFFFFF',
  },
  stepConnector: {
    width: 12,
    height: 2,
    backgroundColor: '#CBD5E1',
  },
  stepHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10,
  },
  empPhotoPickerBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  empPhotoPreview: {
    width: '100%',
    height: '100%',
  },
  selectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  selectionChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  selectionChipTextSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  subSectionBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(114, 46, 209, 0.1)',
  },
  attachBtnText: {
    color: '#722ED1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  docListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  docListTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  backStepBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  pickerModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  fileUploadBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  infoRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  actionBtnRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  checklistText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownField: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValueText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  pickerOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  pickerOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  pickerOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  saveTrainerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  saveTrainerBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  trainerPricingItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  trainerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  trainerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  trainerAvatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  trainerSpecialty: {
    fontSize: 11.5,
    color: '#722ED1',
    fontWeight: '600',
    marginTop: 1,
  },
  tierInputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tierInputCol: {
    width: '48%',
  },
  tierInputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  tierInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    fontSize: 13,
    fontWeight: '600',
  },
  topBackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 4,
  },
  topBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBackHeaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  topBackHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default SettingsTab;

