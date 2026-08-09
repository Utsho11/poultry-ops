import { Alert, AlertButton, ToastAndroid, Platform } from 'react-native';
import Constants from 'expo-constants';

// Local Machine Development API
const debuggerHost = Constants.expoConfig?.hostUri;
const localhostIp = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `http://${localhostIp}:4000/api`;

let activeFarmIdMemory: string | null = null;

export function setActiveFarmIdMemory(id: string | null) {
  activeFarmIdMemory = id;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}, token?: string | null, farmId?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const effectiveFarmId = farmId || activeFarmIdMemory;
  if (effectiveFarmId) headers['x-farm-id'] = effectiveFarmId;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  
  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(`Server returned error (${response.status}): ${text.substring(0, 100)}`);
  }

  if (!response.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

export function showAlert(title: string, message: string, buttons?: AlertButton[]) {
  try {
    const btnList = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    Alert.alert(title, message, btnList, { cancelable: true });
  } catch (e: any) {
    console.warn('Alert.alert TurboModule fallback caught:', e?.message || e);
    if (Platform.OS === 'android') {
      ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
    }
    if (buttons && buttons.length > 1) {
      const confirmBtn = buttons.find(b => b.style === 'destructive' || (b.text && b.text !== 'Cancel'));
      if (confirmBtn && confirmBtn.onPress) {
        confirmBtn.onPress();
      }
    }
  }
}
