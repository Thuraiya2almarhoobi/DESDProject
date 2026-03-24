import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { ProductMeta } from '../components/ProductMeta';
import { SiteHeader } from '../components/SiteHeader';
import { SurplusInfo } from '../components/SurplusInfo';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { fetchPublicMarketplaceProductById } from '../services/productApi';
import { Product } from '../types';

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
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <Button asChild variant="ghost">
          <Link to="/browse">
            <ArrowLeft className="mr-2 size-4" />
            Back to Browse
          </Link>
        </Button>

        {isLoading ? (
          <Card>
            <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_0.95fr]">
              <Skeleton className="aspect-square w-full rounded-3xl" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </CardContent>
          </Card>
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
            <Card className="overflow-hidden border-[oklch(0.87_0.02_145)] bg-white/95 shadow-lg">
              <CardContent className="grid gap-8 p-6 lg:grid-cols-[1fr_0.95fr] lg:p-8">
                <div className="space-y-4">
                  <div className="aspect-square overflow-hidden rounded-3xl bg-[oklch(0.95_0.01_145)]">
                    <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AvailabilityBadge availability={product.availability} />
                    {product.isOrganic && <OrganicBadge />}
                    {product.isSurplus && <SurplusBadge />}
                    {product.stock > 0 ? (
                      <Badge variant="outline">{product.stock} in stock</Badge>
                    ) : (
                      <Badge variant="secondary">Out of stock</Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-[oklch(0.42_0.04_145)]">{product.category}</p>
                    <h1 className="text-4xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)]">{product.name}</h1>
                    <p className="text-lg text-[oklch(0.36_0.03_145)]">{product.producerName}</p>
                    <ProductMeta
                      producerName={product.producerName}
                      producerLocation={product.producerLocation}
                      harvestDate={product.harvestDate}
                      foodMiles={product.foodMiles}
                      seasonalDates={product.seasonalDates}
                    />
                  </div>

                  <div className="rounded-3xl border border-[oklch(0.9_0.02_145)] bg-[oklch(0.985_0.006_145)] p-5">
                    {product.isSurplus && product.surplusDiscount && product.surplusOriginalPrice && product.surplusExpiresAt && product.surplusBestBefore ? (
                      <div className="space-y-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-semibold text-green-700">£{product.price.toFixed(2)}</span>
                          <span className="text-sm text-[oklch(0.45_0.03_145)]">/{product.unit}</span>
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
                        <span className="text-3xl font-semibold text-green-700">£{product.price.toFixed(2)}</span>
                        <span className="text-sm text-[oklch(0.45_0.03_145)]">/{product.unit}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h2 className="text-lg font-semibold text-[oklch(0.24_0.02_145)]">Product description</h2>
                    <p className="text-sm leading-7 text-[oklch(0.36_0.03_145)]">{product.description}</p>
                  </div>

                  {product.allergens.length > 0 && (
                    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm leading-6 text-orange-900">
                      <span className="font-semibold">Allergen information:</span> {product.allergens.join(', ')}
                    </div>
                  )}

                  <div className="rounded-3xl border border-[oklch(0.85_0.03_145)] bg-[linear-gradient(145deg,white,oklch(0.985_0.01_145))] p-5">
                    <p className="text-sm font-semibold text-[oklch(0.24_0.02_145)]">Ordering is disabled in public browse.</p>
                    <p className="mt-2 text-sm leading-6 text-[oklch(0.36_0.03_145)]">
                      Sign in with a customer, community, or restaurant account to add this product to cart and complete checkout.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button asChild>
                        <Link to="/login">
                          Sign In to Order
                          <ArrowRight className="ml-2 size-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link to="/select-portal?mode=register">Create Account</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
