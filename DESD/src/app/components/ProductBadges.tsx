import { Badge } from './ui/badge';
import { AvailabilityType } from '../types';

interface AvailabilityBadgeProps {
  availability: AvailabilityType;
}

export function AvailabilityBadge({ availability }: AvailabilityBadgeProps) {
  const variants: Record<AvailabilityType, { label: string; className: string }> = {
    'in-season': { label: 'In Season', className: 'bg-[oklch(0.55_0.10_150)] hover:bg-[oklch(0.50_0.12_150)] text-white' },
    'year-round': { label: 'Year-round', className: 'bg-[oklch(0.68_0.08_145)] hover:bg-[oklch(0.63_0.10_145)] text-white' },
    'unavailable': { label: 'Unavailable', className: 'bg-[oklch(0.60_0.02_150)] hover:bg-[oklch(0.55_0.02_150)] text-white' },
  };

  const { label, className } = variants[availability];

  return (
    <Badge className={className}>
      {label}
    </Badge>
  );
}

export function OrganicBadge() {
  return (
    <Badge className="bg-[oklch(0.45_0.12_155)] hover:bg-[oklch(0.40_0.14_155)] text-white">
      Organic
    </Badge>
  );
}

export function SurplusBadge() {
  return (
    <Badge variant="outline" className="border-[oklch(0.68_0.18_55)] text-[oklch(0.50_0.18_55)] bg-[oklch(0.95_0.05_55)]">
      Surplus Deal
    </Badge>
  );
}