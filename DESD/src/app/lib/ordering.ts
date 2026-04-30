import { UserRole } from '../types';

export const MAX_ORDER_ITEM_QUANTITY = 100;

function normalizeRole(role?: UserRole | string | null): UserRole | null {
  if (!role) {
    return null;
  }

  const normalizedRole = role.toUpperCase();
  if (
    normalizedRole === 'CUSTOMER' ||
    normalizedRole === 'PRODUCER' ||
    normalizedRole === 'COMMUNITY' ||
    normalizedRole === 'RESTAURANT' ||
    normalizedRole === 'ADMIN'
  ) {
    return normalizedRole;
  }

  return null;
}

export function isBuyerRole(role?: UserRole | string | null): boolean {
  const normalizedRole = normalizeRole(role);
  return (
    normalizedRole === 'CUSTOMER' ||
    normalizedRole === 'PRODUCER' ||
    normalizedRole === 'COMMUNITY' ||
    normalizedRole === 'RESTAURANT'
  );
}

export function isBulkBuyerRole(role?: UserRole | string | null): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === 'COMMUNITY' || normalizedRole === 'RESTAURANT';
}

export function getQuantityCapForRole(
  role: UserRole | string | null | undefined,
  availableStock: number,
): number {
  const normalizedStock = Math.max(0, Math.floor(availableStock));

  if (isBulkBuyerRole(role)) {
    return normalizedStock;
  }

  return Math.min(MAX_ORDER_ITEM_QUANTITY, normalizedStock);
}
