import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Switch,
  Modal,
  PermissionsAndroid,
  NativeModules,
  TurboModuleRegistry,
} from 'react-native';

const getGeolocation = () => {
  try {
    const hasNative =
      (typeof TurboModuleRegistry?.get === 'function' && TurboModuleRegistry.get('RNCGeolocation')) ||
      NativeModules?.RNCGeolocation;
    if (!hasNative) return null;
    const mod = require('@react-native-community/geolocation');
    return mod?.default || mod;
  } catch {
    return null;
  }
};
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { pickImageFromDevice } from '../utils/filePickerUtils';
import { BANKS, getBankByName } from '../utils/bankData';
import {
  stripEmojis,
  containsEmoji,
  validateEmail,
  validatePhone,
  validateUpiId,
  validatePersonName,
  validatePassword,
  validatePostalCode,
  validateAccountNumber,
  validateConfirmAccountNumber,
  MEDIA_FIELDS,
} from '../utils/validationUtils';

// GPS Regex helper for extracting coordinates from various Google Maps URL formats
const AT_COORDS_REGEX = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const Q_COORDS_REGEX = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const D3D4_COORDS_REGEX = /!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/;
const LL_COORDS_REGEX = /(?:ll|loc:)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

const extractCoordinatesFromMapsUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  const atMatch = AT_COORDS_REGEX.exec(url);
  if (atMatch) return { lat: Number.parseFloat(atMatch[1]), lng: Number.parseFloat(atMatch[2]) };

  const qMatch = Q_COORDS_REGEX.exec(url);
  if (qMatch) return { lat: Number.parseFloat(qMatch[1]), lng: Number.parseFloat(qMatch[2]) };

  const d3d4Match = D3D4_COORDS_REGEX.exec(url);
  if (d3d4Match) return { lat: Number.parseFloat(d3d4Match[1]), lng: Number.parseFloat(d3d4Match[2]) };

  const llMatch = LL_COORDS_REGEX.exec(url);
  if (llMatch) return { lat: Number.parseFloat(llMatch[1]), lng: Number.parseFloat(llMatch[2]) };

  return null;
};

// OpenStreetMap Reverse Geocoding helper
const reverseGeocodeCoordinates = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'GYMEZY-Mobile-App/1.0',
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const addr = data.address || {};

    const streetComponents = [
      addr.building || addr.amenity || addr.house_name || addr.house_number,
      addr.road || addr.street || addr.pedestrian || addr.footway,
      addr.neighbourhood || addr.suburb || addr.residential,
    ].filter(Boolean);

    const fullStreet =
      streetComponents.length > 0
        ? streetComponents.join(', ')
        : data.display_name
        ? data.display_name.split(',').slice(0, 2).join(', ').trim()
        : '';

    const area = addr.suburb || addr.neighbourhood || addr.subdistrict || addr.city_district || addr.locality || '';
    const city = addr.city || addr.town || addr.municipality || addr.village || addr.county || addr.state_district || '';
    const state = addr.state || '';
    const pincode = addr.postcode || '';

    return {
      address: fullStreet || data.display_name || '',
      area,
      city,
      state,
      pincode,
    };
  } catch {
    return null;
  }
};

const STEPS = [
  { id: 1, title: 'Business Info', key: 'business' },
  { id: 2, title: 'Location & Operating Hours', key: 'location' },
  { id: 3, title: 'Facilities & Photos', key: 'facilities' },
  { id: 4, title: 'Workouts, Pricing & Rules', key: 'workouts' },
  { id: 5, title: 'Bank Account & Review', key: 'bank' },
];

const STEP_HEADERS = {
  1: {
    title: '1. Business & Legal Information',
    desc: 'Provide basic business information, legal registration, and create administrator credentials.',
  },
  2: {
    title: '2. Location, Geolocation & Operating Hours',
    desc: 'Pinpoint your exact facility address with live geolocation and configure operating shift timings.',
  },
  3: {
    title: '3. Facilities, Amenities & Floor Space',
    desc: 'Define floor area, capacity, highlight badge, brand logo, and facility equipment.',
  },
  4: {
    title: '4. Workouts, Pricing, Rules & Safety',
    desc: 'Configure fitness disciplines, membership tiers, facility guidelines, and safety protocols.',
  },
  5: {
    title: '5. Bank Account & Final Review',
    desc: 'Provide settlement bank account details, review registration overview, and submit for Super Admin approval.',
  },
};

const BADGE_OPTIONS = ['Trending', 'Top Rated', 'Verified SuperGym', 'Popular', 'Premium Club', '24/7 Access', 'CrossFit Ready'];

const FACILITY_OPTIONS = [
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

const WORKOUT_OPTIONS = [
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

const DEFAULT_RULES = [
  'Carry clean indoor training shoes',
  'Mandatory personal gym towel on workout benches',
  'Re-rack dumbbells and plates after set completion',
  'No outside food or beverages allowed on gym floor',
];

const DEFAULT_SAFETY = [
  'Daily multi-session equipment sanitization',
  'Certified First Aid & CPR staff available on floor',
  '24/7 CCTV surveillance coverage',
];

const STEP_FIELDS = {
  1: ['subscriptionType', 'gymName', 'tagline', 'ownerName', 'phone', 'email', 'password', 'confirmPassword', 'gstNumber', 'panNumber'],
  2: ['address', 'area', 'city', 'state', 'pincode', 'landmark'],
  3: ['floorSpaceSqFt', 'maxFloorCapacity', 'logo', 'facilities', 'aboutText'],
  4: ['workouts', 'monthlyPrice'],
  5: ['accountHolder', 'bankName', 'accountNumber', 'confirmAccountNumber', 'ifscCode', 'upiId', 'agreedToTerms'],
};

const STEP_REQUIRED_FIELDS = {
  1: [
    { field: 'subscriptionType', label: 'Subscription Plan' },
    { field: 'gymName', label: 'Gym / Studio Name' },
    { field: 'ownerName', label: 'Owner / MD Name' },
    { field: 'phone', label: 'Mobile Number' },
    { field: 'email', label: 'Official Email' },
    { field: 'password', label: 'Password' },
  ],
  2: [
    { field: 'address', label: 'Street Address' },
    { field: 'area', label: 'Area / Locality' },
    { field: 'city', label: 'City' },
    { field: 'state', label: 'State' },
    { field: 'pincode', label: 'Pincode' },
  ],
  3: [
    { field: 'floorSpaceSqFt', label: 'Floor Space' },
    { field: 'maxFloorCapacity', label: 'Max Capacity' },
    { field: 'logo', label: 'Gym Logo' },
    { field: 'facilities', label: 'Facilities (Min 1)' },
  ],
  4: [
    { field: 'workouts', label: 'Workouts (Min 1)' },
    { field: 'monthlyPrice', label: 'Monthly Pass Price' },
  ],
  5: [
    { field: 'accountHolder', label: 'Account Holder Name' },
    { field: 'bankName', label: 'Bank Name' },
    { field: 'accountNumber', label: 'Account Number' },
    { field: 'confirmAccountNumber', label: 'Confirm Account Number' },
    { field: 'ifscCode', label: 'IFSC Code' },
    { field: 'agreedToTerms', label: 'Terms & Conditions' },
  ],
};

const validateField = (field, value, form) => {
  switch (field) {
    case 'subscriptionType':
      if (!value) return 'Please select a partnership plan';
      return '';
    case 'gymName':
      if (!value || !value.trim()) return 'Gym / Studio name is required';
      if (containsEmoji(value)) return 'Emojis are not allowed in Gym / Studio name';
      if (value.trim().length < 2) return 'Must be at least 2 characters';
      return '';
    case 'tagline':
      if (value && containsEmoji(value)) return 'Emojis are not allowed in Tagline';
      return '';
    case 'ownerName':
      return validatePersonName(value, 'Owner / MD name', 2, 100);
    case 'phone':
      return validatePhone(value);
    case 'email':
      return validateEmail(value);
    case 'password':
      if (form?.isGoogleSso) return '';
      return validatePassword(value, { name: form?.ownerName, email: form?.email, phone: form?.phone });
    case 'confirmPassword':
      if (form?.isGoogleSso) return '';
      if (!value) return 'Please confirm your password';
      if (value !== form.password) return 'Passwords do not match';
      return '';
    case 'gstNumber':
      if (value && value.trim().length > 0 && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value.trim())) {
        return 'Invalid GSTIN format (e.g. 33AAAAA0000A1Z5)';
      }
      return '';
    case 'panNumber':
      if (value && value.trim().length > 0 && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value.trim())) {
        return 'Invalid PAN format (e.g. ABCDE1234F)';
      }
      return '';
    case 'address':
      if (!value || !value.trim()) return 'Street address is required';
      if (containsEmoji(value)) return 'Emojis are not allowed in address';
      if (value.trim().length < 5) return 'Enter full street address (min 5 characters)';
      return '';
    case 'area':
      if (!value || !value.trim()) return 'Area / Locality is required';
      if (containsEmoji(value)) return 'Emojis are not allowed in Area / Locality';
      return '';
    case 'city':
      if (!value || !value.trim()) return 'City is required';
      if (containsEmoji(value)) return 'Emojis are not allowed in City';
      return '';
    case 'state':
      if (!value || !value.trim()) return 'State is required';
      if (containsEmoji(value)) return 'Emojis are not allowed in State';
      return '';
    case 'landmark':
      if (value && containsEmoji(value)) return 'Emojis are not allowed in Landmark';
      return '';
    case 'aboutText':
      if (value && containsEmoji(value)) return 'Emojis are not allowed in description';
      return '';
    case 'pincode':
      return validatePostalCode(value);
    case 'floorSpaceSqFt': {
      const num = Number(value);
      if (!value || isNaN(num) || num < 200) return 'Floor area must be at least 200 sq. ft.';
      if (num > 100000) return 'Floor area cannot exceed 100,000 sq. ft.';
      return '';
    }
    case 'maxFloorCapacity': {
      const num = Number(value);
      if (!value || isNaN(num) || num < 5) return 'Max capacity must be at least 5 athletes';
      if (num > 2000) return 'Max capacity cannot exceed 2,000 athletes';
      return '';
    }
    case 'logo':
      if (!value) return 'Gym brand logo is required';
      return '';
    case 'facilities':
      if (!value || value.length === 0) return 'Select at least 1 facility';
      return '';
    case 'workouts':
      if (!value || value.length === 0) return 'Select at least 1 workout discipline';
      return '';
    case 'monthlyPrice': {
      const num = Number(value);
      if (!value || isNaN(num) || num < 1) return 'Monthly membership price is required';
      return '';
    }
    case 'accountHolder':
      if (!value || !value.trim()) return 'Account holder name is required';
      if (containsEmoji(value)) return 'Emojis are not allowed in Account holder name';
      if (value.trim().length < 2) return 'Must be at least 2 characters';
      return '';
    case 'bankName':
      if (!value || !value.trim()) return 'Bank name is required';
      return '';
    case 'accountNumber':
      return validateAccountNumber(value);
    case 'confirmAccountNumber':
      return validateConfirmAccountNumber(value, form?.accountNumber);
    case 'ifscCode':
      if (!value || !value.trim()) return 'IFSC code is required';
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim())) return 'Invalid IFSC (e.g. HDFC0001234)';
      return '';
    case 'upiId':
      return validateUpiId(value);
    case 'agreedToTerms':
      if (!value) return 'You must accept the terms to proceed';
      return '';
    default:
      return '';
  }
};

