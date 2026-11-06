import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useBookingRepository } from '../data/BookingContext';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { membershipService } from '../services/membershipService';
import { calculateMembershipProgress } from '../utils/dateUtils';

const TABS = ['Active', 'Completed', 'Cancelled'];

export const MyMembershipsScreen = ({ navigation }) => {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { memberships, setAllMemberships } = useBookingRepository();
  const { showToast } = useToast();
  const authContext = useAuth();
  const user = authContext?.user || null;

  const [selectedTab, setSelectedTab] = useState('Active');
  const [isFetching, setIsFetching] = useState(false);

  const loadMemberships = useCallback(async () => {
    try {
      setIsFetching(true);
      const serverList = await membershipService.fetchMyMemberships(user?.id || user?._id);
      if (Array.isArray(serverList)) {
        const mapped = serverList.map((m, idx) => {
          const startDateStr = m.startDate
            ? new Date(m.startDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : '';
          const endDateStr = m.endDate
            ? new Date(m.endDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
            : '';
          const resolvedGymLogo =
            m.gymLogo
            || (typeof m.gymId?.logo === 'string' && m.gymId.logo.trim())
            || m.gymId?.logo?.fileData
            || m.gymId?.logoUrl
            || m.gymId?.coverPhoto?.fileData
            || m.gymId?.coverPhotoUrl
            || m.gymId?.image
            || m.gymId?.images?.[0]
            || m.gymId?.imageUrl
            || m.gymImageUrl
            || null;

          let uniqueDocId = `mem_${idx}`;
          if (m._id) {
            uniqueDocId = String(m._id);
          } else if (m.id && m.id !== m.membershipId) {
            uniqueDocId = String(m.id);
          } else if (m.membershipId) {
            uniqueDocId = `${m.membershipId}_${idx}`;
          }

          return {
            id: uniqueDocId,
            membershipId: m.membershipId || uniqueDocId,
            _id: m._id || uniqueDocId,
            customerId: m.userId?.fullName || user?.fullName || user?.email || 'Member',
            gymName: m.gymId?.name || 'Gym Membership',
            gymLocation:
              typeof m.gymId?.location === 'string'
                ? m.gymId.location
                : (m.gymId?.address || m.gymId?.city || m.gymId?.area || ''),
            gymImageUrl: resolvedGymLogo,
            planName: `${m.membershipTier} Membership`,
            membershipTier: m.membershipTier,
            durationDays: m.durationDays,
            amountPaid: m.pricing?.totalAmount || 0,
            startDate: startDateStr,
            endDate: endDateStr,
            rawStartDate: m.startDate,
            rawEndDate: m.endDate,
            paymentMode: m.payment?.method || 'UPI',
            status: m.status,
            otp: m.entryOtp || null,
            entryOtp: m.entryOtp || null,
            gymDbId: m.gymId?._id || m.gymId,
            hasPersonalTrainer: Boolean(m.trainerId),
            trainerName: m.trainerId?.name || null,
            trainerSchedule: m.trainerSlot || null,
            trainerFee: m.pricing?.trainerFee || 0,
            planDescription: m.planDescription || m.description || null,
            gym: m.gymId,
          };
        });
        setAllMemberships(mapped);
      }
    } catch (err) {
      console.warn('Could not fetch server memberships:', err.message);
    } finally {
      setIsFetching(false);
    }
  }, [user?.id, user?._id, setAllMemberships]);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadMemberships();
    });
    return unsubscribe;
  }, [navigation, loadMemberships]);

  const filteredMemberships = memberships.filter((m) => {
    if (selectedTab === 'Active') {
      return m.status === 'Active' || m.status === 'Upcoming' || m.status === 'Expiring Soon';
    } else if (selectedTab === 'Completed') {
      return m.status === 'Completed' || m.status === 'Expired' || m.status === 'Switched';
    } else {
      return m.status === 'Cancelled';
    }
  });

  const activeCount = memberships.filter(
    (m) => m.status === 'Active' || m.status === 'Upcoming' || m.status === 'Expiring Soon'
  ).length;
  const completedCount = memberships.filter(
    (m) => m.status === 'Completed' || m.status === 'Expired' || m.status === 'Switched'
  ).length;
  const cancelledCount = memberships.filter((m) => m.status === 'Cancelled').length;

  const openUpgradeFlow = () => {
    navigation.navigate('HomeTabs');
  };

  const primaryNavy = isDark ? '#93C5FD' : AppColors.primaryColor;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top App Bar */}
      <View style={styles.appBar}>
        <Text style={[styles.appBarTitle, { color: colors.text }]}>My Memberships</Text>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: isDark ? '#1E1E1E' : '#F8FAFC', borderColor: colors.border }]}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Wallet')}
        >
          <Ionicons name="wallet-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 110 + (insets.bottom > 0 ? insets.bottom + 10 : 20) },
        ]}
      >
        {/* 1. Upgrade Promo Banner */}
        {/* <LinearGradient
          colors={['#1E1B4B', '#312E81', '#4338CA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.promoBanner}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.promoTitle}>Upgrade Membership</Text>
            <Text style={styles.promoDesc}>Unlock more benefits and achieve your goals</Text>

            <TouchableOpacity
              onPress={openUpgradeFlow}
              style={styles.promoBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.promoBtnText}>View Plans</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.promoIconBadge}>
            <MaterialIcons name="workspace-premium" size={36} color="#FBBF24" />
          </View>
        </LinearGradient> */}

        {/* 2. Filter Tabs */}
        <View style={styles.tabsWrapper}>
          <View
            style={[
              styles.tabsContainer,
              {
                backgroundColor: isDark ? '#1E1E1E' : '#F1F5F9',
                borderColor: colors.border,
              },
            ]}
          >
            {TABS.map((tab) => {
              const isSelected = selectedTab === tab;
              const count =
                tab === 'Active'
                  ? activeCount
                  : tab === 'Completed'
                    ? completedCount
                    : cancelledCount;

              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setSelectedTab(tab)}
                  style={[
                    styles.tabItem,
                    {
                      backgroundColor: isSelected
                        ? isDark
                          ? '#262626'
                          : '#FFFFFF'
                        : 'transparent',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.tabText,
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

        {/* 3. Memberships List */}
        {isFetching && filteredMemberships.length === 0 ? (
          <View style={[styles.emptyContainer, { paddingVertical: 40 }]}>
            <ActivityIndicator size="large" color={primaryNavy} />
            <Text style={[styles.emptySub, { color: colors.subtitle, marginTop: 12 }]}>
              Loading memberships...
            </Text>
          </View>
        ) : filteredMemberships.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="card-membership" size={54} color={colors.subtitle} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No {selectedTab} Memberships
            </Text>
            <Text style={[styles.emptySub, { color: colors.subtitle }]}>
              Your long-term membership passes will appear here.
            </Text>
          </View>
        ) : (
          filteredMemberships.map((mbr, idx) => {
            const isActive = mbr.status === 'Active';
            const { daysRemaining, progressPercent } = calculateMembershipProgress(mbr);
            const cardKey = mbr._id ? String(mbr._id) : `${mbr.id || 'mem'}_${idx}`;
            return (
              <TouchableOpacity
                key={cardKey}
                onPress={() => navigation.navigate('MembershipDetails', { membership: mbr })}
                activeOpacity={0.88}
                style={[
                  styles.membershipCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                  {mbr.gymImageUrl ? (
                    <Image
                      source={{ uri: mbr.gymImageUrl }}
                      style={styles.gymAvatar}
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      style={[
                        styles.gymAvatar,
                        {
                          backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                          justifyContent: 'center',
                          alignItems: 'center',
                        },
                      ]}
                    >
                      <MaterialIcons name="fitness-center" size={24} color={primaryNavy} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.cardGymName, { color: colors.text }]} numberOfLines={1}>
                      {mbr.gymName}
                    </Text>

                    <View style={styles.cardBadgesRow}>
                      <View
                        style={[
                          styles.planTag,
                          {
                            backgroundColor: isDark
                              ? 'rgba(30, 58, 138, 0.6)'
                              : AppColors.primaryColor,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.planTagText,
                            { color: isDark ? '#93C5FD' : '#FFFFFF' },
                          ]}
                        >
                          {mbr.planName}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusTag,
                          {
                            backgroundColor: isActive
                              ? '#E6F7EF'
                              : isDark
                                ? '#262626'
                                : '#F1F5F9',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusTagText,
                            {
                              color: isActive
                                ? '#16A34A'
                                : mbr.status === 'REJECTED_BY_GYM'
                                ? '#EF4444'
                                : colors.subtitle,
                            },
                          ]}
                        >
                          {mbr.status === 'REJECTED_BY_GYM'
                            ? 'Rejected By Gym'
                            : String(mbr.status || '').replace(/_/g, ' ')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Membership ID Row (Static info display) */}
                <View style={styles.idRow}>
                  <Text style={[styles.idLabel, { color: colors.subtitle }]}>Membership ID</Text>
                  <Text style={[styles.idVal, { color: primaryNavy }]}>{mbr.membershipId || mbr.id}</Text>
                </View>

                {/* Validity Dual Box */}
                <View
                  style={[
                    styles.validityBox,
                    {
                      backgroundColor: isDark ? '#262626' : '#F8FAFC',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.valCol}>
                    <Text style={[styles.valLabel, { color: colors.subtitle }]}>VALID FROM</Text>
                    <Text style={[styles.valDate, { color: colors.text }]}>{mbr.startDate}</Text>
                  </View>

                  <View style={[styles.valDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.valCol}>
                    <Text style={[styles.valLabel, { color: colors.subtitle }]}>EXPIRES ON</Text>
                    <Text style={[styles.valDate, { color: colors.text }]}>{mbr.endDate}</Text>
                  </View>
                </View>

                {/* Progress Bar (if Active) */}
                {isActive && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabelRow}>
                      <Text style={[styles.progressLabel, { color: colors.subtitle }]}>
                        Days Remaining
                      </Text>
                      <Text style={styles.progressVal}>{daysRemaining}</Text>
                    </View>
                    <View
                      style={[
                        styles.progressTrack,
                        { backgroundColor: isDark ? '#334155' : '#E2E8F0' },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: AppColors.secondaryColor,
                            width: progressPercent,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}

                {/* Footer / CTA Row */}
                <View style={styles.cardFooterRow}>
                  <View>
                    <Text style={[styles.paidLabel, { color: colors.subtitle }]}>Amount Paid</Text>
                    <Text style={[styles.paidAmount, { color: colors.text }]}>
                      ₹{Math.round(mbr.amountPaid)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => navigation.navigate('MembershipDetails', { membership: mbr })}
                    style={[
                      styles.viewPassBtn,
                      { backgroundColor: AppColors.primaryColor },
                    ]}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="qr-code" size={16} color="#FFFFFF" />
                    <Text style={styles.viewPassBtnText}>View Pass & Details</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  notifBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifRedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },

  /* Upgrade Promo Banner */
  promoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#312E81',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  promoSub: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  promoDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 3,
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 12,
  },
  promoBtnText: {
    color: '#1E1B4B',
    fontSize: 12,
    fontWeight: '800',
  },
  promoIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  /* Filter Tabs */
  tabsWrapper: {
    marginTop: 18,
    marginBottom: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabText: {
    fontSize: 13,
  },

  /* Empty State */
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },

  /* Membership Card */
  membershipCard: {
    borderRadius: 22,
    borderWidth: 1.2,
    padding: 16,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gymAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  cardGymName: {
    fontSize: 16,
    fontWeight: '900',
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  planTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  planTagText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginLeft: 6,
  },
  statusTagText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  idRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 0.6,
    borderTopColor: '#E2E8F0',
  },
  idLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idVal: {
    fontSize: 12,
    fontWeight: '800',
  },
  validityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 10,
  },
  valCol: {
    flex: 1,
  },
  valLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  valDate: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 2,
  },
  valDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 12,
  },
  progressSection: {
    marginTop: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressVal: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.secondaryColor,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.6,
    borderTopColor: '#E2E8F0',
  },
  paidLabel: {
    fontSize: 10.5,
  },
  paidAmount: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 1,
  },
  viewPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  viewPassBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    marginHorizontal: 6,
  },
});
