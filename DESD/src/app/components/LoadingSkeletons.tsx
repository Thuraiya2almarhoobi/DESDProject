/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable LoadingSkeletons component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

interface LoadingSkeletonProps {
  rows?: number;
  cards?: number;
}

/**
 * PageLoadingSkeleton boundary.
 *
 * This exported unit supports the file role: Provides the reusable LoadingSkeletons component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function PageLoadingSkeleton({ rows = 3, cards = 3 }: LoadingSkeletonProps) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <Card key={index} className="border-[#e4e1d8] bg-[#fffefa] shadow-sm">
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-4 w-24 bg-[color-mix(in_srgb,var(--forest-green)_10%,white)]" />
              <Skeleton className="h-8 w-20 bg-[color-mix(in_srgb,var(--forest-green)_14%,white)]" />
              <Skeleton className="h-3 w-full bg-[#ece8df]" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-[#e4e1d8] bg-[#fffefa] shadow-sm">
        <CardContent className="space-y-4 p-5">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-[#eeeae1] bg-white/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-5 w-48 max-w-[70%] bg-[color-mix(in_srgb,var(--forest-green)_12%,white)]" />
                <Skeleton className="h-8 w-24 bg-[#ece8df]" />
              </div>
              <Skeleton className="h-3 w-full bg-[#ece8df]" />
              <Skeleton className="h-3 w-5/6 bg-[#ece8df]" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * FeedLoadingSkeleton boundary.
 *
 * This exported unit supports the file role: Provides the reusable LoadingSkeletons component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function FeedLoadingSkeleton({ rows = 4 }: Pick<LoadingSkeletonProps, 'rows'>) {
  return (
    <div className="grid gap-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index} className="border-[#e4e1d8] bg-[#fffefa] shadow-sm">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[8rem_1fr]">
            <Skeleton className="aspect-square w-full rounded-xl bg-[color-mix(in_srgb,var(--forest-green)_10%,white)]" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-2/3 bg-[color-mix(in_srgb,var(--forest-green)_12%,white)]" />
              <Skeleton className="h-3 w-1/3 bg-[#ece8df]" />
              <Skeleton className="h-3 w-full bg-[#ece8df]" />
              <Skeleton className="h-3 w-5/6 bg-[#ece8df]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
