import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { apiService } from '../services/apiService';

export const SECTION_CATEGORIES = [
  { key: 'yoga', label: 'Yoga', icon: 'self-improvement', color: '#7C3AED' },
  { key: 'gym', label: 'Gym Access', icon: 'fitness-center', color: '#003882' },
  { key: 'zumba', label: 'Zumba', icon: 'music-note', color: '#DB2777' },
  { key: 'crossfit', label: 'CrossFit', icon: 'flash-on', color: '#EA580C' },
  { key: 'hiit', label: 'HIIT', icon: 'local-fire-department', color: '#E11D48' },
  { key: 'pilates', label: 'Pilates', icon: 'spa', color: '#059669' },
  { key: 'boxing', label: 'Boxing', icon: 'sports-mma', color: '#D97706' },
  { key: 'other', label: 'Other', icon: 'category', color: '#4B5563' },
];

export const TIME_SLOTS = [
  '05:00 AM', '05:30 AM', '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM',
  '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM', '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM',
  '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM', '10:00 PM', '10:30 PM',
];

export const ALL_DAYS = [
  { id: 'Mon', label: 'M', full: 'Monday' },
  { id: 'Tue', label: 'T', full: 'Tuesday' },
  { id: 'Wed', label: 'W', full: 'Wednesday' },
  { id: 'Thu', label: 'T', full: 'Thursday' },
  { id: 'Fri', label: 'F', full: 'Friday' },
  { id: 'Sat', label: 'S', full: 'Saturday' },
  { id: 'Sun', label: 'S', full: 'Sunday' },
];

// Date format helpers for DD-MM-YYYY
export const formatToDDMMYYYY = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(dateInput)) return dateInput;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const parseDDMMYYYYtoStandard = (dateStr) => {
  if (!dateStr) return null;
  const clean = String(dateStr).trim();
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 2 && parts[2].length === 4) {
      // DD-MM-YYYY -> YYYY-MM-DD
      const [dd, mm, yyyy] = parts;
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    if (parts[0].length === 4 && parts[2].length <= 2) {
      // YYYY-MM-DD
      return clean;
    }
  }
  const d = new Date(clean);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return null;
};

/**
 * Calculates exact completion date by counting occurrences of active weekly days
 */
