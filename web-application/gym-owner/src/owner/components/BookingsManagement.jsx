import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Table,
  Tag,
  Button,
  Row,
  Col,
  Input,
  Select,
  Typography,
  Avatar,
  Dropdown,
  Modal,
  Form,
  DatePicker,
  TimePicker,
  Space,
  Radio,
  Pagination,
  message,
  Tooltip,
  Segmented,
  Badge,
} from 'antd';
import { apiClient } from '../../services/apiClient';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  CalendarOutlined,
  MobileOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  MoreOutlined,
  EyeOutlined,
  CheckOutlined,
  DownloadOutlined,
  DeleteOutlined,
  DollarCircleOutlined,
  DownOutlined,
  PhoneOutlined,
  CreditCardOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const INITIAL_BOOKINGS = [];

/**
 * Reusable Bookings Management Component
 */
export const BookingsManagement = ({
  initialData = INITIAL_BOOKINGS,
  onAddBooking,
  onStatusChange,
}) => {
  const { isDarkMode } = useTheme();
  const [form] = Form.useForm();
  const { user } = useSelector((state) => state.auth);
  const gymId = user?.gymId?._id || user?.gymId || user?._id;

  const [searchParams, setSearchParams] = useSearchParams();
  const [sourceFilter, setSourceFilter] = useState('ALL'); // 'ALL' | 'APP' | 'WALK_IN'

  const [bookings, setBookings] = useState(initialData);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [bookingIdSearch, setBookingIdSearch] = useState('');
  const [customerIdSearch, setCustomerIdSearch] = useState('');
  const [bookingType, setBookingType] = useState('ALL');
  const [bookingStatus, setBookingStatus] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState('21 Jul 2025 - 21 Jul 2025');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [tempDateRange, setTempDateRange] = useState(null);

  // Dynamic Catalog State for Walk-In Creation
  const [gymSections, setGymSections] = useState([]);
  const [gymTrainers, setGymTrainers] = useState([]);
  const [gymSingleSessionPrice, setGymSingleSessionPrice] = useState(199);
  const [sessionTier, setSessionTier] = useState('PER_DAY'); // 'PER_DAY' | 'WEEKLY' | 'CUSTOM'
  const [selectedSectionId, setSelectedSectionId] = useState('general');
  const [selectedTrainerId, setSelectedTrainerId] = useState('none');
  const [customDatesList, setCustomDatesList] = useState([]);

  // Trainers who offer Single Session pass (price > 0)
  const availableSessionTrainers = useMemo(() => {
    return (gymTrainers || []).filter((tr) => Number(tr.trainerPricing?.singleSession || 0) > 0);
  }, [gymTrainers]);

  // Auto-reset selectedTrainerId if they do not offer session passes
  useEffect(() => {
    if (selectedTrainerId !== 'none') {
      const exists = availableSessionTrainers.some(
        (tr) => String(tr._id || tr.id || tr.employeeId) === String(selectedTrainerId)
      );
      if (!exists) {
        setSelectedTrainerId('none');
      }
    }
  }, [availableSessionTrainers, selectedTrainerId]);

  // Calculate total fee based on duration, activity/section, trainer, and custom dates
  const calculateTotalFee = (tier, secId, trId, customDates) => {
    const sec = gymSections.find((s) => String(s._id || s.id) === String(secId));
    const baseRate = sec?.cost ? Number(sec.cost) : gymSingleSessionPrice;
    const trObj = availableSessionTrainers.find((t) => String(t._id || t.id || t.employeeId) === String(trId));
    const trainerDailyFee = trObj ? Number(trObj.trainerPricing?.singleSession || 0) : 0;

    if (tier === 'PER_DAY') {
      return baseRate + trainerDailyFee;
    }
    if (tier === 'WEEKLY') {
      return (baseRate * 7) + (trainerDailyFee * 7);
    }
    if (tier === 'CUSTOM') {
      const days = Math.max(1, customDates.length);
      return (baseRate + trainerDailyFee) * days;
    }
    return baseRate;
  };

  useEffect(() => {
    const total = calculateTotalFee(sessionTier, selectedSectionId, selectedTrainerId, customDatesList);
    form.setFieldsValue({ amount: total });
  }, [sessionTier, selectedSectionId, selectedTrainerId, customDatesList, gymSections, gymSingleSessionPrice, availableSessionTrainers]);

  const handleSectionChange = (val) => {
    setSelectedSectionId(val);
    const sec = gymSections.find((s) => String(s._id || s.id) === String(val));
    if (sec && sec.trainerId) {
      const trId = String(sec.trainerId._id || sec.trainerId);
      if (availableSessionTrainers.some((t) => String(t._id || t.id || t.employeeId) === trId)) {
        setSelectedTrainerId(trId);
      }
    }
  };

  // Auto-open modal if navigated with ?action=walkin
  useEffect(() => {
    if (searchParams.get('action') === 'walkin') {
      setIsAddModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Reschedule Review States
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null); // { booking, sessionIndex, session }
  const [proposedDate, setProposedDate] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const loadBookings = async (activeSource = sourceFilter) => {
    if (!gymId) return;
    try {
      setIsLoadingBookings(true);
      const params = {};
      if (activeSource && activeSource !== 'ALL') {
        params.source = activeSource;
      }
      const res = await apiClient.get(`/bookings/gym/${gymId}`, { params });
      if (res.data?.success && Array.isArray(res.data.data)) {
        const mapped = res.data.data.map((b) => {
          const startDateStr = b.startDate
            ? new Date(b.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : (b.date || 'Today');
          const isWalkIn = b.source === 'WALK_IN' || b.bookingType === 'WALK_IN';
          return {
            key: String(b._id || b.bookingId),
            _id: b._id,
            bookingId: b.bookingId || b._id,
            customerId: b.userId?.customerId || b.customerId || 'CID0001',
            customerName: b.userId?.name || b.userId?.fullName || b.customerName || 'Customer',
            phone: b.userId?.phone || b.phone || '-',
            avatar: b.userId?.avatar || b.userId?.profilePicture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop',
            type: b.bookingType === 'GROUP_CLASS' ? 'Group Class' : (b.bookingType === 'GYM_SESSION' ? 'Gym Session' : (isWalkIn ? 'Walk-in' : 'App Booking')),
            source: b.source || (isWalkIn ? 'WALK_IN' : 'APP'),
            date: startDateStr,
            time: b.timeSlot || b.time || '07:00 AM',
            amount: `₹${b.pricing?.totalAmount ?? b.amountPaid ?? 0}`,
            status: b.status === 'Attended' ? 'Checked-in' : (b.status || 'Active'),
            payment: b.payment?.method || 'Online',
            isCustomDates: b.isCustomDates,
            customDates: b.customDates || [],
            raw: b,
          };
        });
        setBookings(mapped);
      }
    } catch (err) {
      console.warn('[BOOKINGS] Failed to fetch gym bookings:', err?.message);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const loadGymCatalog = async () => {
    if (!gymId) return;
    try {
      const [secRes, trRes, gymRes] = await Promise.allSettled([
        apiClient.get('/sections', { params: { gymId } }),
        apiClient.get('/employees', { params: { gymId, role: 'Trainer', approvalStatus: 'Approved' } }),
        apiClient.get(`/gyms/${gymId}`),
      ]);
      if (secRes.status === 'fulfilled' && secRes.value.data?.success) {
        setGymSections(secRes.value.data.data || []);
      }
      if (trRes.status === 'fulfilled' && trRes.value.data?.success) {
        const empData = trRes.value.data.data;
        const list = Array.isArray(empData) ? empData : (empData?.employees || []);
        setGymTrainers(list);
      }
      if (gymRes.status === 'fulfilled' && gymRes.value.data?.data) {
        const gymData = gymRes.value.data.data;
        const sp = Number(gymData.singleSessionPrice || gymData.pricingPlans?.singleSession || 199);
        setGymSingleSessionPrice(sp);
      }
    } catch (err) {
      console.warn('Failed to load gym sections/trainers/profile:', err?.message);
    }
  };

  useEffect(() => {
    if (gymId) {
      loadBookings();
      loadGymCatalog();
    }
  }, [gymId]);

  const handleReviewReschedule = async (action) => {
    if (!reviewTarget) return;
    if (action === 'PROPOSE' && !proposedDate) {
      message.error('Please select a proposed date for the member.');
      return;
    }

    try {
      setIsSubmittingReview(true);
      const bookingId = reviewTarget.booking._id || reviewTarget.booking.bookingId || reviewTarget.booking.key;
      const res = await apiClient.post(`/bookings/${bookingId}/review-reschedule`, {
        sessionIndex: reviewTarget.sessionIndex,
        sessionDate: reviewTarget.session.date,
        action,
        proposedDate: proposedDate ? proposedDate.format('YYYY-MM-DD') : undefined,
        ownerNotes: reviewNotes,
      });

      message.success(
        action === 'APPROVE'
          ? 'Reschedule approved successfully!'
          : action === 'PROPOSE'
          ? 'Proposed date sent to member for acceptance.'
          : 'Reschedule request rejected.'
      );
      setReviewModalVisible(false);
      setReviewTarget(null);
      setProposedDate(null);
      setReviewNotes('');

      await loadBookings();
      if (res.data?.data) {
        setSelectedBooking((prev) => (prev ? {
          ...prev,
          customDates: res.data.data.customDates || prev.customDates,
        } : null));
      }
    } catch (err) {
      message.error(err.message || 'Failed to submit reschedule decision.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 7;

  // Filter Logic
  const filteredBookings = bookings.filter((item) => {
    const matchName = !nameSearch || item.customerName.toLowerCase().includes(nameSearch.toLowerCase());
    const matchBookingId = !bookingIdSearch || item.bookingId.toLowerCase().includes(bookingIdSearch.toLowerCase());
    const matchCustomerId = !customerIdSearch || item.customerId.toLowerCase().includes(customerIdSearch.toLowerCase());
    const matchType = bookingType === 'ALL' || item.type === bookingType;
    const matchStatus = bookingStatus === 'ALL' || item.status === bookingStatus;
    const matchSource = sourceFilter === 'ALL' || (item.source || 'APP') === sourceFilter;
    return matchName && matchBookingId && matchCustomerId && matchType && matchStatus && matchSource;
  });

  const clearFilters = () => {
    setNameSearch('');
    setBookingIdSearch('');
    setCustomerIdSearch('');
    setBookingType('ALL');
    setBookingStatus('ALL');
    setSourceFilter('ALL');
    setSelectedDateRange('21 Jul 2025 - 21 Jul 2025');
    message.info('Filters cleared');
    loadBookings('ALL');
  };

  const handleCheckIn = (record) => {
    const updated = bookings.map((b) =>
      b.key === record.key ? { ...b, status: 'Checked-in' } : b
    );
    setBookings(updated);
    message.success(`Checked-in ${record.customerName} successfully!`);
    if (onStatusChange) onStatusChange(record.key, 'Checked-in');
  };

  const handleView = (record) => {
    setSelectedBooking(record);
    setIsViewModalOpen(true);
  };

  const handleAddWalkIn = async (values) => {
    try {
      if (sessionTier === 'CUSTOM' && customDatesList.length === 0) {
        message.warning('Please select at least one date for the custom schedule.');
        return;
      }
      setIsLoadingBookings(true);
      const isGroupClass = selectedSectionId && selectedSectionId !== 'general';
      const selectedSection = gymSections.find((s) => String(s._id || s.id) === String(selectedSectionId));
      const selectedTrainer = gymTrainers.find((t) => String(t._id || t.id || t.employeeId) === String(selectedTrainerId));

      let calculatedStartDate = values.date ? values.date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0];
      let calculatedEndDate = calculatedStartDate;
      if (sessionTier === 'WEEKLY') {
        const start = values.date ? values.date.toDate() : new Date();
        const end = new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000);
        calculatedEndDate = end.toISOString().split('T')[0];
      } else if (sessionTier === 'CUSTOM' && customDatesList.length > 0) {
        const sorted = [...customDatesList].sort();
        calculatedStartDate = sorted[0];
        calculatedEndDate = sorted[sorted.length - 1];
      }

      const payload = {
        customerName: values.customerName,
        phone: values.phone,
        email: values.email || undefined,
        bookingType: isGroupClass ? 'GROUP_CLASS' : 'GYM_SESSION',
        title: selectedSection
          ? selectedSection.title
          : sessionTier === 'WEEKLY'
          ? 'Weekly Gym Access Pass'
          : sessionTier === 'CUSTOM'
          ? `Custom ${customDatesList.length}-Days Pass`
          : 'Gym Session Access',
        sectionId: selectedSection ? selectedSection._id : undefined,
        trainerId: selectedTrainer ? (selectedTrainer._id || selectedTrainer.id) : (selectedSection?.trainerId?._id || undefined),
        startDate: calculatedStartDate,
        endDate: calculatedEndDate,
        timeSlot: selectedSection ? `${selectedSection.startTime} - ${selectedSection.endTime}` : (values.time ? values.time.format('hh:mm A') : '07:00 AM'),
        amount: Number(values.amount || 150),
        paymentMethod: values.payment || 'Cash',
        checkInNow: values.status === 'Checked-in',
        isCustomDates: sessionTier === 'CUSTOM',
        customDates: sessionTier === 'CUSTOM' ? customDatesList : undefined,
      };
      const res = await apiClient.post(`/bookings/gym/${gymId}/walk-in`, payload);
      if (res.data?.success) {
        message.success(`Walk-in booking created successfully for ${values.customerName}!`);
        setIsAddModalOpen(false);
        form.resetFields();
        setSelectedSectionId('general');
        setSelectedTrainerId('none');
        setSessionTier('PER_DAY');
        setCustomDatesList([]);
        await loadBookings();
      }
    } catch (err) {
      const errMsg = err.response?.data?.errors?.length
        ? err.response.data.errors.join(', ')
        : (err.response?.data?.message || err.message || 'Failed to create walk-in booking.');
      message.error(errMsg);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  // Date Range Quick Menu
  const dateRangeMenu = {
    items: [
      { key: 'today', label: 'Today (21 Jul 2025)', onClick: () => setSelectedDateRange('21 Jul 2025 - 21 Jul 2025') },
      { key: 'yesterday', label: 'Yesterday (20 Jul 2025)', onClick: () => setSelectedDateRange('20 Jul 2025 - 20 Jul 2025') },
      { key: 'this_week', label: 'This Week (15 Jul 2025 - 21 Jul 2025)', onClick: () => setSelectedDateRange('15 Jul 2025 - 21 Jul 2025') },
      { key: 'this_month', label: 'This Month (01 Jul 2025 - 31 Jul 2025)', onClick: () => setSelectedDateRange('01 Jul 2025 - 31 Jul 2025') },
      { type: 'divider' },
      {
        key: 'custom',
        label: 'Custom Date Range...',
        icon: <CalendarOutlined style={{ color: 'var(--color-primary)' }} />,
        onClick: () => setIsDateRangeModalOpen(true),
      },
    ],
  };

  const getActionMenuItems = (record) => [
    {
      key: 'view',
      label: 'View Booking Details',
      icon: <EyeOutlined />,
      onClick: () => handleView(record),
    },
    {
      key: 'checkin',
      label: 'Mark as Checked-in',
      icon: <CheckOutlined style={{ color: '#00bf62' }} />,
      onClick: () => handleCheckIn(record),
    },
    {
      key: 'receipt',
      label: 'Download Invoice',
      icon: <DownloadOutlined />,
      onClick: () => message.success(`Receipt for ${record.bookingId} downloaded.`),
    },
    { type: 'divider' },
    {
      key: 'cancel',
      label: 'Cancel Booking',
      icon: <DeleteOutlined style={{ color: '#ef4444' }} />,
      onClick: () => {
        setBookings(bookings.map((b) => (b.key === record.key ? { ...b, status: 'Cancelled' } : b)));
        message.warning(`Booking ${record.bookingId} cancelled.`);
      },
    },
  ];

  const columns = [
    {
      title: 'Booking ID',
      dataIndex: 'bookingId',
      key: 'bookingId',
      render: (text, record) => (
        <Tooltip title="Click to view booking details">
          <span
            onClick={() => handleView(record)}
            style={{
              fontWeight: 700,
              color: '#1677ff',
              fontSize: 13,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Customer ID',
      dataIndex: 'customerId',
      key: 'customerId',
      render: (text, record) => (
        <Tooltip title="Click to view customer details">
          <span
            onClick={() => handleView(record)}
            style={{
              color: '#722ed1',
              fontSize: 13,
              fontWeight: 650,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono, monospace)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar src={record.avatar} size={38} style={{ flexShrink: 0 }} />
          <div style={{ fontWeight: 650, color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 13 }}>
            {record.customerName}
          </div>
        </div>
      ),
    },
    {
      title: 'Booking Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const isApp = type === 'App Booking';
        return (
          <Tag
            style={{
              backgroundColor: isApp ? (isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe') : (isDarkMode ? 'rgba(0, 191, 98, 0.2)' : '#eaf8ef'),
              color: isApp ? (isDarkMode ? '#b37feb' : '#722ed1') : '#00bf62',
              border: 'none',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 10px',
            }}
          >
            {type}
          </Tag>
        );
      },
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      render: (source) => {
        const isWalkIn = source === 'WALK_IN';
        return (
          <Tag
            color={isWalkIn ? 'purple' : 'blue'}
            style={{
              fontWeight: 700,
              fontSize: 11,
              borderRadius: 'var(--radius-base)',
              padding: '2px 8px',
            }}
          >
            {isWalkIn ? 'WALK-IN' : 'APP'}
          </Tag>
        );
      },
    },
    {
      title: 'Date & Time',
      key: 'dateTime',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 500 }}>
            {record.date}
          </div>
          <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 1 }}>
            {record.time}
          </div>
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => (
        <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 13 }}>
          {amount}
        </span>
      ),
    },
    {
      title: 'Booking Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        if (status === 'Checked-in') {
          return (
            <Tag
              icon={<CheckOutlined style={{ fontSize: 11 }} />}
              style={{
                backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                color: '#00bf62',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Checked-in
            </Tag>
          );
        }
        if (status === 'Upcoming') {
          return (
            <Tag
              icon={<ClockCircleOutlined style={{ fontSize: 11 }} />}
              style={{
                backgroundColor: isDarkMode ? 'rgba(250, 140, 22, 0.15)' : '#fef4e8',
                color: '#fa8c16',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Upcoming
            </Tag>
          );
        }
        if (status === 'Completed') {
          return (
            <Tag
              icon={<CheckCircleOutlined style={{ fontSize: 11 }} />}
              style={{
                backgroundColor: isDarkMode ? 'rgba(22, 119, 255, 0.15)' : '#edf4fe',
                color: '#1677ff',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Completed
            </Tag>
          );
        }
        if (status === 'Cancelled') {
          return (
            <Tag
              icon={<CloseCircleOutlined style={{ fontSize: 11 }} />}
              style={{
                backgroundColor: isDarkMode ? 'rgba(225, 29, 72, 0.15)' : '#fdeeed',
                color: '#e11d48',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Cancelled
            </Tag>
          );
        }
        return (
          <Tag
            icon={<UserOutlined style={{ fontSize: 11 }} />}
            style={{
              backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.15)' : '#f3effe',
              color: '#722ed1',
              border: 'none',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              fontSize: 11,
              padding: '2px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            No Show
          </Tag>
        );
      },
    },
    {
      title: 'Payment',
      dataIndex: 'payment',
      key: 'payment',
      render: (payment) => {
        if (payment === 'Paid Online') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                color: '#00bf62',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Paid Online
            </Tag>
          );
        }
        if (payment === 'Cash') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(22, 119, 255, 0.15)' : '#edf4fe',
                color: '#1677ff',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Cash
            </Tag>
          );
        }
        if (payment === 'UPI') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.15)' : '#f3effe',
                color: '#722ed1',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              UPI
            </Tag>
          );
        }
        if (payment === 'Refunded') {
          return (
            <Tag
              style={{
                backgroundColor: isDarkMode ? '#1e1e1e' : '#f1f5f9',
                color: isDarkMode ? '#888888' : '#64748b',
                border: 'none',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 11,
                padding: '2px 10px',
              }}
            >
              Refunded
            </Tag>
          );
        }
        return <span style={{ color: isDarkMode ? '#666666' : '#94a3b8' }}>—</span>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 140,
      render: (_, record) => {
        const isUpcoming = record.status === 'Upcoming';
        return (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, width: 124 }}>
            <Button
              size="small"
              onClick={() => (isUpcoming ? handleCheckIn(record) : handleView(record))}
              style={{
                borderRadius: 'var(--radius-base)',
                fontSize: 12,
                fontWeight: 600,
                borderColor: isDarkMode ? '#333333' : '#d0d7de',
                color: isDarkMode ? '#ffffff' : '#0f172a',
                width: 82,
                textAlign: 'center',
                height: 30,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isUpcoming ? 'Check-in' : 'View'}
            </Button>
            <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={['click']}>
              <Button
                type="text"
                size="small"
                style={{ width: 28, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                icon={<MoreOutlined style={{ fontSize: 16, color: isDarkMode ? '#888888' : '#64748b' }} />}
              />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 700 }}>
            Bookings
          </Title>
          <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 14 }}>
            Manage all walk-in and app bookings from one place.
          </Text>
        </div>

        {/* Add Walk-in Button */}
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsAddModalOpen(true)}
          style={{
            backgroundColor: 'var(--color-primary)',
            borderColor: 'var(--color-primary)',
            borderRadius: 'var(--radius-base)',
            fontWeight: 600,
            height: 42,
            padding: '0 20px',
            boxShadow: isDarkMode ? 'none' : '0 2px 6px rgba(0, 56, 130, 0.2)',
          }}
        >
          Add Walk-in
        </Button>
      </div>

      {/* FILTER & SEARCH CARD */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 24,
          boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        {/* Row 1: Search Inputs */}
        <Row gutter={[16, 16]} align="bottom" style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={7}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Search Customer Name
            </div>
            <Input
              prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
              placeholder="Enter customer name"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              allowClear
              style={{ height: 42, borderRadius: 'var(--radius-base)' }}
            />
          </Col>

          <Col xs={24} sm={12} lg={7}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Booking ID
            </div>
            <Input
              prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
              placeholder="Enter booking ID"
              value={bookingIdSearch}
              onChange={(e) => setBookingIdSearch(e.target.value)}
              allowClear
              style={{ height: 42, borderRadius: 'var(--radius-base)' }}
            />
          </Col>

          <Col xs={24} sm={12} lg={7}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Customer ID
            </div>
            <Input
              prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
              placeholder="Enter customer ID"
              value={customerIdSearch}
              onChange={(e) => setCustomerIdSearch(e.target.value)}
              allowClear
              style={{ height: 42, borderRadius: 'var(--radius-base)' }}
            />
          </Col>

          <Col xs={24} sm={12} lg={3}>
            <Button
              block
              onClick={() => message.info(`Showing ${filteredBookings.length} results.`)}
              style={{
                height: 42,
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                color: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
              }}
            >
              Search
            </Button>
          </Col>
        </Row>

        {/* Row 2: Filter Selectors & Action Buttons */}
        <Row gutter={[16, 16]} align="bottom">
          {/* Date Range Filter */}
          <Col xs={24} sm={12} lg={5}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Date Range
            </div>
            <Dropdown menu={dateRangeMenu} trigger={['click']}>
              <div
                style={{
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                  border: `1px solid ${isDarkMode ? '#262626' : '#d9d9d9'}`,
                  borderRadius: 'var(--radius-base)',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>{selectedDateRange}</span>
                </div>
                <DownOutlined style={{ fontSize: 10, color: isDarkMode ? '#888888' : '#64748b' }} />
              </div>
            </Dropdown>
          </Col>

          {/* Booking Type */}
          <Col xs={24} sm={12} lg={5}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Booking Type
            </div>
            <Select
              value={bookingType}
              onChange={setBookingType}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="ALL">All Types</Option>
              <Option value="Gym Session">Gym Session</Option>
              <Option value="Group Class">Group Class</Option>
              <Option value="App Booking">App Booking</Option>
              <Option value="Walk-in">Walk-in</Option>
            </Select>
          </Col>

          {/* Source Filter */}
          <Col xs={24} sm={12} lg={4}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Source
            </div>
            <Select
              value={sourceFilter}
              onChange={(val) => {
                setSourceFilter(val);
                loadBookings(val);
              }}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="ALL">All Sources</Option>
              <Option value="APP">GYMEZY App</Option>
              <Option value="WALK_IN">Front-Desk Walk-in</Option>
            </Select>
          </Col>

          {/* Booking Status */}
          <Col xs={24} sm={12} lg={4}>
            <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
              Booking Status
            </div>
            <Select
              value={bookingStatus}
              onChange={setBookingStatus}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="ALL">All Status</Option>
              <Option value="Checked-in">Checked-in</Option>
              <Option value="Upcoming">Upcoming</Option>
              <Option value="Completed">Completed</Option>
              <Option value="Cancelled">Cancelled</Option>
              <Option value="No Show">No Show</Option>
            </Select>
          </Col>

          {/* Filter & Clear Actions */}
          <Col xs={24} sm={12} lg={6}>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                icon={<FilterOutlined />}
                onClick={() => message.info(`Applied filters: ${filteredBookings.length} matches.`)}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  color: 'var(--color-primary)',
                  borderColor: isDarkMode ? '#333333' : '#d0d7de',
                }}
              >
                Filter
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={clearFilters}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  color: isDarkMode ? '#aaaaaa' : '#64748b',
                  borderColor: isDarkMode ? '#333333' : '#d0d7de',
                }}
              >
                Clear Filters
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      {/* BOOKINGS TABLE CARD */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Table
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
          dataSource={filteredBookings}
          columns={columns}
        />

        {/* Custom Table Footer with Pagination */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
          }}
        >
          <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
            Showing {filteredBookings.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, filteredBookings.length)} of {filteredBookings.length} bookings
          </div>
          <Pagination
            current={currentPage}
            onChange={setCurrentPage}
            total={filteredBookings.length}
            pageSize={pageSize}
            showSizeChanger={false}
          />
        </div>
      </Card>

      {/* ADD WALK-IN BOOKING MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-base)',
                backgroundColor: 'var(--color-primary-bg)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              <PlusOutlined />
            </div>
            <span>Create Walk-in Booking</span>
          </div>
        }
        open={isAddModalOpen}
        onCancel={() => {
          setIsAddModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleAddWalkIn} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Customer Full Name"
                name="customerName"
                rules={[{ required: true, message: 'Please enter customer name' }]}
              >
                <Input placeholder="e.g. Arun Kumar" style={{ height: 42, borderRadius: 'var(--radius-base)' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Phone Number"
                name="phone"
                rules={[{ required: true, message: 'Please enter phone number' }]}
              >
                <Input placeholder="+91 98765 43210" style={{ height: 42, borderRadius: 'var(--radius-base)' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Email Address (Optional)" name="email">
                <Input placeholder="customer@example.com" style={{ height: 42, borderRadius: 'var(--radius-base)' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155' }}>
                Session Duration / Pass Type <span style={{ color: '#ef4444' }}>*</span>
              </div>
              <Segmented
                block
                value={sessionTier}
                onChange={(val) => setSessionTier(val)}
                options={[
                  { label: 'Single Session (1 Day)', value: 'PER_DAY' },
                  { label: 'Weekly Pass (7 Days)', value: 'WEEKLY' },
                  { label: 'Custom Dates', value: 'CUSTOM' },
                ]}
                style={{ height: 42, padding: 3, borderRadius: 'var(--radius-base)' }}
              />
            </Col>
          </Row>

          {/* Activity / Ongoing Section Selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155' }}>
              Activity / Ongoing Section <span style={{ color: '#ef4444' }}>*</span>
            </div>
            <Select
              value={selectedSectionId}
              onChange={handleSectionChange}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="general">
                General Gym Access (Floor & Machines) — ₹{gymSingleSessionPrice} / session
              </Option>
              {gymSections.map((sec) => (
                <Option key={sec._id || sec.id} value={sec._id || sec.id}>
                  {sec.title} ({sec.startTime} - {sec.endTime}) — ₹{sec.cost || gymSingleSessionPrice} / session
                </Option>
              ))}
            </Select>
            <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
              Choose whether the visitor is attending general gym workout or joining an ongoing group class/section.
            </div>
          </div>

          {/* Personal Trainer Selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155' }}>
              Personal Trainer (Optional Add-on)
            </div>
            <Select
              value={selectedTrainerId}
              onChange={(val) => setSelectedTrainerId(val)}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="none">No Personal Trainer (Independent Workout)</Option>
              {availableSessionTrainers.map((tr) => {
                const dailyFee = Number(tr.trainerPricing?.singleSession || 0);
                let feeLabel = `+₹${dailyFee.toLocaleString('en-IN')} / session`;
                if (sessionTier === 'WEEKLY') {
                  feeLabel = `+₹${(dailyFee * 7).toLocaleString('en-IN')} / week (7 sessions)`;
                } else if (sessionTier === 'CUSTOM') {
                  const cnt = Math.max(1, customDatesList.length);
                  feeLabel = `+₹${(dailyFee * cnt).toLocaleString('en-IN')} (${cnt} sessions)`;
                }
                return (
                  <Option key={tr._id || tr.id || tr.employeeId} value={tr._id || tr.id || tr.employeeId}>
                    <UserOutlined style={{ marginRight: 6, color: 'var(--color-primary)' }} />
                    {tr.name} ({tr.specialty || tr.role || 'Certified Trainer'}) — {feeLabel}
                  </Option>
                );
              })}
            </Select>
            {availableSessionTrainers.length === 0 ? (
              <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                No personal trainers available for day/session passes.
              </div>
            ) : (
              <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
                Trainers who have configured single session / daily training pricing in their profile.
              </div>
            )}
          </div>

          {/* Custom Multi-Date Picker (Rendered only if CUSTOM is selected) */}
          {sessionTier === 'CUSTOM' && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#1e1e1e' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  Pick Custom Session Dates
                </span>
                <Badge count={`${customDatesList.length} dates selected`} style={{ backgroundColor: 'var(--color-primary)' }} />
              </div>
              <DatePicker
                placeholder="Click to pick and add a session date"
                style={{ width: '100%', height: 40, marginBottom: 10, borderRadius: 'var(--radius-base)' }}
                onChange={(d) => {
                  if (d) {
                    const dStr = d.format('YYYY-MM-DD');
                    if (!customDatesList.includes(dStr)) {
                      setCustomDatesList([...customDatesList, dStr].sort());
                    } else {
                      message.info('Date is already added.');
                    }
                  }
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 30 }}>
                {customDatesList.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>No dates selected yet. Pick one or more dates above.</span>
                ) : (
                  customDatesList.map((dStr) => (
                    <Tag
                      key={dStr}
                      closable
                      onClose={() => setCustomDatesList(customDatesList.filter((d) => d !== dStr))}
                      color="blue"
                      style={{ padding: '3px 8px', fontSize: 12, borderRadius: 4 }}
                    >
                      {dStr}
                    </Tag>
                  ))
                )}
              </div>
            </div>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={sessionTier === 'WEEKLY' ? 'Pass Start Date (7 Days Validity)' : sessionTier === 'CUSTOM' ? 'First Session Date (Optional)' : 'Session Date'}
                name="date"
              >
                <DatePicker style={{ width: '100%', height: 42, borderRadius: 'var(--radius-base)' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Slot Time" name="time">
                <TimePicker use12Hours format="h:mm a" style={{ width: '100%', height: 42, borderRadius: 'var(--radius-base)' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Pass Fee (Amount in ₹)" name="amount" initialValue={gymSingleSessionPrice}>
                <Input prefix="₹" type="number" style={{ height: 42, borderRadius: 'var(--radius-base)', fontWeight: 700 }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Payment Method" name="payment" initialValue="Cash">
                <Select style={{ height: 42 }}>
                  <Option value="Cash">Cash at Desk</Option>
                  <Option value="UPI">Counter UPI / QR (GPay, PhonePe)</Option>
                  <Option value="Card">Card / POS Swipe</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Price Breakdown Banner */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.1)' : '#f0fdf4',
              border: `1px solid ${isDarkMode ? 'rgba(0, 191, 98, 0.25)' : '#bbf7d0'}`,
              marginBottom: 16,
              fontSize: 12,
              color: isDarkMode ? '#86efac' : '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong>Price Calculation: </strong>
              {sessionTier === 'PER_DAY' && '1 Day Session Pass'}
              {sessionTier === 'WEEKLY' && '7 Days Consecutive Access Pass'}
              {sessionTier === 'CUSTOM' && `${customDatesList.length || 1} Selected Date(s)`}
              {selectedTrainerId !== 'none' && ' + Personal Trainer Add-on'}
            </div>
            <Tag color="green" style={{ fontWeight: 700, margin: 0 }}>Auto-calculated</Tag>
          </div>

          <Form.Item label="Entry Status" name="status" initialValue="Checked-in">
            <Radio.Group>
              <Radio value="Checked-in">Check-in Now (Grant Gate Access Immediately)</Radio>
              <Radio value="Upcoming">Upcoming Session (Check-in upon Arrival)</Radio>
            </Radio.Group>
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
            <Button
              onClick={() => {
                setIsAddModalOpen(false);
                form.resetFields();
              }}
              style={{ borderRadius: 'var(--radius-base)', height: 40 }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<PlusOutlined />}
              style={{
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                height: 40,
              }}
            >
              Confirm & Create Booking
            </Button>
          </div>
        </Form>
      </Modal>

      {/* VIEW BOOKING DETAILS MODAL */}
      <Modal
        title={
          <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Booking Details
          </div>
        }
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={null}
        width={500}
        centered
        destroyOnClose
        styles={{ body: { padding: '8px 4px 12px 4px' } }}
      >
        {selectedBooking && (
          <div>
            {/* Customer Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, marginTop: 8 }}>
              <Avatar
                src={selectedBooking.avatar}
                size={68}
                style={{
                  border: `2px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedBooking.customerName}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PhoneOutlined /> {selectedBooking.phone}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarOutlined /> Customer ID: <span style={{ color: 'var(--color-primary)', fontWeight: 650 }}>{selectedBooking.customerId}</span>
                </div>
              </div>
            </div>

            {/* Key-Value Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              {/* Row 1: Booking Type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <MobileOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Booking Type</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Tag
                    style={{
                      backgroundColor: selectedBooking.type === 'App Booking' ? (isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe') : (isDarkMode ? 'rgba(0, 191, 98, 0.2)' : '#eaf8ef'),
                      color: selectedBooking.type === 'App Booking' ? (isDarkMode ? '#b37feb' : '#722ed1') : '#00bf62',
                      border: 'none',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 12,
                      padding: '2px 10px',
                      margin: 0,
                    }}
                  >
                    {selectedBooking.type}
                  </Tag>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 3 }}>
                    (Member Booking)
                  </div>
                </div>
              </div>

              {/* Row 2: Booking ID */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Booking ID</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedBooking.bookingId}
                </div>
              </div>

              {/* Row 3: Payment Type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CreditCardOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Payment Type</span>
                </div>
                <div>
                  <Tag
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                      color: '#00bf62',
                      border: 'none',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 12,
                      padding: '2px 10px',
                      margin: 0,
                    }}
                  >
                    {selectedBooking.payment && selectedBooking.payment.includes('Online') ? 'Online' : selectedBooking.payment || 'Online'}
                  </Tag>
                </div>
              </div>

              {/* Row 4: Booking Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Booking Date</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedBooking.date}, {selectedBooking.time}
                </div>
              </div>

              {/* Row 5: Booking Expiry Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Booking Expiry Date</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedBooking.date}, 09:00 AM
                </div>
              </div>

              {/* Custom Dates Schedule Section */}
              {selectedBooking.isCustomDates && Array.isArray(selectedBooking.customDates) && selectedBooking.customDates.length > 0 && (
                <div style={{ marginTop: 12, padding: '12px', borderRadius: 8, backgroundColor: isDarkMode ? '#1a1a1a' : '#f8fafc', border: `1px solid ${isDarkMode ? '#333' : '#e2e8f0'}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 10 }}>
                    Custom Dates Schedule ({selectedBooking.customDates.length} Days)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selectedBooking.customDates.map((item, idx) => {
                      const dateFormatted = item.date ? new Date(item.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '';
                      const isRequested = item.status === 'Reschedule_Requested';
                      const isProposed = item.status === 'Reschedule_Proposed';
                      const isAttended = item.status === 'Attended';
                      const isMissed = item.status === 'Missed';
                      const isRescheduled = item.status === 'Rescheduled';

                      let tagColor = 'blue';
                      if (isAttended) tagColor = 'success';
                      else if (isMissed) tagColor = 'error';
                      else if (isRequested) tagColor = 'warning';
                      else if (isProposed) tagColor = 'purple';
                      else if (isRescheduled) tagColor = 'cyan';

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 6,
                            backgroundColor: isDarkMode ? '#222' : '#ffffff',
                            border: `1px solid ${isDarkMode ? '#333' : '#e2e8f0'}`,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 12.5, color: isDarkMode ? '#fff' : '#0f172a' }}>
                                Day {idx + 1}:
                              </span>{' '}
                              <span style={{ fontSize: 12.5, color: isDarkMode ? '#ccc' : '#475569' }}>
                                {dateFormatted}
                              </span>
                              {item.dailyOtp && (
                                <div style={{ fontSize: 11, color: isDarkMode ? '#888' : '#64748b', marginTop: 2 }}>
                                  Daily OTP: <strong style={{ color: 'var(--color-primary)' }}>{item.dailyOtp}</strong>
                                </div>
                              )}
                            </div>
                            <Tag color={tagColor} style={{ fontWeight: 600 }}>
                              {item.status}
                            </Tag>
                          </div>

                          {isRequested && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${isDarkMode ? '#333' : '#e2e8f0'}` }}>
                              <div style={{ fontSize: 12, color: '#d97706', marginBottom: 6 }}>
                                <strong>Requested Date:</strong> {item.requestedDate ? new Date(item.requestedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                {item.reason ? ` (${item.reason})` : ''}
                              </div>
                              <Button
                                size="small"
                                type="primary"
                                style={{ fontSize: 12, borderRadius: 6, backgroundColor: '#003882' }}
                                onClick={() => {
                                  setReviewTarget({ booking: selectedBooking, sessionIndex: idx, session: item });
                                  setProposedDate(null);
                                  setReviewNotes('');
                                  setReviewModalVisible(true);
                                }}
                              >
                                Review Reschedule Request
                              </Button>
                            </div>
                          )}

                          {isProposed && item.proposedDate && (
                            <div style={{ fontSize: 11.5, color: '#722ed1', marginTop: 6 }}>
                              Proposed new date: {new Date(item.proposedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} (Awaiting member confirmation)
                            </div>
                          )}

                          {isRescheduled && item.rescheduledTo && (
                            <div style={{ fontSize: 11.5, color: '#0891b2', marginTop: 6 }}>
                              Rescheduled to: {new Date(item.rescheduledTo).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Expiry Warning Notice Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.15)' : '#f3effe',
                marginBottom: 24,
              }}
            >
              <InfoCircleOutlined style={{ color: '#722ed1', fontSize: 18, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: isDarkMode ? '#d3adf7' : '#531dab', lineHeight: 1.4 }}>
                Customer will not be able to check-in after the expiry date and time.
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 14 }}>
              <Button
                onClick={() => setIsViewModalOpen(false)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 14,
                  borderColor: isDarkMode ? '#333333' : '#d0d7de',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                }}
              >
                Close
              </Button>
              {selectedBooking.status === 'Checked-in' ? (
                <div
                  style={{
                    flex: 1.3,
                    height: 44,
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 600,
                    fontSize: 14,
                    backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                    color: '#00bf62',
                    border: `1px solid ${isDarkMode ? 'rgba(0, 191, 98, 0.3)' : '#b7eb8f'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    userSelect: 'none',
                  }}
                >
                  <CheckCircleOutlined style={{ color: '#00bf62', fontSize: 16 }} />
                  <span>Checked-in</span>
                </div>
              ) : (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined style={{ color: '#ffffff' }} />}
                  onClick={() => {
                    handleCheckIn(selectedBooking);
                    setIsViewModalOpen(false);
                  }}
                  style={{
                    flex: 1.3,
                    height: 44,
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 600,
                    fontSize: 14,
                    backgroundColor: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Mark Check-in
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* CUSTOM DATE RANGE MODAL */}
      <Modal
        title="Select Custom Date Range"
        open={isDateRangeModalOpen}
        onCancel={() => {
          setIsDateRangeModalOpen(false);
          setTempDateRange(null);
        }}
        onOk={() => {
          if (tempDateRange && tempDateRange.length === 2 && tempDateRange[0] && tempDateRange[1]) {
            const start = tempDateRange[0].format('DD MMM YYYY');
            const end = tempDateRange[1].format('DD MMM YYYY');
            setSelectedDateRange(`${start} - ${end}`);
            setIsDateRangeModalOpen(false);
            message.success(`Date filter set: ${start} - ${end}`);
          } else {
            message.warning('Please pick both start and end dates');
          }
        }}
        okText="Apply Filter"
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ padding: '16px 0' }}>
          <Paragraph style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13, marginBottom: 16 }}>
            Pick start date and end date to filter customer bookings ledger:
          </Paragraph>
          <DatePicker.RangePicker
            style={{ width: '100%', height: 42 }}
            onChange={(dates) => setTempDateRange(dates)}
          />
        </div>
      </Modal>

      {/* REVIEW RESCHEDULE MODAL */}
      <Modal
        title="Review Reschedule Request"
        open={reviewModalVisible}
        onCancel={() => {
          setReviewModalVisible(false);
          setReviewTarget(null);
        }}
        footer={null}
        destroyOnClose
        width={480}
      >
        {reviewTarget && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', fontSize: 14 }}>
                Member: {reviewTarget.booking.customerName}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Booking ID: {reviewTarget.booking.bookingId}
              </Text>
            </div>

            <div style={{ padding: 12, borderRadius: 8, backgroundColor: isDarkMode ? '#1e1e1e' : '#f1f5f9', marginBottom: 16 }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>
                <strong>Original Date:</strong> {new Date(reviewTarget.session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 13, color: '#d97706', marginBottom: 4 }}>
                <strong>Member Requested:</strong> {reviewTarget.session.requestedDate ? new Date(reviewTarget.session.requestedDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'None'}
              </div>
              {reviewTarget.session.reason && (
                <div style={{ fontSize: 12, color: isDarkMode ? '#aaa' : '#64748b' }}>
                  <strong>Reason:</strong> {reviewTarget.session.reason}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Or Propose a Different Date:
              </label>
              <DatePicker
                style={{ width: '100%', height: 40 }}
                placeholder="Pick proposed date"
                onChange={(d) => setProposedDate(d)}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                Notes / Message to Member (Optional):
              </label>
              <Input.TextArea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="e.g. Approved as per your request."
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button
                danger
                loading={isSubmittingReview}
                onClick={() => handleReviewReschedule('REJECT')}
              >
                Reject Request
              </Button>
              <Button
                style={{ borderColor: '#722ed1', color: '#722ed1' }}
                disabled={!proposedDate}
                loading={isSubmittingReview}
                onClick={() => handleReviewReschedule('PROPOSE')}
              >
                Propose Different Date
              </Button>
              <Button
                type="primary"
                style={{ backgroundColor: '#003882' }}
                loading={isSubmittingReview}
                onClick={() => handleReviewReschedule('APPROVE')}
              >
                Approve Requested Date
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BookingsManagement;
