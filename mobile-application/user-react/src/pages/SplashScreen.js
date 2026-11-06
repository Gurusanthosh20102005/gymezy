import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  ImageBackground,
  StyleSheet,
  Animated,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { AppColors } from '../theme/appTheme';
import { useAuth } from '../context/AuthContext';
import { gymService } from '../services/gymService';
import { locationService } from '../services/locationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SplashScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const { isAuthenticated, isRestoringSession } = useAuth();

  const [isInitializing, setIsInitializing] = useState(true);
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  const isNavigatingRef = useRef(false);

  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(20)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // Entrance animations
  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const tagTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }, 500);

    return () => clearTimeout(tagTimer);
  }, []);

  const handleAuthenticatedFlow = async (startTime) => {
    // 1. Get saved location from memory / storage (fallback to Anna Nagar)
    const savedLocation = await locationService.getLastSavedLocation();

    // 2. Pre-fetch initial gyms for this exact location so home screen renders instantly
    await gymService.fetchGyms({
      lat: savedLocation.latitude,
      lng: savedLocation.longitude,
      page: 1,
      limit: 15,
    });

    const elapsed = Date.now() - startTime;
    if (elapsed < 1200) {
      await new Promise((resolve) => setTimeout(resolve, 1200 - elapsed));
    }

    if (!isNavigatingRef.current) {
      isNavigatingRef.current = true;
      navigation.replace('HomeTabs');
    }
  };

  const handleUnauthenticatedFlow = async (startTime) => {
    const onboardingDone = await AsyncStorage.getItem('@gymezy_onboarding_completed');
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
    }

    if (!isNavigatingRef.current) {
      isNavigatingRef.current = true;
      const targetScreen = onboardingDone === 'true' ? 'Login' : 'Onboarding';
      navigation.replace(targetScreen);
    }
  };

  // Main App Initializer & Data Loader
  const startBootstrap = useCallback(async () => {
    if (isRestoringSession || isNavigatingRef.current) return;

    setShowNetworkWarning(false);
    setIsInitializing(true);

    const networkTimeout = setTimeout(() => {
      if (!isNavigatingRef.current) {
        setShowNetworkWarning(true);
      }
    }, 5000);

    const startTime = Date.now();

    try {
      if (isAuthenticated) {
        await handleAuthenticatedFlow(startTime);
      } else {
        await handleUnauthenticatedFlow(startTime);
      }
      clearTimeout(networkTimeout);
    } catch (_err) {
      console.warn('[SPLASH] Initial load error:', _err?.message);
      clearTimeout(networkTimeout);
      if (!isNavigatingRef.current) {
        setShowNetworkWarning(true);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [isAuthenticated, isRestoringSession, navigation]);

  useEffect(() => {
    if (!isRestoringSession) {
      void startBootstrap();
    }
  }, [isRestoringSession, startBootstrap]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor="transparent"
      />
      <ImageBackground
        source={require('../../assets/pages/splash_screen/splashscreen_background.png')}
        style={styles.bgImage}
        resizeMode="cover"
      >
        <View
          style={[
            styles.overlay,
            {
              backgroundColor: isDark
                ? 'rgba(0, 0, 0, 0.65)'
                : 'rgba(255, 255, 255, 0.88)',
            },
          ]}
        >
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image
              source={require('../../assets/logo/gymezy.png')}
              style={[
                styles.logo,
                {
                  tintColor: isDark ? '#FFFFFF' : AppColors.primaryColor,
                },
              ]}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.taglineContainer,
              {
                opacity: textOpacity,
                transform: [{ translateY: textSlide }],
              },
            ]}
          >
            <Text
              style={[
                styles.tagline,
                {
                  color: isDark ? '#FFFFFF' : AppColors.primaryColor,
                },
              ]}
            >
              PREMIUM FITNESS
            </Text>
          </Animated.View>

          {/* Bottom Loading Indicator & Subtle Network Note */}
          <View style={styles.bottomStatusContainer}>
            {isInitializing && (
              <View style={styles.loaderCol}>
                <ActivityIndicator
                  size="small"
                  color={isDark ? '#FFFFFF' : AppColors.primaryColor}
                />
                {showNetworkWarning && (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => void startBootstrap()}
                    style={styles.noteContainer}
                  >
                    <Text
                      style={[
                        styles.networkNote,
                        { color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(30, 41, 59, 0.7)' },
                      ]}
                    >
                      Check your internet connection
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 140,
    height: 140,
  },
  taglineContainer: {
    marginTop: 35,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 8,
  },
  bottomStatusContainer: {
    position: 'absolute',
    bottom: 55,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  networkNote: {
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

