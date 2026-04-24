import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MapPin, Truck } from 'lucide-react';
import {
  getGoogleMapsDirectionsEmbedUrl,
  getGoogleMapsDirectionsUrl,
  loadGoogleMapsJavaScriptApi,
} from '../lib/googleMaps';

interface CoordinatePoint {
  lat: number;
  lng: number;
}

interface LocationSnapshot {
  full_address?: string;
  postcode?: string;
  coordinates?: CoordinatePoint | null;
}

interface LiveDeliveryMapProps {
  pickup?: LocationSnapshot | null;
  dropoff?: LocationSnapshot | null;
  courierCoordinates?: CoordinatePoint | null;
  pickupLabel?: string;
  dropoffLabel?: string;
  courierLabel?: string;
  deliveryStatus?: string | null;
  simulationStartedAt?: string | null;
  simulationDurationSeconds?: number;
  testMode?: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolateCoordinates(from: CoordinatePoint, to: CoordinatePoint, progress: number): CoordinatePoint {
  const safeProgress = clamp(progress, 0, 1);
  return {
    lat: from.lat + (to.lat - from.lat) * safeProgress,
    lng: from.lng + (to.lng - from.lng) * safeProgress,
  };
}

function toLatLngLiteral(point: CoordinatePoint): { lat: number; lng: number } {
  return { lat: point.lat, lng: point.lng };
}

function getDistanceMeters(from: CoordinatePoint, to: CoordinatePoint): number {
  const earthRadiusMeters = 6371000;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLat = ((to.lat - from.lat) * Math.PI) / 180;
  const deltaLng = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusMeters * c;
}

function getSimulationProgress(simulationStartedAt?: string | null, simulationDurationSeconds?: number): number | null {
  if (!simulationStartedAt || !simulationDurationSeconds || simulationDurationSeconds <= 0) {
    return null;
  }

  const startedAt = Date.parse(simulationStartedAt);
  if (!Number.isFinite(startedAt)) {
    return null;
  }

  const durationMs = Math.max(1, simulationDurationSeconds * 1000);
  return clamp((Date.now() - startedAt) / durationMs, 0, 1);
}

function getPointAlongRoute(route: CoordinatePoint[], progress: number): CoordinatePoint | null {
  if (route.length === 0) {
    return null;
  }
  if (route.length === 1) {
    return route[0];
  }

  const segmentLengths: number[] = [];
  let totalDistance = 0;
  for (let index = 1; index < route.length; index += 1) {
    const length = getDistanceMeters(route[index - 1], route[index]);
    segmentLengths.push(length);
    totalDistance += length;
  }

  if (totalDistance <= 0) {
    return route[0];
  }

  const targetDistance = clamp(progress, 0, 1) * totalDistance;
  let travelledDistance = 0;

  for (let index = 1; index < route.length; index += 1) {
    const segmentDistance = segmentLengths[index - 1];
    const nextTravelledDistance = travelledDistance + segmentDistance;
    if (targetDistance <= nextTravelledDistance) {
      const segmentProgress = segmentDistance <= 0 ? 0 : (targetDistance - travelledDistance) / segmentDistance;
      return interpolateCoordinates(route[index - 1], route[index], segmentProgress);
    }
    travelledDistance = nextTravelledDistance;
  }

  return route[route.length - 1];
}

function createPinSvg(fillColor: string, foreground: string, iconMarkup: string): string {
  return `
    <svg width="42" height="52" viewBox="0 0 42 52" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 2C12.16 2 5 9.16 5 18c0 11.89 13.58 25.77 15.45 27.63a0.79 0.79 0 0 0 1.1 0C23.42 43.77 37 29.89 37 18 37 9.16 29.84 2 21 2Z" fill="${fillColor}"/>
      <circle cx="21" cy="18" r="10.5" fill="${foreground}" opacity="0.16"/>
      ${iconMarkup}
    </svg>
  `.trim();
}

function buildSvgMarkerIcon(maps: any, svg: string) {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(42, 52),
    anchor: new maps.Point(21, 50),
  };
}

function buildPickupMarkerIcon(maps: any) {
  return buildSvgMarkerIcon(
    maps,
    createPinSvg(
      '#15803d',
      '#ffffff',
      '<text x="21" y="22.5" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">P</text>',
    ),
  );
}

function buildDropoffMarkerIcon(maps: any) {
  return buildSvgMarkerIcon(
    maps,
    createPinSvg(
      '#dc2626',
      '#ffffff',
      '<text x="21" y="22.5" text-anchor="middle" font-size="11" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">D</text>',
    ),
  );
}

