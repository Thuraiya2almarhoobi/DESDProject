const GOOGLE_MAPS_EMBED_BASE = 'https://www.google.com/maps/embed/v1/place';
const GOOGLE_MAPS_DIRECTIONS_EMBED_BASE = 'https://www.google.com/maps/embed/v1/directions';
const GOOGLE_MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';
const GOOGLE_MAPS_DIRECTIONS_BASE = 'https://www.google.com/maps/dir/';

export function getGoogleMapsApiKey(): string {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
}

export function getGoogleMapsEmbedUrl(coordinates?: { lat: number; lng: number }, zoom = 12): string | null {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || !coordinates) {
    return null;
  }

  const params = new URLSearchParams({
    key: apiKey,
    q: `${coordinates.lat},${coordinates.lng}`,
    zoom: String(zoom),
  });

  return `${GOOGLE_MAPS_EMBED_BASE}?${params.toString()}`;
}

export function getGoogleMapsSearchUrl(coordinates?: { lat: number; lng: number }): string | null {
  if (!coordinates) {
    return null;
  }

  const params = new URLSearchParams({
    api: '1',
    query: `${coordinates.lat},${coordinates.lng}`,
  });

  return `${GOOGLE_MAPS_SEARCH_BASE}?${params.toString()}`;
}

export function getGoogleMapsDirectionsEmbedUrl(
  origin?: string,
  destination?: string,
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
): string | null {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey || !origin?.trim() || !destination?.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    key: apiKey,
    origin: origin.trim(),
    destination: destination.trim(),
    mode,
  });

  return `${GOOGLE_MAPS_DIRECTIONS_EMBED_BASE}?${params.toString()}`;
}

export function getGoogleMapsDirectionsUrl(
  origin?: string,
  destination?: string,
  mode: 'driving' | 'walking' | 'bicycling' | 'transit' = 'driving',
): string | null {
  if (!origin?.trim() || !destination?.trim()) {
    return null;
  }

  const params = new URLSearchParams({
    api: '1',
    origin: origin.trim(),
    destination: destination.trim(),
    travelmode: mode,
  });

  return `${GOOGLE_MAPS_DIRECTIONS_BASE}?${params.toString()}`;
}
