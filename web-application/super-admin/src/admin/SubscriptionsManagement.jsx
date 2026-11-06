import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Space,
  message,
  Dropdown,
  Radio,
  Segmented,
  Avatar,
  Tooltip,
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
  CloseOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  SyncOutlined,
  SendOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { apiClient } from '../services/apiClient';

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

  // Main Tab: Partner Subscriptions vs Member Plan Switch Approvals
  const [mainTab, setMainTab] = useState('partner_subs'); // 'partner_subs' | 'member_switches'
  const [switchRequests, setSwitchRequests] = useState([]);
  const [isSwitchLoading, setIsSwitchLoading] = useState(false);
  const [selectedAdminSwitchReq, setSelectedAdminSwitchReq] = useState(null);
  const [isAdminSwitchModalOpen, setIsAdminSwitchModalOpen] = useState(false);
  const [adminRejectionModalOpen, setAdminRejectionModalOpen] = useState(false);
  const [adminRejectionReason, setAdminRejectionReason] = useState('');
  const [adminReqToReject, setAdminReqToReject] = useState(null);
  const [switchSearch, setSwitchSearch] = useState('');
  const [switchStatusFilter, setSwitchStatusFilter] = useState('ALL');

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

  useEffect(() => {
    if (mainTab === 'partner_subs') {
      void fetchPartnerSubscriptions();
    }
  }, [mainTab, fetchPartnerSubscriptions]);

  const fetchAdminSwitchRequests = async () => {
    setIsSwitchLoading(true);
    try {
      const res = await apiClient.get('/admin/membership-switch-requests');
      const data = res.data?.data?.requests;
      if (Array.isArray(data)) {
        setSwitchRequests(data);
      }
    } catch (err) {
      console.warn('Failed to fetch admin switch requests:', err);
    } finally {
      setIsSwitchLoading(false);
    }
  };

  useEffect(() => {
    void fetchAdminSwitchRequests();
  }, []);

  const handleSuperAdminApprove = (req) => {
    if (!req) return;
    Modal.confirm({
      title: 'Approve & Execute Plan Switch',
      icon: <CheckCircleFilled style={{ color: '#00bf62' }} />,
      content: (
        <div>
          <p style={{ margin: '8px 0 6px 0', fontSize: 13.5 }}>
            Final approval for <strong>{req.userId?.fullName || 'Member'}</strong> at <strong>{req.gymId?.name || 'Gym'}</strong> to <strong>{req.targetTier} Plan</strong>?
          </p>
          <div style={{ padding: '10px 12px', background: isDarkMode ? '#141414' : '#f8fafc', borderRadius: 8, fontSize: 12, marginBottom: 8 }}>
            <div>Prorated Credit Applied: <strong style={{ color: '#00bf62' }}>₹{((req.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2)}</strong></div>
            <div>Target Plan Price: <strong>₹{((req.quoteSnapshot?.newPricePaise || 0) / 100).toFixed(2)}</strong></div>
            <div>Net Payable / Wallet Credit: <strong style={{ color: 'var(--color-primary)' }}>₹{((req.quoteSnapshot?.netAmountToPayPaise || 0) / 100).toFixed(2)}</strong></div>
          </div>
          <p style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', margin: 0 }}>
            This operation will atomically commit the membership transition in the database, adjust duration, and credit user wallet if applicable.
          </p>
        </div>
      ),
      okText: 'Approve & Execute Switch',
      okType: 'primary',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          const reqId = req._id || req.requestId;
          await apiClient.patch(`/admin/membership-switch-requests/${reqId}/admin-action`, {
            action: 'APPROVE',
            remarks: 'Approved by Super Admin',
          });
          setSwitchRequests((prev) =>
            prev.map((r) =>
              (r._id === reqId || r.requestId === req.requestId)
                ? { ...r, status: 'APPROVED_AND_EXECUTED' }
                : r
            )
          );
          if (selectedAdminSwitchReq && (selectedAdminSwitchReq._id === reqId || selectedAdminSwitchReq.requestId === req.requestId)) {
            setSelectedAdminSwitchReq((prev) => ({ ...prev, status: 'APPROVED_AND_EXECUTED' }));
          }
          setIsAdminSwitchModalOpen(false);
          message.success('Membership plan switch approved and executed atomically!');
        } catch (err) {
          message.error(err.response?.data?.message || err.message || 'Failed to approve switch request');
        }
      },
    });
  };

  const handleOpenAdminReject = (req) => {
    setAdminReqToReject(req);
    setAdminRejectionReason('');
    setAdminRejectionModalOpen(true);
  };

  const handleConfirmAdminReject = async () => {
    if (!adminReqToReject) return;
    try {
      const reqId = adminReqToReject._id || adminReqToReject.requestId;
      await apiClient.patch(`/admin/membership-switch-requests/${reqId}/admin-action`, {
        action: 'REJECT',
        remarks: adminRejectionReason || 'Rejected by Super Admin',
      });
      setSwitchRequests((prev) =>
        prev.map((r) =>
          (r._id === reqId || r.requestId === adminReqToReject.requestId)
            ? { ...r, status: 'REJECTED_BY_SUPER_ADMIN' }
            : r
        )
      );
      if (selectedAdminSwitchReq && (selectedAdminSwitchReq._id === reqId || selectedAdminSwitchReq.requestId === adminReqToReject.requestId)) {
        setSelectedAdminSwitchReq((prev) => ({ ...prev, status: 'REJECTED_BY_SUPER_ADMIN' }));
      }
      setAdminRejectionModalOpen(false);
      setIsAdminSwitchModalOpen(false);
      message.info(`Switch request ${adminReqToReject.requestId} was rejected.`);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Failed to reject switch request');
    }
  };

  const adminSwitchColumns = [
    {
      title: 'Request ID',
      dataIndex: 'requestId',
      key: 'requestId',
      render: (text, record) => (
        <Tooltip title="Click to view details">
          <span
            onClick={() => {
              setSelectedAdminSwitchReq(record);
              setIsAdminSwitchModalOpen(true);
            }}
            style={{ fontWeight: 700, color: '#4f46e5', cursor: 'pointer', fontFamily: 'monospace' }}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Gym & Partner',
      key: 'gym',
      render: (_, record) => {
        const gymObj = record.gymId || {};
        return (
          <div>
            <div style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 13 }}>
              {gymObj.name || 'Partner Gym'}
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>
              {gymObj.partnerId || ''} • {gymObj.city || ''}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Member',
      key: 'member',
      render: (_, record) => {
        const userObj = record.userId || {};
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar
              src={userObj.profilePicture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'}
              size={34}
            />
            <div>
              <div style={{ fontWeight: 650, color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 13 }}>
                {userObj.fullName || 'Member'}
              </div>
              <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>
                {userObj.phone || userObj.email || ''}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Transition',
      key: 'transition',
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag style={{ margin: 0, fontSize: 11, fontWeight: 600 }}>
              {record.membershipId?.membershipTier || 'Current'}
            </Tag>
            <SwapOutlined style={{ color: '#94a3b8', fontSize: 12 }} />
            <Tag color="blue" style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>
              {record.targetTier}
            </Tag>
          </div>
          <div style={{ fontSize: 11, color: '#00bf62', fontWeight: 600, marginTop: 3 }}>
            Credit: -₹{((record.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2)}
          </div>
        </div>
      ),
    },
    {
      title: 'Net Amount',
      key: 'netAmount',
      render: (_, record) => (
        <span style={{ fontSize: 13.5, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          ₹{((record.quoteSnapshot?.netAmountToPayPaise || 0) / 100).toFixed(2)}
        </span>
      ),
    },
    {
      title: 'Settlement / Payment',
      key: 'settlement',
      render: (_, record) => {
        const quote = record.quoteSnapshot || {};
        const policy = quote.downgradePolicy || 'WALLET';
        const isUpgrade = quote.switchType === 'UPGRADE';
        const leftover = ((quote.leftoverCreditPaise || 0) / 100).toFixed(2);
        const extraDays = quote.extraDaysAwarded || 0;

        if (isUpgrade) {
          return (
            <div>
              <Tag color="cyan" style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4 }}>
                {record.paymentDetails?.method || 'UPI'}
              </Tag>
              {quote.walletDeductionPaise > 0 && (
                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2 }}>
                  Wallet: -₹{(quote.walletDeductionPaise / 100).toFixed(2)}
                </div>
              )}
            </div>
          );
        }

        if (policy === 'REFUND') {
          return (
            <div>
              <Tag color="purple" style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4 }}>
                Refund
              </Tag>
              <div style={{ fontSize: 11, color: '#9333ea', fontWeight: 700, marginTop: 2 }}>
                ₹{leftover}
              </div>
            </div>
          );
        }

        if (policy === 'EXTEND') {
          return (
            <div>
              <Tag color="orange" style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4 }}>
                Date Extend
              </Tag>
              <div style={{ fontSize: 11, color: '#d97706', fontWeight: 700, marginTop: 2 }}>
                +{extraDays} Days
              </div>
            </div>
          );
        }

        // Default: WALLET
        return (
          <div>
            <Tag color="blue" style={{ margin: 0, fontWeight: 700, fontSize: 11, borderRadius: 4 }}>
              Wallet Credit
            </Tag>
            <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, marginTop: 2 }}>
              ₹{leftover}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Gym Approval',
      key: 'gymApproval',
      render: (_, record) => {
        const approval = record.gymApproval || {};
        if (approval.status === 'ACCEPTED') {
          return (
            <Tag color="green" icon={<CheckCircleFilled />} style={{ fontSize: 11, fontWeight: 600, borderRadius: 4 }}>
              Accepted by Gym
            </Tag>
          );
        }
        return (
          <Tag color="orange" icon={<ClockCircleOutlined />} style={{ fontSize: 11, fontWeight: 600, borderRadius: 4 }}>
            Pending Gym Review
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        if (status === 'PENDING_SUPER_ADMIN_APPROVAL') {
          return (
            <Tag color="processing" icon={<SyncOutlined spin />} style={{ fontWeight: 650, borderRadius: 4 }}>
              Awaiting Admin Approval
            </Tag>
          );
        }
        if (status === 'APPROVED_AND_EXECUTED') {
          return (
            <Tag color="success" icon={<CheckCircleFilled />} style={{ fontWeight: 650, borderRadius: 4 }}>
              Approved & Executed
            </Tag>
          );
        }
        if (status === 'PENDING_GYM_APPROVAL') {
          return (
            <Tag color="warning" icon={<ClockCircleOutlined />} style={{ fontWeight: 650, borderRadius: 4 }}>
              Under Gym Review
            </Tag>
          );
        }
        return (
          <Tag color="error" icon={<CloseCircleOutlined />} style={{ fontWeight: 650, borderRadius: 4 }}>
            {status?.includes('GYM') ? 'Rejected by Gym' : 'Rejected by Admin'}
          </Tag>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space size={6}>
          <Tag color={record.status === 'APPROVED_AND_EXECUTED' ? 'success' : 'default'} style={{ borderRadius: 4, fontWeight: 600 }}>
            {record.status === 'APPROVED_AND_EXECUTED' ? 'Executed' : 'Gym Managed'}
          </Tag>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedAdminSwitchReq(record);
              setIsAdminSwitchModalOpen(true);
            }}
            style={{ borderRadius: 'var(--radius-base)', fontSize: 12, height: 30 }}
          />
        </Space>
      ),
    },
  ];

  // Selected Partner for details modal
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Modals State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isDowngradeModalOpen, setIsDowngradeModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedPlanOption, setSelectedPlanOption] = useState('Hybrid');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

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

  // Filtered Switch Requests
  const filteredSwitchRequests = useMemo(() => {
    return switchRequests.filter((item) => {
      if (switchStatusFilter !== 'ALL' && item.status !== switchStatusFilter) {
        return false;
      }
      if (switchSearch.trim()) {
        const q = switchSearch.toLowerCase();
        const reqId = (item.requestId || '').toLowerCase();
        const userName = (item.userId?.fullName || '').toLowerCase();
        const userPhone = (item.userId?.phone || '').toLowerCase();
        const gymName = (item.gymId?.name || '').toLowerCase();
        const partnerId = (item.gymId?.partnerId || '').toLowerCase();
        if (
          !reqId.includes(q) &&
          !userName.includes(q) &&
          !userPhone.includes(q) &&
          !gymName.includes(q) &&
          !partnerId.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [switchRequests, switchStatusFilter, switchSearch]);

  const switchStats = useMemo(() => {
    const total = switchRequests.length;
    const pendingAdmin = switchRequests.filter((r) => r.status === 'PENDING_SUPER_ADMIN_APPROVAL').length;
    const approved = switchRequests.filter((r) => r.status === 'APPROVED_AND_EXECUTED').length;
    const rejected = switchRequests.filter((r) => r.status?.includes('REJECTED')).length;
    return { total, pendingAdmin, approved, rejected };
  }, [switchRequests]);

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
      {/* 1. TOP HEADER WITH VIEW SWITCHER */}
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
            Manage B2B gym partner SaaS tiers and review B2C member plan upgrade / downgrade pro-rated switches.
          </p>
        </div>

        <Segmented
          size="large"
          value={mainTab}
          onChange={setMainTab}
          options={[
            {
              label: (
                <span style={{ padding: '0 10px', fontWeight: 650, fontSize: 13 }}>
                  Partner Gym Subscriptions
                </span>
              ),
              value: 'partner_subs',
            },
            {
              label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', fontWeight: 650, fontSize: 13 }}>
                  <SwapOutlined />
                  <span>Member Plan Switches</span>
                  {switchStats.pendingAdmin > 0 && (
                    <span
                      style={{
                        backgroundColor: '#003882',
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: 10,
                      }}
                    >
                      {switchStats.pendingAdmin}
                    </span>
                  )}
                </div>
              ),
              value: 'member_switches',
            },
          ]}
          style={{
            backgroundColor: isDarkMode ? '#1f1f1f' : '#f1f5f9',
            padding: 4,
            borderRadius: 'var(--radius-base)',
          }}
        />
      </div>

      {/* 2. TAB CONTENT: PARTNER GYM SUBSCRIPTIONS */}
      {mainTab === 'partner_subs' && (
        <>
          {/* TOP 5 METRIC CARDS (IN ONE LINE) */}
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

      {/* 2. FULL-WIDTH PARTNERS TABLE & FILTERS */}
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
        </>
      )}

      {/* 3. TAB CONTENT: MEMBER PLAN SWITCH APPROVALS */}
      {mainTab === 'member_switches' && (
        <>
          {/* TOP 4 SWITCH METRIC CARDS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 16,
              marginBottom: 20,
            }}
          >
            {/* Total Switch Requests */}
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
                    backgroundColor: isDarkMode ? 'rgba(79, 70, 229, 0.15)' : '#eef2ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SwapOutlined style={{ fontSize: 20, color: '#4f46e5' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Total Switch Requests
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                    {switchStats.total}
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    All requests
                  </div>
                </div>
              </div>
            </Card>

            {/* Awaiting Admin Approval */}
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
                    Awaiting Admin Approval
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#f59e0b', lineHeight: 1.2, margin: '2px 0' }}>
                    {switchStats.pendingAdmin}
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    Accepted by Gym Owner
                  </div>
                </div>
              </div>
            </Card>

            {/* Approved & Active */}
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
                  <CheckCircleFilled style={{ fontSize: 20, color: '#00bf62' }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Approved & Active
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#00bf62', lineHeight: 1.2, margin: '2px 0' }}>
                    {switchStats.approved}
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    Transition executed
                  </div>
                </div>
              </div>
            </Card>

            {/* Rejected */}
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
                    Rejected Requests
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#ef4444', lineHeight: 1.2, margin: '2px 0' }}>
                    {switchStats.rejected}
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    Declined by Gym / Admin
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* SWITCH SEARCH & FILTERS */}
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
                placeholder="Search by Request ID, Member Name, Gym, Partner ID..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={switchSearch}
                onChange={(e) => setSwitchSearch(e.target.value)}
                style={{ flex: 1, minWidth: 260, borderRadius: 'var(--radius-base)' }}
                allowClear
              />

              <Select
                value={switchStatusFilter}
                onChange={setSwitchStatusFilter}
                style={{ width: 230 }}
              >
                <Option value="ALL">All Statuses</Option>
                <Option value="PENDING_SUPER_ADMIN_APPROVAL">Awaiting Admin Approval</Option>
                <Option value="APPROVED_AND_EXECUTED">Approved & Executed</Option>
                <Option value="PENDING_GYM_APPROVAL">Under Gym Review</Option>
                <Option value="REJECTED_BY_SUPER_ADMIN">Rejected by Admin</Option>
                <Option value="REJECTED_BY_GYM">Rejected by Gym</Option>
              </Select>

              <Button
                icon={<ReloadOutlined spin={isSwitchLoading} />}
                onClick={fetchAdminSwitchRequests}
                style={{ borderRadius: 'var(--radius-base)' }}
              >
                Refresh
              </Button>
            </div>
          </Card>

          {/* SWITCH REQUESTS TABLE */}
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
              columns={adminSwitchColumns}
              dataSource={filteredSwitchRequests}
              loading={isSwitchLoading}
              rowKey={(r) => r._id || r.requestId}
              pagination={{ pageSize: 10, showSizeChanger: true }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </>
      )}

      {/* -------------------------------------------------------------
          4. PARTNER / SUBSCRIPTION DETAILS POPUP MODAL
         ------------------------------------------------------------- */}
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

      {/* -------------------------------------------------------------
          MODALS: UPGRADE / DOWNGRADE / CANCEL
         ------------------------------------------------------------- */}
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

      {/* -------------------------------------------------------------
          8. SUPER ADMIN: MEMBER PLAN SWITCH DETAILS MODAL
         ------------------------------------------------------------- */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800 }}>
            <SwapOutlined style={{ color: '#003882' }} />
            <span>Plan Switch Request Governance: {selectedAdminSwitchReq?.requestId}</span>
          </div>
        }
        open={isAdminSwitchModalOpen}
        onCancel={() => setIsAdminSwitchModalOpen(false)}
        width={760}
        centered
        footer={
          selectedAdminSwitchReq?.status === 'PENDING_SUPER_ADMIN_APPROVAL' ? [
            <Button key="cancel" onClick={() => setIsAdminSwitchModalOpen(false)}>
              Close
            </Button>,
            <Button
              key="reject"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => {
                handleOpenAdminReject(selectedAdminSwitchReq);
              }}
            >
              Reject Request
            </Button>,
            <Button
              key="approve"
              type="primary"
              icon={<CheckCircleFilled />}
              style={{ backgroundColor: '#00bf62', borderColor: '#00bf62' }}
              onClick={() => handleSuperAdminApprove(selectedAdminSwitchReq)}
            >
              Approve & Execute Switch
            </Button>,
          ] : [
            <Button key="close" type="primary" onClick={() => setIsAdminSwitchModalOpen(false)}>
              Close
            </Button>,
          ]
        }
      >
        {selectedAdminSwitchReq && (
          <div style={{ paddingTop: 8 }}>
            {/* Header Transition Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar
                  src={selectedAdminSwitchReq.userId?.profilePicture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'}
                  size={46}
                />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedAdminSwitchReq.userId?.fullName || 'Member'}
                  </div>
                  <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>
                    {selectedAdminSwitchReq.userId?.email || ''} • {selectedAdminSwitchReq.userId?.phone || ''}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 600 }}>
                  GYM PARTNER
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedAdminSwitchReq.gymId?.name || 'Partner Gym'}
                </div>
                <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                  {selectedAdminSwitchReq.gymId?.partnerId || ''} • {selectedAdminSwitchReq.gymId?.city || ''}
                </div>
              </div>
            </div>

            {/* 2-Tier Workflow Audit Trail */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Dual-Tier Approval & Audit Trail
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {/* Step 1 */}
                <div style={{ padding: 10, borderRadius: 8, backgroundColor: isDarkMode ? '#1f1f1f' : '#f8fafc', border: `1px solid ${isDarkMode ? '#2d2d2d' : '#f1f5f9'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#003882' }}>1. Member Applied</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 4 }}>
                    {selectedAdminSwitchReq.createdAt ? new Date(selectedAdminSwitchReq.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}
                  </div>
                </div>

                {/* Step 2 */}
                <div style={{ padding: 10, borderRadius: 8, backgroundColor: isDarkMode ? '#1f1f1f' : '#f8fafc', border: `1px solid ${isDarkMode ? '#2d2d2d' : '#f1f5f9'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: selectedAdminSwitchReq.gymApproval?.status === 'ACCEPTED' ? '#00bf62' : '#f59e0b' }}>
                    2. Gym Review: {selectedAdminSwitchReq.gymApproval?.status || 'PENDING'}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 4 }}>
                    {selectedAdminSwitchReq.gymApproval?.approvedAt ? new Date(selectedAdminSwitchReq.gymApproval.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Pending review'}
                  </div>
                  {selectedAdminSwitchReq.gymApproval?.rejectionReason && (
                    <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>{selectedAdminSwitchReq.gymApproval.rejectionReason}</div>
                  )}
                </div>

                {/* Step 3 */}
                <div style={{ padding: 10, borderRadius: 8, backgroundColor: isDarkMode ? '#1f1f1f' : '#f8fafc', border: `1px solid ${isDarkMode ? '#2d2d2d' : '#f1f5f9'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: selectedAdminSwitchReq.status === 'APPROVED_AND_EXECUTED' ? '#00bf62' : selectedAdminSwitchReq.status === 'PENDING_SUPER_ADMIN_APPROVAL' ? '#003882' : '#ef4444' }}>
                    3. Super Admin Final
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 4 }}>
                    {selectedAdminSwitchReq.superAdminApproval?.approvedAt ? new Date(selectedAdminSwitchReq.superAdminApproval.approvedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : selectedAdminSwitchReq.status === 'PENDING_SUPER_ADMIN_APPROVAL' ? 'Awaiting Decision' : 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Proration Calculation & Financial Audit Breakdown */}
            <div
              style={{
                padding: '16px',
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Proration Financial Settlement Snapshot
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                {/* Current Plan Sub-Card */}
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: isDarkMode ? '#1b1b1b' : '#ffffff', border: `1px solid ${isDarkMode ? '#2d2d2d' : '#e2e8f0'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b' }}>CURRENT PLAN</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', margin: '4px 0' }}>
                    {selectedAdminSwitchReq.membershipId?.membershipTier || 'Current Tier'}
                  </div>
                  <div style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#475569', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div>Plan Price: <strong>₹{((selectedAdminSwitchReq.quoteSnapshot?.currentPricePaise || 0) / 100).toFixed(2)}</strong></div>
                    <div>Plan Duration: <strong>{selectedAdminSwitchReq.quoteSnapshot?.currentDurationDays || 0} days</strong></div>
                    <div>Daily Pro-rata Rate: <strong>₹{((selectedAdminSwitchReq.quoteSnapshot?.currentPerDayCostPaise || 0) / 100).toFixed(2)}/day</strong></div>
                    <div>Days Remaining: <strong>{selectedAdminSwitchReq.quoteSnapshot?.remainingDays || 0} days</strong></div>
                    <div style={{ color: '#00bf62', fontWeight: 700 }}>
                      Unused Pro-rated Credit: ₹{((selectedAdminSwitchReq.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Target Plan Sub-Card */}
                <div style={{ padding: 12, borderRadius: 8, backgroundColor: isDarkMode ? '#1b1b1b' : '#ffffff', border: `1px solid ${isDarkMode ? '#2d2d2d' : '#e2e8f0'}` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b' }}>TARGET PLAN</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#003882', margin: '4px 0' }}>
                    {selectedAdminSwitchReq.targetTier}
                  </div>
                  <div style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#475569', display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div>Target Price: <strong>₹{((selectedAdminSwitchReq.quoteSnapshot?.newPricePaise || 0) / 100).toFixed(2)}</strong></div>
                    <div>New Duration: <strong>{selectedAdminSwitchReq.quoteSnapshot?.newDurationDays || 0} days</strong></div>
                    <div>Credit Deducted: <strong style={{ color: '#00bf62' }}>-₹{((selectedAdminSwitchReq.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2)}</strong></div>
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${isDarkMode ? '#333' : '#e2e8f0'}` }}>
                      {(selectedAdminSwitchReq.quoteSnapshot?.netAmountToPayPaise || 0) > 0 ? (
                        <div style={{ color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 800 }}>
                          Net Payable by Member: <span style={{ color: '#003882', fontSize: 14 }}>₹{((selectedAdminSwitchReq.quoteSnapshot?.netAmountToPayPaise || 0) / 100).toFixed(2)}</span>
                        </div>
                      ) : (
                        <div style={{ color: '#00bf62', fontWeight: 800 }}>
                          {selectedAdminSwitchReq.quoteSnapshot?.downgradePolicy === 'REFUND'
                            ? 'Refund to Member Bank/UPI: '
                            : selectedAdminSwitchReq.quoteSnapshot?.downgradePolicy === 'EXTEND'
                            ? `Bonus Days: +${selectedAdminSwitchReq.quoteSnapshot?.extraDaysAwarded || 0} Days (Leftover: `
                            : 'Leftover Credit to User Wallet: '}
                          <span style={{ fontSize: 14 }}>₹{((selectedAdminSwitchReq.quoteSnapshot?.leftoverCreditPaise || 0) / 100).toFixed(2)}</span>
                          {selectedAdminSwitchReq.quoteSnapshot?.downgradePolicy === 'EXTEND' ? ')' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* -------------------------------------------------------------
          9. SUPER ADMIN: REJECTION MODAL
         ------------------------------------------------------------- */}
      <Modal
        title={<span style={{ fontWeight: 800, color: '#ef4444' }}>Reject Plan Switch Request</span>}
        open={adminRejectionModalOpen}
        onCancel={() => setAdminRejectionModalOpen(false)}
        onOk={handleConfirmAdminReject}
        okText="Confirm Rejection"
        okButtonProps={{ danger: true }}
        centered
      >
        <div style={{ paddingTop: 10 }}>
          <p style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
            Provide the reason for rejecting request <strong>{adminReqToReject?.requestId}</strong> for <strong>{adminReqToReject?.userId?.fullName}</strong>:
          </p>
          <Input.TextArea
            rows={3}
            placeholder="e.g., Target plan inactive, mismatch in membership eligibility..."
            value={adminRejectionReason}
            onChange={(e) => setAdminRejectionReason(e.target.value)}
            style={{ borderRadius: 'var(--radius-base)' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default SubscriptionsManagement;
