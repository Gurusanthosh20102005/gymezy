import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Switch,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/appTheme';
import { apiService } from '../../services/apiService';
import { CreateSectionModal, SECTION_CATEGORIES, calculateScheduleEndDate } from '../../widgets/CreateSectionModal';
import { SectionRosterModal } from '../../widgets/SectionRosterModal';

export const SectionsSubView = ({ topInset, onBack, gymId }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

  // Roster Modal State
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [rosterSection, setRosterSection] = useState(null);

  // Fetch sections
  const fetchSectionsList = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getSections({
        gymId,
        category: activeCategory !== 'all' ? activeCategory : undefined,
      });
      if (Array.isArray(data)) {
        setSections(data);
      }
    } catch (err) {
      console.warn('Failed to fetch sections:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [gymId, activeCategory]);

  useEffect(() => {
    fetchSectionsList();
  }, [fetchSectionsList]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSectionsList();
  };

  // Toggle active status
  const handleToggleStatus = async (sectionId, currentStatus) => {
    try {
      await apiService.toggleSectionStatus(sectionId, !currentStatus);
      setSections((prev) =>
        prev.map((s) => (s._id === sectionId ? { ...s, isActive: !currentStatus } : s))
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update section status.');
    }
  };

  // Delete section
  const handleDeleteSection = (sectionId, title) => {
    Alert.alert(
      'Delete Section',
      `Are you sure you want to remove section "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteSection(sectionId);
              setSections((prev) => prev.filter((s) => s._id !== sectionId));
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete section.');
            }
          },
        },
      ]
    );
  };

  // Dynamic Theme Colors
  const bgCol = isDark ? AppColors.darkBackground : AppColors.lightBackground;
  const cardBg = isDark ? AppColors.darkCard : '#FFFFFF';
  const borderCol = isDark ? AppColors.darkBorder : '#E2E8F0';
  const textCol = isDark ? '#FFFFFF' : '#0F172A';
  const subTextCol = isDark ? '#94A3B8' : '#64748B';

  return (
    <View style={[styles.container, { backgroundColor: bgCol }]}>
      {/* Top Header */}
      <View style={[styles.navHeader, { paddingTop: topInset + 8, borderBottomColor: borderCol }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={textCol} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.navTitle, { color: textCol }]}>Sections & Classes</Text>
          <Text style={[styles.navSubtitle, { color: subTextCol }]}>
            Create workout batches, assign trainers & schedules
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setEditingSection(null);
            setShowModal(true);
          }}
          style={styles.addIconBtn}
        >
          <MaterialIcons name="add" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Category Filter Pills */}
      <View style={styles.categoryBarWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          <TouchableOpacity
            onPress={() => setActiveCategory('all')}
            style={[
              styles.filterPill,
              {
                backgroundColor: activeCategory === 'all' ? '#003882' : cardBg,
                borderColor: activeCategory === 'all' ? '#003882' : borderCol,
              },
            ]}
          >
            <Text style={[styles.filterPillText, { color: activeCategory === 'all' ? '#FFFFFF' : textCol }]}>
              All ({sections.length})
            </Text>
          </TouchableOpacity>

          {SECTION_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setActiveCategory(cat.key)}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected ? '#003882' : cardBg,
                    borderColor: isSelected ? '#003882' : borderCol,
                  },
                ]}
              >
                <Text style={[styles.filterPillText, { color: isSelected ? '#FFFFFF' : textCol }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Sections List */}
      <ScrollView
        contentContainerStyle={[styles.scrollList, { paddingBottom: 170 + Math.max(insets.bottom, 24) }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[AppColors.primaryColor]}
            tintColor={AppColors.primaryColor}
          />
        }
      >
        {isLoading && !isRefreshing ? (
          <ActivityIndicator size="large" color="#003882" style={{ marginTop: 40 }} />
        ) : sections.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <MaterialIcons name="event-busy" size={44} color={subTextCol} />
            <Text style={[styles.emptyTitle, { color: textCol }]}>No Sections Found</Text>
            <Text style={[styles.emptySub, { color: subTextCol }]}>
              Create your first workout section to assign trainers and schedule timings.
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditingSection(null);
                setShowModal(true);
              }}
              style={styles.emptyAddBtn}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddText}>Create Section</Text>
            </TouchableOpacity>
          </View>
        ) : (
          sections.map((section) => {
            const trainerName =
              typeof section.trainerId === 'object' ? section.trainerId?.name : 'Assigned Trainer';
            const trainerSpecialty =
              typeof section.trainerId === 'object'
                ? section.trainerId?.specialization || section.trainerId?.role || 'Trainer'
                : 'Trainer';
            const catObj = SECTION_CATEGORIES.find((c) => c.key === section.category);
            const catColor = catObj ? catObj.color : '#003882';

            const formatDDMMYYYY = (dateVal) => {
              if (!dateVal) return '—';
              const d = new Date(dateVal);
              if (Number.isNaN(d.getTime())) return '—';
              return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
            };

            const formattedStartDate = formatDDMMYYYY(section.startDate);
            let formattedEndDate = '—';
            if (section.endDate) {
              formattedEndDate = formatDDMMYYYY(section.endDate);
            } else if (section.startDate && section.durationDays) {
              const end = calculateScheduleEndDate(section.startDate, section.durationDays, section.activeDays);
              if (end) formattedEndDate = formatDDMMYYYY(end);
            }

            return (
              <View
                key={section._id}
                style={[
                  styles.sectionCard,
                  {
                    backgroundColor: cardBg,
                    borderColor: borderCol,
                  },
                ]}
              >
                {/* Card Top: Title, Category Badge, Switch */}
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <View style={styles.categoryBadgeRow}>
                      <View style={[styles.catBadge, { backgroundColor: `${catColor}20` }]}>
                        <Text style={[styles.catBadgeText, { color: catColor }]}>
                          {(section.category || 'Class').toUpperCase()}
                        </Text>
                      </View>
                      <View style={[styles.durationBadge, { backgroundColor: 'rgba(0, 56, 130, 0.1)' }]}>
                        <Text style={styles.durationBadgeText}>{section.durationDays || 20} Days</Text>
                      </View>
                    </View>
                    <Text style={[styles.sectionTitle, { color: textCol }]} numberOfLines={2}>
                      {section.title}
                    </Text>
                  </View>

                  <View style={styles.switchWrap}>
                    <Switch
                      value={section.isActive}
                      onValueChange={() => handleToggleStatus(section._id, section.isActive)}
                      trackColor={{ false: '#64748B', true: '#003882' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                </View>

                {/* Trainer Row */}
                <View style={[styles.trainerBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: borderCol }]}>
                  <View style={styles.trainerAvatarCircle}>
                    <Text style={styles.trainerInitial}>
                      {(trainerName || 'T').substring(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.trainerNameText, { color: textCol }]}>{trainerName}</Text>
                    <Text style={[styles.trainerSubText, { color: subTextCol }]}>{trainerSpecialty}</Text>
                  </View>
                  <View style={styles.costBadge}>
                    <Text style={styles.costText}>₹{Number(section.cost || 0).toLocaleString('en-IN')}</Text>
                  </View>
                </View>

                {/* Details Grid: Timing, Days, Capacity */}
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <MaterialIcons name="schedule" size={15} color="#D97706" style={{ marginRight: 4 }} />
                    <Text style={[styles.detailText, { color: textCol }]}>
                      {section.startTime || '06:00 AM'} - {section.endTime || '07:00 AM'}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <MaterialIcons name="calendar-today" size={15} color="#003882" style={{ marginRight: 4 }} />
                    <Text style={[styles.detailText, { color: textCol }]}>
                      {formattedStartDate} → {formattedEndDate}
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <MaterialIcons name="people" size={15} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={[styles.detailText, { color: textCol }]}>
                      {section.enrolledCount || 0} / {section.maxCapacity || 25} Enrolled
                    </Text>
                  </View>

                  <View style={styles.detailItem}>
                    <MaterialIcons name="repeat" size={15} color="#7C3AED" style={{ marginRight: 4 }} />
                    <Text style={[styles.detailText, { color: textCol }]}>
                      {Array.isArray(section.activeDays) && section.activeDays.length === 7
                        ? 'Daily (7 Days)'
                        : Array.isArray(section.activeDays)
                        ? section.activeDays.join(', ')
                        : 'Custom'}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={[styles.cardFooter, { borderTopColor: borderCol }]}>
                  <TouchableOpacity
                    onPress={() => {
                      setRosterSection(section);
                      setShowRosterModal(true);
                    }}
                    style={styles.actionBtn}
                  >
                    <MaterialIcons name="people-outline" size={16} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={[styles.actionBtnText, { color: '#059669' }]}>
                      Roster ({section.enrolledCount || 0})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setEditingSection(section);
                      setShowModal(true);
                    }}
                    style={styles.actionBtn}
                  >
                    <MaterialIcons name="edit" size={16} color="#003882" style={{ marginRight: 4 }} />
                    <Text style={[styles.actionBtnText, { color: '#003882' }]}>Edit</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteSection(section._id, section.title)}
                    style={styles.actionBtn}
                  >
                    <MaterialIcons name="delete-outline" size={16} color="#EF4444" style={{ marginRight: 4 }} />
                    <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create / Edit Section Modal */}
      <CreateSectionModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          fetchSectionsList();
        }}
        gymId={gymId}
        initialSection={editingSection}
      />

      {/* Enrolled Members Roster Modal */}
      <SectionRosterModal
        visible={showRosterModal}
        onClose={() => setShowRosterModal(false)}
        section={rosterSection}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  navSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#003882',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBarWrap: {
    paddingVertical: 10,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003882',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  emptyAddText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  sectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  durationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#003882',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  switchWrap: {
    paddingTop: 2,
  },
  trainerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 12,
  },
  trainerAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#003882',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  trainerNameText: {
    fontSize: 13,
    fontWeight: '700',
  },
  trainerSubText: {
    fontSize: 11,
    marginTop: 1,
  },
  costBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  costText: {
    color: '#16A34A',
    fontWeight: '800',
    fontSize: 14,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
  },
  detailText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default SectionsSubView;
