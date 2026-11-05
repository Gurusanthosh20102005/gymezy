import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  StatusBar,
  Platform,
  Alert,
  Modal,
  PermissionsAndroid,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
import Camera from 'react-native-camera-kit/dist/Camera.android';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { AddWalkInBookingModal } from '../widgets/AddWalkInBookingModal';

const SEARCH_FILTER_CHIPS = [
  'Customer Name',
  'Phone Number',
  'Customer ID',
  'Member ID',
  'Booking ID',
];

const SESSION_AREAS = [
  'General Workout',
  'Cardio Zone',
  'Strength Floor',
  'CrossFit / HIIT',
  'Yoga Studio',
  'Personal Coaching',
];

export const CheckInScreen = ({ navigation, route }) => {
  const { isDark } = useTheme();
  const { showToast } = useToast();
  const { gym } = useAuth();
  const insets = useSafeAreaInsets();

  // Mode: 'HUB' | 'QR' | 'SEARCH' | 'DETAILS' | 'SUCCESS'
  const initialMode = route?.params?.initialMode || 'HUB';
  const [currentStep, setCurrentStep] = useState(initialMode);

  // Search state
  const [searchCategoryTab, setSearchCategoryTab] = useState('Customer Check-in'); // 'Customer Check-in' | 'Member Check-in'
  const [activeChip, setActiveChip] = useState('Customer Name');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveMembers, setLiveMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedArea, setSelectedArea] = useState('General Workout');
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [flashlight, setFlashlight] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const isScanningRef = useRef(false);

  // Fetch live members for check-in
  useEffect(() => {
    const gymId = gym?.id || gym?._id || gym?.partnerId;
    if (!gymId) return;

    const fetchLiveMembers = async () => {
      try {
        setIsLoadingMembers(true);
        const res = await apiService.searchAttendanceMembers({ gymId, query: '' });
        if (Array.isArray(res)) {
          setLiveMembers(res);
        }
      } catch (err) {
        console.log('Error fetching members for check-in:', err.message);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchLiveMembers();
  }, [gym?.id, gym?._id, gym?.partnerId]);

  // Animated laser bar for QR scanner
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Animation for success checkmark
  const successScaleAnim = useRef(new Animated.Value(0.4)).current;
  const successRotateAnim = useRef(new Animated.Value(0)).current;

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44
  );

  // Check and request camera permission on QR screen
  useEffect(() => {
    if (currentStep === 'QR') {
      isScanningRef.current = false;
      const checkPermission = async () => {
        if (Platform.OS === 'android') {
          try {
            const has = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (has) {
              setHasCameraPermission(true);
            } else {
              const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
                title: 'Camera Access Needed',
                message: 'GYMEZY requires camera access to scan member QR passes.',
                buttonPositive: 'Allow',
                buttonNegative: 'Cancel',
              });
              setHasCameraPermission(res === PermissionsAndroid.RESULTS.GRANTED);
            }
          } catch {
            setHasCameraPermission(false);
          }
        } else {
          setHasCameraPermission(true);
        }
      };
      checkPermission();
    }
  }, [currentStep]);

  // Laser scanner loop animation
  useEffect(() => {
    if (currentStep === 'QR') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 200,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [currentStep, laserAnim]);

  // Success screen animation
  useEffect(() => {
    if (currentStep === 'SUCCESS') {
      Animated.parallel([
        Animated.spring(successScaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(successRotateAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentStep, successScaleAnim, successRotateAnim]);

  // Filter members based on search query and active search chip
  const filteredResults = liveMembers.filter((m) => {
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase().trim();

    if (activeChip === 'Customer Name') return m.name?.toLowerCase().includes(q);
    if (activeChip === 'Phone Number') return m.phone?.includes(q);
    if (activeChip === 'Customer ID') return m.customerId?.toLowerCase().includes(q) || m.userId?.toLowerCase().includes(q);
    if (activeChip === 'Member ID') return m.membershipId?.toLowerCase().includes(q) || m.id?.toLowerCase().includes(q);
    if (activeChip === 'Booking ID') return m.bookingId?.toLowerCase().includes(q);

    return (
      m.name?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.customerId?.toLowerCase().includes(q) ||
      m.userId?.toLowerCase().includes(q) ||
      m.membershipId?.toLowerCase().includes(q) ||
      m.bookingId?.toLowerCase().includes(q)
    );
  });

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    setCurrentStep('DETAILS');
  };

  const handleConfirmCheckin = async () => {
    if (!selectedMember) return;
    const now = new Date();
    const isUpcoming =
      selectedMember.status === 'UPCOMING' ||
      selectedMember.status === 'Upcoming' ||
      (selectedMember.startDate && new Date(selectedMember.startDate) > now);

    if (isUpcoming) {
      const startStr = selectedMember.startDate
        ? new Date(selectedMember.startDate).toLocaleDateString()
        : 'a future date';
      Alert.alert(
        'Upcoming Membership',
        `This membership pass is not active yet (Starts on ${startStr}). Entry is not permitted before the start date.`,
        [{ text: 'OK' }]
      );
      return;
    }

    if (selectedMember.status === 'EXPIRED' || selectedMember.status === 'Expired' || (selectedMember.endDate && new Date(selectedMember.endDate) < now)) {
      Alert.alert(
        'Expired Membership',
        'This membership pass has expired. Please renew the membership before marking check-in.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (selectedMember.status === 'CANCELLED' || selectedMember.status === 'Cancelled') {
      Alert.alert(
        'Cancelled Membership',
        'This membership pass has been cancelled. Entry is not permitted.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const gymId = gym?.id || gym?._id || gym?.partnerId;
      const res = await apiService.checkInMember({
        gymId,
        code: selectedMember.membershipId || selectedMember.id || selectedMember.entryOtp,
        otp: selectedMember.entryOtp,
        area: selectedArea,
        method: currentStep === 'QR' ? 'QR' : 'Manual',
        verifiedBy: 'Gym Owner App',
      });

      const isCheckout = res?.action === 'CHECK_OUT';
      const memberData = res?.member || {};
      setSelectedMember((prev) => ({
        ...prev,
        action: res?.action || 'CHECK_IN',
        durationStr: res?.durationStr || '',
        checkInTime: res?.checkInTime,
        checkOutTime: res?.checkOutTime,
        area: res?.area || selectedArea,
        attendedSessionsCount: memberData.attendedSessionsCount,
        durationDays: memberData.durationDays,
        bookingType: memberData.bookingType || prev?.bookingType,
      }));

      showToast({
        message: isCheckout
          ? `Check-out recorded for ${selectedMember.name}! Duration: ${res?.durationStr}`
          : `${selectedMember.name} checked in successfully for ${res?.area || selectedArea}!`,
        isSuccess: true,
      });
      setCurrentStep('SUCCESS');
    } catch (err) {
      Alert.alert('Verification Failed', err.message || 'Unable to process member entry/exit.');
    }
  };

  // Live QR Code Scanner detection handler
  const handleScanCode = async (rawCode) => {
    if (!rawCode || isScanningRef.current) return;
    const cleanCode = String(rawCode).trim();
    isScanningRef.current = true;

    let codeToSend = cleanCode;
    let otpToSend = null;
    try {
      if (cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
        const parsed = JSON.parse(cleanCode);
        codeToSend = parsed.id || parsed.membershipId || parsed.code || cleanCode;
        otpToSend = parsed.entryOtp || parsed.otp || null;
      }
    } catch {}

    try {
      const gymId = gym?.id || gym?._id || gym?.partnerId;
      const res = await apiService.checkInMember({
        gymId,
        code: codeToSend,
        otp: otpToSend,
        area: selectedArea,
        method: 'QR',
        verifiedBy: 'Mobile QR Camera Scanner',
      });

      const memberData = res?.member || {};
      const isCheckout = res?.action === 'CHECK_OUT';

      setSelectedMember({
        id: memberData.membershipId || memberData.id || codeToSend,
        customerId: memberData.id || codeToSend,
        membershipId: memberData.membershipId || codeToSend,
        bookingId: memberData.bookingId || null,
        bookingType: memberData.bookingType || (memberData.bookingId ? 'Section Batch' : 'Membership Pass'),
        name: memberData.name || 'Gym Member',
        plan: memberData.tier
          ? `${memberData.tier} Pass`
          : (memberData.title || (memberData.bookingType === 'SECTION' ? 'Section Batch' : 'Gym Access Pass')),
        avatar: (memberData.name || 'M').charAt(0).toUpperCase(),
        phone: memberData.phone || '',
        status: isCheckout ? 'Checked-Out' : 'Active',
        entryOtp: memberData.entryOtp || otpToSend || codeToSend,
        action: res?.action || 'CHECK_IN',
        durationStr: res?.durationStr || '',
        checkInTime: res?.checkInTime,
        checkOutTime: res?.checkOutTime,
        area: res?.area || selectedArea,
        attendedSessionsCount: memberData.attendedSessionsCount,
        durationDays: memberData.durationDays,
      });

      showToast({
        message: isCheckout
          ? `Check-out recorded for ${memberData.name || 'Member'}! Time spent: ${res?.durationStr}`
          : `${memberData.name || 'Member'} verified successfully!`,
        isSuccess: true,
      });
      setCurrentStep('SUCCESS');
    } catch (err) {
      Alert.alert(
        'QR Code Not Recognized',
        err.message || 'Could not find an active membership pass for this QR code.',
        [
          {
            text: 'Try Again',
            onPress: () => {
              isScanningRef.current = false;
            },
          },
          {
            text: 'Manual Search',
            onPress: () => {
              isScanningRef.current = false;
              setCurrentStep('SEARCH');
            },
          },
        ]
      );
    }
  };

  /* -------------------------------------------------------------------------- */
  /* STEP 1: HUB LANDING VIEW                                                   */
  /* -------------------------------------------------------------------------- */
  const renderHubView = () => (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingTop: topInset + 12, paddingBottom: 40 + Math.max(insets.bottom, 20) }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header */}
      <View style={styles.hubHeaderRow}>
        <TouchableOpacity
          style={[styles.backIconBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>
        <View style={styles.hubTitleBox}>
          <Text style={[styles.mainHubTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Check-in
          </Text>
          <Text style={[styles.mainHubSubtitle, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Mark customer or member check-in
          </Text>
        </View>
      </View>

      {/* Option 1: Scan QR Code */}
      <TouchableOpacity
        style={[
          styles.hubActionCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => setCurrentStep('QR')}
        activeOpacity={0.85}
      >
        <View style={[styles.hubActionIconBox, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
          <MaterialIcons name="qr-code-scanner" size={28} color={AppColors.accentColor} />
        </View>
        <View style={styles.hubActionTextBox}>
          <Text style={[styles.hubActionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Scan QR Code
          </Text>
          <Text style={[styles.hubActionDesc, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Scan the QR code displayed on member's GYMEZY app pass
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
      </TouchableOpacity>

      {/* Option 2: Manual Check-in */}
      <TouchableOpacity
        style={[
          styles.hubActionCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => setCurrentStep('SEARCH')}
        activeOpacity={0.85}
      >
        <View style={[styles.hubActionIconBox, { backgroundColor: 'rgba(0, 56, 130, 0.12)' }]}>
          <MaterialIcons name="person-search" size={28} color={AppColors.primaryColor} />
        </View>
        <View style={styles.hubActionTextBox}>
          <Text style={[styles.hubActionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Manual Check-in
          </Text>
          <Text style={[styles.hubActionDesc, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Search customer / member by Name, Phone, or Member ID
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
      </TouchableOpacity>

      {/* Option 3: Desk Walk-in Pass */}
      <TouchableOpacity
        style={[
          styles.hubActionCard,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => setShowWalkInModal(true)}
        activeOpacity={0.85}
      >
        <View style={[styles.hubActionIconBox, { backgroundColor: 'rgba(124, 58, 237, 0.12)' }]}>
          <MaterialIcons name="person-add" size={28} color="#7C3AED" />
        </View>
        <View style={styles.hubActionTextBox}>
          <Text style={[styles.hubActionTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Desk Walk-in Pass
          </Text>
          <Text style={[styles.hubActionDesc, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
            Issue 1-Day, 7-Day, or custom pass with immediate gate check-in
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
      </TouchableOpacity>

      {/* How it works info card */}
      <View
        style={[
          styles.howItWorksCard,
          {
            backgroundColor: isDark ? 'rgba(99, 102, 241, 0.08)' : '#F5F3FF',
            borderColor: isDark ? 'rgba(99, 102, 241, 0.25)' : '#DDD6FE',
          },
        ]}
      >
        <View style={styles.howItWorksHeader}>
          <Ionicons name="information-circle-outline" size={20} color={AppColors.accentColor} />
          <Text style={[styles.howItWorksTitle, { color: isDark ? '#C7D2FE' : '#4338CA' }]}>
            How it works?
          </Text>
        </View>
        <View style={styles.howItWorksList}>
          <Text style={[styles.howItWorksItem, { color: isDark ? 'rgba(255,255,255,0.7)' : '#5B21B6' }]}>
            1. Customer displays digital QR pass from GYMEZY app
          </Text>
          <Text style={[styles.howItWorksItem, { color: isDark ? 'rgba(255,255,255,0.7)' : '#5B21B6' }]}>
            2. Or search customer manually via phone / ID
          </Text>
          <Text style={[styles.howItWorksItem, { color: isDark ? 'rgba(255,255,255,0.7)' : '#5B21B6' }]}>
            3. Verify active membership details and confirm check-in
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  /* -------------------------------------------------------------------------- */
  /* STEP 2: QR SCANNER CAMERA VIEW                                             */
  /* -------------------------------------------------------------------------- */
  const renderQrScannerView = () => (
    <View style={styles.qrContainer}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* 1. Real Device Camera Feed (or Permission fallback) */}
      {hasCameraPermission ? (
        <Camera
          style={[StyleSheet.absoluteFillObject, { width: SCREEN_WIDTH, height: SCREEN_HEIGHT }]}
          cameraType="back"
          scanBarcode={true}
          showFrame={false}
          torchMode={flashlight ? 'on' : 'off'}
          onReadCode={(event) => {
            const scanned = event?.nativeEvent?.codeStringValue;
            if (scanned) {
              handleScanCode(scanned).catch(() => {});
            }
          }}
        />
      ) : (
        <View style={styles.permissionContainer}>
          <MaterialIcons name="camera-alt" size={56} color="#818CF8" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSubtitle}>
            GYMEZY requires camera access to scan member QR passes in real time.
          </Text>
          <TouchableOpacity
            style={styles.grantPermissionBtn}
            onPress={async () => {
              if (Platform.OS === 'android') {
                const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
                setHasCameraPermission(res === PermissionsAndroid.RESULTS.GRANTED);
              }
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.grantPermissionText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. Top Floating Controls with Status Bar Clearance */}
      <View style={[styles.qrTopBar, { paddingTop: Math.max(topInset + 8, 48) }]}>
        <TouchableOpacity
          style={styles.qrGlassBtn}
          onPress={() => setCurrentStep('HUB')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.qrHeaderTitleContainer}>
          <Text style={styles.qrHeaderTitle}>Scan Member Pass</Text>
          <Text style={styles.qrHeaderSubtitle}>Optical Turnstile Fast Entry</Text>
        </View>

        <TouchableOpacity
          style={[styles.qrGlassBtn, flashlight && { backgroundColor: 'rgba(245, 158, 11, 0.5)' }]}
          onPress={() => setFlashlight(!flashlight)}
          activeOpacity={0.8}
        >
          <Ionicons name={flashlight ? 'flash' : 'flash-off'} size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 3. Center Viewfinder with Laser Scanner */}
      <View style={styles.viewfinderWrapper}>
        <View style={styles.viewfinderFrame}>
          {/* Neon Border Corners */}
          <View style={[styles.frameCorner, styles.cornerTL]} />
          <View style={[styles.frameCorner, styles.cornerTR]} />
          <View style={[styles.frameCorner, styles.cornerBL]} />
          <View style={[styles.frameCorner, styles.cornerBR]} />

          {/* Animated Laser Bar */}
          <Animated.View
            style={[
              styles.laserLine,
              {
                transform: [{ translateY: laserAnim }],
              },
            ]}
          />
        </View>

        <Text style={styles.viewfinderHint}>Align member's QR code within the frame</Text>
      </View>

      {/* 4. Bottom Switch to Manual Check-in */}
      <View style={[styles.qrBottomBar, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
        <TouchableOpacity
          style={styles.switchToManualBtn}
          onPress={() => setCurrentStep('SEARCH')}
          activeOpacity={0.85}
        >
          <MaterialIcons name="search" size={20} color="#FFFFFF" />
          <Text style={styles.switchToManualText}>Switch to Manual Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  /* -------------------------------------------------------------------------- */
  /* STEP 3: MANUAL SEARCH VIEW                                                 */
  /* -------------------------------------------------------------------------- */
  const renderSearchView = () => (
    <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
      {/* Top Header */}
      <View style={[styles.searchTopHeader, { paddingTop: topInset + 10 }]}>
        <TouchableOpacity
          style={[styles.backIconBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
          onPress={() => setCurrentStep('HUB')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
        </TouchableOpacity>
        <Text style={[styles.searchScreenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Manual Check-in
        </Text>
        <TouchableOpacity
          style={[styles.backIconBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
          onPress={() => setCurrentStep('QR')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="qr-code-scanner" size={20} color={AppColors.primaryColor} />
        </TouchableOpacity>
      </View>

      {/* Top Category Segment Tabs: Customer Check-in vs Member Check-in */}
      <View style={[styles.segmentContainer, { borderBottomColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}>
        {['Customer Check-in', 'Member Check-in'].map((tab) => {
          const isSelected = searchCategoryTab === tab;
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
              onPress={() => setSearchCategoryTab(tab)}
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
        <Text style={[styles.searchSectionHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Search {searchCategoryTab === 'Member Check-in' ? 'Member' : 'Customer'}
        </Text>

        {/* Search Bar Input */}
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
            placeholder={`Search by Name / Phone / ID...`}
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

        {/* Search Filter Mode Chips */}
        <Text style={[styles.filterByLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
          Search using any of the details below
        </Text>

        <View style={styles.chipsWrapRow}>
          {SEARCH_FILTER_CHIPS.map((chip) => {
            const isSelected = activeChip === chip;
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
                onPress={() => setActiveChip(chip)}
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

        {/* Search Results Section */}
        {searchQuery.trim().length > 0 ? (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeaderRow}>
              <Text style={[styles.resultsTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Search Result ({filteredResults.length})
              </Text>
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearSearchLink}>Clear</Text>
              </TouchableOpacity>
            </View>

            {filteredResults.length === 0 ? (
              <View style={styles.emptySearchBox}>
                <MaterialIcons name="person-off" size={44} color={isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1'} />
                <Text style={[styles.emptySearchText, { color: isDark ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>
                  No customer or member found matching "{searchQuery}"
                </Text>
              </View>
            ) : (
              filteredResults.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.resultCard,
                    {
                      backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    },
                  ]}
                  onPress={() => handleSelectMember(m)}
                  activeOpacity={0.85}
                >
                  <View style={styles.resultAvatarCircle}>
                    <Text style={styles.resultAvatarText}>{m.avatar}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {m.name}
                    </Text>
                    <Text style={[styles.resultId, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                      {activeChip === 'Member ID' ? `Member ID: ${m.id}` : activeChip === 'Booking ID' ? `Booking ID: ${m.bookingId}` : `Customer ID: ${m.customerId}`}
                    </Text>
                    <Text style={[styles.resultPhone, { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }]}>
                      {m.phone}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'} />
                </TouchableOpacity>
              ))
            )}
          </View>
        ) : (
          /* Recent Members Roster */
          <View style={styles.recentMembersSection}>
            <View style={styles.resultsHeaderRow}>
              <Text style={[styles.resultsTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Recent Members
              </Text>
              <TouchableOpacity onPress={() => setSearchQuery('Arun')}>
                <Text style={styles.clearSearchLink}>View All</Text>
              </TouchableOpacity>
            </View>

            {liveMembers.slice(0, 10).map((m) => {
              const isExpired = m.status === 'EXPIRED' || m.status === 'Expired';
              const isUpcoming = m.status === 'UPCOMING' || m.status === 'Upcoming';
              const isCancelled = m.status === 'CANCELLED' || m.status === 'Cancelled';
              const avatarInitials = m.avatar && m.avatar.length <= 3 ? m.avatar : (m.name ? m.name.slice(0, 2).toUpperCase() : 'GM');
              const badgeBg = isExpired || isCancelled
                ? 'rgba(239, 68, 68, 0.12)'
                : isUpcoming
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(0, 191, 98, 0.12)';
              const badgeColor = isExpired || isCancelled
                ? AppColors.dangerRed
                : isUpcoming
                ? '#D97706'
                : AppColors.secondaryColor;

              return (
                <TouchableOpacity
                  key={m.key || m.id || m.membershipId}
                  style={[
                    styles.resultCard,
                    {
                      backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                      borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                    },
                  ]}
                  onPress={() => handleSelectMember(m)}
                  activeOpacity={0.85}
                >
                  <View style={styles.resultAvatarCircle}>
                    <Text style={styles.resultAvatarText}>{avatarInitials}</Text>
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                      {m.name}
                    </Text>
                    <Text style={[styles.resultId, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                      Member ID: {m.membershipId || m.id}
                    </Text>
                    <Text style={[styles.resultPhone, { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }]}>
                      {m.phone}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.memberStatusBadge,
                      {
                        backgroundColor: badgeBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberStatusText,
                        { color: badgeColor },
                      ]}
                    >
                      {m.status}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );

  /* -------------------------------------------------------------------------- */
  /* STEP 4: VERIFICATION & CHECK-IN DETAILS VIEW                               */
  /* -------------------------------------------------------------------------- */
  const renderDetailsView = () => {
    if (!selectedMember) {
      return (
        <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
          <View style={[styles.searchTopHeader, { paddingTop: topInset + 10 }]}>
            <TouchableOpacity
              style={[styles.backIconBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
              onPress={() => setCurrentStep('SEARCH')}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
            </TouchableOpacity>
            <Text style={[styles.searchScreenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Verify Check-in
            </Text>
            <View style={{ width: 40 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: isDark ? '#FFFFFF' : '#0F172A', fontSize: 15, fontWeight: '600' }}>
              No member selected
            </Text>
          </View>
        </View>
      );
    }

    const now = new Date();
    const isExpired = selectedMember?.status?.toUpperCase() === 'EXPIRED' || (selectedMember?.endDate && new Date(selectedMember.endDate) < now);
    const isUpcoming = selectedMember?.status?.toUpperCase() === 'UPCOMING' || (selectedMember?.startDate && new Date(selectedMember.startDate) > now);
    const isCancelled = selectedMember?.status?.toUpperCase() === 'CANCELLED';

    const detailBadgeBg = isExpired || isCancelled
      ? 'rgba(239, 68, 68, 0.12)'
      : isUpcoming
      ? 'rgba(245, 158, 11, 0.12)'
      : 'rgba(0, 191, 98, 0.12)';
    const detailBadgeColor = isExpired || isCancelled
      ? AppColors.dangerRed
      : isUpcoming
      ? '#D97706'
      : AppColors.secondaryColor;

    return (
      <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
        {/* Top Header */}
        <View style={[styles.searchTopHeader, { paddingTop: topInset + 10 }]}>
          <TouchableOpacity
            style={[styles.backIconBtn, { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF', borderColor: isDark ? AppColors.darkBorder : '#E2E8F0' }]}
            onPress={() => setCurrentStep('SEARCH')}
            activeOpacity={0.8}
          >
            <MaterialIcons name="arrow-back" size={22} color={isDark ? '#FFFFFF' : '#0F172A'} />
          </TouchableOpacity>
          <Text style={[styles.searchScreenTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            Verify Check-in
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.detailsScrollContent, { paddingBottom: 40 + Math.max(insets.bottom, 20) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Member Profile Header Card */}
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
              <View style={styles.detailsAvatarCircle}>
                <Text style={styles.detailsAvatarText}>{selectedMember?.avatar || 'M'}</Text>
              </View>
              <View style={styles.detailsProfileInfo}>
                <View style={styles.detailsNameRow}>
                  <Text style={[styles.detailsName, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                    {selectedMember?.name || 'Member'}
                  </Text>
                  <View
                    style={[
                      styles.memberStatusBadge,
                      {
                        backgroundColor: detailBadgeBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberStatusText,
                        { color: detailBadgeColor },
                      ]}
                    >
                      {selectedMember?.status || 'Active'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.detailsMetaId, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Customer ID: {selectedMember?.customerId || ''}
                </Text>
                <View style={styles.detailsContactRow}>
                  <Ionicons name="call" size={13} color={AppColors.primaryColor} />
                  <Text style={[styles.detailsPhone, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }]}>
                    {selectedMember?.phone || '--'}
                  </Text>
                  <Text style={[styles.detailsAgeGender, { color: isDark ? 'rgba(255,255,255,0.5)' : '#94A3B8' }]}>
                    • Age: {selectedMember?.age || '--'} • {selectedMember?.gender || '--'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Membership / Booking Details Table */}
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
              Booking / Membership Details
            </Text>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Booking Type
              </Text>
              <Text style={[styles.tableValuePill, { color: isDark ? '#93C5FD' : AppColors.primaryColor }]}>
                {selectedMember?.bookingType || 'Standard'}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Booking ID
              </Text>
              <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedMember?.bookingId || '--'}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Booking Date
              </Text>
              <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedMember?.bookingDate || '--'}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Session / Plan
              </Text>
              <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedMember?.plan || '--'}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Subscription End Date
              </Text>
              <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedMember?.endDate || '--'}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Days Remaining
              </Text>
              <Text
                style={[
                  styles.tableValue,
                  {
                    color: (selectedMember?.daysRemaining || 0) > 0 ? AppColors.secondaryColor : AppColors.dangerRed,
                    fontWeight: '800',
                  },
                ]}
              >
                {(selectedMember?.daysRemaining || 0) > 0 ? `${selectedMember?.daysRemaining} Days` : 'Expired'}
              </Text>
            </View>

            <View style={styles.tableRow}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Total Check-ins
              </Text>
              <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedMember?.totalCheckins || 0}
              </Text>
            </View>

            <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
              <Text style={[styles.tableLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Last Check-in
              </Text>
              <Text style={[styles.tableValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedMember?.lastCheckin || '--'}
              </Text>
            </View>
          </View>

          {/* Notes Card */}
          <View
            style={[
              styles.notesCard,
              {
                backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : '#EFF6FF',
                borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : '#BFDBFE',
              },
            ]}
          >
            <Ionicons name="information-circle" size={20} color={AppColors.primaryColor} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.notesTitle, { color: isDark ? '#93C5FD' : AppColors.primaryColor }]}>
                Notes:
              </Text>
              <Text style={[styles.notesBody, { color: isDark ? 'rgba(255,255,255,0.7)' : '#334155' }]}>
                Please verify member identity before marking check-in.
              </Text>
            </View>
          </View>

          {/* Check-in Now Form Card */}
          <View
            style={[
              styles.checkinActionBox,
              {
                backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.checkinActionHeading, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              Check-in Now
            </Text>

            <View style={styles.actionParamRow}>
              <MaterialIcons name="event" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
              <Text style={[styles.actionParamLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Check-in Date & Time:
              </Text>
              <Text style={[styles.actionParamValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                21 May 2026, 07:35 AM
              </Text>
            </View>

            <View style={styles.actionParamRow}>
              <MaterialIcons name="fitness-center" size={20} color={isDark ? 'rgba(255,255,255,0.6)' : '#64748B'} />
              <Text style={[styles.actionParamLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Check-in at:
              </Text>
              <Text style={[styles.actionParamValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {gym?.name || 'Gym Facility'}
              </Text>
            </View>

            {/* Session Area Dropdown Selector */}
            <Text style={[styles.areaFieldLabel, { color: isDark ? 'rgba(255,255,255,0.7)' : '#475569' }]}>
              Session / Area (Optional)
            </Text>
            <TouchableOpacity
              style={[
                styles.areaDropdownBtn,
                {
                  backgroundColor: isDark ? AppColors.darkSurface : '#F8FAFC',
                  borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
                },
              ]}
              onPress={() => setShowAreaModal(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.areaDropdownText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedArea}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={22} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>

            {/* Primary Confirm Button */}
            <TouchableOpacity
              style={[
                styles.confirmCheckinBtn,
                (isExpired || isCancelled) && { backgroundColor: '#94A3B8' },
                isUpcoming && { backgroundColor: '#F59E0B' },
              ]}
              onPress={handleConfirmCheckin}
              activeOpacity={0.88}
            >
              <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
              <Text style={styles.confirmCheckinBtnText}>
                {isExpired
                  ? 'Membership Expired'
                  : isUpcoming
                  ? 'Upcoming (Not Active)'
                  : isCancelled
                  ? 'Membership Cancelled'
                  : 'Confirm Check-in'}
              </Text>
            </TouchableOpacity>

            {/* View Check-in History */}
            <TouchableOpacity
              style={[
                styles.historyBtn,
                {
                  borderColor: isDark ? AppColors.darkBorder : AppColors.primaryColor,
                },
              ]}
              onPress={() =>
                Alert.alert(
                  `${selectedMember.name} - Check-in Logs`,
                  `Total: ${selectedMember.totalCheckins} check-ins\nLast: ${selectedMember.lastCheckin}\nPlan: ${selectedMember.plan}`
                )
              }
              activeOpacity={0.8}
            >
              <Text style={[styles.historyBtnText, { color: isDark ? '#93C5FD' : AppColors.primaryColor }]}>
                View Check-in History
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Session Area Picker Modal */}
        <Modal
          visible={showAreaModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAreaModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAreaModal(false)}
          >
            <View
              style={[
                styles.areaModalContent,
                { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
              ]}
            >
              <Text style={[styles.areaModalTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Select Workout Zone
              </Text>
              {SESSION_AREAS.map((area) => (
                <TouchableOpacity
                  key={area}
                  style={[
                    styles.areaOptionRow,
                    selectedArea === area && {
                      backgroundColor: isDark ? 'rgba(0, 56, 130, 0.25)' : 'rgba(0, 56, 130, 0.08)',
                    },
                  ]}
                  onPress={() => {
                    setSelectedArea(area);
                    setShowAreaModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.areaOptionText,
                      {
                        color:
                          selectedArea === area
                            ? isDark
                              ? '#93C5FD'
                              : AppColors.primaryColor
                            : isDark
                            ? '#FFFFFF'
                            : '#0F172A',
                        fontWeight: selectedArea === area ? '700' : '500',
                      },
                    ]}
                  >
                    {area}
                  </Text>
                  {selectedArea === area && (
                    <MaterialIcons name="check" size={20} color={AppColors.primaryColor} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* STEP 5: SUCCESS CONFIRMATION RECEIPT VIEW                                  */
  /* -------------------------------------------------------------------------- */
  const renderSuccessView = () => {
    if (!selectedMember) return null;
    const isCheckout = selectedMember.action === 'CHECK_OUT';
    const timeDisplay = isCheckout
      ? (selectedMember.checkOutTime ? new Date(selectedMember.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
      : (selectedMember.checkInTime ? new Date(selectedMember.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    return (
      <ScrollView
        contentContainerStyle={[
          styles.successScrollContent,
          { paddingTop: topInset + 20, paddingBottom: 40 + Math.max(insets.bottom, 20) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Celebration Badge */}
        <View style={styles.celebrationBox}>
          <Animated.View
            style={[
              styles.successCircleWrapper,
              {
                transform: [{ scale: successScaleAnim }],
              },
            ]}
          >
            <LinearGradient
              colors={isCheckout ? ['#F59E0B', '#D97706'] : [AppColors.secondaryColor, '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.successCircleGradient}
            >
              <MaterialIcons name={isCheckout ? 'logout' : 'check'} size={48} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <Text style={[styles.successMainTitle, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
            {isCheckout ? 'Check-out Recorded!' : 'Check-in Successful!'}
          </Text>
          <Text style={[styles.successCustomerName, { color: isDark ? 'rgba(255,255,255,0.7)' : '#64748B' }]}>
            {selectedMember.name} • Customer ID: {selectedMember.customerId || selectedMember.id || 'Member'}
          </Text>
        </View>

        {/* Summary Receipt Card */}
        <View
          style={[
            styles.receiptCard,
            {
              backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
              borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.receiptRow}>
            <View style={styles.receiptLabelRow}>
              <MaterialIcons name="schedule" size={18} color={isCheckout ? '#F59E0B' : AppColors.secondaryColor} />
              <Text style={[styles.receiptLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                {isCheckout ? 'Check-out Time' : 'Check-in Time'}
              </Text>
            </View>
            <Text style={[styles.receiptValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {timeDisplay}
            </Text>
          </View>

          {isCheckout && selectedMember.durationStr ? (
            <View style={styles.receiptRow}>
              <View style={styles.receiptLabelRow}>
                <MaterialIcons name="timer" size={18} color={AppColors.primaryColor} />
                <Text style={[styles.receiptLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Duration Spent
                </Text>
              </View>
              <Text style={[styles.receiptValue, { color: isDark ? '#FFFFFF' : '#0F172A', fontWeight: '700' }]}>
                {selectedMember.durationStr}
              </Text>
            </View>
          ) : null}

          <View style={styles.receiptRow}>
            <View style={styles.receiptLabelRow}>
              <MaterialIcons name="confirmation-number" size={18} color={AppColors.primaryColor} />
              <Text style={[styles.receiptLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Booking Type
              </Text>
            </View>
            <Text style={[styles.receiptValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {selectedMember.bookingType || selectedMember.plan || 'Membership Pass'}
            </Text>
          </View>

          {selectedMember.bookingId ? (
            <View style={styles.receiptRow}>
              <View style={styles.receiptLabelRow}>
                <MaterialIcons name="badge" size={18} color={AppColors.accentColor} />
                <Text style={[styles.receiptLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Booking ID
                </Text>
              </View>
              <Text style={[styles.receiptValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                {selectedMember.bookingId}
              </Text>
            </View>
          ) : null}

          {typeof selectedMember.attendedSessionsCount === 'number' && (
            <View style={styles.receiptRow}>
              <View style={styles.receiptLabelRow}>
                <MaterialIcons name="event-available" size={18} color="#8B5CF6" />
                <Text style={[styles.receiptLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                  Section Session
                </Text>
              </View>
              <Text style={[styles.receiptValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
                Session {selectedMember.attendedSessionsCount}
                {selectedMember.durationDays ? ` of ${selectedMember.durationDays}` : ''}
              </Text>
            </View>
          )}

          <View style={[styles.receiptRow, { borderBottomWidth: 0 }]}>
            <View style={styles.receiptLabelRow}>
              <MaterialIcons name="fitness-center" size={18} color={AppColors.warningAmber} />
              <Text style={[styles.receiptLabel, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748B' }]}>
                Session / Plan
              </Text>
            </View>
            <Text style={[styles.receiptValue, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
              {selectedMember.area || selectedArea}
            </Text>
          </View>
        </View>

        {/* Success verified banner */}
        <View style={styles.verifiedSuccessBanner}>
          <MaterialIcons name="check-circle" size={18} color={isCheckout ? '#F59E0B' : AppColors.secondaryColor} />
          <Text style={styles.verifiedSuccessBannerText}>
            {isCheckout
              ? `Member check-out recorded. Total duration: ${selectedMember.durationStr || 'Completed'}`
              : 'Customer has been successfully checked-in.'}
          </Text>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.checkinAnotherBtn}
          onPress={() => {
            setSearchQuery('');
            setCurrentStep('HUB');
          }}
          activeOpacity={0.88}
        >
          <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
          <Text style={styles.checkinAnotherBtnText}>Check-in Another</Text>
        </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.viewCustomerBtn,
          {
            backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF',
            borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
          },
        ]}
        onPress={() => navigation.navigate('Dashboard')}
        activeOpacity={0.8}
      >
        <Text style={[styles.viewCustomerBtnText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}>
          Back to Dashboard
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

  return (
    <View style={[styles.container, { backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground }]}>
      <StatusBar
        barStyle={currentStep === 'QR' ? 'light-content' : isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />

      {currentStep === 'HUB' && renderHubView()}
      {currentStep === 'QR' && renderQrScannerView()}
      {currentStep === 'SEARCH' && renderSearchView()}
      {currentStep === 'DETAILS' && renderDetailsView()}
      {currentStep === 'SUCCESS' && renderSuccessView()}

      {/* Front Desk Walk-in Booking Modal */}
      <AddWalkInBookingModal
        visible={showWalkInModal}
        onClose={() => setShowWalkInModal(false)}
        onSuccess={(created) => {
          showToast({
            message: `Walk-in pass issued for ${created?.customerName || 'customer'}!`,
            isSuccess: true,
          });
        }}
      />
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
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 24,
  },
  backIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubTitleBox: {
    flex: 1,
  },
  mainHubTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  mainHubSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  hubActionCard: {
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
  hubActionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubActionTextBox: {
    flex: 1,
    gap: 3,
  },
  hubActionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  hubActionDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  howItWorksCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
    gap: 10,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  howItWorksList: {
    gap: 8,
    paddingLeft: 4,
  },
  howItWorksItem: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },

  /* QR Scanner Styles */
  qrContainer: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  permissionContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  grantPermissionBtn: {
    backgroundColor: AppColors.primaryColor,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  grantPermissionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  qrTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  qrHeaderTitleContainer: {
    alignItems: 'center',
  },
  qrHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  qrHeaderSubtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  qrGlassBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  viewfinderWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
    backgroundColor: 'transparent',
    pointerEvents: 'box-none',
  },
  viewfinderFrame: {
    width: 260,
    height: 260,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  frameCorner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: '#38BDF8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 20,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 20,
  },
  laserLine: {
    position: 'absolute',
    top: 20,
    left: 15,
    right: 15,
    height: 3,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    borderRadius: 2,
    elevation: 4,
  },
  viewfinderHint: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 22,
    textAlign: 'center',
    opacity: 0.9,
  },
  areaSelectorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  areaSelectorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  simulateScanPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AppColors.primaryColor,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 14,
  },
  simulateScanText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  qrBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
    zIndex: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  switchToManualBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    height: 52,
    width: '100%',
    borderRadius: 16,
    gap: 8,
  },
  switchToManualText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Search Screen Styles */
  searchTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  searchScreenTitle: {
    fontSize: 17,
    fontWeight: '800',
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
  searchSectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
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
  filterByLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
  },
  chipsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
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
  resultsSection: {
    marginTop: 6,
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
  emptySearchBox: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptySearchText: {
    fontSize: 13,
    textAlign: 'center',
  },
  resultCard: {
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
  resultAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultAvatarText: {
    color: AppColors.accentColor,
    fontSize: 14,
    fontWeight: '800',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultId: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  resultPhone: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  memberStatusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  memberStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  recentMembersSection: {
    marginTop: 6,
  },

  /* Details Screen Styles */
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
  detailsAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 56, 130, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsAvatarText: {
    color: AppColors.primaryColor,
    fontSize: 18,
    fontWeight: '800',
  },
  detailsProfileInfo: {
    flex: 1,
  },
  detailsNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsName: {
    fontSize: 17,
    fontWeight: '800',
  },
  detailsMetaId: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  detailsContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  detailsPhone: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailsAgeGender: {
    fontSize: 12,
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
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
  notesCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  notesBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  checkinActionBox: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  checkinActionHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  actionParamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionParamLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionParamValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  areaFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  areaDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  areaDropdownText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryColor,
    height: 52,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmCheckinBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  historyBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  areaModalContent: {
    borderRadius: 20,
    padding: 18,
    gap: 6,
  },
  areaModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  areaOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  areaOptionText: {
    fontSize: 14,
  },

  /* Success Screen Styles */
  successScrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  celebrationBox: {
    alignItems: 'center',
    marginVertical: 18,
    gap: 8,
  },
  successCircleWrapper: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 10,
    shadowColor: AppColors.secondaryColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  successCircleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  successCustomerName: {
    fontSize: 13,
    fontWeight: '600',
  },
  receiptCard: {
    width: '100%',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.12)',
  },
  receiptLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  verifiedSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 191, 98, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    width: '100%',
    marginBottom: 24,
    justifyContent: 'center',
  },
  verifiedSuccessBannerText: {
    color: AppColors.secondaryColor,
    fontSize: 13,
    fontWeight: '700',
  },
  checkinAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primaryColor,
    height: 52,
    borderRadius: 16,
    width: '100%',
    gap: 8,
    marginBottom: 12,
    shadowColor: AppColors.primaryColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  checkinAnotherBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  viewCustomerBtn: {
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  viewCustomerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
