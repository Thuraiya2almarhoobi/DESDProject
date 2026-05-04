/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the PublicProductDetailPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, AlertCircle, ChefHat, MapPin, Sprout, Star } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { SiteHeader } from '../components/SiteHeader';
import { SurplusInfo } from '../components/SurplusInfo';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { fetchPublicMarketplaceProductById } from '../services/productApi';
import { Product } from '../types';

/**
 * ReviewStars boundary.
 *
 * This exported unit supports the file role: Implements the PublicProductDetailPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function ReviewStars({ rating, iconClassName = 'size-4' }: { rating: number; iconClassName?: string }) {
  return (
    <div className="flex items-center">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`${iconClassName} ${
            index < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      ))}
    </div>
  );
}

function formatUnit(unit: string, quantity: number): string {
  if (unit === 'litre') {
    return quantity === 1 ? 'litre' : 'litres';
  }
  return unit;
}

/**
 * PublicProductDetailPage boundary.
 *
 * This exported unit supports the file role: Implements the PublicProductDetailPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function PublicProductDetailPage() {
  const { id = '' } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setHasError(false);

    fetchPublicMarketplaceProductById(id)
      .then((data) => {
        if (mounted) {
          setProduct(data);
        }
      })
      .catch(() => {
        if (mounted) {
          setProduct(null);
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
  }, [id]);

  return (
    <div className="min-h-screen bg-[#f3fbf1]">
      <SiteHeader />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-5 lg:px-6">
        <Button asChild variant="ghost">
          <Link to="/browse">
            <ArrowLeft className="mr-2 size-4" />
            Back to Browse
          </Link>
        </Button>

        {isLoading ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)]">
            <Skeleton className="aspect-[4/3] w-full rounded-3xl lg:aspect-square" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-56 w-full rounded-3xl" />
            </div>
          </div>
        ) : hasError || !product ? (
          <Card className="border-red-200 bg-red-50/70">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <AlertCircle className="size-10 text-red-600" />
              <div className="space-y-1">
                <p className="font-semibold text-red-900">This public product view is unavailable.</p>
                <p className="text-sm text-red-800">The product could not be loaded from the public marketplace feed.</p>
              </div>
              <Button asChild variant="outline">
                <Link to="/browse">Return to Browse</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
                <div className="grid gap-5 sm:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] lg:h-[27rem] xl:h-[28rem]">
                <div className="space-y-4">
                  <div className="relative h-36 overflow-hidden rounded-3xl bg-[#f2efe5] sm:h-[24rem] lg:h-[22.5rem] xl:h-[23.5rem]">
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <AvailabilityBadge availability={product.availability} />
                      {product.isOrganic && <OrganicBadge />}
                      {product.isSurplus && <SurplusBadge />}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span
                        className="block text-[var(--muted-foreground)]"
                        title="Estimated distance from farm to customer area"
                      >
                        Food miles
                      </span>
                      <span className="mt-1 block font-semibold text-[var(--rich-soil)]">{product.foodMiles.toFixed(2)} miles</span>
                    </div>
                    <div>
                      <span className="block text-[var(--muted-foreground)]">Farm</span>
                      <a href="#farm-location" className="mt-1 block truncate font-semibold text-[var(--forest-green)] hover:underline">
                        {product.producerLocation}
                      </a>
                    </div>
                    <div>
                      <span className="block text-[var(--muted-foreground)]">Recipes</span>
                      <a href="#recipes" className="mt-1 block truncate font-semibold text-[var(--forest-green)] hover:underline">
                        {product.recipeIdeas?.length ? `${product.recipeIdeas.length} idea${product.recipeIdeas.length === 1 ? '' : 's'}` : 'Coming soon'}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 space-y-5 lg:pr-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{product.category}</Badge>
                    <Badge variant="secondary">{product.seasonalDates || 'Year-round'}</Badge>
                    <Badge variant="outline">{product.isOrganic ? product.organicCertification || 'Organic Certified' : 'Non-organic'}</Badge>
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-[var(--rich-soil)] sm:text-4xl">{product.name}</h1>
                    <p className="mt-2 text-lg text-[var(--warm-earth)]">{product.producerName}</p>
                    <p className="mt-3 hidden max-w-2xl text-sm leading-6 text-[var(--warm-earth)] sm:block">{product.description}</p>
                  </div>

                  <a
                    id="reviews"
                    href="#reviews"
                    className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#d6cab8] bg-[#fbfaf4] px-4 py-2 text-sm transition hover:border-[var(--forest-green)]"
                  >
                    {product.averageRating ? (
                      <>
                        <ReviewStars rating={Math.round(product.averageRating)} />
                        <span className="font-semibold text-[var(--rich-soil)]">{product.averageRating.toFixed(1)}</span>
                        <span className="text-[var(--warm-earth)]">
                          {product.reviewCount || 0} review{product.reviewCount === 1 ? '' : 's'}
                        </span>
                      </>
                    ) : (
                      <>
                        <ReviewStars rating={0} />
                        <span className="font-semibold text-[var(--rich-soil)]">No customer ratings yet</span>
                      </>
                    )}
                  </a>

                  <div className="hidden max-w-2xl rounded-3xl bg-[#f5fbef] px-4 py-3 text-sm leading-6 text-[var(--warm-earth)] sm:block">
                    <p className="font-semibold text-[var(--rich-soil)]">Order with context</p>
                    <p className="mt-1">
                      This product is available to order today, with fulfilment estimated at {product.producerDeliveryLeadTime || 48} hours from {product.producerLocation}.
                    </p>
                  </div>

                  <div className="hidden max-w-2xl gap-3 border-t border-[#e4e1d8] pt-4 text-sm sm:grid sm:grid-cols-3">
                    <div>
                      <p className="text-[var(--muted-foreground)]">Season</p>
                      <p className="font-medium text-[var(--rich-soil)]">{product.seasonalDates || 'Year-round'}</p>
                    </div>
                    <div>
                      <p className="text-[var(--muted-foreground)]">Certification</p>
                      <p className="font-medium text-[var(--rich-soil)]">
                        {product.isOrganic ? product.organicCertification || 'Organic Certified' : 'Non-organic'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--muted-foreground)]">Stock</p>
                      <p className="font-medium text-[var(--rich-soil)]">{product.stock} {product.unit}</p>
                    </div>
                  </div>
                </div>
                </div>

                <aside className="rounded-3xl border border-[#dfe8d9] bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    {product.isSurplus && product.surplusDiscount && product.surplusOriginalPrice && product.surplusExpiresAt && product.surplusBestBefore ? (
                      <div className="space-y-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-semibold text-[var(--forest-green)]">£{product.price.toFixed(2)}</span>
                          <span className="text-lg text-[var(--warm-earth)]">per {product.unit}</span>
                        </div>
                        <SurplusInfo
                          discount={product.surplusDiscount}
                          originalPrice={product.surplusOriginalPrice}
                          currentPrice={product.price}
                          expiresAt={product.surplusExpiresAt}
                          bestBefore={product.surplusBestBefore}
                          unit={product.unit}
                        />
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold text-[var(--forest-green)]">£{product.price.toFixed(2)}</span>
                        <span className="text-lg text-[var(--warm-earth)]">per {product.unit}</span>
                      </div>
                    )}
                    {product.stock > 0 && product.availability !== 'unavailable' ? (
                      <Badge variant="secondary">Available to order</Badge>
                    ) : (
                      <Badge variant="outline">Out of stock</Badge>
                    )}
	                  </div>

                  <div className="mt-4 grid gap-2 border-t border-[#dfe8d9] pt-4 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--muted-foreground)]">Order status</span>
                      <span className="font-semibold text-[var(--rich-soil)]">
                        {product.stock > 0 && product.availability !== 'unavailable' ? 'Available to order' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--muted-foreground)]">Estimated fulfilment</span>
                      <span className="font-semibold text-[var(--rich-soil)]">
                        {product.producerDeliveryLeadTime || 48} hours
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[var(--muted-foreground)]">Stock</span>
                      <span className="font-semibold text-[var(--rich-soil)]">
                        {product.stock} {formatUnit(product.unit, product.stock)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-[#dfe8d9] pt-4">
                    <p className="text-sm font-semibold text-[var(--rich-soil)]">Sign in to buy now or add to cart.</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button asChild>
                        <Link to="/login">
                          Sign In to Buy Now
                          <ArrowRight className="ml-2 size-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/select-portal?mode=register">Create Account</Link>
                      </Button>
                    </div>
                  </div>

                  {product.allergens.length > 0 && (
                    <div className="mt-4 border-t border-orange-200 pt-3 text-sm leading-6 text-orange-900">
                      <span className="font-semibold">Allergen information:</span> {product.allergens.join(', ')}
                    </div>
                  )}
                </aside>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <Card id="recipes" className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <ChefHat className="size-5 text-[var(--forest-green)]" />
                    <h3 className="text-xl font-semibold text-[var(--rich-soil)]">Recipe Suggestions</h3>
                  </div>
                  {product.recipeIdeas && product.recipeIdeas.length > 0 ? (
                    <div className="space-y-2">
                      {product.recipeIdeas.map((recipe) => (
                        <div
                          key={recipe}
                          className="rounded-2xl border border-[#e4e1d8] bg-[#fbfaf4] px-4 py-3 text-sm text-[var(--muted-foreground)]"
                        >
                          {recipe}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-dashed border-[#d6cab8] bg-[#fbfaf4] px-4 py-6 text-sm text-[var(--muted-foreground)]">
                      Recipe suggestions coming soon.
                    </p>
                  )}
                  {product.storageTips && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-medium text-emerald-900">Storage Guidance</p>
                      <p className="mt-1 text-sm text-emerald-800">{product.storageTips}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-6">
                <Card id="farm-location" className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-5 text-[var(--forest-green)]" />
                      <h3 className="text-xl font-semibold text-[var(--rich-soil)]">Farm Location</h3>
                    </div>
                    <div className="rounded-2xl border border-[#e4e1d8] bg-[#fbfaf4] p-4">
                      <p className="font-medium text-[var(--rich-soil)]">{product.producerName}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">{product.producerLocation}</p>
                      <p className="mt-3 text-sm font-semibold text-[var(--forest-green)]">
                        {product.foodMiles.toFixed(2)} food miles
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card id="producer" className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-center gap-2">
                      <Sprout className="size-5 text-[var(--forest-green)]" />
                      <h3 className="text-xl font-semibold text-[var(--rich-soil)]">About {product.producerName}</h3>
                    </div>
                    <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                      {product.producerDescription || 'Producer description coming soon.'}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
