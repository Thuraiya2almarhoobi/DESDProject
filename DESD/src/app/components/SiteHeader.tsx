/**
 * desd marketplace notes
 *
 * reusable header for role navigation search cart and notification access
 * comments here focus on shared state ownership and cross page routing
 */

import type { FormEvent, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Bell, LogOut, MapPin, Menu, Search, ShoppingCart, Sprout, User, X } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { formatDisplayPostcode, getPreferredAddress, getRoleLabel } from '../lib/accountLocation';
import { useCart } from '../contexts/CartContext';
import { clearPendingCustomerPreviewExitTarget } from '../lib/customerPreview';
import { apiJson } from '../lib/api';
import { formatCompactNumber } from '../lib/numberFormat';
import { fetchProducerNotifications, getProducerNotificationBadgeCount } from '../lib/producerNotifications';
import { getDashboardPathForRole } from '../lib/roleRouting';
import { getSiteNavItems, isSiteNavItemActive } from '../lib/siteNavigation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from './ui/utils';

interface SiteHeaderProps {
  showSearch?: boolean;
  showNavigation?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  searchPlaceholder?: string;
  onSearchSubmit?: (query: string) => void;
  showLocationBar?: boolean;
  locationCity?: string;
}

interface UserNotificationItem {
  id: number;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

function isMarketingPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/about' ||
    pathname === '/producers' ||
    pathname === '/browse' ||
    pathname.startsWith('/browse/')
  );
}

function canOrder(role?: string | null): boolean {
  return role === 'CUSTOMER' || role === 'PRODUCER' || role === 'COMMUNITY' || role === 'RESTAURANT';
}

function firstNameFrom(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().split(/\s+/).filter(Boolean)[0] || '';
}

function notificationTargetPath(item: UserNotificationItem): string {
  // notification metadata chooses the page that explains the event
  // the bell stays generic but order product and recurring events remain clickable
  const metadata = item.metadata || {};
  const orderId = metadata.order_id;
  const productId = metadata.product_id || metadata.producer_product_id;
  const templateId = metadata.template_id;

  if (
    (item.category === 'order_status' ||
      item.category === 'order_confirmation' ||
      item.category === 'recurring_order' ||
      item.category === 'recurring_order_generated') &&
    typeof orderId === 'number'
  ) {
    return `/orders/history?order=${orderId}`;
  }
  if (item.category === 'surplus_deal' && (typeof productId === 'number' || typeof productId === 'string')) {
    return `/product/${productId}`;
  }
  if (
    (item.category === 'recurring_order' ||
      item.category === 'recurring_order_alert' ||
      item.category === 'recurring_order_generated') &&
    typeof templateId === 'number'
  ) {
    return '/restaurant/recurring-orders';
  }
  return '/marketplace';
}

/**
 * site header boundary
 *
 * shared header keeps role routing search cart and notifications consistent
 * page level logic should pass state in instead of duplicating header behavior
 */
