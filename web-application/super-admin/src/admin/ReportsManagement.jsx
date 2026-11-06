import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  DatePicker,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  MoreOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { useDebounce } from '../hooks/useDebounce';
import { reportService } from '../services/reportService';

const { Option } = Select;
const { RangePicker } = DatePicker;

export const ReportsManagement = () => {
  const { isDarkMode } = useTheme();

  // Filters State
  const [reportType, setReportType] = useState('Customer Report');
  const [customerType, setCustomerType] = useState('All');
  const [bookingType, setBookingType] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState(null);

  // Live Database Data & KPI Metrics State
  const [customers, setCustomers] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [didYouMean, setDidYouMean] = useState(null);
  const [stats, setStats] = useState({
    totalCustomers: '0',
    activeCustomers: '0',
    activePct: '0%',
    inactiveCustomers: '0',
    inactivePct: '0%',
    totalBookings: '0',
    revenueGenerated: '0',
  });

  // Detail Modal State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Actual Report Data from Backend API
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        search: debouncedSearch?.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        customerType: customerType === 'All' ? undefined : customerType,
        bookingType: bookingType === 'All' ? undefined : bookingType,
        startDate: dateRange && dateRange[0] ? dateRange[0].toISOString() : undefined,
        endDate: dateRange && dateRange[1] ? dateRange[1].toISOString() : undefined,
      };
      const res = await reportService.getCustomerReports(params);
      if (res?.customers) {
        setCustomers(res.customers);
        setTotalRecords(res.pagination?.totalRecords ?? res.customers.length);
        if (res.stats) setStats(res.stats);
        setDidYouMean(res.didYouMean || null);
      }
    } catch (err) {
      console.error('Failed to load actual customer reports:', err);
      message.error('Failed to load actual report data');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, statusFilter, customerType, bookingType, dateRange]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Global App Refresh listener (from breadcrumbs)
  useEffect(() => {
    const handleRefresh = () => {
      fetchReports();
    };
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchReports]);

  // Handle Reset
  const handleReset = () => {
    setReportType('Customer Report');
    setCustomerType('All');
    setBookingType('All');
    setStatusFilter('all');
    setSearchQuery('');
    setDateRange(null);
    setCurrentPage(1);
    message.info('Filters have been reset.');
  };

  // Handle Export Actual Data as CSV
  const handleExport = () => {
    if (!customers || customers.length === 0) {
      message.warning('No customer records to export');
      return;
    }
    const headers = [
      'Customer Name',
      'Customer ID',
      'Phone Number',
      'Email',
      'Status',
      'Last Activity Date',
      'Total Bookings',
      'Completed Bookings',
      'Cancelled Bookings',
      'No Show',
      'Revenue Generated (INR)',
    ];
    const rows = customers.map((c) => [
      `"${c.name || ''}"`,
      `"${c.customerId || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.email || ''}"`,
      `"${c.status || ''}"`,
      `"${c.lastBookingDate || ''}"`,
      c.totalBookings || 0,
      c.completed || 0,
      c.cancelled || 0,
      c.noShow || 0,
      `"${c.revenueGenerated || 0}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Gymezy_Customer_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Actual customer report exported successfully');
  };

  // Action Menu Dropdown
  const getActionMenu = (record) => ({
    items: [
      {
        key: 'view',
        icon: <EyeOutlined />,
        label: 'View Full Customer History',
        onClick: () => {
          setSelectedCustomer(record);
          setIsModalOpen(true);
        },
      },
      {
        key: 'download',
        icon: <DownloadOutlined />,
        label: 'Download Customer Statement',
        onClick: () => message.success(`Downloading statement for ${record.name}...`),
      },
    ],
  });

  // Table Columns
  const columns = [
    {
      title: 'Customer Name',
      key: 'name',
      width: 190,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: record.avatarColor,
              color: record.avatarTextColor,
              fontWeight: 800,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {record.initials}
          </div>
          <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            {record.name}
          </span>
        </div>
      ),
    },
    {
      title: 'Customer ID',
      dataIndex: 'customerId',
      key: 'customerId',
      width: 130,
      render: (id) => (
        <span style={{ fontWeight: 700, color: '#4f46e5', letterSpacing: '0.2px' }}>
          {id}
        </span>
      ),
    },
    {
      title: (
        <span>
          Last Booking Date <span style={{ color: '#4f46e5' }}>⇅</span>
        </span>
      ),
      dataIndex: 'lastBookingDate',
      key: 'lastBookingDate',
      width: 180,
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
      width: 130,
      render: (status) => {
        const isActive = status === 'Active';
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: isActive
                ? isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef'
                : isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
              color: isActive ? '#00bf62' : '#e11d48',
            }}
          >
            <span>●</span>
            <span>{status}</span>
          </span>
        );
      },
    },
    {
      title: 'Total Bookings',
      dataIndex: 'totalBookings',
      key: 'totalBookings',
      width: 130,
      align: 'center',
      render: (val) => (
        <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          {val}
        </span>
      ),
    },
    {
      title: 'Completed',
      dataIndex: 'completed',
      key: 'completed',
      width: 110,
      align: 'center',
      render: (val) => (
        <span style={{ fontWeight: 700, color: '#00bf62' }}>
          {val}
        </span>
      ),
    },
    {
      title: 'Cancelled',
      dataIndex: 'cancelled',
      key: 'cancelled',
      width: 110,
      align: 'center',
      render: (val) => (
        <span style={{ fontWeight: 700, color: '#ef4444' }}>
          {val}
        </span>
      ),
    },
    {
      title: 'No Show',
      dataIndex: 'noShow',
      key: 'noShow',
      width: 110,
      align: 'center',
      render: (val) => (
        <span style={{ fontWeight: 700, color: '#f59e0b' }}>
          {val}
        </span>
      ),
    },
    {
      title: 'Revenue Generated',
      dataIndex: 'revenueGenerated',
      key: 'revenueGenerated',
      width: 160,
      render: (val) => (
        <span style={{ fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          ₹ {val}
        </span>
      ),
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
            onClick={() => {
              setSelectedCustomer(record);
              setIsModalOpen(true);
            }}
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
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 30 }}>
      {/* 1. TOP FILTERS BAR */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: 1 }}>
            {/* Search Input */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 4 }}>
                Search Customer
              </div>
              <Input
                placeholder="Search name, phone, ID..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ width: 200, borderRadius: 'var(--radius-base)' }}
                allowClear
              />
            </div>

            {/* Report Type */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 4 }}>
                Report Type
              </div>
              <Select value={reportType} onChange={setReportType} style={{ width: 170 }}>
                <Option value="Customer Report">Customer Report</Option>
                <Option value="Gym Performance Report">Gym Performance Report</Option>
                <Option value="Revenue Report">Revenue Report</Option>
                <Option value="Booking Summary Report">Booking Summary Report</Option>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 4 }}>
                Date Range
              </div>
              <RangePicker
                value={dateRange}
                onChange={(dates) => {
                  setDateRange(dates);
                  setCurrentPage(1);
                }}
                format="DD MMM YYYY"
                placeholder={['Start Date', 'End Date']}
                style={{ borderRadius: 'var(--radius-base)', width: 230 }}
              />
            </div>

            {/* Customer Type */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 4 }}>
                Customer Type
              </div>
              <Select
                value={customerType}
                onChange={(val) => {
                  setCustomerType(val);
                  setCurrentPage(1);
                }}
                style={{ width: 130 }}
              >
                <Option value="All">All</Option>
                <Option value="New">New</Option>
                <Option value="Returning">Returning</Option>
                <Option value="VIP">VIP</Option>
              </Select>
            </div>

            {/* Booking Type */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 4 }}>
                Booking Type
              </div>
              <Select
                value={bookingType}
                onChange={(val) => {
                  setBookingType(val);
                  setCurrentPage(1);
                }}
                style={{ width: 130 }}
              >
                <Option value="All">All</Option>
                <Option value="App Booking">App Booking</Option>
                <Option value="Walk-in">Walk-in</Option>
              </Select>
            </div>

            {/* Status */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: isDarkMode ? '#888888' : '#64748b', marginBottom: 4 }}>
                Status
              </div>
              <Select
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                style={{ width: 130 }}
              >
                <Option value="all">All Status</Option>
                <Option value="active">Active</Option>
                <Option value="inactive">Inactive</Option>
              </Select>
            </div>

            {/* Reset Button */}
            <div style={{ marginTop: 20 }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleReset}
                style={{
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                }}
              >
                Reset
              </Button>
            </div>
          </div>

          {/* Export to Excel on Right */}
          <div style={{ marginTop: 20 }}>
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleExport}
              style={{
                borderRadius: 'var(--radius-base)',
                fontWeight: 700,
                backgroundColor: '#4f46e5',
                borderColor: '#4f46e5',
              }}
            >
              Export to Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. TOP 5 KPI METRIC CARDS (IN ONE LINE) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Total Customers */}
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
                Total Customers
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {stats.totalCustomers || '0'}
              </div>
            </div>
          </div>
        </Card>

        {/* Active Customers */}
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
              <UserOutlined style={{ fontSize: 20, color: '#00bf62' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Active Customers
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {stats.activeCustomers || '0'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#00bf62' }}>
                {stats.activePct || '0%'}
              </div>
            </div>
          </div>
        </Card>

        {/* Inactive Customers */}
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
              <TeamOutlined style={{ fontSize: 20, color: '#ef4444' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Inactive Customers
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {stats.inactiveCustomers || '0'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
                {stats.inactivePct || '0%'}
              </div>
            </div>
          </div>
        </Card>

        {/* Total Bookings */}
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
                backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#edf4fe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarOutlined style={{ fontSize: 20, color: '#3b82f6' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Total Bookings
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                {stats.totalBookings || '0'}
              </div>
            </div>
          </div>
        </Card>

        {/* Revenue Generated */}
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
              <span style={{ fontSize: 20, fontWeight: 900, color: '#6366f1' }}>₹</span>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Revenue Generated
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0', whiteSpace: 'nowrap' }}>
                ₹ {stats.revenueGenerated || '0'}
              </div>
            </div>
          </div>
        </Card>
      </div>

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

      {/* 3. REPORT DATA TABLE */}
      <Card
        style={{
          backgroundColor: 'var(--bg-surface-elevated)',
          borderColor: 'var(--border-color)',
          borderRadius: 'var(--radius-base)',
          marginBottom: 16,
        }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Table Top Header */}
        <div style={{ padding: '20px 24px 16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Customer Report</span>
              <InfoCircleOutlined style={{ fontSize: 14, color: isDarkMode ? '#888888' : '#64748b' }} />
            </div>
            <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
              List of customers with their booking summary and revenue details.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>
              Showing {totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} entries
            </span>
            <Pagination
              current={currentPage}
              total={totalRecords}
              pageSize={pageSize}
              onChange={(page, pSize) => {
                setCurrentPage(page);
                setPageSize(pSize);
              }}
              size="small"
            />
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={customers}
          loading={loading}
          pagination={false}
          rowKey={(record) => record._id || record.customerId || record.key}
          scroll={{ x: 1350 }}
        />

        {/* Bottom Pagination Bar */}
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
            Showing {totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} entries
          </div>
          <Pagination
            current={currentPage}
            total={totalRecords}
            pageSize={pageSize}
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

      {/* CUSTOMER REPORT DETAILS MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800 }}>Customer Performance Ledger</span>}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsModalOpen(false)} style={{ backgroundColor: '#4f46e5' }}>
            Close
          </Button>,
        ]}
        centered
      >
        {selectedCustomer && (
          <div style={{ paddingTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: selectedCustomer.avatarColor,
                  color: selectedCustomer.avatarTextColor,
                  fontWeight: 800,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selectedCustomer.initials}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCustomer.name}
                </div>
                <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 700 }}>
                  {selectedCustomer.customerId}
                </div>
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: isDarkMode ? '#141414' : '#f8fafc', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Total Bookings:</span>
                <strong>{selectedCustomer.totalBookings}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Completed Bookings:</span>
                <strong style={{ color: '#00bf62' }}>{selectedCustomer.completed}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Cancelled Bookings:</span>
                <strong style={{ color: '#ef4444' }}>{selectedCustomer.cancelled}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>No Show Bookings:</span>
                <strong style={{ color: '#f59e0b' }}>{selectedCustomer.noShow}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`, paddingTop: 8 }}>
                <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Total Revenue Generated:</span>
                <strong style={{ color: isDarkMode ? '#ffffff' : '#0f172a', fontSize: 15 }}>₹ {selectedCustomer.revenueGenerated}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportsManagement;
