import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';
import { isJwtExpired, getJwtRemainingMs } from '../utils/jwtUtils';

const TOKEN_KEY = '@gymezy_user_jwt_token';
const USER_KEY = '@gymezy_user_auth_profile';
const REMEMBER_KEY = '@gymezy_user_remember_identifier';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [savedIdentifier, setSavedIdentifier] = useState('');
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(null);

  const autoLogoutTimerRef = useRef(null);

  /**
   * Clears any active token expiration timer
   */
  const clearAutoLogoutTimer = useCallback(() => {
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current);
      autoLogoutTimerRef.current = null;
    }
  }, []);

  /**
   * User Logout Handler
   */
  const logout = useCallback(async (reason = null) => {
    clearAutoLogoutTimer();
    setIsLoading(true);

    try {
      await apiService.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => {});
      apiService.setAuthToken(null);
      setUser(null);
      setToken(null);
      setIsGuest(false);
      setIsLoading(false);

      if (reason) {
        setSessionExpiredMessage(reason);
      }
    }
  }, [clearAutoLogoutTimer]);

  /**
   * Schedules an auto-logout timeout based on JWT exp claim
   */
  const scheduleAutoLogout = useCallback((jwtToken) => {
    clearAutoLogoutTimer();
    if (!jwtToken) return;

    if (isJwtExpired(jwtToken)) {
      console.warn('[AUTH] JWT is already expired. Auto-logging out immediately.');
      logout('Session expired. Please log in again.');
      return;
    }

    const remainingMs = getJwtRemainingMs(jwtToken);
    console.log(`[AUTH] Scheduling auto-logout in ${Math.round(remainingMs / 1000)} seconds.`);

    // Set timeout to auto logout when token expires
    autoLogoutTimerRef.current = setTimeout(() => {
      console.warn('[AUTH] JWT token expired. Performing auto-logout.');
      logout('Session expired. Please log in again.');
    }, remainingMs);
  }, [clearAutoLogoutTimer, logout]);

  // Set up 401 Unauthorized interceptor and restore session on launch
  useEffect(() => {
    apiService.setUnauthorizedHandler((msg) => {
      logout(msg || 'Session expired. Please log in again.');
    });

    const restoreSession = async () => {
      try {
        const [storedToken, storedUser, storedRememberId] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(REMEMBER_KEY),
        ]);

        if (storedRememberId) {
          setSavedIdentifier(storedRememberId);
        }

        if (storedToken && storedUser) {
          // Check if token is expired before restoring
          if (isJwtExpired(storedToken)) {
            console.warn('[AUTH] Stored JWT token is expired. Auto-clearing session.');
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]).catch(() => {});
            setToken(null);
            setUser(null);
            setSessionExpiredMessage('Your previous session has expired. Please log in again.');
          } else {
            const parsedUser = JSON.parse(storedUser);
            apiService.setAuthToken(storedToken);
            setToken(storedToken);
            setUser(parsedUser);
            setIsGuest(false);

            // Schedule auto-logout timer for remaining token lifetime
            scheduleAutoLogout(storedToken);

            // Validate and refresh user profile with backend in background
            apiService
              .getCurrentUser()
              .then((freshUser) => {
                if (freshUser) {
                  setUser(freshUser);
                  AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser)).catch(() => {});
                }
              })
              .catch((err) => {
                console.warn('[AUTH] Background session refresh notice:', err.message);
              });
          }
        }
      } catch (err) {
        console.warn('[AUTH] Session restoration warning:', err);
      } finally {
        setIsRestoringSession(false);
      }
    };

    restoreSession();

    return () => {
      clearAutoLogoutTimer();
    };
  }, [clearAutoLogoutTimer, logout, scheduleAutoLogout]);

  /**
   * User Login with JWT Persistence & Expiry Scheduling
   */
  const login = useCallback(async ({ identifier, password, rememberMe = true }) => {
    setIsLoading(true);
    setSessionExpiredMessage(null);

    try {
      const result = await apiService.login({ identifier, password });
      const authUser = result.user;
      const authToken = result.token;

      setUser(authUser);
      setToken(authToken);
      setIsGuest(false);

      if (authToken) {
        apiService.setAuthToken(authToken);
        await AsyncStorage.setItem(TOKEN_KEY, authToken);
        scheduleAutoLogout(authToken);
      }

      if (authUser) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(authUser));
      }

      if (rememberMe && identifier) {
        await AsyncStorage.setItem(REMEMBER_KEY, identifier);
        setSavedIdentifier(identifier);
      } else {
        await AsyncStorage.removeItem(REMEMBER_KEY).catch(() => {});
        setSavedIdentifier('');
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: error.message || 'Login failed.' };
    } finally {
      setIsLoading(false);
    }
  }, [scheduleAutoLogout]);

  /**
   * User Registration with JWT Persistence & Expiry Scheduling
   */
  const register = useCallback(async (registrationData) => {
    setIsLoading(true);
    setSessionExpiredMessage(null);

    try {
      const result = await apiService.register(registrationData);
      const authUser = result.user;
      const authToken = result.token;

      setUser(authUser);
      setToken(authToken);
      setIsGuest(false);

      if (authToken) {
        apiService.setAuthToken(authToken);
        await AsyncStorage.setItem(TOKEN_KEY, authToken);
        scheduleAutoLogout(authToken);
      }

      if (authUser) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(authUser));
      }

      if (registrationData.email) {
        await AsyncStorage.setItem(REMEMBER_KEY, registrationData.email);
        setSavedIdentifier(registrationData.email);
      }

      return { success: true, data: result };
    } catch (error) {
      return { success: false, message: error.message || 'Registration failed.' };
    } finally {
      setIsLoading(false);
    }
  }, [scheduleAutoLogout]);

  /**
   * Guest Exploration Mode
   */
  const continueAsGuest = useCallback(() => {
    clearAutoLogoutTimer();
    setIsGuest(true);
    setUser({
      id: 'guest_user',
      fullName: 'Guest Member',
      email: 'guest@gymezy.com',
      role: 'GUEST',
      avatar: '',
      isGuest: true,
    });
  }, [clearAutoLogoutTimer]);

  /**
   * Update Profile in Memory & Storage
   */
  const updateUser = useCallback(async (updatedFields) => {
    setUser((prev) => {
      const next = { ...prev, ...updatedFields };
      AsyncStorage.setItem(USER_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await apiService.getCurrentUser();
      if (freshUser) {
        setUser(freshUser);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser)).catch(() => {});
        return freshUser;
      }
    } catch (err) {
      console.warn('[AUTH] refreshUser notice:', err.message);
    }
    return null;
  }, []);

  const clearSessionExpiredMessage = useCallback(() => {
    setSessionExpiredMessage(null);
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isGuest,
    isLoading,
    isRestoringSession,
    savedIdentifier,
    sessionExpiredMessage,
    clearSessionExpiredMessage,
    login,
    register,
    continueAsGuest,
    logout,
    updateUser,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
