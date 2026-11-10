import React, { useState, useMemo, useEffect } from 'react';
import { BANKS, getBankByName } from '../utils/bankData';
import {
  Row,
  Col,
  Input,
  Select,
  Button,
  Upload,
  message,
  Divider,
  Tag,
  InputNumber,
  Switch,
  Checkbox,
} from 'antd';
import {
  PictureOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  SafetyCertificateFilled,
  DeleteOutlined,
  CheckOutlined,
  LockOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  SunOutlined,
  MoonOutlined,
  PlusOutlined,
  InfoCircleOutlined,
  AimOutlined,
  EnvironmentOutlined,
  CompassOutlined,
  LoadingOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/apiClient';
import gymezyLogo from '../assets/logo/gymezy.png';

const { Option } = Select;

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

// GPS Regex helper for extracting coordinates from various Google Maps URL formats
const AT_COORDS_REGEX = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const Q_COORDS_REGEX = /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const D3D4_COORDS_REGEX = /!3d(-?\d+(?:\.\d+)?)[^!]*!4d(-?\d+(?:\.\d+)?)/;
const LL_COORDS_REGEX = /(?:ll|loc:)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

const extractCoordinatesFromMapsUrl = (url) => {
  if (!url || typeof url !== 'string') return null;

  const atMatch = AT_COORDS_REGEX.exec(url);
  if (atMatch) {
    return { lat: Number.parseFloat(atMatch[1]), lng: Number.parseFloat(atMatch[2]) };
  }

  const qMatch = Q_COORDS_REGEX.exec(url);
  if (qMatch) {
    return { lat: Number.parseFloat(qMatch[1]), lng: Number.parseFloat(qMatch[2]) };
  }

  const d3d4Match = D3D4_COORDS_REGEX.exec(url);
  if (d3d4Match) {
    return { lat: Number.parseFloat(d3d4Match[1]), lng: Number.parseFloat(d3d4Match[2]) };
  }

  const llMatch = LL_COORDS_REGEX.exec(url);
  if (llMatch) {
    return { lat: Number.parseFloat(llMatch[1]), lng: Number.parseFloat(llMatch[2]) };
  }

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

    const fullStreet = streetComponents.length > 0
      ? streetComponents.join(', ')
      : (data.display_name ? data.display_name.split(',').slice(0, 2).join(', ').trim() : '');

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
  { id: 1, title: 'Basic Info', key: 'basic' },
  { id: 2, title: 'Location & Geolocation', key: 'location' },
  { id: 3, title: 'Facilities & Photos', key: 'facilities' },
  { id: 4, title: 'Pricing & Plans', key: 'pricing' },
  { id: 5, title: 'Bank & Submit', key: 'bank' },
];

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
  1: ['subscriptionType', 'gymName', 'ownerName', 'phone', 'email', 'password', 'confirmPassword', 'gstNumber', 'panNumber'],
  2: ['address', 'area', 'city', 'state', 'pincode'],
  4: ['workouts', 'monthlyPrice'],
  5: ['accountHolder', 'bankName', 'accountNumber', 'confirmAccountNumber', 'ifscCode', 'agreedToTerms'],
};

// Pure validator function
const validateField = (field, value, form) => {
  switch (field) {
    case 'subscriptionType':
      if (!value) return 'Please select a partnership plan';
      return '';
    case 'gymName':
      if (!value || !value.trim()) return 'Gym / Studio name is required';
      if (value.trim().length < 2) return 'Must be at least 2 characters';
      return '';
    case 'ownerName':
      if (!value || !value.trim()) return 'Owner / MD name is required';
      if (value.trim().length < 2) return 'Must be at least 2 characters';
      return '';
    case 'phone':
      if (!value || !value.trim()) return 'Mobile number is required';
      if (!/^\d{10}$/.test(value.trim())) return 'Must be a valid 10-digit mobile number';
      return '';
    case 'email':
      if (!value || !value.trim()) return 'Email address is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter a valid email (e.g. owner@gym.com)';
      return '';
    case 'password': {
      if (form?.isGoogleSso) return '';
      if (!value) return 'Password is required';
      if (value.length < 8 || value.length > 16) return 'Must be 8 to 16 characters';
      if (!/[A-Z]/.test(value)) return 'Must contain at least 1 uppercase letter';
      if (!/\d/.test(value)) return 'Must contain at least 1 number';
      if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value)) return 'Must contain 1 special character';
      return '';
    }
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
      if (value.trim().length < 5) return 'Enter full street address (min 5 characters)';
      return '';
    case 'area':
      if (!value || !value.trim()) return 'Area / Locality is required';
      return '';
    case 'city':
      if (!value || !value.trim()) return 'City is required';
      return '';
    case 'state':
      if (!value || !value.trim()) return 'State is required';
      return '';
    case 'pincode':
      if (!value || !value.trim()) return 'Pincode is required';
      if (!/^\d{6}$/.test(value.trim())) return 'Pincode must be exactly 6 digits';
      return '';
    case 'floorSpaceSqFt':
      if (!value || Number(value) < 200) return 'Floor area must be at least 200 sq. ft.';
      if (Number(value) > 100000) return 'Floor area cannot exceed 100,000 sq. ft.';
      return '';
    case 'maxFloorCapacity':
      if (!value || Number(value) < 5) return 'Max capacity must be at least 5 athletes';
      if (Number(value) > 2000) return 'Max capacity cannot exceed 2,000 athletes';
      return '';
    case 'logo':
      if (!value) return 'Gym brand logo is required';
      return '';
    case 'facilities':
      if (!value || value.length === 0) return 'Select at least 1 facility';
      return '';
    case 'workouts':
      if (!value || value.length === 0) return 'Select at least 1 workout discipline';
      return '';
    case 'monthlyPrice':
      if (!value || Number(value) < 1) return 'Monthly membership price is required';
      return '';
    case 'accountHolder':
      if (!value || !value.trim()) return 'Account holder name is required';
      return '';
    case 'bankName':
      if (!value || !value.trim()) return 'Bank name is required';
      return '';
    case 'accountNumber':
      if (!value || !value.trim()) return 'Account number is required';
      if (value.trim().length < 8) return 'Account number must be at least 8 digits';
      return '';
    case 'confirmAccountNumber':
      if (!value || !value.trim()) return 'Please confirm account number';
      if (value.trim() !== form.accountNumber?.trim()) return 'Account numbers do not match';
      return '';
    case 'ifscCode':
      if (!value || !value.trim()) return 'IFSC code is required';
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.trim())) return 'Invalid IFSC (e.g. HDFC0001234)';
      return '';
    case 'agreedToTerms':
      if (!value) return 'You must accept the terms to proceed';
      return '';
    default:
      return '';
  }
};

