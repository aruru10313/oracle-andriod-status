// ============================================================
// Notifications service — Expo Notifications wrapper
// ============================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Set default notification handler (show banner while app is foregrounded)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ───────────────────── Permissions ────────────────────────────

/**
 * Requests push notification permissions.
 * Must be called before scheduling any notifications.
 * Returns true if permission was granted.
 */
export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    // Notifications don't work on emulators
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permission not granted');
    return false;
  }

  // Android requires a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('server-alerts', {
      name: 'Server Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4f8ef7',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('server-info', {
      name: 'Server Info',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 100],
      lightColor: '#22c55e',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  return true;
}

// ─────────────────────── Alert helpers ────────────────────────

/**
 * Sends a local notification when a server goes offline.
 */
export async function sendDownAlert(serverName: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔴 서버 오프라인',
        body: `${serverName} 서버에 연결할 수 없습니다!`,
        data: { type: 'server_down', serverName },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        color: '#ef4444',
        categoryIdentifier: 'server-alerts',
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.error('[Notifications] sendDownAlert failed', e);
  }
}

/**
 * Sends a local notification when a server comes back online.
 */
export async function sendRecoveryAlert(serverName: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🟢 서버 복구됨',
        body: `${serverName} 서버가 다시 온라인 상태입니다`,
        data: { type: 'server_recovery', serverName },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#22c55e',
        categoryIdentifier: 'server-info',
      },
      trigger: null,
    });
  } catch (e) {
    console.error('[Notifications] sendRecoveryAlert failed', e);
  }
}

/**
 * Sends a high-usage alert (CPU / memory / disk threshold exceeded)
 */
export async function sendHighUsageAlert(
  serverName: string,
  metric: 'CPU' | 'Memory' | 'Disk',
  value: number
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⚠️ ${serverName} — ${metric} 경고`,
        body: `${metric} 사용률이 ${value.toFixed(0)}%에 달했습니다`,
        data: { type: 'high_usage', serverName, metric, value },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
        color: '#f59e0b',
        categoryIdentifier: 'server-alerts',
      },
      trigger: null,
    });
  } catch (e) {
    console.error('[Notifications] sendHighUsageAlert failed', e);
  }
}

/**
 * Cancels all pending local notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
