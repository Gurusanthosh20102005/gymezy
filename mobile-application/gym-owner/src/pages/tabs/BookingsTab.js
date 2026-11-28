import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { AppColors } from '../../theme/appTheme';
import { useToast } from '../../widgets/CustomScaffoldMessage';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import { AddWalkInBookingModal } from '../../widgets/AddWalkInBookingModal';
import { SkeletonBookingRow } from '../../widgets/Skeleton';

export const SOURCE_FILTERS = [
  { key: 'ALL', label: 'All Sources' },
  { key: 'APP', label: 'GYMEZY App' },
  { key: 'WALK_IN', label: 'Front-Desk Walk-in' },
];

export const STATUS_FILTERS = ['All', 'Upcoming', 'Checked-in', 'Cancellation Requests', 'Completed', 'Cancelled'];

export const TYPE_FILTERS = ['All', 'Gym Session', 'Group Class', 'Walk-in Pass'];

export const BookingsTab = ({ topInset, navigation }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { gym, user } = useAuth();

  const targetGymId = gym?._id || gym?.id || user?.gymId;

  // Data States
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedType, setSelectedType] = useState('All');

  // Modal State
  const [showAddWalkInModal, setShowAddWalkInModal] = useState(false);

  // Pagination State (Infinite Scroll)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedSource, selectedStatus, selectedType]);

  // Fetch Bookings from API (Server-side middleware search & pagination)
  const fetchBookings = useCallback(async () => {
    if (!targetGymId) return;
    try {
      const params = {
        page,
        limit: 10,
      };
      if (selectedSource !== 'ALL') {
        params.source = selectedSource;
      }
      if (selectedStatus !== 'All') {
        params.status = selectedStatus;
      }
      if (selectedType !== 'All') {
        params.bookingType = selectedType;
      }
      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      const res = await apiService.getGymBookings(targetGymId, params);
      const rawList = res?.data || res?.bookings || (Array.isArray(res) ? res : []);

      const mapped = rawList.map((b) => {
        const startDateStr = b.startDate
          ? new Date(b.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : (b.date || 'Today');
        const isWalkIn = b.source === 'WALK_IN' || b.bookingType === 'WALK_IN';
        return {
          key: String(b._id || b.bookingId || Math.random()),
          _id: b._id,
          bookingId: b.bookingId || (b._id ? `BK${String(b._id).slice(-4).toUpperCase()}` : '-'),
          customerId: b.userId?.customerId || b.customerId || (b.userId?._id ? `CUST${String(b.userId._id).slice(-4).toUpperCase()}` : '-'),
          customerName: b.userId?.fullName || b.userId?.name || b.customerName || 'Guest Visitor',
          phone: b.userId?.phone || b.phone || '',
          avatar: b.userId?.avatar || b.userId?.profileImage || b.userId?.profilePicture || b.customerAvatar || b.profileImage || b.avatar || null,
          type: b.bookingType === 'GROUP_CLASS'
            ? 'Group Class'
            : b.bookingType === 'GYM_SESSION'
            ? 'Gym Session'
            : isWalkIn
            ? 'Walk-in Pass'
            : 'App Booking',
          source: b.source || (isWalkIn ? 'WALK_IN' : 'APP'),
          date: startDateStr,
          time: b.timeSlot || b.time || '07:00 AM',
          amount: `₹${Number(b.pricing?.totalAmount ?? b.amountPaid ?? b.amount ?? 0).toLocaleString('en-IN')}`,
          status: b.status === 'Attended' ? 'Checked-in' : (b.status || 'Active'),
          payment: b.payment?.method || b.paymentMethod || 'Cash',
          isCustomDates: b.isCustomDates,
          customDates: b.customDates || [],
          trainerName: b.trainerId?.name || b.trainerName || (typeof b.trainerId === 'string' && !/^[0-9a-fA-F]{24}$/.test(b.trainerId.trim()) ? b.trainerId.trim() : null),
          cancellation: b.cancellation || null,
        };
      });

      if (page > 1) {
        setBookings((prev) => {
          const seen = new Set(prev.map((item) => item.key));
          return [...prev, ...mapped.filter((item) => !seen.has(item.key))];
        });
      } else {
        setBookings(mapped);
      }
      setTotalPages(res?.pagination?.totalPages || res?.totalPages || Math.ceil((res?.total || rawList.length) / 10) || 1);
      setTotalCount(res?.pagination?.total ?? res?.total ?? rawList.length);
    } catch (err) {
      console.warn('Error fetching bookings:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [targetGymId, selectedSource, selectedStatus, selectedType, debouncedSearch, page]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    if (page !== 1) {
      setPage(1);
    } else {
      await fetchBookings();
    }
  };

  const handleLoadMore = useCallback(() => {
    if (isLoading || isLoadingMore || isRefreshing || page >= totalPages) return;
    setIsLoadingMore(true);
    setPage((prev) => prev + 1);
  }, [isLoading, isLoadingMore, isRefreshing, page, totalPages]);

  // 1-Tap Check-in Action
  const handleCheckInBooking = (bookingKey) => {
    setBookings((prev) =>
      prev.map((b) => (b.key === bookingKey ? { ...b, status: 'Checked-in' } : b))
    );
    showToast({ message: 'Day pass verified and checked-in successfully!', isSuccess: true });
  };

  // 1-Tap Call & WhatsApp
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
    const text = `Hi ${name}, greeting from ${gymName}! How can we help you with your booking?`;
    Linking.openURL(`whatsapp://send?phone=${clean}&text=${encodeURIComponent(text)}`).catch(() => {
      Alert.alert('WhatsApp', `Opening WhatsApp for ${name} (${phone})`);
    });
  };

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Source filter
      const matchesSource =
        selectedSource === 'ALL'
          ? true
          : selectedSource === 'WALK_IN'
          ? b.source === 'WALK_IN'
          : b.source === 'APP';

      // Status filter
      const matchesStatus =
        selectedStatus === 'All'
          ? true
          : selectedStatus === 'Upcoming'
          ? b.status === 'Upcoming' || b.status === 'Active' || b.status === 'Confirmed'
          : selectedStatus === 'Checked-in'
          ? b.status === 'Checked-in' || b.status === 'Attended'
          : selectedStatus === 'Cancellation Requests'
          ? b.status === 'Cancellation_Requested' || b.cancellation?.cancellationStatus === 'PENDING_GYM_APPROVAL'
          : b.status === selectedStatus;

      // Type filter
      const matchesType =
        selectedType === 'All'
          ? true
          : b.type.toLowerCase().includes(selectedType.toLowerCase());

      // Search query
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        (b.customerName && b.customerName.toLowerCase().includes(q)) ||
        (b.bookingId && b.bookingId.toLowerCase().includes(q)) ||
        (b.customerId && b.customerId.toLowerCase().includes(q)) ||
        (b.phone && b.phone.includes(q));

      return matchesSource && matchesStatus && matchesType && matchesSearch;
    });
  }, [bookings, selectedSource, selectedStatus, selectedType, searchQuery]);

  // Dynamic Key Metrics (matching Web Console)
  const totalBookingsCount = bookings.length;
  const walkInCount = bookings.filter((b) => b.source === 'WALK_IN').length;
  const appBookingsCount = bookings.filter((b) => b.source === 'APP').length;
  const checkedInCount = bookings.filter((b) => b.status === 'Checked-in' || b.status === 'Attended').length;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + 12,
            paddingBottom: 120 + Math.max(insets.bottom, 24),
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 250) {
            handleLoadMore();
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[AppColors.primaryColor]}
            tintColor={AppColors.primaryColor}
          />
        }
      >
        {/* 1. Header Bar */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={[styles.pageTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Bookings & Passes
            </Text>
            <Text style={[styles.pageSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              {totalBookingsCount} passes and session bookings • Desk & App
            </Text>
          </View>
          {/* cmd walk-in button
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setShowAddWalkInModal(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={17} color="#FFFFFF" />
            <Text style={styles.headerActionBtnText}>+ Add Walk-in</Text>
          </TouchableOpacity>
          cmd walk-in button */}
        </View>

        {/* 2. Minimal Key Metrics Strip */}
        <View style={styles.statCardsGrid}>
          {[
            { label: 'Total', value: totalBookingsCount, icon: 'confirmation-number', color: '#10B981' },
            { label: 'Walk-in', value: walkInCount, icon: 'person-add', color: '#7C3AED' },
            { label: 'App', value: appBookingsCount, icon: 'smartphone', color: '#2563EB' },
            { label: 'Checked-in', value: checkedInCount, icon: 'how-to-reg', color: '#059669' },
          ].map((m) => (
            <View
              key={m.label}
              style={[
                styles.statCard,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialIcons name={m.icon} size={14} color={m.color} />
                <Text style={[styles.statCardValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {m.value}
                </Text>
              </View>
              <Text style={[styles.statCardTitle, { color: isDark ? '#94A3B8' : '#64748B' }]} numberOfLines={1}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>

        {/* 3. Search Bar */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchContainer,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <MaterialIcons
              name="search"
              size={20}
              color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
              placeholder="Search customer name, booking ID, phone..."
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 5. Status Filter Horizontal Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {STATUS_FILTERS.map((status) => {
            const isSelected = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
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
                onPress={() => setSelectedStatus(status)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : isDark
                        ? '#94A3B8'
                        : '#64748B',
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 6. Bookings List Content */}
        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            <SkeletonBookingRow />
            <SkeletonBookingRow />
            <SkeletonBookingRow />
          </View>
        ) : filteredBookings.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' },
            ]}
          >
            <MaterialIcons
              name="confirmation-number"
              size={48}
              color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'}
            />
            <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              No Bookings Found
            </Text>
            <Text style={[styles.emptySub, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {searchQuery
                ? 'No bookings match your search query.'
                : 'No day pass or session bookings recorded under this filter.'}
            </Text>
            {/* cmd walk-in button
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setShowAddWalkInModal(true)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="person-add" size={17} color="#FFFFFF" />
              <Text style={styles.emptyActionBtnText}>Add Walk-in Pass</Text>
            </TouchableOpacity>
            cmd walk-in button */}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredBookings.map((b) => {
              const isCheckedIn = b.status === 'Checked-in' || b.status === 'Attended';
              const isUpcoming = b.status === 'Upcoming' || b.status === 'Active' || b.status === 'Confirmed';
              const isWalkIn = b.source === 'WALK_IN';

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
                  {/* Top Customer Info Row */}
                  <View style={[styles.bookingTopRow, { alignItems: 'flex-start' }]}>
                    <View
                      style={[
                        styles.bookingAvatar,
                        {
                          backgroundColor: isWalkIn ? '#334155' : AppColors.primaryColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        },
                      ]}
                    >
                      {b.avatar ? (
                        <Image
                          source={{ uri: b.avatar }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                          {(b.customerName || 'U').substring(0, 2).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                      <Text
                        style={[styles.bookingCustomerName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                        numberOfLines={1}
                      >
                        {b.customerName}
                      </Text>
                      <Text
                        style={[styles.bookingMetaSub, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }]}
                        numberOfLines={1}
                      >
                        {isWalkIn ? 'Walk-in' : 'App'} · {b.type} · #{b.bookingId}
                      </Text>
                      <Text
                        style={[styles.bookingMetaSub, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }]}
                      >
                        {b.date} · {b.time}
                      </Text>

                      {!!b.trainerName && (
                        <Text style={[styles.bookingMetaSub, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }]}>
                          Coach: {b.trainerName}
                        </Text>
                      )}

                      {b.isCustomDates && Array.isArray(b.customDates) && b.customDates.length > 0 && (
                        <Text style={[styles.bookingMetaSub, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }]}>
                          {b.customDates.length} Custom Dates:{' '}
                          {b.customDates
                            .map((d) => {
                              const raw = typeof d === 'string' ? d : d?.date || d?.label || '';
                              if (!raw) return '';
                              const dt = new Date(raw);
                              if (!Number.isNaN(dt.getTime())) {
                                return dt.toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                });
                              }
                              return raw;
                            })
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      )}
                    </View>

                    {/* Single Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            b.status === 'Active' || b.status === 'Checked-in'
                              ? (isDark ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5')
                              : (isDark ? 'rgba(148, 163, 184, 0.14)' : '#F1F5F9'),
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {b.status}
                      </Text>
                    </View>
                  </View>

                  {/* Divider */}
                  <View
                    style={[
                      styles.cardDivider,
                      { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' },
                    ]}
                  />

                  {/* Bottom Row: Amount/Payment & Actions */}
                  <View style={styles.bookingBottomRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={[styles.metaValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {b.amount}{' '}
                        <Text style={{ fontSize: 12, fontWeight: '500', color: isDark ? '#94A3B8' : '#64748B' }}>
                          · {b.payment}
                        </Text>
                      </Text>

                      {!!b.phone && (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                          <TouchableOpacity
                            onPress={() => handleCall(b.phone)}
                            style={[
                              styles.smallActionIconBtn,
                              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                            ]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <MaterialIcons name="call" size={14} color={isDark ? '#94A3B8' : '#475569'} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleWhatsApp(b.phone, b.customerName)}
                            style={[
                              styles.smallActionIconBtn,
                              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' },
                            ]}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {b.status === 'Cancellation_Requested' || b.cancellation?.cancellationStatus === 'PENDING_GYM_APPROVAL' ? (
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={[styles.verifyCheckinBtn, { backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 7 }]}
                          disabled={reviewLoadingId === b._id}
                          onPress={() =>
                            Alert.alert(
                              'Accept Cancellation',
                              `Approve prorated refund of ₹${b.cancellation?.refundAmount || 0} for ${b.customerName}? (Deducted: ₹${b.cancellation?.deductedAmount || 0} for ${b.cancellation?.consumedDays || 1} day(s))`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Confirm & Refund', onPress: () => handleReviewCancellation(b.key, 'ACCEPT') },
                              ]
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="check" size={15} color="#FFFFFF" />
                          <Text style={styles.verifyCheckinBtnText}>Accept (₹{b.cancellation?.refundAmount || 0})</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.verifyCheckinBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 7 }]}
                          disabled={reviewLoadingId === b._id}
                          onPress={() =>
                            Alert.alert(
                              'Reject Cancellation',
                              `Reject cancellation request and restore remaining sessions for ${b.customerName}?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Reject Request', style: 'destructive', onPress: () => handleReviewCancellation(b.key, 'REJECT', 'Rejected by gym owner') },
                              ]
                            )
                          }
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.verifyCheckinBtnText, { color: '#EF4444' }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    ) : isUpcoming && !isCheckedIn ? (
                      <TouchableOpacity
                        style={styles.verifyCheckinBtn}
                        onPress={() => handleCheckInBooking(b.key)}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="qr-code-scanner" size={16} color="#FFFFFF" />
                        <Text style={styles.verifyCheckinBtnText}>Check In Pass</Text>
                      </TouchableOpacity>
                    ) : (isCheckedIn || b.status === 'Checked-in') ? (
                      <View style={styles.verifiedPassBadge}>
                        <MaterialIcons
                          name="check-circle"
                          size={14}
                          color={AppColors.secondaryColor}
                        />
                        <Text style={styles.verifiedPassText}>Access Granted</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Infinite Scroll Loading Indicator */}
        {isLoadingMore && (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={AppColors.primaryColor} />
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Front-Desk Walk-In Booking Modal */}
      <AddWalkInBookingModal
        visible={showAddWalkInModal}
        onClose={() => setShowAddWalkInModal(false)}
        onSuccess={() => {
          fetchBookings();
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  headerActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  statCardsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statCardTitle: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  statCardValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  searchRow: {
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  sourceSegmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 3,
  },
  sourceSegmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 9,
  },
  sourceSegmentTabActive: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  sourceSegmentText: {
    fontSize: 11.5,
    textAlign: 'center',
  },
  filterChipsRow: {
    gap: 8,
    paddingBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  bookingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  bookingTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bookingAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  bookingCustomerName: {
    fontSize: 14,
    fontWeight: '700',
  },
  bookingSourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  bookingSourceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  bookingTypeTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  bookingMetaSub: {
    fontSize: 11.5,
  },
  smallActionIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    marginVertical: 10,
  },
  bookingBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  verifyCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#003882',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  verifyCheckinBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  verifiedPassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 191, 98, 0.1)',
  },
  verifiedPassText: {
    color: '#00BF62',
    fontSize: 11.5,
    fontWeight: '700',
  },
});
