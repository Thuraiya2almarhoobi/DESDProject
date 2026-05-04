/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable AppShell component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { Outlet } from 'react-router';

import { RouteScrollManager } from './RouteScrollManager';

/**
 * AppShell boundary.
 *
 * This exported unit supports the file role: Provides the reusable AppShell component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function AppShell() {
  return (
    <>
      <RouteScrollManager />
      <Outlet />
    </>
  );
}
