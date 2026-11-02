import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Upload,
  Typography,
  Space,
  message,
  Modal,
  Radio,
  Progress,
  Divider,
  Tag,
  InputNumber,
  Switch,
  Tooltip,
  Alert,
} from 'antd';
import {
  ShopOutlined,
  EnvironmentOutlined,
  PictureOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ExclamationCircleFilled,
  WarningOutlined,
  SaveOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  InboxOutlined,
  SafetyCertificateFilled,
  SafetyCertificateOutlined,
  DeleteOutlined,
  CheckOutlined,
  StarFilled,
  ThunderboltFilled,
  CompassOutlined,
  FileProtectOutlined,
  FilePdfOutlined,
  MobileOutlined,
  PlusOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addGym } from '../redux/slices/gymSlice';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/apiClient';
import { BANKS, getBankByName } from '../utils/bankData';

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;

const ONBOARDING_STEPS = [
  { id: 1, key: 'business', title: 'Business Info', icon: <ShopOutlined /> },
  { id: 2, key: 'location', title: 'Location & Geolocation', icon: <EnvironmentOutlined /> },
  { id: 3, key: 'facilities', title: 'Facilities & Photos', icon: <PictureOutlined /> },
  { id: 4, key: 'workouts', title: 'Workouts & Disciplines', icon: <ThunderboltFilled /> },
  { id: 5, key: 'payment', title: 'Payout & Tier', icon: <CreditCardOutlined /> },
  { id: 6, key: 'review', title: 'Review & Go Live', icon: <CheckCircleOutlined /> },
];

const STEP_REQUIRED_FIELDS = {
  1: [
    { field: 'gymName', label: 'Gym / Studio Name' },
    { field: 'ownerName', label: 'Owner / MD Name' },
    { field: 'phone', label: 'Mobile Number' },
    { field: 'email', label: 'Official Email' },
    { field: 'password', label: 'Owner Login Password' },
  ],
  2: [
    { field: 'address', label: 'Street Address / Door No.' },
    { field: 'area', label: 'Area / Locality' },
    { field: 'city', label: 'City' },
    { field: 'state', label: 'State' },
    { field: 'pincode', label: 'Pincode' },
  ],
  3: [
    { field: 'floorSpaceSqFt', label: 'Floor Space (sq. ft.)' },
    { field: 'maxFloorCapacity', label: 'Max Floor Capacity' },
    { field: 'logo', label: 'Gym Logo' },
    { field: 'facilities', label: 'Facilities (Min 1)' },
  ],
  4: [
    { field: 'workouts', label: 'Workouts / Disciplines (Min 1)' },
  ],
  5: [
    { field: 'accountHolder', label: 'Account Holder Name' },
    { field: 'accountNumber', label: 'Bank Account Number' },
    { field: 'ifscCode', label: 'Bank IFSC Code' },
  ],
};

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

const BADGE_OPTIONS = ['Trending', 'Top Rated', 'Verified SuperGym', 'Popular', 'Premium Club', '24/7 Access', 'CrossFit Ready'];

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

