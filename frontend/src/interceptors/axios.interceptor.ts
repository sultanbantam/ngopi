import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_URL, getValidAccessToken, refreshAccessToken } from '../utils/session';

axios.defaults.withCredentials = true;
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

axios.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await getValidAccessToken();
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
    const nextToken = await refreshAccessToken(true);
    if (!nextToken) throw error;

    config.headers.Authorization = `Bearer ${nextToken}`;
    return axios(config);
  },
);

export { API_URL };
