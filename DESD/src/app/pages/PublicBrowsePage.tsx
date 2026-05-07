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
import { AlertCircle, ArrowRight, Search, Star } from 'lucide-react';

import { fetchMarketplaceProductsFromApi } from '../services/productApi';
import { Product } from '../types';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { SiteHeader } from '../components/SiteHeader';
import { fuzzyIncludes } from '../lib/fuzzySearch';
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
  const focusedProductId = searchParams.get('focusProduct') || '';
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

      return fuzzyIncludes(loweredQuery, [product.name, product.description, product.producerName, product.category]);
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

  useEffect(() => {
    if (isLoading || !focusedProductId) {
      return;
    }
    window.setTimeout(() => {
      document.getElementById(`public-product-${focusedProductId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 100);
  }, [focusedProductId, isLoading, filteredProducts.length]);

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
                  <PublicBrowseCard key={product.id} product={product} isFocused={product.id === focusedProductId} />
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
function PublicBrowseCard({ product, isFocused = false }: { product: Product; isFocused?: boolean }) {
  const isAvailable = product.availability !== 'unavailable' && product.stock > 0;

  return (
    <Card
      id={`public-product-${product.id}`}
      className={`group h-full gap-0 overflow-hidden cursor-pointer transition-shadow hover:shadow-lg focus-within:ring-2 focus-within:ring-green-600 focus-within:ring-offset-2 ${
        isFocused ? 'ring-4 ring-[#2f6b45] ring-offset-4 ring-offset-[#f3fbf1]' : ''
      }`}
    >
      <Link to={`/browse/product/${product.id}`} className="block">
        <div className="relative h-56 overflow-hidden bg-[linear-gradient(180deg,#f8faf8_0%,#edf3ea_100%)] sm:h-60">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute right-3 top-3 flex flex-col gap-1">
            <AvailabilityBadge availability={product.availability} />
            {product.isOrganic && <OrganicBadge />}
            {product.isSurplus && <SurplusBadge />}
          </div>
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col justify-between px-4 pb-3.5 pt-4">
        <div className="space-y-2">
          <Link
            to={`/browse/product/${product.id}`}
            className="line-clamp-2 block font-semibold leading-tight text-[oklch(0.24_0.02_145)] hover:text-[oklch(0.31_0.05_145)]"
          >
            {product.name}
          </Link>
          <p className="mb-1 line-clamp-1 text-sm text-gray-600">{product.producerName}</p>
          <p className="mb-2 line-clamp-1 text-xs text-gray-500">{product.category}</p>

          <div className="space-y-1 text-xs text-gray-600">
            <p className="line-clamp-1">
              {product.producerLocation} &bull; Food Miles: {product.foodMiles.toFixed(2)} miles &bull; Go Green
            </p>
            <p className="line-clamp-1">
              {new Date(product.harvestDate).toDateString() === new Date().toDateString()
                ? 'Harvested today'
                : 'Harvested this week'}
            </p>
            <p className="line-clamp-1 font-medium text-green-700">
              Available: {product.seasonalDates || 'Current season'}
            </p>
          </div>

          {product.averageRating !== undefined && product.reviewCount ? (
            <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="size-4 fill-current" />
                <span className="font-medium text-gray-900">{product.averageRating.toFixed(1)}</span>
              </div>
              <span className="text-gray-500">
                {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
              </span>
            </div>
          ) : (
            <p className="mt-2 min-h-5 text-sm text-gray-500">No customer ratings yet</p>
          )}
        </div>

        <div className="space-y-2.5 pt-3">
          {!isAvailable && (
            <Badge variant="secondary" className="text-xs">
              Out of stock
            </Badge>
          )}

          <div className="space-y-1">
            {product.isSurplus && product.surplusDiscount && product.surplusOriginalPrice && product.surplusExpiresAt && product.surplusBestBefore ? (
              <div className="min-w-0 flex-1">
                <SurplusInfo
                  discount={product.surplusDiscount}
                  originalPrice={product.surplusOriginalPrice}
                  currentPrice={product.price}
                  unit={product.unit}
                  bestBefore={product.surplusBestBefore}
                  expiresAt={product.surplusExpiresAt}
                  compact
                />
              </div>
            ) : (
              <div className="flex min-w-0 items-baseline gap-1">
                <span className="text-lg font-semibold text-green-700">&pound;{product.price.toFixed(2)}</span>
                <span className="text-sm text-gray-500">/{product.unit}</span>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild size="sm" className="w-full focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
              <Link to="/login">Sign In to Order</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="w-full border-[var(--forest-green)] text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_8%,white)] hover:text-[var(--forest-green)] focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <Link to={`/browse/product/${product.id}`}>
                View Details
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
