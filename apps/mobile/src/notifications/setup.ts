import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiFetch } from '../config';

// Configure top-level Expo notification behavior
try {
  if (Notifications && Notifications.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (e) {
  console.warn('Notification handler setup warning:', e);
}

export async function registerForPushNotificationsAsync(authToken: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Push] Running on simulator/emulator — push tokens require a physical device.');
    return null;
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('farm-alarms', {
        name: 'Farm Alarms',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Permission not granted for push notifications.');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const expoPushToken = tokenData.data;

    // Stable install ID
    const deviceId = Constants.installationId || `${Platform.OS}-${Device.modelName || 'device'}`;

    // Send token to backend endpoint POST /api/device-tokens
    await apiFetch('/device-tokens', {
      method: 'POST',
      body: JSON.stringify({
        expoPushToken,
        platform: Platform.OS as 'ios' | 'android',
        deviceId
      })
    }, authToken);

    console.log('[Push] Device token registered successfully:', expoPushToken);
    return expoPushToken;
  } catch (err) {
    console.error('[Push] Token registration error:', err);
    return null;
  }
}

export async function unregisterDeviceToken(authToken: string) {
  try {
    const deviceId = Constants.installationId || `${Platform.OS}-${Device.modelName || 'device'}`;
    await apiFetch(`/device-tokens/${deviceId}`, { method: 'DELETE' }, authToken);
    console.log('[Push] Device token unregistered cleanly on logout.');
  } catch (err) {
    console.error('[Push] Token unregister error:', err);
  }
}

function parse12HourTime(timeStr: string): { hours: number; minutes: number } {
  const cleaned = (timeStr || '').trim().toUpperCase();
  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h = h + 12;
    return { hours: h, minutes: m };
  }
  const parts = cleaned.split(':');
  return { hours: parseInt(parts[0], 10) || 8, minutes: parseInt(parts[1], 10) || 0 };
}

// Local Calendar Backup Schedule for Creator Device (Offline Safety Net)
export async function scheduleLocalBackup(reminder: any): Promise<string | null> {
  try {
    const { hours, minutes } = parse12HourTime(reminder.dueTime || '08:00 AM');
    
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🐔 ${reminder.type ? reminder.type.toUpperCase() : 'FARM'} Reminder`,
        body: reminder.message,
        sound: 'default',
        data: { reminderId: reminder._id, farmId: reminder.farmId }
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: hours,
        minute: minutes,
        repeats: reminder.repeat && reminder.repeat !== 'none',
      },
    });

    return id;
  } catch (e) {
    console.warn('[Local Notification] Backup schedule warning:', e);
    return null;
  }
}
