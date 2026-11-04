import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { apiClient } from '../../services/apiClient';
import {
  Card,
  Table,
  Tag,
  Button,
  Row,
  Col,
  Input,
  Select,
  Typography,
  Avatar,
  Dropdown,
  Modal,
  Form,
  DatePicker,
  Radio,
  Pagination,
  message,
  Tooltip,
  Segmented,
  Badge,
  Divider,
  Timeline,
  Empty,
  Space,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  CalendarOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MoreOutlined,
  EyeOutlined,
  PhoneOutlined,
  CreditCardOutlined,
  DollarCircleOutlined,
  SafetyCertificateOutlined,
  InfoCircleOutlined,
  DownOutlined,
  RiseOutlined,
  EditOutlined,
  DownloadOutlined,
  DeleteOutlined,
  CameraOutlined,
  SaveOutlined,
  CheckCircleFilled,
  BarcodeOutlined,
  MobileOutlined,
  CrownOutlined,
  IdcardOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  SendOutlined,
  SyncOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import { useTheme } from '../../theme/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

export const INITIAL_MEMBERS = [];
export const INITIAL_CANCELLATION_REQUESTS = [];

// Canvas Confetti Popper Trigger
export const triggerConfettiPopper = () => {
  try {
    const end = Date.now() + 1.2 * 1000;
    const colors = ['#722ed1', '#003882', '#00bf62', '#fa8c16', '#eb2f96', '#1677ff'];

    (function frame() {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.65 },
        colors: colors,
        zIndex: 99999,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.65 },
        colors: colors,
        zIndex: 99999,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();

    // Center burst
    confetti({
      particleCount: 70,
      spread: 90,
      origin: { y: 0.5 },
      colors: colors,
      zIndex: 99999,
    });
  } catch (err) {
    console.error('Confetti error:', err);
  }
};

/**
 * Reusable Membership Management Component
 */
export const MembersManagement = ({
  initialData = INITIAL_MEMBERS,
  onAddMember,
  onExtendMembership,
}) => {
  const { isDarkMode } = useTheme();
  const { user } = useSelector((state) => state.auth || {});
  const gym = user?.gym || {};
  const gymId = gym._id || gym.id || user?.gymId || user?.partnerId;

  const [form] = Form.useForm();
  const [extendForm] = Form.useForm();

  const [membersList, setMembersList] = useState(initialData);
  const [membershipSummary, setMembershipSummary] = useState(null);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [totalMembersCount, setTotalMembersCount] = useState(0);

  // Pagination & Filter States
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [activeTab, setActiveTab] = useState(
    urlTab && ['members', 'switches', 'cancellations'].includes(urlTab) ? urlTab : 'members'
  );

  useEffect(() => {
    if (urlTab && ['members', 'switches', 'cancellations'].includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', nextTab);
      return next;
    });
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState('All Dates');

  // Plan Switch Requests State & Fetcher
  const [switchRequests, setSwitchRequests] = useState([]);
  const [isSwitchLoading, setIsSwitchLoading] = useState(false);
  const [selectedSwitchReq, setSelectedSwitchReq] = useState(null);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [switchRejectionModalOpen, setSwitchRejectionModalOpen] = useState(false);
  const [switchRejectionReason, setSwitchRejectionReason] = useState('');
  const [switchReqToReject, setSwitchReqToReject] = useState(null);
  const [switchSearch, setSwitchSearch] = useState('');
  const [switchStatusFilter, setSwitchStatusFilter] = useState('ALL');

  // Cancellation Requests State
  const [cancellationRequests, setCancellationRequests] = useState(INITIAL_CANCELLATION_REQUESTS);
  const [cancelSearch, setCancelSearch] = useState('');
  const [cancelStatusFilter, setCancelStatusFilter] = useState('ALL');
  const [selectedCancelRequest, setSelectedCancelRequest] = useState(null);
  const [isCancelDetailsModalOpen, setIsCancelDetailsModalOpen] = useState(false);
  const [cancelCurrentPage, setCancelCurrentPage] = useState(1);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [addedMemberData, setAddedMemberData] = useState(null);
  const [tempDateRange, setTempDateRange] = useState(null);

  // Add Member Form Interactive States
  const [addMemberPhoto, setAddMemberPhoto] = useState(null);
  const [selectedPlanKey, setSelectedPlanKey] = useState('monthly');
  const [membershipStartDate, setMembershipStartDate] = useState(null);
  const [selectedPaymentType, setSelectedPaymentType] = useState('Online');
  const [gymTrainers, setGymTrainers] = useState([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState('none');
  const [gymPlans, setGymPlans] = useState([]);

  // Load custom pricing plans from gym settings or fallback to standard 4 tiers
  useEffect(() => {
    if (!gymId) return;
    apiClient
      .get(`/gyms/${gymId}`)
      .then((res) => {
        const gymData = res.data?.data;
        if (gymData) {
          const custom = Array.isArray(gymData.customPricingPlans) ? gymData.customPricingPlans : [];
          const flat = gymData.pricingPlans || {};

          const monthlyPlan = custom.find((p) => p?.tierId === 'monthly') || {
            name: 'Monthly Plan',
            duration: '30 Days',
            price: Number(flat.monthly || 1299),
            durationDays: 30,
            tier: 'Monthly',
          };
          const quarterlyPlan = custom.find((p) => p?.tierId === 'quarterly') || {
            name: 'Quarterly Plan',
            duration: '90 Days',
            price: Number(flat.quarterly || 3299),
            durationDays: 90,
            tier: 'Quarterly',
          };
          const halfYearlyPlan = custom.find((p) => p?.tierId === 'half_yearly' || p?.tierId === 'halfYearly') || {
            name: 'Half Yearly Plan',
            duration: '180 Days',
            price: Number(flat.halfYearly || 5999),
            durationDays: 180,
            tier: 'Half-Yearly',
          };
          const annualPlan = custom.find((p) => p?.tierId === 'annual') || {
            name: 'Annual Plan',
            duration: '365 Days',
            price: Number(flat.annual || 11999),
            durationDays: 365,
            tier: 'Annual',
          };

          const built = [
            {
              key: 'monthly',
              name: monthlyPlan.name || 'Monthly Plan',
              label: `${monthlyPlan.name || 'Monthly Plan'} (${monthlyPlan.duration || '30 Days'})`,
              tier: 'Monthly',
              durationDays: 30,
              price: Number(monthlyPlan.price || 1299),
              features: monthlyPlan.features || ['Access to all gym facilities', 'Free group workout classes', 'Locker and shower facility'],
              assignedTrainers: monthlyPlan.assignedTrainers || [],
            },
            {
              key: 'quarterly',
              name: quarterlyPlan.name || 'Quarterly Plan',
              label: `${quarterlyPlan.name || 'Quarterly Plan'} (${quarterlyPlan.duration || '90 Days'})`,
              tier: 'Quarterly',
              durationDays: 90,
              price: Number(quarterlyPlan.price || 3299),
              features: quarterlyPlan.features || ['Access to all gym facilities', 'Free group workout classes', 'Locker and shower facility', '1 Guest pass per month'],
              assignedTrainers: quarterlyPlan.assignedTrainers || [],
            },
            {
              key: 'half_yearly',
              name: halfYearlyPlan.name || 'Half Yearly Plan',
              label: `${halfYearlyPlan.name || 'Half Yearly Plan'} (${halfYearlyPlan.duration || '180 Days'})`,
              tier: 'Half-Yearly',
              durationDays: 180,
              price: Number(halfYearlyPlan.price || 5999),
              features: halfYearlyPlan.features || ['Access to all gym facilities', 'Free group workout classes', 'Locker and shower facility', 'Personalized nutrition guidance'],
              assignedTrainers: halfYearlyPlan.assignedTrainers || [],
            },
            {
              key: 'annual',
              name: annualPlan.name || 'Annual Plan',
              label: `${annualPlan.name || 'Annual Plan'} (${annualPlan.duration || '365 Days'})`,
              tier: 'Annual',
              durationDays: 365,
              price: Number(annualPlan.price || 11999),
              features: annualPlan.features || ['Access to all gym facilities', 'VIP all-access pass', 'Free sauna and steam room', 'Personalized nutrition guidance'],
              assignedTrainers: annualPlan.assignedTrainers || [],
            },
          ];
          setGymPlans(built);
          setSelectedPlanKey(built[0].key);
        }
      })
      .catch((err) => console.warn('Failed to load gym pricing plans:', err?.message));
  }, [gymId]);

  const standardFallbackPlans = [
    { key: 'monthly', name: 'Monthly Plan', label: 'Monthly Plan (30 Days)', tier: 'Monthly', durationDays: 30, price: 1599, features: ['Standard gym floor access', 'Peak hours access'] },
    { key: 'quarterly', name: 'Quarterly Plan', label: 'Quarterly Plan (90 Days)', tier: 'Quarterly', durationDays: 90, price: 4499, features: ['Unlimited gym access', 'Locker facility', 'Diet consultation'] },
    { key: 'half_yearly', name: 'Half Yearly Plan', label: 'Half Yearly Plan (180 Days)', tier: 'Half-Yearly', durationDays: 180, price: 7999, features: ['Unlimited gym access', 'All gym facilities', '1 Free guest pass'] },
    { key: 'annual', name: 'Annual Plan', label: 'Annual Plan (365 Days)', tier: 'Annual', durationDays: 365, price: 14999, features: ['VIP all-access pass', 'Personal trainer sessions', 'Free sauna'] },
  ];

  const activePlans = gymPlans.length > 0 ? gymPlans : standardFallbackPlans;

  const selectedPlanObj = useMemo(() => {
    return activePlans.find((p) => p.key === selectedPlanKey) || activePlans[0];
  }, [activePlans, selectedPlanKey]);

  // Compute trainer rate mapped to the chosen membership tier (0 means not available)
  const getTrainerFeeForTier = (trainer, tier) => {
    if (!trainer || !trainer.trainerPricing) return 0;
    const tierKeyMap = {
      Monthly: 'monthly',
      Quarterly: 'quarterly',
      'Half-Yearly': 'halfYearly',
      'Half Yearly': 'halfYearly',
      Annual: 'annual',
    };
    const key = tierKeyMap[tier] || 'monthly';
    const fee = Number(trainer.trainerPricing[key] ?? 0);
    return fee > 0 ? fee : 0;
  };

  // Only list trainers whose price for this specific plan tier is GREATER THAN 0
  const availableTrainersForPlan = useMemo(() => {
    const tier = selectedPlanObj?.tier || 'Monthly';
    return gymTrainers.filter((tr) => {
      if (Array.isArray(selectedPlanObj?.assignedTrainers) && selectedPlanObj.assignedTrainers.length > 0) {
        const allowed = selectedPlanObj.assignedTrainers.map((t) => String(t._id || t.id || t.employeeId || t));
        const trId = String(tr._id || tr.id || tr.employeeId || '');
        if (!allowed.includes(trId)) return false;
      }
      return getTrainerFeeForTier(tr, tier) > 0;
    });
  }, [gymTrainers, selectedPlanObj]);

  // If currently selected trainer is not available for this plan, auto-reset to 'none'
  useEffect(() => {
    if (selectedTrainerId !== 'none') {
      const exists = availableTrainersForPlan.some(
        (tr) => String(tr._id || tr.id || tr.employeeId) === String(selectedTrainerId)
      );
      if (!exists) {
        setSelectedTrainerId('none');
      }
    }
  }, [availableTrainersForPlan, selectedTrainerId]);

  const activeSelectedTrainer = useMemo(() => {
    if (selectedTrainerId === 'none') return null;
    return availableTrainersForPlan.find(
      (tr) => String(tr._id || tr.id || tr.employeeId) === String(selectedTrainerId)
    );
  }, [availableTrainersForPlan, selectedTrainerId]);

  const trainerFee = useMemo(() => {
    if (!activeSelectedTrainer) return 0;
    return getTrainerFeeForTier(activeSelectedTrainer, selectedPlanObj?.tier || 'Monthly');
  }, [activeSelectedTrainer, selectedPlanObj]);

  const membershipTotalAmount = (selectedPlanObj?.price || 1599) + trainerFee;

  const calculatedEndDateFormatted = useMemo(() => {
    const start = membershipStartDate ? membershipStartDate.toDate() : new Date();
    const days = selectedPlanObj?.durationDays || 30;
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    return end.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [membershipStartDate, selectedPlanObj]);

  // Fetch approved gym trainers for personal trainer add-on
  useEffect(() => {
    if (!gymId) return;
    apiClient
      .get('/employees', { params: { gymId, role: 'Trainer', approvalStatus: 'Approved' } })
      .then((res) => {
        const empData = res.data?.data;
        const list = Array.isArray(empData) ? empData : (empData?.employees || []);
        setGymTrainers(list);
      })
      .catch((err) => console.warn('Failed to load gym trainers in MembersManagement:', err?.message));
  }, [gymId]);

  // Auto-open Add Walk-in Member modal if navigated with ?action=walkin
  useEffect(() => {
    if (searchParams.get('action') === 'walkin') {
      setIsAddModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const fetchGymMemberships = async (
    page = currentPage,
    limit = pageSize,
    search = searchQuery,
    status = statusFilter,
    tier = planFilter,
    source = sourceFilter
  ) => {
    if (!gymId) return;
    setIsMembersLoading(true);
    try {
      const params = {
        page,
        limit,
      };
      if (search?.trim()) params.search = search.trim();
      if (status && status !== 'ALL' && status !== 'All') params.status = status;
      if (tier && tier !== 'ALL' && tier !== 'All') params.tier = tier;
      if (source && source !== 'ALL') params.source = source;

      const res = await apiClient.get(`/memberships/gym/${gymId}`, { params });
      const data = res.data?.data?.memberships;
      const total = res.data?.data?.total;
      const summary = res.data?.data?.summary;

      if (typeof total === 'number') {
        setTotalMembersCount(total);
      }
      if (summary) {
        setMembershipSummary(summary);
      }
      if (Array.isArray(data)) {
        const mapped = data.map((m) => {
          const startStr = m.startDate
            ? new Date(m.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';
          const endStr = m.endDate
            ? new Date(m.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
            : '';
          const daysRemaining = Math.max(0, Math.ceil((new Date(m.endDate) - new Date()) / (1000 * 60 * 60 * 24)));
          return {
            key: m._id,
            memberId: m.membershipId,
            name: m.userId?.fullName || 'Member',
            phone: m.userId?.phone || '',
            email: m.userId?.email || '',
            avatar:
              m.userId?.avatar ||
              m.userId?.profilePicture ||
              m.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
            plan: m.membershipTier || 'Standard',
            startDate: startStr,
            expiryDate: endStr,
            daysLeft: `${daysRemaining} days left`,
            status: m.status,
            source: m.source || 'APP',
            paymentType: m.payment?.method || 'Online',
            amount: `₹${m.pricing?.totalAmount || 0}`,
            trainerName: m.trainerId?.name || (m.hasTrainer ? 'Assigned' : 'None'),
          };
        });
        setMembersList(mapped);
      }
    } catch (err) {
      console.warn('Failed to fetch gym memberships:', err);
    } finally {
      setIsMembersLoading(false);
    }
  };

  useEffect(() => {
    void fetchGymMemberships(currentPage, pageSize, searchQuery, statusFilter, planFilter, sourceFilter);
  }, [gymId, currentPage, pageSize, searchQuery, statusFilter, planFilter, sourceFilter]);

  const fetchGymSwitchRequests = async () => {
    if (!gymId) return;
    setIsSwitchLoading(true);
    try {
      const res = await apiClient.get(`/memberships/gym/${gymId}/switch-requests`);
      const data = res.data?.data?.requests;
      if (Array.isArray(data)) {
        setSwitchRequests(data);
      }
    } catch (err) {
      console.warn('Failed to fetch switch requests:', err);
    } finally {
      setIsSwitchLoading(false);
    }
  };

  useEffect(() => {
    void fetchGymSwitchRequests();
  }, [gymId]);

  const fetchCancellationNegotiations = async () => {
    if (!gymId) return;
    try {
      const res = await apiClient.get(`/memberships/gym/${gymId}/cancellation-negotiations`);
      const negotiations = res.data?.data?.negotiations;
      if (!Array.isArray(negotiations)) return;
      setCancellationRequests(negotiations.map((item) => {
        const maxRefund = Number(item.maximumRefundAmount || 0);
        const currentRefund = Number(item.currentOffer?.refundAmount ?? maxRefund);
        return {
          key: item._id,
          requestId: item.requestId,
          memberId: item.membershipId?.membershipId || item.membershipId?._id || 'Member',
          memberName: item.userId?.fullName || 'Member',
          phone: item.userId?.phone || '',
          avatar: item.userId?.avatar || item.userId?.profilePicture,
          plan: item.membershipId?.membershipTier || 'Membership',
          amount: `₹${Number(item.originalAmount || 0).toLocaleString('en-IN')}`,
          refundableAmount: `₹${currentRefund.toLocaleString('en-IN')}`,
          maximumRefundAmount: maxRefund,
          currentRefundAmount: currentRefund,
          reason: item.reason || 'Cancellation requested',
          requestDate: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
          status: item.status === 'PENDING_GYM_APPROVAL'
            ? 'Pending Gym Approval'
            : item.status === 'PENDING_MEMBER_APPROVAL'
            ? 'Quoted Refund'
            : item.status === 'COMPLETED'
            ? 'Approved'
            : item.status === 'REJECTED_BY_GYM'
            ? 'Rejected'
            : item.status,
          adminStatus: item.status,
        };
      }));
    } catch (err) {
      console.warn('Failed to fetch cancellation negotiations:', err);
    }
  };

  useEffect(() => {
    void fetchCancellationNegotiations();
  }, [gymId]);

  // Real Dynamic Metrics from DB & Current List
  const dynamicTotal = membershipSummary?.total ?? totalMembersCount;
  const dynamicActive =
    membershipSummary?.active ??
    membersList.filter((m) => (m.status || '').toLowerCase() === 'active').length;
  const dynamicExpiringSoon =
    membershipSummary?.expiringSoon ??
    membersList.filter((m) => {
      const st = (m.status || '').toLowerCase();
      if (st === 'expiring soon') return true;
      if (st === 'active') {
        const days = Number.parseInt(m.daysLeft, 10);
        return !Number.isNaN(days) && days <= 30 && days >= 0;
      }
      return false;
    }).length;
  const dynamicExpired =
    membershipSummary?.expired ??
    membersList.filter((m) => (m.status || '').toLowerCase() === 'expired').length;

  const clearFilters = () => {
    setSearchQuery('');
    setPlanFilter('ALL');
    setStatusFilter('ALL');
    setSourceFilter('ALL');
    setSelectedDateRange('All Dates');
    setCurrentPage(1);
    void fetchGymMemberships(1, pageSize, '', 'ALL', 'ALL', 'ALL');
    message.info('Filters cleared');
  };

  const handleView = (record) => {
    setSelectedMember(record);
    setIsViewModalOpen(true);
  };

  const handleOpenExtend = (record) => {
    setSelectedMember(record);
    extendForm.setFieldsValue({
      plan: record.plan,
      duration: '3 Months',
      amount: record.amount.replace('₹', ''),
      paymentType: 'Online',
    });
    setIsExtendModalOpen(true);
  };

  const handleAddMemberSubmit = async (values) => {
    const tier = selectedPlanObj?.tier || 'Monthly';
    const basePlanPrice = selectedPlanObj?.price || 1599;
    const finalAmount = Number(values.amount || membershipTotalAmount);

    const start = values.startDate
      ? values.startDate.toDate()
      : membershipStartDate
      ? membershipStartDate.toDate()
      : new Date();
    const days = selectedPlanObj?.durationDays || 30;
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

    try {
      setIsMembersLoading(true);
      const payload = {
        customerName: values.name,
        phone: `${values.countryCode || '+91'} ${values.phone}`.trim(),
        email: values.email || undefined,
        tier: tier,
        price: basePlanPrice,
        amount: finalAmount,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        trainerId: activeSelectedTrainer ? (activeSelectedTrainer._id || activeSelectedTrainer.id) : undefined,
        trainerFee: trainerFee,
        paymentMethod: selectedPaymentType || values.paymentType || 'Cash',
      };

      const res = await apiClient.post(`/memberships/gym/${gymId}/walk-in`, payload);
      if (res.data?.success) {
        const created = res.data.data;
        const newMember = {
          key: created._id || Date.now().toString(),
          memberId: created.membershipId || `MEM${Date.now().toString().slice(-4)}`,
          name: values.name,
          phone: `${values.countryCode || '+91'} ${values.phone}`,
          email: values.email || `${values.name.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
          avatar:
            addMemberPhoto ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop',
          plan: selectedPlanObj?.name || tier,
          startDate: start.toLocaleDateString('en-GB'),
          expiryDate: created.endDate ? new Date(created.endDate).toLocaleDateString('en-GB') : end.toLocaleDateString('en-GB'),
          daysLeft: `${days} days left`,
          status: 'Active',
          source: 'WALK_IN',
          paymentType: selectedPaymentType || 'Cash',
          amount: `₹${finalAmount}`,
          trainerName: activeSelectedTrainer?.name || 'None',
        };

        setIsAddModalOpen(false);
        form.resetFields();
        setAddMemberPhoto(null);
        setSelectedTrainerId('none');
        setMembershipStartDate(null);
        setSelectedPlanKey(activePlans[0]?.key || 'monthly');

        // Save for Success Modal & Launch Canvas Confetti Popper
        setAddedMemberData(newMember);
        setIsSuccessModalOpen(true);
        triggerConfettiPopper();

        void fetchGymMemberships(1, pageSize, searchQuery, statusFilter, planFilter, sourceFilter);
        if (onAddMember) onAddMember(newMember);
      }
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Failed to create walk-in member.');
    } finally {
      setIsMembersLoading(false);
    }
  };

  const handleExtendSubmit = (values) => {
    if (!selectedMember) return;
    const updated = membersList.map((m) => {
      if (m.key === selectedMember.key) {
        return {
          ...m,
          expiryDate: '20 Oct 2025',
          daysLeft: '90 days left',
          status: 'Active',
        };
      }
      return m;
    });
    setMembersList(updated);
    setIsExtendModalOpen(false);
    setIsViewModalOpen(false);
    message.success(`Membership for ${selectedMember.name} extended successfully!`);
    if (onExtendMembership) onExtendMembership(selectedMember.key, values);
  };

  // Date Range Dropdown Menu
  const dateRangeMenu = {
    items: [
      { key: 'today', label: 'Today (21 Jul 2025)', onClick: () => setSelectedDateRange('21 Jul 2025 - 21 Jul 2025') },
      { key: 'yesterday', label: 'Yesterday (20 Jul 2025)', onClick: () => setSelectedDateRange('20 Jul 2025 - 20 Jul 2025') },
      { key: 'this_week', label: 'This Week (15 Jul 2025 - 21 Jul 2025)', onClick: () => setSelectedDateRange('15 Jul 2025 - 21 Jul 2025') },
      { key: 'this_month', label: 'This Month (01 Jul 2025 - 31 Jul 2025)', onClick: () => setSelectedDateRange('01 Jul 2025 - 31 Jul 2025') },
      { type: 'divider' },
      {
        key: 'custom',
        label: 'Custom Date Range...',
        icon: <CalendarOutlined style={{ color: 'var(--color-primary)' }} />,
        onClick: () => setIsDateRangeModalOpen(true),
      },
    ],
  };

  const handleCancelRequest = (member) => {
    if (!member) return;
    Modal.confirm({
      title: 'Request Membership Cancellation',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p style={{ margin: '8px 0 6px 0', fontSize: 13.5 }}>
            Are you sure you want to request cancellation for <strong>{member.name}</strong> (Member ID: <code>{member.memberId}</code>)?
          </p>
          <p style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', margin: 0 }}>
            A formal cancellation request will be dispatched to the platform admin for verification and approval.
          </p>
        </div>
      ),
      okText: 'Send Cancel Request',
      okType: 'danger',
      cancelText: 'Keep Membership',
      centered: true,
      onOk: () => {
        setMembersList((prev) =>
          prev.map((m) =>
            m.key === member.key
              ? { ...m, status: 'Cancellation Requested', daysLeft: 'Cancel Pending' }
              : m
          )
        );
        if (selectedMember && selectedMember.key === member.key) {
          setSelectedMember((prev) => ({
            ...prev,
            status: 'Cancellation Requested',
            daysLeft: 'Cancel Pending',
          }));
        }

        // Add a gym-owner cancellation request
        const newReq = {
          key: `can-${Date.now()}`,
          requestId: `CAN-2025-00${cancellationRequests.length + 1}`,
          memberId: member.memberId,
          memberName: member.name,
          phone: member.phone,
          avatar: member.avatar,
          plan: member.plan,
          amount: member.amount,
          refundableAmount: '₹1,500',
          requestDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reason: 'Member requested cancellation directly via Gym Console',
          notes: 'Awaiting Gym Owner refund quote.',
          status: 'Pending Gym Approval',
          adminStatus: 'Pending Gym Approval',
        };

        setCancellationRequests((prev) => [newReq, ...prev]);
        setIsViewModalOpen(false);
        message.success('Cancel request has send to admin');
      },
    });
  };

  const handleAcceptAndSendToAdmin = (req) => {
    if (!req) return;
    let refundAmount = req.maximumRefundAmount ?? 0;
    Modal.confirm({
      title: 'Quote Refund to Member',
      icon: <SendOutlined style={{ color: 'var(--color-primary)' }} />,
      content: (
        <div>
          <p style={{ margin: '8px 0 6px 0', fontSize: 13.5 }}>
            Quote the refund for <strong>{req.memberName}</strong> ({req.requestId}).
          </p>
          <Input
            type="number"
            addonBefore="₹"
            defaultValue={refundAmount}
            min={0}
            max={refundAmount}
            onChange={(event) => {
              refundAmount = Number(event.target.value);
            }}
          />
        </div>
      ),
      okText: 'Send Quote',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        const maximumRefund = Number(req.maximumRefundAmount || 0);
        if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > maximumRefund) {
          throw new Error(`Refund amount must be between ₹0 and ₹${maximumRefund}`);
        }
        await apiClient.post(`/memberships/cancellation-negotiations/${req.requestId}/gym-offer`, {
          deductionAmount: maximumRefund - refundAmount,
          message: 'Refund quote from gym owner',
        });
        setIsCancelDetailsModalOpen(false);
        message.success('Refund quote sent to the member');
        await fetchCancellationNegotiations();
      },
    });
  };

  const handleRejectCancelRequest = (req) => {
    if (!req) return;
    Modal.confirm({
      title: 'Reject Cancellation Request',
      icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p style={{ margin: '8px 0 6px 0', fontSize: 13.5 }}>
            Are you sure you want to decline this cancellation request for <strong>{req.memberName}</strong>?
          </p>
          <p style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', margin: 0 }}>
            The member's subscription will remain active.
          </p>
        </div>
      ),
      okText: 'Reject Request',
      okType: 'danger',
      cancelText: 'Keep',
      centered: true,
      onOk: async () => {
        await apiClient.patch(`/memberships/cancellation-negotiations/${req.requestId}/gym-reject`);
        if (selectedCancelRequest && selectedCancelRequest.key === req.key) {
          setSelectedCancelRequest((prev) => ({
            ...prev,
            status: 'Rejected',
          }));
        }
        setIsCancelDetailsModalOpen(false);
        message.info(`Cancellation request for ${req.memberName} was rejected.`);
        await fetchCancellationNegotiations();
      },
    });
  };

  const getActionMenuItems = (record) => [
    {
      key: 'view',
      label: 'View Member Details',
      icon: <EyeOutlined />,
      onClick: () => handleView(record),
    },
    {
      key: 'extend',
      label: 'Extend Membership',
      icon: <CalendarOutlined style={{ color: 'var(--color-primary)' }} />,
      onClick: () => handleOpenExtend(record),
    },
    {
      key: 'receipt',
      label: 'Download Invoice',
      icon: <DownloadOutlined />,
      onClick: () => message.success(`Invoice for ${record.memberId} downloaded.`),
    },
    { type: 'divider' },
    {
      key: 'cancel',
      label: 'Cancel Membership',
      icon: <DeleteOutlined style={{ color: '#ef4444' }} />,
      onClick: () => handleCancelRequest(record),
    },
  ];

  const columns = [
    {
      title: 'Member ID',
      dataIndex: 'memberId',
      key: 'memberId',
      width: 130,
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text || 'N/A'}>
          <span
            onClick={() => handleView(record)}
            style={{
              fontWeight: 750,
              color: '#1677ff',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Member Name',
      key: 'memberName',
      width: 170,
      ellipsis: true,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar src={record.avatar} size={32} style={{ flexShrink: 0 }} />
          <Tooltip title={record.name}>
            <span
              style={{
                fontWeight: 650,
                color: isDarkMode ? '#ffffff' : '#0f172a',
                fontSize: 13,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'block',
                flex: 1,
                minWidth: 0,
              }}
            >
              {record.name}
            </span>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text || 'N/A'}>
          <span
            style={{
              color: isDarkMode ? '#cbd5e1' : '#334155',
              fontSize: 13,
              fontWeight: 500,
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
      title: 'Membership Plan',
      dataIndex: 'plan',
      key: 'plan',
      width: 155,
      ellipsis: true,
      render: (plan) => (
        <Tooltip title={plan || 'N/A'}>
          <span
            style={{
              color: '#722ed1',
              fontWeight: 650,
              fontSize: 13,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {plan || 'N/A'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text || 'N/A'}>
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
            {text || 'N/A'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Expiry Date',
      key: 'expiryDate',
      width: 120,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.expiryDate || 'N/A'}>
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
            {record.expiryDate || 'N/A'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Days Left',
      key: 'daysLeft',
      width: 120,
      ellipsis: true,
      render: (_, record) => {
        const isExpired = record.status === 'Expired' || record.daysLeft === 'Expired';
        const label = isExpired
          ? 'Expired'
          : record.daysLeft
          ? typeof record.daysLeft === 'number'
            ? `${record.daysLeft} days left`
            : String(record.daysLeft).includes('left')
            ? record.daysLeft
            : `${record.daysLeft} left`
          : 'N/A';
        return (
          <Tooltip title={label}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: isExpired ? '#ef4444' : '#10b981',
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
      dataIndex: 'amount',
      key: 'amount',
      width: 110,
      ellipsis: true,
      render: (amount) => (
        <Tooltip title={amount || 'N/A'}>
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
            {amount || 'N/A'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Payment Type',
      dataIndex: 'paymentType',
      key: 'paymentType',
      width: 130,
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text || 'Online'}>
          <span
            style={{
              fontSize: 12.5,
              color: isDarkMode ? '#cbd5e1' : '#475569',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {text || 'Online'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 105,
      ellipsis: true,
      render: (source) => {
        const isWalkIn = source === 'WALK_IN';
        return (
          <Tag
            color={isWalkIn ? 'purple' : 'blue'}
            style={{
              fontWeight: 700,
              fontSize: 10.5,
              borderRadius: 'var(--radius-base)',
              padding: '2px 8px',
            }}
          >
            {isWalkIn ? 'WALK-IN' : 'APP'}
          </Tag>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      ellipsis: true,
      render: (status) => {
        let color = '#64748b';
        let icon = null;
        if (status === 'Active') {
          color = '#10b981';
          icon = <CheckCircleOutlined />;
        } else if (status === 'Cancellation Requested') {
          color = '#fa8c16';
          icon = <ClockCircleOutlined />;
        } else if (status === 'Expired') {
          color = '#ef4444';
          icon = <CloseCircleOutlined />;
        } else {
          color = '#64748b';
          icon = <StopOutlined />;
        }
        const label = status || 'Active';
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
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Button
            size="small"
            onClick={() => handleView(record)}
            style={{
              borderRadius: 'var(--radius-base)',
              fontSize: 12,
              fontWeight: 650,
              borderColor: isDarkMode ? '#333333' : '#d0d7de',
              color: isDarkMode ? '#ffffff' : '#0f172a',
              height: 28,
              padding: '0 10px',
            }}
          >
            View
          </Button>
          <Dropdown menu={{ items: getActionMenuItems(record) }} trigger={['click']}>
            <Button
              type="text"
              size="small"
              style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              icon={<MoreOutlined style={{ fontSize: 16, color: isDarkMode ? '#888888' : '#64748b' }} />}
            />
          </Dropdown>
        </div>
      ),
    },
  ];

  // Filter Cancellation Requests
  const filteredCancelRequests = cancellationRequests.filter((item) => {
    const q = cancelSearch.trim().toLowerCase();
    const matchQuery =
      !q ||
      item.memberName.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      item.requestId.toLowerCase().includes(q) ||
      item.memberId.toLowerCase().includes(q) ||
      (item.reason && item.reason.toLowerCase().includes(q));

    const matchStatus =
      cancelStatusFilter === 'ALL' || item.status === cancelStatusFilter;

    return matchQuery && matchStatus;
  });

  const clearCancelFilters = () => {
    setCancelSearch('');
    setCancelStatusFilter('ALL');
    message.info('Cancellation filters cleared');
  };

  const cancellationColumns = [
    {
      title: 'Request ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 140,
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text || 'N/A'}>
          <span
            onClick={() => {
              setSelectedCancelRequest(record);
              setIsCancelDetailsModalOpen(true);
            }}
            style={{
              fontWeight: 750,
              color: '#1677ff',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Member',
      key: 'member',
      width: 180,
      ellipsis: true,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar src={record.avatar} size={32} style={{ flexShrink: 0 }} />
          <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            <Tooltip title={record.memberName}>
              <div
                style={{
                  fontWeight: 650,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {record.memberName}
              </div>
            </Tooltip>
            <Tooltip title={record.memberId}>
              <div
                style={{
                  fontSize: 11,
                  color: '#722ed1',
                  fontFamily: 'monospace',
                  marginTop: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {record.memberId}
              </div>
            </Tooltip>
          </div>
        </div>
      ),
    },
    {
      title: 'Phone Number',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      ellipsis: true,
      render: (phone) => (
        <Tooltip title={phone || 'N/A'}>
          <span
            style={{
              color: isDarkMode ? '#cbd5e1' : '#334155',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {phone || 'N/A'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Plan & Fee Paid',
      key: 'planFee',
      width: 170,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={`${record.plan || ''} - Paid: ${record.amount || 0}`}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span
              style={{
                color: '#722ed1',
                fontWeight: 650,
                fontSize: 12.5,
              }}
            >
              {record.plan}
            </span>
            <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', marginTop: 2 }}>
              Paid: {record.amount}{' '}
              <span style={{ fontSize: 11, fontWeight: 500, color: '#52c41a' }}>
                (Est: {record.refundableAmount})
              </span>
            </div>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Reason for Cancellation',
      dataIndex: 'reason',
      key: 'reason',
      width: 220,
      ellipsis: true,
      render: (reason, record) => (
        <Tooltip title={`${reason || ''}${record.notes ? ` - "${record.notes}"` : ''}`}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
              {reason}
            </span>
            {record.notes && (
              <div
                style={{
                  fontSize: 11,
                  color: isDarkMode ? '#888888' : '#64748b',
                  marginTop: 2,
                  fontStyle: 'italic',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                "{record.notes}"
              </div>
            )}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Requested Date',
      dataIndex: 'requestDate',
      key: 'requestDate',
      width: 130,
      ellipsis: true,
      render: (date) => (
        <Tooltip title={date || 'N/A'}>
          <span
            style={{
              fontSize: 12,
              color: isDarkMode ? '#888888' : '#64748b',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {date || 'N/A'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      ellipsis: true,
      render: (status) => {
        let color = '#64748b';
        let icon = null;

        if (status === 'Pending Gym Approval') {
          color = '#fa8c16';
          icon = <ClockCircleOutlined />;
        } else if (status === 'Pending Gym Approval') {
          color = '#1677ff';
          icon = <SyncOutlined spin />;
        } else if (status === 'Approved by Admin') {
          color = '#10b981';
          icon = <CheckCircleFilled />;
        } else {
          color = '#ef4444';
          icon = <CloseCircleOutlined />;
        }

        const label = status || 'Pending';

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
      align: 'right',
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        if (record.status === 'Pending Gym Approval') {
          return (
            <Space size={6}>
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleAcceptAndSendToAdmin(record)}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-base)',
                  fontSize: 12,
                  fontWeight: 600,
                  height: 28,
                  padding: '0 10px',
                }}
              >
                Quote Refund
              </Button>
              <Button
                danger
                size="small"
                onClick={() => handleRejectCancelRequest(record)}
                style={{
                  borderRadius: 'var(--radius-base)',
                  fontSize: 12,
                  height: 28,
                }}
              >
                Reject
              </Button>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedCancelRequest(record);
                  setIsCancelDetailsModalOpen(true);
                }}
                style={{
                  borderRadius: 'var(--radius-base)',
                  fontSize: 12,
                  height: 28,
                }}
              />
            </Space>
          );
        }
        return (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedCancelRequest(record);
              setIsCancelDetailsModalOpen(true);
            }}
            style={{
              borderRadius: 'var(--radius-base)',
              fontSize: 12,
              fontWeight: 500,
              height: 28,
              padding: '0 12px',
            }}
          >
            Quote Refund
          </Button>
        );
      },
    },
  ];

  // Plan Switch Handlers & Columns
  const handleGymAcceptSwitch = (req) => {
    if (!req) return;
    Modal.confirm({
      title: 'Accept & Forward Plan Switch Request',
      icon: <SendOutlined style={{ color: 'var(--color-primary)' }} />,
      content: (
        <div>
          <p style={{ margin: '8px 0 6px 0', fontSize: 13.5 }}>
            Accept switch request for <strong>{req.userId?.fullName || req.memberName || 'Member'}</strong> to <strong>{req.targetTier} Plan</strong>?
          </p>
          <div style={{ padding: '10px 12px', background: isDarkMode ? '#141414' : '#f8fafc', borderRadius: 8, fontSize: 12, marginBottom: 8 }}>
            <div>Prorated Credit Applied: <strong style={{ color: '#52c41a' }}>₹{((req.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2)}</strong></div>
            <div>Net Payable / Settlement: <strong>₹{((req.quoteSnapshot?.netAmountToPayPaise || 0) / 100).toFixed(2)}</strong></div>
          </div>
          <p style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', margin: 0 }}>
            Once forwarded, Super Admin will perform final verification and execute the membership transition atomically.
          </p>
        </div>
      ),
      okText: 'Accept & Send to Admin',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          const reqId = req._id || req.requestId;
          await apiClient.patch(`/memberships/switch-requests/${reqId}/gym-action`, {
            action: 'ACCEPT',
          });
          setSwitchRequests((prev) =>
            prev.map((r) =>
              (r._id === reqId || r.requestId === req.requestId)
                ? { ...r, status: 'PENDING_SUPER_ADMIN_APPROVAL' }
                : r
            )
          );
          if (selectedSwitchReq && (selectedSwitchReq._id === reqId || selectedSwitchReq.requestId === req.requestId)) {
            setSelectedSwitchReq((prev) => ({ ...prev, status: 'PENDING_SUPER_ADMIN_APPROVAL' }));
          }
          setIsSwitchModalOpen(false);
          triggerConfettiPopper();
          message.success('Plan switch request accepted & sent to Super Admin for execution');
        } catch (err) {
          message.error(err.response?.data?.message || err.message || 'Failed to accept switch request');
        }
      },
    });
  };

  const handleOpenRejectSwitch = (req) => {
    setSwitchReqToReject(req);
    setSwitchRejectionReason('');
    setSwitchRejectionModalOpen(true);
  };

  const handleConfirmRejectSwitch = async () => {
    if (!switchReqToReject) return;
    try {
      const reqId = switchReqToReject._id || switchReqToReject.requestId;
      await apiClient.patch(`/memberships/switch-requests/${reqId}/gym-action`, {
        action: 'REJECT',
        rejectionReason: switchRejectionReason || 'Rejected by Gym Management',
      });
      setSwitchRequests((prev) =>
        prev.map((r) =>
          (r._id === reqId || r.requestId === switchReqToReject.requestId)
            ? { ...r, status: 'REJECTED_BY_GYM', rejectionReason: switchRejectionReason }
            : r
        )
      );
      if (selectedSwitchReq && (selectedSwitchReq._id === reqId || selectedSwitchReq.requestId === switchReqToReject.requestId)) {
        setSelectedSwitchReq((prev) => ({ ...prev, status: 'REJECTED_BY_GYM' }));
      }
      setSwitchRejectionModalOpen(false);
      setIsSwitchModalOpen(false);
      message.info(`Switch request for ${switchReqToReject.userId?.fullName || 'Member'} was rejected.`);
    } catch (err) {
      message.error(err.response?.data?.message || err.message || 'Failed to reject switch request');
    }
  };

  const switchColumns = [
    {
      title: 'Request ID',
      dataIndex: 'requestId',
      key: 'requestId',
      width: 140,
      ellipsis: true,
      render: (text, record) => (
        <Tooltip title={text || 'Click to view details'}>
          <span
            onClick={() => {
              setSelectedSwitchReq(record);
              setIsSwitchModalOpen(true);
            }}
            style={{
              fontWeight: 750,
              color: '#1677ff',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {text}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Member',
      key: 'member',
      width: 180,
      ellipsis: true,
      render: (_, record) => {
        const userObj = record.userId || {};
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <Avatar
              src={userObj.profilePicture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'}
              size={32}
              style={{ flexShrink: 0 }}
            />
            <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <Tooltip title={userObj.fullName || 'Member'}>
                <div
                  style={{
                    fontWeight: 650,
                    color: isDarkMode ? '#ffffff' : '#0f172a',
                    fontSize: 13,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {userObj.fullName || 'Member'}
                </div>
              </Tooltip>
              <Tooltip title={userObj.phone || ''}>
                <div
                  style={{
                    fontSize: 11.5,
                    color: isDarkMode ? '#888888' : '#64748b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontFamily: 'monospace',
                  }}
                >
                  {userObj.phone || ''}
                </div>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Current Plan',
      key: 'currentPlan',
      width: 150,
      ellipsis: true,
      render: (_, record) => {
        const tier = record.membershipId?.membershipTier || 'Current';
        const rem = record.quoteSnapshot?.daysRemaining != null ? `${record.quoteSnapshot.daysRemaining} days left` : '';
        return (
          <Tooltip title={`${tier} ${rem ? `(${rem})` : ''}`}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#722ed1', fontWeight: 650, fontSize: 13 }}>
                {tier}
              </span>
              {rem && (
                <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                  {rem}
                </div>
              )}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Requested Plan',
      key: 'requestedPlan',
      width: 150,
      ellipsis: true,
      render: (_, record) => {
        const switchType = record.quoteSnapshot?.switchType || 'SWITCH';
        return (
          <Tooltip title={`${record.targetTier} Plan (${switchType})`}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span
                style={{
                  color: switchType === 'UPGRADE' ? '#1677ff' : '#d97706',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {record.targetTier} Plan
              </span>
              <div style={{ fontSize: 11, fontWeight: 600, color: isDarkMode ? '#aaaaaa' : '#64748b', marginTop: 2 }}>
                {switchType}
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Proration & Settlement',
      key: 'settlement',
      width: 180,
      ellipsis: true,
      render: (_, record) => {
        const quote = record.quoteSnapshot || {};
        const credit = ((quote.proRatedCreditPaise || 0) / 100).toFixed(2);
        const net = ((quote.netAmountToPayPaise || 0) / 100).toFixed(2);
        const policy = quote.downgradePolicy || 'WALLET';
        const leftover = ((quote.leftoverCreditPaise || 0) / 100).toFixed(2);
        const extraDays = quote.extraDaysAwarded || 0;
        const isUpgrade = quote.switchType === 'UPGRADE';

        return (
          <Tooltip title={`Net: ₹${net} | Credit: -₹${credit}`}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                Net: ₹{net}
              </div>
              <div style={{ fontSize: 11, color: '#52c41a', fontWeight: 600, marginTop: 1 }}>
                Credit: -₹{credit}
              </div>
              <div style={{ fontSize: 10.5, color: isDarkMode ? '#94a3b8' : '#64748b', marginTop: 2, fontWeight: 600 }}>
                {isUpgrade
                  ? record.paymentDetails?.method || 'UPI Payment'
                  : policy === 'REFUND'
                  ? `Refund: ₹${leftover}`
                  : policy === 'EXTEND'
                  ? `+${extraDays} Days Ext.`
                  : `Wallet: ₹${leftover}`}
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      ellipsis: true,
      render: (status) => {
        let color = '#64748b';
        let icon = null;
        let label = 'Pending';

        if (status === 'PENDING_GYM_APPROVAL') {
          color = '#fa8c16';
          icon = <ClockCircleOutlined />;
          label = 'Pending Gym Review';
        } else if (status === 'PENDING_SUPER_ADMIN_APPROVAL') {
          color = '#1677ff';
          icon = <SyncOutlined spin />;
          label = 'Sent to Super Admin';
        } else if (status === 'APPROVED_AND_EXECUTED') {
          color = '#10b981';
          icon = <CheckCircleFilled />;
          label = 'Approved & Executed';
        } else {
          color = '#ef4444';
          icon = <CloseCircleOutlined />;
          label = status === 'REJECTED_BY_GYM' ? 'Rejected by Gym' : 'Rejected by Admin';
        }

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
      align: 'right',
      width: 180,
      fixed: 'right',
      render: (_, record) => {
        if (record.status === 'PENDING_GYM_APPROVAL') {
          return (
            <Space size={6}>
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleGymAcceptSwitch(record)}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-base)',
                  fontSize: 12,
                  fontWeight: 600,
                  height: 28,
                  padding: '0 10px',
                }}
              >
                Accept
              </Button>
              <Button
                danger
                size="small"
                onClick={() => handleOpenRejectSwitch(record)}
                style={{
                  borderRadius: 'var(--radius-base)',
                  fontSize: 12,
                  height: 28,
                }}
              >
                Reject
              </Button>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => {
                  setSelectedSwitchReq(record);
                  setIsSwitchModalOpen(true);
                }}
                style={{
                  borderRadius: 'var(--radius-base)',
                  fontSize: 12,
                  height: 28,
                }}
              />
            </Space>
          );
        }
        return (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedSwitchReq(record);
              setIsSwitchModalOpen(true);
            }}
            style={{
              borderRadius: 'var(--radius-base)',
              fontSize: 12,
              fontWeight: 500,
              height: 28,
              padding: '0 12px',
            }}
          >
            View Details
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      {/* Top Header with Title on Left and Universal Search + Filters on Right */}
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
          <Title level={2} style={{ margin: 0, color: isDarkMode ? '#ffffff' : '#0f172a', fontWeight: 700 }}>
            Membership Management
          </Title>
          <Text style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13.5 }}>
            Manage all gym member subscriptions and details.
          </Text>
        </div>

        {/* Universal Search & Filters Aligned to Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Input
            prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
            placeholder="Search by name, phone, member ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onPressEnter={() => {
              setCurrentPage(1);
              void fetchGymMemberships(1, pageSize, searchQuery, statusFilter, planFilter);
            }}
            allowClear
            style={{ width: 250, height: 40, borderRadius: 'var(--radius-base)' }}
          />

          <Select
            value={planFilter}
            onChange={(val) => {
              setPlanFilter(val);
              setCurrentPage(1);
              void fetchGymMemberships(1, pageSize, searchQuery, statusFilter, val);
            }}
            style={{ width: 140, height: 40 }}
          >
            <Option value="ALL">All Plans</Option>
            <Option value="Monthly">Monthly</Option>
            <Option value="Quarterly">Quarterly</Option>
            <Option value="Half-Yearly">Half-Yearly</Option>
            <Option value="Annual">Annual</Option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
              void fetchGymMemberships(1, pageSize, searchQuery, val, planFilter, sourceFilter);
            }}
            style={{ width: 140, height: 40 }}
          >
            <Option value="ALL">All Status</Option>
            <Option value="Active">Active</Option>
            <Option value="Expiring Soon">Expiring Soon</Option>
            <Option value="Switched">Switched</Option>
            <Option value="Expired">Expired</Option>
            <Option value="Cancelled">Cancelled</Option>
          </Select>

          <Select
            value={sourceFilter}
            onChange={(val) => {
              setSourceFilter(val);
              setCurrentPage(1);
              void fetchGymMemberships(1, pageSize, searchQuery, statusFilter, planFilter, val);
            }}
            style={{ width: 130, height: 40 }}
          >
            <Option value="ALL">All Sources</Option>
            <Option value="APP">GYMEZY App</Option>
            <Option value="WALK_IN">Walk-in</Option>
          </Select>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsAddModalOpen(true)}
            style={{
              height: 40,
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              backgroundColor: '#722ed1',
              borderColor: '#722ed1',
            }}
          >
            New Walk-in Member
          </Button>

          <Dropdown menu={dateRangeMenu} trigger={['click']}>
            <div
              style={{
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                border: `1px solid ${isDarkMode ? '#262626' : '#d9d9d9'}`,
                borderRadius: 'var(--radius-base)',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: isDarkMode ? '#ffffff' : '#0f172a',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                <span>{selectedDateRange === '21 Jul 2025 - 21 Jul 2025' ? 'Date Range' : selectedDateRange}</span>
              </div>
              <DownOutlined style={{ fontSize: 9, color: isDarkMode ? '#888888' : '#64748b' }} />
            </div>
          </Dropdown>

          <Button
            icon={<ReloadOutlined />}
            onClick={clearFilters}
            style={{
              height: 40,
              borderRadius: 'var(--radius-base)',
              fontWeight: 600,
              color: isDarkMode ? '#aaaaaa' : '#64748b',
              borderColor: isDarkMode ? '#333333' : '#d0d7de',
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* VIEW 1: ALL MEMBERS TAB */}
      {activeTab === 'members' && (
        <>
          {/* 4 SUMMARY STAT CARDS */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Total Members */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <TeamOutlined style={{ fontSize: 22, color: 'var(--color-primary)', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Total Members
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                      {dynamicTotal}
                    </div>
                    <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, marginTop: 4 }}>
                      Registered members
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Active Members */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <CheckCircleOutlined style={{ fontSize: 22, color: '#16a34a', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Active Members
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                      {dynamicActive}
                    </div>
                    <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                      Current active plans
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Expiring This Month */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <ClockCircleOutlined style={{ fontSize: 22, color: '#d97706', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Expiring Soon
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                      {dynamicExpiringSoon}
                    </div>
                    <div style={{ fontSize: 12, color: '#d97706', fontWeight: 600, marginTop: 4 }}>
                      Requires renewal
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Expired Members */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <CloseCircleOutlined style={{ fontSize: 22, color: '#dc2626', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Expired Members
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                      {dynamicExpired}
                    </div>
                    <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
                      Past validity date
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* MEMBERS TABLE CARD */}
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Table
              loading={isMembersLoading}
              pagination={false}
              size="middle"
              scroll={{ x: 1400 }}
              dataSource={membersList}
              columns={columns}
              rowKey={(r) => r.key || r.memberId}
            />

            {/* Custom Table Footer with Pagination */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
              }}
            >
              <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
                Showing {totalMembersCount > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                {Math.min(currentPage * pageSize, totalMembersCount)} of {totalMembersCount} members
              </div>
              <Pagination
                current={currentPage}
                onChange={(page) => setCurrentPage(page)}
                total={totalMembersCount}
                pageSize={pageSize}
                showSizeChanger={false}
              />
            </div>
          </Card>
        </>
      )}

      {/* VIEW 2: PLAN SWITCH REQUESTS TAB */}
      {activeTab === 'switches' && (
        <>
          {/* 4 SUMMARY STAT CARDS FOR PLAN SWITCH REQUESTS */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Total Switches */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <SyncOutlined style={{ fontSize: 22, color: 'var(--color-primary)', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Total Switch Requests
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                      {switchRequests.length}
                    </div>
                    <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, marginTop: 4 }}>
                      Member initiated
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Pending Gym Review */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <ClockCircleOutlined style={{ fontSize: 22, color: '#fa8c16', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Pending Gym Review
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#fa8c16', lineHeight: 1.2, marginTop: 2 }}>
                      {switchRequests.filter((r) => r.status === 'PENDING_GYM_APPROVAL').length}
                    </div>
                    <div style={{ fontSize: 12, color: '#fa8c16', fontWeight: 600, marginTop: 4 }}>
                      Action required
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Sent to Super Admin */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <SendOutlined style={{ fontSize: 22, color: '#1677ff', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Forwarded to Admin
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff', lineHeight: 1.2, marginTop: 2 }}>
                      {switchRequests.filter((r) => r.status === 'PENDING_SUPER_ADMIN_APPROVAL').length}
                    </div>
                    <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, marginTop: 4 }}>
                      In Admin Review
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Approved & Executed */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <CheckCircleFilled style={{ fontSize: 22, color: '#00bf62', opacity: 0.75, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Completed Switches
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#00bf62', lineHeight: 1.2, marginTop: 2 }}>
                      {switchRequests.filter((r) => r.status === 'APPROVED_AND_EXECUTED').length}
                    </div>
                    <div style={{ fontSize: 12, color: '#00bf62', fontWeight: 600, marginTop: 4 }}>
                      Active in system
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* SEARCH & FILTER BAR */}
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              marginBottom: 16,
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} sm={12} md={10}>
                <Input
                  prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
                  placeholder="Search by Member name, phone or Request ID..."
                  value={switchSearch}
                  onChange={(e) => setSwitchSearch(e.target.value)}
                  allowClear
                  style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Select
                  value={switchStatusFilter}
                  onChange={setSwitchStatusFilter}
                  style={{ width: '100%', height: 40 }}
                >
                  <Option value="ALL">All Switch Statuses</Option>
                  <Option value="PENDING_GYM_APPROVAL">Pending Gym Review</Option>
                  <Option value="PENDING_SUPER_ADMIN_APPROVAL">Forwarded to Super Admin</Option>
                  <Option value="APPROVED_AND_EXECUTED">Approved & Executed</Option>
                  <Option value="REJECTED_BY_GYM">Rejected by Gym</Option>
                  <Option value="REJECTED_BY_SUPER_ADMIN">Rejected by Super Admin</Option>
                </Select>
              </Col>
              <Col xs={24} sm={12} md={6} style={{ textAlign: 'right' }}>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setSwitchSearch('');
                    setSwitchStatusFilter('ALL');
                    void fetchGymSwitchRequests();
                  }}
                  style={{ height: 40, borderRadius: 'var(--radius-base)' }}
                >
                  Refresh
                </Button>
              </Col>
            </Row>
          </Card>

          {/* PLAN SWITCH REQUESTS TABLE */}
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Table
              loading={isSwitchLoading}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              size="middle"
              scroll={{ x: 1300 }}
              dataSource={switchRequests.filter((item) => {
                const userObj = item.userId || {};
                const matchSearch =
                  !switchSearch ||
                  (userObj.fullName || '').toLowerCase().includes(switchSearch.toLowerCase()) ||
                  (userObj.phone || '').includes(switchSearch) ||
                  (item.requestId || '').toLowerCase().includes(switchSearch.toLowerCase());
                const matchStatus =
                  switchStatusFilter === 'ALL' || item.status === switchStatusFilter;
                return matchSearch && matchStatus;
              })}
              columns={switchColumns}
              rowKey={(r) => r._id || r.requestId}
            />
          </Card>
        </>
      )}

      {/* VIEW 3: CANCELLATION REQUESTS TAB */}
      {activeTab === 'cancellations' && (
        <>
          {/* 4 SUMMARY STAT CARDS FOR CANCELLATION REQUESTS */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {/* Total Requests */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe',
                      color: isDarkMode ? '#b37feb' : '#722ed1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <FileTextOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Total Cancellation Requests
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.2, marginTop: 2 }}>
                      {cancellationRequests.length}
                    </div>
                    <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
                      Across all plans
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Pending Gym Approval */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: isDarkMode ? 'rgba(250, 140, 22, 0.2)' : '#fef4e8',
                      color: '#fa8c16',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <ClockCircleOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Pending Gym Approval
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#fa8c16', lineHeight: 1.2, marginTop: 2 }}>
                      {cancellationRequests.filter((r) => r.status === 'Pending Gym Approval').length}
                    </div>
                    <div style={{ fontSize: 12, color: '#fa8c16', fontWeight: 600, marginTop: 4 }}>
                      Action required by gym
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Pending Gym Approval */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: isDarkMode ? 'rgba(22, 119, 255, 0.2)' : '#e6f4ff',
                      color: '#1677ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <SendOutlined />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Awaiting Refund Quote
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff', lineHeight: 1.2, marginTop: 2 }}>
                      {cancellationRequests.filter((r) => r.status === 'Pending Gym Approval').length}
                    </div>
                    <div style={{ fontSize: 12, color: '#1677ff', fontWeight: 600, marginTop: 4 }}>
                      In admin refund review
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            {/* Approved by Admin */}
            <Col xs={24} sm={12} lg={6}>
              <Card
                style={{
                  backgroundColor: 'var(--bg-surface-elevated)',
                  borderColor: 'var(--border-color)',
                  borderRadius: 'var(--radius-base)',
                  boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
                }}
                styles={{ body: { padding: '20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.2)' : '#eaf8ef',
                      color: '#00bf62',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircleFilled />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', fontWeight: 500 }}>
                      Approved & Settled
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#00bf62', lineHeight: 1.2, marginTop: 2 }}>
                      {cancellationRequests.filter((r) => r.status === 'Approved by Admin').length}
                    </div>
                    <div style={{ fontSize: 12, color: '#00bf62', fontWeight: 600, marginTop: 4 }}>
                      Refund completed
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* CANCELLATION REQUESTS FILTER CARD */}
          <Card
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              marginBottom: 24,
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <Row gutter={[16, 16]} align="bottom">
              {/* Search by Name / Phone / Request ID / Reason */}
              <Col xs={24} sm={14} md={12} lg={10}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
                  Search Cancellation Requests
                </div>
                <Input
                  prefix={<SearchOutlined style={{ color: isDarkMode ? '#888888' : '#94a3b8' }} />}
                  placeholder="Search by Member Name, Phone, Request ID, Member ID, or Reason..."
                  value={cancelSearch}
                  onChange={(e) => setCancelSearch(e.target.value)}
                  allowClear
                  style={{ height: 42, borderRadius: 'var(--radius-base)' }}
                />
              </Col>

              {/* Status Filter */}
              <Col xs={24} sm={10} md={6} lg={6}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#475569', marginBottom: 6 }}>
                  Approval Status
                </div>
                <Select
                  value={cancelStatusFilter}
                  onChange={setCancelStatusFilter}
                  style={{ width: '100%', height: 42 }}
                >
                  <Option value="ALL">All Statuses</Option>
                  <Option value="Pending Gym Approval">Pending Gym Approval</Option>
                  <Option value="Pending Gym Approval">Pending Gym Approval</Option>
                  <Option value="Approved by Admin">Approved by Admin</Option>
                  <Option value="Rejected">Rejected</Option>
                </Select>
              </Col>

              {/* Actions */}
              <Col xs={24} sm={24} md={6} lg={8}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <Button
                    icon={<FilterOutlined />}
                    onClick={() => message.info(`Found ${filteredCancelRequests.length} cancellation requests.`)}
                    style={{
                      height: 42,
                      padding: '0 20px',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      borderColor: isDarkMode ? '#333333' : '#d0d7de',
                    }}
                  >
                    Filter
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={clearCancelFilters}
                    style={{
                      height: 42,
                      padding: '0 18px',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      color: isDarkMode ? '#aaaaaa' : '#64748b',
                      borderColor: isDarkMode ? '#333333' : '#d0d7de',
                    }}
                  >
                    Clear Filters
                  </Button>
                </div>
              </Col>
            </Row>
          </Card>

          {/* CANCELLATION REQUESTS TABLE CARD */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}>
                <StopOutlined style={{ color: '#ef4444' }} />
                <span>All Cancellation Requests</span>
              </div>
            }
            style={{
              backgroundColor: 'var(--bg-surface-elevated)',
              borderColor: 'var(--border-color)',
              borderRadius: 'var(--radius-base)',
              boxShadow: isDarkMode ? 'none' : '0 1px 3px rgba(0,0,0,0.03)',
            }}
            styles={{ body: { padding: '16px 20px' } }}
          >
            <Table
              pagination={false}
              size="middle"
              scroll={{ x: 1300 }}
              dataSource={filteredCancelRequests}
              columns={cancellationColumns}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No cancellation requests found matching your filter criteria."
                  />
                ),
              }}
            />

            {/* Custom Table Footer with Pagination */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
              }}
            >
              <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b' }}>
                Showing 1 to {filteredCancelRequests.length} of {cancellationRequests.length} cancellation requests
              </div>
              <Pagination
                current={cancelCurrentPage}
                onChange={setCancelCurrentPage}
                total={cancellationRequests.length}
                pageSize={10}
                showSizeChanger={false}
              />
            </div>
          </Card>
        </>
      )}

      {/* CANCELLATION REQUEST DETAILS REVIEW MODAL */}
      <Modal
        title={
          <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Cancellation Request Review
          </div>
        }
        open={isCancelDetailsModalOpen}
        onCancel={() => setIsCancelDetailsModalOpen(false)}
        footer={null}
        width={540}
        centered
        destroyOnClose
        styles={{ body: { padding: '8px 4px 12px 4px' } }}
      >
        {selectedCancelRequest && (
          <div>
            {/* Header profile info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, marginTop: 6 }}>
              <Avatar
                src={selectedCancelRequest.avatar}
                size={64}
                style={{
                  border: `2px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCancelRequest.memberName}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PhoneOutlined /> {selectedCancelRequest.phone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <Tag color="purple" style={{ borderRadius: 4, fontWeight: 650, fontSize: 11.5, margin: 0 }}>
                    Member ID: {selectedCancelRequest.memberId}
                  </Tag>
                  <Tag color="blue" style={{ borderRadius: 4, fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, margin: 0 }}>
                    Request ID: {selectedCancelRequest.requestId}
                  </Tag>
                </div>
              </div>
            </div>

            {/* Key-Value Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {/* Plan */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, color: isDarkMode ? '#888888' : '#64748b' }}>Membership Plan</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCancelRequest.plan}
                </span>
              </div>

              {/* Fee Paid */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, color: isDarkMode ? '#888888' : '#64748b' }}>Original Fee Paid</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedCancelRequest.amount}
                </span>
              </div>

              {/* Estimated Refundable Amount */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, color: isDarkMode ? '#888888' : '#64748b' }}>Estimated Refund Balance</span>
                <Tag color="green" style={{ fontSize: 13, fontWeight: 700, borderRadius: 4, margin: 0 }}>
                  {selectedCancelRequest.refundableAmount}
                </Tag>
              </div>

              {/* Requested On */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, color: isDarkMode ? '#888888' : '#64748b' }}>Requested Date & Time</span>
                <span style={{ fontSize: 13, color: isDarkMode ? '#cccccc' : '#334155', fontWeight: 500 }}>
                  {selectedCancelRequest.requestDate}
                </span>
              </div>

              {/* Approval Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5, color: isDarkMode ? '#888888' : '#64748b' }}>Current Status</span>
                <div>
                  {selectedCancelRequest.status === 'Pending Gym Approval' && (
                    <Tag color="orange" icon={<ClockCircleOutlined />} style={{ borderRadius: 4, fontWeight: 650 }}>
                      Pending Gym Approval
                    </Tag>
                  )}
                  {selectedCancelRequest.status === 'Quoted Refund' && (
                    <Tag color="processing" icon={<SyncOutlined spin />} style={{ borderRadius: 4, fontWeight: 650 }}>
                      Quoted Refund
                    </Tag>
                  )}
                  {selectedCancelRequest.status === 'Approved by Admin' && (
                    <Tag color="success" icon={<CheckCircleFilled />} style={{ borderRadius: 4, fontWeight: 650 }}>
                      Approved by Admin
                    </Tag>
                  )}
                  {selectedCancelRequest.status === 'Rejected' && (
                    <Tag color="error" icon={<CloseCircleOutlined />} style={{ borderRadius: 4, fontWeight: 650 }}>
                      Rejected
                    </Tag>
                  )}
                </div>
              </div>
            </div>

            {/* Cancellation Reason Box */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#aaaaaa' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Reason for Cancellation
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#ef4444', marginTop: 4 }}>
                {selectedCancelRequest.reason}
              </div>
              {selectedCancelRequest.notes && (
                <div style={{ fontSize: 12.5, color: isDarkMode ? '#cccccc' : '#475569', marginTop: 6, lineHeight: 1.4 }}>
                  <strong>Notes:</strong> {selectedCancelRequest.notes}
                </div>
              )}
            </div>

            {/* Admin Workflow Note */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? 'rgba(22, 119, 255, 0.12)' : '#e6f4ff',
                marginBottom: 24,
              }}
            >
              <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 16, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: isDarkMode ? '#91caff' : '#0958d9', lineHeight: 1.4 }}>
                {selectedCancelRequest.status === 'Pending Gym Approval'
                  ? 'Enter a refund amount to send a quote directly to the member.'
                  : selectedCancelRequest.status === 'Quoted Refund'
                  ? 'The refund quote is waiting for the member to accept or re-request negotiation.'
                  : 'This cancellation request has been resolved and closed.'}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                onClick={() => setIsCancelDetailsModalOpen(false)}
                style={{
                  flex: 1,
                  minWidth: 80,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 14,
                  borderColor: isDarkMode ? '#333333' : '#d0d7de',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                }}
              >
                Close
              </Button>
              {selectedCancelRequest.status === 'Pending Gym Approval' && (
                <>
                  <Button
                    danger
                    onClick={() => handleRejectCancelRequest(selectedCancelRequest)}
                    style={{
                      flex: 1,
                      minWidth: 100,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 13.5,
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => handleAcceptAndSendToAdmin(selectedCancelRequest)}
                    style={{
                      flex: 1.4,
                      minWidth: 190,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 13.5,
                      backgroundColor: 'var(--color-primary)',
                      borderColor: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    Send Refund Quote
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* PLAN SWITCH REQUEST DETAILS MODAL */}
      <Modal
        title={
          <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Plan Switch Request Details
          </div>
        }
        open={isSwitchModalOpen}
        onCancel={() => setIsSwitchModalOpen(false)}
        footer={null}
        width={540}
        centered
        destroyOnClose
        styles={{ body: { padding: '8px 4px 12px 4px' } }}
      >
        {selectedSwitchReq && (
          <div>
            {/* User Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, marginTop: 6 }}>
              <Avatar
                src={selectedSwitchReq.userId?.avatar || selectedSwitchReq.userId?.profilePicture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&auto=format&fit=crop'}
                size={64}
                style={{
                  border: `2px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 19, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedSwitchReq.userId?.fullName || 'Gym Member'}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PhoneOutlined /> {selectedSwitchReq.userId?.phone || 'No phone recorded'}
                </div>
                <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                  <Tag color="blue" style={{ borderRadius: 4, fontWeight: 700, fontFamily: 'monospace', fontSize: 11.5, margin: 0 }}>
                    {selectedSwitchReq.requestId}
                  </Tag>
                </div>
              </div>
            </div>

            {/* Workflow Stage Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--radius-base)',
                backgroundColor:
                  selectedSwitchReq.status === 'PENDING_GYM_APPROVAL'
                    ? isDarkMode ? 'rgba(250, 140, 22, 0.15)' : '#fff7e6'
                    : selectedSwitchReq.status === 'PENDING_SUPER_ADMIN_APPROVAL'
                    ? isDarkMode ? 'rgba(22, 119, 255, 0.15)' : '#e6f4ff'
                    : isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                marginBottom: 20,
              }}
            >
              <InfoCircleOutlined
                style={{
                  color:
                    selectedSwitchReq.status === 'PENDING_GYM_APPROVAL'
                      ? '#fa8c16'
                      : selectedSwitchReq.status === 'PENDING_SUPER_ADMIN_APPROVAL'
                      ? '#1677ff'
                      : '#00bf62',
                  fontSize: 16,
                  flexShrink: 0,
                }}
              />
              <div style={{ fontSize: 12.5, color: isDarkMode ? '#ffffff' : '#0f172a', lineHeight: 1.4 }}>
                {selectedSwitchReq.status === 'PENDING_GYM_APPROVAL' && (
                  <span><strong>Stage 1 of 2:</strong> Awaiting Gym Owner review before dispatching to Super Admin.</span>
                )}
                {selectedSwitchReq.status === 'PENDING_SUPER_ADMIN_APPROVAL' && (
                  <span><strong>Stage 2 of 2:</strong> Forwarded to Super Admin for final verification and atomic execution.</span>
                )}
                {selectedSwitchReq.status === 'APPROVED_AND_EXECUTED' && (
                  <span><strong>Completed:</strong> Plan switch verified and executed. Member pass is updated.</span>
                )}
                {selectedSwitchReq.status.includes('REJECTED') && (
                  <span><strong>Rejected:</strong> {selectedSwitchReq.rejectionReason || 'Switch request was declined.'}</span>
                )}
              </div>
            </div>

            {/* Proration Breakdown Summary */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#141414' : '#f8fafc',
                border: `1px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: isDarkMode ? '#aaaaaa' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                Proration & Calculation Breakdown
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Current Plan:</span>
                  <span style={{ fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedSwitchReq.membershipId?.membershipTier || 'Current'} ({selectedSwitchReq.quoteSnapshot?.daysRemaining} days left)
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Target Plan:</span>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                    {selectedSwitchReq.targetTier} Plan
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Unused Credit Deducted:</span>
                  <span style={{ fontWeight: 800, color: '#52c41a' }}>
                    - ₹{((selectedSwitchReq.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: isDarkMode ? '#888888' : '#64748b' }}>Target Plan Price:</span>
                  <span style={{ fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    ₹{((selectedSwitchReq.quoteSnapshot?.newPricePaise || 0) / 100).toFixed(2)}
                  </span>
                </div>

                <div style={{ height: 1, backgroundColor: isDarkMode ? '#222222' : '#e2e8f0', margin: '4px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    Net Amount Payable:
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--color-primary)' }}>
                    ₹{((selectedSwitchReq.quoteSnapshot?.netAmountToPayPaise || 0) / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                onClick={() => setIsSwitchModalOpen(false)}
                style={{
                  flex: 1,
                  minWidth: 80,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 14,
                  borderColor: isDarkMode ? '#333333' : '#d0d7de',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                }}
              >
                Close
              </Button>
              {selectedSwitchReq.status === 'PENDING_GYM_APPROVAL' && (
                <>
                  <Button
                    danger
                    onClick={() => handleOpenRejectSwitch(selectedSwitchReq)}
                    style={{
                      flex: 1,
                      minWidth: 100,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 13.5,
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => handleGymAcceptSwitch(selectedSwitchReq)}
                    style={{
                      flex: 1.4,
                      minWidth: 190,
                      height: 44,
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 13.5,
                      backgroundColor: 'var(--color-primary)',
                      borderColor: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    Accept & Send to Admin
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* REJECTION REASON MODAL */}
      <Modal
        title="Decline Plan Switch Request"
        open={switchRejectionModalOpen}
        onCancel={() => setSwitchRejectionModalOpen(false)}
        onOk={handleConfirmRejectSwitch}
        okText="Confirm Reject"
        okType="danger"
        destroyOnClose
      >
        <div style={{ padding: '12px 0' }}>
          <Paragraph style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13, marginBottom: 12 }}>
            Please state the reason for declining this switch request. This note will be recorded for member reference.
          </Paragraph>
          <Input.TextArea
            rows={3}
            value={switchRejectionReason}
            onChange={(e) => setSwitchRejectionReason(e.target.value)}
            placeholder="e.g. Plan switch criteria not met or slot fully occupied..."
            style={{ borderRadius: 'var(--radius-base)' }}
          />
        </div>
      </Modal>

      {/* VIEW MEMBER DETAILS MODAL */}
      <Modal
        title={
          <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Member Details
          </div>
        }
        open={isViewModalOpen}
        onCancel={() => setIsViewModalOpen(false)}
        footer={null}
        width={480}
        centered
        destroyOnClose
        styles={{ body: { padding: '8px 4px 12px 4px' } }}
      >
        {selectedMember && (
          <div>
            {/* Customer Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, marginTop: 6 }}>
              <Avatar
                src={selectedMember.avatar}
                size={68}
                style={{
                  border: `2px solid ${isDarkMode ? '#222222' : '#e2e8f0'}`,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedMember.name}
                </div>
                <div style={{ fontSize: 13, color: isDarkMode ? '#888888' : '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PhoneOutlined /> {selectedMember.phone}
                </div>
                <div style={{ marginTop: 6 }}>
                  <Tag
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe',
                      color: isDarkMode ? '#b37feb' : '#722ed1',
                      border: 'none',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 650,
                      fontSize: 12,
                      padding: '2px 10px',
                    }}
                  >
                    Member ID: {selectedMember.memberId}
                  </Tag>
                </div>
              </div>
            </div>

            {/* Key-Value Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              {/* Row 1: Start Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Start Date</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedMember.startDate}
                </div>
              </div>

              {/* Row 2: End Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>End Date</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                    {selectedMember.expiryDate}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: selectedMember.status === 'Expired' || selectedMember.daysLeft === 'Expired' ? '#e11d48' : '#fa8c16',
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    ({selectedMember.daysLeft})
                  </div>
                </div>
              </div>

              {/* Row 3: Payment Made */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <DollarCircleOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Payment Made</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedMember.amount}
                </div>
              </div>

              {/* Row 4: Payment Type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CreditCardOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Payment Type</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {selectedMember.paymentType}
                </div>
              </div>

              {/* Row 5: Membership Plan */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <SafetyCertificateOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Membership Plan</span>
                </div>
                <div>
                  <Tag
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.2)' : '#f3effe',
                      color: isDarkMode ? '#b37feb' : '#722ed1',
                      border: 'none',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 12,
                      padding: '2px 10px',
                      margin: 0,
                    }}
                  >
                    {selectedMember.plan}
                  </Tag>
                </div>
              </div>

              {/* Row 6: Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#334155', fontSize: 14, fontWeight: 500 }}>
                  <CheckCircleOutlined style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 16 }} />
                  <span>Status</span>
                </div>
                <div>
                  <Tag
                    style={{
                      backgroundColor:
                        selectedMember.status === 'Active'
                          ? isDarkMode
                            ? 'rgba(0, 191, 98, 0.15)'
                            : '#eaf8ef'
                          : selectedMember.status === 'Cancellation Requested'
                          ? isDarkMode
                            ? 'rgba(250, 140, 22, 0.15)'
                            : '#fff7e6'
                          : isDarkMode
                          ? 'rgba(225, 29, 72, 0.15)'
                          : '#fdeeed',
                      color:
                        selectedMember.status === 'Active'
                          ? '#00bf62'
                          : selectedMember.status === 'Cancellation Requested'
                          ? '#fa8c16'
                          : '#e11d48',
                      border: 'none',
                      borderRadius: 'var(--radius-base)',
                      fontWeight: 600,
                      fontSize: 12,
                      padding: '2px 10px',
                      margin: 0,
                    }}
                  >
                    {selectedMember.status}
                  </Tag>
                </div>
              </div>
            </div>

            {/* Expiry Notice Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.15)' : '#f3effe',
                marginBottom: 24,
              }}
            >
              <InfoCircleOutlined style={{ color: '#722ed1', fontSize: 18, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: isDarkMode ? '#d3adf7' : '#531dab', lineHeight: 1.4 }}>
                This membership will expire on {selectedMember.expiryDate}.
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button
                onClick={() => setIsViewModalOpen(false)}
                style={{
                  flex: 1,
                  minWidth: 80,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 14,
                  borderColor: isDarkMode ? '#333333' : '#d0d7de',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                }}
              >
                Close
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => handleCancelRequest(selectedMember)}
                style={{
                  flex: 1.15,
                  minWidth: 150,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 13.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                Cancel Membership
              </Button>
              <Button
                type="primary"
                icon={<CalendarOutlined style={{ color: '#ffffff' }} />}
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenExtend(selectedMember);
                }}
                style={{
                  flex: 1.25,
                  minWidth: 160,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 13.5,
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                Extend Membership
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* EXTEND MEMBERSHIP MODAL */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-base)',
                backgroundColor: 'var(--color-primary-bg)',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
              }}
            >
              <CalendarOutlined />
            </div>
            <span>Extend Membership Subscription</span>
          </div>
        }
        open={isExtendModalOpen}
        onCancel={() => {
          setIsExtendModalOpen(false);
          extendForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        {selectedMember && (
          <Form form={extendForm} layout="vertical" onFinish={handleExtendSubmit} style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16, padding: '12px 16px', backgroundColor: isDarkMode ? '#141414' : '#f8fafc', borderRadius: 'var(--radius-base)' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: isDarkMode ? '#ffffff' : '#0f172a' }}>{selectedMember.name}</div>
              <div style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>{selectedMember.memberId} • Current Plan: {selectedMember.plan}</div>
            </div>

            <Form.Item label="Select Extension Plan" name="plan" rules={[{ required: true }]}>
              <Select style={{ height: 42 }}>
                <Option value="Silver (1 Month)">Silver (1 Month) - ₹1,599</Option>
                <Option value="Gold (3 Months)">Gold (3 Months) - ₹4,499</Option>
                <Option value="Platinum (6 Months)">Platinum (6 Months) - ₹7,999</Option>
                <Option value="Annual (12 Months)">Annual (12 Months) - ₹14,999</Option>
              </Select>
            </Form.Item>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="Payment Method" name="paymentType" rules={[{ required: true }]}>
                  <Select style={{ height: 42 }}>
                    <Option value="Online">Online Payment</Option>
                    <Option value="GPay">GPay / UPI</Option>
                    <Option value="Cash">Cash at Frontdesk</Option>
                    <Option value="COD">Card on Delivery</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Renewal Amount (₹)" name="amount" rules={[{ required: true }]}>
                  <Input prefix="₹" style={{ height: 42, borderRadius: 'var(--radius-base)' }} />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button onClick={() => setIsExtendModalOpen(false)} style={{ borderRadius: 'var(--radius-base)', height: 40 }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<CalendarOutlined />}
                style={{
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  height: 40,
                }}
              >
                Confirm Extension
              </Button>
            </div>
          </Form>
        )}
      </Modal>

      {/* ADD NEW MEMBER MODAL (PIXEL-PERFECT FROM USER REFERENCE) */}
      <Modal
        title={
          <div style={{ fontSize: 18, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
            Add New Member
          </div>
        }
        open={isAddModalOpen}
        onCancel={() => {
          setIsAddModalOpen(false);
          form.resetFields();
          setAddMemberPhoto(null);
          setSelectedPlanKey(activePlans[0]?.key || 'monthly');
          setSelectedPaymentType('Online');
          setSelectedTrainerId('none');
          setMembershipStartDate(null);
        }}
        footer={null}
        width={500}
        centered
        destroyOnClose
        styles={{ body: { padding: '8px 4px 12px 4px' } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddMemberSubmit}
          initialValues={{
            countryCode: '+91',
            plan: activePlans[0]?.key || 'monthly',
            paymentType: 'Online',
          }}
          style={{ marginTop: 12 }}
        >
          {/* Top Section: Member Photo + Name & Phone */}
          <Row gutter={16} align="top" style={{ marginBottom: 16 }}>
            {/* Left: Member Photo Upload Card */}
            <Col xs={24} sm={9}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                Member Photo
              </div>
              <div
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (re) => setAddMemberPhoto(re.target?.result);
                      reader.readAsDataURL(file);
                      message.success('Photo uploaded');
                    }
                  };
                  input.click();
                }}
                style={{
                  height: 122,
                  borderRadius: 'var(--radius-base)',
                  border: `2px dashed ${addMemberPhoto ? '#722ed1' : isDarkMode ? '#333333' : '#d0d7de'}`,
                  backgroundColor: isDarkMode ? '#141414' : '#fafafa',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 8,
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {addMemberPhoto ? (
                  <img
                    src={addMemberPhoto}
                    alt="Member Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
                  />
                ) : (
                  <>
                    <CameraOutlined style={{ fontSize: 28, color: '#722ed1', marginBottom: 6 }} />
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#722ed1' }}>
                      Upload Photo
                    </div>
                    <div style={{ fontSize: 10, color: isDarkMode ? '#888888' : '#64748b', marginTop: 2 }}>
                      JPG, PNG (Max 2MB)
                    </div>
                  </>
                )}
              </div>
            </Col>

            {/* Right: Customer Name & Phone Number */}
            <Col xs={24} sm={15}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Customer Name <span style={{ color: '#ef4444' }}>*</span></span>}
                name="name"
                rules={[{ required: true, message: 'Please enter customer name' }]}
                style={{ marginBottom: 12 }}
              >
                <Input
                  placeholder="Enter customer name"
                  style={{ height: 42, borderRadius: 'var(--radius-base)' }}
                />
              </Form.Item>

              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
                  Phone Number <span style={{ color: '#ef4444' }}>*</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Form.Item name="countryCode" initialValue="+91" noStyle>
                    <Select style={{ width: 85, height: 42 }} dropdownMatchSelectWidth={false}>
                      <Option value="+91">+91</Option>
                      <Option value="+1">+1</Option>
                      <Option value="+44">+44</Option>
                      <Option value="+971">+971</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item
                    name="phone"
                    rules={[{ required: true, message: 'Please enter phone number' }]}
                    noStyle
                  >
                    <Input
                      placeholder="Enter phone number"
                      style={{ flex: 1, height: 42, borderRadius: 'var(--radius-base)' }}
                    />
                  </Form.Item>
                </div>
              </div>

              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Email Address (Optional)</span>}
                name="email"
                style={{ marginTop: 10, marginBottom: 0 }}
              >
                <Input
                  placeholder="customer@example.com"
                  style={{ height: 42, borderRadius: 'var(--radius-base)' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Membership Plan Section */}
          <div style={{ marginBottom: 16 }}>
            <Form.Item
              label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Membership Plan <span style={{ color: '#ef4444' }}>*</span></span>}
              name="plan"
              initialValue={activePlans[0]?.key || 'monthly'}
              rules={[{ required: true }]}
              style={{ marginBottom: 8 }}
            >
              <Select
                value={selectedPlanKey}
                onChange={(val) => setSelectedPlanKey(val)}
                style={{ width: '100%', height: 42 }}
              >
                {activePlans.map((p) => (
                  <Option key={p.key} value={p.key}>
                    {p.label || `${p.name} (${p.durationDays} Days)`}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* Plan Perks Pill Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.12)' : '#f3effe',
                color: isDarkMode ? '#d3adf7' : '#531dab',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <InfoCircleOutlined style={{ color: '#722ed1', fontSize: 14 }} />
                <span>
                  {Array.isArray(selectedPlanObj?.features) && selectedPlanObj.features.length > 0
                    ? selectedPlanObj.features.join('   |   ')
                    : 'Unlimited gym access   |   All gym facilities   |   Free floor guidance'}
                </span>
              </div>
            </div>
          </div>

          {/* Start Date & Validity Section */}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label={<span style={{ fontWeight: 600, fontSize: 12.5 }}>Membership Start Date <span style={{ color: '#ef4444' }}>*</span></span>}
                name="startDate"
              >
                <DatePicker
                  style={{ width: '100%', height: 42, borderRadius: 'var(--radius-base)' }}
                  placeholder="Select start date"
                  onChange={(d) => setMembershipStartDate(d)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ marginBottom: 6, fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155' }}>
                Plan Duration
              </div>
              <div
                style={{
                  height: 42,
                  padding: '0 12px',
                  borderRadius: 'var(--radius-base)',
                  backgroundColor: isDarkMode ? '#1e1e1e' : '#f8fafc',
                  border: `1px solid ${isDarkMode ? '#333333' : '#e2e8f0'}`,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 13,
                  fontWeight: 600,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                }}
              >
                <CalendarOutlined style={{ marginRight: 8, color: 'var(--color-primary)' }} />
                <span>{selectedPlanObj?.durationDays || 30} Days ({selectedPlanObj?.name || 'Monthly'})</span>
              </div>
            </Col>
          </Row>

          {/* Start & End Summary Banner (Identical to Mobile App) */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-base)',
              backgroundColor: isDarkMode ? 'rgba(0, 56, 130, 0.15)' : '#edf4fe',
              border: `1px solid ${isDarkMode ? 'rgba(0, 56, 130, 0.3)' : '#bfdbfe'}`,
              marginBottom: 16,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700, color: isDarkMode ? '#93c5fd' : '#003882' }}>
              Membership will start on {membershipStartDate ? membershipStartDate.format('DD MMM YYYY') : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
            <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 3 }}>
              Valid until {calculatedEndDateFormatted} ({selectedPlanObj?.durationDays || 30} Days Total Access)
            </div>
          </div>

          {/* Personal Trainer Selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
              Personal Trainer (Optional Add-on)
            </div>
            <Select
              value={selectedTrainerId}
              onChange={(val) => setSelectedTrainerId(val)}
              style={{ width: '100%', height: 42 }}
            >
              <Option value="none">No Personal Trainer (General Gym Access)</Option>
              {availableTrainersForPlan.map((tr) => (
                <Option key={tr._id || tr.id || tr.employeeId} value={tr._id || tr.id || tr.employeeId}>
                  <UserOutlined style={{ marginRight: 6, color: 'var(--color-primary)' }} />
                  {tr.name} ({tr.specialty || tr.role || 'Certified Trainer'}) — +₹{getTrainerFeeForTier(tr, selectedPlanObj?.tier).toLocaleString('en-IN')}
                </Option>
              ))}
            </Select>
            {availableTrainersForPlan.length === 0 ? (
              <div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
                No personal trainers have configured pricing for this plan tier.
              </div>
            ) : (
              <div style={{ fontSize: 11, color: isDarkMode ? '#888888' : '#64748b', marginTop: 4 }}>
                Assign a certified trainer dedicated to workout regimes and diet plans for this membership.
              </div>
            )}
          </div>

          {/* Amount to Pay Box */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 6 }}>
              Amount to Pay
            </div>
            <div
              style={{
                height: 52,
                padding: '0 16px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                border: `1px solid ${isDarkMode ? '#262626' : '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: isDarkMode ? '#ffffff' : '#003882' }}>
                  ₹{membershipTotalAmount.toLocaleString('en-IN')}
                </span>
                {activeSelectedTrainer && (
                  <span style={{ fontSize: 12, color: isDarkMode ? '#888888' : '#64748b' }}>
                    (Base: ₹{(selectedPlanObj?.price || 0).toLocaleString('en-IN')} + Trainer: ₹{trainerFee.toLocaleString('en-IN')})
                  </span>
                )}
              </div>
              <Tag
                style={{
                  backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                  color: '#00bf62',
                  border: 'none',
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 11,
                  padding: '2px 10px',
                  margin: 0,
                }}
              >
                Amount auto-filled
              </Tag>
            </div>
          </div>

          {/* Payment Type Grid Cards */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: isDarkMode ? '#cccccc' : '#334155', marginBottom: 8 }}>
              Payment Type <span style={{ color: '#ef4444' }}>*</span>
            </div>
            <Row gutter={[10, 10]}>
              {[
                { key: 'Online', label: 'Online', icon: <CreditCardOutlined /> },
                { key: 'GPay', label: 'GPay', icon: <MobileOutlined /> },
                { key: 'Cash', label: 'Cash', icon: <DollarCircleOutlined /> },
                { key: 'COD', label: 'COD', icon: <BarcodeOutlined /> },
              ].map((p) => {
                const isSelected = selectedPaymentType === p.key;
                return (
                  <Col xs={12} sm={6} key={p.key}>
                    <div
                      onClick={() => setSelectedPaymentType(p.key)}
                      style={{
                        height: 44,
                        padding: '0 10px',
                        borderRadius: 'var(--radius-base)',
                        border: `1.5px solid ${isSelected ? 'var(--color-primary)' : isDarkMode ? '#262626' : '#e2e8f0'}`,
                        backgroundColor: isSelected
                          ? isDarkMode
                            ? 'rgba(0, 56, 130, 0.25)'
                            : '#edf4fe'
                          : isDarkMode
                          ? '#141414'
                          : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span style={{ fontSize: 14, color: isSelected ? 'var(--color-primary)' : isDarkMode ? '#888888' : '#64748b' }}>
                        {p.icon}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isSelected ? (isDarkMode ? '#ffffff' : '#003882') : isDarkMode ? '#cccccc' : '#334155',
                        }}
                      >
                        {p.label}
                      </span>
                      {isSelected && (
                        <CheckCircleFilled style={{ color: 'var(--color-primary)', fontSize: 13 }} />
                      )}
                    </div>
                  </Col>
                );
              })}
            </Row>

            {/* Helper Notice Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.12)' : '#f3effe',
                color: isDarkMode ? '#d3adf7' : '#531dab',
                fontSize: 12,
                fontWeight: 500,
                marginTop: 12,
              }}
            >
              <InfoCircleOutlined style={{ color: '#722ed1', fontSize: 14 }} />
              <span>You can change the payment type if required.</span>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button
              onClick={() => {
                setIsAddModalOpen(false);
                form.resetFields();
                setAddMemberPhoto(null);
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 14,
                borderColor: isDarkMode ? '#333333' : '#d0d7de',
                color: isDarkMode ? '#ffffff' : '#0f172a',
                backgroundColor: isDarkMode ? '#141414' : '#ffffff',
              }}
            >
              Cancel
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined style={{ fontSize: 15 }} />}
              style={{
                flex: 1.3,
                height: 44,
                borderRadius: 'var(--radius-base)',
                fontWeight: 600,
                fontSize: 14,
                backgroundColor: 'var(--color-primary)',
                borderColor: 'var(--color-primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              Add Member
            </Button>
          </div>
        </Form>
      </Modal>

      {/* CUSTOM DATE RANGE MODAL */}
      <Modal
        title="Select Custom Date Range"
        open={isDateRangeModalOpen}
        onCancel={() => {
          setIsDateRangeModalOpen(false);
          setTempDateRange(null);
        }}
        onOk={() => {
          if (tempDateRange && tempDateRange.length === 2 && tempDateRange[0] && tempDateRange[1]) {
            const start = tempDateRange[0].format('DD MMM YYYY');
            const end = tempDateRange[1].format('DD MMM YYYY');
            setSelectedDateRange(`${start} - ${end}`);
            setIsDateRangeModalOpen(false);
            message.success(`Date filter set: ${start} - ${end}`);
          } else {
            message.warning('Please pick both start and end dates');
          }
        }}
        okText="Apply Filter"
        cancelText="Cancel"
        destroyOnClose
      >
        <div style={{ padding: '16px 0' }}>
          <Paragraph style={{ color: isDarkMode ? '#888888' : '#64748b', fontSize: 13, marginBottom: 16 }}>
            Pick start date and end date to filter member subscriptions:
          </Paragraph>
          <DatePicker.RangePicker
            style={{ width: '100%', height: 42 }}
            onChange={(dates) => setTempDateRange(dates)}
          />
        </div>
      </Modal>

      {/* MEMBER ADDED SUCCESSFULLY MODAL (WITH CANVAS CONFETTI POPPER) */}
      <Modal
        open={isSuccessModalOpen}
        onCancel={() => setIsSuccessModalOpen(false)}
        footer={null}
        width={460}
        centered
        destroyOnClose
        styles={{ body: { padding: '24px 20px 16px 20px' } }}
      >
        {addedMemberData && (
          <div>
            {/* Header: Success Icon Badge & Confetti Graphic Background */}
            <div style={{ textAlign: 'center', marginBottom: 20, position: 'relative' }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: '50%',
                  backgroundColor: isDarkMode ? 'rgba(0, 191, 98, 0.15)' : '#eaf8ef',
                  border: `2px solid ${isDarkMode ? 'rgba(0, 191, 98, 0.3)' : '#b7eb8f'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  fontSize: 30,
                  color: '#00bf62',
                  boxShadow: '0 4px 16px rgba(0, 191, 98, 0.25)',
                }}
              >
                <CheckOutlined style={{ strokeWidth: 2.5 }} />
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Member Added Successfully!
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: isDarkMode ? '#888888' : '#64748b',
                  marginTop: 4,
                }}
              >
                The membership has been created and payment recorded.
              </div>
            </div>

            {/* Key-Value Details Rows */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: '16px 0',
                borderTop: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
                borderBottom: `1px solid ${isDarkMode ? '#1e1e1e' : '#f1f5f9'}`,
                marginBottom: 16,
              }}
            >
              {/* Row 1: Member Name */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <UserOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Member Name</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1' }}>
                  {addedMemberData.name}
                </div>
              </div>

              {/* Row 2: Phone Number */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <PhoneOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Phone Number</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedMemberData.phone}
                </div>
              </div>

              {/* Row 3: Member ID */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <IdcardOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Member ID</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1' }}>
                  {addedMemberData.memberId}
                </div>
              </div>

              {/* Row 4: Start Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Start Date</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedMemberData.startDate}
                </div>
              </div>

              {/* Row 5: End Date */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <CalendarOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>End Date</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedMemberData.expiryDate}
                </div>
              </div>

              {/* Row 6: Membership Type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <CrownOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Membership Type</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#722ed1' }}>
                  {addedMemberData.plan}
                </div>
              </div>

              {/* Row 7: Amount Paid */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <DollarCircleOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Amount Paid</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedMemberData.amount}
                </div>
              </div>

              {/* Row 8: Payment Type */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: isDarkMode ? '#cccccc' : '#475569', fontSize: 13.5, fontWeight: 500 }}>
                  <CreditCardOutlined style={{ color: isDarkMode ? '#888888' : '#64748b' }} />
                  <span>Payment Type</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  {addedMemberData.paymentType}
                </div>
              </div>
            </div>

            {/* Notice Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 'var(--radius-base)',
                backgroundColor: isDarkMode ? 'rgba(114, 46, 209, 0.12)' : '#f3effe',
                marginBottom: 20,
              }}
            >
              <InfoCircleOutlined style={{ color: '#722ed1', fontSize: 16, flexShrink: 0 }} />
              <div style={{ fontSize: 12.5, color: isDarkMode ? '#d3adf7' : '#531dab', lineHeight: 1.4 }}>
                An invoice has been generated for this membership.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => message.success(`Invoice for ${addedMemberData.memberId} downloaded!`)}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 14,
                  borderColor: isDarkMode ? '#333333' : '#d0d7de',
                  color: isDarkMode ? '#ffffff' : '#0f172a',
                  backgroundColor: isDarkMode ? '#141414' : '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                Download Invoice
              </Button>
              <Button
                type="primary"
                onClick={() => setIsSuccessModalOpen(false)}
                style={{
                  flex: 1.2,
                  height: 44,
                  borderRadius: 'var(--radius-base)',
                  fontWeight: 600,
                  fontSize: 14,
                  backgroundColor: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  color: '#ffffff',
                }}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MembersManagement;
