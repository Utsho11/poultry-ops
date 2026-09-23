import { Alert, AlertButton, ToastAndroid, Platform } from "react-native";
import Constants from "expo-constants";

// Production & Local API Base URL
const debuggerHost = Constants.expoConfig?.hostUri;
const detectedIp = debuggerHost ? debuggerHost.split(":")[0] : "192.168.0.132";

const rawBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  (__DEV__ ? `http://${detectedIp}:4000/api` : "https://poultrydex.vercel.app/api");

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

let activeFarmIdMemory: string | null = null;

export function setActiveFarmIdMemory(id: string | null) {
  activeFarmIdMemory = id;
}

let onUnauthorizedCallback: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorizedCallback = handler;
}

export async function apiFetch(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null,
  farmId?: string | null,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const effectiveFarmId = farmId || activeFarmIdMemory;
  if (effectiveFarmId) headers["x-farm-id"] = effectiveFarmId;

  const normalizedEndpoint = endpoint.startsWith("/")
    ? endpoint
    : `/${endpoint}`;
  const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
    ...options,
    headers,
  });

  let data: any;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    throw new Error(
      `Server returned error (${response.status}): ${text.substring(0, 100)}`,
    );
  }

  if (response.status === 401) {
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    throw new Error(data.error || "Session expired. Please log in again.");
  }

  if (!response.ok)
    throw new Error(data.error || data.message || "Request failed");
  return data;
}

export function showAlert(
  title: string,
  message: string,
  buttons?: AlertButton[],
) {
  try {
    const btnList = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
    Alert.alert(title, message, btnList, { cancelable: true });
  } catch (e: any) {
    console.warn("Alert.alert fallback caught:", e?.message || e);
    if (Platform.OS === "android") {
      ToastAndroid.show(`${title}: ${message}`, ToastAndroid.LONG);
    }
  }
}
