import { PermissionsAndroid, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../src/services/notificationService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(),
  removeItem: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/services/apiService', () => ({
  post: jest.fn().mockResolvedValue({ success: true }),
  delete: jest.fn().mockResolvedValue({ success: true }),
}));

describe('NotificationService Native Permission & Token Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
    Object.defineProperty(Platform, 'Version', { get: () => 33, configurable: true });
  });

  test('checkNotificationPermission returns true on Android 13+ when permission is granted', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);

    const result = await notificationService.checkNotificationPermission();
    expect(result).toBe(true);
    expect(PermissionsAndroid.check).toHaveBeenCalledWith(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS || 'android.permission.POST_NOTIFICATIONS'
    );
  });

  test('checkNotificationPermission returns false on Android 13+ when permission is denied', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);

    const result = await notificationService.checkNotificationPermission();
    expect(result).toBe(false);
  });

  test('checkNotificationPermission returns true automatically on Android versions below 33', async () => {
    Object.defineProperty(Platform, 'Version', { get: () => 30, configurable: true });
    const checkSpy = jest.spyOn(PermissionsAndroid, 'check');

    const result = await notificationService.checkNotificationPermission();
    expect(result).toBe(true);
    expect(checkSpy).not.toHaveBeenCalled();
  });

  test('requestNotificationPermission grants permission successfully on Android 13+', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);

    const result = await notificationService.requestNotificationPermission();
    expect(result.granted).toBe(true);
    expect(result.status).toBe(PermissionsAndroid.RESULTS.GRANTED);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'gymezy_notification_permission_requested',
      'true'
    );
  });

  test('requestNotificationPermission returns already granted without prompting if already allowed', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
    const requestSpy = jest.spyOn(PermissionsAndroid, 'request');

    const result = await notificationService.requestNotificationPermission();
    expect(result.granted).toBe(true);
    expect(requestSpy).not.toHaveBeenCalled();
  });

  test('requestNotificationPermission handles denial cleanly', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);

    const result = await notificationService.requestNotificationPermission();
    expect(result.granted).toBe(false);
    expect(result.status).toBe(PermissionsAndroid.RESULTS.DENIED);
  });

  test('openNotificationSettings opens device settings via Linking', async () => {
    const openSettingsSpy = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    await notificationService.openNotificationSettings();
    expect(openSettingsSpy).toHaveBeenCalled();
  });

  test('registerDeviceToken stores token and syncs with backend', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    await notificationService.registerDeviceToken('test-fcm-token-123');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'gymezy_owner_fcm_token',
      'test-fcm-token-123'
    );
  });
});
