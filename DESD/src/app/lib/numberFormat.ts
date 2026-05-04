/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for numberFormat concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

export function formatCompactNumber(value: number | string | null | undefined): string {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return '0';
  }

  return new Intl.NumberFormat('en-GB', {
    notation: 'compact',
    maximumFractionDigits: numericValue >= 1000 && numericValue < 10000 ? 1 : 0,
  }).format(numericValue);
}
