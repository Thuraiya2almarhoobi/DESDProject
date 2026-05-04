/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the AuthContext React context/provider and exposes shared state to child components.
 *
 * Frontend context:
 *   React context layer: owns cross-page state such as authentication and cart contents.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User, UserRole } from '../types';
import {
  CommunityRegisterPayload,
  CustomerRegisterPayload,
  MePayload,
  ProducerRegisterPayload,
  RestaurantRegisterPayload,
  getMe as getMeRequest,
  login as loginRequest,
  logout as clearAuthStorage,
  registerCommunity as registerCommunityRequest,
  registerCustomer as registerCustomerRequest,
  registerProducer as registerProducerRequest,
  registerRestaurant as registerRestaurantRequest,
} from '../services/authService';
import { setBasicAuthToken } from '../lib/api';
import { getAccessToken } from '../lib/tokenStorage';

/**
 * Frontend authentication context.
 *
 * This provider is the client-side source of truth for:
 * - the signed-in user and role
 * - the role-specific profile returned by `/api/accounts/me/`
 * - saved addresses used by checkout/account pages
 * - login, logout, registration, and preview-mode helpers
 */
type AuthResult =
  | {
      success: true;
      user: User;
      message?: string;
    }
  | {
      success: false;
      error: string;
    };

interface AuthContextType {
  user: User | null;
  profile: Record<string, unknown> | null;
  addresses: MePayload['addresses'];
  loading: boolean;
  customerPreview: boolean;
  customerPreviewReturnPath: string | null;
  login: (email: string, password: string, rememberMe: boolean) => Promise<AuthResult>;
  registerCustomer: (payload: CustomerRegisterPayload) => Promise<AuthResult>;
  registerProducer: (payload: ProducerRegisterPayload) => Promise<AuthResult>;
  registerCommunity: (payload: CommunityRegisterPayload) => Promise<AuthResult>;
  registerRestaurant: (payload: RestaurantRegisterPayload) => Promise<AuthResult>;
  getMe: () => Promise<MePayload>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  startCustomerPreview: (returnPath?: string | null) => void;
  stopCustomerPreview: () => void;
}

