import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Modal,
  Pagination,
  Space,
  message,
  Dropdown,
  Radio,
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  MoreOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  WalletOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  DollarOutlined,
  CreditCardOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/apiClient';
import { ExportModal } from '../general/components/ExportModal';
import { downloadCSV, getDefaultExportFileName } from '../utils/exportHelper';

const { Option } = Select;

export const SubscriptionsManagement = () => {
  const { isDarkMode } = useTheme();

  // Live Partner Gym Subscriptions State from Middleware API
  const [partners, setPartners] = useState([]);
  const [kpis, setKpis] = useState({
    totalPartners: 0,
    activeSubscriptions: 0,
    activeRate: '0.0',
    expiringSoon: 0,
    cancelled: 0,
    hybridCount: 0,
    appOnlyCount: 0,
    gmsCount: 0,
    listingCount: 0,
    mrr: 0,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    pages: 1,
    didYouMean: null,
  });
  const [isLoadingPartners, setIsLoadingPartners] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected Partner for details modal
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Modals State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedPlanOption, setSelectedPlanOption] = useState('Hybrid');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Debounce search input (280ms) to prevent unnecessary network roundtrips
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset pagination to page 1 on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, typeFilter, periodFilter, statusFilter]);

  // Fetch partner subscriptions from middleware API
  const fetchPartnerSubscriptions = useCallback(async () => {
    setIsLoadingPartners(true);
    try {
      const res = await apiClient.get('/admin/subscriptions', {
        params: {
          search: debouncedSearch.trim() || undefined,
          typeFilter: typeFilter !== 'all' ? typeFilter : undefined,
          statusFilter: statusFilter !== 'all' ? statusFilter : undefined,
          periodFilter: periodFilter !== 'all' ? periodFilter : undefined,
          page: currentPage,
          limit: pageSize,
        },
      });
      const data = res.data?.data;
      if (data) {
        setPartners(data.partners || []);
        if (data.kpis) setKpis(data.kpis);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.warn('Failed to fetch partner subscriptions:', err);
      message.error(err.response?.data?.message || err.message || 'Failed to load subscriptions');
    } finally {
      setIsLoadingPartners(false);
    }
  }, [debouncedSearch, typeFilter, periodFilter, statusFilter, currentPage, pageSize]);

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
        if (typeFilter !== 'all') params.typeFilter = typeFilter;
        if (statusFilter !== 'all') params.statusFilter = statusFilter;
        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      } else if (scope === 'custom' && dateRange) {
        params.startDate = dateRange[0].toISOString();
        params.endDate = dateRange[1].toISOString();
      }

      const res = await apiClient.get('/admin/subscriptions', { params });
      const list = res.data?.data?.partners || [];
      if (list.length === 0) {
        message.warning('No subscription records found matching the requested scope.');
        return;
      }

      const headers = [
        'Partner ID',
        'Gym Name',
        'Location',
        'Subscription Plan',
        'Billing Period',
        'Status',
        'Fee / Rate (INR)',
        'Auto Renewal',
        'Next Billing Date',
      ];

      const rows = list.map((p) => [
        p.gymId || p.partnerId || '',
        p.name || '',
        p.location || '',
        p.plan || '',
        p.billingPeriod || '',
        p.status || '',
        p.price || '',
        p.autoRenewal ? 'Yes' : 'No',
        p.nextBilling || '—',
      ]);

      downloadCSV(fileName, headers, rows);
      message.success(`Successfully exported ${list.length} subscription records to ${fileName}.csv`);
      setIsExportModalOpen(false);
    } catch (err) {
      console.error('Export subscriptions failed:', err);
      message.error(err.message || 'Failed to export subscription records');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    void fetchPartnerSubscriptions();
  }, [fetchPartnerSubscriptions]);

  // Modal Handlers calling live Middleware API
  const handleConfirmUpgrade = async () => {
    if (!selectedPartner?.id) return;
    setIsSubmittingAction(true);
    try {
      await apiClient.patch(`/admin/subscriptions/${selectedPartner.id}`, {
        action: 'UPGRADE',
        subscriptionType: selectedPlanOption,
      });
      message.success(`Upgraded ${selectedPartner?.gymName} to ${selectedPlanOption} tier successfully!`);
      setIsUpgradeModalOpen(false);
      void fetchPartnerSubscriptions();
    } catch (err) {
      console.error('Failed to upgrade subscription:', err);
      message.error(err.response?.data?.message || 'Failed to upgrade subscription');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!selectedPartner?.id) return;
    setIsSubmittingAction(true);
    try {
      await apiClient.patch(`/admin/subscriptions/${selectedPartner.id}`, {
        action: 'DOWNGRADE',
        subscriptionType: selectedPlanOption,
      });
      message.warning(`Downgraded ${selectedPartner?.gymName} to ${selectedPlanOption} tier.`);
      setIsDowngradeModalOpen(false);
      void fetchPartnerSubscriptions();
    } catch (err) {
      console.error('Failed to downgrade subscription:', err);
      message.error(err.response?.data?.message || 'Failed to downgrade subscription');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!selectedPartner?.id) return;
    setIsSubmittingAction(true);
    try {
      await apiClient.patch(`/admin/subscriptions/${selectedPartner.id}`, {
        action: 'CANCEL',
      });
      message.error(`Subscription for ${selectedPartner?.gymName} cancelled.`);
      setIsCancelModalOpen(false);
      void fetchPartnerSubscriptions();
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      message.error(err.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle View
  const handleView = (record) => {
    setSelectedPartner(record);
    setIsDetailsModalOpen(true);
  };

  // Handle Action Dropdown
  const getActionMenu = (record) => ({
    items: [
      {
        key: 'view',
        icon: <EyeOutlined />,
        label: 'View Subscription',
        onClick: () => handleView(record),
      },
      {
        key: 'upgrade',
        icon: <ArrowUpOutlined style={{ color: '#22c55e' }} />,
        label: 'Upgrade Plan',
        onClick: () => {
          setSelectedPartner(record);
          setIsUpgradeModalOpen(true);
        },
      },
      {
        key: 'cancel',
        icon: <CloseCircleOutlined style={{ color: '#ef4444' }} />,
        label: <span style={{ color: '#ef4444' }}>Cancel Subscription</span>,
        onClick: () => {
          setSelectedPartner(record);
          setIsCancelModalOpen(true);
        },
      },
    ],
  });

  // Helper for Subscription Type Tag
  const renderTypeTag = (type) => {
    let bg = isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#ede9fe';
    let color = '#6366f1';
    if (type === 'App Only') {
      bg = isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#edf4fe';
      color = '#3b82f6';
    } else if (type === 'GMS') {
      bg = isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef4e8';
      color = '#d97706';
    } else if (type === 'Listing Only') {
      bg = isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef';
      color = '#00bf62';
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
        {type}
      </span>
    );
  };

  // Helper for Status Tag
  const renderStatusTag = (status) => {
    let bg = isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef';
    let color = '#00bf62';
    if (status === 'Expiring Soon') {
      bg = isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef4e8';
      color = '#d97706';
    } else if (status === 'Cancelled') {
      bg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed';
      color = '#e11d48';
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
        {status}
      </span>
    );
  };

  // Table Columns
  const columns = [
    {
      title: 'Partner / Gym Name',
      key: 'gymName',
      width: 240,
      render: (_, record) => (
        <div
          onClick={() => handleView(record)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 6,
              backgroundColor: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {record.logoText}
          </div>
          <div>
            <div style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 13 }}>
              {record.gymName}
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <EnvironmentOutlined style={{ fontSize: 10, color: '#6366f1' }} />
              <span>{record.gymLocation}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Gym ID',
      dataIndex: 'gymId',
      key: 'gymId',
      width: 120,
      render: (text, record) => (
        <span
          onClick={() => handleView(record)}
          style={{ fontWeight: 700, color: '#4f46e5', letterSpacing: '0.2px', cursor: 'pointer' }}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'Subscription Type',
      dataIndex: 'subscriptionType',
      key: 'subscriptionType',
      width: 170,
      render: (type) => renderTypeTag(type),
    },
    {
      title: 'Subscription Period',
      dataIndex: 'subscriptionPeriod',
      key: 'subscriptionPeriod',
      width: 160,
      render: (text) => (
        <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155', fontSize: 13 }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 140,
      render: (text) => (
        <span style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Next Billing Date',
      dataIndex: 'nextBillingDate',
      key: 'nextBillingDate',
      width: 150,
      render: (text) => (
        <span style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => renderStatusTag(status),
    },
    {
      title: 'Action',
      key: 'action',
      width: 110,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleView(record)}
            style={{
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              fontSize: 12,
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
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* 1. TOP HEADER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 800,
              color: isDarkMode ? '#ffffff' : '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Subscriptions & Plan Governance
          </h2>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: 13,
              color: isDarkMode ? '#888888' : '#64748b',
            }}
          >
            Manage B2B gym partner SaaS tiers, billing lifecycles, and plan upgrades/downgrades.
          </p>
        </div>
      </div>

      {/* 2. TOP 5 METRIC CARDS (IN ONE LINE) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Total Partners */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
          }}
          styles={{ body: { padding: '16px 14px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TeamOutlined style={{ fontSize: 20, color: '#6366f1' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Total Partners
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {kpis.totalPartners || 0}
              </div>
              <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                All time
              </div>
            </div>
          </div>
        </Card>

        {/* Active Subscriptions */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
          }}
          styles={{ body: { padding: '16px 14px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TeamOutlined style={{ fontSize: 20, color: '#00bf62' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Active Subscriptions
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {kpis.activeSubscriptions || 0}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00bf62' }}>
                {kpis.activeRate}%
              </div>
            </div>
          </div>
        </Card>

        {/* Expiring Soon */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
          }}
          styles={{ body: { padding: '16px 14px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
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
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Expiring Soon
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {kpis.expiringSoon || 0}
              </div>
              <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{kpis.totalPartners > 0 ? ((kpis.expiringSoon / kpis.totalPartners) * 100).toFixed(2) : '0.00'}%</span>
                <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, backgroundColor: isDarkMode ? 'rgba(245,158,11,0.2)' : '#fef3c7' }}>7 days</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Cancelled */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
          }}
          styles={{ body: { padding: '16px 14px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CloseCircleOutlined style={{ fontSize: 20, color: '#ef4444' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Cancelled
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {kpis.cancelled || 0}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
                {kpis.totalPartners > 0 ? ((kpis.cancelled / kpis.totalPartners) * 100).toFixed(2) : '0.00'}%
              </div>
            </div>
          </div>
        </Card>

        {/* Total Subscription Revenue */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
          }}
          styles={{ body: { padding: '16px 14px' } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <WalletOutlined style={{ fontSize: 20, color: '#6366f1' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Total Revenue
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0', whiteSpace: 'nowrap' }}>
                ₹ {Number(kpis.mrr || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                All time
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. FULL-WIDTH PARTNERS TABLE & FILTERS */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 16,
        }}
        styles={{ body: { padding: '14px 18px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search by partner name, gym ID, area... (fuzzy typo-tolerant)"
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: 220, borderRadius: 'var(--radius-base)' }}
            allowClear
          />

          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 180 }}
          >
            <Option value="all">All Subscription Types</Option>
            <Option value="Hybrid">Hybrid (₹4,999/mo)</Option>
            <Option value="App Only">App Only (₹2,999/mo)</Option>
            <Option value="GMS">GMS (₹1,999/mo)</Option>
            <Option value="Listing Only">Listing Only (₹999/mo)</Option>
          </Select>

          <Select
            value={periodFilter}
            onChange={setPeriodFilter}
            style={{ width: 140 }}
          >
            <Option value="all">All Periods</Option>
            <Option value="Monthly">Monthly</Option>
            <Option value="Quarterly">Quarterly</Option>
            <Option value="Half Year">Half Year</Option>
            <Option value="Annual">Annual</Option>
          </Select>

          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
          >
            <Option value="all">All Status</Option>
            <Option value="Active">Active</Option>
            <Option value="Expiring Soon">Expiring Soon</Option>
            <Option value="Cancelled">Cancelled</Option>
          </Select>

          <Button
            icon={<ReloadOutlined spin={isLoadingPartners} />}
            onClick={() => void fetchPartnerSubscriptions()}
            style={{ borderRadius: 'var(--radius-base)' }}
          >
            Refresh
          </Button>

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

      {/* "Did You Mean" Suggestion Banner */}
      {pagination.didYouMean && (
        <div
          style={{
            padding: '10px 16px',
            marginBottom: 14,
            borderRadius: 'var(--radius-base)',
            backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.12)' : '#eef2ff',
            border: `1px solid ${isDarkMode ? 'rgba(99, 102, 241, 0.3)' : '#c7d2fe'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: isDarkMode ? '#cbd5e1' : '#334155',
          }}
        >
          <span>
            Did you mean <strong style={{ color: '#4f46e5' }}>"{pagination.didYouMean}"</strong>? Showing closest matching partner gym subscriptions.
          </span>
          <Button
            type="link"
            size="small"
            onClick={() => setSearchQuery(pagination.didYouMean)}
            style={{ padding: 0, fontWeight: 700, color: '#4f46e5' }}
          >
            Search "{pagination.didYouMean}" instead
          </Button>
        </div>
      )}

      {/* Table */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 16,
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={partners}
          loading={isLoadingPartners}
          pagination={false}
          rowKey={(record) => record.id || record.gymId || record.key}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
          Showing {pagination.total > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, pagination.total || 0)} of {pagination.total || 0} partner subscriptions
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Pagination
            current={currentPage}
            total={pagination.total || 0}
            pageSize={pageSize}
            onChange={(newPage, newPageSize) => {
              setCurrentPage(newPage);
              if (newPageSize && newPageSize !== pageSize) {
                setPageSize(newPageSize);
                setCurrentPage(1);
              }
            }}
            showSizeChanger={false}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
            <span>Rows per page:</span>
            <Select
              value={pageSize}
              onChange={(val) => {
                setPageSize(val);
                setCurrentPage(1);
              }}
              style={{ width: 75 }}
              size="small"
            >
              <Option value={10}>10</Option>
              <Option value={25}>25</Option>
              <Option value={50}>50</Option>
            </Select>
          </div>
        </div>
      </div>

      {/* 4. PARTNER / SUBSCRIPTION DETAILS POPUP MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800 }}>
            <WalletOutlined style={{ color: '#4f46e5' }} />
            <span>Partner / Subscription Details</span>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsDetailsModalOpen(false)} style={{ backgroundColor: '#4f46e5', minWidth: 90 }}>
            Close
          </Button>,
        ]}
        width={720}
        centered
      >
        {selectedPartner && (
          <div style={{ paddingTop: 10 }}>
            {/* Gym Banner Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 18px',
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 8,
                  backgroundColor: '#0a0a0a',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 900 }}>{selectedPartner.logoText || 'G'}</span>
                <span style={{ fontSize: 7, fontWeight: 700, color: '#94a3b8', marginTop: 2 }}>{(selectedPartner.logoSub || '').split(' ')[0]}</span>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedPartner.gymName}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      backgroundColor: selectedPartner.status === 'Active'
                        ? isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef'
                        : isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
                      color: selectedPartner.status === 'Active' ? '#00bf62' : '#e11d48',
                    }}
                  >
                    ● {selectedPartner.status}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '3px 0' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>Gym ID</span>
                  <span style={{ fontWeight: 700, color: '#4f46e5', fontSize: 13 }}>{selectedPartner.gymId}</span>
                </div>

                <div style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <EnvironmentOutlined style={{ color: '#6366f1', fontSize: 11 }} />
                  <span>{selectedPartner.gymLocation}</span>
                </div>
              </div>
            </div>

            {/* Section 1: Subscription Information */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 10 }}>
                Subscription Information
              </div>

              <div
                style={{
                  padding: '14px 16px',
                  border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                  borderRadius: 10,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ color: '#6366f1' }} /> Subscription Type
                  </span>
                  {renderTypeTag(selectedPartner.subscriptionType)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ClockCircleOutlined style={{ color: '#6366f1' }} /> Subscription Period
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedPartner.subscriptionPeriod}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ color: '#6366f1' }} /> Start Date
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedPartner.startDate}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarOutlined style={{ color: '#6366f1' }} /> Next Billing Date
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedPartner.nextBillingDate}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <DollarOutlined style={{ color: '#6366f1' }} /> Billing Amount
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedPartner.billingAmount}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CreditCardOutlined style={{ color: '#6366f1' }} /> Payment Method
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                    {selectedPartner.paymentMethod}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gridColumn: 'span 2' }}>
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ReloadOutlined style={{ color: '#6366f1' }} /> Auto Renewal
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: selectedPartner.autoRenewal === 'Enabled' ? '#00bf62' : '#ef4444' }}>
                    {selectedPartner.autoRenewal}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Usage Summary (This Period) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 10 }}>
                Usage Summary (This Period)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <div
                  style={{
                    padding: '12px 10px',
                    borderRadius: 8,
                    border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 600 }}>App Bookings</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 4 }}>
                    {selectedPartner.usage?.appBookings ?? 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 10px',
                    borderRadius: 8,
                    border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 600 }}>Walk-in (GMS)</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 4 }}>
                    {selectedPartner.usage?.walkIn ?? 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 10px',
                    borderRadius: 8,
                    border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 600 }}>Total Revenue</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 4 }}>
                    ₹ {selectedPartner.usage?.totalRevenue ?? 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px 10px',
                    borderRadius: 8,
                    border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 600 }}>Profile Views</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 4 }}>
                    {selectedPartner.usage?.profileViews ?? 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Manage Subscription */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 10 }}>
                Manage Subscription
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                <Button
                  type="primary"
                  icon={<ArrowUpOutlined />}
                  onClick={() => setIsUpgradeModalOpen(true)}
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 700,
                    backgroundColor: '#16a34a',
                    borderColor: '#16a34a',
                  }}
                >
                  Upgrade Plan
                </Button>

                <Button
                  icon={<ArrowDownOutlined />}
                  onClick={() => setIsDowngradeModalOpen(true)}
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 700,
                    color: '#4f46e5',
                    borderColor: isDarkMode ? '#3730a3' : '#c7d2fe',
                  }}
                >
                  Downgrade Plan
                </Button>

                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setIsCancelModalOpen(true)}
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 700,
                  }}
                >
                  Cancel Subscription
                </Button>
              </div>

              {/* Cancellation Alert Notice */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
                  border: `1px solid ${isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#bfdbfe'}`,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                <InfoCircleOutlined style={{ color: '#3b82f6', fontSize: 14, marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontSize: 11, color: isDarkMode ? '#93c5fd' : '#1e40af', lineHeight: 1.4 }}>
                  Cancelling the subscription will stop automatic renewals. Your services will remain active until {selectedPartner.nextBillingDate}.
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 5. MODALS: UPGRADE / DOWNGRADE / CANCEL */}
      {/* UPGRADE PLAN MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800 }}>Upgrade Subscription Plan</span>}
        open={isUpgradeModalOpen}
        onCancel={() => setIsUpgradeModalOpen(false)}
        onOk={handleConfirmUpgrade}
        confirmLoading={isSubmittingAction}
        okText="Confirm Upgrade"
        okButtonProps={{ style: { backgroundColor: '#16a34a' } }}
        centered
      >
        <div style={{ paddingTop: 12 }}>
          <p style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
            Select the new tier to upgrade <strong>{selectedPartner?.gymName}</strong> ({selectedPartner?.gymId}):
          </p>

          <Radio.Group
            value={selectedPlanOption}
            onChange={(e) => setSelectedPlanOption(e.target.value)}
            style={{ width: '100%', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <Radio value="Hybrid" style={{ padding: '10px 14px', border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`, borderRadius: 8 }}>
              <strong>Hybrid Tier (₹ 4,999/mo)</strong> — Full GMS ERP + GYMEZY App Marketplace Listing
            </Radio>
            <Radio value="App Only" style={{ padding: '10px 14px', border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`, borderRadius: 8 }}>
              <strong>App Only (₹ 2,999/mo)</strong> — Discovery Marketplace & App Walk-In Bookings
            </Radio>
          </Radio.Group>
        </div>
      </Modal>

      {/* DOWNGRADE PLAN MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800 }}>Downgrade Subscription Plan</span>}
        open={isDowngradeModalOpen}
        onCancel={() => setIsDowngradeModalOpen(false)}
        onOk={handleConfirmDowngrade}
        confirmLoading={isSubmittingAction}
        okText="Confirm Downgrade"
        centered
      >
        <div style={{ paddingTop: 12 }}>
          <p style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
            Choose lower tier for <strong>{selectedPartner?.gymName}</strong>:
          </p>
          <Radio.Group
            value={selectedPlanOption}
            onChange={(e) => setSelectedPlanOption(e.target.value)}
            style={{ width: '100%', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <Radio value="GMS" style={{ padding: '10px 14px', border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`, borderRadius: 8 }}>
              <strong>GMS Standalone (₹ 1,999/mo)</strong> — Standalone Gym Management Software
            </Radio>
            <Radio value="Listing Only" style={{ padding: '10px 14px', border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`, borderRadius: 8 }}>
              <strong>Listing Only (₹ 999/mo)</strong> — Basic directory discovery without GMS
            </Radio>
          </Radio.Group>
        </div>
      </Modal>

      {/* CANCEL SUBSCRIPTION MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800, color: '#ef4444' }}>Cancel Subscription</span>}
        open={isCancelModalOpen}
        onCancel={() => setIsCancelModalOpen(false)}
        onOk={handleConfirmCancel}
        confirmLoading={isSubmittingAction}
        okText="Yes, Cancel Subscription"
        okButtonProps={{ danger: true }}
        centered
      >
        <p style={{ paddingTop: 12, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
          Are you sure you want to cancel the subscription for <strong>{selectedPartner?.gymName}</strong>? Automatic renewal will be disabled immediately.
        </p>
      </Modal>

      {/* Universal Server-Side Export Dialog */}
      <ExportModal
        open={isExportModalOpen}
        onCancel={() => setIsExportModalOpen(false)}
        title="Export SaaS Subscriptions"
        defaultFileName={getDefaultExportFileName('Subscriptions')}
        totalAvailable={pagination?.total || partners.length}
        onExport={executeExport}
        loading={isExporting}
      />
    </div>
  );
};

export default SubscriptionsManagement;
