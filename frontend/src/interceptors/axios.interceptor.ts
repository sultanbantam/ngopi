import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from '../utils/storage';

const API_URL = 'https://api.bamboochat.click/api';
let refreshPromise: Promise<string | null> | null = null;

const getStoredToken = async () => {
  if (Platform.OS === 'web') return localStorage.getItem('token') || '';
  return (await SecureStore.getItemAsync('token')) || '';
};

const setStoredToken = async (token: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem('token', token);
    return;
  }
  await SecureStore.setItemAsync('token', token);
};

const refreshAccessToken = async () => {
  const response = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true, headers: { 'x-skip-auth-refresh': 'true' } });
  const token = response.data?.token;
  if (token) await setStoredToken(token);
  return token || null;
};

axios.defaults.withCredentials = true;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

axios.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getStoredToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const response = error.response;
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!response || !config || response.status !== 401 || config._retry || config.headers?.['x-skip-auth-refresh']) {
      throw error;
    }

    config._retry = true;
    refreshPromise = refreshPromise || refreshAccessToken().finally(() => { refreshPromise = null; });
    const nextToken = await refreshPromise;
    if (!nextToken) throw error;

    config.headers.Authorization = `Bearer ${nextToken}`;
    return axios(config);
  },
);