import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useBookingRepository } from '../data/BookingContext';
import { SkeletonBookingCard } from '../widgets/Skeleton';
import { getSafeImageUri, getGymLogoUri } from '../utils/mediaUtils';

const TABS = ['Upcoming', 'Completed', 'Cancelled'];

export const MyBookingsScreen = ({ navigation }) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { bookings, refreshBookings, isLoadingBookings } = useBookingRepository();

  const [selectedTab, setSelectedTab] = useState('Upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [failedLogos, setFailedLogos] = useState({});

  useFocusEffect(
    useCallback(() => {
      refreshBookings?.();
    }, [refreshBookings])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshBookings?.();
    setRefreshing(false);
  };

  const upcomingCount = bookings.filter(
    (b) => b.status === 'Upcoming' || b.status === 'Active' || b.status === 'Confirmed' || b.status === 'Cancellation_Requested'
  ).length;
  const completedCount = bookings.filter((b) => b.status === 'Completed').length;
  const cancelledCount = bookings.filter((b) => b.status === 'Cancelled').length;

  const filteredBookings = bookings.filter((b) => {
    if (selectedTab === 'Upcoming') {
      return b.status === 'Upcoming' || b.status === 'Active' || b.status === 'Confirmed' || b.status === 'Cancellation_Requested';
    }
    return b.status === selectedTab;
  });

  const bookNewSession = (_category = 'Gym') => {
    navigation.navigate('HomeTabs');
  };

  const openBookingDetails = (booking) => {
    navigation.navigate('BookingDetails', { booking });
  };

  const getCategoryIcon = (type, iconName) => {
    const t = (type || '').toLowerCase();
    if (t.includes('yoga')) {
      return {
        name: 'self-improvement',
        color: '#8B5CF6',
        bg: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.12)',
      };
    }
    if (t.includes('zumba') || t.includes('dance')) {
      return {
        name: 'music-note',
        color: '#EC4899',
        bg: isDark ? 'rgba(236, 72, 153, 0.25)' : 'rgba(236, 72, 153, 0.12)',
      };
    }
    return {
      name: 'fitness-center',
      color: isDark ? '#93C5FD' : AppColors.primaryColor,
      bg: isDark ? 'rgba(0, 56, 130, 0.35)' : 'rgba(0, 56, 130, 0.12)',
    };
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header matching Flutter */}
      <View style={styles.appBar}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.appBarTitle, { color: colors.text }]}>
            My Bookings
          </Text>
          <Text style={styles.activePassesSub}>
            {upcomingCount} active {upcomingCount === 1 ? 'pass' : 'passes'}
          </Text>
        </View>
      </View>

      {/* ========================================== */}
      {/* MY SESSION BOOKINGS (TICKETS LIST)         */}
      {/* ========================================== */}
      <View style={{ flex: 1 }}>
          {/* Modern Floating Pill Tab Selector */}
          <View style={styles.tabsOuterWrapper}>
            <View
              style={[
                styles.tabsContainer,
                {
                  backgroundColor: isDark ? '#1E1E1E' : '#EEF2F6',
                  borderColor: colors.border,
                },
              ]}
            >
              {TABS.map((tab) => {
                const isSelected = selectedTab === tab;
                const count =
                  tab === 'Upcoming'
                    ? upcomingCount
                    : tab === 'Completed'
                    ? completedCount
                    : cancelledCount;

                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setSelectedTab(tab)}
                    style={[
                      styles.tabPill,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? '#2D3748'
                            : '#FFFFFF'
                          : 'transparent',
                        shadowOpacity: isSelected ? (isDark ? 0.3 : 0.06) : 0,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.tabPillText,
                        {
                          color: isSelected
                            ? isDark
                              ? '#FFFFFF'
                              : AppColors.primaryColor
                            : colors.subtitle,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {tab} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* List of Digital Booking Tickets */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.passesScrollContent,
              { paddingBottom: 110 + (insets.bottom > 0 ? insets.bottom + 10 : 20) },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={isDark ? '#93C5FD' : AppColors.primaryColor}
                colors={[AppColors.primaryColor]}
              />
            }
          >
            {isLoadingBookings && bookings.length === 0 ? (
              <View style={{ paddingTop: 8 }}>
                <SkeletonBookingCard />
                <SkeletonBookingCard />
              </View>
            ) : filteredBookings.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <MaterialIcons name="event-busy" size={54} color={colors.subtitle} />
                <Text style={[styles.emptyStateTitle, { color: colors.text }]}>
                  No {selectedTab} Bookings
                </Text>
                <Text style={[styles.emptyStateSub, { color: colors.subtitle }]}>
                  When you book workout sessions, your digital passes will appear here.
                </Text>
              </View>
            ) : (
              filteredBookings.map((booking) => {
                const isUpcoming =
                  booking.status === 'Upcoming' ||
                  booking.status === 'Active' ||
                  booking.status === 'Confirmed';
                const catMeta = getCategoryIcon(booking.type, booking.iconName);
                const gymLogoUri =
                  !failedLogos[booking.id] &&
                  (getSafeImageUri(booking.gymLogo) ||
                    getGymLogoUri(booking.gymId) ||
                    getSafeImageUri(booking.gymImageUrl) ||
                    null);

                return (
                  <TouchableOpacity
                    key={booking.id}
                    onPress={() => openBookingDetails(booking)}
                    activeOpacity={0.88}
                    style={[
                      styles.ticketCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {/* Top Header Row */}
                    <View style={styles.ticketHeaderRow}>
                      <View
                        style={[
                          styles.categoryIconCapsule,
                          {
                            backgroundColor: gymLogoUri
                              ? (isDark ? '#1E293B' : '#F1F5F9')
                              : catMeta.bg,
                            borderWidth: gymLogoUri ? 1 : 0,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        {gymLogoUri ? (
                          <Image
                            source={{ uri: gymLogoUri }}
                            style={styles.gymLogoImg}
                            resizeMode="cover"
                            onError={() =>
                              setFailedLogos((prev) => ({ ...prev, [booking.id]: true }))
                            }
                          />
                        ) : (
                          <MaterialIcons name={catMeta.name} size={22} color={catMeta.color} />
                        )}
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.ticketGymName, { color: colors.text }]} numberOfLines={1}>
                          {booking.gymName}
                        </Text>
                        <Text style={[styles.ticketSubtitle, { color: colors.subtitle }]}>
                          {booking.sessionSubtitle}
                        </Text>
                      </View>

                      {/* Pass ID Tag & Status Badge on Top Right */}
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View
                          style={[
                            styles.passIdTag,
                            {
                              backgroundColor: isDark ? '#2A2A2A' : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.passIdText,
                              { color: isDark ? '#93C5FD' : AppColors.primaryColor },
                            ]}
                          >
                            {booking.id}
                          </Text>
                        </View>
                        {booking.status === 'Active' && (
                          <View style={{ backgroundColor: 'rgba(0, 191, 98, 0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#00BF62', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>ACTIVE</Text>
                          </View>
                        )}
                        {booking.status === 'Cancellation_Requested' && (
                          <View style={{ backgroundColor: 'rgba(217, 119, 6, 0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#D97706', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>UNDER REVIEW</Text>
                          </View>
                        )}
                        {booking.status === 'Completed' && (
                          <View style={{ backgroundColor: 'rgba(107, 114, 128, 0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#6B7280', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>COMPLETED</Text>
                          </View>
                        )}
                        {booking.status === 'Cancelled' && (
                          <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                            <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>CANCELLED</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Perforated / Stylized Dotted Divider */}
                    <View style={styles.dottedDividerRow}>
                      {Array.from({ length: 24 }).map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.dotSegment,
                            {
                              backgroundColor:
                                i % 2 === 0
                                  ? isDark
                                    ? 'rgba(255, 255, 255, 0.15)'
                                    : '#E2E8F0'
                                  : 'transparent',
                            },
                          ]}
                        />
                      ))}
                    </View>

                    {/* Date & Time Grid Row */}
                    <View style={styles.dateTimeRow}>
                      <View style={styles.dateCol}>
                        <MaterialIcons
                          name="calendar-today"
                          size={14}
                          color={isUpcoming ? AppColors.secondaryColor : colors.subtitle}
                        />
                        <Text
                          style={[styles.dateText, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {booking.date}
                        </Text>
                      </View>

                      <View style={styles.timeCol}>
                        <MaterialIcons name="access-time" size={14} color={colors.subtitle} />
                        <Text style={[styles.timeText, { color: colors.subtitle }]}>
                          {booking.time}
                        </Text>
                      </View>
                    </View>

                    {/* Footer Row: Price + "View Pass & OTP" Pill Button */}
                    <View style={styles.ticketFooterRow}>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceAmount}>
                          ₹{Math.round(booking.amountPaid)}
                        </Text>
                        <Text style={[styles.pricePaidLabel, { color: colors.subtitle }]}>
                          Paid
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.viewPassPill,
                          {
                            backgroundColor: isDark
                              ? '#262626'
                              : 'rgba(0, 56, 130, 0.08)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0, 56, 130, 0.2)',
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={isUpcoming ? 'qr-code-scanner' : 'receipt-long'}
                          size={14}
                          color={isDark ? '#93C5FD' : AppColors.primaryColor}
                        />
                        <Text
                          style={[
                            styles.viewPassPillText,
                            { color: isDark ? '#93C5FD' : AppColors.primaryColor },
                          ]}
                        >
                          {isUpcoming ? 'View Pass & OTP' : 'View Receipt'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}

            {/* Creative Inline "Explore More" Banner Card */}
            <LinearGradient
              colors={
                isDark
                  ? ['#1E293B', '#0F172A']
                  : ['#F1F5F9', '#E2E8F0']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.exploreBanner}
            >
              <View style={styles.exploreBannerTopRow}>
                <View style={styles.boltCircle}>
                  <MaterialIcons name="bolt" size={20} color={AppColors.secondaryColor} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.exploreBannerTitle, { color: colors.text }]}>
                    Book Your Next Workout
                  </Text>
                  <Text style={[styles.exploreBannerSub, { color: colors.subtitle }]}>
                    Single passes • Zero lock-in contracts
                  </Text>
                </View>
              </View>

              {/* Quick Action Chips Row */}
              <View style={styles.quickChipsRow}>
                {[
                  {
                    label: 'Gym',
                    icon: 'fitness-center',
                    color: isDark ? '#93C5FD' : AppColors.primaryColor,
                  },
                  {
                    label: 'Yoga',
                    icon: 'self-improvement',
                    color: isDark ? '#A78BFA' : '#8B5CF6',
                  },
                  {
                    label: 'Zumba',
                    icon: 'music-note',
                    color: isDark ? '#F472B6' : '#EC4899',
                  },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    onPress={() => bookNewSession(item.label)}
                    style={[
                      styles.quickChipBtn,
                      {
                        backgroundColor: isDark ? '#262626' : '#FFFFFF',
                        borderColor: colors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons
                      name={item.icon}
                      size={16}
                      color={item.color}
                      style={styles.quickChipIcon}
                    />
                    <Text style={[styles.quickChipText, { color: colors.text }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </LinearGradient>
          </ScrollView>
        </View>
      </View>
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
    paddingVertical: 10,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  activePassesSub: {
    color: AppColors.secondaryColor,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  bookCtaPillWrapper: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: AppColors.primaryColor,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  bookCtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  bookCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },

  /* Tabs */
  tabsOuterWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabPillText: {
    fontSize: 12.5,
  },

  /* Passes List */
  passesScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 120,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  emptyStateSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },

  /* Ticket Card */
  ticketCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 14,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIconCapsule: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gymLogoImg: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  ticketGymName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ticketSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  passIdTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  passIdText: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },

  /* Dotted Line Divider */
  dottedDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },
  dotSegment: {
    flex: 1,
    height: 1.2,
  },

  /* Date & Time */
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
  },
  dateText: {
    fontSize: 12.5,
    fontWeight: '600',
    marginLeft: 6,
  },
  timeCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    marginLeft: 6,
  },

  /* Footer */
  ticketFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: AppColors.secondaryColor,
  },
  pricePaidLabel: {
    fontSize: 11,
    marginLeft: 6,
  },
  viewPassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  viewPassPillText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },

  /* Explore Banner */
  exploreBanner: {
    borderRadius: 24,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  exploreBannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boltCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 191, 98, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreBannerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  exploreBannerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  quickChipBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipIcon: {
    marginRight: 6,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
