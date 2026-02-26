import { MapPin, Calendar, Truck } from 'lucide-react';
import { format, isThisWeek } from 'date-fns';

interface ProductMetaProps {
  producerName: string;
  producerLocation: string;
  harvestDate: string;
  foodMiles: number;
  seasonalDates?: string;
  compact?: boolean;
}

export function ProductMeta({ producerName, producerLocation, harvestDate, foodMiles, seasonalDates, compact = false }: ProductMetaProps) {
  const harvestDateObj = new Date(harvestDate);
  const harvestedThisWeek = isThisWeek(harvestDateObj);
  
  if (compact) {
    // Compact version for cards
    return (
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <MapPin className="size-3" />
          <span>{producerLocation} • {foodMiles} km</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="size-3" />
          <span>
            {harvestedThisWeek 
              ? 'Harvested this week' 
              : `Harvested ${format(harvestDateObj, 'MMM d')}`}
          </span>
        </div>
        {seasonalDates && (
          <div className="text-xs text-green-700 font-medium">
            Available: {seasonalDates}
          </div>
        )}
      </div>
    );
  }

  // Full version for detail pages
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
      <div className="flex items-center gap-1.5">
        <MapPin className="size-4" />
        <span>{producerName} • {producerLocation}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Calendar className="size-4" />
        <span>Harvested {format(harvestDateObj, 'MMM d, yyyy')}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Truck className="size-4" />
        <span>{foodMiles} km</span>
      </div>
    </div>
  );
}