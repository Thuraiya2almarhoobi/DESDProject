/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable RouteScrollManager component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * RouteScrollManager boundary.
 *
 * This exported unit supports the file role: Provides the reusable RouteScrollManager component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function RouteScrollManager() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  return null;
}
