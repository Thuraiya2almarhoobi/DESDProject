import type { FormEvent, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { LogOut, MapPin, Menu, Search, ShoppingCart, Sprout, User, X } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { formatDisplayPostcode, getPreferredAddress, getRoleLabel } from '../lib/accountLocation';
import { useCart } from '../contexts/CartContext';
import { clearPendingCustomerPreviewExitTarget } from '../lib/customerPreview';
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
  showLocationBar?: boolean;
  locationCity?: string;
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

export function SiteHeader({
  showSearch = false,
  showNavigation = true,
  searchQuery = '',
  onSearchQueryChange,
  searchPlaceholder = 'Search produce, farms, or categories…',
  showLocationBar = false,
  locationCity = 'Bristol',
}: SiteHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, addresses, logout, stopCustomerPreview } = useAuth();
  const { getTotalItems } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

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
    !user || isMarketingSurface || user.role === 'ADMIN' ? '/browse' : '/marketplace';
  const searchValue = onSearchQueryChange ? searchQuery : localSearchQuery;
  const cartItemCount = getTotalItems();
  const preferredAddress = useMemo(
    () => (user ? getPreferredAddress(user.role, profile, addresses) : null),
    [addresses, profile, user],
  );
  const userPostcode = formatDisplayPostcode(preferredAddress?.postcode);
  const signedInRoleLabel = getRoleLabel(user?.role);
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
    if (onSearchQueryChange) {
      return;
    }

    const queryFromUrl = new URLSearchParams(location.search).get('q') || '';
    setLocalSearchQuery(queryFromUrl);
  }, [location.search, onSearchQueryChange]);

  const updateSearchValue = (value: string) => {
    if (onSearchQueryChange) {
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
    const nextPath = nextQuery ? `${searchTargetPath}?q=${encodeURIComponent(nextQuery)}` : searchTargetPath;
    navigate(nextPath);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    clearPendingCustomerPreviewExitTarget();
    stopCustomerPreview();
    logout();
    navigate('/');
  };

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
                {cartItemCount}
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
                      <span className="font-medium text-[var(--forest-green)]">{user.name}</span>
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
                    <span className="font-medium text-[var(--forest-green)]">{user.name}</span>
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

          {isAuthenticated ? (
            <div className="border-t border-[oklch(0.9_0.02_145)] py-2 md:hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[oklch(0.42_0.03_145)]">
                <div className="min-w-0 truncate pl-12">
                  <span className="font-medium text-[var(--forest-green)]">{user.name}</span>
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

              <span className="text-xs font-medium text-[var(--forest-green)]">Origin, seasonality, and delivery context stay visible</span>
            </div>
          </div>
        ) : null}
      </header>
    </div>
  );
}






