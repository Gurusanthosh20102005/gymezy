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
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeContext';
import { AppColors } from '../../theme/appTheme';
import { useToast } from '../../widgets/CustomScaffoldMessage';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import { getSafeImageUri } from '../../utils/mediaUtils';


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
    daysLeft: `${daysRemaining} days left`,
    status: m.status || 'Active',
    paymentType: m.payment?.method || 'Online',
    amount: `₹${Number(m.pricing?.totalAmount || 0).toLocaleString('en-IN')}`,
    trainerName: m.trainerId?.name || (m.hasTrainer ? 'Assigned' : 'None'),
    emergencyContact: m.userId?.emergencyContact || m.emergencyContact || 'Not Specified',
    gender: m.userId?.gender || 'Not Specified',
    bloodGroup: m.userId?.bloodGroup || 'Not Specified',
    fitnessGoals: m.userId?.fitnessGoals || ['General Fitness'],
  };
};

export const MembersTab = ({ topInset, navigation }) => {
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
        setCancellations(cancellationRes.negotiations.map((item) => ({
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
        })));
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

  // Legacy gym-side cancellation entry (member requests now originate from the user app)
  const handleRequestCancellation = (member) => {
    if (!member) return;

    Alert.alert(
      'Request Membership Cancellation',
      `Cancellation requests must originate from the member's Membership Details screen for ${member.name}.`,
      [
        { text: 'Keep Membership', style: 'cancel' },
        {
          text: 'Send Cancel Request',
          style: 'destructive',
          onPress: () => {
            // Update member status
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

            // Create Cancellation Request item
            const newReq = {
              key: `can-${Date.now()}`,
              requestId: `CAN-2025-${String(cancellations.length + 1).padStart(3, '0')}`,
              memberId: member.memberId || member.id,
              memberName: member.name,
              phone: member.phone,
              avatar: member.avatar,
              avatarInitials: member.avatarInitials,
              plan: member.plan,
              amount: member.amount,
              refundableAmount: '₹1,500',
              requestDate:
                new Date().toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }) +
                ', ' +
                new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              reason: 'Member requested early cancellation via Gym Owner Console',
              notes: 'Awaiting refund quote from Gym Owner.',
              status: 'Pending Gym Approval',
              adminStatus: 'Pending Gym Approval',
            };

            setCancellations((prev) => [newReq, ...prev]);
            showToast({
              message: `Cancellation request for ${member.name} is pending review.`,
              isSuccess: true,
            });
          },
        },
      ]
    );
  };

  // Send a refund quote to the member
  const handleForwardCancelToAdmin = (req) => {
    setCancelQuoteAmount(String(Number(req.maximumRefundAmount || 0)));
    setSelectedCancelRequest(req);
  };

  const handleSendCancelQuote = async (req) => {
    const maximumRefund = Number(req.maximumRefundAmount || 0);
    const refundAmount = Number(cancelQuoteAmount);
    if (!Number.isFinite(refundAmount) || refundAmount < 0 || refundAmount > maximumRefund) {
      showToast({
        message: `Refund amount must be between ₹0 and ₹${maximumRefund}.`,
        isSuccess: false,
      });
      return;
    }
    try {
      await apiService.quoteCancellationRefund(
        req.requestId,
        maximumRefund,
        refundAmount,
        'Refund quote from gym owner.'
      );
      setSelectedCancelRequest(null);
      setCancelQuoteAmount('');
      showToast({ message: `Refund quote of ₹${refundAmount} sent to member.`, isSuccess: true });
      fetchAllData();
    } catch (error) {
      showToast({ message: error.message || 'Unable to send refund quote.', isSuccess: false });
    }
  };

  // Reject Cancellation Request
  const handleRejectCancelRequest = (req) => {
    Alert.alert(
      'Reject Cancellation',
      `Reject cancellation request for ${req.memberName}? Membership will remain active.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Request',
          style: 'destructive',
          onPress: () => {
            setCancellations((prev) =>
              prev.map((r) =>
                r.key === req.key
                  ? { ...r, status: 'Rejected', adminStatus: 'Rejected by Gym' }
                  : r
              )
            );
            setMembers((prev) =>
              prev.map((m) => (m.id === req.memberId ? { ...m, status: 'Active' } : m))
            );
            setSelectedCancelRequest(null);
            showToast({ message: `Cancellation request rejected for ${req.memberName}.` });
          },
        },
      ]
    );
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

  // Action on Plan Switch Request (ACCEPT or REJECT)
  const handleSwitchAction = (req, action) => {
    const isApprove = action === 'ACCEPT';
    const memberName = req.userId?.fullName || 'member';
    Alert.alert(
      isApprove ? 'Approve Transfer' : 'Reject Transfer',
      isApprove
        ? `Approve switch request for ${memberName} and forward to Super Admin for processing?`
        : `Are you sure you want to reject switch request for ${memberName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isApprove ? 'Accept & Forward' : 'Reject',
          style: isApprove ? 'default' : 'destructive',
          onPress: async () => {
            try {
              await apiService.respondToSwitchRequest(req._id || req.requestId, {
                action,
                remarks: isApprove
                  ? 'Approved by Gym Owner via mobile console'
                  : 'Rejected by Gym Owner via mobile console',
              });
              showToast({
                message: isApprove
                  ? `Plan switch for ${memberName} approved and forwarded to Super Admin!`
                  : `Plan switch for ${memberName} rejected.`,
                isSuccess: isApprove,
              });
              fetchAllData();
            } catch (err) {
              Alert.alert('Action Failed', err.message || 'Unable to update switch request.');
            }
          },
        },
      ]
    );
  };

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
            paddingBottom: 110,
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
          <View>
            <Text style={[styles.pageTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {activeMode === 'MEMBERS'
                ? 'Members Management'
                : activeMode === 'SWITCHES'
                ? 'Plan Switch Requests'
                : activeMode === 'BOOKINGS'
                ? 'Day Pass Bookings'
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
                : activeMode === 'BOOKINGS'
                ? `${bookings.length} passes and session bookings`
                : `${cancellations.length} total cancellation requests`}
            </Text>
          </View>
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
                {switchRequests.filter((r) => ['APPROVED', 'COMPLETED', 'REJECTED_BY_GYM', 'REJECTED_BY_SUPER_ADMIN'].includes(r.status)).length}
              </Text>
              <Text style={[styles.statCardSubtitle, { color: '#16A34A' }]}>Finalized transfers</Text>
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

        {/* ACTIVE SECTION PILL INDICATOR */}
        {activeMode !== 'MEMBERS' && (
          <View style={styles.activeModeIndicatorRow}>
            <View
              style={[
                styles.activeModeIndicatorPill,
                { backgroundColor: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF', borderColor: '#2563EB', borderWidth: 1 },
              ]}
            >
              <MaterialIcons
                name={
                  activeMode === 'SWITCHES'
                    ? 'sync'
                    : activeMode === 'BOOKINGS'
                    ? 'confirmation-number'
                    : 'cancel'
                }
                size={14}
                color="#2563EB"
              />
              <Text style={[styles.activeModeIndicatorText, { color: '#2563EB' }]}>
                Viewing:{' '}
                {activeMode === 'SWITCHES'
                  ? `Plan Switches (${switchRequests.length})`
                  : activeMode === 'BOOKINGS'
                  ? `Day Passes (${bookings.length})`
                  : `Cancellations (${cancellations.length})`}
              </Text>
              <TouchableOpacity
                onPress={() => setActiveMode('MEMBERS')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={14} color="#2563EB" style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>
          </View>
        )}

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
                const isInactive = member.status === 'Inactive';
                const isCancelPending = member.status === 'Cancellation Requested';


                const badgeColor = isCancelPending
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

                    {/* Action Buttons for Pending Gym Review */}
                    {isPendingGym && (
                      <View style={styles.switchActionRow}>
                        <TouchableOpacity
                          style={[styles.switchAcceptBtn, { backgroundColor: AppColors.primaryColor }]}
                          onPress={() => handleSwitchAction(req, 'ACCEPT')}
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
                          onPress={() => handleSwitchAction(req, 'REJECT')}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="close" size={15} color="#EF4444" />
                          <Text style={[styles.switchRejectBtnText, { color: '#EF4444' }]}>
                            Reject
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

        {/* --- 5C. CANCELLATION REQUESTS VIEW --- */}
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
                  Member cancellation requests and their refund negotiations will appear here.
                </Text>
              </View>
            ) : (
              filteredCancellations.map((req) => {
                const isQuotedRefund = req.status === 'Quoted Refund';
                const isRejected = req.status === 'Rejected';


                const statusColor = isRejected
                  ? AppColors.dangerRed
                  : isQuotedRefund
                  ? '#3B82F6'
                  : AppColors.secondaryColor;

                return (
                  <TouchableOpacity
                    key={req.key || req.requestId}
                    style={[
                      styles.memberCard,
                      {
                        backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                    onPress={() => setSelectedCancelRequest(req)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardTopRow}>
                      <View style={styles.memberMain}>
                        <View
                          style={[
                            styles.avatarCircle,
                            { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                          ]}
                        >
                          <Text style={[styles.avatarText, { color: AppColors.dangerRed }]}>
                            {req.avatarInitials ||
                              (req.memberName || 'C').substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <View style={styles.nameRow}>
                            <Text
                              style={[
                                styles.memberName,
                                { color: isDark ? '#FFFFFF' : '#0F172A' },
                              ]}
                            >
                              {req.memberName}
                            </Text>
                            <Text style={styles.memberIdText}>{req.requestId}</Text>
                          </View>
                          <Text
                            style={[
                              styles.memberPlan,
                              { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                            ]}
                          >
                            {req.plan} • Refund: {req.refundableAmount || '₹1,500'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.statusBadge}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                          {req.status}
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
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.metaLabel,
                            { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                          ]}
                        >
                          ADMIN STATUS
                        </Text>
                        <Text
                          style={[
                            styles.metaValue,
                            { color: isDark ? '#FFFFFF' : '#0F172A' },
                          ]}
                          numberOfLines={1}
                        >
                          {req.adminStatus || req.status}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.smallActionBtn,
                          { backgroundColor: AppColors.primaryColor },
                        ]}
                        onPress={() => setSelectedCancelRequest(req)}
                      >
                        <Text style={styles.smallActionBtnText}>Quote Refund</Text>
                      </TouchableOpacity>
                    </View>
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
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: '88%' },
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
                      <Text style={[styles.sheetPlanText, { color: AppColors.primaryColor }]}>
                        {selectedMember.plan}
                      </Text>
                      <Text
                        style={[
                          styles.sheetIdText,
                          { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
                        ]}
                      >
                        ID: {selectedMember.memberId || selectedMember.id} • Joined {selectedMember.joinDate || '21 Jul 2025'}
                      </Text>
                    </View>
                  </View>

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

                  {/* Segment Tabs in Details Sheet */}
                  <View
                    style={[
                      styles.sheetSegmentContainer,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    {[
                      { id: 'plan', label: 'Plan & Validity' },
                      { id: 'trainer', label: 'Trainer & Goals' },
                      { id: 'emergency', label: 'Emergency' },
                      { id: 'attendance', label: 'Check-ins' },
                    ].map((tab) => (
                      <TouchableOpacity
                        key={tab.id}
                        style={[
                          styles.sheetSegmentTab,
                          memberDetailsTab === tab.id && {
                            backgroundColor: AppColors.primaryColor,
                          },
                        ]}
                        onPress={() => setMemberDetailsTab(tab.id)}
                      >
                        <Text
                          style={[
                            styles.sheetSegmentTabText,
                            {
                              color:
                                memberDetailsTab === tab.id
                                  ? '#FFFFFF'
                                  : isDark
                                  ? '#94A3B8'
                                  : '#64748B',
                              fontWeight: memberDetailsTab === tab.id ? '700' : '500',
                            },
                          ]}
                        >
                          {tab.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Tab 1: Plan & Validity */}
                  {memberDetailsTab === 'plan' && (
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
                  )}

                  {/* Tab 2: Trainer & Goals */}
                  {memberDetailsTab === 'trainer' && (
                    <View style={styles.sheetSectionBox}>
                      <View
                        style={[
                          styles.trainerCardBox,
                          {
                            backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                        ]}
                      >
                        <MaterialIcons
                          name="fitness-center"
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
                  )}

                  {/* Tab 3: Emergency & Contact */}
                  {memberDetailsTab === 'emergency' && (
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
                  )}

                  {/* Tab 4: Check-in History */}
                  {memberDetailsTab === 'attendance' && (
                    <View style={styles.sheetSectionBox}>
                      <View style={styles.sheetStatsGrid}>
                        <View
                          style={[
                            styles.sheetStatBox,
                            { backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC' },
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
                            { backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC' },
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
                                backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
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
                  )}

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
                  </View>
                </ScrollView>
              </>
            )}
          </View>
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
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: '80%' },
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
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: '80%' },
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

                  <View style={styles.sheetBottomActionRow}>
                    <TouchableOpacity
                      style={[styles.sheetMainBtn, { backgroundColor: AppColors.primaryColor }]}
                      onPress={() => handleSendCancelQuote(selectedCancelRequest)}
                    >
                      <MaterialIcons name="send" size={18} color="#FFFFFF" />
                      <Text style={styles.sheetMainBtnText}>Send Refund Quote</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.sheetSecondaryBtn,
                        { borderColor: AppColors.dangerRed, backgroundColor: 'rgba(239, 68, 68, 0.08)' },
                      ]}
                      onPress={() => handleRejectCancelRequest(selectedCancelRequest)}
                    >
                      <MaterialIcons name="close" size={18} color={AppColors.dangerRed} />
                      <Text style={[styles.sheetSecondaryBtnText, { color: AppColors.dangerRed }]}>
                        Reject Request
                      </Text>
                    </TouchableOpacity>
                  </View>
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
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', maxHeight: '84%' },
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

                  {selectedSwitchRequest.status === 'PENDING_GYM_APPROVAL' && (
                    <View style={styles.sheetBottomActionRow}>
                      <TouchableOpacity
                        style={[styles.sheetMainBtn, { backgroundColor: AppColors.primaryColor }]}
                        onPress={() => {
                          const req = selectedSwitchRequest;
                          setSelectedSwitchRequest(null);
                          handleSwitchAction(req, 'ACCEPT');
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
                          handleSwitchAction(req, 'REJECT');
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
});
