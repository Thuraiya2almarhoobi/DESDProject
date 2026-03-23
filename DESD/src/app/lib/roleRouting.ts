import { UserRole } from '../types';

export function getDashboardPathForRole(role: UserRole): string {
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
