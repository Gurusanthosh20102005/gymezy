import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
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
  Tooltip,
  Row,
  Col,
  Space,
  Result,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  WalletOutlined,
  CreditCardOutlined,
  DollarOutlined,
  CopyOutlined,
  PrinterOutlined,
  ReloadOutlined,
  UserOutlined,
  ShopOutlined,
  CalendarOutlined,
  PhoneOutlined,
  MailOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { useTheme } from '../../theme/ThemeContext';
import { transactionService } from '../../services/transactionService';
import { useDebounce } from '../../hooks/useDebounce';
import { getDidYouMeanSuggestion } from '../../utils/fuzzySearchEngine';

const { Option } = Select;
const { Text, Title } = Typography;

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed) return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

export const TransactionsManagement = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();
  const { user } = useSelector((state) => state.auth || {});
  const gymProfile = useSelector((state) => state.gym?.gymProfile || {});

  const isManager = Boolean(
    user?.isManager ||
    user?.role === 'MANAGER' ||
    String(user?.role || '').toUpperCase() === 'MANAGER'
  );

  // Resolve target gym details strictly for this gym owner
  const gym = user?.gym || gymProfile || {};
  const gymId = gym._id || gym.id || user?.gymId?._id || user?.gymId || user?.partnerId || 'me';
  const gymName = gym.name || gymProfile.name || user?.gymName || 'Partner Gym';
  const gymPartnerId = gym.partnerId || gymProfile.partnerId || '';

  // Data & Loading States
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    successfulTransactions: 0,
    successfulPct: '0%',
    pendingTransactions: 0,
    pendingPct: '0%',
    failedTransactions: 0,
    failedPct: '0%',
    totalAmount: '0.00',
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters & Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 350);
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const didYouMean = React.useMemo(() => {
    return getDidYouMeanSuggestion(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, paymentModeFilter, statusFilter]);

  // Modal State
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Fetch Transactions from Backend API scoped to this gym
  const fetchTransactions = useCallback(
    async (page = currentPage, search = debouncedSearchQuery, mode = paymentModeFilter, status = statusFilter) => {
      if (isManager) return;
      setLoading(true);
      try {
        const params = {
          page,
          limit: pageSize,
          search: search?.trim() || undefined,
          paymentMode: mode === 'all' ? undefined : mode,
          status: status === 'all' ? undefined : status,
        };
        const res = await transactionService.getGymTransactions(gymId, params);
        setTransactions(res.transactions || []);
        if (res.stats) setStats(res.stats);
        if (res.pagination) {
          setTotalRecords(res.pagination.totalRecords || 0);
          setCurrentPage(res.pagination.page || page);
        }
      } catch (err) {
        console.error('Failed to load gym transactions:', err);
        message.error(err.response?.data?.message || 'Failed to load transactions for this gym.');
      } finally {
        setLoading(false);
      }
    },
    [gymId, pageSize, debouncedSearchQuery, paymentModeFilter, statusFilter, isManager]
  );

  useEffect(() => {
    fetchTransactions(currentPage, debouncedSearchQuery, paymentModeFilter, statusFilter);
  }, [fetchTransactions, currentPage, debouncedSearchQuery, paymentModeFilter, statusFilter]);

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleModeChange = (val) => {
    setPaymentModeFilter(val);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setPaymentModeFilter('all');
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handlePageChange = (page, newPageSize) => {
    setCurrentPage(page);
    if (newPageSize && newPageSize !== pageSize) {
      setPageSize(newPageSize);
      setCurrentPage(1);
    }
  };

  const handleCopy = (text, label) => {
    if (!text || text === '—') return;
    navigator.clipboard.writeText(text);
    message.success(`Copied ${label || 'text'} to clipboard!`);
  };

  const handleExportCSV = () => {
    if (transactions.length === 0) {
      message.warning('No transactions available to export.');
      return;
    }

    const headers = [
      'Transaction ID',
      'Gateway Reference',
      'Reference ID',
      'Service / Plan',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Date & Time',
      'Amount (INR)',
      'Payment Mode',
      'Status',
    ];

    const rows = transactions.map((t) => [
      `"${t.transactionId || ''}"`,
      `"${t.gatewayTxnId || ''}"`,
      `"${t.referenceId || ''}"`,
      `"${t.title || ''}"`,
      `"${t.customerName || ''}"`,
      `"${t.customerPhone || ''}"`,
      `"${t.customerEmail || ''}"`,
      `"${t.dateTime || t.transactionDate || ''}"`,
      `"${t.amount || '0.00'}"`,
      `"${t.paymentMode || ''}"`,
      `"${t.status || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${gymName.replace(/\s+/g, '_')}_transactions_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Transactions CSV exported successfully!');
  };

  // Status Badge Helper
  const renderStatusTag = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'completed' || s === 'success') {
      return (
        <Tag
          icon={<CheckCircleOutlined />}
          style={{
            backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
            color: '#16a34a',
            borderColor: isDarkMode ? 'rgba(34, 197, 94, 0.3)' : '#86efac',
            borderRadius: 6,
            fontWeight: 700,
            padding: '2px 8px',
          }}
        >
          Completed
        </Tag>
      );
    }
    if (s === 'pending') {
      return (
        <Tag
          icon={<ClockCircleOutlined />}
          style={{
            backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
            color: '#ca8a04',
            borderColor: isDarkMode ? 'rgba(234, 179, 8, 0.3)' : '#fde047',
            borderRadius: 6,
            fontWeight: 700,
            padding: '2px 8px',
          }}
        >
          Pending
        </Tag>
      );
    }
    if (s === 'refunded') {
      return (
        <Tag
          style={{
            backgroundColor: isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff',
            color: '#9333ea',
            borderColor: isDarkMode ? 'rgba(168, 85, 247, 0.3)' : '#d8b4fe',
            borderRadius: 6,
            fontWeight: 700,
            padding: '2px 8px',
          }}
        >
          Refunded
        </Tag>
      );
    }
    return (
      <Tag
        icon={<CloseCircleOutlined />}
        style={{
          backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
          color: '#dc2626',
          borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : '#fca5a5',
          borderRadius: 6,
          fontWeight: 700,
          padding: '2px 8px',
        }}
      >
        {status || 'Failed'}
      </Tag>
    );
  };

  // Columns Configuration
  const columns = [
    {
      title: 'Customer / Member',
      key: 'customer',
      width: 250,
      render: (_, record) => {
        const isProfilePic = hasValidProfilePic(record.avatar);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              size={40}
              src={isProfilePic ? record.avatar : undefined}
              icon={!isProfilePic ? <UserOutlined style={{ fontSize: 18 }} /> : undefined}
              style={{
                backgroundColor: isProfilePic ? 'transparent' : isDarkMode ? '#1e1b4b' : '#ede9fe',
                color: '#6366f1',
                border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 13.5,
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {record.customerName || 'Member'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: isDarkMode ? '#94a3b8' : '#64748b',
                    fontWeight: 600,
                  }}
                >
                  {record.customerId || 'CUST'}
                </span>
                {record.customerPhone && record.customerPhone !== '—' && (
                  <span style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                    • {record.customerPhone}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Service & Plan',
      key: 'service',
      width: 210,
      render: (_, record) => (
        <div>
          <div
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: isDarkMode ? '#e2e8f0' : '#1e293b',
            }}
          >
            {record.title || 'Gym Session'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Tag
              color={record.referenceType === 'MEMBERSHIP' ? 'purple' : 'blue'}
              style={{
                borderRadius: 4,
                fontSize: 10,
                lineHeight: '16px',
                padding: '0 6px',
                fontWeight: 700,
                margin: 0,
              }}
            >
              {record.referenceType === 'MEMBERSHIP' ? 'Membership' : 'Booking'}
            </Tag>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'monospace',
                color: isDarkMode ? '#818cf8' : '#4338ca',
                fontWeight: 600,
              }}
            >
              {record.referenceId || record.bookingId || '—'}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Payment Mode',
      key: 'mode',
      width: 190,
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CreditCardOutlined style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: 600, fontSize: 12.5, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
              {record.paymentMode || 'UPI'}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 3,
              fontSize: 11,
              color: isDarkMode ? '#64748b' : '#94a3b8',
              fontFamily: 'monospace',
            }}
          >
            <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.transactionId}
            </span>
            <Tooltip title="Copy Txn ID">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined style={{ fontSize: 11 }} />}
                onClick={() => handleCopy(record.transactionId, 'Txn ID')}
                style={{ padding: 0, width: 16, height: 16 }}
              />
            </Tooltip>
          </div>
        </div>
      ),
    },
    {
      title: 'Date & Time',
      dataIndex: 'dateTime',
      key: 'dateTime',
      width: 170,
      render: (dateTime, record) => (
        <div style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          <div style={{ fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
            {record.transactionDate || dateTime || '—'}
          </div>
          <div style={{ fontSize: 11, marginTop: 2 }}>{record.daysBooked || 'Access Pass'}</div>
        </div>
      ),
    },
    {
      title: 'Amount (INR)',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (amount, record) => (
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: isDarkMode ? '#ffffff' : '#0f172a',
              letterSpacing: '-0.2px',
            }}
          >
            ₹ {Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          {record.walletAmountApplied > 0 && (
            <div style={{ marginTop: 2 }}>
              <Tag
                color="orange"
                style={{
                  fontSize: 10,
                  margin: 0,
                  padding: '0 4px',
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                Wallet: -₹{record.walletAmountApplied}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      render: (status) => renderStatusTag(status),
    },
    {
      title: 'Receipt',
      key: 'actions',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedTransaction(record);
            setIsDetailsModalOpen(true);
          }}
          style={{
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 12,
            borderColor: '#818cf8',
            color: isDarkMode ? '#a5b4fc' : '#4338ca',
          }}
        >
          Receipt
        </Button>
      ),
    },
  ];

  if (isManager) {
    return (
      <div style={{ maxWidth: 800, margin: '60px auto', padding: '40px 24px', textAlign: 'center' }}>
        <Result
          status="403"
          title="Access Restricted"
          subTitle="Financial transactions, settlement records, and revenue audits are strictly reserved for the Gym Owner."
          extra={
            <Button
              type="primary"
              onClick={() => navigate('/owner/dashboard')}
              style={{ backgroundColor: 'var(--color-primary)', fontWeight: 600 }}
            >
              Return to Dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Title level={3} style={{ margin: 0, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
              Transactions & Payments
            </Title>
            <Tag color="blue" style={{ fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>
              {gymPartnerId ? `${gymName} (${gymPartnerId})` : gymName}
            </Tag>
          </div>
          <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 13 }}>
            Live collections ledger, member checkout payments, booking passes, and settlement receipts for {gymName}.
          </Text>
        </div>

        <Space size={10}>
          <Button
            icon={<ReloadOutlined spin={loading} />}
            onClick={() => fetchTransactions(currentPage, searchQuery, paymentModeFilter, statusFilter)}
            style={{ borderRadius: 8, height: 38 }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportCSV}
            style={{
              borderRadius: 8,
              height: 38,
              backgroundColor: '#4338ca',
              borderColor: '#4338ca',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(67, 56, 202, 0.25)',
            }}
          >
            Export Ledger CSV
          </Button>
        </Space>
      </div>

      {/* 2. Collections Overview Metrics */}
      <Row gutter={[16, 16]}>
        {/* Metric 1: Total Collections */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Gym Collections
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: isDarkMode ? '#ffffff' : '#0f172a',
                    marginTop: 4,
                  }}
                >
                  ₹ {Number(stats.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                  Across {stats.totalTransactions} total transactions
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#4f46e5',
                  fontSize: 20,
                }}
              >
                <DollarOutlined />
              </div>
            </div>
          </Card>
        </Col>

        {/* Metric 2: Successful Payments */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Successful Payments
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#16a34a',
                    marginTop: 4,
                  }}
                >
                  {stats.successfulTransactions}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Tag color="green" style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px', fontWeight: 700 }}>
                    {stats.successfulPct} Success Rate
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#16a34a',
                  fontSize: 20,
                }}
              >
                <CheckCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>

        {/* Metric 3: Pending Payments */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Pending Verifications
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#ca8a04',
                    marginTop: 4,
                  }}
                >
                  {stats.pendingTransactions}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px', fontWeight: 700 }}>
                    {stats.pendingPct} Pending
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ca8a04',
                  fontSize: 20,
                }}
              >
                <ClockCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>

        {/* Metric 4: Failed / Cancelled */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 12,
            }}
            styles={{ body: { padding: '18px 20px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Failed / Cancelled
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#dc2626',
                    marginTop: 4,
                  }}
                >
                  {stats.failedTransactions}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Tag color="red" style={{ fontSize: 10, lineHeight: '16px', margin: 0, padding: '0 4px', fontWeight: 700 }}>
                    {stats.failedPct} Failed
                  </Tag>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#dc2626',
                  fontSize: 20,
                }}
              >
                <CloseCircleOutlined />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 3. Search & Filter Bar */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 12,
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              placeholder="Search by member name, phone, email, txn ID, booking ID..."
              value={searchQuery}
              onChange={handleSearchChange}
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              allowClear
              style={{ height: 40, borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              value={paymentModeFilter}
              onChange={handleModeChange}
              style={{ width: '100%', height: 40 }}
            >
              <Option value="all">All Payment Modes</Option>
              <Option value="upi">UPI / QR</Option>
              <Option value="card">Credit / Debit Card</Option>
              <Option value="net banking">Net Banking</Option>
              <Option value="cash">Cash at Gym Counter</Option>
              <Option value="wallet">Gym Wallet</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={5}>
            <Select
              value={statusFilter}
              onChange={handleStatusChange}
              style={{ width: '100%', height: 40 }}
            >
              <Option value="all">All Payment Statuses</Option>
              <Option value="completed">Completed</Option>
              <Option value="pending">Pending</Option>
              <Option value="cancelled">Failed / Cancelled</Option>
              <Option value="refunded">Refunded</Option>
            </Select>
          </Col>
          <Col xs={24} md={4} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleResetFilters} style={{ height: 40, borderRadius: 8, width: '100%' }}>
              Reset Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Typo-Tolerant "Did You Mean" Suggestion Banner */}
      {didYouMean &&
        debouncedSearchQuery &&
        didYouMean.toLowerCase() !== debouncedSearchQuery.toLowerCase().trim() && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 18px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? '#1e293b' : '#eff6ff',
              border: `1px solid ${isDarkMode ? '#3b82f6' : '#bfdbfe'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: isDarkMode ? '#93c5fd' : '#1e40af' }}>
              <SearchOutlined style={{ color: '#3b82f6' }} />
              <span>
                Did you mean:{' '}
                <strong
                  onClick={() => {
                    setSearchQuery(didYouMean);
                  }}
                  style={{
                    cursor: 'pointer',
                    color: '#2563eb',
                    textDecoration: 'underline',
                  }}
                >
                  {didYouMean}
                </strong>
                ?
              </span>
            </div>
            <Button
              size="small"
              type="primary"
              ghost
              onClick={() => {
                setSearchQuery(didYouMean);
              }}
              style={{ fontWeight: 700, fontSize: 12, borderRadius: 6 }}
            >
              Search for &ldquo;{didYouMean}&rdquo;
            </Button>
          </div>
        )}

      {/* 4. Transactions Data Table */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={transactions}
          rowKey={(record) => record.key || record.id || record._id}
          loading={loading}
          pagination={false}
          scroll={{ x: 1050 }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <WalletOutlined style={{ fontSize: 36, color: '#94a3b8', marginBottom: 12 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  No transactions found for {gymName}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#64748b' : '#94a3b8', marginTop: 4 }}>
                  Member booking checkouts and membership payments for this gym will appear here in real-time.
                </div>
              </div>
            ),
          }}
        />
      </Card>

      {/* 5. Pagination */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingBottom: 24,
          paddingTop: 16,
        }}
      >
        <div style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
          Showing {transactions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} transactions
        </div>
        <Pagination
          current={currentPage}
          total={totalRecords}
          pageSize={pageSize}
          pageSizeOptions={['10', '20', '50', '100']}
          showSizeChanger
          showQuickJumper
          onChange={handlePageChange}
        />
      </div>

      {/* 6. Gym Receipt & Invoice Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShopOutlined style={{ color: '#4338ca', fontSize: 18 }} />
            <span style={{ fontWeight: 800 }}>Gym Payment Receipt</span>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => {
          setIsDetailsModalOpen(false);
          setSelectedTransaction(null);
        }}
        footer={[
          <Button key="close" onClick={() => setIsDetailsModalOpen(false)} style={{ borderRadius: 8 }}>
            Close
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => window.print()}
            style={{
              backgroundColor: '#4338ca',
              borderColor: '#4338ca',
              fontWeight: 700,
              borderRadius: 8,
            }}
          >
            Print Receipt
          </Button>,
        ]}
        width={580}
        centered
        destroyOnClose
      >
        {selectedTransaction && (
          <div style={{ padding: '8px 0' }}>
            {/* Receipt Header Banner */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                marginBottom: 20,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.5px' }}>
                  {gymPartnerId ? `${gymName.toUpperCase()} • ${gymPartnerId}` : gymName.toUpperCase()}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: isDarkMode ? '#ffffff' : '#0f172a',
                    marginTop: 2,
                  }}
                >
                  ₹ {Number(selectedTransaction.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2 }}>
                  {selectedTransaction.dateTime || selectedTransaction.transactionDate}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>{renderStatusTag(selectedTransaction.status)}</div>
            </div>

            {/* Member Details */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  letterSpacing: '0.4px',
                }}
              >
                Member Information
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <div>
                  <span style={{ color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}>Name:</span>{' '}
                  <strong style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                    {selectedTransaction.customerName}
                  </strong>
                </div>
                <div>
                  <span style={{ color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}>Customer ID:</span>{' '}
                  <code style={{ color: '#6366f1' }}>{selectedTransaction.customerId}</code>
                </div>
                <div>
                  <span style={{ color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}>Phone:</span>{' '}
                  <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                    {selectedTransaction.customerPhone || '—'}
                  </span>
                </div>
                <div>
                  <span style={{ color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}>Email:</span>{' '}
                  <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                    {selectedTransaction.customerEmail || '—'}
                  </span>
                </div>
              </div>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            {/* Financial Item Breakdown */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                  letterSpacing: '0.4px',
                }}
              >
                Service Breakdown
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Item Description:</span>
                <strong style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                  {selectedTransaction.title}
                </strong>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Reference ID:</span>
                <code style={{ color: '#6366f1' }}>
                  {selectedTransaction.referenceId || selectedTransaction.bookingId || '—'}
                </code>
              </div>
              {selectedTransaction.walletAmountApplied > 0 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13,
                    color: '#ca8a04',
                    marginBottom: 6,
                  }}
                >
                  <span>Gym Wallet Deducted:</span>
                  <span>-₹ {selectedTransaction.walletAmountApplied}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                  fontWeight: 800,
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: `1px dashed ${isDarkMode ? '#334155' : '#e2e8f0'}`,
                }}
              >
                <span>Net Amount Paid:</span>
                <span style={{ color: '#16a34a' }}>
                  ₹ {Number(selectedTransaction.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            {/* Gateway Information */}
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: isDarkMode ? '#94a3b8' : '#64748b',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                  letterSpacing: '0.4px',
                }}
              >
                Payment Gateway Details
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  fontSize: 12,
                }}
              >
                <div>
                  <span style={{ color: isDarkMode ? '#64748b' : '#94a3b8' }}>Payment Method:</span>{' '}
                  <strong style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                    {selectedTransaction.paymentMode || 'UPI'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: isDarkMode ? '#64748b' : '#94a3b8' }}>Txn Reference:</span>{' '}
                  <code style={{ fontSize: 11, color: isDarkMode ? '#a5b4fc' : '#4338ca' }}>
                    {selectedTransaction.transactionId}
                  </code>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TransactionsManagement;

