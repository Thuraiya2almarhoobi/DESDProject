/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for customerPreview concerns across the frontend.
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
 * CUSTOMER_PREVIEW_EXIT_TARGET_STORAGE_KEY boundary.
 *
 * This exported unit supports the file role: Contains reusable helper functions for customerPreview concerns across the frontend.
 * It belongs to: Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const CUSTOMER_PREVIEW_EXIT_TARGET_STORAGE_KEY = 'desd_customer_preview_exit_target';

function readStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.sessionStorage;
}

export function getPendingCustomerPreviewExitTarget(): string | null {
  const storage = readStorage();
  if (!storage) {
    return null;
  }
  const value = storage.getItem(CUSTOMER_PREVIEW_EXIT_TARGET_STORAGE_KEY);
  return value && value.trim() ? value : null;
}

export function setPendingCustomerPreviewExitTarget(path: string | null): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  if (!path || !path.trim()) {
    storage.removeItem(CUSTOMER_PREVIEW_EXIT_TARGET_STORAGE_KEY);
    return;
  }
  storage.setItem(CUSTOMER_PREVIEW_EXIT_TARGET_STORAGE_KEY, path);
}

export function clearPendingCustomerPreviewExitTarget(): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }
  storage.removeItem(CUSTOMER_PREVIEW_EXIT_TARGET_STORAGE_KEY);
}
