import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { attendanceService } from '../services/attendanceService';

const getInitialTab = (membershipId, bookingId) => {
  if (membershipId) return 'MEMBERSHIP';
  if (bookingId) return 'BOOKING';
  return 'ALL';
};

const getScreenTitle = (membershipId, bookingId, fallbackTitle) => {
  if (membershipId) return 'Membership Attendance';
  if (bookingId) return 'Session Attendance';
  return fallbackTitle || 'Attendance History';
};

export const AttendanceHistoryScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const initialMembershipId = route.params?.membershipId || null;
  const initialBookingId = route.params?.bookingId || null;
  const initialTitle = route.params?.title || null;
  const contextName = route.params?.contextName || null;

  // Filter state
  const [filterMembershipId, setFilterMembershipId] = useState(initialMembershipId);
  const [filterBookingId, setFilterBookingId] = useState(initialBookingId);
  const [activeTab, setActiveTab] = useState(() => getInitialTab(initialMembershipId, initialBookingId));

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allLogs, setAllLogs] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    thisMonth: 0,
    completed: 0,
    activeNow: 0,
  });

  const loadAttendance = useCallback(async () => {
    try {
      const data = await attendanceService.fetchAttendanceHistory({
        membershipId: filterMembershipId || undefined,
        bookingId: filterBookingId || undefined,
      });

      if (data) {
        setAllLogs(data.logs || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (error) {
      console.warn('Failed to load attendance history:', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterMembershipId, filterBookingId]);

  useEffect(() => {
    setLoading(true);
    void loadAttendance();
  }, [loadAttendance]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadAttendance();
  };

  const clearSpecificFilter = () => {
    setFilterMembershipId(null);
    setFilterBookingId(null);
    setActiveTab('ALL');
  };

  // Filter logs by tab if viewing all
  const displayedLogs = allLogs.filter((log) => {
    if (filterMembershipId || filterBookingId) return true;
    if (activeTab === 'MEMBERSHIP') return log.type === 'MEMBERSHIP';
    if (activeTab === 'BOOKING') return log.type === 'BOOKING';
    return true;
  });

  const screenTitle = getScreenTitle(filterMembershipId, filterBookingId, initialTitle);

  const formatLogDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderEmptyState = () => {
    const isFiltered = Boolean(filterMembershipId || filterBookingId);
    const emptySub = isFiltered
      ? 'No check-ins have been recorded for this pass yet. Show your QR code or 6-digit OTP at the gym turnstile to check in.'
      : 'You have not checked in to any gym session yet. Once you scan your pass at the turnstile, your attendance history will appear here.';

    return (
      <ScrollView
        contentContainerStyle={styles.emptyContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#003882']} />}
      >
        <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
          <MaterialIcons name="history" size={48} color={colors.subtitle} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Attendance Records Found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.subtitle }]}>{emptySub}</Text>
        {isFiltered && (
          <TouchableOpacity onPress={clearSpecificFilter} style={styles.viewAllBtn} activeOpacity={0.8}>
            <Text style={styles.viewAllBtnText}>View All Gym Attendance</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const renderLogItem = ({ item }) => {
    const isCompleted = item.status === 'Completed';
    let passType = 'Pass';
    if (item.type === 'MEMBERSHIP') {
      passType = 'Membership';
    } else if (item.type === 'BOOKING') {
      passType = 'Session Pass';
    }
    const passId = item.membership?.membershipId || item.booking?.bookingId || null;

    let chipBg = isDark ? '#064E3B' : '#ECFDF5';
    let chipText = isDark ? '#A7F3D0' : '#047857';
    if (item.type === 'MEMBERSHIP') {
      chipBg = isDark ? '#312E81' : '#EEF2FF';
      chipText = isDark ? '#C7D2FE' : '#4338CA';
    }

    return (
      <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header: Date + Status Badge */}
        <View style={styles.cardHeader}>
          <View style={styles.dateRow}>
            <MaterialIcons name="calendar-today" size={15} color="#003882" style={{ marginRight: 6 }} />
            <Text style={[styles.dateText, { color: colors.text }]}>
              {formatLogDate(item.checkInTime)}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isCompleted
                  ? 'rgba(0, 191, 98, 0.12)'
                  : 'rgba(0, 56, 130, 0.12)',
              },
            ]}
          >
            {!isCompleted && <View style={styles.pulsingDot} />}
            <Text
              style={[
                styles.statusBadgeText,
                { color: isCompleted ? '#059669' : '#003882' },
              ]}
            >
              {isCompleted ? 'Completed' : 'Checked-In'}
            </Text>
          </View>
        </View>

        {/* Gym & Area */}
        <View style={styles.gymRow}>
          <View style={[styles.gymIconBox, { backgroundColor: isDark ? '#262626' : '#EFF6FF' }]}>
            <Ionicons name="fitness" size={18} color="#003882" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.gymName, { color: colors.text }]} numberOfLines={1}>
              {item.gym?.name || 'GYMEZY Partner Gym'}
            </Text>
            <Text style={[styles.areaText, { color: colors.subtitle }]} numberOfLines={1}>
              {item.area || 'General Workout'}
            </Text>
          </View>

          <View style={[styles.passTypeChip, { backgroundColor: chipBg }]}>
            <Text style={[styles.passTypeText, { color: chipText }]}>{passType}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Time & Duration Info */}
        <View style={styles.timeInfoRow}>
          <View style={styles.timeCol}>
            <Text style={[styles.timeLabel, { color: colors.subtitle }]}>ENTRY</Text>
            <View style={styles.timeValRow}>
              <MaterialIcons name="login" size={14} color="#003882" style={{ marginRight: 4 }} />
              <Text style={[styles.timeVal, { color: colors.text }]}>{item.timeStr}</Text>
            </View>
          </View>

          <View style={styles.timeCol}>
            <Text style={[styles.timeLabel, { color: colors.subtitle }]}>EXIT</Text>
            <View style={styles.timeValRow}>
              <MaterialIcons
                name="logout"
                size={14}
                color={item.checkOutStr ? '#059669' : colors.subtitle}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.timeVal, { color: item.checkOutStr ? colors.text : colors.subtitle }]}>
                {item.checkOutStr || 'Active Inside'}
              </Text>
            </View>
          </View>

          <View style={styles.timeCol}>
            <Text style={[styles.timeLabel, { color: colors.subtitle }]}>DURATION</Text>
            <View style={styles.timeValRow}>
              <MaterialIcons name="timer" size={14} color="#6366F1" style={{ marginRight: 4 }} />
              <Text style={[styles.timeVal, { color: colors.text, fontWeight: '700' }]}>
                {item.durationStr || 'In Progress'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer Details: Pass ID + Method */}
        <View style={styles.cardFooter}>
          {passId ? (
            <Text style={[styles.footerSub, { color: colors.subtitle }]}>
              Pass: <Text style={{ color: colors.text, fontWeight: '600' }}>{passId}</Text>
            </Text>
          ) : (
            <View />
          )}

          <View style={styles.methodPill}>
            <MaterialIcons
              name={item.method === 'OTP' ? 'dialpad' : 'qr-code-2'}
              size={13}
              color={colors.subtitle}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.methodText, { color: colors.subtitle }]}>
              {item.method === 'OTP' ? 'OTP Entry' : 'QR Scan'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 1. App Bar */}
      <View style={[styles.appBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: isDark ? '#262626' : '#F1F5F9' }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="arrow-back-ios-new" size={18} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {screenTitle}
          </Text>
          {contextName ? (
            <Text style={[styles.subtitle, { color: colors.subtitle }]} numberOfLines={1}>
              {contextName}
            </Text>
          ) : (
            <Text style={[styles.subtitle, { color: colors.subtitle }]}>
              Turnstile check-in & workout tracking
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onRefresh}
          style={[styles.backBtn, { backgroundColor: isDark ? '#262626' : '#F1F5F9' }]}
          activeOpacity={0.7}
        >
          <MaterialIcons name="refresh" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* 2. Active Specific Filter Banner */}
      {(filterMembershipId || filterBookingId) && (
        <View style={[styles.filterBanner, { backgroundColor: isDark ? '#1E293B' : '#EFF6FF', borderColor: '#BFDBFE' }]}>
          <View style={styles.filterBannerLeft}>
            <MaterialIcons name="filter-alt" size={16} color="#003882" />
            <Text style={styles.filterBannerText} numberOfLines={1}>
              Filtered by {filterMembershipId ? `Membership (${filterMembershipId})` : `Booking Pass (${filterBookingId})`}
            </Text>
          </View>
          <TouchableOpacity onPress={clearSpecificFilter} style={styles.clearFilterBtn} activeOpacity={0.7}>
            <Text style={styles.clearFilterBtnText}>Show All</Text>
            <MaterialIcons name="close" size={14} color="#003882" />
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Summary Metric Cards */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.metricNumber, { color: '#003882' }]}>{summary.total}</Text>
          <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Total Check-ins</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.metricNumber, { color: AppColors.secondaryColor }]}>{summary.thisMonth}</Text>
          <Text style={[styles.metricLabel, { color: colors.subtitle }]}>This Month</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.metricNumber, { color: colors.text }]}>{summary.completed}</Text>
          <Text style={[styles.metricLabel, { color: colors.subtitle }]}>Completed</Text>
        </View>
      </View>

      {/* 4. Filter Tabs (when viewing all) */}
      {!filterMembershipId && !filterBookingId && (
        <View style={styles.tabsContainer}>
          {[
            { id: 'ALL', label: 'All History' },
            { id: 'MEMBERSHIP', label: 'Memberships' },
            { id: 'BOOKING', label: 'Sessions' },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            let tabBg = isDark ? '#1E293B' : '#F1F5F9';
            let tabText = isDark ? '#94A3B8' : '#64748B';
            if (isSelected) {
              tabBg = '#003882';
              tabText = '#FFFFFF';
            }

            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
                style={[styles.tabChip, { backgroundColor: tabBg }]}
              >
                <Text style={[styles.tabChipText, { color: tabText, fontWeight: isSelected ? '700' : '500' }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 5. Logs List or Loading / Empty */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#003882" />
          <Text style={[styles.loadingText, { color: colors.subtitle }]}>Loading attendance logs...</Text>
        </View>
      ) : displayedLogs.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={displayedLogs}
          keyExtractor={(item) => item.key || item._id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 32 + (insets.bottom > 0 ? insets.bottom + 10 : 16) },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#003882']} />}
          renderItem={renderLogItem}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  filterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#003882',
    marginLeft: 6,
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  clearFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#003882',
    marginRight: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  metricCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabChipText: {
    fontSize: 13,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  viewAllBtn: {
    backgroundColor: '#003882',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  viewAllBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 12,
  },
  logCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pulsingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#003882',
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  gymRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  gymIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  gymName: {
    fontSize: 14,
    fontWeight: '700',
  },
  areaText: {
    fontSize: 12,
    marginTop: 1,
  },
  passTypeChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  passTypeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
  timeInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  timeCol: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  timeValRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  footerSub: {
    fontSize: 11,
  },
  methodPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export default AttendanceHistoryScreen;
