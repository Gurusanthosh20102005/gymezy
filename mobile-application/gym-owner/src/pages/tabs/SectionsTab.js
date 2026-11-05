import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TextInput,
  Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors } from '../../theme/appTheme';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import {
  CreateSectionModal,
  SECTION_CATEGORIES,
  calculateScheduleEndDate,
} from '../../widgets/CreateSectionModal';
import { SectionRosterModal } from '../../widgets/SectionRosterModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SectionsTab = ({ topInset, navigation }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { gym, user } = useAuth();

  const targetGymId = gym?._id || gym?.id || user?.gymId;

  // Data States
  const [sections, setSections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter & Search States
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

  // Roster Modal State
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedSectionRoster, setSelectedSectionRoster] = useState(null);

  // Fetch sections
  const fetchSectionsList = useCallback(async () => {
    try {
      const data = await apiService.getSections({
        gymId: targetGymId,
        category: activeCategory !== 'all' ? activeCategory : undefined,
      });
      if (Array.isArray(data)) {
        setSections(data);
      } else {
        setSections([]);
      }
    } catch (err) {
      console.warn('Failed to fetch sections:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [targetGymId, activeCategory]);

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
      `Are you sure you want to delete section "${title}"? This cannot be undone.`,
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

  // Filtered Sections
  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      // Category filter
      if (activeCategory !== 'all' && sec.category !== activeCategory) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (sec.title || '').toLowerCase().includes(query);
        const catMatch = (sec.category || '').toLowerCase().includes(query);
        const trainerMatch =
          typeof sec.trainerId === 'object' && sec.trainerId?.name
            ? sec.trainerId.name.toLowerCase().includes(query)
            : false;
        const daysMatch = Array.isArray(sec.activeDays)
          ? sec.activeDays.some((d) => d.toLowerCase().includes(query))
          : false;

        return titleMatch || catMatch || trainerMatch || daysMatch;
      }
      return true;
    });
  }, [sections, activeCategory, searchQuery]);

  // Dynamic Dashboard Stats (matching Web App)
  const totalSectionsCount = sections.length;
  const activeSectionsCount = sections.filter((s) => s.isActive !== false).length;
  const totalCapacityCount = sections.reduce((acc, s) => acc + (Number(s.maxCapacity) || 0), 0);
  const totalEnrolledCount = sections.reduce(
    (acc, s) => acc + (Number(s.enrolledCount) || (Array.isArray(s.enrolledUsers) ? s.enrolledUsers.length : 0)),
    0
  );

  // Dynamic Theme Colors
  const bgCol = isDark ? AppColors.darkBackground : AppColors.lightBackground;
  const cardBg = isDark ? AppColors.darkCard : '#FFFFFF';
  const borderCol = isDark ? AppColors.darkBorder : '#E2E8F0';
  const textCol = isDark ? '#FFFFFF' : '#0F172A';
  const subTextCol = isDark ? 'rgba(255,255,255,0.6)' : '#64748B';

  return (
    <View style={[styles.container, { backgroundColor: bgCol }]}>
      {/* Top Header */}
      <View style={[styles.topHeader, { paddingTop: topInset + 10 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: textCol }]}>Sections & Batches</Text>
          <Text style={[styles.headerSubtitle, { color: subTextCol }]}>
            {totalSectionsCount} Batches • Group classes & trainer schedules
          </Text>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => {
            setEditingSection(null);
            setShowCreateModal(true);
          }}
          activeOpacity={0.85}
        >
          <MaterialIcons name="add" size={19} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 170 + Math.max(insets.bottom, 24) },
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
        {/* Dynamic Metric Cards Row (SSOT from Web SectionsManagement.jsx) */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={[styles.metricIconBox, { backgroundColor: 'rgba(0, 56, 130, 0.12)' }]}>
              <MaterialIcons name="layers" size={18} color="#003882" />
            </View>
            <Text style={[styles.metricVal, { color: textCol }]}>{totalSectionsCount}</Text>
            <Text style={[styles.metricLabel, { color: subTextCol }]}>Total Batches</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={[styles.metricIconBox, { backgroundColor: 'rgba(0, 191, 98, 0.12)' }]}>
              <MaterialIcons name="check-circle" size={18} color={AppColors.secondaryColor} />
            </View>
            <Text style={[styles.metricVal, { color: textCol }]}>{activeSectionsCount}</Text>
            <Text style={[styles.metricLabel, { color: subTextCol }]}>Active Batches</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={[styles.metricIconBox, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }]}>
              <MaterialIcons name="groups" size={18} color="#7C3AED" />
            </View>
            <Text style={[styles.metricVal, { color: textCol }]}>{totalCapacityCount}</Text>
            <Text style={[styles.metricLabel, { color: subTextCol }]}>Total Capacity</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <View style={[styles.metricIconBox, { backgroundColor: 'rgba(234, 88, 12, 0.12)' }]}>
              <MaterialIcons name="how-to-reg" size={18} color="#EA580C" />
            </View>
            <Text style={[styles.metricVal, { color: textCol }]}>{totalEnrolledCount}</Text>
            <Text style={[styles.metricLabel, { color: subTextCol }]}>Total Enrolled</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: cardBg,
              borderColor: borderCol,
            },
          ]}
        >
          <MaterialIcons name="search" size={20} color={subTextCol} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: textCol }]}
            placeholder="Search by title, trainer or day..."
            placeholderTextColor={subTextCol}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={18} color={subTextCol} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Filter Pills */}
        <View style={styles.categoryScrollWrap}>
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
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, { color: activeCategory === 'all' ? '#FFFFFF' : textCol }]}>
                All ({sections.length})
              </Text>
            </TouchableOpacity>

            {SECTION_CATEGORIES.map((cat) => {
              const isSelected = activeCategory === cat.key;
              const countInCat = sections.filter((s) => s.category === cat.key).length;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isSelected ? cat.color : cardBg,
                      borderColor: isSelected ? cat.color : borderCol,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, { color: isSelected ? '#FFFFFF' : textCol }]}>
                    {cat.label} {countInCat > 0 ? `(${countInCat})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Content Section List */}
        {isLoading && !isRefreshing ? (
          <ActivityIndicator size="large" color="#003882" style={{ marginTop: 40 }} />
        ) : filteredSections.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: cardBg, borderColor: borderCol }]}>
            <MaterialIcons name="event-busy" size={46} color={subTextCol} />
            <Text style={[styles.emptyTitle, { color: textCol }]}>No Sections Found</Text>
            <Text style={[styles.emptySub, { color: subTextCol }]}>
              {searchQuery
                ? `No sections matching "${searchQuery}". Try a different filter.`
                : 'Create your first workout batch to assign trainers and schedule timings.'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setEditingSection(null);
                setShowCreateModal(true);
              }}
              style={styles.emptyAddBtn}
              activeOpacity={0.85}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyAddText}>Create Section</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredSections.map((section) => {
            const trainerName =
              typeof section.trainerId === 'object' ? section.trainerId?.name : 'Assigned Trainer';
            const trainerRole =
              typeof section.trainerId === 'object'
                ? section.trainerId?.role || section.trainerId?.specialization || 'Trainer'
                : 'Trainer';
            const catObj = SECTION_CATEGORIES.find((c) => c.key === section.category);
            const catColor = catObj ? catObj.color : '#003882';

            const enrolledCount =
              section.enrolledCount || (Array.isArray(section.enrolledUsers) ? section.enrolledUsers.length : 0);
            const maxCap = section.maxCapacity || 25;
            const fillRatio = Math.min(1, enrolledCount / (maxCap || 1));
            const availableSeats = Math.max(0, maxCap - enrolledCount);

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
                {/* Top Row: Category Pill, Cost, Status Switch */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardHeaderLeft}>
                    <View style={[styles.catBadge, { backgroundColor: `${catColor}15` }]}>
                      <Text style={[styles.catBadgeText, { color: catColor }]}>
                        {(section.category || 'Batch').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.costBadge}>
                      <Text style={styles.costText}>₹{Number(section.cost || 0).toLocaleString('en-IN')}</Text>
                    </View>
                  </View>

                  <View style={styles.cardHeaderRight}>
                    <Text
                      style={[
                        styles.statusLabel,
                        { color: section.isActive !== false ? AppColors.secondaryColor : '#94A3B8' },
                      ]}
                    >
                      {section.isActive !== false ? 'Active' : 'Paused'}
                    </Text>
                    <Switch
                      value={section.isActive !== false}
                      onValueChange={() => handleToggleStatus(section._id, section.isActive !== false)}
                      trackColor={{ false: '#94A3B8', true: 'rgba(0, 191, 98, 0.4)' }}
                      thumbColor={section.isActive !== false ? AppColors.secondaryColor : '#E2E8F0'}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                  </View>
                </View>

                {/* Section Title */}
                <Text style={[styles.sectionTitle, { color: textCol }]}>{section.title}</Text>

                {/* Trainer Info Row */}
                <View style={[styles.trainerBox, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}>
                  <View style={styles.trainerAvatarCircle}>
                    <Text style={styles.trainerAvatarText}>
                      {(trainerName || 'T')
                        .split(' ')
                        .map((w) => w[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.trainerName, { color: textCol }]} numberOfLines={1}>
                      {trainerName}
                    </Text>
                    <Text style={[styles.trainerRole, { color: subTextCol }]} numberOfLines={1}>
                      {trainerRole}
                    </Text>
                  </View>
                </View>

                {/* Schedule Details Row */}
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleItem}>
                    <MaterialIcons name="calendar-today" size={14} color="#003882" />
                    <Text style={[styles.scheduleText, { color: subTextCol }]}>
                      {formattedStartDate} → {formattedEndDate}
                    </Text>
                  </View>

                  <View style={styles.scheduleItem}>
                    <MaterialIcons name="access-time" size={14} color="#003882" />
                    <Text style={[styles.scheduleText, { color: subTextCol }]}>
                      {section.startTime || '06:00 AM'} - {section.endTime || '07:00 AM'}
                    </Text>
                  </View>
                </View>

                {/* Days of Week Pills */}
                {Array.isArray(section.activeDays) && section.activeDays.length > 0 && (
                  <View style={styles.daysRow}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                      const isDayActive = section.activeDays.includes(day);
                      return (
                        <View
                          key={day}
                          style={[
                            styles.dayPill,
                            {
                              backgroundColor: isDayActive ? '#003882' : isDark ? '#1E293B' : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayPillText,
                              { color: isDayActive ? '#FFFFFF' : isDark ? '#64748B' : '#94A3B8' },
                            ]}
                          >
                            {day}
                          </Text>
                        </View>
                      );
                    })}
                    <Text style={[styles.sessionsBadge, { color: subTextCol }]}>
                      {section.durationDays || 20} Sessions
                    </Text>
                  </View>
                )}

                {/* Capacity Progress Bar */}
                <View style={styles.capacitySection}>
                  <View style={styles.capacityHeader}>
                    <Text style={[styles.capacityText, { color: textCol }]}>
                      <Text style={{ fontWeight: '800' }}>{enrolledCount}</Text> / {maxCap} Enrolled
                    </Text>
                    <Text
                      style={[
                        styles.seatsLeftText,
                        { color: availableSeats <= 3 ? AppColors.dangerRed : AppColors.secondaryColor },
                      ]}
                    >
                      {availableSeats > 0 ? `${availableSeats} Seats Left` : 'Batch Full'}
                    </Text>
                  </View>
                  <View style={[styles.progressBarTrack, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.round(fillRatio * 100)}%`,
                          backgroundColor:
                            availableSeats === 0
                              ? AppColors.dangerRed
                              : fillRatio > 0.8
                                ? AppColors.warningAmber
                                : AppColors.secondaryColor,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Inclusions Tags */}
                {Array.isArray(section.inclusions) && section.inclusions.length > 0 && (
                  <View style={styles.inclusionsRow}>
                    {section.inclusions.slice(0, 3).map((inc, i) => (
                      <View key={i} style={[styles.inclusionPill, { backgroundColor: isDark ? '#1E293B' : '#F1F5F9' }]}>
                        <MaterialIcons name="check" size={12} color={AppColors.secondaryColor} />
                        <Text style={[styles.inclusionText, { color: subTextCol }]} numberOfLines={1}>
                          {inc}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Action Buttons Row */}
                <View style={[styles.actionsRow, { borderTopColor: borderCol }]}>
                  <TouchableOpacity
                    style={[styles.rosterBtn, { backgroundColor: isDark ? 'rgba(0, 56, 130, 0.2)' : '#EFF6FF' }]}
                    onPress={() => {
                      setSelectedSectionRoster(section);
                      setShowRosterModal(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="people-outline" size={16} color="#003882" />
                    <Text style={styles.rosterBtnText}>Enrolled ({enrolledCount})</Text>
                  </TouchableOpacity>

                  <View style={styles.iconActionsWrap}>
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
                      onPress={() => {
                        setEditingSection(section);
                        setShowCreateModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="edit" size={16} color="#003882" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC' }]}
                      onPress={() => handleDeleteSection(section._id, section.title)}
                      activeOpacity={0.7}
                    >
                      <MaterialIcons name="delete-outline" size={16} color={AppColors.dangerRed} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Create / Edit Section Modal */}
      <CreateSectionModal
        visible={showCreateModal}
        gymId={targetGymId}
        initialSection={editingSection}
        onClose={() => {
          setShowCreateModal(false);
          setEditingSection(null);
        }}
        onSuccess={() => {
          fetchSectionsList();
        }}
      />

      {/* Section Roster Modal */}
      <SectionRosterModal
        visible={showRosterModal}
        section={selectedSectionRoster}
        onClose={() => {
          setShowRosterModal(false);
          setSelectedSectionRoster(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003882',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#003882',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollContent: {
    paddingHorizontal: 18,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  categoryScrollWrap: {
    marginBottom: 16,
  },
  categoryScroll: {
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 20,
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
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003882',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  costBadge: {
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  costText: {
    color: AppColors.secondaryColor,
    fontSize: 11,
    fontWeight: '800',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  trainerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  trainerAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#003882',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerAvatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  trainerName: {
    fontSize: 13,
    fontWeight: '700',
  },
  trainerRole: {
    fontSize: 11,
    marginTop: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scheduleText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  dayPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dayPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sessionsBadge: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '600',
  },
  capacitySection: {
    marginBottom: 12,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  capacityText: {
    fontSize: 12,
  },
  seatsLeftText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  inclusionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  inclusionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inclusionText: {
    fontSize: 10.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  rosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  rosterBtnText: {
    color: '#003882',
    fontSize: 12,
    fontWeight: '700',
  },
  iconActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

