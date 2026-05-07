/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for roleRouting concerns across the frontend.
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

export function getDashboardPathForRole(role: UserRole): string {
  // role routing is centralised so login remember me and nav all agree
  switch (role) {
    case 'CUSTOMER':
      return '/marketplace';
    case 'PRODUCER':
      return '/producer/dashboard';
    case 'COMMUNITY':
      return '/community/dashboard';
    case 'RESTAURANT':
      return '/restaurant/dashboard';
    case 'ADMIN':
      return '/admin/dashboard';
    default:
      return '/login';
  }
}