const INITIAL_FORM_DATA = {
  // Step 1: Business Info
  subscriptionType: 'Hybrid',
  gymName: '',
  tagline: '',
  ownerName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  businessType: 'Private Limited',
  yearEstablished: '',
  gstNumber: '',
  panNumber: '',
  branches: '1',
  businessCertificate: '',
  businessCertificateName: '',
  businessCertificateSize: '',

  // Step 2: Location & GPS
  address: '',
  area: '',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '',
  landmark: '',
  lat: 13.0827,
  lng: 80.2707,
  googleMapsUrl: '',
  timingMode: 'REGULAR',
  weekdayOpen: '05:30 AM',
  weekdayClose: '10:30 PM',
  weekendOpen: '06:00 AM',
  weekendClose: '09:00 PM',
  morningOpen: '05:30 AM',
  morningClose: '11:30 AM',
  eveningOpen: '04:30 PM',
  eveningClose: '10:30 PM',
  isSplitShift: false,
  isOpenHolidays: true,
  is24Hours: false,

  // Step 3: Facilities, Amenities & Photos
  floorSpaceSqFt: 3500,
  maxFloorCapacity: 45,
  genderAllowed: 'Unisex',
  badgeText: 'Trending',
  logo: '',
  coverPhoto: '',
  galleryPhotos: [],
  facilities: ['AC Gym', 'Locker Facility', 'Shower Available', 'Free Wi-Fi', 'CCTV 24/7'],
  amenities: ['RO Drinking Water', 'Towel Service', 'Locker Key Padlocks'],
  aboutText: '',

  // Step 4: Pricing & Workouts
  workouts: ['GYM / Strength', 'Cardio Fitness', 'HIIT (High Intensity)'],
  rules: [...DEFAULT_RULES],
  safetyMeasures: [...DEFAULT_SAFETY],
  singleSessionPrice: 199,
  fiveSessionPrice: 899,
  monthlyPrice: 1999,
  quarterlyPrice: 4999,
  halfYearlyPrice: 8999,
  annualPrice: 14999,
  freeCancellationHours: 2,
  refundPercentage: 100,
  rescheduleAllowedCount: 2,

  // Step 5: Bank & Submission
  commissionRate: 10,
  settlementCycle: 'Daily (T+1)',
  accountHolder: '',
  bankName: '',
  accountNumber: '',
  confirmAccountNumber: '',
  ifscCode: '',
  upiId: '',

  agreedToTerms: false,
};

