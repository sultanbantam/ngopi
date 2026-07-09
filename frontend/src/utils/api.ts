import { Platform } from 'react-native';
import * as SecureStore from './storage';

export const API_URL = 'https://api.bamboochat.click/api';

export const getAuthToken = async () => {
  if (Platform.OS === 'web') return localStorage.getItem('token') || '';
  return (await SecureStore.getItemAsync('token')) || '';
};

export const getAuthHeaders = async () => {
  const token = await getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};