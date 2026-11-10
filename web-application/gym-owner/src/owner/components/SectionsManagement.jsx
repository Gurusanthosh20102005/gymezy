import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Button,
  Input,
  Select,
  Modal,
  Form,
  InputNumber,
  Switch,
  Space,
  Tooltip,
  Popconfirm,
  Table,
  Avatar,
  message,
  Spin,
  Empty,
  DatePicker,
  Segmented,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  FireOutlined,
  HeartOutlined,
  TrophyOutlined,
  AppstoreOutlined,
  CalendarOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTheme } from '../../theme/ThemeContext';
import { apiClient } from '../../services/apiClient';
import { useDebounce } from '../../hooks/useDebounce';
import { getDidYouMeanSuggestion } from '../../utils/fuzzySearchEngine';

const { Text } = Typography;
const { Option } = Select;

export const hasValidProfilePic = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return false;
  const trimmed = avatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return false;
  if (trimmed.includes('dicebear.com')) return false;
  return true;
};

// Section Category Definitions
export const SECTION_CATEGORIES = [
  { key: 'all', label: 'All Sections', icon: <TrophyOutlined /> },
  { key: 'yoga', label: 'Yoga Classes', icon: <HeartOutlined />, color: '#7c3aed' },
  { key: 'gym', label: 'Gym Access', icon: <ThunderboltOutlined />, color: '#003882' },
  { key: 'zumba', label: 'Zumba Sessions', icon: <FireOutlined />, color: '#db2777' },
  { key: 'crossfit', label: 'CrossFit', icon: <ThunderboltOutlined />, color: '#ea580c' },
  { key: 'hiit', label: 'HIIT Workouts', icon: <FireOutlined />, color: '#e11d48' },
  { key: 'pilates', label: 'Pilates', icon: <HeartOutlined />, color: '#059669' },
  { key: 'boxing', label: 'Boxing / MMA', icon: <TrophyOutlined />, color: '#d97706' },
  { key: 'other', label: 'Other Classes', icon: <AppstoreOutlined />, color: '#4b5563' },
];

export const TIME_SLOTS = [
  '05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM',
  '11:00 PM',
];

export const DAYS_OPTIONS = [
  { label: 'Mon', value: 'Mon' },
  { label: 'Tue', value: 'Tue' },
  { label: 'Wed', value: 'Wed' },
  { label: 'Thu', value: 'Thu' },
  { label: 'Fri', value: 'Fri' },
  { label: 'Sat', value: 'Sat' },
  { label: 'Sun', value: 'Sun' },
];

