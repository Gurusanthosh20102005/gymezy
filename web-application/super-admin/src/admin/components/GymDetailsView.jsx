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
  ExportOutlined,
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
  HistoryOutlined,
  DiffOutlined,
  TeamOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';
import { apiClient } from '../../services/apiClient';
import { fetchGyms } from '../../redux/slices/gymSlice';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

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

  // Employee Management & Approval State
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState('All');

  // Modals for employee audit & diff
  const [selectedEmpForDiff, setSelectedEmpForDiff] = useState(null);
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  const [selectedEmpForDetails, setSelectedEmpForDetails] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const [selectedEmpForHistory, setSelectedEmpForHistory] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const [selectedEmpForReject, setSelectedEmpForReject] = useState(null);
  const [isEmpRejectModalOpen, setIsEmpRejectModalOpen] = useState(false);
  const [empRejectRemarks, setEmpRejectRemarks] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Load Employees API
  const loadGymEmployees = async () => {
    const gymId = gym?._id || gym?.id || gym?.mongoId;
    if (!gymId) return;
    setLoadingEmployees(true);
    try {
      const res = await apiClient.get('/employees', {
        params: {
          gymId,
          gymPartnerId: gym?.partnerId,
        },
      });
      if (res.data?.success) {
        const rawData = res.data?.data;
        const empList = Array.isArray(rawData) ? rawData : rawData?.employees || [];
        setEmployees(empList);
      }
    } catch (err) {
      console.error('Failed to load gym employees:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadGymEmployees();
  }, [gym?.id, gym?._id]);

  // Filtered gym-specific bookings
  const gymBookings = useMemo(() => {
    return SAMPLE_BOOKINGS.filter((b) => {
      const matchSearch =
        b.customerName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.bookingId.toLowerCase().includes(bookingSearch.toLowerCase()) ||
        b.customerPhone.includes(bookingSearch);
      const matchStatus = bookingStatusFilter === 'All' || b.status === bookingStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [bookingSearch, bookingStatusFilter]);

  const safeEmployees = useMemo(() => {
    return Array.isArray(employees) ? employees : [];
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return safeEmployees.filter((emp) => {
      const searchLower = (employeeSearch || '').toLowerCase();
      const matchSearch =
        !employeeSearch ||
        emp.name?.toLowerCase().includes(searchLower) ||
        emp.employeeId?.toLowerCase().includes(searchLower) ||
        emp.role?.toLowerCase().includes(searchLower) ||
        emp.phone?.includes(employeeSearch) ||
        emp.email?.toLowerCase().includes(searchLower);

      const matchStatus =
        employeeStatusFilter === 'All' ||
        emp.approvalStatus === employeeStatusFilter ||
        emp.status === employeeStatusFilter;

      return matchSearch && matchStatus;
    });
  }, [safeEmployees, employeeSearch, employeeStatusFilter]);

  const pendingEmployeesCount = useMemo(() => {
    return safeEmployees.filter((e) => e.approvalStatus === 'Pending Approval').length;
  }, [safeEmployees]);

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

  const handleApproveEmployee = async (employee) => {
    const empId = employee._id || employee.id;
    setActionLoadingId(empId);
    try {
      const res = await apiClient.patch(`/employees/${empId}/approval`, {
        decision: 'Approved',
        reviewedBy: 'Super Admin',
      });
      if (res.data?.success) {
        message.success(`Employee "${employee.name}" approved successfully!`);
        if (isDiffModalOpen) setIsDiffModalOpen(false);
        loadGymEmployees();
      } else {
        message.error(res.data?.message || 'Failed to approve employee.');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Error approving employee.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectEmployeeSubmit = async () => {
    if (!selectedEmpForReject) return;
    const empId = selectedEmpForReject._id || selectedEmpForReject.id;
    setActionLoadingId(empId);
    try {
      const res = await apiClient.patch(`/employees/${empId}/approval`, {
        decision: 'Rejected',
        adminRemarks: empRejectRemarks,
        reviewedBy: 'Super Admin',
      });
      if (res.data?.success) {
        message.success(`Employee "${selectedEmpForReject.name}" marked as Rejected.`);
        setIsEmpRejectModalOpen(false);
        if (isDiffModalOpen) setIsDiffModalOpen(false);
        setEmpRejectRemarks('');
        setSelectedEmpForReject(null);
        loadGymEmployees();
      } else {
        message.error(res.data?.message || 'Failed to reject employee.');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Error rejecting employee.');
    } finally {
      setActionLoadingId(null);
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
            {allGyms.map((g) => (
              <Option key={g.id || g._id} value={g.id || g._id}>
                {g.name} {g.partnerId ? `(${g.partnerId})` : '(-)'}
              </Option>
            ))}
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

          <Button
            icon={<ExportOutlined />}
            onClick={() => message.info(`Opening preview for ${gym.name}`)}
            style={{ borderRadius: 'var(--radius-base)', fontWeight: 600 }}
          >
            Customer View
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
              {gym.partnerId ? (
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Rate disabled defaultValue={4.9} style={{ fontSize: 15 }} />
              <strong style={{ fontSize: 13, color: isDarkMode ? '#f1f5f9' : '#0f172a' }}>4.9</strong>
              <span style={{ fontSize: 12, color: '#64748b' }}>(128 customer reviews)</span>
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
                {gym.totalBookings ?? gym.bookingsCount ?? 0}
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
            children: (
              <Row gutter={[20, 20]}>
                {/* Left Column: Facility & Business Overview */}
                <Col xs={24} lg={14}>
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
                      <Descriptions.Item label="Partner Code">{gym.partnerId || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Gym Type">{gym.gymType || 'Unisex Fitness Center'}</Descriptions.Item>
                      <Descriptions.Item label="Gender Policy">{gym.genderAllowed || 'Unisex'}</Descriptions.Item>
                      <Descriptions.Item label="Owner Name">{gym.ownerName || gym.fullName || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Contact Phone">{gym.phone || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Official Email">{gym.email || '—'}</Descriptions.Item>
                      <Descriptions.Item label="Registered On">{gym.registeredOn || gym.createdAt ? new Date(gym.createdAt).toLocaleDateString() : 'Active Partner'}</Descriptions.Item>
                      <Descriptions.Item label="Operating Hours" span={2}>
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

                  <Card
                    title="Supported Workouts & Amenities"
                    style={{
                      borderRadius: 14,
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div style={{ marginBottom: 16 }}>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Workout Disciplines:
                      </Text>
                      <Space wrap size={[8, 8]}>
                        {(gym.workouts && gym.workouts.length > 0
                          ? gym.workouts
                          : ['Gym & Weights', 'Cardio', 'HIIT', 'Crossfit', 'Yoga', 'Strength Training']
                        ).map((w, i) => (
                          <Tag key={i} color="blue" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>
                            {w}
                          </Tag>
                        ))}
                      </Space>
                    </div>

                    <div>
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        Available Amenities:
                      </Text>
                      <Space wrap size={[8, 8]}>
                        {(gym.amenities && gym.amenities.length > 0
                          ? gym.amenities
                          : ['Air Conditioned', 'Locker Facility', 'Shower Rooms', 'Free Wi-Fi', 'RO Drinking Water', 'CCTV 24/7', 'Parking Available']
                        ).map((a, i) => (
                          <Tag key={i} color="green" style={{ fontSize: 13, padding: '4px 10px', borderRadius: 6 }}>
                            <CheckCircleOutlined style={{ marginRight: 4 }} /> {a}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  </Card>
                </Col>

                {/* Right Column: Legal, Bank & Operating Schedule */}
                <Col xs={24} lg={10}>
                  <Card
                    title="Tax, Bank & Settlement"
                    style={{
                      borderRadius: 14,
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-color)',
                      marginBottom: 20,
                    }}
                  >
                    <Descriptions column={1} bordered size="small">
                      <Descriptions.Item label="GST Number">{gym.gstNumber || '33AAAAA0000A1Z5 (Registered)'}</Descriptions.Item>
                      <Descriptions.Item label="Bank Name">{gym.bankName || 'HDFC Bank Ltd'}</Descriptions.Item>
                      <Descriptions.Item label="Account Holder">{gym.accountHolderName || gym.name || 'Gym Enterprise'}</Descriptions.Item>
                      <Descriptions.Item label="Account Number">{gym.accountNumber ? `•••• •••• ${String(gym.accountNumber).slice(-4)}` : '•••• •••• 8842'}</Descriptions.Item>
                      <Descriptions.Item label="IFSC Code">{gym.ifscCode || 'HDFC0001234'}</Descriptions.Item>
                      <Descriptions.Item label="Payout Cycle">Daily Automated (T+1 Settlement)</Descriptions.Item>
                    </Descriptions>
                  </Card>

                  <Card
                    title="Operating Hours Summary"
                    style={{
                      borderRadius: 14,
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { day: 'Monday – Friday', hours: '05:30 AM – 10:30 PM', status: 'Open' },
                        { day: 'Saturday', hours: '06:00 AM – 10:00 PM', status: 'Open' },
                        { day: 'Sunday', hours: '06:00 AM – 09:00 PM', status: 'Open' },
                      ].map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{item.day}</span>
                          <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 700 }}>{item.hours}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'bookings',
            label: (
              <span>
                <CalendarOutlined /> Bookings ({gymBookings.length})
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <span>Customer Bookings for {gym.name}</span>
                    <Space wrap>
                      <Input
                        placeholder="Search Customer or Booking ID..."
                        prefix={<SearchOutlined />}
                        value={bookingSearch}
                        onChange={(e) => setBookingSearch(e.target.value)}
                        style={{ width: 250, borderRadius: 'var(--radius-base)' }}
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
                <Table
                  dataSource={gymBookings}
                  pagination={{ pageSize: 8 }}
                  rowKey="bookingId"
                  columns={[
                    {
                      title: 'Booking ID',
                      dataIndex: 'bookingId',
                      key: 'bookingId',
                      render: (text) => <strong style={{ color: 'var(--color-primary)' }}>{text}</strong>,
                    },
                    {
                      title: 'Customer',
                      key: 'customer',
                      render: (_, record) => (
                        <div>
                          <div style={{ fontWeight: 700 }}>{record.customerName}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{record.customerPhone}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Pass Type',
                      dataIndex: 'type',
                      key: 'type',
                      render: (text) => <Tag color="blue">{text}</Tag>,
                    },
                    {
                      title: 'Slot Time',
                      dataIndex: 'slotTime',
                      key: 'slotTime',
                      render: (text) => <span style={{ fontFamily: 'monospace' }}>{text}</span>,
                    },
                    {
                      title: 'Date',
                      dataIndex: 'bookingDate',
                      key: 'bookingDate',
                    },
                    {
                      title: 'Amount Paid',
                      dataIndex: 'amount',
                      key: 'amount',
                      render: (amount, record) => (
                        <div>
                          <strong style={{ color: '#16a34a' }}>₹{amount}</strong>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{record.paymentMode}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      key: 'status',
                      render: (status) => {
                        const color =
                          status === 'Completed' ? 'success' : status === 'Active' ? 'processing' : 'error';
                        return <Badge status={color} text={status} />;
                      },
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
          {
            key: 'employees',
            label: (
              <span>
                <TeamOutlined /> Staff Approvals{' '}
                {pendingEmployeesCount > 0 && (
                  <Badge count={pendingEmployeesCount} style={{ backgroundColor: '#f59e0b', marginLeft: 6 }} />
                )}
              </span>
            ),
            children: (
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <TeamOutlined style={{ fontSize: 18, color: '#2563eb' }} />
                      <span style={{ fontSize: 16, fontWeight: 750 }}>
                        Staff & Trainer Management — Gym ID: <Tag color="geekblue" style={{ fontSize: 13, fontWeight: 700 }}>{gym.partnerId || gym.gymPartnerId || gym._id || 'GYM'}</Tag>
                      </span>
                    </div>
                    {pendingEmployeesCount > 0 && (
                      <Tag color="warning" icon={<ClockCircleOutlined />} style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6 }}>
                        {pendingEmployeesCount} Modification / Add Request(s) Awaiting Super Admin Review
                      </Tag>
                    )}
                  </div>
                }
                style={{
                  borderRadius: 14,
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                }}
              >
                {/* Search & Filter Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <Input
                      placeholder="Search employee by name, ID, role, phone..."
                      prefix={<SearchOutlined style={{ color: '#888' }} />}
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      style={{ width: 280, borderRadius: 8 }}
                      allowClear
                    />
                    <Select
                      value={employeeStatusFilter}
                      onChange={setEmployeeStatusFilter}
                      style={{ width: 180 }}
                    >
                      <Option value="All">All Statuses</Option>
                      <Option value="Pending Approval">Pending Approval</Option>
                      <Option value="Approved">Approved</Option>
                      <Option value="Rejected">Rejected</Option>
                      <Option value="Active">Active Staff</Option>
                      <Option value="Inactive">Inactive Staff</Option>
                    </Select>
                  </div>
                  <Button
                    onClick={loadGymEmployees}
                    loading={loadingEmployees}
                    style={{ borderRadius: 8, fontWeight: 600 }}
                  >
                    Refresh List
                  </Button>
                </div>

                {/* Employees Table */}
                <Table
                  dataSource={filteredEmployees}
                  rowKey={(record) => record._id || record.id || record.employeeId || record.key}
                  loading={loadingEmployees}
                  pagination={{ pageSize: 8, showSizeChanger: true, pageSizeOptions: ['5', '8', '10', '20', '50'] }}
                  scroll={{ x: 1250 }}
                  columns={[
                    {
                      title: 'Gym ID',
                      key: 'gymPartnerId',
                      width: 100,
                      render: (_, record) => (
                        <Tag color="geekblue" style={{ fontWeight: 700, fontSize: 12, borderRadius: 4 }}>
                          {record.gymPartnerId || gym.partnerId || record.gymId || 'GYM'}
                        </Tag>
                      ),
                    },
                    {
                      title: 'Employee ID',
                      dataIndex: 'employeeId',
                      key: 'employeeId',
                      width: 120,
                      render: (text) => (
                        <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                          {text || 'EMP-NEW'}
                        </span>
                      ),
                    },
                    {
                      title: 'Employee Profile',
                      key: 'name',
                      width: 210,
                      render: (_, record) => (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar
                            src={record.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'}
                            size={36}
                            style={{ flexShrink: 0 }}
                          />
                          <div>
                            <div style={{ fontWeight: 650, color: isDarkMode ? '#fff' : '#0f172a', fontSize: 13 }}>
                              {record.name}
                            </div>
                            <div style={{ fontSize: 11, color: isDarkMode ? '#888' : '#64748b' }}>
                              {record.phone || record.email || '—'}
                            </div>
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Role & Type',
                      key: 'role',
                      width: 130,
                      render: (_, record) => (
                        <div>
                          <Tag color="blue" style={{ fontWeight: 600, borderRadius: 4, marginBottom: 4 }}>
                            {record.role || 'Staff'}
                          </Tag>
                          <div style={{ fontSize: 11, color: isDarkMode ? '#888' : '#64748b' }}>
                            {record.type || record.accessType || 'Full Time'}
                          </div>
                        </div>
                      ),
                    },
                    {
                      title: 'Action Requested',
                      key: 'pendingAction',
                      width: 160,
                      render: (_, record) => {
                        if (record.pendingAction === 'ADD') {
                          return <Tag color="cyan" style={{ fontWeight: 600 }}>New Staff Onboarding</Tag>;
                        }
                        if (record.pendingAction === 'EDIT') {
                          return <Tag color="orange" style={{ fontWeight: 600 }}>Profile Edited</Tag>;
                        }
                        if (record.pendingAction === 'DEACTIVATE') {
                          return <Tag color="red" style={{ fontWeight: 600 }}>Deactivation</Tag>;
                        }
                        return <Tag color="default" style={{ fontWeight: 500 }}>Live Active Record</Tag>;
                      },
                    },
                    {
                      title: 'Approval Status',
                      dataIndex: 'approvalStatus',
                      key: 'approvalStatus',
                      width: 160,
                      render: (status) => {
                        const s = status || 'Approved';
                        if (s === 'Pending Approval') {
                          return (
                            <Tag color="warning" icon={<ClockCircleOutlined />} style={{ fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>
                              Pending Approval
                            </Tag>
                          );
                        }
                        if (s === 'Approved') {
                          return (
                            <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>
                              Approved
                            </Tag>
                          );
                        }
                        if (s === 'Rejected') {
                          return (
                            <Tag color="error" icon={<CloseCircleOutlined />} style={{ fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>
                              Rejected
                            </Tag>
                          );
                        }
                        return <Tag>{s}</Tag>;
                      },
                    },
                    {
                      title: 'Audit & Diff',
                      key: 'diff',
                      width: 220,
                      render: (_, record) => (
                        <Space size={6} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                          {(record.pendingChanges || record.approvalStatus === 'Pending Approval' || record.auditHistory?.length > 0) && (
                            <Button
                              size="small"
                              type="primary"
                              ghost
                              icon={<DiffOutlined />}
                              onClick={() => {
                                setSelectedEmpForDiff(record);
                                setIsDiffModalOpen(true);
                              }}
                              style={{ fontWeight: 600, borderRadius: 6, fontSize: 12 }}
                            >
                              View Diff
                            </Button>
                          )}
                          {record.auditHistory && record.auditHistory.length > 0 && (
                            <Button
                              size="small"
                              icon={<HistoryOutlined />}
                              onClick={() => {
                                setSelectedEmpForHistory(record);
                                setIsHistoryModalOpen(true);
                              }}
                              style={{ borderRadius: 6, fontSize: 12 }}
                            >
                              Log ({record.auditHistory.length})
                            </Button>
                          )}
                        </Space>
                      ),
                    },
                    {
                      title: 'Super Admin Actions',
                      key: 'actions',
                      width: 200,
                      fixed: 'right',
                      render: (_, record) => (
                        <Space size={6} wrap={false} style={{ whiteSpace: 'nowrap' }}>
                          {record.approvalStatus === 'Pending Approval' ? (
                            <>
                              <Button
                                size="small"
                                type="primary"
                                icon={<CheckOutlined />}
                                loading={actionLoadingId === (record._id || record.id)}
                                onClick={() => handleApproveEmployee(record)}
                                style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: 600, borderRadius: 6 }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                danger
                                icon={<CloseOutlined />}
                                loading={actionLoadingId === (record._id || record.id)}
                                onClick={() => {
                                  setSelectedEmpForReject(record);
                                  setEmpRejectRemarks('');
                                  setIsEmpRejectModalOpen(true);
                                }}
                                style={{ fontWeight: 600, borderRadius: 6 }}
                              >
                                Reject
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => {
                                setSelectedEmpForDetails(record);
                                setIsDetailsModalOpen(true);
                              }}
                              style={{ borderRadius: 6, fontWeight: 500 }}
                            >
                              Full Profile
                            </Button>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                />
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
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="email"
                          label="Official Email"
                          rules={[{ type: 'email', message: 'Enter a valid email' }]}
                        >
                          <Input placeholder="gym@example.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="businessType" label="Business Entity Type">
                          <Select>
                            <Option value="Sole Proprietorship">Sole Proprietorship</Option>
                            <Option value="Partnership">Partnership</Option>
                            <Option value="Private Limited">Private Limited</Option>
                            <Option value="LLP">LLP</Option>
                          </Select>
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
                        <Form.Item name="gstNumber" label="GST Number">
                          <Input placeholder="15-digit GSTIN" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="panNumber" label="PAN Number">
                          <Input placeholder="10-digit PAN" />
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
                        <Form.Item name="accountNumber" label="Account Number">
                          <Input placeholder="Bank account number" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item name="ifscCode" label="IFSC Code">
                          <Input placeholder="e.g. HDFC0001234" />
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

      {/* 4. EMPLOYEE EDIT DIFF & APPROVAL MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DiffOutlined style={{ color: '#2563eb' }} />
            <span>Employee Change Audit & Approval</span>
          </div>
        }
        open={isDiffModalOpen}
        onCancel={() => setIsDiffModalOpen(false)}
        footer={null}
        width={780}
        centered
        destroyOnClose
      >
        {selectedEmpForDiff && (
          <div style={{ padding: '8px 0' }}>
            {/* Context Header Card */}
            <Card
              size="small"
              style={{
                marginBottom: 16,
                backgroundColor: isDarkMode ? '#1a2234' : '#f0f7ff',
                borderColor: '#bfdbfe',
                borderRadius: 8,
              }}
            >
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Associated Gym ID:</Text>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1d4ed8' }}>
                    {selectedEmpForDiff.gymPartnerId || gym.partnerId || selectedEmpForDiff.gymId || 'GYM-UNKNOWN'}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Gym Facility Name:</Text>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {selectedEmpForDiff.gymName || gym.name}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Employee Name & ID:</Text>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {selectedEmpForDiff.name} ({selectedEmpForDiff.employeeId})
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Change Type:</Text>
                  <div>
                    {selectedEmpForDiff.pendingAction === 'ADD' ? (
                      <Tag color="cyan" style={{ fontWeight: 600 }}>New Employee Onboarding</Tag>
                    ) : selectedEmpForDiff.pendingAction === 'EDIT' ? (
                      <Tag color="orange" style={{ fontWeight: 600 }}>Profile Modification</Tag>
                    ) : (
                      <Tag color="purple" style={{ fontWeight: 600 }}>{selectedEmpForDiff.pendingAction || 'Information Update'}</Tag>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>

            {/* Changed Fields Diff Table */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: isDarkMode ? '#fff' : '#0f172a' }}>
                {selectedEmpForDiff.pendingAction === 'ADD' ? 'Submitted Profile Attributes' : 'Modified Fields (Before vs After Comparison):'}
              </div>

              {(() => {
                let diffItems = [];
                const latestAudit = selectedEmpForDiff.auditHistory?.[selectedEmpForDiff.auditHistory.length - 1];

                if (latestAudit?.editedFields && latestAudit.editedFields.length > 0) {
                  diffItems = latestAudit.editedFields;
                } else if (selectedEmpForDiff.pendingChanges) {
                  const changes = selectedEmpForDiff.pendingChanges instanceof Map
                    ? Object.fromEntries(selectedEmpForDiff.pendingChanges)
                    : selectedEmpForDiff.pendingChanges;
                  diffItems = Object.entries(changes).map(([field, val]) => ({
                    field,
                    oldValue: selectedEmpForDiff[field],
                    newValue: val,
                  }));
                }

                if (diffItems.length === 0 && selectedEmpForDiff.pendingAction === 'ADD') {
                  const fullFields = [
                    { field: 'Full Name', value: selectedEmpForDiff.name },
                    { field: 'Role / Designation', value: selectedEmpForDiff.role },
                    { field: 'Phone Number', value: selectedEmpForDiff.phone },
                    { field: 'Official Email', value: selectedEmpForDiff.email },
                    { field: 'Access Level', value: selectedEmpForDiff.accessType },
                    { field: 'Joining Date', value: selectedEmpForDiff.joinDate },
                    { field: 'Employment Type', value: selectedEmpForDiff.type || 'Regular' },
                    { field: 'Previous Experience', value: selectedEmpForDiff.previousExp || 'None' },
                    { field: 'Emergency Contact', value: selectedEmpForDiff.emergencyContact?.name ? `${selectedEmpForDiff.emergencyContact.name} (${selectedEmpForDiff.emergencyContact.relationship}) - ${selectedEmpForDiff.emergencyContact.phone}` : '—' },
                  ];

                  return (
                    <Table
                      size="small"
                      bordered
                      pagination={false}
                      dataSource={fullFields}
                      rowKey="field"
                      columns={[
                        { title: 'Attribute', dataIndex: 'field', width: '35%', render: (t) => <strong>{t}</strong> },
                        { title: 'Submitted Value', dataIndex: 'value', render: (val) => <span style={{ color: '#059669', fontWeight: 600 }}>{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span> },
                      ]}
                    />
                  );
                }

                if (diffItems.length === 0) {
                  return (
                    <div style={{ padding: '24px', textAlign: 'center', backgroundColor: isDarkMode ? '#1f1f1f' : '#f8fafc', borderRadius: 8 }}>
                      <InfoCircleOutlined style={{ fontSize: 24, color: '#3b82f6', marginBottom: 8 }} />
                      <div style={{ fontSize: 13, color: isDarkMode ? '#aaa' : '#64748b' }}>
                        No isolated field-level differences found. All current attributes reflect the pending submission.
                      </div>
                    </div>
                  );
                }

                return (
                  <Table
                    size="small"
                    bordered
                    pagination={false}
                    dataSource={diffItems}
                    rowKey="field"
                    columns={[
                      {
                        title: 'Modified Field',
                        dataIndex: 'field',
                        width: '25%',
                        render: (field) => <strong style={{ textTransform: 'capitalize' }}>{field.replace(/([A-Z])/g, ' $1')}</strong>,
                      },
                      {
                        title: 'Previous Value (Original)',
                        dataIndex: 'oldValue',
                        width: '37%',
                        render: (val) => (
                          <div style={{ backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2', padding: '4px 8px', borderRadius: 4, color: isDarkMode ? '#fca5a5' : '#991b1b', fontSize: 12 }}>
                            {val ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : <em>(Empty / Not set)</em>}
                          </div>
                        ),
                      },
                      {
                        title: 'New Value (Edited Request)',
                        dataIndex: 'newValue',
                        width: '38%',
                        render: (val) => (
                          <div style={{ backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7', padding: '4px 8px', borderRadius: 4, color: isDarkMode ? '#86efac' : '#166534', fontWeight: 600, fontSize: 12 }}>
                            {val ? (typeof val === 'object' ? JSON.stringify(val) : String(val)) : <em>(Removed)</em>}
                          </div>
                        ),
                      },
                    ]}
                  />
                );
              })()}
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: `1px solid ${isDarkMode ? '#333' : '#e2e8f0'}`, paddingTop: 16 }}>
              <Button onClick={() => setIsDiffModalOpen(false)}>Close</Button>
              {selectedEmpForDiff.approvalStatus === 'Pending Approval' && (
                <>
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    loading={actionLoadingId === (selectedEmpForDiff._id || selectedEmpForDiff.id)}
                    onClick={() => {
                      setSelectedEmpForReject(selectedEmpForDiff);
                      setEmpRejectRemarks('');
                      setIsEmpRejectModalOpen(true);
                    }}
                    style={{ fontWeight: 600 }}
                  >
                    Reject Changes
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={actionLoadingId === (selectedEmpForDiff._id || selectedEmpForDiff.id)}
                    onClick={() => handleApproveEmployee(selectedEmpForDiff)}
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontWeight: 600 }}
                  >
                    Approve & Apply Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 5. EMPLOYEE AUDIT HISTORY LOG MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HistoryOutlined style={{ color: '#2563eb' }} />
            <span>Audit Trail & Historical Changes Log</span>
          </div>
        }
        open={isHistoryModalOpen}
        onCancel={() => setIsHistoryModalOpen(false)}
        footer={null}
        width={750}
        centered
        destroyOnClose
      >
        {selectedEmpForHistory && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 14 }}>
                {selectedEmpForHistory.name} ({selectedEmpForHistory.employeeId})
              </Text>
              <div style={{ fontSize: 12, color: '#888' }}>
                Gym ID: <strong>{selectedEmpForHistory.gymPartnerId || gym.partnerId || selectedEmpForHistory.gymId || 'GYM'}</strong> — {selectedEmpForHistory.gymName || gym.name}
              </div>
            </div>

            {selectedEmpForHistory.auditHistory && selectedEmpForHistory.auditHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {selectedEmpForHistory.auditHistory.slice().reverse().map((audit, idx) => (
                  <Card
                    key={idx}
                    size="small"
                    style={{
                      borderRadius: 8,
                      backgroundColor: isDarkMode ? '#1e1e1e' : '#f8fafc',
                      borderColor: isDarkMode ? '#333' : '#e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Tag color={audit.changeType === 'ADD_EMPLOYEE' ? 'blue' : audit.changeType === 'EDIT_EMPLOYEE' ? 'orange' : 'red'} style={{ fontWeight: 600 }}>
                        {audit.changeType?.replace('_', ' ') || 'CHANGE'}
                      </Tag>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {audit.timestamp ? new Date(audit.timestamp).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: isDarkMode ? '#ccc' : '#475569', marginBottom: 8 }}>
                      Gym ID: <strong>{audit.gymPartnerId || audit.gymId || 'GYM'}</strong> | Requested By: <strong>{audit.requestedBy || 'Gym Owner'}</strong>
                      {audit.reviewedBy && (
                        <span> | Reviewed By: <strong>{audit.reviewedBy}</strong></span>
                      )}
                    </div>

                    {audit.editedFields && audit.editedFields.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4 }}>Fields Edited:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {audit.editedFields.map((f, i) => (
                            <Tag key={i} color="default" style={{ fontSize: 11 }}>
                              <strong>{f.field}:</strong> {String(f.oldValue ?? '')} ➔ {String(f.newValue ?? '')}
                            </Tag>
                          ))}
                        </div>
                      </div>
                    )}

                    {audit.adminRemarks && (
                      <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>
                        <strong>Admin Remarks:</strong> {audit.adminRemarks}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#888' }}>
                No past audit records found.
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 6. EMPLOYEE FULL PROFILE DETAILS MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserOutlined style={{ color: '#2563eb' }} />
            <span>Staff Profile & Verification Details</span>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={null}
        width={720}
        centered
        destroyOnClose
      >
        {selectedEmpForDetails && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <Avatar
                src={selectedEmpForDetails.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'}
                size={54}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 750, color: isDarkMode ? '#fff' : '#0f172a' }}>
                  {selectedEmpForDetails.name}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  ID: {selectedEmpForDetails.employeeId} • Role: {selectedEmpForDetails.role}
                </div>
              </div>
            </div>

            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Gym Partner ID">
                <Tag color="geekblue">{selectedEmpForDetails.gymPartnerId || gym.partnerId || selectedEmpForDetails.gymId || 'GYM'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Gym Name">{selectedEmpForDetails.gymName || gym.name}</Descriptions.Item>
              <Descriptions.Item label="Phone Number">{selectedEmpForDetails.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Official Email">{selectedEmpForDetails.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Approval Status">
                <Tag color={selectedEmpForDetails.approvalStatus === 'Approved' ? 'success' : selectedEmpForDetails.approvalStatus === 'Pending Approval' ? 'warning' : 'error'}>
                  {selectedEmpForDetails.approvalStatus || 'Approved'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Work Status">{selectedEmpForDetails.status || 'Active'}</Descriptions.Item>
              <Descriptions.Item label="Join Date">{selectedEmpForDetails.joinDate || '—'}</Descriptions.Item>
              <Descriptions.Item label="Access Level">{selectedEmpForDetails.accessType || 'Employee'}</Descriptions.Item>
              <Descriptions.Item label="Previous Experience" span={2}>
                {selectedEmpForDetails.previousExp ? `${selectedEmpForDetails.previousExp} at ${selectedEmpForDetails.previousCompany || 'Previous Firm'} (${selectedEmpForDetails.previousDesignation || 'Trainer'})` : 'No prior company noted'}
              </Descriptions.Item>
              <Descriptions.Item label="Emergency Contact" span={2}>
                {selectedEmpForDetails.emergencyContact?.name ? `${selectedEmpForDetails.emergencyContact.name} (${selectedEmpForDetails.emergencyContact.relationship || 'Contact'}) — ${selectedEmpForDetails.emergencyContact.phone}` : 'Not provided'}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <Button type="primary" onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 7. EMPLOYEE REJECTION REMARKS MODAL */}
      <Modal
        title="Reject Employee Changes / Submission"
        open={isEmpRejectModalOpen}
        onCancel={() => {
          setIsEmpRejectModalOpen(false);
          setEmpRejectRemarks('');
        }}
        footer={null}
        centered
        width={480}
      >
        <div style={{ padding: '12px 0' }}>
          <p style={{ fontSize: 13, color: isDarkMode ? '#aaaaaa' : '#64748b', marginBottom: 12 }}>
            Provide the administrative reason for rejecting the employee submission/changes for <strong>{selectedEmpForReject?.name}</strong>:
          </p>
          <TextArea
            rows={4}
            value={empRejectRemarks}
            onChange={(e) => setEmpRejectRemarks(e.target.value)}
            placeholder="e.g. Incomplete ID verification, invalid phone number, certification mismatch..."
            style={{ marginBottom: 18 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button onClick={() => setIsEmpRejectModalOpen(false)}>Cancel</Button>
            <Button
              danger
              type="primary"
              loading={actionLoadingId === (selectedEmpForReject?._id || selectedEmpForReject?.id)}
              onClick={handleRejectEmployeeSubmit}
              style={{ fontWeight: 600 }}
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GymDetailsView;