const INITIAL_FORM_DATA = {
  gymName: '',
  tagline: '',
  ownerName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  businessType: 'Private Limited',
  yearEstablished: '2024',
  gstNumber: '',
  panNumber: '',
  branches: '1',
  businessCertificate: '',
  businessCertificateName: '',
  businessCertificateSize: '',
  businessCertificateType: '',

  // Step 2: Location & GPS
  address: '',
  area: '',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '',
  landmark: '',
  lat: null,
  lng: null,
  googleMapsUrl: '',
  weekdayOpen: '05:30 AM',
  weekdayClose: '10:30 PM',
  weekendOpen: '06:00 AM',
  weekendClose: '09:00 PM',
  isSplitShift: false,
  isOpenHolidays: true,
  is24Hours: false,

  floorSpaceSqFt: 3500,
  maxFloorCapacity: 45,
  genderAllowed: 'Unisex',
  logo: '',
  coverPhoto: '',
  galleryPhotos: [],
  facilities: ['AC Gym', 'Locker Facility', 'Shower Available', 'Free Wi-Fi', 'CCTV 24/7'],
  amenities: ['RO Drinking Water', 'Towel Service', 'Locker Key Padlocks'],
  aboutText: '',

  workouts: ['GYM / Strength', 'Cardio Fitness', 'HIIT (High Intensity)'],
  rules: [
    'Carry clean indoor training shoes',
    'Mandatory personal gym towel on workout benches',
    'Re-rack dumbbells and plates after set completion',
  ],
  safetyMeasures: [
    'Daily multi-session equipment sanitization',
    'Certified First Aid & CPR staff available on floor',
    '24/7 CCTV surveillance coverage',
  ],
  singleSessionPrice: 199,
  weeklyPassPrice: 799,
  fiveSessionPrice: 899,
  monthlyPrice: 1999,
  quarterlyPrice: 4999,
  halfYearlyPrice: 8999,
  annualPrice: 14999,
  freeCancellationHours: 2,
  refundPercentage: 100,
  rescheduleAllowedCount: 2,

  subscriptionType: 'Listing Only',
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

export const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();

  // Google SSO Onboarding State passed from Login redirect
  const googleProfile = location.state?.googleProfile || null;
  const isGoogleSso = Boolean(googleProfile);

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredGymData, setRegisteredGymData] = useState(null);

  // GPS Auto-detect loading state and pinned visibility state
  const [isFetchingGps, setIsFetchingGps] = useState(false);
  const [isGpsPinned, setIsGpsPinned] = useState(false);

  // Field touched tracker for live feedback
  const [touched, setTouched] = useState({});

  // Form State
  const [formData, setFormData] = useState(() => ({ ...INITIAL_FORM_DATA }));

  // Full reset helper to purge state and reset all inputs
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

  useEffect(() => {
    if (location.state?.reset) {
      resetForm();
    }
  }, [location.key]);

  // Email availability check states
  const [emailCheckStatus, setEmailCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'exists'
  const [emailCheckError, setEmailCheckError] = useState('');

  // Mobile Phone availability check states
  const [phoneCheckStatus, setPhoneCheckStatus] = useState('idle'); // 'idle' | 'checking' | 'available' | 'exists'
  const [phoneCheckError, setPhoneCheckError] = useState('');

  // Dynamic Rule & Safety Measure input states
  const [newRuleInput, setNewRuleInput] = useState('');
  const [newSafetyInput, setNewSafetyInput] = useState('');

  // Auto-fill Google Profile into form if redirected from Google Sign-In
  useEffect(() => {
    if (googleProfile) {
      setFormData((prev) => ({
        ...prev,
        email: googleProfile.email || prev.email,
        ownerName: googleProfile.fullName || prev.ownerName,
        isGoogleSso: true,
        googleId: googleProfile.googleUid,
      }));
      setEmailCheckStatus('available');
    }
  }, [googleProfile]);

  // API Call to check email availability
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
      const response = await apiClient.get(`/auth/check-email?email=${encodeURIComponent(trimmed)}`);
      const data = response?.data?.data || response?.data;
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
      if (err?.response?.data?.message?.includes('already exists')) {
        setEmailCheckStatus('exists');
        setEmailCheckError('An account with this email address already exists. Please log in or use a different email.');
        return false;
      }
      setEmailCheckStatus('idle');
      return null;
    }
  };

  // Debounced email check when typing
  useEffect(() => {
    const trimmedEmail = (formData.email || '').trim();
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setEmailCheckStatus('idle');
      setEmailCheckError('');
      return;
    }

    const timer = setTimeout(() => {
      void checkEmailExistsApi(trimmedEmail);
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.email]);

  // API Call to check phone availability
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
      const response = await apiClient.get(`/auth/check-phone?phone=${encodeURIComponent(digits)}`);
      const data = response?.data?.data || response?.data;
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
      if (err?.response?.data?.message?.includes('already exists')) {
        setPhoneCheckStatus('exists');
        setPhoneCheckError('An account with this mobile number already exists. Please log in or use a different number.');
        return false;
      }
      setPhoneCheckStatus('idle');
      return null;
    }
  };

  // Debounced phone check when typing
  useEffect(() => {
    const digits = (formData.phone || '').replace(/\D/g, '');
    if (digits.length !== 10) {
      setPhoneCheckStatus('idle');
      setPhoneCheckError('');
      return;
    }

    const timer = setTimeout(() => {
      void checkPhoneExistsApi(digits);
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.phone]);

  // Compute live validation errors reactively
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
    return errs;
  }, [formData, emailCheckError]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const markFieldTouched = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // GPS Auto-detect and reverse geocode handler
  const handleGetAddressByGps = () => {
    if (!navigator.geolocation) {
      message.error('Geolocation is not supported by your browser.');
      return;
    }

    setIsFetchingGps(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const parsed = await reverseGeocodeCoordinates(latitude, longitude);

          setFormData((prev) => ({
            ...prev,
            lat: latitude,
            lng: longitude,
            googleMapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
            ...(parsed?.address ? { address: parsed.address } : {}),
            ...(parsed?.area ? { area: parsed.area } : {}),
            ...(parsed?.city ? { city: parsed.city } : {}),
            ...(parsed?.state ? { state: parsed.state } : {}),
            ...(parsed?.pincode ? { pincode: parsed.pincode } : {}),
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
          message.success(`GPS Location detected: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        } catch {
          message.error('Failed to parse address from GPS coordinates.');
        } finally {
          setIsFetchingGps(false);
        }
      },
      (geoError) => {
        setIsFetchingGps(false);
        message.error(geoError.message || 'Unable to retrieve location. Please check browser location permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Google Maps URL change handler that parses coordinates automatically
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
      message.success(`GPS coordinates synced: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
    }
  };

  const toggleArrayItem = (field, item) => {
    setFormData((prev) => {
      const list = prev[field] || [];
      const updated = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
      return { ...prev, [field]: updated };
    });
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Live password complexity metrics
  const passwordChecks = {
    length: formData.password.length >= 8 && formData.password.length <= 16,
    hasUpper: /[A-Z]/.test(formData.password),
    hasNumber: /\d/.test(formData.password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(formData.password),
    match: formData.password === formData.confirmPassword && formData.confirmPassword.length > 0,
  };

  // Check step validity
  const isStepValid = (step) => {
    const fields = STEP_FIELDS[step] || [];
    return fields.every((f) => !errors[f]);
  };

  const handleNext = async () => {
    const rawFields = STEP_FIELDS[currentStep] || [];
    const currentFields = isGoogleSso && currentStep === 1
      ? rawFields.filter((f) => f !== 'password' && f !== 'confirmPassword')
      : rawFields;
    const newTouched = { ...touched };
    let hasError = false;
    for (const f of currentFields) {
      newTouched[f] = true;
      if (errors[f]) hasError = true;
    }
    setTouched(newTouched);

    if (currentStep === 1) {
      // 1. Mobile Phone Availability Check
      if (phoneCheckStatus === 'checking') {
        const isAvail = await checkPhoneExistsApi(formData.phone);
        if (isAvail === false) {
          message.error('An account with this mobile number already exists. Please log in or use a different number.');
          return;
        }
      } else if (phoneCheckStatus === 'exists' || phoneCheckError) {
        message.error('An account with this mobile number already exists. Please log in or use a different number.');
        return;
      } else if (phoneCheckStatus === 'idle' && formData.phone && formData.phone.trim().length === 10) {
        const isAvail = await checkPhoneExistsApi(formData.phone);
        if (isAvail === false) {
          message.error('An account with this mobile number already exists. Please log in or use a different number.');
          return;
        }
      }

      // 2. Official Email Availability Check
      if (emailCheckStatus === 'checking') {
        const isAvail = await checkEmailExistsApi(formData.email);
        if (isAvail === false) {
          message.error('An account with this email address already exists.');
          return;
        }
      } else if (emailCheckStatus === 'exists' || emailCheckError) {
        message.error('An account with this email address already exists. Please log in or use a different email.');
        return;
      } else if (emailCheckStatus === 'idle' && formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
        const isAvail = await checkEmailExistsApi(formData.email);
        if (isAvail === false) {
          message.error('An account with this email address already exists. Please log in or use a different email.');
          return;
        }
      }
    }

    if (hasError) {
      const firstError = currentFields.find((f) => errors[f]);
      message.error(errors[firstError] || 'Please complete all required fields.');
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, 5));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBusinessDocUpload = async (file) => {
    try {
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('Document size must be less than 10MB');
        return false;
      }
      const b64 = await fileToBase64(file);
      const sizeStr = file.size > 1024 * 1024
        ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.round(file.size / 1024) + ' KB';
      setFormData((prev) => ({
        ...prev,
        businessCertificate: b64,
        businessCertificateName: file.name,
        businessCertificateSize: sizeStr,
        businessCertificateType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      }));
      message.success(`Attached ${file.name}`);
    } catch {
      message.error('Failed to read document');
    }
    return false;
  };

  const handleLogoUpload = async (file) => {
    try {
      const b64 = await fileToBase64(file);
      updateField('logo', b64);
      message.success('Brand logo uploaded.');
    } catch {
      message.error('Failed to process image.');
    }
    return false;
  };

  const handleCoverUpload = async (file) => {
    try {
      const b64 = await fileToBase64(file);
      updateField('coverPhoto', b64);
      message.success('Cover photo uploaded.');
    } catch {
      message.error('Failed to process image.');
    }
    return false;
  };

  const handleFacilityPhotoUpload = async (file) => {
    try {
      const b64 = await fileToBase64(file);
      setFormData((prev) => ({
        ...prev,
        galleryPhotos: [...(prev.galleryPhotos || []), b64],
      }));
      message.success('Facility photo added.');
    } catch {
      message.error('Failed to process photo.');
    }
    return false;
  };

  const handleRemoveFacilityPhoto = (index) => {
    setFormData((prev) => ({
      ...prev,
      galleryPhotos: prev.galleryPhotos.filter((_, i) => i !== index),
    }));
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
      message.error(errors[firstError] || 'Please review your bank & agreement details.');
      return;
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
        password: isGoogleSso ? undefined : formData.password,
        authProvider: isGoogleSso ? 'GOOGLE' : 'LOCAL',
        googleId: isGoogleSso ? (googleProfile?.googleUid || '') : null,
        isSsoEnabled: true,
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

        weekdayOpen: formData.weekdayOpen,
        weekdayClose: formData.weekdayClose,
        weekendOpen: formData.weekendOpen,
        weekendClose: formData.weekendClose,
        isSplitShift: formData.isSplitShift,
        isOpenHolidays: formData.isOpenHolidays,
        is24Hours: formData.is24Hours,

        floorSpaceSqFt: Number(formData.floorSpaceSqFt),
        maxFloorCapacity: Number(formData.maxFloorCapacity),
        genderAllowed: formData.genderAllowed,
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
        weeklyPassPrice: Number(formData.weeklyPassPrice),
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

      const res = await apiClient.post('/gyms/register', payload);

      if (res.data?.success) {
        setRegisteredGymData({
          ...res.data.data,
          gymName: formData.gymName,
          ownerName: formData.ownerName,
          email: formData.email,
        });
        setIsSuccess(true);
        resetForm();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        message.error(res.data?.message || 'Registration failed. Please review your details.');
      }
    } catch (err) {
      message.error(
        err.response?.data?.message || 'Failed to submit registration. Please check your network and inputs.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Live input style generator with error / valid feedback borders
  const getInputStyle = (field) => {
    const isFieldTouched = !!touched[field];
    const hasFieldError = isFieldTouched && !!errors[field];
    const isFieldValid = isFieldTouched && !errors[field] && formData[field];

    return {
      height: 44,
      borderRadius: 8,
      backgroundColor: isDarkMode ? '#121214' : '#ffffff',
      borderColor: hasFieldError
        ? '#ef4444'
        : isFieldValid
        ? '#10b981'
        : isDarkMode
        ? '#27272a'
        : '#d4d4d8',
      color: isDarkMode ? '#ffffff' : '#0f172a',
      fontSize: 14,
      transition: 'border-color 0.2s ease',
    };
  };

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: isDarkMode ? '#cbd5e1' : '#334155',
    marginBottom: 6,
  };

  // Helper to render inline error message below input
  const renderFieldError = (field) => {
    if (touched[field] && errors[field]) {
      return (
        <div
          style={{
            color: '#ef4444',
            fontSize: 12,
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontWeight: 500,
          }}
        >
          <CloseCircleFilled style={{ fontSize: 11 }} />
          <span>{errors[field]}</span>
        </div>
      );
    }
    return null;
  };

  if (isSuccess) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: isDarkMode ? '#09090b' : '#f8fafc',
          color: isDarkMode ? '#ffffff' : '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 580,
            width: '100%',
            borderRadius: 16,
            backgroundColor: isDarkMode ? '#121214' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#e6f4ea',
              color: '#16a34a',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              marginBottom: 16,
            }}
          >
            <CheckCircleFilled />
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px 0' }}>
            Application Submitted for Approval
          </h2>

          <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px 0' }}>
            Thank you for registering <strong>{registeredGymData?.gymName || 'your gym'}</strong>. Your gym profile and facility photos have been routed to the GYMEZY Super Admin review desk.
          </p>

          <div
            style={{
              backgroundColor: isDarkMode ? '#18181b' : '#f8fafc',
              border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 24,
              textAlign: 'left',
            }}
          >
            <Row gutter={[16, 12]}>
              <Col span={12}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Partner Ref ID
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#003882', marginTop: 2 }}>
                  {registeredGymData?.partnerId || registeredGymData?.gymId || 'GYM-REG'}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Initial Publication Status
                </div>
                <div style={{ marginTop: 2 }}>
                  <Tag color="warning" style={{ fontWeight: 700, borderRadius: 6 }}>
                    Pending Approval
                  </Tag>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Owner Name
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                  {registeredGymData?.ownerName || '-'}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Login Email
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                  {registeredGymData?.email || '-'}
                </div>
              </Col>
            </Row>
          </div>

          <Button
            type="primary"
            size="large"
            block
            onClick={() => {
              resetForm();
              navigate('/login');
            }}
            style={{
              height: 46,
              backgroundColor: '#003882',
              borderColor: '#003882',
              fontWeight: 700,
              borderRadius: 8,
            }}
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: isDarkMode ? '#09090b' : '#f8fafc',
        color: isDarkMode ? '#ffffff' : '#0f172a',
        paddingBottom: 80,
      }}
    >
      {/* MINIMAL TOP NAVBAR */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backgroundColor: isDarkMode ? 'rgba(9, 9, 11, 0.85)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Left: Brand */}
        <div
          onClick={() => navigate('/login')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <img
            src={gymezyLogo}
            alt="GYMEZY Logo"
            style={{
              width: 30,
              height: 30,
              objectFit: 'contain',
              filter: isDarkMode ? 'brightness(0) invert(1)' : 'none',
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '0.5px', color: isDarkMode ? '#ffffff' : '#0f172a' }}>GYMEZY</span>
          <span style={{ color: isDarkMode ? '#52525b' : '#94a3b8', fontSize: 14, fontWeight: 400 }}>/</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Partner Onboarding
          </span>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: '#64748b' }} className="hide-mobile">
            Already a partner?{' '}
            <a
              onClick={() => navigate('/login')}
              style={{ color: '#003882', fontWeight: 700, cursor: 'pointer' }}
            >
              Sign In
            </a>
          </div>

          <div
            onClick={toggleTheme}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 10px',
              borderRadius: 16,
              backgroundColor: isDarkMode ? '#18181b' : '#f1f5f9',
              border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: isDarkMode ? '#e2e8f0' : '#475569',
            }}
          >
            {isDarkMode ? (
              <MoonOutlined style={{ color: '#ffd700' }} />
            ) : (
              <SunOutlined style={{ color: '#f59e0b' }} />
            )}
            <span>{isDarkMode ? 'Night' : 'Day'}</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: 740, margin: '0 auto', padding: '32px 20px 0 20px' }}>
        {/* STEP PROGRESS BAR WITH LIVE COMPLETION STATUS */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#003882', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Step {currentStep} of {STEPS.length} &bull; {STEPS[currentStep - 1].title}
            </span>
            <span style={{ fontSize: 12, color: isStepValid(currentStep) ? '#16a34a' : '#64748b', fontWeight: 600 }}>
              {isStepValid(currentStep) ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckOutlined /> Ready to proceed
                </span>
              ) : (
                `${Math.round((currentStep / STEPS.length) * 100)}% Completed`
              )}
            </span>
          </div>

          {/* Minimal 5-segment track */}
          <div style={{ display: 'flex', gap: 6, height: 5 }}>
            {STEPS.map((s) => (
              <div
                key={s.id}
                style={{
                  flex: 1,
                  borderRadius: 3,
                  backgroundColor:
                    s.id < currentStep
                      ? '#10b981'
                      : s.id === currentStep
                      ? '#003882'
                      : isDarkMode
                      ? '#27272a'
                      : '#e2e8f0',
                  transition: 'background-color 0.3s ease',
                }}
              />
            ))}
          </div>
        </div>

        {/* STEP HEADER */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: isDarkMode ? '#ffffff' : '#0f172a',
              margin: '0 0 6px 0',
              letterSpacing: '-0.3px',
            }}
          >
            {currentStep === 1 && "Let's start with your gym details"}
            {currentStep === 2 && 'Location, Geolocation & Operating Hours'}
            {currentStep === 3 && 'Facilities, Amenities & Photos'}
            {currentStep === 4 && 'Workout Disciplines & Membership Pricing'}
            {currentStep === 5 && 'Bank Account & Review'}
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            {currentStep === 1 && 'Provide basic business information and create your administrator login credentials.'}
            {currentStep === 2 && 'Pinpoint your exact facility address with live geolocation and define regular operating hours.'}
            {currentStep === 3 && 'Upload brand logo, cover photo, and high quality facility & equipment photos.'}
            {currentStep === 4 && 'Set your walk-in single session pass price and optional recurring membership tiers.'}
            {currentStep === 5 && 'Provide your settlement bank account. Your application will be submitted for Super Admin review.'}
          </p>
        </div>

        {/* STEP CONTENT BODY (MINIMAL CARD) */}
        <div
          style={{
            backgroundColor: isDarkMode ? '#121214' : '#ffffff',
            border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
            borderRadius: 14,
            padding: '28px 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          }}
        >
          {/* STEP 1: BASIC INFO & OWNER CREDENTIALS */}
          {currentStep === 1 && (
            <div>
              {/* Partnership Plan Selection matching uploaded design */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>
                    Select Partnership Plan <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Choose your operating tier on GYMEZY
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 8,
                    padding: 4,
                    backgroundColor: isDarkMode ? '#18181b' : '#f1f5f9',
                    borderRadius: 10,
                    border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
                  }}
                >
                  {[
                    { key: 'Listing Only', label: 'Free Listing', desc: 'Listing & Discovery' },
                    { key: 'GMS', label: 'GMS Software', desc: 'Member & Billing' },
                    { key: 'App Only', label: 'App Listing', desc: 'Direct Passes' },
                    { key: 'Hybrid', label: 'Hybrid Partner', desc: 'Full Suite' },
                  ].map((plan) => {
                    const isSelected = (formData.subscriptionType || 'Hybrid') === plan.key;
                    return (
                      <button
                        type="button"
                        key={plan.key}
                        onClick={() => updateField('subscriptionType', plan.key)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          textAlign: 'center',
                          backgroundColor: isSelected
                            ? isDarkMode
                              ? 'rgba(99, 102, 241, 0.22)'
                              : '#ffffff'
                            : 'transparent',
                          color: isSelected
                            ? isDarkMode
                              ? '#ffffff'
                              : '#4f46e5'
                            : isDarkMode
                            ? '#94a3b8'
                            : '#475569',
                          boxShadow: isSelected
                            ? isDarkMode
                              ? '0 0 0 1px #818cf8, 0 4px 12px rgba(129, 140, 248, 0.25)'
                              : '0 1px 4px rgba(0,0,0,0.08)'
                            : 'none',
                          border: isSelected
                            ? isDarkMode
                              ? '1.5px solid #818cf8'
                              : '1.5px solid #4f46e5'
                            : '1.5px solid transparent',
                          fontWeight: isSelected ? 800 : 700,
                          fontSize: 13,
                          letterSpacing: '-0.2px',
                          outline: 'none',
                          transition: 'all 0.2s ease',
                          fontFamily: 'inherit',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: 68,
                          gap: 3,
                        }}
                      >
                        <span style={{ fontSize: 13.5, fontWeight: isSelected ? 800 : 700 }}>{plan.label}</span>
                        <span style={{ fontSize: 11, opacity: isSelected ? 0.9 : 0.65, fontWeight: 500 }}>{plan.desc}</span>
                      </button>
                    );
                  })}
                </div>
                {renderFieldError('subscriptionType')}
              </div>

              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                Facility Information
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <label style={labelStyle}>
                    Gym / Studio Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    value={formData.gymName}
                    onChange={(e) => updateField('gymName', e.target.value)}
                    onBlur={() => markFieldTouched('gymName')}
                    style={getInputStyle('gymName')}
                  />
                  {renderFieldError('gymName')}
                </Col>

                <Col xs={24}>
                  <label style={labelStyle}>Tagline / Motto</label>
                  <Input
                    value={formData.tagline}
                    onChange={(e) => updateField('tagline', e.target.value)}
                    style={getInputStyle('tagline')}
                  />
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Number of Branches</label>
                  <Select
                    value={formData.branches}
                    onChange={(val) => updateField('branches', val)}
                    style={{ width: '100%', height: 44 }}
                  >
                    <Option value="1">1 (Single Facility)</Option>
                    <Option value="2-5">2 – 5 Branches</Option>
                    <Option value="6-10">6 – 10 Branches</Option>
                    <Option value="10+">10+ Chain Network</Option>
                  </Select>
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>GST Number (Optional)</label>
                  <Input
                    maxLength={15}
                    placeholder="e.g. 33AAAAA0000A1Z5"
                    value={formData.gstNumber}
                    onChange={(e) => updateField('gstNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15))}
                    onBlur={() => markFieldTouched('gstNumber')}
                    style={getInputStyle('gstNumber')}
                  />
                  {renderFieldError('gstNumber')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>PAN Number (Optional)</label>
                  <Input
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={formData.panNumber}
                    onChange={(e) => updateField('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    onBlur={() => markFieldTouched('panNumber')}
                    style={getInputStyle('panNumber')}
                  />
                  {renderFieldError('panNumber')}
                </Col>

                <Col xs={24}>
                  <div style={{ marginTop: 6 }}>
                    <label style={labelStyle}>
                      Business License / Registration Document (Optional)
                    </label>

                    {!formData.businessCertificate ? (
                      <Upload.Dragger
                        accept=".pdf,image/*"
                        showUploadList={false}
                        beforeUpload={handleBusinessDocUpload}
                        style={{
                          padding: '20px',
                          background: isDarkMode ? '#18181b' : '#fafafa',
                          borderColor: isDarkMode ? '#27272a' : '#cbd5e1',
                          borderRadius: 8,
                        }}
                      >
                        <p style={{ margin: 0 }}>
                          <FilePdfOutlined style={{ color: '#003882', fontSize: 28 }} />
                        </p>
                        <p style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a', margin: '6px 0 0 0' }}>
                          Click or drag document to upload
                        </p>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                          PDF, PNG, or JPG up to 10MB (GST, Trade License, or Shop Act)
                        </p>
                      </Upload.Dragger>
                    ) : (
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? '#18181b' : '#f8fafc',
                          border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 6,
                              backgroundColor: formData.businessCertificateType?.includes('pdf') || formData.businessCertificateName?.toLowerCase().endsWith('.pdf')
                                ? 'rgba(239, 68, 68, 0.1)'
                                : 'rgba(0, 56, 130, 0.1)',
                              color: formData.businessCertificateType?.includes('pdf') || formData.businessCertificateName?.toLowerCase().endsWith('.pdf')
                                ? '#ef4444'
                                : '#003882',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            {formData.businessCertificateType?.includes('pdf') || formData.businessCertificateName?.toLowerCase().endsWith('.pdf') ? (
                              <FilePdfOutlined />
                            ) : (
                              <PictureOutlined />
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: isDarkMode ? '#ffffff' : '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={formData.businessCertificateName}
                            >
                              {formData.businessCertificateName}
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                              {formData.businessCertificateSize}
                            </div>
                          </div>
                        </div>

                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              businessCertificate: '',
                              businessCertificateName: '',
                              businessCertificateSize: '',
                              businessCertificateType: '',
                            }));
                          }}
                          style={{ fontWeight: 600 }}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>

              <Divider style={{ margin: '24px 0 20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                Administrator Login Account
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Owner / MD Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                    value={formData.ownerName}
                    onChange={(e) => updateField('ownerName', e.target.value)}
                    onBlur={() => markFieldTouched('ownerName')}
                    style={getInputStyle('ownerName')}
                  />
                  {renderFieldError('ownerName')}
                </Col>

                <Col xs={24} sm={12}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      Owner Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {phoneCheckStatus === 'checking' && (
                      <span style={{ fontSize: 11, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                        <LoadingOutlined spin /> Checking availability...
                      </span>
                    )}
                    {phoneCheckStatus === 'available' && !errors.phone && (
                      <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CheckCircleFilled style={{ fontSize: 11 }} /> Mobile available
                      </span>
                    )}
                    {phoneCheckStatus === 'exists' && (
                      <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CloseCircleFilled style={{ fontSize: 11 }} /> Mobile already registered
                      </span>
                    )}
                  </div>
                  <Input
                    prefix={<PhoneOutlined style={{ color: '#94a3b8' }} />}
                    suffix={
                      phoneCheckStatus === 'checking' ? (
                        <LoadingOutlined style={{ color: '#6366f1' }} spin />
                      ) : phoneCheckStatus === 'available' && !errors.phone ? (
                        <CheckCircleFilled style={{ color: '#10b981' }} />
                      ) : (phoneCheckStatus === 'exists' || (touched.phone && errors.phone)) ? (
                        <CloseCircleFilled style={{ color: '#ef4444' }} />
                      ) : null
                    }
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value.replace(/\D/g, ''))}
                    onBlur={() => markFieldTouched('phone')}
                    style={{
                      ...getInputStyle('phone'),
                      borderColor:
                        phoneCheckStatus === 'exists' || (touched.phone && errors.phone)
                          ? '#ef4444'
                          : phoneCheckStatus === 'available' && !errors.phone
                          ? '#10b981'
                          : getInputStyle('phone').borderColor,
                    }}
                  />
                  {renderFieldError('phone')}
                  {phoneCheckStatus === 'exists' && !errors.phone && (
                    <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CloseCircleFilled style={{ fontSize: 11 }} />
                      <span>{phoneCheckError || 'An account with this mobile number already exists.'}</span>
                    </div>
                  )}
                </Col>

                <Col xs={24}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>
                      Official Email Address <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {emailCheckStatus === 'checking' && (
                      <span style={{ fontSize: 11, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                        <LoadingOutlined spin /> Checking availability...
                      </span>
                    )}
                    {emailCheckStatus === 'available' && !errors.email && (
                      <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CheckCircleFilled style={{ fontSize: 11 }} /> Email available
                      </span>
                    )}
                    {emailCheckStatus === 'exists' && (
                      <span style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CloseCircleFilled style={{ fontSize: 11 }} /> Email already registered
                      </span>
                    )}
                  </div>
                  <Input
                    prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
                    suffix={
                      emailCheckStatus === 'checking' ? (
                        <LoadingOutlined style={{ color: '#6366f1' }} spin />
                      ) : emailCheckStatus === 'available' && !errors.email ? (
                        <CheckCircleFilled style={{ color: '#10b981' }} />
                      ) : (emailCheckStatus === 'exists' || (touched.email && errors.email)) ? (
                        <CloseCircleFilled style={{ color: '#ef4444' }} />
                      ) : null
                    }
                    value={formData.email}
                    disabled={isGoogleSso}
                    onChange={(e) => updateField('email', e.target.value)}
                    onBlur={() => {
                      markFieldTouched('email');
                      if (formData.email && formData.email.includes('@') && formData.email.includes('.')) {
                        void checkEmailExistsApi(formData.email);
                      }
                    }}
                    style={{
                      ...getInputStyle('email'),
                      backgroundColor: isGoogleSso
                        ? isDarkMode
                          ? '#1e293b'
                          : '#f1f5f9'
                        : getInputStyle('email').backgroundColor,
                      cursor: isGoogleSso ? 'not-allowed' : 'default',
                    }}
                  />
                  {renderFieldError('email')}
                </Col>

                {isGoogleSso ? (
                  <Col xs={24}>
                    <div
                      style={{
                        padding: '16px 20px',
                        borderRadius: 10,
                        backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#bfdbfe'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        marginTop: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: isDarkMode ? '#f8fafc' : '#1e3a8a' }}>
                          Verified Google Account Sign-In
                        </div>
                        <div style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#475569', marginTop: 2 }}>
                          No password required. Your partner account will be saved once you finish onboarding.
                        </div>
                      </div>
                    </div>
                  </Col>
                ) : (
                  <>
                    <Col xs={24} sm={12}>
                      <label style={labelStyle}>
                        Create Account Password <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <Input.Password
                        prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                        value={formData.password}
                        onChange={(e) => updateField('password', e.target.value)}
                        onBlur={() => markFieldTouched('password')}
                        style={getInputStyle('password')}
                      />
                      {renderFieldError('password')}
                    </Col>

                    <Col xs={24} sm={12}>
                      <label style={labelStyle}>
                        Confirm Password <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <Input.Password
                        prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                        value={formData.confirmPassword}
                        onChange={(e) => updateField('confirmPassword', e.target.value)}
                        onBlur={() => markFieldTouched('confirmPassword')}
                        style={getInputStyle('confirmPassword')}
                      />
                      {renderFieldError('confirmPassword')}
                    </Col>

                    {/* Minimal Live Password Requirements Checklist */}
                    <Col xs={24}>
                      <div
                        style={{
                          marginTop: 16,
                          padding: '12px 14px',
                          borderRadius: 8,
                          backgroundColor: isDarkMode ? '#18181b' : '#f8fafc',
                          border: `1px solid ${isDarkMode ? '#27272a' : '#f1f5f9'}`,
                          display: 'flex',
                          gap: 12,
                          flexWrap: 'wrap',
                        }}
                      >
                        {[
                          { label: '8-16 Chars', valid: passwordChecks.length },
                          { label: '1 Uppercase', valid: passwordChecks.hasUpper },
                          { label: '1 Number', valid: passwordChecks.hasNumber },
                          { label: '1 Special Symbol', valid: passwordChecks.hasSpecial },
                          { label: 'Passwords Match', valid: passwordChecks.match },
                        ].map((item, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: 12,
                              fontWeight: 500,
                              color: item.valid
                                ? '#10b981'
                                : isDarkMode
                                ? '#71717a'
                                : '#94a3b8',
                            }}
                          >
                            {item.valid ? (
                              <CheckCircleFilled style={{ color: '#10b981', fontSize: 13 }} />
                            ) : (
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: isDarkMode ? '#3f3f46' : '#cbd5e1',
                                }}
                              />
                            )}
                            {item.label}
                          </span>
                        ))}
                      </div>
                    </Col>
                  </>
                )}
              </Row>
            </div>
          )}

          {/* STEP 2: LOCATION, GPS & OPERATING SCHEDULE */}
          {currentStep === 2 && (
            <div>
              {/* GPS AUTO-DETECT TOP BAR */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  Facility Address & Geolocation
                </div>

                <Button
                  icon={<AimOutlined style={{ color: '#003882' }} />}
                  loading={isFetchingGps}
                  onClick={handleGetAddressByGps}
                  style={{
                    height: 36,
                    borderRadius: 8,
                    fontWeight: 600,
                    borderColor: '#003882',
                    color: '#003882',
                    backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                  }}
                >
                  Auto-Detect GPS Location
                </Button>
              </div>

              {/* GPS Live Pinned Coordinates Badge - Displayed ONLY after Auto-Detection */}
              {isGpsPinned && formData.lat && formData.lng && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    backgroundColor: isDarkMode ? '#18181b' : '#f0fdf4',
                    border: `1px solid ${isDarkMode ? '#27272a' : '#bbf7d0'}`,
                    marginBottom: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <EnvironmentOutlined style={{ color: '#16a34a', fontSize: 16 }} />
                    <span style={{ fontWeight: 600, color: isDarkMode ? '#86efac' : '#15803d' }}>
                      GPS Coordinates Pinned:
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                      {Number(formData.lat).toFixed(5)}, {Number(formData.lng).toFixed(5)}
                    </span>
                  </div>

                  <a
                    href={formData.googleMapsUrl || `https://maps.google.com/?q=${formData.lat},${formData.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 13, color: '#003882', fontWeight: 700, textDecoration: 'underline' }}
                  >
                    View on Google Maps
                  </a>
                </div>
              )}

              <Row gutter={[16, 16]}>
                <Col xs={24}>
                  <label style={labelStyle}>
                    Street Address / Door No. <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    onBlur={() => markFieldTouched('address')}
                    style={getInputStyle('address')}
                  />
                  {renderFieldError('address')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Area / Locality <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    value={formData.area}
                    onChange={(e) => updateField('area', e.target.value)}
                    onBlur={() => markFieldTouched('area')}
                    style={getInputStyle('area')}
                  />
                  {renderFieldError('area')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Landmark (Optional)</label>
                  <Input
                    value={formData.landmark}
                    onChange={(e) => updateField('landmark', e.target.value)}
                    style={getInputStyle('landmark')}
                  />
                </Col>

                <Col xs={24} sm={8}>
                  <label style={labelStyle}>
                    City <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    onBlur={() => markFieldTouched('city')}
                    style={getInputStyle('city')}
                  />
                  {renderFieldError('city')}
                </Col>

                <Col xs={24} sm={8}>
                  <label style={labelStyle}>
                    State <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    onBlur={() => markFieldTouched('state')}
                    style={getInputStyle('state')}
                  />
                  {renderFieldError('state')}
                </Col>

                <Col xs={24} sm={8}>
                  <label style={labelStyle}>
                    Pincode <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    maxLength={6}
                    value={formData.pincode}
                    onChange={(e) => updateField('pincode', e.target.value.replace(/\D/g, ''))}
                    onBlur={() => markFieldTouched('pincode')}
                    style={getInputStyle('pincode')}
                  />
                  {renderFieldError('pincode')}
                </Col>

                <Col xs={24}>
                  <label style={labelStyle}>Google Maps Share Link (Auto-extracts GPS)</label>
                  <Input
                    prefix={<CompassOutlined style={{ color: '#94a3b8' }} />}
                    value={formData.googleMapsUrl}
                    onChange={(e) => handleGoogleMapsUrlChange(e.target.value)}
                    style={getInputStyle('googleMapsUrl')}
                  />
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>GPS Latitude</label>
                  <InputNumber
                    step={0.0001}
                    value={formData.lat}
                    onChange={(val) => {
                      updateField('lat', val);
                      if (formData.lng) updateField('googleMapsUrl', `https://maps.google.com/?q=${val},${formData.lng}`);
                    }}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>GPS Longitude</label>
                  <InputNumber
                    step={0.0001}
                    value={formData.lng}
                    onChange={(val) => {
                      updateField('lng', val);
                      if (formData.lat) updateField('googleMapsUrl', `https://maps.google.com/?q=${formData.lat},${val}`);
                    }}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                </Col>
              </Row>

              <Divider style={{ margin: '24px 0 20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                Regular Operating Hours
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Weekday Open (Mon – Fri)</label>
                  <Select
                    value={formData.weekdayOpen}
                    onChange={(val) => updateField('weekdayOpen', val)}
                    style={{ width: '100%', height: 44 }}
                  >
                    {['05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM'].map((t) => (
                      <Option key={t} value={t}>{t}</Option>
                    ))}
                  </Select>
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Weekday Close (Mon – Fri)</label>
                  <Select
                    value={formData.weekdayClose}
                    onChange={(val) => updateField('weekdayClose', val)}
                    style={{ width: '100%', height: 44 }}
                  >
                    {['09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM', '11:00 PM', '11:30 PM'].map((t) => (
                      <Option key={t} value={t}>{t}</Option>
                    ))}
                  </Select>
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Weekend Open (Sat – Sun)</label>
                  <Select
                    value={formData.weekendOpen}
                    onChange={(val) => updateField('weekendOpen', val)}
                    style={{ width: '100%', height: 44 }}
                  >
                    {['05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '08:00 AM'].map((t) => (
                      <Option key={t} value={t}>{t}</Option>
                    ))}
                  </Select>
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Weekend Close (Sat – Sun)</label>
                  <Select
                    value={formData.weekendClose}
                    onChange={(val) => updateField('weekendClose', val)}
                    style={{ width: '100%', height: 44 }}
                  >
                    {['08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM'].map((t) => (
                      <Option key={t} value={t}>{t}</Option>
                    ))}
                  </Select>
                </Col>
              </Row>

              <div
                style={{
                  marginTop: 18,
                  display: 'flex',
                  gap: 24,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Open on Public Holidays</span>
                  <Switch
                    size="small"
                    checked={formData.isOpenHolidays}
                    onChange={(checked) => updateField('isOpenHolidays', checked)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>24/7 Facility Access</span>
                  <Switch
                    size="small"
                    checked={formData.is24Hours}
                    onChange={(checked) => updateField('is24Hours', checked)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FACILITIES, AMENITIES & PHOTOS */}
          {currentStep === 3 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                Capacity & Access
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <label style={labelStyle}>
                    Floor Area (Sq. Ft.) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <InputNumber
                    min={200}
                    max={50000}
                    value={formData.floorSpaceSqFt}
                    onChange={(val) => updateField('floorSpaceSqFt', val)}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                  {renderFieldError('floorSpaceSqFt')}
                </Col>

                <Col xs={24} sm={8}>
                  <label style={labelStyle}>
                    Max Slot Capacity <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <InputNumber
                    min={5}
                    max={300}
                    value={formData.maxFloorCapacity}
                    onChange={(val) => updateField('maxFloorCapacity', val)}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                  {renderFieldError('maxFloorCapacity')}
                </Col>

                <Col xs={24} sm={8}>
                  <label style={labelStyle}>Gender Policy</label>
                  <Select
                    value={formData.genderAllowed}
                    onChange={(val) => updateField('genderAllowed', val)}
                    style={{ width: '100%', height: 44 }}
                  >
                    <Option value="Unisex">Unisex (All Welcome)</Option>
                    <Option value="Men Only">Men Only</Option>
                    <Option value="Women Only">Women Only</Option>
                  </Select>
                </Col>
              </Row>

              <Divider style={{ margin: '24px 0 20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                Brand Identity Media
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Brand Logo <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {formData.logo ? (
                    <div
                      style={{
                        position: 'relative',
                        height: 135,
                        borderRadius: 8,
                        border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isDarkMode ? '#18181b' : '#fafafa',
                      }}
                    >
                      <img
                        src={formData.logo}
                        alt="Logo"
                        style={{ maxHeight: 100, maxWidth: '80%', objectFit: 'contain' }}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => updateField('logo', '')}
                        style={{ position: 'absolute', top: 8, right: 8 }}
                      />
                    </div>
                  ) : (
                    <Upload.Dragger
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={handleLogoUpload}
                      style={{
                        padding: '16px 12px',
                        background: isDarkMode ? '#18181b' : '#fafafa',
                        borderColor: touched.logo && errors.logo ? '#ef4444' : isDarkMode ? '#27272a' : '#cbd5e1',
                        borderRadius: 8,
                        height: 135,
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        <PictureOutlined style={{ fontSize: 24, color: '#003882' }} />
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#003882', margin: '6px 0 2px 0' }}>
                        Upload Logo
                      </p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                        PNG or JPG (Square recommended)
                      </p>
                    </Upload.Dragger>
                  )}
                  {renderFieldError('logo')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Cover Photo (Optional)</label>
                  {formData.coverPhoto ? (
                    <div
                      style={{
                        position: 'relative',
                        height: 135,
                        borderRadius: 8,
                        border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isDarkMode ? '#18181b' : '#fafafa',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={formData.coverPhoto}
                        alt="Cover"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => updateField('coverPhoto', '')}
                        style={{ position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}
                      />
                    </div>
                  ) : (
                    <Upload.Dragger
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={handleCoverUpload}
                      style={{
                        padding: '16px 12px',
                        background: isDarkMode ? '#18181b' : '#fafafa',
                        borderColor: isDarkMode ? '#27272a' : '#cbd5e1',
                        borderRadius: 8,
                        height: 135,
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        <PictureOutlined style={{ fontSize: 24, color: '#003882' }} />
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#003882', margin: '6px 0 2px 0' }}>
                        Upload Cover Banner
                      </p>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                        16:9 Wide Landscape
                      </p>
                    </Upload.Dragger>
                  )}
                </Col>
              </Row>

              <Divider style={{ margin: '24px 0 20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              {/* FACILITY & EQUIPMENT PHOTOS MULTI-UPLOAD */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>
                    Facility & Equipment Photos
                  </label>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {formData.galleryPhotos.length} photos uploaded
                  </span>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px 0' }}>
                  Upload clear photos of your workout floor, strength machines, cardio zones, and locker rooms.
                </p>

                {/* Upload Button + Gallery Grid */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={handleFacilityPhotoUpload}
                  >
                    <div
                      style={{
                        width: 120,
                        height: 100,
                        border: `1.5px dashed ${isDarkMode ? '#3f3f46' : '#cbd5e1'}`,
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backgroundColor: isDarkMode ? '#18181b' : '#fafafa',
                        gap: 6,
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#003882';
                        e.currentTarget.style.backgroundColor = isDarkMode ? '#27272a' : '#f0f7ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = isDarkMode ? '#3f3f46' : '#cbd5e1';
                        e.currentTarget.style.backgroundColor = isDarkMode ? '#18181b' : '#fafafa';
                      }}
                    >
                      <PlusOutlined style={{ fontSize: 20, color: '#003882' }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#003882' }}>Add Photo</span>
                    </div>
                  </Upload>

                  {formData.galleryPhotos.map((photoSrc, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: 120,
                        height: 100,
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
                      }}
                    >
                      <img
                        src={photoSrc}
                        alt={`Facility ${idx + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveFacilityPhoto(idx)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.6)',
                          color: '#ffffff',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                        }}
                      >
                        <DeleteOutlined />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Divider style={{ margin: '24px 0 20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              {/* FACILITIES MULTI-SELECT */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>
                    Facilities Multi-Select (Available at Facility) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {formData.facilities.length} selected
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {FACILITY_OPTIONS.map((item) => {
                    const isSelected = formData.facilities.includes(item);
                    return (
                      <div
                        key={item}
                        onClick={() => toggleArrayItem('facilities', item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? '#003882'
                            : isDarkMode
                            ? '#18181b'
                            : '#f1f5f9',
                          color: isSelected
                            ? '#ffffff'
                            : isDarkMode
                            ? '#cbd5e1'
                            : '#475569',
                          border: `1px solid ${
                            isSelected
                              ? '#003882'
                              : isDarkMode
                              ? '#27272a'
                              : '#e2e8f0'
                          }`,
                          userSelect: 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isSelected && <CheckOutlined style={{ fontSize: 10 }} />}
                        {item}
                      </div>
                    );
                  })}
                </div>
                {renderFieldError('facilities')}
              </div>

              <Divider style={{ margin: '20px 0 16px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              {/* AMENITIES & MEMBER PERKS */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, margin: 0 }}>
                    Amenities & Member Perks
                  </label>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {(formData.amenities || []).length} selected
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {AMENITY_OPTIONS.map((item) => {
                    const isSelected = (formData.amenities || []).includes(item);
                    return (
                      <div
                        key={item}
                        onClick={() => toggleArrayItem('amenities', item)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? '#F59E0B'
                            : isDarkMode
                            ? '#18181b'
                            : '#fffbeb',
                          color: isSelected
                            ? '#ffffff'
                            : isDarkMode
                            ? '#cbd5e1'
                            : '#92400e',
                          border: `1px solid ${
                            isSelected
                              ? '#F59E0B'
                              : isDarkMode
                              ? '#27272a'
                              : '#fcd34d'
                          }`,
                          userSelect: 'none',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {isSelected && <CheckOutlined style={{ fontSize: 10 }} />}
                        {item}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: WORKOUTS & PRICING PLANS */}
          {currentStep === 4 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 12 }}>
                Supported Workout Disciplines <span style={{ color: '#ef4444' }}>*</span>
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px 0' }}>
                Select all fitness and workout activities supported at your center.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {WORKOUT_OPTIONS.map((item) => {
                  const isSelected = formData.workouts.includes(item);
                  return (
                    <div
                      key={item}
                      onClick={() => toggleArrayItem('workouts', item)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 14px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: isSelected
                          ? '#003882'
                          : isDarkMode
                          ? '#18181b'
                          : '#f1f5f9',
                        color: isSelected
                          ? '#ffffff'
                          : isDarkMode
                          ? '#cbd5e1'
                          : '#475569',
                        border: `1px solid ${
                          isSelected
                            ? '#003882'
                            : isDarkMode
                            ? '#27272a'
                            : '#e2e8f0'
                        }`,
                        userSelect: 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isSelected && <CheckOutlined style={{ fontSize: 10 }} />}
                      {item}
                    </div>
                  );
                })}
              </div>
              {renderFieldError('workouts')}

              <Divider style={{ margin: '24px 0 20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                Membership & Access Pricing (4 Standard Tiers)
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    1. Monthly Unlimited Pass (₹) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <InputNumber
                    min={299}
                    max={25000}
                    value={formData.monthlyPrice}
                    onChange={(val) => updateField('monthlyPrice', val)}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                    Standard 30-day recurring membership
                  </span>
                  {renderFieldError('monthlyPrice')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    2. Quarterly Pass (3 Months) (₹)
                  </label>
                  <InputNumber
                    min={699}
                    max={50000}
                    value={formData.quarterlyPrice}
                    onChange={(val) => updateField('quarterlyPrice', val)}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                    Valid for 90 days {formData.monthlyPrice && formData.quarterlyPrice < formData.monthlyPrice * 3 && (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>• Save ₹{(formData.monthlyPrice * 3 - formData.quarterlyPrice).toLocaleString('en-IN')}</span>
                    )}
                  </span>
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    3. Half Yearly Pass (6 Months) (₹)
                  </label>
                  <InputNumber
                    min={1299}
                    max={90000}
                    value={formData.halfYearlyPrice}
                    onChange={(val) => updateField('halfYearlyPrice', val)}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                    Valid for 180 days {formData.monthlyPrice && formData.halfYearlyPrice < formData.monthlyPrice * 6 && (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>• Save ₹{(formData.monthlyPrice * 6 - formData.halfYearlyPrice).toLocaleString('en-IN')}</span>
                    )}
                  </span>
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    4. Annual VIP Pass (1 Year) (₹)
                  </label>
                  <InputNumber
                    min={2499}
                    max={150000}
                    value={formData.annualPrice}
                    onChange={(val) => updateField('annualPrice', val)}
                    style={{ width: '100%', height: 44, borderRadius: 8 }}
                  />
                  <span style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginTop: 4 }}>
                    Valid for 365 days {formData.monthlyPrice && formData.annualPrice < formData.monthlyPrice * 12 && (
                      <span style={{ color: '#10b981', fontWeight: 600 }}>• Save ₹{(formData.monthlyPrice * 12 - formData.annualPrice).toLocaleString('en-IN')}</span>
                    )}
                  </span>
                </Col>
              </Row>

              <div
                style={{
                  marginTop: 20,
                  marginBottom: 20,
                  padding: '12px 16px',
                  borderRadius: 8,
                  backgroundColor: isDarkMode ? '#18181b' : '#f8fafc',
                  border: `1px solid ${isDarkMode ? '#27272a' : '#f1f5f9'}`,
                  fontSize: 12,
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <InfoCircleOutlined style={{ color: '#003882', fontSize: 16 }} />
                <span>
                  Members can cancel bookings up to <strong>2 hours</strong> before the session for a <strong>100% refund</strong>.
                </span>
              </div>

              <Divider style={{ margin: '20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              {/* RULES & SAFETY */}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <div style={{ padding: '16px', borderRadius: 8, border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`, backgroundColor: isDarkMode ? '#18181b' : '#fafafa', height: '100%' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileTextOutlined style={{ color: '#6366F1' }} /> Gym Rules & Member Guidelines
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {(formData.rules || []).map((rule, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}` }}>
                          <CheckOutlined style={{ color: '#6366F1', fontSize: 10, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12, color: isDarkMode ? '#e2e8f0' : '#334155' }}>{rule}</span>
                          <Button
                            type="text" size="small" danger
                            icon={<DeleteOutlined />}
                            onClick={() => updateField('rules', (formData.rules || []).filter((_, i) => i !== idx))}
                            style={{ padding: '0 4px', height: 22 }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input
                        placeholder="Add gym rule..."
                        value={newRuleInput}
                        onChange={(e) => setNewRuleInput(e.target.value)}
                        style={{ height: 34, borderRadius: 6 }}
                        onPressEnter={() => {
                          if (newRuleInput.trim()) {
                            updateField('rules', [...(formData.rules || []), newRuleInput.trim()]);
                            setNewRuleInput('');
                          }
                        }}
                      />
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => {
                          if (newRuleInput.trim()) {
                            updateField('rules', [...(formData.rules || []), newRuleInput.trim()]);
                            setNewRuleInput('');
                          }
                        }}
                        style={{ flexShrink: 0, height: 34 }}
                      />
                    </div>
                  </div>
                </Col>

                <Col xs={24} md={12}>
                  <div style={{ padding: '16px', borderRadius: 8, border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`, backgroundColor: isDarkMode ? '#18181b' : '#fafafa', height: '100%' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SafetyCertificateOutlined style={{ color: '#10B981' }} /> Safety Measures & Protocols
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                      {(formData.safetyMeasures || []).map((measure, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', border: `1px solid ${isDarkMode ? '#334155' : '#bbf7d0'}` }}>
                          <CheckCircleFilled style={{ color: '#10B981', fontSize: 10, flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: 12, color: isDarkMode ? '#e2e8f0' : '#166534' }}>{measure}</span>
                          <Button
                            type="text" size="small" danger
                            icon={<DeleteOutlined />}
                            onClick={() => updateField('safetyMeasures', (formData.safetyMeasures || []).filter((_, i) => i !== idx))}
                            style={{ padding: '0 4px', height: 22 }}
                          />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Input
                        placeholder="Add safety measure..."
                        value={newSafetyInput}
                        onChange={(e) => setNewSafetyInput(e.target.value)}
                        style={{ height: 34, borderRadius: 6 }}
                        onPressEnter={() => {
                          if (newSafetyInput.trim()) {
                            updateField('safetyMeasures', [...(formData.safetyMeasures || []), newSafetyInput.trim()]);
                            setNewSafetyInput('');
                          }
                        }}
                      />
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => {
                          if (newSafetyInput.trim()) {
                            updateField('safetyMeasures', [...(formData.safetyMeasures || []), newSafetyInput.trim()]);
                            setNewSafetyInput('');
                          }
                        }}
                        style={{ flexShrink: 0, height: 34 }}
                      />
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          )}

          {/* STEP 5: BANK & SETTLEMENT & REVIEW & SUBMISSION */}
          {currentStep === 5 && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                Bank Account for Automated Payouts
              </div>

              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Account Holder Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    placeholder="e.g. Apex Fitness Pvt Ltd"
                    value={formData.accountHolder}
                    onChange={(e) => updateField('accountHolder', e.target.value)}
                    onBlur={() => markFieldTouched('accountHolder')}
                    style={getInputStyle('accountHolder')}
                  />
                  {renderFieldError('accountHolder')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Bank Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Select
                    showSearch
                    optionFilterProp="children"
                    placeholder="Select bank"
                    value={formData.bankName}
                    style={getInputStyle('bankName')}
                    onChange={(bankName) => {
                      updateField('bankName', bankName);
                      updateField('ifscCode', getBankByName(bankName)?.ifscPrefix || '');
                      markFieldTouched('bankName');
                    }}
                  >
                    {BANKS.map((bank) => (
                      <Select.Option key={bank.name} value={bank.name}>{bank.name}</Select.Option>
                    ))}
                  </Select>
                  {renderFieldError('bankName')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Bank Account Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    placeholder="50100456789012"
                    value={formData.accountNumber}
                    maxLength={18}
                    inputMode="numeric"
                    onChange={(e) => updateField('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 18))}
                    onBlur={() => markFieldTouched('accountNumber')}
                    style={getInputStyle('accountNumber')}
                  />
                  {renderFieldError('accountNumber')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Confirm Account Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    placeholder="Re-enter bank account number"
                    value={formData.confirmAccountNumber}
                    maxLength={18}
                    inputMode="numeric"
                    onChange={(e) => updateField('confirmAccountNumber', e.target.value.replace(/\D/g, '').slice(0, 18))}
                    onBlur={() => markFieldTouched('confirmAccountNumber')}
                    style={getInputStyle('confirmAccountNumber')}
                  />
                  {renderFieldError('confirmAccountNumber')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>
                    Bank IFSC Code <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <Input
                    placeholder="e.g. HDFC0001234"
                    value={formData.ifscCode}
                    maxLength={11}
                    onChange={(e) => {
                      const bankPrefix = getBankByName(formData.bankName)?.ifscPrefix || '';
                      const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                      let finalVal = raw;
                      if (bankPrefix) {
                        if (!raw.startsWith(bankPrefix)) {
                          const branchPart = raw.replace(new RegExp(`^${bankPrefix.slice(0, 3)}|^${bankPrefix.slice(0, 2)}|^${bankPrefix.slice(0, 1)}`, 'i'), '');
                          finalVal = (bankPrefix + branchPart).slice(0, 11);
                        } else {
                          finalVal = raw.slice(0, 11);
                        }
                      } else {
                        finalVal = raw.slice(0, 11);
                      }
                      updateField('ifscCode', finalVal);
                    }}
                    onBlur={() => markFieldTouched('ifscCode')}
                    style={getInputStyle('ifscCode')}
                  />
                  {renderFieldError('ifscCode')}
                </Col>

                <Col xs={24} sm={12}>
                  <label style={labelStyle}>Payout UPI ID (Optional)</label>
                  <Input
                    placeholder="e.g. apexfitness@okaxis"
                    value={formData.upiId}
                    onChange={(e) => updateField('upiId', e.target.value)}
                    style={getInputStyle('upiId')}
                  />
                </Col>
              </Row>

              <Divider style={{ margin: '24px 0 20px 0', borderColor: isDarkMode ? '#27272a' : '#f1f5f9' }} />

              {/* INITIAL PUBLICATION STATUS CALLOUT */}
              <div
                style={{
                  borderRadius: 10,
                  padding: '16px 18px',
                  backgroundColor: isDarkMode ? '#172554' : '#eff6ff',
                  border: '1px solid #93c5fd',
                  marginBottom: 20,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                }}
              >
                <SafetyCertificateFilled style={{ color: '#2563eb', fontSize: 22, marginTop: 2 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#1e3a8a' }}>
                      Initial Publication Status:
                    </span>
                    <Tag color="warning" style={{ fontWeight: 800, borderRadius: 6, fontSize: 12 }}>
                      Pending Approval
                    </Tag>
                  </div>
                  <div style={{ fontSize: 12, color: isDarkMode ? '#bfdbfe' : '#1e40af', lineHeight: 1.5 }}>
                    Your facility registration, pricing, and photos will be submitted to the GYMEZY Super Admin review console. Once reviewed and approved by the Super Admin, your gym will automatically go live for user bookings on the customer mobile app.
                  </div>
                </div>
              </div>

              {/* Minimal Summary Box */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? '#18181b' : '#f8fafc',
                  border: `1px solid ${isDarkMode ? '#27272a' : '#e2e8f0'}`,
                  marginBottom: 20,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
                  Registration Overview
                </div>
                <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div><strong>Partnership Plan:</strong> <Tag color="blue" style={{ fontWeight: 700, marginLeft: 4 }}>{formData.subscriptionType === 'Listing Only' ? 'Free Listing' : formData.subscriptionType === 'GMS' ? 'GMS Software' : formData.subscriptionType === 'App Only' ? 'App Listing' : 'Hybrid Partner'}</Tag></div>
                  <div><strong>Gym Name:</strong> {formData.gymName || 'Not specified'}</div>
                  <div><strong>Location:</strong> {formData.area}, {formData.city}</div>
                  <div><strong>GPS Coordinates:</strong> {Number(formData.lat).toFixed(4)}, {Number(formData.lng).toFixed(4)}</div>
                  <div><strong>Owner:</strong> {formData.ownerName} ({formData.phone})</div>
                  <div><strong>Day Pass Price:</strong> ₹{formData.singleSessionPrice} / session</div>
                  <div><strong>Facility Photos:</strong> {formData.galleryPhotos.length} photos ready</div>
                </div>
              </div>

              {/* Terms Checkbox */}
              <div>
                <Checkbox
                  checked={formData.agreedToTerms}
                  onChange={(e) => updateField('agreedToTerms', e.target.checked)}
                  style={{ fontSize: 13 }}
                >
                  I confirm that all provided details and facility photographs are accurate, and I agree to the{' '}
                  <a style={{ color: '#003882', fontWeight: 600 }}>GYMEZY Partner Terms & Policies</a>.
                </Checkbox>
                {renderFieldError('agreedToTerms')}
              </div>
            </div>
          )}

          {/* BOTTOM NAVIGATION ACTIONS */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 28,
              paddingTop: 20,
              borderTop: `1px solid ${isDarkMode ? '#27272a' : '#f1f5f9'}`,
            }}
          >
            {currentStep > 1 ? (
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={handlePrev}
                style={{
                  height: 44,
                  fontWeight: 600,
                  color: isDarkMode ? '#cbd5e1' : '#475569',
                  borderRadius: 8,
                }}
              >
                Back
              </Button>
            ) : (
              <div />
            )}

            {currentStep < 5 ? (
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                onClick={handleNext}
                style={{
                  height: 44,
                  padding: '0 24px',
                  backgroundColor: '#003882',
                  borderColor: '#003882',
                  fontWeight: 700,
                  borderRadius: 8,
                }}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="primary"
                loading={submitting}
                onClick={handleSubmitRegistration}
                style={{
                  height: 44,
                  padding: '0 28px',
                  backgroundColor: '#003882',
                  borderColor: '#003882',
                  fontWeight: 700,
                  borderRadius: 8,
                }}
              >
                Submit Gym for Approval
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Register;
