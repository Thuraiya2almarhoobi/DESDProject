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
