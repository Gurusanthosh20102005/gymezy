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
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { recordCheckIn, recordCheckOut } from '../redux/slices/gymSlice';
import { apiClient } from '../services/apiClient';

const { Title, Text, Paragraph } = Typography;

export const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isDarkMode } = useTheme();

  const { user } = useSelector((state) => state.auth || {});
  const { liveOccupancy, capacity, members, checkIns, bookings, gymProfile } = useSelector((state) => state.gym);

  // Scoped gym partner identity
  const activeGym = user?.gym || gymProfile || {};
  const gymId = activeGym._id || activeGym.id || user?.gymId?._id || user?.gymId || user?.partnerId || 'me';

  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [quickOtp, setQuickOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [selectedDate, setSelectedDate] = useState('Today');
  const [isCustomDateModalOpen, setIsCustomDateModalOpen] = useState(false);
  const [tempCustomRange, setTempCustomRange] = useState(null);

  const fetchDashboardStats = useCallback(async () => {
    if (!gymId) return;
    setLoadingStats(true);
    try {
      const res = await apiClient.get(`/gyms/${gymId}/dashboard-stats`, {
        params: { range: selectedDate },
      });
      if (res?.data?.data) {
        setDashboardStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load gym dashboard statistics:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [gymId, selectedDate]);

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
            style={{ backgroundColor: '#1677ff', fontWeight: 700 }}
          >
            {text.charAt(0)}
          </Avatar>
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

  const dateFilterMenu = {
    items: [
      { key: 'today', label: 'Today', onClick: () => setSelectedDate('Today') },
      { key: 'yesterday', label: 'Yesterday', onClick: () => setSelectedDate('Yesterday') },
      { key: 'this_week', label: 'This Week', onClick: () => setSelectedDate('This Week') },
      { key: 'this_month', label: 'This Month', onClick: () => setSelectedDate('This Month') },
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
                  ₹{Number(dashboardStats?.metrics?.totalRevenue ?? gymProfile?.monthlyRevenue ?? 0).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Monthly GMV
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
                  ₹{Number(dashboardStats?.metrics?.memberRevenue ?? (members || []).reduce((acc, m) => acc + (parseInt(String(m.amount || '').replace(/[^\d]/g, ''), 10) || 0), 0)).toLocaleString('en-IN')}
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
                  ₹{Number(dashboardStats?.metrics?.appBookingRevenue ?? (checkIns || []).reduce((acc, b) => acc + (Number(b.price) || 0), 0)).toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Day Passes & Group Classes
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 4. Total Active Users */}
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
                  Active App Customers
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 5. Members */}
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
                  Members
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                  {dashboardStats?.metrics?.activeMembersCount ?? (members || []).length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Active Gym Passes
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* 6. App Booking Number */}
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
                  backgroundColor: 'var(--color-danger-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-danger)',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                <MobileOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Completed Sessions
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0' }}>
                  {dashboardStats?.metrics?.completedBookingsCount ?? (checkIns || []).length}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Classes & Session Passes
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
                  render: (text, record) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar src={record.avatar} size={36} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                          {text}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                          {record.phone}
                        </div>
                      </div>
                    </div>
                  ),
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
                  render: (type) => (
                    <Tag
                      style={{
                        backgroundColor: type === 'App Booking' ? 'var(--color-purple-bg)' : 'var(--color-success-bg)',
                        color: type === 'App Booking' ? 'var(--color-purple)' : 'var(--color-success)',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 11,
                        padding: '1px 8px',
                      }}
                    >
                      {type}
                    </Tag>
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
                  render: (text, record) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar src={record.avatar} size={36} />
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                        {text}
                      </span>
                    </div>
                  ),
                },
                {
                  title: 'Membership Type',
                  dataIndex: 'plan',
                  key: 'plan',
                  render: (plan) => (
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {plan}
                    </span>
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

          {/* Action 2: Add Employee */}
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
            const startStr = tempCustomRange[0].format ? tempCustomRange[0].format('DD MMM YYYY') : String(tempCustomRange[0]);
            const endStr = tempCustomRange[1].format ? tempCustomRange[1].format('DD MMM YYYY') : String(tempCustomRange[1]);
            setSelectedDate(`${startStr} - ${endStr}`);
            setIsCustomDateModalOpen(false);
            message.success(`Overview filtered for: ${startStr} - ${endStr}`);
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
