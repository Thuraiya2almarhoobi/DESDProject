/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for tokenStorage concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

/**
 * ACCESS_TOKEN_KEY boundary.
 *
 * This exported unit supports the file role: Contains reusable helper functions for tokenStorage concerns across the frontend.
 * It belongs to: Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export const ACCESS_TOKEN_KEY = 'desd_access_token';
export const REFRESH_TOKEN_KEY = 'desd_refresh_token';
export const USER_ROLE_KEY = 'desd_user_role';

/**
 * Browser storage helpers for JWT auth and remembered role state.
 *
 * Tokens can live in localStorage or sessionStorage depending on the user's
 * remember-me preference.
 */
function getSessionStore(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
}

function getLocalStore(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function readFromSessionThenLocal(key: string): string | null {
  const sessionStore = getSessionStore();
  const localStore = getLocalStore();
  // session value wins so non remembered login does not get mixed with old local login
  const sessionValue = sessionStore?.getItem(key) ?? null;
  if (sessionValue) {
    return sessionValue;
  }
  return localStore?.getItem(key) ?? null;
}

function clearKeyFromAllStores(key: string): void {
  // clear both stores because the user can switch remember me on and off
  getLocalStore()?.removeItem(key);
  getSessionStore()?.removeItem(key);
}

export function getAccessToken(): string | null {
  return readFromSessionThenLocal(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readFromSessionThenLocal(REFRESH_TOKEN_KEY);
}

export function getStoredRole(): string | null {
  return readFromSessionThenLocal(USER_ROLE_KEY);
}

function inferRememberPreference(): boolean {
  // keep refreshed tokens in the same place as the current refresh token
  if (getSessionStore()?.getItem(REFRESH_TOKEN_KEY)) {
    return false;
  }
  if (getLocalStore()?.getItem(REFRESH_TOKEN_KEY)) {
    return true;
  }
  return true;
}

export function setAuthTokens(access: string, refresh: string, rememberMe = inferRememberPreference()): void {
  // Clear both stores first so a previous session does not leave stale tokens
  // behind when the storage target changes.
  clearKeyFromAllStores(ACCESS_TOKEN_KEY);
  clearKeyFromAllStores(REFRESH_TOKEN_KEY);
  const sessionStore = getSessionStore();
  const localStore = getLocalStore();
  if (rememberMe) {
    localStore?.setItem(ACCESS_TOKEN_KEY, access);
    localStore?.setItem(REFRESH_TOKEN_KEY, refresh);
  } else {
    sessionStore?.setItem(ACCESS_TOKEN_KEY, access);
    sessionStore?.setItem(REFRESH_TOKEN_KEY, refresh);
  }
}

export function setStoredRole(role: string, rememberMe = true): void {
  // role is stored beside tokens so protected routes can recover after reload
  clearKeyFromAllStores(USER_ROLE_KEY);
  const sessionStore = getSessionStore();
  const localStore = getLocalStore();
  if (rememberMe) {
    localStore?.setItem(USER_ROLE_KEY, role);
  } else {
    sessionStore?.setItem(USER_ROLE_KEY, role);
  }
}

export function clearAuthStorage(): void {
  clearKeyFromAllStores(ACCESS_TOKEN_KEY);
  clearKeyFromAllStores(REFRESH_TOKEN_KEY);
  clearKeyFromAllStores(USER_ROLE_KEY);
}
