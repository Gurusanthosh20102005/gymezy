import React, { useEffect, useState } from 'react';
import { BANKS, getBankByName } from '../utils/bankData';
import {
  Button,
  Image,
  Switch,
  App as AntdApp,
  Modal,
  Input,
  Row,
  Col,
  Form,
  Tabs,
  Select,
  InputNumber,
  Checkbox,
  Tag,
  Divider,
  Radio,
  Upload,
} from 'antd';
import {
  SyncOutlined,
  LogoutOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
  ArrowRightOutlined,
  SunOutlined,
  MoonOutlined,
  QuestionCircleOutlined,
  SendOutlined,
  EditOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ShopOutlined,
  DollarOutlined,
  PictureOutlined,
  BankOutlined,
  AimOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../theme/ThemeContext';
import { refreshCurrentUser, logout } from '../redux/slices/authSlice';
import { apiClient } from '../services/apiClient';
import gymezyLogo from '../assets/logo/gymezy.png';

const { TextArea } = Input;
const { Option } = Select;

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

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

export const ApplicationStatus = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const { message: messageApi } = AntdApp.useApp();

  const [refreshing, setRefreshing] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [resubmitting, setResubmitting] = useState(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editActiveTab, setEditActiveTab] = useState('business');
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFacilities, setEditFacilities] = useState([]);
  const [editWorkouts, setEditWorkouts] = useState([]);
  const [editLogo, setEditLogo] = useState('');
  const [editCoverPhoto, setEditCoverPhoto] = useState('');
  const [editGalleryPhotos, setEditGalleryPhotos] = useState([]);
  const [editResubmitFlag, setEditResubmitFlag] = useState(false);
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const gym = user?.gym || {};
  const galleryPhotos = Array.isArray(gym.galleryPhotos)
    ? gym.galleryPhotos
        .filter(Boolean)
        .map((photo) => (
          typeof photo === 'string'
            ? { fileName: '', fileData: photo }
            : photo
        ))
    : [];
  const approvalStatus = gym.approvalStatus || 'Pending Approval';
  const isApproved = approvalStatus === 'Approved';
  const isOnHold = approvalStatus === 'On Hold';
  const isRejected = approvalStatus === 'Rejected';
  const isPending = approvalStatus === 'Pending Approval' || (!isApproved && !isOnHold && !isRejected);
  const adminRemark = gym.remark || gym.rejectionReason || '';

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(refreshCurrentUser());
    } else {
      navigate('/login');
    }
  }, [dispatch, isAuthenticated, navigate]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await dispatch(refreshCurrentUser()).unwrap();
      const updatedStatus = result.gym?.approvalStatus || 'Pending Approval';
      if (updatedStatus === 'Approved') {
        messageApi.success('Your gym partner account has been approved.');
        navigate('/owner/dashboard');
      } else {
        messageApi.info(`Current status: ${updatedStatus}`);
      }
    } catch (err) {
      messageApi.error(err?.message || err || 'Could not refresh status.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleResubmit = async () => {
    const gymId = gym.id || gym._id;
    if (!gymId) {
      messageApi.error('Gym ID not found. Please log in again.');
      return;
    }
    setResubmitting(true);
    try {
      await apiClient.post(`/gyms/${gymId}/resubmit`, {
        notes: resubmitNotes,
      });
      messageApi.success('Application resubmitted successfully. Status updated to Pending Approval.');
      setResubmitModalOpen(false);
      setResubmitNotes('');
      await dispatch(refreshCurrentUser()).unwrap();
    } catch (err) {
      messageApi.error(err?.response?.data?.message || err?.message || 'Failed to resubmit application.');
    } finally {
      setResubmitting(false);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    messageApi.success('Signed out.');
    navigate('/login');
  };

  // Open Edit Modal with Pre-filled Data
  const handleOpenEditModal = (initialTab = 'business') => {
    setEditActiveTab(initialTab);
    setEditResubmitFlag(isOnHold || isRejected);
    setEditAdminNotes('');
    setEditFacilities(Array.isArray(gym.facilities) ? [...gym.facilities] : []);
    setEditWorkouts(Array.isArray(gym.workouts) ? [...gym.workouts] : []);

    const existingLogo = typeof gym.logo === 'string' ? gym.logo : gym.logo?.fileData || '';
    const existingCover = typeof gym.coverPhoto === 'string' ? gym.coverPhoto : gym.coverPhoto?.fileData || existingLogo;
    setEditLogo(existingLogo);
    setEditCoverPhoto(existingCover);

    const existingGallery = Array.isArray(gym.galleryPhotos)
      ? gym.galleryPhotos
          .filter(Boolean)
          .map((p) => (typeof p === 'string' ? p : p.fileData || ''))
      : [];
    setEditGalleryPhotos(existingGallery);

    editForm.setFieldsValue({
      name: gym.name || '',
      tagline: gym.tagline || '',
      ownerName: gym.ownerName || user?.fullName || '',
      phone: gym.phone || user?.phone || '',
      email: gym.email || user?.email || '',
      businessType: gym.businessType || 'Private Limited',
      yearEstablished: gym.yearEstablished || '',
      subscriptionType: gym.subscriptionType || 'Hybrid',
      gstNumber: gym.gstNumber || '',
      panNumber: gym.panNumber || '',

      address: gym.address || '',
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

      singleSessionPrice: gym.singleSessionPrice || gym.pricingPlans?.singleSession || 199,
      weeklyPassPrice: gym.pricingPlans?.weeklyPass || 799,
      monthlyPrice: gym.pricingPlans?.monthly || 1999,
      quarterlyPrice: gym.pricingPlans?.quarterly || 4999,
      annualPrice: gym.pricingPlans?.annual || 14999,

      floorSpaceSqFt: gym.floorSpaceSqFt || 2000,
      maxFloorCapacity: gym.maxFloorCapacity || 50,
      aboutText: gym.aboutText || '',

      accountHolder: gym.bankDetails?.accountHolder || '',
      bankName: gym.bankDetails?.bankName || '',
      accountNumber: gym.bankDetails?.accountNumber || '',
      ifscCode: gym.bankDetails?.ifscCode || '',
      upiId: gym.bankDetails?.upiId || '',
    });

    setIsEditModalOpen(true);
  };

  // Submit edits via PUT /gyms/:id
  const handleSaveGymDetails = async (values) => {
    const gymId = gym.id || gym._id;
    if (!gymId) {
      messageApi.error('Gym record not found. Please log in again.');
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
        facilities: editFacilities,
        workouts: editWorkouts,
        logo: editLogo,
        coverPhoto: editCoverPhoto || editLogo,
        galleryPhotos: editGalleryPhotos,
        resubmit: editResubmitFlag,
        resubmitNotes: editAdminNotes,
      };

      const res = await apiClient.put(`/gyms/${gymId}`, payload);
      if (res.data?.success) {
        const apiMsg = res.data?.message;
        messageApi.success(
          apiMsg || (editResubmitFlag
            ? 'Gym details updated and application resubmitted for Super Admin review!'
            : 'Changes submitted successfully! Pending Super Admin approval.')
        );
        setIsEditModalOpen(false);
        await dispatch(refreshCurrentUser()).unwrap();
      } else {
        messageApi.error(res.data?.message || 'Failed to update gym details.');
      }
    } catch (err) {
      messageApi.error(err.response?.data?.message || err.message || 'Error updating gym details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleLogoUpload = async (file) => {
    try {
      const b64 = await fileToBase64(file);
      setEditLogo(b64);
      messageApi.success('Logo selected.');
    } catch {
      messageApi.error('Failed to process image file.');
    }
    return false;
  };

  const handleGalleryUpload = async (file) => {
    try {
      const b64 = await fileToBase64(file);
      setEditGalleryPhotos((prev) => [...prev, b64]);
      messageApi.success('Facility photo added.');
    } catch {
      messageApi.error('Failed to process photo.');
    }
    return false;
  };

  const handleGpsPin = () => {
    if (!navigator.geolocation) {
      messageApi.error('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        editForm.setFieldsValue({
          googleMapsUrl: `https://maps.google.com/?q=${latitude},${longitude}`,
        });
        messageApi.success(`GPS Location Synced: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        messageApi.error(err.message || 'Unable to retrieve location.');
      },
      { timeout: 8000 }
    );
  };

  const pageBg = isDarkMode ? '#000000' : '#ffffff';
  const surfaceBg = isDarkMode ? '#0d0d0d' : '#fafafa';
  const borderCol = isDarkMode ? '#222222' : '#eaeaea';
  const textPrimary = isDarkMode ? '#ffffff' : '#111111';
  const textSecondary = isDarkMode ? '#888888' : '#666666';
  const textMuted = isDarkMode ? '#555555' : '#999999';

  const submissionDateStr = gym.createdAt
    ? new Date(gym.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recent';

  // Status badge config
  const getStatusColor = () => {
    if (isApproved) return '#10b981';
    if (isOnHold) return '#f59e0b';
    if (isRejected) return '#ef4444';
    return '#f59e0b';
  };

  const getStatusLabel = () => {
    if (isApproved) return 'Approved';
    if (isOnHold) return 'On Hold';
    if (isRejected) return 'Changes Requested';
    return 'Pending Approval';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: pageBg,
        color: textPrimary,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >

      {/* MINIMAL HEADER */}
      <header
        style={{
          height: 56,
          borderBottom: `1px solid ${borderCol}`,
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={gymezyLogo}
            alt="GYMEZY"
            style={{
              width: 26,
              height: 26,
              objectFit: 'contain',
              filter: isDarkMode ? 'brightness(0) invert(1)' : 'none',
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.5px' }}>GYMEZY</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: textSecondary,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <Switch
              size="small"
              checked={isDarkMode}
              checkedChildren={<MoonOutlined style={{ color: '#ffd700', fontSize: 9 }} />}
              unCheckedChildren={<SunOutlined style={{ color: '#fa8c16', fontSize: 9 }} />}
              style={{ margin: 0, pointerEvents: 'none' }}
            />
            <span>{isDarkMode ? 'Night' : 'Day'}</span>
          </div>

          <Button
            type="text"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{
              color: textSecondary,
              fontSize: 12,
              fontWeight: 500,
              padding: '0 8px',
              height: 28,
            }}
          >
            Sign out
          </Button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '48px 24px 80px 24px',
        }}
      >
        {/* HERO TITLE & STATUS */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: textMuted,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Partner Registration
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  margin: 0,
                  color: textPrimary,
                  letterSpacing: '-0.5px',
                }}
              >
                {gym.name || 'Your Gym'}
              </h1>

              {/* Minimal Status Pill */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 20,
                  backgroundColor: surfaceBg,
                  border: `1px solid ${borderCol}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: textPrimary,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: getStatusColor(),
                  }}
                />
                <span>{getStatusLabel()}</span>
              </div>

              {gym.partnerId && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 20,
                    backgroundColor: surfaceBg,
                    border: `1px solid ${borderCol}`,
                    color: textSecondary,
                  }}
                >
                  ID: {gym.partnerId}
                </div>
              )}
            </div>

            {/* Header Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Button
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal('business')}
                size="small"
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  borderColor: '#2563eb',
                  color: '#2563eb',
                  backgroundColor: isDarkMode ? 'rgba(37,99,235,0.1)' : '#eff6ff',
                }}
              >
                Edit Application
              </Button>

              <Button
                icon={<SyncOutlined spin={refreshing} />}
                onClick={handleRefresh}
                loading={refreshing}
                size="small"
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  borderColor: borderCol,
                  backgroundColor: surfaceBg,
                  color: textPrimary,
                }}
              >
                Refresh
              </Button>

              <Button
                icon={<QuestionCircleOutlined />}
                onClick={() => setSupportModalOpen(true)}
                size="small"
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  borderColor: borderCol,
                  backgroundColor: surfaceBg,
                  color: textPrimary,
                }}
              >
                Support
              </Button>

              {(isOnHold || isRejected) && (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => setResubmitModalOpen(true)}
                  size="small"
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: isOnHold ? '#fa8c16' : '#2563eb',
                    borderColor: isOnHold ? '#fa8c16' : '#2563eb',
                  }}
                >
                  Resubmit Application
                </Button>
              )}

              {isApproved && (
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate('/owner/dashboard')}
                  size="small"
                  style={{
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    backgroundColor: '#003882',
                    borderColor: '#003882',
                  }}
                >
                  Dashboard
                </Button>
              )}
            </div>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: textSecondary,
              lineHeight: 1.5,
              maxWidth: 680,
            }}
          >
            {isApproved
              ? 'Your gym partner account is approved and active. You can manage your gym in the Owner Console.'
              : isOnHold
              ? 'Your application is currently on hold. Please review the administrator notes below, edit any required information, and resubmit when ready.'
              : isRejected
              ? 'Review is complete and changes are required before activation. Please check the administrator note below, make the necessary updates, and resubmit.'
              : `Submitted on ${submissionDateStr} by ${user?.fullName || gym.ownerName || 'Partner'}. The GYMEZY operations team is currently reviewing your registration.`}
          </p>
        </div>

        {/* MINIMAL PROGRESS TRACK */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            padding: '20px 0',
            borderTop: `1px solid ${borderCol}`,
            borderBottom: `1px solid ${borderCol}`,
            marginBottom: 32,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>1. Submitted</span>
            </div>
            <div style={{ fontSize: 12, color: textMuted }}>
              {submissionDateStr}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isApproved ? '#10b981' : isOnHold ? '#f59e0b' : isRejected ? '#ef4444' : '#f59e0b',
                }}
              >
                2. Review
              </span>
            </div>
            <div style={{ fontSize: 12, color: textMuted }}>
              {isApproved ? 'Verified' : isOnHold ? 'On Hold' : isRejected ? 'Action Needed' : 'In Progress'}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isApproved ? '#10b981' : textMuted,
                }}
              >
                3. Activation
              </span>
            </div>
            <div style={{ fontSize: 12, color: textMuted }}>
              {isApproved ? 'Live on GYMEZY' : 'Pending Review'}
            </div>
          </div>
        </div>

        {/* ADMIN NOTE BANNER (ON HOLD / REJECTED / PREVIOUS REMARKS) */}
        {adminRemark && (
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 8,
              backgroundColor: surfaceBg,
              border: `1px solid ${borderCol}`,
              borderLeft: `4px solid ${isOnHold ? '#fa8c16' : isRejected ? '#ef4444' : '#2563eb'}`,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isOnHold ? '#fa8c16' : isRejected ? '#ef4444' : '#2563eb',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                {isOnHold
                  ? 'Administrator Note — On Hold'
                  : isRejected
                  ? 'Administrator Note — Changes Required'
                  : 'Administrator Note'}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenEditModal('business')}
                  style={{
                    height: 28,
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  Edit Information
                </Button>

                {(isOnHold || isRejected) && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => setResubmitModalOpen(true)}
                    style={{
                      height: 28,
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 600,
                      backgroundColor: isOnHold ? '#fa8c16' : '#2563eb',
                      borderColor: isOnHold ? '#fa8c16' : '#2563eb',
                    }}
                  >
                    Resubmit Now
                  </Button>
                )}
              </div>
            </div>

            <div style={{ fontSize: 13, color: textPrimary, lineHeight: 1.5 }}>
              {adminRemark}
            </div>
          </div>
        )}

        {/* DETAILS LISTING */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Section 1: Business Profile */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: textPrimary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Gym Details
              </div>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal('business')}
                style={{ color: '#2563eb', fontWeight: 600, padding: 0 }}
              >
                Edit
              </Button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                padding: '18px 20px',
                borderRadius: 8,
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Owner Name</div>
                <div style={{ fontWeight: 600 }}>{gym.ownerName || user?.fullName || '—'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Email</div>
                <div>{gym.email || user?.email || '—'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Phone</div>
                <div>{gym.phone || user?.phone || '—'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Business Type</div>
                <div>{gym.businessType || 'Private Limited'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Established</div>
                <div>{gym.yearEstablished || 'N/A'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Plan Model</div>
                <div>{gym.subscriptionType || 'Hybrid'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>GST Number</div>
                <div style={{ fontFamily: 'monospace' }}>{gym.gstNumber || 'Not provided'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>PAN Number</div>
                <div style={{ fontFamily: 'monospace' }}>{gym.panNumber || 'Not provided'}</div>
              </div>
            </div>
          </div>

          {/* Section 2: Location & Timings */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: textPrimary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Location & Schedule
              </div>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal('location')}
                style={{ color: '#2563eb', fontWeight: 600, padding: 0 }}
              >
                Edit
              </Button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                padding: '18px 20px',
                borderRadius: 8,
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                fontSize: 13,
              }}
            >
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Address</div>
                <div style={{ lineHeight: 1.4 }}>
                  <EnvironmentOutlined style={{ marginRight: 6, color: textSecondary }} />
                  {gym.address}
                  {gym.area ? `, ${gym.area}` : ''}
                  {gym.city ? `, ${gym.city}` : ''}
                  {gym.state ? `, ${gym.state}` : ''}
                  {gym.pincode ? ` - ${gym.pincode}` : ''}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Coordinates</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                  {Array.isArray(gym.location?.coordinates) &&
                  gym.location.coordinates.length >= 2 &&
                  Number.isFinite(Number(gym.location.coordinates[0])) &&
                  Number.isFinite(Number(gym.location.coordinates[1]))
                    ? `${Number(gym.location.coordinates[1]).toFixed(4)}, ${Number(gym.location.coordinates[0]).toFixed(4)}`
                    : 'Pinned via GPS'}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Opening Hours & Timing Model</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Tag color={gym.openingHours?.mode === '24_HOURS' ? 'green' : (gym.openingHours?.mode === 'SPLIT_SHIFT' ? 'purple' : 'blue')}>
                    {gym.openingHours?.mode === '24_HOURS' ? '24/7 Access' : (gym.openingHours?.mode === 'SPLIT_SHIFT' ? 'Split Shift' : 'Single Shift')}
                  </Tag>
                  <span>{gym.openingHours?.displayText || `${gym.openingHours?.weekdayOpen || '05:30 AM'} - ${gym.openingHours?.weekdayClose || '10:30 PM'}`}</span>
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Floor Space & Capacity</div>
                <div>{gym.floorSpaceSqFt || 2000} sq.ft / {gym.maxFloorCapacity || 50} people</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Single Session</div>
                <div style={{ fontWeight: 600 }}>₹{gym.singleSessionPrice || 199}</div>
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Membership Plans */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: textPrimary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Pricing & Passes
              </div>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal('pricing')}
                style={{ color: '#2563eb', fontWeight: 600, padding: 0 }}
              >
                Edit
              </Button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 12,
                padding: '18px 20px',
                borderRadius: 8,
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Single Session</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#16a34a' }}>
                  ₹{gym.singleSessionPrice || gym.pricingPlans?.singleSession || 199}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Weekly Pass</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: textPrimary }}>
                  ₹{gym.pricingPlans?.weeklyPass || 799}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Monthly Pass</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: textPrimary }}>
                  ₹{gym.pricingPlans?.monthly || 1999}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Quarterly (3M)</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: textPrimary }}>
                  ₹{gym.pricingPlans?.quarterly || 4999}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Annual Pass</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: textPrimary }}>
                  ₹{gym.pricingPlans?.annual || 14999}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Facilities & Disciplines */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: textPrimary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Facilities & Workout Disciplines
              </div>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal('facilities')}
                style={{ color: '#2563eb', fontWeight: 600, padding: 0 }}
              >
                Edit
              </Button>
            </div>

            <div
              style={{
                padding: '18px 20px',
                borderRadius: 8,
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
                  Active Facilities ({gym.facilities?.length || 0})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(gym.facilities || ['Air Conditioned', 'Locker Facility', 'Shower Available']).map((f) => (
                    <Tag key={f} color="blue" style={{ borderRadius: 4, fontWeight: 500, margin: 0 }}>
                      {f}
                    </Tag>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>
                  Workout Disciplines ({gym.workouts?.length || 0})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(gym.workouts || ['Strength & Weights', 'Cardio & Endurance', 'HIIT Functional Training']).map((w) => (
                    <Tag key={w} color="purple" style={{ borderRadius: 4, fontWeight: 500, margin: 0 }}>
                      {w}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Settlement Bank Details */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: textPrimary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Settlement Bank Account
              </div>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenEditModal('bank')}
                style={{ color: '#2563eb', fontWeight: 600, padding: 0 }}
              >
                Edit
              </Button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                padding: '18px 20px',
                borderRadius: 8,
                backgroundColor: surfaceBg,
                border: `1px solid ${borderCol}`,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Account Holder</div>
                <div style={{ fontWeight: 600 }}>{gym.bankDetails?.accountHolder || gym.ownerName || '—'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Bank Name</div>
                <div>{gym.bankDetails?.bankName || 'Not configured'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>Account Number</div>
                <div style={{ fontFamily: 'monospace' }}>
                  {gym.bankDetails?.accountNumber
                    ? `•••• •••• ${gym.bankDetails.accountNumber.slice(-4)}`
                    : 'Not configured'}
                </div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>IFSC Code</div>
                <div style={{ fontFamily: 'monospace' }}>{gym.bankDetails?.ifscCode || '—'}</div>
              </div>

              <div>
                <div style={{ color: textMuted, fontSize: 11, marginBottom: 2 }}>UPI ID</div>
                <div>{gym.bankDetails?.upiId || '—'}</div>
              </div>
            </div>
          </div>

          {/* Section 6: Facility Photos */}
          {gym.galleryPhotos && gym.galleryPhotos.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: textPrimary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Facility Photos ({gym.galleryPhotos.length})
                </div>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenEditModal('facilities')}
                  style={{ color: '#2563eb', fontWeight: 600, padding: 0 }}
                >
                  Manage Photos
                </Button>
              </div>

              <Image.PreviewGroup>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {galleryPhotos.map((photo, index) => {
                    const src = typeof photo === 'string' ? photo : photo.fileData;
                    return (
                      <div
                        key={photo.fileName || index}
                        style={{
                          width: 110,
                          height: 80,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: `1px solid ${borderCol}`,
                          backgroundColor: surfaceBg,
                        }}
                      >
                        <Image
                          src={src}
                          alt={photo.fileName || `Photo ${index + 1}`}
                          style={{
                            width: '100%',
                            height: 80,
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </Image.PreviewGroup>
            </div>
          )}
        </div>

        {/* SIMPLE FOOTER */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: `1px solid ${borderCol}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: textMuted,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            Need help? Contact{' '}
            <a href="mailto:partners@gymezy.com" style={{ color: textSecondary, textDecoration: 'underline' }}>
              partners@gymezy.com
            </a>{' '}
            or call <span style={{ color: textSecondary }}>+91 98765 43210</span>
          </div>
          <div>GYMEZY Partner Portal</div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* COMPREHENSIVE EDIT APPLICATION MODAL */}
      {/* ========================================================================= */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#2563eb' }} />
            <span style={{ fontWeight: 700 }}>Edit Gym Application Details</span>
          </div>
        }
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        width={780}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveGymDetails}
          style={{ marginTop: 12 }}
        >
          <Tabs
            activeKey={editActiveTab}
            onChange={setEditActiveTab}
            items={[
              {
                key: 'business',
                label: (
                  <span>
                    <ShopOutlined /> Gym Details
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: 8 }}>
                    <Row gutter={[16, 12]}>
                      <Col xs={24} sm={16}>
                        <Form.Item
                          label="Gym / Studio Name"
                          name="name"
                          rules={[{ required: true, message: 'Gym name is required' }]}
                        >
                          <Input placeholder="e.g. Super Max Gym" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={8}>
                        <Form.Item label="Year Established" name="yearEstablished">
                          <Input placeholder="2024" />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item label="Tagline / Motto" name="tagline">
                          <Input placeholder="e.g. Elevate Your Fitness" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item
                          label="Owner / MD Full Name"
                          name="ownerName"
                          rules={[{ required: true, message: 'Owner name required' }]}
                        >
                          <Input placeholder="e.g. Thaingasaami" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item
                          label="Mobile / Contact Number"
                          name="phone"
                          rules={[{ required: true, message: 'Phone required' }]}
                        >
                          <Input placeholder="9876543210" maxLength={10} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Business Structure" name="businessType">
                          <Select>
                            <Option value="Private Limited">Private Limited (Pvt Ltd)</Option>
                            <Option value="Partnership">Partnership Firm</Option>
                            <Option value="Proprietorship">Sole Proprietorship</Option>
                            <Option value="LLP">Limited Liability Partnership (LLP)</Option>
                            <Option value="Individual">Individual Fitness Studio</Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Partnership Plan" name="subscriptionType">
                          <Select>
                            <Option value="Listing Only">Free Listing (Discovery Only)</Option>
                            <Option value="GMS">GMS Software (Member & Billing)</Option>
                            <Option value="App Only">App Listing (Direct Passes)</Option>
                            <Option value="Hybrid">Hybrid Partner (Full Suite)</Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="GST Number (Optional)" name="gstNumber">
                          <Input placeholder="33AAAAA0000A1Z5" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="PAN Number (Optional)" name="panNumber">
                          <Input placeholder="ABCDE1234F" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: 'location',
                label: (
                  <span>
                    <EnvironmentOutlined /> Location & Hours
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: 8 }}>
                    <Row gutter={[16, 12]}>
                      <Col xs={24}>
                        <Form.Item
                          label="Street Address"
                          name="address"
                          rules={[{ required: true, message: 'Address required' }]}
                        >
                          <Input placeholder="e.g. Mangadu, Kundrathur Road" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Locality / Area" name="area">
                          <Input placeholder="e.g. Mangadu" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item
                          label="City"
                          name="city"
                          rules={[{ required: true, message: 'City is required' }]}
                        >
                          <Select>
                            <Option value="Chennai">Chennai</Option>
                            <Option value="Bengaluru">Bengaluru</Option>
                            <Option value="Mumbai">Mumbai</Option>
                            <Option value="Pune">Pune</Option>
                            <Option value="Hyderabad">Hyderabad</Option>
                            <Option value="Delhi-NCR">Delhi-NCR</Option>
                            <Option value="Kolkata">Kolkata</Option>
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="State" name="state">
                          <Input placeholder="Tamil Nadu" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item
                          label="Pincode"
                          name="pincode"
                          rules={[{ required: true, message: 'Pincode is required' }]}
                        >
                          <Input placeholder="602101" maxLength={6} />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <label style={{ fontSize: 13, fontWeight: 600 }}>Google Maps Link / GPS Coordinates</label>
                          <Button
                            size="small"
                            icon={<AimOutlined />}
                            loading={isLocating}
                            onClick={handleGpsPin}
                            style={{ fontSize: 11 }}
                          >
                            Auto-Detect GPS
                          </Button>
                        </div>
                        <Form.Item name="googleMapsUrl" style={{ marginBottom: 0 }}>
                          <Input placeholder="https://maps.google.com/?q=13.0827,80.2707" />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Divider style={{ margin: '14px 0 10px 0' }} />
                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                          Operating Hours & Shift Architecture
                        </div>
                      </Col>

                      <Col xs={24}>
                        <Form.Item label="Timing Model" name="timingMode">
                          <Radio.Group buttonStyle="solid">
                            <Radio.Button value="REGULAR">Single Shift (Continuous 12h/16h)</Radio.Button>
                            <Radio.Button value="SPLIT_SHIFT">Split Shift (Morning + Evening)</Radio.Button>
                            <Radio.Button value="24_HOURS">24 Hours Open (24x7)</Radio.Button>
                          </Radio.Group>
                        </Form.Item>
                      </Col>

                      <Col xs={12} sm={6}>
                        <Form.Item label="Weekday Open" name="weekdayOpen">
                          <Input placeholder="05:30 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label="Weekday Close" name="weekdayClose">
                          <Input placeholder="10:30 PM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label="Weekend Open" name="weekendOpen">
                          <Input placeholder="06:00 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label="Weekend Close" name="weekendClose">
                          <Input placeholder="09:00 PM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label="Morning Shift Open" name="morningOpen">
                          <Input placeholder="05:30 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label="Morning Shift Close" name="morningClose">
                          <Input placeholder="11:30 AM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label="Evening Shift Open" name="eveningOpen">
                          <Input placeholder="04:30 PM" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item label="Evening Shift Close" name="eveningClose">
                          <Input placeholder="10:30 PM" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: 'pricing',
                label: (
                  <span>
                    <DollarOutlined /> Pricing & Passes
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: 8 }}>
                    <Row gutter={[16, 12]}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          label="Single Session Walk-in Price (₹)"
                          name="singleSessionPrice"
                          rules={[{ required: true, message: 'Price required' }]}
                        >
                          <InputNumber prefix="₹" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Weekly Pass Price (₹)" name="weeklyPassPrice">
                          <InputNumber prefix="₹" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Monthly Membership Price (₹)" name="monthlyPrice">
                          <InputNumber prefix="₹" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Quarterly Pass Price (₹)" name="quarterlyPrice">
                          <InputNumber prefix="₹" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Annual Membership Price (₹)" name="annualPrice">
                          <InputNumber prefix="₹" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: 'facilities',
                label: (
                  <span>
                    <PictureOutlined /> Facilities & Photos
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                      Select Facility Amenities:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                      {FACILITY_OPTIONS.map((f) => {
                        const isSelected = editFacilities.includes(f);
                        return (
                          <Tag
                            key={f}
                            onClick={() => {
                              setEditFacilities((prev) =>
                                prev.includes(f) ? prev.filter((i) => i !== f) : [...prev, f]
                              );
                            }}
                            color={isSelected ? 'blue' : 'default'}
                            style={{
                              cursor: 'pointer',
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 500,
                            }}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {f}
                          </Tag>
                        );
                      })}
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                      Workout Disciplines:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                      {WORKOUT_OPTIONS.map((w) => {
                        const isSelected = editWorkouts.includes(w);
                        return (
                          <Tag
                            key={w}
                            onClick={() => {
                              setEditWorkouts((prev) =>
                                prev.includes(w) ? prev.filter((i) => i !== w) : [...prev, w]
                              );
                            }}
                            color={isSelected ? 'purple' : 'default'}
                            style={{
                              cursor: 'pointer',
                              padding: '4px 10px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: isSelected ? 700 : 500,
                            }}
                          >
                            {isSelected ? '✓ ' : '+ '}
                            {w}
                          </Tag>
                        );
                      })}
                    </div>

                    <Divider style={{ margin: '14px 0' }} />

                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                      Brand Logo & Facility Gallery:
                    </div>

                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={8}>
                        <div style={{ fontSize: 12, color: textSecondary, marginBottom: 6 }}>Gym Brand Logo</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {editLogo ? (
                            <img
                              src={editLogo}
                              alt="Logo"
                              style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                            />
                          ) : null}
                          <Upload beforeUpload={handleLogoUpload} showUploadList={false}>
                            <Button size="small" icon={<PlusOutlined />}>
                              {editLogo ? 'Change Logo' : 'Upload Logo'}
                            </Button>
                          </Upload>
                        </div>
                      </Col>

                      <Col xs={24} sm={16}>
                        <div style={{ fontSize: 12, color: textSecondary, marginBottom: 6 }}>
                          Facility Photos ({editGalleryPhotos.length})
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {editGalleryPhotos.map((photo, i) => (
                            <div
                              key={i}
                              style={{
                                position: 'relative',
                                width: 56,
                                height: 56,
                                borderRadius: 6,
                                overflow: 'hidden',
                                border: '1px solid #cbd5e1',
                              }}
                            >
                              <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button
                                type="button"
                                onClick={() => setEditGalleryPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                                style={{
                                  position: 'absolute',
                                  top: 2,
                                  right: 2,
                                  background: 'rgba(0,0,0,0.6)',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: 16,
                                  height: 16,
                                  fontSize: 10,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <Upload beforeUpload={handleGalleryUpload} showUploadList={false}>
                            <Button
                              size="small"
                              icon={<PlusOutlined />}
                              style={{ height: 56, width: 56, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                            />
                          </Upload>
                        </div>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: 'bank',
                label: (
                  <span>
                    <BankOutlined /> Bank Details
                  </span>
                ),
                children: (
                  <div style={{ paddingTop: 8 }}>
                    <Row gutter={[16, 12]}>
                      <Col xs={24} sm={12}>
                        <Form.Item label="Account Holder Name" name="accountHolder">
                          <Input placeholder="e.g. Thaingasaami" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Bank Name" name="bankName">
                          <Select
                            showSearch
                            optionFilterProp="children"
                            placeholder="Select bank"
                            onChange={(bankName) => {
                              editForm.setFieldValue('ifscCode', getBankByName(bankName)?.ifscPrefix || '');
                            }}
                          >
                            {BANKS.map((bank) => (
                              <Select.Option key={bank.name} value={bank.name}>{bank.name}</Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="Account Number" name="accountNumber">
                          <Input placeholder="50100000000000" />
                        </Form.Item>
                      </Col>

                      <Col xs={24} sm={12}>
                        <Form.Item label="IFSC Code" name="ifscCode">
                          <Input placeholder="HDFC0001234" />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item label="UPI ID (Optional)" name="upiId">
                          <Input placeholder="owner@okaxis" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },
            ]}
          />

          <Divider style={{ margin: '20px 0 16px 0' }} />

          {/* Resubmit toggle option */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 8,
              backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
              border: `1px solid ${borderCol}`,
              marginBottom: 16,
            }}
          >
            <Checkbox
              checked={editResubmitFlag}
              onChange={(e) => setEditResubmitFlag(e.target.checked)}
              style={{ fontWeight: 600 }}
            >
              Resubmit application for Super Admin review upon saving
            </Checkbox>
            {editResubmitFlag && (
              <div style={{ marginTop: 10 }}>
                <TextArea
                  rows={2}
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  placeholder="Optional note for admin (e.g. Updated address and pricing pass)..."
                  style={{ fontSize: 12 }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setIsEditModalOpen(false)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={savingEdit}
              icon={<SaveOutlined />}
              style={{
                fontWeight: 700,
                backgroundColor: '#2563eb',
                borderColor: '#2563eb',
              }}
            >
              {editResubmitFlag ? 'Save & Resubmit to Review' : 'Save Changes'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* RESUBMIT APPLICATION MODAL */}
      <Modal
        title="Resubmit Application"
        open={resubmitModalOpen}
        onCancel={() => setResubmitModalOpen(false)}
        footer={null}
        centered
        width={480}
      >
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: 13, color: textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
            Provide notes or explanations on the changes you have addressed. Once submitted, your application status will return to <strong>Pending Approval</strong>.
          </p>

          <TextArea
            rows={4}
            value={resubmitNotes}
            onChange={(e) => setResubmitNotes(e.target.value)}
            placeholder="e.g. Uploaded revised license document, updated morning opening slot..."
            style={{ marginBottom: 18 }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setResubmitModalOpen(false)} disabled={resubmitting}>
              Cancel
            </Button>
            <Button
              type="primary"
              loading={resubmitting}
              onClick={handleResubmit}
              style={{
                fontWeight: 600,
                backgroundColor: '#2563eb',
                borderColor: '#2563eb',
              }}
            >
              Confirm & Resubmit
            </Button>
          </div>
        </div>
      </Modal>

      {/* MINIMAL SUPPORT MODAL */}
      <Modal
        title="Partner Support"
        open={supportModalOpen}
        onOk={() => setSupportModalOpen(false)}
        onCancel={() => setSupportModalOpen(false)}
        footer={[
          <Button key="close" type="default" onClick={() => setSupportModalOpen(false)} style={{ borderRadius: 6 }}>
            Close
          </Button>,
        ]}
      >
        <p style={{ color: textSecondary, marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
          For questions or updates regarding your gym registration:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MailOutlined style={{ color: textSecondary }} />
            <a href="mailto:partners@gymezy.com" style={{ color: '#003882', fontWeight: 600 }}>
              partners@gymezy.com
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: textSecondary }}>
            <PhoneOutlined />
            <span>+91 98765 43210 (Mon - Sat, 9 AM - 7 PM)</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationStatus;
