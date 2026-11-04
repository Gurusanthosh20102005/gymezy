import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Linking } from 'react-native';
import apiService from './apiService';

const FCM_TOKEN_STORAGE_KEY = 'gymezy_owner_fcm_token';
const NOTIFICATION_PERMISSION_REQUESTED_KEY = 'gymezy_notification_permission_requested';

const POST_NOTIFICATIONS_PERMISSION =
  PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS || 'android.permission.POST_NOTIFICATIONS';

/**
 * Mobile Push & Native Notification Service for Gym Owner App
 * Manages native device permissions and notification token registration with GYMEZY backend
 */
class NotificationService {
  /**
   * Check if native notification permission is currently granted on device
   * @returns {Promise<boolean>}
   */
  async checkNotificationPermission() {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          const isGranted = await PermissionsAndroid.check(POST_NOTIFICATIONS_PERMISSION);
          return !!isGranted;
        }
        // Granted by default on Android < 13 (API 33)
        return true;
      } catch (err) {
        console.warn('⚠️ Error checking native notification permission:', err);
        return false;
      }
    }
    return true;
  }

  /**
   * Request native notification permission on device (Android 13+ runtime permission)
   * @param {Object} [options]
   * @param {boolean} [options.promptRationale=true]
   * @returns {Promise<{ granted: boolean, status: string }>}
   */
  async requestNotificationPermission(options = {}) {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          const alreadyGranted = await PermissionsAndroid.check(POST_NOTIFICATIONS_PERMISSION);
          if (alreadyGranted) {
            return { granted: true, status: PermissionsAndroid.RESULTS.GRANTED };
          }

          const rationale = options.promptRationale !== false
            ? {
                title: 'Notification Access',
                message:
                  'GYMEZY Gym Owner requires notification permission to alert you about member bookings, plan switch requests, cancellation alerts, and staff updates in real time.',
                buttonPositive: 'Allow',
                buttonNegative: 'Not Now',
              }
            : undefined;

          const result = await PermissionsAndroid.request(
            POST_NOTIFICATIONS_PERMISSION,
            rationale
          );

          await AsyncStorage.setItem(NOTIFICATION_PERMISSION_REQUESTED_KEY, 'true').catch(() => {});

          return {
            granted: result === PermissionsAndroid.RESULTS.GRANTED,
            status: result,
          };
        }
        return { granted: true, status: PermissionsAndroid.RESULTS.GRANTED };
      } catch (err) {
        console.warn('⚠️ Error requesting native notification permission:', err);
        return { granted: false, status: 'error', error: err?.message };
      }
    }
    return { granted: true, status: 'granted' };
  }

  /**
   * Check if notification permission has been prompted to the user at least once
   * @returns {Promise<boolean>}
   */
  async hasPromptedPermission() {
    try {
      const val = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_REQUESTED_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Open the app's native notification settings page in device settings
   */
  async openNotificationSettings() {
    try {
      await Linking.openSettings();
    } catch (err) {
      console.warn('⚠️ Failed to open device app settings:', err);
    }
  }

  /**
   * Register device token with GYMEZY backend
   * @param {string} token - FCM device token
   */
  async registerDeviceToken(token) {
    if (!token) return;

    try {
      const storedToken = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (storedToken === token) {
        return; // Already registered
      }

      await apiService.post('/notifications/device-token', { token });
      await AsyncStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      console.log('✅ FCM token registered with backend successfully.');
    } catch (err) {
      console.warn('⚠️ Failed to register FCM token with backend:', err.message);
    }
  }

  /**
   * Unregister device token from GYMEZY backend on logout
   */
  async unregisterDeviceToken() {
    try {
      const token = await AsyncStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (token) {
        await apiService.delete(`/notifications/device-token?token=${encodeURIComponent(token)}`);
        await AsyncStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
        console.log('✅ FCM token unregistered from backend.');
      }
    } catch (err) {
      console.warn('⚠️ Failed to unregister FCM token:', err.message);
    }
  }

  /**
   * Handle incoming push notification payload
   * @param {{ notification: { title: string, body: string }, data?: Record<string, string> }} remoteMessage
   */
  handleNotificationMessage(remoteMessage) {
    if (!remoteMessage) return;

    const { notification, data } = remoteMessage;
    console.log('🔔 Gym Owner Push Notification:', notification?.title, notification?.body, data);
  }
}

export const notificationService = new NotificationService();
export default notificationService;
