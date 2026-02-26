export const ACCESS_TOKEN_KEY = 'desd_access_token';
export const REFRESH_TOKEN_KEY = 'desd_refresh_token';
export const USER_ROLE_KEY = 'desd_user_role';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredRole(): string | null {
  return localStorage.getItem(USER_ROLE_KEY);
}

export function setAuthTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function setStoredRole(role: string): void {
  localStorage.setItem(USER_ROLE_KEY, role);
}

export function clearAuthStorage(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_ROLE_KEY);
}
