/**
 * desd marketplace notes
 *
 * shared google maps helpers for embeds directions links and script loading
 * comments here explain api key ownership and fallback behavior
 */

/**
 * google maps url constants
 *
 * constants stay together so embed and external route links cannot drift
 */
const GOOGLE_MAPS_EMBED_BASE = 'https://www.google.com/maps/embed/v1/place';
const GOOGLE_MAPS_DIRECTIONS_EMBED_BASE = 'https://www.google.com/maps/embed/v1/directions';
const GOOGLE_MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';
const GOOGLE_MAPS_DIRECTIONS_BASE = 'https://www.google.com/maps/dir/';
const GOOGLE_MAPS_LIBRARIES = 'places';
const GOOGLE_MAPS_JS_BASE = 'https://maps.googleapis.com/maps/api/js';

/**
 * google maps helper functions
 *
 * static urls keep simple map views cheap
 * lazy javascript loading is only used for interactive delivery tracking
 */
declare global {
  interface Window {
    google?: any;
    __desdGoogleMapsPromise?: Promise<any>;
  }
}

export function getGoogleMapsApiKey(): string {
  // vite exposes only variables prefixed with vite_
  // the key is baked at build time so docker needs a rebuild after changes
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
}

export function getGoogleMapsEmbedUrl(coordinates?: { lat: number; lng: number }, zoom = 12): string | null {
  // product and farm cards use the lightweight embed api
  // null lets the ui show address fallback when keys or coordinates are missing
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
  // delivery pages embed producer pickup to customer dropoff directions
  // this matches the separate google maps tab without duplicating route logic
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
  // external directions links do not need our api key
  // users can still open maps when the embedded view is unavailable
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

export async function loadGoogleMapsJavaScriptApi(): Promise<any | null> {
  // memoize script loading on window so repeated visits do not inject duplicates
  // this keeps live delivery pages stable when order polling rerenders them
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return null;
  }

  if (window.google?.maps) {
    return window.google.maps;
  }

  if (!window.__desdGoogleMapsPromise) {
    window.__desdGoogleMapsPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[data-desd-google-maps="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google?.maps ?? null), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = `${GOOGLE_MAPS_JS_BASE}?key=${encodeURIComponent(apiKey)}&libraries=${encodeURIComponent(GOOGLE_MAPS_LIBRARIES)}`;
      script.async = true;
      script.defer = true;
      script.dataset.desdGoogleMaps = 'true';
      script.onload = () => resolve(window.google?.maps ?? null);
      script.onerror = () => {
        window.__desdGoogleMapsPromise = undefined;
        reject(new Error('Google Maps failed to load.'));
      };
      document.head.appendChild(script);
    });
  }

  return window.__desdGoogleMapsPromise;
}
