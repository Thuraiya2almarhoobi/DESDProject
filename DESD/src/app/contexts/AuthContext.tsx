import React, { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { AxiosError } from 'axios';

import {
  CommunityRegisterPayload,
  CustomerRegisterPayload,
  MePayload,
  ProducerRegisterPayload,
  RestaurantRegisterPayload,
  getMe as fetchMe,
  login as loginRequest,
  logout as clearAuth,
  registerCommunity as registerCommunityRequest,
  registerCustomer as registerCustomerRequest,
  registerProducer as registerProducerRequest,
  registerRestaurant as registerRestaurantRequest,
} from '../services/authService';
import { User, UserRole } from '../types';
import { clearAuthStorage, getAccessToken } from '../lib/tokenStorage';

type AuthResult = { success: true; user: User } | { success: false; error: string };

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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveDisplayName(mePayload: MePayload): string {
  const role = mePayload.user.role;
  const profile = mePayload.profile ?? {};

  switch (role) {
    case 'CUSTOMER':
      return (profile.full_name as string | undefined) ?? mePayload.user.email;
    case 'PRODUCER':
      return (profile.business_name as string | undefined) ?? mePayload.user.email;
    case 'COMMUNITY':
      return (profile.organisation_name as string | undefined) ?? mePayload.user.email;
    case 'RESTAURANT':
      return (profile.business_name as string | undefined) ?? mePayload.user.email;
    case 'ADMIN':
      return mePayload.user.email;
    default:
      return mePayload.user.email;
  }
}

function buildUserFromMe(mePayload: MePayload): User {
  return {
    id: mePayload.user.id,
    email: mePayload.user.email,
    role: mePayload.user.role,
    name: resolveDisplayName(mePayload),
    profile: mePayload.profile,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const responseData = error.response?.data as Record<string, unknown> | undefined;
    const detail = typeof responseData?.detail === 'string' ? responseData.detail : undefined;
    if (detail) {
      return detail;
    }
    const firstEntry = Object.entries(responseData ?? {})[0];
    if (firstEntry && Array.isArray(firstEntry[1]) && firstEntry[1].length > 0) {
      return String(firstEntry[1][0]);
    }
  }
  return 'Request failed. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [addresses, setAddresses] = useState<MePayload['addresses']>([]);
  const [loading, setLoading] = useState(true);

  const applyMePayload = (mePayload: MePayload): User => {
    const nextUser = buildUserFromMe(mePayload);
    setUser(nextUser);
    setProfile(mePayload.profile);
    setAddresses(mePayload.addresses);
    return nextUser;
  };

  const getMe = async (): Promise<MePayload> => {
    const mePayload = await fetchMe();
    applyMePayload(mePayload);
    return mePayload;
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      const accessToken = getAccessToken();
      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        await getMe();
      } catch {
        clearAuthStorage();
        setUser(null);
        setProfile(null);
        setAddresses([]);
      } finally {
        setLoading(false);
      }
    };

    void bootstrapAuth();
  }, []);

  const runAuthFlow = async (requestFn: () => Promise<{ user: { id: number; email: string; role: UserRole } }>): Promise<AuthResult> => {
    try {
      const authPayload = await requestFn();

      try {
        const mePayload = await fetchMe();
        const nextUser = applyMePayload(mePayload);
        return { success: true, user: nextUser };
      } catch {
        const fallbackUser: User = {
          id: authPayload.user.id,
          email: authPayload.user.email,
          role: authPayload.user.role,
          name: authPayload.user.email,
          profile: null,
        };
        setUser(fallbackUser);
        setProfile(null);
        setAddresses([]);
        return { success: true, user: fallbackUser };
      }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const login = async (email: string, password: string): Promise<AuthResult> => {
    return runAuthFlow(() => loginRequest(email, password));
  };

  const registerCustomer = async (payload: CustomerRegisterPayload): Promise<AuthResult> => {
    return runAuthFlow(() => registerCustomerRequest(payload));
  };

  const registerProducer = async (payload: ProducerRegisterPayload): Promise<AuthResult> => {
    return runAuthFlow(() => registerProducerRequest(payload));
  };

  const registerCommunity = async (payload: CommunityRegisterPayload): Promise<AuthResult> => {
    return runAuthFlow(() => registerCommunityRequest(payload));
  };

  const registerRestaurant = async (payload: RestaurantRegisterPayload): Promise<AuthResult> => {
    return runAuthFlow(() => registerRestaurantRequest(payload));
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setProfile(null);
    setAddresses([]);
  };

  const hasRole = (role: UserRole) => user?.role === role;

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