export function SiteHeader({
  showSearch = false,
  showNavigation = true,
  searchQuery = '',
  onSearchQueryChange,
  searchPlaceholder = 'Search produce, farms, or categories…',
  onSearchSubmit,
  showLocationBar = false,
  locationCity = 'Bristol',
}: SiteHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, addresses, logout, stopCustomerPreview } = useAuth();
  const { getTotalItems } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [producerNotificationCount, setProducerNotificationCount] = useState(0);
  const [userNotifications, setUserNotifications] = useState<UserNotificationItem[]>([]);
  const [userNotificationCount, setUserNotificationCount] = useState(0);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  const isMarketingSurface = isMarketingPath(location.pathname);
  const isAuthenticated = Boolean(user);
  const isBuyer = canOrder(user?.role);
  const renderSearch = showSearch || showNavigation;
  const navItems = useMemo(() => {
    if (!showNavigation) {
      return [];
    }
    if (isMarketingSurface) {
      return getSiteNavItems(null);
    }
    return user ? getSiteNavItems(user.role) : getSiteNavItems(null);
  }, [isMarketingSurface, showNavigation, user]);

  const brandLinkTarget = isMarketingSurface ? '/' : user ? getDashboardPathForRole(user.role) : '/';
  const searchTargetPath =
    !user || isMarketingSurface || user.role === 'ADMIN'
      ? '/browse'
      : location.pathname.startsWith('/product') || location.pathname.startsWith('/cart') || location.pathname.startsWith('/checkout')
        ? '/marketplace'
        : location.pathname;
  const searchValue = onSearchQueryChange ? searchQuery : localSearchQuery;
  const cartItemCount = getTotalItems();
  const preferredAddress = useMemo(
    () => (user ? getPreferredAddress(user.role, profile, addresses) : null),
    [addresses, profile, user],
  );
  const userPostcode = formatDisplayPostcode(preferredAddress?.postcode);
  const signedInRoleLabel = getRoleLabel(user?.role);
  const signedInFirstName = useMemo(() => {
    if (!user) {
      return '';
    }
    const profileRecord = (profile || {}) as Record<string, unknown>;
    return (
      firstNameFrom(profileRecord.first_name) ||
      firstNameFrom(profileRecord.contact_first_name) ||
      firstNameFrom(profileRecord.full_name) ||
      firstNameFrom(profileRecord.contact_name) ||
      firstNameFrom(user.name) ||
      firstNameFrom(user.email?.split('@')[0])
    );
  }, [profile, user]);
  const postcodeEditTarget = user
    ? user.role === 'PRODUCER'
      ? '/account#business-profile'
      : user.role === 'COMMUNITY'
        ? '/account#organisation-profile'
        : user.role === 'RESTAURANT'
          ? '/account#delivery-profile'
          : '/account#delivery-profile'
    : '/account';

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    // local header search follows the url only when the page does not own search state
    if (onSearchQueryChange) {
      return;
    }

    const queryFromUrl = new URLSearchParams(location.search).get('q') || '';
    setLocalSearchQuery(queryFromUrl);
  }, [location.search, onSearchQueryChange]);

  useEffect(() => {
    if (!user) {
      // signed out users should never see stale notification counts
      // clearing both sources keeps role switching demos predictable
      setUserNotifications([]);
      setUserNotificationCount(0);
      setProducerNotificationCount(0);
      return;
    }

    let mounted = true;
    const loadNotificationCounts = async () => {
      try {
        // customer and producer notification sources are merged into one bell count
        // this keeps status notes surplus alerts and producer alerts in one header
        const [userNotificationsPayload, producerNotificationsPayload] = await Promise.all([
          apiJson<UserNotificationItem[]>('/api/orders/notifications/'),
          user.role === 'PRODUCER'
            ? fetchProducerNotifications((user.email || '').trim().toLowerCase())
            : Promise.resolve([]),
        ]);
        if (!mounted) {
          return;
        }
        setUserNotifications(userNotificationsPayload);
        setUserNotificationCount(userNotificationsPayload.filter((item) => !item.is_read).length);
        setProducerNotificationCount(getProducerNotificationBadgeCount(producerNotificationsPayload));
      } catch {
        if (mounted) {
          setUserNotifications([]);
          setUserNotificationCount(0);
          setProducerNotificationCount(0);
        }
      }
    };

    void loadNotificationCounts();
    return () => {
      mounted = false;
    };
  }, [location.pathname, location.search, user]);

  const updateSearchValue = (value: string) => {
    if (onSearchQueryChange) {
      // marketplace owns its search input so url syncing does not fight typing
      onSearchQueryChange(value);
      return;
    }

    setLocalSearchQuery(value);
  };

  const handleSamePageClick = (event: MouseEvent<HTMLAnchorElement>, target: string) => {
    if (location.pathname === target) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  const handleSearchSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const nextQuery = searchValue.trim();
    if (onSearchSubmit) {
      onSearchSubmit(nextQuery);
      setIsMobileMenuOpen(false);
      return;
    }
    const currentParams = searchTargetPath === location.pathname ? new URLSearchParams(location.search) : new URLSearchParams();
    if (nextQuery) {
      currentParams.set('q', nextQuery);
    } else {
      currentParams.delete('q');
    }
    const nextSearch = currentParams.toString();
    const nextPath = nextSearch ? `${searchTargetPath}?${nextSearch}` : searchTargetPath;
    navigate(nextPath);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    // logout also clears preview state before returning to the public home page
    clearPendingCustomerPreviewExitTarget();
    stopCustomerPreview();
    logout();
    navigate('/');
  };

  const totalNotificationCount = userNotificationCount + producerNotificationCount;

  const handleNotificationButtonClick = async () => {
    // open first then mark read so the panel still works if the patch fails
    // the optimistic count update makes notification demos feel immediate
    const nextOpen = !isNotificationPanelOpen;
    setIsNotificationPanelOpen(nextOpen);
    if (!nextOpen || userNotificationCount === 0) {
      return;
    }
    const unreadIds = userNotifications.filter((item) => !item.is_read).map((item) => item.id);
    setUserNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    setUserNotificationCount(0);
    try {
      await apiJson('/api/orders/notifications/', {
        method: 'PATCH',
        body: JSON.stringify({ ids: unreadIds }),
      });
    } catch {
      // panel remains useful even if the read marker fails
    }
  };

  const handleUserNotificationClick = (item: UserNotificationItem) => {
    // close before navigating so the next screen starts clean
    // target routing is derived from persisted notification metadata
    setIsNotificationPanelOpen(false);
    navigate(notificationTargetPath(item));
  };

  const notificationButton = user ? (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleNotificationButtonClick}
        className="relative text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_6%,white)]"
        aria-label={`Notifications${totalNotificationCount > 0 ? `, ${totalNotificationCount} active` : ''}`}
      >
          <Bell className="size-4" />
          {totalNotificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--forest-green)] px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {formatCompactNumber(totalNotificationCount)}
            </span>
          ) : null}
      </Button>
      {isNotificationPanelOpen && (
        <div className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-[#e4e1d8] bg-[#fffefa] text-left shadow-xl">
          <div className="border-b border-[#eee8dc] px-4 py-3">
            <p className="font-semibold text-[var(--rich-soil)]">Notifications</p>
            <p className="text-xs text-gray-600">Order updates and favourite-producer surplus alerts.</p>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {userNotifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-gray-500">No customer notifications yet.</p>
            ) : (
              userNotifications.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleUserNotificationClick(item)}
                  className="block w-full rounded-xl px-3 py-2 text-left hover:bg-[#f6f1e7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-[var(--rich-soil)]">{item.message}</p>
                    {!item.is_read && <span className="mt-1 size-2 rounded-full bg-[var(--forest-green)]" />}
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{item.category.replaceAll('_', ' ')}</p>
                </button>
              ))
            )}
            {user?.role === 'PRODUCER' && producerNotificationCount > 0 && (
              <Link
                to="/producer/notifications"
                onClick={() => setIsNotificationPanelOpen(false)}
                className="mt-2 block rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm font-medium text-[var(--forest-green)] hover:bg-green-100"
              >
                {producerNotificationCount} producer inventory/order alert{producerNotificationCount === 1 ? '' : 's'}
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  ) : null;

  const desktopActionButtons = !isAuthenticated ? (
    <>

      <Button asChild variant="ghost" size="sm" className="text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_6%,white)]">
        <Link to="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]">
        <Link to="/select-portal?mode=register">Sign up</Link>
      </Button>
    </>
  ) : (
    <>

      {isBuyer ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[var(--forest-green)] text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_8%,white)] hover:text-[var(--forest-green)]"
        >
          <Link to="/cart">
            <ShoppingCart className="size-4" />
            Cart
            {cartItemCount > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--forest-green)] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {formatCompactNumber(cartItemCount)}
              </span>
            ) : null}
          </Link>
        </Button>
      ) : (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="border-[var(--forest-green)] text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_8%,white)] hover:text-[var(--forest-green)]"
        >
          <Link to={getDashboardPathForRole(user.role)}>Dashboard</Link>
        </Button>
      )}
      {notificationButton}
      <Button asChild variant="ghost" size="sm" className="text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_6%,white)]">
        <Link to="/account">
          <User className="size-4" />
          Account
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={handleLogout}
        className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]"
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </>
  );

  return (
    <div className="sticky top-0 z-30 border-b border-[#e4e1d8] bg-[#fffefa]/95 shadow-sm backdrop-blur-sm">
      <header>
        <div className="mx-auto max-w-7xl px-4">
          <div className="hidden md:block">
            <div className="grid min-h-16 grid-cols-[minmax(12rem,1fr)_minmax(18rem,38rem)_minmax(12rem,1fr)] items-center gap-4 py-3">
              <Link
                to={brandLinkTarget}
                className="flex min-w-0 items-center gap-3 text-[var(--forest-green)]"
                onClick={(event) => handleSamePageClick(event, brandLinkTarget)}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--forest-green)] shadow-sm">
                  <Sprout className="size-4 text-white" />
                </div>
                <span className="truncate text-base font-semibold tracking-tight">Local Food Marketplace</span>
              </Link>

              {renderSearch ? (
                <form onSubmit={handleSearchSubmit} className="site-search-form relative w-full justify-self-center">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--forest-green)]" />
                  <Input
                    value={searchValue}
                    onChange={(event) => updateSearchValue(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-11 rounded-full border-[#d8d0c0] bg-[#fffefa] pl-10 pr-10 shadow-none transition-colors focus-visible:border-[var(--forest-green)] focus-visible:ring-[var(--forest-green)]/15"
                  />
                  {searchValue ? (
                    <button
                      type="button"
                      onClick={() => updateSearchValue('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--forest-green)] transition-colors hover:text-[var(--forest-green)]"
                      aria-label="Clear search"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </form>
              ) : (
                <div />
              )}

              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">{desktopActionButtons}</div>
            </div>

            {showNavigation ? (
              <div className="border-t border-[#e9e3d7]">
                {isAuthenticated ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 py-2.5">
                    <div className="min-w-0 truncate pl-2 text-sm text-[oklch(0.42_0.03_145)]">
                      <span className="font-medium text-[var(--forest-green)]">{signedInFirstName || user.name}</span>
                      <span className="px-2 text-[oklch(0.55_0.02_145)]">&middot;</span>
                      <span>{signedInRoleLabel}</span>
                    </div>
                    <nav aria-label="Primary" className="flex items-center justify-center gap-4 overflow-x-auto">
                      {navItems.map((item) => {
                        const isActive = isSiteNavItemActive(location.pathname, item);

                        return (
                          <Link
                            key={item.label}
                            to={item.to}
                            onClick={(event) => handleSamePageClick(event, item.to)}
                            className={cn(
                              'border-b-2 px-2.5 py-1.5 text-sm font-medium transition-colors',
                              isActive
                                ? 'border-[var(--forest-green)] text-[var(--forest-green)]'
                                : 'border-transparent text-[oklch(0.38_0.03_95)] hover:border-[color-mix(in_srgb,var(--forest-green)_35%,white)] hover:text-[var(--forest-green)]',
                            )}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </nav>
                    <div className="flex justify-end">
                      <Link
                        to={postcodeEditTarget}
                        className="inline-flex items-center gap-2 rounded-full border border-[#d8d0c0] bg-[#fffefa] px-3 py-1.5 text-xs font-medium text-[oklch(0.42_0.03_145)] transition-colors hover:border-[color-mix(in_srgb,var(--forest-green)_40%,white)] hover:text-[var(--forest-green)]"
                      >
                        <MapPin className="size-3.5 text-[var(--forest-green)]" />
                        <span>Delivering to</span>
                        <span className="text-[var(--forest-green)]">{userPostcode || 'Set postcode'}</span>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <nav aria-label="Primary" className="flex items-center justify-center gap-4 overflow-x-auto py-2.5">
                    {navItems.map((item) => {
                      const isActive = isSiteNavItemActive(location.pathname, item);

                      return (
                        <Link
                          key={item.label}
                          to={item.to}
                          onClick={(event) => handleSamePageClick(event, item.to)}
                          className={cn(
                            'border-b-2 px-2.5 py-1.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'border-[var(--forest-green)] text-[var(--forest-green)]'
                              : 'border-transparent text-[oklch(0.38_0.03_95)] hover:border-[color-mix(in_srgb,var(--forest-green)_35%,white)] hover:text-[var(--forest-green)]',
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                )}
              </div>
            ) : isAuthenticated ? (
              <div className="border-t border-[#e9e3d7]">
                <div className="flex items-center justify-between gap-4 py-2 text-sm text-[oklch(0.42_0.03_145)]">
                  <div className="min-w-0 truncate pl-2">
                    <span className="font-medium text-[var(--forest-green)]">{signedInFirstName || user.name}</span>
                    <span className="px-2">&middot;</span>
                    <span>{signedInRoleLabel}</span>
                  </div>
                  <Link
                    to={postcodeEditTarget}
                    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#d8d0c0] bg-[#fffefa] px-3 py-1.5 text-xs font-medium text-[oklch(0.42_0.03_145)] transition-colors hover:border-[color-mix(in_srgb,var(--forest-green)_40%,white)] hover:text-[var(--forest-green)]"
                  >
                    <MapPin className="size-3.5 text-[var(--forest-green)]" />
                    <span>Delivering to</span>
                    <span className="text-[var(--forest-green)]">{userPostcode || 'Set postcode'}</span>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex h-[60px] items-center justify-between gap-3 md:hidden">
            <Link
              to={brandLinkTarget}
              className="flex min-w-0 items-center gap-3 text-[var(--forest-green)]"
              onClick={(event) => handleSamePageClick(event, brandLinkTarget)}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--forest-green)] shadow-sm">
                <Sprout className="size-4 text-white" />
              </div>
              <span className="truncate text-sm font-semibold tracking-tight">Local Food Marketplace</span>
            </Link>

            <div className="flex items-center gap-1">
              {notificationButton}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                onClick={() => setIsMobileMenuOpen((current) => !current)}
                className="text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_6%,white)]"
              >
                {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </div>
          </div>

          {isAuthenticated ? (
            <div className="border-t border-[oklch(0.9_0.02_145)] py-2 md:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[oklch(0.42_0.03_145)]">
                <div className="min-w-0 truncate pl-12">
                  <span className="font-medium text-[var(--forest-green)]">{signedInFirstName || user.name}</span>
                  <span className="px-1.5">&middot;</span>
                  <span>{signedInRoleLabel}</span>
                </div>
                <Link
                  to={postcodeEditTarget}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d8d0c0] bg-[#fffefa] px-2.5 py-1 text-[11px] font-medium text-[oklch(0.42_0.03_145)]"
                >
                  <MapPin className="size-3 text-[var(--forest-green)]" />
                  <span>Delivering to</span>
                  <span className="text-[var(--forest-green)]">{userPostcode || 'Set postcode'}</span>
                </Link>
              </div>
            </div>
          ) : null}

          {isMobileMenuOpen ? (
            <div className="border-t border-[oklch(0.9_0.02_145)] py-4 md:hidden">
              {renderSearch ? (
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--forest-green)]" />
                  <Input
                    value={searchValue}
                    onChange={(event) => updateSearchValue(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-10 rounded-full border-[#e4e1d8] bg-[#fffefa] pl-10 pr-10 shadow-none focus-visible:border-[var(--forest-green)]"
                  />
                  {searchValue ? (
                    <button
                      type="button"
                      onClick={() => updateSearchValue('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--forest-green)] transition-colors hover:text-[var(--forest-green)]"
                      aria-label="Clear search"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </form>
              ) : null}

              {showNavigation ? (
                <div className={cn('grid gap-2', renderSearch ? 'mt-4' : '')}>
                  {navItems.map((item) => {
                    const isActive = isSiteNavItemActive(location.pathname, item);

                    return (
                      <Link
                        key={item.label}
                        to={item.to}
                        onClick={(event) => handleSamePageClick(event, item.to)}
                        className={cn(
                          'rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-[color-mix(in_srgb,var(--forest-green)_9%,white)] text-[var(--forest-green)]'
                            : 'border border-[#e4e1d8] bg-[#fffefa] text-[oklch(0.34_0.03_95)] hover:bg-[color-mix(in_srgb,var(--forest-green)_6%,white)] hover:text-[var(--forest-green)]',
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}


              <div className={cn('grid gap-2', renderSearch || showNavigation ? 'mt-4' : '')}>{desktopActionButtons}</div>
            </div>
          ) : null}
        </div>

        {showLocationBar ? (
          <div className="border-t border-[#e4e1d8] border-b bg-[#fffefa]">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-sm text-[oklch(0.35_0.03_145)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-[var(--forest-green)]" />
                <span>
                  Built for local ordering in <span className="font-semibold text-[var(--forest-green)]">{locationCity}</span>{' '}
                  <span className="text-[oklch(0.52_0.02_145)]">|</span>{' '}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/browse')}
                  className="font-medium text-[var(--forest-green)] underline underline-offset-4 hover:text-[var(--forest-green)]"
                >
                  Browse the market
                </button>
              </div>

              <span className="text-xs font-medium text-[var(--forest-green)]">Origin, seasonality, and delivery</span>
            </div>
          </div>
        ) : null}
      </header>
    </div>
  );
}
