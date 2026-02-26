import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface AllergenBlockProps {
  allergens: string[];
}

export function AllergenBlock({ allergens }: AllergenBlockProps) {
  if (allergens.length === 0) {
    return null;
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
