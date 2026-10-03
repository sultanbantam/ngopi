import { Platform } from 'react-native';
import * as SecureStore from './storage';

export const API_URL = 'https://api.ngopi.top/api';

const TOKEN_REFRESH_WINDOW_MS = 2 * 60 * 1000;
const REFRESH_RETRY_COOLDOWN_MS = 5 * 1000;
const SESSION_KEYS = ['token', 'refresh_token', 'username', 'userId', 'temp_key', 'private_key'];

export type RefreshFailureReason = 'none' | 'unauthorized' | 'unavailable';

let refreshPromise: Promise<string | null> | null = null;
let lastRefreshFailureAt = 0;
let lastRefreshFailureReason: RefreshFailureReason = 'none';

const getStorageValue = async (key: string) => {
  if (Platform.OS === 'web') return localStorage.getItem(key) || '';
  return (await SecureStore.getItemAsync(key)) || '';
};

const setStorageValue = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
};

const deleteStorageValue = async (key: string) => {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
};

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof globalThis.atob !== 'function') return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(globalThis.atob(padded));
  } catch {
    return null;
  }
};

export const getStoredToken = () => getStorageValue('token');
export const getStoredRefreshToken = () => getStorageValue('refresh_token');
export const setStoredToken = (token: string) => setStorageValue('token', token);
export const getLastRefreshFailureReason = () => lastRefreshFailureReason;

export const setStoredRefreshToken = async (refreshToken?: string | null) => {
  if (refreshToken) await setStorageValue('refresh_token', refreshToken);
};

export const hasStoredSession = async () => Boolean(
  (await getStorageValue('token')) ||
  (await getStorageValue('refresh_token')) ||
  (await getStorageValue('userId'))
);

export const isAccessTokenExpiring = (token: string, windowMs = TOKEN_REFRESH_WINDOW_MS) => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + windowMs;
};

export const refreshAccessToken = async (force = false) => {
  if (refreshPromise) return refreshPromise;
  if (!force && lastRefreshFailureAt && Date.now() - lastRefreshFailureAt < REFRESH_RETRY_COOLDOWN_MS) {
    return null;
  }

  refreshPromise = getStorageValue('refresh_token')
    .then((storedRefreshToken) => fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420'
      },
      body: JSON.stringify(storedRefreshToken ? { refresh_token: storedRefreshToken } : {}),
    }))
    .then(async (response) => {
      if (!response.ok) {
        lastRefreshFailureAt = Date.now();
        lastRefreshFailureReason = response.status === 401 || response.status === 403 ? 'unauthorized' : 'unavailable';
        return null;
      }
      const data = await response.json();
      const token = typeof data?.token === 'string' ? data.token : null;
      if (token) {
        await setStoredToken(token);
        await setStoredRefreshToken(data?.refresh_token);
        lastRefreshFailureAt = 0;
        lastRefreshFailureReason = 'none';
      } else {
        lastRefreshFailureAt = Date.now();
        lastRefreshFailureReason = 'unavailable';
      }
      return token;
    })
    .catch(() => {
      lastRefreshFailureAt = Date.now();
      lastRefreshFailureReason = 'unavailable';
      return null;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

export const getValidAccessToken = async () => {
  const token = await getStoredToken();
  if (token && !isAccessTokenExpiring(token)) {
    lastRefreshFailureReason = 'none';
    return token;
  }

  const refreshedToken = await refreshAccessToken(Boolean(token));
  if (refreshedToken) return refreshedToken;

  return token && !isAccessTokenExpiring(token, 0) ? token : '';
};

export const clearStoredSession = async () => {
  await Promise.all(SESSION_KEYS.map((key) => deleteStorageValue(key)));
  lastRefreshFailureAt = 0;
  lastRefreshFailureReason = 'none';
};