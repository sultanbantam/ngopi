import { API_URL, getValidAccessToken, getStoredToken } from './session';

export { API_URL };

export const getAuthToken = getStoredToken;

export const getAuthHeaders = async () => {
  const token = await getValidAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
