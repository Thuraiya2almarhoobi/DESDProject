import { UserRole } from '../types';

export interface SiteNavItem {
  label: string;
  to: string;
  exact?: boolean;
  matchPrefixes: string[];
}

export function getSiteNavItems(role?: UserRole | null): SiteNavItem[] {
  switch (role) {
    case 'CUSTOMER':
      return [
        {
          label: 'Marketplace',
          to: '/marketplace',
          matchPrefixes: ['/marketplace', '/product', '/cart', '/checkout'],
        },
        { label: 'Orders', to: '/orders/history', matchPrefixes: ['/orders/history'] },
        { label: 'Near Me', to: '/map', matchPrefixes: ['/map'] },
        { label: 'Recipes', to: '/content/feed', matchPrefixes: ['/content/feed'] },
      ];
    case 'COMMUNITY':
      return [
        {
          label: 'Marketplace',
          to: '/marketplace',
          matchPrefixes: ['/marketplace', '/product', '/cart', '/checkout'],
        },
        { label: 'Dashboard', to: '/community/dashboard', matchPrefixes: ['/community/dashboard'] },
        { label: 'Recipes', to: '/content/feed', matchPrefixes: ['/content/feed'] },
      ];
    case 'RESTAURANT':
      return [
        {
          label: 'Marketplace',
          to: '/marketplace',
          matchPrefixes: ['/marketplace', '/product', '/cart', '/checkout'],
        },
        {
          label: 'Dashboard',
          to: '/restaurant/dashboard',
          matchPrefixes: ['/restaurant/dashboard', '/restaurant/recurring-orders'],
        },
        { label: 'Recipes', to: '/content/feed', matchPrefixes: ['/content/feed'] },
      ];
    case 'PRODUCER':
      return [
        { label: 'Marketplace', to: '/marketplace', matchPrefixes: ['/marketplace', '/product'] },
        { label: 'Dashboard', to: '/producer/dashboard', matchPrefixes: ['/producer/dashboard'] },
        { label: 'Orders', to: '/producer/orders', matchPrefixes: ['/producer/orders'] },
        { label: 'Inventory', to: '/producer/inventory', matchPrefixes: ['/producer/inventory'] },
        { label: 'Payments', to: '/producer/payments', matchPrefixes: ['/producer/payments'] },
        { label: 'Recipes', to: '/content/feed', matchPrefixes: ['/content/feed'] },
      ];
    case 'ADMIN':
      return [
        { label: 'Commission', to: '/admin/commission', matchPrefixes: ['/admin/commission'] },
      ];
    default:
      return [
        { label: 'Home', to: '/', exact: true, matchPrefixes: ['/'] },
        { label: 'Buy Local', to: '/portal/customer', matchPrefixes: ['/portal/customer'] },
        { label: 'Producer Portal', to: '/portal/producer', matchPrefixes: ['/portal/producer'] },
        { label: 'Community Portal', to: '/portal/community', matchPrefixes: ['/portal/community'] },
      ];
  }
}

export function isSiteNavItemActive(pathname: string, item: SiteNavItem): boolean {
  if (item.exact) {
    return pathname === item.to;
  }

  return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
