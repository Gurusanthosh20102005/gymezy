import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Switch,
  Modal,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
  NativeModules,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useBookingRepository } from '../data/BookingContext';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { BrandWatermarkFooter } from '../widgets/BrandWatermarkFooter';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import { attendanceService } from '../services/attendanceService';
import { notificationService } from '../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys for user preferences & security
const PREF_WORKOUT_REMINDERS_KEY = '@gymezy_pref_workout_reminders';
const PREF_PASS_EXPIRY_ALERTS_KEY = '@gymezy_pref_pass_expiry_alerts';
const PREF_BIOMETRIC_LOGIN_KEY = '@gymezy_pref_biometric_login';

// Safely load ExpoLocalAuthentication only if registered in native runtime
const getSafeLocalAuthentication = () => {
  try {
    const isLinked = Boolean(
      NativeModules?.ExpoLocalAuthentication ||
      globalThis?.expo?.modules?.ExpoLocalAuthentication ||
      globalThis?.ExpoModules?.ExpoLocalAuthentication
    );
    if (!isLinked) {
      return null;
    }
    return require('expo-local-authentication');
  } catch {
    return null;
  }
};

// Safely check if native ImagePicker module is registered before requiring
const getSafeImagePicker = () => {
  try {
    const isNativeModuleLinked = Boolean(
      NativeModules?.ExponentImagePicker ||
      globalThis?.expo?.modules?.ExponentImagePicker ||
      globalThis?.ExpoModules?.ExponentImagePicker
    );
    if (!isNativeModuleLinked) {
      return null;
    }
    return require('expo-image-picker');
  } catch {
    return null;
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FITNESS_GOALS = [
  'Muscle Building & Hypertrophy',
  'Weight Loss & Fat Burn',
  'Endurance & Stamina',
  'Strength & Powerlifting',
  'General Fitness & Mobility',
];

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop';

const AVATAR_PRESETS = [
  { id: '1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop', label: 'Pro Athlete' },
  { id: '2', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop', label: 'Runner' },
  { id: '3', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop', label: 'Yoga & Core' },
  { id: '4', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop', label: 'Powerlifter' },
  { id: '5', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=400&auto=format&fit=crop', label: 'CrossFit' },
  { id: '6', url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400&auto=format&fit=crop', label: 'Gym Pro' },
  { id: '7', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=400&auto=format&fit=crop', label: 'Trainer Dave' },
  { id: '8', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=400&auto=format&fit=crop', label: 'Iron Master' },
];

const FAQS = [
  {
    q: 'How do I check-in at a gym?',
    a: 'Open your active booking or membership in GYMEZY and show your QR code pass to the front desk scanner, or share the 6-digit entry OTP.',
  },
  {
    q: 'Can I reschedule a session booking?',
    a: 'Yes! You can reschedule any upcoming session up to 2 hours before the start time without any cancellation fees.',
  },
  {
    q: 'How do membership cancellations work?',
    a: "You can request a cancellation from your Membership Details screen. Refunds are processed according to the gym's policy.",
  },
  {
    q: 'Are trainers certified on GYMEZY?',
    a: 'All personal trainers listed on GYMEZY are verified and certified with relevant national and international fitness accreditations.',
  },
];

export const ProfileScreen = ({ navigation, onNavigateToBookings, onNavigateToMemberships }) => {
  const { isDark, colors } = useTheme();
  const { bookings, memberships } = useBookingRepository();
  const { showToast } = useToast();
  const { user, logout, updateUser } = useAuth();

  // User Profile State
  const [userName, setUserName] = useState(user?.fullName || 'Alex Morgan');
  const [userEmail, setUserEmail] = useState(user?.email || 'alex.morgan@fitness.io');
  const [userPhone, setUserPhone] = useState(user?.phone || '+91 98765 43210');
  const [userGender, setUserGender] = useState(user?.gender === 'FEMALE' ? 'Female' : 'Male');
  const [userEmergencyContact, setUserEmergencyContact] = useState(
    user?.emergencyContact || '+91 98123 45678 (Spouse)'
  );
  const avatarUrl = user?.avatar || DEFAULT_AVATAR;

  // Keep local state in sync when auth user updates
  useEffect(() => {
    if (user) {
      if (user.fullName) setUserName(user.fullName);
      if (user.email) setUserEmail(user.email);
      if (user.phone) setUserPhone(user.phone);
      if (user.emergencyContact) setUserEmergencyContact(user.emergencyContact);
    }
  }, [user]);

  // Body & Fitness Metrics
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(74.5);
  const [targetWeightKg, setTargetWeightKg] = useState(70.0);
  const [fitnessGoal, setFitnessGoal] = useState('Muscle Building & Hypertrophy');

  // Preferences Toggles - initialized from user preferences or defaults (default false)
  const [workoutReminders, setWorkoutReminders] = useState(
    user?.preferences?.workoutReminders !== undefined ? Boolean(user.preferences.workoutReminders) : false
  );
  const [passExpiryAlerts, setPassExpiryAlerts] = useState(
    user?.preferences?.passExpiryAlerts !== undefined ? Boolean(user.preferences.passExpiryAlerts) : false
  );
  const [biometricLogin, setBiometricLogin] = useState(
    user?.preferences?.biometricLogin !== undefined
      ? Boolean(user.preferences.biometricLogin)
      : Boolean(user?.biometricEnabled)
  );
  const [monthlyCheckInsCount, setMonthlyCheckInsCount] = useState(null);

  // Load saved preferences from AsyncStorage and sync with Auth user
  useEffect(() => {
    let isMounted = true;
    const loadStoredPreferences = async () => {
      try {
        const [storedWorkout, storedPassExpiry, storedBiometric] = await Promise.all([
          AsyncStorage.getItem(PREF_WORKOUT_REMINDERS_KEY),
          AsyncStorage.getItem(PREF_PASS_EXPIRY_ALERTS_KEY),
          AsyncStorage.getItem(PREF_BIOMETRIC_LOGIN_KEY),
        ]);

        if (isMounted) {
          if (storedWorkout !== null) {
            setWorkoutReminders(storedWorkout === 'true');
          } else if (user?.preferences?.workoutReminders !== undefined) {
            setWorkoutReminders(Boolean(user.preferences.workoutReminders));
          }

          if (storedPassExpiry !== null) {
            setPassExpiryAlerts(storedPassExpiry === 'true');
          } else if (user?.preferences?.passExpiryAlerts !== undefined) {
            setPassExpiryAlerts(Boolean(user.preferences.passExpiryAlerts));
          }

          if (storedBiometric !== null) {
            setBiometricLogin(storedBiometric === 'true');
          } else if (user?.preferences?.biometricLogin !== undefined) {
            setBiometricLogin(Boolean(user.preferences.biometricLogin));
          } else if (user?.biometricEnabled !== undefined) {
            setBiometricLogin(Boolean(user.biometricEnabled));
          }
        }
      } catch (err) {
        console.warn('Could not read saved preferences from AsyncStorage:', err);
      }
    };

    loadStoredPreferences();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Handler for Workout Reminders toggle
  const handleToggleWorkoutReminders = async (nextVal) => {
    if (nextVal) {
      await notificationService.requestNotificationPermission();
    }
    setWorkoutReminders(nextVal);
    try {
      await AsyncStorage.setItem(PREF_WORKOUT_REMINDERS_KEY, String(nextVal));

      const updatedPrefs = {
        ...(user?.preferences || {}),
        workoutReminders: nextVal,
        passExpiryAlerts,
        biometricLogin,
      };

      if (updateUser) {
        await updateUser({ preferences: updatedPrefs });
      }

      await apiService.updateProfile({
        preferences: updatedPrefs,
      });

      showToast({
        message: nextVal
          ? 'Workout Reminders enabled! You will receive daily session alerts.'
          : 'Workout Reminders disabled.',
        isSuccess: nextVal,
      });
    } catch (err) {
      showToast({
        message: 'Failed to update reminder settings: ' + (err.message || 'Error'),
        isError: true,
      });
    }
  };

  // Handler for Pass Expiry Alerts toggle
  const handleTogglePassExpiryAlerts = async (nextVal) => {
    if (nextVal) {
      await notificationService.requestNotificationPermission();
    }
    setPassExpiryAlerts(nextVal);
    try {
      await AsyncStorage.setItem(PREF_PASS_EXPIRY_ALERTS_KEY, String(nextVal));

      const updatedPrefs = {
        ...(user?.preferences || {}),
        workoutReminders,
        passExpiryAlerts: nextVal,
        biometricLogin,
      };

      if (updateUser) {
        await updateUser({ preferences: updatedPrefs });
      }

      await apiService.updateProfile({
        preferences: updatedPrefs,
      });

      showToast({
        message: nextVal
          ? 'Pass Expiry Alerts enabled! You will be notified 3 days prior.'
          : 'Pass Expiry Alerts disabled.',
        isSuccess: nextVal,
      });
    } catch (err) {
      showToast({
        message: 'Failed to update expiry alert settings: ' + (err.message || 'Error'),
        isError: true,
      });
    }
  };

  // Handler for Biometric / Face ID Login toggle with hardware & enrollment verification
  const handleToggleBiometricLogin = async (nextVal) => {
    if (nextVal) {
      try {
        const localAuth = getSafeLocalAuthentication();
        if (!localAuth) {
          // Native module not linked in this build; save preference directly
          setBiometricLogin(true);
          await AsyncStorage.setItem(PREF_BIOMETRIC_LOGIN_KEY, 'true');
          showToast({
            message: 'Biometric login preference enabled for this device.',
            isSuccess: true,
          });
          return;
        }

        const hasHardware = await localAuth.hasHardwareAsync();
        if (!hasHardware) {
          showToast({
            message: 'Biometric hardware sensor is not available on this device.',
            isError: true,
          });
          return;
        }

        const isEnrolled = await localAuth.isEnrolledAsync();
        if (!isEnrolled) {
          showToast({
            message: 'No biometric credentials found. Please set up fingerprint or Face ID in device settings first.',
            isError: true,
          });
          return;
        }

        const authResult = await localAuth.authenticateAsync({
          promptMessage: 'Verify identity to enable Biometric & Face ID Login',
          cancelLabel: 'Cancel',
          disableDeviceFallback: false,
        });

        if (!authResult.success) {
          if (authResult.error !== 'user_cancel' && authResult.error !== 'system_cancel') {
            showToast({
              message: 'Biometric verification could not be completed.',
              isError: true,
            });
          }
          return;
        }

        // Successfully authenticated
        setBiometricLogin(true);
        await AsyncStorage.setItem(PREF_BIOMETRIC_LOGIN_KEY, 'true');
        if (updateUser) {
          await updateUser({
            biometricEnabled: true,
            preferences: {
              ...(user?.preferences || {}),
              biometricLogin: true,
            },
          });
        }
        await apiService.updateProfile({
          biometricEnabled: true,
          preferences: {
            ...(user?.preferences || {}),
            workoutReminders,
            passExpiryAlerts,
            biometricLogin: true,
          },
        });

        showToast({
          message: 'Biometric / Face ID Login enabled successfully!',
          isSuccess: true,
        });
      } catch (err) {
        showToast({
          message: 'Could not enable biometric: ' + (err.message || 'Error'),
          isError: true,
        });
      }
    } else {
      // User turning off biometric login
      setBiometricLogin(false);
      try {
        await AsyncStorage.setItem(PREF_BIOMETRIC_LOGIN_KEY, 'false');
        if (updateUser) {
          await updateUser({
            biometricEnabled: false,
            preferences: {
              ...(user?.preferences || {}),
              biometricLogin: false,
            },
          });
        }
        await apiService.updateProfile({
          biometricEnabled: false,
          preferences: {
            ...(user?.preferences || {}),
            workoutReminders,
            passExpiryAlerts,
            biometricLogin: false,
          },
        });

        showToast({
          message: 'Biometric authentication turned off.',
          isSuccess: false,
        });
      } catch (err) {
        showToast({
          message: 'Failed to update setting: ' + (err.message || 'Error'),
          isError: true,
        });
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    attendanceService
      .fetchAttendanceHistory()
      .then((data) => {
        if (isMounted && data?.summary?.thisMonth !== undefined) {
          setMonthlyCheckInsCount(data.summary.thisMonth);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Modals state
  const [showAvatarPickerModal, setShowAvatarPickerModal] = useState(false);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [showInvoicesModal, setShowInvoicesModal] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState(null);

  // Form temporary edit state
  const [tempName, setTempName] = useState(userName);
  const [tempEmail, setTempEmail] = useState(userEmail);
  const [tempPhone, setTempPhone] = useState(userPhone);
  const [tempEmergency, setTempEmergency] = useState(userEmergencyContact);
  const [tempGender, setTempGender] = useState(userGender);

  const [tempHeight, setTempHeight] = useState(heightCm.toString());
  const [tempWeight, setTempWeight] = useState(weightKg.toString());
  const [tempTargetWeight, setTempTargetWeight] = useState(targetWeightKg.toString());
  const [tempGoal, setTempGoal] = useState(fitnessGoal);

  // Computed values
  const bmi = weightKg / ((heightCm / 100) * (heightCm / 100));
  const getBmiCategory = () => {
    if (bmi < 18.5) return { label: 'Underweight', color: '#F59E0B' };
    if (bmi < 24.9) return { label: 'Normal Weight', color: '#16A34A' };
    if (bmi < 29.9) return { label: 'Overweight', color: '#EA580C' };
    return { label: 'Obese', color: '#EF4444' };
  };
  const bmiInfo = getBmiCategory();

  const activeMemberships = memberships.filter((m) => m.status === 'Active');
  const activeBookings = bookings.filter((b) => b.status === 'Upcoming');
  const totalActivePasses = activeMemberships.length + activeBookings.length;

  const userInvoices = useMemo(() => {
    const list = [];
    memberships.forEach((m) => {
      list.push({
        id: `INV-${m.id || 'MBR'}`,
        title: `${m.gymName || 'Gym'} • ${m.planName || 'Membership'}`,
        date: m.startDate || 'Active',
        amount: `₹${m.amountPaid || 0}`,
        status: m.status || 'Paid',
      });
    });
    bookings.forEach((b) => {
      list.push({
        id: `INV-${b.id || 'BKG'}`,
        title: `${b.gymName || 'Gym'} • ${b.sessionSubtitle || b.type || 'Pass'}`,
        date: b.date || 'Recent',
        amount: `₹${b.amountPaid || 0}`,
        status: b.status || 'Paid',
      });
    });
    return list;
  }, [memberships, bookings]);

  const primaryNavy = isDark ? '#93C5FD' : '#003882';
  const cardColor = isDark ? '#1E1E1E' : '#FFFFFF';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.7)' : '#64748B';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0';
  const inputBgColor = isDark ? '#262626' : '#F8FAFC';

  const handleSaveAvatar = async (newUri) => {
    setIsUpdatingAvatar(true);
    setShowAvatarPickerModal(false);
    try {
      if (updateUser) {
        await updateUser({ avatar: newUri });
      }
      try {
        await apiService.updateProfile({ avatar: newUri });
      } catch {
        // Backend or offline mode - local state already updated
      }
      showToast({ message: 'Profile photo updated successfully!', isSuccess: true });
    } catch (error) {
      showToast({ message: 'Failed to update photo: ' + (error.message || 'Error') });
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const ImagePicker = getSafeImagePicker();
      if (!ImagePicker) {
        showToast({
          message: 'Device photo library requires app restart (npm run android). Please pick a fitness avatar preset below!',
        });
        return;
      }
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Permission to access photo gallery was denied.' });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Native JPEG compression for compact DB storage
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const compressedUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        await handleSaveAvatar(compressedUri);
      }
    } catch (error) {
      showToast({ message: 'Could not open photo gallery: ' + (error.message || 'Error') });
    }
  };

  const handleTakePhoto = async () => {
    try {
      const ImagePicker = getSafeImagePicker();
      if (!ImagePicker) {
        showToast({
          message: 'Device camera requires app restart (npm run android). Please pick a fitness avatar preset below!',
        });
        return;
      }
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showToast({ message: 'Camera permission is required to take a photo.' });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Native JPEG compression for compact DB storage
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const compressedUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        await handleSaveAvatar(compressedUri);
      }
    } catch (error) {
      showToast({ message: 'Could not open camera: ' + (error.message || 'Error') });
    }
  };

  const handleSelectPresetAvatar = async (presetUrl) => {
    await handleSaveAvatar(presetUrl);
  };

  const handleRemovePhoto = async () => {
    await handleSaveAvatar('');
  };

  const handleOpenEditProfile = () => {
    setTempName(userName);
    setTempEmail(userEmail);
    setTempPhone(userPhone);
    setTempEmergency(userEmergencyContact);
    setTempGender(userGender);
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = () => {
    const updatedName = tempName.trim() || userName;
    const updatedEmail = tempEmail.trim() || userEmail;
    const updatedPhone = tempPhone.trim() || userPhone;
    const updatedEmergency = tempEmergency.trim() || userEmergencyContact;

    setUserName(updatedName);
    setUserEmail(updatedEmail);
    setUserPhone(updatedPhone);
    setUserEmergencyContact(updatedEmergency);
    setUserGender(tempGender);

    if (updateUser) {
      updateUser({
        fullName: updatedName,
        email: updatedEmail,
        phone: updatedPhone,
        emergencyContact: updatedEmergency,
        gender: tempGender,
      });
    }

    try {
      apiService.updateProfile({
        fullName: updatedName,
        email: updatedEmail,
        phone: updatedPhone,
        emergencyContact: updatedEmergency,
        gender: tempGender,
      }).catch(() => {});
    } catch {
      // Offline mode or network error
    }

    setShowEditProfileModal(false);
    showToast({ message: 'Profile updated successfully', isSuccess: true });
  };

  const handleOpenMeasurements = () => {
    setTempHeight(heightCm.toFixed(0));
    setTempWeight(weightKg.toFixed(1));
    setTempTargetWeight(targetWeightKg.toFixed(1));
    setTempGoal(fitnessGoal);
    setShowMeasurementsModal(true);
  };

  const handleSaveMeasurements = () => {
    const h = Number.parseFloat(tempHeight) || heightCm;
    const w = Number.parseFloat(tempWeight) || weightKg;
    const tw = Number.parseFloat(tempTargetWeight) || targetWeightKg;
    setHeightCm(h);
    setWeightKg(w);
    setTargetWeightKg(tw);
    setFitnessGoal(tempGoal);
    setShowMeasurementsModal(false);
    showToast({ message: 'Measurements updated successfully', isSuccess: true });
  };

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    if (logout) {
      await logout();
    }
    showToast({ message: 'Logged out successfully' });
    if (navigation?.replace) {
      navigation.replace('Login');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 0. Top Header */}
      <View style={styles.appBar}>
        <Text style={[styles.appBarTitle, { color: textColor }]}>Profile & Settings</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handleOpenEditProfile}
          style={styles.headerActionBtn}
        >
          <MaterialIcons name="edit-note" size={28} color={primaryNavy} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. User Profile Header Card */}
        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: cardColor,
              borderColor: borderColor,
              shadowColor: isDark ? '#000000' : '#000000',
              shadowOpacity: isDark ? 0.35 : 0.04,
            },
          ]}
        >
          {/* Avatar & User Details */}
          <View style={styles.userInfoRow}>
            {/* Avatar Stack with Tap to Change */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowAvatarPickerModal(true)}
              style={styles.avatarStack}
            >
              <View
                style={[
                  styles.avatarBorder,
                  { borderColor: isDark ? '#93C5FD' : '#003882' },
                ]}
              >
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.cameraBadge}>
                <MaterialIcons name="photo-camera" size={13} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            {/* User Identity Details */}
            <View style={styles.identityDetails}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.userNameText, { color: textColor }]}
                  numberOfLines={1}
                >
                  {userName}
                </Text>
                <MaterialIcons name="verified" size={18} color="#3B82F6" style={{ marginLeft: 6 }} />
              </View>
              <Text style={[styles.userPhoneText, { color: subtitleColor }]}>
                {userPhone}
              </Text>
              <Text
                style={[styles.userEmailText, { color: subtitleColor }]}
                numberOfLines={1}
              >
                {userEmail}
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.cardDivider, { backgroundColor: borderColor }]} />

          {/* VIP Membership Status Pill */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (activeMemberships.length > 0) {
                navigation.navigate('MembershipDetails', { membership: activeMemberships[0] });
              } else if (onNavigateToMemberships) {
                onNavigateToMemberships();
              } else {
                navigation.navigate('MyMemberships');
              }
            }}
          >
            <LinearGradient
              colors={
                isDark
                  ? ['rgba(30, 58, 138, 0.5)', 'rgba(49, 46, 129, 0.5)']
                  : ['#EEF2FF', '#E0E7FF']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.vipPill,
                {
                  borderColor: isDark
                    ? 'rgba(96, 165, 250, 0.3)'
                    : '#C7D2FE',
                },
              ]}
            >
              <MaterialIcons name="workspace-premium" size={20} color="#F59E0B" />
              <View style={styles.vipPillContent}>
                <Text
                  style={[
                    styles.vipPillBadge,
                    { color: isDark ? '#93C5FD' : '#003882' },
                  ]}
                >
                  PRO FITNESS MEMBER
                </Text>
                <Text
                  style={[styles.vipPillGym, { color: textColor }]}
                  numberOfLines={1}
                >
                  {activeMemberships.length > 0
                    ? activeMemberships[0].gymName
                    : 'Explore Partner Gyms'}
                </Text>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={isDark ? '#93C5FD' : '#003882'}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* 2. 4-Column Activity Stats Summary */}
        <View style={styles.statCardsRow}>
          {/* Card 1: Workouts */}
          <View
            style={[
              styles.statCard,
              { backgroundColor: cardColor, borderColor: borderColor },
            ]}
          >
            <MaterialIcons name="fitness-center" size={22} color="#3B82F6" />
            <Text style={[styles.statCardValue, { color: textColor }]} numberOfLines={1}>
              {bookings.length}
            </Text>
            <Text style={[styles.statCardLabel, { color: subtitleColor }]} numberOfLines={1}>
              Workouts
            </Text>
          </View>

          {/* Card 2: Streak */}
          <View
            style={[
              styles.statCard,
              { backgroundColor: cardColor, borderColor: borderColor },
            ]}
          >
            <MaterialIcons name="local-fire-department" size={22} color="#EF4444" />
            <Text style={[styles.statCardValue, { color: textColor }]} numberOfLines={1}>
              {user?.streakDays ? `${user.streakDays} Days` : '0 Days'}
            </Text>
            <Text style={[styles.statCardLabel, { color: subtitleColor }]} numberOfLines={1}>
              Streak
            </Text>
          </View>

          {/* Card 3: Passes */}
          <View
            style={[
              styles.statCard,
              { backgroundColor: cardColor, borderColor: borderColor },
            ]}
          >
            <MaterialIcons name="card-membership" size={22} color="#10B981" />
            <Text style={[styles.statCardValue, { color: textColor }]} numberOfLines={1}>
              {`${totalActivePasses} Active`}
            </Text>
            <Text style={[styles.statCardLabel, { color: subtitleColor }]} numberOfLines={1}>
              Passes
            </Text>
          </View>

          {/* Card 4: Calories */}
          <View
            style={[
              styles.statCard,
              { backgroundColor: cardColor, borderColor: borderColor },
            ]}
          >
            <MaterialIcons name="bolt" size={22} color="#F59E0B" />
            <Text style={[styles.statCardValue, { color: textColor }]} numberOfLines={1}>
              {bookings.length > 0 ? `${bookings.length * 350}` : '0 kcal'}
            </Text>
            <Text style={[styles.statCardLabel, { color: subtitleColor }]} numberOfLines={1}>
              Calories
            </Text>
          </View>
        </View>

        {/* 3. Body Measurements & Fitness Goals Card */}
        <View
          style={[
            styles.metricsCard,
            { backgroundColor: cardColor, borderColor: borderColor },
          ]}
        >
          {/* Card Header */}
          <View style={styles.metricsHeaderRow}>
            <View style={styles.metricsHeaderLeft}>
              <View style={styles.metricsIconContainer}>
                <MaterialIcons name="accessibility-new" size={18} color="#003882" />
              </View>
              <Text style={[styles.metricsTitleText, { color: textColor }]}>
                Body Metrics & Target
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleOpenMeasurements}
              style={styles.editMetricsBtn}
            >
              <Text style={[styles.editMetricsText, { color: isDark ? '#93C5FD' : '#003882' }]}>
                Edit
              </Text>
            </TouchableOpacity>
          </View>

          {/* 4-Column Metric Boxes */}
          <View style={styles.metricBoxesRow}>
            {/* Height */}
            <View style={[styles.metricBox, { backgroundColor: inputBgColor }]}>
              <Text style={[styles.metricBoxLabel, { color: subtitleColor }]}>Height</Text>
              <Text style={[styles.metricBoxValue, { color: textColor }]}>
                {Math.round(heightCm)} cm
              </Text>
            </View>

            {/* Weight */}
            <View style={[styles.metricBox, { backgroundColor: inputBgColor }]}>
              <Text style={[styles.metricBoxLabel, { color: subtitleColor }]}>Weight</Text>
              <Text style={[styles.metricBoxValue, { color: textColor }]}>
                {weightKg.toFixed(1)} kg
              </Text>
            </View>

            {/* BMI */}
            <View style={[styles.metricBox, { backgroundColor: inputBgColor }]}>
              <Text style={[styles.metricBoxLabel, { color: subtitleColor }]}>BMI</Text>
              <Text style={[styles.metricBoxValue, { color: bmiInfo.color }]}>
                {bmi.toFixed(1)}
              </Text>
              <Text
                style={[styles.bmiBadgeText, { color: bmiInfo.color }]}
                numberOfLines={1}
              >
                {bmiInfo.label}
              </Text>
            </View>

            {/* Target */}
            <View style={[styles.metricBox, { backgroundColor: inputBgColor }]}>
              <Text style={[styles.metricBoxLabel, { color: subtitleColor }]}>Target</Text>
              <Text style={[styles.metricBoxValue, { color: textColor }]}>
                {targetWeightKg.toFixed(1)} kg
              </Text>
            </View>
          </View>

          {/* Goal Banner */}
          <View style={[styles.goalBanner, { backgroundColor: inputBgColor }]}>
            <MaterialIcons name="track-changes" size={16} color="#003882" />
            <Text
              style={[styles.goalBannerText, { color: textColor }]}
              numberOfLines={1}
            >
              Goal: {fitnessGoal}
            </Text>
          </View>
        </View>

        {/* 4. Section: Passes & Activity */}
        <Text style={[styles.sectionHeading, { color: textColor }]}>Passes & Activity</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (onNavigateToBookings) {
              onNavigateToBookings();
            } else {
              navigation.navigate('MyBookings');
            }
          }}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="confirmation-number" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>My Session Bookings</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>View upcoming gym sessions & passes</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (onNavigateToMemberships) {
              onNavigateToMemberships();
            } else {
              navigation.navigate('MyMemberships');
            }
          }}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="card-membership" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>My Gym Memberships</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>Active plans, duration & QR access</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('AttendanceHistory')}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="history" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>Check-in & Attendance History</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>
              {monthlyCheckInsCount !== null
                ? `${monthlyCheckInsCount} check-ins recorded this month`
                : 'View all check-in & workout logs'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>

        {/* 5. Section: Payments & Billing */}
        <Text style={[styles.sectionHeading, { color: textColor }]}>Payments & Billing</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigation.navigate('Wallet')}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 191, 98, 0.12)' }]}>
            <Ionicons name="wallet" size={20} color={AppColors.secondaryColor} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>GYMEZY Digital Wallet</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>Prorated balance, top-ups & instant payouts</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowInvoicesModal(true)}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="receipt-long" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>Invoices & Receipts</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>Download GST receipts & payment records</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>


        {/* 6. Section: Preferences & Security */}
        <Text style={[styles.sectionHeading, { color: textColor }]}>Preferences & Security</Text>

        <View style={[styles.preferencesCard, { backgroundColor: cardColor, borderColor: borderColor }]}>
          {/* Switch 1: Workout Reminders */}
          <View style={styles.switchTile}>
            <MaterialIcons name="notifications-active" size={22} color="#003882" style={{ marginRight: 12 }} />
            <View style={styles.switchContent}>
              <Text style={[styles.switchTitle, { color: textColor }]}>Workout Reminders</Text>
              <Text style={[styles.switchSubtitle, { color: subtitleColor }]}>Daily notifications before your session</Text>
            </View>
            <Switch
              value={workoutReminders}
              onValueChange={handleToggleWorkoutReminders}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={workoutReminders ? '#003882' : '#F4F3F4'}
            />
          </View>

          <View style={[styles.switchDivider, { backgroundColor: borderColor }]} />

          {/* Switch 2: Pass Expiry Alerts */}
          <View style={styles.switchTile}>
            <MaterialIcons name="alarm" size={22} color="#003882" style={{ marginRight: 12 }} />
            <View style={styles.switchContent}>
              <Text style={[styles.switchTitle, { color: textColor }]}>Pass Expiry Alerts</Text>
              <Text style={[styles.switchSubtitle, { color: subtitleColor }]}>Get notified 3 days before membership ends</Text>
            </View>
            <Switch
              value={passExpiryAlerts}
              onValueChange={handleTogglePassExpiryAlerts}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={passExpiryAlerts ? '#003882' : '#F4F3F4'}
            />
          </View>

          <View style={[styles.switchDivider, { backgroundColor: borderColor }]} />

          {/* Switch 3: Biometric Login */}
          <View style={styles.switchTile}>
            <MaterialIcons name="fingerprint" size={22} color="#003882" style={{ marginRight: 12 }} />
            <View style={styles.switchContent}>
              <Text style={[styles.switchTitle, { color: textColor }]}>Biometric / Face ID Login</Text>
              <Text style={[styles.switchSubtitle, { color: subtitleColor }]}>Fast authentication for check-in QR</Text>
            </View>
            <Switch
              value={biometricLogin}
              onValueChange={handleToggleBiometricLogin}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={biometricLogin ? '#003882' : '#F4F3F4'}
            />
          </View>
        </View>

        {/* 7. Section: Support & About */}
        <Text style={[styles.sectionHeading, { color: textColor }]}>Support & About</Text>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setShowFaqModal(true)}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="help-outline" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>Help & FAQ Center</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>Answers to common booking questions</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => showToast({ message: 'Connecting to GYMEZY 24/7 Support Desk...', isSuccess: true })}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="chat-bubble-outline" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>Contact Customer Support</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>24/7 WhatsApp & In-app assistance</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => showToast({ message: 'GYMEZY Privacy Policy: Secure & Encrypted' })}
          style={[styles.menuTile, { backgroundColor: cardColor, borderColor: borderColor }]}
        >
          <View style={[styles.menuIconBox, { backgroundColor: isDark ? '#262626' : 'rgba(0, 56, 130, 0.08)' }]}>
            <MaterialIcons name="privacy-tip" size={20} color={isDark ? '#93C5FD' : '#003882'} />
          </View>
          <View style={styles.menuTileContent}>
            <Text style={[styles.menuTileTitle, { color: textColor }]}>Privacy Policy & Terms</Text>
            <Text style={[styles.menuTileSubtitle, { color: subtitleColor }]}>GYMEZY User Agreements v2.4.0</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={subtitleColor} />
        </TouchableOpacity>

        {/* 8. Log Out & Version */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowLogoutDialog(true)}
          style={styles.logoutBtn}
        >
          <MaterialIcons name="logout" size={20} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <BrandWatermarkFooter />

        <Text style={[styles.versionFooterText, { color: subtitleColor }]}>
          GYMEZY App • Version 2.4.0 (Build 2026)
        </Text>
      </ScrollView>

      {/* ============================================================ */}
      {/* MODAL 0: AVATAR PICKER (Bottom Sheet) */}
      {/* ============================================================ */}
      <Modal
        visible={showAvatarPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowAvatarPickerModal(false)}
          />
          <View style={[styles.bottomSheetContainer, { backgroundColor: cardColor }]}>
            {/* Sheet Top Grab Handle */}
            <View style={styles.sheetGrabHandle} />

            {/* Sheet Header */}
            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={[styles.sheetTitleText, { color: textColor }]}>Profile Photo</Text>
                <Text style={[styles.sheetSubtitleText, { color: subtitleColor }]}>
                  Choose a photo or select an avatar preset
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAvatarPickerModal(false)}
                style={styles.sheetCloseBtn}
              >
                <MaterialIcons name="close" size={22} color={subtitleColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Current Avatar Preview & Status */}
              <View style={styles.avatarPickerPreviewSection}>
                <View style={[styles.avatarPickerPreviewCircle, { borderColor: isDark ? '#93C5FD' : '#003882' }]}>
                  <Image source={{ uri: avatarUrl }} style={styles.avatarPickerPreviewImg} resizeMode="cover" />
                  {isUpdatingAvatar && (
                    <View style={styles.avatarLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </View>
                <Text style={[styles.avatarPickerPreviewName, { color: textColor }]}>{userName}</Text>
                <Text style={[styles.avatarPickerPreviewSub, { color: subtitleColor }]}>Current Profile Avatar</Text>
              </View>

              {/* Upload Actions: Camera & Gallery */}
              <View style={styles.avatarActionGrid}>
                {/* 1. Take Photo */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleTakePhoto}
                  style={[
                    styles.avatarActionCard,
                    {
                      backgroundColor: isDark ? '#262626' : '#F1F5F9',
                      borderColor: borderColor,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#3B82F6', '#1D4ED8']}
                    style={styles.avatarActionIconGrad}
                  >
                    <MaterialIcons name="photo-camera" size={22} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.avatarActionTitle, { color: textColor }]}>Take Photo</Text>
                  <Text style={[styles.avatarActionSub, { color: subtitleColor }]}>Use camera</Text>
                </TouchableOpacity>

                {/* 2. Choose from Library */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handlePickFromGallery}
                  style={[
                    styles.avatarActionCard,
                    {
                      backgroundColor: isDark ? '#262626' : '#F1F5F9',
                      borderColor: borderColor,
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.avatarActionIconGrad}
                  >
                    <MaterialIcons name="photo-library" size={22} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={[styles.avatarActionTitle, { color: textColor }]}>Upload Photo</Text>
                  <Text style={[styles.avatarActionSub, { color: subtitleColor }]}>From gallery</Text>
                </TouchableOpacity>
              </View>

              {/* Section: Fitness Avatars Presets */}
              <View style={styles.presetSectionHeader}>
                <MaterialIcons name="face" size={18} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 6 }} />
                <Text style={[styles.presetSectionTitle, { color: textColor }]}>
                  Or Choose a Fitness Avatar
                </Text>
              </View>

              <View style={styles.avatarPresetsGrid}>
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = avatarUrl === preset.url;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      activeOpacity={0.8}
                      onPress={() => handleSelectPresetAvatar(preset.url)}
                      style={styles.presetItem}
                    >
                      <View
                        style={[
                          styles.presetAvatarWrapper,
                          isSelected && {
                            borderColor: '#003882',
                            borderWidth: 2.5,
                            shadowColor: '#003882',
                            shadowOpacity: 0.35,
                            shadowRadius: 6,
                            elevation: 4,
                          },
                        ]}
                      >
                        <Image source={{ uri: preset.url }} style={styles.presetAvatarImage} resizeMode="cover" />
                        {isSelected && (
                          <View style={styles.presetCheckmarkBadge}>
                            <MaterialIcons name="check" size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.presetLabel,
                          {
                            color: isSelected ? (isDark ? '#93C5FD' : '#003882') : subtitleColor,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Image URL Option */}
              <View style={styles.customUrlSection}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setShowCustomUrlInput(!showCustomUrlInput)}
                  style={[styles.customUrlHeaderRow, { borderColor: borderColor }]}
                >
                  <MaterialIcons name="link" size={18} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 8 }} />
                  <Text style={[styles.customUrlHeaderText, { color: textColor }]}>
                    Paste Custom Image URL
                  </Text>
                  <MaterialIcons
                    name={showCustomUrlInput ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={20}
                    color={subtitleColor}
                  />
                </TouchableOpacity>

                {showCustomUrlInput && (
                  <View style={styles.customUrlInputBox}>
                    <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor, marginBottom: 8 }]}>
                      <TextInput
                        value={customAvatarUrl}
                        onChangeText={setCustomAvatarUrl}
                        placeholder="https://example.com/photo.jpg"
                        placeholderTextColor={subtitleColor}
                        autoCapitalize="none"
                        style={[styles.textInput, { color: textColor }]}
                      />
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        if (customAvatarUrl.trim()) {
                          handleSaveAvatar(customAvatarUrl.trim());
                          setCustomAvatarUrl('');
                          setShowCustomUrlInput(false);
                        } else {
                          showToast({ message: 'Please enter a valid image URL' });
                        }
                      }}
                      style={styles.applyUrlBtn}
                    >
                      <Text style={styles.applyUrlBtnText}>Apply Photo URL</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Remove Photo Option */}
              {avatarUrl ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleRemovePhoto}
                  style={[styles.removeAvatarBtn, { borderColor: borderColor }]}
                >
                  <MaterialIcons name="delete-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.removeAvatarText}>Remove Photo & Reset to Default</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 1: EDIT PERSONAL PROFILE (Bottom Sheet) */}
      {/* ============================================================ */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowEditProfileModal(false)}
          />
          <View style={[styles.bottomSheetContainer, { backgroundColor: cardColor }]}>
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitleText, { color: textColor }]}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setShowEditProfileModal(false)}
                style={styles.sheetCloseBtn}
              >
                <MaterialIcons name="close" size={22} color={subtitleColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Avatar Quick Switch Banner inside Edit Profile */}
              <View style={[styles.editProfileAvatarBanner, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                <View style={styles.editProfileAvatarStack}>
                  <Image source={{ uri: avatarUrl }} style={styles.editProfileAvatarImg} />
                  <View style={styles.editProfileCameraBadge}>
                    <MaterialIcons name="photo-camera" size={11} color="#FFFFFF" />
                  </View>
                </View>
                <View style={styles.editProfileAvatarInfo}>
                  <Text style={[styles.editProfileAvatarTitle, { color: textColor }]}>Profile Picture</Text>
                  <Text style={[styles.editProfileAvatarSub, { color: subtitleColor }]}>PNG, JPG or Fitness Preset</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowEditProfileModal(false);
                    setTimeout(() => setShowAvatarPickerModal(true), 250);
                  }}
                  style={styles.editProfileChangePhotoBtn}
                >
                  <Text style={styles.editProfileChangePhotoText}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Full Name */}
              <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Full Name</Text>
              <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                <MaterialIcons name="person-outline" size={20} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 10 }} />
                <TextInput
                  value={tempName}
                  onChangeText={setTempName}
                  style={[styles.textInput, { color: textColor }]}
                  placeholder="Full Name"
                  placeholderTextColor={subtitleColor}
                />
              </View>

              {/* Email Address */}
              <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Email Address</Text>
              <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                <MaterialIcons name="mail-outline" size={20} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 10 }} />
                <TextInput
                  value={tempEmail}
                  onChangeText={setTempEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={[styles.textInput, { color: textColor }]}
                  placeholder="Email"
                  placeholderTextColor={subtitleColor}
                />
              </View>

              {/* Phone Number */}
              <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Phone Number</Text>
              <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                <MaterialIcons name="phone" size={20} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 10 }} />
                <TextInput
                  value={tempPhone}
                  onChangeText={setTempPhone}
                  keyboardType="phone-pad"
                  style={[styles.textInput, { color: textColor }]}
                  placeholder="Phone"
                  placeholderTextColor={subtitleColor}
                />
              </View>

              {/* Emergency Contact */}
              <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Emergency Contact</Text>
              <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                <MaterialIcons name="contact-phone" size={20} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 10 }} />
                <TextInput
                  value={tempEmergency}
                  onChangeText={setTempEmergency}
                  style={[styles.textInput, { color: textColor }]}
                  placeholder="Emergency Contact"
                  placeholderTextColor={subtitleColor}
                />
              </View>

              {/* Gender */}
              <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Gender</Text>
              <View style={styles.genderRow}>
                {['Male', 'Female', 'Other'].map((g) => {
                  const isSel = tempGender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      activeOpacity={0.8}
                      onPress={() => setTempGender(g)}
                      style={[
                        styles.genderPill,
                        {
                          backgroundColor: isSel
                            ? '#003882'
                            : isDark
                            ? '#262626'
                            : '#F1F5F9',
                          borderColor: isSel ? '#003882' : borderColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.genderPillText,
                          { color: isSel ? '#FFFFFF' : textColor, fontWeight: isSel ? 'bold' : '500' },
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Save Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveProfile}
                style={styles.sheetSaveBtn}
              >
                <Text style={styles.sheetSaveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: FITNESS METRICS & GOALS (Bottom Sheet) */}
      {/* ============================================================ */}
      <Modal
        visible={showMeasurementsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMeasurementsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowMeasurementsModal(false)}
          />
          <View style={[styles.bottomSheetContainer, { backgroundColor: cardColor }]}>
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitleText, { color: textColor }]}>Fitness Metrics & Goals</Text>
              <TouchableOpacity
                onPress={() => setShowMeasurementsModal(false)}
                style={styles.sheetCloseBtn}
              >
                <MaterialIcons name="close" size={22} color={subtitleColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Height & Weight Row */}
              <View style={styles.metricsFormRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Height (cm)</Text>
                  <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                    <MaterialIcons name="height" size={20} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 8 }} />
                    <TextInput
                      value={tempHeight}
                      onChangeText={setTempHeight}
                      keyboardType="numeric"
                      style={[styles.textInput, { color: textColor }]}
                    />
                  </View>
                </View>

                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Weight (kg)</Text>
                  <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                    <MaterialIcons name="monitor-weight" size={20} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 8 }} />
                    <TextInput
                      value={tempWeight}
                      onChangeText={setTempWeight}
                      keyboardType="decimal-pad"
                      style={[styles.textInput, { color: textColor }]}
                    />
                  </View>
                </View>
              </View>

              {/* Target Weight */}
              <Text style={[styles.fieldLabel, { color: subtitleColor }]}>Target Weight (kg)</Text>
              <View style={[styles.inputContainer, { backgroundColor: inputBgColor, borderColor: borderColor }]}>
                <MaterialIcons name="flag" size={20} color={isDark ? '#93C5FD' : '#003882'} style={{ marginRight: 10 }} />
                <TextInput
                  value={tempTargetWeight}
                  onChangeText={setTempTargetWeight}
                  keyboardType="decimal-pad"
                  style={[styles.textInput, { color: textColor }]}
                />
              </View>

              {/* Primary Fitness Goal */}
              <Text style={[styles.fieldLabel, { color: subtitleColor, marginTop: 12 }]}>Primary Fitness Goal</Text>
              {FITNESS_GOALS.map((goal) => {
                const isSel = tempGoal === goal;
                return (
                  <TouchableOpacity
                    key={goal}
                    activeOpacity={0.8}
                    onPress={() => setTempGoal(goal)}
                    style={[
                      styles.goalSelectRow,
                      {
                        backgroundColor: isSel
                          ? isDark
                            ? 'rgba(30, 58, 138, 0.5)'
                            : 'rgba(0, 56, 130, 0.08)'
                          : isDark
                          ? '#262626'
                          : '#F8FAFC',
                        borderColor: isSel ? '#003882' : borderColor,
                        borderWidth: isSel ? 1.5 : 1,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={isSel ? 'check-circle' : 'radio-button-unchecked'}
                      size={20}
                      color={isSel ? '#003882' : subtitleColor}
                      style={{ marginRight: 10 }}
                    />
                    <Text
                      style={[
                        styles.goalSelectText,
                        {
                          color: textColor,
                          fontWeight: isSel ? 'bold' : '500',
                        },
                      ]}
                    >
                      {goal}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Save Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSaveMeasurements}
                style={styles.sheetSaveBtn}
              >
                <Text style={styles.sheetSaveBtnText}>Update Metrics</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: INVOICES & BILLING RECEIPTS */}
      {/* ============================================================ */}
      <Modal
        visible={showInvoicesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInvoicesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowInvoicesModal(false)}
          />
          <View style={[styles.bottomSheetContainer, { backgroundColor: cardColor }]}>
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitleText, { color: textColor }]}>Invoices & Receipts</Text>
              <TouchableOpacity
                onPress={() => setShowInvoicesModal(false)}
                style={styles.sheetCloseBtn}
              >
                <MaterialIcons name="close" size={22} color={subtitleColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {userInvoices.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <MaterialIcons name="receipt" size={44} color={subtitleColor} />
                  <Text style={{ color: textColor, fontWeight: '700', fontSize: 16, marginTop: 10 }}>
                    No Invoices Found
                  </Text>
                  <Text style={{ color: subtitleColor, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                    Your session bookings and gym membership purchases will appear here.
                  </Text>
                </View>
              ) : (
                userInvoices.map((inv) => (
                  <View
                    key={inv.id}
                    style={[
                      styles.invoiceItemCard,
                      {
                        backgroundColor: isDark ? '#262626' : '#F8FAFC',
                        borderColor: borderColor,
                      },
                    ]}
                  >
                    <View style={styles.invoiceIconBox}>
                      <MaterialIcons name="receipt-long" size={22} color="#003882" />
                    </View>
                    <View style={styles.invoiceContent}>
                      <Text style={[styles.invoiceTitle, { color: textColor }]}>{inv.title}</Text>
                      <Text style={[styles.invoiceMeta, { color: subtitleColor }]}>
                        {inv.id} • {inv.date}
                      </Text>
                    </View>
                    <View style={styles.invoicePriceCol}>
                      <Text style={[styles.invoiceAmount, { color: textColor }]}>{inv.amount}</Text>
                      <View style={styles.paidBadge}>
                        <Text style={styles.paidBadgeText}>PAID</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: HELP & FREQUENTLY ASKED QUESTIONS */}
      {/* ============================================================ */}
      <Modal
        visible={showFaqModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFaqModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setShowFaqModal(false)}
          />
          <View style={[styles.bottomSheetContainer, { backgroundColor: cardColor }]}>
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitleText, { color: textColor }]}>Help & FAQs</Text>
              <TouchableOpacity
                onPress={() => setShowFaqModal(false)}
                style={styles.sheetCloseBtn}
              >
                <MaterialIcons name="close" size={22} color={subtitleColor} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {FAQS.map((faq, index) => {
                const isOpen = expandedFaqIndex === index;
                return (
                  <View
                    key={index}
                    style={[
                      styles.faqItemContainer,
                      { borderBottomColor: borderColor },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setExpandedFaqIndex(isOpen ? null : index)}
                      style={styles.faqHeaderRow}
                    >
                      <Text style={[styles.faqQuestionText, { color: textColor }]}>
                        {faq.q}
                      </Text>
                      <MaterialIcons
                        name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                        size={22}
                        color={subtitleColor}
                      />
                    </TouchableOpacity>
                    {isOpen && (
                      <Text style={[styles.faqAnswerText, { color: subtitleColor }]}>
                        {faq.a}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ============================================================ */}
      {/* CONFIRM LOGOUT DIALOG */}
      {/* ============================================================ */}
      <Modal
        visible={showLogoutDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutDialog(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogContainer, { backgroundColor: cardColor }]}>
            <Text style={[styles.dialogTitle, { color: textColor }]}>
              Log Out of GYMEZY?
            </Text>
            <Text style={[styles.dialogContentText, { color: subtitleColor }]}>
              Are you sure you want to log out? You'll need your phone number and OTP to log back in.
            </Text>
            <View style={styles.dialogActionsRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowLogoutDialog(false)}
                style={styles.dialogCancelBtn}
              >
                <Text style={[styles.dialogCancelBtnText, { color: subtitleColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleLogout}
                style={styles.dialogLogoutBtn}
              >
                <Text style={styles.dialogLogoutBtnText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  appBarTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  headerActionBtn: {
    padding: 6,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
  },

  /* Profile Card */
  profileCard: {
    borderRadius: 24,
    borderWidth: 1.2,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStack: {
    position: 'relative',
    width: 72,
    height: 72,
  },
  avatarBorder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: '#003882',
    padding: 5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityDetails: {
    flex: 1,
    marginLeft: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  userPhoneText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },
  userEmailText: {
    fontSize: 12,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    marginTop: 16,
    marginBottom: 12,
  },
  vipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  vipPillContent: {
    flex: 1,
    marginLeft: 10,
  },
  vipPillBadge: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  vipPillGym: {
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 1,
  },

  /* 4 Stat Cards Row */
  statCardsRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 8,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    textAlign: 'center',
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  /* Body Metrics Card */
  metricsCard: {
    borderRadius: 22,
    borderWidth: 1.2,
    padding: 18,
    marginTop: 18,
  },
  metricsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metricsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricsIconContainer: {
    padding: 8,
    backgroundColor: 'rgba(0, 56, 130, 0.1)',
    borderRadius: 10,
    marginRight: 10,
  },
  metricsTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  editMetricsBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editMetricsText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  metricBoxesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  metricBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  metricBoxLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  metricBoxValue: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: 4,
  },
  bmiBadgeText: {
    fontSize: 8.5,
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center',
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  goalBannerText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
    flex: 1,
  },

  /* Section Headings */
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  /* Menu Tiles */
  menuTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1.2,
    marginBottom: 8,
  },
  menuIconBox: {
    padding: 9,
    borderRadius: 12,
    marginRight: 14,
  },
  menuTileContent: {
    flex: 1,
  },
  menuTileTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  menuTileSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },

  /* Preferences Card */
  preferencesCard: {
    borderRadius: 20,
    borderWidth: 1.2,
    paddingVertical: 4,
  },
  switchTile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  switchContent: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  switchSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  switchDivider: {
    height: 1,
  },

  /* Logout Button */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    marginTop: 24,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  versionFooterText: {
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 16,
  },

  /* Modals and Sheets */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdropTouch: {
    flex: 1,
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  sheetGrabHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitleText: {
    fontSize: 20,
    fontWeight: '900',
  },
  sheetSubtitleText: {
    fontSize: 12.5,
    marginTop: 2,
  },
  sheetCloseBtn: {
    padding: 4,
  },

  /* Avatar Picker Modal Styles */
  avatarPickerPreviewSection: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  avatarPickerPreviewCircle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 8,
  },
  avatarPickerPreviewImg: {
    width: '100%',
    height: '100%',
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickerPreviewName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarPickerPreviewSub: {
    fontSize: 12,
    marginTop: 2,
  },
  avatarActionGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 18,
  },
  avatarActionCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
  },
  avatarActionIconGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarActionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  avatarActionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  presetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  presetSectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  avatarPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  presetItem: {
    width: '22%',
    alignItems: 'center',
    marginBottom: 12,
  },
  presetAvatarWrapper: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  presetAvatarImage: {
    width: '100%',
    height: '100%',
  },
  presetCheckmarkBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#003882',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  /* Custom URL Section */
  customUrlSection: {
    marginTop: 4,
    marginBottom: 12,
  },
  customUrlHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  customUrlHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  customUrlInputBox: {
    marginTop: 10,
  },
  applyUrlBtn: {
    backgroundColor: '#003882',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyUrlBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },

  removeAvatarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  removeAvatarText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Edit Profile Modal Avatar Banner */
  editProfileAvatarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  editProfileAvatarStack: {
    width: 48,
    height: 48,
    borderRadius: 24,
    position: 'relative',
  },
  editProfileAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  editProfileCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#003882',
    padding: 3,
    borderRadius: 8,
  },
  editProfileAvatarInfo: {
    flex: 1,
    marginLeft: 12,
  },
  editProfileAvatarTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
  },
  editProfileAvatarSub: {
    fontSize: 11,
    marginTop: 2,
  },
  editProfileChangePhotoBtn: {
    backgroundColor: '#003882',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  editProfileChangePhotoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  genderPillText: {
    fontSize: 13,
  },
  sheetSaveBtn: {
    backgroundColor: '#003882',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  sheetSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },

  /* Metrics Modal */
  metricsFormRow: {
    flexDirection: 'row',
  },
  goalSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  goalSelectText: {
    fontSize: 13.5,
    flex: 1,
  },

  /* Invoice Modal */
  invoiceItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  invoiceIconBox: {
    padding: 10,
    backgroundColor: 'rgba(0, 56, 130, 0.1)',
    borderRadius: 12,
    marginRight: 12,
  },
  invoiceContent: {
    flex: 1,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  invoiceMeta: {
    fontSize: 11.5,
    marginTop: 2,
  },
  invoicePriceCol: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  paidBadge: {
    backgroundColor: '#E6F7EF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  paidBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#047857',
  },

  /* FAQ */
  faqItemContainer: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  faqHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    paddingRight: 8,
  },
  faqAnswerText: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },

  /* Dialog */
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialogContainer: {
    width: '100%',
    borderRadius: 22,
    padding: 22,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },
  dialogContentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  dialogActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dialogCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dialogCancelBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  dialogLogoutBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dialogLogoutBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
