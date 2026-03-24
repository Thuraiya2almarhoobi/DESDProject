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
        { label: 'Orders', to: '/orders/history', matchPrefixes: ['/orders/history'] },
        { label: 'Near Me', to: '/map', matchPrefixes: ['/map'] },
        { label: 'Recipes', to: '/content/feed', matchPrefixes: ['/content/feed'] },
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
        { label: 'Recipes', to: '/content/feed', matchPrefixes: ['/content/feed'] },
        {
          label: 'Dashboard',
          to: '/restaurant/dashboard',
          matchPrefixes: ['/restaurant/dashboard', '/restaurant/recurring-orders'],
        },
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