function buildCourierMarkerIcon(maps: any) {
  return buildSvgMarkerIcon(
    maps,
    createPinSvg(
      '#ea580c',
      '#ffffff',
      `
        <circle cx="21" cy="13.5" r="3.2" fill="#ffffff"/>
        <path d="M16.5 23c1.8-4.4 7.2-4.4 9 0" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/>
        <rect x="25.8" y="20.6" width="5.3" height="4.6" rx="1" fill="#ffffff"/>
        <path d="M16.2 23h-3.4M25.8 23h-4.2" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="14.2" cy="27.8" r="2.3" stroke="#ffffff" stroke-width="2" fill="none"/>
        <circle cx="27.8" cy="27.8" r="2.3" stroke="#ffffff" stroke-width="2" fill="none"/>
      `,
    ),
  );
}

function getSimulatedCourierPosition(
  pickup: CoordinatePoint | null,
  dropoff: CoordinatePoint | null,
  routePath: CoordinatePoint[],
  simulationStartedAt?: string | null,
  simulationDurationSeconds?: number,
  testMode?: boolean,
): CoordinatePoint | null {
  if (!pickup || !dropoff || !testMode || !simulationStartedAt || !simulationDurationSeconds || simulationDurationSeconds <= 0) {
    return null;
  }

  const progress = getSimulationProgress(simulationStartedAt, simulationDurationSeconds);
  if (progress === null) {
    return null;
  }

  if (progress < 0.40) {
    return pickup;
  }
  if (progress >= 1) {
    return dropoff;
  }

  if (routePath.length > 1) {
    return getPointAlongRoute(routePath, (progress - 0.40) / 0.60) || dropoff;
  }

  return interpolateCoordinates(pickup, dropoff, (progress - 0.40) / 0.60);
}

