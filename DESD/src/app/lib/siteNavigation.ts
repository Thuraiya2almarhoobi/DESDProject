/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for siteNavigation concerns across the frontend.
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

export interface SiteNavItem {
  label: string;
  to: string;
  exact?: boolean;
  matchPrefixes: string[];
}

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

export function getSiteNavItems(role?: UserRole | null): SiteNavItem[] {
  switch (normalizeRole(role)) {
    case 'CUSTOMER':
      return [
        {
          label: 'Marketplace',
          to: '/marketplace',
          matchPrefixes: ['/marketplace', '/product', '/cart', '/checkout'],
        },
        { label: 'Orders', to: '/orders/history', matchPrefixes: ['/orders/history'] },
        { label: 'Near Me', to: '/map', matchPrefixes: ['/map'] },
        { label: 'Content', to: '/content/recipes', matchPrefixes: ['/content/recipes', '/content/stories', '/content/feed'] },
      ];
    case 'COMMUNITY':
      return [
        {
          label: 'Marketplace',
          to: '/marketplace',
          matchPrefixes: ['/marketplace', '/product', '/cart', '/checkout'],
        },
        { label: 'Orders', to: '/orders/history', matchPrefixes: ['/orders/history'] },
        { label: 'Near Me', to: '/map', matchPrefixes: ['/map'] },
        { label: 'Content', to: '/content/recipes', matchPrefixes: ['/content/recipes', '/content/stories', '/content/feed'] },
        { label: 'Dashboard', to: '/community/dashboard', matchPrefixes: ['/community/dashboard'] },
      ];
    case 'RESTAURANT':
      return [
        {
          label: 'Marketplace',
          to: '/marketplace',
          matchPrefixes: ['/marketplace', '/product', '/cart', '/checkout'],
        },
        { label: 'Orders', to: '/orders/history', matchPrefixes: ['/orders/history'] },
        { label: 'Near Me', to: '/map', matchPrefixes: ['/map'] },
        { label: 'Content', to: '/content/recipes', matchPrefixes: ['/content/recipes', '/content/stories', '/content/feed'] },
        {
          label: 'Dashboard',
          to: '/restaurant/dashboard',
          matchPrefixes: ['/restaurant/dashboard', '/restaurant/recurring-orders'],
        },
      ];
    case 'PRODUCER':
      return [
        { label: 'Dashboard', to: '/producer/dashboard', matchPrefixes: ['/producer/dashboard'] },
        { label: 'Orders', to: '/producer/orders', matchPrefixes: ['/producer/orders', '/orders/history'] },
        { label: 'Inventory', to: '/producer/inventory', matchPrefixes: ['/producer/inventory'] },
        { label: 'Payouts', to: '/producer/payments', matchPrefixes: ['/producer/payments'] },
        {
          label: 'Content',
          to: '/producer/publish',
          matchPrefixes: ['/producer/publish', '/producer/content', '/content/recipes', '/content/stories', '/content/feed'],
        },
        { label: 'Near Me', to: '/map', matchPrefixes: ['/map'] },
        { label: 'Marketplace', to: '/marketplace', matchPrefixes: ['/marketplace', '/product', '/cart', '/checkout'] },
      ];
    case 'ADMIN':
      return [
        { label: 'Commission', to: '/admin/commission', matchPrefixes: ['/admin/commission'] },
      ];
    default:
      return [
        { label: 'Home', to: '/', exact: true, matchPrefixes: ['/'] },
        { label: 'About', to: '/about', matchPrefixes: ['/about'] },
        { label: 'Producers', to: '/producers', matchPrefixes: ['/producers'] },
        { label: 'Browse', to: '/browse', matchPrefixes: ['/browse'] },
      ];
  }
}

export function isSiteNavItemActive(pathname: string, item: SiteNavItem): boolean {
  if (item.exact) {
    return pathname === item.to;
  }

  return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
