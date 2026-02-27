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

type AuthResult =
  | {
      success: true;
      user: User;
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
  login: (email: string, password: string) => Promise<AuthResult>;
  registerCustomer: (payload: CustomerRegisterPayload) => Promise<AuthResult>;
  registerProducer: (payload: ProducerRegisterPayload) => Promise<AuthResult>;
  registerCommunity: (payload: CommunityRegisterPayload) => Promise<AuthResult>;
  registerRestaurant: (payload: RestaurantRegisterPayload) => Promise<AuthResult>;
  getMe: () => Promise<MePayload>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
}

const USER_STORAGE_KEY = 'desd_user';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [addresses, setAddresses] = useState<MePayload['addresses']>([]);
  const [loading, setLoading] = useState(true);

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
    async (authAction: () => Promise<{ user: { id: number; email: string; role: UserRole } }>): Promise<AuthResult> => {
      try {
        const authPayload = await authAction();
        const me = await getMeRequest().catch(() => null);
        const nextUser = me
          ? applyMePayload(me)
          : buildUserPayload(authPayload.user, null);
        if (!me) {
          persistUser(nextUser);
        }
        return { success: true, user: nextUser };
      } catch (error) {
        clearAuthStorage();
        setBasicAuthToken(null);
        persistUser(null);
        setProfile(null);
        setAddresses([]);
        return { success: false, error: errorMessageFromUnknown(error) };
      }
    },
    [applyMePayload, persistUser],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const result = await runAuthFlow(() => loginRequest(email, password));
      if (result.success) {
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
    clearAuthStorage();
    setBasicAuthToken(null);
    persistUser(null);
    setProfile(null);
    setAddresses([]);
  }, [persistUser]);

  const hasRole = useCallback((role: UserRole) => user?.role === role, [user]);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        if (!getAccessToken()) {
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
      login,
      registerCustomer,
      registerProducer,
      registerCommunity,
      registerRestaurant,
      getMe,
      logout,
      hasRole,
    }),
    [
      user,
      profile,
      addresses,
      loading,
      login,
      registerCustomer,
      registerProducer,
      registerCommunity,
      registerRestaurant,
      getMe,
      logout,
      hasRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
