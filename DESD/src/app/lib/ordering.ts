import { UserRole } from '../types';

export const MAX_ORDER_ITEM_QUANTITY = 100;

export function isBuyerRole(role?: UserRole | null): boolean {
  return role === 'CUSTOMER' || role === 'COMMUNITY' || role === 'RESTAURANT';
}

export function isBulkBuyerRole(role?: UserRole | null): boolean {
  return role === 'COMMUNITY' || role === 'RESTAURANT';
}
