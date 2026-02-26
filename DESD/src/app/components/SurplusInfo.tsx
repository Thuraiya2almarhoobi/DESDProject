import { Clock, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui/badge';

interface SurplusInfoProps {
  discount: number;
  originalPrice: number;
  currentPrice: number;
  expiresAt: string;
  bestBefore: string;
  unit: string;
}

export function SurplusInfo({ discount, originalPrice, currentPrice, expiresAt, bestBefore, unit }: SurplusInfoProps) {
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const hoursUntilExpiry = Math.max(0, (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60));

  return (
    <div className="space-y-2">
      {/* Discount and Price */}
      <div className="flex items-center gap-2">
        <Badge variant="destructive" className="text-xs font-semibold">
          {discount}% off
        </Badge>
        <span className="text-xs text-gray-500 line-through">
          £{originalPrice.toFixed(2)}/{unit}
        </span>
      </div>

      {/* Urgency Timer */}
      <div className="flex items-center gap-1.5 text-xs text-orange-600">
        <Clock className="size-3" />
        <span className="font-medium">
          Ends in: {hoursUntilExpiry < 1 
            ? `${Math.round(hoursUntilExpiry * 60)} min` 
            : `${Math.round(hoursUntilExpiry)}h`}
        </span>
      </div>

      {/* Best Before */}
      <div className="flex items-center gap-1.5 text-xs text-gray-600">
        <Calendar className="size-3" />
        <span>Best before: {bestBefore}</span>
      </div>
    </div>
  );
}
