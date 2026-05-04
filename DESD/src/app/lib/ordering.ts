/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for ordering concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { UserRole } from '../types';

/**
 * MAX_ORDER_ITEM_QUANTITY boundary.
 *
 * This exported unit supports the file role: Contains reusable helper functions for ordering concerns across the frontend.
 * It belongs to: Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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
