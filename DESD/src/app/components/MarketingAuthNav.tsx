/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable MarketingAuthNav component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { SiteHeader } from './SiteHeader';

type MarketingAuthNavProps = {
  active?: 'login' | 'register' | null;
};

/**
 * MarketingAuthNav boundary.
 *
 * This exported unit supports the file role: Provides the reusable MarketingAuthNav component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function MarketingAuthNav({ active: _active = null }: MarketingAuthNavProps) {
  return <SiteHeader />;
}
