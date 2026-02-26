import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { apiJson, setBasicAuthToken } from '../lib/api';

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

function deriveRoleFromEmail(email: string): UserRole {
  const value = email.toLowerCase();
  if (value.includes('admin')) {
    return 'admin';
  }
  if (value.includes('producer')) {
    return 'producer';
  }
  return 'customer';
}

function inferDisplayName(email: string): string {
  const local = email.split('@')[0] || 'User';
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => loadStoredUser());

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const basicToken = btoa(`${email}:${password}`);

    try {
      setBasicAuthToken(basicToken);
      await apiJson('/api/orders/profile/');

      const nextUser: User = {
        id: email,
        email,
        role: deriveRoleFromEmail(email),
        name: inferDisplayName(email),
        customerType: deriveRoleFromEmail(email) === 'customer' ? 'standard' : undefined,
      };

      setUser(nextUser);
      saveUser(nextUser);
      return { success: true };
    } catch {
      setBasicAuthToken(null);
      saveUser(null);
      setUser(null);
      return { success: false, error: 'Invalid credentials' };
    }
  };

  const logout = () => {
    setBasicAuthToken(null);
    saveUser(null);
    setUser(null);
    setProfile(null);
    setAddresses([]);
  };

  const hasRole = (role: UserRole) => user?.role === role;

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      hasRole,
    }),
    [user],
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
