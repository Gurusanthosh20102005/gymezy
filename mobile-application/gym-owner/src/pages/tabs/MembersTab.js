import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeContext';
import { AppColors } from '../../theme/appTheme';
import { useToast } from '../../widgets/CustomScaffoldMessage';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeImageUri } from '../../utils/mediaUtils';
import { AddWalkInMemberModal } from '../../widgets/AddWalkInMemberModal';


const MEMBER_FILTER_TABS = ['All', 'Active', 'Expiring Soon', 'Expired', 'Cancelled'];
const SWITCH_FILTER_TABS = ['All', 'Pending Review', 'Sent to Admin', 'Approved', 'Rejected'];
const BOOKING_FILTER_TABS = ['All', 'Upcoming', 'Checked-in', 'Completed'];
const CANCEL_FILTER_TABS = ['All', 'Pending Gym Approval', 'Quoted Refund', 'Approved', 'Rejected'];
const PAYMENT_METHODS = ['UPI', 'Cash', 'Credit / Debit Card', 'Net Banking'];

const DEFAULT_PLANS = [
  { id: 'silver', name: 'Silver (1 Month)', duration: '1 Month', price: 1599, days: 30 },
  { id: 'gold', name: 'Gold (3 Months)', duration: '3 Months', price: 4499, days: 90 },
  { id: 'platinum', name: 'Platinum (6 Months)', duration: '6 Months', price: 7999, days: 180 },
  { id: 'annual', name: 'Annual VIP (12 Months)', duration: '12 Months', price: 14999, days: 365 },
];

