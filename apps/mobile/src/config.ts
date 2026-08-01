import { Alert, AlertButton, ToastAndroid, Platform } from 'react-native';

// Your machine's Wi-Fi IP — change if your network IP changes
// Your detected IP: 192.168.0.132
export const API_BASE_URL = 'http://192.168.0.132:4000/api';

export async function apiFetch(endpoint: string, options: RequestInit = {}, token?: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json();
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
