import type { FormEvent, MouseEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { LogOut, MapPin, Menu, Search, ShoppingCart, Sprout, User, X } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
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
  return role === 'CUSTOMER' || role === 'COMMUNITY' || role === 'RESTAURANT';
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
  const { user, logout, stopCustomerPreview } = useAuth();
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

  useEffect(() => {
    if (user?.role === 'PRODUCER') {
      clearPendingCustomerPreviewExitTarget();
      stopCustomerPreview();
    }
  }, [stopCustomerPreview, user?.role]);

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
      <Button
        asChild
        variant="outline"
        size="sm"
        className="border-[#1a5c35] text-[#1a5c35] hover:bg-[#f4f9f5] hover:text-[#1a5c35]"
      >
        <Link to="/portal/producer">Producer portal</Link>
      </Button>
      <Button asChild variant="ghost" size="sm" className="text-[#1a5c35] hover:bg-[#f4f9f5]">
        <Link to="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm" className="bg-[#1a5c35] text-white hover:bg-[#154a2a]">
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
          className="border-[#1a5c35] text-[#1a5c35] hover:bg-[#f4f9f5] hover:text-[#1a5c35]"
        >
          <Link to="/cart">
            <ShoppingCart className="size-4" />
            Cart
            {cartItemCount > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#1a5c35] px-1.5 py-0.5 text-[11px] font-semibold text-white">
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
          className="border-[#1a5c35] text-[#1a5c35] hover:bg-[#f4f9f5] hover:text-[#1a5c35]"
        >
          <Link to={getDashboardPathForRole(user.role)}>Dashboard</Link>
        </Button>
      )}
      <Button asChild variant="ghost" size="sm" className="text-[#1a5c35] hover:bg-[#f4f9f5]">
        <Link to="/account">
          <User className="size-4" />
          Account
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        onClick={handleLogout}
        className="bg-[#1a5c35] text-white hover:bg-[#154a2a]"
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </>
  );

  return (
    <div className="sticky top-0 z-30 border-b border-[oklch(0.88_0.02_145)] bg-white/95 shadow-sm backdrop-blur-sm">
      <header>
        <div className="mx-auto max-w-7xl px-4">
          <div className="hidden h-[60px] items-center gap-4 md:flex">
            <Link
              to={brandLinkTarget}
              className="flex shrink-0 items-center gap-3 text-[#1a5c35]"
              onClick={(event) => handleSamePageClick(event, brandLinkTarget)}
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#1a5c35] shadow-sm">
                <Sprout className="size-4 text-white" />
              </div>
              <span className="text-base font-semibold tracking-tight">Local Food Marketplace</span>
            </Link>

            <div className="h-6 w-px shrink-0 bg-[oklch(0.88_0.02_145)]" />

            {showNavigation ? (
              <nav aria-label="Primary" className="flex shrink-0 items-center gap-1 overflow-x-auto">
                {navItems.map((item) => {
                  const isActive = isSiteNavItemActive(location.pathname, item);

                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={(event) => handleSamePageClick(event, item.to)}
                      className={cn(
                        'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-[#edf6ef] text-[#1a5c35]'
                          : 'text-[oklch(0.38_0.03_145)] hover:bg-[#f4f9f5] hover:text-[#1a5c35]',
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            {renderSearch ? (
              <form onSubmit={handleSearchSubmit} className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[oklch(0.45_0.03_145)]" />
                <Input
                  value={searchValue}
                  onChange={(event) => updateSearchValue(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 rounded-full border-[oklch(0.88_0.02_145)] bg-white pl-10 pr-10 shadow-none focus-visible:border-[#1a5c35] focus-visible:ring-[#1a5c35]/15"
                />
                {searchValue ? (
                  <button
                    type="button"
                    onClick={() => updateSearchValue('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.45_0.03_145)] transition-colors hover:text-[#1a5c35]"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </form>
            ) : (
              <div className="flex-1" />
            )}

            <div className="flex shrink-0 items-center justify-end gap-2">{desktopActionButtons}</div>
          </div>

          <div className="flex h-[60px] items-center justify-between gap-3 md:hidden">
            <Link
              to={brandLinkTarget}
              className="flex min-w-0 items-center gap-3 text-[#1a5c35]"
              onClick={(event) => handleSamePageClick(event, brandLinkTarget)}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1a5c35] shadow-sm">
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
              className="text-[#1a5c35] hover:bg-[#f4f9f5]"
            >
              {isMobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>

          {isMobileMenuOpen ? (
            <div className="border-t border-[oklch(0.9_0.02_145)] py-4 md:hidden">
              {renderSearch ? (
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[oklch(0.45_0.03_145)]" />
                  <Input
                    value={searchValue}
                    onChange={(event) => updateSearchValue(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-10 rounded-full border-[oklch(0.88_0.02_145)] bg-white pl-10 pr-10 shadow-none focus-visible:border-[#1a5c35] focus-visible:ring-[#1a5c35]/15"
                  />
                  {searchValue ? (
                    <button
                      type="button"
                      onClick={() => updateSearchValue('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[oklch(0.45_0.03_145)] transition-colors hover:text-[#1a5c35]"
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
                            ? 'bg-[#edf6ef] text-[#1a5c35]'
                            : 'border border-[oklch(0.9_0.02_145)] bg-white text-[oklch(0.34_0.03_145)] hover:bg-[#f4f9f5] hover:text-[#1a5c35]',
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
          <div className="border-t border-[oklch(0.9_0.02_145)] border-b bg-[#f4f9f5]">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-sm text-[oklch(0.35_0.03_145)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-[#1a5c35]" />
                <span>
                  Showing producers near <span className="font-semibold text-[#1a5c35]">{locationCity}</span>{' '}
                  <span className="text-[oklch(0.52_0.02_145)]">·</span>{' '}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/browse')}
                  className="font-medium text-[#1a5c35] underline underline-offset-4 hover:text-[#154a2a]"
                >
                  Change location
                </button>
              </div>

              <span className="text-xs font-medium text-[#1a5c35]">Browse freely — no account needed</span>
            </div>
          </div>
        ) : null}
      </header>
    </div>
  );
}