export const RegisterScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { isDark, toggleTheme } = useTheme();
  const { login } = useAuth();
  const { showToast } = useToast();
  const scrollViewRef = useRef(null);

  const googleProfile = route?.params?.googleProfile || null;
  const isGoogleSso = Boolean(googleProfile);

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // GPS Auto-detect loading & pinned state
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [isGpsPinned, setIsGpsPinned] = useState(false);

  // Field touched tracker for live feedback
  const [touched, setTouched] = useState({});

  // Form State matching web gym exactly
  const [formData, setFormData] = useState(() => ({
    ...INITIAL_FORM_DATA,
    ...(googleProfile
      ? {
          email: googleProfile.email || '',
          ownerName: googleProfile.fullName || '',
          isGoogleSso: true,
          googleId: googleProfile.googleUid,
        }
      : {}),
  }));

  useEffect(() => {
    if (googleProfile) {
      setFormData((prev) => ({
        ...prev,
        email: googleProfile.email || prev.email,
        ownerName: googleProfile.fullName || prev.ownerName,
        isGoogleSso: true,
        googleId: googleProfile.googleUid,
      }));
    }
  }, [googleProfile]);

  const resetForm = () => {
    setFormData({ ...INITIAL_FORM_DATA });
    setCurrentStep(1);
    setErrors({});
    setTouched({});
    setNewRuleInput('');
    setNewSafetyInput('');
    setEmailCheckStatus('idle');
    setEmailCheckError('');
    setPhoneCheckStatus('idle');
    setPhoneCheckError('');
    setIsGpsPinned(false);
  };

  // Rules and Safety dynamic inputs
  const [newRuleInput, setNewRuleInput] = useState('');
  const [newSafetyInput, setNewSafetyInput] = useState('');

  // Email availability check states
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'exists'
  const [emailCheckError, setEmailCheckError] = useState('');
  const [phoneCheckStatus, setPhoneCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'exists'
  const [phoneCheckError, setPhoneCheckError] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check email availability
  const checkEmailExistsApi = async (emailToCheck) => {
    const trimmed = String(emailToCheck || '').trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setEmailCheckStatus('idle');
      setEmailCheckError('');
      return null;
    }

    setEmailCheckStatus('checking');
    setEmailCheckError('');

    try {
      const response = await apiService.checkEmail(trimmed);
      const data = response?.data || response;
      if (data?.isExisting || data?.isAvailable === false) {
        setEmailCheckStatus('exists');
        setEmailCheckError('An account with this email address already exists. Please log in or use a different email.');
        return false;
      } else {
        setEmailCheckStatus('available');
        setEmailCheckError('');
        return true;
      }
    } catch (err) {
      if (err?.message?.includes('already exists')) {
        setEmailCheckStatus('exists');
        setEmailCheckError('An account with this email address already exists. Please log in or use a different email.');
        return false;
      }
      setEmailCheckStatus('idle');
      return null;
    }
  };

  useEffect(() => {
    const trimmedEmail = (formData.email || '').trim();
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setEmailCheckStatus('idle');
      setEmailCheckError('');
      return;
    }

    const timer = setTimeout(() => {
      void checkEmailExistsApi(trimmedEmail);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.email]);

  // Check phone availability
  const checkPhoneExistsApi = async (phoneToCheck) => {
    const digits = String(phoneToCheck || '').replace(/\D/g, '');
    if (digits.length !== 10) {
      setPhoneCheckStatus('idle');
      setPhoneCheckError('');
      return null;
    }

    setPhoneCheckStatus('checking');
    setPhoneCheckError('');

    try {
      const response = await apiService.checkPhone(digits);
      const data = response?.data || response;
      if (data?.isExisting || data?.isAvailable === false) {
        setPhoneCheckStatus('exists');
        setPhoneCheckError('An account with this mobile number already exists. Please log in or use a different number.');
        return false;
      } else {
        setPhoneCheckStatus('available');
        setPhoneCheckError('');
        return true;
      }
    } catch (err) {
      if (err?.message?.includes('already exists')) {
        setPhoneCheckStatus('exists');
        setPhoneCheckError('An account with this mobile number already exists. Please log in or use a different number.');
        return false;
      }
      setPhoneCheckStatus('idle');
      return null;
    }
  };

  useEffect(() => {
    const digits = (formData.phone || '').replace(/\D/g, '');
    if (digits.length !== 10) {
      setPhoneCheckStatus('idle');
      setPhoneCheckError('');
      return;
    }

    const timer = setTimeout(() => {
      void checkPhoneExistsApi(digits);
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.phone]);

  // Compute live validation errors
  const errors = useMemo(() => {
    const errs = {};
    const allFields = Object.values(STEP_FIELDS).flat();
    for (const f of allFields) {
      const msg = validateField(f, formData[f], formData);
      if (msg) errs[f] = msg;
    }
    if (emailCheckError && !errs.email) {
      errs.email = emailCheckError;
    }
    if (phoneCheckError && !errs.phone) {
      errs.phone = phoneCheckError;
    }
    return errs;
  }, [formData, emailCheckError, phoneCheckError]);

  const updateField = (field, value) => {
    const sanitized = typeof value === 'string' && !MEDIA_FIELDS.has(field) ? stripEmojis(value) : value;
    setFormData((prev) => ({ ...prev, [field]: sanitized }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const updateFields = (fieldsObj) => {
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(fieldsObj)) {
      sanitizedObj[k] = typeof v === 'string' && !MEDIA_FIELDS.has(k) ? stripEmojis(v) : v;
    }
    setFormData((prev) => ({ ...prev, ...sanitizedObj }));
  };

  const markFieldTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const toggleArrayItem = (field, item) => {
    setFormData((prev) => {
      const list = prev[field] || [];
      const updated = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
      return { ...prev, [field]: updated };
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleAddRule = () => {
    const trimmed = stripEmojis(newRuleInput).trim();
    if (!trimmed) return;
    setFormData((prev) => ({
      ...prev,
      rules: [...(prev.rules || []), trimmed],
    }));
    setNewRuleInput('');
  };

  const handleRemoveRule = (index) => {
    setFormData((prev) => ({
      ...prev,
      rules: (prev.rules || []).filter((_, i) => i !== index),
    }));
  };

  const handleAddSafety = () => {
    const trimmed = stripEmojis(newSafetyInput).trim();
    if (!trimmed) return;
    setFormData((prev) => ({
      ...prev,
      safetyMeasures: [...(prev.safetyMeasures || []), trimmed],
    }));
    setNewSafetyInput('');
  };

  const handleRemoveSafety = (index) => {
    setFormData((prev) => ({
      ...prev,
      safetyMeasures: (prev.safetyMeasures || []).filter((_, i) => i !== index),
    }));
  };

  // Google Maps URL parser
  const handleGoogleMapsUrlChange = (url) => {
    updateField('googleMapsUrl', url);
    const coords = extractCoordinatesFromMapsUrl(url);
    if (coords) {
      setFormData((prev) => ({
        ...prev,
        googleMapsUrl: url,
        lat: coords.lat,
        lng: coords.lng,
      }));
      setIsGpsPinned(true);
      showToast({ message: `GPS synced: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`, isSuccess: true });
    }
  };

  // GPS Auto-detect and reverse geocode handler using native device Geolocation
  const handleGetAddressByGps = async () => {
    setIsFetchingGps(true);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'GYMEZY needs access to your location to auto-detect your gym address and coordinates.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setIsFetchingGps(false);
          showToast({
            message: 'Location permission denied. Please enable it in settings or paste a Google Maps link.',
            isError: true,
          });
          return;
        }
      }

      const Geolocation = getGeolocation();
      if (!Geolocation) {
        setIsFetchingGps(false);
        showToast({
          message: 'Native GPS module is not linked in this build. Rebuild the app (npm run android) or paste a Google Maps URL.',
          isError: true,
        });
        return;
      }

      Geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const geoRes = await reverseGeocodeCoordinates(latitude, longitude);

          setFormData((prev) => ({
            ...prev,
            lat: latitude,
            lng: longitude,
            googleMapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
            address: stripEmojis(geoRes?.address || prev.address),
            area: stripEmojis(geoRes?.area || prev.area),
            city: stripEmojis(geoRes?.city || prev.city),
            state: stripEmojis(geoRes?.state || prev.state),
            pincode: geoRes?.pincode || prev.pincode,
          }));
          setTouched((prev) => ({
            ...prev,
            address: true,
            area: true,
            city: true,
            state: true,
            pincode: true,
          }));
          setIsGpsPinned(true);
          setIsFetchingGps(false);
          showToast({ message: `GPS location detected (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, isSuccess: true });
        },
        (err) => {
          setIsFetchingGps(false);
          showToast({
            message: err?.message || 'Could not access GPS. Please enable device location or paste Google Maps URL.',
            isError: true,
          });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (e) {
      setIsFetchingGps(false);
      showToast({ message: 'Failed to detect GPS location.', isError: true });
    }
  };

  // Image upload handlers (1MB max limit)
  const MAX_UPLOAD_BYTES = 1024 * 1024;

  const isAllowedImagePick = (picked) => {
    if (!picked) return false;
    if (picked.fileType && !String(picked.fileType).toLowerCase().startsWith('image/')) {
      showToast({ message: 'Only image files (JPG, PNG, WEBP) are allowed.', isError: true });
      return false;
    }
    return true;
  };

  const handlePickLogo = async () => {
    const picked = await pickImageFromDevice({ maxWidth: 800, maxHeight: 800 });
    if (!isAllowedImagePick(picked)) return;
    if (picked?.fileSize && picked.fileSize > MAX_UPLOAD_BYTES) {
      showToast({ message: 'Logo file size must be less than 1MB.', isError: true });
      return;
    }
    if (picked?.fileData) {
      updateField('logo', picked.fileData);
      showToast({ message: 'Brand logo uploaded.', isSuccess: true });
    }
  };

  const handlePickCover = async () => {
    const picked = await pickImageFromDevice({ maxWidth: 1200, maxHeight: 800 });
    if (!isAllowedImagePick(picked)) return;
    if (picked?.fileSize && picked.fileSize > MAX_UPLOAD_BYTES) {
      showToast({ message: 'Cover photo file size must be less than 1MB.', isError: true });
      return;
    }
    if (picked?.fileData) {
      updateField('coverPhoto', picked.fileData);
      showToast({ message: 'Cover photo uploaded.', isSuccess: true });
    }
  };

  const handlePickFacilityPhoto = async () => {
    const picked = await pickImageFromDevice({ maxWidth: 1000, maxHeight: 1000 });
    if (!isAllowedImagePick(picked)) return;
    if (picked?.fileSize && picked.fileSize > MAX_UPLOAD_BYTES) {
      showToast({ message: 'Facility photo file size must be less than 1MB.', isError: true });
      return;
    }
    if (picked?.fileData) {
      setFormData((prev) => ({
        ...prev,
        galleryPhotos: [...(prev.galleryPhotos || []), picked.fileData],
      }));
      showToast({ message: 'Facility photo added.', isSuccess: true });
    }
  };

  const handleRemoveFacilityPhoto = (index) => {
    setFormData((prev) => ({
      ...prev,
      galleryPhotos: prev.galleryPhotos.filter((_, i) => i !== index),
    }));
  };

  const handlePickBusinessDoc = async () => {
    const picked = await pickImageFromDevice({ maxWidth: 1200, maxHeight: 1200 });
    if (picked?.fileSize && picked.fileSize > MAX_UPLOAD_BYTES) {
      showToast({ message: 'Document size must be less than 1MB.', isError: true });
      return;
    }
    if (picked?.fileData) {
      const sizeStr = picked.fileSize
        ? picked.fileSize > 1024 * 1024
          ? (picked.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
          : Math.round(picked.fileSize / 1024) + ' KB'
        : 'Attached';
      setFormData((prev) => ({
        ...prev,
        businessCertificate: picked.fileData,
        businessCertificateName: picked.fileName || 'business_license.jpg',
        businessCertificateSize: sizeStr,
      }));
      showToast({ message: 'Business document attached.', isSuccess: true });
    }
  };

  // Expandable progress drawer & Bank search modal states
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');

  const filteredBanks = useMemo(() => {
    if (!bankSearchQuery.trim()) return BANKS;
    const q = bankSearchQuery.toLowerCase();
    return BANKS.filter((b) => b.name.toLowerCase().includes(q) || b.ifscPrefix.toLowerCase().includes(q));
  }, [bankSearchQuery]);

  // Live password checks
  const passwordChecks = {
    length: formData.password.length >= 8 && formData.password.length <= 16,
    hasUpper: /[A-Z]/.test(formData.password),
    hasNumber: /\d/.test(formData.password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(formData.password),
    match: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0,
  };

  const getStepValidationStatus = (stepId) => {
    const required = STEP_REQUIRED_FIELDS[stepId] || [];
    const missing = required.filter(({ field }) => {
      if (isGoogleSso && (field === 'password' || field === 'confirmPassword')) return false;
      const val = formData[field];
      if (Array.isArray(val)) return !val || val.length === 0;
      if (field === 'floorSpaceSqFt') {
        const num = Number(val);
        return !val || isNaN(num) || num < 200 || num > 100000;
      }
      if (field === 'maxFloorCapacity') {
        const num = Number(val);
        return !val || isNaN(num) || num < 5 || num > 2000;
      }
      if (field === 'monthlyPrice') {
        const num = Number(val);
        return !val || isNaN(num) || num < 1;
      }
      if (field === 'phone') {
        return validatePhone(val) !== '' || phoneCheckStatus === 'exists';
      }
      if (field === 'email') {
        return validateEmail(val) !== '' || emailCheckStatus === 'exists';
      }
      if (field === 'password') {
        return !val || containsEmoji(val) || val.length < 8 || val.length > 16 || !/[A-Z]/.test(val) || !/\d/.test(val) || !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(val);
      }
      if (field === 'confirmPassword') {
        return !val || val !== formData.password;
      }
      if (field === 'pincode') {
        return !val || !/^[1-9][0-9]{5}$/.test(String(val).trim());
      }
      if (field === 'agreedToTerms') {
        return !val;
      }
      if (field === 'ifscCode') {
        return !val || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(val).trim());
      }
      if (field === 'accountNumber') {
        return validateAccountNumber(val) !== '';
      }
      if (field === 'confirmAccountNumber') {
        return validateConfirmAccountNumber(val, formData.accountNumber) !== '';
      }
      return !val || String(val).trim() === '';
    });
    return {
      isValid: missing.length === 0,
      missingCount: missing.length,
      missingFields: missing,
    };
  };

  const validationSummary = useMemo(() => {
    const statusMap = {};
    let totalMissing = 0;
    for (let i = 1; i <= 5; i++) {
      const st = getStepValidationStatus(i);
      statusMap[i] = st;
      totalMissing += st.missingCount;
    }
    return {
      statusMap,
      totalMissing,
      isAllValid: totalMissing === 0,
    };
  }, [formData, isGoogleSso, phoneCheckStatus, emailCheckStatus]);

  const isStepValid = (step) => {
    return getStepValidationStatus(step).isValid;
  };

  const handleNext = async () => {
    const currentFields = STEP_FIELDS[currentStep] || [];
    const newTouched = { ...touched };
    let hasError = false;
    for (const f of currentFields) {
      newTouched[f] = true;
      if (errors[f]) hasError = true;
    }
    setTouched(newTouched);

    if (currentStep === 1) {
      if (phoneCheckStatus === 'checking') {
        const isAvail = await checkPhoneExistsApi(formData.phone);
        if (isAvail === false) {
          showToast({ message: 'An account with this mobile number already exists.', isError: true });
          return;
        }
      } else if (phoneCheckStatus === 'exists' || phoneCheckError) {
        showToast({
          message: 'An account with this mobile number already exists. Please log in or use a different number.',
          isError: true,
        });
        return;
      }

      if (emailCheckStatus === 'checking') {
        const isAvail = await checkEmailExistsApi(formData.email);
        if (isAvail === false) {
          showToast({ message: 'An account with this email address already exists.', isError: true });
          return;
        }
      } else if (emailCheckStatus === 'exists' || emailCheckError) {
        showToast({
          message: 'An account with this email address already exists. Please log in or use a different email.',
          isError: true,
        });
        return;
      }
    }

    if (hasError) {
      const firstError = currentFields.find((f) => errors[f]);
      showToast({ message: errors[firstError] || 'Please complete all required fields.', isError: true });
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, 5));
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSubmitRegistration = async () => {
    const step5Fields = STEP_FIELDS[5];
    const newTouched = { ...touched };
    let hasError = false;
    for (const f of step5Fields) {
      newTouched[f] = true;
      if (errors[f]) hasError = true;
    }
    setTouched(newTouched);

    if (hasError) {
      const firstError = step5Fields.find((f) => errors[f]);
      showToast({ message: errors[firstError] || 'Please review your bank & agreement details.', isError: true });
      return;
    }

    if (!validationSummary.isAllValid) {
      for (let s = 1; s <= 5; s++) {
        if (!validationSummary.statusMap[s]?.isValid) {
          setCurrentStep(s);
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          showToast({
            message: `Please complete required fields in Step ${s}: ${STEPS[s - 1].title}`,
            isError: true,
          });
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.gymName.trim(),
        gymName: formData.gymName.trim(),
        tagline: formData.tagline.trim(),
        ownerName: formData.ownerName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        businessType: formData.businessType,
        yearEstablished: formData.yearEstablished,
        gstNumber: formData.gstNumber.trim(),
        panNumber: formData.panNumber.trim(),
        branches: formData.branches,
        gstCertificate: formData.businessCertificate || '',

        address: formData.address.trim(),
        area: formData.area.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        landmark: formData.landmark.trim(),
        lat: Number(formData.lat) || 13.0827,
        lng: Number(formData.lng) || 80.2707,
        googleMapsUrl: formData.googleMapsUrl.trim() || `https://maps.google.com/?q=${formData.lat},${formData.lng}`,

        timingMode: formData.timingMode || 'REGULAR',
        weekdayOpen: formData.weekdayOpen,
        weekdayClose: formData.weekdayClose,
        weekendOpen: formData.weekendOpen,
        weekendClose: formData.weekendClose,
        morningOpen: formData.morningOpen || '05:30 AM',
        morningClose: formData.morningClose || '11:30 AM',
        eveningOpen: formData.eveningOpen || '04:30 PM',
        eveningClose: formData.eveningClose || '10:30 PM',
        isSplitShift: formData.timingMode === 'SPLIT_SHIFT',
        isOpenHolidays: formData.isOpenHolidays !== false,
        is24Hours: formData.timingMode === '24_HOURS',
        openingHours: {
          mode: formData.timingMode || 'REGULAR',
          weekdayOpen: formData.weekdayOpen,
          weekdayClose: formData.weekdayClose,
          weekendOpen: formData.weekendOpen,
          weekendClose: formData.weekendClose,
          morningOpen: formData.morningOpen || '05:30 AM',
          morningClose: formData.morningClose || '11:30 AM',
          eveningOpen: formData.eveningOpen || '04:30 PM',
          eveningClose: formData.eveningClose || '10:30 PM',
          isSplitShift: formData.timingMode === 'SPLIT_SHIFT',
          isOpenHolidays: formData.isOpenHolidays !== false,
          is24Hours: formData.timingMode === '24_HOURS',
        },

        floorSpaceSqFt: Number(formData.floorSpaceSqFt),
        maxFloorCapacity: Number(formData.maxFloorCapacity),
        genderAllowed: formData.genderAllowed,
        badgeText: formData.badgeText || 'Trending',
        logo: formData.logo,
        coverPhoto: formData.coverPhoto || formData.logo,
        galleryPhotos: formData.galleryPhotos || [],

        facilities: formData.facilities,
        amenities: formData.amenities,
        workouts: formData.workouts,
        rules: formData.rules || [],
        safetyMeasures: formData.safetyMeasures || [],
        aboutText: formData.aboutText,

        singleSessionPrice: Number(formData.singleSessionPrice),
        fiveSessionPrice: Number(formData.fiveSessionPrice),
        monthlyPrice: Number(formData.monthlyPrice),
        quarterlyPrice: Number(formData.quarterlyPrice),
        halfYearlyPrice: Number(formData.halfYearlyPrice),
        annualPrice: Number(formData.annualPrice),
        freeCancellationHours: Number(formData.freeCancellationHours),
        refundPercentage: Number(formData.refundPercentage),
        rescheduleAllowedCount: Number(formData.rescheduleAllowedCount),

        subscriptionType: formData.subscriptionType,
        commissionRate: Number(formData.commissionRate),
        settlementCycle: formData.settlementCycle,

        accountHolder: formData.accountHolder.trim(),
        bankName: formData.bankName.trim(),
        accountNumber: formData.accountNumber.trim(),
        ifscCode: formData.ifscCode.trim(),
        upiId: formData.upiId.trim(),

        status: 'Pending',
        approvalStatus: 'Pending Approval',
        initialApprovalStatus: 'Pending Approval',
      };

      const res = await apiService.registerGym(payload);

      if (res?.success) {
        if (!isGoogleSso && formData.email && formData.password) {
          const loginRes = await login({
            identifier: formData.email.trim().toLowerCase(),
            password: formData.password,
          });
          if (loginRes?.success) {
            resetForm();
            showToast({ message: 'Application submitted! Redirecting to application status.', isSuccess: true });
            navigation.replace('ApplicationStatus');
            return;
          }
        }
        resetForm();
        showToast({ message: 'Registration submitted! Please sign in to track your status.', isSuccess: true });
        navigation.replace('Login');
      } else {
        showToast({ message: res?.message || 'Registration failed. Please review your details.', isError: true });
      }
    } catch (err) {
      showToast({
        message: err.message || 'Failed to submit registration. Please check inputs and server connection.',
        isError: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const bgColor = isDark ? '#09090B' : '#F8FAFC';
  const cardBg = isDark ? '#121214' : '#FFFFFF';
  const cardBorder = isDark ? '#27272A' : '#E2E8F0';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? '#A1A1AA' : '#64748B';
  const inputBg = isDark ? '#18181B' : '#FFFFFF';
  const inputBorder = isDark ? '#27272A' : '#D4D4D8';
  const primaryNavy = '#003882';

  const renderFieldError = (field) => {
    if (touched[field] && errors[field]) {
      return (
        <View style={styles.errorRow}>
          <Icon name="error-outline" size={13} color="#EF4444" />
          <Text style={styles.errorText}>{errors[field]}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: bgColor }]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* TOP HEADER / APP BAR */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: Math.max(insets.top, Platform.OS === 'android' ? 12 : 24),
            borderBottomColor: cardBorder,
            backgroundColor: isDark ? 'rgba(9, 9, 11, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBrand}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../assets/logo/gymezy.png')}
            style={[styles.brandLogo, isDark && { tintColor: '#FFFFFF' }]}
            resizeMode="contain"
          />
          <Text style={[styles.brandName, { color: textColor }]}>GYMEZY</Text>
          <Text style={[styles.headerSlash, { color: isDark ? '#52525B' : '#94A3B8' }]}>/</Text>
          <Text style={[styles.partnerSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Partner Onboarding
          </Text>
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.themeToggleBtn, { backgroundColor: isDark ? '#18181B' : '#F1F5F9', borderColor: cardBorder }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Icon
              name={isDark ? 'nightlight-round' : 'wb-sunny'}
              size={15}
              color={isDark ? '#FFD700' : '#F59E0B'}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 24, 48) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ONBOARDING PROGRESS CARD & STEP TRACK */}
        <View style={[styles.progressCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <TouchableOpacity
            style={styles.progressCardHeader}
            onPress={() => setShowProgressDetails((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.progressCardSub, { color: primaryNavy }]}>ONBOARDING PROGRESS</Text>
              <Text style={[styles.progressCardTitle, { color: textColor }]}>
                Step {currentStep} of {STEPS.length} &bull; {STEPS[currentStep - 1].title}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={[
                  styles.statusBadgePill,
                  {
                    backgroundColor: isStepValid(currentStep)
                      ? isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7'
                      : isDark ? '#27272A' : '#F1F5F9',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: isStepValid(currentStep) ? '#16A34A' : subtitleColor,
                  }}
                >
                  {isStepValid(currentStep)
                    ? '✓ Ready'
                    : `${validationSummary.statusMap[currentStep]?.missingCount || 0} pending`}
                </Text>
              </View>
              <Icon
                name={showProgressDetails ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={22}
                color={subtitleColor}
              />
            </View>
          </TouchableOpacity>

          {/* 5-segment track */}
          <View style={styles.segmentTrack}>
            {STEPS.map((s) => {
              const isPast = s.id < currentStep;
              const isCurrent = s.id === currentStep;
              return (
                <View
                  key={s.id}
                  style={[
                    styles.segmentBar,
                    {
                      backgroundColor: isPast
                        ? '#10B981'
                        : isCurrent
                        ? primaryNavy
                        : isDark
                        ? '#27272A'
                        : '#E2E8F0',
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Expandable Step Breakdown List */}
          {showProgressDetails && (
            <View style={[styles.progressBreakdownList, { borderTopColor: cardBorder }]}>
              {STEPS.map((s) => {
                const stepStatus = validationSummary.statusMap[s.id];
                const isCurrent = s.id === currentStep;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.progressStepRow,
                      isCurrent && {
                        backgroundColor: isDark ? 'rgba(0, 56, 130, 0.2)' : '#EFF6FF',
                        borderRadius: 8,
                      },
                    ]}
                    onPress={() => {
                      setCurrentStep(s.id);
                      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View
                        style={[
                          styles.stepNumberCircle,
                          {
                            backgroundColor: stepStatus?.isValid
                              ? '#10B981'
                              : isCurrent
                              ? primaryNavy
                              : isDark
                              ? '#27272A'
                              : '#E2E8F0',
                          },
                        ]}
                      >
                        {stepStatus?.isValid ? (
                          <Icon name="check" size={12} color="#FFFFFF" />
                        ) : (
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '800',
                              color: isCurrent ? '#FFFFFF' : subtitleColor,
                            }}
                          >
                            {s.id}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepRowTitle,
                          {
                            color: isCurrent ? primaryNavy : textColor,
                            fontWeight: isCurrent ? '800' : '600',
                          },
                        ]}
                      >
                        {s.title}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadgePill,
                        {
                          backgroundColor: stepStatus?.isValid
                            ? isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7'
                            : isDark ? '#18181B' : '#F1F5F9',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: stepStatus?.isValid ? '#16A34A' : '#64748B',
                        }}
                      >
                        {stepStatus?.isValid ? 'Ready' : `${stepStatus?.missingCount || 0} pending`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* STEP TITLE & SUBTITLE */}
        <View style={styles.stepHeader}>
          <Text style={[styles.stepTitle, { color: textColor }]}>
            {STEP_HEADERS[currentStep]?.title || ''}
          </Text>
          <Text style={[styles.stepSubtitle, { color: subtitleColor }]}>
            {STEP_HEADERS[currentStep]?.desc || ''}
          </Text>
        </View>

        {/* STEP CONTENT BODY (CARD) */}
        <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {/* ================= STEP 1: BASIC INFO ================= */}
          {currentStep === 1 && (
            <View>
              {Boolean(formData.isGoogleSso) && (
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                    borderColor: '#3B82F6',
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <Icon name="check-circle" size={20} color="#3B82F6" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: isDark ? '#93C5FD' : '#1D4ED8' }}>
                      Google Account Connected
                    </Text>
                    <Text style={{ fontSize: 12, color: isDark ? '#BFDBFE' : '#2563EB', marginTop: 2 }}>
                      Registered with {formData.email}. Password is not required for Google Sign-In.
                    </Text>
                  </View>
                </View>
              )}

              {/* Partnership Plan Selector */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Select Partnership Plan <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Text style={styles.fieldHelper}>Choose your operating tier</Text>
                </View>

                <View style={[styles.planGrid, { backgroundColor: isDark ? '#18181B' : '#F1F5F9', borderColor: cardBorder }]}>
                  {[
                    { key: 'Listing Only', label: 'Free Listing', desc: 'Listing & Discovery' },
                    { key: 'GMS', label: 'GMS Software', desc: 'Member & Billing' },
                    { key: 'App Only', label: 'App Listing', desc: 'Direct Passes' },
                    { key: 'Hybrid', label: 'Hybrid Partner', desc: 'Full Suite' },
                  ].map((plan) => {
                    const isSelected = (formData.subscriptionType || 'Hybrid') === plan.key;
                    return (
                      <TouchableOpacity
                        key={plan.key}
                        style={[
                          styles.planBtn,
                          isSelected && {
                            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.22)' : '#FFFFFF',
                            borderColor: isDark ? '#818CF8' : '#4F46E5',
                            borderWidth: 2,
                            elevation: 3,
                            shadowColor: isDark ? '#818CF8' : '#000',
                            shadowOpacity: isDark ? 0.35 : 0.08,
                            shadowRadius: 4,
                          },
                        ]}
                        onPress={() => updateField('subscriptionType', plan.key)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.planBtnTitle,
                            {
                              color: isSelected
                                ? isDark
                                  ? '#FFFFFF'
                                  : '#4F46E5'
                                : isDark
                                ? '#94A3B8'
                                : '#475569',
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {plan.label}
                        </Text>
                        <Text style={[styles.planBtnDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          {plan.desc}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {renderFieldError('subscriptionType')}
              </View>

              {/* Gym Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Gym / Studio Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  value={formData.gymName}
                  onChangeText={(val) => updateField('gymName', val)}
                  onBlur={() => markFieldTouched('gymName')}
                />
                {renderFieldError('gymName')}
              </View>

              {/* Tagline */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>Tagline / Motto</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  value={formData.tagline}
                  onChangeText={(val) => updateField('tagline', val)}
                  onBlur={() => markFieldTouched('tagline')}
                />
                {renderFieldError('tagline')}
              </View>

              {/* Owner Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Owner / MD Full Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  value={formData.ownerName}
                  onChangeText={(val) => updateField('ownerName', val)}
                  onBlur={() => markFieldTouched('ownerName')}
                />
                {renderFieldError('ownerName')}
              </View>

              {/* Mobile Phone */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Owner Mobile Number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  {phoneCheckStatus === 'checking' && (
                    <ActivityIndicator size="small" color={primaryNavy} />
                  )}
                  {phoneCheckStatus === 'available' && !errors.phone && (
                    <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>✓ Phone Available</Text>
                  )}
                  {phoneCheckStatus === 'exists' && (
                    <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: '700' }}>✕ Already Registered</Text>
                  )}
                </View>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor:
                        phoneCheckStatus === 'exists' || (touched.phone && errors.phone)
                          ? '#EF4444'
                          : phoneCheckStatus === 'available' && !errors.phone
                          ? '#16A34A'
                          : inputBorder,
                      color: textColor,
                    },
                  ]}
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={formData.phone}
                  onChangeText={(val) => updateField('phone', val.replace(/\D/g, ''))}
                  onBlur={() => markFieldTouched('phone')}
                />
                {renderFieldError('phone')}
              </View>

              {/* Email Address */}
              <View style={styles.fieldGroup}>
                <View style={styles.fieldHeaderRow}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Official Email Address <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  {emailCheckStatus === 'checking' && (
                    <ActivityIndicator size="small" color={primaryNavy} />
                  )}
                  {emailCheckStatus === 'available' && (
                    <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '700' }}>✓ Email Available</Text>
                  )}
                </View>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={formData.email}
                  onChangeText={(val) => updateField('email', val)}
                  onBlur={() => markFieldTouched('email')}
                />
                {renderFieldError('email')}
              </View>

              {/* Password & Confirm Password (Hidden for Google SSO users) */}
              {!formData.isGoogleSso && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: textColor }]}>
                      Create Password <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={[styles.passwordWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                      <TextInput
                        style={[styles.passwordInput, { color: textColor }]}
                        secureTextEntry={!showPassword}
                        value={formData.password}
                        onChangeText={(val) => updateField('password', val)}
                        onBlur={() => markFieldTouched('password')}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowPassword(!showPassword)}
                      >
                        <Icon name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                    {renderFieldError('password')}
                  </View>

                  {/* Confirm Password */}
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: textColor }]}>
                      Confirm Password <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <View style={[styles.passwordWrapper, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                      <TextInput
                        style={[styles.passwordInput, { color: textColor }]}
                        secureTextEntry={!showConfirmPassword}
                        value={formData.confirmPassword}
                        onChangeText={(val) => updateField('confirmPassword', val)}
                        onBlur={() => markFieldTouched('confirmPassword')}
                      />
                      <TouchableOpacity
                        style={styles.eyeBtn}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <Icon name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                    {renderFieldError('confirmPassword')}
                  </View>

                  {/* Live Password Requirements Checklist */}
                  <View style={[styles.checksBox, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: cardBorder }]}>
                    {[
                      { label: '8-16 Chars', valid: passwordChecks.length },
                      { label: '1 Uppercase', valid: passwordChecks.hasUpper },
                      { label: '1 Number', valid: passwordChecks.hasNumber },
                      { label: '1 Special Symbol', valid: passwordChecks.hasSpecial },
                      { label: 'Passwords Match', valid: passwordChecks.match },
                    ].map((item, idx) => (
                      <View key={idx} style={styles.checkItem}>
                        <Icon
                          name={item.valid ? 'check-circle' : 'radio-button-unchecked'}
                          size={14}
                          color={item.valid ? '#16A34A' : '#94A3B8'}
                        />
                        <Text
                          style={[
                            styles.checkItemText,
                            { color: item.valid ? '#16A34A' : '#94A3B8', fontWeight: item.valid ? '700' : '500' },
                          ]}
                        >
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* GST Number & PAN (Optional) */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>GST Number (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                    autoCapitalize="characters"
                    maxLength={15}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    placeholderTextColor={inputBorder}
                    value={formData.gstNumber}
                    onChangeText={(val) => updateField('gstNumber', val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                    onBlur={() => markFieldTouched('gstNumber')}
                  />
                  {renderFieldError('gstNumber')}
                </View>

                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>PAN Number (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                    autoCapitalize="characters"
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    placeholderTextColor={inputBorder}
                    value={formData.panNumber}
                    onChangeText={(val) => updateField('panNumber', val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    onBlur={() => markFieldTouched('panNumber')}
                  />
                  {renderFieldError('panNumber')}
                </View>
              </View>

              {/* Number of Branches */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>Number of Branches</Text>
                <View style={styles.branchesRow}>
                  {[
                    { key: '1', label: '1 (Single)' },
                    { key: '2-5', label: '2–5' },
                    { key: '6-10', label: '6–10' },
                    { key: '10+', label: '10+' },
                  ].map((b) => {
                    const isSelected = formData.branches === b.key;
                    return (
                      <TouchableOpacity
                        key={b.key}
                        style={[
                          styles.branchPill,
                          {
                            backgroundColor: isSelected ? primaryNavy : isDark ? '#1E293B' : '#F1F5F9',
                            borderColor: isSelected ? primaryNavy : inputBorder,
                          },
                        ]}
                        onPress={() => updateField('branches', b.key)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.branchPillText,
                            { color: isSelected ? '#FFFFFF' : textColor, fontWeight: isSelected ? '700' : '500' },
                          ]}
                        >
                          {b.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Business License / Registration Document (Optional) */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Business License / Registration Document (Optional)
                </Text>
                {!formData.businessCertificate ? (
                  <TouchableOpacity
                    style={[
                      styles.docUploadBox,
                      { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: inputBorder },
                    ]}
                    onPress={handlePickBusinessDoc}
                    activeOpacity={0.7}
                  >
                    <Icon name="description" size={26} color={primaryNavy} />
                    <Text style={[styles.docUploadTitle, { color: textColor }]}>
                      Upload License / Registration Document
                    </Text>
                    <Text style={styles.docUploadSubtitle}>
                      PNG or JPG up to 1MB (Trade License, GST, or Shop Act)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View
                    style={[
                      styles.docAttachedCard,
                      { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: inputBorder },
                    ]}
                  >
                    <View style={styles.docAttachedLeft}>
                      <View style={styles.docIconCircle}>
                        <Icon name="insert-drive-file" size={20} color={primaryNavy} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.docAttachedName, { color: textColor }]} numberOfLines={1}>
                          {formData.businessCertificateName}
                        </Text>
                        <Text style={styles.docAttachedSize}>{formData.businessCertificateSize}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setFormData((prev) => ({
                          ...prev,
                          businessCertificate: '',
                          businessCertificateName: '',
                          businessCertificateSize: '',
                        }));
                      }}
                      style={styles.docRemoveBtn}
                    >
                      <Icon name="delete" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ================= STEP 2: LOCATION & GEOLOCATION ================= */}
          {currentStep === 2 && (
            <View>
              <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 12 }]}>
                Facility Address & Geolocation
              </Text>

              {/* Google Maps Share Link (Top, matching Web) */}
              <View style={styles.fieldGroup}>
                <View style={[styles.fieldHeaderRow, { flexWrap: 'wrap', gap: 6 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Icon name="explore" size={16} color={primaryNavy} />
                    <Text style={[styles.fieldLabel, { color: textColor, marginBottom: 0 }]}>
                      Google Maps Share Link (Auto-extracts GPS)
                    </Text>
                  </View>
                  {isGpsPinned && formData.lat && formData.lng && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#16A34A' }}>
                      GPS: {Number(formData.lat).toFixed(6)}, {Number(formData.lng).toFixed(6)}
                    </Text>
                  )}
                </View>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  placeholder="https://maps.google.com/?q=..."
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  value={formData.googleMapsUrl}
                  onChangeText={handleGoogleMapsUrlChange}
                />
              </View>

              {/* Street Address with inline Get by GPS (Matching Web) */}
              <View style={styles.fieldGroup}>
                <View style={[styles.fieldHeaderRow, { marginBottom: 6 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor, marginBottom: 0 }]}>
                    Street Address / Door No. <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 4 }}
                    onPress={handleGetAddressByGps}
                    disabled={isFetchingGps}
                    activeOpacity={0.7}
                  >
                    {isFetchingGps ? (
                      <ActivityIndicator size="small" color={primaryNavy} />
                    ) : (
                      <>
                        <Icon name="my-location" size={15} color={primaryNavy} />
                        <Text style={{ fontSize: 12, fontWeight: '700', color: primaryNavy }}>Get by GPS</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor: touched.address && errors.address ? '#EF4444' : inputBorder,
                      color: textColor,
                    },
                  ]}
                  value={formData.address}
                  onChangeText={(val) => updateField('address', val)}
                  onBlur={() => markFieldTouched('address')}
                />
                {renderFieldError('address')}
              </View>

              {/* Area & City */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Area / Locality <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: touched.area && errors.area ? '#EF4444' : inputBorder,
                        color: textColor,
                      },
                    ]}
                    value={formData.area}
                    onChangeText={(val) => updateField('area', val)}
                    onBlur={() => markFieldTouched('area')}
                  />
                  {renderFieldError('area')}
                </View>

                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    City <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: touched.city && errors.city ? '#EF4444' : inputBorder,
                        color: textColor,
                      },
                    ]}
                    value={formData.city}
                    onChangeText={(val) => updateField('city', val)}
                    onBlur={() => markFieldTouched('city')}
                  />
                  {renderFieldError('city')}
                </View>
              </View>

              {/* State & Pincode */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    State <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: touched.state && errors.state ? '#EF4444' : inputBorder,
                        color: textColor,
                      },
                    ]}
                    value={formData.state}
                    onChangeText={(val) => updateField('state', val)}
                    onBlur={() => markFieldTouched('state')}
                  />
                  {renderFieldError('state')}
                </View>

                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Pincode <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: touched.pincode && errors.pincode ? '#EF4444' : inputBorder,
                        color: textColor,
                      },
                    ]}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={formData.pincode}
                    onChangeText={(val) => updateField('pincode', val.replace(/\D/g, ''))}
                    onBlur={() => markFieldTouched('pincode')}
                  />
                  {renderFieldError('pincode')}
                </View>
              </View>

              {/* Landmark (Optional) */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>Landmark (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  value={formData.landmark}
                  onChangeText={(val) => updateField('landmark', val)}
                />
              </View>

              {/* GPS Coordinates Manual Input */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>GPS Latitude</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                    keyboardType="numeric"
                    value={formData.lat ? String(formData.lat) : ''}
                    onChangeText={(val) => {
                      updateField('lat', val);
                      if (formData.lng) updateField('googleMapsUrl', `https://maps.google.com/?q=${val},${formData.lng}`);
                    }}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>GPS Longitude</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                    keyboardType="numeric"
                    value={formData.lng ? String(formData.lng) : ''}
                    onChangeText={(val) => {
                      updateField('lng', val);
                      if (formData.lat) updateField('googleMapsUrl', `https://maps.google.com/?q=${formData.lat},${val}`);
                    }}
                  />
                </View>
              </View>

              {/* Operating Hours Divider */}
              <View style={[styles.divider, { backgroundColor: cardBorder }]} />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
                <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 0, fontSize: 14, flex: 1, flexShrink: 1 }]}>
                  Facility Operating Hours & Shift Architecture
                </Text>
                <View
                  style={{
                    flexShrink: 0,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    backgroundColor:
                      formData.timingMode === '24_HOURS'
                        ? isDark ? 'rgba(34,197,94,0.15)' : '#F0FDF4'
                        : formData.timingMode === 'SPLIT_SHIFT'
                        ? isDark ? 'rgba(168,85,247,0.15)' : '#FAF5FF'
                        : isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                    borderWidth: 1,
                    borderColor:
                      formData.timingMode === '24_HOURS'
                        ? '#86EFAC'
                        : formData.timingMode === 'SPLIT_SHIFT'
                        ? '#D8B4FE'
                        : '#BFDBFE',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '700',
                      color:
                        formData.timingMode === '24_HOURS'
                          ? '#16A34A'
                          : formData.timingMode === 'SPLIT_SHIFT'
                          ? '#9333EA'
                          : '#2563EB',
                    }}
                  >
                    {formData.timingMode === '24_HOURS'
                      ? '24/7 Mode'
                      : formData.timingMode === 'SPLIT_SHIFT'
                      ? 'Split Shift'
                      : 'Regular Mode'}
                  </Text>
                </View>
              </View>

              {/* Timing Mode Selector */}
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: textColor, marginBottom: 8 }]}>
                  Select Operational Timing Model
                </Text>
                <View style={{ flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Single Shift (Continuous 12h/16h)', value: 'REGULAR' },
                    { label: 'Split Shift (Morning + Evening)', value: 'SPLIT_SHIFT' },
                    { label: '24 Hours (Round-the-clock)', value: '24_HOURS' },
                  ].map((modeItem) => {
                    const isSelected = (formData.timingMode || 'REGULAR') === modeItem.value;
                    return (
                      <TouchableOpacity
                        key={modeItem.value}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 14,
                          borderRadius: 8,
                          borderWidth: 1.5,
                          borderColor: isSelected ? primaryNavy : inputBorder,
                          backgroundColor: isSelected ? (isDark ? 'rgba(30,58,138,0.2)' : '#EFF6FF') : inputBg,
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}
                        onPress={() => {
                          updateFields({
                            timingMode: modeItem.value,
                            is24Hours: modeItem.value === '24_HOURS',
                            isSplitShift: modeItem.value === 'SPLIT_SHIFT',
                          });
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            borderWidth: 2,
                            borderColor: isSelected ? primaryNavy : '#94A3B8',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                          }}
                        >
                          {isSelected && (
                            <View
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 5,
                                backgroundColor: primaryNavy,
                              }}
                            />
                          )}
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '700' : '600',
                            color: isSelected ? (isDark ? '#60A5FA' : primaryNavy) : textColor,
                          }}
                        >
                          {modeItem.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Mode-Specific Time Pickers */}
              {(formData.timingMode === 'REGULAR' || !formData.timingMode) && (
                <View>
                  <View style={styles.rowTwoCols}>
                    <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Weekday Open (Mon – Fri)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.weekdayOpen}
                        onChangeText={(val) => updateField('weekdayOpen', val)}
                        placeholder="05:30 AM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Weekday Close (Mon – Fri)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.weekdayClose}
                        onChangeText={(val) => updateField('weekdayClose', val)}
                        placeholder="10:30 PM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={styles.rowTwoCols}>
                    <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Weekend Open (Sat – Sun)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.weekendOpen}
                        onChangeText={(val) => updateField('weekendOpen', val)}
                        placeholder="06:00 AM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Weekend Close (Sat – Sun)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.weekendClose}
                        onChangeText={(val) => updateField('weekendClose', val)}
                        placeholder="09:00 PM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>
              )}

              {formData.timingMode === 'SPLIT_SHIFT' && (
                <View style={{ marginBottom: 4 }}>
                  <View
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: isDark ? 'rgba(168,85,247,0.1)' : '#FAF5FF',
                      borderWidth: 1,
                      borderColor: '#D8B4FE',
                      marginBottom: 14,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: isDark ? '#E9D5FF' : '#6B21A8', lineHeight: 18 }}>
                      <Text style={{ fontWeight: '700' }}>Split Shift Model: </Text>
                      Common for fitness studios in India. Gym opens for early morning routines, closes during the afternoon for sanitization/break, and reopens for evening workouts. Bookable slots are generated only during active shifts.
                    </Text>
                  </View>

                  <View style={styles.rowTwoCols}>
                    <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Morning Shift Open</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.morningOpen || '05:30 AM'}
                        onChangeText={(val) => updateField('morningOpen', val)}
                        placeholder="05:30 AM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Morning Shift Close</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.morningClose || '11:30 AM'}
                        onChangeText={(val) => updateField('morningClose', val)}
                        placeholder="11:30 AM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={styles.rowTwoCols}>
                    <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Evening Shift Open</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.eveningOpen || '04:30 PM'}
                        onChangeText={(val) => updateField('eveningOpen', val)}
                        placeholder="04:30 PM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                      <Text style={[styles.fieldLabel, { color: textColor }]}>Evening Shift Close</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                        value={formData.eveningClose || '10:30 PM'}
                        onChangeText={(val) => updateField('eveningClose', val)}
                        placeholder="10:30 PM"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>
                </View>
              )}

              {formData.timingMode === '24_HOURS' && (
                <View
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4',
                    borderWidth: 1,
                    borderColor: '#86EFAC',
                    marginBottom: 14,
                  }}
                >
                  <Text style={{ fontSize: 12, color: isDark ? '#86EFAC' : '#166534', lineHeight: 18 }}>
                    <Text style={{ fontWeight: '700' }}>24/7 Round-the-clock Facility: </Text>
                    This gym operates continuously 24 hours a day, 7 days a week. Dynamic customer booking slots will be available around the clock.
                  </Text>
                </View>
              )}

              {/* Holiday Switch */}
              <View style={styles.switchesContainer}>
                <View style={styles.switchRow}>
                  <Text style={[styles.switchRowText, { color: textColor }]}>Facility Remains Open on Public Holidays</Text>
                  <Switch
                    trackColor={{ false: isDark ? '#3F3F46' : '#CBD5E1', true: primaryNavy }}
                    thumbColor={Platform.OS === 'ios' ? undefined : '#FFFFFF'}
                    ios_backgroundColor={isDark ? '#3F3F46' : '#CBD5E1'}
                    onValueChange={(val) => updateField('isOpenHolidays', val)}
                    value={formData.isOpenHolidays !== false}
                  />
                </View>
              </View>
            </View>
          )}

          {/* ================= STEP 3: FACILITIES & PHOTOS ================= */}
          {currentStep === 3 && (
            <View>
              <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 14 }]}>Capacity & Access</Text>

              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Floor Area (Sq. Ft.) <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: touched.floorSpaceSqFt && errors.floorSpaceSqFt ? '#EF4444' : inputBorder,
                        color: textColor,
                      },
                    ]}
                    keyboardType="number-pad"
                    placeholder="e.g. 3500"
                    placeholderTextColor="#94A3B8"
                    value={formData.floorSpaceSqFt !== undefined && formData.floorSpaceSqFt !== null ? String(formData.floorSpaceSqFt) : ''}
                    onChangeText={(val) => updateField('floorSpaceSqFt', val.replace(/\D/g, ''))}
                    onBlur={() => markFieldTouched('floorSpaceSqFt')}
                  />
                  {renderFieldError('floorSpaceSqFt')}
                </View>

                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Max Safe Floor Capacity <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: touched.maxFloorCapacity && errors.maxFloorCapacity ? '#EF4444' : inputBorder,
                        color: textColor,
                      },
                    ]}
                    keyboardType="number-pad"
                    placeholder="e.g. 45"
                    placeholderTextColor="#94A3B8"
                    value={formData.maxFloorCapacity !== undefined && formData.maxFloorCapacity !== null ? String(formData.maxFloorCapacity) : ''}
                    onChangeText={(val) => updateField('maxFloorCapacity', val.replace(/\D/g, ''))}
                    onBlur={() => markFieldTouched('maxFloorCapacity')}
                  />
                  {renderFieldError('maxFloorCapacity')}
                </View>
              </View>

              {/* Gender Policy */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>Gender Policy</Text>
                <View style={styles.pillsContainer}>
                  {['Unisex', 'Men Only', 'Women Only'].map((policy) => {
                    const isSelected = formData.genderAllowed === policy;
                    return (
                      <TouchableOpacity
                        key={policy}
                        style={[
                          styles.optionPill,
                          isSelected && { backgroundColor: primaryNavy, borderColor: primaryNavy },
                        ]}
                        onPress={() => updateField('genderAllowed', policy)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.optionPillText, isSelected && { color: '#FFFFFF', fontWeight: '700' }]}>
                          {policy}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Highlight Listing Badge */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>Highlight Listing Badge</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {BADGE_OPTIONS.map((badge) => {
                    const isSelected = (formData.badgeText || 'Trending') === badge;
                    return (
                      <TouchableOpacity
                        key={badge}
                        style={[
                          styles.optionPill,
                          isSelected && { backgroundColor: primaryNavy, borderColor: primaryNavy },
                        ]}
                        onPress={() => updateField('badgeText', badge)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.optionPillText, isSelected && { color: '#FFFFFF', fontWeight: '700' }]}>
                          {badge}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={[styles.divider, { backgroundColor: cardBorder }]} />
              <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 14 }]}>Brand Identity Media</Text>

              {/* Logo & Cover Photo */}
              <View style={styles.rowTwoCols}>
                {/* Brand Logo */}
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Brand Logo <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  {formData.logo ? (
                    <View style={[styles.imagePreviewBox, { borderColor: cardBorder }]}>
                      <Image source={{ uri: formData.logo }} style={styles.previewImageContain} />
                      <TouchableOpacity
                        style={styles.deletePhotoBtn}
                        onPress={() => updateField('logo', '')}
                      >
                        <Icon name="delete" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadBox, { borderColor: touched.logo && errors.logo ? '#EF4444' : inputBorder }]}
                      onPress={handlePickLogo}
                      activeOpacity={0.8}
                    >
                      <Icon name="add-photo-alternate" size={28} color={primaryNavy} />
                      <Text style={[styles.uploadBoxTitle, { color: primaryNavy }]}>Upload Logo</Text>
                      <Text style={styles.uploadBoxHint}>Square PNG/JPG</Text>
                    </TouchableOpacity>
                  )}
                  {renderFieldError('logo')}
                </View>

                {/* Cover Photo */}
                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>Cover Photo (Optional)</Text>
                  {formData.coverPhoto ? (
                    <View style={[styles.imagePreviewBox, { borderColor: cardBorder }]}>
                      <Image source={{ uri: formData.coverPhoto }} style={styles.previewImageCover} />
                      <TouchableOpacity
                        style={styles.deletePhotoBtn}
                        onPress={() => updateField('coverPhoto', '')}
                      >
                        <Icon name="delete" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.uploadBox, { borderColor: inputBorder }]}
                      onPress={handlePickCover}
                      activeOpacity={0.8}
                    >
                      <Icon name="panorama" size={28} color={primaryNavy} />
                      <Text style={[styles.uploadBoxTitle, { color: primaryNavy }]}>Upload Cover</Text>
                      <Text style={styles.uploadBoxHint}>16:9 Landscape</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Facility & Equipment Photos */}
              <View style={[styles.divider, { backgroundColor: cardBorder }]} />
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.sectionHeading, { color: textColor }]}>Facility & Equipment Photos</Text>
                <Text style={styles.fieldHelper}>{formData.galleryPhotos.length} uploaded</Text>
              </View>
              <Text style={[styles.fieldHelper, { marginBottom: 12 }]}>
                Add clear photos of workout zones, machines, cardio, and changing rooms.
              </Text>

              <View style={styles.galleryGrid}>
                <TouchableOpacity
                  style={[styles.addPhotoGridBtn, { borderColor: primaryNavy }]}
                  onPress={handlePickFacilityPhoto}
                  activeOpacity={0.8}
                >
                  <Icon name="add-a-photo" size={22} color={primaryNavy} />
                  <Text style={[styles.addPhotoGridText, { color: primaryNavy }]}>Add Photo</Text>
                </TouchableOpacity>

                {formData.galleryPhotos.map((photoUri, idx) => (
                  <View key={idx} style={[styles.galleryThumb, { borderColor: cardBorder }]}>
                    <Image source={{ uri: photoUri }} style={styles.galleryThumbImg} />
                    <TouchableOpacity
                      style={styles.deleteThumbBtn}
                      onPress={() => handleRemoveFacilityPhoto(idx)}
                    >
                      <Icon name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Facilities Multi-Select */}
              <View style={[styles.divider, { backgroundColor: cardBorder }]} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 0 }]}>
                  Facilities Multi-Select (Available at Facility) <Text style={styles.requiredStar}>*</Text>
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  {formData.facilities.length} selected
                </Text>
              </View>
              <Text style={[styles.fieldHelper, { marginBottom: 10 }]}>
                Select core infrastructure and building features present at your facility.
              </Text>

              <View style={styles.pillsContainer}>
                {FACILITY_OPTIONS.map((item) => {
                  const isSelected = formData.facilities.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.chipPill,
                        {
                          backgroundColor: isSelected
                            ? primaryNavy
                            : isDark
                            ? '#18181B'
                            : '#F1F5F9',
                          borderColor: isSelected
                            ? primaryNavy
                            : isDark
                            ? '#27272A'
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => toggleArrayItem('facilities', item)}
                      activeOpacity={0.8}
                    >
                      {isSelected && <Icon name="check" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                      <Text
                        style={[
                          styles.chipPillText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : isDark
                              ? '#CBD5E1'
                              : '#475569',
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {renderFieldError('facilities')}

              {/* Amenities & Member Perks */}
              <View style={[styles.divider, { backgroundColor: cardBorder, marginVertical: 14 }]} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 0 }]}>
                  Amenities & Member Perks
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  {(formData.amenities || []).length} selected
                </Text>
              </View>
              <Text style={[styles.fieldHelper, { marginBottom: 10 }]}>
                Select complimentary or add-on amenities available for members.
              </Text>

              <View style={styles.pillsContainer}>
                {AMENITY_OPTIONS.map((item) => {
                  const isSelected = (formData.amenities || []).includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.chipPill,
                        {
                          backgroundColor: isSelected
                            ? primaryNavy
                            : isDark
                            ? '#18181B'
                            : '#F1F5F9',
                          borderColor: isSelected
                            ? primaryNavy
                            : isDark
                            ? '#27272A'
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => toggleArrayItem('amenities', item)}
                      activeOpacity={0.8}
                    >
                      {isSelected && <Icon name="check" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                      <Text
                        style={[
                          styles.chipPillText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : isDark
                              ? '#CBD5E1'
                              : '#475569',
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ================= STEP 4: WORKOUTS & PRICING ================= */}
          {currentStep === 4 && (
            <View>
              <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 8 }]}>
                Supported Workout Disciplines <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Text style={[styles.fieldHelper, { marginBottom: 12 }]}>
                Select all fitness and workout activities available at your center.
              </Text>

              <View style={styles.pillsContainer}>
                {WORKOUT_OPTIONS.map((item) => {
                  const isSelected = formData.workouts.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.chipPill,
                        {
                          backgroundColor: isSelected
                            ? primaryNavy
                            : isDark
                            ? '#18181B'
                            : '#F1F5F9',
                          borderColor: isSelected
                            ? primaryNavy
                            : isDark
                            ? '#27272A'
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => toggleArrayItem('workouts', item)}
                      activeOpacity={0.8}
                    >
                      {isSelected && <Icon name="check" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />}
                      <Text
                        style={[
                          styles.chipPillText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : isDark
                              ? '#CBD5E1'
                              : '#475569',
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {renderFieldError('workouts')}

              <View style={[styles.divider, { backgroundColor: cardBorder }]} />
              <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 14 }]}>
                Passes & Membership Pricing (₹)
              </Text>

              {/* Day Pass / Walk-in Pass */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Single Session Day Pass (₹)
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  placeholder="199"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={formData.singleSessionPrice !== undefined && formData.singleSessionPrice !== null ? String(formData.singleSessionPrice) : ''}
                  onChangeText={(val) => updateField('singleSessionPrice', val.replace(/\D/g, ''))}
                />
                <Text style={styles.pricingHint}>Walk-in instant entry pass price</Text>
              </View>

              {/* 1. Monthly */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  1. Monthly Unlimited Pass (₹) <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor: touched.monthlyPrice && errors.monthlyPrice ? '#EF4444' : inputBorder,
                      color: textColor,
                    },
                  ]}
                  placeholder="1999"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={formData.monthlyPrice !== undefined && formData.monthlyPrice !== null ? String(formData.monthlyPrice) : ''}
                  onChangeText={(val) => updateField('monthlyPrice', val.replace(/\D/g, ''))}
                  onBlur={() => markFieldTouched('monthlyPrice')}
                />
                <Text style={styles.pricingHint}>Standard 30-day recurring membership</Text>
                {renderFieldError('monthlyPrice')}
              </View>

              {/* 2. Quarterly */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  2. Quarterly Pass (3 Months) (₹)
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  placeholder="4999"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={formData.quarterlyPrice !== undefined && formData.quarterlyPrice !== null ? String(formData.quarterlyPrice) : ''}
                  onChangeText={(val) => updateField('quarterlyPrice', val.replace(/\D/g, ''))}
                />
                {Number(formData.monthlyPrice) > 0 && Number(formData.quarterlyPrice) > 0 && Number(formData.quarterlyPrice) < Number(formData.monthlyPrice) * 3 && (
                  <Text style={[styles.pricingHint, { color: '#10B981', fontWeight: '700' }]}>
                    Save ₹{(Number(formData.monthlyPrice) * 3 - Number(formData.quarterlyPrice)).toLocaleString('en-IN')} vs Monthly
                  </Text>
                )}
              </View>

              {/* 3. Half-Yearly */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  3. Half-Yearly Pass (6 Months) (₹)
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  placeholder="8999"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={formData.halfYearlyPrice !== undefined && formData.halfYearlyPrice !== null ? String(formData.halfYearlyPrice) : ''}
                  onChangeText={(val) => updateField('halfYearlyPrice', val.replace(/\D/g, ''))}
                />
                {Number(formData.monthlyPrice) > 0 && Number(formData.halfYearlyPrice) > 0 && Number(formData.halfYearlyPrice) < Number(formData.monthlyPrice) * 6 && (
                  <Text style={[styles.pricingHint, { color: '#10B981', fontWeight: '700' }]}>
                    Save ₹{(Number(formData.monthlyPrice) * 6 - Number(formData.halfYearlyPrice)).toLocaleString('en-IN')} vs Monthly
                  </Text>
                )}
              </View>

              {/* 4. Annual VIP Pass */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  4. Annual VIP Pass (1 Year) (₹)
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  placeholder="14999"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  value={formData.annualPrice !== undefined && formData.annualPrice !== null ? String(formData.annualPrice) : ''}
                  onChangeText={(val) => updateField('annualPrice', val.replace(/\D/g, ''))}
                />
                {Number(formData.monthlyPrice) > 0 && Number(formData.annualPrice) > 0 && Number(formData.annualPrice) < Number(formData.monthlyPrice) * 12 && (
                  <Text style={[styles.pricingHint, { color: '#10B981', fontWeight: '700' }]}>
                    Save ₹{(Number(formData.monthlyPrice) * 12 - Number(formData.annualPrice)).toLocaleString('en-IN')} vs Monthly
                  </Text>
                )}
              </View>

              {/* Refund Notice */}
              <View style={[styles.infoBanner, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: cardBorder }]}>
                <Icon name="info-outline" size={18} color={primaryNavy} />
                <Text style={[styles.infoBannerText, { color: subtitleColor }]}>
                  Members can cancel session bookings up to 2 hours before the start time for a 100% refund.
                </Text>
              </View>

              {/* Gym Rules & Member Guidelines */}
              <View style={[styles.divider, { backgroundColor: cardBorder, marginVertical: 18 }]} />
              <View style={[styles.ruleCard, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: cardBorder }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Icon name="description" size={18} color="#6366F1" />
                  <Text style={[styles.ruleCardTitle, { color: textColor }]}>
                    Gym Rules & Member Guidelines
                  </Text>
                </View>
                <Text style={[styles.fieldHelper, { marginBottom: 12 }]}>
                  Standard guidelines members must observe while training.
                </Text>

                <View style={{ gap: 8, marginBottom: 12 }}>
                  {(formData.rules || []).map((rule, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.ruleItemRow,
                        {
                          backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                          borderColor: isDark ? '#3F3F46' : '#E2E8F0',
                        },
                      ]}
                    >
                      <Icon name="check" size={16} color="#6366F1" style={{ marginRight: 6 }} />
                      <Text style={[styles.ruleItemText, { color: textColor }]}>{rule}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveRule(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="delete-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={styles.ruleInputRow}>
                  <TextInput
                    style={[
                      styles.ruleTextInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: inputBorder,
                        color: textColor,
                      },
                    ]}
                    placeholder="Add gym rule..."
                    placeholderTextColor="#94A3B8"
                    value={newRuleInput}
                    onChangeText={(val) => setNewRuleInput(stripEmojis(val))}
                  />
                  <TouchableOpacity
                    style={[styles.ruleAddBtn, { backgroundColor: primaryNavy }]}
                    onPress={handleAddRule}
                    activeOpacity={0.8}
                  >
                    <Icon name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.ruleAddBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Safety Measures & Protocols */}
              <View style={[styles.ruleCard, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: cardBorder, marginTop: 14 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Icon name="verified-user" size={18} color="#10B981" />
                  <Text style={[styles.ruleCardTitle, { color: textColor }]}>
                    Safety Measures & Protocols
                  </Text>
                </View>
                <Text style={[styles.fieldHelper, { marginBottom: 12 }]}>
                  Hygiene, safety equipment, and emergency preparedness.
                </Text>

                <View style={{ gap: 8, marginBottom: 12 }}>
                  {(formData.safetyMeasures || []).map((safety, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.ruleItemRow,
                        {
                          backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                          borderColor: isDark ? '#3F3F46' : '#E2E8F0',
                        },
                      ]}
                    >
                      <Icon name="check" size={16} color="#10B981" style={{ marginRight: 6 }} />
                      <Text style={[styles.ruleItemText, { color: textColor }]}>{safety}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveSafety(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="delete-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <View style={styles.ruleInputRow}>
                  <TextInput
                    style={[
                      styles.ruleTextInput,
                      {
                        backgroundColor: inputBg,
                        borderColor: inputBorder,
                        color: textColor,
                      },
                    ]}
                    placeholder="Add safety measure..."
                    placeholderTextColor="#94A3B8"
                    value={newSafetyInput}
                    onChangeText={(val) => setNewSafetyInput(stripEmojis(val))}
                  />
                  <TouchableOpacity
                    style={[styles.ruleAddBtn, { backgroundColor: primaryNavy }]}
                    onPress={handleAddSafety}
                    activeOpacity={0.8}
                  >
                    <Icon name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.ruleAddBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ================= STEP 5: BANK & SUBMIT ================= */}
          {currentStep === 5 && (
            <View>
              <Text style={[styles.sectionHeading, { color: textColor, marginBottom: 14 }]}>
                Bank Account for Automated Payouts
              </Text>

              {/* Account Holder */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Account Holder Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                  placeholder="e.g. Apex Fitness Pvt Ltd"
                  placeholderTextColor="#94A3B8"
                  value={formData.accountHolder}
                  onChangeText={(val) => updateField('accountHolder', val)}
                  onBlur={() => markFieldTouched('accountHolder')}
                />
                {renderFieldError('accountHolder')}
              </View>

              {/* Bank Name */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Bank Name <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor: touched.bankName && errors.bankName ? '#EF4444' : inputBorder,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: 12,
                    },
                  ]}
                  onPress={() => {
                    setBankSearchQuery('');
                    setBankModalVisible(true);
                    markFieldTouched('bankName');
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color: formData.bankName ? textColor : '#94A3B8',
                      fontWeight: formData.bankName ? '600' : '400',
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {formData.bankName || 'Select bank'}
                  </Text>
                  <Icon name="arrow-drop-down" size={24} color={subtitleColor} />
                </TouchableOpacity>
                {renderFieldError('bankName')}
              </View>

              {/* Account Number */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Bank Account Number <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor: touched.accountNumber && errors.accountNumber ? '#EF4444' : inputBorder,
                      color: textColor,
                    },
                  ]}
                  placeholder="50100456789012"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={18}
                  value={formData.accountNumber}
                  onChangeText={(val) => updateField('accountNumber', val.replace(/\D/g, '').slice(0, 18))}
                  onBlur={() => markFieldTouched('accountNumber')}
                />
                {renderFieldError('accountNumber')}
              </View>

              {/* Confirm Account Number */}
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: textColor }]}>
                  Confirm Account Number <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: inputBg,
                      borderColor: touched.confirmAccountNumber && errors.confirmAccountNumber ? '#EF4444' : inputBorder,
                      color: textColor,
                    },
                  ]}
                  placeholder="Re-enter bank account number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={18}
                  value={formData.confirmAccountNumber}
                  onChangeText={(val) => updateField('confirmAccountNumber', val.replace(/\D/g, '').slice(0, 18))}
                  onBlur={() => markFieldTouched('confirmAccountNumber')}
                />
                {renderFieldError('confirmAccountNumber')}
              </View>

              {/* IFSC & UPI */}
              <View style={styles.rowTwoCols}>
                <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>
                    Bank IFSC Code <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                    placeholder="HDFC0001234"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={11}
                    value={formData.ifscCode}
                    onChangeText={(val) => updateField('ifscCode', val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11))}
                    onBlur={() => markFieldTouched('ifscCode')}
                  />
                  {renderFieldError('ifscCode')}
                </View>

                <View style={[styles.fieldGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.fieldLabel, { color: textColor }]}>Payout UPI (Optional)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textColor }]}
                    placeholder="gym@upi"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    value={formData.upiId}
                    onChangeText={(val) => updateField('upiId', val)}
                    onBlur={() => markFieldTouched('upiId')}
                  />
                  {renderFieldError('upiId')}
                </View>
              </View>

              {/* Status Callout Card */}
              <View style={[styles.approvalNotice, { backgroundColor: isDark ? '#172554' : '#EFF6FF', borderColor: '#93C5FD' }]}>
                <Icon name="verified-user" size={24} color="#2563EB" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <View style={styles.approvalNoticeHeader}>
                    <Text style={[styles.approvalNoticeTitle, { color: isDark ? '#FFFFFF' : '#1E3A8A' }]}>
                      Publication Status:
                    </Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pending Approval</Text>
                    </View>
                  </View>
                  <Text style={[styles.approvalNoticeDesc, { color: isDark ? '#BFDBFE' : '#1E40AF' }]}>
                    Your facility registration, pricing, and photos will be submitted to the GYMEZY Super Admin review console. Once reviewed and approved, your gym will automatically go live for user bookings.
                  </Text>
                </View>
              </View>

              {/* Summary Overview Card */}
              <View style={[styles.summaryCard, { backgroundColor: isDark ? '#18181B' : '#F8FAFC', borderColor: cardBorder }]}>
                <Text style={styles.summaryHeader}>Registration Overview</Text>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryKey}>Plan:</Text>
                  <Text style={[styles.summaryVal, { color: primaryNavy, fontWeight: '700' }]}>{formData.subscriptionType}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryKey}>Gym Name:</Text>
                  <Text style={[styles.summaryVal, { color: textColor }]}>{formData.gymName || 'Not specified'}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryKey}>Location:</Text>
                  <Text style={[styles.summaryVal, { color: textColor }]}>{formData.area}, {formData.city}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryKey}>Owner:</Text>
                  <Text style={[styles.summaryVal, { color: textColor }]}>{formData.ownerName} ({formData.phone})</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryKey}>Monthly Pass:</Text>
                  <Text style={[styles.summaryVal, { color: textColor }]}>₹{formData.monthlyPrice}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryKey}>Photos:</Text>
                  <Text style={[styles.summaryVal, { color: textColor }]}>{formData.galleryPhotos.length} facility photos</Text>
                </View>
              </View>

              {/* Terms Checkbox */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => updateField('agreedToTerms', !formData.agreedToTerms)}
                activeOpacity={0.8}
              >
                <Icon
                  name={formData.agreedToTerms ? 'check-box' : 'check-box-outline-blank'}
                  size={22}
                  color={formData.agreedToTerms ? primaryNavy : '#94A3B8'}
                />
                <Text style={[styles.termsText, { color: subtitleColor }]}>
                  I confirm that all provided details and facility photographs are accurate, and I agree to the{' '}
                  <Text style={{ color: primaryNavy, fontWeight: '700' }}>GYMEZY Partner Terms & Policies</Text>.
                </Text>
              </TouchableOpacity>
              {renderFieldError('agreedToTerms')}
            </View>
          )}

          {/* BOTTOM STEP ACTIONS */}
          <View style={[styles.actionRow, { borderTopColor: cardBorder }]}>
            {currentStep > 1 ? (
              <TouchableOpacity
                style={[styles.prevBtn, { borderColor: cardBorder }]}
                onPress={handlePrev}
                disabled={submitting}
                activeOpacity={0.7}
              >
                <Icon name="arrow-back" size={18} color={textColor} />
                <Text style={[styles.prevBtnText, { color: textColor }]}>Previous</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.signInLinkBtn}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.7}
              >
                <Text style={[styles.signInLinkText, { color: primaryNavy }]}>Sign In Instead</Text>
              </TouchableOpacity>
            )}

            {currentStep < 5 ? (
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: primaryNavy }]}
                onPress={handleNext}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>Continue</Text>
                <Icon name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: '#16A34A' }]}
                onPress={handleSubmitRegistration}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Icon name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.submitBtnText}>Submit Application</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      {/* BANK SELECTION SEARCH MODAL */}
      <Modal
        visible={bankModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBankModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: textColor }]}>Select Bank</Text>
                <Text style={styles.modalSubtitle}>Popular scheduled commercial banks</Text>
              </View>
              <TouchableOpacity
                onPress={() => setBankModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalSearchBox, { backgroundColor: inputBg, borderColor: inputBorder }]}>
              <Icon name="search" size={20} color="#94A3B8" />
              <TextInput
                style={[styles.modalSearchInput, { color: textColor }]}
                placeholder="Search bank name or IFSC..."
                placeholderTextColor="#94A3B8"
                value={bankSearchQuery}
                onChangeText={setBankSearchQuery}
                autoFocus={false}
              />
              {bankSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setBankSearchQuery('')}>
                  <Icon name="cancel" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredBanks.map((b) => {
                const isSelected = formData.bankName === b.name;
                return (
                  <TouchableOpacity
                    key={b.name}
                    style={[
                      styles.bankRow,
                      { borderBottomColor: isDark ? '#27272A' : '#F1F5F9' },
                      isSelected && { backgroundColor: isDark ? 'rgba(0, 56, 130, 0.25)' : '#EFF6FF' },
                    ]}
                    onPress={() => {
                      updateField('bankName', b.name);
                      if (b.ifscPrefix) {
                        updateField('ifscCode', b.ifscPrefix);
                      }
                      markFieldTouched('bankName');
                      setBankModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.bankRowName, { color: textColor, fontWeight: isSelected ? '700' : '500' }]}>
                        {b.name}
                      </Text>
                      <View style={styles.ifscBadgeRow}>
                        <Text style={styles.ifscPrefixTag}>IFSC Prefix: {b.ifscPrefix}</Text>
                      </View>
                    </View>
                    {isSelected && <Icon name="check-circle" size={20} color={primaryNavy} />}
                  </TouchableOpacity>
                );
              })}

              {filteredBanks.length === 0 && (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: subtitleColor, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>
                    No bank found matching "{bankSearchQuery}"
                  </Text>
                  <TouchableOpacity
                    style={{ paddingVertical: 10, paddingHorizontal: 16, backgroundColor: primaryNavy, borderRadius: 8 }}
                    onPress={() => {
                      updateField('bankName', bankSearchQuery.trim());
                      markFieldTouched('bankName');
                      setBankModalVisible(false);
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                      Use "{bankSearchQuery.trim()}"
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSlash: {
    fontSize: 14,
    marginHorizontal: 1,
    fontWeight: '400',
  },
  partnerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  themeToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 48,
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  progressCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  progressCardSub: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  progressCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressBreakdownList: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
    gap: 6,
  },
  progressStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  stepNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRowTitle: {
    fontSize: 13,
  },
  segmentTrack: {
    flexDirection: 'row',
    gap: 6,
    height: 5,
  },
  segmentBar: {
    flex: 1,
    borderRadius: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderRadius: 8,
  },
  bankRowName: {
    fontSize: 13.5,
    marginBottom: 3,
  },
  ifscBadgeRow: {
    flexDirection: 'row',
  },
  ifscPrefixTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  stepHeader: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  fieldHelper: {
    fontSize: 11,
    color: '#94A3B8',
  },
  textInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  passwordWrapper: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  branchesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  branchPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchPillText: {
    fontSize: 12,
  },
  docUploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  docUploadTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  docUploadSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
  },
  docAttachedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
  },
  docAttachedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  docIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docAttachedName: {
    fontSize: 13,
    fontWeight: '600',
  },
  docAttachedSize: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  docRemoveBtn: {
    padding: 8,
  },
  rowTwoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planGrid: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  planBtn: {
    flex: 1,
    minWidth: '45%',
    minHeight: 64,
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  planBtnTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  planBtnDesc: {
    fontSize: 10,
  },
  checksBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  checkItemText: {
    fontSize: 11,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
  },
  gpsAutoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  autoDetectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#003882',
  },
  autoDetectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003882',
  },
  pinnedBadge: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  pinnedBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinnedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 18,
  },
  switchesContainer: {
    marginTop: 14,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchRowText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  optionPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D4D4D8',
  },
  optionPillText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipPillText: {
    fontSize: 12,
  },
  uploadBox: {
    height: 105,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.01)',
  },
  uploadBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  uploadBoxHint: {
    fontSize: 10,
    color: '#94A3B8',
  },
  imagePreviewBox: {
    height: 105,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  previewImageContain: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  previewImageCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deletePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    borderRadius: 14,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  addPhotoGridBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoGridText: {
    fontSize: 10,
    fontWeight: '700',
  },
  galleryThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryThumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deleteThumbBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
  },
  infoBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  approvalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  approvalNoticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  approvalNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  approvalNoticeDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  summaryHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  summaryKey: {
    fontSize: 12,
    color: '#94A3B8',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  prevBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  prevBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  signInLinkBtn: {
    paddingVertical: 8,
  },
  signInLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 8,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
  },
  successScrollContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  successCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  detailsBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryActionBtn: {
    width: '100%',
    height: 46,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  ruleCard: {
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  ruleCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  ruleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  ruleItemText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  ruleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleTextInput: {
    flex: 1,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  ruleAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4,
  },
  ruleAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  progressCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    elevation: 1,
  },
  progressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressCardSub: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  progressCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressBreakdownList: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
    gap: 6,
  },
  progressStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  stepNumberCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepRowTitle: {
    fontSize: 12.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13.5,
    padding: 0,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 6,
  },
  bankRowName: {
    fontSize: 13.5,
  },
  ifscBadgeRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  ifscPrefixTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
});
