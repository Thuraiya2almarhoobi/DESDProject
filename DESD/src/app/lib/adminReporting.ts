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
