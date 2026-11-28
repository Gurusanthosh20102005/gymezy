import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeContext';
import { AppColors } from '../../theme/appTheme';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGymLogoUri } from '../../utils/mediaUtils';
import { AddWalkInBookingModal } from '../../widgets/AddWalkInBookingModal';
import { AddWalkInMemberModal } from '../../widgets/AddWalkInMemberModal';
import { SkeletonMetricCard } from '../../widgets/Skeleton';

export const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const OverviewTab = ({
  topInset,
  navigation,
  onNavigateToMembers,
  onNavigateToBookings,
  onNavigateToEmployees,
  onNavigateToSections,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, gym, refreshGymProfile } = useAuth();

  const isManager = Boolean(
    user?.isManager ||
    user?.role === 'Manager' ||
    user?.role === 'MANAGER' ||
    String(user?.role || '').toLowerCase() === 'manager'
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(!gym);
  const [employees, setEmployees] = useState([]);
  const [membershipSummary, setMembershipSummary] = useState(null);
  const [membershipsList, setMembershipsList] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showWalkInMemberModal, setShowWalkInMemberModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');


  // Fetch live employees, dashboard stats, memberships, bookings, and attendance from DB
  const fetchOverviewData = useCallback(async () => {
    try {
      if (refreshGymProfile) {
        await refreshGymProfile();
      }
      const targetGymId = gym?.id || gym?._id || user?.gymId;
      const [employeeData, memRes, attendanceData, bookingsRes, statsRes] = await Promise.all([
        apiService.getEmployees().catch(() => []),
        targetGymId ? apiService.getMemberships(targetGymId, { limit: 100 }).catch(() => null) : null,
        targetGymId ? apiService.getTodayAttendance({ gymId: targetGymId }).catch(() => []) : [],
        targetGymId ? apiService.getGymBookings(targetGymId, { limit: 100 }).catch(() => null) : null,
        targetGymId ? apiService.getGymDashboardStats(targetGymId, selectedPeriod).catch(() => null) : null,
      ]);
      if (Array.isArray(employeeData)) {
        setEmployees(employeeData);
      }
      if (memRes) {
        if (memRes.summary) setMembershipSummary(memRes.summary);
        const list = Array.isArray(memRes.memberships) ? memRes.memberships : Array.isArray(memRes) ? memRes : [];
        setMembershipsList(list);
      }
      if (Array.isArray(attendanceData)) {
        setTodayAttendance(attendanceData);
      }
      if (bookingsRes) {
        const bList = Array.isArray(bookingsRes.bookings) ? bookingsRes.bookings : Array.isArray(bookingsRes) ? bookingsRes : [];
        setBookingsList(bList);
      }
      if (statsRes) {
        setDashboardStats(statsRes);
      }
    } catch (err) {
      console.warn('Overview data fetch error:', err.message);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [gym?.id, gym?._id, user?.gymId, refreshGymProfile, selectedPeriod]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchOverviewData();
    setIsRefreshing(false);
  };

  // Gym Initials for Avatar Fallback
  const gymInitials = useMemo(() => {
    const name = gym?.name || user?.fullName || 'Gym';
    return name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'GY';
  }, [gym?.name, user?.fullName]);

  // Safe Gym Logo URI
  const logoUri = useMemo(() => getGymLogoUri(gym), [gym]);

  // Dynamic Live Key Metrics matching Web Dashboard
  const activeMembersCount = Number(
    membershipSummary?.active !== undefined
      ? membershipSummary.active
      : gym?.activeMembersCount !== undefined
      ? gym.activeMembersCount
      : Array.isArray(gym?.members)
      ? gym.members.length
      : 0
  );
  const todayCheckinsCount = todayAttendance.length > 0
    ? todayAttendance.length
    : Number(gym?.todayCheckinsCount !== undefined ? gym.todayCheckinsCount : 0);

  const statsMetrics = dashboardStats?.metrics || null;

  const memberRevenue = useMemo(() => {
    if (statsMetrics?.memberRevenue !== undefined) return Number(statsMetrics.memberRevenue) || 0;
    if (gym?.memberRevenue !== undefined) return Number(gym.memberRevenue) || 0;
    if (membershipsList.length > 0) {
      return membershipsList.reduce((acc, m) => acc + (Number(m.amountPaid || m.price || m.amount) || 0), 0);
    }
    return 0;
  }, [statsMetrics?.memberRevenue, gym?.memberRevenue, membershipsList]);

  const appBookingRevenue = useMemo(() => {
    if (statsMetrics?.appBookingRevenue !== undefined) return Number(statsMetrics.appBookingRevenue) || 0;
    if (gym?.appBookingRevenue !== undefined) return Number(gym.appBookingRevenue) || 0;
    if (gym?.bookingRevenue !== undefined) return Number(gym.bookingRevenue) || 0;
    if (bookingsList.length > 0) {
      return bookingsList.reduce((acc, b) => acc + (Number(b.totalAmount || b.amountPaid || b.price) || 0), 0);
    }
    return 0;
  }, [statsMetrics?.appBookingRevenue, gym?.appBookingRevenue, gym?.bookingRevenue, bookingsList]);

  const monthlyRevenue = useMemo(() => {
    if (statsMetrics?.totalRevenue !== undefined) return Number(statsMetrics.totalRevenue) || 0;
    const raw = gym?.monthlyRevenue ?? gym?.totalRevenue;
    const parsed = typeof raw === 'number' ? raw : Number.parseInt(String(raw || '').replace(/[^\d]/g, ''), 10) || 0;
    return parsed > 0 ? parsed : memberRevenue + appBookingRevenue;
  }, [statsMetrics?.totalRevenue, gym?.monthlyRevenue, gym?.totalRevenue, memberRevenue, appBookingRevenue]);

  const periodRevenueValue = useMemo(() => {
    if (statsMetrics?.totalRevenue !== undefined) return Number(statsMetrics.totalRevenue) || 0;
    return monthlyRevenue;
  }, [statsMetrics?.totalRevenue, monthlyRevenue]);

  const periodRevenueFormatted = `₹${periodRevenueValue.toLocaleString('en-IN')}`;
  const dailyAverageFormatted = useMemo(() => {
    const days = selectedPeriod === 'This Week' ? 7 : selectedPeriod === 'This Year' ? 365 : 30;
    return `₹${Math.round(periodRevenueValue / days).toLocaleString('en-IN')}`;
  }, [periodRevenueValue, selectedPeriod]);

  const activeRateFormatted = useMemo(() => {
    const total = Number(membershipSummary?.total ?? membershipsList.length ?? 0);
    const active = Number(membershipSummary?.active ?? membershipsList.filter((m) => m.status === 'Active').length ?? 0);
    if (total <= 0) return '0%';
    return `${((active / total) * 100).toFixed(1)}%`;
  }, [membershipSummary, membershipsList]);

  const newSignupsCount = useMemo(() => {
    const days = selectedPeriod === 'This Week' ? 7 : selectedPeriod === 'This Year' ? 365 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return membershipsList.filter((m) => m.createdAt && new Date(m.createdAt).getTime() >= cutoff).length;
  }, [membershipsList, selectedPeriod]);

  const weeklyCheckins = useMemo(() => {
    const counts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    todayAttendance.forEach((a) => {
      const dt = new Date(a.checkInTime || a.createdAt || Date.now());
      if (dt.getTime() >= weekAgo) {
        const d = dayNames[dt.getDay()];
        if (counts[d] !== undefined) counts[d] += 1;
      }
    });
    const maxCount = Math.max(1, ...Object.values(counts));
    return DAYS_ORDER.map((day) => ({
      day,
      count: counts[day],
      heightPct: counts[day] > 0 ? Math.max(12, Math.round((counts[day] / maxCount) * 100)) : 4,
    }));
  }, [todayAttendance]);

  const peakDayLabel = useMemo(() => {
    const best = weeklyCheckins.reduce((top, cur) => (cur.count > top.count ? cur : top), { day: '—', count: 0 });
    return best.count > 0 ? `${best.day} Peak` : 'No Peak Yet';
  }, [weeklyCheckins]);

  const avgDailyCheckins = useMemo(() => {
    const total = weeklyCheckins.reduce((acc, cur) => acc + cur.count, 0);
    return Math.round(total / 7);
  }, [weeklyCheckins]);

  const totalActiveUsers = Number(
    statsMetrics?.totalActiveUsers !== undefined
      ? statsMetrics.totalActiveUsers
      : membershipSummary?.total !== undefined
      ? membershipSummary.total
      : gym?.membersCount || (gym?.members || []).length || activeMembersCount || 0
  );

  const walkInCount = Number(
    statsMetrics?.walkInCount !== undefined
      ? statsMetrics.walkInCount
      : membershipSummary?.active !== undefined
      ? membershipSummary.active
      : totalActiveUsers
  );

  const appCount = Number(
    statsMetrics?.appCount !== undefined
      ? statsMetrics.appCount
      : gym?.appBookingsCount || gym?.completedBookingsCount || todayCheckinsCount || 0
  );

  const metricCards = useMemo(() => {
    const allCards = [
      {
        id: 'total-revenue',
        title: 'Total Revenue',
        value: `₹${monthlyRevenue.toLocaleString('en-IN')}`,
        iconBg: 'transparent',
        iconColor: '#10B981',
        isTextIcon: true,
        textIcon: '₹',
        isRevenue: true,
      },
      {
        id: 'member-revenue',
        title: 'Membership Plans',
        value: `₹${memberRevenue.toLocaleString('en-IN')}`,
        iconBg: 'transparent',
        iconColor: '#3B82F6',
        iconName: 'person-add-alt-1',
        isRevenue: true,
      },
      {
        id: 'app-booking-revenue',
        title: 'Session Bookings',
        value: `₹${appBookingRevenue.toLocaleString('en-IN')}`,
        iconBg: 'transparent',
        iconColor: '#8B5CF6',
        iconName: 'smartphone',
        onPress: onNavigateToBookings,
        isRevenue: true,
      },
      {
        id: 'app-count',
        title: 'App Count',
        value: String(appCount),
        iconBg: 'transparent',
        iconColor: '#8B5CF6',
        iconName: 'smartphone',
        onPress: onNavigateToBookings,
      },
      {
        id: 'total-active-users',
        title: 'Total Active Users',
        value: String(totalActiveUsers),
        iconBg: 'transparent',
        iconColor: '#EA580C',
        iconName: 'groups',
        onPress: onNavigateToMembers,
      },
      {
        id: 'walk-in-count',
        title: 'Walk-in Count',
        value: String(walkInCount),
        iconBg: 'transparent',
        iconColor: '#059669',
        iconName: 'how-to-reg',
        onPress: onNavigateToMembers,
      },
    ];

    if (isManager) {
      return allCards.filter((card) => !card.isRevenue);
    }
    return allCards;
  }, [
    isManager,
    monthlyRevenue,
    memberRevenue,
    appBookingRevenue,
    appCount,
    totalActiveUsers,
    walkInCount,
    onNavigateToMembers,
    onNavigateToBookings,
    navigation,
  ]);

  // Dynamic Staff Count
  const totalStaff = employees.length;

  // Live Member Check-ins
  const liveCheckins = Array.isArray(gym?.recentCheckins) ? gym.recentCheckins : [];

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: topInset + 12,
          paddingBottom: 170 + Math.max(insets.bottom, 24),
        },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[AppColors.primaryColor]}
          tintColor={AppColors.primaryColor}
        />
      }
    >
      {/* 1. Top Header: Gym Logo, Gym Name, Location & Notifications */}
      <View style={styles.topHeader}>
        <View style={styles.gymProfile}>
          <View
            style={[
              styles.gymLogoWrapper,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            {logoUri ? (
              <Image
                source={{ uri: logoUri }}
                style={styles.gymLogo}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.gymInitialBadge, { backgroundColor: AppColors.primaryColor }]}>
                <Text style={styles.gymInitialText}>{gymInitials}</Text>
              </View>
            )}
          </View>
          <View style={styles.gymInfoBox}>
            <View style={styles.gymNameRow}>
              <Text
                style={[
                  styles.gymName,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
                numberOfLines={1}
              >
                {gym?.name || user?.fullName || 'Gym Facility'}
              </Text>
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified" size={15} color={AppColors.secondaryColor} />
              </View>
            </View>
            <Text
              style={[
                styles.gymLocation,
                { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
              ]}
              numberOfLines={1}
            >
              {gym?.city
                ? gym?.area
                  ? `${gym.area}, ${gym.city}`
                  : gym.city
                : gym?.fullAddress || 'Partner Location'}
            </Text>
          </View>
        </View>

        {/* Top Right Actions: Settings */}
        <View style={styles.topHeaderRight}>
          <TouchableOpacity
            style={[
              styles.settingsHeaderBtn,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={() => navigation?.navigate('Settings')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="settings-outline"
              size={20}
              color={isDark ? '#FFFFFF' : '#0F172A'}
            />
          </TouchableOpacity>
        </View>
      </View>



      {/* 2. Key Business Metrics Grid (6 Unified Cards) */}
      <View style={styles.metricsGrid}>
        {isLoadingOverview && !gym ? (
          <>
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
            <SkeletonMetricCard />
          </>
        ) : (
          metricCards.map((card) => {
          const CardComp = card.onPress ? TouchableOpacity : View;
          return (
            <CardComp
              key={card.id}
              style={[
                styles.metricCard,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
              onPress={card.onPress}
              activeOpacity={card.onPress ? 0.8 : 1}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {card.isTextIcon ? (
                  <Text style={{ fontSize: 13, fontWeight: '800', color: card.iconColor }}>
                    {card.textIcon}
                  </Text>
                ) : (
                  <MaterialIcons name={card.iconName} size={14} color={card.iconColor} />
                )}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={[
                    styles.metricNum,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  {card.value}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.metricLabel,
                  { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                ]}
              >
                {card.title}
              </Text>
            </CardComp>
          );
        })
      )}
      </View>

      {/* Quick Desk Actions Grid: Walk-in Booking & Walk-in Member (commented out)
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <TouchableOpacity
          style={[
            styles.walkInQuickHalfCard,
            {
              backgroundColor: isDark ? 'rgba(124, 58, 237, 0.12)' : '#F5F3FF',
              borderColor: isDark ? 'rgba(139, 92, 246, 0.35)' : '#DDD6FE',
            },
          ]}
          onPress={() => setShowWalkInModal(true)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={[styles.actionIconBox, { backgroundColor: '#7C3AED' }]}>
              <MaterialIcons name="confirmation-number" size={17} color="#FFFFFF" />
            </View>
            <View style={[styles.deskTag, { backgroundColor: '#7C3AED' }]}>
              <Text style={styles.deskTagText}>PASS</Text>
            </View>
          </View>
          <Text style={[styles.halfCardTitle, { color: isDark ? '#FFFFFF' : '#4C1D95' }]}>
            Walk-in Booking
          </Text>
          <Text style={[styles.halfCardSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#6D28D9' }]}>
            Day pass & session
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.walkInQuickHalfCard,
            {
              backgroundColor: isDark ? 'rgba(0, 56, 130, 0.12)' : '#EFF6FF',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
            },
          ]}
          onPress={() => setShowWalkInMemberModal(true)}
          activeOpacity={0.85}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={[styles.actionIconBox, { backgroundColor: '#003882' }]}>
              <MaterialIcons name="person-add" size={17} color="#FFFFFF" />
            </View>
            <View style={[styles.deskTag, { backgroundColor: '#003882' }]}>
              <Text style={styles.deskTagText}>MEMBER</Text>
            </View>
          </View>
          <Text style={[styles.halfCardTitle, { color: isDark ? '#FFFFFF' : '#1E3A8A' }]}>
            Walk-in Member
          </Text>
          <Text style={[styles.halfCardSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#1D4ED8' }]}>
            Register membership
          </Text>
        </TouchableOpacity>
      </View>
      */}

      {/* 5. Live Member Check-Ins Activity Feed */}

      <View style={styles.sectionHeaderRow}>
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? '#FFFFFF' : '#0F172A' },
          ]}
        >
          Live Member Check-Ins
        </Text>
        <TouchableOpacity onPress={onNavigateToMembers}>
          <Text style={styles.viewAllText}>View All Members</Text>
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.checkinCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        {liveCheckins.length > 0 ? (
          liveCheckins.map((item, index) => (
            <View
              key={item.id || index}
              style={[
                styles.checkinRow,
                index < liveCheckins.length - 1 && [
                  styles.checkinBorder,
                  { borderColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
                ],
              ]}
            >
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {item.avatar ||
                    (item.name
                      ? item.name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase()
                      : 'MB')}
                </Text>
              </View>

              <View style={styles.checkinInfo}>
                <Text
                  style={[
                    styles.checkinName,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  {item.name || 'Member'}
                </Text>
                <Text
                  style={[
                    styles.checkinMeta,
                    { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                  ]}
                >
                  {item.plan || 'Standard Pass'} • {item.type || 'Workout'}
                </Text>
              </View>

              <View style={styles.checkinStatusBox}>
                <Text
                  style={[
                    styles.checkinStatusBadge,
                    {
                      color:
                        item.status === 'Active'
                          ? AppColors.secondaryColor
                          : AppColors.warningAmber,
                      backgroundColor:
                        item.status === 'Active'
                          ? 'rgba(0, 191, 98, 0.12)'
                          : 'rgba(245, 158, 11, 0.12)',
                    },
                  ]}
                >
                  {item.status || 'Active'}
                </Text>
                <Text
                  style={[
                    styles.checkinTime,
                    { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                  ]}
                >
                  {item.time || 'Just now'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCheckinsBox}>
            <MaterialIcons
              name="qr-code-scanner"
              size={32}
              color={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
            />
            <Text style={[styles.emptyCheckinsTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              No Check-ins Recorded Today
            </Text>
            <Text style={[styles.emptyCheckinsSub, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
              Members checking in via QR scan or check-in verification will appear here in real-time.
            </Text>
            <TouchableOpacity
              style={styles.emptyScanBtn}
              onPress={() => navigation?.navigate('CheckIn', { initialMode: 'QR' })}
              activeOpacity={0.88}
            >
              <MaterialIcons name="qr-code" size={18} color="#FFFFFF" />
              <Text style={styles.emptyScanBtnText}>Scan Member Entry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 6. Performance & Analytics Insights (Merged from Analytics Tab) */}
      <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
        <View>
          <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Performance & Insights
          </Text>
          <Text style={[styles.analyticsSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Real-time analytics for {gym?.name || 'your gym'}
          </Text>
        </View>
      </View>

      {/* Period Filter Buttons */}
      <View style={styles.periodRow}>
        {['This Week', 'This Month', 'This Year'].map((p) => {
          const isSelected = selectedPeriod === p;
          return (
            <TouchableOpacity
              key={p}
              onPress={() => setSelectedPeriod(p)}
              style={[
                styles.periodBtn,
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
                  styles.periodBtnText,
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
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Revenue Highlight Card */}
      {!isManager && (
        <View
          style={[
            styles.revenueCard,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.revenueTopRow}>
            <View>
              <Text
                style={[
                  styles.revenueLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' },
                ]}
              >
                TOTAL REVENUE ({selectedPeriod.toUpperCase()})
              </Text>
              <Text
                style={[
                  styles.revenueAmount,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                {periodRevenueFormatted}
              </Text>
            </View>
            <View style={styles.growthBadge}>
              <MaterialIcons name="trending-up" size={16} color={AppColors.secondaryColor} />
              <Text style={styles.growthText}>Live DB</Text>
            </View>
          </View>

          <View
            style={[
              styles.statDivider,
              { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
            ]}
          />

          <View style={styles.miniStatsRow}>
            <View style={styles.miniStatItem}>
              <Text
                style={[
                  styles.miniStatLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
                ]}
              >
                Daily Average
              </Text>
              <Text
                style={[
                  styles.miniStatVal,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                {dailyAverageFormatted}
              </Text>
            </View>

            <View style={styles.miniStatItem}>
              <Text
                style={[
                  styles.miniStatLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
                ]}
              >
                Active Rate
              </Text>
              <Text
                style={[
                  styles.miniStatVal,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                {activeRateFormatted}
              </Text>
            </View>

            <View style={styles.miniStatItem}>
              <Text
                style={[
                  styles.miniStatLabel,
                  { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
                ]}
              >
                New Signups
              </Text>
              <Text
                style={[
                  styles.miniStatVal,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                +{newSignupsCount}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Weekly Check-In Activity Graph */}
      <View
        style={[
          styles.chartCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.chartHeader}>
          <View>
            <Text
              style={[
                styles.chartTitle,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              Weekly Footfall Trends
            </Text>
            <Text
              style={[
                styles.chartSub,
                { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' },
              ]}
            >
              Average {avgDailyCheckins} members / day
            </Text>
          </View>
          <View style={styles.peakBadge}>
            <Text style={styles.peakBadgeText}>{peakDayLabel}</Text>
          </View>
        </View>

        {/* Bar Chart Container */}
        <View style={styles.barChartContainer}>
          {weeklyCheckins.map((item) => (
            <View key={item.day} style={styles.barColumn}>
              <Text
                style={[
                  styles.barValueText,
                  { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                ]}
              >
                {item.count}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      height: `${item.heightPct}%`,
                      backgroundColor:
                        item.day === 'Sat'
                          ? AppColors.secondaryColor
                          : isDark
                          ? '#3B82F6'
                          : AppColors.primaryColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barDayText,
                  {
                    color:
                      item.day === 'Sat'
                        ? AppColors.secondaryColor
                        : isDark
                        ? 'rgba(255,255,255,0.7)'
                        : '#475569',
                    fontWeight: item.day === 'Sat' ? '800' : '600',
                  },
                ]}
              >
                {item.day}
              </Text>
            </View>
          ))}
        </View>
      </View>

            {/* Front Desk Walk-in Booking Modal */}
      <AddWalkInBookingModal
        visible={showWalkInModal}
        onClose={() => setShowWalkInModal(false)}
        onSuccess={() => {
          fetchOverviewData();
          if (onNavigateToBookings) onNavigateToBookings();
        }}
      />

      {/* Front Desk Walk-in Member Registration Modal */}
      <AddWalkInMemberModal
        visible={showWalkInMemberModal}
        onClose={() => setShowWalkInMemberModal(false)}
        onSuccess={() => {
          fetchOverviewData();
          if (onNavigateToMembers) onNavigateToMembers();
        }}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 18,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  gymProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  gymLogoWrapper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gymLogo: {
    width: '100%',
    height: '100%',
  },
  gymInitialBadge: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymInitialText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gymInfoBox: {
    flex: 1,
  },
  gymNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gymName: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    marginTop: 1,
  },
  gymLocation: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.dangerRed,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  metricCard: {
    width: '31.5%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  metricNum: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryColor,
    height: 52,
    borderRadius: 16,
    gap: 8,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  viewAllText: {
    color: AppColors.primaryColor,
    fontSize: 13,
    fontWeight: '700',
  },
  checkinCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  checkinBorder: {
    borderBottomWidth: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 56, 130, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: AppColors.primaryColor,
    fontSize: 13,
    fontWeight: '800',
  },
  checkinInfo: {
    flex: 1,
  },
  checkinName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  checkinMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  checkinStatusBox: {
    alignItems: 'flex-end',
    gap: 4,
  },
  checkinStatusBadge: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  checkinTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  walkInQuickHalfCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfCardTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  halfCardSub: {
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
  walkInQuickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  deskTag: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  deskTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyCheckinsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyCheckinsTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyCheckinsSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  emptyScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.primaryColor,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyScanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  analyticsSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBtnText: {
    fontSize: 12,
  },
  revenueCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  revenueTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  revenueLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  revenueAmount: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  growthText: {
    color: AppColors.secondaryColor,
    fontSize: 12,
    fontWeight: '700',
  },
  statDivider: {
    height: 1,
    marginVertical: 14,
  },
  miniStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniStatItem: {
    alignItems: 'center',
  },
  miniStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  miniStatVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  chartCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  chartSub: {
    fontSize: 12,
    marginTop: 2,
  },
  peakBadge: {
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  peakBadgeText: {
    color: AppColors.secondaryColor,
    fontSize: 11,
    fontWeight: '700',
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 140,
    paddingTop: 10,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barValueText: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  barTrack: {
    width: 22,
    height: 90,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    borderRadius: 6,
  },
  barDayText: {
    fontSize: 11,
    marginTop: 6,
  },
  settlementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    marginBottom: 18,
  },
  settlementContent: {
    flex: 1,
  },
  settlementTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  settlementSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
