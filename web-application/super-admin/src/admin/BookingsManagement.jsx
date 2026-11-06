import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Modal,
  Pagination,
  Typography,
  message,
  Avatar,
  Divider,
  Spin,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ShopOutlined,
  PhoneOutlined,
  MailOutlined,
  CreditCardOutlined,
  UserOutlined,
  DollarOutlined,
  CopyOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { useDebounce } from '../hooks/useDebounce';
import { bookingService } from '../services/bookingService';
import { apiClient } from '../services/apiClient';

const { Option } = Select;
const { Text } = Typography;

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed) return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

export const BookingsManagement = () => {
  const { isDarkMode } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter: 'all', 'session', 'group_class'
  const urlType = searchParams.get('type') || 'all';

  // Data & Loading States
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    sessionCount: 0,
    groupClassCount: 0,
    upcomingCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalRevenue: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

  // Dynamic Gyms List
  const [gymsList, setGymsList] = useState([]);
  const [gymsLoading, setGymsLoading] = useState(false);

  // Filters & Pagination
  const [activeTab, setActiveTab] = useState(urlType);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [didYouMean, setDidYouMean] = useState(null);
  const [gymFilter, setGymFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    if (urlType && ['all', 'session', 'group_class'].includes(urlType)) {
      setActiveTab(urlType);
      setCurrentPage(1);
    }
  }, [urlType]);

  // Load gyms list once
  useEffect(() => {
    const fetchGyms = async () => {
      setGymsLoading(true);
      try {
        const res = await apiClient.get('/gyms/options', { params: { limit: 50 } });
        const list = res.data?.data?.gyms || [];
        setGymsList(list);
      } catch (err) {
        console.warn('Failed to load gym options:', err);
      } finally {
        setGymsLoading(false);
      }
    };
    fetchGyms();
  }, []);

  // Fetch Bookings from API
  const fetchBookings = useCallback(
    async (page = 1, type = activeTab, status = statusFilter, gym = gymFilter, search = debouncedSearch) => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: pageSize,
          type: type === 'all' ? undefined : type,
          status: status === 'all' ? undefined : status,
          gymId: gym === 'all' ? undefined : gym,
          search: search?.trim() || undefined,
        };
        const res = await bookingService.getBookings(params);
        setBookings(res.bookings || []);
        setDidYouMean(res.didYouMean || null);
        if (res.summary) setSummary(res.summary);
        if (res.pagination) {
          setTotalRecords(res.pagination.totalRecords || 0);
          setCurrentPage(res.pagination.page || 1);
        }
      } catch (err) {
        console.error('Failed to fetch bookings:', err);
        message.error('Failed to fetch bookings from server');
      } finally {
        setLoading(false);
      }
    },
    [activeTab, statusFilter, gymFilter, debouncedSearch, pageSize]
  );

  useEffect(() => {
    fetchBookings(currentPage, activeTab, statusFilter, gymFilter, debouncedSearch);
  }, [fetchBookings, currentPage, activeTab, statusFilter, gymFilter, debouncedSearch]);

  // Global App Refresh listener (from breadcrumb bar)
  useEffect(() => {
    const handleRefresh = () => {
      fetchBookings(currentPage, activeTab, statusFilter, gymFilter, debouncedSearch);
    };
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchBookings, currentPage, activeTab, statusFilter, gymFilter, debouncedSearch]);

  const handleTabChange = (key) => {
    setActiveTab(key);
    setCurrentPage(1);
    setSearchParams(key === 'all' ? {} : { type: key });
  };

  const handleOpenDetails = (record) => {
    setSelectedBooking(record);
    setIsDetailsModalOpen(true);
  };

  const handleExportCSV = () => {
    if (bookings.length === 0) {
      message.warning('No booking records to export');
      return;
    }
    const headers = [
      'Booking ID',
      'Booking Type',
      'Session / Class Title',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Gym Partner',
      'Gym City',
      'Date',
      'Time Slot',
      'Status',
      'Amount',
      'Payment Method',
    ];
    const rows = bookings.map((b) => [
      b.bookingId || '',
      b.bookingType === 'GROUP_CLASS' ? 'Group Class' : 'Session Booking',
      b.title || '',
      b.user?.name || '',
      b.user?.phone || '',
      b.user?.email || '',
      b.gym?.name || '',
      b.gym?.city || '',
      b.startDate ? new Date(b.startDate).toLocaleDateString('en-GB') : '',
      b.timeSlot || 'General Session',
      b.status || '',
      b.pricing?.totalAmount || 0,
      b.payment?.method || 'UPI',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gymezy_Bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Bookings exported to CSV');
  };

  // Table Columns
  const columns = [
    {
      title: 'Booking ID',
      dataIndex: 'bookingId',
      key: 'bookingId',
      width: 140,
      render: (text, record) => (
        <Tooltip title="View full booking details">
          <span
            onClick={() => handleOpenDetails(record)}
            style={{
              fontWeight: 750,
              color: '#4f46e5',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 13,
            }}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 220,
      render: (_, record) => {
        const u = record.user || {};
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {hasValidProfilePic(u.avatar) ? (
              <Avatar src={u.avatar} size={36} style={{ flexShrink: 0 }} />
            ) : (
              <Avatar
                icon={<UserOutlined style={{ fontSize: 18 }} />}
                size={36}
                style={{
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe',
                  color: '#6366f1',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {u.name || 'Member'}
              </div>
              <div style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                {u.phone || u.email || '—'}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Gym Partner',
      key: 'gym',
      width: 190,
      render: (_, record) => {
        const g = record.gym || {};
        return (
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
              {g.name || 'Partner Gym'}
            </div>
            <div style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {g.area ? `${g.area}, ` : ''}{g.city || ''}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Booking Type',
      dataIndex: 'bookingType',
      key: 'bookingType',
      width: 140,
      render: (type) => {
        const isGroup = type === 'GROUP_CLASS';
        return (
          <Tag
            color={isGroup ? 'purple' : 'blue'}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              fontWeight: 700,
              fontSize: 11.5,
            }}
          >
            {isGroup ? 'Group Class' : 'Session Booking'}
          </Tag>
        );
      },
    },
    {
      title: 'Session / Class Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      render: (title, record) => (
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: isDarkMode ? '#cbd5e1' : '#334155',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 190,
            }}
          >
            {title || 'Session Pass'}
          </div>
          <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
            {record.category || 'General'}
          </div>
        </div>
      ),
    },
    {
      title: 'Date & Time Slot',
      key: 'dateTime',
      width: 180,
      render: (_, record) => {
        const dateStr = record.startDate
          ? new Date(record.startDate).toLocaleDateString('en-GB')
          : record.createdAt
          ? new Date(record.createdAt).toLocaleDateString('en-GB')
          : 'Recent';
        return (
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
              {dateStr}
            </div>
            <div style={{ fontSize: 11.5, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {record.timeSlot || 'General Session'}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (st) => {
        let bg = isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef';
        let color = '#00bf62';
        if (st === 'Cancelled') {
          bg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed';
          color = '#e11d48';
        } else if (st === 'Upcoming' || st === 'Active') {
          bg = isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#edf4fe';
          color = '#3b82f6';
        }
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: bg,
              color: color,
            }}
          >
            {st || 'Active'}
          </span>
        );
      },
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 120,
      render: (_, record) => {
        const amt = record.pricing?.totalAmount || 0;
        return (
          <span style={{ fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            ₹ {amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          size="small"
          onClick={() => handleOpenDetails(record)}
          style={{
            borderRadius: 'var(--radius-base)',
            fontWeight: 600,
            fontSize: 12,
            color: '#4f46e5',
            borderColor: isDarkMode ? '#3730a3' : '#c7d2fe',
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 1. TOP SUMMARY METRIC CARDS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Total Bookings */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CalendarOutlined style={{ fontSize: 20, color: '#6366f1' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Bookings
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {(summary.totalCount || 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>All Sessions & Classes</div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Session Bookings */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#edf4fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ClockCircleOutlined style={{ fontSize: 20, color: '#3b82f6' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Session Bookings
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {(summary.sessionCount || 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>Gym & Section</div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Group Classes */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#f5f3ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <UserOutlined style={{ fontSize: 20, color: '#a855f7' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Group Classes
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {(summary.groupClassCount || 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#a855f7', fontWeight: 600 }}>Batches & Classes</div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Upcoming */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef4e8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ClockCircleOutlined style={{ fontSize: 20, color: '#f59e0b' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Upcoming
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {(summary.upcomingCount || 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>Scheduled</div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Completed */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 20, color: '#00bf62' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Completed
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {(summary.completedCount || 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#00bf62', fontWeight: 600 }}>Attended</div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Total Revenue */}
        <Col xs={24} sm={12} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#ede9fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <DollarOutlined style={{ fontSize: 20, color: '#6366f1' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Revenue
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  ₹ {(summary.totalRevenue || 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>Gross Bookings</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2. SUB-NAV TABS & FILTERS BAR */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 20,
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        {/* Navigation Tabs for All / Session Bookings / Group Classes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, borderBottom: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`, paddingBottom: 12 }}>
          <Button
            type={activeTab === 'all' ? 'primary' : 'text'}
            onClick={() => handleTabChange('all')}
            style={{
              borderRadius: 20,
              fontWeight: 700,
              backgroundColor: activeTab === 'all' ? '#4f46e5' : 'transparent',
            }}
          >
            All Bookings ({summary.totalCount || 0})
          </Button>

          <Button
            type={activeTab === 'session' ? 'primary' : 'text'}
            onClick={() => handleTabChange('session')}
            style={{
              borderRadius: 20,
              fontWeight: 700,
              backgroundColor: activeTab === 'session' ? '#4f46e5' : 'transparent',
            }}
          >
            Session Bookings ({summary.sessionCount || 0})
          </Button>

          <Button
            type={activeTab === 'group_class' ? 'primary' : 'text'}
            onClick={() => handleTabChange('group_class')}
            style={{
              borderRadius: 20,
              fontWeight: 700,
              backgroundColor: activeTab === 'group_class' ? '#4f46e5' : 'transparent',
            }}
          >
            Group Classes ({summary.groupClassCount || 0})
          </Button>
        </div>

        {/* Filter controls row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
            <Input
              placeholder="Search by customer, booking ID, phone..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={() => {
                setCurrentPage(1);
                fetchBookings(1, activeTab, statusFilter, gymFilter, searchQuery);
              }}
              style={{ width: 260, borderRadius: 'var(--radius-base)' }}
              allowClear
            />

            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                setCurrentPage(1);
                fetchBookings(1, activeTab, statusFilter, gymFilter, searchQuery);
              }}
              style={{ backgroundColor: '#4f46e5', borderRadius: 'var(--radius-base)' }}
            >
              Search
            </Button>

            <Select
              value={gymFilter}
              onChange={(val) => {
                setGymFilter(val);
                setCurrentPage(1);
              }}
              style={{ width: 180 }}
              placeholder="All Gyms"
            >
              <Option value="all">All Gym Partners</Option>
              {gymsList.map((g) => (
                <Option key={g._id || g.partnerId} value={g._id || g.partnerId}>
                  {g.name} {g.area ? `(${g.area})` : ''}
                </Option>
              ))}
            </Select>

            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              style={{ width: 140 }}
            >
              <Option value="all">All Status</Option>
              <Option value="Upcoming">Upcoming</Option>
              <Option value="Active">Active</Option>
              <Option value="Completed">Completed</Option>
              <Option value="Cancelled">Cancelled</Option>
            </Select>
          </div>

          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
            style={{
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              borderColor: isDarkMode ? '#334155' : '#e2e8f0',
            }}
          >
            Export CSV
          </Button>
        </div>
      </Card>

      {/* "Did You Mean" Interactive Spelling Suggestion Banner */}
      {didYouMean && (
        <div
          style={{
            backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff',
            border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe'}`,
            borderRadius: 8,
            padding: '10px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
              Did you mean{' '}
              <strong
                onClick={() => {
                  setSearchQuery(didYouMean);
                  setCurrentPage(1);
                }}
                style={{
                  color: '#6366f1',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                "{didYouMean}"
              </strong>
              ?
            </span>
          </div>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setSearchQuery(didYouMean);
              setCurrentPage(1);
            }}
            style={{ color: '#6366f1', fontWeight: 600, padding: 0 }}
          >
            Apply Correction
          </Button>
        </div>
      )}

      {/* 3. BOOKINGS DATA TABLE */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 20,
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={bookings}
          loading={loading}
          pagination={false}
          rowKey={(r) => r._id || r.bookingId}
          scroll={{ x: 1300 }}
          locale={{ emptyText: 'No booking records found for the selected filter.' }}
        />

        {/* Server-Side Pagination Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`, flexWrap: 'wrap', gap: 12 }}>
          <span style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Showing {bookings.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
          </span>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalRecords}
            onChange={(page, pSize) => {
              setCurrentPage(page);
              setPageSize(pSize);
            }}
            showSizeChanger
            showQuickJumper
            pageSizeOptions={['10', '20', '50', '100']}
          />
        </div>
      </Card>

      {/* 4. BOOKING FULL DETAILS MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 17 }}>Booking Details</span>
            {selectedBooking?.bookingType === 'GROUP_CLASS' ? (
              <Tag color="purple">Group Class</Tag>
            ) : (
              <Tag color="blue">Session Booking</Tag>
            )}
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={null}
        width={680}
        centered
      >
        {selectedBooking && (
          <div style={{ marginTop: 16 }}>
            {/* Top Info Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: 8,
                backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                marginBottom: 20,
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>Booking ID</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: '#4f46e5' }}>
                  {selectedBooking.bookingId}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, color: '#64748b', display: 'block' }}>Status</span>
                <span style={{ fontWeight: 800, color: selectedBooking.status === 'Cancelled' ? '#ef4444' : '#00bf62' }}>
                  {selectedBooking.status}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: 10 }}>
                Customer Information
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {hasValidProfilePic(selectedBooking.user?.avatar) ? (
                  <Avatar src={selectedBooking.user?.avatar} size={48} />
                ) : (
                  <Avatar
                    icon={<UserOutlined style={{ fontSize: 24 }} />}
                    size={48}
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe',
                      color: '#4f46e5',
                    }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedBooking.user?.name || 'Customer'}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12.5, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 4 }}>
                    <span><PhoneOutlined /> {selectedBooking.user?.phone || '—'}</span>
                    <span><MailOutlined /> {selectedBooking.user?.email || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Gym & Session Information */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: 10 }}>
                Session & Gym Details
              </div>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Gym Partner</Text>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedBooking.gym?.name || 'Partner Gym'}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {selectedBooking.gym?.area ? `${selectedBooking.gym?.area}, ` : ''}{selectedBooking.gym?.city}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Session / Class Title</Text>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedBooking.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Category: {selectedBooking.category || 'General'}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Scheduled Date</Text>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {selectedBooking.startDate
                      ? new Date(selectedBooking.startDate).toLocaleDateString('en-GB')
                      : 'Recent'}
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Time Slot</Text>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {selectedBooking.timeSlot || 'General Session'}
                  </div>
                </Col>
              </Row>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Payment & Pricing */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: 10 }}>
                Payment & Pricing
              </div>
              <Row gutter={[16, 12]}>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Total Amount</Text>
                  <div style={{ fontWeight: 900, fontSize: 18, color: '#00bf62' }}>
                    ₹ {(selectedBooking.pricing?.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Payment Method</Text>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {selectedBooking.payment?.method || 'UPI'}
                  </div>
                </Col>
                <Col span={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Transaction ID</Text>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#64748b' }}>
                    {selectedBooking.payment?.transactionId || '—'}
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BookingsManagement;
