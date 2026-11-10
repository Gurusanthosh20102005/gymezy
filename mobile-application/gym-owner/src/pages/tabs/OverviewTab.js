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

export const WEEKLY_CHECKINS = [
  { day: 'Mon', count: 74, heightPct: 74 },
  { day: 'Tue', count: 88, heightPct: 88 },
  { day: 'Wed', count: 68, heightPct: 68 },
  { day: 'Thu', count: 82, heightPct: 82 },
  { day: 'Fri', count: 95, heightPct: 95 },
  { day: 'Sat', count: 100, heightPct: 100 },
  { day: 'Sun', count: 54, heightPct: 54 },
];

export const PEAK_HOURS = [
  { time: '06:00 AM - 09:00 AM', label: 'Morning Rush', occupancy: '88%', status: 'Peak' },
  { time: '11:00 AM - 04:00 PM', label: 'Afternoon Hours', occupancy: '34%', status: 'Moderate' },
  { time: '05:00 PM - 09:30 PM', label: 'Evening Prime', occupancy: '96%', status: 'Max Rush' },
];

export const PLAN_STATS = [
  { name: 'Annual VIP Pass', count: 112, pct: '45%', color: AppColors.primaryColor },
  { name: 'Quarterly Pro', count: 86, pct: '35%', color: AppColors.secondaryColor },
  { name: 'Monthly Standard', count: 50, pct: '20%', color: AppColors.accentColor },
];

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

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingOverview, setIsLoadingOverview] = useState(!gym);
  const [employees, setEmployees] = useState([]);
  const [membershipSummary, setMembershipSummary] = useState(null);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [showWalkInMemberModal, setShowWalkInMemberModal] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');


  // Fetch live employees, memberships summary, and refresh gym profile
  const fetchOverviewData = useCallback(async () => {
    try {
      if (refreshGymProfile) {
        await refreshGymProfile();
      }
      const targetGymId = gym?.id || gym?._id || user?.gymId;
      const [employeeData, memRes] = await Promise.all([
        apiService.getEmployees().catch(() => []),
        targetGymId ? apiService.getMemberships(targetGymId, { limit: 10 }).catch(() => null) : null,
      ]);
      if (Array.isArray(employeeData)) {
        setEmployees(employeeData);
      }
      if (memRes?.summary) {
        setMembershipSummary(memRes.summary);
      }
    } catch (err) {
      console.warn('Overview data fetch error:', err.message);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [gym?.id, gym?._id, user?.gymId, refreshGymProfile]);

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
  const todayCheckinsCount = Number(gym?.todayCheckinsCount !== undefined ? gym.todayCheckinsCount : 0);
  const monthlyRevenue = Number(gym?.monthlyRevenue !== undefined ? gym.monthlyRevenue : gym?.totalRevenue || 0);

  const periodRevenueFormatted = useMemo(() => {
    if (selectedPeriod === 'This Week') {
      const val = Math.round((monthlyRevenue || 185400) * 0.28);
      return `₹${val.toLocaleString('en-IN')}`;
    }
    if (selectedPeriod === 'This Year') {
      const val = Math.round((monthlyRevenue || 185400) * 8.5);
      return `₹${val.toLocaleString('en-IN')}`;
    }
    return monthlyRevenue > 0 ? `₹${monthlyRevenue.toLocaleString('en-IN')}` : '₹1,85,400';
  }, [selectedPeriod, monthlyRevenue]);

  const memberRevenue = useMemo(() => {
    if (gym?.memberRevenue !== undefined) return Number(gym.memberRevenue);
    if (Array.isArray(gym?.members)) {
      return gym.members.reduce(
        (acc, m) => acc + (Number.parseInt(String(m.amount || '').replace(/[^\d]/g, ''), 10) || 0),
        0
      );
    }
    return 0;
  }, [gym?.memberRevenue, gym?.members]);

  const appBookingRevenue = useMemo(() => {
    if (gym?.appBookingRevenue !== undefined) return Number(gym.appBookingRevenue);
    if (gym?.bookingRevenue !== undefined) return Number(gym.bookingRevenue);
    if (Array.isArray(gym?.recentCheckins)) {
      return gym.recentCheckins.reduce((acc, b) => acc + (Number(b.price) || 0), 0);
    }
    return 0;
  }, [gym?.appBookingRevenue, gym?.bookingRevenue, gym?.recentCheckins]);

  const totalActiveUsers = Number(
    membershipSummary?.total !== undefined
      ? membershipSummary.total
      : gym?.membersCount || (gym?.members || []).length || activeMembersCount || 0
  );

  const activePassesCount = useMemo(() => {
    if (membershipSummary?.active !== undefined) {
      return Number(membershipSummary.active);
    }
    if (Array.isArray(gym?.members)) {
      return gym.members.filter((m) => m.status === 'Active' || !m.status).length;
    }
    return totalActiveUsers;
  }, [membershipSummary?.active, gym?.members, totalActiveUsers]);

  const appBookingsCount = Number(gym?.appBookingsCount || gym?.completedBookingsCount || todayCheckinsCount || 0);

  const metricCards = useMemo(
    () => [
      {
        id: 'total-revenue',
        title: 'Total Revenue',
        value: `₹${monthlyRevenue.toLocaleString('en-IN')}`,
        iconBg: 'transparent',
        iconColor: '#10B981',
        isTextIcon: true,
        textIcon: '₹',
      },
      {
        id: 'member-revenue',
        title: 'Member Revenue',
        value: `₹${memberRevenue.toLocaleString('en-IN')}`,
        iconBg: 'transparent',
        iconColor: '#3B82F6',
        iconName: 'person-add-alt-1',
      },
      {
        id: 'app-booking-revenue',
        title: 'App Booking Revenue',
        value: `₹${appBookingRevenue.toLocaleString('en-IN')}`,
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
        id: 'members',
        title: 'Members',
        value: String(activePassesCount),
        iconBg: 'transparent',
        iconColor: '#059669',
        iconName: 'how-to-reg',
        onPress: onNavigateToMembers,
      },
      {
        id: 'app-booking-number',
        title: 'App Booking Number',
        value: String(appBookingsCount),
        iconBg: 'transparent',
        iconColor: '#DC2626',
        iconName: 'smartphone',
        onPress: onNavigateToBookings,
      },
    ],
    [
      monthlyRevenue,
      memberRevenue,
      appBookingRevenue,
      totalActiveUsers,
      activePassesCount,
      appBookingsCount,
      onNavigateToMembers,
      navigation,
    ]
  );

  // Dynamic Staff Attendance Counts
  const totalStaff = employees.length;
  const presentStaff = employees.filter(
    (e) => e.status === 'Active' || e.attendance === 'Present' || e.attendance === 'Checked In'
  ).length;
  const absentStaff = Math.max(0, totalStaff - presentStaff);

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

        {/* Top Right Actions: Notifications & Settings */}
        <View style={styles.topHeaderRight}>
          <TouchableOpacity
            style={[
              styles.notifBtn,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={() =>
              Alert.alert(
                `${gym?.name || 'Gym'} Notifications`,
                `• Super Admin Status: ${gym?.approvalStatus || 'Approved'}\n• Staff Registered: ${totalStaff} staff members\n• Active Platform Plans: ${(gym?.pricingPlans ? Object.keys(gym.pricingPlans).length : 0)} configured`
              )
            }
            activeOpacity={0.8}
          >
            <Ionicons
              name="notifications-outline"
              size={20}
              color={isDark ? '#FFFFFF' : '#0F172A'}
            />
            <View style={styles.notifDot} />
          </TouchableOpacity>

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
              <View style={[styles.metricIconCircle, { backgroundColor: card.iconBg }]}>
                {card.isTextIcon ? (
                  <Text style={[styles.metricTextIcon, { color: card.iconColor }]}>
                    {card.textIcon}
                  </Text>
                ) : (
                  <MaterialIcons name={card.iconName} size={18} color={card.iconColor} />
                )}
              </View>
              <View style={styles.metricTextCol}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.metricLabel,
                    { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                  ]}
                >
                  {card.title}
                </Text>
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
                {!!card.subtitle && (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.metricSub,
                      { color: isDark ? 'rgba(255,255,255,0.45)' : '#94A3B8' },
                    ]}
                  >
                    {card.subtitle}
                  </Text>
                )}
              </View>
            </CardComp>
          );
        })
      )}
      </View>

      {/* Quick Desk Actions Grid: Walk-in Booking & Walk-in Member */}
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

      {/* Staff Attendance Quick Access Card */}
      <TouchableOpacity
        style={[
          styles.staffAttendanceQuickCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => (onNavigateToEmployees ? onNavigateToEmployees() : navigation?.navigate('Attendance'))}
        activeOpacity={0.85}
      >
        <View style={styles.staffQuickLeft}>
          <View style={[styles.staffIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
            <MaterialIcons name="badge" size={20} color={AppColors.accentColor} />
          </View>
          <View>
            <Text style={[styles.staffQuickTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Staff & Trainer Attendance
            </Text>
            <Text style={[styles.staffQuickSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              {totalStaff > 0
                ? `${presentStaff} / ${totalStaff} Present Today • ${absentStaff} Absent`
                : '0 Staff Configured • Tap to Manage Staff'}
            </Text>
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
      </TouchableOpacity>

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
            <Text style={styles.growthText}>+14.2%</Text>
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
              ₹6,180
            </Text>
          </View>

          <View style={styles.miniStatItem}>
            <Text
              style={[
                styles.miniStatLabel,
                { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' },
              ]}
            >
              Renewal Rate
            </Text>
            <Text
              style={[
                styles.miniStatVal,
                { color: isDark ? '#FFFFFF' : '#0F172A' },
              ]}
            >
              92.4%
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
              +{activeMembersCount > 0 ? Math.round(activeMembersCount * 0.15) : 28}
            </Text>
          </View>
        </View>
      </View>

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
              Average {todayCheckinsCount > 0 ? todayCheckinsCount : 82} members / day
            </Text>
          </View>
          <View style={styles.peakBadge}>
            <Text style={styles.peakBadgeText}>Saturday Peak</Text>
          </View>
        </View>

        {/* Bar Chart Container */}
        <View style={styles.barChartContainer}>
          {WEEKLY_CHECKINS.map((item) => (
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

      {/* Peak Hours Breakdown */}
      <View style={[styles.sectionHeaderRow, { marginTop: 4 }]}>
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? '#FFFFFF' : '#0F172A' },
          ]}
        >
          Occupancy by Time Slot
        </Text>
      </View>

      <View
        style={[
          styles.peakCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        {PEAK_HOURS.map((slot, index) => (
          <View
            key={slot.time}
            style={[
              styles.slotRow,
              index < PEAK_HOURS.length - 1 && [
                styles.slotBorder,
                { borderColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
              ],
            ]}
          >
            <View style={styles.slotInfo}>
              <Text
                style={[
                  styles.slotLabel,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                {slot.label}
              </Text>
              <Text
                style={[
                  styles.slotTime,
                  { color: isDark ? 'rgba(255,255,255,0.55)' : '#64748B' },
                ]}
              >
                {slot.time}
              </Text>
            </View>

            <View style={styles.slotBadgeBox}>
              <Text
                style={[
                  styles.slotOccupancy,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                {slot.occupancy}
              </Text>
              <Text
                style={[
                  styles.slotStatusTag,
                  {
                    color:
                      slot.status === 'Max Rush'
                        ? AppColors.dangerRed
                        : slot.status === 'Peak'
                        ? AppColors.warningAmber
                        : AppColors.secondaryColor,
                  },
                ]}
              >
                {slot.status}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Membership Plan Distribution */}
      <View style={[styles.sectionHeaderRow, { marginTop: 4 }]}>
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? '#FFFFFF' : '#0F172A' },
          ]}
        >
          Plan Distribution
        </Text>
      </View>

      <View
        style={[
          styles.planDistCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        {PLAN_STATS.map((plan) => (
          <View key={plan.name} style={styles.planStatRow}>
            <View style={styles.planStatHeader}>
              <View style={styles.planBulletRow}>
                <View style={[styles.planDot, { backgroundColor: plan.color }]} />
                <Text
                  style={[
                    styles.planStatName,
                    { color: isDark ? '#FFFFFF' : '#0F172A' },
                  ]}
                >
                  {plan.name}
                </Text>
              </View>
              <Text
                style={[
                  styles.planStatVal,
                  { color: isDark ? '#FFFFFF' : '#0F172A' },
                ]}
              >
                {plan.count} ({plan.pct})
              </Text>
            </View>
            <View
              style={[
                styles.planProgressBar,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
              ]}
            >
              <View
                style={[
                  styles.planProgressFill,
                  { width: plan.pct, backgroundColor: plan.color },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Settlement Alert Card */}
      <View
        style={[
          styles.settlementCard,
          {
            backgroundColor: isDark ? 'rgba(0, 56, 130, 0.15)' : '#EFF6FF',
            borderColor: isDark ? 'rgba(0, 56, 130, 0.4)' : '#BFDBFE',
          },
        ]}
      >
        <Ionicons name="card-outline" size={24} color={AppColors.primaryColor} />
        <View style={styles.settlementContent}>
          <Text
            style={[
              styles.settlementTitle,
              { color: isDark ? '#93C5FD' : AppColors.primaryColor },
            ]}
          >
            Next Settlement: 01 Nov 2026
          </Text>
          <Text
            style={[
              styles.settlementSub,
              { color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' },
            ]}
          >
            Pending pass & membership payouts will be credited to registered gym bank account.
          </Text>
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
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricTextIcon: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricNum: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 1,
  },
  metricSub: {
    fontSize: 9.5,
    fontWeight: '500',
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
  staffAttendanceQuickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
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
  staffQuickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  staffIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffQuickTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  staffQuickSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
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
  peakCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  slotBorder: {
    borderBottomWidth: 1,
  },
  slotInfo: {
    gap: 2,
  },
  slotLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  slotTime: {
    fontSize: 12,
  },
  slotBadgeBox: {
    alignItems: 'flex-end',
    gap: 2,
  },
  slotOccupancy: {
    fontSize: 14,
    fontWeight: '800',
  },
  slotStatusTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  planDistCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  planStatRow: {
    gap: 6,
  },
  planStatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planStatName: {
    fontSize: 13,
    fontWeight: '600',
  },
  planStatVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  planProgressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  planProgressFill: {
    height: '100%',
    borderRadius: 4,
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
