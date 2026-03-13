import { MapPin, Navigation } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { getGoogleMapsEmbedUrl, getGoogleMapsSearchUrl } from '../lib/googleMaps';

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
  const embedUrl = getGoogleMapsEmbedUrl(coordinates, 12);
  const openInMapsUrl = getGoogleMapsSearchUrl(coordinates);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="relative aspect-[2/1] bg-gradient-to-br from-green-100 to-green-50">
          {embedUrl ? (
            <iframe
              title={`Map showing ${producerName} location`}
              src={embedUrl}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-green-900">
              Google Maps is unavailable right now. The producer location details are still shown below.
            </div>
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-4 text-white">
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
            {openInMapsUrl && (
              <a
                href={openInMapsUrl}
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
