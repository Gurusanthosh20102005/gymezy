import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/apiService';
import { isJwtExpired, getJwtRemainingMs } from '../utils/jwtUtils';

const TOKEN_KEY = '@gymezy_jwt_token';
const USER_KEY = '@gymezy_auth_user';
const GYM_KEY = '@gymezy_auth_gym';

const removeStorageKeys = async (keys) => {
  if (typeof AsyncStorage.removeMany === 'function') {
    await AsyncStorage.removeMany(keys).catch(() => {});
  } else if (typeof AsyncStorage.multiRemove === 'function') {
    await AsyncStorage.multiRemove(keys).catch(() => {});
  } else {
    await Promise.all(keys.map((k) => AsyncStorage.removeItem(k).catch(() => {})));
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [gym, setGym] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoringToken, setIsRestoringToken] = useState(true);

  const autoLogoutTimerRef = useRef(null);

  const clearAutoLogoutTimer = useCallback(() => {
    if (autoLogoutTimerRef.current) {
      clearTimeout(autoLogoutTimerRef.current);
      autoLogoutTimerRef.current = null;
    }
  }, []);

  const logout = useCallback(async () => {
    clearAutoLogoutTimer();
    setIsLoading(true);
    try {
      await apiService.logout();
    } catch {
      // Ignore network error on logout
    } finally {
      await removeStorageKeys([TOKEN_KEY, USER_KEY, GYM_KEY]);
      apiService.setAuthToken(null);
      setUser(null);
      setGym(null);
      setToken(null);
      setIsLoading(false);
    }
  }, [clearAutoLogoutTimer]);

  const scheduleAutoLogout = useCallback((jwtToken) => {
    clearAutoLogoutTimer();
    if (!jwtToken) return;

    if (isJwtExpired(jwtToken)) {
      logout();
      return;
    }

    const remainingMs = getJwtRemainingMs(jwtToken);
    autoLogoutTimerRef.current = setTimeout(() => {
      console.warn('[GYM OWNER AUTH] JWT token expired. Performing auto-logout.');
      logout();
    }, remainingMs);
  }, [clearAutoLogoutTimer, logout]);

  // Restore JWT token and user session on initial application load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [storedToken, storedUser, storedGym] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(GYM_KEY),
        ]);

        if (storedToken && storedUser) {
          if (isJwtExpired(storedToken)) {
            console.warn('[GYM OWNER AUTH] Stored token is expired. Auto-logging out.');
            await removeStorageKeys([TOKEN_KEY, USER_KEY, GYM_KEY]);
            setToken(null);
            setUser(null);
            setGym(null);
          } else {
            const parsedUser = JSON.parse(storedUser);
            const parsedGym = storedGym ? JSON.parse(storedGym) : null;

            apiService.setAuthToken(storedToken);
            setToken(storedToken);
            setUser(parsedUser);
            setGym(parsedGym);
            scheduleAutoLogout(storedToken);

            // Synchronize fresh gym profile in the background
            const gymId = parsedGym?._id || parsedGym?.id || parsedUser?.gymId;
            if (gymId) {
              apiService
                .getGym(gymId)
                .then((freshGym) => {
                  if (freshGym) {
                    setGym(freshGym);
                    AsyncStorage.setItem(GYM_KEY, JSON.stringify(freshGym)).catch(() => {});
                  }
                })
                .catch((err) => {
                  console.warn('Background gym sync error:', err.message);
                });
            }
          }
        }
      } catch (error) {
        console.warn('Failed to restore auth session from storage:', error);
      } finally {
        setIsRestoringToken(false);
      }
    };

    restoreSession();

    return () => {
      clearAutoLogoutTimer();
    };
  }, [clearAutoLogoutTimer, scheduleAutoLogout]);

  const login = useCallback(async ({ identifier, password }) => {
    setIsLoading(true);
    try {
      const response = await apiService.login({ identifier, password });
      setUser(response.user);
      setGym(response.gym);
      setToken(response.token);

      if (response.token) {
        apiService.setAuthToken(response.token);
        await AsyncStorage.setItem(TOKEN_KEY, response.token);
        scheduleAutoLogout(response.token);
      }
      if (response.user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
      }
      if (response.gym) {
        await AsyncStorage.setItem(GYM_KEY, JSON.stringify(response.gym));
      }

      return { success: true, data: response };
    } catch (error) {
      return { success: false, message: error.message || 'Login failed.' };
    } finally {
      setIsLoading(false);
    }
  }, [scheduleAutoLogout]);

  const loginWithGoogle = useCallback(async ({ idToken }) => {
    setIsLoading(true);
    try {
      const response = await apiService.googleLogin({
        idToken,
        portal: 'gym-owner',
        expectedRole: 'GYM_OWNER',
      });

      // User does not exist in DB yet: returns profile for onboarding
      if (response.exists === false) {
        return { success: true, exists: false, profile: response.profile };
      }

      setUser(response.user);
      setGym(response.gym);
      setToken(response.token);

      if (response.token) {
        apiService.setAuthToken(response.token);
        await AsyncStorage.setItem(TOKEN_KEY, response.token);
        scheduleAutoLogout(response.token);
      }
      if (response.user) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.user));
      }
      if (response.gym) {
        await AsyncStorage.setItem(GYM_KEY, JSON.stringify(response.gym));
      }

      return { success: true, exists: true, data: response };
    } catch (error) {
      return { success: false, message: error.message || 'Google Login failed.' };
    } finally {
      setIsLoading(false);
    }
  }, [scheduleAutoLogout]);

  const updateGym = useCallback((updatedGym) => {
    setGym((prev) => {
      const nextGym = { ...(prev || {}), ...(updatedGym || {}) };
      AsyncStorage.setItem(GYM_KEY, JSON.stringify(nextGym)).catch(() => {});
      return nextGym;
    });
  }, []);

  const refreshGymProfile = useCallback(async () => {
    const gymId = gym?._id || gym?.id || user?.gymId;
    if (!gymId) return null;
    try {
      const freshGym = await apiService.getGym(gymId);
      if (freshGym) {
        setGym(freshGym);
        await AsyncStorage.setItem(GYM_KEY, JSON.stringify(freshGym)).catch(() => {});
        return freshGym;
      }
    } catch (err) {
      console.warn('Background gym profile sync notice:', err?.message || err);
    }
    return null;
  }, [gym?._id, gym?.id, user?.gymId]);

  const value = {
    user,
    gym,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    isRestoringToken,
    login,
    loginWithGoogle,
    logout,
    updateGym,
    refreshGymProfile,
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
