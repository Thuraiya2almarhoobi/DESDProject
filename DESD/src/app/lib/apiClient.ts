/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for apiClient concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

import { resolveApiPathBase } from './apiBase';
import {
  clearAuthStorage,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from './tokenStorage';

type ExtendedRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

const env = import.meta.env as Record<string, string | undefined>;
const apiBaseUrl = resolveApiPathBase(env.VITE_API_URL ?? env.REACT_APP_API_URL, '/api');

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as ExtendedRequestConfig | undefined;
    const statusCode = error.response?.status;

    if (!request || statusCode !== 401 || request._retry) {
      return Promise.reject(error);
    }

    const url = request.url ?? '';
    const authEndpoint = url.includes('/accounts/auth/login/')
      || url.includes('/accounts/auth/refresh/')
      || url.includes('/accounts/auth/register/');
    if (authEndpoint) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuthStorage();
      return Promise.reject(error);
    }

    request._retry = true;

    try {
      const refreshResponse = await refreshClient.post('/accounts/auth/refresh/', {
        refresh: refreshToken,
      });
      const newAccessToken = refreshResponse.data?.access as string | undefined;
      if (!newAccessToken) {
        throw new Error('No access token returned from refresh endpoint.');
      }

      setAuthTokens(newAccessToken, refreshToken);
      request.headers.Authorization = `Bearer ${newAccessToken}`;
      return apiClient(request);
    } catch {
      clearAuthStorage();
      return Promise.reject(error);
    }
  }
);

export { apiBaseUrl };
export default apiClient;