export function LiveDeliveryMap({
  pickup,
  dropoff,
  courierCoordinates,
  pickupLabel = 'Pickup',
  dropoffLabel = 'Dropoff',
  courierLabel = 'Courier',
  deliveryStatus,
  simulationStartedAt,
  simulationDurationSeconds,
  testMode,
}: LiveDeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const dropoffMarkerRef = useRef<any>(null);
  const courierMarkerRef = useRef<any>(null);
  const routeLineRef = useRef<any>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptUnavailable, setScriptUnavailable] = useState(false);
  const [routePath, setRoutePath] = useState<CoordinatePoint[]>([]);
  const [animatedCourierCoordinates, setAnimatedCourierCoordinates] = useState<CoordinatePoint | null>(courierCoordinates || null);

  const pickupCoordinates = pickup?.coordinates || null;
  const dropoffCoordinates = dropoff?.coordinates || null;
  const originText = pickup?.full_address || pickup?.postcode || '';
  const destinationText = dropoff?.full_address || dropoff?.postcode || '';
  const fallbackEmbedUrl = useMemo(
    () => getGoogleMapsDirectionsEmbedUrl(originText, destinationText),
    [destinationText, originText],
  );
  const fallbackRouteUrl = useMemo(
    () => getGoogleMapsDirectionsUrl(originText, destinationText),
    [destinationText, originText],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!pickupCoordinates || !dropoffCoordinates) {
        setScriptUnavailable(true);
        setScriptReady(false);
        return;
      }

      try {
        const maps = await loadGoogleMapsJavaScriptApi();
        if (cancelled) {
          return;
        }
        if (!maps) {
          setScriptUnavailable(true);
          setScriptReady(false);
          return;
        }
        setScriptReady(true);
        setScriptUnavailable(false);
      } catch (_error) {
        if (!cancelled) {
          setScriptUnavailable(true);
          setScriptReady(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [dropoffCoordinates, pickupCoordinates]);

  useEffect(() => {
    if (!scriptReady || !pickupCoordinates || !dropoffCoordinates || !window.google?.maps) {
      setRoutePath([]);
      return;
    }

    let cancelled = false;
    const maps = window.google.maps;
    const directionsService = new maps.DirectionsService();

    directionsService.route(
      {
        origin: toLatLngLiteral(pickupCoordinates),
        destination: toLatLngLiteral(dropoffCoordinates),
        travelMode: maps.TravelMode.DRIVING,
      },
      (result: any, status: string) => {
        if (cancelled) {
          return;
        }

        if (
          status === maps.DirectionsStatus.OK &&
          result?.routes?.[0]?.overview_path &&
          Array.isArray(result.routes[0].overview_path)
        ) {
          const nextRoutePath = result.routes[0].overview_path
            .map((point: any) => ({ lat: Number(point.lat()), lng: Number(point.lng()) }))
            .filter((point: CoordinatePoint) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

          if (nextRoutePath.length > 1) {
            setRoutePath(nextRoutePath);
            return;
          }
        }

        setRoutePath([pickupCoordinates, dropoffCoordinates]);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [dropoffCoordinates, pickupCoordinates, scriptReady]);

  useEffect(() => {
    if (!pickupCoordinates || !dropoffCoordinates) {
      setAnimatedCourierCoordinates(courierCoordinates || null);
      return;
    }

    const updatePosition = () => {
      const simulatedPosition = getSimulatedCourierPosition(
        pickupCoordinates,
        dropoffCoordinates,
        routePath,
        simulationStartedAt,
        simulationDurationSeconds,
        testMode,
      );
      setAnimatedCourierCoordinates(simulatedPosition || courierCoordinates || null);
    };

    updatePosition();

    if (!testMode || !simulationStartedAt || !simulationDurationSeconds) {
      return;
    }

    const intervalId = window.setInterval(updatePosition, 250);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    courierCoordinates,
    dropoffCoordinates,
    pickupCoordinates,
    routePath,
    simulationDurationSeconds,
    simulationStartedAt,
    testMode,
  ]);

  useEffect(() => {
    if (!scriptReady || !mapContainerRef.current || !pickupCoordinates || !dropoffCoordinates || !window.google?.maps) {
      return;
    }

    const maps = window.google.maps;
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new maps.Map(mapContainerRef.current, {
        center: pickupCoordinates,
        zoom: 12,
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        gestureHandling: 'greedy',
      });
    }

    const map = mapInstanceRef.current;
  const activeRoutePath = routePath.length > 1 ? routePath : [pickupCoordinates, dropoffCoordinates];
    const bounds = new maps.LatLngBounds();
  activeRoutePath.forEach((point) => bounds.extend(point));

    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = new maps.Marker({
        position: pickupCoordinates,
        map,
        title: pickupLabel,
        icon: buildPickupMarkerIcon(maps),
      });
    } else {
      pickupMarkerRef.current.setPosition(pickupCoordinates);
      pickupMarkerRef.current.setTitle(pickupLabel);
    }

    if (!dropoffMarkerRef.current) {
      dropoffMarkerRef.current = new maps.Marker({
        position: dropoffCoordinates,
        map,
        title: dropoffLabel,
        icon: buildDropoffMarkerIcon(maps),
      });
    } else {
      dropoffMarkerRef.current.setPosition(dropoffCoordinates);
      dropoffMarkerRef.current.setTitle(dropoffLabel);
    }

    if (!routeLineRef.current) {
      routeLineRef.current = new maps.Polyline({
        path: activeRoutePath,
        geodesic: true,
        strokeColor: '#15803d',
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });
    } else {
      routeLineRef.current.setPath(activeRoutePath);
    }

    map.fitBounds(bounds, 56);
  }, [dropoffCoordinates, dropoffLabel, pickupCoordinates, pickupLabel, routePath, scriptReady]);

  useEffect(() => {
    if (!scriptReady || !window.google?.maps || !mapInstanceRef.current) {
      return;
    }
    const maps = window.google.maps;

    if (!animatedCourierCoordinates) {
      if (courierMarkerRef.current) {
        courierMarkerRef.current.setMap(null);
        courierMarkerRef.current = null;
      }
      return;
    }

    if (!courierMarkerRef.current) {
      courierMarkerRef.current = new maps.Marker({
        position: animatedCourierCoordinates,
        map: mapInstanceRef.current,
        title: courierLabel,
        icon: buildCourierMarkerIcon(maps),
        zIndex: 20,
      });
      return;
    }

    courierMarkerRef.current.setPosition(animatedCourierCoordinates);
    courierMarkerRef.current.setTitle(courierLabel);
  }, [animatedCourierCoordinates, courierLabel, scriptReady]);

  const showLiveCanvas = scriptReady && pickupCoordinates && dropoffCoordinates;

  return (
    <div className="overflow-hidden rounded-xl border bg-gray-50">
      <div className="aspect-[16/7] bg-[oklch(0.985_0.006_145)]">
        {showLiveCanvas ? (
          <div ref={mapContainerRef} className="h-full w-full" />
        ) : fallbackEmbedUrl && !scriptUnavailable ? (
          <iframe
            title="Delivery route map"
            src={fallbackEmbedUrl}
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-600">
            Live delivery map is unavailable right now, but route details and tracking updates are still shown below.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-white px-4 py-3 text-xs text-gray-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3 text-green-700" />
            {pickupLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3 text-red-600" />
            {dropoffLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Truck className="size-3 text-blue-600" />
            {deliveryStatus || 'Live Courier'}
          </span>
        </div>

        {fallbackRouteUrl && (
          <a
            href={fallbackRouteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-green-700 underline"
          >
            <ExternalLink className="size-3" />
            Open route in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
