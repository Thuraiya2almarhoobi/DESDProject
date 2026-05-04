/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable AllergenBlock component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface AllergenBlockProps {
  allergens: string[];
}

/**
 * AllergenBlock boundary.
 *
 * This exported unit supports the file role: Provides the reusable AllergenBlock component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function AllergenBlock({ allergens }: AllergenBlockProps) {
  if (allergens.length === 0) {
    return (
      <Alert className="border border-green-200 bg-green-50 text-green-900">
        <AlertTriangle className="size-5 text-green-700" />
        <AlertTitle>No common allergens</AlertTitle>
        <AlertDescription>
          This product does not list any common allergens.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="border-2">
      <AlertTriangle className="size-5" />
      <AlertTitle>Allergen Warning</AlertTitle>
      <AlertDescription>
        Contains: <strong>{allergens.join(', ')}</strong>
      </AlertDescription>
    </Alert>
  );
}
