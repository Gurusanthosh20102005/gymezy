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
  Form,
  Typography,
  Space,
  message,
  Switch,
  Popconfirm,
  Tooltip,
  Upload,
  Spin,
  Badge,
  Pagination,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
  StarFilled,
  StarOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  UploadOutlined,
  StopOutlined,
  ThunderboltFilled,
  FireOutlined,
} from '@ant-design/icons';
import { useTheme } from '../theme/ThemeContext';
import { bannerService } from '../services/bannerService';
import { gymService } from '../services/gymService';
import { apiClient } from '../services/apiClient';
import { useDebounce } from '../hooks/useDebounce';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const QUICK_BADGES = [
  '30% OFF PASS',
  'FEATURED DEAL',
  'LIMITED PERIOD',
  'NEW OPENING',
  'FLAT 50% OFF',
  'EXCLUSIVE ACCESS',
];

export const BannerManagement = () => {
  const { isDarkMode } = useTheme();
  const [form] = Form.useForm();

  // State
  const [banners, setBanners] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [gymsLoading, setGymsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Server-Side Pagination States (driven by SSOT Specification)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalBanners, setTotalBanners] = useState(0);
  const [didYouMean, setDidYouMean] = useState(null);

  // Image Upload State
  const [previewImage, setPreviewImage] = useState('');
  const [imageSizeKb, setImageSizeKb] = useState(0);

  // Live Modal Preview States
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formBadge, setFormBadge] = useState('FEATURED DEAL');

  // Gym Search State for dynamic dropdown filtering
  const [gymSearchInput, setGymSearchInput] = useState('');
  const debouncedGymSearch = useDebounce(gymSearchInput, 300);

  // Fetch Banners with Server-Side Typo-Tolerant Search & Pagination
  const fetchBanners = useCallback(
    async (
      page = currentPage,
      limit = pageSize,
      search = debouncedSearch,
      priority = priorityFilter,
      status = statusFilter
    ) => {
      try {
        setLoading(true);
        const res = await bannerService.getAllBanners({
          page,
          limit,
          search,
          priority,
          status,
        });

        const bannerList = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.banners)
            ? res.banners
            : Array.isArray(res)
              ? res
              : [];

        setBanners(bannerList);
        setTotalBanners(res?.pagination?.total ?? res?.total ?? bannerList.length);
        setDidYouMean(res?.didYouMean || null);
      } catch (err) {
        console.error('Failed to load banners:', err);
        message.error(err.message || 'Failed to load promotional banners');
        setBanners([]);
      } finally {
        setLoading(false);
      }
    },
    [currentPage, pageSize, debouncedSearch, priorityFilter, statusFilter]
  );

  // Fetch Gyms for Dropdown using dedicated SSOT gymService
  const fetchGyms = useCallback(async (searchQuery = '') => {
    try {
      setGymsLoading(true);
      const res = await gymService.getGymOptions({
        limit: 0, // Unrestricted/fetch all for full fleet selector
        search: searchQuery.trim() || undefined,
      });
      const gymList = Array.isArray(res?.gyms) ? res.gyms : [];
      setGyms(gymList);
    } catch (err) {
      console.error('Failed to load gyms for banner mapping:', err);
      setGyms([]);
    } finally {
      setGymsLoading(false);
    }
  }, []);

  // Initial load & gym mapping
  useEffect(() => {
    fetchGyms();
  }, [fetchGyms]);

  // Dynamic remote search when user types in the gym dropdown
  useEffect(() => {
    if (debouncedGymSearch !== '') {
      fetchGyms(debouncedGymSearch);
    }
  }, [debouncedGymSearch, fetchGyms]);

  // Re-fetch when pagination, search, or filters change
  useEffect(() => {
    fetchBanners(currentPage, pageSize, debouncedSearch, priorityFilter, statusFilter);
  }, [fetchBanners, currentPage, pageSize, debouncedSearch, priorityFilter, statusFilter]);

  // Reset to page 1 on filter or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, priorityFilter, statusFilter]);

  // Listen to Global App Refresh event (from breadcrumb bar)
  useEffect(() => {
    const handleRefresh = () => {
      fetchBanners(currentPage, pageSize, debouncedSearch, priorityFilter, statusFilter);
    };
    window.addEventListener('app:refresh', handleRefresh);
    return () => window.removeEventListener('app:refresh', handleRefresh);
  }, [fetchBanners, currentPage, pageSize, debouncedSearch, priorityFilter, statusFilter]);

  // Data to render in table (driven by server pagination)
  const filteredBanners = banners;

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingBanner(null);
    setPreviewImage('');
    setImageSizeKb(0);
    setFormTitle('');
    setFormSubtitle('');
    setFormBadge('FEATURED DEAL');
    form.resetFields();
    form.setFieldsValue({
      badgeText: 'FEATURED DEAL',
      isPriority: false,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (banner) => {
    setEditingBanner(banner);
    const existingImg = banner.image?.fileData || banner.imageUrl || '';
    setPreviewImage(existingImg);
    setImageSizeKb(banner.image?.fileSizeKb || 0);
    setFormTitle(banner.title || '');
    setFormSubtitle(banner.subtitle || '');
    setFormBadge(banner.badgeText || 'FEATURED DEAL');

    form.resetFields();
    form.setFieldsValue({
      title: banner.title,
      subtitle: banner.subtitle,
      badgeText: banner.badgeText || 'FEATURED DEAL',
      gymId: banner.gymId?._id || banner.gymId,
      isPriority: Boolean(banner.isPriority),
      isActive: Boolean(banner.isActive),
    });
    setIsModalOpen(true);
  };

  // Handle Image Selection
  const handleImageSelect = (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('You can only upload image files (PNG, JPG, WebP)!');
      return false;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target.result;
      setPreviewImage(base64Data);
      const approxKb = Math.round((base64Data.length * 3) / 4 / 1024);
      setImageSizeKb(approxKb);
    };
    reader.readAsDataURL(file);
    return false; // Prevent automatic upload
  };

  // Handle Form Submission
  const handleSubmit = async (values) => {
    try {
      if (!previewImage && !editingBanner) {
        message.error('Please upload an image for the promotional banner');
        return;
      }

      setSubmitting(true);
      const payload = {
        title: values.title,
        subtitle: values.subtitle || '',
        badgeText: values.badgeText || 'FEATURED DEAL',
        gymId: values.gymId,
        isPriority: Boolean(values.isPriority),
        isActive: Boolean(values.isActive),
        image: previewImage,
      };

      if (editingBanner) {
        await bannerService.updateBanner(editingBanner._id, payload);
        message.success('Banner updated successfully with WebP compression');
      } else {
        await bannerService.createBanner(payload);
        message.success('Banner created and compressed to WebP successfully');
      }

      setIsModalOpen(false);
      fetchBanners();
    } catch (err) {
      console.error('Error saving banner:', err);
      message.error(err.message || 'Failed to save promotional banner');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Priority
  const handleTogglePriority = async (banner) => {
    try {
      await bannerService.togglePriority(banner._id);
      message.success(
        `Banner "${banner.title}" priority set to ${!banner.isPriority ? 'HIGH (First in list)' : 'NORMAL'}`
      );
      fetchBanners();
    } catch (err) {
      message.error(err.message || 'Failed to toggle priority');
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (banner, checked) => {
    try {
      await bannerService.updateBanner(banner._id, { isActive: checked });
      message.success(`Banner status updated to ${checked ? 'Active' : 'Inactive'}`);
      fetchBanners();
    } catch (err) {
      message.error(err.message || 'Failed to update active status');
    }
  };

  // Delete Banner
  const handleDeleteBanner = async (id) => {
    try {
      await bannerService.deleteBanner(id);
      message.success('Banner deleted successfully');
      fetchBanners();
    } catch (err) {
      message.error(err.message || 'Failed to delete banner');
    }
  };

  // Table Columns
  const columns = [
    {
      title: 'Banner Preview',
      key: 'preview',
      width: 140,
      render: (_, record) => {
        const imgSrc = record.image?.fileData || record.imageUrl;
        return (
          <div
            style={{
              width: 120,
              height: 68,
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
              position: 'relative',
            }}
          >
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={record.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <PictureOutlined style={{ fontSize: 24, color: '#94a3b8' }} />
            )}
            {record.isPriority && (
              <div
                style={{
                  position: 'absolute',
                  top: 4,
                  left: 4,
                  backgroundColor: '#f59e0b',
                  color: '#ffffff',
                  borderRadius: 4,
                  padding: '2px 4px',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <StarFilled style={{ fontSize: 9 }} /> PRIORITY
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Title & Badge',
      key: 'title',
      render: (_, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Tag color="#6366f1" style={{ fontWeight: 700, borderRadius: 4 }}>
              {record.badgeText || 'PROMO'}
            </Tag>
            <Text strong style={{ fontSize: 14, color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
              {record.title}
            </Text>
          </div>
          {record.subtitle && (
            <Text style={{ fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
              {record.subtitle}
            </Text>
          )}
          {record.image?.fileSizeKb > 0 && (
            <div style={{ marginTop: 4 }}>
              <Tag style={{ fontSize: 10 }}>WebP • {record.image.fileSizeKb} KB</Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Linked Gym & Area',
      key: 'gym',
      render: (_, record) => {
        const gymName = record.gymName || record.gymId?.name || 'Unassigned Gym';
        const gymArea = record.gymArea || record.gymId?.area || 'Chennai';
        const gymSlug = record.gymSlug || record.gymId?.slug || '';
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShopOutlined style={{ color: '#0ea5e9' }} />
              <Text strong style={{ color: isDarkMode ? '#f1f5f9' : '#1e293b' }}>
                {gymName}
              </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <EnvironmentOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
              <Text style={{ fontSize: 12, color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                {gymArea}
              </Text>
              {gymSlug && (
                <Tag color="cyan" style={{ fontSize: 11, padding: '0 4px', lineHeight: '18px' }}>
                  /{gymSlug}
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Priority Flag',
      key: 'isPriority',
      width: 140,
      render: (_, record) => (
        <Tooltip
          title={
            record.isPriority
              ? 'Priority banner: always shown at the top of the user app'
              : 'Click to prioritize this banner above regular distance sorting'
          }
        >
          <Button
            size="small"
            type={record.isPriority ? 'primary' : 'default'}
            icon={record.isPriority ? <StarFilled /> : <StarOutlined />}
            onClick={() => handleTogglePriority(record)}
            style={{
              backgroundColor: record.isPriority ? '#f59e0b' : 'transparent',
              borderColor: record.isPriority ? '#d97706' : isDarkMode ? '#475569' : '#cbd5e1',
              color: record.isPriority ? '#ffffff' : isDarkMode ? '#e2e8f0' : '#475569',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {record.isPriority ? 'Priority' : 'Normal'}
          </Button>
        </Tooltip>
      ),
    },
    {
      title: 'Active',
      key: 'isActive',
      width: 100,
      render: (_, record) => (
        <Switch
          checked={record.isActive}
          onChange={(checked) => handleToggleActive(record, checked)}
          checkedChildren="ON"
          unCheckedChildren="OFF"
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit Banner">
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#3b82f6' }} />}
              onClick={() => handleOpenEditModal(record)}
            />
          </Tooltip>
          <Tooltip title="Delete Banner">
            <Popconfirm
              title="Delete Promotional Banner"
              description="Are you sure you want to permanently delete this banner?"
              onConfirm={() => handleDeleteBanner(record._id)}
              okText="Yes, Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          gap: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
          <Title
            level={3}
            style={{ margin: 0, color: isDarkMode ? '#f8fafc' : '#0f172a', fontWeight: 800 }}
          >
            Promotional Banners & Ads
          </Title>
          <Paragraph
            style={{
              margin: '4px 0 0 0',
              color: isDarkMode ? '#94a3b8' : '#64748b',
              fontSize: 14,
            }}
          >
            Upload banners with automatic WebP compression, map by Gym Mongo ID & slug, and configure
            priority & location sorting.
          </Paragraph>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
          style={{
            backgroundColor: '#6366f1',
            borderColor: '#6366f1',
            fontWeight: 600,
            height: 40,
            borderRadius: 8,
            flexShrink: 0,
          }}
        >
          Create New Banner
        </Button>
      </div>

      {/* Filter Toolbar */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
          marginBottom: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              prefix={<SearchOutlined style={{ color: isDarkMode ? '#94a3b8' : '#64748b', marginRight: 4 }} />}
              placeholder="Search by title, gym name, area, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: '100%', borderRadius: 8 }}
            >
              <Option value="ALL">All Priority Levels</Option>
              <Option value="PRIORITY">Priority Only</Option>
              <Option value="NORMAL">Normal Only</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%', borderRadius: 8 }}
            >
              <Option value="ALL">All Statuses</Option>
              <Option value="ACTIVE">Active Only</Option>
              <Option value="INACTIVE">Inactive Only</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6} style={{ textAlign: 'right' }}>
            <Text style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: 13, fontWeight: 500 }}>
              Showing {totalBanners > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
              {Math.min(currentPage * pageSize, totalBanners)} of {totalBanners} banners
            </Text>
          </Col>
        </Row>
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

      {/* Banners Table */}
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          dataSource={banners}
          columns={columns}
          rowKey="_id"
          loading={loading}
          pagination={false}
          locale={{ emptyText: 'No promotional banners found matching your criteria.' }}
        />
      </Card>

      {/* Numbered Server-Side Pagination Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0 24px',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
          Showing {totalBanners > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(currentPage * pageSize, totalBanners)} of {totalBanners} banners
        </div>
        <Pagination
          current={currentPage}
          total={totalBanners}
          pageSize={pageSize}
          onChange={(newPage, newPageSize) => {
            setCurrentPage(newPage);
            if (newPageSize !== pageSize) {
              setPageSize(newPageSize);
            }
          }}
          showSizeChanger
          pageSizeOptions={['10', '20', '50', '100']}
          showQuickJumper
        />
      </div>

      {/* Create / Edit Modal (Landscape Design) */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PictureOutlined style={{ color: '#6366f1' }} />
            <span style={{ fontWeight: 800 }}>{editingBanner ? 'Edit Promotional Banner' : 'Create Promotional Banner'}</span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={960}
        centered
        destroyOnClose
        styles={{ body: { padding: '8px 4px 16px' } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ marginTop: 12 }}
        >
          <Row gutter={[24, 16]}>
            {/* Left Column: Form Controls */}
            <Col xs={24} lg={13}>
              {/* Gym Selector */}
              <Form.Item
                label="Select Gym (Auto-maps Mongo ObjectId & Location Slug)"
                name="gymId"
                rules={[{ required: true, message: 'Please select a gym' }]}
                style={{ marginBottom: 14 }}
                extra="User app automatically calculates distance to this gym and enables direct booking on tap."
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="Search and select gym..."
                  loading={gymsLoading}
                  optionFilterProp="label"
                  onSearch={(val) => setGymSearchInput(val)}
                  onClear={() => {
                    setGymSearchInput('');
                    fetchGyms('');
                  }}
                  filterOption={(input, option) => {
                    if (!input) return true;
                    const target = String(option?.label || '').toLowerCase();
                    const query = String(input || '').trim().toLowerCase();
                    if (target.includes(query)) return true;
                    // Relaxed matching ignoring spaces/hyphens (e.g. "supermax" matches "Super Max Gym")
                    const cleanTarget = target.replace(/[^a-z0-9]/g, '');
                    const cleanQuery = query.replace(/[^a-z0-9]/g, '');
                    return cleanTarget.includes(cleanQuery);
                  }}
                  options={(Array.isArray(gyms) ? gyms : []).map((g) => ({
                    value: g._id || g.id,
                    label: `${g.name || 'Gym'} — ${g.area || g.city || 'Chennai'}${g.slug ? ` (/${g.slug})` : ''}`,
                  }))}
                  style={{ borderRadius: 8 }}
                />
              </Form.Item>

              {/* Banner Title */}
              <Form.Item
                label="Banner Title / Headline"
                name="title"
                rules={[{ required: true, message: 'Banner headline is required' }]}
                style={{ marginBottom: 14 }}
              >
                <Input
                  placeholder="e.g. 30% Off Pass, Summer Fitness Festival"
                  maxLength={120}
                  style={{ borderRadius: 8 }}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </Form.Item>

              {/* Subtitle / Description */}
              <Form.Item label="Subtitle / Tagline (Optional)" name="subtitle" style={{ marginBottom: 14 }}>
                <Input
                  placeholder="e.g. Valid on all day passes & weekly workouts"
                  maxLength={200}
                  style={{ borderRadius: 8 }}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                />
              </Form.Item>

              {/* Promotional Badge */}
              <Form.Item
                label="Promotional Badge Tag"
                name="badgeText"
                style={{ marginBottom: 8 }}
                extra="Quick tags click to auto-fill:"
              >
                <Input
                  placeholder="e.g. 30% OFF PASS"
                  maxLength={50}
                  style={{ borderRadius: 8 }}
                  onChange={(e) => setFormBadge(e.target.value)}
                />
              </Form.Item>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {QUICK_BADGES.map((b) => (
                  <Tag
                    key={b}
                    style={{ cursor: 'pointer', borderRadius: 4, fontSize: 11 }}
                    onClick={() => {
                      form.setFieldsValue({ badgeText: b });
                      setFormBadge(b);
                    }}
                  >
                    + {b}
                  </Tag>
                ))}
              </div>

              {/* Priority & Status Switches */}
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    label="Priority Flag"
                    name="isPriority"
                    valuePropName="checked"
                    extra="Floats to top of mobile app"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch
                      checkedChildren="PRIORITY"
                      unCheckedChildren="NORMAL"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Active Status"
                    name="isActive"
                    valuePropName="checked"
                    extra="Live in user mobile carousel"
                    style={{ marginBottom: 0 }}
                  >
                    <Switch checkedChildren="ACTIVE" unCheckedChildren="HIDDEN" />
                  </Form.Item>
                </Col>
              </Row>
            </Col>

            {/* Right Column: Image Upload & Live 16:9 Banner Preview */}
            <Col xs={24} lg={11} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <Form.Item
                  label="Banner Graphic Image (WebP Auto-Compression)"
                  required={!editingBanner}
                  extra="Recommended 16:9 ratio (800x450 or 1200x675). Auto-compressed to WebP."
                  style={{ marginBottom: 14 }}
                >
                  <Upload
                    beforeUpload={handleImageSelect}
                    showUploadList={false}
                    accept="image/*"
                  >
                    <Button icon={<UploadOutlined />} style={{ borderRadius: 8, width: '100%' }}>
                      {previewImage ? 'Replace Image File' : 'Choose Image File'}
                    </Button>
                  </Upload>
                </Form.Item>

                {/* Live Mobile Card Preview */}
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Live App Carousel Preview
                  </div>
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16 / 9',
                      borderRadius: 12,
                      overflow: 'hidden',
                      backgroundColor: isDarkMode ? '#0f172a' : '#1e293b',
                      border: `1px solid ${isDarkMode ? '#334155' : '#cbd5e1'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: 14,
                      boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                    }}
                  >
                    {previewImage ? (
                      <img
                        src={previewImage}
                        alt="Preview"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8',
                          gap: 8,
                        }}
                      >
                        <PictureOutlined style={{ fontSize: 36, opacity: 0.6 }} />
                        <span style={{ fontSize: 12, fontWeight: 500 }}>No image selected yet</span>
                      </div>
                    )}

                    {/* Gradient Overlay for Text Readability */}
                    {previewImage && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.45) 100%)',
                        }}
                      />
                    )}

                    {/* Top Badges */}
                    <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Tag color="purple" style={{ fontWeight: 800, fontSize: 11, borderRadius: 4, margin: 0, border: 'none', backgroundColor: '#6366f1', color: '#fff' }}>
                        {formBadge || 'FEATURED DEAL'}
                      </Tag>
                      {previewImage && imageSizeKb > 0 && (
                        <span
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: '#ffffff',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        >
                          ~{imageSizeKb} KB WebP
                        </span>
                      )}
                    </div>

                    {/* Bottom Headline & Subtitle */}
                    <div style={{ position: 'relative', zIndex: 2 }}>
                      <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 15, textShadow: '0 1px 3px rgba(0,0,0,0.9)', lineHeight: 1.25 }}>
                        {formTitle || 'Banner Headline Appears Here'}
                      </div>
                      <div style={{ color: '#e2e8f0', fontSize: 11, marginTop: 4, textShadow: '0 1px 2px rgba(0,0,0,0.9)', lineHeight: 1.3 }}>
                        {formSubtitle || 'Subtitle or promotional terms appear here'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 12, borderTop: isDarkMode ? '1px solid #1e293b' : '1px solid #f1f5f9' }}>
                <Button onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                  style={{
                    backgroundColor: '#6366f1',
                    borderColor: '#6366f1',
                    fontWeight: 600,
                    borderRadius: 8,
                  }}
                >
                  {editingBanner ? 'Save Changes' : 'Create & Compress Banner'}
                </Button>
              </div>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default BannerManagement;