export const calculateScheduleEndDate = (startDateInput, durationDaysInput, activeDaysInput) => {
  if (!startDateInput) return null;
  const standardDateStr = parseDDMMYYYYtoStandard(startDateInput);
  if (!standardDateStr) return null;
  const d = new Date(standardDateStr);
  if (Number.isNaN(d.getTime())) return null;

  const targetSessions = Math.max(1, Number(durationDaysInput) || 1);
  const activeDaysSet = new Set(
    Array.isArray(activeDaysInput) && activeDaysInput.length > 0
      ? activeDaysInput
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let current = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  let sessionsCounted = 0;
  let safetyLimit = 365 * 5;

  while (safetyLimit > 0) {
    const dayName = dayNames[current.getDay()];
    if (activeDaysSet.has(dayName)) {
      sessionsCounted += 1;
      if (sessionsCounted >= targetSessions) {
        return current;
      }
    }
    current.setDate(current.getDate() + 1);
    safetyLimit -= 1;
  }
  return current;
};

export const CreateSectionModal = ({
  visible,
  onClose,
  onSuccess,
  gymId,
  initialSection = null,
}) => {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Form States
  const [title, setTitle] = useState(initialSection?.title || '');
  const [category, setCategory] = useState(initialSection?.category || 'yoga');
  const [trainerId, setTrainerId] = useState(
    initialSection?.trainerId?._id || initialSection?.trainerId || ''
  );
  const [cost, setCost] = useState(initialSection?.cost ? String(initialSection.cost) : '1500');
  const [startDate, setStartDate] = useState(
    initialSection?.startDate
      ? formatToDDMMYYYY(initialSection.startDate)
      : formatToDDMMYYYY(new Date())
  );
  const [durationDays, setDurationDays] = useState(
    initialSection?.durationDays ? String(initialSection.durationDays) : '20'
  );
  const [startTime, setStartTime] = useState(initialSection?.startTime || '06:00 AM');
  const [endTime, setEndTime] = useState(initialSection?.endTime || '07:00 AM');
  const [activeDays, setActiveDays] = useState(
    initialSection?.activeDays || ['Mon', 'Wed', 'Fri']
  );
  const [maxCapacity, setMaxCapacity] = useState(
    initialSection?.maxCapacity ? String(initialSection.maxCapacity) : '25'
  );
  const [description, setDescription] = useState(initialSection?.description || '');
  const [inclusions, setInclusions] = useState(
    Array.isArray(initialSection?.inclusions)
      ? initialSection.inclusions.join('\n')
      : initialSection?.inclusions || ''
  );
  const [instructions, setInstructions] = useState(initialSection?.instructions || '');

  // Sub-Pickers State
  const [showTrainerPicker, setShowTrainerPicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Available Trainers List
  const [trainers, setTrainers] = useState([]);
  const [allEvaluatedTrainers, setAllEvaluatedTrainers] = useState([]);
  const [isLoadingTrainers, setIsLoadingTrainers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Available Trainers for the proposed Schedule dynamically
  useEffect(() => {
    if (!visible) return;

    let isMounted = true;
    const fetchTrainersList = async () => {
      setIsLoadingTrainers(true);
      try {
        const standardStartDate = parseDDMMYYYYtoStandard(startDate);
        const data = await apiService.getAvailableTrainers({
          startDate: standardStartDate || undefined,
          durationDays: Math.max(1, Number(durationDays) || 20),
          activeDays,
          startTime,
          endTime,
          excludeSectionId: initialSection?._id || undefined,
        });

        if (isMounted) {
          const availList = Array.isArray(data?.availableTrainers) ? data.availableTrainers : [];
          const allEv = Array.isArray(data?.allTrainers) ? data.allTrainers : [];
          setTrainers(availList);
          setAllEvaluatedTrainers(allEv);

          // If current trainerId is no longer in the available list, select first or null
          setTrainerId((currentId) => {
            const stillAvailable = availList.some((t) => (t._id || t.id) === currentId);
            if (stillAvailable) return currentId;
            return availList.length > 0 ? (availList[0]._id || availList[0].id) : null;
          });
        }
      } catch (err) {
        console.warn('Failed to load available trainers for section:', err.message);
      } finally {
        if (isMounted) setIsLoadingTrainers(false);
      }
    };

    fetchTrainersList();
    return () => {
      isMounted = false;
    };
  }, [visible, startDate, durationDays, activeDays, startTime, endTime, initialSection?._id]);

  // Selected Trainer Object (Checking both available and all evaluated trainers so name is never missing)
  const selectedTrainer = useMemo(() => {
    const list = trainers.length > 0 ? trainers : allEvaluatedTrainers;
    return list.find((t) => (t._id || t.id) === trainerId) || null;
  }, [trainers, allEvaluatedTrainers, trainerId]);
  }, [trainers, trainerId]);

  // Estimated End Date calculation in DD-MM-YYYY taking weekly active days into account
  const estimatedEndDate = useMemo(() => {
    if (!startDate) return '—';
    const end = calculateScheduleEndDate(startDate, durationDays, activeDays);
    if (!end) return '—';
    return formatToDDMMYYYY(end);
  }, [startDate, durationDays, activeDays]);

  // Toggle Day Selection
  const toggleDay = useCallback((dayId) => {
    setActiveDays((prev) => {
      if (prev.includes(dayId)) {
        if (prev.length === 1) {
          Alert.alert('Required', 'At least one active day of the week must be selected.');
          return prev;
        }
        return prev.filter((d) => d !== dayId);
      }
      return [...prev, dayId];
    });
  }, []);

  // Submit Handler
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter section name.');
      return;
    }

    if (!trainerId) {
      Alert.alert('Validation Error', 'Please assign a trainer for this section.');
      return;
    }

    const parsedCost = Number(cost);
    if (Number.isNaN(parsedCost) || parsedCost < 0) {
      Alert.alert('Validation Error', 'Please enter a valid section cost.');
      return;
    }

    const standardStartDate = parseDDMMYYYYtoStandard(startDate);
    if (!standardStartDate) {
      Alert.alert('Validation Error', 'Please enter a valid starting date in DD-MM-YYYY format (e.g. 21-10-2026).');
      return;
    }

    const daysCount = Math.max(1, Number(durationDays) || 20);
    const calculatedEnd = calculateScheduleEndDate(standardStartDate, daysCount, activeDays) || new Date(standardStartDate);

    const payload = {
      gymId,
      trainerId, // Connected strictly by ID only
      title: title.trim(),
      category,
      cost: parsedCost,
      startDate: standardStartDate,
      endDate: calculatedEnd.toISOString(),
      durationDays: daysCount,
      startTime,
      endTime,
      activeDays,
      maxCapacity: Math.max(1, Number(maxCapacity) || 25),
      description: description.trim(),
      inclusions: inclusions ? inclusions.split('\n').map((s) => s.trim()).filter(Boolean) : [],
      instructions: instructions.trim(),
      isActive: true,
    };

    setIsSubmitting(true);
    try {
      let result;
      if (initialSection?._id) {
        result = await apiService.updateSection(initialSection._id, payload);
      } else {
        result = await apiService.createSection(payload);
      }

      Alert.alert(
        'Success',
        `Section "${payload.title}" has been ${initialSection?._id ? 'updated' : 'published'} successfully!`,
        [
          {
            text: 'OK',
            onPress: () => {
              if (onSuccess) onSuccess(result);
              if (onClose) onClose();
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to create section.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Card background and border dynamic styles
  const cardBg = isDark ? AppColors.darkCard : '#FFFFFF';
  const inputBg = isDark ? '#1E293B' : '#F8FAFC';
  const borderCol = isDark ? AppColors.darkBorder : '#E2E8F0';
  const textCol = isDark ? '#FFFFFF' : '#0F172A';
  const subTextCol = isDark ? '#94A3B8' : '#64748B';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: cardBg,
              paddingBottom: insets.bottom > 0 ? insets.bottom + 12 : (Platform.OS === 'ios' ? 34 : 24),
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: borderCol }]}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconBadge}>
                <MaterialIcons name="event-note" size={20} color="#003882" />
              </View>
              <Text style={[styles.headerTitle, { color: textCol }]}>
                {initialSection ? 'Edit Section' : 'Create New Section'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialIcons name="close" size={22} color={subTextCol} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Section Name / Title */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: textCol }]}>
                Section Name / Title <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
                placeholder="Enter section title"
                placeholderTextColor={subTextCol}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Category Selector */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: textCol }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
                {SECTION_CATEGORIES.map((cat) => {
                  const isSelected = category === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setCategory(cat.key)}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: isSelected ? '#003882' : inputBg,
                          borderColor: isSelected ? '#003882' : borderCol,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={cat.icon}
                        size={15}
                        color={isSelected ? '#FFFFFF' : cat.color}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.categoryText, { color: isSelected ? '#FFFFFF' : textCol }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Assigned Trainer Picker */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: textCol }]}>
                Assigned Trainer <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => setShowTrainerPicker(true)}
                style={[styles.pickerTrigger, { backgroundColor: inputBg, borderColor: borderCol }]}
              >
                <View style={styles.pickerTriggerLeft}>
                  <MaterialIcons name="person" size={20} color="#003882" style={{ marginRight: 8 }} />
                  <Text style={[styles.pickerTriggerText, { color: textCol }]}>
                    {isLoadingTrainers
                      ? 'Checking trainer availability...'
                      : selectedTrainer
                      ? selectedTrainer.name
                      : 'Select an available trainer'}
                  </Text>
                </View>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={subTextCol} />
              </TouchableOpacity>
            </View>

            {/* Cost & Capacity in 2 columns */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.inputLabel, { color: textCol }]}>
                  Cost (₹) <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
                  placeholder="1500"
                  placeholderTextColor={subTextCol}
                  keyboardType="numeric"
                  value={cost}
                  onChangeText={setCost}
                />
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.inputLabel, { color: textCol }]}>Capacity (Seats)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
                  placeholder="25"
                  placeholderTextColor={subTextCol}
                  keyboardType="numeric"
                  value={maxCapacity}
                  onChangeText={setMaxCapacity}
                />
              </View>
            </View>

            {/* Start Date & Duration in 2 columns */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.formGroup, { flex: 1.2, marginRight: 8 }]}>
                <Text style={[styles.inputLabel, { color: textCol }]}>
                  Start Date (DD-MM-YYYY) <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
                  placeholder="21-10-2026"
                  placeholderTextColor={subTextCol}
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>

              <View style={[styles.formGroup, { flex: 0.8, marginLeft: 8 }]}>
                <Text style={[styles.inputLabel, { color: textCol }]}>Duration (Days)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: inputBg, borderColor: borderCol, color: textCol }]}
                  placeholder="20"
                  placeholderTextColor={subTextCol}
                  keyboardType="numeric"
                  value={durationDays}
                  onChangeText={setDurationDays}
                />
              </View>
            </View>

            {/* Estimated End Date Banner */}
            <View
              style={[
                styles.estEndDateBanner,
                { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: borderCol },
              ]}
            >
              <MaterialIcons name="event" size={18} color="#003882" style={{ marginRight: 8 }} />
              <Text style={[styles.estEndDateLabel, { color: subTextCol }]}>Estimated End Date: </Text>
              <Text style={[styles.estEndDateVal, { color: isDark ? '#93C5FD' : '#003882' }]}>
                {estimatedEndDate}
              </Text>
            </View>

            {/* Start Time & End Time */}
            <View style={styles.rowTwoCols}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.inputLabel, { color: textCol }]}>Start Time</Text>
                <TouchableOpacity
                  onPress={() => setShowStartTimePicker(true)}
                  style={[styles.pickerTrigger, { backgroundColor: inputBg, borderColor: borderCol }]}
                >
                  <Text style={[styles.pickerTriggerText, { color: textCol }]}>{startTime}</Text>
                  <MaterialIcons name="schedule" size={18} color="#003882" />
                </TouchableOpacity>
              </View>

              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.inputLabel, { color: textCol }]}>End Time</Text>
                <TouchableOpacity
                  onPress={() => setShowEndTimePicker(true)}
                  style={[styles.pickerTrigger, { backgroundColor: inputBg, borderColor: borderCol }]}
                >
                  <Text style={[styles.pickerTriggerText, { color: textCol }]}>{endTime}</Text>
                  <MaterialIcons name="schedule" size={18} color="#003882" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekly Schedule Days */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: textCol }]}>
                Weekly Schedule (Recurring Days)
              </Text>
              <View style={styles.daysRow}>
                {ALL_DAYS.map((d) => {
                  const isSelected = activeDays.includes(d.id);
                  return (
                    <TouchableOpacity
                      key={d.id}
                      onPress={() => toggleDay(d.id)}
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: isSelected ? '#003882' : inputBg,
                          borderColor: isSelected ? '#003882' : borderCol,
                        },
                      ]}
                    >
                      <Text style={[styles.dayText, { color: isSelected ? '#FFFFFF' : textCol }]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.daysSummaryText, { color: subTextCol }]}>
                Active on: {activeDays.join(', ')}
              </Text>
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: textCol }]}>Description / Guidelines</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  { backgroundColor: inputBg, borderColor: borderCol, color: textCol },
                ]}
                placeholder="Details about syllabus, prerequisites or equipment..."
                placeholderTextColor={subTextCol}
                multiline
                numberOfLines={3}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Inclusions Field */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: textCol }]}>What's Included (One item per line)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  { backgroundColor: inputBg, borderColor: borderCol, color: textCol },
                ]}
                placeholder={'e.g.\nFull trainer-guided batch sessions\nDedicated yoga studio mats\nLocker and shower facility access'}
                placeholderTextColor={subTextCol}
                multiline
                numberOfLines={3}
                value={inclusions}
                onChangeText={setInclusions}
              />
            </View>

            {/* Guidelines / Instructions */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: textCol }]}>Special Guidelines / Notice</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  { backgroundColor: inputBg, borderColor: borderCol, color: textCol },
                ]}
                placeholder="e.g. Please arrive 10 minutes before the scheduled time slot."
                placeholderTextColor={subTextCol}
                multiline
                numberOfLines={2}
                value={instructions}
                onChangeText={setInstructions}
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footerRow, { borderTopColor: borderCol }]}>
            <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { borderColor: borderCol }]}>
              <Text style={[styles.cancelBtnText, { color: subTextCol }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || trainers.length === 0 || !trainerId}
              style={[
                styles.submitBtn,
                { opacity: isSubmitting || trainers.length === 0 || !trainerId ? 0.45 : 1 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {initialSection ? 'Save Changes' : 'Create Section'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Trainer Picker Sub-Modal */}
      <Modal visible={showTrainerPicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: cardBg }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: textCol }]}>Select Available Trainer</Text>
              <TouchableOpacity onPress={() => setShowTrainerPicker(false)}>
                <MaterialIcons name="close" size={20} color={subTextCol} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {isLoadingTrainers ? (
                <ActivityIndicator size="small" color="#003882" style={{ padding: 20 }} />
              ) : (allEvaluatedTrainers.length > 0 ? allEvaluatedTrainers : trainers).length === 0 ? (
                <Text style={{ padding: 20, textAlign: 'center', color: subTextCol }}>
                  No trainers found in gym staff records.
                </Text>
              ) : (
                (allEvaluatedTrainers.length > 0 ? allEvaluatedTrainers : trainers).map((t) => {
                  const isAvail = t.isAvailable !== false;
                  const isSelected = (t._id || t.id) === trainerId;
                  return (
                    <TouchableOpacity
                      key={t._id || t.id}
                      disabled={!isAvail}
                      onPress={() => {
                        if (isAvail) {
                          setTrainerId(t._id || t.id);
                          setShowTrainerPicker(false);
                        }
                      }}
                      style={[
                        styles.pickerItem,
                        {
                          backgroundColor: isSelected ? 'rgba(0, 56, 130, 0.1)' : 'transparent',
                          borderColor: borderCol,
                          opacity: isAvail ? 1 : 0.5,
                        },
                      ]}
                    >
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.pickerItemTitle, { color: textCol }]}>{t.name}</Text>
                        <Text style={[styles.pickerItemSub, { color: subTextCol }]}>
                          {t.specialty || t.role || 'Trainer'} {t.employeeId ? `• ${t.employeeId}` : ''}
                        </Text>
                      </View>
                      {isSelected ? (
                        <MaterialIcons name="check" size={18} color="#003882" />
                      ) : isAvail ? (
                        <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ color: '#166534', fontSize: 11, fontWeight: '600' }}>Available</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: isDark ? '#334155' : '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>Not Available</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Start Time Picker Sub-Modal */}
      <Modal visible={showStartTimePicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: cardBg }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: textCol }]}>Select Start Time</Text>
              <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                <MaterialIcons name="close" size={20} color={subTextCol} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 280 }}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  onPress={() => {
                    setStartTime(slot);
                    setShowStartTimePicker(false);
                  }}
                  style={[
                    styles.pickerItem,
                    {
                      backgroundColor: startTime === slot ? 'rgba(0, 56, 130, 0.1)' : 'transparent',
                      borderColor: borderCol,
                    },
                  ]}
                >
                  <Text style={[styles.pickerItemTitle, { color: textCol }]}>{slot}</Text>
                  {startTime === slot ? <MaterialIcons name="check" size={18} color="#003882" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* End Time Picker Sub-Modal */}
      <Modal visible={showEndTimePicker} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerCard, { backgroundColor: cardBg }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: textCol }]}>Select End Time</Text>
              <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                <MaterialIcons name="close" size={20} color={subTextCol} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 280 }}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  onPress={() => {
                    setEndTime(slot);
                    setShowEndTimePicker(false);
                  }}
                  style={[
                    styles.pickerItem,
                    {
                      backgroundColor: endTime === slot ? 'rgba(0, 56, 130, 0.1)' : 'transparent',
                      borderColor: borderCol,
                    },
                  ]}
                >
                  <Text style={[styles.pickerItemTitle, { color: textCol }]}>{slot}</Text>
                  {endTime === slot ? <MaterialIcons name="check" size={18} color="#003882" /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 56, 130, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  formGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#EF4444',
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 72,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  categoriesScroll: {
    flexDirection: 'row',
    marginTop: 2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rowTwoCols: {
    flexDirection: 'row',
  },
  pickerTrigger: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerTriggerText: {
    fontSize: 14,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 13,
    fontWeight: '700',
  },
  daysSummaryText: {
    fontSize: 11,
    marginTop: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#003882',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  pickerCard: {
    borderRadius: 16,
    padding: 16,
    elevation: 5,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
  },
  pickerItemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickerItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  estEndDateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  estEndDateLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  estEndDateVal: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default CreateSectionModal;
