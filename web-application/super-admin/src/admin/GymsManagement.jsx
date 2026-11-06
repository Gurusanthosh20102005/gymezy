import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Dropdown,
  Modal,
  Form,
  Drawer,
  Pagination,
  Typography,
  Tabs,
  Space,
  message,
  Popconfirm,
  Badge,
  Tooltip,
  InputNumber,
  Avatar,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  FilterOutlined,
  PlusOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  ShopOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ExportOutlined,
  FileTextOutlined,
  DollarOutlined,
  SafetyCertificateOutlined,
  PictureOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  FileAddOutlined,
  UploadOutlined,
  RocketOutlined,
  StarFilled,
  DiffOutlined,
  SwapOutlined,
  CheckOutlined,
  CloseOutlined,
  IdcardOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  addGym,
  deleteGym,
  fetchGyms,
  updateGymStatusApi,
} from '../redux/slices/gymSlice';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/apiClient';
import GymDetailsView from './components/GymDetailsView';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const getGymLocation = (gym) => {
  if (!gym) return '—';
  if (typeof gym.location === 'string' && gym.location) return gym.location;
  const parts = [gym.area, gym.city, gym.state].filter(Boolean);
  if (parts.length > 0) return parts.join(', ');
  if (typeof gym.fullAddress === 'string' && gym.fullAddress) return gym.fullAddress;
  if (typeof gym.address === 'string' && gym.address) return gym.address;
  if (typeof gym.city === 'string' && gym.city) return gym.city;
  return '—';
};

