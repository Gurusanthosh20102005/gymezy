import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { AppColors } from '../../theme/appTheme';
import { useToast } from '../../widgets/CustomScaffoldMessage';
import { useAuth } from '../../context/AuthContext';
import { apiService } from '../../services/apiService';
import { getSafeImageUri } from '../../utils/mediaUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDebounce } from '../../hooks/useDebounce';
import { AddTempStaffModal } from '../../widgets/AddTempStaffModal';
import { SkeletonEmployeeCard } from '../../widgets/Skeleton';
import {
  AddEmployeeModal,
  AVAILABLE_SERVICES,
  getServiceIconName,
} from '../../widgets/AddEmployeeModal';

const FILTER_TABS = ['All', 'Trainers', 'Floor Staff', 'Part-Time', 'Temporary', 'Pending Approval'];

export const EmployeesTab = ({ topInset, navigation }) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { gym, user } = useAuth();

  const isManager = Boolean(
    user?.isManager ||
    user?.role === 'Manager' ||
    user?.role === 'MANAGER' ||
    String(user?.role || '').toLowerCase() === 'manager'
  );

  // State
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showTempStaffModal, setShowTempStaffModal] = useState(false);

  // Pagination State (SSOT Server Pagination)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, activeTab]);

  // Fetch Employees from Middleware (SSOT Server Search & Pagination)
  const fetchEmployees = useCallback(async () => {
    try {
      const targetGymId = gym?._id || gym?.partnerId;
      if (!targetGymId) return;

      const params = {
        gymId: targetGymId,
        page,
        limit: 10,
      };

      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (activeTab === 'Trainers') {
        params.role = 'Trainer';
      } else if (activeTab === 'Pending Approval') {
        params.approvalStatus = 'Pending Approval';
      } else if (activeTab === 'Part-Time') {
        params.type = 'Part-Time';
      } else if (activeTab === 'Temporary') {
        params.type = 'Temporary';
      }

      const res = await apiService.getEmployees(params);
      const list = res?.employees || (Array.isArray(res) ? res : []);
      setEmployees(list);
      setTotalPages(res?.pagination?.totalPages || res?.totalPages || Math.ceil((res?.total || list.length) / 10) || 1);
      setTotalCount(res?.pagination?.total ?? res?.total ?? list.length);
      if (res?.summary) {
        setMetrics(res.summary);
      }
    } catch (err) {
      console.warn('Employees fetch warning:', err.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [gym?._id, gym?.partnerId, debouncedSearch, activeTab, page]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchEmployees();
  };

  // Metrics (Gym-Wide Summary with current fallback)
  const trainersCount = useMemo(() => {
    if (metrics?.trainersCount !== undefined) return metrics.trainersCount;
    return employees.filter((e) => {
      const roleStr = (e.role || '').toLowerCase();
      return roleStr.includes('trainer') || roleStr.includes('coach');
    }).length;
  }, [metrics, employees]);

  const staffCount = useMemo(() => {
    if (metrics?.staffCount !== undefined) return metrics.staffCount;
    return employees.filter((e) => {
      const roleStr = (e.role || '').toLowerCase();
      return !roleStr.includes('trainer') && !roleStr.includes('coach');
    }).length;
  }, [metrics, employees]);

  const pendingCount = useMemo(() => {
    if (metrics?.pendingCount !== undefined) return metrics.pendingCount;
    return employees.filter((e) => e.approvalStatus === 'Pending Approval').length;
  }, [metrics, employees]);

  // Filtered List (Server-filtered with Floor Staff client-side guard)
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (activeTab === 'Floor Staff') {
        const roleStr = (emp.role || '').toLowerCase();
        const isTrainer = roleStr.includes('trainer') || roleStr.includes('coach');
        if (isTrainer) return false;
      }
      return true;
    });
  }, [employees, activeTab]);



  // Status toggle
  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await apiService.updateEmployee(emp._id || emp.id, { status: newStatus });
      showToast({
        message: `${emp.name} marked as ${newStatus}`,
        isSuccess: true,
      });
      await fetchEmployees();
    } catch (err) {
      showToast({ message: err.message || 'Failed to update status', isError: true });
    }
  };

  // Deactivate
  const handleDeactivate = (emp) => {
    Alert.alert(
      'Deactivate Employee',
      `Are you sure you want to request deactivation for ${emp.name}? This will be submitted to Super Admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiService.deleteEmployee(emp._id || emp.id);
              showToast({
                message: res.message || 'Deactivation requested',
                isSuccess: true,
              });
              if (showDetailModal) setShowDetailModal(false);
              await fetchEmployees();
            } catch (err) {
              showToast({ message: err.message || 'Failed to deactivate', isError: true });
            }
          },
        },
      ]
    );
  };

  const handleReviewApproval = async (action) => {
    if (!selectedEmployee) return;
    try {
      const empId = selectedEmployee._id || selectedEmployee.id;
      await apiService.reviewEmployeeApproval(empId, action, action === 'reject' ? 'Rejected by Gym Admin' : '');
      showToast({
        message: action === 'approve' ? 'Employee approved successfully!' : 'Employee approval rejected.',
        isSuccess: true,
      });
      setShowDetailModal(false);
      setSelectedEmployee(null);
      await fetchEmployees();
    } catch (err) {
      showToast({ message: err.message || `Failed to ${action} employee.`, isError: true });
    }
  };

  // Contact actions
  const handleCall = (phone) => {
    if (!phone) return;
    const clean = phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${clean}`).catch(() => {
      showToast({ message: `Cannot dial ${phone}`, isError: true });
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
      {/* 1. Header with Dual Action Buttons (Add Employee & Add Temp / Part-Time) */}
      <View style={[styles.headerRow, { paddingTop: topInset + 12 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Staff & Employees
            </Text>
            <Text style={[styles.headerSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              {employees.length} team members configured
            </Text>
          </View>
        </View>

        <View style={styles.headerActionRow}>
          <TouchableOpacity
            style={[
              styles.addTempStaffBtn,
              {
                backgroundColor: isDark ? 'rgba(124, 58, 237, 0.16)' : '#F5F3FF',
                borderColor: isDark ? 'rgba(124, 58, 237, 0.45)' : '#DDD6FE',
              },
            ]}
            onPress={() => setShowTempStaffModal(true)}
            activeOpacity={0.85}
          >
            <MaterialIcons name="group-add" size={16} color={isDark ? '#C084FC' : '#7C3AED'} />
            <Text style={[styles.addTempStaffBtnText, { color: isDark ? '#C084FC' : '#7C3AED' }]}>
              + Temp / Part-Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addEmployeeBtn}
            onPress={() => {
              setEditingEmployee(null);
              setShowAddModal(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialIcons name="person-add" size={16} color="#FFFFFF" />
            <Text style={styles.addEmployeeBtnText}>+ Add Employee</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 170 + Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AppColors.primaryColor}
          />
        }
      >
        {/* 2. Key Metrics Row */}
        <View style={styles.metricsRow}>
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(0, 102, 204, 0.12)' }]}>
              <MaterialIcons name="badge" size={18} color={AppColors.primaryColor} />
            </View>
            <Text style={[styles.metricNumber, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {employees.length}
            </Text>
            <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
              Total Staff
            </Text>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <MaterialIcons name="fitness-center" size={18} color={AppColors.successGreen} />
            </View>
            <Text style={[styles.metricNumber, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {trainersCount}
            </Text>
            <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
              Trainers
            </Text>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(168, 85, 247, 0.12)' }]}>
              <MaterialIcons name="support-agent" size={18} color="#A855F7" />
            </View>
            <Text style={[styles.metricNumber, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {staffCount}
            </Text>
            <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
              Floor Staff
            </Text>
          </View>

          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <MaterialIcons name="hourglass-empty" size={18} color={AppColors.warningAmber} />
            </View>
            <Text style={[styles.metricNumber, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {pendingCount}
            </Text>
            <Text style={[styles.metricLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
              Pending
            </Text>
          </View>
        </View>

        {/* 3. Quick Attendance Action Card */}
        <TouchableOpacity
          style={[
            styles.attendanceBanner,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
          onPress={() => navigation?.navigate('Attendance')}
          activeOpacity={0.85}
        >
          <View style={styles.attendanceIconCircle}>
            <MaterialIcons name="how-to-reg" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.attendanceBannerTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Staff & Trainer Attendance Hub
            </Text>
            <Text style={[styles.attendanceBannerSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              Record check-ins, verify shift hours & review today's roster
            </Text>
          </View>
          <MaterialIcons name="arrow-forward-ios" size={16} color={AppColors.primaryColor} />
        </TouchableOpacity>

        {/* 4. Search Bar */}
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          <MaterialIcons name="search" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
            placeholder="Search by name, role, ID, or phone..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : '#94A3B8'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={18} color={isDark ? '#FFFFFF' : '#64748B'} />
            </TouchableOpacity>
          )}
        </View>

        {/* 5. Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          {FILTER_TABS.map((tab) => {
            const isSel = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.filterTabChip,
                  isSel && { backgroundColor: AppColors.primaryColor, borderColor: AppColors.primaryColor },
                  {
                    backgroundColor: isSel
                      ? AppColors.primaryColor
                      : isDark
                      ? AppColors.darkCard
                      : '#FFFFFF',
                    borderColor: isSel
                      ? AppColors.primaryColor
                      : isDark
                      ? AppColors.darkBorder
                      : '#E2E8F0',
                  },
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.filterTabChipText,
                    { color: isSel ? '#FFFFFF' : isDark ? '#FFFFFF' : '#64748B' },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 6. Employee Cards List */}
        {isLoading ? (
          <View style={{ paddingTop: 8 }}>
            <SkeletonEmployeeCard />
            <SkeletonEmployeeCard />
            <SkeletonEmployeeCard />
          </View>
        ) : filteredEmployees.length === 0 ? (
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <MaterialIcons
              name="badge"
              size={48}
              color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'}
            />
            <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              No Employees Found
            </Text>
            <Text style={[styles.emptySub, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
              {searchQuery
                ? 'Try adjusting your search query or filter criteria.'
                : 'Get started by adding your first trainer or gym staff member.'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => {
                  setEditingEmployee(null);
                  setShowAddModal(true);
                }}
              >
                <MaterialIcons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add First Employee</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredEmployees.map((emp) => {
            const avatarUri = getSafeImageUri(emp.avatar);
            const isApproved = emp.approvalStatus === 'Approved';
            const isPending = emp.approvalStatus === 'Pending Approval';
            const isActive = emp.status === 'Active';

            const isSelf = Boolean(
              (user?.email && emp.email && user.email.toLowerCase() === emp.email.toLowerCase()) ||
              (user?.phone && emp.phone && user.phone.replace(/[^0-9]/g, '') === String(emp.phone).replace(/[^0-9]/g, '')) ||
              (user?.employeeId && emp.employeeId && user.employeeId === emp.employeeId) ||
              (user?.name && emp.name && user.name.toLowerCase() === emp.name.toLowerCase()) ||
              (user?.id && (emp._id === user.id || emp.id === user.id || emp.userId === user.id))
            );

            const initials = emp.name
              ? emp.name
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()
              : 'EM';

            return (
              <TouchableOpacity
                key={emp._id || emp.id || emp.employeeId}
                style={[
                  styles.employeeCard,
                  {
                    backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                    borderColor: isSelf
                      ? '#A855F7'
                      : isDark
                      ? AppColors.darkBorder
                      : '#E2E8F0',
                    borderWidth: isSelf ? 1.5 : 1,
                  },
                ]}
                activeOpacity={0.88}
                onPress={() => {
                  setSelectedEmployee(emp);
                  setShowDetailModal(true);
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.avatarWrap}>
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: AppColors.primaryColor }]}>
                        <Text style={styles.avatarFallbackText}>{initials}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.headerInfoCol}>
                    <View style={styles.nameAndStatusRow}>
                      <View style={styles.nameAndIdBox}>
                        <Text
                          style={[styles.empName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {emp.name}
                        </Text>
                        {isSelf && (
                          <View
                            style={{
                              backgroundColor: isDark ? 'rgba(168, 85, 247, 0.22)' : '#F3E8FF',
                              borderColor: isDark ? 'rgba(168, 85, 247, 0.5)' : '#D8B4FE',
                              borderWidth: 1,
                              borderRadius: 6,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              marginRight: 4,
                            }}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#9333EA' }}>You</Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.empIdTag,
                            {
                              backgroundColor: isDark ? 'rgba(0, 56, 130, 0.28)' : 'rgba(0, 56, 130, 0.08)',
                              borderColor: isDark ? 'rgba(0, 56, 130, 0.45)' : 'rgba(0, 56, 130, 0.18)',
                            },
                          ]}
                        >
                          <Text style={styles.empIdTagText}>{emp.employeeId || 'EMP'}</Text>
                        </View>
                      </View>

                      {/* Status Pill - Right aligned, flexShrink: 0, guaranteed zero overlap */}
                      {!isApproved && emp.approvalStatus && emp.approvalStatus !== 'Approved' && (
                        <View
                          style={[
                            styles.statusPill,
                            {
                              backgroundColor: isPending
                                ? 'rgba(245, 158, 11, 0.14)'
                                : 'rgba(239, 68, 68, 0.12)',
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor: isPending
                                  ? AppColors.warningAmber
                                  : AppColors.dangerRed,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.statusPillText,
                              {
                                color: isPending
                                  ? AppColors.warningAmber
                                  : AppColors.dangerRed,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {emp.approvalStatus}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      <Text
                        style={[styles.empRole, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}
                        numberOfLines={1}
                      >
                        {emp.role === 'Manager' ? 'Manager (Operational Admin)' : emp.role}
                      </Text>
                      {emp.role === 'Manager' && (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: isDark ? 'rgba(79, 70, 229, 0.2)' : '#EEF2FF',
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: isDark ? '#4338CA' : '#C7D2FE',
                            gap: 3,
                          }}
                        >
                          <MaterialIcons name="workspace-premium" size={11} color="#4F46E5" />
                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#4F46E5' }}>ADMIN</Text>
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <View
                        style={[
                          styles.typePill,
                          emp.type === 'Temporary'
                            ? { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.18)' : '#FFEDD5' }
                            : emp.type === 'Part-Time'
                            ? { backgroundColor: isDark ? 'rgba(8, 145, 178, 0.18)' : '#CFFAFE' }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typePillText,
                            emp.type === 'Temporary'
                              ? { color: '#EA580C', fontWeight: '700' }
                              : emp.type === 'Part-Time'
                              ? { color: '#0891B2', fontWeight: '700' }
                              : { color: isDark ? '#94A3B8' : '#475569' },
                          ]}
                          numberOfLines={1}
                        >
                          {emp.type || 'Full Time'} • {emp.accessType || 'Employee'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Info row */}
                <View
                  style={[
                    styles.cardMetaRow,
                    {
                      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.metaItem}
                    onPress={() => handleCall(emp.phone)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="phone" size={14} color={AppColors.primaryColor} />
                    <Text style={[styles.metaText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }]}>
                      {emp.phone || 'No phone'}
                    </Text>
                  </TouchableOpacity>

                  {emp.compensation?.payAmount ? (
                    <View style={styles.metaItem}>
                      <MaterialIcons name="payments" size={14} color={AppColors.successGreen} />
                      <Text style={[styles.metaText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }]}>
                        ₹{Number(emp.compensation.payAmount).toLocaleString('en-IN')}/mo
                      </Text>
                    </View>
                  ) : null}

                  {emp.schedule?.shiftTiming ? (
                    <View style={styles.metaItem}>
                      <MaterialIcons name="schedule" size={14} color="#6366F1" />
                      <Text style={[styles.metaText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }]}>
                        {emp.schedule.shiftTiming}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Quick Card Action Buttons */}
                <View
                  style={[
                    styles.cardActionsRow,
                    {
                      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                      },
                    ]}
                    onPress={() => {
                      setSelectedEmployee(emp);
                      setShowDetailModal(true);
                    }}
                  >
                    <MaterialIcons name="visibility" size={15} color={AppColors.primaryColor} />
                    <Text style={[styles.actionBtnText, { color: AppColors.primaryColor }]}>
                      View Profile
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                      },
                    ]}
                    onPress={() => handleToggleStatus(emp)}
                  >
                    <MaterialIcons
                      name={isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={15}
                      color={isActive ? AppColors.warningAmber : AppColors.successGreen}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: isActive ? AppColors.warningAmber : AppColors.successGreen },
                      ]}
                    >
                      {isActive ? 'Mark Inactive' : 'Mark Active'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                      },
                    ]}
                    onPress={() => handleDeactivate(emp)}
                  >
                    <MaterialIcons name="delete-outline" size={15} color={AppColors.dangerRed} />
                    <Text style={[styles.actionBtnText, { color: AppColors.dangerRed }]}>
                      Deactivate
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Pagination Controls */}
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
                {totalCount} total staff
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

      {/* 7. Detailed Employee Profile Modal */}
      <Modal
        visible={showDetailModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Employee Profile
                </Text>
                <Text style={[styles.modalSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  {selectedEmployee?.employeeId} • {selectedEmployee?.role}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            {selectedEmployee && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Profile Top Row */}
                <View style={styles.modalProfileRow}>
                  {getSafeImageUri(selectedEmployee.avatar) ? (
                    <Image
                      source={{ uri: getSafeImageUri(selectedEmployee.avatar) }}
                      style={styles.modalAvatar}
                    />
                  ) : (
                    <View style={[styles.modalAvatarFallback, { backgroundColor: AppColors.primaryColor }]}>
                      <Text style={styles.modalAvatarText}>
                        {selectedEmployee.name?.substring(0, 2).toUpperCase() || 'EM'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.modalEmpName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {selectedEmployee.name}
                      </Text>
                      {Boolean(
                        (user?.email && selectedEmployee.email && user.email.toLowerCase() === selectedEmployee.email.toLowerCase()) ||
                        (user?.phone && selectedEmployee.phone && user.phone.replace(/[^0-9]/g, '') === String(selectedEmployee.phone).replace(/[^0-9]/g, '')) ||
                        (user?.employeeId && selectedEmployee.employeeId && user.employeeId === selectedEmployee.employeeId) ||
                        (user?.name && selectedEmployee.name && user.name.toLowerCase() === selectedEmployee.name.toLowerCase()) ||
                        (user?.id && (selectedEmployee._id === user.id || selectedEmployee.id === user.id || selectedEmployee.userId === user.id))
                      ) && (
                        <View
                          style={{
                            backgroundColor: isDark ? 'rgba(168, 85, 247, 0.22)' : '#F3E8FF',
                            borderColor: isDark ? 'rgba(168, 85, 247, 0.5)' : '#D8B4FE',
                            borderWidth: 1,
                            borderRadius: 6,
                            paddingHorizontal: 6,
                            paddingVertical: 1,
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9333EA' }}>You</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.modalEmpRole, { color: AppColors.primaryColor }]}>
                      {selectedEmployee.role === 'Manager' ? 'Manager (Operational Admin)' : selectedEmployee.role}
                    </Text>
                    <Text style={[styles.modalEmpAccess, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {selectedEmployee.type || 'Full Time'} • Access: {selectedEmployee.accessType || 'Employee'}
                    </Text>
                  </View>
                </View>

                {/* Super Admin Approval Banner */}
                <View
                  style={[
                    styles.approvalBanner,
                    {
                      backgroundColor:
                        selectedEmployee.approvalStatus === 'Approved'
                          ? 'rgba(16, 185, 129, 0.12)'
                          : selectedEmployee.approvalStatus === 'Pending Approval'
                          ? 'rgba(245, 158, 11, 0.14)'
                          : 'rgba(239, 68, 68, 0.12)',
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      selectedEmployee.approvalStatus === 'Approved'
                        ? 'verified'
                        : selectedEmployee.approvalStatus === 'Pending Approval'
                        ? 'pending'
                        : 'cancel'
                    }
                    size={20}
                    color={
                      selectedEmployee.approvalStatus === 'Approved'
                        ? AppColors.successGreen
                        : selectedEmployee.approvalStatus === 'Pending Approval'
                        ? AppColors.warningAmber
                        : AppColors.dangerRed
                    }
                  />
                  <Text
                    style={[
                      styles.approvalBannerText,
                      {
                        color:
                          selectedEmployee.approvalStatus === 'Approved'
                            ? AppColors.successGreen
                            : selectedEmployee.approvalStatus === 'Pending Approval'
                            ? AppColors.warningAmber
                            : AppColors.dangerRed,
                      },
                    ]}
                  >
                    Approval Status: {selectedEmployee.approvalStatus || 'Approved'}
                  </Text>
                </View>

                {selectedEmployee.approvalStatus === 'Pending Approval' && !isManager && (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      marginBottom: 16,
                      padding: 12,
                      backgroundColor: isDark ? '#1E1B4B' : '#F5F3FF',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? '#4338CA' : '#C7D2FE',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1E1B4B' }}>
                        Manager Submission
                      </Text>
                      <Text style={{ fontSize: 11, color: isDark ? '#C7D2FE' : '#64748B' }}>
                        Review and approve this staff profile
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={{
                        backgroundColor: AppColors.successGreen,
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 8,
                      }}
                      onPress={() => handleReviewApproval('approve')}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 12 }}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        backgroundColor: 'transparent',
                        borderWidth: 1,
                        borderColor: AppColors.dangerRed,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 8,
                      }}
                      onPress={() => handleReviewApproval('reject')}
                    >
                      <Text style={{ color: AppColors.dangerRed, fontWeight: '700', fontSize: 12 }}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {selectedEmployee.approvalStatus === 'Pending Approval' && isManager && (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 10,
                      marginBottom: 16,
                      padding: 12,
                      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                      alignItems: 'center',
                    }}
                  >
                    <MaterialIcons name="hourglass-empty" size={20} color={AppColors.warningAmber} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: isDark ? '#FFFFFF' : '#92400E' }}>
                        Pending Gym Admin Review
                      </Text>
                      <Text style={{ fontSize: 11, color: isDark ? 'rgba(255,255,255,0.7)' : '#B45309' }}>
                        This staff profile has been submitted and is awaiting approval from the Gym Admin.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Details Section */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Contact & Personal Information
                  </Text>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Phone</Text>
                    <TouchableOpacity onPress={() => handleCall(selectedEmployee.phone)}>
                      <Text style={[styles.detailVal, { color: AppColors.primaryColor }]}>
                        {selectedEmployee.phone || 'N/A'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Email</Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {selectedEmployee.email || 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Gender</Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {selectedEmployee.gender || 'Not specified'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Status</Text>
                    <Text style={[styles.detailVal, { color: selectedEmployee.status === 'Active' ? AppColors.successGreen : AppColors.warningAmber }]}>
                      {selectedEmployee.status || 'Active'}
                    </Text>
                  </View>
                </View>

                {/* Compensation & Shift */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Shift & Compensation
                  </Text>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Employment Type</Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' }]}>
                      {selectedEmployee.type || 'Full-Time'}
                    </Text>
                  </View>
                  {selectedEmployee.type === 'Temporary' && (selectedEmployee.schedule?.startDate || selectedEmployee.schedule?.endDate) && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Engagement Period</Text>
                      <Text style={[styles.detailVal, { color: '#EA580C', fontWeight: '700' }]}>
                        {selectedEmployee.schedule.startDate || '—'} to {selectedEmployee.schedule.endDate || '—'}
                      </Text>
                    </View>
                  )}
                  {Array.isArray(selectedEmployee.schedule?.workingDays) && selectedEmployee.schedule.workingDays.length > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Working Days</Text>
                      <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {selectedEmployee.schedule.workingDays.join(', ')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Compensation</Text>
                    <Text style={[styles.detailVal, { color: AppColors.secondaryColor, fontWeight: '700' }]}>
                      {selectedEmployee.compensation?.payAmount
                        ? `₹${Number(selectedEmployee.compensation.payAmount).toLocaleString('en-IN')}${selectedEmployee.compensation?.payType ? ` / ${selectedEmployee.compensation.payType}` : ''}${selectedEmployee.compensation?.payFreq ? ` (${selectedEmployee.compensation.payFreq})` : ''}`
                        : 'Not recorded'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Shift Hours</Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {selectedEmployee.schedule?.workingTimeStart && selectedEmployee.schedule?.workingTimeEnd
                        ? `${selectedEmployee.schedule.workingTimeStart} - ${selectedEmployee.schedule.workingTimeEnd}`
                        : selectedEmployee.schedule?.shiftTiming || 'General Floor Shift'}
                    </Text>
                  </View>
                  {!!selectedEmployee.notes && (
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Notes</Text>
                      <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A', flex: 1, textAlign: 'right' }]}>
                        {selectedEmployee.notes}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Emergency Contact */}
                {selectedEmployee.emergencyContact && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Emergency Contact
                    </Text>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Name</Text>
                      <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {selectedEmployee.emergencyContact.name || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Relation</Text>
                      <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {selectedEmployee.emergencyContact.relation || 'Parent'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Phone</Text>
                      <TouchableOpacity onPress={() => handleCall(selectedEmployee.emergencyContact.phone)}>
                        <Text style={[styles.detailVal, { color: AppColors.primaryColor }]}>
                          {selectedEmployee.emergencyContact.phone || 'N/A'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Trainer Profile & Showcase (Shown in User App) */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Trainer Profile & Showcase (User App)
                  </Text>
                  <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 4 }]}>
                    About Me
                  </Text>
                  <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A', marginBottom: 12, lineHeight: 20 }]}>
                    {selectedEmployee.aboutMe || selectedEmployee.description || 'Certified fitness trainer with 8+ years of experience helping clients achieve their fitness goals through personalized training and nutrition guidance.'}
                  </Text>

                  <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B', marginBottom: 6 }]}>
                    Services Offered
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {(Array.isArray(selectedEmployee.servicesOffered) && selectedEmployee.servicesOffered.length > 0
                      ? selectedEmployee.servicesOffered
                      : AVAILABLE_SERVICES
                    ).map((s, idx) => (
                      <View
                        key={idx}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 8,
                        }}
                      >
                        <MaterialIcons
                          name={getServiceIconName(s)}
                          size={13}
                          color={AppColors.primaryColor}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={{ fontSize: 11, color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '600' }}>
                          {s}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Experience</Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {selectedEmployee.experience || '8+ Years'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B' }]}>Languages</Text>
                    <Text style={[styles.detailVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {Array.isArray(selectedEmployee.languages)
                        ? selectedEmployee.languages.join(', ')
                        : selectedEmployee.languages || 'English, Hindi'}
                    </Text>
                  </View>

                  <Text style={[styles.detailKey, { color: isDark ? '#94A3B8' : '#64748B', marginTop: 8, marginBottom: 4 }]}>
                    Certifications
                  </Text>
                  {(Array.isArray(selectedEmployee.certifications) && selectedEmployee.certifications.length > 0
                    ? selectedEmployee.certifications
                    : [
                        'ACE Certified Personal Trainer',
                        'Certified Strength & Conditioning Specialist (CSCS)',
                        'Nutrition & Weight Management Certification',
                      ]
                  ).map((c, idx) => (
                    <Text
                      key={idx}
                      style={{
                        fontSize: 12,
                        color: isDark ? '#94A3B8' : '#64748B',
                        marginBottom: 3,
                        lineHeight: 18,
                      }}
                    >
                      • {c}
                    </Text>
                  ))}
                </View>

                {/* Action Buttons in Modal */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 24 }}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: AppColors.primaryColor, flex: 1 }]}
                    onPress={() => {
                      const empToEdit = selectedEmployee;
                      setShowDetailModal(false);
                      setEditingEmployee(empToEdit);
                      setShowAddModal(true);
                    }}
                  >
                    <MaterialIcons name="edit" size={17} color="#FFFFFF" />
                    <Text style={styles.modalActionBtnText}>
                      {Boolean(
                        (user?.email && selectedEmployee.email && user.email.toLowerCase() === selectedEmployee.email.toLowerCase()) ||
                        (user?.phone && selectedEmployee.phone && user.phone.replace(/[^0-9]/g, '') === String(selectedEmployee.phone).replace(/[^0-9]/g, '')) ||
                        (user?.employeeId && selectedEmployee.employeeId && user.employeeId === selectedEmployee.employeeId) ||
                        (user?.name && selectedEmployee.name && user.name.toLowerCase() === selectedEmployee.name.toLowerCase()) ||
                        (user?.id && (selectedEmployee._id === user.id || selectedEmployee.id === user.id || selectedEmployee.userId === user.id))
                      )
                        ? 'Edit My Profile'
                        : 'Edit'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                        borderWidth: 1,
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        flex: 1,
                      },
                    ]}
                    onPress={() => {
                      setShowDetailModal(false);
                      navigation?.navigate('Attendance');
                    }}
                  >
                    <MaterialIcons name="how-to-reg" size={17} color={isDark ? '#FFFFFF' : '#0F172A'} />
                    <Text style={[styles.modalActionBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      Attendance
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)', flex: 1 }]}
                    onPress={() => handleDeactivate(selectedEmployee)}
                  >
                    <MaterialIcons name="delete" size={17} color={AppColors.dangerRed} />
                    <Text style={[styles.modalActionBtnText, { color: AppColors.dangerRed }]}>
                      Deactivate
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 8. Add / Edit Permanent Employee Modal */}
      <AddEmployeeModal
        visible={showAddModal}
        initialEmployee={editingEmployee}
        onClose={() => {
          setShowAddModal(false);
          setEditingEmployee(null);
        }}
        onSuccess={() => {
          fetchEmployees();
          setEditingEmployee(null);
        }}
      />

      {/* 9. Add Temporary / Part-Time Staff Modal */}
      <AddTempStaffModal
        visible={showTempStaffModal}
        onClose={() => setShowTempStaffModal(false)}
        onSuccess={() => fetchEmployees()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Bold',
  },
  headerSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Outfit' : 'Outfit-Medium',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addTempStaffBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 6,
  },
  addTempStaffBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  addEmployeeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryColor,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  addEmployeeBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  attendanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    gap: 12,
  },
  attendanceIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceBannerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  attendanceBannerSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  tabsScroll: {
    marginBottom: 14,
  },
  filterTabChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterTabChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyStateCard: {
    padding: 36,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 260,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.primaryColor,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 18,
    gap: 6,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  employeeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 48,
    height: 48,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  headerInfoCol: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
    justifyContent: 'center',
  },
  nameAndStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    minWidth: 0,
  },
  nameAndIdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  empName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  empIdTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    flexShrink: 0,
  },
  empIdTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: AppColors.primaryColor,
  },
  empRole: {
    fontSize: 12.5,
    fontWeight: '600',
    marginTop: 2,
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typePillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    gap: 5,
    flexShrink: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
  },
  modalSub: {
    fontSize: 12,
    marginTop: 2,
  },
  modalProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  modalAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  modalEmpName: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalEmpRole: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  modalEmpAccess: {
    fontSize: 12,
    marginTop: 2,
  },
  approvalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  approvalBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  sectionBlock: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailKey: {
    fontSize: 12.5,
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  modalActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addPhotoPreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  addPhotoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primaryColor,
    borderStyle: 'dashed',
  },
  photoHelpTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  photoHelpSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  formLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 12,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
  },
  chipBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  accessLevelRow: {
    gap: 8,
    marginBottom: 14,
  },
  accessLevelCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  accessLevelTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  accessLevelDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  smallChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
    marginBottom: 30,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13.5,
  },
  trainerShowcaseBox: {
    marginTop: 18,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  showcaseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  showcaseHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  showcaseHeaderSub: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 6,
  },
  textAreaInput: {
    minHeight: 70,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  servicesChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  serviceChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  serviceChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  subSectionBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(114, 46, 209, 0.1)',
  },
  attachBtnText: {
    color: '#722ED1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  docListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  docListTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  backStepBtn: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionChipSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  selectionChipTextSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectionChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pickerModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  fileUploadBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 56, 130, 0.08)',
  },
  pageBtnDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  pageBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  pageInfoBox: {
    alignItems: 'center',
  },
  pageInfoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pageTotalSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
});
