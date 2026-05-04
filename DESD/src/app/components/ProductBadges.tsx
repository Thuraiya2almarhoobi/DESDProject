/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable ProductBadges component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { Badge } from './ui/badge';
import { AvailabilityType } from '../types';

interface AvailabilityBadgeProps {
  availability: AvailabilityType;
}

/**
 * AvailabilityBadge boundary.
 *
 * This exported unit supports the file role: Provides the reusable ProductBadges component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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

/**
 * OrganicBadge boundary.
 *
 * This exported unit supports the file role: Provides the reusable ProductBadges component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function OrganicBadge() {
  return (
    <Badge className="bg-[oklch(0.45_0.12_155)] hover:bg-[oklch(0.40_0.14_155)] text-white">
      Organic
    </Badge>
  );
}

/**
 * SurplusBadge boundary.
 *
 * This exported unit supports the file role: Provides the reusable ProductBadges component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function SurplusBadge() {
  return (
    <Badge variant="outline" className="border-[oklch(0.68_0.18_55)] text-[oklch(0.50_0.18_55)] bg-[oklch(0.95_0.05_55)]">
      Surplus Deal
    </Badge>
  );
}
