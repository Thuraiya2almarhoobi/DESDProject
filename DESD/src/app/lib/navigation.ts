/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for navigation concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useNavigate } from 'react-router';

/**
 * useSafeBack boundary.
 *
 * This exported unit supports the file role: Contains reusable helper functions for navigation concerns across the frontend.
 * It belongs to: Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function useSafeBack(fallbackPath: string) {
  const navigate = useNavigate();

  return () => {
    if (typeof window !== 'undefined') {
      const historyState = window.history.state as { idx?: number } | null;
      if (typeof historyState?.idx === 'number' && historyState.idx > 0) {
        navigate(-1);
        return;
      }
    }

    navigate(fallbackPath, { replace: true });
  };
}
