/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for adminReporting concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { format, subDays } from 'date-fns';

const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

export function getDefaultAdminDateRange() {
  const today = new Date();

  return {
    dateFrom: format(subDays(today, 14), 'yyyy-MM-dd'),
    dateTo: format(today, 'yyyy-MM-dd'),
  };
}

export function formatAdminCurrency(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return gbpFormatter.format(Number.isFinite(amount) ? amount : 0);
}

export function formatAdminDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, 'yyyy-MM-dd');
}
