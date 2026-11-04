import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';

const SEARCH_FILTER_CHIPS = ['Employee Name', 'Phone Number', 'Employee ID', 'Role'];

export const AttendanceScreen = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { gym } = useAuth();
  const insets = useSafeAreaInsets();

  // Mode: 'HUB' | 'FULL_TIME' | 'PART_TIME' | 'TODAY_SUMMARY' | 'EMPLOYEE_DETAIL'
  const initialView = route?.params?.initialView || 'HUB';
  const [currentView, setCurrentView] = useState(initialView);

  // Live Employee Data
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Sub-tabs
  const [topTab, setTopTab] = useState('Search Employee'); // 'Search Employee' | "Today's Attendance"
  const [attendanceSegment, setAttendanceSegment] = useState('Full Time');
  const [activeFilterChip, setActiveFilterChip] = useState('Employee Name');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Check-out edit state
  const [checkoutTime, setCheckoutTime] = useState('02:35 PM');

  // Animation for celebration checkmark
  const successScaleAnim = useRef(new Animated.Value(0.4)).current;

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44
  );

  useEffect(() => {
    fetchEmployees();
  }, [gym?.id, gym?._id, gym?.partnerId]);

  const fetchEmployees = async () => {
    const gymId = gym?.id || gym?._id || gym?.partnerId;
    if (!gymId) return;
    try {
      setIsLoading(true);
      const res = await apiService.getEmployees({ gymId, limit: 'all' });
      if (res && Array.isArray(res.employees)) {
        setEmployees(res.employees);
      }
    } catch (err) {
      console.log('Error fetching employees in AttendanceScreen:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showSuccessModal) {
      Animated.spring(successScaleAnim, {
        toValue: 1,
        tension: 65,
        friction: 6,
        useNativeDriver: true,
      }).start();
    } else {
      successScaleAnim.setValue(0.4);
    }
  }, [showSuccessModal, successScaleAnim]);

  // Transform live backend employee models to staff items
  const fullTimeStaff = employees
    .filter((e) => e.type !== 'Part-Time' && e.type !== 'Temporary')
    .map((e) => {
      const initials = e.name
        ? e.name
            .split(' ')
            .map((p) => p[0])
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : 'EM';
      return {
        id: e.employeeId || e.id || e._id || 'EMP',
        name: e.name || 'Staff Member',
        role: e.role || 'Staff',
        phone: e.phone || '',
        type: e.type || 'Full Time',
        shift: e.schedule?.workingTimeStart && e.schedule?.workingTimeEnd
          ? `Shift (${e.schedule.workingTimeStart} - ${e.schedule.workingTimeEnd})`
          : 'General Shift (6:00 AM - 2:00 PM)',
        status: e.attendance || (e.status === 'Active' ? 'Present' : e.status || 'Present'),
        checkinTime: e.checkinTime || '07:35 AM',
        checkoutTime: e.checkoutTime || '--',
        avatar: initials,
        approvalStatus: e.approvalStatus || 'Approved',
        raw: e,
      };
    });

  const partTimeStaff = employees
    .filter((e) => e.type === 'Part-Time' || e.type === 'Temporary')
    .map((e) => {
      const initials = e.name
        ? e.name
            .split(' ')
            .map((p) => p[0])
            .join('')
            .substring(0, 2)
            .toUpperCase()
        : 'PT';
      return {
        id: e.employeeId || e.id || e._id || 'EMP',
        name: e.name || 'Contract Trainer',
        role: e.role || 'Part Time Trainer',
        phone: e.phone || '',
        type: e.type || 'Part Time',
        contractStart: e.schedule?.startDate || '01 May 2026',
        contractEnd: e.schedule?.endDate || '30 Jun 2026',
        workingDays: Array.isArray(e.schedule?.workingDays) ? e.schedule.workingDays.join(', ') : 'Mon, Wed, Fri',
        shift: e.schedule?.workingTimeStart && e.schedule?.workingTimeEnd
          ? `${e.schedule.workingTimeStart} - ${e.schedule.workingTimeEnd}`
          : '6:00 AM - 11:00 AM',
        status: e.attendance || (e.status === 'Active' ? 'Checked In' : 'Not Checked In'),
        checkinTime: e.checkinTime || '07:10 AM',
        checkoutTime: e.checkoutTime || '--',
        totalHours: '--',
        avatar: initials,
        approvalStatus: e.approvalStatus || 'Approved',
        raw: e,
      };
    });

  // Filter staff list
  const activeStaffList = currentView === 'FULL_TIME' ? fullTimeStaff : partTimeStaff;
  const filteredStaff = activeStaffList.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();

    if (activeFilterChip === 'Employee Name') return s.name.toLowerCase().includes(q);
    if (activeFilterChip === 'Phone Number') return s.phone.includes(q);
    if (activeFilterChip === 'Employee ID') return s.id.toLowerCase().includes(q);
    if (activeFilterChip === 'Role') return s.role.toLowerCase().includes(q);

    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      s.phone.includes(q)
    );
  });

  const handleOpenCheckin = (staff) => {
    setSelectedStaff(staff);
    setShowCheckinModal(true);
  };

  const handleOpenCheckout = (staff) => {
    setSelectedStaff(staff);
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckin = () => {
    setShowCheckinModal(false);
    showToast({
      message: `${selectedStaff?.name || 'Employee'} checked in successfully!`,
      isSuccess: true,
    });
    setShowSuccessModal(true);
  };

  const handleConfirmCheckout = () => {
    setShowCheckoutModal(false);
    showToast({
      message: `${selectedStaff?.name || 'Employee'} checked out at ${checkoutTime}`,
      isSuccess: true,
    });
  };

  /* -------------------------------------------------------------------------- */
  /* 1. HUB VIEW: Choose Employee Type + Today's Summary                         */
  /* -------------------------------------------------------------------------- */
  const renderHubView = () => (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: topInset + 12, paddingBottom: 40 + Math.max(insets.bottom, 20) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>
        <View style={styles.headerTitleBox}>
          <Text style={[styles.mainHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Mark Attendance
          </Text>
          <Text style={[styles.subHeading, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Choose employee type to mark attendance
          </Text>
        </View>
      </View>

      {/* Option 1: Full Time Employees */}
      <TouchableOpacity
        style={[
          styles.typeCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => {
          setTopTab('Search Employee');
          setCurrentView('FULL_TIME');
        }}
        activeOpacity={0.85}
      >
        <View style={[styles.typeIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
          <MaterialIcons name="badge" size={28} color={AppColors.accentColor} />
        </View>
        <View style={styles.typeTextBox}>
          <Text style={[styles.typeTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Full Time Employees
          </Text>
          <Text style={[styles.typeDesc, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Mark check-in for full time gym employees
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
      </TouchableOpacity>

      {/* Option 2: Part Time / Contract Employees */}
      <TouchableOpacity
        style={[
          styles.typeCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => {
          setTopTab('Search Employee');
          setCurrentView('PART_TIME');
        }}
        activeOpacity={0.85}
      >
        <View style={[styles.typeIconBox, { backgroundColor: 'rgba(0, 56, 130, 0.12)' }]}>
          <MaterialIcons name="person-pin" size={28} color={AppColors.primaryColor} />
        </View>
        <View style={styles.typeTextBox}>
          <Text style={[styles.typeTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Part Time / Contract Employees
          </Text>
          <Text style={[styles.typeDesc, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Mark check-in and check-out for part time trainers & contractors
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
      </TouchableOpacity>

      {/* Today's Summary Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.summaryTopRow}>
          <Text style={[styles.summaryTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Today's Summary
          </Text>
          <Text style={[styles.summaryDate, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
            {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        <View style={styles.metricsGridRow}>
          <View style={styles.summaryStatCol}>
            <Text style={[styles.statVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {fullTimeStaff.length + partTimeStaff.length}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>Total Staff</Text>
          </View>
          <View style={styles.summaryStatCol}>
            <Text style={[styles.statVal, { color: AppColors.secondaryColor }]}>
              {[...fullTimeStaff, ...partTimeStaff].filter((s) => s.status === 'Present' || s.status === 'Checked In').length}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>Present</Text>
          </View>
          <View style={styles.summaryStatCol}>
            <Text style={[styles.statVal, { color: AppColors.dangerRed }]}>
              {[...fullTimeStaff, ...partTimeStaff].filter((s) => s.status === 'Absent' || s.status === 'Not Checked In').length}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>Absent</Text>
          </View>
          <View style={styles.summaryStatCol}>
            <Text style={[styles.statVal, { color: AppColors.warningAmber }]}>
              {[...fullTimeStaff, ...partTimeStaff].filter((s) => s.status === 'On Leave').length}
            </Text>
            <Text style={[styles.statLabel, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>On Leave</Text>
          </View>
        </View>
      </View>

      {/* Quick View Rows */}
      <Text style={[styles.quickViewHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
        Quick View
      </Text>

      <TouchableOpacity
        style={[
          styles.quickRow,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => {
          setCurrentView('TODAY_SUMMARY');
          setAttendanceSegment('Full Time');
        }}
        activeOpacity={0.8}
      >
        <View style={styles.quickLeft}>
          <MaterialIcons name="groups" size={20} color={AppColors.primaryColor} />
          <Text style={[styles.quickLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Full Time Present
          </Text>
        </View>
        <View style={styles.quickRight}>
          <Text style={[styles.quickCount, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {fullTimeStaff.filter((s) => s.status === 'Present' || s.status === 'Checked In').length}
          </Text>
          <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.quickRow,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => {
          setCurrentView('TODAY_SUMMARY');
          setAttendanceSegment('Part Time');
        }}
        activeOpacity={0.8}
      >
        <View style={styles.quickLeft}>
          <MaterialIcons name="person-outline" size={20} color={AppColors.accentColor} />
          <Text style={[styles.quickLabel, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Part Time Present
          </Text>
        </View>
        <View style={styles.quickRight}>
          <Text style={[styles.quickCount, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {partTimeStaff.filter((s) => s.status === 'Present' || s.status === 'Checked In').length}
          </Text>
          <MaterialIcons name="chevron-right" size={20} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );

  /* -------------------------------------------------------------------------- */
  /* 2. STAFF SEARCH & MARK ATTENDANCE VIEW (Full-time & Part-time)             */
  /* -------------------------------------------------------------------------- */
  const renderStaffRosterView = () => {
    const isFullTime = currentView === 'FULL_TIME';
    const screenTitle = isFullTime ? 'Full Time Employees' : 'Part Time / Contract Employees';

    return (
      <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
        {/* Top Header */}
        <View style={[styles.searchHeaderRow, { paddingTop: topInset + 10 }]}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={() => setCurrentView('HUB')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.screenTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {screenTitle}
          </Text>
          <TouchableOpacity
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={() => setCurrentView('TODAY_SUMMARY')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="calendar-today" size={18} color={AppColors.primaryColor} />
          </TouchableOpacity>
        </View>

        {/* Top Sub-tabs: Search Employee vs Today's Attendance */}
        <View style={[styles.segmentContainer, { borderBottomColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
          {['Search Employee', "Today's Attendance"].map((tab) => {
            const isSelected = topTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.segmentTab,
                  isSelected && {
                    borderBottomColor: isDark ? AppColors.darkAccentColor : AppColors.primaryColor,
                    borderBottomWidth: 2.5,
                  },
                ]}
                onPress={() => {
                  if (tab === "Today's Attendance") {
                    setCurrentView('TODAY_SUMMARY');
                  } else {
                    setTopTab(tab);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    {
                      color: isSelected
                        ? isDark
                          ? '#93C5FD'
                          : AppColors.primaryColor
                        : isDark
                        ? 'rgba(255,255,255,0.5)'
                        : '#64748B',
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={[styles.searchScrollContent, { paddingBottom: 40 + Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search by Input */}
          <Text style={[styles.searchByHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Search by
          </Text>

          <View
            style={[
              styles.searchInputBox,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
              },
            ]}
          >
            <MaterialIcons name="search" size={22} color={isDark ? 'rgba(255,255,255,0.5)' : '#64748B'} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by Name / Phone / Employee ID / Role"
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchTextInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={18} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          <View style={styles.chipsWrapRow}>
            {SEARCH_FILTER_CHIPS.map((chip) => {
              const isSelected = activeFilterChip === chip;
              return (
                <TouchableOpacity
                  key={chip}
                  style={[
                    styles.filterChipItem,
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
                  onPress={() => setActiveFilterChip(chip)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterChipItemText,
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
                    {chip}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search Result Section */}
          <View style={styles.resultsHeaderRow}>
            <Text style={[styles.resultsTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Search Result
            </Text>
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchLink}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredStaff.map((staff) => {
            const isPresent = staff.status === 'Present' || staff.status === 'Checked In';
            const isAbsent = staff.status === 'Absent' || staff.status === 'Not Checked In';

            const badgeBg = isPresent
              ? 'rgba(0, 191, 98, 0.12)'
              : isAbsent
              ? 'rgba(239, 68, 68, 0.12)'
              : 'rgba(245, 158, 11, 0.12)';

            const badgeColor = isPresent
              ? AppColors.secondaryColor
              : isAbsent
              ? AppColors.dangerRed
              : AppColors.warningAmber;

            return (
              <TouchableOpacity
                key={staff.id}
                style={[
                  styles.staffCard,
                  {
                    backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                  },
                ]}
                onPress={() => {
                  if (isFullTime) {
                    handleOpenCheckin(staff);
                  } else {
                    if (staff.status === 'Checked In') {
                      handleOpenCheckout(staff);
                    } else {
                      setSelectedStaff(staff);
                      setCurrentView('EMPLOYEE_DETAIL');
                    }
                  }
                }}
                activeOpacity={0.85}
              >
                <View style={styles.staffAvatarCircle}>
                  <Text style={styles.staffAvatarText}>{staff.avatar}</Text>
                </View>

                <View style={styles.staffInfoBox}>
                  <Text style={[styles.staffName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {staff.name}
                  </Text>
                  <Text style={[styles.staffRoleMeta, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    {staff.role} • {staff.id}
                  </Text>
                  {staff.checkinTime !== '--' && (
                    <Text style={[styles.staffCheckinTime, { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }]}>
                      Checked in: {staff.checkinTime}
                    </Text>
                  )}
                </View>

                <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
                    {staff.status}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* 3. CONTRACT EMPLOYEE DETAIL & ATTENDANCE HISTORY VIEW                      */
  /* -------------------------------------------------------------------------- */
  const renderContractEmployeeDetailView = () => {
    if (!selectedStaff) {
      return (
        <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
          <View style={[styles.searchHeaderRow, { paddingTop: topInset + 10 }]}>
            <TouchableOpacity
              style={[styles.backBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              onPress={() => setCurrentView('PART_TIME')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
            <Text style={[styles.screenTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Employee Details
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: isDark ? '#FFFFFF' : '#0F172A', fontSize: 15, fontWeight: '600' }}>
              No employee selected
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
        {/* Top Header */}
        <View style={[styles.searchHeaderRow, { paddingTop: topInset + 10 }]}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={() => setCurrentView('PART_TIME')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.screenTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Part Time / Contract Employees
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.detailsScrollContent, { paddingBottom: 40 + Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View
            style={[
              styles.profileVerifyCard,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.profileVerifyTop}>
              <View style={styles.staffAvatarCircle}>
                <Text style={styles.staffAvatarText}>{selectedStaff?.avatar || 'EM'}</Text>
              </View>
              <View style={styles.profileDetailInfo}>
                <Text style={[styles.detailsName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {selectedStaff?.name || 'Employee'}
                </Text>
                <Text style={[styles.detailsRole, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  {selectedStaff?.role || 'Staff'} • {selectedStaff?.id || ''}
                </Text>
                <View style={styles.phoneRow}>
                  <Ionicons name="call" size={13} color={AppColors.primaryColor} />
                  <Text style={[styles.phoneText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }]}>
                    {selectedStaff?.phone || '--'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

        {/* Contract Details Table */}
        <View
          style={[
            styles.detailsTableCard,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.tableHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Contract Details
          </Text>

          <View style={styles.tableRow}>
            <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              Contract Type
            </Text>
            <Text style={[styles.tableValuePill, { color: isDark ? '#93C5FD' : AppColors.primaryColor }]}>
              {selectedStaff?.type || 'Part Time'}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              Contract Start Date
            </Text>
            <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {selectedStaff?.contractStart || '--'}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              Contract End Date
            </Text>
            <Text style={[styles.tableValue, { color: AppColors.secondaryColor, fontWeight: '800' }]}>
              {selectedStaff?.contractEnd || '--'}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              Working Days
            </Text>
            <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {selectedStaff?.workingDays || 'Mon, Wed, Fri'}
            </Text>
          </View>

          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
              Daily Shift
            </Text>
            <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {selectedStaff?.shift || '6:00 AM - 11:00 AM'}
            </Text>
          </View>
        </View>

        {/* Today's Attendance Table */}
        <View
          style={[
            styles.detailsTableCard,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          <Text style={[styles.tableHeaderTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Today's Attendance
          </Text>

          <View style={styles.tableRow}>
            <View style={styles.iconParamRow}>
              <MaterialIcons name="schedule" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Check-in Time
              </Text>
            </View>
            <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {selectedStaff?.checkinTime || '--'}
            </Text>
          </View>

          <View style={styles.tableRow}>
            <View style={styles.iconParamRow}>
              <MaterialIcons name="logout" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Check-out Time
              </Text>
            </View>
            <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {selectedStaff?.checkoutTime || '--'}
            </Text>
          </View>

          <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
            <View style={styles.iconParamRow}>
              <MaterialIcons name="info" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Status
              </Text>
            </View>
            <View style={styles.redDotStatusRow}>
              <View style={styles.statusDotRed} />
              <Text style={styles.statusDotText}>
                {selectedStaff?.status || 'Present'}
              </Text>
            </View>
          </View>
        </View>

        {/* Mark Check-in Button */}
        <TouchableOpacity
          style={styles.markCheckinBtn}
          onPress={() => handleOpenCheckin(selectedStaff)}
          activeOpacity={0.88}
        >
          <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
          <Text style={styles.markCheckinBtnText}>Mark Check-in</Text>
        </TouchableOpacity>

        {/* View Attendance History Button */}
        <TouchableOpacity
          style={[
            styles.historyOutlineBtn,
            {
              borderColor: isDark ? AppColors.darkBorder : AppColors.primaryColor,
            },
          ]}
          onPress={() =>
            Alert.alert(
              `${selectedStaff?.name || 'Employee'} Attendance History`,
              '• May 2026: 22 Days Present (100% attendance)\n• Apr 2026: 20 Days Present\n• Mar 2026: 21 Days Present'
            )
          }
          activeOpacity={0.8}
        >
          <Text style={[styles.historyOutlineBtnText, { color: isDark ? '#93C5FD' : AppColors.primaryColor }]}>
            View Attendance History
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

  /* -------------------------------------------------------------------------- */
  /* 4. TODAY'S ATTENDANCE SUMMARY & GROUPED ROSTER VIEW                        */
  /* -------------------------------------------------------------------------- */
  const renderTodaySummaryView = () => {
    const isFullTimeSeg = attendanceSegment.startsWith('Full Time');
    const sourceList = isFullTimeSeg ? fullTimeStaff : partTimeStaff;
    const presentStaff = sourceList.filter((s) => s.status === 'Present' || s.status === 'Checked In');
    const absentStaff = sourceList.filter((s) => s.status === 'Absent' || s.status === 'Not Checked In');
    const onLeaveStaff = sourceList.filter((s) => s.status === 'On Leave');

    return (
      <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
        {/* Top Header */}
        <View style={[styles.searchHeaderRow, { paddingTop: topInset + 10 }]}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
            onPress={() => setCurrentView('HUB')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.screenTitleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Today's Attendance
          </Text>
          <View style={[styles.calendarIconBox, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
            <MaterialIcons name="event" size={20} color={AppColors.primaryColor} />
          </View>
        </View>

        {/* Segment Tabs: Full Time vs Part Time */}
        <View style={[styles.segmentContainer, { borderBottomColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
          {[`Full Time (${fullTimeStaff.length})`, `Part Time / Contract (${partTimeStaff.length})`].map((seg) => {
            const isSelected = attendanceSegment.startsWith('Full Time') ? seg.startsWith('Full Time') : seg.startsWith('Part Time');
            return (
              <TouchableOpacity
                key={seg}
                style={[
                  styles.segmentTab,
                  isSelected && {
                    borderBottomColor: isDark ? AppColors.darkAccentColor : AppColors.primaryColor,
                    borderBottomWidth: 2.5,
                  },
                ]}
                onPress={() => setAttendanceSegment(seg)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segmentTabText,
                    {
                      color: isSelected
                        ? isDark
                          ? '#93C5FD'
                          : AppColors.primaryColor
                        : isDark
                        ? 'rgba(255,255,255,0.5)'
                        : '#64748B',
                      fontWeight: isSelected ? '800' : '600',
                    },
                  ]}
                >
                  {seg}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={[styles.searchScrollContent, { paddingBottom: 40 + Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary Mini Cards */}
          <View style={styles.todaySummaryCardsRow}>
            <View
              style={[
                styles.miniSummaryCard,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
            >
              <Text style={[styles.miniSummaryCount, { color: AppColors.secondaryColor }]}>
                {presentStaff.length}
              </Text>
              <Text style={[styles.miniSummaryLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>Present</Text>
            </View>

            <View
              style={[
                styles.miniSummaryCard,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
            >
              <Text style={[styles.miniSummaryCount, { color: AppColors.dangerRed }]}>
                {absentStaff.length}
              </Text>
              <Text style={[styles.miniSummaryLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>Absent</Text>
            </View>

            <View
              style={[
                styles.miniSummaryCard,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
            >
              <Text style={[styles.miniSummaryCount, { color: AppColors.warningAmber }]}>
                {onLeaveStaff.length}
              </Text>
              <Text style={[styles.miniSummaryLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>On Leave</Text>
            </View>
          </View>

          {/* Search Input Bar */}
          <View
            style={[
              styles.searchInputBox,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
              },
            ]}
          >
            <MaterialIcons name="search" size={22} color={isDark ? 'rgba(255,255,255,0.5)' : '#64748B'} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search employee..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
              style={[styles.searchTextInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
            />
          </View>

          {/* Group 1: Present */}
          <View style={styles.resultsHeaderRow}>
            <Text style={[styles.resultsTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Present ({presentStaff.length})
            </Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.clearSearchLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {presentStaff.map((staff) => (
            <View
              key={staff.id}
              style={[
                styles.staffCard,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.staffAvatarCircle}>
                <Text style={styles.staffAvatarText}>{staff.avatar}</Text>
              </View>
              <View style={styles.staffInfoBox}>
                <Text style={[styles.staffName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {staff.name}
                </Text>
                <Text style={[styles.staffRoleMeta, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  {staff.role}
                </Text>
              </View>
              <Text style={[styles.checkinTimestamp, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                {staff.checkinTime}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(0, 191, 98, 0.12)' }]}>
                <Text style={[styles.statusBadgeText, { color: AppColors.secondaryColor }]}>
                  Present
                </Text>
              </View>
            </View>
          ))}

          {/* Group 2: Absent */}
          <View style={[styles.resultsHeaderRow, { marginTop: 14 }]}>
            <Text style={[styles.resultsTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Absent ({absentStaff.length})
            </Text>
          </View>

          {absentStaff.map((staff) => (
            <View
              key={staff.id}
              style={[
                styles.staffCard,
                {
                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
            >
              <View style={styles.staffAvatarCircle}>
                <Text style={styles.staffAvatarText}>{staff.avatar}</Text>
              </View>
              <View style={styles.staffInfoBox}>
                <Text style={[styles.staffName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {staff.name}
                </Text>
                <Text style={[styles.staffRoleMeta, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  {staff.role}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                <Text style={[styles.statusBadgeText, { color: AppColors.dangerRed }]}>
                  Absent
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      {currentView === 'HUB' && renderHubView()}
      {(currentView === 'FULL_TIME' || currentView === 'PART_TIME') && renderStaffRosterView()}
      {currentView === 'EMPLOYEE_DETAIL' && renderContractEmployeeDetailView()}
      {currentView === 'TODAY_SUMMARY' && renderTodaySummaryView()}

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 1: MARK CHECK-IN BOTTOM SHEET                                        */}
      {/* -------------------------------------------------------------------------- */}
      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 1: MARK CHECK-IN BOTTOM SHEET                                        */}
      {/* -------------------------------------------------------------------------- */}
      <Modal
        visible={showCheckinModal && !!selectedStaff}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCheckinModal(false)}
      >
        <View style={styles.modalOverlay}>
          {selectedStaff && (
            <View
              style={[
                styles.bottomSheetCard,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', paddingBottom: Math.max(insets.bottom, 24) + 16 },
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Mark Check-in
                </Text>
                <TouchableOpacity onPress={() => setShowCheckinModal(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
                </TouchableOpacity>
              </View>

              {/* Employee mini card */}
              <View style={styles.modalStaffProfile}>
                <View style={styles.staffAvatarCircle}>
                  <Text style={styles.staffAvatarText}>{selectedStaff?.avatar || 'EM'}</Text>
                </View>
                <View style={styles.staffInfoBox}>
                  <Text style={[styles.modalStaffName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {selectedStaff?.name || 'Employee'}
                  </Text>
                  <Text style={[styles.modalStaffMeta, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    {selectedStaff?.role || 'Staff'} • Employee ID: {selectedStaff?.id || ''}
                  </Text>
                  <Text style={[styles.modalStaffPhone, { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }]}>
                    {selectedStaff?.phone || '--'}
                  </Text>
                </View>
              </View>

              <View style={[styles.sheetDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

              {/* Check-in parameters */}
              <View style={styles.sheetParamRow}>
                <View style={styles.iconParamRow}>
                  <MaterialIcons name="event" size={18} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                  <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    Date
                  </Text>
                </View>
                <Text style={[styles.paramVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Text>
              </View>

              <View style={styles.sheetParamRow}>
                <View style={styles.iconParamRow}>
                  <MaterialIcons name="schedule" size={18} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                  <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    Check-in Time
                  </Text>
                </View>
                <Text style={[styles.paramVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  07:35 AM (Now)
                </Text>
              </View>

              <View style={styles.sheetParamRow}>
                <View style={styles.iconParamRow}>
                  <MaterialIcons name="info" size={18} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                  <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    Status
                  </Text>
                </View>
                <View style={styles.redDotStatusRow}>
                  <View style={styles.statusDotRed} />
                  <Text style={styles.statusDotText}>Absent</Text>
                </View>
              </View>

              <View style={[styles.sheetParamRow, { borderBottomWidth: 0 }]}>
                <View style={styles.iconParamRow}>
                  <MaterialIcons name="access-time" size={18} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                  <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    Shift
                  </Text>
                </View>
                <Text style={[styles.paramVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {selectedStaff?.shift || 'General Shift'}
                </Text>
              </View>

              {/* Actions */}
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleConfirmCheckin}
                activeOpacity={0.88}
              >
                <MaterialIcons name="check" size={20} color="#FFFFFF" />
                <Text style={styles.modalPrimaryBtnText}>Mark Check-in</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                  },
                ]}
                onPress={() => setShowCheckinModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelBtnText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 2: MARK CHECK-OUT BOTTOM SHEET                                       */}
      {/* -------------------------------------------------------------------------- */}
      <Modal
        visible={showCheckoutModal && !!selectedStaff}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCheckoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          {selectedStaff && (
            <View
              style={[
                styles.bottomSheetCard,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', paddingBottom: Math.max(insets.bottom, 24) + 16 },
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  Mark Check-out
                </Text>
                <TouchableOpacity onPress={() => setShowCheckoutModal(false)}>
                  <MaterialIcons name="close" size={24} color={isDark ? '#FFFFFF' : '#0F172A'} />
                </TouchableOpacity>
              </View>

              {/* Employee mini card */}
              <View style={styles.modalStaffProfile}>
                <View style={styles.staffAvatarCircle}>
                  <Text style={styles.staffAvatarText}>{selectedStaff?.avatar || 'EM'}</Text>
                </View>
                <View style={styles.staffInfoBox}>
                  <Text style={[styles.modalStaffName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {selectedStaff?.name || 'Employee'}
                  </Text>
                  <Text style={[styles.modalStaffMeta, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    {selectedStaff?.role || 'Staff'} • {selectedStaff?.id || ''}
                  </Text>
                </View>
              </View>

              <View style={[styles.sheetDivider, { backgroundColor: isDark ? AppColors.darkBorder : '#F1F5F9' }]} />

              <View style={styles.sheetParamRow}>
                <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Check-in Time
                </Text>
                <Text style={[styles.paramVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                  {selectedStaff?.checkinTime || '--'}
                </Text>
              </View>

              {/* Check-out Time Input Row */}
              <View style={styles.sheetParamRow}>
                <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Check-out Time
                </Text>
                <View style={styles.checkoutInputRow}>
                  <TextInput
                    value={checkoutTime}
                    onChangeText={setCheckoutTime}
                    style={[
                      styles.timeInput,
                      {
                        color: isDark ? '#FFFFFF' : '#0F172A',
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  />
                  <MaterialIcons name="access-time" size={20} color={AppColors.primaryColor} />
                </View>
              </View>

              <View style={[styles.sheetParamRow, { borderBottomWidth: 0 }]}>
                <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Total Hours
                </Text>
                <Text style={[styles.paramVal, { color: AppColors.secondaryColor, fontWeight: '800' }]}>
                  7h 25m
                </Text>
              </View>

              {/* Actions */}
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleConfirmCheckout}
                activeOpacity={0.88}
              >
                <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                <Text style={styles.modalPrimaryBtnText}>Confirm Check-out</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                  },
                ]}
                onPress={() => setShowCheckoutModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalCancelBtnText, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 3: CHECK-IN SUCCESSFUL CELEBRATION MODAL                             */}
      {/* -------------------------------------------------------------------------- */}
      <Modal
        visible={showSuccessModal && !!selectedStaff}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.successModalOverlay}>
          {selectedStaff && (
            <View
              style={[
                styles.successModalCard,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
              ]}
            >
              <TouchableOpacity
                style={styles.closeModalCornerBtn}
                onPress={() => setShowSuccessModal(false)}
              >
                <MaterialIcons name="close" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>

              <Animated.View
                style={[
                  styles.successCircleWrapper,
                  {
                    transform: [{ scale: successScaleAnim }],
                  },
                ]}
              >
                <LinearGradient
                  colors={[AppColors.secondaryColor, '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.successCircleGradient}
                >
                  <MaterialIcons name="check" size={44} color="#FFFFFF" />
                </LinearGradient>
              </Animated.View>

              <Text style={[styles.successModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Check-in Successful
              </Text>
              <Text style={[styles.successModalName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedStaff?.name || 'Employee'}
              </Text>
              <Text style={[styles.successModalEmpId, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                {selectedStaff?.id || ''}
              </Text>
              <Text style={styles.checkedInGreenBadge}>Checked-in Successfully</Text>

              <View style={[styles.receiptBox, { backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
                <View style={styles.receiptRow}>
                  <View style={styles.iconParamRow}>
                    <MaterialIcons name="event" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                    <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>Date</Text>
                  </View>
                  <Text style={[styles.paramVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>

                <View style={styles.receiptRow}>
                  <View style={styles.iconParamRow}>
                    <MaterialIcons name="schedule" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                    <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>Check-in Time</Text>
                  </View>
                  <Text style={[styles.paramVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>07:35 AM</Text>
                </View>

                <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.iconParamRow}>
                    <MaterialIcons name="access-time" size={16} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                    <Text style={[styles.paramLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>Shift</Text>
                  </View>
                  <Text style={[styles.paramVal, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {selectedStaff?.shift || 'General Shift'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => setShowSuccessModal(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalPrimaryBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flex: 1,
  },
  mainHeading: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1.2,
    marginBottom: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  typeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTextBox: {
    flex: 1,
    gap: 3,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  typeDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  summaryDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStatCol: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  quickViewHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 6,
  },
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  quickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickCount: {
    fontSize: 14,
    fontWeight: '800',
  },

  /* Roster & Search View Styles */
  searchHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  screenTitleText: {
    fontSize: 17,
    fontWeight: '800',
  },
  calendarIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    borderBottomWidth: 1,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  segmentTabText: {
    fontSize: 14,
  },
  searchScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  searchByHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  searchInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  chipsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  filterChipItem: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterChipItemText: {
    fontSize: 12,
  },
  resultsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  clearSearchLink: {
    color: AppColors.primaryColor,
    fontSize: 13,
    fontWeight: '700',
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  staffAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    color: AppColors.accentColor,
    fontSize: 14,
    fontWeight: '800',
  },
  staffInfoBox: {
    flex: 1,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
  },
  staffRoleMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  staffCheckinTime: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  checkinTimestamp: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Details Styles */
  detailsScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  profileVerifyCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileVerifyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileDetailInfo: {
    flex: 1,
  },
  detailsName: {
    fontSize: 17,
    fontWeight: '800',
  },
  detailsRole: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsTableCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  tableHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  iconParamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tableValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  tableValuePill: {
    fontSize: 12,
    fontWeight: '800',
  },
  redDotStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AppColors.dangerRed,
  },
  statusDotText: {
    color: AppColors.dangerRed,
    fontSize: 12,
    fontWeight: '700',
  },
  markCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryColor,
    height: 52,
    borderRadius: 16,
    gap: 8,
    marginBottom: 12,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  markCheckinBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  historyOutlineBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyOutlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Today's Summary Specific */
  todaySummaryCardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  miniSummaryCard: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  miniSummaryCount: {
    fontSize: 22,
    fontWeight: '800',
  },
  miniSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },

  /* Modal Sheets */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  bottomSheetCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalStaffProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  modalStaffName: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalStaffMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  modalStaffPhone: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  sheetDivider: {
    height: 1,
    marginVertical: 12,
  },
  sheetParamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  paramLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  paramVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkoutInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    height: 36,
    width: 100,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 0,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryColor,
    height: 50,
    borderRadius: 16,
    gap: 8,
    marginTop: 18,
    marginBottom: 10,
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancelBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },

  /* Celebration Modal */
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  successModalCard: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  closeModalCornerBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
  },
  successCircleWrapper: {
    width: 76,
    height: 76,
    borderRadius: 38,
    marginVertical: 12,
    shadowColor: AppColors.secondaryColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  successCircleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  successModalName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  successModalEmpId: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  checkedInGreenBadge: {
    color: AppColors.secondaryColor,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 14,
  },
  receiptBox: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
});
