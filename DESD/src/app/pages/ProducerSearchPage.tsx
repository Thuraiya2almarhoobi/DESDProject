import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, Clock, Heart, MapPin, Package, Store } from 'lucide-react';
import { toast } from 'sonner';

import { fetchProducts } from '../api/catalog';
import { SiteHeader } from '../components/SiteHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { fuzzyIncludes } from '../lib/fuzzySearch';
import { Product } from '../types';
import type { MarketplaceProducer } from './MarketplacePage';

type ProducerDirectoryView = 'all' | 'saved';

export function ProducerSearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [producers, setProducers] = useState<MarketplaceProducer[]>([]);
  const [savedProducers, setSavedProducers] = useState<MarketplaceProducer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [view, setView] = useState<ProducerDirectoryView>(searchParams.get('view') === 'saved' ? 'saved' : 'all');
  const [loading, setLoading] = useState(true);
  const [savingProducerId, setSavingProducerId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([apiJson<MarketplaceProducer[]>('/api/orders/producers/'), fetchProducts({})])
      .then(([producerPayload, productPayload]) => {
        if (!mounted) {
          return;
        }
        setProducers(producerPayload);
        setProducts(productPayload);
      })
      .catch(() => {
        if (mounted) {
          setProducers([]);
          setProducts([]);
          toast.error('Unable to load producers.');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedProducers([]);
      return;
    }
    let mounted = true;
    apiJson<MarketplaceProducer[]>('/api/orders/producers/favorites/')
      .then((payload) => {
        if (mounted) {
          setSavedProducers(payload);
        }
      })
      .catch(() => {
        if (mounted) {
          setSavedProducers([]);
        }
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (searchQuery.trim()) {
      nextParams.set('q', searchQuery.trim());
    }
    if (view === 'saved') {
      nextParams.set('view', 'saved');
    }
    setSearchParams(nextParams, { replace: true });
  }, [searchQuery, setSearchParams, view]);

  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      counts.set(product.producerId, (counts.get(product.producerId) || 0) + 1);
    });
    return counts;
  }, [products]);

  const producerProducts = useMemo(() => {
    const grouped = new Map<string, Product[]>();
    products.forEach((product) => {
      const entries = grouped.get(product.producerId) || [];
      entries.push(product);
      grouped.set(product.producerId, entries);
    });
    return grouped;
  }, [products]);

  const savedProducerIds = useMemo(() => new Set(savedProducers.map((producer) => producer.id)), [savedProducers]);

  const displayedProducers = useMemo(() => {
    const source = view === 'saved' ? savedProducers : producers;
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return source;
    }
    return source.filter((producer) => {
      const productsForProducer = producerProducts.get(String(producer.id)) || [];
      return fuzzyIncludes(query, [
        producer.business_name,
        producer.contact_email,
        producer.postcode,
        ...productsForProducer.flatMap((product) => [product.name, product.category, product.description]),
      ]);
    });
  }, [producerProducts, producers, savedProducers, searchQuery, view]);

  const toggleSavedProducer = async (producer: MarketplaceProducer, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    if (savingProducerId !== null) {
      return;
    }
    setSavingProducerId(producer.id);
    const isSaved = savedProducerIds.has(producer.id);
    try {
      if (isSaved) {
        await apiJson<null>(`/api/orders/producers/${producer.id}/favorite/`, { method: 'DELETE' });
        setSavedProducers((current) => current.filter((item) => item.id !== producer.id));
        toast.success('Producer removed from saved producers.');
      } else {
        await apiJson<{ is_favorite?: boolean }>(`/api/orders/producers/${producer.id}/favorite/`, { method: 'POST' });
        setSavedProducers((current) => (current.some((item) => item.id === producer.id) ? current : [...current, producer]));
        toast.success('Producer saved.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update saved producer.');
    } finally {
      setSavingProducerId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.985_0.01_145)]">
      <SiteHeader
        showSearch
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search producers, products, categories..."
      />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Button type="button" variant="ghost" size="sm" className="mb-3" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="size-4" />
              Marketplace
            </Button>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.42_0.07_145)]">Producer directory</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[oklch(0.23_0.03_145)]">Browse local producers</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
              Find producer companies on the platform, open their product ranges, and keep saved producers close for repeat orders.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Tabs value={view} onValueChange={(value) => setView(value as ProducerDirectoryView)}>
              <TabsList className="bg-white">
                <TabsTrigger value="all">All producers</TabsTrigger>
                <TabsTrigger value="saved">
                  Saved
                  <Badge className="ml-2 h-5 min-w-5 px-1.5">{savedProducers.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-[#dfe8d8] bg-white px-4 py-3 text-sm font-medium text-gray-600 shadow-sm">
          {displayedProducers.length} producer{displayedProducers.length === 1 ? '' : 's'} found
        </div>

        {view === 'saved' && !user ? (
          <Card className="border-[#dfe8d8] bg-white">
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold text-[oklch(0.24_0.03_145)]">Sign in to view saved producers</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-gray-600">
                Saved producers are attached to your account so you can return to trusted suppliers quickly.
              </p>
              <Button type="button" className="mt-5" onClick={() => navigate('/login')}>
                Sign in
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="h-48 animate-pulse border-[#dfe8d8] bg-white" />
            ))}
          </div>
        ) : displayedProducers.length === 0 ? (
          <Card className="border-[#dfe8d8] bg-white">
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold text-[oklch(0.24_0.03_145)]">
                {view === 'saved' ? 'No saved producers found' : 'No producers found'}
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-gray-600">
                {searchQuery.trim()
                  ? 'Try another producer name, product, category, or postcode.'
                  : view === 'saved'
                    ? 'Save producers from marketplace cards or producer pages to see them here.'
                    : 'Producer profiles will appear here once they have marketplace records.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedProducers.map((producer) => {
              const productsForProducer = producerProducts.get(String(producer.id)) || [];
              const categories = Array.from(new Set(productsForProducer.map((product) => product.category).filter(Boolean))).slice(0, 3);
              const isSaved = savedProducerIds.has(producer.id);
              return (
                <Card
                  key={producer.id}
                  className="group cursor-pointer border-[#dfe8d8] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[var(--forest-green)] hover:shadow-md"
                  onClick={() => navigate(`/producers/${producer.id}`)}
                >
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--forest-green)_10%,white)] text-[var(--forest-green)]">
                        <Store className="size-5" />
                      </span>
                      <Button
                        type="button"
                        variant={isSaved ? 'default' : 'outline'}
                        size="sm"
                        disabled={savingProducerId === producer.id}
                        onClick={(event) => toggleSavedProducer(producer, event)}
                      >
                        <Heart className={`size-4 ${isSaved ? 'fill-current' : ''}`} />
                        {isSaved ? 'Saved' : 'Save'}
                      </Button>
                    </div>

                    <div className="mt-4 min-w-0">
                      <h2 className="truncate text-lg font-semibold text-[oklch(0.23_0.03_145)]">{producer.business_name}</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="gap-1">
                          <MapPin className="size-3" />
                          {producer.postcode || 'Bristol'}
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                          <Package className="size-3" />
                          {productCounts.get(String(producer.id)) || 0} products
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Clock className="size-3" />
                          {producer.lead_time_hours || 48}h
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {categories.length > 0 ? (
                        categories.map((category) => (
                          <span key={category} className="rounded-full bg-[#f2f5ee] px-2.5 py-1 text-xs font-medium text-[oklch(0.32_0.05_145)]">
                            {category}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No current product categories</span>
                      )}
                    </div>

                    <Button type="button" variant="ghost" className="mt-auto justify-start px-0 pt-5 text-[var(--forest-green)]">
                      View producer products
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
