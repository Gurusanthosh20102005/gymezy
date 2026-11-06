import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_BIOMETRIC_LOGIN_KEY = '@gymezy_pref_biometric_login';
const BIOMETRIC_AUTH_SESSION_KEY = '@gymezy_biometric_auth_session';

/**
 * Biometric Authentication Service
 * Manages Face ID, Touch ID & Fingerprint hardware verification and session unlock.
 */
class BiometricService {
  /**
   * Determine whether device hardware supports biometric sensors and whether credentials are enrolled.
   * @returns {Promise<{ hasHardware: boolean, isEnrolled: boolean, available: boolean, error?: string }>}
   */
  async checkHardwareSupport() {
    try {
      if (!LocalAuthentication || typeof LocalAuthentication.hasHardwareAsync !== 'function') {
        return { hasHardware: false, isEnrolled: false, available: false, error: 'Module unavailable' };
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return { hasHardware: false, isEnrolled: false, available: false };
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return {
        hasHardware: true,
        isEnrolled,
        available: isEnrolled,
      };
    } catch (err) {
      console.warn('[BIOMETRIC SERVICE] Hardware check error:', err.message);
      return { hasHardware: false, isEnrolled: false, available: false, error: err.message };
    }
  }

  /**
   * Determine primary biometric type supported (Face ID vs Fingerprint).
   * @returns {Promise<'FACIAL_RECOGNITION' | 'FINGERPRINT' | 'BIOMETRIC'>}
   */
  async getBiometricType() {
    try {
      if (!LocalAuthentication || typeof LocalAuthentication.supportedAuthenticationTypesAsync !== 'function') {
        return 'BIOMETRIC';
      }

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        return 'FACIAL_RECOGNITION';
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        return 'FINGERPRINT';
      }
      return 'BIOMETRIC';
    } catch {
      return 'BIOMETRIC';
    }
  }

  /**
   * Prompt user for native biometric verification (Face ID or Fingerprint).
   * @param {string} promptMessage
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async authenticate(promptMessage = 'Verify your identity to log in to GYMEZY') {
    try {
      const support = await this.checkHardwareSupport();
      if (!support.hasHardware) {
        return { success: false, error: 'Biometric hardware sensor is not available on this device.' };
      }
      if (!support.isEnrolled) {
        return { success: false, error: 'No biometric credentials enrolled. Please setup Face ID or Fingerprint in device settings.' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Use Password',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error === 'user_cancel' || result.error === 'system_cancel'
          ? 'Authentication cancelled'
          : result.warning || 'Biometric verification failed',
      };
    } catch (err) {
      console.warn('[BIOMETRIC SERVICE] Authentication exception:', err.message);
      return { success: false, error: err.message || 'Authentication error' };
    }
  }

  /**
   * Check if user has enabled biometric login preference
   * @returns {Promise<boolean>}
   */
  async isBiometricEnabled() {
    try {
      const val = await AsyncStorage.getItem(PREF_BIOMETRIC_LOGIN_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Persist biometric login preference toggle
   * @param {boolean} enabled
   */
  async setBiometricEnabled(enabled) {
    try {
      await AsyncStorage.setItem(PREF_BIOMETRIC_LOGIN_KEY, enabled ? 'true' : 'false');
      if (!enabled) {
        await this.clearAuthSession();
      }
    } catch (err) {
      console.warn('[BIOMETRIC SERVICE] Failed to store biometric preference:', err.message);
    }
  }

  /**
   * Persist user auth session for instant biometric re-login
   * @param {{ token: string, user: object, identifier: string }} sessionData
   */
  async saveAuthSession(sessionData) {
    try {
      if (!sessionData?.token || !sessionData?.user) return;
      const payload = {
        token: sessionData.token,
        user: sessionData.user,
        identifier: sessionData.identifier || sessionData.user.email || sessionData.user.phone || '',
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(BIOMETRIC_AUTH_SESSION_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('[BIOMETRIC SERVICE] Failed to save biometric session:', err.message);
    }
  }

  /**
   * Retrieve saved auth session for biometric unlock
   * @returns {Promise<{ token: string, user: object, identifier: string, savedAt: number } | null>}
   */
  async getAuthSession() {
    try {
      const raw = await AsyncStorage.getItem(BIOMETRIC_AUTH_SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Clear saved auth session (e.g. when biometric disabled)
   */
  async clearAuthSession() {
    try {
      await AsyncStorage.removeItem(BIOMETRIC_AUTH_SESSION_KEY);
    } catch (err) {
      console.warn('[BIOMETRIC SERVICE] Failed to clear biometric session:', err.message);
    }
  }
}

export const biometricService = new BiometricService();
export default biometricService;

