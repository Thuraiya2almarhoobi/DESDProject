import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface AllergenBlockProps {
  allergens: string[];
}

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
