import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, ShoppingCart, Plus, Minus, ChefHat, Refrigerator, MapPin, Sprout, AlertCircle } from 'lucide-react';
import { fetchProductById, fetchProductReviews } from '../api/catalog';
import { Product, ProductReview } from '../types';
import { useCart } from '../contexts/CartContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Card, CardContent } from '../components/ui/card';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { ProductMeta } from '../components/ProductMeta';
import { AllergenBlock } from '../components/AllergenBlock';
import { FarmLocationMap } from '../components/FarmLocationMap';
import { SurplusInfo } from '../components/SurplusInfo';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { Skeleton } from '../components/ui/skeleton';
import { toast } from 'sonner';

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [hasReviewsError, setHasReviewsError] = useState(false);
  const [hasReviewedAllergens, setHasReviewedAllergens] = useState(false);

  useEffect(() => {
    if (!id) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setHasError(false);

    fetchProductById(id)
      .then((apiProduct) => {
        if (!isCancelled) {
          setProduct(apiProduct);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHasError(true);
          setProduct(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      setIsReviewsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsReviewsLoading(true);
    setHasReviewsError(false);

    fetchProductReviews(id)
      .then((apiReviews) => {
        if (!isCancelled) {
          setReviews(apiReviews);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setReviews([]);
          setHasReviewsError(true);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsReviewsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!product) {
      setHasReviewedAllergens(false);
      return;
    }

    if (product.allergens.length === 0) {
      setHasReviewedAllergens(true);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    setHasReviewedAllergens(
      window.localStorage.getItem(`allergen-reviewed-${product.id}`) === 'true'
    );
  }, [product]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="size-4 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (hasError || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <AlertCircle className="size-10 text-red-500 mx-auto" />
          <p className="text-gray-700 font-medium">Failed to load product details</p>
          <p className="text-sm text-gray-500">Please return to marketplace and try again.</p>
          <Button onClick={() => navigate('/marketplace')}>
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const isAvailable = product.availability !== 'unavailable' && product.stock > 0;
  const maxQuantity = Math.min(product.stock, 99);
  const producerDeliveryLeadTime = product.producerDeliveryLeadTime || 48;
  const requiresAllergenReview = product.allergens.length > 0;

  const handleAddToCart = () => {
    if (!isAvailable) return;
    if (requiresAllergenReview && !hasReviewedAllergens) {
      toast.warning('Please acknowledge allergen information before adding to cart.');
      return;
    }

    addToCart(product, quantity);
    toast.success(`Added ${quantity} ${product.unit} of ${product.name} to cart`);
  };

  const handleAllergenReviewToggle = (checked: boolean) => {
    setHasReviewedAllergens(checked);

    if (typeof window !== 'undefined' && requiresAllergenReview) {
      window.localStorage.setItem(`allergen-reviewed-${product.id}`, checked ? 'true' : 'false');
    }
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </header>

      {/* Product Detail */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Title and Badges */}
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <AvailabilityBadge availability={product.availability} />
                {product.isOrganic && <OrganicBadge />}
                {product.isSurplus && <SurplusBadge />}
              </div>
              <h1 className="text-3xl font-semibold mb-2">{product.name}</h1>
              <p className="text-gray-600">{product.description}</p>
            </div>

            {/* Producer Meta */}
            <ProductMeta
              producerName={product.producerName}
              producerLocation={product.producerLocation}
              harvestDate={product.harvestDate}
              foodMiles={product.foodMiles}
            />

            <Separator />

            {/* Price */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-green-700">
                  £{product.price.toFixed(2)}
                </span>
                <span className="text-xl text-gray-500">per {product.unit}</span>
              </div>
              {product.stock > 0 && product.stock < 10 && (
                <p className="text-sm text-orange-600 mt-2">
                  Only {product.stock} {product.unit} remaining
                </p>
              )}
            </div>

            {/* Allergen Warning (TC-015) */}
            <AllergenBlock allergens={product.allergens} />
            <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="allergen-review-confirmation"
                  checked={hasReviewedAllergens}
                  onCheckedChange={(checked) => handleAllergenReviewToggle(checked === true)}
                  className="mt-0.5"
                  aria-label="Confirm allergen information has been reviewed"
                />
                <div className="space-y-1">
                  <Label htmlFor="allergen-review-confirmation" className="font-medium">
                    I have reviewed this product&apos;s allergen information
                  </Label>
                  <p className="text-xs text-gray-600">
                    {requiresAllergenReview
                      ? 'Required before adding this item to cart.'
                      : 'No allergens are listed for this product.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            {isAvailable && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <div className="w-20 text-center">
                    <span className="text-lg font-medium">{quantity}</span>
                    <span className="text-sm text-gray-500 ml-1">{product.unit}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={incrementQuantity}
                    disabled={quantity >= maxQuantity}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Add to Cart Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handleAddToCart}
              disabled={!isAvailable}
            >
              <ShoppingCart className="size-5 mr-2" />
              {isAvailable ? 'Add to Cart' : 'Currently Unavailable'}
            </Button>

            <Separator />

            {/* Additional Details */}
            <div className="space-y-4">
              <h3 className="font-semibold">About this product</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Category</p>
                  <p className="font-medium">{product.category}</p>
                </div>
                <div>
                  <p className="text-gray-500">Season</p>
                  <p className="font-medium">{product.seasonalDates || 'Year-round'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Certification</p>
                  <p className="font-medium">
                    {product.isOrganic
                      ? product.organicCertification || 'Organic Certified'
                      : 'Non-organic'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Stock</p>
                  <p className="font-medium">
                    {product.stock > 0 ? `${product.stock} ${product.unit} available` : 'Out of stock'}
                  </p>
                </div>
              </div>
            </div>

            {/* Producer Info Card */}
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold mb-2">From {product.producerName}</h4>
                <p className="text-sm text-gray-600 mb-2">Located in {product.producerLocation}</p>
                <p className="text-sm text-gray-500">
                  Delivery lead time: {producerDeliveryLeadTime} hours minimum
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews Section (TC-024 scaffold) */}
        <section className="mt-8">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-xl font-semibold">Reviews</h3>
                <Button variant="outline" size="sm" disabled>
                  Write review (coming soon)
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Verified-purchase review submission is pending order/delivery integration.
              </p>

              {isReviewsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : hasReviewsError ? (
                <div className="text-sm text-gray-600">
                  Reviews are temporarily unavailable.
                </div>
              ) : reviews.length === 0 ? (
                <div className="text-sm text-gray-600">No reviews yet for this product.</div>
              ) : (
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <div key={review.id} className="border rounded-lg p-3 space-y-2 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{review.reviewerName}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-600">{'★'.repeat(review.rating)}</span>
                          {review.verifiedPurchase && (
                            <Badge variant="secondary" className="text-xs">
                              Verified purchase
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{review.comment || 'No written comment.'}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Additional Information */}
        <div className="mt-8">
          <Accordion type="single" collapsible className="space-y-2">
            {/* Farm Location */}
            <AccordionItem value="location" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <MapPin className="size-5 text-green-600" />
                  <span className="font-medium">Farm Location</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <FarmLocationMap
                  producerName={product.producerName}
                  location={product.producerLocation}
                  postcode={product.producerPostcode}
                  coordinates={product.producerCoordinates}
                  foodMiles={product.foodMiles}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Storage Tips */}
            {product.storageTips && (
              <AccordionItem value="storage" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Refrigerator className="size-5 text-green-600" />
                    <span className="font-medium">Storage Tips</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <p className="text-sm text-gray-600">{product.storageTips}</p>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Recipe Ideas */}
            {product.recipeIdeas && product.recipeIdeas.length > 0 && (
              <AccordionItem value="recipes" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <ChefHat className="size-5 text-green-600" />
                    <span className="font-medium">Recipe Ideas</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <ul className="space-y-2">
                    {product.recipeIdeas.map((recipe, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="size-1.5 rounded-full bg-green-600" />
                        {recipe}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Surplus Info */}
            {product.isSurplus && product.surplusDiscount && product.surplusOriginalPrice && product.surplusExpiresAt && product.surplusBestBefore && (
              <AccordionItem value="surplus" className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">Surplus Deal</Badge>
                    <span className="font-medium">Why is this discounted?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      This item is discounted to reduce food waste while still in safe, good condition.
                    </p>
                    <SurplusInfo
                      discount={product.surplusDiscount}
                      originalPrice={product.surplusOriginalPrice}
                      currentPrice={product.price}
                      expiresAt={product.surplusExpiresAt}
                      bestBefore={product.surplusBestBefore}
                      unit={product.unit}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Producer Information */}
            <AccordionItem value="producer" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Sprout className="size-5 text-green-600" />
                  <span className="font-medium">About {product.producerName}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    {product.producerDescription || 'Producer description coming soon.'}
                  </p>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500">
                      Delivery lead time: {producerDeliveryLeadTime} hours minimum
                    </p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </main>
    </div>
  );
}
