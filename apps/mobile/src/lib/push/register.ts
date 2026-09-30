import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerDevice } from '../api';

export const ANDROID_CHANNEL_ID = 'default';

// Show scan/alert pushes as banners even while the app is in the foreground.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Request permission, fetch the Expo push token and register it with the API
 * (FR-V-001). Best-effort: returns null instead of throwing, so a denied
 * permission or offline API never blocks the vendor. Screens keep polling as
 * the fallback (IR-COM-003).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;

    // Android 13+ needs a channel before the permission prompt can appear.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Scans and alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7ed9a4',
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const status =
      existing.status === 'granted'
        ? existing.status
        : (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) throw new Error('EAS projectId is missing from app config.');

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerDevice(token, Platform.OS);
    return token;
  } catch (error) {
    console.warn('[push] registration skipped:', error);
    return null;
  }
}
