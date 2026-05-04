/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the PublicBrowsePage browser route and coordinates the UI state for that screen.
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
import { Link, useSearchParams } from 'react-router';
import { AlertCircle, ArrowRight, Search } from 'lucide-react';

import { fetchMarketplaceProductsFromApi } from '../services/productApi';
import { Product } from '../types';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { ProductMeta } from '../components/ProductMeta';
import { SiteHeader } from '../components/SiteHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { SurplusInfo } from '../components/SurplusInfo';

type SortOption = 'featured' | 'price-low' | 'price-high' | 'nearest';

/**
 * PublicBrowsePage boundary.
 *
 * This exported unit supports the file role: Implements the PublicBrowsePage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function PublicBrowsePage() {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [showOnlyInStock, setShowOnlyInStock] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setHasError(false);

    fetchMarketplaceProductsFromApi()
      .then((data) => {
        if (mounted) {
          setProducts(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setProducts([]);
          setHasError(true);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(products.map((product) => product.category || 'Uncategorised'))).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const loweredQuery = searchQuery.trim().toLowerCase();

    const next = products.filter((product) => {
      if (showOnlyInStock && product.stock <= 0) {
        return false;
      }

      if (selectedCategory !== 'All' && product.category !== selectedCategory) {
        return false;
      }

      if (!loweredQuery) {
        return true;
      }

      return [
        product.name,
        product.description,
        product.producerName,
        product.category,
      ]
        .join(' ')
        .toLowerCase()
        .includes(loweredQuery);
    });

    switch (sortBy) {
      case 'price-low':
        return next.sort((a, b) => a.price - b.price);
      case 'price-high':
        return next.sort((a, b) => b.price - a.price);
      case 'nearest':
        return next.sort((a, b) => a.foodMiles - b.foodMiles);
      case 'featured':
      default:
        return next.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [products, searchQuery, selectedCategory, showOnlyInStock, sortBy]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader
        showSearch
        showLocationBar
        locationCity="Bristol"
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Card className="border-[oklch(0.85_0.03_145)] bg-[linear-gradient(145deg,white,oklch(0.985_0.01_145))] shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.45_0.05_145)]">Public browse</p>
              <h1 className="text-3xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)]">Browse the marketplace before signing in.</h1>
              <p className="max-w-3xl text-sm leading-6 text-[oklch(0.36_0.03_145)]">
                This is a read-only marketplace browser. You can inspect products and producers, but ordering stays
                behind authenticated customer, community, or restaurant accounts.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/login">Sign In to Order</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/select-portal?mode=register">Create Account</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-4">
            <Card className="border-[oklch(0.87_0.02_145)] bg-white/92 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-sm font-semibold text-[oklch(0.24_0.02_145)]">Browse filters</p>
                  <p className="mt-1 text-xs leading-5 text-[oklch(0.4_0.03_145)]">Lightweight public filtering for discovery only.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="public-category" className="text-xs font-semibold uppercase tracking-[0.16em] text-[oklch(0.42_0.04_145)]">
                    Category
                  </label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="public-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="public-sort" className="text-xs font-semibold uppercase tracking-[0.16em] text-[oklch(0.42_0.04_145)]">
                    Sort
                  </label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                    <SelectTrigger id="public-sort">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="featured">Featured</SelectItem>
                      <SelectItem value="price-low">Price low to high</SelectItem>
                      <SelectItem value="price-high">Price high to low</SelectItem>
                      <SelectItem value="nearest">Nearest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-[oklch(0.9_0.02_145)] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={showOnlyInStock}
                    onChange={(event) => setShowOnlyInStock(event.target.checked)}
                    className="size-4 rounded border-[oklch(0.8_0.02_145)]"
                  />
                  <span className="text-sm text-[oklch(0.34_0.03_145)]">Show in-stock products only</span>
                </label>
                <div className="rounded-2xl border border-[oklch(0.9_0.02_145)] bg-[oklch(0.985_0.006_145)] p-4 text-sm leading-6 text-[oklch(0.36_0.03_145)]">
                  Buying is disabled here. Use a signed-in buyer account to add items to cart and check out.
                </div>
              </CardContent>
            </Card>
          </aside>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-3xl border border-[oklch(0.87_0.02_145)] bg-white/92 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[oklch(0.24_0.02_145)]">
                  {filteredProducts.length} product{filteredProducts.length === 1 ? '' : 's'} available to browse
                </p>
                <p className="text-xs text-[oklch(0.42_0.03_145)]">Open any product to inspect details before signing in.</p>
              </div>
              <div className="hidden items-center gap-2 text-xs text-[oklch(0.38_0.03_145)] sm:flex">
                <Search className="size-3.5" />
                Search stays available in the header above.
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden">
                    <Skeleton className="aspect-video w-full" />
                    <CardContent className="space-y-3 p-4">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : hasError ? (
              <Card className="border-red-200 bg-red-50/70">
                <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                  <AlertCircle className="size-10 text-red-600" />
                  <div className="space-y-1">
                    <p className="font-semibold text-red-900">Public browse is unavailable right now.</p>
                    <p className="text-sm text-red-800">The products could not be loaded from the public marketplace feed.</p>
                  </div>
                </CardContent>
              </Card>
            ) : filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="py-14 text-center">
                  <p className="font-semibold text-[oklch(0.24_0.02_145)]">No products match the current public filters.</p>
                  <p className="mt-2 text-sm text-[oklch(0.42_0.03_145)]">Try a different category or clear the search term.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <PublicBrowseCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

/**
 * PublicBrowseCard boundary.
 *
 * This exported unit supports the file role: Implements the PublicBrowsePage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function PublicBrowseCard({ product }: { product: Product }) {
  const isAvailable = product.availability !== 'unavailable' && product.stock > 0;

  return (
    <Card className="overflow-hidden border-[oklch(0.87_0.02_145)] bg-white/95 shadow-sm transition-shadow hover:shadow-lg">
      <Link to={`/browse/product/${product.id}`} className="block">
        <div className="aspect-video overflow-hidden bg-[oklch(0.95_0.01_145)]">
          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
        </div>
      </Link>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <AvailabilityBadge availability={product.availability} />
          {product.isOrganic && <OrganicBadge />}
          {product.isSurplus && <SurplusBadge />}
        </div>

        <div className="space-y-1">
          <Link to={`/browse/product/${product.id}`} className="text-lg font-semibold text-[oklch(0.24_0.02_145)] hover:text-[oklch(0.31_0.05_145)]">
            {product.name}
          </Link>
          <p className="text-sm text-[oklch(0.4_0.03_145)]">{product.producerName}</p>
          <p className="text-xs text-[oklch(0.45_0.03_145)]">{product.category}</p>
        </div>

        <ProductMeta
          producerName={product.producerName}
          producerLocation={product.producerLocation}
          harvestDate={product.harvestDate}
          foodMiles={product.foodMiles}
          seasonalDates={product.seasonalDates}
          compact
        />

        {product.isSurplus && product.surplusDiscount && product.surplusOriginalPrice && product.surplusExpiresAt && product.surplusBestBefore ? (
          <SurplusInfo
            discount={product.surplusDiscount}
            originalPrice={product.surplusOriginalPrice}
            currentPrice={product.price}
            expiresAt={product.surplusExpiresAt}
            bestBefore={product.surplusBestBefore}
            unit={product.unit}
          />
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-semibold text-green-700">£{product.price.toFixed(2)}</span>
            <span className="text-sm text-gray-500">/{product.unit}</span>
          </div>
        )}

        {!isAvailable && (
          <Badge variant="secondary" className="w-fit">
            Out of stock
          </Badge>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild className="flex-1">
            <Link to="/login">Sign In to Order</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link to={`/browse/product/${product.id}`}>
              View Details
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
