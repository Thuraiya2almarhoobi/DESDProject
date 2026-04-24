import { Link } from 'react-router';
import { ExternalLink, Sprout } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';
import { getSiteNavItems } from '../lib/siteNavigation';

export function SiteFooter() {
  const { user } = useAuth();
  const navItems = getSiteNavItems(user?.role);
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-[#e4e1d8] bg-[#fffefa]/95 backdrop-blur-sm">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--forest-green)] shadow-sm">
              <Sprout className="size-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--forest-green)]">
                Local Food Marketplace
              </p>
              <p className="text-sm text-[oklch(0.34_0.03_95)]">
                Fresh produce, coordinated deliveries, and producer-first trading in one place.
              </p>
            </div>
          </div>
          <p className="max-w-xl text-sm leading-6 text-[oklch(0.4_0.03_95)]">
            Built for customers, producers, restaurants, and community buyers who need a clear local-food ordering flow.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-[oklch(0.28_0.03_95)]">Explore</p>
          <div className="flex flex-col gap-2 text-sm text-[oklch(0.38_0.03_95)]">
            {navItems.map((item) => (
              <Link key={item.label} to={item.to} className="transition-colors hover:text-[var(--forest-green)]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-[oklch(0.28_0.03_95)]">Access</p>
          <div className="flex flex-col gap-2 text-sm text-[oklch(0.38_0.03_95)]">
            <Link to="/select-portal" className="transition-colors hover:text-[var(--forest-green)]">
              Role Portal
            </Link>
            <Link to="/login" className="transition-colors hover:text-[var(--forest-green)]">
              Sign In
            </Link>
            <Link to="/select-portal?mode=register" className="transition-colors hover:text-[var(--forest-green)]">
              Create Account
            </Link>
            <Link
              to="/portal/producer"
              className="inline-flex items-center gap-2 transition-colors hover:text-[var(--forest-green)]"
            >
              Producer Portal
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-[#e4e1d8] bg-[#fbfaf4]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-[oklch(0.44_0.03_95)] sm:flex-row sm:items-center sm:justify-between">
          <p>{currentYear} Local Food Marketplace. Local sourcing, lower food miles, clearer ordering.</p>
          <p>Bristol network ordering for households, kitchens, and community buyers.</p>
        </div>
      </div>
    </footer>
  );
}
