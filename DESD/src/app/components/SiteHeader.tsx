import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { LogOut, MapPin, Search, ShoppingCart, Sprout, User, X } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { apiJson } from '../lib/api';
import { clearPendingCustomerPreviewExitTarget } from '../lib/customerPreview';
import { isBuyerRole } from '../lib/ordering';
import { getDashboardPathForRole } from '../lib/roleRouting';
import { getSiteNavItems, isSiteNavItemActive } from '../lib/siteNavigation';
import { Badge } from './ui/badge';
import { Button, buttonVariants } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
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

function getRoleSummary(role?: string | null): string | null {
  const normalizedRole = role?.toUpperCase();

  switch (normalizedRole) {
    case 'COMMUNITY':
      return 'Role: COMMUNITY | Bulk multi-producer ordering interface';
    case 'RESTAURANT':
      return 'Role: RESTAURANT | Recurring-order marketplace interface';
    case 'PRODUCER':
      return 'Role: PRODUCER | Manage supply, incoming orders, and settlements';
    case 'ADMIN':
      return 'Role: ADMIN | Monitor platform commissions and operations';
    default:
      return null;
  }
}

export function SiteHeader({
  showSearch = false,
  showNavigation = true,
  searchQuery = '',
  onSearchQueryChange,
  searchPlaceholder = 'Search products, producers, categories...',
  showLocationBar = false,
  locationCity = 'Bristol',
}: SiteHeaderProps) {
  const HEADER_EXPAND_THRESHOLD = 8;
  const HEADER_COLLAPSE_THRESHOLD = 96;
  const HEADER_STATE_SETTLE_MS = 220;

  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, logout, addresses, stopCustomerPreview } = useAuth();
  const { getTotalItems } = useCart();
  const headerRef = useRef<HTMLElement | null>(null);
  const collapsedStateLockUntil = useRef(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profilePostcode, setProfilePostcode] = useState('');

  const isBuyer = isBuyerRole(user?.role);
  const isProducer = user?.role === 'PRODUCER';
  const customerName = (user?.name || '').trim() || 'Customer';
  const roleSummary = getRoleSummary(user?.role);
  const navItems = useMemo(() => getSiteNavItems(user?.role), [user?.role]);
  const defaultAddressText = useMemo(() => {
    if (!addresses || addresses.length === 0) {
      return '';
    }

    const defaultAddress = addresses.find((address) => address.is_default) || addresses[0];
    return [defaultAddress.line1, defaultAddress.city, defaultAddress.postcode].filter(Boolean).join(', ');
  }, [addresses]);
  const deliveryPostcode = useMemo(() => {
    if (!addresses || addresses.length === 0) {
      return '';
    }

    const defaultAddress = addresses.find((address) => address.is_default) || addresses[0];
    return defaultAddress.postcode || '';
  }, [addresses]);
  const displayedDeliveryPostcode = deliveryPostcode || profilePostcode;
  const producerAddressId =
    typeof profile?.address === 'number'
      ? profile.address
      : typeof profile?.address === 'string'
        ? Number(profile.address)
        : null;
  const producerAddress =
    (producerAddressId ? addresses.find((address) => address.id === producerAddressId) : null) ||
    addresses.find((address) => address.is_default) ||
    addresses[0] ||
    null;
  const producerOriginPostcode = producerAddress?.postcode || '';
  const brandLinkTarget = !user
    ? '/'
    : user.role === 'ADMIN'
      ? getDashboardPathForRole(user.role)
      : '/marketplace';
  const compactActionClass = isCollapsed ? 'h-9 px-3 py-1.5' : '';
  const compactProfileButtonClass = isCollapsed ? 'min-h-9 gap-2 px-2.5 py-1.5' : 'min-h-10 gap-2 px-3 py-2';

  const buyerAddressLabel =
    user?.role === 'COMMUNITY'
      ? 'Community drop-off'
      : user?.role === 'RESTAURANT'
        ? 'Kitchen delivery'
        : 'Delivery address';

  const buyerPostcodeLabel =
    user?.role === 'COMMUNITY'
      ? 'Drop-off postcode'
      : user?.role === 'RESTAURANT'
        ? 'Kitchen postcode'
        : 'Delivering to';

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    collapsedStateLockUntil.current = 0;
    setIsCollapsed(window.scrollY > HEADER_COLLAPSE_THRESHOLD);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    let ticking = false;

    const updateHeaderState = () => {
      const currentScrollY = window.scrollY;
      const now = Date.now();

      if (now >= collapsedStateLockUntil.current) {
        setIsCollapsed((previous) => {
          const nextCollapsed = previous
            ? currentScrollY > HEADER_EXPAND_THRESHOLD
            : currentScrollY > HEADER_COLLAPSE_THRESHOLD;

          if (nextCollapsed !== previous) {
            collapsedStateLockUntil.current = now + HEADER_STATE_SETTLE_MS;
          }

          return nextCollapsed;
        });
      }
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(updateHeaderState);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isBuyer || deliveryPostcode) {
      setProfilePostcode('');
      return;
    }

    let mounted = true;

    const loadProfilePostcode = async () => {
      try {
        const payload = await apiJson<{ postcode: string }>('/api/orders/profile/');
        if (mounted) {
          setProfilePostcode(payload.postcode || '');
        }
      } catch {
        if (mounted) {
          setProfilePostcode('');
        }
      }
    };

    void loadProfilePostcode();

    return () => {
      mounted = false;
    };
  }, [deliveryPostcode, isBuyer]);

  const handleLogout = () => {
    clearPendingCustomerPreviewExitTarget();
    stopCustomerPreview();
    logout();
    navigate(user?.role === 'PRODUCER' ? '/login' : '/');
  };

  const openDeliveryProfile = () => {
    if (user?.role === 'COMMUNITY') {
      navigate('/account#organisation-profile');
      return;
    }
    navigate('/account#delivery-profile');
  };

  const openProducerProfile = () => {
    navigate('/account#business-profile');
  };

  useEffect(() => {
    if (user?.role === 'PRODUCER') {
      clearPendingCustomerPreviewExitTarget();
      stopCustomerPreview();
    }
  }, [stopCustomerPreview, user?.role]);

  const compactHeaderRow = (
    <div
      className={cn(
        'flex flex-col justify-between gap-4 transition-[gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex-row',
        isCollapsed ? 'lg:items-center' : 'lg:items-start',
      )}
    >
      <Link to={brandLinkTarget} className={cn('flex items-start gap-3', isCollapsed && 'items-center gap-2.5')}>
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.45_0.12_155)] to-[oklch(0.55_0.10_150)] shadow-sm transition-[width,height,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            isCollapsed ? 'size-9 rounded-[1.1rem]' : 'size-11',
          )}
        >
          <Sprout className="size-5 text-white" />
        </div>
        <div>
          <h1
            className={cn(
              'font-semibold text-[oklch(0.24_0.03_145)] transition-[font-size,line-height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              isCollapsed ? 'text-lg leading-none sm:text-xl' : 'text-2xl',
            )}
          >
            Local Food Marketplace
          </h1>
          {!isCollapsed && (
            <>
              <p className="text-sm text-[oklch(0.38_0.03_145)]">
                {!user ? 'Browse first, then sign in when you are ready to order.' : `Signed in as ${customerName}`}
              </p>
              {roleSummary && <p className="text-xs text-[oklch(0.43_0.03_145)]">{roleSummary}</p>}
              {isBuyer && defaultAddressText && (
                <p className="max-w-[24rem] truncate text-xs text-[oklch(0.43_0.03_145)]">
                  {buyerAddressLabel}: {defaultAddressText}
                </p>
              )}
              {isProducer && producerAddress && (
                <p className="max-w-[24rem] truncate text-xs text-[oklch(0.43_0.03_145)]">
                  Dispatch postcode: {producerAddress.postcode}
                </p>
              )}
            </>
          )}
        </div>
      </Link>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {isBuyer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openDeliveryProfile}
            className={cn('h-auto items-start text-left', compactProfileButtonClass, isCollapsed && 'items-center')}
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-[oklch(0.38_0.04_145)]" />
            <span className="flex flex-col leading-tight">
              {!isCollapsed && (
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[oklch(0.46_0.03_145)]">
                  {buyerPostcodeLabel}
                </span>
              )}
              <span className="max-w-[8rem] truncate text-sm font-semibold text-[oklch(0.24_0.03_145)]">
                {displayedDeliveryPostcode || 'Set postcode'}
              </span>
            </span>
          </Button>
        )}

        {isProducer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={openProducerProfile}
            className={cn('h-auto items-start text-left', compactProfileButtonClass, isCollapsed && 'items-center')}
          >
            <MapPin className="mt-0.5 size-4 shrink-0 text-[oklch(0.38_0.04_145)]" />
            <span className="flex flex-col leading-tight">
              {!isCollapsed && (
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[oklch(0.46_0.03_145)]">
                  Delivering from
                </span>
              )}
              <span className="max-w-[8rem] truncate text-sm font-semibold text-[oklch(0.24_0.03_145)]">
                {producerOriginPostcode || 'Set postcode'}
              </span>
            </span>
          </Button>
        )}

        {isBuyer && (
          <Button variant="outline" size="sm" onClick={() => navigate('/cart')} className={cn('relative', compactActionClass)}>
            <ShoppingCart className="size-4 sm:mr-2" />
            <span className="hidden sm:inline">{user?.role === 'CUSTOMER' ? 'Cart' : 'Order Cart'}</span>
            {getTotalItems() > 0 && (
              <Badge className="ml-2 flex h-5 min-w-5 items-center justify-center px-1.5">{getTotalItems()}</Badge>
            )}
          </Button>
        )}

        {!user && (
          <>
            <Button asChild variant="ghost" size="sm" className={compactActionClass}>
              <Link to="/portal/producer">Producer Portal</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={compactActionClass}>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm" className={compactActionClass}>
              <Link to="/select-portal?mode=register">Sign Up</Link>
            </Button>
          </>
        )}

        {user && (
          <>
            <Button variant="ghost" size="sm" onClick={handleLogout} className={compactActionClass}>
              <LogOut className="size-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                aria-label="Open account menu"
                className={`${buttonVariants({ variant: 'ghost', size: 'sm' })} focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2`}
              >
                <User className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Hello, {customerName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {isBuyer ? (
                  <>
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate('/account')}>Account Information</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings')}>Settings</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/orders/history')}>Order History</DropdownMenuItem>
                    {user.role !== 'CUSTOMER' && (
                      <DropdownMenuItem onClick={() => navigate(getDashboardPathForRole(user.role))}>
                        Go to Dashboard
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Explore</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigate('/map')}>Producers Near Me</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/content/feed')}>Recipes & Stories</DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/account')}>Account Information</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(getDashboardPathForRole(user.role))}>
                      Go to Dashboard
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );

  const primaryNav = (
    <div className="overflow-x-auto pb-1">
      <nav
        aria-label="Primary"
        className="inline-flex min-w-max max-w-full flex-wrap items-center gap-2 rounded-[1.5rem] border border-[oklch(0.88_0.02_145)] bg-[oklch(0.985_0.008_145)] p-2 shadow-sm"
      >
        {navItems.map((item) => {
          const isActive = isSiteNavItemActive(location.pathname, item);

          return (
            <Link
              key={item.label}
              to={item.to}
              className={cn(
                'inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[oklch(0.94_0.05_145)] text-[oklch(0.28_0.06_145)] shadow-sm'
                  : 'text-[oklch(0.4_0.03_145)] hover:bg-white hover:text-[oklch(0.28_0.04_145)]',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  const collapsedSearchBrand = (
    <Link
      to={brandLinkTarget}
      className="flex shrink-0 items-center gap-2 rounded-2xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.985_0.008_145)] px-2.5 py-2 shadow-sm"
      aria-label="Go to marketplace home"
    >
      <div className="flex size-8 items-center justify-center rounded-[1rem] bg-gradient-to-br from-[oklch(0.45_0.12_155)] to-[oklch(0.55_0.10_150)] shadow-sm">
        <Sprout className="size-4 text-white" />
      </div>
      <span className="hidden text-sm font-semibold text-[oklch(0.24_0.03_145)] sm:inline">Local Food Marketplace</span>
    </Link>
  );

  const searchInput = (
    <div className="relative min-w-0 flex-1">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id="marketplace-search"
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(event) => onSearchQueryChange?.(event.target.value)}
        className="pl-10 pr-10"
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => onSearchQueryChange?.('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );

  return (
    <header
      ref={headerRef}
      style={{ overflowAnchor: 'none' }}
      className="sticky top-0 z-30 border-b border-[oklch(0.88_0.02_145)] bg-white/84 shadow-sm backdrop-blur-sm"
    >
      <div className="mx-auto max-w-7xl px-4">
        {showSearch ? (
          <div
            className={cn(
              'space-y-3 transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              isCollapsed ? 'py-2' : 'py-3',
            )}
          >
            <div
              className={cn(
                'overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                isCollapsed ? 'max-h-0 -translate-y-1 opacity-0' : 'max-h-[12rem] translate-y-0 opacity-100',
              )}
              aria-hidden={isCollapsed}
            >
              <div className="pb-1 pt-1">{compactHeaderRow}</div>
            </div>

            <div
              className={cn(
                'transition-[gap] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                isCollapsed ? 'flex items-center gap-3' : 'block',
              )}
            >
              {isCollapsed && collapsedSearchBrand}
              {searchInput}
            </div>

            {showNavigation && (
              <div
                className={cn(
                  'overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  isCollapsed ? 'max-h-0 -translate-y-1 opacity-0' : 'max-h-32 translate-y-0 opacity-100',
                )}
                aria-hidden={isCollapsed}
              >
                {primaryNav}
              </div>
            )}
          </div>
        ) : (
          <div
            className={cn(
              'transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              isCollapsed ? 'py-2' : 'py-4',
            )}
          >
            {compactHeaderRow}
            {showNavigation && (
              <div
                className={cn(
                  'overflow-hidden transition-[max-height,opacity,transform,padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  isCollapsed ? 'max-h-0 -translate-y-1 pt-0 opacity-0' : 'max-h-[10rem] translate-y-0 pt-4 opacity-100',
                )}
                aria-hidden={isCollapsed}
              >
                {primaryNav}
              </div>
            )}
          </div>
        )}
      </div>

      {showLocationBar && (
        <div className="border-t border-[oklch(0.9_0.02_145)] border-b bg-[#f4f9f5]">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-sm text-[oklch(0.35_0.03_145)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#1a5c35]" />
              <span>
                Showing producers near <span className="font-semibold text-[#1a5c35]">{locationCity}</span>{' '}
                <span className="text-[oklch(0.52_0.02_145)]">.</span>{' '}
              </span>
              <button
                type="button"
                onClick={() => navigate('/browse')}
                className="font-medium text-[#1a5c35] underline underline-offset-4 hover:text-[#154a2a]"
              >
                Change location
              </button>
            </div>

            <span className="text-xs font-medium text-[#1a5c35]">Browse freely - no account needed</span>
          </div>
        </div>
      )}
    </header>
  );
}
