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
