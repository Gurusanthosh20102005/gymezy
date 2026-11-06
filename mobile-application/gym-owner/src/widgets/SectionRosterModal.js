import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { apiService } from '../services/apiService';

export const SectionRosterModal = ({ visible, onClose, section }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [enrollments, setEnrollments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchRoster = useCallback(async () => {
    if (!section?._id) return;
    setIsLoading(true);
    try {
      const data = await apiService.getSectionEnrollments(section._id);
      if (data) {
        setEnrollments(data.enrollments || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.warn('[ROSTER MODAL] Failed to fetch section enrollments:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [section?._id]);

  useEffect(() => {
    if (visible && section?._id) {
      fetchRoster();
    } else {
      setEnrollments([]);
      setSummary(null);
    }
  }, [visible, section?._id, fetchRoster]);

  if (!visible) return null;

  const bg = isDark ? '#0F172A' : '#FFFFFF';
  const cardBg = isDark ? '#1E293B' : '#F8FAFC';
  const textCol = isDark ? '#F8FAFC' : '#0F172A';
  const subCol = isDark ? '#94A3B8' : '#64748B';
  const borderCol = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0';

  const maxCap = summary?.maxCapacity || section?.maxCapacity || 25;
  const enrolledCnt = summary?.enrolledCount || section?.enrolledCount || enrollments.length;
  const availSlots = summary?.availableSlots ?? Math.max(0, maxCap - enrolledCnt);
  const activeCnt = summary?.activeCount || enrollments.filter((b) => b.status === 'Upcoming' || b.status === 'Active').length;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: bg,
              paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : (Platform.OS === 'ios' ? 34 : 24),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: borderCol }]}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <View style={styles.badgeRow}>
                <View style={[styles.categoryBadge, { backgroundColor: 'rgba(0, 56, 130, 0.12)' }]}>
                  <Text style={styles.categoryBadgeText}>{(section?.category || 'BATCH').toUpperCase()}</Text>
                </View>
                <Text style={[styles.headerSubtitle, { color: subCol }]}>
                  {section?.durationDays || 20} Days • {section?.startTime} - {section?.endTime}
                </Text>
              </View>
              <Text style={[styles.headerTitle, { color: textCol }]} numberOfLines={1}>
                {section?.title || 'Section Roster'}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <MaterialIcons name="close" size={22} color={subCol} />
            </TouchableOpacity>
          </View>

          {/* Quick Stats Summary Bar */}
          <View style={styles.statsBar}>
            <View style={[styles.statBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.statLabel, { color: subCol }]}>Total Enrolled</Text>
              <Text style={[styles.statValue, { color: '#003882' }]}>
                {enrolledCnt} / {maxCap}
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.statLabel, { color: subCol }]}>Available Slots</Text>
              <Text style={[styles.statValue, { color: '#00BF62' }]}>
                {availSlots}
              </Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: cardBg, borderColor: borderCol }]}>
              <Text style={[styles.statLabel, { color: subCol }]}>Active</Text>
              <Text style={[styles.statValue, { color: '#6366F1' }]}>
                {activeCnt}
              </Text>
            </View>
          </View>

          {/* Members List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#003882" />
              <Text style={[styles.loadingText, { color: subCol }]}>Loading enrolled members...</Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {enrollments.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialIcons name="people-outline" size={48} color={subCol} style={{ opacity: 0.5 }} />
                  <Text style={[styles.emptyTitle, { color: textCol }]}>No Enrolled Members</Text>
                  <Text style={[styles.emptySubtitle, { color: subCol }]}>
                    Members who book this batch from the user app will appear here.
                  </Text>
                </View>
              ) : (
                enrollments.map((item, idx) => {
                  const user = item.userId;
                  const name = user?.fullName || user?.name || 'Member';
                  const phone = user?.phone || user?.email || item.customerId || '—';
                  const bookingId = item.bookingId || item.id || `BK${idx + 100}`;
                  const enrolledDate = item.createdAt
                    ? new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                    : '—';

                  const isCancelled = item.status === 'Cancelled';
                  const statusBg = isCancelled
                    ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.12)')
                    : (isDark ? 'rgba(0, 191, 98, 0.2)' : 'rgba(0, 191, 98, 0.12)');
                  const statusCol = isCancelled ? '#EF4444' : '#00BF62';

                  return (
                    <View
                      key={item._id || bookingId}
                      style={[styles.memberRow, { backgroundColor: cardBg, borderColor: borderCol }]}
                    >
                      {/* Avatar */}
                      {user?.avatar || user?.profilePicture ? (
                        <Image source={{ uri: user.avatar || user.profilePicture }} style={styles.avatarImg} />
                      ) : (
                        <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                          <Text style={[styles.avatarInitial, { color: textCol }]}>
                            {name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      {/* Info */}
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.memberName, { color: textCol }]} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={[styles.memberPhone, { color: subCol }]}>{phone}</Text>
                        <Text style={[styles.bookingMeta, { color: subCol }]}>
                          {bookingId} • Enrolled {enrolledDate}
                        </Text>
                      </View>

                      {/* Status Badge */}
                      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.statusText, { color: statusCol }]}>
                          {item.status || 'Upcoming'}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    minHeight: '55%',
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#003882',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
  },
  statsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 8,
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  memberName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  memberPhone: {
    fontSize: 12,
    marginTop: 2,
  },
  bookingMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default SectionRosterModal;