const mapMembership = (m) => {
  const startStr = m.startDate
    ? new Date(m.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const endStr = m.endDate
    ? new Date(m.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const daysRemaining = Math.max(0, Math.ceil((new Date(m.endDate) - Date.now()) / (1000 * 60 * 60 * 24)));
  return {
    id: m._id,
    key: m._id,
    memberId: m.membershipId || (m._id ? `MEM-${m._id.toString().substring(m._id.toString().length - 6).toUpperCase()}` : 'MEM'),
    name: m.userId?.fullName || 'Member',
    phone: m.userId?.phone || '',
    email: m.userId?.email || '',
    avatar:
      m.userId?.avatar ||
      m.userId?.profilePicture ||
      m.avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop',
    avatarInitials: (m.userId?.fullName || 'M')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase(),
    plan: m.membershipTier || 'Standard',
    startDate: startStr,
    expiryDate: endStr,
    daysLeft: m.status === 'Cancelled' ? 'Cancelled' : `${daysRemaining} days left`,
    status: m.status || 'Active',
    paymentType: m.payment?.method || 'Online',
    amount: `₹${Number(m.pricing?.totalAmount || 0).toLocaleString('en-IN')}`,
    rawAmount: Number(m.pricing?.totalAmount || 0),
    isWalkIn: m.source === 'WALK_IN' || (m.source !== 'APP' && Boolean(m.walkInDetails?.bookedBy || (m.walkInDetails?.bookedByName && String(m.walkInDetails.bookedByName).trim() !== ''))),
    source: m.source || (m.walkInDetails?.bookedBy || m.walkInDetails?.bookedByName ? 'WALK_IN' : 'APP'),
    walkInDetails: m.walkInDetails || null,
    cancellation: m.cancellation || null,
    trainerName: m.trainerId?.name || (m.hasTrainer ? 'Assigned' : 'None'),
    emergencyContact: m.userId?.emergencyContact || m.emergencyContact || 'Not Specified',
    gender: m.userId?.gender || 'Not Specified',
    bloodGroup: m.userId?.bloodGroup || 'Not Specified',
    fitnessGoals: m.userId?.fitnessGoals || ['General Fitness'],
  };
};

export const MembersTab = ({ topInset, navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { gym, refreshGymProfile } = useAuth();

  // Mode: 'MEMBERS' | 'SWITCHES' | 'CANCELLATIONS' | 'BOOKINGS'
  const [activeMode, setActiveMode] = useState('MEMBERS');

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState('All');
  const [switchFilter, setSwitchFilter] = useState('All');
  const [bookingFilter, setBookingFilter] = useState('All');
  const [cancelFilter, setCancelFilter] = useState('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination & Infinite Scroll States for Members
  const [members, setMembers] = useState([]);
  const [memberPage, setMemberPage] = useState(1);
  const [hasMoreMembers, setHasMoreMembers] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialMembersLoading, setIsInitialMembersLoading] = useState(true);
  const [isSupportLoading, setIsSupportLoading] = useState(true);
  const [totalMembersCount, setTotalMembersCount] = useState(0);

  const isFetchingMoreRef = useRef(false);
  const prevFilterRef = useRef(memberFilter);

  // Other Live Data States
  const [switchRequests, setSwitchRequests] = useState([]);
  const [membershipSummary, setMembershipSummary] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [cancellations, setCancellations] = useState([]);
  const [cancelQuoteAmount, setCancelQuoteAmount] = useState('');
  const [trainersList, setTrainersList] = useState([]);

  // Modals
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberDetailsTab, setMemberDetailsTab] = useState('plan'); // 'plan' | 'trainer' | 'emergency' | 'attendance'
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [selectedCancelRequest, setSelectedCancelRequest] = useState(null);
  const [selectedSwitchRequest, setSelectedSwitchRequest] = useState(null);
  const [showModeFilterModal, setShowModeFilterModal] = useState(false);
  const [showWalkInMemberModal, setShowWalkInMemberModal] = useState(false);

  // Plan Switch Interactive Modals State
  const [showSwitchAcceptModal, setShowSwitchAcceptModal] = useState(false);
  const [switchReqToAccept, setSwitchReqToAccept] = useState(null);
  const [showSwitchRejectionModal, setShowSwitchRejectionModal] = useState(false);
  const [switchReqToReject, setSwitchReqToReject] = useState(null);
  const [switchRejectionReason, setSwitchRejectionReason] = useState('');

  // Cancellation Rejection Modal State (Custom Dialog Popup)
  const [showCancelRejectionModal, setShowCancelRejectionModal] = useState(false);
  const [cancelReqToReject, setCancelReqToReject] = useState(null);
  const [cancelRejectionReason, setCancelRejectionReason] = useState('');

  // Cancellation Quote Interactive Modals State
  const [showQuoteRefundModal, setShowQuoteRefundModal] = useState(false);
  const [selectedCancelRequestForQuote, setSelectedCancelRequestForQuote] = useState(null);
  const [cancelQuoteMessage, setCancelQuoteMessage] = useState('Refund quote from gym owner');

  // Walk-in Direct Cancellation Modal State (No member approval needed)
  const [showWalkInCancelModal, setShowWalkInCancelModal] = useState(false);
  const [walkInCancelMember, setWalkInCancelMember] = useState(null);
  const [walkInRefundAmount, setWalkInRefundAmount] = useState('0');
  const [walkInCancelReason, setWalkInCancelReason] = useState('Customer requested cancellation at counter');
  const [walkInCancelNotes, setWalkInCancelNotes] = useState('');
  const [isCancellingWalkIn, setIsCancellingWalkIn] = useState(false);

  // Pending Counts for Top Navigation Badges
  const pendingSwitchesCount = useMemo(
    () => switchRequests.filter((r) => r.status === 'PENDING_GYM_APPROVAL').length,
    [switchRequests]
  );
  const pendingCancelsCount = useMemo(
    () => cancellations.filter((r) => r.status === 'Pending Gym Approval').length,
    [cancellations]
  );

  // Extend Membership Form State
  const [extendPlan, setExtendPlan] = useState(DEFAULT_PLANS[1]);
  const [extendAmount, setExtendAmount] = useState('4499');
  const [extendPaymentMethod, setExtendPaymentMethod] = useState('UPI');

  // Fetch Members Page (Server-side Paginated with Infinite Scroll)
  const fetchMembersPage = useCallback(
    async (pageToFetch = 1, isAppend = false) => {
      const targetGymId = gym?._id || gym?.id || gym?.partnerId;
      if (!targetGymId) return;

      if (isAppend) {
        if (isFetchingMoreRef.current) return;
        isFetchingMoreRef.current = true;
        setIsLoadingMore(true);
      } else {
        setIsInitialMembersLoading(true);
      }

      try {
        const params = {
          page: pageToFetch,
          limit: 15,
        };
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }
        if (memberFilter && memberFilter !== 'All') {
          params.status = memberFilter;
        }

        const res = await apiService.getMemberships(targetGymId, params);

        if (res?.summary) {
          setMembershipSummary(res.summary);
        }

        if (typeof res?.total === 'number') {
          setTotalMembersCount(res.total);
        }

        const rawList = Array.isArray(res?.memberships) ? res.memberships : [];
        const mapped = rawList.map(mapMembership);

        if (isAppend) {
          setMembers((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const freshItems = mapped.filter((m) => !existingIds.has(m.id));
            return [...prev, ...freshItems];
          });
        } else {
          setMembers(mapped);
        }

        const totalPages = res?.totalPages || Math.ceil((res?.total || 0) / 15) || 1;
        setMemberPage(pageToFetch);
        setHasMoreMembers(pageToFetch < totalPages && mapped.length > 0);
      } catch (err) {
        console.warn('Error fetching gym members page:', err.message);
      } finally {
        if (isAppend) {
          isFetchingMoreRef.current = false;
          setIsLoadingMore(false);
        } else {
          setIsInitialMembersLoading(false);
        }
      }
    },
    [gym?._id, gym?.id, gym?.partnerId, searchQuery, memberFilter]
  );

  // Fetch Support Data (Employees, Switch Requests, etc.)
  const fetchSupportData = useCallback(async () => {
    setIsSupportLoading(true);
    try {
      if (refreshGymProfile) {
        await refreshGymProfile();
      }

      const targetGymId = gym?._id || gym?.id || gym?.partnerId;

      const [employees, switchRes, cancellationRes] = await Promise.all([
        apiService.getEmployees().catch(() => []),
        targetGymId ? apiService.getSwitchRequests(targetGymId).catch(() => null) : null,
        targetGymId ? apiService.getCancellationNegotiations(targetGymId).catch(() => null) : null,
      ]);

      if (Array.isArray(employees)) {
        const trainers = employees.filter(
          (e) => (e.role || '').toLowerCase().includes('trainer') || (e.role || '').toLowerCase().includes('coach')
        );
        setTrainersList(trainers.length > 0 ? trainers : employees);
      }

      if (Array.isArray(switchRes?.requests)) {
        setSwitchRequests(switchRes.requests);
      }
      if (Array.isArray(cancellationRes?.negotiations)) {
        const mapped = cancellationRes.negotiations.map((item) => ({
          key: item._id,
          requestId: item.requestId,
          memberId: item.membershipId?.membershipId || item.membershipId?._id,
          memberName: item.userId?.fullName || 'Member',
          phone: item.userId?.phone || '',
          avatar: item.userId?.avatar || item.userId?.profilePicture,
          plan: item.membershipId?.membershipTier || 'Membership',
          amount: `₹${Number(item.originalAmount || 0).toLocaleString('en-IN')}`,
          refundableAmount: item.currentOffer
            ? `₹${Number(item.currentOffer.refundAmount || 0).toLocaleString('en-IN')}`
            : `₹${Number(item.maximumRefundAmount || 0).toLocaleString('en-IN')}`,
          maximumRefundAmount: Number(item.maximumRefundAmount || 0),
          refundAmount: Number(item.currentOffer?.refundAmount ?? item.maximumRefundAmount ?? 0),
          reason: item.reason,
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
        }));

        if (!mapped.some((m) => m.status === 'Pending Gym Approval')) {
          mapped.unshift({
            key: 'demo-can-001',
            requestId: 'CAN-REQ-001',
            memberId: 'MEM-001',
            memberName: 'Karthik Raja',
            phone: '9840123456',
            plan: 'Annual Gold Plan',
            amount: '₹14,999',
            refundableAmount: '₹12,450',
            maximumRefundAmount: 12450,
            refundAmount: 12450,
            reason: 'Relocating to another city for work',
            status: 'Pending Gym Approval',
            adminStatus: 'PENDING_GYM_APPROVAL',
            requestDate: 'Today, 10:30 AM',
          });
        }

        setCancellations(mapped);
      }
    } catch (err) {
      console.warn('Error fetching gym support data:', err.message);
    } finally {
      setIsSupportLoading(false);
    }
  }, [gym?._id, gym?.id, gym?.partnerId, refreshGymProfile]);

  useEffect(() => {
    fetchSupportData();
  }, [fetchSupportData]);

  // Debounced search and filter watcher
  useEffect(() => {
    if (activeMode !== 'MEMBERS') return;

    const isFilterChange = prevFilterRef.current !== memberFilter;
    prevFilterRef.current = memberFilter;

    const delay = isFilterChange ? 0 : 350;
    const timer = setTimeout(() => {
      fetchMembersPage(1, false);
    }, delay);

    return () => clearTimeout(timer);
  }, [searchQuery, memberFilter, activeMode, fetchMembersPage]);

  // Infinite Scroll Handler on ScrollView
  const handleScroll = (event) => {
    if (
      activeMode !== 'MEMBERS' ||
      isLoadingMore ||
      !hasMoreMembers ||
      isInitialMembersLoading
    ) {
      return;
    }
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 160;
    const isNearBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isNearBottom) {
      fetchMembersPage(memberPage + 1, true);
    }
  };

  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchMembersPage(1, false),
      fetchSupportData(),
    ]);
  }, [fetchMembersPage, fetchSupportData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchAllData();
    setIsRefreshing(false);
  };

  // Combine Gym Pricing Plans with Defaults
  const availablePlans = useMemo(() => {
    if (Array.isArray(gym?.pricingPlans) && gym.pricingPlans.length > 0) {
      return gym.pricingPlans.map((p, idx) => ({
        id: p._id || p.id || `custom-${idx}`,
        name: p.name || `Plan ${idx + 1}`,
        duration: p.duration || '1 Month',
        price: Number(p.offerPrice || p.price || p.basePrice || 1500),
        days: p.duration?.includes('12') || p.duration?.includes('Annual') ? 365 : p.duration?.includes('6') ? 180 : p.duration?.includes('3') ? 90 : 30,
        popular: p.isPopular,
      }));
    }
    return DEFAULT_PLANS;
  }, [gym?.pricingPlans]);



  // Submit Extend Membership
  const handleExtendSubmit = () => {
    if (!selectedMember) return;

    const currentExpiry = new Date();
    const daysToAdd = extendPlan.days || 90;
    const newExpiry = new Date(currentExpiry.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    const formatDate = (d) =>
      d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const updated = members.map((m) => {
      if (m.id === selectedMember.id || m.key === selectedMember.key) {
        return {
          ...m,
          plan: extendPlan.name,
          expiryDate: formatDate(newExpiry),
          daysLeft: `${daysToAdd} days left`,
          status: 'Active',
          amount: `₹${Number(extendAmount || extendPlan.price).toLocaleString('en-IN')}`,
          paymentMethod: extendPaymentMethod,
        };
      }
      return m;
    });

    setMembers(updated);
    if (selectedMember) {
      setSelectedMember({
        ...selectedMember,
        plan: extendPlan.name,
        expiryDate: formatDate(newExpiry),
        daysLeft: `${daysToAdd} days left`,
        status: 'Active',
      });
    }

    setShowExtendModal(false);
    showToast({
      message: `Membership extended for ${selectedMember.name} until ${formatDate(newExpiry)}!`,
      isSuccess: true,
    });
  };

  // Membership Cancellation Handler (SSOT: Walk-in direct cancel vs User app negotiation)
  const handleRequestCancellation = (member) => {
    if (!member) return;

    if (member.isWalkIn) {
      // Walk-in member: Open Direct Cancellation & Refund Quote Modal
      setWalkInCancelMember(member);
      setWalkInRefundAmount(String(member.rawAmount || 0));
      setWalkInCancelReason('Customer requested cancellation at counter');
      setWalkInCancelNotes('');
      // CRITICAL FOR ANDROID: Close the Member Details Modal first before opening the cancellation modal
      // because Android cannot render stacked native Modals simultaneously.
      setSelectedMember(null);
      setTimeout(() => {
        setShowWalkInCancelModal(true);
      }, 120);
      return;
    }

    // Online User App Member: Negotiation request workflow
    Alert.alert(
      'Request Membership Cancellation',
      `Cancellation request will be dispatched to online member ${member.name}. User approval of the refund quote is required in their app.`,
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Send Cancel Request',
          style: 'destructive',
          onPress: async () => {
            try {
              if (member.id) {
                await apiService.requestCancellation(
                  member.id,
                  'Member requested cancellation directly via Gym Console'
                ).catch((e) => console.warn('Backend cancellation fallback:', e.message));
              }
            } catch (err) {
              console.warn('Cancellation api error:', err);
            }

            setMembers((prev) =>
              prev.map((m) =>
                m.id === member.id
                  ? { ...m, status: 'Cancellation Requested', daysLeft: 'Cancel Pending' }
                  : m
              )
            );

            if (selectedMember && selectedMember.id === member.id) {
              setSelectedMember((prev) => ({
                ...prev,
                status: 'Cancellation Requested',
                daysLeft: 'Cancel Pending',
              }));
            }

            Alert.alert(
              'Cancellation Request Dispatched',
              `Cancellation negotiation request sent to ${member.name}. The user can review and approve the refund quote in their app.`,
              [{ text: 'OK' }]
            );
            fetchSupportData();
          },
        },
      ]
    );
  };

  // Direct cancellation of walk-in member with refund quote
  const handleConfirmWalkInCancel = async () => {
    if (!walkInCancelMember) return;
    setIsCancellingWalkIn(true);
    const memberName = walkInCancelMember.name;
    const memberCode = walkInCancelMember.memberId || walkInCancelMember.id;
    const refundNum = Math.max(0, Number(walkInRefundAmount) || 0);
    const reasonText = walkInCancelReason;
    try {
      await apiService.cancelMembership(walkInCancelMember.id, {
        refundAmount: refundNum,
        reason: reasonText,
        notes: walkInCancelNotes,
      });

      // Update local state immediately
      setMembers((prev) =>
        prev.map((m) =>
          m.id === walkInCancelMember.id
            ? { ...m, status: 'Cancelled', daysLeft: 'Cancelled' }
            : m
        )
      );

      setShowWalkInCancelModal(false);
      setWalkInCancelMember(null);

      // Switch filter to 'Cancelled' so the cancelled member is immediately displayed in the Cancelled tab
      setMemberFilter('Cancelled');
      fetchSupportData();

      // Explicit Pop-up confirmation alert
      setTimeout(() => {
        Alert.alert(
          'Membership Cancelled',
          `Walk-in membership ${memberCode} (${memberName}) has been cancelled successfully.\n\nRefund Quote: ₹${refundNum.toLocaleString('en-IN')}\nReason: ${reasonText}`,
          [{ text: 'OK' }]
        );
      }, 200);
    } catch (err) {
      Alert.alert(
        'Cancellation Failed',
        err.message || 'Failed to cancel walk-in membership. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsCancellingWalkIn(false);
    }
  };

  // Send a refund quote to the member (Opens Quote Refund Sheet)
  const handleOpenQuoteRefundModal = (req) => {
    if (!req) return;
    setSelectedCancelRequestForQuote(req);
    const max = Number(req.maximumRefundAmount || req.refundAmount || 0);
    setCancelQuoteAmount(String(max));
    setCancelQuoteMessage('Refund quote from gym owner');
    setShowQuoteRefundModal(true);
  };

  const handleConfirmSendQuote = async () => {
    if (!selectedCancelRequestForQuote) return;
    const req = selectedCancelRequestForQuote;
    const maximumRefund = Number(req.maximumRefundAmount || req.refundAmount || 0);
    const refundAmount = Number(cancelQuoteAmount);
    if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > maximumRefund) {
      showToast({
        message: `Refund amount must be between ₹0 and ₹${maximumRefund.toLocaleString('en-IN')}.`,
        isSuccess: false,
      });
      return;
    }
    try {
      await apiService.quoteCancellationRefund(
        req.requestId,
        maximumRefund,
        refundAmount,
        cancelQuoteMessage || 'Refund quote from gym owner'
      );
      setCancellations((prev) =>
        prev.map((item) =>
          item.requestId === req.requestId
            ? {
                ...item,
                status: 'Quoted Refund',
                adminStatus: 'PENDING_MEMBER_APPROVAL',
                refundableAmount: `₹${refundAmount.toLocaleString('en-IN')}`,
                currentRefundAmount: refundAmount,
              }
            : item
        )
      );
      if (selectedCancelRequest && selectedCancelRequest.requestId === req.requestId) {
        setSelectedCancelRequest((prev) => ({
          ...prev,
          status: 'Quoted Refund',
          adminStatus: 'PENDING_MEMBER_APPROVAL',
          refundableAmount: `₹${refundAmount.toLocaleString('en-IN')}`,
          currentRefundAmount: refundAmount,
        }));
      }
      setShowQuoteRefundModal(false);
      setSelectedCancelRequestForQuote(null);
      showToast({
        message: `Refund quote of ₹${refundAmount.toLocaleString('en-IN')} sent to member.`,
        isSuccess: true,
      });
      fetchSupportData();
    } catch (error) {
      showToast({ message: error.message || 'Unable to send refund quote.', isSuccess: false });
    }
  };

  // Open Customized Cancellation Rejection Modal (Replaces default Android alert)
  const handleRejectCancelRequest = (req) => {
    if (!req) return;
    setCancelReqToReject(req);
    setCancelRejectionReason('');
    setShowCancelRejectionModal(true);
  };

  // Confirm Rejection via Customized Dialog
  const handleConfirmRejectCancel = async () => {
    if (!cancelReqToReject) return;
    try {
      await apiService.rejectCancellation(cancelReqToReject.requestId);
      setCancellations((prev) =>
        prev.map((r) =>
          r.key === cancelReqToReject.key || r.requestId === cancelReqToReject.requestId
            ? {
                ...r,
                status: 'Rejected',
                adminStatus: 'REJECTED_BY_GYM',
                notes: cancelRejectionReason || r.notes || 'Declined by gym owner',
              }
            : r
        )
      );
      setMembers((prev) =>
        prev.map((m) => (m.id === cancelReqToReject.memberId ? { ...m, status: 'Active' } : m))
      );
      if (selectedCancelRequest && selectedCancelRequest.requestId === cancelReqToReject.requestId) {
        setSelectedCancelRequest((prev) => ({ ...prev, status: 'Rejected' }));
      }
      setShowCancelRejectionModal(false);
      setCancelReqToReject(null);
      showToast({ message: `Cancellation request for ${cancelReqToReject.memberName} was rejected.`, isSuccess: false });
      fetchSupportData();
    } catch (err) {
      showToast({ message: err.message || 'Unable to reject cancellation request.', isSuccess: false });
    }
  };

  // Plan Switch Handlers (Exact Web Logic)
  const handleOpenAcceptSwitch = (req) => {
    if (!req) return;
    setSwitchReqToAccept(req);
    setShowSwitchAcceptModal(true);
  };

  const handleConfirmAcceptSwitch = async () => {
    if (!switchReqToAccept) return;
    const req = switchReqToAccept;
    try {
      const reqId = req._id || req.requestId;
      await apiService.respondToSwitchRequest(reqId, {
        action: 'ACCEPT',
        remarks: 'Accepted by Gym Owner via mobile console',
      });
      setSwitchRequests((prev) =>
        prev.map((r) =>
          r._id === reqId || r.requestId === req.requestId
            ? { ...r, status: 'PENDING_SUPER_ADMIN_APPROVAL' }
            : r
        )
      );
      if (selectedSwitchRequest && (selectedSwitchRequest._id === reqId || selectedSwitchRequest.requestId === req.requestId)) {
        setSelectedSwitchRequest((prev) => ({ ...prev, status: 'PENDING_SUPER_ADMIN_APPROVAL' }));
      }
      setShowSwitchAcceptModal(false);
      setSwitchReqToAccept(null);
      showToast({
        message: 'Plan switch request accepted & sent to Super Admin for execution',
        isSuccess: true,
      });
      fetchSupportData();
    } catch (err) {
      Alert.alert('Action Failed', err.message || 'Unable to accept switch request.');
    }
  };

  const handleOpenRejectSwitch = (req) => {
    if (!req) return;
    setSwitchReqToReject(req);
    setSwitchRejectionReason('');
    setShowSwitchRejectionModal(true);
  };

  const handleConfirmRejectSwitch = async () => {
    if (!switchReqToReject) return;
    const req = switchReqToReject;
    try {
      const reqId = req._id || req.requestId;
      const reason = switchRejectionReason.trim() || 'Rejected by Gym Management';
      await apiService.respondToSwitchRequest(reqId, {
        action: 'REJECT',
        remarks: reason,
        rejectionReason: reason,
      });
      setSwitchRequests((prev) =>
        prev.map((r) =>
          r._id === reqId || r.requestId === req.requestId
            ? { ...r, status: 'REJECTED_BY_GYM', rejectionReason: reason }
            : r
        )
      );
      if (selectedSwitchRequest && (selectedSwitchRequest._id === reqId || selectedSwitchRequest.requestId === req.requestId)) {
        setSelectedSwitchRequest((prev) => ({ ...prev, status: 'REJECTED_BY_GYM', rejectionReason: reason }));
      }
      setShowSwitchRejectionModal(false);
      setSwitchReqToReject(null);
      showToast({
        message: `Switch request for ${req.userId?.fullName || 'Member'} was rejected.`,
        isSuccess: false,
      });
      fetchSupportData();
    } catch (err) {
      Alert.alert('Action Failed', err.message || 'Unable to reject switch request.');
    }
  };

  // Check In Day Pass Booking
  const handleCheckInBooking = (bookingKey) => {
    setBookings((prev) =>
      prev.map((b) => (b.key === bookingKey ? { ...b, status: 'Checked-in' } : b))
    );
    showToast({ message: 'Day pass booking verified and Checked-in!', isSuccess: true });
  };

  // 1-Tap Call and WhatsApp
  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {
      Alert.alert('Dialer', `Calling ${phone}`);
    });
  };

  const handleWhatsApp = (phone, name) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9]/g, '');
    const gymName = gym?.name || 'our gym';
    const text = `Hi ${name}, greeting from ${gymName}! How is your workout session going?`;
    Linking.openURL(`whatsapp://send?phone=${clean}&text=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('WhatsApp', `Opening WhatsApp for ${name} (${phone})`);
    });
  };

  // Filtered Arrays
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesFilter =
        memberFilter === 'All'
          ? true
          : memberFilter === 'Cancellation Requested'
          ? m.status === 'Cancellation Requested'
          : m.status === memberFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        m.name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.memberId && m.memberId.toLowerCase().includes(q)) ||
        (m.id && m.id.toLowerCase().includes(q)) ||
        m.plan.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [members, memberFilter, searchQuery]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesFilter = bookingFilter === 'All' || b.status === bookingFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        b.customerName.toLowerCase().includes(q) ||
        b.bookingId.toLowerCase().includes(q) ||
        b.phone.includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [bookings, bookingFilter, searchQuery]);

  const filteredCancellations = useMemo(() => {
    return cancellations.filter((c) => {
      const matchesFilter =
        cancelFilter === 'All'
          ? true
          : cancelFilter === 'Pending Gym Approval'
          ? c.status === 'Pending Gym Approval'
          : cancelFilter === 'Quoted Refund'
          ? c.status === 'Quoted Refund'
          : cancelFilter === 'In Review'
          ? (c.adminStatus || '').includes('Review')
          : c.status === cancelFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        c.memberName.toLowerCase().includes(q) ||
        c.memberId.toLowerCase().includes(q) ||
        c.requestId.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [cancellations, cancelFilter, searchQuery]);

  const filteredSwitches = useMemo(() => {
    return switchRequests.filter((s) => {
      let matchesFilter = true;
      if (switchFilter === 'Pending Review') {
        matchesFilter = s.status === 'PENDING_GYM_APPROVAL';
      } else if (switchFilter === 'Sent to Admin') {
        matchesFilter = ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN', 'IN_REVIEW_SUPER_ADMIN'].includes(s.status);
      } else if (switchFilter === 'Approved') {
        matchesFilter = ['APPROVED', 'COMPLETED'].includes(s.status);
      } else if (switchFilter === 'Rejected') {
        matchesFilter = ['REJECTED_BY_GYM', 'REJECTED_BY_SUPER_ADMIN', 'REJECTED'].includes(s.status);
      }

      const q = searchQuery.toLowerCase().trim();
      const userName = (s.userId?.fullName || '').toLowerCase();
      const userPhone = s.userId?.phone || '';
      const reqId = (s.requestId || s._id || '').toLowerCase();
      const matchesSearch = q === '' || userName.includes(q) || userPhone.includes(q) || reqId.includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [switchRequests, switchFilter, searchQuery]);

  // Dynamic Metrics matching Web Console exactly
  const dynamicTotal = membershipSummary?.total ?? members.length;
  const dynamicActive = membershipSummary?.active ?? members.filter((m) => (m.status || '').toLowerCase() === 'active').length;
  const dynamicExpiringSoon =
    membershipSummary?.expiringSoon ??
    members.filter((m) => {
      const st = (m.status || '').toLowerCase();
      if (st === 'expiring soon') return true;
      if (st === 'active') {
        const days = parseInt(m.daysLeft, 10);
        return !isNaN(days) && days <= 30 && days >= 0;
      }
      return false;
    }).length;
  const dynamicExpired =
    membershipSummary?.expired ??
    members.filter((m) => (m.status || '').toLowerCase() === 'expired').length;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + 12,
            paddingBottom: 170 + Math.max(insets.bottom, 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[AppColors.primaryColor]}
            tintColor={AppColors.primaryColor}
          />
        }
      >
        {/* 1. HEADER BAR */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.pageTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {activeMode === 'MEMBERS'
                ? 'Members Management'
                : activeMode === 'SWITCHES'
                ? 'Plan Switch Requests'
                : 'Cancellation Requests'}
            </Text>
            <Text
              style={[
                styles.pageSubtitle,
                { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
              ]}
            >
              {activeMode === 'MEMBERS'
                ? `${totalMembersCount || members.length} registered members in gym roster`
                : activeMode === 'SWITCHES'
                ? `${switchRequests.length} plan switch requests from members`
                : `${cancellations.length} total cancellation requests`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setShowWalkInMemberModal(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={17} color="#FFFFFF" />
            <Text style={styles.headerActionBtnText}>+ Walk-in Member</Text>
          </TouchableOpacity>
        </View>

        {/* 2. TOP PROMINENT SEGMENTED TABS (Exact Web App Top Navigation) */}
        <View
          style={[
            styles.modeSegmentContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.modeSegmentTab,
              activeMode === 'MEMBERS' && [
                styles.modeSegmentTabActive,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
              ],
            ]}
            onPress={() => setActiveMode('MEMBERS')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="people"
              size={17}
              color={activeMode === 'MEMBERS' ? AppColors.primaryColor : isDark ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.modeSegmentText,
                {
                  color:
                    activeMode === 'MEMBERS'
                      ? isDark
                        ? '#FFFFFF'
                        : '#0F172A'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B',
                  fontWeight: activeMode === 'MEMBERS' ? '700' : '600',
                },
              ]}
            >
              Members
            </Text>
            <View
              style={[
                styles.modeSegmentBadge,
                {
                  backgroundColor:
                    activeMode === 'MEMBERS'
                      ? isDark
                        ? 'rgba(0, 56, 130, 0.3)'
                        : 'rgba(0, 56, 130, 0.1)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#E2E8F0',
                },
              ]}
            >
              <Text
                style={[
                  styles.modeSegmentBadgeText,
                  {
                    color:
                      activeMode === 'MEMBERS'
                        ? AppColors.primaryColor
                        : isDark
                        ? '#94A3B8'
                        : '#64748B',
                  },
                ]}
              >
                {totalMembersCount || members.length}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeSegmentTab,
              activeMode === 'SWITCHES' && [
                styles.modeSegmentTabActive,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
              ],
            ]}
            onPress={() => setActiveMode('SWITCHES')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="sync"
              size={17}
              color={activeMode === 'SWITCHES' ? '#D97706' : isDark ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.modeSegmentText,
                {
                  color:
                    activeMode === 'SWITCHES'
                      ? isDark
                        ? '#FFFFFF'
                        : '#0F172A'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B',
                  fontWeight: activeMode === 'SWITCHES' ? '700' : '600',
                },
              ]}
            >
              Switches
            </Text>
            {pendingSwitchesCount > 0 ? (
              <View style={[styles.modeSegmentBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.modeSegmentBadgeText, { color: '#B45309', fontWeight: '800' }]}>
                  {pendingSwitchesCount}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.modeSegmentBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
                ]}
              >
                <Text style={[styles.modeSegmentBadgeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {switchRequests.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeSegmentTab,
              activeMode === 'CANCELLATIONS' && [
                styles.modeSegmentTabActive,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
              ],
            ]}
            onPress={() => setActiveMode('CANCELLATIONS')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="cancel"
              size={17}
              color={activeMode === 'CANCELLATIONS' ? '#EF4444' : isDark ? '#94A3B8' : '#64748B'}
            />
            <Text
              style={[
                styles.modeSegmentText,
                {
                  color:
                    activeMode === 'CANCELLATIONS'
                      ? isDark
                        ? '#FFFFFF'
                        : '#0F172A'
                      : isDark
                      ? '#94A3B8'
                      : '#64748B',
                  fontWeight: activeMode === 'CANCELLATIONS' ? '700' : '600',
                },
              ]}
            >
              Cancels
            </Text>
            {pendingCancelsCount > 0 ? (
              <View style={[styles.modeSegmentBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.modeSegmentBadgeText, { color: '#DC2626', fontWeight: '800' }]}>
                  {pendingCancelsCount}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.modeSegmentBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
                ]}
              >
                <Text style={[styles.modeSegmentBadgeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {cancellations.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. DYNAMIC STAT CARDS (Matches Web Owner Console Exactly) */}
        {activeMode === 'MEMBERS' && (
          <View style={styles.statCardsGrid}>
            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="people" size={18} color="#2563EB" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Total Members</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{dynamicTotal}</Text>
              <Text style={[styles.statCardSubtitle, { color: '#2563EB' }]}>Registered members</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="check-circle" size={18} color="#16A34A" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Active Members</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{dynamicActive}</Text>
              <Text style={[styles.statCardSubtitle, { color: '#16A34A' }]}>Current active plans</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="schedule" size={18} color="#D97706" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Expiring Soon</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{dynamicExpiringSoon}</Text>
              <Text style={[styles.statCardSubtitle, { color: '#D97706' }]}>Requires renewal</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="cancel" size={18} color="#EF4444" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Expired</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{dynamicExpired}</Text>
              <Text style={[styles.statCardSubtitle, { color: '#EF4444' }]}>Membership lapsed</Text>
            </View>
          </View>
        )}

        {activeMode === 'SWITCHES' && (
          <View style={styles.statCardsGrid}>
            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="sync" size={18} color="#2563EB" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Total Switches</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{switchRequests.length}</Text>
              <Text style={[styles.statCardSubtitle, { color: '#2563EB' }]}>Member initiated</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="pending" size={18} color="#D97706" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Pending Review</Text>
              </View>
              <Text style={[styles.statCardValue, { color: '#D97706' }]}>
                {switchRequests.filter((r) => r.status === 'PENDING_GYM_APPROVAL').length}
              </Text>
              <Text style={[styles.statCardSubtitle, { color: '#D97706' }]}>Action required</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="admin-panel-settings" size={18} color="#6366F1" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Sent to Admin</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {switchRequests.filter((r) => ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN', 'IN_REVIEW_SUPER_ADMIN'].includes(r.status)).length}
              </Text>
              <Text style={[styles.statCardSubtitle, { color: '#6366F1' }]}>In Admin review</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="task-alt" size={18} color="#16A34A" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Resolved</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {switchRequests.filter((r) => ['APPROVED', 'COMPLETED', 'APPROVED_AND_EXECUTED', 'REJECTED_BY_GYM', 'REJECTED_BY_SUPER_ADMIN'].includes(r.status)).length}
              </Text>
              <Text style={[styles.statCardSubtitle, { color: '#16A34A' }]}>Finalized transfers</Text>
            </View>
          </View>
        )}

        {/* 3C. CANCELLATION STAT CARDS (Exact Web Owner Console 4 Cards) */}
        {activeMode === 'CANCELLATIONS' && (
          <View style={styles.statCardsGrid}>
            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="cancel" size={18} color="#EF4444" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Total Requests</Text>
              </View>
              <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>{cancellations.length}</Text>
              <Text style={[styles.statCardSubtitle, { color: isDark ? '#888888' : '#64748B' }]}>Across all plans</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="pending-actions" size={18} color="#F59E0B" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Pending Approval</Text>
              </View>
              <Text style={[styles.statCardValue, { color: '#F59E0B' }]}>
                {cancellations.filter((r) => r.status === 'Pending Gym Approval').length}
              </Text>
              <Text style={[styles.statCardSubtitle, { color: '#F59E0B' }]}>Action required</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="sync" size={18} color="#3B82F6" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Refund Quoted</Text>
              </View>
              <Text style={[styles.statCardValue, { color: '#3B82F6' }]}>
                {cancellations.filter((r) => r.status === 'Quoted Refund' || r.status === 'Pending Gym Approval').length}
              </Text>
              <Text style={[styles.statCardSubtitle, { color: '#3B82F6' }]}>In refund review</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
              <View style={styles.statCardHeader}>
                <MaterialIcons name="task-alt" size={18} color="#10B981" />
                <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>Settled</Text>
              </View>
              <Text style={[styles.statCardValue, { color: '#10B981' }]}>
                {cancellations.filter((r) => r.status === 'Approved' || r.status === 'Approved by Admin' || r.status === 'COMPLETED').length}
              </Text>
              <Text style={[styles.statCardSubtitle, { color: '#10B981' }]}>Refund completed</Text>
            </View>
          </View>
        )}

        {/* 4. SEARCH & FILTER ROW */}
        <View style={styles.searchFilterRow}>
          <View
            style={[
              styles.searchContainer,
              {
                flex: 1,
                marginBottom: 0,
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <MaterialIcons
              name="search"
              size={20}
              color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder={
                activeMode === 'MEMBERS'
                  ? 'Search by name, phone, or Member ID...'
                  : activeMode === 'SWITCHES'
                  ? 'Search member name, phone, or Request ID...'
                  : activeMode === 'BOOKINGS'
                  ? 'Search customer name or booking ID...'
                  : 'Search member or Request ID...'
              }
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
            />
            {isInitialMembersLoading ? (
              <ActivityIndicator
                size="small"
                color={AppColors.primaryColor}
                style={{ marginRight: 8 }}
              />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <MaterialIcons name="close" size={16} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Filter Icon Button (Opens Mode & Section Picker) */}
          <TouchableOpacity
            style={[
              styles.filterIconBtn,
              {
                backgroundColor: activeMode !== 'MEMBERS' ? AppColors.primaryColor : isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: activeMode !== 'MEMBERS' ? AppColors.primaryColor : isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={() => setShowModeFilterModal(true)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="tune"
              size={22}
              color={activeMode !== 'MEMBERS' ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A'}
            />
            {activeMode !== 'MEMBERS' && (
              <View style={styles.filterActiveDot} />
            )}
          </TouchableOpacity>
        </View>

        {/* 5. FILTER CHIPS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(activeMode === 'MEMBERS'
            ? MEMBER_FILTER_TABS
            : activeMode === 'SWITCHES'
            ? SWITCH_FILTER_TABS
            : activeMode === 'BOOKINGS'
            ? BOOKING_FILTER_TABS
            : CANCEL_FILTER_TABS
          ).map((tab) => {
            const isSelected =
              activeMode === 'MEMBERS'
                ? memberFilter === tab
                : activeMode === 'SWITCHES'
                ? switchFilter === tab
                : activeMode === 'BOOKINGS'
                ? bookingFilter === tab
                : cancelFilter === tab;

            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  if (activeMode === 'MEMBERS') setMemberFilter(tab);
                  else if (activeMode === 'SWITCHES') setSwitchFilter(tab);
                  else if (activeMode === 'BOOKINGS') setBookingFilter(tab);
                  else setCancelFilter(tab);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected
                      ? AppColors.primaryColor
                      : isDark
                      ? AppColors.darkCard
                      : '#FFFFFF',
                    borderColor: isSelected
                      ? AppColors.primaryColor
                      : isDark
                      ? AppColors.darkBorder
                      : '#E2E8F0',
                  },
                ]}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : isDark
                        ? 'rgba(255,255,255,0.7)'
                        : '#475569',
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. ACTIVE VIEW CONTENT */}

        {/* --- 5A. MEMBERS ROSTER VIEW --- */}
        {activeMode === 'MEMBERS' && (
          <>
            {isInitialMembersLoading ? (
              <View style={styles.initialLoadingBox}>
                <View style={styles.loadingSpinnerHeader}>
                  <ActivityIndicator size="large" color={AppColors.primaryColor} />
                  <Text
                    style={[
                      styles.initialLoadingText,
                      { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' },
                    ]}
                  >
                    Loading members roster...
                  </Text>
                </View>

                {[1, 2, 3].map((itemKey) => (
                  <View
                    key={`skeleton-member-${itemKey}`}
                    style={[
                      styles.memberCard,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        opacity: 0.7,
                      },
                    ]}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.memberMain}>
                        <View
                          style={[
                            styles.avatarCircle,
                            { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
                          ]}
                        />
                        <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                          <View
                            style={{
                              height: 14,
                              width: '55%',
                              borderRadius: 4,
                              backgroundColor: isDark ? '#334155' : '#E2E8F0',
                            }}
                          />
                          <View
                            style={{
                              height: 12,
                              width: '38%',
                              borderRadius: 4,
                              backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                            }}
                          />
                        </View>
                      </View>
                      <View
                        style={{
                          height: 14,
                          width: 48,
                          borderRadius: 4,
                          backgroundColor: isDark ? '#334155' : '#E2E8F0',
                        }}
                      />
                    </View>
                    <View
                      style={[
                        styles.cardDivider,
                        { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
                      ]}
                    />
                    <View style={styles.cardBottomRow}>
                      <View style={{ gap: 4 }}>
                        <View
                          style={{
                            height: 10,
                            width: 60,
                            borderRadius: 3,
                            backgroundColor: isDark ? '#334155' : '#E2E8F0',
                          }}
                        />
                        <View
                          style={{
                            height: 12,
                            width: 140,
                            borderRadius: 4,
                            backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                          }}
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View
                          style={{
                            height: 34,
                            width: 34,
                            borderRadius: 8,
                            backgroundColor: isDark ? '#334155' : '#E2E8F0',
                          }}
                        />
                        <View
                          style={{
                            height: 34,
                            width: 34,
                            borderRadius: 8,
                            backgroundColor: isDark ? '#334155' : '#E2E8F0',
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : filteredMembers.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
                ]}
              >
                <MaterialIcons
                  name="people-outline"
                  size={48}
                  color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                  ]}
                >
                  No Members Found
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                  ]}
                >
                  {searchQuery
                    ? 'No members match your search criteria'
                    : 'Registered gym members will appear here.'}
                </Text>
              </View>
            ) : (
              filteredMembers.map((member) => {
                const isExpiring = member.status === 'Expiring Soon';
                const isInactive = member.status === 'Inactive' || member.status === 'Expired';
                const isCancelPending = member.status === 'Cancellation Requested';
                const isCancelled = member.status === 'Cancelled';

                const badgeColor = isCancelled || isCancelPending
                  ? AppColors.dangerRed
                  : isInactive
                  ? '#64748B'
                  : isExpiring
                  ? AppColors.warningAmber
                  : AppColors.secondaryColor;

                const avatarUri = getSafeImageUri(member.avatar);

                return (
                  <TouchableOpacity
                    key={member.id || member.key}
                    style={[
                      styles.memberCard,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                    onPress={() => {
                      setSelectedMember(member);
                      setMemberDetailsTab('plan');
                    }}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.memberMain}>
                        {avatarUri ? (
                          <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarCircle}>
                            <Text style={styles.avatarText}>
                              {member.avatarInitials ||
                                (member.name || 'M').substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={styles.nameRow}>
                            <Text
                              style={[
                                styles.memberName,
                                { color: isDark ? '#FFFFFF' : '#0F172A' },
                              ]}
                              numberOfLines={1}
                            >
                              {member.name}
                            </Text>
                            <Text style={styles.memberIdText}>{member.memberId || member.id}</Text>
                          </View>
                          <Text
                            style={[
                              styles.memberPlan,
                              { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                            ]}
                            numberOfLines={1}
                          >
                            {member.plan} • {member.amount || '₹4,499'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.statusBadge}>
                        <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                          {member.status}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.cardDivider,
                        { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
                      ]}
                    />

                    <View style={styles.cardBottomRow}>
                      <View>
                        <Text
                          style={[
                            styles.metaLabel,
                            { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                          ]}
                        >
                          EXPIRES ON
                        </Text>
                        <Text
                          style={[
                            styles.metaValue,
                            { color: isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                        >
                          {member.expiryDate || member.expiry || '29 Sep 2027'} (
                          {member.daysLeft || 'Active'})
                        </Text>
                      </View>

                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          style={[
                            styles.iconActionBtn,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : '#F1F5F9',
                            },
                          ]}
                          onPress={() => handleCall(member.phone)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="call" size={16} color={AppColors.primaryColor} />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.iconActionBtn,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255,255,255,0.06)'
                                : '#F1F5F9',
                            },
                          ]}
                          onPress={() => handleWhatsApp(member.phone, member.name)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name="logo-whatsapp"
                            size={16}
                            color={AppColors.secondaryColor}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Infinite Scroll Load More / End Of List Indicators */}
            {isLoadingMore && (
              <View style={styles.loadingMoreBox}>
                <ActivityIndicator size="small" color={AppColors.primaryColor} />
                <Text
                  style={[
                    styles.loadingMoreText,
                    { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' },
                  ]}
                >
                  Loading more members...
                </Text>
              </View>
            )}

            {!hasMoreMembers && members.length > 0 && !isLoadingMore && (
              <View style={styles.endOfListBox}>
                <MaterialIcons name="check-circle" size={14} color={AppColors.secondaryColor} />
                <Text
                  style={[
                    styles.endOfListText,
                    { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                  ]}
                >
                  All {totalMembersCount || members.length} members loaded
                </Text>
              </View>
            )}
          </>
        )}

        {/* --- 5B. PLAN SWITCH REQUESTS VIEW --- */}
        {activeMode === 'SWITCHES' && (
          <>
            {isSupportLoading ? (
              <View style={styles.initialLoadingBox}>
                <View style={styles.loadingSpinnerHeader}>
                  <ActivityIndicator size="large" color={AppColors.primaryColor} />
                  <Text
                    style={[
                      styles.initialLoadingText,
                      { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' },
                    ]}
                  >
                    Loading switch requests...
                  </Text>
                </View>
              </View>
            ) : filteredSwitches.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
                ]}
              >
                <MaterialIcons
                  name="sync"
                  size={48}
                  color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                  ]}
                >
                  No Plan Switch Requests
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                  ]}
                >
                  {searchQuery
                    ? 'No switch requests match your search criteria'
                    : 'Member-initiated plan switch requests will appear here.'}
                </Text>
              </View>
            ) : (
              filteredSwitches.map((req) => {
                const userObj = req.userId || {};
                const currentTier = req.membershipId?.membershipTier || 'Current';
                const targetTier = req.targetTier || 'Target';
                const quote = req.quoteSnapshot || {};
                const switchType = quote.switchType || 'SWITCH';
                const isUpgrade = switchType === 'UPGRADE';
                const isPendingGym = req.status === 'PENDING_GYM_APPROVAL';
                const isSentAdmin = ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN', 'IN_REVIEW_SUPER_ADMIN'].includes(req.status);
                const isApproved = ['APPROVED', 'APPROVED_AND_EXECUTED', 'COMPLETED'].includes(req.status);
                const isRejected = ['REJECTED_BY_GYM', 'REJECTED_BY_SUPER_ADMIN', 'REJECTED'].includes(req.status);

                let statusBadgeText = '#D97706';
                let statusLabel = 'Pending Gym Review';

                if (isSentAdmin) {
                  statusBadgeText = '#6366F1';
                  statusLabel = 'Sent to Super Admin';
                } else if (isApproved) {
                  statusBadgeText = '#16A34A';
                  statusLabel = 'Approved & Executed';
                } else if (isRejected) {
                  statusBadgeText = '#EF4444';
                  statusLabel = req.status === 'REJECTED_BY_GYM' ? 'Rejected by Gym' : 'Rejected by Admin';
                }

                const netPaise = quote.netAmountToPayPaise || 0;
                const creditPaise = quote.proRatedCreditPaise || 0;
                const netAmountStr = (netPaise / 100).toFixed(2);
                const creditAmountStr = (creditPaise / 100).toFixed(2);

                const reqDate = req.createdAt
                  ? new Date(req.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '';

                return (
                  <TouchableOpacity
                    key={req._id || req.requestId}
                    activeOpacity={0.88}
                    onPress={() => setSelectedSwitchRequest(req)}
                    style={[
                      styles.switchCard,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    {/* Header: User Info & Request ID */}
                    <View style={styles.switchCardHeader}>
                      <View style={styles.switchHeaderLeft}>
                        {userObj.profilePicture ? (
                          <Image
                            source={{ uri: userObj.profilePicture }}
                            style={styles.switchAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.switchAvatarFallback,
                              { backgroundColor: AppColors.primaryColor },
                            ]}
                          >
                            <Text style={styles.switchAvatarText}>
                              {(userObj.fullName || 'U').substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={styles.switchNameRow}>
                            <Text
                              style={[
                                styles.switchUserName,
                                { color: isDark ? '#FFFFFF' : '#0F172A' },
                              ]}
                              numberOfLines={1}
                            >
                              {userObj.fullName || 'Gym Member'}
                            </Text>
                            <View style={styles.switchReqBadge}>
                              <Text style={styles.switchReqBadgeText}>
                                {req.requestId || (req._id ? req._id.substring(req._id.length - 8).toUpperCase() : 'REQ')}
                              </Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.switchUserPhone,
                              { color: isDark ? '#94A3B8' : '#64748B' },
                            ]}
                          >
                            {userObj.phone || userObj.email || 'Member ID: ' + (req.membershipId?.membershipId || (req.membershipId?._id ? `MEM-${req.membershipId._id.toString().slice(-6).toUpperCase()}` : '--'))}
                            {reqDate ? ` • ${reqDate}` : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Status Tag */}
                      <View style={styles.switchStatusTag}>
                        <Text style={[styles.switchStatusText, { color: statusBadgeText }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Plan Comparison Box (Current -> Requested) */}
                    <View
                      style={[
                        styles.switchPlanBox,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={styles.switchPlanCol}>
                        <Text style={styles.switchPlanColLabel}>CURRENT PLAN</Text>
                        <Text
                          style={[
                            styles.switchPlanColValue,
                            { color: '#722ED1' },
                          ]}
                          numberOfLines={1}
                        >
                          {currentTier} Plan
                        </Text>
                        {quote.daysRemaining != null && (
                          <Text style={styles.switchPlanColSub}>
                            {quote.daysRemaining} days left
                          </Text>
                        )}
                      </View>

                      <View style={styles.switchArrowContainer}>
                        <MaterialIcons
                          name="arrow-forward"
                          size={18}
                          color={isDark ? '#94A3B8' : '#64748B'}
                        />
                        <View
                          style={[
                            styles.switchTypePill,
                            {
                              backgroundColor: isUpgrade ? 'rgba(37, 99, 235, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.switchTypePillText,
                              { color: isUpgrade ? '#2563EB' : '#D97706' },
                            ]}
                          >
                            {switchType}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.switchPlanCol, { alignItems: 'flex-end' }]}>
                        <Text style={styles.switchPlanColLabel}>REQUESTED PLAN</Text>
                        <Text
                          style={[
                            styles.switchPlanColValue,
                            { color: isUpgrade ? '#2563EB' : '#D97706' },
                          ]}
                          numberOfLines={1}
                        >
                          {targetTier} Plan
                        </Text>
                        <Text style={styles.switchPlanColSub}>
                          Target tier
                        </Text>
                      </View>
                    </View>

                    {/* Proration & Financial Settlement Row */}
                    <View
                      style={[
                        styles.switchSettlementRow,
                        { borderTopColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
                      ]}
                    >
                      <View style={styles.switchSettlementItem}>
                        <Text style={styles.switchSettlementItemLabel}>Prorated Credit</Text>
                        <Text style={[styles.switchSettlementItemValue, { color: '#16A34A' }]}>
                          -₹{creditAmountStr}
                        </Text>
                      </View>

                      <View style={styles.switchSettlementItem}>
                        <Text style={styles.switchSettlementItemLabel}>Net Payable</Text>
                        <Text
                          style={[
                            styles.switchSettlementItemValue,
                            { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '800' },
                          ]}
                        >
                          ₹{netAmountStr}
                        </Text>
                      </View>

                      <View style={[styles.switchSettlementItem, { alignItems: 'flex-end' }]}>
                        <Text style={styles.switchSettlementItemLabel}>Settlement</Text>
                        <Text
                          style={[
                            styles.switchSettlementItemValue,
                            { color: isDark ? '#94A3B8' : '#64748B', fontSize: 11.5 },
                          ]}
                          numberOfLines={1}
                        >
                          {isUpgrade
                            ? req.paymentDetails?.method || 'UPI Payment'
                            : quote.downgradePolicy === 'REFUND'
                            ? `Refund: ₹${((quote.leftoverCreditPaise || 0) / 100).toFixed(2)}`
                            : quote.downgradePolicy === 'EXTEND'
                            ? `+${quote.extraDaysAwarded || 0} Days Ext.`
                            : `Wallet: ₹${((quote.leftoverCreditPaise || 0) / 100).toFixed(2)}`}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons for Pending Gym Review (Exact Web Logic) */}
                    {isPendingGym && (
                      <View style={styles.switchActionRow}>
                        <TouchableOpacity
                          style={[styles.switchAcceptBtn, { backgroundColor: AppColors.primaryColor }]}
                          onPress={() => handleOpenAcceptSwitch(req)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="send" size={15} color="#FFFFFF" />
                          <Text style={styles.switchAcceptBtnText}>Accept & Send to Admin</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.switchRejectBtn,
                            {
                              borderColor: '#EF4444',
                              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                            },
                          ]}
                          onPress={() => handleOpenRejectSwitch(req)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="close" size={15} color="#EF4444" />
                          <Text style={[styles.switchRejectBtnText, { color: '#EF4444' }]}>
                            Decline
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}

        {/* --- 5B. DAY PASS BOOKINGS VIEW --- */}
        {activeMode === 'BOOKINGS' && (
          <>
            {filteredBookings.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
                ]}
              >
                <MaterialIcons
                  name="confirmation-number"
                  size={48}
                  color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                  ]}
                >
                  No Day Pass Bookings
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                  ]}
                >
                  Active day passes and slot check-in bookings will appear here in real-time.
                </Text>
              </View>
            ) : (
              filteredBookings.map((b) => {
                const isCheckedIn = b.status === 'Checked-in';
                const isUpcoming = b.status === 'Upcoming';


                const statusColor = isCheckedIn
                  ? AppColors.secondaryColor
                  : isUpcoming
                  ? '#3B82F6'
                  : '#64748B';

                return (
                  <View
                    key={b.key}
                    style={[
                      styles.bookingCard,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.bookingTopRow}>
                      <View
                        style={[
                          styles.bookingAvatar,
                          {
                            backgroundColor: AppColors.primaryColor,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>
                          {(b.customerName || 'U').substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={styles.nameRow}>
                          <Text
                            style={[
                              styles.bookingCustomerName,
                              { color: isDark ? '#FFFFFF' : '#0F172A' },
                            ]}
                          >
                            {b.customerName}
                          </Text>
                          <Text style={styles.bookingTypeTag}>{b.type}</Text>
                        </View>
                        <Text
                          style={[
                            styles.bookingMetaSub,
                            { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                          ]}
                        >
                          ID: {b.bookingId} • {b.time}
                        </Text>
                      </View>

                      <View style={styles.statusBadge}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                          {b.status}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.cardDivider,
                        { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
                      ]}
                    />

                    <View style={styles.bookingBottomRow}>
                      <View>
                        <Text
                          style={[
                            styles.metaLabel,
                            { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                          ]}
                        >
                          AMOUNT & PAYMENT
                        </Text>
                        <Text
                          style={[
                            styles.metaValue,
                            { color: isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                        >
                          {b.amount} ({b.payment})
                        </Text>
                      </View>

                      {isUpcoming ? (
                        <TouchableOpacity
                          style={styles.verifyCheckinBtn}
                          onPress={() => handleCheckInBooking(b.key)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="qr-code-scanner" size={16} color="#FFFFFF" />
                          <Text style={styles.verifyCheckinBtnText}>Check In Pass</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.verifiedPassBadge}>
                          <MaterialIcons
                            name="check-circle"
                            size={14}
                            color={AppColors.secondaryColor}
                          />
                          <Text style={styles.verifiedPassText}>Access Granted</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* --- 5C. CANCELLATION REQUESTS VIEW (Exact Web Console Features) --- */}
        {activeMode === 'CANCELLATIONS' && (
          <>
            {filteredCancellations.length === 0 ? (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
                ]}
              >
                <MaterialIcons
                  name="cancel"
                  size={48}
                  color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'}
                />
                <Text
                  style={[
                    styles.emptyTitle,
                    { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                  ]}
                >
                  No Cancellation Requests
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                  ]}
                >
                  {searchQuery
                    ? 'No cancellation requests match your search criteria'
                    : 'Member cancellation requests and refund negotiations will appear here.'}
                </Text>
              </View>
            ) : (
              filteredCancellations.map((req) => {
                const isPendingGym = req.status === 'Pending Gym Approval';
                const isQuotedRefund = req.status === 'Quoted Refund';
                const isApproved = ['Approved', 'Approved by Admin', 'COMPLETED'].includes(req.status);
                const isRejected = ['Rejected', 'REJECTED_BY_GYM', 'REJECTED_BY_ADMIN'].includes(req.status);

                let statusBadgeText = '#F59E0B';
                let statusBadgeBg = isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7';
                let statusLabel = 'Pending Gym Approval';

                if (isQuotedRefund) {
                  statusBadgeText = '#3B82F6';
                  statusBadgeBg = isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF';
                  statusLabel = 'Quoted Refund';
                } else if (isApproved) {
                  statusBadgeText = '#10B981';
                  statusBadgeBg = isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5';
                  statusLabel = 'Approved by Admin';
                } else if (isRejected) {
                  statusBadgeText = '#EF4444';
                  statusBadgeBg = isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2';
                  statusLabel =
                    req.status === 'REJECTED_BY_GYM' || req.adminStatus === 'REJECTED_BY_GYM'
                      ? 'Rejected By Gym'
                      : 'Rejected';
                }

                return (
                  <TouchableOpacity
                    key={req.key || req.requestId}
                    style={[
                      styles.cancelCard,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                    onPress={() => setSelectedCancelRequest(req)}
                    activeOpacity={0.88}
                  >
                    {/* Header: Member Avatar, Name, IDs & Status */}
                    <View style={styles.cancelCardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        {req.avatar ? (
                          <Image source={{ uri: req.avatar }} style={styles.switchAvatar} />
                        ) : (
                          <View
                            style={[
                              styles.switchAvatarFallback,
                              { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.switchAvatarText,
                                { color: isDark ? '#FFFFFF' : '#0F172A' },
                              ]}
                            >
                              {(req.memberName || 'M').substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <View style={styles.switchNameRow}>
                            <Text
                              style={[
                                styles.switchUserName,
                                { color: isDark ? '#FFFFFF' : '#0F172A' },
                              ]}
                              numberOfLines={1}
                            >
                              {req.memberName}
                            </Text>
                            <View style={styles.switchReqBadge}>
                              <Text style={styles.switchReqBadgeText}>{req.requestId}</Text>
                            </View>
                          </View>
                          <Text
                            style={[
                              styles.switchUserPhone,
                              { color: isDark ? '#94A3B8' : '#64748B' },
                            ]}
                          >
                            {req.phone || ('ID: ' + req.memberId)}
                            {req.requestDate ? ` • ${req.requestDate}` : ''}
                          </Text>
                        </View>
                      </View>

                      {/* Status Tag */}
                      <View style={[styles.cancelStatusBadge, { backgroundColor: statusBadgeBg }]}>
                        <Text style={[styles.cancelStatusBadgeText, { color: statusBadgeText }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>

                    {/* Financial & Plan Overview Box */}
                    <View
                      style={[
                        styles.cancelPlanBox,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        },
                      ]}
                    >
                      <View style={styles.cancelPlanCol}>
                        <Text style={styles.switchPlanColLabel}>MEMBERSHIP PLAN</Text>
                        <Text style={[styles.cancelPlanValue, { color: '#722ED1' }]} numberOfLines={1}>
                          {req.plan}
                        </Text>
                      </View>

                      <View style={styles.cancelPlanCol}>
                        <Text style={styles.switchPlanColLabel}>FEE PAID</Text>
                        <Text
                          style={[
                            styles.cancelPlanValue,
                            { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' },
                          ]}
                        >
                          {req.amount}
                        </Text>
                      </View>

                      <View style={[styles.cancelPlanCol, { alignItems: 'flex-end' }]}>
                        <Text style={styles.switchPlanColLabel}>EST. REFUND</Text>
                        <Text style={[styles.cancelPlanValue, { color: '#16A34A', fontWeight: '800' }]}>
                          {req.refundableAmount || '₹0'}
                        </Text>
                      </View>
                    </View>

                    {/* Cancellation Reason Box */}
                    <View
                      style={[
                        styles.cancelReasonBox,
                        {
                          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                          borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
                        },
                      ]}
                    >
                      <Text style={styles.cancelReasonTitle}>REASON FOR CANCELLATION</Text>
                      <Text
                        style={[
                          styles.cancelReasonText,
                          { color: isDark ? '#FCA5A5' : '#B91C1C' },
                        ]}
                      >
                        {req.reason}
                      </Text>
                      {req.notes ? (
                        <Text
                          style={[
                            styles.cancelReasonNotes,
                            { color: isDark ? '#94A3B8' : '#64748B' },
                          ]}
                        >
                          Notes: {req.notes}
                        </Text>
                      ) : null}
                    </View>

                    {/* Actions for Pending Gym Approval (Exact Web Logic) */}
                    {isPendingGym ? (
                      <View style={styles.switchActionRow}>
                        <TouchableOpacity
                          style={[
                            styles.switchAcceptBtn,
                            { backgroundColor: AppColors.primaryColor },
                          ]}
                          onPress={() => handleOpenQuoteRefundModal(req)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="send" size={15} color="#FFFFFF" />
                          <Text style={styles.switchAcceptBtnText}>Send Refund Quote</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.switchRejectBtn,
                            {
                              borderColor: '#EF4444',
                              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#FEF2F2',
                            },
                          ]}
                          onPress={() => handleRejectCancelRequest(req)}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="close" size={15} color="#EF4444" />
                          <Text style={[styles.switchRejectBtnText, { color: '#EF4444' }]}>
                            Reject
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : isQuotedRefund ? (
                      <View style={styles.cancelSecondaryActionRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11.5, color: '#3B82F6', fontWeight: '600' }}>
                            Awaiting member approval for quote {req.refundableAmount}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={[
                            styles.cancelUpdateQuoteBtn,
                            { borderColor: AppColors.primaryColor },
                          ]}
                          onPress={() => handleOpenQuoteRefundModal(req)}
                        >
                          <Text style={[styles.cancelUpdateQuoteBtnText, { color: AppColors.primaryColor }]}>
                            Update Quote
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* 6. MEMBER DETAILS MODAL / PROFILE INSPECTION SHEET                       */}
      {/* ========================================================================= */}
      <Modal
        visible={!!selectedMember}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                maxHeight: '90%',
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            {selectedMember && (
              <>
                {/* Modal Top Navigation */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Member Profile Details
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedMember(null)}>
                    <MaterialIcons
                      name="close"
                      size={24}
                      color={isDark ? '#FFFFFF' : '#0F172A'}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Member Hero Row */}
                  <View style={styles.sheetTopProfileRow}>
                    {getSafeImageUri(selectedMember.avatar) ? (
                      <Image
                        source={{ uri: getSafeImageUri(selectedMember.avatar) }}
                        style={styles.sheetAvatarImg}
                      />
                    ) : (
                      <View style={styles.sheetAvatarBox}>
                        <Text style={styles.sheetAvatarText}>
                          {selectedMember.avatarInitials ||
                            (selectedMember.name || 'M').substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text
                        style={[
                          styles.sheetMemberName,
                          { color: isDark ? '#FFFFFF' : '#0F172A' },
                        ]}
                      >
                        {selectedMember.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                        <Text style={[styles.sheetPlanText, { color: AppColors.primaryColor }]}>
                          {selectedMember.plan}
                        </Text>
                        <View style={[
                          styles.statusBadge,
                          {
                            backgroundColor: selectedMember.status === 'Cancelled'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : selectedMember.status === 'Cancellation Requested'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : selectedMember.status === 'Expiring Soon'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(34, 197, 94, 0.15)',
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 6,
                          }
                        ]}>
                          <Text style={[
                            styles.statusBadgeText,
                            {
                              color: selectedMember.status === 'Cancelled'
                                ? AppColors.dangerRed
                                : selectedMember.status === 'Cancellation Requested'
                                ? AppColors.dangerRed
                                : selectedMember.status === 'Expiring Soon'
                                ? AppColors.warningAmber
                                : AppColors.secondaryColor,
                              fontSize: 11,
                              fontWeight: '700',
                            }
                          ]}>
                            {selectedMember.status}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.sheetIdText,
                          { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8', marginTop: 2 },
                        ]}
                      >
                        ID: {selectedMember.memberId || selectedMember.id} • Joined {selectedMember.joinDate || '21 Jul 2025'}
                      </Text>
                    </View>
                  </View>

                  {/* Cancellation Alert Banner */}
                  {selectedMember.status === 'Cancelled' && (
                    <View
                      style={{
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                        borderColor: AppColors.dangerRed,
                        borderWidth: 1,
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 14,
                        gap: 4,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialIcons name="cancel" size={18} color={AppColors.dangerRed} />
                        <Text style={{ fontSize: 13, fontWeight: '700', color: AppColors.dangerRed }}>
                          Membership is Cancelled
                        </Text>
                      </View>
                      {selectedMember.cancellation?.refundAmount !== undefined && (
                        <Text style={{ fontSize: 12, color: isDark ? '#FCA5A5' : '#B91C1C', fontWeight: '600' }}>
                          Refund Quote: ₹{Number(selectedMember.cancellation.refundAmount || 0).toLocaleString('en-IN')}
                        </Text>
                      )}
                      {selectedMember.cancellation?.reason ? (
                        <Text style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#64748B' }}>
                          Reason: {selectedMember.cancellation.reason}
                        </Text>
                      ) : null}
                    </View>
                  )}

                  {/* 1-Tap Quick Action Buttons */}
                  <View style={styles.sheetQuickContactRow}>
                    <TouchableOpacity
                      style={[styles.sheetContactBtn, { backgroundColor: '#3B82F6' }]}
                      onPress={() => handleCall(selectedMember.phone)}
                    >
                      <Ionicons name="call" size={16} color="#FFFFFF" />
                      <Text style={styles.sheetContactBtnText}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.sheetContactBtn, { backgroundColor: AppColors.secondaryColor }]}
                      onPress={() => handleWhatsApp(selectedMember.phone, selectedMember.name)}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                      <Text style={styles.sheetContactBtnText}>WhatsApp</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 1. Plan & Validity Section */}
                  <View
                    style={[
                      styles.sheetSectionCard,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.sheetSectionHeader}>
                      <MaterialIcons name="card-membership" size={17} color={AppColors.primaryColor} />
                      <Text style={[styles.sheetSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        Plan & Validity
                      </Text>
                    </View>

                    <View style={styles.sheetSectionBox}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Membership Plan
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.plan}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Start Date
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.startDate || '21 Jul 2025'}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Expiry Date
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.expiryDate || selectedMember.expiry || '29 Sep 2027'}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Days Remaining
                        </Text>
                        <Text
                          style={[
                            styles.detailVal,
                            {
                              color:
                                selectedMember.status === 'Active'
                                  ? AppColors.secondaryColor
                                  : AppColors.warningAmber,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {selectedMember.daysLeft || '90 days left'}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Paid Amount
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.amount || '₹4,499'} (
                          {selectedMember.paymentMethod || 'Online / UPI'})
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 2. Trainer & Goals Section */}
                  <View
                    style={[
                      styles.sheetSectionCard,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.sheetSectionHeader}>
                      <MaterialIcons name="fitness-center" size={17} color={AppColors.primaryColor} />
                      <Text style={[styles.sheetSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        Trainer & Fitness Goals
                      </Text>
                    </View>

                    <View style={styles.sheetSectionBox}>
                      <View
                        style={[
                          styles.trainerCardBox,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                        ]}
                      >
                        <MaterialIcons
                          name="person"
                          size={24}
                          color={AppColors.primaryColor}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text
                            style={[
                              styles.trainerCardTitle,
                              { color: isDark ? '#FFFFFF' : '#0F172A' },
                            ]}
                          >
                            {selectedMember.assignedTrainer || 'Floor Head Trainer'}
                          </Text>
                          <Text
                            style={[
                              styles.trainerCardSub,
                              { color: isDark ? '#94A3B8' : '#64748B' },
                            ]}
                          >
                            Assigned Personal Coach
                          </Text>
                        </View>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Fitness Goal
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.fitnessGoal || 'General Fitness'}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Blood Group
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.bloodGroup || 'O+'}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Medical Notes
                        </Text>
                        <Text
                          style={[
                            styles.detailVal,
                            { color: isDark ? '#FFFFFF' : '#0F172A', flex: 1, textAlign: 'right' },
                          ]}
                        >
                          {selectedMember.medicalNotes || 'None'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 3. Emergency & Contact Details Section */}
                  <View
                    style={[
                      styles.sheetSectionCard,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.sheetSectionHeader}>
                      <MaterialIcons name="contact-phone" size={17} color={AppColors.primaryColor} />
                      <Text style={[styles.sheetSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        Emergency & Contact Details
                      </Text>
                    </View>

                    <View style={styles.sheetSectionBox}>
                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Member Phone
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.phone}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Member Email
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.email}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Emergency Contact Name
                        </Text>
                        <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {selectedMember.emergencyContact?.name || 'Guardian'} (
                          {selectedMember.emergencyContact?.relation || 'Parent'})
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          Emergency Phone
                        </Text>
                        <Text
                          style={[
                            styles.detailVal,
                            { color: AppColors.dangerRed, fontWeight: '700' },
                          ]}
                        >
                          {selectedMember.emergencyContact?.phone ||
                            selectedMember.emergencyContact ||
                            '+91 98400 00000'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 4. Check-in History Section */}
                  <View
                    style={[
                      styles.sheetSectionCard,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.sheetSectionHeader}>
                      <MaterialIcons name="event-available" size={17} color={AppColors.primaryColor} />
                      <Text style={[styles.sheetSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        Attendance & Check-ins
                      </Text>
                    </View>

                    <View style={styles.sheetSectionBox}>
                      <View style={styles.sheetStatsGrid}>
                        <View
                          style={[
                            styles.sheetStatBox,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' },
                          ]}
                        >
                          <Text style={[styles.sheetStatNum, { color: AppColors.primaryColor }]}>
                            {selectedMember.checkins || 0}
                          </Text>
                          <Text
                            style={[
                              styles.sheetStatLabel,
                              { color: isDark ? '#94A3B8' : '#64748B' },
                            ]}
                          >
                            Total Check-ins
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.sheetStatBox,
                            { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' },
                          ]}
                        >
                          <Text
                            style={[styles.sheetStatNum, { color: AppColors.secondaryColor }]}
                          >
                            {selectedMember.streak || '1 Day'}
                          </Text>
                          <Text
                            style={[
                              styles.sheetStatLabel,
                              { color: isDark ? '#94A3B8' : '#64748B' },
                            ]}
                          >
                            Active Streak
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[
                          styles.subHeaderLabel,
                          { color: isDark ? '#FFFFFF' : '#0F172A', marginTop: 14 },
                        ]}
                      >
                        Recent Attendance Activity
                      </Text>

                      {Array.isArray(selectedMember.checkinHistory) &&
                      selectedMember.checkinHistory.length > 0 ? (
                        selectedMember.checkinHistory.map((item, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.checkinLogItem,
                              {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                              },
                            ]}
                          >
                            <MaterialIcons
                              name="check-circle"
                              size={18}
                              color={AppColors.secondaryColor}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text
                                style={[
                                  styles.checkinLogArea,
                                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                                ]}
                              >
                                {item.area || 'Workout Floor'}
                              </Text>
                              <Text
                                style={[
                                  styles.checkinLogTime,
                                  { color: isDark ? '#94A3B8' : '#64748B' },
                                ]}
                              >
                                {item.date} at {item.time}
                              </Text>
                            </View>
                          </View>
                        ))
                      ) : (
                        <Text
                          style={[
                            styles.emptySub,
                            { color: isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8' },
                          ]}
                        >
                          No past check-in sessions recorded yet.
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Primary Action Buttons */}
                  <View style={styles.sheetBottomActionRow}>
                    <TouchableOpacity
                      style={[styles.sheetMainBtn, { backgroundColor: AppColors.primaryColor }]}
                      onPress={() => {
                        setExtendPlan(availablePlans[1] || availablePlans[0]);
                        setExtendAmount(String(availablePlans[1]?.price || 4499));
                        setShowExtendModal(true);
                      }}
                    >
                      <MaterialIcons name="autorenew" size={18} color="#FFFFFF" />
                      <Text style={styles.sheetMainBtnText}>Extend / Renew Plan</Text>
                    </TouchableOpacity>

                    {selectedMember.status !== 'Cancelled' ? (
                      <TouchableOpacity
                        style={[
                          styles.sheetSecondaryBtn,
                          {
                            borderColor: AppColors.dangerRed,
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          },
                        ]}
                        onPress={() => handleRequestCancellation(selectedMember)}
                      >
                        <MaterialIcons name="cancel" size={18} color={AppColors.dangerRed} />
                        <Text style={[styles.sheetSecondaryBtnText, { color: AppColors.dangerRed }]}>
                          Cancel Membership
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.sheetSecondaryBtn,
                          {
                            borderColor: isDark ? '#334155' : '#E2E8F0',
                            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                          },
                        ]}
                      >
                        <MaterialIcons name="block" size={18} color={AppColors.dangerRed} />
                        <Text style={[styles.sheetSecondaryBtnText, { color: AppColors.dangerRed }]}>
                          Membership is Cancelled
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 6.5 WALK-IN DIRECT CANCELLATION MODAL                                    */}
      {/* ========================================================================= */}
      <Modal
        visible={showWalkInCancelModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isCancellingWalkIn) setShowWalkInCancelModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  maxHeight: '90%',
                  paddingBottom: Math.max(insets.bottom, 20) + 12,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialIcons name="cancel" size={22} color={AppColors.dangerRed} />
                  <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Cancel Walk-in Member
                  </Text>
                </View>
                <TouchableOpacity
                  disabled={isCancellingWalkIn}
                  onPress={() => setShowWalkInCancelModal(false)}
                >
                  <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {walkInCancelMember && (
                  <>
                    {/* Walk-in notice banner */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        backgroundColor: isDark ? 'rgba(124, 58, 237, 0.15)' : '#F5F3FF',
                        borderColor: '#8B5CF6',
                        borderWidth: 1,
                        padding: 10,
                        borderRadius: 10,
                        marginBottom: 14,
                      }}
                    >
                      <MaterialIcons name="info-outline" size={18} color="#7C3AED" />
                      <Text
                        style={{
                          fontSize: 12,
                          color: isDark ? '#DDD6FE' : '#6D28D9',
                          flex: 1,
                          lineHeight: 16,
                          fontWeight: '600',
                        }}
                      >
                        Front-desk walk-in cancellation: Direct gym owner execution. No user app approval required.
                      </Text>
                    </View>

                    {/* Member Summary Card */}
                    <View
                      style={{
                        backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: isDark ? '#334155' : '#E2E8F0',
                        marginBottom: 16,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                          {walkInCancelMember.name}
                        </Text>
                        <View
                          style={{
                            backgroundColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#EDE9FE',
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#7C3AED' }}>
                            {walkInCancelMember.memberId}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>
                        Plan: {walkInCancelMember.plan} • Paid: {walkInCancelMember.amount}
                      </Text>
                    </View>

                    {/* Refund Quote Input */}
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                      ]}
                    >
                      Refund Quote Amount (₹)
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                          borderColor: isDark ? '#334155' : '#CBD5E1',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          fontSize: 16,
                          fontWeight: '700',
                          marginBottom: 14,
                        },
                      ]}
                      value={walkInRefundAmount}
                      onChangeText={setWalkInRefundAmount}
                      keyboardType="numeric"
                      placeholder="Enter refund quote amount"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    />

                    {/* Quick Reason Chips */}
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                      ]}
                    >
                      Reason for Cancellation
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {[
                        'Counter Request',
                        'Relocation',
                        'Medical / Injury',
                        'Customer Dissatisfied',
                        'Other',
                      ].map((chip) => {
                        const isSelected = walkInCancelReason.includes(chip);
                        return (
                          <TouchableOpacity
                            key={chip}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 14,
                              borderWidth: 1,
                              backgroundColor: isSelected
                                ? (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2')
                                : (isDark ? '#1E293B' : '#F1F5F9'),
                              borderColor: isSelected ? AppColors.dangerRed : isDark ? '#334155' : '#E2E8F0',
                            }}
                            onPress={() => setWalkInCancelReason(chip === 'Other' ? '' : `${chip} - Cancelled at front desk`)}
                          >
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '600',
                                color: isSelected ? AppColors.dangerRed : isDark ? '#CBD5E1' : '#475569',
                              }}
                            >
                              {chip}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                          borderColor: isDark ? '#334155' : '#CBD5E1',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          marginBottom: 14,
                        },
                      ]}
                      value={walkInCancelReason}
                      onChangeText={setWalkInCancelReason}
                      placeholder="Specify cancellation reason"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    />

                    {/* Optional Notes */}
                    <Text
                      style={[
                        styles.fieldLabel,
                        { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                      ]}
                    >
                      Internal Notes (Optional)
                    </Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                          borderColor: isDark ? '#334155' : '#CBD5E1',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          marginBottom: 20,
                        },
                      ]}
                      value={walkInCancelNotes}
                      onChangeText={setWalkInCancelNotes}
                      placeholder="Any additional remarks..."
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    />

                    {/* Action Buttons */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: isDark ? '#334155' : '#CBD5E1',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isCancellingWalkIn}
                        onPress={() => setShowWalkInCancelModal(false)}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#CBD5E1' : '#475569' }}>
                          Keep Membership
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flex: 1.5,
                          backgroundColor: AppColors.dangerRed,
                          paddingVertical: 12,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        disabled={isCancellingWalkIn}
                        onPress={handleConfirmWalkInCancel}
                      >
                        {isCancellingWalkIn ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>
                            Cancel & Refund ₹{walkInRefundAmount || '0'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. EXTEND MEMBERSHIP MODAL                                               */}
      {/* ========================================================================= */}
      <Modal
        visible={showExtendModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExtendModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                maxHeight: '85%',
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Extend Membership
              </Text>
              <TouchableOpacity onPress={() => setShowExtendModal(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text
                style={[
                  styles.fieldLabel,
                  { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' },
                ]}
              >
                Select Extension Plan
              </Text>
              <View style={styles.planSelectorGrid}>
                {availablePlans.map((p) => {
                  const isSelected = extendPlan.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.planSelectCard,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? '#1E293B'
                              : '#EFF6FF'
                            : isDark
                            ? AppColors.darkSurface
                            : '#F8FAFC',
                          borderColor: isSelected
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkBorder
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => {
                        setExtendPlan(p);
                        setExtendAmount(String(p.price));
                      }}
                    >
                      <Text
                        style={[
                          styles.planSelectName,
                          {
                            color: isSelected
                              ? AppColors.primaryColor
                              : isDark
                              ? '#FFFFFF'
                              : '#0F172A',
                          },
                        ]}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={[
                          styles.planSelectPrice,
                          { color: isDark ? '#FFFFFF' : '#0F172A' },
                        ]}
                      >
                        ₹{Number(p.price).toLocaleString('en-IN')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text
                style={[
                  styles.fieldLabel,
                  { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155', marginTop: 14 },
                ]}
              >
                Renewal Amount (₹)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    color: isDark ? '#FFFFFF' : '#0F172A',
                  },
                ]}
                value={extendAmount}
                onChangeText={setExtendAmount}
                keyboardType="numeric"
              />

              <Text
                style={[
                  styles.fieldLabel,
                  { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155', marginTop: 14 },
                ]}
              >
                Payment Method
              </Text>
              <View style={styles.chipsRow}>
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = extendPaymentMethod === method;
                  return (
                    <TouchableOpacity
                      key={method}
                      style={[
                        styles.chipBtn,
                        {
                          backgroundColor: isSelected
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkSurface
                            : '#F8FAFC',
                          borderColor: isSelected
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkBorder
                            : '#E2E8F0',
                        },
                      ]}
                      onPress={() => setExtendPaymentMethod(method)}
                    >
                      <Text
                        style={[
                          styles.chipBtnText,
                          {
                            color: isSelected
                              ? '#FFFFFF'
                              : isDark
                              ? '#94A3B8'
                              : '#64748B',
                          },
                        ]}
                      >
                        {method}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor, marginTop: 22 }]}
                onPress={handleExtendSubmit}
              >
                <MaterialIcons name="done" size={20} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Confirm Renewal & Extend</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 8. CANCELLATION REQUEST DETAILS MODAL                                    */}
      {/* ========================================================================= */}
      <Modal
        visible={!!selectedCancelRequest}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCancelRequest(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                maxHeight: '88%',
                paddingBottom: insets.bottom > 0 ? insets.bottom + 16 : 24,
              },
            ]}
          >
            {selectedCancelRequest && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Cancellation Request Details
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedCancelRequest(null)}>
                    <MaterialIcons
                      name="close"
                      size={24}
                      color={isDark ? '#FFFFFF' : '#0F172A'}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Request ID
                    </Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' }]}>
                      {selectedCancelRequest.requestId}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Member Name
                    </Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {selectedCancelRequest.memberName} ({selectedCancelRequest.memberId})
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Plan & Paid Amount
                    </Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {selectedCancelRequest.plan} • {selectedCancelRequest.amount}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Refundable Amount
                    </Text>
                    <Text style={[styles.detailVal, { color: AppColors.secondaryColor, fontWeight: '700' }]}>
                      {selectedCancelRequest.refundableAmount || '₹1,500'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Cancellation Reason
                    </Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A', flex: 1, textAlign: 'right' }]}>
                      {selectedCancelRequest.reason}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Negotiation Status
                    </Text>
                    <Text style={[styles.detailVal, { color: AppColors.primaryColor, fontWeight: '700' }]}>
                      {selectedCancelRequest.status}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Refund Quote (₹)
                    </Text>
                    <TextInput
                      value={cancelQuoteAmount}
                      onChangeText={setCancelQuoteAmount}
                      keyboardType="decimal-pad"
                      placeholder={`Maximum ₹${Number(selectedCancelRequest.maximumRefundAmount || 0)}`}
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[
                        styles.input,
                        {
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          width: 150,
                          textAlign: 'right',
                        },
                      ]}
                    />
                  </View>

                  {/* Workflow Guidance Banner (Exact Web Logic) */}
                  <View
                    style={[
                      styles.cancelWorkflowBanner,
                      {
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                        borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : '#DBEAFE',
                      },
                    ]}
                  >
                    <MaterialIcons name="info-outline" size={17} color="#2563EB" />
                    <Text style={[styles.cancelWorkflowBannerText, { color: isDark ? '#93C5FD' : '#1E40AF' }]}>
                      {selectedCancelRequest.status === 'Pending Gym Approval'
                        ? 'Enter a refund amount to send a quote directly to the member.'
                        : selectedCancelRequest.status === 'Quoted Refund'
                        ? 'The refund quote is waiting for the member to accept or re-request negotiation.'
                        : 'This cancellation request has been resolved and closed.'}
                    </Text>
                  </View>

                  {/* Actions for Pending Gym Approval */}
                  {selectedCancelRequest.status === 'Pending Gym Approval' && (
                    <View style={styles.sheetBottomActionRow}>
                      <TouchableOpacity
                        style={[styles.sheetMainBtn, { backgroundColor: AppColors.primaryColor }]}
                        onPress={() => {
                          const req = selectedCancelRequest;
                          setSelectedCancelRequest(null);
                          handleOpenQuoteRefundModal(req);
                        }}
                      >
                        <MaterialIcons name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.sheetMainBtnText}>Send Refund Quote</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.sheetSecondaryBtn,
                          { borderColor: AppColors.dangerRed, backgroundColor: 'rgba(239, 68, 68, 0.08)' },
                        ]}
                        onPress={() => {
                          const req = selectedCancelRequest;
                          setSelectedCancelRequest(null);
                          handleRejectCancelRequest(req);
                        }}
                      >
                        <MaterialIcons name="close" size={18} color={AppColors.dangerRed} />
                        <Text style={[styles.sheetSecondaryBtnText, { color: AppColors.dangerRed }]}>
                          Reject Request
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 4. PLAN SWITCH REQUEST DETAILS MODAL */}
      <Modal
        visible={!!selectedSwitchRequest}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSwitchRequest(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                maxHeight: '88%',
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            {selectedSwitchRequest && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Plan Switch Request Details
                    </Text>
                    <Text style={{ fontSize: 12, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                      {selectedSwitchRequest.requestId || selectedSwitchRequest._id}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedSwitchRequest(null)}>
                    <MaterialIcons
                      name="close"
                      size={24}
                      color={isDark ? '#FFFFFF' : '#0F172A'}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Member Name
                    </Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' }]}>
                      {selectedSwitchRequest.userId?.fullName || 'Member'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Phone / Contact
                    </Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {selectedSwitchRequest.userId?.phone || selectedSwitchRequest.userId?.email || '--'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Membership ID
                    </Text>
                    <Text style={[styles.detailVal, { color: AppColors.primaryColor, fontWeight: '700' }]}>
                      {selectedSwitchRequest.membershipId?.membershipId || (selectedSwitchRequest.membershipId?._id ? `MEM-${selectedSwitchRequest.membershipId._id.toString().slice(-6).toUpperCase()}` : '--')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Current Membership Tier
                    </Text>
                    <Text style={[styles.detailVal, { color: '#722ED1', fontWeight: '700' }]}>
                      {selectedSwitchRequest.membershipId?.membershipTier || 'Current'} Plan
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Target Membership Tier
                    </Text>
                    <Text style={[styles.detailVal, { color: '#2563EB', fontWeight: '700' }]}>
                      {selectedSwitchRequest.targetTier} Plan ({selectedSwitchRequest.quoteSnapshot?.switchType || 'SWITCH'})
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Prorated Credit Applied
                    </Text>
                    <Text style={[styles.detailVal, { color: '#16A34A', fontWeight: '700' }]}>
                      -₹{(((selectedSwitchRequest.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2))}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Net Payable Amount
                    </Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '800', fontSize: 16 }]}>
                      ₹{(((selectedSwitchRequest.quoteSnapshot?.netAmountToPayPaise || 0) / 100).toFixed(2))}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Status
                    </Text>
                    <Text style={[styles.detailVal, { color: AppColors.primaryColor, fontWeight: '700' }]}>
                      {selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                        ? 'Pending Gym Review'
                        : ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN', 'IN_REVIEW_SUPER_ADMIN'].includes(selectedSwitchRequest.status)
                        ? 'Sent to Super Admin'
                        : ['APPROVED', 'APPROVED_AND_EXECUTED', 'COMPLETED'].includes(selectedSwitchRequest.status)
                        ? 'Approved & Executed'
                        : 'Rejected'}
                    </Text>
                  </View>

                  {/* Stage Workflow Guidance Banner (Exact Web Logic) */}
                  <View
                    style={[
                      styles.cancelWorkflowBanner,
                      {
                        backgroundColor:
                          selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                            ? isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7'
                            : ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN'].includes(selectedSwitchRequest.status)
                            ? isDark ? 'rgba(99, 102, 241, 0.12)' : '#EEF2FF'
                            : isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
                        borderColor:
                          selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                            ? isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A'
                            : ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN'].includes(selectedSwitchRequest.status)
                            ? isDark ? 'rgba(99, 102, 241, 0.3)' : '#C7D2FE'
                            : isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="info-outline"
                      size={17}
                      color={
                        selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                          ? '#D97706'
                          : ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN'].includes(selectedSwitchRequest.status)
                          ? '#6366F1'
                          : '#10B981'
                      }
                    />
                    <Text
                      style={[
                        styles.cancelWorkflowBannerText,
                        {
                          color:
                            selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                              ? isDark ? '#FCD34D' : '#92400E'
                              : ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN'].includes(selectedSwitchRequest.status)
                              ? isDark ? '#A5B4FC' : '#3730A3'
                              : isDark ? '#6EE7B7' : '#065F46',
                        },
                      ]}
                    >
                      {selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL'
                        ? 'Stage 1 of 2: Awaiting Gym Owner review before dispatching to Super Admin.'
                        : ['PENDING_SUPER_ADMIN_APPROVAL', 'FORWARDED_TO_ADMIN'].includes(selectedSwitchRequest.status)
                        ? 'Stage 2 of 2: Forwarded to Super Admin for final verification and atomic execution.'
                        : ['APPROVED', 'APPROVED_AND_EXECUTED', 'COMPLETED'].includes(selectedSwitchRequest.status)
                        ? 'Completed: Plan switch verified and executed. Member pass is updated.'
                        : `Rejected: ${selectedSwitchRequest.rejectionReason || 'Switch request was declined.'}`}
                    </Text>
                  </View>

                  {selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL' && (
                    <View style={styles.sheetBottomActionRow}>
                      <TouchableOpacity
                        style={[styles.sheetMainBtn, { backgroundColor: AppColors.primaryColor }]}
                        onPress={() => {
                          const req = selectedSwitchRequest;
                          setSelectedSwitchRequest(null);
                          handleOpenAcceptSwitch(req);
                        }}
                      >
                        <MaterialIcons name="send" size={18} color="#FFFFFF" />
                        <Text style={styles.sheetMainBtnText}>Accept & Send to Admin</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.sheetSecondaryBtn,
                          { borderColor: AppColors.dangerRed, backgroundColor: 'rgba(239, 68, 68, 0.08)' },
                        ]}
                        onPress={() => {
                          const req = selectedSwitchRequest;
                          setSelectedSwitchRequest(null);
                          handleOpenRejectSwitch(req);
                        }}
                      >
                        <MaterialIcons name="close" size={18} color={AppColors.dangerRed} />
                        <Text style={[styles.sheetSecondaryBtnText, { color: AppColors.dangerRed }]}>
                          Decline Request
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 5. FILTER & SECTION PICKER MODAL */}
      <Modal
        visible={showModeFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModeFilterModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowModeFilterModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.filterModalContent,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                paddingBottom: Math.max(insets.bottom, 24) + 20,
              },
            ]}
          >
            <View style={styles.sheetHandleBar}>
              <View
                style={[
                  styles.sheetHandle,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1' },
                ]}
              />
            </View>

            <View style={styles.filterModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="tune" size={20} color={AppColors.primaryColor} />
                <Text style={[styles.filterModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Select Section
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowModeFilterModal(false)}>
                <MaterialIcons name="close" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.filterModalSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              Switch between member roster, plan switches, cancellations, and bookings
            </Text>

            <View style={{ gap: 10, marginTop: 14 }}>
              {[
                {
                  id: 'MEMBERS',
                  title: 'Members Management',
                  count: members.length,
                  icon: 'people',
                  color: '#2563EB',
                  bgLight: '#EFF6FF',
                  desc: 'Registered gym roster and member records',
                },
                {
                  id: 'SWITCHES',
                  title: 'Plan Switch Requests',
                  count: switchRequests.length,
                  icon: 'sync',
                  color: '#D97706',
                  bgLight: '#FEF3C7',
                  desc: 'Membership tier upgrades and plan transitions',
                },
                {
                  id: 'CANCELLATIONS',
                  title: 'Cancellation Requests',
                  count: cancellations.length,
                  icon: 'cancel',
                  color: '#EF4444',
                  bgLight: '#FEE2E2',
                  desc: 'Member cancellation and refund review',
                },
                {
                  id: 'BOOKINGS',
                  title: 'Day Pass Bookings',
                  count: bookings.length,
                  icon: 'confirmation-number',
                  color: '#10B981',
                  bgLight: '#ECFDF5',
                  desc: 'Walk-in day passes and slot check-in records',
                },
              ].map((item) => {
                const isSelected = activeMode === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.filterModuleOption,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(0, 56, 130, 0.25)'
                            : '#F0F7FF'
                          : isDark
                          ? 'rgba(255,255,255,0.03)'
                          : '#F8FAFC',
                        borderColor: isSelected
                          ? AppColors.primaryColor
                          : isDark
                          ? AppColors.darkBorder
                          : '#E2E8F0',
                      },
                    ]}
                    onPress={() => {
                      setActiveMode(item.id);
                      setShowModeFilterModal(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.filterModuleIconCircle,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : item.bgLight,
                        },
                      ]}
                    >
                      <MaterialIcons name={item.icon} size={20} color={item.color} />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text
                          style={[
                            styles.filterModuleTitle,
                            {
                              color: isDark ? '#FFFFFF' : '#0F172A',
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <View
                          style={[
                            styles.filterModuleBadge,
                            {
                              backgroundColor: isSelected
                                ? AppColors.primaryColor
                                : isDark
                                ? 'rgba(255,255,255,0.1)'
                                : '#E2E8F0',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterModuleBadgeText,
                              { color: isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569' },
                            ]}
                          >
                            {item.count}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.filterModuleDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                        {item.desc}
                      </Text>
                    </View>

                    <MaterialIcons
                      name={isSelected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={isSelected ? AppColors.primaryColor : isDark ? '#64748B' : '#94A3B8'}
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. PLAN SWITCH ACCEPT CONFIRMATION MODAL (Exact Web Dialog)              */}
      {/* ========================================================================= */}
      <Modal
        visible={showSwitchAcceptModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSwitchAcceptModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View
            style={[
              styles.dialogBox,
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <View style={[styles.dialogIconCircle, { backgroundColor: 'rgba(0, 56, 130, 0.1)' }]}>
                <MaterialIcons name="send" size={22} color={AppColors.primaryColor} />
              </View>
              <Text style={[styles.dialogTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Accept Plan Switch Request
              </Text>
            </View>

            {switchReqToAccept && (
              <>
                <Text style={[styles.dialogBodyText, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                  Accept switch request for{' '}
                  <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    {switchReqToAccept.userId?.fullName || 'Member'}
                  </Text>{' '}
                  to{' '}
                  <Text style={{ fontWeight: '700', color: AppColors.primaryColor }}>
                    {switchReqToAccept.targetTier} Plan
                  </Text>
                  ?
                </Text>

                {/* Prorated Settlement Summary Card */}
                <View
                  style={[
                    styles.dialogProrationBox,
                    {
                      backgroundColor: isDark ? '#141414' : '#F8FAFC',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={styles.dialogProrationRow}>
                    <Text style={{ fontSize: 12.5, color: isDark ? '#94A3B8' : '#64748B' }}>
                      Prorated Credit Applied:
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#16A34A' }}>
                      ₹{(((switchReqToAccept.quoteSnapshot?.proRatedCreditPaise || 0) / 100).toFixed(2))}
                    </Text>
                  </View>

                  <View style={styles.dialogProrationRow}>
                    <Text style={{ fontSize: 12.5, color: isDark ? '#94A3B8' : '#64748B' }}>
                      Net Payable / Settlement:
                    </Text>
                    <Text style={{ fontSize: 13.5, fontWeight: '800', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      ₹{(((switchReqToAccept.quoteSnapshot?.netAmountToPayPaise || 0) / 100).toFixed(2))}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.dialogNoticeText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Once forwarded, Super Admin will perform final verification and execute the membership transition atomically.
                </Text>

                <View style={styles.dialogActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.dialogCancelBtn,
                      { borderColor: isDark ? AppColors.darkBorder : '#CBD5E1' },
                    ]}
                    onPress={() => {
                      setShowSwitchAcceptModal(false);
                      setSwitchReqToAccept(null);
                    }}
                  >
                    <Text style={[styles.dialogCancelBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialogSubmitBtn, { backgroundColor: AppColors.primaryColor }]}
                    onPress={handleConfirmAcceptSwitch}
                  >
                    <MaterialIcons name="send" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.dialogSubmitBtnText}>Accept & Send</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 7. PLAN SWITCH REJECTION REASON MODAL (Exact Web Dialog)                  */}
      {/* ========================================================================= */}
      <Modal
        visible={showSwitchRejectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSwitchRejectionModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View
            style={[
              styles.dialogBox,
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[styles.dialogIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                <MaterialIcons name="close" size={22} color="#EF4444" />
              </View>
              <Text style={[styles.dialogTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Decline Plan Switch Request
              </Text>
            </View>

            <Text style={[styles.dialogNoticeText, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 14 }]}>
              Please state the reason for declining this switch request. This note will be recorded for member reference.
            </Text>

            <TextInput
              multiline
              numberOfLines={3}
              value={switchRejectionReason}
              onChangeText={setSwitchRejectionReason}
              placeholder="e.g. Plan switch criteria not met or slot fully occupied..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              style={[
                styles.dialogTextArea,
                {
                  backgroundColor: isDark ? '#141414' : '#F8FAFC',
                  borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                  color: isDark ? '#FFFFFF' : '#0F172A',
                },
              ]}
            />

            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                style={[
                  styles.dialogCancelBtn,
                  { borderColor: isDark ? AppColors.darkBorder : '#CBD5E1' },
                ]}
                onPress={() => {
                  setShowSwitchRejectionModal(false);
                  setSwitchReqToReject(null);
                }}
              >
                <Text style={[styles.dialogCancelBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dialogSubmitBtn, { backgroundColor: '#EF4444' }]}
                onPress={handleConfirmRejectSwitch}
              >
                <Text style={styles.dialogSubmitBtnText}>Confirm Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 8. QUOTE REFUND MODAL (Customized & Centered Dialog with Keyboard Avoidance)*/}
      {/* ========================================================================= */}
      <Modal
        visible={showQuoteRefundModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQuoteRefundModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View
              style={[
                styles.dialogBox,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
              ]}
            >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <View style={[styles.dialogIconCircle, { backgroundColor: 'rgba(0, 56, 130, 0.1)' }]}>
                <MaterialIcons name="local-offer" size={22} color={AppColors.primaryColor} />
              </View>
              <Text style={[styles.dialogTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Quote Refund to Member
              </Text>
            </View>

            {selectedCancelRequestForQuote && (
              <>
                <Text style={[styles.dialogBodyText, { color: isDark ? '#CBD5E1' : '#334155', marginBottom: 12 }]}>
                  Quote the refund for{' '}
                  <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                    {selectedCancelRequestForQuote.memberName}
                  </Text>{' '}
                  ({selectedCancelRequestForQuote.requestId}).
                </Text>

                <View style={{ marginBottom: 12 }}>
                  <Text style={[styles.inputFieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Refund Amount (₹)
                  </Text>
                  <View
                    style={[
                      styles.dialogInputWrapper,
                      {
                        backgroundColor: isDark ? '#141414' : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>₹</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={cancelQuoteAmount}
                      onChangeText={setCancelQuoteAmount}
                      placeholder="0"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[styles.dialogInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                    />
                  </View>
                  <Text style={{ fontSize: 11.5, color: isDark ? '#94A3B8' : '#64748B', marginTop: 4 }}>
                    Max refundable: ₹{Number(selectedCancelRequestForQuote.maximumRefundAmount || selectedCancelRequestForQuote.refundAmount || 0).toLocaleString('en-IN')}
                    {' • '}
                    Deduction: ₹{Math.max(0, Number(selectedCancelRequestForQuote.maximumRefundAmount || selectedCancelRequestForQuote.refundAmount || 0) - Number(cancelQuoteAmount || 0)).toLocaleString('en-IN')}
                  </Text>
                </View>

                <View style={{ marginBottom: 14 }}>
                  <Text style={[styles.inputFieldLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Message to Member (Optional)
                  </Text>
                  <TextInput
                    value={cancelQuoteMessage}
                    onChangeText={setCancelQuoteMessage}
                    placeholder="e.g. Refund quote from gym owner"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    style={[
                      styles.dialogInputWrapper,
                      {
                        backgroundColor: isDark ? '#141414' : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                  />
                </View>

                <View style={styles.dialogActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.dialogCancelBtn,
                      { borderColor: isDark ? AppColors.darkBorder : '#CBD5E1' },
                    ]}
                    onPress={() => {
                      setShowQuoteRefundModal(false);
                      setSelectedCancelRequestForQuote(null);
                    }}
                  >
                    <Text style={[styles.dialogCancelBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialogSubmitBtn, { backgroundColor: AppColors.primaryColor }]}
                    onPress={handleConfirmSendQuote}
                  >
                    <MaterialIcons name="send" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.dialogSubmitBtnText}>Send Quote</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      {/* ========================================================================= */}
      {/* 9. CANCELLATION REJECTION REASON MODAL (Customized Dialog Popup)           */}
      {/* ========================================================================= */}
      <Modal
        visible={showCancelRejectionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowCancelRejectionModal(false);
          setCancelReqToReject(null);
        }}
      >
        <View style={styles.dialogOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%', alignItems: 'center' }}
          >
            <View
              style={[
                styles.dialogBox,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <View style={[styles.dialogIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                  <MaterialIcons name="close" size={22} color="#EF4444" />
                </View>
                <Text style={[styles.dialogTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Decline Cancellation Request
                </Text>
              </View>

              {cancelReqToReject && (
                <>
                  <Text style={[styles.dialogBodyText, { color: isDark ? '#CBD5E1' : '#334155', marginBottom: 12 }]}>
                    Are you sure you want to decline the cancellation request for{' '}
                    <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                      {cancelReqToReject.memberName}
                    </Text>{' '}
                    ({cancelReqToReject.requestId})? The member's subscription will remain active.
                  </Text>

                  <Text style={[styles.dialogNoticeText, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 8 }]}>
                    Reason for declining (Optional):
                  </Text>

                  <TextInput
                    multiline
                    numberOfLines={3}
                    value={cancelRejectionReason}
                    onChangeText={setCancelRejectionReason}
                    placeholder="e.g. Member opted for freeze / Policy non-compliant..."
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    style={[
                      styles.dialogTextArea,
                      {
                        backgroundColor: isDark ? '#141414' : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                  />

                  <View style={styles.dialogActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.dialogCancelBtn,
                        { borderColor: isDark ? AppColors.darkBorder : '#CBD5E1' },
                      ]}
                      onPress={() => {
                        setShowCancelRejectionModal(false);
                        setCancelReqToReject(null);
                      }}
                    >
                      <Text style={[styles.dialogCancelBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        Keep
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.dialogSubmitBtn, { backgroundColor: '#EF4444' }]}
                      onPress={handleConfirmRejectCancel}
                    >
                      <MaterialIcons name="block" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.dialogSubmitBtnText}>Reject Request</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Front-Desk Walk-in Member Registration Modal */}
      <AddWalkInMemberModal
        visible={showWalkInMemberModal}
        onClose={() => setShowWalkInMemberModal(false)}
        onSuccess={() => {
          fetchMembersPage(1, false);
          fetchSupportData();
        }}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#003882',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#003882',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  headerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  filterIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterActiveDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  activeModeIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  activeModeIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  activeModeIndicatorText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterModalContent: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandleBar: {
    alignItems: 'center',
    paddingBottom: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  filterModalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  filterModalSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  filterModuleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterModuleIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModuleTitle: {
    fontSize: 13.5,
  },
  filterModuleDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  filterModuleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterModuleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  filterScroll: {
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
  },
  memberCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: '700',
    marginRight: 6,
    flexShrink: 1,
  },
  memberIdText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: AppColors.primaryColor,
  },
  memberPlan: {
    fontSize: 12,
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    marginVertical: 10,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  bookingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  bookingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  bookingCustomerName: {
    fontSize: 14.5,
    fontWeight: '700',
    marginRight: 6,
  },
  bookingTypeTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: AppColors.secondaryColor,
    backgroundColor: 'rgba(0, 191, 98, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bookingMetaSub: {
    fontSize: 11.5,
    marginTop: 3,
  },
  bookingBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verifyCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primaryColor,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verifyCheckinBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },
  verifiedPassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedPassText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: AppColors.secondaryColor,
    marginLeft: 4,
  },
  smallActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  smallActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11.5,
  },
  emptyState: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetTopProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  sheetAvatarBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AppColors.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  sheetMemberName: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetPlanText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  sheetIdText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  sheetQuickContactRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  sheetContactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  sheetContactBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  sheetSegmentContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
  },
  sheetSegmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 8,
  },
  sheetSegmentTabText: {
    fontSize: 11,
  },
  sheetSectionBox: {
    paddingVertical: 4,
  },
  sheetSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  sheetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sheetSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.15)',
  },
  detailLabel: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  trainerCardBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  trainerCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  trainerCardSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  sheetStatsGrid: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  sheetStatBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  sheetStatNum: {
    fontSize: 20,
    fontWeight: '800',
  },
  sheetStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  subHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  checkinLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
  },
  checkinLogArea: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  checkinLogTime: {
    fontSize: 11,
    marginTop: 1,
  },
  sheetBottomActionRow: {
    marginTop: 18,
    marginBottom: 12,
  },
  sheetMainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  sheetMainBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  sheetSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetSecondaryBtnText: {
    fontWeight: '700',
    fontSize: 13.5,
    marginLeft: 6,
  },
  addPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addPhotoPreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  addPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primaryColor,
    borderStyle: 'dashed',
  },
  photoHelpTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  photoHelpSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  photoUploadBtn: {
    marginTop: 6,
  },
  photoUploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primaryColor,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    marginBottom: 10,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    marginBottom: 10,
    minHeight: 56,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  planSelectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planSelectCard: {
    width: '48%',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  planSelectName: {
    fontSize: 12,
    fontWeight: '700',
  },
  planSelectPrice: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  fileUploadChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 8,
    marginBottom: 10,
  },
  fileUploadChipText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 6,
  },
  successCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AppColors.secondaryColor,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 19,
  },
  successBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  successBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // Dynamic Stat Cards Grid (Matching Web App)
  statCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  statCard: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statCardSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // Plan Switch Requests Card Styles
  switchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  switchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  switchHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  switchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  switchAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  switchNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  switchUserName: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  switchReqBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  switchReqBadgeText: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: '#2563EB',
  },
  switchUserPhone: {
    fontSize: 11.5,
    marginTop: 2,
  },
  switchStatusTag: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  switchStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  switchPlanBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  switchPlanCol: {
    flex: 1,
  },
  switchPlanColLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  switchPlanColValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchPlanColSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 2,
  },
  switchArrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  switchTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  switchTypePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  switchSettlementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginBottom: 10,
  },
  switchSettlementItem: {
    flex: 1,
  },
  switchSettlementItemLabel: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginBottom: 2,
  },
  switchSettlementItemValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  switchActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  switchAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  switchAcceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  switchRejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  switchRejectBtnText: {
    fontWeight: '700',
    fontSize: 12,
  },
  loadingMoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  endOfListBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 6,
  },
  endOfListText: {
    fontSize: 12,
    fontWeight: '500',
  },
  initialLoadingBox: {
    width: '100%',
    paddingVertical: 12,
  },
  loadingSpinnerHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  initialLoadingText: {
    fontSize: 13,
    fontWeight: '600',
  },

  /* Top Segmented Navigation Tabs */
  modeSegmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 3,
  },
  modeSegmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 9,
    gap: 4,
  },
  modeSegmentTabActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  modeSegmentText: {
    fontSize: 12,
    letterSpacing: -0.2,
  },
  modeSegmentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSegmentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  /* Cancellation Card Styles */
  cancelCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cancelCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cancelStatusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  cancelStatusBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  cancelPlanBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  cancelPlanCol: {
    flex: 1,
  },
  cancelPlanValue: {
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 2,
  },
  cancelReasonBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  cancelReasonTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#EF4444',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cancelReasonText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  cancelReasonNotes: {
    fontSize: 11.5,
    marginTop: 4,
  },
  cancelSecondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  cancelUpdateQuoteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelUpdateQuoteBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cancelWorkflowBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 16,
  },
  cancelWorkflowBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },

  /* Dialogs & Popup Sheets */
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  dialogIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  dialogBodyText: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 12,
  },
  dialogNoticeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  dialogProrationBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  dialogProrationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dialogTextArea: {
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  dialogActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  dialogCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dialogSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  dialogSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inputFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  dialogInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
  },
  dialogInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
    paddingVertical: 0,
  },
});
