import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Switch,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from './CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { pickImageFromDevice, capturePhotoFromCamera } from '../utils/filePickerUtils';

export const TEMP_ROLES = [
  'Trainer',
  'Coach',
  'Yoga Instructor',
  'Zumba Instructor',
  'Floor Assistant',
  'Nutritionist',
];

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const PAY_TYPES = [
  { key: 'Hourly', label: 'Per Hour' },
  { key: 'Session', label: 'Per Session' },
  { key: 'Daily', label: 'Daily' },
  { key: 'Weekly', label: 'Weekly' },
  { key: 'Monthly', label: 'Monthly' },
];

export const PAY_FREQUENCIES = [
  'Daily',
  'Weekly',
  'Monthly',
  'Per Session',
  'Per Hour',
];

export const TIME_OPTIONS = [
  '05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM',
];

const formatDateYYYYMMDD = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const AddTempStaffModal = ({ visible, onClose, onSuccess }) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { gym, user } = useAuth();

  // Basic Details
  const [photoUri, setPhotoUri] = useState(null);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Trainer');
  const [employmentType, setEmploymentType] = useState('Temporary'); // 'Temporary' | 'Part-Time'

  // Temporary Staff Period
  const todayStr = useMemo(() => formatDateYYYYMMDD(new Date()), []);
  const defaultEndStr = useMemo(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 1);
    return formatDateYYYYMMDD(end);
  }, []);

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(defaultEndStr);

  // Schedule & Working Days
  const [workingDays, setWorkingDays] = useState(['Mon', 'Wed', 'Fri']);
  const [workingTimeStart, setWorkingTimeStart] = useState('09:00 AM');
  const [workingTimeEnd, setWorkingTimeEnd] = useState('06:00 PM');
  const [isDifferentDays, setIsDifferentDays] = useState(false);
  const [dayWiseHours, setDayWiseHours] = useState({});

  // Pay & Compensation
  const [payType, setPayType] = useState('Hourly');
  const [payAmount, setPayAmount] = useState('500');
  const [payFreq, setPayFreq] = useState('Weekly');
  const [notes, setNotes] = useState('');

  // Auxiliary UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState(null); // { type: 'global-start' | 'global-end' | 'day-start' | 'day-end', day?: string }

  // Toggle Day Selection
  const handleToggleDay = (day) => {
    if (workingDays.includes(day)) {
      setWorkingDays(workingDays.filter((d) => d !== day));
    } else {
      setWorkingDays([...workingDays, day]);
      if (!dayWiseHours[day]) {
        setDayWiseHours((prev) => ({
          ...prev,
          [day]: { startTime: workingTimeStart, endTime: workingTimeEnd },
        }));
      }
    }
  };

  // Add preset months to end date
  const handleAddMonthsToEndDate = (months) => {
    const base = startDate ? new Date(startDate) : new Date();
    base.setMonth(base.getMonth() + months);
    setEndDate(formatDateYYYYMMDD(base));
  };

  // Photo Pick Handler
  const handlePickPhoto = () => {
    pickImageFromDevice({
      onSuccess: (uri) => {
        setPhotoUri(uri);
        showToast({ message: 'Photo selected successfully', isSuccess: true });
      },
      onError: (err) => showToast({ message: err.message, isError: true }),
    });
  };

  // Reset form
  const resetForm = () => {
    setPhotoUri(null);
    setName('');
    setPhone('');
    setEmail('');
    setRole('Trainer');
    setEmploymentType('Temporary');
    setStartDate(todayStr);
    setEndDate(defaultEndStr);
    setWorkingDays(['Mon', 'Wed', 'Fri']);
    setWorkingTimeStart('09:00 AM');
    setWorkingTimeEnd('06:00 PM');
    setIsDifferentDays(false);
    setDayWiseHours({});
    setPayType('Hourly');
    setPayAmount('500');
    setPayFreq('Weekly');
    setNotes('');
  };

  const handleClose = () => {
    resetForm();
    onClose?.();
  };

  // Submit Handler matching exact Website Logic
  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast({ message: 'Full name is required', isError: true });
      return;
    }
    if (!phone.trim()) {
      showToast({ message: 'Phone number is required', isError: true });
      return;
    }

    if (employmentType === 'Part-Time' && workingDays.length === 0) {
      showToast({ message: 'Please select at least one working day', isError: true });
      return;
    }

    setIsSubmitting(true);
    try {
      const activeGymId = gym?._id || gym?.id || user?.gymId || user?.gym?._id || user?.gym?.id;
      const activeGymPartnerId = gym?.partnerId || user?.gym?.partnerId || user?.partnerId || 'GYM1';
      const activeGymName = gym?.name || user?.gym?.name || 'Main Facility';

      const todayFormatted = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      const dayWiseArray = isDifferentDays
        ? workingDays.map((d) => ({
            day: d,
            startTime: dayWiseHours[d]?.startTime || workingTimeStart,
            endTime: dayWiseHours[d]?.endTime || workingTimeEnd,
          }))
        : [];

      const payload = {
        gymId: activeGymId,
        gymPartnerId: activeGymPartnerId,
        gymName: activeGymName,
        name: name.trim(),
        role: role || 'Trainer',
        phone: `${countryCode || '+91'} ${phone.trim()}`.trim(),
        email: email.trim() || `${name.trim().toLowerCase().replace(/\s+/g, '')}@gymezy.com`,
        avatar:
          photoUri ||
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&auto=format&fit=crop',
        joinDate: todayFormatted,
        status: 'Active',
        attendance: 'Present',
        accessType: 'Employee',
        approvalStatus: 'Approved',
        pendingAction: 'NONE',
        type: employmentType || 'Temporary', // 'Temporary' or 'Part-Time'
        schedule: {
          workingDays,
          workingTimeStart,
          workingTimeEnd,
          isDifferentDays,
          dayWiseHours: dayWiseArray,
          startDate: employmentType === 'Temporary' ? startDate : '',
          endDate: employmentType === 'Temporary' ? endDate : '',
        },
        compensation: {
          payType,
          payAmount: Number(payAmount) || 500,
          payFreq,
        },
        notes: notes.trim(),
      };

      const res = await apiService.createEmployee(payload);
      showToast({
        message: `${employmentType} staff "${name.trim()}" added successfully!`,
        isSuccess: true,
      });

      resetForm();
      onClose?.();
      onSuccess?.(res);
    } catch (err) {
      showToast({ message: err.message || 'Failed to add staff', isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                maxHeight: '92%',
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconWrap}>
                  <MaterialIcons name="group-add" size={20} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Add Temp / Part-Time Staff
                  </Text>
                  <Text style={[styles.modalSub, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                    Quick onboarding for visiting trainers & shift staff
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.closeBtn}
              >
                <MaterialIcons name="close" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flexGrow: 1, flexShrink: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
              {/* Photo & Name Card */}
              <View style={styles.photoAndNameCard}>
                <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} style={styles.photoWrap}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoImg} />
                  ) : (
                    <View
                      style={[
                        styles.photoPlaceholder,
                        {
                          backgroundColor: isDark ? 'rgba(124, 58, 237, 0.12)' : '#F5F3FF',
                          borderColor: isDark ? 'rgba(124, 58, 237, 0.35)' : '#DDD6FE',
                        },
                      ]}
                    >
                      <MaterialIcons name="add-a-photo" size={24} color="#7C3AED" />
                      <Text style={styles.photoPlaceholderText}>Photo</Text>
                    </View>
                  )}
                  <View style={styles.photoEditBadge}>
                    <MaterialIcons name="edit" size={12} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    Full Name <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Ramesh Kumar"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Phone & Email */}
              <View style={styles.rowTwoCols}>
                <View style={{ flex: 1.1 }}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    Phone Number <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <View
                    style={[
                      styles.phoneInputWrap,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                  >
                    <View style={styles.countryCodeBadge}>
                      <Text style={[styles.countryCodeText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                        {countryCode}
                      </Text>
                    </View>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      placeholder="9876543210"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[styles.phoneTextInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    Email ID (Optional)
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholder="staff@gymezy.com"
                    placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                        color: isDark ? '#FFFFFF' : '#0F172A',
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Role / Designation */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                  Role / Designation <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.chipsWrap}>
                  {TEMP_ROLES.map((r) => {
                    const isSelected = role === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.chipItem,
                          isSelected
                            ? {
                                backgroundColor: AppColors.primaryColor,
                                borderColor: AppColors.primaryColor,
                              }
                            : {
                                backgroundColor: isDark ? AppColors.darkSurface : '#F1F5F9',
                                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                              },
                        ]}
                        onPress={() => setRole(r)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569',
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Employment Type Selection (Temporary vs Part-Time) */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                  Employment Type <Text style={styles.requiredStar}>*</Text>
                </Text>

                <View style={styles.typeCardsRow}>
                  {/* Temporary Card */}
                  <TouchableOpacity
                    style={[
                      styles.typeCard,
                      employmentType === 'Temporary'
                        ? {
                            backgroundColor: isDark ? 'rgba(124, 58, 237, 0.16)' : '#F5F3FF',
                            borderColor: '#7C3AED',
                          }
                        : {
                            backgroundColor: isDark ? AppColors.darkSurface : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                    ]}
                    onPress={() => setEmploymentType('Temporary')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeCardHeader}>
                      <MaterialIcons
                        name="event"
                        size={20}
                        color={employmentType === 'Temporary' ? '#7C3AED' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.typeCardTitle,
                          {
                            color:
                              employmentType === 'Temporary'
                                ? '#7C3AED'
                                : isDark
                                ? '#FFFFFF'
                                : '#0F172A',
                          },
                        ]}
                      >
                        Temporary
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.typeCardSub,
                        { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                      ]}
                    >
                      For a specific period (start & end date)
                    </Text>
                  </TouchableOpacity>

                  {/* Part-Time Card */}
                  <TouchableOpacity
                    style={[
                      styles.typeCard,
                      employmentType === 'Part-Time'
                        ? {
                            backgroundColor: isDark ? 'rgba(8, 145, 178, 0.16)' : '#ECFEFF',
                            borderColor: '#0891B2',
                          }
                        : {
                            backgroundColor: isDark ? AppColors.darkSurface : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                    ]}
                    onPress={() => setEmploymentType('Part-Time')}
                    activeOpacity={0.85}
                  >
                    <View style={styles.typeCardHeader}>
                      <MaterialIcons
                        name="schedule"
                        size={20}
                        color={employmentType === 'Part-Time' ? '#0891B2' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.typeCardTitle,
                          {
                            color:
                              employmentType === 'Part-Time'
                                ? '#0891B2'
                                : isDark
                                ? '#FFFFFF'
                                : '#0F172A',
                          },
                        ]}
                      >
                        Part-Time
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.typeCardSub,
                        { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' },
                      ]}
                    >
                      Work specific days or shift timings
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Engagement Period (For Temporary Staff) */}
              {employmentType === 'Temporary' && (
                <View
                  style={[
                    styles.subSectionBox,
                    {
                      backgroundColor: isDark ? 'rgba(124, 58, 237, 0.08)' : '#FAF5FF',
                      borderColor: isDark ? 'rgba(124, 58, 237, 0.25)' : '#E9D5FF',
                    },
                  ]}
                >
                  <View style={styles.subSectionHeader}>
                    <MaterialIcons name="date-range" size={17} color="#7C3AED" />
                    <Text style={[styles.subSectionTitle, { color: isDark ? '#DDD6FE' : '#6B21A8' }]}>
                      Engagement Period
                    </Text>
                  </View>

                  <View style={styles.rowTwoCols}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                        Start Date (YYYY-MM-DD)
                      </Text>
                      <TextInput
                        value={startDate}
                        onChangeText={setStartDate}
                        placeholder="2026-11-04"
                        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark ? AppColors.darkSurface : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                            color: isDark ? '#FFFFFF' : '#0F172A',
                          },
                        ]}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                        End Date (YYYY-MM-DD)
                      </Text>
                      <TextInput
                        value={endDate}
                        onChangeText={setEndDate}
                        placeholder="2026-12-04"
                        placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                        style={[
                          styles.input,
                          {
                            backgroundColor: isDark ? AppColors.darkSurface : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                            color: isDark ? '#FFFFFF' : '#0F172A',
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Quick Duration Buttons */}
                  <View style={styles.durationChipsRow}>
                    <Text style={[styles.durationChipsLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Quick Duration:
                    </Text>
                    {[
                      { label: '+1 Month', months: 1 },
                      { label: '+3 Months', months: 3 },
                      { label: '+6 Months', months: 6 },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.label}
                        style={[
                          styles.durationChip,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(124, 58, 237, 0.4)' : '#DDD6FE',
                          },
                        ]}
                        onPress={() => handleAddMonthsToEndDate(opt.months)}
                      >
                        <Text style={[styles.durationChipText, { color: isDark ? '#C084FC' : '#7C3AED' }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Working Schedule (Days & Timings) */}
              <View
                style={[
                  styles.subSectionBox,
                  {
                    backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.subSectionHeader}>
                  <MaterialIcons name="event-available" size={17} color={AppColors.primaryColor} />
                  <Text style={[styles.subSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Working Schedule & Shift Timings
                  </Text>
                </View>

                {/* Days of week selector */}
                <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155', marginBottom: 8 }]}>
                  Working Days <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.daysRow}>
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = workingDays.includes(day);
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayBtn,
                          isSelected
                            ? {
                                backgroundColor: AppColors.primaryColor,
                                borderColor: AppColors.primaryColor,
                              }
                            : {
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                                borderColor: isDark ? AppColors.darkBorder : '#CBD5E1',
                              },
                        ]}
                        onPress={() => handleToggleDay(day)}
                      >
                        <Text
                          style={[
                            styles.dayBtnText,
                            {
                              color: isSelected ? '#FFFFFF' : isDark ? '#94A3B8' : '#475569',
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Standard Hours */}
                {!isDifferentDays && (
                  <View style={styles.rowTwoCols}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                        Shift Start
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.timeBtn,
                          {
                            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                        ]}
                        onPress={() => setTimePickerTarget({ type: 'global-start' })}
                      >
                        <MaterialIcons name="schedule" size={16} color={AppColors.primaryColor} />
                        <Text style={[styles.timeBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {workingTimeStart}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                        Shift End
                      </Text>
                      <TouchableOpacity
                        style={[
                          styles.timeBtn,
                          {
                            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          },
                        ]}
                        onPress={() => setTimePickerTarget({ type: 'global-end' })}
                      >
                        <MaterialIcons name="schedule" size={16} color={AppColors.primaryColor} />
                        <Text style={[styles.timeBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                          {workingTimeEnd}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Different time for different days toggle */}
                <View style={styles.diffDaysToggleRow}>
                  <Text style={[styles.diffDaysText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                    Different time for different days
                  </Text>
                  <Switch
                    value={isDifferentDays}
                    onValueChange={setIsDifferentDays}
                    trackColor={{ false: '#94A3B8', true: AppColors.primaryColor }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Day-Wise Hours List */}
                {isDifferentDays && (
                  <View style={styles.dayWiseContainer}>
                    {workingDays.length === 0 ? (
                      <Text style={{ fontSize: 12, color: AppColors.warningAmber, marginVertical: 6 }}>
                        Please select working days first.
                      </Text>
                    ) : (
                      workingDays.map((day) => {
                        const start = dayWiseHours[day]?.startTime || workingTimeStart;
                        const end = dayWiseHours[day]?.endTime || workingTimeEnd;
                        return (
                          <View key={day} style={styles.dayWiseRow}>
                            <View style={styles.dayWiseBadge}>
                              <Text style={styles.dayWiseBadgeText}>{day}</Text>
                            </View>

                            <TouchableOpacity
                              style={[
                                styles.dayWiseTimeBtn,
                                {
                                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                                },
                              ]}
                              onPress={() => setTimePickerTarget({ type: 'day-start', day })}
                            >
                              <Text style={[styles.dayWiseTimeText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                                {start}
                              </Text>
                            </TouchableOpacity>

                            <Text style={{ color: isDark ? '#64748B' : '#94A3B8' }}>-</Text>

                            <TouchableOpacity
                              style={[
                                styles.dayWiseTimeBtn,
                                {
                                  backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                                },
                              ]}
                              onPress={() => setTimePickerTarget({ type: 'day-end', day })}
                            >
                              <Text style={[styles.dayWiseTimeText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                                {end}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>

              {/* Pay / Compensation */}
              <View
                style={[
                  styles.subSectionBox,
                  {
                    backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.subSectionHeader}>
                  <MaterialIcons name="payments" size={17} color={AppColors.successGreen} />
                  <Text style={[styles.subSectionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    Pay & Compensation
                  </Text>
                </View>

                {/* Pay Type Chips */}
                <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                  Pay Type <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.chipsWrap}>
                  {PAY_TYPES.map((pt) => {
                    const isSelected = payType === pt.key;
                    return (
                      <TouchableOpacity
                        key={pt.key}
                        style={[
                          styles.chipItem,
                          isSelected
                            ? {
                                backgroundColor: AppColors.primaryColor,
                                borderColor: AppColors.primaryColor,
                              }
                            : {
                                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                              },
                        ]}
                        onPress={() => setPayType(pt.key)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569',
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {pt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Amount & Frequency */}
                <View style={[styles.rowTwoCols, { marginTop: 8 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                      Amount (₹) <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TextInput
                      value={payAmount}
                      onChangeText={setPayAmount}
                      keyboardType="numeric"
                      placeholder="500"
                      placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                      style={[
                        styles.input,
                        {
                          backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                          borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                          color: isDark ? '#FFFFFF' : '#0F172A',
                          fontWeight: '700',
                        },
                      ]}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                      Payout Frequency
                    </Text>
                    <View style={styles.chipsWrap}>
                      {['Daily', 'Weekly', 'Monthly'].map((f) => {
                        const isSelected = payFreq === f;
                        return (
                          <TouchableOpacity
                            key={f}
                            style={[
                              styles.chipItemMini,
                              isSelected
                                ? { backgroundColor: '#7C3AED', borderColor: '#7C3AED' }
                                : {
                                    backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                                  },
                            ]}
                            onPress={() => setPayFreq(f)}
                          >
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: isSelected ? '700' : '500',
                                color: isSelected ? '#FFFFFF' : isDark ? '#CBD5E1' : '#475569',
                              }}
                            >
                              {f}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>

              {/* Additional Notes */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.fieldLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                  Additional Notes (Optional)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={2}
                  placeholder="Enter any additional shift instructions or qualifications..."
                  placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      color: isDark ? '#FFFFFF' : '#0F172A',
                    },
                  ]}
                />
              </View>

              {/* Deactivation Notice Banner (Exact Web Copy) */}
              <View
                style={[
                  styles.deactivationBanner,
                  {
                    backgroundColor: isDark ? 'rgba(124, 58, 237, 0.12)' : '#F5F3FF',
                    borderColor: isDark ? 'rgba(124, 58, 237, 0.3)' : '#DDD6FE',
                  },
                ]}
              >
                <MaterialIcons name="info-outline" size={18} color="#7C3AED" />
                <Text style={[styles.deactivationBannerText, { color: isDark ? '#DDD6FE' : '#6B21A8' }]}>
                  Temporary staff will be automatically deactivated after the engagement end date.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Action Buttons (Fixed Footer) */}
            <View
              style={[
                styles.actionBtnRow,
                {
                  paddingTop: 12,
                  marginTop: 6,
                  borderTopWidth: 1,
                  borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: isDark ? AppColors.darkSurface : '#F1F5F9',
                    borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                  },
                ]}
                onPress={handleClose}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: AppColors.primaryColor }]}
                onPress={handleSubmit}
                disabled={isSubmitting}
                activeOpacity={0.88}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.submitBtnText}>Add Staff</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Auxiliary Time Picker Sheet */}
      <Modal
        visible={!!timePickerTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <TouchableOpacity
          style={styles.timePickerOverlay}
          activeOpacity={1}
          onPress={() => setTimePickerTarget(null)}
        >
          <View
            style={[
              styles.timePickerContent,
              { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
            ]}
          >
            <View style={styles.timePickerHeader}>
              <Text style={[styles.timePickerTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Select Time Slot
              </Text>
              <TouchableOpacity onPress={() => setTimePickerTarget(null)}>
                <MaterialIcons name="close" size={20} color={isDark ? '#FFFFFF' : '#0F172A'} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              <View style={styles.timeGrid}>
                {TIME_OPTIONS.map((slot) => (
                  <TouchableOpacity
                    key={slot}
                    style={[
                      styles.timeSlotPill,
                      {
                        backgroundColor: isDark ? AppColors.darkSurface : '#F1F5F9',
                        borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                      },
                    ]}
                    onPress={() => {
                      if (!timePickerTarget) return;
                      const { type, day } = timePickerTarget;
                      if (type === 'global-start') setWorkingTimeStart(slot);
                      else if (type === 'global-end') setWorkingTimeEnd(slot);
                      else if (type === 'day-start' && day) {
                        setDayWiseHours((prev) => ({
                          ...prev,
                          [day]: { ...(prev[day] || {}), startTime: slot },
                        }));
                      } else if (type === 'day-end' && day) {
                        setDayWiseHours((prev) => ({
                          ...prev,
                          [day]: { ...(prev[day] || {}), endTime: slot },
                        }));
                      }
                      setTimePickerTarget(null);
                    }}
                  >
                    <Text style={[styles.timeSlotText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modalSub: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  photoAndNameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  photoWrap: {
    position: 'relative',
  },
  photoImg: {
    width: 68,
    height: 68,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  photoPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoPlaceholderText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#7C3AED',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 5,
  },
  requiredStar: {
    color: AppColors.dangerRed,
  },
  input: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  countryCodeBadge: {
    paddingHorizontal: 10,
    borderRightWidth: 1,
    borderRightColor: 'rgba(148, 163, 184, 0.25)',
    justifyContent: 'center',
    height: '100%',
  },
  countryCodeText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  phoneTextInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 10,
    fontSize: 13,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipItem: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipItemMini: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11.5,
  },
  typeCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
  },
  typeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  typeCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  typeCardSub: {
    fontSize: 10,
    lineHeight: 14,
  },
  subSectionBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  subSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  subSectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  durationChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  durationChipsLabel: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  durationChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  durationChipText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dayBtn: {
    width: 40,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnText: {
    fontSize: 11,
  },
  timeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    gap: 6,
  },
  timeBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  diffDaysToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
  },
  diffDaysText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  dayWiseContainer: {
    marginTop: 8,
    gap: 6,
  },
  dayWiseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayWiseBadge: {
    width: 40,
    alignItems: 'center',
  },
  dayWiseBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#7C3AED',
  },
  dayWiseTimeBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayWiseTimeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 12.5,
    textAlignVertical: 'top',
  },
  deactivationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  deactivationBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '500',
    lineHeight: 16,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1.6,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    elevation: 3,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  timePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  timePickerContent: {
    width: '90%',
    maxWidth: 360,
    borderRadius: 18,
    padding: 18,
    elevation: 8,
  },
  timePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
    marginBottom: 12,
  },
  timePickerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlotPill: {
    width: '30%',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
});
