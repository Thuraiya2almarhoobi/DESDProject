/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the MapPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { ArrowLeft, MapPin, Route } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { formatDisplayPostcode, getPreferredPostcode } from '../lib/accountLocation';
import { getGoogleMapsEmbedUrl, getGoogleMapsSearchUrl } from '../lib/googleMaps';
import { useSafeBack } from '../lib/navigation';
import { SiteHeader } from '../components/SiteHeader';
import { PageLoadingSkeleton } from '../components/LoadingSkeletons';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';

interface ProducersNearPayload {
  postcode: string;
  radius_miles: number;
  customer_coordinates?: {
    lat: number;
    lng: number;
  };
  producers: Array<{
    producer_id: number;
    producer_name: string;
    postcode: string;
    distance_miles: number;
    coordinates: {
      lat: number;
      lng: number;
    };
  }>;
}

interface CartMilesPayload {
  customer_postcode: string;
  total_food_miles: string;
  producer_totals: Array<{
    producer_id: number;
    producer_name: string;
    distance_miles: string;
    item_count: number;
  }>;
}

/**
 * MapPage boundary.
 *
 * This exported unit supports the file role: Implements the MapPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function MapPage() {
  const location = useLocation();
  const goBack = useSafeBack('/marketplace');
  const { user, profile, addresses, loading: authLoading } = useAuth();
  const [postcode, setPostcode] = useState('');
  const [radius, setRadius] = useState('20');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nearPayload, setNearPayload] = useState<ProducersNearPayload | null>(null);
  const [cartMiles, setCartMiles] = useState<CartMilesPayload | null>(null);
  const searchQuery = new URLSearchParams(location.search).get('q') || '';
  const backToMarketplaceButton = (
    <Button variant="ghost" onClick={goBack}>
      <ArrowLeft className="mr-2 size-4" />
      Back to Marketplace
    </Button>
  );
  const portalLabel =
    user?.role === 'COMMUNITY'
      ? 'Community'
      : user?.role === 'RESTAURANT'
        ? 'Restaurant'
        : 'Customer';
  const postcodeLabel =
    user?.role === 'COMMUNITY'
      ? 'Community Postcode'
      : user?.role === 'RESTAURANT'
        ? 'Kitchen Postcode'
        : 'Customer Postcode';
  const heading =
    user?.role === 'COMMUNITY'
      ? 'Community Producers Near Me'
      : user?.role === 'RESTAURANT'
        ? 'Restaurant Producers Near Me'
        : 'Producers Near Me';
  const introCopy =
    user?.role === 'COMMUNITY'
      ? 'Compare supplier distances around your community drop-off point and track total food miles across the current bulk basket.'
      : user?.role === 'RESTAURANT'
        ? 'Compare supplier distances around your kitchen postcode and track total food miles across the current restaurant order cart.'
        : 'Postcode distance and cart food-miles visual for sustainability tracking.';
  const defaultPostcode = useMemo(
    () => formatDisplayPostcode(getPreferredPostcode(user?.role, profile, addresses)),
    [addresses, profile, user],
  );

  const loadData = async (overridePostcode?: string, overrideRadius?: string) => {
    setLoading(true);
    setError('');

    try {
      const activePostcode = formatDisplayPostcode(overridePostcode || postcode || defaultPostcode || '');
      const activeRadius = overrideRadius || radius || '20';

      setPostcode(activePostcode);
      setRadius(activeRadius);

      const [nearMe, foodMiles] = await Promise.all([
        apiJson<ProducersNearPayload>(
          `/api/geo/producers-near-me/?postcode=${encodeURIComponent(activePostcode)}&radius_miles=${encodeURIComponent(activeRadius)}`,
        ),
        apiJson<CartMilesPayload>(`/api/geo/food-miles/cart/?postcode=${encodeURIComponent(activePostcode)}`),
      ]);

      setNearPayload(nearMe);
      setCartMiles(foodMiles);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load map data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }
    void loadData(defaultPostcode, radius);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, defaultPostcode]);

  const visibleProducers = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const producers = nearPayload?.producers || [];
    if (!normalizedSearch) {
      return producers;
    }
    return producers.filter((producer) =>
      [producer.producer_name, producer.postcode, `${producer.distance_miles.toFixed(2)} miles`]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [nearPayload, searchQuery]);

  const visibleProducerTotals = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const rows = cartMiles?.producer_totals || [];
    if (!normalizedSearch) {
      return rows;
    }
    return rows.filter((row) =>
      [row.producer_name, `${Number(row.distance_miles).toFixed(2)} miles`, `${row.item_count} items`]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [cartMiles, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader searchPlaceholder="Search nearby producers, postcodes, distances..." />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">{backToMarketplaceButton}</div>
        <div>
          <h1 className="text-3xl font-semibold">{heading}</h1>
          <p className="text-sm text-gray-600 mt-1">{introCopy}</p>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600">
              Search: <span className="font-medium text-gray-900">{searchQuery}</span>
            </p>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Distance Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid sm:grid-cols-3 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void loadData(postcode, radius);
              }}
            >
              <div>
                <Label htmlFor="postcode">{postcodeLabel}</Label>
                <Input id="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="radius">Radius (miles)</Label>
                <Input id="radius" type="number" min="1" value={radius} onChange={(e) => setRadius(e.target.value)} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">Refresh Map Data</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {loading ? (
          <PageLoadingSkeleton rows={2} cards={3} />
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center text-red-700">{error}</CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {visibleProducers.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-gray-600">No producers found in the selected radius.</CardContent>
                </Card>
              ) : (
                visibleProducers.map((producer) => (
                  <Card key={producer.producer_id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between gap-4 items-start">
                        <div>
                          <p className="font-semibold">{producer.producer_name}</p>
                          <p className="text-sm text-gray-600">{producer.postcode}</p>
                        </div>
                        <Badge variant="secondary">{producer.distance_miles.toFixed(2)} miles</Badge>
                      </div>

                      <div className="aspect-[2/1] rounded-md overflow-hidden bg-gray-100">
                        {getGoogleMapsEmbedUrl(producer.coordinates, 11) ? (
                          <iframe
                            title={`Map preview for ${producer.producer_name}`}
                            src={getGoogleMapsEmbedUrl(producer.coordinates, 11) || undefined}
                            className="h-full w-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-600">
                            Google Maps preview is unavailable for this producer.
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="size-3" />
                          Lat {producer.coordinates.lat}, Lng {producer.coordinates.lng}
                        </div>
                        {getGoogleMapsSearchUrl(producer.coordinates) && (
                          <a
                            href={getGoogleMapsSearchUrl(producer.coordinates) || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-green-700 underline"
                          >
                            Open in Google Maps
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Cart Food Miles</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600">{portalLabel} postcode</p>
                    <p className="font-medium">{cartMiles?.customer_postcode || nearPayload?.postcode || 'N/A'}</p>
                  </div>

                  <div className="p-3 border rounded">
                    <p className="text-xs text-gray-600">Total Food Miles (current {portalLabel.toLowerCase()} cart)</p>
                    <p className="text-2xl font-semibold text-green-700 flex items-center gap-2">
                      <Route className="size-5" />
                      {Number(cartMiles?.total_food_miles || 0).toFixed(2)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {visibleProducerTotals.map((row) => (
                      <div key={row.producer_id} className="border rounded p-3">
                        <p className="font-medium text-sm">{row.producer_name}</p>
                        <p className="text-xs text-gray-600">{row.item_count} item(s)</p>
                        <p className="text-sm text-gray-700">{Number(row.distance_miles).toFixed(2)} miles</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
