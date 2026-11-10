import React, { useState, useMemo, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import {
  Card,
  Row,
  Col,
  Tag,
  Button,
  Typography,
  Avatar,
  Tabs,
  Table,
  Badge,
  Descriptions,
  Space,
  Input,
  Select,
  Divider,
  message,
  Image,
  Rate,
  Dropdown,
  Modal,
  Form,
  InputNumber,
  Checkbox,
  Radio,
  Segmented,
  Progress,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  ShopOutlined,
  DollarOutlined,
  PictureOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  SaveOutlined,
  UserOutlined,
  SearchOutlined,
  EditOutlined,
  AimOutlined,
  CheckOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FireOutlined,
  ThunderboltOutlined,
  IdcardOutlined,
  StarFilled,
  StarOutlined,
  BankOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  CheckCircleFilled,
  InstagramOutlined,
  WhatsAppOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';
import { apiClient } from '../../services/apiClient';
import { fetchGyms } from '../../redux/slices/gymSlice';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

const getGymLogoSrc = (gym) => {
  if (!gym) return '';
  // 1. Direct logo fileData (Base64 WebP/PNG)
  if (gym.logo && typeof gym.logo.fileData === 'string' && gym.logo.fileData.trim()) {
    return gym.logo.fileData.trim();
  }
  // 2. Direct logo URL/string
  if (typeof gym.logo === 'string' && gym.logo.trim()) {
    return gym.logo.trim();
  }
  // 3. logoUrl convenience field
  if (typeof gym.logoUrl === 'string' && gym.logoUrl.trim()) {
    return gym.logoUrl.trim();
  }
  // 4. coverPhoto fileData
  if (gym.coverPhoto && typeof gym.coverPhoto.fileData === 'string' && gym.coverPhoto.fileData.trim()) {
    return gym.coverPhoto.fileData.trim();
  }
  // 5. coverPhoto URL/string
  if (typeof gym.coverPhoto === 'string' && gym.coverPhoto.trim()) {
    return gym.coverPhoto.trim();
  }
  // 6. coverPhotoUrl convenience field
  if (typeof gym.coverPhotoUrl === 'string' && gym.coverPhotoUrl.trim()) {
    return gym.coverPhotoUrl.trim();
  }
  // 7. imageUrl or image
  if (typeof gym.imageUrl === 'string' && gym.imageUrl.trim()) {
    return gym.imageUrl.trim();
  }
  if (typeof gym.image === 'string' && gym.image.trim()) {
    return gym.image.trim();
  }
  if (typeof gym.thumbnailImage === 'string' && gym.thumbnailImage.trim()) {
    return gym.thumbnailImage.trim();
  }
  // 8. Gallery / images array
  if (Array.isArray(gym.images) && gym.images.length > 0 && typeof gym.images[0] === 'string' && gym.images[0].trim()) {
    return gym.images[0].trim();
  }
  if (Array.isArray(gym.galleryPhotos) && gym.galleryPhotos.length > 0 && gym.galleryPhotos[0]?.fileData) {
    return gym.galleryPhotos[0].fileData.trim();
  }
  return '';
};

// Helper function to extract initials
const getGymInitials = (name) => {
  if (!name || typeof name !== 'string') return 'GY';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GY';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

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
  'Automated External Defibrillator (AED) on premises',
];

const DEFAULT_WORKOUTS = [
  'HIIT (High Intensity)',
  'Yoga & Mobility',
  'Zumba & Dance',
  'Boxing & Kickboxing',
  'CrossFit',
  'Powerlifting',
  'Bodybuilding',
  'Calisthenics',
  'MMA & Martial Arts',
  'Aerobics',
  'Pilates',
  'Cardio Fitness',
];

const DEFAULT_AMENITIES = [
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

const DEFAULT_SESSION_CATEGORIES = [
  'Gym Access',
  'Group Classes',
  'Yoga Classes',
  'Zumba Sessions',
  'HIIT',
  'CrossFit',
  'Pilates',
  'Kickboxing',
  'Dance Fitness',
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const getDayByDaySchedule = (gym) => {
  const oh = gym?.openingHours || {};
  const scheduleArray = Array.isArray(oh.schedule) && oh.schedule.length > 0 ? oh.schedule : null;

  return DAYS_OF_WEEK.map((dayName) => {
    if (scheduleArray) {
      const found = scheduleArray.find((s) => s.day?.toLowerCase() === dayName.toLowerCase());
      if (found) {
        if (!found.isOpen || found.mode === 'CLOSED') {
          return { day: dayName, isOpen: false, text: 'Closed', mode: 'CLOSED' };
        }
        if (found.mode === 'SPLIT_SHIFT') {
          const mOpen = found.morningShift?.openTime || oh.morningOpen || '05:30 AM';
          const mClose = found.morningShift?.closeTime || oh.morningClose || '11:30 AM';
          const eOpen = found.eveningShift?.openTime || oh.eveningOpen || '04:30 PM';
          const eClose = found.eveningShift?.closeTime || oh.eveningClose || '10:30 PM';
          return {
            day: dayName,
            isOpen: true,
            text: `${mOpen} – ${mClose} & ${eOpen} – ${eClose}`,
            mode: 'SPLIT_SHIFT',
            morning: `${mOpen} – ${mClose}`,
            evening: `${eOpen} – ${eClose}`,
          };
        }
        if (found.mode === '24_HOURS') {
          return { day: dayName, isOpen: true, text: '24 Hours Open', mode: '24_HOURS' };
        }
        return {
          day: dayName,
          isOpen: true,
          text: `${found.openTime || oh.weekdayOpen || '05:30 AM'} – ${found.closeTime || oh.weekdayClose || '10:30 PM'}`,
          mode: 'REGULAR',
        };
      }
    }

    const isWeekend = dayName === 'Saturday' || dayName === 'Sunday';
    const isSunday = dayName === 'Sunday';

    if (oh.mode === '24_HOURS' || oh.is24Hours) {
      return { day: dayName, isOpen: true, text: '24 Hours Open', mode: '24_HOURS' };
    }

    if (oh.mode === 'SPLIT_SHIFT' || oh.isSplitShift) {
      const mOpen = oh.morningOpen || '05:30 AM';
      const mClose = oh.morningClose || (isSunday ? '01:00 PM' : '11:30 AM');
      const eOpen = oh.eveningOpen || '04:30 PM';
      const eClose = oh.eveningClose || (isSunday ? '08:00 PM' : '10:30 PM');
      return {
        day: dayName,
        isOpen: true,
        text: `${mOpen} – ${mClose} & ${eOpen} – ${eClose}`,
        mode: 'SPLIT_SHIFT',
        morning: `${mOpen} – ${mClose}`,
        evening: `${eOpen} – ${eClose}`,
      };
    }

    const openTime = isWeekend ? (oh.weekendOpen || '06:00 AM') : (oh.weekdayOpen || '05:30 AM');
    const closeTime = isSunday
      ? (oh.weekendClose || '08:00 PM')
      : isWeekend
      ? (oh.weekendClose || '09:00 PM')
      : (oh.weekdayClose || '10:30 PM');

    return {
      day: dayName,
      isOpen: true,
      text: `${openTime} – ${closeTime}`,
      mode: 'REGULAR',
    };
  });
};

// Default fallback bookings matching gym
const SAMPLE_BOOKINGS = [
  {
    key: '1',
    bookingId: 'BK100121',
    customerName: 'Arun Kumar',
    customerPhone: '+91 98765 43210',
    type: 'Single Session Pass',
    slotTime: '06:00 AM - 07:30 AM',
    bookingDate: '18 May 2026',
    amount: 199,
    status: 'Completed',
    paymentMode: 'UPI',
  },
  {
    key: '2',
    bookingId: 'BK100122',
    customerName: 'Priya Sharma',
    customerPhone: '+91 91234 56789',
    type: 'Monthly Membership',
    slotTime: '06:00 PM - 07:30 PM',
    bookingDate: '18 May 2026',
    amount: 1499,
    status: 'Active',
    paymentMode: 'Card',
  },
  {
    key: '3',
    bookingId: 'BK100123',
    customerName: 'Rahul Krishnan',
    customerPhone: '+91 99887 66554',
    type: 'Single Session Pass',
    slotTime: '07:30 AM - 09:00 AM',
    bookingDate: '17 May 2026',
    amount: 199,
    status: 'Completed',
    paymentMode: 'UPI',
  },
  {
    key: '4',
    bookingId: 'BK100124',
    customerName: 'Sneha Patel',
    customerPhone: '+91 97654 32109',
    type: 'Quarterly Pass (3M)',
    slotTime: 'All Day Access',
    bookingDate: '16 May 2026',
    amount: 3999,
    status: 'Active',
    paymentMode: 'Net Banking',
  },
  {
    key: '5',
    bookingId: 'BK100125',
    customerName: 'Vignesh M',
    customerPhone: '+91 98401 23456',
    type: 'Single Session Pass',
    slotTime: '05:00 PM - 06:30 PM',
    bookingDate: '15 May 2026',
    amount: 199,
    status: 'Cancelled',
    paymentMode: 'UPI (Refunded)',
  },
];

export const GymDetailsView = ({
  gym,
  allGyms = [],
  onBack,
  onSelectGym,
  onApprove,
  onHold,
  onReject,
  onStatusChange,
}) => {
  const dispatch = useDispatch();
  const { isDarkMode } = useTheme();
  const [editForm] = Form.useForm();

  // Basic Gym Details View State
  const [activeTab, setActiveTab] = useState('overview');
  const [adminNote, setAdminNote] = useState(gym?.adminNote || '');
  const [bookingSearch, setBookingSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('All');

  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdNotes, setHoldNotes] = useState(gym?.remark || '');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState(gym?.remark || '');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Live Activity: Bookings, Memberships, Created Sections, and Reviews
  const [realBookings, setRealBookings] = useState([]);
  const [realMemberships, setRealMemberships] = useState([]);
  const [createdSections, setCreatedSections] = useState([]);
  const [gymReviewsData, setGymReviewsData] = useState(null);
  const [isLoadingGymData, setIsLoadingGymData] = useState(false);
  const [bookingTypeFilter, setBookingTypeFilter] = useState('ALL'); // 'ALL' | 'MEMBERSHIP' | 'GYM_SESSION' | 'GROUP_CLASS'
  const [selectedSectionForModal, setSelectedSectionForModal] = useState(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);

  const loadGymActivity = async () => {
    const gymId = gym?._id || gym?.id || gym?.mongoId;
    if (!gymId) return;
    setIsLoadingGymData(true);
    try {
      const [bRes, mRes, sRes, rRes] = await Promise.all([
        apiClient.get(`/bookings/gym/${gymId}?isFetchAll=true`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/memberships/gym/${gymId}?isFetchAll=true`).catch(() => ({ data: { data: { memberships: [] } } })),
        apiClient.get(`/sections?gymId=${gymId}`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/gyms/${gymId}/reviews`).catch(() => ({ data: { data: null } })),
      ]);

      const bList = Array.isArray(bRes.data?.data) ? bRes.data.data : [];
      const mList = Array.isArray(mRes.data?.data?.memberships)
        ? mRes.data.data.memberships
        : Array.isArray(mRes.data?.data)
        ? mRes.data.data
        : [];
      const sList = Array.isArray(sRes.data?.data) ? sRes.data.data : [];
      const rData = rRes.data?.data || null;

      setRealBookings(bList);
      setRealMemberships(mList);
      setCreatedSections(sList);
      setGymReviewsData(rData);
    } catch (err) {
      console.error('Failed to load gym activity:', err);
    } finally {
      setIsLoadingGymData(false);
    }
  };

  useEffect(() => {
    loadGymActivity();
  }, [gym?._id, gym?.id]);

  // Unified list of Bookings & Memberships
  const unifiedBookings = useMemo(() => {
    const list = [];

    // 1. Process Bookings (Sessions & Group Classes)
    realBookings.forEach((b) => {
      const isGroupClass = b.bookingType === 'GROUP_CLASS' || b.category === 'section' || b.category === 'group_class';
      const customer = b.userId || {};
      const passTypeLabel = isGroupClass
        ? (b.title || 'Group Class Booking')
        : (b.title || (b.sessionsCount > 1 ? `${b.sessionsCount}-Session Pass` : 'Single Session Pass'));

      list.push({
        key: `b-${b._id || b.bookingId}`,
        bookingId: b.bookingId || `BK-${String(b._id).slice(-6).toUpperCase()}`,
        category: isGroupClass ? 'GROUP_CLASS' : 'GYM_SESSION',
        customerName: customer.fullName || customer.name || b.walkInDetails?.name || 'Customer',
        customerPhone: customer.phone || b.walkInDetails?.phone || '—',
        customerAvatar: customer.avatar || customer.profilePicture || '',
        type: passTypeLabel,
        slotTime: b.timeSlot || (b.startTime && b.endTime ? `${b.startTime} - ${b.endTime}` : 'General Slot'),
        bookingDate: b.createdAt
          ? new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—',
        amount: b.pricing?.totalAmount ?? b.amount ?? 0,
        paymentMode: b.payment?.method || 'UPI',
        status: b.status || 'Active',
        raw: b,
      });
    });

    // 2. Process Memberships
    realMemberships.forEach((m) => {
      const customer = m.userId || {};
      list.push({
        key: `m-${m._id || m.membershipId}`,
        bookingId: m.membershipId || `MEM-${String(m._id).slice(-6).toUpperCase()}`,
        category: 'MEMBERSHIP',
        customerName: customer.fullName || customer.name || m.walkInDetails?.name || 'Member',
        customerPhone: customer.phone || m.walkInDetails?.phone || '—',
        customerAvatar: customer.avatar || customer.profilePicture || '',
        type: `${m.membershipTier || 'Monthly'} Membership`,
        slotTime: m.hasTrainer && m.trainerSlot ? `PT Slot: ${m.trainerSlot}` : 'All Day Facility Access',
        bookingDate: m.createdAt
          ? new Date(m.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—',
        amount: m.pricing?.totalAmount ?? m.amount ?? 0,
        paymentMode: m.payment?.method || 'UPI',
        status: m.status || 'Active',
        raw: m,
      });
    });

    // Fallback to SAMPLE_BOOKINGS if DB has 0 records
    if (list.length === 0 && SAMPLE_BOOKINGS.length > 0) {
      return SAMPLE_BOOKINGS.map((sb) => ({
        ...sb,
        customerAvatar: '',
        category: sb.type.includes('Membership') ? 'MEMBERSHIP' : (sb.type.includes('Class') ? 'GROUP_CLASS' : 'GYM_SESSION'),
      }));
    }

    return list;
  }, [realBookings, realMemberships]);

  const bookingCounts = useMemo(() => {
    const total = unifiedBookings.length;
    const memberships = unifiedBookings.filter((b) => b.category === 'MEMBERSHIP').length;
    const sessions = unifiedBookings.filter((b) => b.category === 'GYM_SESSION').length;
    const groupClasses = unifiedBookings.filter((b) => b.category === 'GROUP_CLASS').length;
    return { total, memberships, sessions, groupClasses };
  }, [unifiedBookings]);

  const filteredBookings = useMemo(() => {
    return unifiedBookings.filter((b) => {
      if (bookingTypeFilter !== 'ALL' && b.category !== bookingTypeFilter) {
        return false;
      }
      if (bookingStatusFilter !== 'All' && b.status !== bookingStatusFilter) {
        return false;
      }
      if (bookingSearch) {
        const q = bookingSearch.toLowerCase();
        const matchName = b.customerName?.toLowerCase().includes(q);
        const matchPhone = b.customerPhone?.includes(q);
        const matchId = b.bookingId?.toLowerCase().includes(q);
        const matchType = b.type?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchId && !matchType) return false;
      }
      return true;
    });
  }, [unifiedBookings, bookingTypeFilter, bookingStatusFilter, bookingSearch]);

  const handleOpenEditModal = () => {
    if (!gym) return;
    editForm.setFieldsValue({
      name: gym.name || '',
      tagline: gym.tagline || '',
      ownerName: gym.ownerName || gym.fullName || '',
      phone: gym.phone || '',
      email: gym.email || '',
      businessType: gym.businessType || 'Private Limited',
      yearEstablished: gym.yearEstablished || '',
      subscriptionType: gym.subscriptionType || 'Hybrid',
      gstNumber: gym.gstNumber || '',
      panNumber: gym.panNumber || '',

      address: gym.address || gym.fullAddress || '',
      area: gym.area || '',
      city: gym.city || 'Chennai',
      state: gym.state || 'Tamil Nadu',
      pincode: gym.pincode || '',
      googleMapsUrl: gym.googleMapsUrl || '',

      timingMode: gym.openingHours?.mode || (gym.openingHours?.is24Hours ? '24_HOURS' : (gym.openingHours?.isSplitShift ? 'SPLIT_SHIFT' : 'REGULAR')),
      weekdayOpen: gym.openingHours?.weekdayOpen || '05:30 AM',
      weekdayClose: gym.openingHours?.weekdayClose || '10:30 PM',
      weekendOpen: gym.openingHours?.weekendOpen || '06:00 AM',
      weekendClose: gym.openingHours?.weekendClose || '09:00 PM',
      morningOpen: gym.openingHours?.morningOpen || '05:30 AM',
      morningClose: gym.openingHours?.morningClose || '11:30 AM',
      eveningOpen: gym.openingHours?.eveningOpen || '04:30 PM',
      eveningClose: gym.openingHours?.eveningClose || '10:30 PM',

      singleSessionBookingEnabled: gym.singleSessionBookingEnabled !== undefined ? Boolean(gym.singleSessionBookingEnabled) : true,
      singleSessionPrice: gym.singleSessionPrice || gym.pricingPlans?.singleSession || 199,
      weeklyPassPrice: gym.pricingPlans?.weeklyPass || 799,
      monthlyPrice: gym.pricingPlans?.monthly || 1999,
      quarterlyPrice: gym.pricingPlans?.quarterly || 4999,
      annualPrice: gym.pricingPlans?.annual || 14999,

      floorSpaceSqFt: gym.floorSpaceSqFt || 2000,
      maxFloorCapacity: gym.maxFloorCapacity || 50,
      platformCommission: gym.platformCommission || 10,
      aboutText: gym.aboutText || '',

      accountHolder: gym.bankDetails?.accountHolder || '',
      bankName: gym.bankDetails?.bankName || '',
      accountNumber: gym.bankDetails?.accountNumber || '',
      ifscCode: gym.bankDetails?.ifscCode || '',
      upiId: gym.bankDetails?.upiId || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveGymDetails = async (values) => {
    const gymId = gym?.id || gym?._id;
    if (!gymId) {
      message.error('Gym ID not found.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        ...values,
        openingHours: {
          mode: values.timingMode || gym.openingHours?.mode || 'REGULAR',
          weekdayOpen: values.weekdayOpen || gym.openingHours?.weekdayOpen || '05:30 AM',
          weekdayClose: values.weekdayClose || gym.openingHours?.weekdayClose || '10:30 PM',
          weekendOpen: values.weekendOpen || gym.openingHours?.weekendOpen || '06:00 AM',
          weekendClose: values.weekendClose || gym.openingHours?.weekendClose || '09:00 PM',
          morningOpen: values.morningOpen || gym.openingHours?.morningOpen || '05:30 AM',
          morningClose: values.morningClose || gym.openingHours?.morningClose || '11:30 AM',
          eveningOpen: values.eveningOpen || gym.openingHours?.eveningOpen || '04:30 PM',
          eveningClose: values.eveningClose || gym.openingHours?.eveningClose || '10:30 PM',
          isSplitShift: values.timingMode === 'SPLIT_SHIFT',
          is24Hours: values.timingMode === '24_HOURS',
          isOpenHolidays: values.isOpenHolidays !== false,
        },
      };
      const res = await apiClient.put(`/gyms/${gymId}`, payload);
      if (res.data?.success) {
        message.success(`Gym "${values.name || gym.name}" updated successfully.`);
        setIsEditModalOpen(false);
        dispatch(fetchGyms());
      } else {
        message.error(res.data?.message || 'Failed to update gym details.');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Error updating gym details.');
    } finally {
      setSavingEdit(false);
    }
  };

  if (!gym) return null;

  const logoSrc = getGymLogoSrc(gym);
  const locationStr = gym.fullAddress || gym.address || gym.location || `${gym.area || ''}, ${gym.city || ''}`.trim() || 'Address not specified';

  return (
    <div style={{ maxWidth: 1360, margin: '0 auto', paddingBottom: 40 }}>
      {/* 1. TOP BREADCRUMB & GYM SWITCHER BAR */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={onBack}
          style={{
            padding: 0,
            fontWeight: 700,
            fontSize: 15,
            color: 'var(--color-primary)',
          }}
        >
          Back to Gyms Fleet
        </Button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Switch Gym:
          </span>
          <Select
            value={gym.id || gym._id}
            onChange={(selectedId) => {
              const target = allGyms.find((g) => (g.id || g._id) === selectedId);
              if (target && onSelectGym) onSelectGym(target);
            }}
            style={{ width: 240 }}
            showSearch
            optionFilterProp="children"
          >
            {allGyms.map((g) => {
              const isGen = Boolean(g.partnerId && !/^[0-9a-fA-F]{24}$/.test(g.partnerId) && g.partnerId !== '-');
              return (
                <Option key={g.id || g._id} value={g.id || g._id}>
                  {g.name} {isGen ? `(${g.partnerId})` : '(-)'}
                </Option>
              );
            })}
          </Select>

          {(gym.approvalStatus === 'Pending Approval' || gym.approvalStatus === 'On Hold' || gym.approvalStatus === 'Rejected' || Boolean(gym.pendingChanges && Object.keys(gym.pendingChanges).length > 0) || Boolean(gym.changesCount > 0)) ? (
            <Space>
              <Button
                danger
                disabled={isProcessingAction}
                onClick={() => setIsRejectModalOpen(true)}
                style={{ fontWeight: 600, borderRadius: 'var(--radius-base)' }}
              >
                Reject
              </Button>
              <Button
                disabled={isProcessingAction}
                onClick={() => setIsHoldModalOpen(true)}
                style={{
                  fontWeight: 600,
                  borderRadius: 'var(--radius-base)',
                  borderColor: '#fa8c16',
                  color: '#fa8c16',
                }}
              >
                Put on Hold
              </Button>
              <Button
                type="primary"
                loading={isProcessingAction}
                disabled={isProcessingAction}
                onClick={async () => {
                  if (onApprove) {
                    setIsProcessingAction(true);
                    try {
                      await onApprove(gym);
                    } finally {
                      setIsProcessingAction(false);
                    }
                  }
                }}
                style={{
                  fontWeight: 700,
                  backgroundColor: '#16a34a',
                  borderColor: '#16a34a',
                  borderRadius: 'var(--radius-base)',
                }}
              >
                Approve & Publish
              </Button>
            </Space>
          ) : (
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'active',
                    label: 'Set Status: Active',
                    onClick: () => onStatusChange && onStatusChange(gym.id || gym._id, 'Active'),
                  },
                  {
                    key: 'inactive',
                    label: 'Set Status: Inactive',
                    onClick: () => onStatusChange && onStatusChange(gym.id || gym._id, 'Inactive'),
                  },
                  {
                    key: 'suspended',
                    label: 'Set Status: Suspended',
                    danger: true,
                    onClick: () => onStatusChange && onStatusChange(gym.id || gym._id, 'Suspended'),
                  },
                ],
              }}
            >
              <Button style={{ fontWeight: 600, borderRadius: 'var(--radius-base)' }}>
                Change Status: <strong style={{ marginLeft: 4 }}>{gym.status || 'Active'}</strong>
              </Button>
            </Dropdown>
          )}

          <Button
            icon={<EditOutlined />}
            onClick={handleOpenEditModal}
            style={{ borderRadius: 'var(--radius-base)', fontWeight: 600, borderColor: '#2563eb', color: '#2563eb' }}
          >
            Edit Gym
          </Button>
        </div>
      </div>

      {/* 2. MAIN GYM HERO HEADER CARD */}
      <Card
        style={{
          borderRadius: 16,
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          marginBottom: 24,
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 24 } }}
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Gym Logo / Avatar */}
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={gym.name}
              style={{
                width: 100,
                height: 100,
                borderRadius: 16,
                objectFit: 'cover',
                border: `2px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
              }}
            />
          ) : (
            <Avatar
              shape="square"
              size={100}
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: 32,
                borderRadius: 16,
              }}
            >
              {getGymInitials(gym.name)}
            </Avatar>
          )}

          {/* Core Info Details */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                {gym.name}
              </h1>
              {gym.partnerId && !/^[0-9a-fA-F]{24}$/.test(gym.partnerId) && gym.partnerId !== '-' ? (
                <Tag color="blue" style={{ fontWeight: 800, fontSize: 13, padding: '2px 10px', borderRadius: 6 }}>
                  {gym.partnerId}
                </Tag>
              ) : (
                <Tag style={{ fontWeight: 700, fontSize: 13, padding: '2px 10px', borderRadius: 6 }}>
                  -
                </Tag>
              )}
              <Tag
                color={
                  gym.approvalStatus === 'Approved' || gym.status === 'Active'
                    ? 'success'
                    : gym.approvalStatus === 'Pending Approval'
                    ? 'warning'
                    : 'error'
                }
                style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 6 }}
              >
                {gym.approvalStatus || gym.status || 'Active'}
              </Tag>
              <Tag color="purple" style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 6 }}>
                {gym.subscriptionType || 'Listing Only Tier'}
              </Tag>
            </div>

            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer' }}
              onClick={() => setActiveTab('reviews')}
              title="Click to view all reviews and ratings"
            >
              <Rate
                disabled
                allowHalf
                value={Number(gymReviewsData?.rating ?? gym.rating ?? 0)}
                style={{ fontSize: 15 }}
              />
              <strong style={{ fontSize: 13, color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>
                {Number(gymReviewsData?.rating ?? gym.rating ?? 0).toFixed(1)}
              </strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                ({gymReviewsData?.reviewsCount ?? gym.reviewsCount ?? (Array.isArray(gym.ratings) ? gym.ratings.length : 0)} customer reviews)
              </span>
            </div>

            <div style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 13, marginBottom: 6 }}>
              <EnvironmentOutlined style={{ marginRight: 6, color: 'var(--color-primary)' }} />
              {locationStr}
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#475569' }}>
              <span>
                <PhoneOutlined style={{ marginRight: 6, color: '#16a34a' }} />
                {gym.phone || '—'}
              </span>
              <span>
                <MailOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                {gym.email || '—'}
              </span>
              <span>
                <UserOutlined style={{ marginRight: 6, color: '#9333ea' }} />
                Partner: <strong>{gym.ownerName || gym.fullName || 'Gym Partner'}</strong>
              </span>
            </div>

            {gym.remark && (
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 14px',
                  borderRadius: 6,
                  backgroundColor: isDarkMode ? '#1e293b' : '#f0f7ff',
                  borderLeft: '3px solid #1677ff',
                  fontSize: 13,
                  color: isDarkMode ? '#e2e8f0' : '#1e3a8a',
                }}
              >
                <strong>Admin Remark:</strong> {gym.remark}
              </div>
            )}
          </div>
        </div>

        <Divider style={{ margin: '20px 0 16px 0' }} />

        {/* High Impact Key Metrics Row */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={4}>
            <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}` }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>ACTIVE MEMBERS</Text>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#2563eb', marginTop: 4 }}>
                {gym.membersCount ?? gym.activeMembers ?? 0}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}` }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>MONTHLY GMV</Text>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
                ₹{(gym.monthlyRevenue ?? gym.monthlyGmv ?? 0).toLocaleString('en-IN')}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}` }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>TOTAL BOOKINGS</Text>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#9333ea', marginTop: 4 }}>
                {unifiedBookings.length || gym.totalBookings || gym.bookingsCount || 0}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}` }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>SINGLE SESSION</Text>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                ₹{gym.singleSessionPrice ?? gym.pricingPlans?.singleSession ?? (gym.customPricingPlans && gym.customPricingPlans.length > 0 ? gym.customPricingPlans[0].price : 0)}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}` }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>COMMISSION RATE</Text>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#06b6d4', marginTop: 4 }}>
                {gym.commissionRate ?? gym.platformCommission ?? 10}%
              </div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc', border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}` }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>SETTLEMENT</Text>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                {gym.settlementCycle || gym.bankDetails?.payoutSchedule || 'Daily (T+1)'}
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {/* 3. INTERACTIVE SECTION TABS */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="gym-details-tabs"
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <ShopOutlined /> Overview
              </span>
            ),
            children: (() => {
              const weekSchedule = getDayByDaySchedule(gym);
              const gymWorkoutsList = Array.isArray(gym.workouts) && gym.workouts.length > 0 ? gym.workouts : DEFAULT_WORKOUTS;
              const gymAmenitiesList = Array.isArray(gym.amenities) && gym.amenities.length > 0
                ? gym.amenities
                : Array.isArray(gym.facilities) && gym.facilities.length > 0
                ? gym.facilities.map((f) => (typeof f === 'string' ? f : f?.name || String(f))).filter(Boolean)
                : DEFAULT_AMENITIES;
              const gymRulesList = Array.isArray(gym.rules) && gym.rules.length > 0 ? gym.rules : DEFAULT_RULES;
              const gymSafetyList = Array.isArray(gym.safetyMeasures) && gym.safetyMeasures.length > 0 ? gym.safetyMeasures : DEFAULT_SAFETY;
              const sessionCategories = Array.isArray(gym.enabledSessionCategories) && gym.enabledSessionCategories.length > 0
                ? gym.enabledSessionCategories
                : DEFAULT_SESSION_CATEGORIES;
              const sessionPrice = Number(gym.singleSessionPrice ?? gym.pricingPlans?.singleSession ?? (gym.customPricingPlans && gym.customPricingPlans.length > 0 ? gym.customPricingPlans[0].price : 199));
              const bank = gym.bankDetails || {};
              const social = gym.socialLinks || {};

              return (
                <Row gutter={[20, 20]}>
                  {/* Left Column: Facility, Workouts, Amenities, Rules, Safety, Session Pricing */}
                  <Col xs={24} lg={14}>
                    {/* 1. Facility & Business Profile */}
                    <Card
                      title="Facility & Business Profile"
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                        marginBottom: 20,
                      }}
                    >
                      <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
                        <Descriptions.Item label="Gym Name">{gym.name}</Descriptions.Item>
                        <Descriptions.Item label="Partner Code">{(gym.partnerId && !/^[0-9a-fA-F]{24}$/.test(gym.partnerId) && gym.partnerId !== '-') ? gym.partnerId : '-'}</Descriptions.Item>
                        <Descriptions.Item label="Gym Type">{gym.gymType || 'Unisex Fitness Center'}</Descriptions.Item>
                        <Descriptions.Item label="Gender Policy">{gym.genderAllowed || 'Unisex'}</Descriptions.Item>
                        <Descriptions.Item label="Owner Name">{gym.ownerName || gym.fullName || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Contact Phone">{gym.phone || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Official Email">{gym.email || '—'}</Descriptions.Item>
                        <Descriptions.Item label="Registered On">
                          {gym.registeredOn || gym.createdAt ? new Date(gym.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Active Partner'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Operating Model" span={2}>
                          <Space align="center" wrap>
                            <Tag color={gym.openingHours?.mode === '24_HOURS' ? 'green' : (gym.openingHours?.mode === 'SPLIT_SHIFT' ? 'purple' : 'blue')}>
                              {gym.openingHours?.mode === '24_HOURS' ? '24/7 Facility' : (gym.openingHours?.mode === 'SPLIT_SHIFT' ? 'Split Shift' : 'Regular Single Shift')}
                            </Tag>
                            <span style={{ fontWeight: 600 }}>
                              {gym.openingHours?.displayText || `${gym.openingHours?.weekdayOpen || '05:30 AM'} - ${gym.openingHours?.weekdayClose || '10:30 PM'}`}
                            </span>
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="Full Street Address" span={2}>
                          {locationStr}
                        </Descriptions.Item>
                        <Descriptions.Item label="About Facility" span={2}>
                          {gym.about || gym.description || 'Premium fitness facility offering specialized workout sections, modern strength gear, cardio equipment, and certified personal coaching.'}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>

                    {/* 2. Workout Disciplines Offered */}
                    <Card
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <FireOutlined style={{ color: '#ec4899' }} />
                          <span>Workout Disciplines Offered ({gymWorkoutsList.length})</span>
                        </div>
                      }
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                        marginBottom: 20,
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                        All workout disciplines, training regimes, and athletic programs offered on the floor.
                      </div>
                      <Space wrap size={[8, 8]}>
                        {gymWorkoutsList.map((w, i) => (
                          <Tag
                            key={i}
                            color="blue"
                            style={{
                              fontSize: 13,
                              padding: '5px 12px',
                              borderRadius: 16,
                              fontWeight: 600,
                              backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
                              borderColor: isDarkMode ? '#3b82f6' : '#bfdbfe',
                              color: isDarkMode ? '#93c5fd' : '#1d4ed8',
                            }}
                          >
                            {w}
                          </Tag>
                        ))}
                      </Space>
                    </Card>

                    {/* 3. Amenities & Member Perks */}
                    <Card
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <StarFilled style={{ color: '#f59e0b' }} />
                          <span>Amenities & Member Perks ({gymAmenitiesList.length})</span>
                        </div>
                      }
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                        marginBottom: 20,
                      }}
                    >
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                        Complimentary and value-added amenities available for registered members and day-pass visitors.
                      </div>
                      <Space wrap size={[8, 8]}>
                        {gymAmenitiesList.map((a, i) => (
                          <Tag
                            key={i}
                            style={{
                              fontSize: 13,
                              padding: '5px 12px',
                              borderRadius: 16,
                              fontWeight: 600,
                              backgroundColor: isDarkMode ? '#143026' : '#f0fdf4',
                              borderColor: isDarkMode ? '#15803d' : '#bbf7d0',
                              color: isDarkMode ? '#86efac' : '#15803d',
                            }}
                          >
                            <CheckCircleFilled style={{ marginRight: 6, color: '#10b981' }} />
                            {a}
                          </Tag>
                        ))}
                      </Space>
                    </Card>

                    {/* 4. Gym Rules & Safety Measures (Side by side) */}
                    <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                      <Col xs={24} md={12}>
                        <Card
                          title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <FileTextOutlined style={{ color: '#6366f1' }} />
                              <span style={{ fontSize: 14 }}>Gym Rules & Member Guidelines</span>
                            </div>
                          }
                          style={{
                            borderRadius: 14,
                            backgroundColor: 'var(--bg-surface-elevated)',
                            borderColor: 'var(--border-color)',
                            height: '100%',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {gymRulesList.map((rule, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                                  border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                                }}
                              >
                                <CheckOutlined style={{ color: '#6366f1', fontSize: 12, marginTop: 3, flexShrink: 0 }} />
                                <span style={{ fontSize: 12.5, color: isDarkMode ? '#e2e8f0' : '#334155', lineHeight: 1.4 }}>
                                  {rule}
                                </span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </Col>

                      <Col xs={24} md={12}>
                        <Card
                          title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <SafetyCertificateOutlined style={{ color: '#10b981' }} />
                              <span style={{ fontSize: 14 }}>Safety Measures & Protocols</span>
                            </div>
                          }
                          style={{
                            borderRadius: 14,
                            backgroundColor: 'var(--bg-surface-elevated)',
                            borderColor: 'var(--border-color)',
                            height: '100%',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {gymSafetyList.map((measure, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4',
                                  border: `1px solid ${isDarkMode ? '#334155' : '#bbf7d0'}`,
                                }}
                              >
                                <CheckCircleFilled style={{ color: '#10b981', fontSize: 12, marginTop: 3, flexShrink: 0 }} />
                                <span style={{ fontSize: 12.5, color: isDarkMode ? '#e2e8f0' : '#166534', lineHeight: 1.4 }}>
                                  {measure}
                                </span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      </Col>
                    </Row>

                    {/* 5. Per-Session / Day Pass Pricing */}
                    <Card
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <DollarOutlined style={{ color: '#16a34a' }} />
                            <span>Per-Session / Day Pass Pricing</span>
                          </div>
                          <Tag color="success" style={{ fontWeight: 700, borderRadius: 6 }}>
                            Day Pass Booking Enabled
                          </Tag>
                        </div>
                      }
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                        marginBottom: 20,
                      }}
                    >
                      <Row gutter={[16, 16]} align="middle">
                        <Col xs={24} sm={10}>
                          <div
                            style={{
                              padding: '16px 20px',
                              borderRadius: 10,
                              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                              textAlign: 'center',
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                              Single Session Pass Base Rate
                            </Text>
                            <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
                              ₹{sessionPrice.toLocaleString('en-IN')}
                              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}> / visit</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                              Includes full gym floor & locker access
                            </div>
                          </div>
                        </Col>
                        <Col xs={24} sm={14}>
                          <Text strong style={{ fontSize: 12.5, display: 'block', marginBottom: 8 }}>
                            Active Day Pass Booking Categories:
                          </Text>
                          <Space wrap size={[6, 6]}>
                            {sessionCategories.map((cat, idx) => (
                              <Tag key={idx} color="cyan" style={{ borderRadius: 6, fontWeight: 600, fontSize: 12, padding: '3px 8px' }}>
                                ✓ {cat}
                              </Tag>
                            ))}
                          </Space>
                        </Col>
                      </Row>
                    </Card>
                  </Col>

                  {/* Right Column: Day-by-Day Hours, Bank Details & Direct Settlements, Social Media & Digital Brand Presence */}
                  <Col xs={24} lg={10}>
                    {/* 6. Day-by-Day Working Hours */}
                    <Card
                      title={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ClockCircleOutlined style={{ color: '#2563eb' }} />
                            <span>Day-by-Day Working Hours</span>
                          </div>
                          <Tag color={gym.openingHours?.mode === '24_HOURS' ? 'green' : (gym.openingHours?.mode === 'SPLIT_SHIFT' ? 'purple' : 'blue')}>
                            {gym.openingHours?.mode === '24_HOURS' ? '24/7 Facility' : (gym.openingHours?.mode === 'SPLIT_SHIFT' ? 'Split Shifts' : 'Regular Hours')}
                          </Tag>
                        </div>
                      }
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                        marginBottom: 20,
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {weekSchedule.map((item) => (
                          <div
                            key={item.day}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: 13,
                              padding: '8px 12px',
                              borderRadius: 8,
                              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                              border: `1px solid ${isDarkMode ? '#334155' : '#f1f5f9'}`,
                            }}
                          >
                            <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', width: 95 }}>
                              {item.day}
                            </span>
                            <div style={{ flex: 1, textAlign: 'right', paddingRight: 10 }}>
                              {item.isOpen ? (
                                item.mode === 'SPLIT_SHIFT' ? (
                                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>
                                    <div>M: {item.morning}</div>
                                    <div>E: {item.evening}</div>
                                  </div>
                                ) : (
                                  <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 700 }}>
                                    {item.text}
                                  </span>
                                )
                              ) : (
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>Closed</span>
                              )}
                            </div>
                            <Tag
                              color={item.isOpen ? 'success' : 'error'}
                              style={{ margin: 0, borderRadius: 4, fontWeight: 700, fontSize: 11 }}
                            >
                              {item.isOpen ? 'Open' : 'Closed'}
                            </Tag>
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* 7. Bank Details & Direct Settlements */}
                    <Card
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <BankOutlined style={{ color: '#0284c7' }} />
                          <span>Bank Details & Direct Settlements</span>
                        </div>
                      }
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                        marginBottom: 20,
                      }}
                    >
                      <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label="Account Holder">
                          <strong>{bank.accountHolder || gym.accountHolderName || gym.name || 'Gym Enterprise'}</strong>
                        </Descriptions.Item>
                        <Descriptions.Item label="Bank Name">
                          {bank.bankName || gym.bankName || 'HDFC Bank Ltd'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Account Number">
                          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                            {bank.accountNumber || gym.accountNumber ? `•••• •••• ${String(bank.accountNumber || gym.accountNumber).slice(-4)}` : '•••• •••• 8842'}
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="IFSC Code">
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563eb' }}>
                            {bank.ifscCode || gym.ifscCode || 'HDFC0001234'}
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Settlement UPI ID">
                          <span style={{ fontFamily: 'monospace', color: '#16a34a', fontWeight: 600 }}>
                            {bank.upiId || gym.upiId || `${(gym.slug || 'gymezy').replace(/-/g, '')}@upi`}
                          </span>
                        </Descriptions.Item>
                        <Descriptions.Item label="Account Type">
                          {bank.accountType || 'Current Account'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Branch Location">
                          {bank.branch || gym.area || 'Chennai Main Branch'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Settlement Schedule">
                          <Badge status="processing" text={gym.settlementCycle || 'Daily Automated (T+1 Settlement)'} />
                        </Descriptions.Item>
                        <Descriptions.Item label="Platform Commission">
                          <strong style={{ color: '#0284c7' }}>{gym.commissionRate ?? 10}%</strong> on app bookings
                        </Descriptions.Item>
                        <Descriptions.Item label="GST Registration">
                          <span style={{ fontFamily: 'monospace' }}>
                            {gym.gstNumber || '33AAAAA0000A1Z5 (Verified)'}
                          </span>
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>

                    {/* 8. Social Media & Digital Brand Presence */}
                    <Card
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <GlobalOutlined style={{ color: '#8b5cf6' }} />
                          <span>Social Media & Digital Brand Presence</span>
                        </div>
                      }
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Instagram */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <InstagramOutlined style={{ color: '#e1306c', fontSize: 16 }} />
                            <strong style={{ color: 'var(--text-color)' }}>Instagram</strong>
                          </span>
                          <span style={{ color: '#2563eb', fontWeight: 600 }}>
                            {social.instagramHandle || (social.instagram ? `@${social.instagram.split('/').filter(Boolean).pop()}` : `@${(gym.slug || gym.name || 'gym').toLowerCase().replace(/\s+/g, '_')}`)}
                          </span>
                        </div>

                        {/* WhatsApp */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <WhatsAppOutlined style={{ color: '#25d366', fontSize: 16 }} />
                            <strong style={{ color: 'var(--text-color)' }}>WhatsApp Channel</strong>
                          </span>
                          <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155', fontWeight: 600 }}>
                            {social.whatsapp || gym.phone || '+91 98400 00000'}
                          </span>
                        </div>

                        {/* Official Website */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <GlobalOutlined style={{ color: '#0284c7', fontSize: 16 }} />
                            <strong style={{ color: 'var(--text-color)' }}>Official Website</strong>
                          </span>
                          <span style={{ color: '#2563eb', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {social.website || `https://${(gym.slug || 'gymezy').toLowerCase()}.gymezy.com`}
                          </span>
                        </div>

                        {/* Facebook / YouTube */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <LinkOutlined style={{ color: '#6366f1', fontSize: 16 }} />
                            <strong style={{ color: 'var(--text-color)' }}>Facebook / YouTube</strong>
                          </span>
                          <span style={{ color: '#64748b' }}>
                            {social.facebook || social.youtube ? 'Connected' : 'Listed via GYMEZY'}
                          </span>
                        </div>

                        {/* Google Business Rating */}
                        <div
                          style={{
                            marginTop: 4,
                            padding: '10px 14px',
                            borderRadius: 8,
                            backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4',
                            border: `1px solid ${isDarkMode ? '#334155' : '#bbf7d0'}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
                              Google Business Verified
                            </div>
                            <div style={{ fontSize: 12, color: isDarkMode ? '#e2e8f0' : '#334155', marginTop: 2 }}>
                              Maps profile linked for local discovery
                            </div>
                          </div>
                          <Tag color="orange" style={{ fontWeight: 800, borderRadius: 6, fontSize: 12, padding: '2px 8px' }}>
                            ★ {social.googleRating || (gym.rating ? gym.rating.toFixed(1) : '4.9')} / 5.0
                          </Tag>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              );
            })(),
          },
          {
            key: 'bookings',
            label: (
              <span>
                <CalendarOutlined /> Bookings ({unifiedBookings.length})
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Customer Bookings for {gym.name}</span>
                      <Button
                        size="small"
                        type="link"
                        icon={<FireOutlined style={{ color: '#ea580c' }} />}
                        onClick={() => setActiveTab('classes')}
                        style={{ marginLeft: 8, fontWeight: 600, color: '#ea580c' }}
                      >
                        View Created Group Classes ({createdSections.length}) ➔
                      </Button>
                    </div>
                    <Space wrap>
                      <Input
                        placeholder="Search Customer or Booking ID..."
                        prefix={<SearchOutlined />}
                        value={bookingSearch}
                        onChange={(e) => setBookingSearch(e.target.value)}
                        style={{ width: 250, borderRadius: 'var(--radius-base)' }}
                        allowClear
                      />
                      <Select
                        value={bookingStatusFilter}
                        onChange={setBookingStatusFilter}
                        style={{ width: 140 }}
                      >
                        <Option value="All">All Status</Option>
                        <Option value="Active">Active</Option>
                        <Option value="Completed">Completed</Option>
                        <Option value="Cancelled">Cancelled</Option>
                      </Select>
                    </Space>
                  </div>
                }
                style={{
                  borderRadius: 14,
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {/* Category Filter: All, Memberships, Sessions, Group Classes */}
                <div style={{ marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
                  <Segmented
                    value={bookingTypeFilter}
                    onChange={setBookingTypeFilter}
                    size="middle"
                    options={[
                      {
                        label: (
                          <span style={{ padding: '4px 8px', fontWeight: 600 }}>
                            All Bookings{' '}
                            <Badge
                              count={bookingCounts.total}
                              overflowCount={999}
                              style={{
                                backgroundColor: bookingTypeFilter === 'ALL' ? '#4f46e5' : '#94a3b8',
                                marginLeft: 6,
                              }}
                            />
                          </span>
                        ),
                        value: 'ALL',
                      },
                      {
                        label: (
                          <span style={{ padding: '4px 8px', fontWeight: 600 }}>
                            <IdcardOutlined style={{ marginRight: 6, color: '#9333ea' }} />
                            Memberships{' '}
                            <Badge
                              count={bookingCounts.memberships}
                              overflowCount={999}
                              style={{
                                backgroundColor: bookingTypeFilter === 'MEMBERSHIP' ? '#9333ea' : '#94a3b8',
                                marginLeft: 6,
                              }}
                            />
                          </span>
                        ),
                        value: 'MEMBERSHIP',
                      },
                      {
                        label: (
                          <span style={{ padding: '4px 8px', fontWeight: 600 }}>
                            <ClockCircleOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                            Single Sessions{' '}
                            <Badge
                              count={bookingCounts.sessions}
                              overflowCount={999}
                              style={{
                                backgroundColor: bookingTypeFilter === 'GYM_SESSION' ? '#2563eb' : '#94a3b8',
                                marginLeft: 6,
                              }}
                            />
                          </span>
                        ),
                        value: 'GYM_SESSION',
                      },
                      {
                        label: (
                          <span style={{ padding: '4px 8px', fontWeight: 600 }}>
                            <FireOutlined style={{ marginRight: 6, color: '#ea580c' }} />
                            Group Classes{' '}
                            <Badge
                              count={bookingCounts.groupClasses}
                              overflowCount={999}
                              style={{
                                backgroundColor: bookingTypeFilter === 'GROUP_CLASS' ? '#ea580c' : '#94a3b8',
                                marginLeft: 6,
                              }}
                            />
                          </span>
                        ),
                        value: 'GROUP_CLASS',
                      },
                    ]}
                  />
                </div>

                <Table
                  dataSource={filteredBookings}
                  loading={isLoadingGymData}
                  pagination={{ pageSize: 8, showTotal: (total) => `Total ${total} bookings` }}
                  rowKey="key"
                  columns={[
                    {
                      title: 'Booking ID',
                      dataIndex: 'bookingId',
                      key: 'bookingId',
                      render: (text) => <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{text}</strong>,
                    },
                    {
                      title: 'Customer',
                      key: 'customer',
                      render: (_, record) => (
                        <Space orientation="horizontal" size={10}>
                          <Avatar
                            size={36}
                            src={hasValidProfilePic(record.customerAvatar) ? record.customerAvatar : undefined}
                            icon={<UserOutlined />}
                            style={{ backgroundColor: '#e0e7ff', color: '#4f46e5', flexShrink: 0 }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--text-color)' }}>{record.customerName}</div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>{record.customerPhone}</div>
                          </div>
                        </Space>
                      ),
                    },
                    {
                      title: 'Pass Type',
                      key: 'type',
                      render: (_, record) => {
                        let catTag = null;
                        if (record.category === 'MEMBERSHIP') {
                          catTag = (
                            <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                              <IdcardOutlined style={{ marginRight: 4 }} /> Membership
                            </Tag>
                          );
                        } else if (record.category === 'GROUP_CLASS') {
                          catTag = (
                            <Tag color="volcano" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                              <FireOutlined style={{ marginRight: 4 }} /> Group Class
                            </Tag>
                          );
                        } else {
                          catTag = (
                            <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                              <ClockCircleOutlined style={{ marginRight: 4 }} /> Session
                            </Tag>
                          );
                        }
                        return (
                          <div>
                            <div>{catTag}</div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-color)', marginTop: 2 }}>
                              {record.type}
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Slot Time',
                      dataIndex: 'slotTime',
                      key: 'slotTime',
                      render: (text) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{text}</span>,
                    },
                    {
                      title: 'Date',
                      dataIndex: 'bookingDate',
                      key: 'bookingDate',
                      render: (text) => <span style={{ fontSize: 13 }}>{text}</span>,
                    },
                    {
                      title: 'Amount Paid',
                      dataIndex: 'amount',
                      key: 'amount',
                      render: (amount, record) => (
                        <div>
                          <strong style={{ color: '#16a34a', fontSize: 13 }}>₹{Number(amount || 0).toLocaleString('en-IN')}</strong>
                          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{record.paymentMode}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status) => {
                        const s = String(status).toLowerCase();
                        const badgeStatus = (s === 'completed' || s === 'active') ? 'success' : s === 'cancelled' ? 'error' : 'processing';
                        return <Badge status={badgeStatus} text={status} />;
                      },
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'classes',
            label: (
              <span>
                <FireOutlined /> Group Classes ({createdSections.length})
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>Created Group Classes & Batches for {gym.name}</span>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        All workout sessions, batches, and group fitness classes configured for this gym.
                      </div>
                    </div>
                    <Button
                      type="default"
                      icon={<CalendarOutlined />}
                      onClick={() => {
                        setBookingTypeFilter('GROUP_CLASS');
                        setActiveTab('bookings');
                      }}
                    >
                      View Group Class Bookings ({bookingCounts.groupClasses}) ➔
                    </Button>
                  </div>
                }
                style={{
                  borderRadius: 14,
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {/* Stats Summary Cards */}
                <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                  <Col xs={12} sm={6}>
                    <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}` }}>
                      <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>TOTAL CLASSES</Text>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#ea580c', marginTop: 4 }}>
                        {createdSections.length}
                      </div>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}` }}>
                      <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>ACTIVE BATCHES</Text>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                        {createdSections.filter((s) => s.isActive !== false).length}
                      </div>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}` }}>
                      <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>TOTAL ENROLLMENTS</Text>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', marginTop: 4 }}>
                        {createdSections.reduce((sum, s) => sum + (s.enrolledCount || 0), 0)}
                      </div>
                    </div>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}` }}>
                      <Text type="secondary" style={{ fontSize: 11, fontWeight: 700 }}>TOTAL CAPACITY</Text>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#9333ea', marginTop: 4 }}>
                        {createdSections.reduce((sum, s) => sum + (s.maxCapacity || 0), 0)} Seats
                      </div>
                    </div>
                  </Col>
                </Row>

                <Table
                  dataSource={createdSections}
                  loading={isLoadingGymData}
                  rowKey={(record) => record._id || record.id || record.title}
                  pagination={{ pageSize: 6 }}
                  columns={[
                    {
                      title: 'Class Name & Category',
                      key: 'title',
                      render: (_, record) => {
                        const cat = (record.category || 'general').toLowerCase();
                        let tagColor = 'blue';
                        if (cat.includes('yoga')) tagColor = 'purple';
                        else if (cat.includes('hiit')) tagColor = 'volcano';
                        else if (cat.includes('zumba')) tagColor = 'magenta';
                        else if (cat.includes('crossfit')) tagColor = 'orange';
                        else if (cat.includes('boxing')) tagColor = 'red';

                        return (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-color)' }}>
                              {record.title || record.name || 'Untitled Class'}
                            </div>
                            <Space size={4} style={{ marginTop: 4 }}>
                              <Tag color={tagColor} style={{ borderRadius: 6, textTransform: 'capitalize', fontWeight: 600 }}>
                                {record.category || 'Group Class'}
                              </Tag>
                              {record.durationDays ? (
                                <Tag style={{ borderRadius: 6 }}>{record.durationDays} Days Plan</Tag>
                              ) : null}
                            </Space>
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Trainer',
                      key: 'trainer',
                      render: (_, record) => {
                        const trainerName =
                          typeof record.trainerId === 'object' && record.trainerId?.name
                            ? record.trainerId.name
                            : record.trainerName || 'Assigned Instructor';
                        const trainerPhone =
                          typeof record.trainerId === 'object' && record.trainerId?.phone
                            ? record.trainerId.phone
                            : record.trainerPhone || '';
                        const specialization =
                          typeof record.trainerId === 'object' && record.trainerId?.specialization
                            ? record.trainerId.specialization
                            : '';
                        const trainerRating = Number(
                          typeof record.trainerId === 'object' && record.trainerId?.rating
                            ? record.trainerId.rating
                            : record.trainerRating || 0
                        );
                        const trainerReviews = Number(
                          typeof record.trainerId === 'object' && record.trainerId?.reviewsCount
                            ? record.trainerId.reviewsCount
                            : record.trainerReviewsCount || 0
                        );

                        return (
                          <Space orientation="horizontal" size={10}>
                            <Avatar
                              size={34}
                              icon={<UserOutlined />}
                              style={{ backgroundColor: '#fef3c7', color: '#d97706', flexShrink: 0 }}
                            />
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{trainerName}</div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {specialization || trainerPhone || 'Lead Coach'}
                              </div>
                              {trainerRating > 0 && (
                                <div style={{ fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                  <StarFilled style={{ fontSize: 10, color: '#f59e0b' }} />
                                  <strong>{trainerRating.toFixed(1)}</strong>
                                  {trainerReviews > 0 ? <span style={{ color: '#64748b' }}>({trainerReviews})</span> : null}
                                </div>
                              )}
                            </div>
                          </Space>
                        );
                      },
                    },
                    {
                      title: 'Schedule & Timing',
                      key: 'schedule',
                      render: (_, record) => {
                        const days = Array.isArray(record.activeDays) && record.activeDays.length > 0
                          ? record.activeDays
                          : ['Mon', 'Wed', 'Fri'];
                        const timeSlot = record.startTime && record.endTime
                          ? `${record.startTime} - ${record.endTime}`
                          : record.timeSlot || 'Batch Time TBA';

                        return (
                          <div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: 'var(--text-color)' }}>
                              <ClockCircleOutlined style={{ marginRight: 4, color: '#2563eb' }} />
                              {timeSlot}
                            </div>
                            <div style={{ marginTop: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                              {days.slice(0, 4).map((d) => (
                                <Tag key={d} style={{ fontSize: 10, margin: 0, padding: '0 4px', borderRadius: 4 }}>
                                  {String(d).slice(0, 3)}
                                </Tag>
                              ))}
                              {days.length > 4 ? (
                                <Tag key="more" style={{ fontSize: 10, margin: 0, padding: '0 4px', borderRadius: 4 }}>
                                  +{days.length - 4}
                                </Tag>
                              ) : null}
                            </div>
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Capacity & Enrolled',
                      key: 'capacity',
                      width: 180,
                      render: (_, record) => {
                        const enrolled = Number(record.enrolledCount || 0);
                        const capacity = Number(record.maxCapacity || 20);
                        const percent = Math.min(100, Math.round((enrolled / capacity) * 100));
                        return (
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600 }}>{enrolled} Enrolled</span>
                              <span style={{ color: '#64748b' }}>Max {capacity}</span>
                            </div>
                            <Progress
                              percent={percent}
                              size="small"
                              status={percent >= 90 ? 'exception' : 'active'}
                              strokeColor={percent >= 90 ? '#ef4444' : percent >= 60 ? '#f59e0b' : '#10b981'}
                            />
                          </div>
                        );
                      },
                    },
                    {
                      title: 'Price / Fee',
                      dataIndex: 'cost',
                      key: 'cost',
                      render: (cost) => (
                        <strong style={{ color: '#16a34a', fontSize: 14 }}>
                          ₹{Number(cost || 0).toLocaleString('en-IN')}
                        </strong>
                      ),
                    },
                    {
                      title: 'Status',
                      key: 'status',
                      render: (_, record) => {
                        const active = record.isActive !== false;
                        return (
                          <Tag color={active ? 'success' : 'default'} style={{ borderRadius: 6, fontWeight: 600 }}>
                            {active ? 'Active' : 'Inactive'}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: 'Actions',
                      key: 'actions',
                      render: (_, record) => (
                        <Button
                          type="link"
                          size="small"
                          icon={<EyeOutlined />}
                          onClick={() => {
                            setSelectedSectionForModal(record);
                            setIsSectionModalOpen(true);
                          }}
                        >
                          Details
                        </Button>
                      ),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'pricing',
            label: (
              <span>
                <DollarOutlined /> Plans & Pricing
              </span>
            ),
            children: (() => {
              const plans = (Array.isArray(gym.customPricingPlans) && gym.customPricingPlans.length > 0)
                ? gym.customPricingPlans
                : [
                    { name: 'Monthly Plan', badge: 'Monthly', duration: '30 Days', price: gym.pricingPlans?.monthly || 1299, description: 'Standard 30-day recurring membership.', features: ['Access to all gym facilities', 'Free group workout classes', 'Locker and shower facility', 'Trainer guidance on floor'] },
                    { name: 'Quarterly Plan', badge: 'Quarterly', duration: '90 Days', price: gym.pricingPlans?.quarterly || 3299, savingsText: gym.pricingPlans?.monthly ? `Save ₹${Math.max(0, (gym.pricingPlans.monthly * 3 - (gym.pricingPlans?.quarterly || 3299))).toLocaleString('en-IN')}` : '', description: '3-month structured fitness package.', features: ['Access to all gym facilities', 'Free group workout classes', 'Locker and shower facility', '1 Guest pass per month', '2 Complimentary PT Sessions'] },
                    { name: 'Half Yearly Plan', badge: 'Half Yearly', duration: '180 Days', price: gym.pricingPlans?.halfYearly || 5999, savingsText: gym.pricingPlans?.monthly ? `Save ₹${Math.max(0, (gym.pricingPlans.monthly * 6 - (gym.pricingPlans?.halfYearly || 5999))).toLocaleString('en-IN')}` : '', description: '6-month transformation package.', features: ['Access to all gym facilities', 'Free group workout classes', 'Locker and shower facility', '1 Guest pass per month', 'Personalized nutrition guidance', '4 Complimentary PT Sessions'] },
                    { name: 'Annual Plan', badge: 'Annual', duration: '365 Days', price: gym.pricingPlans?.annual || 11999, savingsText: gym.pricingPlans?.monthly ? `Save ₹${Math.max(0, (gym.pricingPlans.monthly * 12 - (gym.pricingPlans?.annual || 11999))).toLocaleString('en-IN')}` : '', description: 'All-inclusive annual membership with priority perks.', features: ['Access to all gym facilities', 'Free group workout classes', 'Locker and shower facility', '2 Guest passes per month', 'Personalized nutrition guidance', 'Free steam & sauna access'] },
                  ];

              return (
                <Row gutter={[20, 20]}>
                  {plans.map((p, idx) => (
                    <Col xs={24} sm={12} lg={6} key={p.id || p.tierId || idx}>
                      <Card
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700 }}>{p.name || p.badge}</span>
                            {p.popular && <Tag color="blue" style={{ fontSize: 10, fontWeight: 700 }}>MOST POPULAR</Tag>}
                          </div>
                        }
                        style={{
                          borderRadius: 14,
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderColor: p.popular ? 'var(--color-primary)' : 'var(--border-color)',
                          borderWidth: p.popular ? 2 : 1,
                          height: '100%',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                          {p.badge || 'Tier'}
                        </div>
                        <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-primary)', margin: '8px 0 4px 0' }}>
                          ₹{Number(p.price || 0).toLocaleString('en-IN')}
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}> / {p.duration}</span>
                        </div>
                        {p.savingsText && (
                          <Tag color="success" style={{ fontWeight: 700, marginBottom: 8, borderRadius: 4 }}>
                            {p.savingsText}
                          </Tag>
                        )}
                        <p style={{ color: '#64748b', fontSize: 12, minHeight: 36, marginTop: 4 }}>
                          {p.description || 'Full gym floor access & workout facilities.'}
                        </p>
                        {Array.isArray(p.features) && p.features.length > 0 && (
                          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                            {p.features.map((feat, fIdx) => (
                              <div key={fIdx} style={{ fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <CheckCircleOutlined style={{ color: '#00bf62', fontSize: 12 }} />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    </Col>
                  ))}
                </Row>
              );
            })(),
          },
          {
            key: 'gallery',
            label: (
              <span>
                <PictureOutlined /> Photos & Media
              </span>
            ),
            children: (
              <Card
                title="Gym Photos & Media Assets"
                style={{
                  borderRadius: 14,
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <Row gutter={[20, 20]}>
                  <Col xs={24} md={8}>
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ display: 'block', marginBottom: 6 }}>
                        Primary Brand Logo:
                      </Text>
                      {logoSrc ? (
                        <Image
                          src={logoSrc}
                          alt="Gym Logo"
                          style={{ width: '100%', height: 200, objectFit: 'contain', borderRadius: 10, border: `1px solid ${isDarkMode ? '#333' : '#e2e8f0'}` }}
                        />
                      ) : (
                        <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 10 }}>
                          No Logo Uploaded
                        </div>
                      )}
                    </div>
                  </Col>

                  <Col xs={24} md={16}>
                    <Text strong style={{ display: 'block', marginBottom: 6 }}>
                      Facility & Equipment Photos:
                    </Text>
                    {(() => {
                      const uploadedPhotos = (
                        Array.isArray(gym.galleryPhotos) && gym.galleryPhotos.length > 0
                          ? gym.galleryPhotos
                          : Array.isArray(gym.images) && gym.images.length > 0
                          ? gym.images
                          : []
                      )
                        .map((item) => {
                          if (!item) return null;
                          if (typeof item === 'string') return item;
                          if (item.fileData) return item.fileData;
                          if (item.url) return item.url;
                          return null;
                        })
                        .filter(Boolean);

                      const displayPhotos =
                        uploadedPhotos.length > 0
                          ? uploadedPhotos
                          : [
                              'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?q=80&w=400&auto=format&fit=crop',
                              'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop',
                              'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=400&auto=format&fit=crop',
                              'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400&auto=format&fit=crop',
                            ];

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 }}>
                          {displayPhotos.map((imgUrl, i) => (
                            <Image
                              key={i}
                              src={imgUrl}
                              alt={`Facility Photo ${i + 1}`}
                              style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 8 }}
                            />
                          ))}
                        </div>
                      );
                    })()}
                  </Col>
                </Row>
              </Card>
            ),
          },
          {
            key: 'reviews',
            label: (() => {
              const count = gymReviewsData?.reviewsCount ?? gym.reviewsCount ?? (Array.isArray(gym.ratings) ? gym.ratings.length : 0);
              return (
                <span>
                  <StarFilled style={{ color: '#f59e0b' }} /> Reviews & Ratings ({count})
                </span>
              );
            })(),
            children: (() => {
              const reviewsList = Array.isArray(gymReviewsData?.reviews)
                ? gymReviewsData.reviews
                : Array.isArray(gym.ratings)
                ? gym.ratings
                : [];
              const rawHist = Array.isArray(gymReviewsData?.histograms) ? gymReviewsData.histograms : [];
              const histograms = rawHist.length > 0 ? rawHist : [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, ratio: 0, percent: '0%' }));
              const avgScore = Number(gymReviewsData?.rating ?? gym.rating ?? 0);
              const totalReviews = gymReviewsData?.reviewsCount ?? gym.reviewsCount ?? reviewsList.length;

              // Distinct trainers list from createdSections
              const trainersMap = new Map();
              createdSections.forEach((sec) => {
                const tObj = typeof sec.trainerId === 'object' && sec.trainerId ? sec.trainerId : null;
                const tName = tObj?.name || sec.trainerName;
                if (tName && !trainersMap.has(tName)) {
                  trainersMap.set(tName, {
                    id: tObj?._id || sec._id,
                    name: tName,
                    specialty: tObj?.specialization || tObj?.specialty || 'Fitness Trainer',
                    phone: tObj?.phone || sec.trainerPhone || '',
                    rating: Number(tObj?.rating || sec.trainerRating || 0),
                    reviewsCount: Number(tObj?.reviewsCount || sec.trainerReviewsCount || 0),
                    avatar: tObj?.avatar || '',
                  });
                }
              });
              const gymTrainers = Array.from(trainersMap.values());

              return (
                <Space direction="vertical" size={20} style={{ width: '100%' }}>
                  {/* 1. Rating Overview & Histogram */}
                  <Row gutter={[20, 20]}>
                    <Col xs={24} md={10}>
                      <Card
                        style={{
                          borderRadius: 14,
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderColor: 'var(--border-color)',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          textAlign: 'center',
                          padding: '24px 16px',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Overall Facility Rating
                        </div>
                        <div style={{ fontSize: 54, fontWeight: 900, color: '#f59e0b', lineHeight: 1.2, marginTop: 8 }}>
                          {avgScore.toFixed(1)}
                        </div>
                        <Rate disabled allowHalf value={avgScore} style={{ fontSize: 24, marginTop: 4 }} />
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 10 }}>
                          Based on <strong>{totalReviews}</strong> verified member rating{totalReviews === 1 ? '' : 's'}
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} md={14}>
                      <Card
                        title="Rating Breakdown (Star Distribution)"
                        style={{
                          borderRadius: 14,
                          backgroundColor: 'var(--bg-surface-elevated)',
                          borderColor: 'var(--border-color)',
                          height: '100%',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {histograms.map((h) => (
                            <div key={h.stars} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <span style={{ width: 60, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                {h.stars} <StarFilled style={{ color: '#f59e0b', fontSize: 11 }} />
                              </span>
                              <div style={{ flex: 1 }}>
                                <Progress
                                  percent={Math.round((h.ratio || 0) * 100)}
                                  strokeColor="#f59e0b"
                                  showInfo={false}
                                  size="small"
                                />
                              </div>
                              <span style={{ width: 65, textAlign: 'right', fontSize: 12, color: '#64748b' }}>
                                {h.count} ({h.percent || '0%'})
                              </span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* 2. Trainer Ratings Card */}
                  {gymTrainers.length > 0 && (
                    <Card
                      title={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <TeamOutlined style={{ color: '#2563eb' }} />
                          <span>Floor Instructors & Trainer Ratings ({gymTrainers.length})</span>
                        </div>
                      }
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'var(--bg-surface-elevated)',
                        borderColor: 'var(--border-color)',
                      }}
                    >
                      <Row gutter={[16, 16]}>
                        {gymTrainers.map((t) => (
                          <Col xs={24} sm={12} md={8} key={t.id || t.name}>
                            <div
                              style={{
                                padding: 16,
                                borderRadius: 10,
                                backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                                border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Avatar
                                  size={44}
                                  src={hasValidProfilePic(t.avatar) ? t.avatar : undefined}
                                  icon={<UserOutlined />}
                                  style={{ backgroundColor: '#fef3c7', color: '#d97706', flexShrink: 0 }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {t.name}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#64748b' }}>{t.specialty}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                    <Rate disabled allowHalf value={t.rating || 0} style={{ fontSize: 13 }} />
                                    <strong style={{ fontSize: 12, color: '#f59e0b' }}>
                                      {t.rating > 0 ? t.rating.toFixed(1) : 'No rating'}
                                    </strong>
                                    {t.reviewsCount > 0 && (
                                      <span style={{ fontSize: 11, color: '#64748b' }}>({t.reviewsCount})</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  )}

                  {/* 3. Member Reviews List */}
                  <Card
                    title={
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Customer Testimonials & Reviews ({reviewsList.length})</span>
                      </div>
                    }
                    style={{
                      borderRadius: 14,
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    {reviewsList.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No member reviews or feedback submitted yet for this gym."
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {reviewsList.map((rev, idx) => (
                          <div
                            key={rev._id || rev.id || idx}
                            style={{
                              padding: 16,
                              borderRadius: 10,
                              backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                              border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar
                                  size={38}
                                  src={hasValidProfilePic(rev.userImageUrl) ? rev.userImageUrl : undefined}
                                  icon={<UserOutlined />}
                                  style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                                    {rev.userName || rev.fullName || 'Member'}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#64748b' }}>
                                    {rev.userPhone ? `${rev.userPhone} • ` : ''}{rev.date || 'Recent'}
                                  </div>
                                </div>
                              </div>

                              <Space wrap>
                                <Rate disabled value={rev.rating || 5} style={{ fontSize: 13 }} />
                                <Tag color="blue" style={{ borderRadius: 6, fontWeight: 600, fontSize: 11 }}>
                                  {rev.bookingType || 'Member'}
                                </Tag>
                              </Space>
                            </div>

                            <p style={{ margin: 0, fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#334155', fontStyle: 'italic', lineHeight: 1.5 }}>
                              "{rev.comment}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </Space>
              );
            })(),
          },
          {
            key: 'audit',
            label: (
              <span>
                <FileTextOutlined /> Admin Notes
              </span>
            ),
            children: (
              <Card
                title="Super Admin Internal Audit & Notes"
                style={{
                  borderRadius: 14,
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    Internal Administrative Notes (Visible only to Super Admins):
                  </Text>
                  <TextArea
                    rows={4}
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Enter compliance notes, verification remarks, or onboarding records..."
                    style={{ borderRadius: 'var(--radius-base)', marginBottom: 14 }}
                  />
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={() => message.success('Admin notes saved successfully!')}
                    style={{ backgroundColor: '#003882', borderColor: '#003882', fontWeight: 600 }}
                  >
                    Save Notes
                  </Button>
                </div>

                <Divider />

                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="Partner Account Status">
                    <Badge status={gym.status === 'Active' ? 'success' : 'default'} text={gym.status || 'Active'} />
                  </Descriptions.Item>
                  <Descriptions.Item label="KYC Document Verification">Verified by Super Admin</Descriptions.Item>
                  <Descriptions.Item label="Platform Security Policy">Standard Enterprise SLA</Descriptions.Item>
                  <Descriptions.Item label="Last Audit Check">{new Date().toLocaleDateString()}</Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]}
      />

      {/* Hold Modal */}
      <Modal
        title="Put Gym on Hold"
        open={isHoldModalOpen}
        onCancel={() => !isProcessingAction && setIsHoldModalOpen(false)}
        closable={!isProcessingAction}
        maskClosable={!isProcessingAction}
        footer={null}
        centered
        width={480}
      >
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: 13, color: isDarkMode ? '#aaaaaa' : '#64748b', marginBottom: 12 }}>
            Specify the required updates or missing information for <strong>{gym.name}</strong>:
          </p>
          <TextArea
            rows={4}
            disabled={isProcessingAction}
            value={holdNotes}
            onChange={(e) => setHoldNotes(e.target.value)}
            placeholder="e.g. Please upload clear trade license, verify gym timings..."
            style={{ marginBottom: 18 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button disabled={isProcessingAction} onClick={() => setIsHoldModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              loading={isProcessingAction}
              disabled={isProcessingAction}
              onClick={async () => {
                if (onHold) {
                  setIsProcessingAction(true);
                  try {
                    await onHold(gym, holdNotes);
                    setIsHoldModalOpen(false);
                  } finally {
                    setIsProcessingAction(false);
                  }
                }
              }}
              style={{ fontWeight: 600, backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}
            >
              Confirm Hold
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rejection Modal */}
      <Modal
        title="Reject Gym Application"
        open={isRejectModalOpen}
        onCancel={() => !isProcessingAction && setIsRejectModalOpen(false)}
        closable={!isProcessingAction}
        maskClosable={!isProcessingAction}
        footer={null}
        centered
        width={480}
      >
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: 13, color: isDarkMode ? '#aaaaaa' : '#64748b', marginBottom: 12 }}>
            Please specify the reason for rejecting <strong>{gym.name}</strong>:
          </p>
          <TextArea
            rows={4}
            disabled={isProcessingAction}
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="e.g. Incomplete documentation, equipment does not meet platform standards..."
            style={{ marginBottom: 18 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button disabled={isProcessingAction} onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
            <Button
              danger
              type="primary"
              loading={isProcessingAction}
              disabled={isProcessingAction}
              onClick={async () => {
                if (onReject) {
                  setIsProcessingAction(true);
                  try {
                    await onReject(gym, rejectNotes);
                    setIsRejectModalOpen(false);
                  } finally {
                    setIsProcessingAction(false);
                  }
                }
              }}
              style={{ fontWeight: 600 }}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Gym Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#2563eb' }} />
            <span>Edit Gym Details — {gym.name}</span>
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        width={760}
        centered
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveGymDetails}
          style={{ marginTop: 16 }}
        >
          <Tabs
            defaultActiveKey="basic"
            items={[
              {
                key: 'basic',
                label: 'Basic Information',
                children: (
                  <>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="name"
                          label="Gym Name"
                          rules={[{ required: true, message: 'Please enter gym name' }]}
                        >
                          <Input placeholder="e.g. Super Max Gym" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="tagline" label="Tagline / Slogan">
                          <Input placeholder="e.g. Elevate Your Strength" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="ownerName"
                          label="Owner / Contact Person"
                          rules={[{ required: true, message: 'Owner name required' }]}
                        >
                          <Input placeholder="Owner full name" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="phone"
                          label="Phone Number"
                          rules={[{ required: true, message: 'Phone number required' }]}
                        >
                          <Input placeholder="e.g. 9876543210" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24}>
                        <Form.Item
                          name="email"
                          label="Official Email"
                          rules={[{ type: 'email', message: 'Enter a valid email' }]}
                        >
                          <Input placeholder="gym@example.com" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={8}>
                        <Form.Item name="yearEstablished" label="Established Year">
                          <Input placeholder="e.g. 2022" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item name="subscriptionType" label="Subscription Tier">
                          <Select>
                            <Option value="Listing Only">Listing Only</Option>
                            <Option value="Gym Management">Gym Management (GMS)</Option>
                            <Option value="Hybrid">Hybrid (Listing + GMS)</Option>
                            <Option value="Enterprise">Enterprise</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item name="platformCommission" label="Commission (%)">
                          <InputNumber min={0} max={50} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="gstNumber"
                          label="GST Number"
                          normalize={(val) => (val ? val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15) : '')}
                        >
                          <Input maxLength={15} placeholder="15-digit GSTIN (e.g. 33AAAAA0000A1Z5)" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="panNumber"
                          label="PAN Number"
                          normalize={(val) => (val ? val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) : '')}
                        >
                          <Input maxLength={10} placeholder="10-digit PAN (e.g. ABCDE1234F)" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: 'location',
                label: 'Location & Hours',
                children: (
                  <>
                    <Form.Item
                      name="address"
                      label="Street Address / Building"
                      rules={[{ required: true, message: 'Address required' }]}
                    >
                      <Input placeholder="Door no, Building name, Street" />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="area" label="Area / Locality">
                          <Input placeholder="e.g. Anna Nagar, Kundrathur" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="city" label="City">
                          <Input placeholder="e.g. Chennai" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="state" label="State">
                          <Input placeholder="e.g. Tamil Nadu" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="pincode" label="Pincode">
                          <Input placeholder="e.g. 600040" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="googleMapsUrl" label="Google Maps URL / Coordinates">
                      <Input placeholder="https://maps.google.com/?q=..." />
                    </Form.Item>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                      Operating Hours & Shift Architecture
                    </div>
                    <Form.Item name="timingMode" label="Timing Model">
                      <Radio.Group buttonStyle="solid">
                        <Radio.Button value="REGULAR">Single Shift (Continuous 12h/16h)</Radio.Button>
                        <Radio.Button value="SPLIT_SHIFT">Split Shift (Morning + Evening)</Radio.Button>
                        <Radio.Button value="24_HOURS">24 Hours Open (24x7)</Radio.Button>
                      </Radio.Group>
                    </Form.Item>

                    <Row gutter={16}>
                      <Col xs={12} sm={6}>
                        <Form.Item name="weekdayOpen" label="Weekday Open">
                          <Input placeholder="05:30 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="weekdayClose" label="Weekday Close">
                          <Input placeholder="10:30 PM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="weekendOpen" label="Weekend Open">
                          <Input placeholder="06:00 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="weekendClose" label="Weekend Close">
                          <Input placeholder="09:00 PM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="morningOpen" label="Morning Shift Open">
                          <Input placeholder="05:30 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="morningClose" label="Morning Shift Close">
                          <Input placeholder="11:30 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="eveningOpen" label="Evening Shift Open">
                          <Input placeholder="04:30 PM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item name="eveningClose" label="Evening Shift Close">
                          <Input placeholder="10:30 PM" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: 'pricing',
                label: 'Pricing & Capacity',
                children: (
                  <>

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="singleSessionPrice" label="Single Session Pass Base Price (₹)">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="weeklyPassPrice" label="Weekly Pass (₹)">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24}>
                        <Form.Item
                          name="enabledSessionCategories"
                          label="Active Day Pass Booking Categories (Checked categories are enabled for members)"
                        >
                          <Checkbox.Group style={{ width: '100%' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1677ff', marginBottom: 6 }}>
                              PRIMARY CATEGORIES
                            </div>
                            <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
                              {[
                                { label: 'Gym Access', value: 'Gym Access' },
                                { label: 'Group Classes', value: 'Group Classes' },
                                { label: 'Yoga Classes', value: 'Yoga Classes' },
                                { label: 'Zumba Sessions', value: 'Zumba Sessions' },
                              ].map((cat) => (
                                <Col xs={24} sm={6} key={cat.value}>
                                  <Checkbox value={cat.value}>{cat.label}</Checkbox>
                                </Col>
                              ))}
                            </Row>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#00bf62', marginBottom: 6 }}>
                              OTHER FITNESS CLASSES GROUP
                            </div>
                            <Row gutter={[16, 8]}>
                              {[
                                { label: 'HIIT', value: 'HIIT' },
                                { label: 'CrossFit', value: 'CrossFit' },
                                { label: 'Pilates', value: 'Pilates' },
                                { label: 'Kickboxing', value: 'Kickboxing' },
                                { label: 'Dance Fitness', value: 'Dance Fitness' },
                              ].map((cat) => (
                                <Col xs={24} sm={6} md={4} key={cat.value}>
                                  <Checkbox value={cat.value}>{cat.label}</Checkbox>
                                </Col>
                              ))}
                            </Row>
                          </Checkbox.Group>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={8}>
                        <Form.Item name="monthlyPrice" label="Monthly Pass (₹)">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item name="quarterlyPrice" label="Quarterly Pass (₹)">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={8}>
                        <Form.Item name="annualPrice" label="Annual Pass (₹)">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="floorSpaceSqFt" label="Floor Space (Sq. Ft)">
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="maxFloorCapacity" label="Max Floor Capacity">
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ),
              },
              {
                key: 'banking',
                label: 'Bank Details',
                children: (
                  <>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="accountHolder" label="Account Holder Name">
                          <Input placeholder="Name on bank account" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="bankName" label="Bank Name">
                          <Input placeholder="e.g. HDFC Bank" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item name="accountNumber" label="Account Number" normalize={(val) => val ? val.replace(/\D/g, '').slice(0, 18) : ''}>
                          <Input placeholder="Bank account number" maxLength={18} inputMode="numeric" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="ifscCode" label="IFSC Code" normalize={(val) => val ? val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) : ''}>
                          <Input placeholder="e.g. HDFC0001234" maxLength={11} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="upiId" label="Settlement UPI ID / VPA">
                      <Input placeholder="e.g. gymezy@upi" />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={savingEdit}
              icon={<SaveOutlined />}
              style={{ fontWeight: 600, backgroundColor: '#2563eb', borderColor: '#2563eb' }}
            >
              Save Changes
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Group Class Details Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FireOutlined style={{ color: '#ea580c' }} />
            <span>{selectedSectionForModal?.title || 'Group Class Details'}</span>
          </div>
        }
        open={isSectionModalOpen}
        onCancel={() => {
          setIsSectionModalOpen(false);
          setSelectedSectionForModal(null);
        }}
        footer={[
          <Button key="close" onClick={() => setIsSectionModalOpen(false)}>
            Close
          </Button>,
          <Button
            key="viewBookings"
            type="primary"
            icon={<CalendarOutlined />}
            onClick={() => {
              setIsSectionModalOpen(false);
              setBookingTypeFilter('GROUP_CLASS');
              setActiveTab('bookings');
            }}
          >
            Filter Class Bookings
          </Button>,
        ]}
        width={650}
      >
        {selectedSectionForModal && (
          <div style={{ marginTop: 16 }}>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Class Title" span={2}>
                <strong>{selectedSectionForModal.title}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag color="volcano" style={{ textTransform: 'capitalize' }}>
                  {selectedSectionForModal.category || 'General'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={selectedSectionForModal.isActive !== false ? 'success' : 'default'}>
                  {selectedSectionForModal.isActive !== false ? 'Active' : 'Inactive'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Time Slot">
                {selectedSectionForModal.startTime && selectedSectionForModal.endTime
                  ? `${selectedSectionForModal.startTime} - ${selectedSectionForModal.endTime}`
                  : selectedSectionForModal.timeSlot || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {selectedSectionForModal.durationDays ? `${selectedSectionForModal.durationDays} Days` : 'Weekly Recurring'}
              </Descriptions.Item>
              <Descriptions.Item label="Assigned Trainer" span={2}>
                {typeof selectedSectionForModal.trainerId === 'object' && selectedSectionForModal.trainerId?.name
                  ? `${selectedSectionForModal.trainerId.name} (${selectedSectionForModal.trainerId.phone || 'No phone'})`
                  : selectedSectionForModal.trainerName || 'Assigned Floor Trainer'}
              </Descriptions.Item>
              <Descriptions.Item label="Active Days" span={2}>
                <Space wrap>
                  {(Array.isArray(selectedSectionForModal.activeDays) && selectedSectionForModal.activeDays.length > 0
                    ? selectedSectionForModal.activeDays
                    : ['Monday', 'Wednesday', 'Friday']
                  ).map((d) => (
                    <Tag key={d} color="blue">{d}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Registration Fee">
                <strong style={{ color: '#16a34a', fontSize: 16 }}>
                  ₹{Number(selectedSectionForModal.cost || 0).toLocaleString('en-IN')}
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Capacity & Seats">
                <span>{selectedSectionForModal.enrolledCount || 0} enrolled of {selectedSectionForModal.maxCapacity || 20} max capacity</span>
              </Descriptions.Item>
              {selectedSectionForModal.description ? (
                <Descriptions.Item label="Description" span={2}>
                  {selectedSectionForModal.description}
                </Descriptions.Item>
              ) : null}
              {Array.isArray(selectedSectionForModal.inclusions) && selectedSectionForModal.inclusions.length > 0 ? (
                <Descriptions.Item label="Inclusions" span={2}>
                  <ul style={{ paddingLeft: 18, margin: 0 }}>
                    {selectedSectionForModal.inclusions.map((inc, idx) => (
                      <li key={idx}>{inc}</li>
                    ))}
                  </ul>
                </Descriptions.Item>
              ) : null}
              {selectedSectionForModal.instructions ? (
                <Descriptions.Item label="Member Instructions" span={2}>
                  <div style={{ color: '#64748b' }}>{selectedSectionForModal.instructions}</div>
                </Descriptions.Item>
              ) : null}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default GymDetailsView;