export const SectionsManagement = () => {
  const { isDarkMode } = useTheme();

  // Data States
  const [sections, setSections] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [activeCategory, setActiveCategory] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('active'); // 'active' (Upcoming/Ongoing), 'completed', 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 350);

  const didYouMean = React.useMemo(() => {
    return getDidYouMeanSuggestion(debouncedSearchQuery);
  }, [debouncedSearchQuery]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [form] = Form.useForm();

  // Roster Modal State
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [selectedSectionRoster, setSelectedSectionRoster] = useState(null);
  const [rosterEnrollments, setRosterEnrollments] = useState([]);
  const [rosterSummary, setRosterSummary] = useState(null);
  const [isRosterLoading, setIsRosterLoading] = useState(false);

  const handleOpenRoster = async (section) => {
    setSelectedSectionRoster(section);
    setIsRosterModalOpen(true);
    setIsRosterLoading(true);
    try {
      const response = await apiClient.get(`/bookings/section/${section._id}`);
      if (response.data?.success && response.data.data) {
        setRosterEnrollments(response.data.data.enrollments || []);
        setRosterSummary(response.data.data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load section roster:', err);
      message.error(err.message || 'Failed to load enrolled members.');
    } finally {
      setIsRosterLoading(false);
    }
  };

  // Dynamic Watch for Estimated End Date calculation & Trainer Availability
  const watchedStartDate = Form.useWatch('startDate', form);
  const watchedDurationDays = Form.useWatch('durationDays', form);
  const watchedActiveDays = Form.useWatch('activeDays', form);
  const watchedStartTime = Form.useWatch('startTime', form);
  const watchedEndTime = Form.useWatch('endTime', form);
  const watchedTrainerId = Form.useWatch('trainerId', form);

  // Available Trainers for the current schedule
  const [availableTrainers, setAvailableTrainers] = useState([]);
  const [isLoadingAvailableTrainers, setIsLoadingAvailableTrainers] = useState(false);

  // Calculates exact completion date by counting occurrences of active weekly days
  const calculateScheduleEndDate = useCallback((startDateInput, durationDaysInput, activeDaysInput) => {
    if (!startDateInput) return null;
    const d = new Date(startDateInput);
    if (Number.isNaN(d.getTime())) return null;

    const targetSessions = Math.max(1, Number(durationDaysInput) || 1);
    const activeDaysSet = new Set(
      Array.isArray(activeDaysInput) && activeDaysInput.length > 0
        ? activeDaysInput
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    );

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let current = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    let sessionsCounted = 0;
    let safetyLimit = 365 * 5;

    while (safetyLimit > 0) {
      const dayName = dayNames[current.getDay()];
      if (activeDaysSet.has(dayName)) {
        sessionsCounted += 1;
        if (sessionsCounted >= targetSessions) {
          return current;
        }
      }
      current.setDate(current.getDate() + 1);
      safetyLimit -= 1;
    }
    return current;
  }, []);

  // Single Source of Truth Lifecycle Calculator for Section Batches
  const getSectionLifecycleState = useCallback((record) => {
    if (record.lifecycleStatus) return record.lifecycleStatus;
    const now = new Date();
    const sDate = record.startDate ? new Date(record.startDate) : new Date();
    let effectiveEnd = record.endDate;
    if (!effectiveEnd && record.startDate && record.durationDays) {
      effectiveEnd = calculateScheduleEndDate(record.startDate, record.durationDays, record.activeDays);
    }
    const eDate = effectiveEnd ? new Date(effectiveEnd) : sDate;
    eDate.setHours(23, 59, 59, 999);
    if (now > eDate) return 'COMPLETED';
    if (record.isActive === false) return 'PAUSED';
    if (now >= sDate) return 'ONGOING';
    return 'UPCOMING';
  }, [calculateScheduleEndDate]);

  // Lifecycle counts for tabs
  const upcomingCount = sections.filter((s) => getSectionLifecycleState(s) === 'UPCOMING').length;
  const ongoingCount = sections.filter((s) => getSectionLifecycleState(s) === 'ONGOING').length;
  const activeCount = upcomingCount + ongoingCount;
  const completedCount = sections.filter((s) => getSectionLifecycleState(s) === 'COMPLETED').length;

  const estimatedEndDate = React.useMemo(() => {
    const rawStart = watchedStartDate || form.getFieldValue('startDate');
    const rawDays = watchedDurationDays || form.getFieldValue('durationDays');
    const rawActive = watchedActiveDays || form.getFieldValue('activeDays') || ['Mon', 'Wed', 'Fri'];
    if (!rawStart) return '—';
    const end = calculateScheduleEndDate(rawStart, rawDays, rawActive);
    if (!end) return '—';
    return end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [watchedStartDate, watchedDurationDays, watchedActiveDays, form, calculateScheduleEndDate]);

  // Fetch sections from live API
  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/sections');
      if (response.data?.success && Array.isArray(response.data.data)) {
        setSections(response.data.data);
      } else {
        setSections([]);
      }
    } catch (err) {
      console.error('Failed to fetch sections:', err);
      message.error(err.message || 'Failed to fetch sections from server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch gym trainers (strictly referencing them by ID)
  const fetchTrainers = useCallback(async () => {
    try {
      const response = await apiClient.get('/employees', { params: { limit: 'all' } });
      const rawData = response.data?.data;
      const allEmployees = Array.isArray(rawData) ? rawData : rawData?.employees || [];

      if (allEmployees.length > 0) {
        // Filter active employees whose role is Trainer or coach
        const gymTrainers = allEmployees.filter(
          (emp) =>
            emp.status !== 'Deactivated' &&
            (!emp.role || emp.role.toLowerCase().includes('trainer') || emp.role.toLowerCase().includes('coach'))
        );
        const resolved = gymTrainers.length > 0 ? gymTrainers : allEmployees;
        setTrainers(resolved);

        // Auto-select first trainer if not set
        if (!form.getFieldValue('trainerId') && resolved.length > 0) {
          form.setFieldsValue({ trainerId: String(resolved[0]._id || resolved[0].id) });
        }
      }
    } catch (err) {
      console.warn('Could not load gym trainers:', err.message);
    }
  }, [form]);

  useEffect(() => {
    fetchSections();
    fetchTrainers();
  }, [fetchSections, fetchTrainers]);

  // Dynamic Available Trainers Fetcher for Selected Schedule
  useEffect(() => {
    if (!isModalOpen) return;

    let isMounted = true;
    const fetchAvailable = async () => {
      setIsLoadingAvailableTrainers(true);
      try {
        const params = {
          startDate: watchedStartDate || undefined,
          durationDays: watchedDurationDays || 20,
          activeDays: watchedActiveDays ? (Array.isArray(watchedActiveDays) ? watchedActiveDays.join(',') : watchedActiveDays) : undefined,
          startTime: watchedStartTime || undefined,
          endTime: watchedEndTime || undefined,
          excludeSectionId: editingSection?._id || undefined,
        };
        const res = await apiClient.get('/sections/available-trainers', { params });
        if (isMounted && res.data?.success) {
          const avail = res.data.data?.availableTrainers || [];
          setAvailableTrainers(avail);

          // If current trainer is no longer available, update selection
          const currentTid = form.getFieldValue('trainerId');
          const stillAvail = avail.some((t) => String(t._id || t.id) === String(currentTid));
          if (!stillAvail) {
            form.setFieldsValue({
              trainerId: avail.length > 0 ? String(avail[0]._id || avail[0].id) : undefined,
            });
          }
        }
      } catch (err) {
        console.warn('Failed to fetch available trainers:', err);
      } finally {
        if (isMounted) setIsLoadingAvailableTrainers(false);
      }
    };

    fetchAvailable();
    return () => {
      isMounted = false;
    };
  }, [
    isModalOpen,
    watchedStartDate,
    watchedDurationDays,
    watchedActiveDays,
    watchedStartTime,
    watchedEndTime,
    editingSection,
    form,
  ]);

  // Trainer Select Options (Showing ONLY available trainers for current schedule)
  const trainerOptions = React.useMemo(() => {
    return availableTrainers.map((t) => ({
      value: String(t._id || t.id),
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar
            size="small"
            src={hasValidProfilePic(t.avatar) ? t.avatar : undefined}
            icon={<UserOutlined style={{ fontSize: 13 }} />}
            style={{
              backgroundColor: isDarkMode ? '#1e1b4b' : '#ede9fe',
              color: '#6366f1',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
          <span style={{ fontWeight: 600 }}>{t.name}</span>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>
            ({t.specialty || t.role || 'Coach'}{t.employeeId ? ` • ${t.employeeId}` : ''})
          </span>
        </div>
      ),
    }));
  }, [availableTrainers, isDarkMode]);

  // Open Create/Edit Modal
  const handleOpenModal = (section = null) => {
    setEditingSection(section);
    setIsModalOpen(true);

    setTimeout(() => {
      if (section) {
        const tid = section.trainerId?._id ? String(section.trainerId._id) : String(section.trainerId || '');
        form.setFieldsValue({
          title: section.title,
          category: section.category || 'yoga',
          trainerId: tid || undefined,
          cost: section.cost,
          startDate: section.startDate ? section.startDate.split('T')[0] : '',
          durationDays: section.durationDays || 20,
          startTime: section.startTime || '06:00 AM',
          endTime: section.endTime || '07:00 AM',
          activeDays: section.activeDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          maxCapacity: section.maxCapacity || 25,
          description: section.description || '',
          inclusions: Array.isArray(section.inclusions) ? section.inclusions.join('\n') : (section.inclusions || ''),
          instructions: section.instructions || '',
          isActive: section.isActive !== undefined ? section.isActive : true,
        });
      } else {
        form.resetFields();
        const defaultTrainerId = trainers[0]?._id
          ? String(trainers[0]._id)
          : (trainers[0]?.id ? String(trainers[0].id) : undefined);
        form.setFieldsValue({
          title: '',
          category: 'yoga',
          trainerId: defaultTrainerId,
          cost: 1500,
          startDate: new Date().toISOString().split('T')[0],
          durationDays: 20,
          startTime: '06:00 AM',
          endTime: '07:00 AM',
          activeDays: ['Mon', 'Wed', 'Fri'],
          maxCapacity: 20,
          description: '',
          isActive: true,
        });
      }
    }, 0);
  };

  // Save Section (Create / Update)
  const handleSaveSection = async (values) => {
    setIsSubmitting(true);
    try {
      let calculatedEndDate = null;
      if (values.startDate && values.durationDays) {
        const end = calculateScheduleEndDate(values.startDate, values.durationDays, values.activeDays);
        if (end) calculatedEndDate = end.toISOString();
      }

      const payload = {
        title: values.title.trim(),
        category: values.category,
        trainerId: values.trainerId, // Connected strictly by ID
        cost: Number(values.cost),
        startDate: values.startDate,
        endDate: calculatedEndDate,
        durationDays: Number(values.durationDays) || 20,
        startTime: values.startTime,
        endTime: values.endTime,
        activeDays: values.activeDays,
        maxCapacity: Number(values.maxCapacity) || 25,
        description: values.description || '',
        inclusions: values.inclusions
          ? (typeof values.inclusions === 'string'
              ? values.inclusions.split('\n').map((s) => s.trim()).filter(Boolean)
              : values.inclusions)
          : [],
        instructions: values.instructions ? values.instructions.trim() : '',
        isActive: values.isActive !== undefined ? values.isActive : true,
      };

      if (editingSection?._id) {
        // Update existing section
        const response = await apiClient.put(`/sections/${editingSection._id}`, payload);
        if (response.data?.success) {
          message.success('Workout section updated successfully!');
          fetchSections();
          setIsModalOpen(false);
        }
      } else {
        // Create new section
        const response = await apiClient.post('/sections', payload);
        if (response.data?.success) {
          message.success('New workout section created & published!');
          fetchSections();
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      console.error('Failed to save section:', err);
      message.error(err.message || 'Failed to save section.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Section Status
  const handleToggleStatus = async (id, currentStatus) => {
    const target = sections.find((s) => s._id === id);
    if (target && getSectionLifecycleState(target) === 'COMPLETED' && !currentStatus) {
      message.warning('This batch schedule has already ended. Edit the schedule dates to reopen it.');
      return;
    }
    try {
      const response = await apiClient.patch(`/sections/${id}/status`, {
        isActive: !currentStatus,
      });
      if (response.data?.success) {
        setSections((prev) =>
          prev.map((sec) => (sec._id === id ? { ...sec, isActive: !currentStatus } : sec))
        );
        message.info(`Section status ${!currentStatus ? 'Activated' : 'Paused'}.`);
      }
    } catch (err) {
      message.error(err.message || 'Failed to update section status.');
    }
  };

  // Delete Section
  const handleDeleteSection = async (id) => {
    try {
      const response = await apiClient.delete(`/sections/${id}`);
      if (response.data?.success) {
        setSections((prev) => prev.filter((sec) => sec._id !== id));
        message.success('Section removed permanently.');
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete section.');
    }
  };

  // Filtered Sections
  const filteredSections = React.useMemo(() => {
    return sections.filter((sec) => {
      const state = getSectionLifecycleState(sec);
      if (lifecycleFilter === 'active' && state !== 'UPCOMING' && state !== 'ONGOING') return false;
      if (lifecycleFilter === 'completed' && state !== 'COMPLETED') return false;

      const matchesCategory = activeCategory === 'all' || sec.category === activeCategory;
      const trainerName =
        (typeof sec.trainerId === 'object' ? sec.trainerId?.name : '') || '';
      const q = (debouncedSearchQuery || '').toLowerCase();
      const matchesSearch =
        !q ||
        (sec.title || '').toLowerCase().includes(q) ||
        trainerName.toLowerCase().includes(q) ||
        (sec.category || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [sections, lifecycleFilter, activeCategory, debouncedSearchQuery, getSectionLifecycleState]);

  // Category Color Helper
  const getCategoryColor = (catKey) => {
    const found = SECTION_CATEGORIES.find((c) => c.key === catKey);
    return found?.color || '#003882';
  };

  // Table Columns Definition
  const columns = [
    {
      title: 'Section & Category',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      render: (text, record) => {
        const catColor = getCategoryColor(record.category);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color={catColor} style={{ fontWeight: 700, fontSize: 11, margin: 0, textTransform: 'uppercase' }}>
                {record.category || 'Class'}
              </Tag>
              <Text strong style={{ fontSize: 14, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                {text}
              </Text>
            </div>
            {record.description ? (
              <Text type="secondary" style={{ fontSize: 12 }} ellipsis={{ tooltip: record.description }}>
                {record.description}
              </Text>
            ) : null}
          </div>
        );
      },
    },
    {
      title: 'Assigned Trainer',
      dataIndex: 'trainerId',
      key: 'trainer',
      width: 220,
      render: (trainerObj) => {
        const name = typeof trainerObj === 'object' ? trainerObj?.name : 'Assigned Trainer';
        const avatar = typeof trainerObj === 'object' ? trainerObj?.avatar : null;
        const empId = typeof trainerObj === 'object' ? trainerObj?.employeeId : '';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar
              src={hasValidProfilePic(avatar) ? avatar : undefined}
              icon={<UserOutlined style={{ fontSize: 16 }} />}
              size={32}
              style={{
                backgroundColor: isDarkMode ? '#1e1b4b' : '#ede9fe',
                color: '#6366f1',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong style={{ fontSize: 13, color: isDarkMode ? '#e6edf3' : '#0f172a' }}>
                {name || 'Unassigned'}
              </Text>
              {empId ? (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ID: {empId}
                </Text>
              ) : null}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Cost',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      sorter: (a, b) => a.cost - b.cost,
      render: (cost, record) => (
        <Tag
          color="green"
          style={{
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 'var(--radius-base)',
            padding: '2px 8px',
            margin: 0,
          }}
        >
          ₹{Number(cost || 0).toLocaleString('en-IN')}
        </Tag>
      ),
    },
    {
      title: 'Daily Timings',
      key: 'timings',
      width: 180,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ClockCircleOutlined style={{ color: '#d97706', fontSize: 14 }} />
          <Text strong style={{ fontSize: 12, color: isDarkMode ? '#e6edf3' : '#334155' }}>
            {record.startTime || '06:00 AM'} - {record.endTime || '07:00 AM'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Schedule & Duration',
      key: 'schedule',
      width: 220,
      render: (_, record) => {
        const formatDDMMYYYY = (dateVal) => {
          if (!dateVal) return '—';
          const d = new Date(dateVal);
          if (Number.isNaN(d.getTime())) return '—';
          return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
        };
        const dateStr = formatDDMMYYYY(record.startDate);
        let endDateStr = '—';
        if (record.endDate) {
          endDateStr = formatDDMMYYYY(record.endDate);
        } else if (record.startDate && record.durationDays) {
          const end = calculateScheduleEndDate(record.startDate, record.durationDays, record.activeDays);
          if (end) endDateStr = formatDDMMYYYY(end);
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarOutlined style={{ color: '#003882', fontSize: 13 }} />
              <Text style={{ fontSize: 12 }}>
                {dateStr} → <Text strong style={{ color: '#003882' }}>{endDateStr}</Text>
              </Text>
            </div>
            <Tag color="blue" style={{ width: 'fit-content', fontSize: 10, margin: 0, borderRadius: 4 }}>
              {record.durationDays || 20} Days Batch
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Weekly Days',
      dataIndex: 'activeDays',
      key: 'activeDays',
      width: 180,
      render: (days) => (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {Array.isArray(days) && days.length === 7 ? (
            <Tag color="cyan">Daily (All 7 Days)</Tag>
          ) : Array.isArray(days) && days.length > 0 ? (
            days.map((d) => (
              <Tag key={d} style={{ fontSize: 10, margin: 0 }}>
                {d}
              </Tag>
            ))
          ) : (
            <Text type="secondary">—</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Capacity',
      key: 'capacity',
      width: 140,
      render: (_, record) => {
        const isFull = (record.enrolledCount || 0) >= (record.maxCapacity || 25);
        return (
          <Tooltip title="Click to view enrolled members roster">
            <div
              onClick={() => handleOpenRoster(record)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isFull
                  ? (isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)')
                  : (isDarkMode ? 'rgba(0,56,130,0.15)' : 'rgba(0,56,130,0.08)'),
              }}
            >
              <TeamOutlined style={{ color: isFull ? '#ef4444' : '#003882' }} />
              <Text strong style={{ fontSize: 13, color: isFull ? '#ef4444' : (isDarkMode ? '#e6edf3' : '#1e293b') }}>
                {record.enrolledCount || 0} / {record.maxCapacity || 25}
              </Text>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      key: 'lifecycleStatus',
      width: 130,
      render: (_, record) => {
        const state = getSectionLifecycleState(record);
        const isCompleted = state === 'COMPLETED';
        const badgeColors = {
          UPCOMING: '#0284c7',
          ONGOING: '#ea580c',
          COMPLETED: '#64748b',
          PAUSED: '#ef4444',
        };
        const badgeLabels = {
          UPCOMING: 'Upcoming',
          ONGOING: 'Ongoing',
          COMPLETED: 'Completed',
          PAUSED: 'Paused',
        };
        return (
          <Space direction="vertical" size={4} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
            <Tag
              color={badgeColors[state] || '#64748b'}
              style={{
                borderRadius: 12,
                fontWeight: 600,
                fontSize: 11,
                padding: '1px 8px',
                border: 'none',
                margin: 0,
              }}
            >
              {badgeLabels[state] || state}
            </Tag>
            {!isCompleted && (
              <Switch
                checked={record.isActive}
                onChange={() => handleToggleStatus(record._id, record.isActive)}
                size="small"
              />
            )}
          </Space>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View Enrolled Members">
            <Button
              type="text"
              size="small"
              icon={<TeamOutlined style={{ color: '#003882' }} />}
              onClick={() => handleOpenRoster(record)}
            />
          </Tooltip>
          <Tooltip title="Edit Section">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleOpenModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Section?"
            description="Are you sure you want to remove this section permanently?"
            onConfirm={() => handleDeleteSection(record._id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* 1. Header Toolbar: Category Pills, Search, Refresh, Add Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* Lifecycle Tabs, Category Dropdown & Search Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Segmented
            value={lifecycleFilter}
            onChange={setLifecycleFilter}
            options={[
              { label: `Active (${activeCount})`, value: 'active' },
              { label: `Completed (${completedCount})`, value: 'completed' },
              { label: `All (${sections.length})`, value: 'all' },
            ]}
          />

          <Select
            value={activeCategory}
            onChange={(val) => setActiveCategory(val)}
            style={{ width: 200, height: 38 }}
            popupMatchSelectWidth={false}
          >
            {SECTION_CATEGORIES.map((cat) => (
              <Option key={cat.key} value={cat.key}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: cat.color || '#003882', display: 'inline-flex' }}>{cat.icon}</span>
                  <span style={{ fontWeight: 500 }}>{cat.label}</span>
                </span>
              </Option>
            ))}
          </Select>

          <div style={{ width: 260 }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Search section or trainer..."
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#161b22' : '#ffffff',
                borderColor: isDarkMode ? '#30363d' : '#cbd5e1',
                height: 38,
              }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tooltip title="Reload Sections">
            <Button
              icon={<ReloadOutlined spin={isLoading} />}
              onClick={fetchSections}
              style={{ borderRadius: 'var(--radius-base)', height: 38 }}
            />
          </Tooltip>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            style={{
              backgroundColor: '#003882',
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              height: 38,
              padding: '0 18px',
            }}
          >
            Create Section
          </Button>
        </div>
      </div>

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

      {/* 2. Sections Table */}
      <Card
        style={{
          borderRadius: 'var(--radius-base)',
          backgroundColor: isDarkMode ? '#0d1117' : '#ffffff',
          border: `1px solid ${isDarkMode ? '#1e293b' : '#e2e8f0'}`,
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={filteredSections}
          loading={isLoading}
          pagination={{
            pageSize: 10,
            pageSizeOptions: ['10', '20', '50', '100'],
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `Showing ${range[0]} to ${range[1]} of ${total} sections`,
          }}
          rowKey="_id"
          scroll={{ x: 1500 }}
          locale={{
            emptyText: (
              <Empty
                description="No sections found. Click 'Create Section' to add your first training batch!"
                style={{ padding: '36px 0' }}
              />
            ),
          }}
        />
      </Card>

      {/* 3. Create / Edit Section Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-base)',
                backgroundColor: 'rgba(0, 56, 130, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#003882',
              }}
            >
              {editingSection ? <EditOutlined /> : <PlusOutlined />}
            </div>
            <span style={{ fontSize: 16, fontWeight: 700 }}>
              {editingSection ? 'Edit Section / Class' : 'Create New Section'}
            </span>
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={700}
        footer={null}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSaveSection} style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="title"
                label="Section Name / Title"
                rules={[{ required: true, message: 'Please enter section title' }]}
              >
                <Input
                  size="large"
                  placeholder="Enter section name"
                  style={{ borderRadius: 'var(--radius-base)' }}
                />
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                name="category"
                label="Category"
                rules={[{ required: true, message: 'Please select a category' }]}
              >
                <Select size="large" style={{ borderRadius: 'var(--radius-base)' }}>
                  {SECTION_CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                    <Option key={c.key} value={c.key}>
                      <Space>
                        {c.icon}
                        {c.label}
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="trainerId"
                label="Assigned Gym Trainer (Available in Gym)"
                rules={[{ required: true, message: 'Please select an available trainer' }]}
                help={
                  !isLoadingAvailableTrainers && availableTrainers.length === 0 ? (
                    <span style={{ color: '#ef4444', fontWeight: 500 }}>
                      No trainers are available for this time and schedule. Adjust the time slot or active days.
                    </span>
                  ) : undefined
                }
                validateStatus={!isLoadingAvailableTrainers && availableTrainers.length === 0 ? 'error' : undefined}
              >
                <Select
                  size="large"
                  placeholder={
                    isLoadingAvailableTrainers
                      ? 'Evaluating available trainers...'
                      : availableTrainers.length === 0
                      ? 'No trainers available for this schedule'
                      : 'Select an available trainer'
                  }
                  loading={isLoadingAvailableTrainers}
                  style={{ borderRadius: 'var(--radius-base)' }}
                  options={trainerOptions}
                />
              </Form.Item>
            </Col>

            <Col span={10}>
              <Form.Item
                name="cost"
                label="Cost / Program Fee (₹)"
                rules={[{ required: true, message: 'Enter program cost' }]}
              >
                <InputNumber
                  size="large"
                  min={0}
                  prefix="₹"
                  placeholder="e.g. 1500"
                  style={{ width: '100%', borderRadius: 'var(--radius-base)' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {!isLoadingAvailableTrainers && availableTrainers.length === 0 && (
            <Alert
              type="warning"
              showIcon
              message="No Trainers Available for this Schedule"
              description="All trainers either have an overlapping batch or do not work during these hours/days. Please adjust the daily time slot, active days, or date range to assign a trainer."
              style={{ marginBottom: 16, borderRadius: 'var(--radius-base)' }}
            />
          )}

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item
                name="startDate"
                label="Starting Date"
                rules={[{ required: true, message: 'Select start date' }]}
              >
                <Input
                  type="date"
                  size="large"
                  style={{ borderRadius: 'var(--radius-base)' }}
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item
                name="durationDays"
                label="Duration (Days)"
                rules={[{ required: true, message: 'Enter days' }]}
              >
                <InputNumber
                  size="large"
                  min={1}
                  max={365}
                  placeholder="20"
                  addonAfter="Days"
                  style={{ width: '100%', borderRadius: 'var(--radius-base)' }}
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item label="Estimated End Date">
                <Input
                  size="large"
                  readOnly
                  value={estimatedEndDate}
                  prefix={<CalendarOutlined style={{ color: '#003882' }} />}
                  style={{
                    borderRadius: 'var(--radius-base)',
                    backgroundColor: isDarkMode ? '#161b22' : '#f8fafc',
                    color: isDarkMode ? '#58a6ff' : '#003882',
                    fontWeight: 700,
                    cursor: 'default',
                  }}
                />
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item
                name="maxCapacity"
                label="Capacity"
                rules={[{ required: true, message: 'Enter capacity' }]}
              >
                <InputNumber
                  size="large"
                  min={1}
                  max={200}
                  placeholder="25"
                  addonAfter="Seats"
                  style={{ width: '100%', borderRadius: 'var(--radius-base)' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="startTime"
                label="Daily Start Time"
                rules={[{ required: true, message: 'Select start time' }]}
              >
                <Select size="large" style={{ borderRadius: 'var(--radius-base)' }}>
                  {TIME_SLOTS.map((slot) => (
                    <Option key={slot} value={slot}>
                      {slot}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="endTime"
                label="Daily End Time"
                rules={[{ required: true, message: 'Select end time' }]}
              >
                <Select size="large" style={{ borderRadius: 'var(--radius-base)' }}>
                  {TIME_SLOTS.map((slot) => (
                    <Option key={slot} value={slot}>
                      {slot}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* Weekly Recurring Days */}
          <Form.Item
            name="activeDays"
            label="Weekly Schedule (Select Active Days)"
            rules={[{ required: true, message: 'Select at least one day' }]}
          >
            <Select
              mode="multiple"
              size="large"
              placeholder="Select recurring days (e.g. Mon, Wed, Fri)"
              options={DAYS_OPTIONS}
              style={{ borderRadius: 'var(--radius-base)' }}
            />
          </Form.Item>

          {/* Description */}
          <Form.Item name="description" label="Section Description / Guidelines">
            <Input.TextArea
              rows={2}
              placeholder="e.g. 20-day progressive yoga program covering Asanas, Pranayama and Surya Namaskar."
              style={{ borderRadius: 'var(--radius-base)' }}
            />
          </Form.Item>

          {/* Inclusions */}
          <Form.Item name="inclusions" label="What's Included (One item per line)">
            <Input.TextArea
              rows={3}
              placeholder="e.g.&#10;Full trainer-guided batch sessions&#10;Dedicated studio mats & equipment&#10;Locker and shower facility access"
              style={{ borderRadius: 'var(--radius-base)' }}
            />
          </Form.Item>

          {/* Guidelines / Notice */}
          <Form.Item name="instructions" label="Special Guidelines / Notice">
            <Input.TextArea
              rows={2}
              placeholder="e.g. Please arrive 10 minutes before the scheduled time slot."
              style={{ borderRadius: 'var(--radius-base)' }}
            />
          </Form.Item>

          {/* Active Switch */}
          <Form.Item name="isActive" valuePropName="checked" label="Section Visibility">
            <Space>
              <Switch defaultChecked />
              <Text style={{ fontSize: 13, color: isDarkMode ? '#8b949e' : '#64748b' }}>
                Active and visible for member enrollment
              </Text>
            </Space>
          </Form.Item>

          {/* Submit Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <Button size="large" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              loading={isSubmitting}
              disabled={availableTrainers.length === 0 || !watchedTrainerId}
              style={{
                backgroundColor: availableTrainers.length === 0 || !watchedTrainerId ? undefined : '#003882',
                fontWeight: 600,
              }}
            >
              {editingSection ? 'Save Changes' : 'Create & Publish Section'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* 4. Enrolled Members Roster Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-base)',
                backgroundColor: 'rgba(0, 56, 130, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#003882',
              }}
            >
              <TeamOutlined />
            </div>
            <div>
              <span style={{ fontSize: 16, fontWeight: 700 }}>
                Enrolled Members Roster
              </span>
              {selectedSectionRoster?.title && (
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  {selectedSectionRoster.title} ({selectedSectionRoster.category?.toUpperCase()})
                </Text>
              )}
            </div>
          </div>
        }
        open={isRosterModalOpen}
        onCancel={() => setIsRosterModalOpen(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setIsRosterModalOpen(false)} style={{ backgroundColor: '#003882' }}>
            Close Roster
          </Button>,
        ]}
        width={840}
        destroyOnClose
      >
        {/* Roster Summary Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 20,
            marginTop: 10,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? '#161b22' : '#f8fafc',
              border: `1px solid ${isDarkMode ? '#30363d' : '#e2e8f0'}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>Total Enrolled</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#003882', marginTop: 2 }}>
              {rosterSummary?.enrolledCount || 0} / {rosterSummary?.maxCapacity || selectedSectionRoster?.maxCapacity || 25}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? '#161b22' : '#f8fafc',
              border: `1px solid ${isDarkMode ? '#30363d' : '#e2e8f0'}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>Available Slots</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#00BF62', marginTop: 2 }}>
              {rosterSummary?.availableSlots ?? Math.max(0, (selectedSectionRoster?.maxCapacity || 25) - (selectedSectionRoster?.enrolledCount || 0))}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? '#161b22' : '#f8fafc',
              border: `1px solid ${isDarkMode ? '#30363d' : '#e2e8f0'}`,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>Active Bookings</Text>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#6366f1', marginTop: 2 }}>
              {rosterSummary?.activeCount || rosterEnrollments.filter((b) => b.status === 'Upcoming' || b.status === 'Active').length}
            </div>
          </div>
        </div>

        {/* Members Roster Table */}
        <Table
          loading={isRosterLoading}
          dataSource={rosterEnrollments}
          rowKey={(r) => r._id || r.bookingId}
          pagination={{ pageSize: 6 }}
          columns={[
            {
              title: 'Member',
              key: 'member',
              render: (_, record) => {
                const u = record.userId;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar
                      src={hasValidProfilePic(u?.avatar || u?.profilePicture) ? (u?.avatar || u?.profilePicture) : undefined}
                      icon={<UserOutlined style={{ fontSize: 16 }} />}
                      size={32}
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
                      <div style={{ fontWeight: 600 }}>{u?.fullName || u?.name || 'Member'}</div>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {u?.phone || u?.email || record.customerId || '—'}
                      </Text>
                    </div>
                  </div>
                );
              },
            },
            {
              title: 'Booking ID',
              dataIndex: 'bookingId',
              key: 'bookingId',
              render: (id) => <Tag color="blue">{id}</Tag>,
            },
            {
              title: 'Enrolled Date',
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (dt) => dt ? new Date(dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
            },
            {
              title: 'Amount',
              key: 'amount',
              render: (_, record) => `₹${record.pricing?.totalAmount || record.amountPaid || 0}`,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (status) => {
                let color = 'green';
                if (status === 'Cancelled') color = 'red';
                else if (status === 'Completed') color = 'blue';
                return <Tag color={color}>{status || 'Upcoming'}</Tag>;
              },
            },
          ]}
          locale={{
            emptyText: (
              <Empty
                description="No members enrolled in this batch yet."
                style={{ padding: '24px 0' }}
              />
            ),
          }}
        />
      </Modal>
    </div>
  );
};

export default SectionsManagement;
