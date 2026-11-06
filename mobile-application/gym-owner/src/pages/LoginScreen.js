import React, { useState, useRef, useEffect } from 'react';
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
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useToast } from '../widgets/CustomScaffoldMessage';
import { useAuth } from '../context/AuthContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const LoginScreen = ({ navigation }) => {
  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const passwordInputRef = useRef(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [obscurePassword, setObscurePassword] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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

  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 36) : 44
  );

  const validate = () => {
    const newErrors = {};
    const trimmedId = identifier.trim();

    if (!trimmedId) {
      newErrors.identifier = 'Please enter your registered email or phone number';
    } else {
      const isEmail = /\S+@\S+\.\S+/.test(trimmedId);
      const isPhone = /^[0-9+ \-()]{7,15}$/.test(trimmedId);
      if (!isEmail && !isPhone) {
        newErrors.identifier = 'Please enter a valid email address or phone number';
      }
    }

    if (!password) {
      newErrors.password = 'Please enter your password';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    Keyboard.dismiss();

    setIsLoading(true);
    try {
      const result = await login({
        identifier: identifier.trim(),
        password: password.trim(),
      });

      if (result.success) {
        const loggedInUser = result.data?.user;
        const loggedInGym = result.data?.gym;
        const displayName =
          loggedInUser?.fullName ||
          loggedInGym?.name ||
          'Partner';
        const approvalStatus = loggedInGym?.approvalStatus || 'Pending Approval';
        const isApproved = approvalStatus === 'Approved';

        if (!isApproved) {
          showToast({
            message: `Welcome ${displayName}. Application status: ${approvalStatus}.`,
            isInfo: true,
          });
          navigation.replace('ApplicationStatus');
        } else {
          const roleTitle = loggedInUser?.role === 'MANAGER' ? 'Manager Portal' : 'Gym Owner Portal';
          showToast({
            message: `Welcome back, ${displayName}! ${roleTitle} loaded.`,
            isSuccess: true,
          });
          navigation.replace('Dashboard');
        }
      } else {
        const errorMsg =
          result.message || 'Invalid email/phone or password. Please try again.';
        showToast({
          message: errorMsg,
          isError: true,
        });
      }
    } catch (err) {
      showToast({
        message:
          err.message ||
          'Unable to connect to server. Please check your network and try again.',
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const surfaceBg = isDark ? AppColors.darkSurface : '#F8FAFC';
  const borderColor = isDark ? AppColors.darkBorder : '#E2E8F0';
  const textColor = isDark ? '#FFFFFF' : '#0F172A';
  const subtitleColor = isDark ? 'rgba(255, 255, 255, 0.65)' : '#64748B';

  // Increased top hero section height for cinematic visual presence and full page scrollability
  const heroHeight = Math.max(Math.round(SCREEN_HEIGHT * 0.44), 360);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? AppColors.darkBackground : '#F8FAFC' },
      ]}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(keyboardHeight + 60, 100 + (insets.bottom > 0 ? insets.bottom : 20)) },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={true}
          alwaysBounceVertical={true}
          overScrollMode="always"
          nestedScrollEnabled={true}
        >
          {/* 1. TOP HERO: Cinematic Visual with GYMEZY Logo & Vignette (Expanded Height) */}
          <View style={[styles.topHeroContainer, { height: heroHeight }]}>
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
                      'transparent',
                      'rgba(18,18,18,0.7)',
                      AppColors.darkBackground,
                    ]
                  : [
                      'rgba(0,0,0,0.55)',
                      'transparent',
                      'rgba(0,0,0,0.2)',
                      'rgba(0,0,0,0.6)',
                    ]
              }
              style={styles.gradientOverlay}
            />

            {/* Centered Brand Logo & Partner Tagline */}
            <View style={styles.heroCenterContent}>
              <Image
                source={require('../../assets/logo/gymezy.png')}
                style={styles.heroLogo}
                resizeMode="contain"
              />
              <Text style={styles.heroSubtitle}>PARTNER PORTAL</Text>
            </View>

            {/* Top Actions: Theme Switcher */}
            <View style={[styles.topActionsRow, { top: topInset + 6 }]}>
              <TouchableOpacity
                onPress={toggleTheme}
                style={styles.themePill}
                activeOpacity={0.8}
              >
                <Icon
                  name={isDark ? 'light-mode' : 'dark-mode'}
                  size={16}
                  color={isDark ? '#F59E0B' : '#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. FORM & ACTIONS SECTION */}
          <View style={styles.formContainer}>
            <Text style={[styles.welcomeTitle, { color: textColor }]}>
              Welcome Back, Partner
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: subtitleColor }]}>
              Log in to manage your gym facility, track revenue, and monitor check-ins
            </Text>

            {/* Email / Phone Number Field */}
            <Text style={[styles.fieldLabel, { color: textColor }]}>
              Registered Email / Phone Number
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: surfaceBg,
                  borderColor: errors.identifier ? AppColors.dangerRed : borderColor,
                },
              ]}
            >
              <Icon
                name="person-outline"
                size={20}
                color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                style={styles.inputPrefixIcon}
              />
              <TextInput
                style={[styles.inputField, { color: textColor }]}
                placeholder="e.g. owner@gym.com or +91 9876543210"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'}
                value={identifier}
                onChangeText={(text) => {
                  setIdentifier(text);
                  if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: null }));
                }}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({
                      y: Math.round(heroHeight * 0.4),
                      animated: true,
                    });
                  }, 120);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => {
                  passwordInputRef.current?.focus();
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({
                      y: heroHeight + 60,
                      animated: true,
                    });
                  }, 120);
                }}
                blurOnSubmit={false}
              />
            </View>
            {errors.identifier && <Text style={styles.errorText}>{errors.identifier}</Text>}

            {/* Password Field */}
            <Text
              style={[
                styles.fieldLabel,
                {
                  color: textColor,
                  marginTop: 16,
                },
              ]}
            >
              Password
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: surfaceBg,
                  borderColor: errors.password ? AppColors.dangerRed : borderColor,
                },
              ]}
            >
              <Icon
                name="lock-outline"
                size={20}
                color={isDark ? 'rgba(255,255,255,0.6)' : AppColors.primaryColor}
                style={styles.inputPrefixIcon}
              />
              <TextInput
                ref={passwordInputRef}
                style={[styles.inputField, { color: textColor }]}
                placeholder="Enter your password"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : '#94A3B8'}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                }}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({
                      y: heroHeight + 60,
                      animated: true,
                    });
                  }, 120);
                }}
                secureTextEntry={obscurePassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity
                onPress={() => setObscurePassword(!obscurePassword)}
                style={styles.inputSuffixBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon
                  name={obscurePassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color={subtitleColor}
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
                      backgroundColor: rememberMe
                        ? AppColors.secondaryColor
                        : 'transparent',
                      borderColor: rememberMe
                        ? AppColors.secondaryColor
                        : borderColor,
                    },
                  ]}
                >
                  {rememberMe && (
                    <Icon name="check" size={14} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[styles.rememberText, { color: subtitleColor }]}>
                  Remember me
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  Alert.alert(
                    'Password Reset',
                    'A password reset link or OTP will be sent to your registered email or phone.'
                  )
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
              onPress={handleLogin}
              disabled={isLoading}
              style={[
                styles.loginBtn,
                { backgroundColor: AppColors.secondaryColor },
              ]}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.loginBtnContent}>
                  <Text style={styles.loginBtnText}>Sign In to Dashboard</Text>
                  <Icon
                    name="arrow-forward"
                    size={18}
                    color="#FFFFFF"
                    style={styles.iconLeftMargin}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Partner Onboarding Footer */}
            <View style={styles.footerRow}>
              <Text style={[styles.footerText, { color: subtitleColor }]}>
                New gym partner?{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.signUpLink}>Register Your Gym</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  topHeroContainer: {
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
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 8,
  },
  topActionsRow: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  themePill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 22,
    paddingTop: 20,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 13.5,
    letterSpacing: 0.1,
    marginTop: 4,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  inputPrefixIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  inputSuffixBtn: {
    padding: 6,
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
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
  },
  signUpLink: {
    fontSize: 13,
    color: AppColors.secondaryColor,
    fontWeight: '700',
  },
  iconLeftMargin: {
    marginLeft: 8,
  },
});

export default LoginScreen;
