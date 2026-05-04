/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for googleMaps concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

/**
 * GOOGLE_MAPS_EMBED_BASE boundary.
 *
 * This exported unit supports the file role: Contains reusable helper functions for googleMaps concerns across the frontend.
 * It belongs to: Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const GOOGLE_MAPS_EMBED_BASE = 'https://www.google.com/maps/embed/v1/place';
const GOOGLE_MAPS_DIRECTIONS_EMBED_BASE = 'https://www.google.com/maps/embed/v1/directions';
const GOOGLE_MAPS_SEARCH_BASE = 'https://www.google.com/maps/search/';
const GOOGLE_MAPS_DIRECTIONS_BASE = 'https://www.google.com/maps/dir/';
/**
 * GOOGLE_MAPS_JS_BASE boundary.
 *
 * This exported unit supports the file role: Contains reusable helper functions for googleMaps concerns across the frontend.
 * It belongs to: Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const GOOGLE_MAPS_JS_BASE = 'https://maps.googleapis.com/maps/api/js';

/**
 * Google Maps helper functions used by product detail and live delivery UI.
 *
 * The project uses:
 * - static embed/search/directions URLs for lightweight map views
 * - lazy loading of the JavaScript API for interactive delivery tracking
 */
declare global {
  interface Window {
    google?: any;
    __desdGoogleMapsPromise?: Promise<any>;
  }
}

export function getGoogleMapsApiKey(): string {
  // Vite exposes only variables prefixed with VITE_. The key is read at build
  // time from `.env`, so Docker/frontend rebuilds are required after changing it.
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '';
}

export function getGoogleMapsEmbedUrl(coordinates?: { lat: number; lng: number }, zoom = 12): string | null {
  // Product/farm map cards use the lightweight Embed API. Returning null lets
  // the UI show the address fallback when the key or coordinates are missing.
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
  // Live delivery pages use an embedded directions map from producer pickup to
  // customer dropoff, matching the route shown in the separate Google Maps tab.
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
  // External Google Maps links do not require our API key, so users can still
  // open directions even if the embedded map is unavailable.
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
  // Memoize script loading on window so repeated visits do not inject duplicate
  // script tags or race each other.
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
      script.src = `${GOOGLE_MAPS_JS_BASE}?key=${encodeURIComponent(apiKey)}`;
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
