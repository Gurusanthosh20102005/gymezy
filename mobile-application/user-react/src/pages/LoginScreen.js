import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';
import { biometricService } from '../services/biometricService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const FITNESS_GOALS = [
  { id: 'GENERAL_FITNESS', label: 'General Fitness' },
  { id: 'WEIGHT_LOSS', label: 'Weight Loss' },
  { id: 'HYPERTROPHY', label: 'Muscle Building' },
  { id: 'STRENGTH', label: 'Strength Training' },
];

export const LoginScreen = ({ navigation }) => {
  const { isDark, colors } = useTheme();
  const { showToast } = useToast();
  const {
    login,
    register,
    loginWithBiometrics,
    savedIdentifier,
    isLoading,
    sessionExpiredMessage,
    clearSessionExpiredMessage,
  } = useAuth();

  const [isBiometricReady, setIsBiometricReady] = useState(false);
  const [biometricType, setBiometricType] = useState('FINGERPRINT');

  const scrollViewRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Track keyboard height to dynamically expand ScrollView bottom padding
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Tab State: 'SIGN_IN' or 'SIGN_UP'
  const [authMode, setAuthMode] = useState('SIGN_IN');

  // Sign In State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [obscurePassword, setObscurePassword] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});

  // Sign Up State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupObscurePassword, setSignupObscurePassword] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState('GENERAL_FITNESS');

  // Display session expired notification if auto-logged out
  useEffect(() => {
    if (sessionExpiredMessage) {
      showToast({
        message: sessionExpiredMessage,
        isError: true,
      });
      clearSessionExpiredMessage();
    }
  }, [sessionExpiredMessage, clearSessionExpiredMessage, showToast]);

  // Load saved remember me identifier on mount
  useEffect(() => {
    if (savedIdentifier) {
      setIdentifier(savedIdentifier);
    }
  }, [savedIdentifier]);

  // Check biometric capability and saved session on mount
  useEffect(() => {
    let isMounted = true;
    const checkBiometricAvailability = async () => {
      try {
        const isEnabled = await biometricService.isBiometricEnabled();
        if (!isEnabled) {
          if (isMounted) setIsBiometricReady(false);
          return;
        }
        const session = await biometricService.getAuthSession();
        if (!session?.token) {
          if (isMounted) setIsBiometricReady(false);
          return;
        }
        const support = await biometricService.checkHardwareSupport();
        if (support.available) {
          const type = await biometricService.getBiometricType();
          if (isMounted) {
            setBiometricType(type);
            setIsBiometricReady(true);
          }
        } else {
          if (isMounted) setIsBiometricReady(false);
        }
      } catch {
        if (isMounted) setIsBiometricReady(false);
      }
    };

    checkBiometricAvailability();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleBiometricSignIn = async () => {
    const result = await loginWithBiometrics();
    if (result.success) {
      showToast({
        message: `Welcome back, ${result.user?.fullName || result.user?.name || 'Member'}!`,
        isSuccess: true,
      });
      navigation.replace('HomeTabs');
    } else {
      if (result.message && !result.message.toLowerCase().includes('cancel')) {
        showToast({
          message: result.message,
          isError: true,
        });
      }
    }
  };

  const fillDemoCredentials = () => {
    setAuthMode('SIGN_IN');
    setIdentifier('sam@gmail.com');
    setPassword('123456');
    setErrors({});
    showToast({
      message: 'Demo credentials filled! Tap Log In to continue.',
      isSuccess: true,
    });
  };

  const validateSignIn = () => {
    const newErrors = {};
    const cleanId = identifier.trim();

    if (!cleanId) {
      newErrors.identifier = 'Please enter your email or phone number';
    } else if (cleanId.includes('@') && !/\S+@\S+\.\S+/.test(cleanId)) {
      newErrors.identifier = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Please enter your password';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignUp = () => {
    const newErrors = {};
    const cleanName = signupName.trim();
    const cleanEmail = signupEmail.trim();
    const cleanPhone = signupPhone.trim();

    if (!cleanName || cleanName.length < 2) {
      newErrors.signupName = 'Please enter your full name (at least 2 characters)';
    }

    if (!cleanEmail) {
      newErrors.signupEmail = 'Please enter your email address';
    } else if (!/\S+@\S+\.\S+/.test(cleanEmail)) {
      newErrors.signupEmail = 'Please enter a valid email address';
    }

    if (!cleanPhone) {
      newErrors.signupPhone = 'Please enter your phone number';
    } else if (cleanPhone.length < 10) {
      newErrors.signupPhone = 'Please enter a valid 10-digit phone number';
    }

    if (!signupPassword) {
      newErrors.signupPassword = 'Please choose a password';
    } else if (signupPassword.length < 6) {
      newErrors.signupPassword = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateSignIn()) return;

    const result = await login({
      identifier: identifier.trim(),
      password,
      rememberMe,
    });

    if (result.success) {
      showToast({
        message: result.data?.message || 'Login successful! Welcome back.',
        isSuccess: true,
      });
      navigation.replace('HomeTabs');
    } else {
      showToast({
        message: result.message || 'Login failed. Please check your credentials.',
        isError: true,
      });
    }
  };

  const handleSignUp = async () => {
    if (!validateSignUp()) return;

    const result = await register({
      fullName: signupName.trim(),
      email: signupEmail.trim(),
      phone: signupPhone.trim(),
      password: signupPassword,
      fitnessGoal: selectedGoal,
    });

    if (result.success) {
      showToast({
        message: result.data?.message || 'Account created successfully! Welcome to GYMEZY.',
        isSuccess: true,
      });
      navigation.replace('HomeTabs');
    } else {
      showToast({
        message: result.message || 'Registration failed. Please try again.',
        isError: true,
      });
    }
  };



  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(keyboardHeight + 60, 160) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEnabled={true}
        nestedScrollEnabled={true}
        bounces={true}
        alwaysBounceVertical={true}
        overScrollMode="always"
      >
        {/* ==================== 1. TOP HERO BANNER ==================== */}
        <View style={styles.topHeroContainer}>
          <Image
            source={require('../../assets/pages/onboarding/onboarding_1.jpg')}
            style={styles.heroImage}
            resizeMode="cover"
          />

          <LinearGradient
            colors={
              isDark
                ? [
                    'rgba(0,0,0,0.65)',
                    'rgba(0,0,0,0.3)',
                    'rgba(18,18,18,0.85)',
                    AppColors.darkBackground,
                  ]
                : [
                    'rgba(0,0,0,0.5)',
                    'rgba(0,0,0,0.2)',
                    'rgba(0,0,0,0.3)',
                    'rgba(0,0,0,0.65)',
                  ]
            }
            stops={[0, 0.35, 0.75, 1]}
            style={styles.gradientOverlay}
          />

          {/* Centered Brand Identity */}
          <SafeAreaView style={styles.heroCenterContent}>
            <Image
              source={require('../../assets/logo/gymezy.png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
            <Text style={styles.heroSubtitle}>ELEVATE YOUR FITNESS</Text>
          </SafeAreaView>
        </View>

        {/* ==================== 2. SEGMENTED TAB SWITCHER ==================== */}
        <View style={styles.formContainer}>
          <View
            style={[
              styles.tabSwitcherCard,
              {
                backgroundColor: isDark ? AppColors.darkSurface : '#F1F5F9',
                borderColor: isDark ? AppColors.darkBorder : '#E2E8F0',
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tabSwitchBtn,
                authMode === 'SIGN_IN' && [
                  styles.tabSwitchBtnActive,
                  { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
                ],
              ]}
              onPress={() => {
                setAuthMode('SIGN_IN');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabSwitchText,
                  {
                    color:
                      authMode === 'SIGN_IN'
                        ? AppColors.primaryColor
                        : isDark
                        ? '#94A3B8'
                        : '#64748B',
                    fontWeight: authMode === 'SIGN_IN' ? '800' : '600',
                  },
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabSwitchBtn,
                authMode === 'SIGN_UP' && [
                  styles.tabSwitchBtnActive,
                  { backgroundColor: isDark ? AppColors.darkCard : '#FFFFFF' },
                ],
              ]}
              onPress={() => {
                setAuthMode('SIGN_UP');
                setErrors({});
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabSwitchText,
                  {
                    color:
                      authMode === 'SIGN_UP'
                        ? AppColors.primaryColor
                        : isDark
                        ? '#94A3B8'
                        : '#64748B',
                    fontWeight: authMode === 'SIGN_UP' ? '800' : '600',
                  },
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* ==================== 3. SIGN IN MODE ==================== */}
          {authMode === 'SIGN_IN' && (
            <View>
              <Text style={[styles.welcomeTitle, { color: colors.text }]}>Welcome Back</Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.subtitle }]}>
                Log in to access your workouts, passes, and gym memberships
              </Text>

              {/* Email / Phone Field */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Email or Phone Number</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.identifier ? '#EF4444' : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="person-outline"
                  size={20}
                  color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="e.g. sam@gmail.com or 9876543210"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
                  value={identifier}
                  onChangeText={(text) => {
                    setIdentifier(text);
                    if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: null }));
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {errors.identifier && <Text style={styles.errorText}>{errors.identifier}</Text>}

              {/* Password Field */}
              <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 16 }]}>Password</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.password ? '#EF4444' : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="lock-outline"
                  size={20}
                  color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  secureTextEntry={obscurePassword}
                />
                <TouchableOpacity
                  onPress={() => setObscurePassword(!obscurePassword)}
                  style={styles.inputSuffixBtn}
                >
                  <MaterialIcons
                    name={obscurePassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.subtitle}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

              {/* Remember Me & Forgot Password */}
              <View style={styles.rememberForgotRow}>
                <TouchableOpacity
                  onPress={() => setRememberMe(!rememberMe)}
                  style={styles.rememberRow}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: rememberMe ? AppColors.secondaryColor : 'transparent',
                        borderColor: rememberMe ? AppColors.secondaryColor : colors.border,
                      },
                    ]}
                  >
                    {rememberMe && <MaterialIcons name="check" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.rememberText, { color: colors.subtitle }]}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    showToast({
                      message: 'Password reset link sent to your registered email or phone.',
                    })
                  }
                >
                  <Text
                    style={[
                      styles.forgotText,
                      { color: isDark ? AppColors.darkAccentColor : AppColors.primaryColor },
                    ]}
                  >
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Log In Button */}
              <TouchableOpacity
                onPress={handleSignIn}
                disabled={isLoading}
                style={[styles.loginBtn, { backgroundColor: AppColors.secondaryColor }]}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.loginBtnContent}>
                    <Text style={styles.loginBtnText}>Log In</Text>
                    <MaterialIcons
                      name="arrow-forward"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Biometric / Face ID Quick Login Button */}
              {isBiometricReady && (
                <TouchableOpacity
                  onPress={handleBiometricSignIn}
                  disabled={isLoading}
                  style={[
                    styles.biometricBtn,
                    {
                      borderColor: isDark ? AppColors.darkBorder : '#BFDBFE',
                      backgroundColor: isDark ? 'rgba(0, 56, 130, 0.15)' : '#EFF6FF',
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={biometricType === 'FACIAL_RECOGNITION' ? 'face' : 'fingerprint'}
                    size={22}
                    color={AppColors.primaryColor}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={[styles.biometricBtnText, { color: isDark ? '#93C5FD' : AppColors.primaryColor }]}>
                    {biometricType === 'FACIAL_RECOGNITION'
                      ? 'Log In with Face ID'
                      : 'Log In with Fingerprint'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ==================== 4. SIGN UP MODE ==================== */}
          {authMode === 'SIGN_UP' && (
            <View>
              <Text style={[styles.welcomeTitle, { color: colors.text }]}>Join GYMEZY</Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.subtitle }]}>
                Start your fitness journey and explore top gyms near you
              </Text>

              {/* Full Name */}
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Full Name *</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.signupName ? '#EF4444' : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="badge"
                  size={20}
                  color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
                  value={signupName}
                  onChangeText={(text) => {
                    setSignupName(text);
                    if (errors.signupName) setErrors((prev) => ({ ...prev, signupName: null }));
                  }}
                />
              </View>
              {errors.signupName && <Text style={styles.errorText}>{errors.signupName}</Text>}

              {/* Email Address */}
              <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 14 }]}>
                Email Address *
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.signupEmail ? '#EF4444' : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="mail-outline"
                  size={20}
                  color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="e.g. rahul@domain.com"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
                  value={signupEmail}
                  onChangeText={(text) => {
                    setSignupEmail(text);
                    if (errors.signupEmail) setErrors((prev) => ({ ...prev, signupEmail: null }));
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
              {errors.signupEmail && <Text style={styles.errorText}>{errors.signupEmail}</Text>}

              {/* Phone Number */}
              <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 14 }]}>
                Phone Number *
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.signupPhone ? '#EF4444' : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="phone-iphone"
                  size={20}
                  color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="9876543210"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
                  value={signupPhone}
                  onChangeText={(text) => {
                    setSignupPhone(text);
                    if (errors.signupPhone) setErrors((prev) => ({ ...prev, signupPhone: null }));
                  }}
                  keyboardType="phone-pad"
                />
              </View>
              {errors.signupPhone && <Text style={styles.errorText}>{errors.signupPhone}</Text>}

              {/* Password */}
              <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 14 }]}>
                Password *
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: colors.card,
                    borderColor: errors.signupPassword ? '#EF4444' : colors.border,
                  },
                ]}
              >
                <MaterialIcons
                  name="lock-outline"
                  size={20}
                  color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                  style={styles.inputPrefixIcon}
                />
                <TextInput
                  style={[styles.inputField, { color: colors.text }]}
                  placeholder="At least 6 characters"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : '#94A3B8'}
                  value={signupPassword}
                  onChangeText={(text) => {
                    setSignupPassword(text);
                    if (errors.signupPassword)
                      setErrors((prev) => ({ ...prev, signupPassword: null }));
                  }}
                  secureTextEntry={signupObscurePassword}
                />
                <TouchableOpacity
                  onPress={() => setSignupObscurePassword(!signupObscurePassword)}
                  style={styles.inputSuffixBtn}
                >
                  <MaterialIcons
                    name={signupObscurePassword ? 'visibility-off' : 'visibility'}
                    size={20}
                    color={colors.subtitle}
                  />
                </TouchableOpacity>
              </View>
              {errors.signupPassword && (
                <Text style={styles.errorText}>{errors.signupPassword}</Text>
              )}

              {/* Fitness Goal */}
              <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 14 }]}>
                Primary Fitness Goal
              </Text>
              <View style={styles.goalChipsRow}>
                {FITNESS_GOALS.map((goal) => {
                  const isSelected = selectedGoal === goal.id;
                  return (
                    <TouchableOpacity
                      key={goal.id}
                      onPress={() => setSelectedGoal(goal.id)}
                      style={[
                        styles.goalChip,
                        {
                          backgroundColor: isSelected
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkSurface
                            : '#F1F5F9',
                          borderColor: isSelected
                            ? AppColors.primaryColor
                            : isDark
                            ? AppColors.darkBorder
                            : '#E2E8F0',
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.goalChipText,
                          {
                            color: isSelected ? '#FFFFFF' : isDark ? '#FFFFFF' : '#0F172A',
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {goal.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Register Button */}
              <TouchableOpacity
                onPress={handleSignUp}
                disabled={isLoading}
                style={[
                  styles.loginBtn,
                  { backgroundColor: AppColors.primaryColor, marginTop: 20 },
                ]}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <View style={styles.loginBtnContent}>
                    <Text style={styles.loginBtnText}>Create My Account</Text>
                    <MaterialIcons
                      name="check-circle"
                      size={18}
                      color="#FFFFFF"
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Footer Toggle */}
          <View style={styles.footerRow}>
            <Text style={[styles.footerText, { color: colors.subtitle }]}>
              {authMode === 'SIGN_IN'
                ? "Don't have an account? "
                : 'Already have an account? '}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setAuthMode(authMode === 'SIGN_IN' ? 'SIGN_UP' : 'SIGN_IN');
                setErrors({});
              }}
            >
              <Text style={styles.signUpLink}>
                {authMode === 'SIGN_IN' ? 'Sign Up' : 'Log In'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
  },
  topHeroContainer: {
    height: SCREEN_HEIGHT * 0.32,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  heroCenterContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogo: {
    height: 48,
    width: 140,
    tintColor: '#FFFFFF',
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
    marginTop: 8,
  },
  demoPillWrapper: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 10,
    right: 16,
  },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  demoPillText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
    marginLeft: 4,
  },
  formContainer: {
    paddingHorizontal: 22,
    paddingTop: 16,
  },
  tabSwitcherCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20,
  },
  tabSwitchBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabSwitchBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabSwitchText: {
    fontSize: 13,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 4,
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  inputPrefixIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
  },
  inputSuffixBtn: {
    padding: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 4,
  },
  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: {
    fontSize: 12.5,
    marginLeft: 8,
  },
  forgotText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  loginBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 14,
  },
  biometricBtnText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  goalChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  goalChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  goalChipText: {
    fontSize: 12,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 22,
  },
  footerText: {
    fontSize: 13,
  },
  signUpLink: {
    fontSize: 13,
    color: AppColors.secondaryColor,
    fontWeight: '700',
  },
});

export default LoginScreen;
