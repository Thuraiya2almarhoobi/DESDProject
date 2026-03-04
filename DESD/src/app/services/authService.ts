import {
  clearAuthStorage,
  getAccessToken,
  getStoredRole,
  setAuthTokens,
  setStoredRole,
} from '../lib/tokenStorage';
import { UserRole } from '../types';

export interface AuthUserPayload {
  id: number;
  email: string;
  role: UserRole;
  email_verified: boolean;
}

export interface AuthTokensPayload {
  access: string;
  refresh: string;
  user: AuthUserPayload;
  detail?: string;
}

export interface MePayload {
  user: AuthUserPayload;
  profile: Record<string, unknown> | null;
  addresses: Array<{
    id: number;
    label: string;
    line1: string;
    line2: string;
    city: string;
    postcode: string;
    is_default: boolean;
  }>;
}

export interface CustomerRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  full_name: string;
  phone: string;
  delivery_address: string;
  postcode: string;
  accept_terms: boolean;
}

export interface ProducerRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  business_name: string;
  contact_name: string;
  phone: string;
  business_address: string;
  postcode: string;
}

export interface CommunityRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  organisation_name: string;
  org_type: string;
  contact_name: string;
  phone: string;
}

export interface RestaurantRegisterPayload {
  email: string;
  password: string;
  confirm_password: string;
  business_name: string;
  contact_name: string;
  phone: string;
}

class AuthApiError extends Error {
  status: number;
  response: { data: unknown };

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.response = { data };
  }
}

const env = import.meta.env as Record<string, string | undefined>;
const rawApiBaseUrl = env.VITE_API_URL ?? env.REACT_APP_API_URL ?? 'http://127.0.0.1:8000/api';
const apiBaseUrl = rawApiBaseUrl.replace(/\/$/, '');

function toApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
      if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
        return value[0];
      }
    }
  }
  return fallback;
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  withAccessToken = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (withAccessToken) {
    const accessToken = getAccessToken();
    if (accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(toApiUrl(path), {
    ...init,
    headers,
  });
  const payload = await readResponseBody(response);

  if (!response.ok) {
    throw new AuthApiError(
      messageFromPayload(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }
  return payload as T;
}

async function postAuthPayload<TPayload>(
  url: string,
  payload: TPayload,
  rememberMe = true,
): Promise<AuthTokensPayload> {
  const response = await requestJson<AuthTokensPayload>(
    url,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    false,
  );
  setAuthTokens(response.access, response.refresh, rememberMe);
  setStoredRole(response.user.role, rememberMe);
  return response;
}

export function getStoredUserRole(): string | null {
  return getStoredRole();
}

export function logout(): void {
  clearAuthStorage();
}

export async function login(email: string, password: string, rememberMe = false): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/login/', { email, password, remember_me: rememberMe }, rememberMe);
}

export async function registerCustomer(payload: CustomerRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/customer/', payload);
}

export async function registerProducer(payload: ProducerRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/producer/', payload);
}

export async function registerCommunity(payload: CommunityRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/community/', payload);
}

export async function registerRestaurant(payload: RestaurantRegisterPayload): Promise<AuthTokensPayload> {
  return postAuthPayload('/accounts/auth/register/restaurant/', payload);
}

export async function getMe(): Promise<MePayload> {
  return requestJson<MePayload>('/accounts/me/', { method: 'GET' }, true);
}

export async function verifyEmail(token: string): Promise<{ detail: string }> {
  return requestJson<{ detail: string }>(
    '/accounts/auth/verify-email/',
    {
      method: 'POST',
      body: JSON.stringify({ token }),
    },
    false,
  );
}

export async function requestPasswordReset(email: string): Promise<{ detail: string }> {
  return requestJson<{ detail: string }>(
    '/accounts/auth/password-reset/request/',
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
    false,
  );
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ detail: string }> {
  return requestJson<{ detail: string }>(
    '/accounts/auth/password-reset/confirm/',
    {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    },
    false,
  );
}
