import { Link, useLocation } from 'react-router';
import { ExternalLink, Sprout } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { getSiteNavItems } from '../lib/siteNavigation';

export function SiteFooter() {
  const location = useLocation();
  const { user } = useAuth();
  const navItems = getSiteNavItems(user?.role);
  const currentYear = new Date().getFullYear();

  if (location.pathname === '/') {
    return null;
  }

  return (
    <footer className="border-t border-[oklch(0.88_0.02_145)] bg-white/92 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[oklch(0.45_0.12_155)] to-[oklch(0.55_0.10_150)] shadow-sm">
              <Sprout className="size-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[oklch(0.42_0.05_145)] uppercase">
                Local Food Marketplace
              </p>
              <p className="text-sm text-[oklch(0.34_0.03_145)]">
                Fresh produce, coordinated deliveries, and producer-first trading in one place.
              </p>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[oklch(0.4_0.03_145)]">
            Built for customers, producers, restaurants, and community buyers who need a clear local-food ordering flow.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-[0.14em] text-[oklch(0.32_0.03_145)] uppercase">Explore</p>
          <div className="flex flex-col gap-2 text-sm text-[oklch(0.38_0.03_145)]">
            {navItems.map((item) => (
              <Link key={item.label} to={item.to} className="transition-colors hover:text-[oklch(0.28_0.06_145)]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-[0.14em] text-[oklch(0.32_0.03_145)] uppercase">Access</p>
          <div className="flex flex-col gap-2 text-sm text-[oklch(0.38_0.03_145)]">
            <Link to="/select-portal" className="transition-colors hover:text-[oklch(0.28_0.06_145)]">
              Role Portal
            </Link>
            <Link to="/login" className="transition-colors hover:text-[oklch(0.28_0.06_145)]">
              Sign In
            </Link>
            <Link to="/select-portal?mode=register" className="transition-colors hover:text-[oklch(0.28_0.06_145)]">
              Create Account
            </Link>
            <Link
              to="/portal/producer"
              className="inline-flex items-center gap-2 transition-colors hover:text-[oklch(0.28_0.06_145)]"
            >
              Producer Portal
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-[oklch(0.9_0.02_145)] bg-[oklch(0.985_0.006_145)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-[oklch(0.44_0.03_145)] sm:flex-row sm:items-center sm:justify-between">
          <p>{currentYear} Local Food Marketplace. Local sourcing, lower food miles, clearer ordering.</p>
          <p>Bristol network ordering for households, kitchens, and community buyers.</p>
        </div>
      </div>
    </footer>
  );
}
