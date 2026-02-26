import { MapPin, Navigation } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';

interface FarmLocationMapProps {
  producerName: string;
  location: string;
  postcode?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  foodMiles: number;
}

export function FarmLocationMap({ 
  producerName, 
  location, 
  postcode, 
  coordinates,
  foodMiles 
}: FarmLocationMapProps) {
  // Generate Google Maps Static API URL
  // Using a placeholder style - in production, you'd use an actual API key
  const getMapUrl = () => {
    if (!coordinates) return null;
    
    // Google Maps Static API URL format
    // Note: This is a demo URL - in production, replace with actual API key
    const { lat, lng } = coordinates;
    const zoom = 12;
    const size = '600x300';
    const markerColor = '0x16a34a'; // Green color
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=color:${markerColor}%7C${lat},${lng}&key=YOUR_API_KEY`;
  };

  const mapUrl = getMapUrl();

  // Fallback to OpenStreetMap tile for demo (doesn't need API key)
  const getOpenStreetMapUrl = () => {
    if (!coordinates) return null;
    const { lat, lng } = coordinates;
    const zoom = 12;
    // Using staticmap service as a demo alternative
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=600x300&markers=${lat},${lng},green`;
  };

  const demoMapUrl = getOpenStreetMapUrl();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Map Image */}
        <div className="relative aspect-[2/1] bg-gradient-to-br from-green-100 to-green-50">
          {demoMapUrl ? (
            <img 
              src={demoMapUrl}
              alt={`Map showing ${producerName} location`}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to a styled placeholder
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          
          {/* Overlay with farm info */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="size-5" />
                  <h3 className="font-semibold text-lg">{producerName}</h3>
                </div>
                <p className="text-sm text-white/90">{location}</p>
                {postcode && (
                  <p className="text-xs text-white/80 mt-1">{postcode}</p>
                )}
              </div>
              
              <Badge className="bg-green-600 hover:bg-green-700 border-0">
                <Navigation className="size-3 mr-1" />
                {foodMiles} miles
              </Badge>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="p-4 bg-green-50/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-green-700">
              <MapPin className="size-4" />
              <span className="font-medium">Farm Location</span>
            </div>
            {coordinates && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-700 underline text-xs"
              >
                Open in Google Maps →
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
