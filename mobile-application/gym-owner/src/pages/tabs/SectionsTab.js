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
import { useDebounce } from '../../hooks/useDebounce';
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
import { SkeletonSectionCard } from '../../widgets/Skeleton';

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
  const [lifecycleTab, setLifecycleTab] = useState('active'); // 'active' (Upcoming/Ongoing), 'completed', 'all'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSection, setEditingSection] = useState(null);

  // Roster Modal State
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [selectedSectionRoster, setSelectedSectionRoster] = useState(null);

  // Pagination State (SSOT Server Pagination)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch sections
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset to page 1 on category or search change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeCategory]);

  const fetchSectionsList = useCallback(async () => {
    try {
      const params = {
        gymId: targetGymId,
        page,
        limit: 10,
      };
      if (activeCategory !== 'all') {
        params.category = activeCategory;
      }
      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      const data = await apiService.getSections(params);
      const rawList = data?.sections || (Array.isArray(data) ? data : []);
      setSections(rawList);
      setTotalPages(data?.pagination?.totalPages || data?.totalPages || Math.ceil((data?.total || rawList.length) / 10) || 1);
      setTotalCount(data?.pagination?.total ?? data?.total ?? rawList.length);
    } catch (err) {
      console.warn('Failed to fetch sections:', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [targetGymId, activeCategory, debouncedSearch, page]);

  useEffect(() => {
    fetchSectionsList();
  }, [fetchSectionsList]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchSectionsList();
  };

  // Single Source of Truth Lifecycle Calculator for Section Batches
  const getSectionLifecycleState = useCallback((sec) => {
    if (sec.lifecycleStatus) return sec.lifecycleStatus;
    const now = new Date();
    const sDate = sec.startDate ? new Date(sec.startDate) : new Date();
    let effectiveEnd = sec.endDate;
    if (!effectiveEnd && sec.startDate && sec.durationDays) {
      effectiveEnd = calculateScheduleEndDate(sec.startDate, sec.durationDays, sec.activeDays);
    }
    const eDate = effectiveEnd ? new Date(effectiveEnd) : sDate;
    eDate.setHours(23, 59, 59, 999);
    if (now > eDate) return 'COMPLETED';
    if (sec.isActive === false) return 'PAUSED';
    if (now >= sDate) return 'ONGOING';
    return 'UPCOMING';
  }, []);

  // Toggle active status (guard against activating completed batches)
  const handleToggleStatus = async (sectionId, currentStatus) => {
    const targetSection = sections.find((s) => s._id === sectionId);
    if (targetSection && getSectionLifecycleState(targetSection) === 'COMPLETED') {
      Alert.alert(
        'Batch Completed',
        'This batch schedule has already ended. To reopen enrollment, please edit the section and update the start and end dates.'
      );
      return;
    }
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

  // Filtered Sections by Lifecycle + Category + Search
  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      const state = getSectionLifecycleState(sec);
      // Lifecycle filter
      if (lifecycleTab === 'active' && state !== 'UPCOMING' && state !== 'ONGOING') {
        return false;
      }
      if (lifecycleTab === 'completed' && state !== 'COMPLETED') {
        return false;
      }

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
  }, [sections, activeCategory, searchQuery, lifecycleTab, getSectionLifecycleState]);

  // Dynamic Dashboard & Lifecycle Counts
  const upcomingCount = sections.filter((s) => getSectionLifecycleState(s) === 'UPCOMING').length;
  const ongoingCount = sections.filter((s) => getSectionLifecycleState(s) === 'ONGOING').length;
  const activeSectionsCount = upcomingCount + ongoingCount;
  const completedSectionsCount = sections.filter((s) => getSectionLifecycleState(s) === 'COMPLETED').length;
  const totalSectionsCount = sections.length;
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

        {/* Lifecycle Segment Tabs (Active/Upcoming vs Completed vs All) */}
        <View style={styles.lifecycleSegmentRow}>
          {[
            { key: 'active', label: 'Active', count: activeSectionsCount, icon: 'bolt' },
            { key: 'completed', label: 'Completed', count: completedSectionsCount, icon: 'check-circle' },
            { key: 'all', label: 'All', count: totalSectionsCount, icon: 'layers' },
          ].map((tab) => {
            const isTabActive = lifecycleTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setLifecycleTab(tab.key)}
                style={[
                  styles.lifecycleTabBtn,
                  isTabActive
                    ? { backgroundColor: '#003882', borderColor: '#003882' }
                    : { backgroundColor: cardBg, borderColor: borderCol },
                ]}
                activeOpacity={0.8}
              >
                <MaterialIcons
                  name={tab.icon}
                  size={14}
                  color={isTabActive ? '#FFFFFF' : subTextCol}
                  style={{ marginRight: 5 }}
                />
                <Text style={[styles.lifecycleTabText, { color: isTabActive ? '#FFFFFF' : textCol }]}>
                  {tab.label} ({tab.count})
                </Text>
              </TouchableOpacity>
            );
          })}
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
          <View style={{ paddingTop: 8 }}>
            <SkeletonSectionCard />
            <SkeletonSectionCard />
            <SkeletonSectionCard />
          </View>
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

            const lifecycleState = getSectionLifecycleState(section);
            const isCompleted = lifecycleState === 'COMPLETED';
            const isOngoing = lifecycleState === 'ONGOING';
            const isPaused = lifecycleState === 'PAUSED';

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
                {/* Top Row: Category Pill, Cost, Lifecycle Badge & Toggle */}
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
                    <View
                      style={[
                        styles.lifecycleBadge,
                        {
                          backgroundColor: isCompleted
                            ? isDark ? 'rgba(100, 116, 139, 0.2)' : '#F1F5F9'
                            : isOngoing
                            ? isDark ? 'rgba(234, 88, 12, 0.2)' : '#FFF7ED'
                            : isPaused
                            ? isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEF2F2'
                            : isDark ? 'rgba(2, 132, 199, 0.2)' : '#F0F9FF',
                          borderColor: isCompleted
                            ? '#94A3B8'
                            : isOngoing
                            ? '#EA580C'
                            : isPaused
                            ? '#EF4444'
                            : '#0284C7',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.lifecycleBadgeText,
                          {
                            color: isCompleted
                              ? '#64748B'
                              : isOngoing
                              ? '#EA580C'
                              : isPaused
                              ? '#EF4444'
                              : '#0284C7',
                          },
                        ]}
                      >
                        {lifecycleState}
                      </Text>
                    </View>
                    {!isCompleted ? (
                      <Switch
                        value={section.isActive !== false}
                        onValueChange={() => handleToggleStatus(section._id, section.isActive !== false)}
                        trackColor={{ false: '#94A3B8', true: 'rgba(0, 191, 98, 0.4)' }}
                        thumbColor={section.isActive !== false ? AppColors.secondaryColor : '#E2E8F0'}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                    ) : null}
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

        {/* Sections Pagination Toolbar */}
        {totalPages > 1 && (
          <View
            style={[
              styles.paginationRow,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
              disabled={page <= 1 || isLoading}
              onPress={() => setPage((prev) => Math.max(1, prev - 1))}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="chevron-left"
                size={20}
                color={page <= 1 ? (isDark ? '#64748B' : '#94A3B8') : AppColors.primaryColor}
              />
              <Text
                style={[
                  styles.pageBtnText,
                  { color: page <= 1 ? (isDark ? '#64748B' : '#94A3B8') : AppColors.primaryColor },
                ]}
              >
                Prev
              </Text>
            </TouchableOpacity>

            <View style={styles.pageInfoBox}>
              <Text style={[styles.pageInfoText, { color: isDark ? '#F1F5F9' : '#0F172A' }]}>
                Page <Text style={{ fontWeight: '700' }}>{page}</Text> of <Text style={{ fontWeight: '700' }}>{totalPages}</Text>
              </Text>
              <Text style={[styles.pageTotalSubtext, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {totalCount} total batches
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              disabled={page >= totalPages || isLoading}
              onPress={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.pageBtnText,
                  { color: page >= totalPages ? (isDark ? '#64748B' : '#94A3B8') : AppColors.primaryColor },
                ]}
              >
                Next
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={page >= totalPages ? (isDark ? '#64748B' : '#94A3B8') : AppColors.primaryColor}
              />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 100 }} />
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
  lifecycleSegmentRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  lifecycleTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  lifecycleTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  lifecycleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  lifecycleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
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