export const GymOnboarding = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDarkMode } = useTheme();
  const [currentStep, setCurrentStep] = useState(1);

  // Success Celebration Modal State
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [createdGymSummary, setCreatedGymSummary] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingGps, setIsFetchingGps] = useState(false);

  // Live Validation Errors and Touched State
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleGetAddressByGps = async () => {
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
            googleMapsUrl: prev.googleMapsUrl || `https://maps.google.com/?q=${latitude},${longitude}`,
            ...(parsed?.address ? { address: parsed.address } : {}),
            ...(parsed?.area ? { area: parsed.area } : {}),
            ...(parsed?.city ? { city: parsed.city } : {}),
            ...(parsed?.state ? { state: parsed.state } : {}),
            ...(parsed?.pincode ? { pincode: parsed.pincode } : {}),
          }));

          setErrors((prev) => {
            const nextErrors = { ...prev };
            if (parsed?.address) delete nextErrors.address;
            if (parsed?.area) delete nextErrors.area;
            if (parsed?.city) delete nextErrors.city;
            if (parsed?.state) delete nextErrors.state;
            if (parsed?.pincode) delete nextErrors.pincode;
            return nextErrors;
          });

          message.success(`GPS coordinates and address loaded (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        } catch {
          message.error('Failed to parse address from GPS');
        } finally {
          setIsFetchingGps(false);
        }
      },
      (geoError) => {
        setIsFetchingGps(false);
        message.error(geoError.message || 'Unable to retrieve location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Comprehensive Form State Data across steps (Clean Zero/Empty Defaults)
  const [formData, setFormData] = useState({
    // Step 1: Business
    gymName: '',
    tagline: '',
    businessType: 'Private Limited',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    yearEstablished: '2026',
    gstNumber: '',
    panNumber: '',
    branches: '1',
    gymId: '',
    businessCertificate: '',
    businessCertificateName: '',
    businessCertificateSize: '',
    businessCertificateType: '',
    gstCertificate: '',

    // Step 2: Location & Hours
    address: '',
    area: '',
    city: '',
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

    // Step 3: Facilities, Photos & Space
    floorSpaceSqFt: '',
    maxFloorCapacity: '',
    logo: '',
    coverPhoto: '',
    galleryPhotos: [],
    facilities: [],
    amenities: [],
    tags: [],
    badgeText: 'Verified',
    genderAllowed: 'Unisex',
    aboutText: '',

    // Step 4: Workouts & Trainers
    workouts: [],
    trainers: [],

    // Step 5: Sessions & Pricing
    singleSessionPrice: '',
    weeklyPassPrice: '',
    fiveSessionPrice: '',
    monthlyPrice: '',
    quarterlyPrice: '',
    halfYearlyPrice: '',
    annualPrice: '',
    slotDurationMinutes: 60,
    maxSlotCapacity: 25,
    slotsMorning: [],
    slotsEvening: [],

    // Step 6: Rules & Safety
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
    freeCancellationHours: 2,
    refundPercentage: 100,
    rescheduleAllowedCount: 2,

    // Step 7: Payout & Tier
    subscriptionType: 'Hybrid',
    commissionRate: 10,
    settlementCycle: 'Daily (T+1)',
    accountHolder: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    upiId: '',
    initialApprovalStatus: 'Approved',
  });

  // Calculate Progress Pct
  const progressPercent = Math.round((currentStep / 6) * 100);

  // Single Field Validator
  const validateField = (name, value, allData = formData) => {
    let error = null;
    const strVal = value !== undefined && value !== null ? String(value).trim() : '';

    switch (name) {
      // Step 1: Business
      case 'gymName':
        if (!strVal) error = 'Gym / Studio Name is required';
        else if (strVal.length < 3) error = 'Gym Name must be at least 3 characters';
        break;
      case 'ownerName':
        if (!strVal) error = 'Primary Owner / MD Name is required';
        else if (strVal.length < 2) error = 'Owner Name must be at least 2 characters';
        break;
      case 'phone':
        if (!strVal) {
          error = 'Contact Mobile Number is required';
        } else {
          const normalizedPhone = strVal.replace(/[\s()-]/g, '');
          const phoneDigits = /^(?:\+91|91)\d{10}$/.test(normalizedPhone)
            ? normalizedPhone.replace(/^(?:\+91|91)/, '')
            : normalizedPhone;
          if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
            error = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210)';
          }
        }
        break;
      case 'email':
        if (!strVal) {
          error = 'Official Email Address is required';
        } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(strVal)) {
          error = 'Please enter a valid email address (e.g. owner@gym.com)';
        }
        break;
      case 'password': {
        const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|[^\x20-\x7E]/u;
        if (!strVal) {
          error = 'Account Password is required';
        } else if (emojiRegex.test(strVal)) {
          error = 'Emojis and non-standard characters are not allowed in password';
        } else if (strVal.length < 8) {
          error = 'Password must be at least 8 characters';
        } else if (strVal.length > 16) {
          error = 'Password cannot exceed 16 characters (max 16)';
        } else if (!/[A-Z]/.test(strVal)) {
          error = 'Password must contain at least 1 uppercase letter (A-Z)';
        } else if (!/\d/.test(strVal)) {
          error = 'Password must contain at least 1 number (0-9)';
        } else if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(strVal)) {
          error = 'Password must contain at least 1 symbol / special character';
        }
        break;
      }
      case 'gstNumber':
        if (strVal && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(strVal)) {
          error = 'Invalid GSTIN format (e.g. 33AAAAA0000A1Z5)';
        }
        break;
      case 'panNumber':
        if (strVal && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(strVal)) {
          error = 'Invalid PAN format (e.g. ABCDE1234F)';
        }
        break;

      // Step 2: Location & Geolocation
      case 'address':
        if (!strVal) error = 'Street Address is required';
        else if (strVal.length < 5) error = 'Address must be at least 5 characters';
        break;
      case 'area':
        if (!strVal) error = 'Area / Locality is required';
        break;
      case 'city':
        if (!strVal) error = 'City is required';
        break;
      case 'state':
        if (!strVal) error = 'State is required';
        break;
      case 'pincode':
        if (!strVal) {
          error = 'Pincode is required';
        } else if (!/^[1-9][0-9]{5}$/.test(strVal)) {
          error = 'Enter a valid 6-digit postal pincode (e.g. 600040)';
        }
        break;

      // Step 3: Facilities, Photos & Space
      case 'floorSpaceSqFt':
        if (!value || Number(value) <= 0) error = 'Floor space (sq. ft.) is required and must be > 0';
        break;
      case 'maxFloorCapacity':
        if (!value || Number(value) <= 0) error = 'Max floor capacity is required and must be > 0';
        break;
      case 'logo':
      case 'coverPhoto':
        if (!strVal) error = 'Gym brand logo is required (upload image or provide URL)';
        break;
      case 'facilities':
        if (!Array.isArray(value) || value.length === 0) error = 'Please select at least 1 facility';
        break;

      // Step 4: Services & Workouts
      case 'workouts':
        if (!Array.isArray(value) || value.length === 0) error = 'Please select at least 1 fitness discipline';
        break;

      // Step 5: Payout & Subscription
      case 'accountHolder':
        if (!strVal) error = 'Bank account holder name is required';
        break;
      case 'accountNumber':
        if (!strVal) {
          error = 'Bank account number is required';
        } else if (!/^\d{9,18}$/.test(strVal)) {
          error = 'Enter a valid bank account number (9 to 18 digits)';
        }
        break;
      case 'ifscCode':
        if (!strVal) {
          error = 'IFSC code is required';
        } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(strVal)) {
          error = 'Enter a valid 11-character IFSC code (e.g. HDFC0001234)';
        }
        break;

      default:
        break;
    }

    return error;
  };

  // Live Field Change Handler
  const handleFieldChange = (name, value) => {
    const updatedData = { ...formData, [name]: value };
    setFormData(updatedData);
    setTouched((prev) => ({ ...prev, [name]: true }));

    const fieldErr = validateField(name, value, updatedData);
    setErrors((prev) => {
      const next = { ...prev };
      if (fieldErr) {
        next[name] = fieldErr;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  const handleFieldsChange = (changes) => {
    const updatedData = { ...formData, ...changes };
    setFormData(updatedData);

    Object.entries(changes).forEach(([name, value]) => {
      setTouched((prev) => ({ ...prev, [name]: true }));

      const fieldErr = validateField(name, value, updatedData);
      setErrors((prev) => {
        const next = { ...prev };
        if (fieldErr) {
          next[name] = fieldErr;
        } else {
          delete next[name];
        }
        return next;
      });
    });
  };

  // Field Blur Handler
  const handleFieldBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const fieldErr = validateField(name, formData[name], formData);
    setErrors((prev) => {
      const next = { ...prev };
      if (fieldErr) {
        next[name] = fieldErr;
      } else {
        delete next[name];
      }
      return next;
    });
  };

  // Step Status Inspector
  const getStepValidationStatus = (stepId, currentFormData = formData) => {
    const fields = STEP_REQUIRED_FIELDS[stepId] || [];
    const missing = [];

    for (const { field, label } of fields) {
      const err = validateField(field, currentFormData[field], currentFormData);
      if (err) {
        missing.push({ field, label, error: err });
      }
    }

    return {
      isValid: missing.length === 0,
      missingCount: missing.length,
      missingFields: missing,
    };
  };

  // Step Validator on Next
  const validateStep = (stepNumber) => {
    const fields = STEP_REQUIRED_FIELDS[stepNumber] || [];
    const newErrors = {};
    const newTouched = { ...touched };
    let isValid = true;

    for (const { field } of fields) {
      newTouched[field] = true;
      const err = validateField(field, formData[field], formData);
      if (err) {
        newErrors[field] = err;
        isValid = false;
      }
    }

    setTouched(newTouched);
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return { isValid, errors: newErrors };
  };

  // Global Check Across All 5 Data Steps
  const getAllStepsValidationStatus = () => {
    const statusMap = {};
    let totalMissing = 0;
    for (let s = 1; s <= 5; s++) {
      const status = getStepValidationStatus(s);
      statusMap[s] = status;
      totalMissing += status.missingCount;
    }
    return {
      statusMap,
      totalMissing,
      isAllValid: totalMissing === 0,
    };
  };

  // Helper to render live error feedback underneath inputs
  const renderFieldError = (fieldName) => {
    if (touched[fieldName] && errors[fieldName]) {
      return (
        <div
          style={{
            color: '#ef4444',
            fontSize: 12,
            marginTop: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 600,
            lineHeight: 1.3,
          }}
        >
          <CloseCircleFilled style={{ color: '#ef4444', fontSize: 13, flexShrink: 0 }} />
          <span>{errors[fieldName]}</span>
        </div>
      );
    }
    return null;
  };

  // Helper to render success checkmark when valid
  const renderFieldSuccess = (fieldName) => {
    const val = formData[fieldName];
    const isPopulated = Array.isArray(val) ? val.length > 0 : Boolean(val);
    if (touched[fieldName] && !errors[fieldName] && isPopulated) {
      return (
        <Tooltip title="Valid entry">
          <CheckCircleFilled style={{ color: '#16a34a', marginLeft: 6, fontSize: 13 }} />
        </Tooltip>
      );
    }
    return null;
  };

  // Handle Save & Next with Step Live Validation
  const handleSaveAndNext = () => {
    const { isValid, errors: stepErrors } = validateStep(currentStep);
    if (!isValid) {
      const errorCount = Object.keys(stepErrors).length;
      message.error(
        `Please fix the ${errorCount} required field${errorCount > 1 ? 's' : ''} in Step ${currentStep} before proceeding.`
      );
      return;
    }

    if (currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
      message.success(`Step ${currentStep} verified & saved!`);
    } else {
      handleFinalPublish();
    }
  };

  // Handle Final Publish with Platform Validation
  const handleFinalPublish = async () => {
    for (let step = 1; step <= 5; step++) {
      const { isValid, missingFields } = getStepValidationStatus(step);
      if (!isValid) {
        validateStep(step);
        message.error(`Step ${step} has incomplete fields (${missingFields.map((f) => f.label).join(', ')}). Redirecting...`);
        setCurrentStep(step);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const newGymPayload = {
        id: formData.gymId || `GYM-${Math.floor(1000 + Math.random() * 9000)}`,
        name: formData.gymName,
        gymName: formData.gymName,
        tagline: formData.tagline,
        businessType: formData.businessType,
        ownerName: formData.ownerName,
        phone: formData.phone.startsWith('+91') ? formData.phone : `+91 ${formData.phone}`,
        email: formData.email,
        password: formData.password,
        location: `${formData.area || formData.city}, ${formData.city}`,
        fullAddress: formData.address,
        address: formData.address,
        area: formData.area,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,
        landmark: formData.landmark,
        lat: formData.lat,
        lng: formData.lng,
        geoCoordinates: { lat: formData.lat, lng: formData.lng },
        googleMapsUrl: formData.googleMapsUrl,
        floorSpaceSqFt: Number(formData.floorSpaceSqFt) || 0,
        maxFloorCapacity: Number(formData.maxFloorCapacity) || 0,
        genderAllowed: formData.genderAllowed || 'Unisex',
        gstNumber: formData.gstNumber,
        panNumber: formData.panNumber,
        branches: formData.branches,
        openingHours: {
          mode: formData.timingMode,
          weekdayOpen: formData.weekdayOpen,
          weekdayClose: formData.weekdayClose,
          weekendOpen: formData.weekendOpen,
          weekendClose: formData.weekendClose,
          morningOpen: formData.morningOpen,
          morningClose: formData.morningClose,
          eveningOpen: formData.eveningOpen,
          eveningClose: formData.eveningClose,
          isSplitShift: formData.timingMode === 'SPLIT_SHIFT',
          isOpenHolidays: formData.isOpenHolidays !== false,
          is24Hours: formData.timingMode === '24_HOURS',
        },
        slotDurationMinutes: Number(formData.slotDurationMinutes) || 60,
        maxSlotCapacity: Number(formData.maxSlotCapacity) || 25,
        slotsMorning: formData.slotsMorning,
        slotsEvening: formData.slotsEvening,
        singleSessionPrice: Number(formData.singleSessionPrice) || 199,
        rating: 4.9,
        reviewsCount: 0,
        membersCount: 0,
        monthlyRevenue: '₹ 0',
        status: formData.initialApprovalStatus === 'Approved' ? 'Active' : 'Pending',
        approvalStatus: formData.initialApprovalStatus || 'Approved',
        subscriptionType: formData.subscriptionType || 'Hybrid',
        subscriptionStatus: 'Active',
        commissionRate: Number(formData.commissionRate) || 10,
        settlementCycle: formData.settlementCycle || 'Daily (T+1)',
        logo: formData.logo || formData.coverPhoto,
        coverPhoto: formData.logo || formData.coverPhoto,
        image: formData.logo || formData.coverPhoto,
        galleryPhotos: formData.galleryPhotos,
        tags: formData.tags,
        badgeText: formData.badgeText,
        aboutText: formData.aboutText,
        facilities: formData.facilities,
        amenities: formData.amenities,
        workouts: formData.workouts,
        trainers: formData.trainers,
        pricingPlans: {
          singleSession: Number(formData.singleSessionPrice) || 199,
          weeklyPass: Number(formData.weeklyPassPrice) || 799,
          fiveSessions: Number(formData.fiveSessionPrice) || 899,
          monthly: Number(formData.monthlyPrice) || 1999,
          quarterly: Number(formData.quarterlyPrice) || 4999,
          halfYearly: Number(formData.halfYearlyPrice) || 8999,
          annual: Number(formData.annualPrice) || 14999,
        },
        rules: formData.rules,
        safetyMeasures: formData.safetyMeasures,
        freeCancellationHours: Number(formData.freeCancellationHours) || 2,
        refundPercentage: Number(formData.refundPercentage) || 100,
        rescheduleAllowedCount: Number(formData.rescheduleAllowedCount) || 2,
        bankDetails: {
          accountHolder: formData.accountHolder,
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
          upiId: formData.upiId,
        },
        documents: {
          gstCertificate: formData.gstCertificate || formData.businessCertificate || '',
          panCard: formData.panCard || '',
          tradeLicense: formData.tradeLicense || '',
          bankProof: formData.bankProof || '',
        },
      };

      const response = await apiClient.post('/gyms/onboard', newGymPayload);
      const createdGym = response.data?.data?.gym || newGymPayload;

      dispatch(addGym(createdGym));
      setCreatedGymSummary(createdGym);
      setIsSuccessModalOpen(true);
      message.success(`Gym "${formData.gymName}" onboarded and live on GYMEZY!`);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to onboard gym partner.';
      message.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Save & Exit
  const handleSaveAndExit = () => {
    message.info('Onboarding draft saved. You can resume anytime.');
    navigate('/admin/gyms');
  };

  const validationSummary = getAllStepsValidationStatus();

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 40 }}>
      {/* 1. TOP TITLE & ACTIONS BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: isDarkMode ? '#ffffff' : '#0f172a',
              margin: 0,
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            New Gym Partner Onboarding
            {validationSummary.isAllValid ? (
              <Tag color="success" style={{ fontSize: 12, fontWeight: 700, borderRadius: 12, padding: '2px 10px' }}>
                <CheckCircleFilled /> Ready to Launch
              </Tag>
            ) : (
              <Tag color="warning" style={{ fontSize: 12, fontWeight: 700, borderRadius: 12, padding: '2px 10px' }}>
                <WarningOutlined /> Live Validation Active
              </Tag>
            )}
          </h1>
          <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13 }}>
            Configure partner business details, location, facilities, trainers, and settlement parameters with live validation.
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveAndExit}
            style={{
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              borderColor: isDarkMode ? '#334155' : '#e2e8f0',
            }}
          >
            Save Draft & Exit
          </Button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 20,
              backgroundColor: isDarkMode ? '#141414' : '#f1f5f9',
              fontSize: 13,
              fontWeight: 700,
              color: isDarkMode ? '#ffffff' : '#0f172a',
              border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: '#4338ca',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              GYM
            </div>
            <span>{formData.gymName || 'New Gym Partner'}</span>
          </div>
        </div>
      </div>

      {/* 2. TOP HORIZONTAL STEPPER (8 ICONS) */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 24,
        }}
        styles={{ body: { padding: '16px 12px' } }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            overflowX: 'auto',
            gap: 8,
          }}
        >
          {ONBOARDING_STEPS.map((step) => {
            const isActive = step.id === currentStep;
            const stepStatus = getStepValidationStatus(step.id);
            const isCompleted = step.id < currentStep && stepStatus.isValid;
            const hasError = step.id < currentStep && !stepStatus.isValid;

            return (
              <div
                key={step.key}
                onClick={() => setCurrentStep(step.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 105,
                  cursor: 'pointer',
                  position: 'relative',
                  padding: '6px 8px',
                  borderRadius: 8,
                  backgroundColor: isActive ? (isDarkMode ? 'rgba(79, 70, 229, 0.15)' : '#eef2ff') : 'transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Step Circle */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: isActive
                      ? '#4338ca'
                      : isCompleted
                        ? '#16a34a'
                        : hasError
                          ? '#ef4444'
                          : isDarkMode
                            ? '#1e293b'
                            : '#f1f5f9',
                    color: isActive || isCompleted || hasError ? '#ffffff' : isDarkMode ? '#64748b' : '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                    border: isActive
                      ? '3px solid rgba(79, 70, 229, 0.35)'
                      : isCompleted
                        ? '3px solid rgba(22, 163, 74, 0.35)'
                        : hasError
                          ? '3px solid rgba(239, 68, 68, 0.35)'
                          : 'none',
                    transition: 'all 0.2s ease',
                    marginBottom: 6,
                  }}
                >
                  {isCompleted ? (
                    <CheckOutlined style={{ fontSize: 12 }} />
                  ) : hasError ? (
                    <ExclamationCircleFilled style={{ fontSize: 12 }} />
                  ) : (
                    step.id
                  )}
                </div>

                {/* Step Label */}
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: isActive ? 800 : 600,
                    color: isActive
                      ? '#4338ca'
                      : isCompleted
                        ? isDarkMode ? '#e2e8f0' : '#1e293b'
                        : hasError
                          ? '#ef4444'
                          : isDarkMode ? '#64748b' : '#94a3b8',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.title}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 3. MAIN FORM BODY: LEFT PROGRESS SIDEBAR + RIGHT FORM CONTENT */}
      <Row gutter={[24, 24]}>
        {/* Left Column: Onboarding Progress Card */}
        <Col xs={24} lg={7}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            styles={{ body: { padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' } }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b', textTransform: 'uppercase' }}>
                Onboarding Progress
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', margin: '4px 0 10px 0' }}>
                Step {currentStep} of 6
              </div>

              {/* Progress Bar */}
              <Progress
                percent={progressPercent}
                strokeColor="#4338ca"
                showInfo={false}
                size="small"
                style={{ marginBottom: 4 }}
              />
              <div style={{ fontSize: 12, fontWeight: 700, color: '#4338ca', marginBottom: 20 }}>
                {progressPercent}% Setup Completed
              </div>

              {/* Vertical Steps Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ONBOARDING_STEPS.map((step) => {
                  const isActive = step.id === currentStep;
                  const stepStatus = getStepValidationStatus(step.id);
                  const isCompleted = stepStatus.isValid;
                  const hasErrors = !stepStatus.isValid && Object.keys(touched).some((k) => (STEP_REQUIRED_FIELDS[step.id] || []).some((f) => f.field === k));

                  return (
                    <div
                      key={step.key}
                      onClick={() => setCurrentStep(step.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: isActive
                          ? isDarkMode ? 'rgba(79, 70, 229, 0.2)' : '#ede9fe'
                          : 'transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            backgroundColor: isActive
                              ? '#4338ca'
                              : isCompleted
                                ? '#16a34a'
                                : hasErrors
                                  ? '#ef4444'
                                  : isDarkMode
                                    ? '#1e293b'
                                    : '#e2e8f0',
                            color: isActive || isCompleted || hasErrors ? '#ffffff' : '#64748b',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {isCompleted ? <CheckOutlined style={{ fontSize: 10 }} /> : step.id}
                        </div>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: isActive ? 800 : 600,
                            color: isActive
                              ? '#4338ca'
                              : isCompleted
                                ? isDarkMode ? '#e2e8f0' : '#334155'
                                : isDarkMode ? '#64748b' : '#94a3b8',
                          }}
                        >
                          {step.title}
                        </span>
                      </div>

                      {/* Step Validation Tag */}
                      {step.id < 8 && (
                        <div>
                          {isCompleted ? (
                            <Tag color="success" style={{ margin: 0, fontSize: 10, borderRadius: 10, fontWeight: 700 }}>
                              Ready
                            </Tag>
                          ) : stepStatus.missingCount > 0 && (
                            <Tag color="default" style={{ margin: 0, fontSize: 10, borderRadius: 10 }}>
                              {stepStatus.missingCount} pending
                            </Tag>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Summary Snapshot */}
            <div
              style={{
                marginTop: 24,
                padding: '14px',
                borderRadius: 10,
                backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.1)' : '#f5f3ff',
                border: `1px solid ${isDarkMode ? 'rgba(79, 70, 229, 0.25)' : '#e0e7ff'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <SafetyCertificateFilled style={{ fontSize: 16, color: '#4338ca' }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: isDarkMode ? '#e0e7ff' : '#3730a3' }}>
                  GYMEZY Verification Standards
                </span>
              </div>
            </div>
          </Card>
        </Col>

        {/* Right Column: Dynamic Step Content */}
        <Col xs={24} lg={17}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              marginBottom: 20,
            }}
            styles={{ body: { padding: '28px 32px' } }}
          >
            {/* ========================================================================= */}
            {/* STEP 1: BUSINESS INFORMATION */}
            {/* ========================================================================= */}
            {currentStep === 1 && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    1. Business & Legal Information
                  </div>
                  <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                    Enter registered gym brand name, legal entity, and contact credentials
                  </div>
                </div>

                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Gym / Studio Name * {renderFieldSuccess('gymName')}
                    </div>
                    <Input
                      value={formData.gymName}
                      status={touched.gymName && errors.gymName ? 'error' : ''}
                      onChange={(e) => handleFieldChange('gymName', e.target.value)}
                      onBlur={() => handleFieldBlur('gymName')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('gymName')}
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Tagline / Motto
                    </div>
                    <Input
                      value={formData.tagline}
                      onChange={(e) => handleFieldChange('tagline', e.target.value)}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Business Structure * {renderFieldSuccess('businessType')}
                    </div>
                    <Select
                      value={formData.businessType}
                      onChange={(v) => handleFieldChange('businessType', v)}
                      style={{ width: '100%', height: 40 }}
                    >
                      <Option value="Private Limited">Private Limited</Option>
                      <Option value="Partnership">Partnership</Option>
                      <Option value="Sole Proprietorship">Sole Proprietorship</Option>
                      <Option value="LLP">LLP</Option>
                      <Option value="Trust / Society">Trust / Society</Option>
                    </Select>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Owner / MD Full Name * {renderFieldSuccess('ownerName')}
                    </div>
                    <Input
                      value={formData.ownerName}
                      status={touched.ownerName && errors.ownerName ? 'error' : ''}
                      onChange={(e) => handleFieldChange('ownerName', e.target.value)}
                      onBlur={() => handleFieldBlur('ownerName')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('ownerName')}
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Owner Mobile Number * {renderFieldSuccess('phone')}
                    </div>
                    <Input
                      addonBefore="+91"
                      value={formData.phone}
                      maxLength={12}
                      status={touched.phone && errors.phone ? 'error' : ''}
                      onChange={(e) => {
                        let digits = e.target.value.replace(/\D/g, '');
                        if (digits.length === 12 && digits.startsWith('91')) {
                          digits = digits.slice(2);
                        } else if (digits.length === 11 && digits.startsWith('0')) {
                          digits = digits.slice(1);
                        }
                        handleFieldChange('phone', digits.slice(0, 10));
                      }}
                      onBlur={() => handleFieldBlur('phone')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('phone')}
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Official Email Address * {renderFieldSuccess('email')}
                    </div>
                    <Input
                      value={formData.email}
                      status={touched.email && errors.email ? 'error' : ''}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      onBlur={() => handleFieldBlur('email')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('email')}
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Create Password * {renderFieldSuccess('password')}
                    </div>
                    <Input.Password
                      value={formData.password}
                      maxLength={16}
                      status={touched.password && errors.password ? 'error' : ''}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      onBlur={() => handleFieldBlur('password')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    <Text
                      type="secondary"
                      style={{ display: 'block', fontSize: 11, marginTop: 5, lineHeight: 1.5 }}
                    >
                      Use 8-16 characters with 1 uppercase letter, 1 number, and 1 symbol.
                    </Text>
                    {renderFieldError('password')}
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      GST Number (Optional) {renderFieldSuccess('gstNumber')}
                    </div>
                    <Input
                      value={formData.gstNumber}
                      status={touched.gstNumber && errors.gstNumber ? 'error' : ''}
                      onChange={(e) => handleFieldChange('gstNumber', e.target.value)}
                      onBlur={() => handleFieldBlur('gstNumber')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('gstNumber')}
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      PAN Number (Optional) {renderFieldSuccess('panNumber')}
                    </div>
                    <Input
                      value={formData.panNumber}
                      status={touched.panNumber && errors.panNumber ? 'error' : ''}
                      onChange={(e) => handleFieldChange('panNumber', e.target.value)}
                      onBlur={() => handleFieldBlur('panNumber')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('panNumber')}
                  </Col>

                  <Col xs={24} md={8}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Number of Branches
                    </div>
                    <Input
                      value={formData.branches}
                      onChange={(e) => handleFieldChange('branches', e.target.value)}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                  </Col>
                </Row>

                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                    Business License / Registration Document (Optional)
                  </div>

                  {!formData.businessCertificate ? (
                    <Dragger
                      style={{
                        padding: '24px',
                        background: isDarkMode ? '#141414' : '#fafafa',
                        borderColor: isDarkMode ? '#333333' : '#d9d9d9',
                        borderRadius: 8,
                      }}
                      showUploadList={false}
                      beforeUpload={async (file) => {
                        try {
                          const base64 = await fileToBase64(file);
                          const sizeStr = file.size > 1024 * 1024
                            ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                            : Math.round(file.size / 1024) + ' KB';
                          setFormData((prev) => ({
                            ...prev,
                            businessCertificate: base64,
                            gstCertificate: base64,
                            businessCertificateName: file.name,
                            businessCertificateSize: sizeStr,
                            businessCertificateType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
                          }));
                          message.success(`Attached ${file.name}`);
                        } catch {
                          message.error('Failed to read document');
                        }
                        return false;
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        <FilePdfOutlined style={{ color: '#4338ca', fontSize: 28 }} />
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a', margin: '6px 0 0 0' }}>
                        Click or drag document to upload
                      </p>
                      <p style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', margin: 0 }}>
                        PDF, PNG, or JPG up to 10MB
                      </p>
                    </Dragger>
                  ) : (
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                        border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`,
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
                            backgroundColor: (formData.businessCertificateType?.includes('pdf') || formData.businessCertificateName?.toLowerCase().endsWith('.pdf')) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                            color: (formData.businessCertificateType?.includes('pdf') || formData.businessCertificateName?.toLowerCase().endsWith('.pdf')) ? '#ef4444' : '#3b82f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {(formData.businessCertificateType?.includes('pdf') || formData.businessCertificateName?.toLowerCase().endsWith('.pdf')) ? (
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
                          <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 1 }}>
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
                            gstCertificate: '',
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
              </div>
            )}

            {/* ========================================================================= */}
            {/* ========================================================================= */}
            {/* STEP 2: LOCATION, GEOLOCATION & OPERATING HOURS */}
            {/* ========================================================================= */}
            {currentStep === 2 && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    2. Location, Geolocation & Operating Hours
                  </div>
                  <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                    Pinpoint your exact facility address with live geolocation and define regular operating hours.
                  </div>
                </div>

                <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 16 }}>
                  Facility Address & Geolocation
                </div>

                <Row gutter={[16, 16]}>
                  <Col xs={24}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CompassOutlined style={{ color: '#4338ca' }} /> Google Maps Share Link (Auto-extracts GPS)
                      </span>
                      {formData.lat && formData.lng && (
                        <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                          GPS: {formData.lat}, {formData.lng}
                        </span>
                      )}
                    </div>
                    <Input
                      value={formData.googleMapsUrl}
                      onChange={async (e) => {
                        const url = e.target.value;
                        const coords = extractCoordinatesFromMapsUrl(url);
                        if (coords) {
                          setFormData((prev) => ({
                            ...prev,
                            googleMapsUrl: url,
                            lat: coords.lat,
                            lng: coords.lng,
                          }));
                          message.success(`GPS coordinates extracted: ${coords.lat}, ${coords.lng}`);

                          const parsed = await reverseGeocodeCoordinates(coords.lat, coords.lng);
                          if (parsed) {
                            setFormData((prev) => ({
                              ...prev,
                              address: prev.address || parsed.address,
                              area: prev.area || parsed.area,
                              city: prev.city || parsed.city,
                              state: prev.state || parsed.state,
                              pincode: prev.pincode || parsed.pincode,
                            }));
                            setErrors((prev) => {
                              const next = { ...prev };
                              if (parsed.address) delete next.address;
                              if (parsed.area) delete next.area;
                              if (parsed.city) delete next.city;
                              if (parsed.state) delete next.state;
                              if (parsed.pincode) delete next.pincode;
                              return next;
                            });
                          }
                        } else {
                          handleFieldChange('googleMapsUrl', url);
                        }
                      }}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                  </Col>

                  <Col xs={24}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                        color: isDarkMode ? '#cccccc' : '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>Street Address / Door No. * {renderFieldSuccess('address')}</span>
                      <Button
                        type="link"
                        size="small"
                        icon={<EnvironmentOutlined />}
                        loading={isFetchingGps}
                        onClick={handleGetAddressByGps}
                        style={{
                          padding: 0,
                          height: 'auto',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#4338ca',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Get by GPS
                      </Button>
                    </div>
                    <Input
                      value={formData.address}
                      status={touched.address && errors.address ? 'error' : ''}
                      onChange={(e) => handleFieldChange('address', e.target.value)}
                      onBlur={() => handleFieldBlur('address')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('address')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Area / Locality * {renderFieldSuccess('area')}
                    </div>
                    <Input
                      value={formData.area}
                      status={touched.area && errors.area ? 'error' : ''}
                      onChange={(e) => handleFieldChange('area', e.target.value)}
                      onBlur={() => handleFieldBlur('area')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('area')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      City * {renderFieldSuccess('city')}
                    </div>
                    <Input
                      value={formData.city}
                      status={touched.city && errors.city ? 'error' : ''}
                      onChange={(e) => handleFieldChange('city', e.target.value)}
                      onBlur={() => handleFieldBlur('city')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('city')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      State * {renderFieldSuccess('state')}
                    </div>
                    <Input
                      value={formData.state}
                      status={touched.state && errors.state ? 'error' : ''}
                      onChange={(e) => handleFieldChange('state', e.target.value)}
                      onBlur={() => handleFieldBlur('state')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('state')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Pincode * {renderFieldSuccess('pincode')}
                    </div>
                    <Input
                      value={formData.pincode}
                      status={touched.pincode && errors.pincode ? 'error' : ''}
                      onChange={(e) => handleFieldChange('pincode', e.target.value)}
                      onBlur={() => handleFieldBlur('pincode')}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                    {renderFieldError('pincode')}
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Landmark (Optional)
                    </div>
                    <Input
                      value={formData.landmark}
                      onChange={(e) => handleFieldChange('landmark', e.target.value)}
                      style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      GPS Latitude
                    </div>
                    <InputNumber
                      value={formData.lat}
                      onChange={(v) => handleFieldChange('lat', v)}
                      style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      GPS Longitude
                    </div>
                    <InputNumber
                      value={formData.lng}
                      onChange={(v) => handleFieldChange('lng', v)}
                      style={{ width: '100%', height: 40, borderRadius: 'var(--radius-base)' }}
                    />
                  </Col>
                </Row>

                <Divider style={{ margin: '24px 0 20px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Facility Operating Hours & Shift Architecture
                  </div>
                  <Tag color={formData.timingMode === '24_HOURS' ? 'green' : (formData.timingMode === 'SPLIT_SHIFT' ? 'purple' : 'blue')}>
                    {formData.timingMode === '24_HOURS' ? '24/7 Mode' : (formData.timingMode === 'SPLIT_SHIFT' ? 'Split Shift' : 'Regular Mode')}
                  </Tag>
                </div>

                {/* Timing Mode Selector */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: isDarkMode ? '#cccccc' : '#334155' }}>
                    Select Operational Timing Model
                  </div>
                  <Radio.Group
                    value={formData.timingMode}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleFieldChange('timingMode', val);
                      handleFieldChange('is24Hours', val === '24_HOURS');
                      handleFieldChange('isSplitShift', val === 'SPLIT_SHIFT');
                    }}
                    buttonStyle="solid"
                    style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}
                  >
                    <Radio.Button value="REGULAR" style={{ borderRadius: 8, height: 38, lineHeight: '36px' }}>
                      Single Shift (Continuous 12h/16h)
                    </Radio.Button>
                    <Radio.Button value="SPLIT_SHIFT" style={{ borderRadius: 8, height: 38, lineHeight: '36px' }}>
                      Split Shift (Morning + Evening)
                    </Radio.Button>
                    <Radio.Button value="24_HOURS" style={{ borderRadius: 8, height: 38, lineHeight: '36px' }}>
                      24 Hours (Round-the-clock)
                    </Radio.Button>
                  </Radio.Group>
                </div>

                {/* Mode-Specific Time Pickers */}
                {formData.timingMode === 'REGULAR' && (
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                        Weekday Open (Mon – Fri)
                      </div>
                      <Input
                        value={formData.weekdayOpen}
                        onChange={(e) => handleFieldChange('weekdayOpen', e.target.value)}
                        placeholder="05:30 AM"
                        style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                        Weekday Close (Mon – Fri)
                      </div>
                      <Input
                        value={formData.weekdayClose}
                        onChange={(e) => handleFieldChange('weekdayClose', e.target.value)}
                        placeholder="10:30 PM"
                        style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                        Weekend Open (Sat – Sun)
                      </div>
                      <Input
                        value={formData.weekendOpen}
                        onChange={(e) => handleFieldChange('weekendOpen', e.target.value)}
                        placeholder="06:00 AM"
                        style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                        Weekend Close (Sat – Sun)
                      </div>
                      <Input
                        value={formData.weekendClose}
                        onChange={(e) => handleFieldChange('weekendClose', e.target.value)}
                        placeholder="09:00 PM"
                        style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                      />
                    </Col>
                  </Row>
                )}

                {formData.timingMode === 'SPLIT_SHIFT' && (
                  <div>
                    <div style={{ padding: '10px 14px', borderRadius: 8, backgroundColor: isDarkMode ? 'rgba(168,85,247,0.1)' : '#faf5ff', border: '1px solid #d8b4fe', marginBottom: 14, fontSize: 13, color: isDarkMode ? '#e9d5ff' : '#6b21a8' }}>
                      <strong>Split Shift Model:</strong> Common for fitness studios in India. Gym opens for early morning routines, closes during the afternoon for sanitization/break, and reopens for evening workouts. Bookable slots are generated only during active shifts.
                    </div>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={6}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                          Morning Shift Open
                        </div>
                        <Input
                          value={formData.morningOpen}
                          onChange={(e) => handleFieldChange('morningOpen', e.target.value)}
                          placeholder="05:30 AM"
                          style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                          Morning Shift Close
                        </div>
                        <Input
                          value={formData.morningClose}
                          onChange={(e) => handleFieldChange('morningClose', e.target.value)}
                          placeholder="11:30 AM"
                          style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                          Evening Shift Open
                        </div>
                        <Input
                          value={formData.eveningOpen}
                          onChange={(e) => handleFieldChange('eveningOpen', e.target.value)}
                          placeholder="04:30 PM"
                          style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                          Evening Shift Close
                        </div>
                        <Input
                          value={formData.eveningClose}
                          onChange={(e) => handleFieldChange('eveningClose', e.target.value)}
                          placeholder="10:30 PM"
                          style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                        />
                      </Col>
                    </Row>
                  </div>
                )}

                {formData.timingMode === '24_HOURS' && (
                  <div style={{ padding: '14px 18px', borderRadius: 8, backgroundColor: isDarkMode ? 'rgba(34,197,94,0.1)' : '#f0fdf4', border: '1px solid #86efac', marginBottom: 14, fontSize: 13, color: isDarkMode ? '#86efac' : '#166534' }}>
                    <strong>24/7 Round-the-clock Facility:</strong> This gym operates continuously 24 hours a day, 7 days a week. Dynamic customer booking slots will be available around the clock.
                  </div>
                )}

                <Row gutter={[16, 16]} style={{ marginTop: 14 }}>
                  <Col xs={24} md={12}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Switch
                        checked={formData.isOpenHolidays}
                        onChange={(chk) => handleFieldChange('isOpenHolidays', chk)}
                      />
                      <span style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                        Facility Remains Open on Public Holidays
                      </span>
                    </div>
                  </Col>
                </Row>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 3: FACILITIES, AMENITIES & PHOTOS */}
            {/* ========================================================================= */}
            {currentStep === 3 && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    3. Facilities, Amenities & Floor Space
                  </div>
                  <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                    Showcase gym infrastructure, floor capacity, and high-resolution photo gallery
                  </div>
                </div>

                <Row gutter={[16, 16]}>
                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Floor Space (sq. ft.) * {renderFieldSuccess('floorSpaceSqFt')}
                    </div>
                    <InputNumber
                      value={formData.floorSpaceSqFt}
                      status={touched.floorSpaceSqFt && errors.floorSpaceSqFt ? 'error' : ''}
                      onChange={(v) => handleFieldChange('floorSpaceSqFt', v)}
                      onBlur={() => handleFieldBlur('floorSpaceSqFt')}
                      style={{ width: '100%', height: 40 }}
                    />
                    {renderFieldError('floorSpaceSqFt')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Max Safe Floor Capacity (Athletes) * {renderFieldSuccess('maxFloorCapacity')}
                    </div>
                    <InputNumber
                      value={formData.maxFloorCapacity}
                      status={touched.maxFloorCapacity && errors.maxFloorCapacity ? 'error' : ''}
                      onChange={(v) => handleFieldChange('maxFloorCapacity', v)}
                      onBlur={() => handleFieldBlur('maxFloorCapacity')}
                      style={{ width: '100%', height: 40 }}
                    />
                    {renderFieldError('maxFloorCapacity')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Gender Policy
                    </div>
                    <Select
                      value={formData.genderAllowed}
                      onChange={(v) => handleFieldChange('genderAllowed', v)}
                      style={{ width: '100%', height: 40 }}
                    >
                      <Option value="Unisex">Unisex (All Welcome)</Option>
                      <Option value="Men Only">Men Only</Option>
                      <Option value="Women Only">Women Only</Option>
                    </Select>
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Highlight Badge Text
                    </div>
                    <Select
                      value={formData.badgeText}
                      onChange={(v) => handleFieldChange('badgeText', v)}
                      style={{ width: '100%', height: 40 }}
                    >
                      {BADGE_OPTIONS.map((b) => (
                        <Option key={b} value={b}>{b}</Option>
                      ))}
                    </Select>
                  </Col>

                  <Col xs={24}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Gym Logo * {renderFieldSuccess('logo')}
                    </div>

                    {!formData.logo && !formData.coverPhoto ? (
                      <div>
                        <Dragger
                          style={{
                            padding: '16px',
                            background: isDarkMode ? '#141414' : '#fafafa',
                            borderColor: touched.logo && errors.logo ? '#ef4444' : (isDarkMode ? '#333333' : '#d9d9d9'),
                            borderRadius: 8,
                          }}
                          showUploadList={false}
                          beforeUpload={async (file) => {
                            try {
                              const base64 = await fileToBase64(file);
                              handleFieldsChange({ logo: base64, coverPhoto: base64 });
                              message.success(`Gym logo "${file.name}" attached!`);
                            } catch {
                              message.error('Failed to read image file');
                            }
                            return false;
                          }}
                        >
                          <p style={{ margin: 0 }}>
                            <InboxOutlined style={{ color: '#4338ca', fontSize: 26 }} />
                          </p>
                          <p style={{ fontSize: 13, fontWeight: 700, margin: '6px 0 0 0', color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                            Click or drag & drop gym brand logo
                          </p>
                          <p style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', margin: '2px 0 0 0' }}>
                            Supports JPG, PNG or WebP images
                          </p>
                        </Dragger>
                        {renderFieldError('logo')}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          padding: 12,
                          borderRadius: 8,
                          border: isDarkMode ? '1px solid #333333' : '1px solid #e2e8f0',
                          backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                        }}
                      >
                        <div
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid #4338ca',
                            flexShrink: 0,
                            backgroundColor: isDarkMode ? '#1e1e1e' : '#edf4fe',
                          }}
                        >
                          <img
                            src={formData.logo || formData.coverPhoto}
                            alt="Logo Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                            Gym Brand Logo
                          </div>
                          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                            Logo uploaded and ready
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <Upload
                            showUploadList={false}
                            beforeUpload={async (file) => {
                              try {
                                const base64 = await fileToBase64(file);
                                handleFieldsChange({ logo: base64, coverPhoto: base64 });
                                message.success(`Gym logo updated with "${file.name}"!`);
                              } catch {
                                message.error('Failed to read image file');
                              }
                              return false;
                            }}
                          >
                            <Button size="small">Change</Button>
                          </Upload>
                          <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              handleFieldsChange({ logo: '', coverPhoto: '' });
                            }}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    )}
                  </Col>

                  <Col xs={24}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#cccccc' : '#334155' }}>
                        Facility & Equipment Photos
                      </div>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {(formData.galleryPhotos || []).length} photos uploaded
                      </span>
                    </div>
                    <p style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', margin: '0 0 10px 0' }}>
                      Upload clear photos of your workout floor, strength machines, cardio zones, and locker rooms.
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      <Upload
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={async (file) => {
                          try {
                            const b64 = await fileToBase64(file);
                            handleFieldChange('galleryPhotos', [...(formData.galleryPhotos || []), b64]);
                            message.success(`Facility photo "${file.name}" attached!`);
                          } catch {
                            message.error('Failed to read image file');
                          }
                          return false;
                        }}
                      >
                        <div
                          style={{
                            width: 120,
                            height: 100,
                            border: `1.5px dashed ${isDarkMode ? '#333333' : '#d9d9d9'}`,
                            borderRadius: 8,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            backgroundColor: isDarkMode ? '#141414' : '#fafafa',
                            gap: 6,
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#4338ca';
                            e.currentTarget.style.backgroundColor = isDarkMode ? '#1e1e1e' : '#f5f3ff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = isDarkMode ? '#333333' : '#d9d9d9';
                            e.currentTarget.style.backgroundColor = isDarkMode ? '#141414' : '#fafafa';
                          }}
                        >
                          <PlusOutlined style={{ fontSize: 20, color: '#4338ca' }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#4338ca' }}>Add Photo</span>
                        </div>
                      </Upload>

                      {(formData.galleryPhotos || []).map((photoSrc, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            width: 120,
                            height: 100,
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: isDarkMode ? '1px solid #333333' : '1px solid #e2e8f0',
                          }}
                        >
                          <img
                            src={photoSrc}
                            alt={`Facility ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              handleFieldChange(
                                'galleryPhotos',
                                (formData.galleryPhotos || []).filter((_, i) => i !== idx)
                              );
                            }}
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
                  </Col>

                  <Col xs={24}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Facilities Multi-Select (Available at Facility) * {renderFieldSuccess('facilities')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {FACILITY_OPTIONS.map((fac) => {
                        const selected = formData.facilities.includes(fac);
                        return (
                          <Tag.CheckableTag
                            key={fac}
                            checked={selected}
                            onChange={(checked) => {
                              const next = checked
                                ? [...formData.facilities, fac]
                                : formData.facilities.filter((f) => f !== fac);
                              handleFieldChange('facilities', next);
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 16,
                              fontSize: 13,
                              fontWeight: 600,
                              backgroundColor: selected ? '#4338ca' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                              color: selected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#334155'),
                              border: `1px solid ${selected ? '#4338ca' : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                            }}
                          >
                            {fac}
                          </Tag.CheckableTag>
                        );
                      })}
                    </div>
                    {renderFieldError('facilities')}
                  </Col>

                  <Col xs={24}>
                    <div style={{ fontSize: 12, fontWeight: 700, margin: '8px 0 8px 0', color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Amenities & Member Perks
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {AMENITY_OPTIONS.map((amen) => {
                        const selected = formData.amenities.includes(amen);
                        return (
                          <Tag.CheckableTag
                            key={amen}
                            checked={selected}
                            onChange={(checked) => {
                              const next = checked
                                ? [...formData.amenities, amen]
                                : formData.amenities.filter((a) => a !== amen);
                              handleFieldChange('amenities', next);
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 16,
                              fontSize: 13,
                              fontWeight: 600,
                              backgroundColor: selected ? '#16a34a' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                              color: selected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#334155'),
                              border: `1px solid ${selected ? '#16a34a' : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                            }}
                          >
                            {amen}
                          </Tag.CheckableTag>
                        );
                      })}
                    </div>
                  </Col>

                  <Col xs={24}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      About Gym Description / Facility Bio
                    </div>
                    <TextArea
                      rows={3}
                      value={formData.aboutText}
                      onChange={(e) => handleFieldChange('aboutText', e.target.value)}
                      placeholder="Write a compelling overview of what makes your fitness center unique..."
                    />
                  </Col>
                </Row>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 4: WORKOUTS, AMENITIES, RULES & SAFETY */}
            {/* ========================================================================= */}
            {currentStep === 4 && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    4. Workouts, Amenities, Rules & Safety
                  </div>
                  <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                    Configure fitness disciplines, member amenities, facility rules, and safety protocols
                  </div>
                </div>

                {/* Workouts */}
                <div style={{ marginBottom: 24, padding: '18px 20px', borderRadius: 10, border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`, backgroundColor: isDarkMode ? '#141414' : '#fafafa' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ThunderboltFilled style={{ color: '#EC4899' }} />
                    Workout Disciplines Offered * {renderFieldSuccess('workouts')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {WORKOUT_OPTIONS.map((w) => {
                      const selected = formData.workouts.includes(w);
                      return (
                        <Tag.CheckableTag
                          key={w}
                          checked={selected}
                          onChange={(checked) => {
                            const next = checked
                              ? [...formData.workouts, w]
                              : formData.workouts.filter((item) => item !== w);
                            handleFieldChange('workouts', next);
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 16, fontSize: 13, fontWeight: 600,
                            backgroundColor: selected ? '#4338ca' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                            color: selected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#334155'),
                            border: `1px solid ${selected ? '#4338ca' : (isDarkMode ? '#334155' : '#cbd5e1')}`,
                          }}
                        >
                          {w}
                        </Tag.CheckableTag>
                      );
                    })}
                  </div>
                  {renderFieldError('workouts')}
                </div>

                {/* Amenities */}
                <div style={{ marginBottom: 24, padding: '18px 20px', borderRadius: 10, border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`, backgroundColor: isDarkMode ? '#141414' : '#fafafa' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StarFilled style={{ color: '#F59E0B' }} />
                    Amenities & Member Perks
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {AMENITY_OPTIONS.map((amen) => {
                      const selected = (formData.amenities || []).includes(amen);
                      return (
                        <Tag.CheckableTag
                          key={amen}
                          checked={selected}
                          onChange={(checked) => {
                            const next = checked
                              ? [...(formData.amenities || []), amen]
                              : (formData.amenities || []).filter((a) => a !== amen);
                            handleFieldChange('amenities', next);
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 16, fontSize: 13, fontWeight: 600,
                            backgroundColor: selected ? '#F59E0B' : (isDarkMode ? '#1e293b' : '#fffbeb'),
                            color: selected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#92400e'),
                            border: `1px solid ${selected ? '#F59E0B' : (isDarkMode ? '#334155' : '#fcd34d')}`,
                          }}
                        >
                          {amen}
                        </Tag.CheckableTag>
                      );
                    })}
                  </div>
                </div>

                <Row gutter={[16, 16]}>
                  {/* Gym Rules */}
                  <Col xs={24} md={12}>
                    <div style={{ padding: '18px 20px', borderRadius: 10, border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`, backgroundColor: isDarkMode ? '#141414' : '#fafafa', height: '100%' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <FileTextOutlined style={{ color: '#6366F1' }} />
                        Gym Rules & Member Guidelines
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {(formData.rules || []).map((rule, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}` }}>
                            <CheckOutlined style={{ color: '#6366F1', fontSize: 11, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 12, color: isDarkMode ? '#e2e8f0' : '#334155' }}>{rule}</span>
                            <Button
                              type="text" size="small" danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleFieldChange('rules', formData.rules.filter((_, i) => i !== idx))}
                              style={{ padding: '0 4px' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                          placeholder="Add gym rule..."
                          id="new-rule-input"
                          style={{ height: 36 }}
                          onPressEnter={(e) => {
                            if (e.target.value.trim()) {
                              handleFieldChange('rules', [...(formData.rules || []), e.target.value.trim()]);
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => {
                            const input = document.getElementById('new-rule-input');
                            if (input?.value?.trim()) {
                              handleFieldChange('rules', [...(formData.rules || []), input.value.trim()]);
                              input.value = '';
                            }
                          }}
                          style={{ flexShrink: 0 }}
                        />
                      </div>
                    </div>
                  </Col>

                  {/* Safety Measures */}
                  <Col xs={24} md={12}>
                    <div style={{ padding: '18px 20px', borderRadius: 10, border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`, backgroundColor: isDarkMode ? '#141414' : '#fafafa', height: '100%' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <SafetyCertificateOutlined style={{ color: '#10B981' }} />
                        Safety Measures & Protocols
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {(formData.safetyMeasures || []).map((measure, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4', border: `1px solid ${isDarkMode ? '#334155' : '#bbf7d0'}` }}>
                            <CheckCircleFilled style={{ color: '#10B981', fontSize: 11, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 12, color: isDarkMode ? '#e2e8f0' : '#166534' }}>{measure}</span>
                            <Button
                              type="text" size="small" danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleFieldChange('safetyMeasures', formData.safetyMeasures.filter((_, i) => i !== idx))}
                              style={{ padding: '0 4px' }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Input
                          placeholder="Add safety measure..."
                          id="new-safety-input"
                          style={{ height: 36 }}
                          onPressEnter={(e) => {
                            if (e.target.value.trim()) {
                              handleFieldChange('safetyMeasures', [...(formData.safetyMeasures || []), e.target.value.trim()]);
                              e.target.value = '';
                            }
                          }}
                        />
                        <Button
                          icon={<PlusOutlined />}
                          onClick={() => {
                            const input = document.getElementById('new-safety-input');
                            if (input?.value?.trim()) {
                              handleFieldChange('safetyMeasures', [...(formData.safetyMeasures || []), input.value.trim()]);
                              input.value = '';
                            }
                          }}
                          style={{ flexShrink: 0 }}
                        />
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 5: PAYOUT & SUBSCRIPTION TIER */}
            {/* ========================================================================= */}
            {currentStep === 5 && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    5. GYMEZY Subscription Tier & Payout Settlement
                  </div>
                  <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                    Select platform software package and configure automated merchant bank details
                  </div>
                </div>

                <div style={{ fontSize: 14, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 12 }}>
                  GYMEZY Partner Subscription Plan *
                </div>

                <Row gutter={[16, 16]}>
                  {[
                    { key: 'Hybrid', title: 'Hybrid Plan', price: '₹ 4,999/mo', desc: 'Full Cloud GMS + App Marketplace + QR Turnstile Integration + Trainers Hub', recommended: true },
                    { key: 'App Only', title: 'App Only', price: '₹ 2,999/mo', desc: 'GYMEZY User App Marketplace Listing + Walk-In Pass revenue' },
                    { key: 'GMS', title: 'GMS Only', price: '₹ 1,999/mo', desc: 'Gym Management Software for existing members' },
                    { key: 'Listing Only', title: 'Listing Only', price: '₹ 999/mo', desc: 'Basic directory listing and search presence' },
                  ].map((tier) => {
                    const isSelected = formData.subscriptionType === tier.key;
                    return (
                      <Col xs={24} sm={12} key={tier.key}>
                        <Card
                          onClick={() => handleFieldChange('subscriptionType', tier.key)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: isSelected ? (isDarkMode ? 'rgba(79, 70, 229, 0.15)' : '#eef2ff') : (isDarkMode ? '#141414' : '#ffffff'),
                            borderColor: isSelected ? '#4338ca' : (isDarkMode ? '#333333' : '#e2e8f0'),
                            borderWidth: isSelected ? 2 : 1,
                            borderRadius: 10,
                            position: 'relative',
                          }}
                          styles={{ body: { padding: '16px' } }}
                        >
                          {tier.recommended && (
                            <Tag color="purple" style={{ position: 'absolute', top: 12, right: 12, fontWeight: 700 }}>
                              Recommended
                            </Tag>
                          )}
                          <div style={{ fontWeight: 800, fontSize: 15, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                            {tier.title}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#4338ca', margin: '4px 0' }}>
                            {tier.price}
                          </div>
                          <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>
                            {tier.desc}
                          </div>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>

                <Divider style={{ margin: '24px 0 20px 0' }} />

                <div style={{ fontSize: 14, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 12 }}>
                  Payout Bank Account & UPI Settlement
                </div>

                <Row gutter={[16, 16]}>
                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Account Holder Name * {renderFieldSuccess('accountHolder')}
                    </div>
                    <Input
                      placeholder="e.g. FitZone Fitness Pvt Ltd"
                      value={formData.accountHolder}
                      status={touched.accountHolder && errors.accountHolder ? 'error' : ''}
                      onChange={(e) => handleFieldChange('accountHolder', e.target.value)}
                      onBlur={() => handleFieldBlur('accountHolder')}
                      style={{ height: 40 }}
                    />
                    {renderFieldError('accountHolder')}
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Bank Name *
                    </div>
                    <Select
                      value={formData.bankName}
                      showSearch
                      optionFilterProp="children"
                      placeholder="Select bank"
                      onChange={(bankName) => {
                        handleFieldsChange({
                          bankName,
                          ifscCode: getBankByName(bankName)?.ifscPrefix || '',
                        });
                      }}
                      style={{ width: '100%', height: 40 }}
                    >
                      {BANKS.map((bank) => (
                        <Option key={bank.name} value={bank.name}>{bank.name}</Option>
                      ))}
                    </Select>
                  </Col>

                  <Col xs={24} md={12}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      Bank Account Number * {renderFieldSuccess('accountNumber')}
                    </div>
                    <Input
                      placeholder="50200012345678"
                      value={formData.accountNumber}
                      status={touched.accountNumber && errors.accountNumber ? 'error' : ''}
                      onChange={(e) => handleFieldChange('accountNumber', e.target.value)}
                      onBlur={() => handleFieldBlur('accountNumber')}
                      style={{ height: 40 }}
                    />
                    {renderFieldError('accountNumber')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155', display: 'flex', alignItems: 'center' }}>
                      IFSC Code * {renderFieldSuccess('ifscCode')}
                    </div>
                    <Input
                      placeholder="HDFC0001234"
                      value={formData.ifscCode}
                      status={touched.ifscCode && errors.ifscCode ? 'error' : ''}
                      onChange={(e) => handleFieldChange('ifscCode', e.target.value)}
                      onBlur={() => handleFieldBlur('ifscCode')}
                      style={{ height: 40 }}
                    />
                    {renderFieldError('ifscCode')}
                  </Col>

                  <Col xs={24} md={6}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: isDarkMode ? '#cccccc' : '#334155' }}>
                      Instant Settlement UPI ID
                    </div>
                    <Input
                      placeholder="fitzone@okhdfc"
                      value={formData.upiId}
                      onChange={(e) => handleFieldChange('upiId', e.target.value)}
                      style={{ height: 40 }}
                    />
                  </Col>
                </Row>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 6: REVIEW & GO LIVE */}
            {/* ========================================================================= */}
            {currentStep === 6 && (
              <div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    6. Final Review & Partner Activation
                  </div>
                  <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                    Inspect configured profile parameters and publish to the live GYMEZY platform
                  </div>
                </div>

                {/* Pre-Launch Validation Health Banner */}
                {validationSummary.isAllValid ? (
                  <Alert
                    type="success"
                    showIcon
                    icon={<CheckCircleFilled style={{ fontSize: 20, color: '#16a34a' }} />}
                    message={<span style={{ fontWeight: 800, fontSize: 14 }}>All 5 Milestones Verified & Complete!</span>}
                    description="All required business parameters, facilities, trainers, and payout coordinates are validated. You can publish this partner immediately."
                    style={{ marginBottom: 20, borderRadius: 10 }}
                  />
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    icon={<ExclamationCircleFilled style={{ fontSize: 20, color: '#ea580c' }} />}
                    message={<span style={{ fontWeight: 800, fontSize: 14 }}>{validationSummary.totalMissing} Required Field(s) Incomplete</span>}
                    description="Please resolve the missing fields in the checklist below before activating this partner."
                    style={{ marginBottom: 20, borderRadius: 10 }}
                  />
                )}

                {/* Step-by-Step Validation Checklist */}
                <Card
                  style={{
                    backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                    borderColor: isDarkMode ? '#333333' : '#e2e8f0',
                    borderRadius: 10,
                    marginBottom: 20,
                  }}
                  styles={{ body: { padding: '18px 20px' } }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 12, color: isDarkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileProtectOutlined style={{ color: '#4338ca' }} /> Pre-Activation Compliance Checklist
                  </div>
                  <Row gutter={[12, 12]}>
                    {ONBOARDING_STEPS.slice(0, 5).map((step) => {
                      const st = validationSummary.statusMap[step.id];
                      return (
                        <Col xs={24} sm={12} md={8} key={step.id}>
                          <div
                            style={{
                              padding: '10px 14px',
                              borderRadius: 8,
                              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                              border: `1px solid ${st.isValid ? '#16a34a' : '#ea580c'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                                Step {step.id}: {step.title}
                              </div>
                              <div style={{ fontSize: 11, color: st.isValid ? '#16a34a' : '#ea580c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {st.isValid ? (
                                  <>
                                    <CheckCircleFilled style={{ color: '#16a34a' }} />
                                    <span>Verified</span>
                                  </>
                                ) : (
                                  <>
                                    <WarningOutlined style={{ color: '#ea580c' }} />
                                    <span>{st.missingCount} Missing</span>
                                  </>
                                )}
                              </div>
                            </div>
                            {!st.isValid && (
                              <Button
                                size="small"
                                type="link"
                                onClick={() => setCurrentStep(step.id)}
                                style={{ padding: 0, fontWeight: 700, fontSize: 12 }}
                              >
                                Fix Step
                              </Button>
                            )}
                          </div>
                        </Col>
                      );
                    })}
                  </Row>
                </Card>

                <Row gutter={[20, 20]}>
                  {/* Left: Summary Review Cards */}
                  <Col xs={24} md={14}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Business & Location Card */}
                      <Card
                        style={{ backgroundColor: isDarkMode ? '#141414' : '#f8fafc', borderColor: isDarkMode ? '#333333' : '#e2e8f0', borderRadius: 8 }}
                        styles={{ body: { padding: '16px' } }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#4338ca', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ShopOutlined /> Business & Location
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                          <div><span style={{ color: '#64748b' }}>Gym Name:</span> <strong>{formData.gymName || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Owner:</span> <strong>{formData.ownerName || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Phone:</span> <strong>{formData.phone ? `+91 ${formData.phone}` : '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>City:</span> <strong>{formData.city || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Gender Policy:</span> <strong>{formData.genderAllowed || 'Unisex'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Facility Photos:</span> <strong>{(formData.galleryPhotos || []).length} uploaded</strong></div>
                          <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#64748b' }}>Address:</span> {formData.address || '—'}</div>
                          <div style={{ gridColumn: 'span 2' }}><span style={{ color: '#64748b' }}>Timings:</span> {formData.is24Hours ? '24/7 Facility Access' : `${formData.weekdayOpen} - ${formData.weekdayClose}`}</div>
                        </div>
                      </Card>

                      {/* Subscription & Bank Settlement Card */}
                      <Card
                        style={{ backgroundColor: isDarkMode ? '#141414' : '#f8fafc', borderColor: isDarkMode ? '#333333' : '#e2e8f0', borderRadius: 8 }}
                        styles={{ body: { padding: '16px' } }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CreditCardOutlined /> Subscription & Bank Settlement
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                          <div><span style={{ color: '#64748b' }}>Platform Tier:</span> <Tag color="blue">{formData.subscriptionType}</Tag></div>
                          <div><span style={{ color: '#64748b' }}>Bank:</span> <strong>{formData.bankName}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Account Holder:</span> <strong>{formData.accountHolder || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>Account No:</span> <strong>{formData.accountNumber ? `••••${formData.accountNumber.slice(-4)}` : '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>IFSC Code:</span> <strong>{formData.ifscCode || '—'}</strong></div>
                          <div><span style={{ color: '#64748b' }}>UPI ID:</span> <strong>{formData.upiId || '—'}</strong></div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ color: '#64748b' }}>Pass & Membership Pricing:</span>{' '}
                            <Tag color="cyan">Configured later by partner in Gym Owner Dashboard</Tag>
                          </div>
                        </div>
                      </Card>

                      {/* Activation Status Radio */}
                      <div style={{ padding: '14px', background: isDarkMode ? '#1a1a1a' : '#f1f5f9', borderRadius: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                          Initial Publication Status:
                        </div>
                        <Radio.Group
                          value={formData.initialApprovalStatus}
                          onChange={(e) => handleFieldChange('initialApprovalStatus', e.target.value)}
                        >
                          <Radio value="Approved">
                            <span style={{ fontWeight: 700, color: '#16a34a' }}>Approved & Live Immediately</span>
                          </Radio>
                          <Radio value="Pending Approval">
                            <span style={{ fontWeight: 700, color: '#ea580c' }}>Save as Pending Verification</span>
                          </Radio>
                        </Radio.Group>
                      </div>
                    </div>
                  </Col>

                  {/* Right: Live Customer App Mobile Preview Card */}
                  <Col xs={24} md={10}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 8, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <MobileOutlined /> Live GYMEZY Customer App Card Preview
                    </div>
                    <div
                      style={{
                        borderRadius: 16,
                        overflow: 'hidden',
                        backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                        border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      }}
                    >
                      {/* Image Header */}
                      <div style={{ position: 'relative', height: 160, backgroundColor: '#0f172a' }}>
                        {formData.logo || formData.coverPhoto ? (
                          <img
                            src={formData.logo || formData.coverPhoto}
                            alt="Gym Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                            <PictureOutlined style={{ fontSize: 32 }} />
                          </div>
                        )}
                        <Tag
                          color="#4338ca"
                          style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            fontWeight: 800,
                            borderRadius: 12,
                            padding: '2px 8px',
                          }}
                        >
                          {formData.badgeText || 'Verified'}
                        </Tag>
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 10,
                            right: 10,
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: '#fbbf24',
                            padding: '3px 8px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <StarFilled style={{ color: '#fbbf24' }} /> 4.9 (New)
                        </div>
                      </div>

                      {/* Card Body */}
                      <div style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                          {formData.gymName || 'Gym Name Preview'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <EnvironmentOutlined /> {formData.area || formData.city || 'Locality'}, {formData.city || 'City'} • 1.2 km
                        </div>

                        {/* Facilities tags */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '10px 0' }}>
                          {formData.facilities.slice(0, 3).map((f) => (
                            <Tag key={f} style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>
                              {f}
                            </Tag>
                          ))}
                          {formData.facilities.length > 3 && (
                            <Tag style={{ fontSize: 10, margin: 0, borderRadius: 4 }}>
                              +{formData.facilities.length - 3} more
                            </Tag>
                          )}
                          {formData.facilities.length === 0 && (
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>No facilities selected</span>
                          )}
                        </div>

                        {/* Price & Book Pass Button */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}` }}>
                          <div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>Pass starts at</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#4338ca' }}>
                              ₹ {formData.singleSessionPrice || '—'} <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>/ session</span>
                            </div>
                          </div>
                          <Button
                            type="primary"
                            size="small"
                            style={{ backgroundColor: '#4338ca', fontWeight: 700, borderRadius: 6 }}
                          >
                            Book Pass
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>
            )}

            {/* Bottom Navigation Buttons */}
            <Divider style={{ margin: '28px 0 20px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button
                icon={<ArrowLeftOutlined />}
                disabled={currentStep === 1}
                onClick={() => setCurrentStep((prev) => prev - 1)}
                style={{ borderRadius: 'var(--radius-base)', fontWeight: 600 }}
              >
                Previous Step
              </Button>

              <Space>
                {currentStep < 6 ? (
                  <Button
                    type="primary"
                    onClick={handleSaveAndNext}
                    style={{
                      backgroundColor: '#4338ca',
                      borderColor: '#4338ca',
                      height: 40,
                      padding: '0 24px',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 700,
                    }}
                  >
                    Save & Continue <ArrowRightOutlined />
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    icon={<ThunderboltFilled />}
                    loading={isSubmitting}
                    onClick={handleFinalPublish}
                    style={{
                      backgroundColor: validationSummary.isAllValid ? '#16a34a' : '#4338ca',
                      borderColor: validationSummary.isAllValid ? '#16a34a' : '#4338ca',
                      height: 44,
                      padding: '0 28px',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 800,
                      fontSize: 15,
                    }}
                  >
                    Publish & Activate Gym
                  </Button>
                )}
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* ========================================================================= */}
      {/* SUCCESS CELEBRATION MODAL */}
      {/* ========================================================================= */}
      <Modal
        open={isSuccessModalOpen}
        footer={null}
        closable={false}
        centered
        width={500}
        styles={{
          body: {
            padding: '36px 28px',
            textAlign: 'center',
            backgroundColor: isDarkMode ? '#141414' : '#ffffff',
            borderRadius: 16,
          },
        }}
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            backgroundColor: '#dcfce7',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 36,
            margin: '0 auto 18px auto',
          }}
        >
          <CheckCircleOutlined />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', margin: 0 }}>
          Gym Onboarded Successfully!
        </h2>

        <p style={{ fontSize: 14, color: isDarkMode ? '#888888' : '#64748b', marginTop: 8 }}>
          <strong>{createdGymSummary?.name || formData.gymName}</strong> is now registered on the GYMEZY platform with status{' '}
          <Tag color="green" style={{ fontWeight: 700 }}>{createdGymSummary?.approvalStatus || 'Approved'}</Tag>.
        </p>

        <div
          style={{
            margin: '20px 0',
            padding: '14px',
            borderRadius: 10,
            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
            textAlign: 'left',
            fontSize: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div>
            <strong>Partner ID:</strong>{' '}
            <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, marginLeft: 4 }}>
              {createdGymSummary?.partnerId || formData.partnerId || '-'}
            </Tag>
          </div>
          <div><strong>Location:</strong> {formData.area ? `${formData.area}, ` : ''}{formData.city}</div>
          <div><strong>Subscription Tier:</strong> {formData.subscriptionType}</div>
          <div><strong>Membership & Passes:</strong> Configured in Owner Dashboard</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button
            type="primary"
            onClick={() => navigate('/admin/gyms')}
            style={{
              backgroundColor: '#4338ca',
              borderColor: '#4338ca',
              height: 42,
              fontWeight: 700,
              borderRadius: 'var(--radius-base)',
            }}
          >
            View in Gyms & Tenants Fleet
          </Button>

          <Button
            onClick={() => {
              setIsSuccessModalOpen(false);
              setCurrentStep(1);
              setFormData((prev) => ({
                ...prev,
                gymName: '',
                gymId: 'GYM-' + Math.floor(1000 + Math.random() * 9000),
              }));
            }}
            style={{ height: 40, fontWeight: 600, borderRadius: 'var(--radius-base)' }}
          >
            Onboard Another Gym Partner
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default GymOnboarding;