/**
 * USER_STORAGE_KEY boundary.
 *
 * This exported unit supports the file role: Provides the AuthContext React context/provider and exposes shared state to child components.
 * It belongs to: React context layer: owns cross-page state such as authentication and cart contents.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const USER_STORAGE_KEY = 'desd_user';
const CUSTOMER_PREVIEW_STORAGE_KEY = 'desd_customer_preview';
const CUSTOMER_PREVIEW_RETURN_PATH_STORAGE_KEY = 'desd_customer_preview_return_path';
const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as User;
  } catch {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return null;
  }
}

function saveUser(user: User | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!user) {
    window.localStorage.removeItem(USER_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

function loadCustomerPreview(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(CUSTOMER_PREVIEW_STORAGE_KEY) === 'true';
}

function saveCustomerPreview(enabled: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!enabled) {
    window.localStorage.removeItem(CUSTOMER_PREVIEW_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(CUSTOMER_PREVIEW_STORAGE_KEY, 'true');
}

function loadCustomerPreviewReturnPath(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(CUSTOMER_PREVIEW_RETURN_PATH_STORAGE_KEY);
}

function saveCustomerPreviewReturnPath(path: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (!path) {
    window.localStorage.removeItem(CUSTOMER_PREVIEW_RETURN_PATH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(CUSTOMER_PREVIEW_RETURN_PATH_STORAGE_KEY, path);
}

function inferName(email: string, profile: Record<string, unknown> | null): string {
  const candidateKeys = ['full_name', 'business_name', 'organisation_name', 'contact_name'];
  for (const key of candidateKeys) {
    const value = profile?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  const local = email.split('@')[0] || 'User';
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function buildUserPayload(
  apiUser: { id: number; email: string; role: UserRole },
  profile: Record<string, unknown> | null,
): User {
  return {
    id: apiUser.id,
    email: apiUser.email,
    role: apiUser.role,
    name: inferName(apiUser.email, profile),
    profile,
  };
}

function errorMessageFromUnknown(error: unknown): string {
  if (error && typeof error === 'object') {
    const maybeResponse = (error as { response?: { data?: unknown } }).response;
    const payload = maybeResponse?.data;
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
  }
  return 'Request failed';
}

/**
 * AuthProvider boundary.
 *
 * This exported unit supports the file role: Provides the AuthContext React context/provider and exposes shared state to child components.
 * It belongs to: React context layer: owns cross-page state such as authentication and cart contents.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Persisted auth state is restored on refresh so protected routes and shared
  // navigation can react immediately without forcing a new login.
  const [user, setUser] = useState<User | null>(() => loadStoredUser());
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [addresses, setAddresses] = useState<MePayload['addresses']>([]);
  const [loading, setLoading] = useState(true);
  const [customerPreview, setCustomerPreview] = useState<boolean>(() => loadCustomerPreview());
  const [customerPreviewReturnPath, setCustomerPreviewReturnPath] = useState<string | null>(() =>
    loadCustomerPreviewReturnPath(),
  );

  const persistUser = useCallback((nextUser: User | null) => {
    setUser(nextUser);
    saveUser(nextUser);
  }, []);

  const applyMePayload = useCallback(
    (payload: MePayload): User => {
      const nextUser = buildUserPayload(payload.user, payload.profile);
      persistUser(nextUser);
      setProfile(payload.profile);
      setAddresses(payload.addresses);
      return nextUser;
    },
    [persistUser],
  );

  const getMe = useCallback(async (): Promise<MePayload> => {
    const payload = await getMeRequest();
    applyMePayload(payload);
    return payload;
  }, [applyMePayload]);

  const runAuthFlow = useCallback(
    async (
      authAction: () => Promise<{ user: { id: number; email: string; role: UserRole }; detail?: string }>
    ): Promise<AuthResult> => {
      try {
        // Login and all four registration flows share the same post-auth shape:
        // fetch `/me`, save the role/profile/address payload, and let route
        // guards decide the dashboard from the returned role.
        const authPayload = await authAction();
        const me = await getMeRequest().catch(() => null);
        const nextUser = me
          ? applyMePayload(me)
          : buildUserPayload(authPayload.user, null);
        if (!me) {
          persistUser(nextUser);
        }
        return { success: true, user: nextUser, message: authPayload.detail };
      } catch (error) {
        clearAuthStorage();
        setBasicAuthToken(null);
        persistUser(null);
        setProfile(null);
        setAddresses([]);
        setCustomerPreview(false);
        saveCustomerPreview(false);
        setCustomerPreviewReturnPath(null);
        saveCustomerPreviewReturnPath(null);
        return { success: false, error: errorMessageFromUnknown(error) };
      }
    },
    [applyMePayload, persistUser],
  );

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean): Promise<AuthResult> => {
      const result = await runAuthFlow(() => loginRequest(email, password, rememberMe));
      if (result.success) {
        // Some legacy endpoints still support Basic auth, so the frontend keeps
        // this compatibility token alongside the JWT stored by authService.
        setBasicAuthToken(btoa(`${email}:${password}`));
      }
      return result;
    },
    [runAuthFlow],
  );

  const registerCustomer = useCallback(
    async (payload: CustomerRegisterPayload): Promise<AuthResult> => {
      const result = await runAuthFlow(() => registerCustomerRequest(payload));
      if (result.success) {
        setBasicAuthToken(btoa(`${payload.email}:${payload.password}`));
      }
      return result;
    },
    [runAuthFlow],
  );

  const registerProducer = useCallback(
    async (payload: ProducerRegisterPayload): Promise<AuthResult> => {
      const result = await runAuthFlow(() => registerProducerRequest(payload));
      if (result.success) {
        setBasicAuthToken(btoa(`${payload.email}:${payload.password}`));
      }
      return result;
    },
    [runAuthFlow],
  );

  const registerCommunity = useCallback(
    async (payload: CommunityRegisterPayload): Promise<AuthResult> => {
      const result = await runAuthFlow(() => registerCommunityRequest(payload));
      if (result.success) {
        setBasicAuthToken(btoa(`${payload.email}:${payload.password}`));
      }
      return result;
    },
    [runAuthFlow],
  );

  const registerRestaurant = useCallback(
    async (payload: RestaurantRegisterPayload): Promise<AuthResult> => {
      const result = await runAuthFlow(() => registerRestaurantRequest(payload));
      if (result.success) {
        setBasicAuthToken(btoa(`${payload.email}:${payload.password}`));
      }
      return result;
    },
    [runAuthFlow],
  );

  const logout = useCallback(() => {
    // Logout clears every browser-side auth surface, including producer preview
    // mode, so the next session cannot inherit another role's state.
    clearAuthStorage();
    setBasicAuthToken(null);
    persistUser(null);
    setProfile(null);
    setAddresses([]);
    setCustomerPreview(false);
    saveCustomerPreview(false);
    setCustomerPreviewReturnPath(null);
    saveCustomerPreviewReturnPath(null);
  }, [persistUser]);

  const hasRole = useCallback((role: UserRole) => user?.role === role, [user]);
  const startCustomerPreview = useCallback((returnPath?: string | null) => {
    // Producer preview mode is intentionally frontend-only. It lets producers
    // inspect customer-facing pages while preserving their actual backend role.
    setCustomerPreview(true);
    saveCustomerPreview(true);
    const nextReturnPath = returnPath && returnPath.trim() ? returnPath : null;
    setCustomerPreviewReturnPath(nextReturnPath);
    saveCustomerPreviewReturnPath(nextReturnPath);
  }, []);
  const stopCustomerPreview = useCallback(() => {
    setCustomerPreview(false);
    saveCustomerPreview(false);
    setCustomerPreviewReturnPath(null);
    saveCustomerPreviewReturnPath(null);
  }, []);

  useEffect(() => {
    // Preview mode should disappear as soon as the signed-in user is not a
    // producer, otherwise customers/restaurants could see confusing navigation.
    if (user?.role === 'PRODUCER' || user === null) {
      return;
    }
    setCustomerPreview(false);
    saveCustomerPreview(false);
    setCustomerPreviewReturnPath(null);
    saveCustomerPreviewReturnPath(null);
  }, [user]);

  useEffect(() => {
    // On refresh, the access token is the source of truth. A stale localStorage
    // user is discarded if `/api/accounts/me/` cannot validate the session.
    const bootstrap = async () => {
      try {
        if (!getAccessToken()) {
          persistUser(null);
          return;
        }
        await getMe();
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [getMe, logout]);

  const value = useMemo(
    () => ({
      user,
      profile,
      addresses,
      loading,
      customerPreview,
      customerPreviewReturnPath,
      login,
      registerCustomer,
      registerProducer,
      registerCommunity,
      registerRestaurant,
      getMe,
      logout,
      hasRole,
      startCustomerPreview,
      stopCustomerPreview,
    }),
    [
      user,
      profile,
      addresses,
      loading,
      customerPreview,
      customerPreviewReturnPath,
      login,
      registerCustomer,
      registerProducer,
      registerCommunity,
      registerRestaurant,
      getMe,
      logout,
      hasRole,
      startCustomerPreview,
      stopCustomerPreview,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth boundary.
 *
 * This exported unit supports the file role: Provides the AuthContext React context/provider and exposes shared state to child components.
 * It belongs to: React context layer: owns cross-page state such as authentication and cart contents.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
