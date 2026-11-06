import React, { useState, useEffect, useCallback } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Table,
  Tag,
  Button,
  Input,
  Space,
  Typography,
  Badge,
  Avatar,
  Dropdown,
  DatePicker,
  Modal,
  message,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  UsergroupAddOutlined,
  UserAddOutlined,
  MobileOutlined,
  TeamOutlined,
  QrcodeOutlined,
  DollarCircleOutlined,
  RiseOutlined,
  LineChartOutlined,
  ScanOutlined,
  LockOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  FireOutlined,
  PlusOutlined,
  CalendarOutlined,
  DownOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { recordCheckIn, recordCheckOut } from '../redux/slices/gymSlice';
import { apiClient } from '../services/apiClient';

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

const { Title, Text, Paragraph } = Typography;

export const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDarkMode } = useTheme();

  const { user } = useSelector((state) => state.auth || {});
  const { liveOccupancy, capacity, members, checkIns, bookings, gymProfile } = useSelector((state) => state.gym);

  const isManager = Boolean(
    user?.isManager ||
    user?.role === 'MANAGER' ||
    String(user?.role || '').toUpperCase() === 'MANAGER'
  );

  // Scoped gym partner identity
  const activeGym = user?.gym || gymProfile || {};
  const gymId = activeGym._id || activeGym.id || user?.gymId?._id || user?.gymId || user?.partnerId || 'me';

  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [quickOtp, setQuickOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [selectedDate, setSelectedDate] = useState('This Month');
  const [customDateRange, setCustomDateRange] = useState({ startDate: null, endDate: null });
  const [isCustomDateModalOpen, setIsCustomDateModalOpen] = useState(false);
  const [tempCustomRange, setTempCustomRange] = useState(null);

  const fetchDashboardStats = useCallback(async () => {
    if (!gymId) return;
    setLoadingStats(true);
    try {
      const params = { range: selectedDate };
      if (customDateRange?.startDate && customDateRange?.endDate) {
        params.startDate = customDateRange.startDate;
        params.endDate = customDateRange.endDate;
      }
      const res = await apiClient.get(`/gyms/${gymId}/dashboard-stats`, { params });
      if (res?.data?.data) {
        setDashboardStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load gym dashboard statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [gymId, selectedDate, customDateRange]);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const handleQuickCheckIn = () => {
    if (!quickOtp || quickOtp.length < 6) {
      message.warning('Please enter a valid 6-digit check-in OTP');
      return;
    }

    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      const newEntry = {
        key: Date.now().toString(),
        passId: `FSB${Math.floor(100000 + Math.random() * 900000)}`,
        customerId: `CUST${Math.floor(100000 + Math.random() * 900000)}`,
        memberName: `Pass Holder (${quickOtp})`,
        type: 'Gym Access Pass',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: 'Today',
        otp: quickOtp,
        status: 'VERIFIED',
        method: 'Turnstile Terminal',
      };
      dispatch(recordCheckIn(newEntry));
      message.success(`Access Granted! Turnstile Gate 1 Unlocked.`);
      setQuickOtp('');
    }, 500);
  };

  const columns = [
    {
      title: 'Member',
      dataIndex: 'memberName',
      key: 'memberName',
      render: (text, record) => (
        <Space orientation="horizontal" size={12}>
          <Avatar
            src={hasValidProfilePic(record.avatar) ? record.avatar : undefined}
            icon={<UserOutlined style={{ fontSize: 16 }} />}
            style={{
              backgroundColor: isDarkMode ? '#1e1b4b' : '#ede9fe',
              color: '#6366f1',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          <div>
            <div style={{ fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>{text}</div>
            <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>{record.customerId}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Pass Type',
      dataIndex: 'type',
      key: 'type',
      render: (text) => <Text style={{ color: isDarkMode ? '#cccccc' : '#334155' }}>{text}</Text>,
    },
    {
      title: 'Pass ID & OTP',
      key: 'pass',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#1677ff' }}>{record.passId}</div>
          <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>OTP: {record.otp}</div>
        </div>
      ),
    },
    {
      title: 'Time',
      dataIndex: 'time',
      key: 'time',
      render: (text) => (
        <Space size={6}>
          <ClockCircleOutlined style={{ color: '#888888' }} />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Gate Point',
      dataIndex: 'method',
      key: 'method',
      render: (text) => (
        <Tag color="blue" style={{ borderRadius: 6, fontWeight: 500 }}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: () => (
        <Tag
          color="success"
          icon={<CheckCircleFilled />}
          style={{
            color: '#00bf62',
            backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.12)' : '#e6f7ef',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          PASSED
        </Tag>
      ),
    },
  ];

  const occupancyPercent = Math.round((liveOccupancy / capacity) * 100);

  const handleSelectDateRange = (label) => {
    setCustomDateRange({ startDate: null, endDate: null });
    setSelectedDate(label);
  };

  const dateFilterMenu = {
    items: [
      { key: 'today', label: 'Today', onClick: () => handleSelectDateRange('Today') },
      { key: 'yesterday', label: 'Yesterday', onClick: () => handleSelectDateRange('Yesterday') },
      { key: 'this_week', label: 'This Week', onClick: () => handleSelectDateRange('This Week') },
      { key: 'this_month', label: 'This Month', onClick: () => handleSelectDateRange('This Month') },
      { key: 'all_time', label: 'All Time', onClick: () => handleSelectDateRange('All Time') },
      { type: 'divider' },
      {
        key: 'custom',
        label: 'Custom Range...',
        icon: <CalendarOutlined style={{ color: 'var(--color-primary)' }} />,
        onClick: () => setIsCustomDateModalOpen(true),
      },
    ],
  };

  return (
    <div>
      {/* Overview Header */}
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
          <Title level={2} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Overview
          </Title>
          <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 14 }}>
            Here's what's happening at your gym today.
          </Text>
        </div>

        {/* Date Filter Pill */}
        <Dropdown menu={dateFilterMenu} trigger={['click']}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              backgroundColor: isDarkMode ? '#141414' : '#ffffff',
              border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
              borderRadius: 'var(--radius-base)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: isDarkMode ? '#ffffff' : '#0f172a',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 15 }} />
            <span>{selectedDate}</span>
            <DownOutlined style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginLeft: 4 }} />
          </div>
        </Dropdown>
      </div>

      {/* 6 OVERVIEW METRIC CARDS GRID */}
      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        {/* 1-3. Financial & Revenue Metrics (Restricted to Gym Owner / Admin Only) */}
        {!isManager && (
          <>
            {/* 1. Total Revenue */}
            <Col xs={24} sm={12} lg={8}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-success-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-success)',
                      fontSize: 22,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    ₹
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Total Revenue
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                      ₹{Number(dashboardStats?.metrics?.totalRevenue ?? 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {selectedDate === 'This Month' ? 'Monthly GMV' : `${selectedDate} GMV`}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* 2. Member Revenue */}
            <Col xs={24} sm={12} lg={8}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-info-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-info)',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <UserAddOutlined />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Membership Plans
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                      ₹{Number(dashboardStats?.metrics?.memberRevenue ?? 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Active Plan Subscriptions
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* 3. App Booking Revenue */}
            <Col xs={24} sm={12} lg={8}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px 24px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-purple-bg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-purple)',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <MobileOutlined />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Session Bookings
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                      ₹{Number(dashboardStats?.metrics?.appBookingRevenue ?? 0).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                      Day Passes & Group Classes
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </>
        )}

        {/* 4. App Count */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-purple-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-purple)',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <MobileOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  App Count
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                  {dashboardStats?.metrics?.appCount ?? 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Active App Passes & Bookings
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 5. Total Active Users (Moved to center) */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-warning-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-warning)',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <TeamOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Total Active Users
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                  {dashboardStats?.metrics?.totalActiveUsers ?? 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Active Registered Customers
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 6. Walk-in Count (Replaced Completed Sessions) */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-success)',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <UsergroupAddOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Walk-in Count
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                  {dashboardStats?.metrics?.walkInCount ?? 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Counter & Desk Walk-ins
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* RECENT BOOKINGS & MEMBERSHIP STATUS */}
      <Row gutter={[20, 20]} style={{ marginBottom: 28 }}>
        {/* Card 1: Recent Bookings */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            {/* Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-base)',
                    backgroundColor: 'var(--color-purple-bg)',
                    color: 'var(--color-purple)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  <CalendarOutlined />
                </div>
                <span style={{ fontSize: 16, fontWeight: 650, color: 'var(--text-primary)' }}>
                  Recent Bookings
                </span>
              </div>
              <Button
                type="link"
                onClick={() => navigate('/owner/bookings')}
                style={{ color: 'var(--color-primary)', fontWeight: 600, padding: 0 }}
              >
                View All
              </Button>
            </div>

            {/* Table */}
            <Table
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
              loading={loadingStats}
              dataSource={(dashboardStats?.recentBookings || bookings || []).slice(0, 4)}
              locale={{ emptyText: 'No recent bookings recorded today' }}
              columns={[
                {
                  title: 'Customer Name',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text, record) => {
                    const hasPic = hasValidProfilePic(record.avatar);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar
                          src={hasPic ? record.avatar : undefined}
                          icon={!hasPic ? <UserOutlined style={{ fontSize: 18 }} /> : undefined}
                          size={36}
                          style={{
                            backgroundColor: 'var(--bg-tag)',
                            color: 'var(--color-primary)',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                            {text}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {record.phone}
                          </div>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  title: 'Time',
                  dataIndex: 'time',
                  key: 'time',
                  render: (text) => (
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                      {text}
                    </span>
                  ),
                },
                {
                  title: 'Type',
                  dataIndex: 'type',
                  key: 'type',
                  render: (type, record) => (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Tag
                        style={{
                          backgroundColor: type === 'App Booking' ? 'var(--color-purple-bg)' : 'var(--color-success-bg)',
                          color: type === 'App Booking' ? 'var(--color-purple)' : 'var(--color-success)',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 11,
                          padding: '1px 8px',
                          margin: 0,
                        }}
                      >
                        {type}
                      </Tag>
                      <Tag
                        color={record.source === 'WALK_IN' ? 'purple' : 'blue'}
                        style={{
                          fontWeight: 700,
                          fontSize: 10,
                          borderRadius: 4,
                          padding: '0 6px',
                          margin: 0,
                        }}
                      >
                        {record.source === 'WALK_IN' ? 'WALK-IN' : 'APP'}
                      </Tag>
                    </div>
                  ),
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => {
                    if (status === 'Checked In') {
                      return (
                        <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircleFilled style={{ fontSize: 12 }} /> Checked In
                        </span>
                      );
                    }
                    if (status === 'Upcoming') {
                      return (
                        <span style={{ color: 'var(--color-warning)', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ClockCircleOutlined style={{ fontSize: 12 }} /> Upcoming
                        </span>
                      );
                    }
                    return (
                      <span style={{ color: 'var(--color-info)', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircleFilled style={{ fontSize: 12 }} /> Completed
                      </span>
                    );
                  },
                },
              ]}
            />

            {/* Footer Link */}
            <div style={{ marginTop: 16 }}>
              <Button
                type="link"
                onClick={() => navigate('/owner/bookings')}
                style={{
                  padding: 0,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                View all bookings <ArrowRightOutlined style={{ fontSize: 11 }} />
              </Button>
            </div>
          </Card>
        </Col>

        {/* Card 2: Membership Status */}
        <Col xs={24} lg={12}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 4px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            {/* Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-base)',
                    backgroundColor: 'var(--color-info-bg)',
                    color: 'var(--color-info)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 16,
                  }}
                >
                  <UsergroupAddOutlined />
                </div>
                <span style={{ fontSize: 16, fontWeight: 650, color: 'var(--text-primary)' }}>
                  Membership Status
                </span>
              </div>
              <Button
                type="link"
                onClick={() => navigate('/owner/members')}
                style={{ color: 'var(--color-primary)', fontWeight: 600, padding: 0 }}
              >
                View All
              </Button>
            </div>

            {/* Table */}
            <Table
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
              loading={loadingStats}
              dataSource={(dashboardStats?.recentMembers || members || []).slice(0, 4)}
              locale={{ emptyText: 'No registered active members found' }}
              columns={[
                {
                  title: 'Customer Name',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text, record) => {
                    const hasPic = hasValidProfilePic(record.avatar);
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar
                          src={hasPic ? record.avatar : undefined}
                          icon={!hasPic ? <UserOutlined style={{ fontSize: 18 }} /> : undefined}
                          size={36}
                          style={{
                            backgroundColor: 'var(--bg-tag)',
                            color: 'var(--color-primary)',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                          {text}
                        </span>
                      </div>
                    );
                  },
                },
                {
                  title: 'Membership Type',
                  dataIndex: 'plan',
                  key: 'plan',
                  render: (plan, record) => (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {plan}
                      </span>
                      <Tag
                        color={record.source === 'WALK_IN' ? 'purple' : 'blue'}
                        style={{
                          fontWeight: 700,
                          fontSize: 10,
                          borderRadius: 4,
                          padding: '0 6px',
                          margin: 0,
                        }}
                      >
                        {record.source === 'WALK_IN' ? 'WALK-IN' : 'APP'}
                      </Tag>
                    </div>
                  ),
                },
                {
                  title: 'End Date',
                  dataIndex: 'endDate',
                  key: 'endDate',
                  render: (date) => (
                    <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
                      {date}
                    </span>
                  ),
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => {
                    let color = 'var(--color-success)';
                    let bg = 'var(--color-success-bg)';
                    if (status === 'Expiring Soon') {
                      color = 'var(--color-warning)';
                      bg = 'var(--color-warning-bg)';
                    } else if (status === 'Expired') {
                      color = 'var(--color-danger)';
                      bg = 'var(--color-danger-bg)';
                    }
                    return (
                      <Tag
                        style={{
                          backgroundColor: bg,
                          color: color,
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 11,
                          padding: '1px 8px',
                        }}
                      >
                        {status}
                      </Tag>
                    );
                  },
                },
                {
                  title: 'Action',
                  key: 'action',
                  render: (_, record) => {
                    const isExpiring = record.status === 'Expiring Soon';
                    return (
                      <Button
                        size="small"
                        type={isExpiring ? 'primary' : 'default'}
                        onClick={() => navigate('/owner/members')}
                        style={{
                          borderRadius: 'var(--radius-base)',
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: isExpiring ? 'var(--color-primary)' : 'transparent',
                          borderColor: isExpiring ? 'var(--color-primary)' : 'var(--border-color)',
                          color: isExpiring ? '#ffffff' : 'var(--color-primary)',
                        }}
                      >
                        {record.status === 'Active' ? 'View' : 'Extend'}
                      </Button>
                    );
                  },
                },
              ]}
            />

            {/* Footer Link */}
            <div style={{ marginTop: 16 }}>
              <Button
                type="link"
                onClick={() => navigate('/owner/members')}
                style={{
                  padding: 0,
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                View all members <ArrowRightOutlined style={{ fontSize: 11 }} />
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* QUICK ACTIONS SECTION */}
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 650, color: 'var(--text-primary)', marginBottom: 16 }}>
          Quick Actions
        </div>

        <Row gutter={[16, 16]}>
          {/* Action 1: Member Check-in */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/owner/checkin')}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              styles={{ body: { padding: '16px 18px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-purple-bg)',
                      color: 'var(--color-purple)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <ScanOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Member Check-in
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Scan QR or check-in member manually
                    </div>
                  </div>
                </div>
                <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }} />
              </div>
            </Card>
          </Col>

          {/* Action 2: New Walk-in Booking */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/owner/bookings?action=walkin')}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              styles={{ body: { padding: '16px 18px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-primary-bg)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <PlusOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      New Walk-in Booking
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Create pass or session for visitor
                    </div>
                  </div>
                </div>
                <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }} />
              </div>
            </Card>
          </Col>

          {/* Action 3: New Walk-in Member */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/owner/members?action=walkin')}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              styles={{ body: { padding: '16px 18px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'rgba(114, 46, 209, 0.12)',
                      color: '#722ed1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <UsergroupAddOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      New Walk-in Member
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Register offline walk-in member
                    </div>
                  </div>
                </div>
                <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }} />
              </div>
            </Card>
          </Col>

          {/* Action 4: Add Employee */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/owner/employees')}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              styles={{ body: { padding: '16px 18px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-success-bg)',
                      color: 'var(--color-success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <UserAddOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Add Employee
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Add new employee to your gym
                    </div>
                  </div>
                </div>
                <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }} />
              </div>
            </Card>
          </Col>

          {/* Action 3: Mark Attendance */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/owner/employees')}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              styles={{ body: { padding: '16px 18px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-warning-bg)',
                      color: 'var(--color-warning)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <CalendarOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Mark Attendance
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Mark attendance for your employees
                    </div>
                  </div>
                </div>
                <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }} />
              </div>
            </Card>
          </Col>

          {/* Action 4: Gym Profile */}
          <Col xs={24} sm={12} lg={6}>
            <Card
              hoverable
              onClick={() => navigate('/owner/settings')}
              style={{
                backgroundColor: 'var(--bg-surface-elevated)',
                borderColor: 'var(--border-color)',
                borderRadius: 'var(--radius-base)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              styles={{ body: { padding: '16px 18px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      backgroundColor: 'var(--color-info-bg)',
                      color: 'var(--color-info)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <SettingOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Gym Profile
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      Configure gym details and settings
                    </div>
                  </div>
                </div>
                <ArrowRightOutlined style={{ color: 'var(--text-secondary)', fontSize: 13, marginLeft: 8 }} />
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* CUSTOM DATE RANGE MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: 'var(--color-primary)' }} />
            <span>Select Custom Date Range</span>
          </div>
        }
        open={isCustomDateModalOpen}
        onCancel={() => {
          setIsCustomDateModalOpen(false);
          setTempCustomRange(null);
        }}
        onOk={() => {
          if (tempCustomRange && tempCustomRange.length === 2 && tempCustomRange[0] && tempCustomRange[1]) {
            const startObj = tempCustomRange[0];
            const endObj = tempCustomRange[1];
            const startFormatted = startObj.format ? startObj.format('DD MMM YYYY') : String(startObj);
            const endFormatted = endObj.format ? endObj.format('DD MMM YYYY') : String(endObj);
            const startIso = startObj.toISOString ? startObj.toISOString() : (startObj.format ? startObj.format('YYYY-MM-DD') : String(startObj));
            const endIso = endObj.toISOString ? endObj.toISOString() : (endObj.format ? endObj.format('YYYY-MM-DD') : String(endObj));

            setCustomDateRange({ startDate: startIso, endDate: endIso });
            setSelectedDate(`${startFormatted} - ${endFormatted}`);
            setIsCustomDateModalOpen(false);
            message.success(`Overview filtered for: ${startFormatted} - ${endFormatted}`);
          } else {
            message.warning('Please select a start and end date');
          }
        }}
        okText="Apply Filter"
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ padding: '16px 0' }}>
          <Paragraph style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13, marginBottom: 16 }}>
            Choose a date range to filter overview analytics, revenue, and check-ins:
          </Paragraph>
          <DatePicker.RangePicker
            style={{ width: '100%', height: 42 }}
            onChange={(dates) => setTempCustomRange(dates)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
