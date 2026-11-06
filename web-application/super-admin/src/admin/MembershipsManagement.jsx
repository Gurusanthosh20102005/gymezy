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
  Dropdown,
  DatePicker,
  Avatar,
  Divider,
  Spin,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  MoreOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ShopOutlined,
  PhoneOutlined,
  CreditCardOutlined,
  IdcardOutlined,
  UserOutlined,
  SyncOutlined,
  StopOutlined,
  CopyOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/apiClient';
import { gymService } from '../services/gymService';
import { ExportModal } from '../general/components/ExportModal';
import { downloadCSV, getDefaultExportFileName } from '../utils/exportHelper';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Text } = Typography;

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

export const MembershipsManagement = () => {
  const { isDarkMode } = useTheme();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || 'active';

  // Data & Loading States
  const [memberships, setMemberships] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    expiringSoon: 0,
    expired: 0,
    switched: 0,
    cancelled: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic Gyms Dropdown with Infinite Scroll & Search
  const [gymsList, setGymsList] = useState([]);
  const [gymPage, setGymPage] = useState(1);
  const [gymsHasMore, setGymsHasMore] = useState(true);
  const [gymsLoading, setGymsLoading] = useState(false);
  const [gymSearchText, setGymSearchText] = useState('');

  // Filter & Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [gymFilter, setGymFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState(
    ['active', 'expiring', 'switched_cancelled'].includes(urlTab) ? urlTab : 'active'
  );

  useEffect(() => {
    if (urlTab && ['active', 'expiring', 'switched_cancelled'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Modal State
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Gyms Options from separate dedicated API
  const fetchGymOptions = useCallback(async (pageToFetch = 1, search = '', append = false) => {
    setGymsLoading(true);
    try {
      const payload = await gymService.getGymOptions({
        page: pageToFetch,
        limit: 15,
        search: search.trim() || undefined,
      });
      const newGyms = payload.gyms || [];
      setGymsList((prev) => (append ? [...prev, ...newGyms] : newGyms));
      setGymPage(payload.page || pageToFetch);
      setGymsHasMore(Boolean(payload.hasMore));
    } catch (err) {
      console.warn('Failed to load gym options:', err);
    } finally {
      setGymsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGymOptions(1, '', false);
  }, [fetchGymOptions]);

  const handleGymSearch = (value) => {
    setGymSearchText(value);
    void fetchGymOptions(1, value, false);
  };

  const handleGymPopupScroll = (e) => {
    const { target } = e;
    if (target.scrollTop + target.offsetHeight >= target.scrollHeight - 15) {
      if (gymsHasMore && !gymsLoading) {
        void fetchGymOptions(gymPage + 1, gymSearchText, true);
      }
    }
  };

  // Fetch Memberships from Backend API
  const fetchMemberships = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (gymFilter !== 'All') {
        params.gymId = gymFilter;
      }
      if (tierFilter !== 'All') {
        params.tier = tierFilter;
      }

      // Handle Tab/Status Filter
      if (activeTab === 'active') {
        params.status = 'Active';
      } else if (activeTab === 'expiring') {
        params.status = 'Expiring Soon';
      } else if (activeTab === 'switched_cancelled') {
        params.status = 'Switched';
      } else if (statusFilter !== 'All') {
        params.status = statusFilter;
      }

      const res = await apiClient.get('/admin/memberships', { params });
      const payload = res.data?.data || {};

      setMemberships(payload.memberships || []);
      setTotalCount(payload.total || 0);
      if (payload.summary) {
        setSummary(payload.summary);
      }
    } catch (err) {
      console.error('Failed to load super admin memberships:', err);
      message.error(err.response?.data?.message || 'Failed to load memberships.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, gymFilter, tierFilter, statusFilter, activeTab]);

  useEffect(() => {
    void fetchMemberships();
  }, [fetchMemberships]);

  const getGymLocationText = (gym) => {
    if (!gym) return 'Chennai';
    if (typeof gym.address === 'string' && gym.address.trim()) return gym.address;
    if (gym.address?.city) return gym.address.city;
    if (gym.address?.street) return gym.address.street;
    if (typeof gym.city === 'string' && gym.city.trim()) return gym.city;
    if (typeof gym.location === 'string' && gym.location.trim()) return gym.location;
    return 'Chennai';
  };

  const handleOpenDetails = (record) => {
    setSelectedMembership(record);
    setIsModalOpen(true);
  };

  const handleCopyId = (id) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(id);
      message.success(`Copied Membership ID: ${id}`);
    }
  };

  // Server-Side Export Modal & Execution
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleOpenExportModal = () => {
    setIsExportModalOpen(true);
  };

  const executeExport = async ({ fileName, scope, dateRange }) => {
    setIsExporting(true);
    try {
      const params = {
        export: true,
        limit: 0,
        page: 1,
      };

      if (scope === 'filtered') {
        if (gymFilter !== 'All') params.gymId = gymFilter;
        if (statusFilter !== 'All') params.status = statusFilter;
        if (tierFilter !== 'All') params.tier = tierFilter;
        if (typeFilter !== 'all') params.type = typeFilter;
        if (searchQuery.trim()) params.search = searchQuery.trim();
      } else if (scope === 'custom' && dateRange) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }

      const res = await apiClient.get('/admin/memberships', { params });
      const list = res.data?.data?.memberships || [];
      if (list.length === 0) {
        message.warning('No membership records found matching the requested scope.');
        return;
      }

      const headers = [
        'Membership ID',
        'Customer Name',
        'Phone Number',
        'Email Address',
        'Gym ID',
        'Gym Name',
        'City',
        'Plan Tier',
        'Start Date',
        'Expiry Date',
        'Status',
        'Amount (INR)',
      ];

      const rows = list.map((m) => [
        m.membershipId || '',
        m.userId?.fullName || 'Member',
        m.userId?.phone || '',
        m.userId?.email || '',
        m.gymId?.partnerId || '',
        m.gymId?.name || '',
        getGymLocationText(m.gymId),
        m.membershipTier || '',
        m.startDate ? new Date(m.startDate).toLocaleDateString('en-GB') : '',
        m.endDate ? new Date(m.endDate).toLocaleDateString('en-GB') : '',
        m.status || '',
        m.pricing?.totalAmount || 0,
      ]);

      downloadCSV(fileName, headers, rows);
      message.success(`Successfully exported ${list.length} membership records to ${fileName}.csv`);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Export memberships failed:', err);
      message.error(err.message || 'Failed to export membership records');
    } finally {
      setIsExporting(false);
    }
  };

  const getActionMenu = (record) => ({
    items: [
      {
        key: 'view',
        label: 'View Full Details',
        icon: <EyeOutlined />,
        onClick: () => handleOpenDetails(record),
      },
      {
        key: 'copy',
        label: 'Copy Membership ID',
        icon: <CopyOutlined />,
        onClick: () => handleCopyId(record.membershipId),
      },
      {
        key: 'invoice',
        label: 'Download Invoice',
        icon: <DownloadOutlined />,
        onClick: () => message.success(`Invoice for ${record.membershipId} downloaded.`),
      },
    ],
  });

  const columns = [
    {
      title: 'Membership ID',
      dataIndex: 'membershipId',
      key: 'membershipId',
      width: 130,
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title="Click to view details">
          <span
            onClick={() => handleOpenDetails(record)}
            style={{
              fontWeight: 750,
              color: '#4f46e5',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {text || 'N/A'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Customer Name',
      key: 'customerName',
      width: 170,
      ellipsis: true,
      render: (_, record) => {
        const u = record.userId || {};
        const avatarUrl = u.avatar || u.profilePicture;
        const name = u.fullName || 'Member';
        const hasPic = hasValidProfilePic(avatarUrl);

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Avatar
              src={hasPic ? avatarUrl : undefined}
              icon={!hasPic ? <UserOutlined style={{ fontSize: 15 }} /> : undefined}
              style={{
                backgroundColor: isDarkMode ? '#1e1b4b' : '#ede9fe',
                color: '#6366f1',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              size={30}
            />
            <Tooltip title={name}>
              <span
                style={{
                  fontWeight: 650,
                  fontSize: 13,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'block',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {name}
              </span>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: 'Customer Phone Number',
      key: 'customerPhone',
      width: 160,
      ellipsis: true,
      render: (_, record) => {
        const phone = record.userId?.phone || record.userId?.email || 'N/A';
        return (
          <Tooltip title={phone}>
            <span
              style={{
                fontSize: 13,
                color: isDarkMode ? '#cbd5e1' : '#334155',
                fontWeight: 500,
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {phone}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Gym ID',
      key: 'gymId',
      width: 110,
      ellipsis: true,
      render: (_, record) => {
        const g = record.gymId || {};
        const gymIdDisplay = g.partnerId || g.id || (g._id ? `GYM-${String(g._id).slice(-4).toUpperCase()}` : 'N/A');
        return (
          <Tooltip title={gymIdDisplay}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 750,
                color: '#4f46e5',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {gymIdDisplay}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Gym Name',
      key: 'gymName',
      width: 180,
      ellipsis: true,
      render: (_, record) => {
        const g = record.gymId || {};
        const gymName = g.name || 'Gym Center';
        return (
          <Tooltip title={gymName}>
            <span
              style={{
                fontWeight: 650,
                fontSize: 13,
                color: isDarkMode ? '#ffffff' : '#0f172a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {gymName}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Membership Plan',
      key: 'plan',
      width: 155,
      ellipsis: true,
      render: (_, record) => {
        const tier = (record.membershipTier || 'Standard').replace(/\s*\(\d+\s*Days\)/gi, '').trim();
        return (
          <Tooltip title={tier}>
            <span
              style={{
                color: '#6366f1',
                fontWeight: 650,
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {tier}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Start Date',
      key: 'startDate',
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        const dateStr = record.startDate
          ? new Date(record.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'N/A';
        return (
          <Tooltip title={dateStr}>
            <span
              style={{
                fontSize: 12.5,
                color: isDarkMode ? '#cbd5e1' : '#334155',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {dateStr}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Expiry Date',
      key: 'expiryDate',
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        const dateStr = record.endDate
          ? new Date(record.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'N/A';
        return (
          <Tooltip title={dateStr}>
            <span
              style={{
                fontSize: 12.5,
                color: isDarkMode ? '#cbd5e1' : '#334155',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {dateStr}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Days Left',
      key: 'daysLeft',
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        if (!record.endDate) return <span style={{ color: '#94a3b8' }}>N/A</span>;
        const end = new Date(record.endDate);
        const daysLeft = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
        const isExpired = daysLeft <= 0 || record.status === 'Expired';
        const label = isExpired ? 'Expired' : `${daysLeft} days left`;
        return (
          <Tooltip title={label}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: isExpired ? '#ef4444' : daysLeft <= 15 ? '#f59e0b' : '#10b981',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {label}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 110,
      ellipsis: true,
      render: (_, record) => {
        const totalAmount = record.pricing?.totalAmount || 0;
        const amtStr = `₹${totalAmount.toLocaleString('en-IN')}`;
        return (
          <Tooltip title={amtStr}>
            <span
              style={{
                fontWeight: 750,
                color: isDarkMode ? '#ffffff' : '#0f172a',
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {amtStr}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Payment Method',
      key: 'paymentMethod',
      width: 130,
      ellipsis: true,
      render: (_, record) => {
        const method = record.payment?.method || 'Online (UPI)';
        return (
          <Tooltip title={method}>
            <span
              style={{
                fontWeight: 500,
                fontSize: 12.5,
                color: isDarkMode ? '#cbd5e1' : '#475569',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
              }}
            >
              {method}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      ellipsis: true,
      render: (st) => {
        let color = '#64748b';
        let icon = null;

        if (st === 'Active') {
          color = '#10b981';
          icon = <CheckCircleOutlined />;
        } else if (st === 'Expiring Soon') {
          color = '#f59e0b';
          icon = <ClockCircleOutlined />;
        } else if (st === 'Switched') {
          color = '#6366f1';
          icon = <SyncOutlined />;
        } else if (st === 'Expired') {
          color = '#ef4444';
          icon = <CloseCircleOutlined />;
        } else if (st === 'Cancelled') {
          color = '#64748b';
          icon = <StopOutlined />;
        }

        const label = st || 'Active';

        return (
          <Tooltip title={label}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: color,
                fontWeight: 650,
                fontSize: 12.5,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              <span style={{ flexShrink: 0 }}>{icon}</span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Button
            size="small"
            onClick={() => handleOpenDetails(record)}
            style={{
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 650,
              color: '#4f46e5',
              borderColor: isDarkMode ? '#3730a3' : '#c7d2fe',
              backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.1)' : '#f5f3ff',
            }}
          >
            View
          </Button>
          <Dropdown menu={getActionMenu(record)} trigger={['click']} placement="bottomRight">
            <Button
              type="text"
              size="small"
              icon={<MoreOutlined style={{ fontSize: 16, color: isDarkMode ? '#888888' : '#64748b' }} />}
            />
          </Dropdown>
        </div>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1340, margin: '0 auto' }}>
      {/* 1. TOP 6 METRIC CARDS */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Total Memberships */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <IdcardOutlined style={{ fontSize: 22, color: '#6366f1', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Memberships
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {summary.total.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                  All Gyms
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Active Memberships */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircleOutlined style={{ fontSize: 22, color: '#10b981', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Active Members
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {summary.active.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                  {summary.total > 0 ? `${Math.round((summary.active / summary.total) * 100)}% active` : '0%'}
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Expiring Soon */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ClockCircleOutlined style={{ fontSize: 22, color: '#f59e0b', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Expiring Soon
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', lineHeight: 1.2, margin: '2px 0' }}>
                  {summary.expiringSoon.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
                  Next 30 Days
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Expired Memberships */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CloseCircleOutlined style={{ fontSize: 22, color: '#ef4444', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Expired
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {summary.expired.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                  Needs Renewal
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Switched Plans */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <SyncOutlined style={{ fontSize: 22, color: '#6366f1', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Plan Switched
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {summary.switched.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                  Prorated
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Cancelled */}
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StopOutlined style={{ fontSize: 22, color: '#64748b', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Cancelled
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {summary.cancelled.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                  Terminated
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2. FILTER CONTROLS */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 20,
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Filters on Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
            <Input
              placeholder="Search by customer, membership ID, phone, gym..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 280, borderRadius: 'var(--radius-base)' }}
              allowClear
            />

            {/* Dynamic Gyms Selector with Infinite Scroll & Search */}
            <Select
              showSearch
              filterOption={false}
              value={gymFilter}
              onChange={(val) => {
                setGymFilter(val);
                setCurrentPage(1);
              }}
              onSearch={handleGymSearch}
              onPopupScroll={handleGymPopupScroll}
              placeholder="All Gyms"
              notFoundContent={
                gymsLoading ? (
                  <div style={{ padding: 8, textAlign: 'center' }}>
                    <Spin size="small" />
                  </div>
                ) : null
              }
              dropdownRender={(menu) => (
                <>
                  {menu}
                  {gymsLoading && (
                    <div style={{ textAlign: 'center', padding: '6px 0', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <Spin size="small" />
                    </div>
                  )}
                </>
              )}
              style={{ width: 220 }}
            >
              <Option value="All">All Gyms</Option>
              {gymsList.map((g) => (
                <Option key={g._id || g.partnerId} value={g._id || g.partnerId}>
                  {g.name} {g.area ? `(${g.area})` : ''}
                </Option>
              ))}
            </Select>

            {/* Plan Tier Filter */}
            <Select
              value={tierFilter}
              onChange={(val) => {
                setTierFilter(val);
                setCurrentPage(1);
              }}
              style={{ width: 140 }}
            >
              <Option value="All">All Plans</Option>
              <Option value="Monthly">Monthly</Option>
              <Option value="Quarterly">Quarterly</Option>
              <Option value="Half-Yearly">Half-Yearly</Option>
              <Option value="Annual">Annual</Option>
            </Select>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              style={{ width: 140 }}
            >
              <Option value="All">All Status</Option>
              <Option value="Active">Active</Option>
              <Option value="Expiring Soon">Expiring Soon</Option>
              <Option value="Switched">Switched</Option>
              <Option value="Expired">Expired</Option>
              <Option value="Cancelled">Cancelled</Option>
            </Select>

            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchQuery('');
                setGymFilter('All');
                setTierFilter('All');
                setStatusFilter('All');
                setActiveTab('active');
                setCurrentPage(1);
                setGymSearchText('');
                void fetchGymOptions(1, '', false);
              }}
              style={{ borderRadius: 'var(--radius-base)' }}
            >
              Reset
            </Button>
          </div>

          {/* Export on Right */}
          <Button
            icon={<DownloadOutlined />}
            onClick={handleOpenExportModal}
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

      {/* 4. MEMBERSHIPS TABLE */}
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
          dataSource={memberships}
          loading={isLoading}
          pagination={false}
          rowKey={(r) => r._id || r.membershipId}
          scroll={{ x: 1600 }}
        />
      </Card>

      {/* 5. SERVER-SIDE PAGINATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
          Showing {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(currentPage * pageSize, totalCount)} of {totalCount} memberships
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Pagination
            current={currentPage}
            total={totalCount}
            pageSize={pageSize}
            onChange={(page) => setCurrentPage(page)}
            showSizeChanger={false}
          />
          <Select
            value={pageSize}
            onChange={(val) => {
              setPageSize(val);
              setCurrentPage(1);
            }}
            style={{ width: 110 }}
          >
            <Option value={10}>10 / page</Option>
            <Option value={25}>25 / page</Option>
            <Option value={50}>50 / page</Option>
          </Select>
        </div>
      </div>

      {/* -------------------------------------------------------------
          MEMBERSHIP DETAILS POPUP MODAL
         ------------------------------------------------------------- */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800 }}>
            <IdcardOutlined style={{ color: '#4f46e5' }} />
            <span>Membership Details</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => handleCopyId(selectedMembership?.membershipId)}>
            Copy ID
          </Button>,
          <Button key="close" type="primary" style={{ backgroundColor: '#4f46e5' }} onClick={() => setIsModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={680}
        centered
      >
        {selectedMembership && (
          <div style={{ padding: '8px 0' }}>
            {/* Header Member Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <Avatar
                src={hasValidProfilePic(selectedMembership.userId?.avatar || selectedMembership.userId?.profilePicture) ? (selectedMembership.userId?.avatar || selectedMembership.userId?.profilePicture) : undefined}
                icon={!hasValidProfilePic(selectedMembership.userId?.avatar || selectedMembership.userId?.profilePicture) ? <UserOutlined style={{ fontSize: 28 }} /> : undefined}
                size={58}
                style={{
                  backgroundColor: isDarkMode ? '#1e1b4b' : '#ede9fe',
                  color: '#6366f1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 750, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedMembership.userId?.fullName || 'Gym Member'}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', gap: 12, marginTop: 3 }}>
                  <span><PhoneOutlined /> {selectedMembership.userId?.phone || 'N/A'}</span>
                  <span>{selectedMembership.userId?.email || ''}</span>
                </div>
              </div>
            </div>

            <Divider style={{ margin: '12px 0' }} />

            {/* Grid Information */}
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Membership ID</div>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>
                  {selectedMembership.membershipId}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Status</div>
                <Tag color={selectedMembership.status === 'Active' ? 'green' : 'orange'} style={{ fontWeight: 650, marginTop: 2 }}>
                  {selectedMembership.status}
                </Tag>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Gym Center</div>
                <div style={{ fontSize: 14, fontWeight: 650, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>{selectedMembership.gymId?.name || 'N/A'}</span>
                  {selectedMembership.gymId?.partnerId && (
                    <Tag
                      style={{
                        backgroundColor: '#eef2ff',
                        color: '#4f46e5',
                        border: 'none',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        fontSize: 11,
                      }}
                    >
                      {selectedMembership.gymId.partnerId}
                    </Tag>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#888888' }}>
                  {getGymLocationText(selectedMembership.gymId)}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Membership Tier</div>
                <div style={{ fontSize: 14, fontWeight: 650 }}>
                  {selectedMembership.membershipTier}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Start Date</div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {selectedMembership.startDate ? new Date(selectedMembership.startDate).toLocaleDateString('en-GB') : 'N/A'}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Expiry Date</div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {selectedMembership.endDate ? new Date(selectedMembership.endDate).toLocaleDateString('en-GB') : 'N/A'}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Amount Paid</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>
                  ₹{(selectedMembership.pricing?.totalAmount || 0).toLocaleString('en-IN')}
                </div>
              </Col>
              <Col span={12}>
                <div style={{ fontSize: 12, color: '#888888' }}>Payment Method</div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  {selectedMembership.payment?.method || 'Online (UPI)'}
                </div>
              </Col>
              {selectedMembership.trainerId && (
                <Col span={24}>
                  <div style={{ fontSize: 12, color: '#888888' }}>Assigned Trainer</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {typeof selectedMembership.trainerId === 'string'
                      ? selectedMembership.trainerId
                      : `${selectedMembership.trainerId.name || 'Trainer'} (${selectedMembership.trainerId.specialty || 'General Trainer'})`}
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>

      {/* Universal Server-Side Export Dialog */}
      <ExportModal
        open={isExportModalOpen}
        onCancel={() => setIsExportModalOpen(false)}
        title="Export Memberships Fleet"
        defaultFileName={getDefaultExportFileName('Memberships')}
        totalAvailable={totalRecords}
        onExport={executeExport}
        loading={isExporting}
      />
    </div>
  );
};

export default MembershipsManagement;
