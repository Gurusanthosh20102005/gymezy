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
  Typography,
  message,
  Avatar,
  Divider,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  WalletOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  CreditCardOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  UserOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { useDebounce } from '../hooks/useDebounce';
import { transactionService } from '../services/transactionService';

const { Option } = Select;
const { Text } = Typography;

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed) return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

export const TransactionsManagement = () => {
  const { isDarkMode } = useTheme();

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
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [didYouMean, setDidYouMean] = useState(null);
  const [paymentModeFilter, setPaymentModeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('Customer Request');

  // Fetch Transactions from Backend API
  const fetchTransactions = useCallback(
    async (page = 1, search = debouncedSearch, mode = paymentModeFilter, status = statusFilter) => {
      setLoading(true);
      try {
        const params = {
          page,
          limit: pageSize,
          search: search?.trim() || undefined,
          paymentMode: mode === 'all' ? undefined : mode,
          status: status === 'all' ? undefined : status,
        };
        const res = await transactionService.getTransactions(params);
        setTransactions(res.transactions || []);
        setDidYouMean(res.didYouMean || null);
        if (res.stats) setStats(res.stats);
        if (res.pagination) {
          setTotalRecords(res.pagination.totalRecords || 0);
          setCurrentPage(res.pagination.page || 1);
        }
      } catch (err) {
        console.error('Failed to load transactions:', err);
        message.error('Failed to fetch transactions from server');
      } finally {
        setLoading(false);
      }
    },
    [pageSize, debouncedSearch, paymentModeFilter, statusFilter]
  );

  useEffect(() => {
    fetchTransactions(currentPage, debouncedSearch, paymentModeFilter, statusFilter);
  }, [fetchTransactions, currentPage, debouncedSearch, paymentModeFilter, statusFilter]);

  // Global App Refresh listener (from breadcrumb bar)
  useEffect(() => {
    const handleRefresh = () => {
      fetchTransactions(currentPage, debouncedSearch, paymentModeFilter, statusFilter);
    };
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchTransactions, currentPage, debouncedSearch, paymentModeFilter, statusFilter]);

  // Open Details Modal
  const handleView = (record) => {
    setSelectedTransaction(record);
    setIsDetailsModalOpen(true);
  };

  // Handle Initiate Refund
  const handleInitiateRefund = () => {
    message.success(
      `Refund of ₹${selectedTransaction?.amount} initiated for ${selectedTransaction?.transactionId} successfully!`
    );
    setIsRefundModalOpen(false);
  };

  // Handle Cancel Booking
  const handleCancelBooking = () => {
    message.warning(`Booking ${selectedTransaction?.bookingId} has been cancelled.`);
    setIsCancelModalOpen(false);
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      message.warning('No transactions available to export');
      return;
    }
    const headers = [
      'Transaction ID',
      'Gateway Txn ID',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Reference ID',
      'Reference Type',
      'Gym Name',
      'Date & Time',
      'Amount',
      'Payment Mode',
      'Status',
    ];
    const rows = transactions.map((t) => [
      t.transactionId || '',
      t.gatewayTxnId || '',
      t.customerName || '',
      t.customerPhone || '',
      t.customerEmail || '',
      t.referenceId || '',
      t.referenceType || '',
      t.gymName || '',
      t.dateTime || '',
      t.amount || '0',
      t.paymentMode || '',
      t.status || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gymezy_Transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Transactions exported to CSV');
  };

  // Table Columns
  const columns = [
    {
      title: 'Transaction ID',
      dataIndex: 'transactionId',
      key: 'transactionId',
      width: 170,
      render: (text, record) => (
        <Tooltip title="View transaction details">
          <span
            onClick={() => handleView(record)}
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
      width: 200,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasValidProfilePic(record.avatar) ? (
            <Avatar src={record.avatar} size={34} style={{ flexShrink: 0 }} />
          ) : (
            <Avatar
              icon={<UserOutlined style={{ fontSize: 16 }} />}
              size={34}
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
              onClick={() => handleView(record)}
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: isDarkMode ? '#818cf8' : '#4338ca',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {record.customerName}
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {record.customerPhone !== '—' ? record.customerPhone : record.customerId}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Reference / Item',
      key: 'reference',
      width: 170,
      render: (_, record) => {
        const isMem = record.referenceType === 'MEMBERSHIP';
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Tag
                color={isMem ? 'purple' : 'blue'}
                style={{ padding: '1px 6px', fontSize: 10, fontWeight: 700, borderRadius: 4, margin: 0 }}
              >
                {isMem ? 'Membership' : 'Booking'}
              </Tag>
              <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: '#4f46e5' }}>
                {record.referenceId}
              </span>
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: isDarkMode ? '#cbd5e1' : '#475569',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 160,
              }}
            >
              {record.title}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Gym Partner',
      key: 'gym',
      width: 170,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            {record.gymName}
          </div>
          <div style={{ fontSize: 11.5, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            {record.gymLocation}
          </div>
        </div>
      ),
    },
    {
      title: 'Date & Time',
      dataIndex: 'dateTime',
      key: 'dateTime',
      width: 170,
      render: (text) => (
        <span style={{ fontSize: 12.5, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (val) => (
        <span style={{ fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          ₹ {Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      title: 'Payment Mode',
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      width: 130,
      render: (mode) => (
        <Tag
          color="default"
          style={{
            borderRadius: 6,
            fontWeight: 600,
            fontSize: 12,
            backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
            borderColor: isDarkMode ? '#334155' : '#cbd5e1',
          }}
        >
          {mode || 'UPI'}
        </Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        let bg = isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef';
        let color = '#00bf62';
        if (status === 'Cancelled' || status === 'Failed') {
          bg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed';
          color = '#e11d48';
        } else if (status === 'Pending') {
          bg = isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef4e8';
          color = '#d97706';
        } else if (status === 'Refunded') {
          bg = isDarkMode ? 'rgba(168, 85, 247, 0.15)' : '#f3effe';
          color = '#7e22ce';
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
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 90,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
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
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* 1. TOP 5 LIVE METRIC CARDS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Total Transactions */}
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
              <CreditCardOutlined style={{ fontSize: 20, color: '#6366f1' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Total Transactions
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {(stats.totalTransactions || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                All Platform Txns
              </div>
            </div>
          </div>
        </Card>

        {/* Successful */}
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
              <CheckCircleOutlined style={{ fontSize: 20, color: '#00bf62' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Successful
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {(stats.successfulTransactions || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00bf62' }}>
                {stats.successfulPct || '0%'}
              </div>
            </div>
          </div>
        </Card>

        {/* Pending */}
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
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Pending
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {(stats.pendingTransactions || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>
                {stats.pendingPct || '0%'}
              </div>
            </div>
          </div>
        </Card>

        {/* Failed / Cancelled */}
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
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Failed / Cancelled
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {(stats.failedTransactions || 0).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
                {stats.failedPct || '0%'}
              </div>
            </div>
          </div>
        </Card>

        {/* Total Amount */}
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
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Total Revenue
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                ₹ {Number(stats.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>
                Gross Settlement
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 2. FILTER CONTROLS & EXPORT BAR */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 16,
        }}
        styles={{ body: { padding: '14px 18px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            <Input
              placeholder="Search by customer name, phone, transaction ID, booking ID..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={() => {
                setCurrentPage(1);
                fetchTransactions(1, searchQuery, paymentModeFilter, statusFilter);
              }}
              style={{ minWidth: 260, maxWidth: 380, borderRadius: 'var(--radius-base)' }}
              allowClear
            />

            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                setCurrentPage(1);
                fetchTransactions(1, searchQuery, paymentModeFilter, statusFilter);
              }}
              style={{ backgroundColor: '#4f46e5', borderRadius: 'var(--radius-base)' }}
            >
              Search
            </Button>

            <Select
              value={paymentModeFilter}
              onChange={(val) => {
                setPaymentModeFilter(val);
                setCurrentPage(1);
              }}
              style={{ width: 170 }}
            >
              <Option value="all">All Payment Modes</Option>
              <Option value="UPI">UPI</Option>
              <Option value="Card">Card</Option>
              <Option value="Net Banking">Net Banking</Option>
              <Option value="Cash">Cash / Desk</Option>
              <Option value="Wallet">Wallet</Option>
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
              <Option value="Completed">Completed</Option>
              <Option value="Pending">Pending</Option>
              <Option value="Cancelled">Cancelled</Option>
              <Option value="Refunded">Refunded</Option>
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

      {/* 3. TRANSACTIONS TABLE */}
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
          dataSource={transactions}
          loading={loading}
          pagination={false}
          rowKey={(r) => r.key || r.transactionId}
          scroll={{ x: 1200 }}
          locale={{ emptyText: 'No transactions found for the selected filter.' }}
        />

        {/* Server-Side Pagination Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderTop: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
            Showing {transactions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} transactions
          </div>
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

      {/* 4. TRANSACTION DETAILS POPUP MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, fontWeight: 800 }}>
            <WalletOutlined style={{ color: '#4f46e5' }} />
            <span>Transaction Details</span>
          </div>
        }
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => setIsDetailsModalOpen(false)}
            style={{ backgroundColor: '#4f46e5', minWidth: 90 }}
          >
            Close
          </Button>,
        ]}
        width={680}
        centered
      >
        {selectedTransaction && (
          <div style={{ paddingTop: 10 }}>
            {/* Status & ID Badge Row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    padding: '3px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor:
                      selectedTransaction.status === 'Completed'
                        ? isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef'
                        : isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
                    color: selectedTransaction.status === 'Completed' ? '#00bf62' : '#e11d48',
                  }}
                >
                  ● {selectedTransaction.status}
                </span>
                <Tag color={selectedTransaction.referenceType === 'MEMBERSHIP' ? 'purple' : 'blue'}>
                  {selectedTransaction.referenceType === 'MEMBERSHIP' ? 'Membership Purchase' : 'Session Booking'}
                </Tag>
              </div>

              <span style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                Ref ID:{' '}
                <strong style={{ color: '#4f46e5', fontFamily: 'monospace' }}>
                  {selectedTransaction.referenceId}
                </strong>
              </span>
            </div>

            {/* Customer & Gym Info Card */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                borderRadius: 12,
                marginBottom: 16,
                gap: 12,
              }}
            >
              {/* Customer */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {hasValidProfilePic(selectedTransaction.avatar) ? (
                  <Avatar src={selectedTransaction.avatar} size={44} />
                ) : (
                  <Avatar
                    icon={<UserOutlined style={{ fontSize: 22 }} />}
                    size={44}
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe',
                      color: '#6366f1',
                    }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedTransaction.customerName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '2px 0' }}>
                    <span style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>Customer ID:</span>
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe',
                        color: '#4f46e5',
                      }}
                    >
                      {selectedTransaction.customerId}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: isDarkMode ? '#cbd5e1' : '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <PhoneOutlined style={{ color: '#6366f1', fontSize: 10 }} />
                    <span>{selectedTransaction.customerPhone}</span>
                  </div>
                </div>
              </div>

              {/* Gym */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b' }}>
                  Gym Partner
                </div>
                <div style={{ fontWeight: 700, fontSize: 13, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 3 }}>
                  {selectedTransaction.gymName}
                </div>
                <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 2 }}>
                  <EnvironmentOutlined style={{ color: '#6366f1', fontSize: 10 }} />
                  <span>{selectedTransaction.gymLocation}</span>
                </div>
              </div>
            </div>

            {/* Payment Ledger Breakdown */}
            <div
              style={{
                padding: '14px 16px',
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                borderRadius: 10,
                marginBottom: 18,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>Total Amount Paid</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: '#00bf62' }}>
                  ₹ {Number(selectedTransaction.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>Payment Mode</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                  {selectedTransaction.paymentMode}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>Transaction ID (Gateway)</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', fontFamily: 'monospace' }}>
                  {selectedTransaction.gatewayTxnId}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>Transaction Date</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
                  {selectedTransaction.transactionDate}
                </span>
              </div>
            </div>

            {/* Need Help? Action Buttons */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 4 }}>
                Actions & Adjustments
              </div>
              <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 12 }}>
                Initiate a refund or cancel the associated booking if required.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Button
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => setIsCancelModalOpen(true)}
                  style={{ borderRadius: 'var(--radius-base)', fontWeight: 700, fontSize: 12 }}
                >
                  Cancel Booking
                </Button>

                <Button
                  type="primary"
                  icon={<DollarOutlined />}
                  onClick={() => setIsRefundModalOpen(true)}
                  style={{
                    borderRadius: 'var(--radius-base)',
                    fontWeight: 700,
                    fontSize: 12,
                    backgroundColor: '#4f46e5',
                    borderColor: '#4f46e5',
                  }}
                >
                  Initiate Refund
                </Button>
              </div>
            </div>

            {/* Information Alert Box */}
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
                Refunds are processed back to the original source payment method (UPI / Card / Net Banking) within 3–5 working days.
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* INITIATE REFUND MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800 }}>Initiate Refund</span>}
        open={isRefundModalOpen}
        onCancel={() => setIsRefundModalOpen(false)}
        onOk={handleInitiateRefund}
        okText="Confirm & Process Refund"
        okButtonProps={{ style: { backgroundColor: '#4f46e5' } }}
        centered
      >
        <div style={{ paddingTop: 12 }}>
          <p style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
            Are you sure you want to refund <strong>₹ {selectedTransaction?.amount}</strong> for transaction{' '}
            <strong>{selectedTransaction?.transactionId}</strong>?
          </p>
          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              Reason for Refund
            </label>
            <Select value={refundReason} onChange={setRefundReason} style={{ width: '100%' }}>
              <Option value="Customer Request">Customer Request</Option>
              <Option value="Gym Closed / Slot Cancelled">Gym Closed / Slot Cancelled</Option>
              <Option value="Duplicate Payment">Duplicate Payment</Option>
              <Option value="Other">Other</Option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* CANCEL BOOKING MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800, color: '#ef4444' }}>Cancel Booking</span>}
        open={isCancelModalOpen}
        onCancel={() => setIsCancelModalOpen(false)}
        onOk={handleCancelBooking}
        okText="Yes, Cancel Booking"
        okButtonProps={{ danger: true }}
        centered
      >
        <p style={{ paddingTop: 12, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
          Are you sure you want to cancel booking <strong>{selectedTransaction?.bookingId}</strong> for customer{' '}
          <strong>{selectedTransaction?.customerName}</strong>?
        </p>
      </Modal>
    </div>
  );
};

export default TransactionsManagement;
