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

export function formatPercentRate(value: number | string | null | undefined): string {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return '0%';
  }
  // backend can send rates as decimals or whole percents
  const percentValue = numericValue > 1 ? numericValue : numericValue * 100;
  return `${Number.isInteger(percentValue) ? percentValue.toFixed(0) : percentValue.toFixed(2)}%`;
}