const getGymInitials = (name) => {
  if (!name || typeof name !== 'string') return 'GY';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'GY';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
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

const getGymImage = (gym) => {
  const resolved = getGymLogoSrc(gym);
  if (resolved) return resolved;
  return 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop';
};

const GymLogoAvatar = ({ gym, isDarkMode, size = 38, onClick }) => {
  const [hasError, setHasError] = useState(false);
  const logoSrc = getGymLogoSrc(gym);
  const initials = getGymInitials(gym?.name);

  if (logoSrc && !hasError) {
    return (
      <div
        onClick={onClick}
        style={{
          display: 'inline-flex',
          cursor: onClick ? 'pointer' : 'default',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={logoSrc}
          alt={gym?.name || 'Gym Logo'}
          onError={() => setHasError(true)}
          style={{
            width: size,
            height: size,
            borderRadius: 8,
            objectFit: 'cover',
            border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
          }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'inline-flex',
        cursor: onClick ? 'pointer' : 'default',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Avatar
        shape="square"
        size={size}
        style={{
          backgroundColor: '#4338ca',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: Math.max(11, Math.round(size * 0.35)),
          borderRadius: 8,
        }}
      >
        {initials}
      </Avatar>
    </div>
  );
};

export const GymsManagement = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'approved';

  // Redux Fleet Data directly from store (with middleware pagination & counts)
  const {
    gyms: reduxGyms = [],
    pagination = {},
    counts = {},
    loading = false,
  } = useSelector((state) => state.gyms) || {};

  // Navigation Views: 'list' | 'review' | 'timing_diff'
  const [currentView, setCurrentView] = useState('list');
  const [selectedGym, setSelectedGym] = useState(reduxGyms[0] || null);
  const [activeSubTab, setActiveSubTab] = useState('profile');

  // Filter States for List View
  const [searchName, setSearchName] = useState('');
  const [searchStatus, setSearchStatus] = useState('All');
  const [searchSubscriptionType, setSearchSubscriptionType] = useState('All');
  const [searchLocation, setSearchLocation] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  // Debounced filter states to avoid rapid API thrashing
  const [debouncedSearchName, setDebouncedSearchName] = useState(searchName);
  const [debouncedLocation, setDebouncedLocation] = useState(searchLocation);
  const [debouncedPhone, setDebouncedPhone] = useState(searchPhone);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchName(searchName);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchName]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedLocation(searchLocation);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchLocation]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPhone(searchPhone);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchPhone]);

  // Modals
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);
  const [quickAddForm] = Form.useForm();
  const [rejectionReason, setRejectionReason] = useState('');
  const [holdNotes, setHoldNotes] = useState('');
  const [adminNote, setAdminNote] = useState('');

  // Pagination (driven completely by middleware)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Total matching gyms from server pagination metadata
  const totalGyms = pagination.total ?? reduxGyms.length;

  // Reset pagination page to 1 whenever filters or tabs change
  useEffect(() => {
    setCurrentPage(1);
  }, [currentTab, searchStatus, searchSubscriptionType, debouncedSearchName, debouncedLocation, debouncedPhone]);

  // Dispatch fetch to middleware with complete server-side filters & pagination
  const loadGyms = useCallback(
    (extraParams = {}) => {
      dispatch(
        fetchGyms({
          tab: currentTab,
          status: searchStatus !== 'All' ? searchStatus : undefined,
          subscriptionType: searchSubscriptionType !== 'All' ? searchSubscriptionType : undefined,
          location: debouncedLocation.trim() || undefined,
          phone: debouncedPhone.trim() || undefined,
          search: debouncedSearchName.trim() || undefined,
          page: currentPage,
          limit: pageSize,
          force: true,
          ...extraParams,
        })
      );
    },
    [
      dispatch,
      currentTab,
      searchStatus,
      searchSubscriptionType,
      debouncedLocation,
      debouncedPhone,
      debouncedSearchName,
      currentPage,
      pageSize,
    ]
  );

  useEffect(() => {
    loadGyms();
  }, [loadGyms]);

  // Reset currentView to 'list' whenever sidebar tab changes
  useEffect(() => {
    setCurrentView('list');
    setCurrentPage(1);
  }, [currentTab]);

  const handleOpenReview = (gym) => {
    setSelectedGym(gym);
    setHoldNotes(gym.remark || '');
    setRejectionReason(gym.remark || gym.rejectionReason || '');
    setCurrentView('review');
  };

  const handleOpenDetails = (gym) => {
    setSelectedGym(gym);
    setCurrentView('details');
  };

  const handleTabChange = (key) => {
    setSearchParams({ tab: key });
    setCurrentView('list');
    setCurrentPage(1);
  };

  const handleApproveAll = async (targetGym) => {
    const target = targetGym || selectedGym;
    if (target) {
      const id = target.id || target._id;
      setIsProcessingStatus(true);
      try {
        await dispatch(updateGymStatusApi({ id, status: 'Approved', approvalStatus: 'Approved' })).unwrap();
        message.success(`Gym "${target.name}" approved and published to customer app!`);
        dispatch(fetchGyms());
        setIsApproveModalOpen(false);
        setCurrentView('list');
      } catch (err) {
        message.error(err || 'Failed to approve gym');
      } finally {
        setIsProcessingStatus(false);
      }
    } else {
      setIsApproveModalOpen(false);
      setCurrentView('list');
    }
  };

  const handleHold = async (targetGym, notes) => {
    const target = targetGym || selectedGym;
    const finalNotes = notes !== undefined ? notes : holdNotes;
    if (target) {
      const id = target.id || target._id;
      setIsProcessingStatus(true);
      try {
        await dispatch(updateGymStatusApi({ id, status: 'On Hold', approvalStatus: 'On Hold', remark: finalNotes, notes: finalNotes })).unwrap();
        message.info(`Gym "${target.name}" put on hold.`);
        dispatch(fetchGyms());
        setIsHoldModalOpen(false);
        setHoldNotes('');
        setCurrentView('list');
      } catch (err) {
        message.error(err || 'Failed to put gym on hold');
      } finally {
        setIsProcessingStatus(false);
      }
    } else {
      setIsHoldModalOpen(false);
      setHoldNotes('');
      setCurrentView('list');
    }
  };

  const handleReject = async (targetGym, notes) => {
    const target = targetGym || selectedGym;
    const finalNotes = notes !== undefined ? notes : rejectionReason;
    if (target) {
      const id = target.id || target._id;
      setIsProcessingStatus(true);
      try {
        await dispatch(updateGymStatusApi({ id, status: 'Rejected', approvalStatus: 'Rejected', rejectionReason: finalNotes, remark: finalNotes })).unwrap();
        message.warning(`Changes for "${target.name}" rejected. Notes sent to partner.`);
        dispatch(fetchGyms());
        setIsRejectModalOpen(false);
        setRejectionReason('');
        setCurrentView('list');
      } catch (err) {
        message.error(err || 'Failed to reject gym');
      } finally {
        setIsProcessingStatus(false);
      }
    } else {
      setIsRejectModalOpen(false);
      setRejectionReason('');
      setCurrentView('list');
    }
  };

  const handleDeleteGym = async (gymId, gymName) => {
    try {
      if (gymId && (gymId.length === 24 || !gymId.startsWith('GYM-'))) {
        await apiClient.delete(`/gyms/${gymId}`);
      }
      dispatch(deleteGym(gymId));
      message.success(`Gym "${gymName}" deleted successfully.`);
    } catch {
      dispatch(deleteGym(gymId));
      message.success(`Gym "${gymName}" removed.`);
    }
  };

  const handleQuickAddSubmit = (values) => {
    const newGym = {
      id: `GYM-${Math.floor(1000 + Math.random() * 9000)}`,
      name: values.name,
      ownerName: values.ownerName,
      phone: values.phone.startsWith('+91') ? values.phone : `+91 ${values.phone}`,
      email: values.email,
      location: `${values.area || values.city}, ${values.city}`,
      fullAddress: `${values.area}, ${values.city}`,
      city: values.city,
      singleSessionPrice: Number(values.singleSessionPrice) || 199,
      subscriptionType: values.subscriptionType || 'Hybrid',
      subscriptionStatus: 'Active',
      status: 'Active',
      approvalStatus: 'Approved',
      image: values.image || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=400&auto=format&fit=crop',
      facilities: ['AC Gym', 'Locker Facility', 'Shower Available', 'Free Wi-Fi'],
      amenities: ['RO Drinking Water', 'Towel Service', 'First Aid Kit', 'CCTV 24/7'],
      workouts: ['GYM', 'Cardio', 'HIIT', 'Yoga'],
      trainers: [],
      rules: ['Clean indoor shoes mandatory', 'Towel mandatory on benches'],
      safety: ['CCTV surveillance', 'Daily equipment sanitization'],
    };

    dispatch(addGym(newGym));
    message.success(`New gym "${newGym.name}" onboarded and live on GYMEZY!`);
    setIsQuickAddModalOpen(false);
    quickAddForm.resetFields();
  };

  // =========================================================================
  // VIEW 4: COMPREHENSIVE FULL-PAGE GYM DETAILS & BOOKINGS VIEW
  // =========================================================================
  if (currentView === 'details' && selectedGym) {
    return (
      <GymDetailsView
        gym={selectedGym}
        allGyms={reduxGyms}
        onBack={() => setCurrentView('list')}
        onSelectGym={(g) => setSelectedGym(g)}
        onApprove={(g) => handleApproveAll(g)}
        onHold={(g, notes) => handleHold(g, notes)}
        onReject={(g, notes) => handleReject(g, notes)}
        onStatusChange={async (id, status) => {
          try {
            await dispatch(updateGymStatusApi({ id, status, approvalStatus: status === 'Active' ? 'Approved' : status })).unwrap();
            message.success(`Status updated to ${status}`);
            dispatch(fetchGyms());
          } catch (err) {
            message.error(err || 'Failed to update status');
          }
        }}
      />
    );
  }

  // =========================================================================
  // VIEW 3: DETAILED CHANGE COMPARISON (SCREEN 3)
  // =========================================================================
  if (currentView === 'timing_diff') {
    return (
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Top Breadcrumb Link */}
        <div style={{ marginBottom: 16 }}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => setCurrentView('review')}
            style={{ padding: 0, fontWeight: 600, color: 'var(--color-primary)' }}
          >
            Back to Gym Profile Changes
          </Button>
        </div>

        {/* Header */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                Gym Timings
              </h2>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 700,
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef',
                  color: '#16a34a',
                  border: `1px solid ${isDarkMode ? 'rgba(34, 197, 94, 0.3)' : '#bbf7d0'}`,
                }}
              >
                Updated
              </span>
            </div>
            <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13 }}>
              Compare the old and new timings
            </Text>
          </div>

          <Button
            icon={<ExportOutlined />}
            onClick={() => message.info('Opening live customer preview...')}
            style={{ borderRadius: 'var(--radius-base)', fontWeight: 600, color: '#4338ca', borderColor: '#c7d2fe' }}
          >
            View in Customer App
          </Button>
        </div>

        {/* Side-by-Side Day-by-Day Timing Comparison */}
        <Row gutter={[24, 24]} align="middle" style={{ marginBottom: 24 }}>
          {/* Left: Old Timings (Red Tone) */}
          <Col xs={24} md={11}>
            <Card
              style={{
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : '#fff5f5',
                borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.25)' : '#fecaca',
                borderRadius: 'var(--radius-base)',
              }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: '#dc2626', fontWeight: 700, fontSize: 14 }}>
                <ClockCircleOutlined /> Old Timings
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { day: 'Monday', time: '05:30 AM - 11:00 PM' },
                  { day: 'Tuesday', time: '05:30 AM - 11:00 PM' },
                  { day: 'Wednesday', time: '05:30 AM - 11:00 PM' },
                  { day: 'Thursday', time: '05:30 AM - 11:00 PM' },
                  { day: 'Friday', time: '05:30 AM - 11:00 PM' },
                  { day: 'Saturday', time: '06:00 AM - 10:30 PM' },
                  { day: 'Sunday', time: '06:00 AM - 10:30 PM' },
                ].map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>{row.day}</span>
                    <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontFamily: 'monospace' }}>{row.time}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          {/* Center Transition Arrow */}
          <Col xs={24} md={2} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6366f1',
                fontSize: 16,
              }}
            >
              <ArrowRightOutlined />
            </div>
          </Col>

          {/* Right: New Timings (Green Tone) */}
          <Col xs={24} md={11}>
            <Card
              style={{
                backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.08)' : '#f0fdf4',
                borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.25)' : '#bbf7d0',
                borderRadius: 'var(--radius-base)',
              }}
              styles={{ body: { padding: '24px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, color: '#16a34a', fontWeight: 700, fontSize: 14 }}>
                <CheckCircleOutlined /> New Timings
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { day: 'Monday', time: '05:00 AM - 11:30 PM', changed: true },
                  { day: 'Tuesday', time: '05:00 AM - 11:30 PM', changed: true },
                  { day: 'Wednesday', time: '05:00 AM - 11:30 PM', changed: true },
                  { day: 'Thursday', time: '05:00 AM - 11:30 PM', changed: true },
                  { day: 'Friday', time: '05:00 AM - 11:30 PM', changed: true },
                  { day: 'Saturday', time: '05:30 AM - 11:00 PM', changed: true },
                  { day: 'Sunday', time: '05:30 AM - 11:00 PM', changed: true },
                ].map((row, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>{row.day}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 700, fontFamily: 'monospace' }}>
                        {row.time}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>Changed</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Optional Notes Section */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
            marginBottom: 20,
          }}
          styles={{ body: { padding: '20px' } }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 8 }}>
            Notes (Optional)
          </div>
          <TextArea
            rows={3}
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
            placeholder="Add notes about this change..."
            style={{
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? '#111827' : '#ffffff',
              borderColor: isDarkMode ? '#374151' : '#d9d9d9',
              marginBottom: 16,
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setCurrentView('review')}>Cancel</Button>
            <Button
              type="primary"
              onClick={() => {
                message.success('Timings modification note saved.');
                setCurrentView('review');
              }}
              style={{ backgroundColor: '#4338ca', borderColor: '#4338ca', fontWeight: 600 }}
            >
              Save Note
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: REVIEW CHANGES – GYM PROFILE (SCREEN 2)
  // =========================================================================
  if (currentView === 'review') {
    if (!selectedGym) {
      return (
        <div style={{ maxWidth: 800, margin: '60px auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? '#fff' : '#0f172a', marginBottom: 12 }}>
            No Gym Selected
          </h2>
          <p style={{ color: '#64748b', marginBottom: 20 }}>
            Please choose a gym from the fleet list to review its submitted details.
          </p>
          <Button type="primary" onClick={() => setCurrentView('list')} style={{ fontWeight: 600 }}>
            Back to Gyms Directory
          </Button>
        </div>
      );
    }

    return (
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Top Back Link & Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => setCurrentView('list')}
            style={{ padding: 0, fontWeight: 600, color: 'var(--color-primary)', fontSize: 14 }}
          >
            Back to Gyms Fleet
          </Button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#cbd5e1' : '#475569' }}>
              Switch Pending Gym:
            </span>
            <Select
              value={selectedGym?.id || selectedGym?._id}
              onChange={(gymId) => {
                const target = reduxGyms.find((g) => (g.id || g._id) === gymId);
                if (target) setSelectedGym(target);
              }}
              style={{ width: 220 }}
            >
              {reduxGyms
                .filter((g) => g.approvalStatus === 'Pending Approval' || g.status === 'Pending')
                .map((g) => (
                  <Option key={g.id || g._id} value={g.id || g._id}>
                    {g.name}
                  </Option>
                ))}
            </Select>
          </div>
        </div>

        {/* Gym Header & Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                {selectedGym?.name || 'Gym Partner'}
              </h1>
              {selectedGym?.partnerId ? (
                <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, padding: '2px 8px' }}>
                  {selectedGym.partnerId}
                </Tag>
              ) : (
                <Tag style={{ fontWeight: 600, fontSize: 13, padding: '2px 8px' }}>
                  -
                </Tag>
              )}
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef4e8',
                  color: '#d97706',
                  border: `1px solid ${isDarkMode ? 'rgba(245, 158, 11, 0.3)' : '#fed7aa'}`,
                }}
              >
                {selectedGym?.approvalStatus || 'Pending Approval'}
              </span>
            </div>
            <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
              Requested by <strong style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>{selectedGym?.requestedBy || selectedGym?.ownerName || 'Gym Partner'}</strong> on {selectedGym?.requestedOn || 'Recent'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Button
              danger
              onClick={() => {
                setRejectionReason(selectedGym?.remark || '');
                setIsRejectModalOpen(true);
              }}
              style={{ borderRadius: 'var(--radius-base)', fontWeight: 600, height: 40, padding: '0 18px' }}
            >
              Reject Changes
            </Button>
            <Button
              onClick={() => {
                setHoldNotes(selectedGym?.remark || '');
                setIsHoldModalOpen(true);
              }}
              style={{
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                height: 40,
                padding: '0 18px',
                borderColor: '#fa8c16',
                color: '#fa8c16',
              }}
            >
              Put on Hold
            </Button>
            <Button
              type="primary"
              onClick={() => setIsApproveModalOpen(true)}
              style={{
                borderRadius: 'var(--radius-base)',
                fontWeight: 700,
                backgroundColor: '#16a34a',
                borderColor: '#16a34a',
                height: 40,
                padding: '0 20px',
              }}
            >
              Approve All Changes
            </Button>
          </div>
        </div>

        {/* Dynamic Changes / Verification Container */}
        {(() => {
          const isEditRequest = Boolean(
            selectedGym?.pendingChanges &&
            typeof selectedGym.pendingChanges === 'object' &&
            Object.keys(selectedGym.pendingChanges).length > 0
          );

          const latestAudit =
            Array.isArray(selectedGym?.auditHistory) && selectedGym.auditHistory.length > 0
              ? selectedGym.auditHistory[0]
              : null;
          const previousSnapshot = latestAudit?.previousSnapshot || selectedGym;

          const ignoredKeys = new Set([
            '_id',
            'id',
            '__v',
            'key',
            'updatedAt',
            'createdAt',
            'auditHistory',
            'pendingChanges',
            'approvalStatus',
            'changesCount',
            'customFacilities',
          ]);

          const gymDiffRows = isEditRequest
            ? Object.entries(selectedGym.pendingChanges)
                .filter(([k]) => !ignoredKeys.has(k))
                .map(([k, newVal]) => {
                  let oldVal = latestAudit?.editedFields?.[k]?.oldValue;
                  if (oldVal === undefined) {
                    oldVal = previousSnapshot?.[k];
                  }
                  if (oldVal === undefined) {
                    oldVal = selectedGym[k];
                  }

                  const normalize = (v) => {
                    if (v === null || v === undefined) return '';
                    if (typeof v === 'object') return JSON.stringify(v);
                    return String(v).trim();
                  };

                  const isIdentical =
                    normalize(oldVal) === normalize(newVal) &&
                    latestAudit?.editedFields?.[k] === undefined;

                  return {
                    fieldKey: k,
                    fieldName: k.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
                    oldVal,
                    newVal,
                    isIdentical,
                  };
                })
                .filter((row) => !row.isIdentical)
            : [];

          const renderDiffValue = (val, fieldKey) => {
            if (val === null || val === undefined || val === '') {
              return <span style={{ color: isDarkMode ? '#666666' : '#94a3b8' }}>—</span>;
            }
            if (typeof val === 'boolean') {
              return <span>{val ? 'Yes' : 'No'}</span>;
            }
            if (fieldKey === 'logo' || fieldKey === 'coverPhoto') {
              const url = typeof val === 'object' && val.fileData ? val.fileData : val;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img
                    src={url}
                    alt={fieldKey}
                    style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 6 }}
                  />
                  <span style={{ fontSize: 12, color: isDarkMode ? '#aaaaaa' : '#64748b' }}>
                    {fieldKey === 'logo' ? 'Logo' : 'Cover Banner'}
                  </span>
                </div>
              );
            }
            if (fieldKey === 'galleryPhotos' && Array.isArray(val)) {
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {val.map((img, i) => {
                    const src = typeof img === 'object' && img.fileData ? img.fileData : img;
                    return (
                      <img
                        key={i}
                        src={src}
                        alt={`Photo ${i + 1}`}
                        style={{ width: 50, height: 40, objectFit: 'cover', borderRadius: 4 }}
                      />
                    );
                  })}
                </div>
              );
            }
            if ((fieldKey === 'pricingPlans' || fieldKey === 'customPricingPlans') && Array.isArray(val)) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {val.map((p, i) => (
                    <div
                      key={p.id || i}
                      style={{
                        fontSize: 12,
                        padding: '6px 10px',
                        borderRadius: 6,
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#f8fafc',
                        border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#3b82f6' }}>{p.name || p.badge || 'Plan'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 800, color: isDarkMode ? '#10b981' : '#059669' }}>
                            ₹{p.price} {p.duration ? `(${p.duration})` : ''}
                          </span>
                          {p.savingsText && (
                            <Tag color="green" style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                              {p.savingsText}
                            </Tag>
                          )}
                        </div>
                      </div>
                      {p.description && (
                        <div style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                          {p.description}
                        </div>
                      )}
                      {Array.isArray(p.features) && p.features.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {p.features.map((feat, fIdx) => (
                            <Tag key={fIdx} style={{ fontSize: 10, margin: 0 }}>
                              {feat}
                            </Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            }
            if (fieldKey === 'pricingPlans' && typeof val === 'object' && !Array.isArray(val)) {
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(val).map(([k, v]) => (
                    <Tag key={k} color="blue" style={{ fontSize: 11, margin: 0 }}>
                      <strong>{k.replace(/([A-Z])/g, ' $1')}:</strong> ₹{String(v)}
                    </Tag>
                  ))}
                </div>
              );
            }
            if ((fieldKey === 'facilities' || fieldKey === 'customFacilities') && Array.isArray(val)) {
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {val.map((f, i) => (
                    <Tag key={i} color="blue" style={{ fontSize: 11, margin: 0 }}>
                      {typeof f === 'string' ? f : `${f.name || f.title || 'Facility'}${f.count ? ` (${f.count})` : ''}`}
                    </Tag>
                  ))}
                </div>
              );
            }
            if (['workouts', 'amenities', 'rules', 'safetyMeasures', 'slotsMorning', 'slotsEvening'].includes(fieldKey) && Array.isArray(val)) {
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {val.map((item, i) => (
                    <Tag key={i} color="geekblue" style={{ fontSize: 11, margin: 0 }}>
                      {typeof item === 'string' ? item : JSON.stringify(item)}
                    </Tag>
                  ))}
                </div>
              );
            }
            if (fieldKey === 'openingHours' && typeof val === 'object') {
              return (
                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div><strong>Weekday:</strong> {val.weekdayOpen || '05:30 AM'} - {val.weekdayClose || '10:30 PM'}</div>
                  <div><strong>Weekend:</strong> {val.weekendOpen || '06:00 AM'} - {val.weekendClose || '09:00 PM'}</div>
                  {val.is24Hours && <div><Tag color="green">24 Hours Open</Tag></div>}
                  {Array.isArray(val.holidays) && val.holidays.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <span style={{ fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#475569' }}>Holidays / Exceptions:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                        {val.holidays.map((h, i) => (
                          <Tag key={h.id || i} color="volcano" style={{ fontSize: 11, margin: 0 }}>
                            {h.title || h.date}: {h.hours || h.type}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            if (fieldKey === 'bankDetails' && typeof val === 'object') {
              return (
                <div style={{ fontSize: 12 }}>
                  <div><strong>{val.bankName || 'Bank'}</strong> - {val.accountNumber || '—'}</div>
                  <div>IFSC: {val.ifscCode || '—'} | UPI: {val.upiId || '—'}</div>
                  {val.accountHolderName && <div>Holder: {val.accountHolderName}</div>}
                </div>
              );
            }
            if (fieldKey === 'socialLinks' && typeof val === 'object') {
              return (
                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {val.instagramHandle && <div><strong>Instagram:</strong> {val.instagramHandle}</div>}
                  {val.whatsapp && <div><strong>WhatsApp:</strong> {val.whatsapp}</div>}
                  {val.website && <div><strong>Website:</strong> {val.website}</div>}
                  {val.facebook && <div><strong>Facebook:</strong> {val.facebook}</div>}
                </div>
              );
            }
            if (fieldKey === 'systemSettings' && typeof val === 'object') {
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {Object.entries(val).map(([k, v]) => (
                    <Tag key={k} style={{ fontSize: 11, margin: 0 }}>
                      <strong>{k.replace(/([A-Z])/g, ' $1')}:</strong> {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                    </Tag>
                  ))}
                </div>
              );
            }
            if (Array.isArray(val)) {
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {val.map((item, i) => (
                    <Tag key={i} style={{ fontSize: 11, margin: 0 }}>
                      {typeof item === 'object' && item !== null
                        ? item.name || item.title || item.label || JSON.stringify(item)
                        : String(item)}
                    </Tag>
                  ))}
                </div>
              );
            }
            if (typeof val === 'object') {
              return <span style={{ wordBreak: 'break-word', fontSize: 12 }}>{JSON.stringify(val)}</span>;
            }
            return <span style={{ wordBreak: 'break-word' }}>{String(val)}</span>;
          };

          return (
            <div style={{ marginBottom: 30 }}>
              {isEditRequest && gymDiffRows.length > 0 ? (
                <div>
                  <div
                    style={{
                      padding: '12px 16px',
                      borderRadius: 8,
                      backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#b45309',
                      fontSize: 14,
                      fontWeight: 600,
                      marginBottom: 18,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      Pending Profile Modifications ({gymDiffRows.length} field(s) changed)
                    </span>
                    <Tag color="warning" style={{ fontWeight: 700 }}>
                      Pending Approval
                    </Tag>
                  </div>

                  <div
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                      overflow: 'hidden',
                    }}
                  >
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13,
                        tableLayout: 'fixed',
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                            borderBottom: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                          }}
                        >
                          <th
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontWeight: 700,
                              width: '26%',
                            }}
                          >
                            Field Name
                          </th>
                          <th
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontWeight: 700,
                              width: '37%',
                              color: '#ef4444',
                            }}
                          >
                            Current Live Value
                          </th>
                          <th
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontWeight: 700,
                              width: '37%',
                              color: '#16a34a',
                            }}
                          >
                            Requested Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {gymDiffRows.map((row, idx) => (
                          <tr
                            key={row.fieldKey || idx}
                            style={{
                              borderBottom: `1px solid ${isDarkMode ? '#1e293b' : '#f1f5f9'}`,
                              backgroundColor: idx % 2 === 0 ? 'transparent' : isDarkMode ? 'rgba(255,255,255,0.02)' : '#fafafa',
                            }}
                          >
                            <td
                              style={{
                                padding: '12px 16px',
                                fontWeight: 700,
                                color: isDarkMode ? '#e2e8f0' : '#1e293b',
                              }}
                            >
                              {row.fieldName}
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                color: isDarkMode ? '#cbd5e1' : '#475569',
                                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.05)' : '#fef2f2',
                              }}
                            >
                              {renderDiffValue(row.oldVal, row.fieldKey)}
                            </td>
                            <td
                              style={{
                                padding: '12px 16px',
                                color: isDarkMode ? '#ffffff' : '#0f172a',
                                fontWeight: 600,
                                backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.08)' : '#f0fdf4',
                              }}
                            >
                              {renderDiffValue(row.newVal, row.fieldKey)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* New Onboard or Full Verification Card View */
                <Row gutter={[20, 20]}>
                  <Col xs={24} md={12}>
                    <Card
                      title={<span style={{ fontWeight: 700 }}>Basic Information</span>}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-base)', height: '100%' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                        <div><strong>Gym Name:</strong> {selectedGym?.name || '—'}</div>
                        <div><strong>Owner Name:</strong> {selectedGym?.ownerName || '—'}</div>
                        <div><strong>Phone:</strong> {selectedGym?.phone || '—'}</div>
                        <div><strong>Email:</strong> {selectedGym?.email || '—'}</div>
                        <div><strong>Business Type:</strong> {selectedGym?.businessType || 'Private Limited'}</div>
                        <div><strong>GST / PAN:</strong> {selectedGym?.gstNumber || '—'} / {selectedGym?.panNumber || '—'}</div>
                        <div><strong>Address:</strong> {selectedGym?.address || selectedGym?.fullAddress || `${selectedGym?.area || ''} ${selectedGym?.city || ''}`}</div>
                      </div>
                    </Card>
                  </Col>

                  <Col xs={24} md={12}>
                    <Card
                      title={<span style={{ fontWeight: 700 }}>Facilities & Operations</span>}
                      style={{ backgroundColor: 'var(--bg-surface-elevated)', borderColor: 'var(--border-color)', borderRadius: 'var(--radius-base)', height: '100%' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                        <div>
                          <strong>Operating Hours:</strong>{' '}
                          {selectedGym?.openingHours?.displayText ||
                            `${selectedGym?.openingHours?.weekdayOpen || '05:30 AM'} - ${selectedGym?.openingHours?.weekdayClose || '10:30 PM'}`}
                        </div>
                        <div>
                          <strong>Floor Space / Capacity:</strong> {selectedGym?.floorSpaceSqFt || 3500} sq.ft / {selectedGym?.maxFloorCapacity || 60} persons
                        </div>
                        <div>
                          <strong>Facilities:</strong>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                            {(selectedGym?.facilities || []).map((f, i) => (
                              <Tag key={i} color="blue">{typeof f === 'string' ? f : f.name}</Tag>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Col>
                </Row>
              )}
            </div>
          );
        })()}

        {/* Screen 4: Confirmation Modal */}
        <Modal
          open={isApproveModalOpen}
          onCancel={() => !isProcessingStatus && setIsApproveModalOpen(false)}
          closable={!isProcessingStatus}
          maskClosable={!isProcessingStatus}
          footer={null}
          centered
          width={440}
        >
          <div style={{ textAlign: 'center', padding: '24px 12px 12px 12px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#eaf8ef',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <CheckCircleOutlined style={{ fontSize: 36, color: '#16a34a' }} />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', margin: '0 0 8px 0' }}>
              Approve Changes?
            </h3>

            <p style={{ fontSize: 13, color: isDarkMode ? '#aaaaaa' : '#64748b', lineHeight: 1.5, marginBottom: 24 }}>
              All approved changes will be published and reflected in the customer app immediately. Partner ID will be generated if not assigned yet.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Button
                disabled={isProcessingStatus}
                onClick={() => setIsApproveModalOpen(false)}
                style={{ height: 42, borderRadius: 'var(--radius-base)', fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                loading={isProcessingStatus}
                disabled={isProcessingStatus}
                onClick={() => handleApproveAll(selectedGym)}
                style={{
                  height: 42,
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: '#16a34a',
                  borderColor: '#16a34a',
                  fontWeight: 700,
                }}
              >
                Yes, Approve & Publish
              </Button>
            </div>
          </div>
        </Modal>

        {/* Hold Modal */}
        <Modal
          title="Put Gym on Hold"
          open={isHoldModalOpen}
          onCancel={() => !isProcessingStatus && setIsHoldModalOpen(false)}
          closable={!isProcessingStatus}
          maskClosable={!isProcessingStatus}
          footer={null}
          centered
          width={480}
        >
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: 13, color: isDarkMode ? '#aaaaaa' : '#64748b', marginBottom: 12 }}>
              Specify the required updates or missing information for <strong>{selectedGym?.name || 'Selected Gym'}</strong>:
            </p>
            <TextArea
              rows={4}
              disabled={isProcessingStatus}
              value={holdNotes}
              onChange={(e) => setHoldNotes(e.target.value)}
              placeholder="e.g. Please upload trade license with clear stamp, update opening hours..."
              style={{ marginBottom: 18 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button disabled={isProcessingStatus} onClick={() => setIsHoldModalOpen(false)}>Cancel</Button>
              <Button
                type="primary"
                loading={isProcessingStatus}
                disabled={isProcessingStatus}
                onClick={() => handleHold(selectedGym, holdNotes)}
                style={{ fontWeight: 600, backgroundColor: '#fa8c16', borderColor: '#fa8c16' }}
              >
                Confirm Hold
              </Button>
            </div>
          </div>
        </Modal>

        {/* Rejection Modal */}
        <Modal
          title="Reject Gym Changes"
          open={isRejectModalOpen}
          onCancel={() => !isProcessingStatus && setIsRejectModalOpen(false)}
          closable={!isProcessingStatus}
          maskClosable={!isProcessingStatus}
          footer={null}
          centered
          width={480}
        >
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: 13, color: isDarkMode ? '#aaaaaa' : '#64748b', marginBottom: 12 }}>
              Please specify the reason for rejecting changes submitted by <strong>{selectedGym?.requestedBy || selectedGym?.ownerName || 'Gym Partner'}</strong>:
            </p>
            <TextArea
              rows={4}
              disabled={isProcessingStatus}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g. Photo resolution too low, pricing does not adhere to platform standard..."
              style={{ marginBottom: 18 }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button disabled={isProcessingStatus} onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
              <Button
                danger
                type="primary"
                loading={isProcessingStatus}
                disabled={isProcessingStatus}
                onClick={() => handleReject(selectedGym, rejectionReason)}
                style={{ fontWeight: 600 }}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: MAIN LIST VIEW (SCREEN 1 & ALL GYMS)
  // =========================================================================
  const isPendingView = currentTab === 'pending';

  const getHeaderBadge = () => {
    switch (currentTab) {
      case 'pending': {
        const count = counts.pending ?? reduxGyms.filter((g) => g.approvalStatus === 'Pending Approval' || g.status === 'Pending' || g.approvalStatus === 'Pending').length;
        return count > 0 ? <Badge count={count} style={{ backgroundColor: '#d97706', fontWeight: 800 }} /> : null;
      }
      case 'approved': {
        const count = counts.approved ?? reduxGyms.filter((g) => g.approvalStatus === 'Approved' || g.status === 'Active').length;
        return count > 0 ? <Badge count={count} overflowCount={9999} style={{ backgroundColor: '#16a34a', fontWeight: 800 }} /> : null;
      }
      case 'on_hold': {
        const count = counts.on_hold ?? reduxGyms.filter((g) => g.approvalStatus === 'On Hold' || g.status === 'On Hold' || g.status === 'Inactive').length;
        return count > 0 ? <Badge count={count} style={{ backgroundColor: '#3b82f6', fontWeight: 800 }} /> : null;
      }
      case 'rejected': {
        const count = counts.rejected ?? reduxGyms.filter((g) => g.approvalStatus === 'Rejected' || g.status === 'Rejected').length;
        return count > 0 ? <Badge count={count} style={{ backgroundColor: '#ef4444', fontWeight: 800 }} /> : null;
      }
      default: {
        const count = counts.total ?? totalGyms;
        return count > 0 ? <Badge count={count} overflowCount={9999} style={{ backgroundColor: '#4338ca', fontWeight: 800 }} /> : null;
      }
    }
  };

  const getHeaderTitle = () => {
    switch (currentTab) {
      case 'pending':
        return 'Gym Onboarding Requests';
      case 'approved':
        return 'Approved Partner Gyms';
      case 'on_hold':
        return 'On Hold Gyms';
      case 'rejected':
        return 'Rejected Gyms';
      default:
        return 'Approved Partner Gyms';
    }
  };

  const getHeaderSubtitle = () => {
    switch (currentTab) {
      case 'pending':
        return 'New partner gym onboarding applications awaiting Super Admin verification and approval.';
      case 'approved':
        return 'Verified and published gym partners operating live on the Gymezy platform.';
      case 'on_hold':
        return 'Gym partners currently placed on administrative hold pending document re-submission.';
      case 'rejected':
        return 'Gym listings that did not meet onboarding quality and compliance standards.';
      default:
        return 'Verified and published gym partners operating live on the Gymezy platform.';
    }
  };

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto' }}>
      {/* 1. Page Header & Action Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: isDarkMode ? '#ffffff' : '#0f172a',
                margin: 0,
                letterSpacing: '-0.3px',
              }}
            >
              {getHeaderTitle()}
            </h1>
            {getHeaderBadge()}
          </div>
          <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13 }}>
            {getHeaderSubtitle()}
          </Text>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/onboarding')}
            style={{
              height: 40,
              padding: '0 18px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: '#4338ca',
              borderColor: '#4338ca',
              fontWeight: 700,
              fontSize: 14,
              boxShadow: '0 4px 14px rgba(67, 56, 202, 0.35)',
            }}
          >
            Add New Gym
          </Button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 20,
        }}
        styles={{ body: { padding: '18px 20px' } }}
      >
        <Row gutter={[14, 14]}>
          <Col xs={24} sm={12} lg={6}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
              Gym Name
            </div>
            <Input
              placeholder="Search by gym name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              style={{ height: 38, borderRadius: 'var(--radius-base)' }}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} lg={4}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
              Approval Status
            </div>
            <Select value={searchStatus} onChange={setSearchStatus} style={{ width: '100%', height: 38 }}>
              <Option value="All">All Status</Option>
              <Option value="Approved">Approved</Option>
              <Option value="Pending Approval">Pending Approval</Option>
              <Option value="Rejected">Rejected</Option>
              <Option value="On Hold">On Hold</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} lg={5}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
              Subscription Tier
            </div>
            <Select value={searchSubscriptionType} onChange={setSearchSubscriptionType} style={{ width: '100%', height: 38 }}>
              <Option value="All">All Plans</Option>
              <Option value="Hybrid">Hybrid (₹ 4,999/mo)</Option>
              <Option value="App Only">App Only (₹ 2,999/mo)</Option>
              <Option value="GMS">GMS Only (₹ 1,999/mo)</Option>
              <Option value="Listing Only">Listing Only (₹ 999/mo)</Option>
            </Select>
          </Col>

          <Col xs={24} sm={12} lg={5}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
              Location / City
            </div>
            <Input
              placeholder="Chennai, Mumbai, Pune..."
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              suffix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />}
              style={{ height: 38, borderRadius: 'var(--radius-base)' }}
              allowClear
            />
          </Col>

          <Col xs={24} sm={12} lg={4}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
              Phone Number
            </div>
            <Input
              placeholder="+91..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              style={{ height: 38, borderRadius: 'var(--radius-base)' }}
              allowClear
            />
          </Col>
        </Row>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}` }}>
          <div style={{ fontSize: 13, color: isDarkMode ? '#888' : '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading ? (
              <>
                <Spin size="small" />
                <span>Searching gyms fleet...</span>
              </>
            ) : (
              <>
                Found <strong style={{ color: isDarkMode ? '#fff' : '#0f172a' }}>{totalGyms}</strong> matching gyms
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Button
              size="small"
              onClick={() => {
                setSearchName('');
                setSearchStatus('All');
                setSearchSubscriptionType('All');
                setSearchLocation('');
                setSearchPhone('');
                setCurrentPage(1);
              }}
            >
              Reset Filters
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => message.success('Exporting gyms list as CSV...')}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Typo-Tolerant "Did You Mean" Suggestion Banner */}
      {pagination?.didYouMean &&
        debouncedSearchName &&
        pagination.didYouMean.toLowerCase() !== debouncedSearchName.toLowerCase().trim() && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 18px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.12)' : '#eff6ff',
              border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : '#bfdbfe'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#1e3a8a' }}>
              <SearchOutlined style={{ color: '#3b82f6' }} />
              <span>
                Did you mean:{" "}
                <strong
                  onClick={() => {
                    setSearchName(pagination.didYouMean);
                    setDebouncedSearchName(pagination.didYouMean);
                  }}
                  style={{
                    cursor: 'pointer',
                    color: '#2563eb',
                    textDecoration: 'underline',
                  }}
                >
                  {pagination.didYouMean}
                </strong>
                ?
              </span>
            </div>
            <Button
              size="small"
              type="primary"
              ghost
              onClick={() => {
                setSearchName(pagination.didYouMean);
                setDebouncedSearchName(pagination.didYouMean);
              }}
              style={{ fontWeight: 700, fontSize: 12, borderRadius: 6 }}
            >
              Search for &ldquo;{pagination.didYouMean}&rdquo;
            </Button>
          </div>
        )}

      {/* 4. Main Tables Area */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          overflow: 'hidden',
          marginBottom: 20,
        }}
        styles={{ body: { padding: 0 } }}
      >
        {isPendingView ? (
          /* PENDING APPROVAL TABLE */
          <Table
            dataSource={reduxGyms}
            rowKey={(record) => record.id || record._id || String(Math.random())}
            pagination={false}
            loading={{
              spinning: loading,
              tip: 'Loading pending approvals...',
              size: 'large',
            }}
            scroll={{ x: 1350 }}
            size="middle"
            columns={[
              {
                title: 'Partner ID',
                dataIndex: 'partnerId',
                key: 'partnerId',
                width: 110,
                render: (_, record) => {
                  const partnerIdDisplay = record.partnerId;
                  if (!partnerIdDisplay) {
                    return (
                      <span style={{ color: isDarkMode ? '#888888' : '#94a3b8', fontWeight: 500, paddingLeft: 4 }}>
                        -
                      </span>
                    );
                  }
                  return (
                    <span
                      onClick={() => handleOpenDetails(record)}
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: isDarkMode ? '#818cf8' : '#4338ca',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        letterSpacing: '0.3px',
                      }}
                    >
                      {partnerIdDisplay}
                    </span>
                  );
                },
              },
              {
                title: 'Gym Logo',
                key: 'logo',
                width: 90,
                align: 'center',
                render: (_, record) => (
                  <GymLogoAvatar
                    gym={record}
                    isDarkMode={isDarkMode}
                    onClick={() => handleOpenDetails(record)}
                  />
                ),
              },
              {
                title: 'Gym Name',
                dataIndex: 'name',
                key: 'name',
                width: 260,
                render: (name, record) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, justifyContent: 'center' }}>
                    <Tooltip title={name}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isDarkMode ? '#f8fafc' : '#0f172a',
                          fontSize: 13.5,
                          lineHeight: '1.4',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                        }}
                      >
                        {name}
                      </span>
                    </Tooltip>
                    <div>
                      <Tag color="cyan" style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, margin: 0, fontWeight: 600 }}>
                        {record.genderAllowed || 'Unisex'}
                      </Tag>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Phone Number',
                dataIndex: 'phone',
                key: 'phone',
                width: 150,
                render: (phone) => (
                  <span style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {phone || '—'}
                  </span>
                ),
              },
              {
                title: 'Location',
                dataIndex: 'location',
                key: 'location',
                width: 200,
                render: (_, record) => {
                  const loc = getGymLocation(record);
                  return (
                    <Tooltip title={loc}>
                      <span
                        style={{
                          color: isDarkMode ? '#d1d5db' : '#334155',
                          fontSize: 13,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '18px',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                        }}
                      >
                        {loc}
                      </span>
                    </Tooltip>
                  );
                },
              },
              {
                title: 'Requested By',
                dataIndex: 'requestedBy',
                key: 'requestedBy',
                width: 160,
                render: (req, record) => (
                  <span
                    onClick={() => handleOpenDetails(record)}
                    style={{
                      fontWeight: 600,
                      color: isDarkMode ? '#e2e8f0' : '#1e293b',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: 13,
                    }}
                  >
                    {req || record.ownerName || 'Gym Partner'}
                  </span>
                ),
              },
              {
                title: 'Requested On',
                dataIndex: 'requestedOn',
                key: 'requestedOn',
                width: 150,
                render: (date) => (
                  <span style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13 }}>{date || 'Recent'}</span>
                ),
              },
              {
                title: 'Changes',
                dataIndex: 'changesCount',
                key: 'changesCount',
                width: 120,
                render: (count) => (
                  <Tag color="orange" style={{ fontWeight: 700, borderRadius: 4 }}>
                    {count || 1} Changes
                  </Tag>
                ),
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                width: 120,
                render: () => (
                  <Tag color="gold" style={{ fontWeight: 700, letterSpacing: '0.4px' }}>
                    Pending
                  </Tag>
                ),
              },
              {
                title: 'Action',
                key: 'action',
                width: 110,
                align: 'center',
                fixed: 'right',
                onCell: () => ({
                  style: {
                    backgroundColor: isDarkMode ? '#0d1117' : '#ffffff',
                  },
                }),
                render: (_, record) => (
                  <Button
                    size="small"
                    onClick={() => handleOpenReview(record)}
                    style={{
                      borderRadius: 6,
                      fontWeight: 700,
                      color: '#4338ca',
                      borderColor: '#c7d2fe',
                      backgroundColor: isDarkMode ? 'rgba(99,102,241,0.1)' : '#eef2ff',
                      fontSize: 12,
                    }}
                  >
                    Review →
                  </Button>
                ),
              },
            ]}
          />
        ) : (
          /* ALL / APPROVED / ON-HOLD / REJECTED GYMS TABLE */
          <Table
            dataSource={reduxGyms}
            rowKey={(record) => record.id || record._id || String(Math.random())}
            pagination={false}
            loading={{
              spinning: loading,
              tip: 'Loading gyms fleet...',
              size: 'large',
            }}
            scroll={{ x: 1450 }}
            size="middle"
            columns={[
              {
                title: 'Partner ID',
                dataIndex: 'partnerId',
                key: 'partnerId',
                width: 110,
                render: (_, record) => {
                  const partnerIdDisplay = record.partnerId;
                  if (!partnerIdDisplay) {
                    return (
                      <span style={{ color: isDarkMode ? '#888888' : '#94a3b8', fontWeight: 500, paddingLeft: 4 }}>
                        -
                      </span>
                    );
                  }
                  return (
                    <span
                      onClick={() => handleOpenDetails(record)}
                      style={{
                        fontWeight: 700,
                        fontSize: 13,
                        color: isDarkMode ? '#818cf8' : '#4338ca',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        letterSpacing: '0.3px',
                      }}
                    >
                      {partnerIdDisplay}
                    </span>
                  );
                },
              },
              {
                title: 'Gym Logo',
                key: 'logo',
                width: 90,
                align: 'center',
                render: (_, record) => (
                  <GymLogoAvatar
                    gym={record}
                    isDarkMode={isDarkMode}
                    onClick={() => handleOpenDetails(record)}
                  />
                ),
              },
              {
                title: 'Gym Name',
                dataIndex: 'name',
                key: 'name',
                width: 260,
                render: (name, record) => (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, justifyContent: 'center' }}>
                    <Tooltip title={name}>
                      <span
                        style={{
                          fontWeight: 700,
                          color: isDarkMode ? '#f8fafc' : '#0f172a',
                          fontSize: 13.5,
                          lineHeight: '1.4',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                        }}
                      >
                        {name}
                      </span>
                    </Tooltip>
                    <div>
                      <Tag color="cyan" style={{ fontSize: 10, padding: '0 6px', borderRadius: 4, margin: 0, fontWeight: 600 }}>
                        {record.genderAllowed || 'Unisex'}
                      </Tag>
                    </div>
                  </div>
                ),
              },
              {
                title: 'Phone Number',
                dataIndex: 'phone',
                key: 'phone',
                width: 150,
                render: (phone) => (
                  <span style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {phone || '—'}
                  </span>
                ),
              },
              {
                title: 'Location',
                dataIndex: 'location',
                key: 'location',
                width: 200,
                render: (_, record) => {
                  const loc = getGymLocation(record);
                  return (
                    <Tooltip title={loc}>
                      <span
                        style={{
                          color: isDarkMode ? '#d1d5db' : '#334155',
                          fontSize: 13,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: '18px',
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                        }}
                      >
                        {loc}
                      </span>
                    </Tooltip>
                  );
                },
              },
              {
                title: 'Partner / Owner',
                dataIndex: 'requestedBy',
                key: 'requestedBy',
                width: 150,
                render: (owner, record) => (
                  <span
                    onClick={() => handleOpenDetails(record)}
                    style={{
                      fontWeight: 600,
                      color: isDarkMode ? '#e2e8f0' : '#1e293b',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontSize: 13,
                    }}
                  >
                    {owner || record.ownerName || 'Gym Partner'}
                  </span>
                ),
              },
              {
                title: 'Approval Status',
                dataIndex: 'approvalStatus',
                key: 'approvalStatus',
                width: 150,
                render: (status) => {
                  let color = 'default';
                  if (status === 'Approved') color = 'success';
                  else if (status === 'Pending Approval') color = 'warning';
                  else if (status === 'On Hold') color = 'processing';
                  else if (status === 'Rejected') color = 'error';
                  return <Tag color={color} style={{ fontWeight: 600 }}>{status || 'Approved'}</Tag>;
                },
              },
              {
                title: 'Subscription Tier',
                dataIndex: 'subscriptionType',
                key: 'subscriptionType',
                width: 140,
                render: (type) => {
                  let color = 'blue';
                  if (type === 'Hybrid') color = 'purple';
                  else if (type === 'GMS') color = 'cyan';
                  else if (type === 'Listing Only') color = 'default';
                  return <Tag color={color} style={{ fontWeight: 600 }}>{type || 'Hybrid'}</Tag>;
                },
              },
              {
                title: 'Monthly GMV',
                dataIndex: 'monthlyRevenue',
                key: 'monthlyRevenue',
                width: 130,
                render: (rev) => {
                  const formatted =
                    typeof rev === 'number'
                      ? `₹ ${rev.toLocaleString('en-IN')}`
                      : rev || '₹ 0';
                  return (
                    <span style={{ fontWeight: 700, color: '#16a34a', fontFamily: 'monospace', fontSize: 13 }}>
                      {formatted}
                    </span>
                  );
                },
              },
              {
                title: 'Plan Status',
                dataIndex: 'subscriptionStatus',
                key: 'subscriptionStatus',
                width: 120,
                render: (status) => (
                  <Tag color={status === 'Active' || !status ? 'green' : 'red'} style={{ fontWeight: 600 }}>
                    {status || 'Active'}
                  </Tag>
                ),
              },
              {
                title: 'Action',
                key: 'actions',
                width: 90,
                fixed: 'right',
                align: 'center',
                onCell: () => ({
                  style: {
                    backgroundColor: isDarkMode ? '#0d0d0d' : '#ffffff',
                  },
                }),
                render: (_, record) => (
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handleOpenDetails(record)}
                    style={{ borderRadius: 6, fontWeight: 600 }}
                  >
                    View
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      {/* 5. Server-Side Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
          Showing {totalGyms > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, totalGyms)} of {totalGyms} gyms
        </div>
        <Pagination
          current={currentPage}
          total={totalGyms}
          pageSize={pageSize}
          onChange={(newPage, newPageSize) => {
            setCurrentPage(newPage);
            if (newPageSize && newPageSize !== pageSize) {
              setPageSize(newPageSize);
              setCurrentPage(1);
            }
          }}
          showSizeChanger
          pageSizeOptions={['10', '20', '50', '100']}
        />
      </div>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined style={{ color: '#16a34a', fontSize: 20 }} />
            <span style={{ fontWeight: 800 }}>Quick Onboard Gym Partner</span>
          </div>
        }
        open={isQuickAddModalOpen}
        onCancel={() => setIsQuickAddModalOpen(false)}
        footer={null}
        width={680}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, fontSize: 13, color: isDarkMode ? '#888' : '#64748b' }}>
          Fast-track register a new gym partner into GYMEZY. You can expand full amenities and trainer rosters later in the 8-step wizard.
        </div>

        <Form form={quickAddForm} layout="vertical" onFinish={handleQuickAddSubmit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="Gym / Studio Name" name="name" rules={[{ required: true, message: 'Please enter gym name' }]}>
                <Input placeholder="e.g. Spartan Strength Club" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Owner Full Name" name="ownerName" rules={[{ required: true, message: 'Please enter owner name' }]}>
                <Input placeholder="e.g. Vikramaditya Verma" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Owner Mobile Number" name="phone" rules={[{ required: true, message: 'Please enter phone' }]}>
                <Input addonBefore="+91" placeholder="9876543210" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Official Email" name="email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                <Input placeholder="contact@spartanfit.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Locality / Area" name="area" rules={[{ required: true, message: 'Area is required' }]}>
                <Input placeholder="e.g. Koramangala" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="City" name="city" initialValue="Chennai" rules={[{ required: true, message: 'City is required' }]}>
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
            <Col xs={24} md={12}>
              <Form.Item label="Single Session Drop-in Rate (₹)" name="singleSessionPrice" initialValue={199}>
                <InputNumber prefix="₹" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="Subscription Tier" name="subscriptionType" initialValue="Hybrid">
                <Select>
                  <Option value="Hybrid">Hybrid (₹ 4,999/mo) — Full Suite</Option>
                  <Option value="App Only">App Only (₹ 2,999/mo)</Option>
                  <Option value="GMS">GMS Only (₹ 1,999/mo)</Option>
                  <Option value="Listing Only">Listing Only (₹ 999/mo)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${isDarkMode ? '#222' : '#f1f5f9'}` }}>
            <Button
              icon={<RocketOutlined />}
              onClick={() => {
                setIsQuickAddModalOpen(false);
                navigate('/admin/onboarding');
              }}
            >
              Open Full 8-Step Wizard
            </Button>

            <Space>
              <Button onClick={() => setIsQuickAddModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: '#4338ca', fontWeight: 700 }}>
                Quick Publish Gym
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default GymsManagement;
