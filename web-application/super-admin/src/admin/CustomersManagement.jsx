import React, { useState, useEffect, useCallback } from 'react';
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
  Form,
  Pagination,
  Space,
  message,
  Avatar,
  Spin,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  PhoneOutlined,
  MailOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ShopOutlined,
  StarFilled,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { customerService } from '../services/customerService';

const { Option } = Select;

const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed) return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

export const CustomersManagement = () => {
  const { isDarkMode } = useTheme();

  // Navigation View State: 'list' | 'detail'
  const [currentView, setCurrentView] = useState('list');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Live Server Data & Pagination States
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
  });
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('CUSTOMER');

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();

  // Modal State for Booking & Gym Details
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedGymInfo, setSelectedGymInfo] = useState(null);
  const [detailTab, setDetailTab] = useState('bookings'); // 'bookings' | 'memberships'

  // Load paginated customers from middleware API (SSOT)
  const fetchCustomers = useCallback(
    async (page = currentPage, query = searchQuery, status = statusFilter, role = roleFilter) => {
      setLoading(true);
      try {
        const data = await customerService.getCustomers({
          page,
          limit: pageSize,
          search: query.trim() || undefined,
          status: status !== 'all' ? status : undefined,
          role: role !== 'all' ? role : undefined,
        });
        setCustomers(data.customers || []);
        setTotalRecords(data.pagination?.totalRecords || 0);
        if (data.stats) {
          setStats(data.stats);
        }
      } catch (err) {
        message.error(err.message || 'Failed to fetch customers from server');
      } finally {
        setLoading(false);
      }
    },
    [currentPage, pageSize, searchQuery, statusFilter, roleFilter]
  );

  useEffect(() => {
    fetchCustomers(currentPage, searchQuery, statusFilter, roleFilter);
  }, [currentPage, pageSize, statusFilter, roleFilter]);

  // Handle View Customer Detail
  const handleViewCustomer = async (record) => {
    setSelectedCustomer(record);
    setCurrentView('detail');
    try {
      const detail = await customerService.getCustomerById(record.id || record._id);
      if (detail) {
        setSelectedCustomer(detail);
      }
    } catch {
      // Keep basic customer data loaded from table
    }
  };

  // Handle Toggle Active/Inactive Status
  const handleToggleStatus = async (record) => {
    try {
      const res = await customerService.toggleCustomerStatus(record.id || record._id);
      message.success(res.message || 'Customer status updated successfully');
      await fetchCustomers(currentPage, searchQuery, statusFilter, roleFilter);
      if (selectedCustomer && (selectedCustomer.id === record.id || selectedCustomer._id === record._id)) {
        setSelectedCustomer((prev) => ({
          ...prev,
          status: prev.status === 'Active' ? 'Inactive' : 'Active',
          isActive: !prev.isActive,
        }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to update customer status');
    }
  };

  // Handle Add Customer Submit
  const handleAddCustomerSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      await customerService.createCustomer({
        fullName: values.name,
        name: values.name,
        email: values.email,
        phone: values.phone,
        status: values.status,
      });
      message.success(`Customer "${values.name}" created successfully!`);
      setIsAddModalOpen(false);
      form.resetFields();
      await fetchCustomers(1, searchQuery, statusFilter, roleFilter);
    } catch (err) {
      message.error(err.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Customer Submit
  const handleEditCustomerSubmit = async (values) => {
    if (!selectedCustomer) return;
    setIsSubmitting(true);
    try {
      const targetId = selectedCustomer.id || selectedCustomer._id;
      await customerService.updateCustomer(targetId, {
        fullName: values.name,
        name: values.name,
        email: values.email,
        phone: values.phone,
        status: values.status,
      });
      message.success('Customer details updated successfully!');
      setIsEditModalOpen(false);
      await fetchCustomers(currentPage, searchQuery, statusFilter, roleFilter);
      const updated = await customerService.getCustomerById(targetId);
      if (updated) setSelectedCustomer(updated);
    } catch (err) {
      message.error(err.message || 'Failed to update customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export Customer List as CSV
  const handleExportCSV = () => {
    if (customers.length === 0) {
      message.warning('No customer records available to export.');
      return;
    }
    const headers = ['Customer ID', 'Full Name', 'Phone', 'Email', 'Role', 'Status', 'Total Bookings', 'Total Revenue'];
    const rows = customers.map((c) => [
      c.customerId || '',
      `"${c.name || c.fullName || ''}"`,
      c.phone || '',
      c.email || '',
      c.role || 'CUSTOMER',
      c.status || 'Active',
      c.totalBookings || 0,
      c.totalRevenue || 0,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Customers exported successfully!');
  };

  // Table Columns for Customer List
  const customerColumns = [
    {
      title: 'Customer Name',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (_, record) => (
        <div
          onClick={() => handleViewCustomer(record)}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          {hasValidProfilePic(record.avatar) ? (
            <Avatar
              src={record.avatar}
              size={36}
              style={{ flexShrink: 0 }}
            />
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
          <div>
            <div
              style={{
                fontWeight: 700,
                color: isDarkMode ? '#818cf8' : '#4338ca',
                transition: 'all 0.15s ease',
              }}
            >
              {record.name}
            </div>
            {record.role && record.role !== 'CUSTOMER' && (
              <Tag color="purple" style={{ fontSize: 10, lineHeight: '16px', padding: '0 6px', margin: 0, marginTop: 2 }}>
                {record.role}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Customer ID',
      dataIndex: 'customerId',
      key: 'customerId',
      width: 140,
      render: (text, record) => (
        <span
          onClick={() => handleViewCustomer(record)}
          style={{
            fontWeight: 700,
            color: '#4f46e5',
            letterSpacing: '0.2px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (text) => (
        <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Email ID',
      dataIndex: 'email',
      key: 'email',
      width: 210,
      render: (text) => (
        <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Total Bookings',
      dataIndex: 'totalBookings',
      key: 'totalBookings',
      width: 130,
      align: 'center',
      render: (val) => (
        <span style={{ fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          {val || 0}
        </span>
      ),
    },
    {
      title: 'Total Revenue',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      width: 140,
      render: (val) => (
        <span style={{ fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          ₹ {val || '0.00'}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const isActive = status === 'Active';
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: isActive
                ? isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef'
                : isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
              color: isActive ? '#00bf62' : '#e11d48',
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
      width: 150,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size={6}>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewCustomer(record)}
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
          <Button
            size="small"
            danger={record.status === 'Active'}
            onClick={() => handleToggleStatus(record)}
            style={{
              borderRadius: 'var(--radius-base)',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {record.status === 'Active' ? 'Deactivate' : 'Activate'}
          </Button>
        </Space>
      ),
    },
  ];

  // Recent Bookings Columns for Customer Detail View
  const recentBookingsColumns = [
    {
      title: 'Booking ID',
      dataIndex: 'bookingId',
      key: 'bookingId',
      width: 130,
      render: (text, record) => (
        <span
          onClick={() => setSelectedBooking(record)}
          style={{
            fontWeight: 700,
            color: '#4f46e5',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'bookingType',
      key: 'bookingType',
      width: 130,
      render: (type) => {
        const isGroup = type === 'GROUP_CLASS';
        return (
          <Tag color={isGroup ? 'purple' : 'blue'} style={{ fontWeight: 700, borderRadius: 4 }}>
            {isGroup ? 'Group Class' : 'Gym Session'}
          </Tag>
        );
      },
    },
    {
      title: 'Gym Partner',
      dataIndex: 'gymName',
      key: 'gymName',
      width: 170,
      render: (text, record) => (
        <span
          onClick={() => setSelectedGymInfo({ name: text, location: record.gymCity || 'Chennai' })}
          style={{
            fontWeight: 600,
            color: isDarkMode ? '#818cf8' : '#4338ca',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: 'Section / Session',
      dataIndex: 'sectionName',
      key: 'sectionName',
      width: 160,
      render: (text) => (
        <span style={{ color: isDarkMode ? '#cbd5e1' : '#334155', fontWeight: 600 }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Date & Time Slot',
      key: 'dateTime',
      width: 190,
      render: (_, record) => {
        const slot = record.timeSlot && record.timeSlot !== 'undefined - undefined'
          ? record.timeSlot
          : 'General Session';
        return (
          <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>
            {record.date} • {slot}
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        let bg = isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef';
        let color = '#00bf62';
        if (status === 'Cancelled') {
          bg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed';
          color = '#e11d48';
        } else if (status === 'Upcoming' || status === 'Active') {
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
            {status}
          </span>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (val) => (
        <span style={{ fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          ₹ {val}
        </span>
      ),
    },
  ];

  // Memberships Columns for Customer Detail View
  const recentMembershipsColumns = [
    {
      title: 'Membership ID',
      dataIndex: 'membershipId',
      key: 'membershipId',
      width: 140,
      render: (text) => (
        <span style={{ fontWeight: 750, color: '#4f46e5', fontFamily: 'monospace' }}>
          {text}
        </span>
      ),
    },
    {
      title: 'Plan Tier',
      dataIndex: 'membershipTier',
      key: 'membershipTier',
      width: 130,
      render: (tier) => (
        <Tag color="purple" style={{ fontWeight: 700, borderRadius: 4 }}>
          {tier} Plan
        </Tag>
      ),
    },
    {
      title: 'Gym Partner',
      dataIndex: 'gymName',
      key: 'gymName',
      width: 170,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 600, color: isDarkMode ? '#cbd5e1' : '#334155' }}>
            {text}
          </div>
          <div style={{ fontSize: 11, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
            {record.gymCity}
          </div>
        </div>
      ),
    },
    {
      title: 'Validity Period',
      key: 'validity',
      width: 200,
      render: (_, record) => (
        <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 12 }}>
          {record.startDate} — {record.endDate}
        </span>
      ),
    },
    {
      title: 'Trainer Assigned',
      key: 'trainer',
      width: 150,
      render: (_, record) =>
        record.hasTrainer ? (
          <Tag color="green" style={{ fontWeight: 600, borderRadius: 4 }}>
            {record.trainerName}
          </Tag>
        ) : (
          <span style={{ color: isDarkMode ? '#64748b' : '#94a3b8', fontSize: 12 }}>
            No Trainer
          </span>
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
        if (status === 'Cancelled' || status === 'Expired') {
          bg = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed';
          color = '#e11d48';
        } else if (status === 'Upcoming' || status === 'Active') {
          bg = isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#edf4fe';
          color = '#3b82f6';
        } else if (status === 'Expiring Soon') {
          bg = isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#fef4e8';
          color = '#f59e0b';
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
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (val) => (
        <span style={{ fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
          ₹ {val}
        </span>
      ),
    },
  ];

  // -------------------------------------------------------------
  // RENDER SCREEN 2: CUSTOMER DETAIL VIEW
  // -------------------------------------------------------------
  if (currentView === 'detail' && selectedCustomer) {
    return (
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Back Button Navigation */}
        <div style={{ marginBottom: 20 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => setCurrentView('list')}
            style={{
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Back to Customers List
          </Button>
        </div>

        {/* 1. TOP CUSTOMER PROFILE CARD */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
            marginBottom: 20,
          }}
          styles={{ body: { padding: '24px 28px' } }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            {/* Left: Avatar + Details */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              {hasValidProfilePic(selectedCustomer.avatar) ? (
                <Avatar
                  size={80}
                  src={selectedCustomer.avatar}
                  style={{
                    backgroundColor: '#e0e7ff',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Avatar
                  size={80}
                  icon={<UserOutlined style={{ fontSize: 38 }} />}
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe',
                    color: '#4f46e5',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              )}

              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a', marginBottom: 6 }}>
                  {selectedCustomer.name}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                    Customer ID
                  </span>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#ede9fe',
                      color: '#4f46e5',
                    }}
                  >
                    {selectedCustomer.customerId}
                  </span>
                  {selectedCustomer.role && selectedCustomer.role !== 'CUSTOMER' && (
                    <Tag color="purple" style={{ fontWeight: 700 }}>
                      {selectedCustomer.role}
                    </Tag>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isDarkMode ? '#cbd5e1' : '#334155', fontSize: 13 }}>
                    <PhoneOutlined style={{ color: '#6366f1' }} />
                    <span>{selectedCustomer.phone}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isDarkMode ? '#cbd5e1' : '#334155', fontSize: 13 }}>
                    <MailOutlined style={{ color: '#6366f1' }} />
                    <span>{selectedCustomer.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Status Pill & Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 20,
                  backgroundColor: selectedCustomer.status === 'Active'
                    ? isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef'
                    : isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: selectedCustomer.status === 'Active' ? '#00bf62' : '#e11d48',
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: selectedCustomer.status === 'Active' ? '#00bf62' : '#e11d48',
                  }}
                >
                  {selectedCustomer.status}
                </span>
              </div>

              <Button
                icon={selectedCustomer.status === 'Active' ? <StopOutlined /> : <CheckCircleOutlined />}
                danger={selectedCustomer.status === 'Active'}
                onClick={() => handleToggleStatus(selectedCustomer)}
                style={{ borderRadius: 'var(--radius-base)', fontWeight: 600 }}
              >
                {selectedCustomer.status === 'Active' ? 'Deactivate' : 'Activate'}
              </Button>

              <Button
                icon={<EditOutlined />}
                onClick={() => {
                  editForm.setFieldsValue({
                    name: selectedCustomer.name,
                    phone: selectedCustomer.phone,
                    email: selectedCustomer.email,
                    status: selectedCustomer.status,
                  });
                  setIsEditModalOpen(true);
                }}
                style={{
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  color: '#4f46e5',
                  borderColor: isDarkMode ? '#3730a3' : '#c7d2fe',
                }}
              >
                Edit
              </Button>
            </div>
          </div>
        </Card>

        {/* 2. MIDDLE 5-SEGMENT METRIC BAR */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
            marginBottom: 20,
          }}
          styles={{ body: { padding: '20px 24px' } }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {/* Metric 1: Total Bookings */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                <CalendarOutlined style={{ fontSize: 22, color: '#3b82f6' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Bookings
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCustomer.metrics?.totalBookings ?? selectedCustomer.totalBookings ?? 0}
                </div>
              </div>
            </div>

            {/* Metric 2: Completed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                <CheckCircleOutlined style={{ fontSize: 22, color: '#00bf62' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Completed
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCustomer.metrics?.completed ?? 0}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#00bf62' }}>
                  {selectedCustomer.metrics?.completedPct || '0%'}
                </div>
              </div>
            </div>

            {/* Metric 3: Cancelled */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CloseCircleOutlined style={{ fontSize: 22, color: '#ef4444' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Cancelled
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCustomer.metrics?.cancelled ?? 0}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
                  {selectedCustomer.metrics?.cancelledPct || '0%'}
                </div>
              </div>
            </div>

            {/* Metric 4: Join Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                <ClockCircleOutlined style={{ fontSize: 22, color: '#f59e0b' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Member Since
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCustomer.joinDate || 'Recent'}
                </div>
              </div>
            </div>

            {/* Metric 5: Total Revenue */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
                <span style={{ fontSize: 22, fontWeight: 900, color: '#6366f1' }}>₹</span>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Spend
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  ₹ {selectedCustomer.metrics?.totalRevenue ?? selectedCustomer.totalRevenue ?? '0.00'}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* 3. RECENT ACTIVITY: GROUP CLASSES, BOOKINGS & MEMBERSHIPS TABS */}
        <Card
          style={{
            backgroundColor: 'var(--bg-surface-elevated)',
            borderColor: 'var(--border-color)',
            borderRadius: 'var(--radius-base)',
            marginBottom: 30,
          }}
          styles={{ body: { padding: '24px' } }}
        >
          {/* Sub-Tabs: Group Classes & Bookings vs. Memberships */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 20,
              borderBottom: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`,
              paddingBottom: 12,
            }}
          >
            <Button
              type={detailTab === 'bookings' ? 'primary' : 'text'}
              onClick={() => setDetailTab('bookings')}
              style={{
                borderRadius: 20,
                fontWeight: 700,
                backgroundColor: detailTab === 'bookings' ? '#4f46e5' : 'transparent',
              }}
            >
              Group Classes & Bookings ({(selectedCustomer.recentBookings || []).length})
            </Button>
            <Button
              type={detailTab === 'memberships' ? 'primary' : 'text'}
              onClick={() => setDetailTab('memberships')}
              style={{
                borderRadius: 20,
                fontWeight: 700,
                backgroundColor: detailTab === 'memberships' ? '#4f46e5' : 'transparent',
              }}
            >
              Memberships ({(selectedCustomer.recentMemberships || []).length})
            </Button>
          </div>

          {detailTab === 'bookings' ? (
            <Table
              columns={recentBookingsColumns}
              dataSource={selectedCustomer.recentBookings || []}
              pagination={false}
              rowKey="key"
              scroll={{ x: 950 }}
              locale={{ emptyText: 'No booking or pass records found for this customer.' }}
            />
          ) : (
            <Table
              columns={recentMembershipsColumns}
              dataSource={selectedCustomer.recentMemberships || []}
              pagination={false}
              rowKey="key"
              scroll={{ x: 950 }}
              locale={{ emptyText: 'No gym membership records found for this customer.' }}
            />
          )}
        </Card>

        {/* EDIT CUSTOMER MODAL */}
        <Modal
          title={<span style={{ fontWeight: 800 }}>Edit Customer Details</span>}
          open={isEditModalOpen}
          onCancel={() => setIsEditModalOpen(false)}
          footer={null}
          centered
        >
          <Form form={editForm} layout="vertical" onFinish={handleEditCustomerSubmit} style={{ marginTop: 16 }}>
            <Form.Item label="Customer Full Name" name="name" rules={[{ required: true, message: 'Enter name' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Phone Number" name="phone" rules={[{ required: true, message: 'Enter phone' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Email ID" name="email" rules={[{ required: true, type: 'email', message: 'Enter valid email' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Status" name="status" rules={[{ required: true }]}>
              <Select>
                <Option value="Active">Active</Option>
                <Option value="Inactive">Inactive</Option>
              </Select>
            </Form.Item>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <Button onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ backgroundColor: '#4f46e5' }}>
                Save Changes
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER SCREEN 1: CUSTOMERS LIST VIEW
  // -------------------------------------------------------------
  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* 1. TOP 4 METRIC CARDS */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        {/* Total Customers */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? 'rgba(99, 102, 241, 0.15)' : '#f3effe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <TeamOutlined style={{ fontSize: 24, color: '#6366f1' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Total Customers
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {stats.totalCustomers.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                  Registered on platform
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Active Customers */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? 'rgba(34, 197, 94, 0.15)' : '#eaf8ef',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 24, color: '#00bf62' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Active Customers
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {stats.activeCustomers.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#00bf62' }}>
                  {stats.totalCustomers > 0 ? ((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1) : 0}% Active
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Inactive Customers */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#fdeeed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <MinusCircleOutlined style={{ fontSize: 24, color: '#ef4444' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Inactive Customers
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {stats.inactiveCustomers.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>
                  {stats.totalCustomers > 0 ? ((stats.inactiveCustomers / stats.totalCustomers) * 100).toFixed(1) : 0}% Inactive
                </div>
              </div>
            </div>
          </Card>
        </Col>

        {/* Total Filtered Records */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
            }}
            styles={{ body: { padding: '20px' } }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : '#edf4fe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <CalendarOutlined style={{ fontSize: 24, color: '#3b82f6' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                  Current Query Total
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, margin: '2px 0' }}>
                  {totalRecords.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: 12, color: isDarkMode ? '#64748b' : '#94a3b8' }}>
                  Page {currentPage} of {Math.max(1, Math.ceil(totalRecords / pageSize))}
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 2. ACTIONS & FILTERS BAR */}
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
          {/* Left: Search + Status Dropdown + Role Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 280, flexWrap: 'wrap' }}>
            <Input
              placeholder="Search by name, phone, email or customer ID..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onPressEnter={() => {
                setCurrentPage(1);
                fetchCustomers(1, searchQuery, statusFilter, roleFilter);
              }}
              allowClear
              style={{ width: 280, borderRadius: 'var(--radius-base)' }}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={() => {
                setCurrentPage(1);
                fetchCustomers(1, searchQuery, statusFilter, roleFilter);
              }}
              style={{ backgroundColor: '#4f46e5', borderRadius: 'var(--radius-base)' }}
            >
              Search
            </Button>

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

            <Select
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val);
                setCurrentPage(1);
              }}
              style={{ width: 160 }}
            >
              <Option value="CUSTOMER">Customers Only</Option>
              <Option value="GYM_OWNER">Gym Owners</Option>
              <Option value="all">All Platform Users</Option>
            </Select>
          </div>

          {/* Right: Export & Add New Customer Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsAddModalOpen(true)}
              style={{
                borderRadius: 'var(--radius-base)',
                fontWeight: 700,
                backgroundColor: '#4f46e5',
                borderColor: '#4f46e5',
              }}
            >
              Add New Customer
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. CUSTOMER DATA TABLE */}
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
          columns={customerColumns}
          dataSource={customers}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
          locale={{ emptyText: loading ? 'Loading customers...' : 'No customer records found matching your filters.' }}
        />
      </Card>

      {/* 4. SERVER-SIDE PAGINATION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
          Showing {totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} customers
        </div>
        <Pagination
          current={currentPage}
          total={totalRecords}
          pageSize={pageSize}
          showSizeChanger
          pageSizeOptions={['10', '20', '50']}
          onChange={(page, newPageSize) => {
            setCurrentPage(page);
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
            }
          }}
        />
      </div>

      {/* ADD NEW CUSTOMER MODAL */}
      <Modal
        title={<span style={{ fontWeight: 800 }}>Add New Customer</span>}
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        footer={null}
        centered
      >
        <Form form={form} layout="vertical" onFinish={handleAddCustomerSubmit} style={{ marginTop: 16 }}>
          <Form.Item label="Customer Full Name" name="name" rules={[{ required: true, message: 'Please enter customer name' }]}>
            <Input placeholder="e.g. Rahul Sharma" />
          </Form.Item>
          <Form.Item label="Phone Number" name="phone" rules={[{ required: true, message: 'Please enter phone number' }]}>
            <Input placeholder="+91 98765 43210" />
          </Form.Item>
          <Form.Item label="Email ID" name="email" rules={[{ required: true, type: 'email', message: 'Please enter valid email' }]}>
            <Input placeholder="rahul@email.com" />
          </Form.Item>
          <Form.Item label="Status" name="status" initialValue="Active">
            <Select>
              <Option value="Active">Active</Option>
              <Option value="Inactive">Inactive</Option>
            </Select>
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ backgroundColor: '#4f46e5' }}>
              Create Customer
            </Button>
          </div>
        </Form>
      </Modal>

      {/* QUICK BOOKING DETAILS MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarOutlined style={{ color: '#4338ca' }} />
            <span>Booking Details — {selectedBooking?.bookingId}</span>
          </div>
        }
        open={Boolean(selectedBooking)}
        onCancel={() => setSelectedBooking(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedBooking(null)}>
            Close
          </Button>,
        ]}
        centered
      >
        {selectedBooking && (
          <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px', background: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: '#888' }}>Gym Partner</div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{selectedBooking.gymName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Schedule: {selectedBooking.date} • {selectedBooking.timeSlot}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              <div><span style={{ color: '#888' }}>Section / Type:</span> <strong>{selectedBooking.sectionName}</strong></div>
              <div><span style={{ color: '#888' }}>Amount:</span> <strong>₹ {selectedBooking.amount}</strong></div>
              <div><span style={{ color: '#888' }}>Status:</span> <Tag color={selectedBooking.status === 'Completed' ? 'success' : 'orange'}>{selectedBooking.status}</Tag></div>
              <div><span style={{ color: '#888' }}>Access Pass:</span> <Tag color="blue">Dynamic QR Active</Tag></div>
            </div>
          </div>
        )}
      </Modal>

      {/* QUICK GYM INFO MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShopOutlined style={{ color: '#4338ca' }} />
            <span>Gym Partner — {selectedGymInfo?.name}</span>
          </div>
        }
        open={Boolean(selectedGymInfo)}
        onCancel={() => setSelectedGymInfo(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedGymInfo(null)}>
            Close
          </Button>,
        ]}
        centered
      >
        {selectedGymInfo && (
          <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '12px', background: isDarkMode ? '#1e293b' : '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{selectedGymInfo.name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {selectedGymInfo.location || 'Chennai'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              <div><span style={{ color: '#888' }}>Status:</span> <Tag color="success">Approved & Live</Tag></div>
              <div><span style={{ color: '#888' }}>Drop-in Rate:</span> <strong>₹ 199 / session</strong></div>
              <div><span style={{ color: '#888' }}>Facilities:</span> <span>AC, Lockers, Showers, Parking</span></div>
              <div><span style={{ color: '#888' }}>Rating:</span> <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><StarFilled style={{ color: '#fbbf24', fontSize: 12 }} /> 4.8 (Verified)</span></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default CustomersManagement;
