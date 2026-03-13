import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  ChefHat,
  MapPin,
  Sprout,
  AlertCircle,
  Star,
  User as UserIcon,
  CreditCard,
  Trash2,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { AvailabilityBadge, OrganicBadge } from '../components/ProductBadges';
import { ProductMeta } from '../components/ProductMeta';
import { AllergenBlock } from '../components/AllergenBlock';
import { FarmLocationMap } from '../components/FarmLocationMap';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui/accordion';
import { SiteHeader } from '../components/SiteHeader';
import { toast } from 'sonner';
import { Product, ProductReview } from '../types';
import { createProductReview, fetchProductById, fetchProductReviews } from '../api/catalog';
import { getDashboardPathForRole } from '../lib/roleRouting';
import { useSafeBack } from '../lib/navigation';
import { ApiRecipe, apiJson } from '../lib/api';

function formatReviewDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Date unavailable';
  }

  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

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

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goBack = useSafeBack('/marketplace');
  const {
    addToCartAndWait,
    removeFromCartAndWait,
    isProductInCart,
    getProductCartQuantity,
    prepareSingleItemCheckout,
  } = useCart();
  const { user } = useAuth();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [hasReviewsError, setHasReviewsError] = useState(false);
  const [hasReviewedAllergens, setHasReviewedAllergens] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFormError, setReviewFormError] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [activeCartAction, setActiveCartAction] = useState<'add' | 'buy' | 'remove' | null>(null);
  const [linkedRecipes, setLinkedRecipes] = useState<ApiRecipe[]>([]);
  const [linkedRecipesLoading, setLinkedRecipesLoading] = useState(false);
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<number[]>([]);

  useEffect(() => {
    if (!id) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setHasError(false);

    fetchProductById(id)
      .then((apiProduct) => {
        if (!mounted) {
          return;
        }
        setProduct(apiProduct);
      })
      .catch(() => {
        if (mounted) {
          setHasError(true);
          setProduct(null);
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

  useEffect(() => {
    if (!id) {
      setIsReviewsLoading(false);
      return;
    }

    let mounted = true;
    setIsReviewsLoading(true);
    setHasReviewsError(false);

    fetchProductReviews(id)
      .then((apiReviews) => {
        if (!mounted) {
          return;
        }
        setReviews(apiReviews);
      })
      .catch(() => {
        if (mounted) {
          setReviews([]);
          setHasReviewsError(true);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsReviewsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLinkedRecipes([]);
      setLinkedRecipesLoading(false);
      return;
    }

    let mounted = true;
    setLinkedRecipesLoading(true);

    apiJson<ApiRecipe[]>(`/api/content/products/${id}/recipes/`)
      .then((recipes) => {
        if (!mounted) {
          return;
        }
        setLinkedRecipes(recipes);
      })
      .catch(() => {
        if (mounted) {
          setLinkedRecipes([]);
        }
      })
      .finally(() => {
        if (mounted) {
          setLinkedRecipesLoading(false);
        }
      });

    return () => {
      mounted = false;
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

  const isAvailable = useMemo(() => {
    if (!product) {
      return false;
    }
    return product.availability !== 'unavailable' && product.stock > 0;
  }, [product]);

  const maxQuantity = useMemo(() => {
    if (!product) {
      return 1;
    }
    return Math.min(product.stock, 99);
  }, [product]);

  const requiresAllergenReview = Boolean(product && product.allergens.length > 0);
  const producerDeliveryLeadTime = product?.producerDeliveryLeadTime || 48;
  const hasExistingReview = useMemo(() => {
    if (!user) {
      return false;
    }
    return reviews.some((review) => review.userId === String(user.id));
  }, [reviews, user]);
  const averageRating = useMemo(() => {
    if (reviews.length === 0) {
      return null;
    }
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return total / reviews.length;
  }, [reviews]);
  const isInCart = useMemo(() => {
    if (!product) {
      return false;
    }
    return isProductInCart(product.id);
  }, [isProductInCart, product]);
  const cartQuantity = useMemo(() => {
    if (!product) {
      return 0;
    }
    return getProductCartQuantity(product.id);
  }, [getProductCartQuantity, product]);
  const isCartActionPending = activeCartAction !== null;
  const remainingAddToCartQuantity = useMemo(() => {
    if (!product) {
      return 0;
    }
    return Math.max(0, product.stock - cartQuantity);
  }, [cartQuantity, product]);

  const validateCustomerPurchaseAction = () => {
    if (!product || !isAvailable) {
      return false;
    }
    if (requiresAllergenReview && !hasReviewedAllergens) {
      toast.warning('Please review and acknowledge allergen information before adding to cart.');
      return false;
    }

    if (!user) {
      toast.error('Please sign in to add items to your cart.', {
        action: {
          label: 'Login',
          onClick: () => navigate('/login'),
        },
      });
      return false;
    }

    if (user.role !== 'CUSTOMER') {
      toast.error('Only customer accounts can place orders.', {
        action: {
          label: 'Dashboard',
          onClick: () => navigate(getDashboardPathForRole(user.role)),
        },
      });
      return false;
    }

    if (requiresAllergenReview && !hasReviewedAllergens) {
      toast.warning('Please acknowledge allergen information before adding this item to cart.');
      return false;
    }

    return true;
  };

  const handleAddToCart = async () => {
    if (!product || !validateCustomerPurchaseAction()) {
      return;
    }
    if (remainingAddToCartQuantity <= 0) {
      toast.error(`You already have the maximum available quantity of ${product.name} in your cart.`);
      return;
    }

    setActiveCartAction('add');
    try {
      const quantityToAdd = Math.min(quantity, remainingAddToCartQuantity);
      const cartItemId = await addToCartAndWait(product, quantityToAdd);
      if (!cartItemId) {
        return;
      }
      toast.success(`Added ${quantityToAdd} ${product.unit} of ${product.name} to cart`);
    } finally {
      setActiveCartAction(null);
    }
  };

  const handleBuyNow = async () => {
    if (!product || !validateCustomerPurchaseAction()) {
      return;
    }

    setActiveCartAction('buy');
    try {
      const checkoutReady = await prepareSingleItemCheckout(product, quantity);
      if (!checkoutReady) {
        return;
      }
      navigate('/checkout');
    } finally {
      setActiveCartAction(null);
    }
  };

  const handleRemoveFromCart = async () => {
    if (!product || !isInCart) {
      return;
    }

    setActiveCartAction('remove');
    try {
      const removed = await removeFromCartAndWait(product.id);
      if (removed) {
        toast.success(`${product.name} removed from your cart.`);
      }
    } finally {
      setActiveCartAction(null);
    }
  };

  const handleViewCart = () => {
    navigate('/cart');
  };

  const backToMarketplaceButton = (
    <Button variant="ghost" onClick={goBack}>
      <ArrowLeft className="mr-2 size-4" />
      Back to Marketplace
    </Button>
  );

  const cartActionPanel = isAvailable ? (
    <div className="space-y-4 rounded-2xl border border-[oklch(0.88_0.03_145)] bg-white/85 p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="bg-[oklch(0.96_0.05_150)] text-[oklch(0.34_0.05_145)]">
          Ready for checkout
        </Badge>
        {isInCart && (
          <Badge variant="outline">
            In cart: {cartQuantity} {product?.unit}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={() => void handleBuyNow()} disabled={isCartActionPending}>
          <CreditCard className="size-5" />
          {activeCartAction === 'buy' ? 'Preparing Checkout...' : 'Buy Now'}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => void handleAddToCart()}
          disabled={isCartActionPending || remainingAddToCartQuantity <= 0}
        >
          <ShoppingCart className="size-5" />
          {activeCartAction === 'add'
            ? 'Adding to Cart...'
            : remainingAddToCartQuantity <= 0
              ? 'Max in Cart'
              : 'Add to Cart'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        {isInCart && (
          <Button variant="secondary" onClick={handleViewCart} disabled={isCartActionPending}>
            <ShoppingCart className="size-4" />
            View Cart
          </Button>
        )}
        {isInCart && (
          <Button variant="ghost" onClick={() => void handleRemoveFromCart()} disabled={isCartActionPending}>
            <Trash2 className="size-4" />
            {activeCartAction === 'remove' ? 'Removing...' : 'Remove from Cart'}
          </Button>
        )}
      </div>
    </div>
  ) : (
    <Button className="w-full" size="lg" disabled>
      <ShoppingCart className="mr-2 size-5" />
      Currently Unavailable
    </Button>
  );

  const handleAllergenReviewToggle = (checked: boolean) => {
    if (!product) {
      return;
    }

    setHasReviewedAllergens(checked);
    if (typeof window !== 'undefined' && requiresAllergenReview) {
      window.localStorage.setItem(`allergen-reviewed-${product.id}`, checked ? 'true' : 'false');
    }
  };

  const incrementQuantity = () => {
    if (quantity < maxQuantity) {
      setQuantity((value) => value + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity((value) => value - 1);
    }
  };

  const openReviewForm = () => {
    document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleReviewSubmit = async () => {
    if (!id) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    if (user.role !== 'CUSTOMER') {
      toast.error('Only customer accounts can submit reviews.');
      return;
    }

    if (hasExistingReview) {
      setReviewFormError('You have already reviewed this product.');
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewFormError('Please choose a star rating before submitting.');
      return;
    }

    setReviewFormError('');
    setIsSubmittingReview(true);

    try {
      const createdReview = await createProductReview(id, {
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviews((currentReviews) => [createdReview, ...currentReviews]);
      setReviewRating(0);
      setReviewComment('');
      setHasReviewsError(false);
      toast.success('Your review has been posted.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit review.';
      setReviewFormError(message);
      toast.error(message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const toggleLinkedRecipe = (recipeId: number) => {
    setExpandedRecipeIds((previous) =>
      previous.includes(recipeId)
        ? previous.filter((currentId) => currentId !== recipeId)
        : [...previous, recipeId],
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <SiteHeader />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="mb-6">{backToMarketplaceButton}</div>
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
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <SiteHeader />
        <main className="mx-auto flex max-w-5xl items-center justify-center px-4 py-12">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-4 size-10 text-red-500" />
            <p className="mb-4 text-gray-700">Failed to load product details.</p>
            <div className="flex justify-center">{backToMarketplaceButton}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">{backToMarketplaceButton}</div>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <AvailabilityBadge availability={product.availability} />
                {product.isOrganic && <OrganicBadge />}
              </div>
              <h1 className="text-3xl font-semibold mb-2">{product.name}</h1>
              <p className="text-gray-600">{product.description}</p>
            </div>

            <ProductMeta
              producerName={product.producerName}
              producerLocation={product.producerLocation}
              harvestDate={product.harvestDate}
              foodMiles={product.foodMiles}
            />

            <Separator />

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-green-700">£{product.price.toFixed(2)}</span>
                <span className="text-xl text-gray-500">per {product.unit}</span>
              </div>
              {product.stock > 0 && product.stock < 10 && (
                <p className="text-sm text-orange-600 mt-2">Only {product.stock} {product.unit} remaining</p>
              )}
            </div>

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

            {isAvailable && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Quantity</label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={decrementQuantity}
                    disabled={quantity <= 1 || isCartActionPending}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max={String(maxQuantity)}
                      step="1"
                      value={quantity}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) {
                          return;
                        }
                        setQuantity(Math.max(1, Math.min(maxQuantity, Math.floor(next))));
                      }}
                      className="w-24 text-center"
                      disabled={isCartActionPending}
                    />
                    <span className="text-sm text-gray-500">{product.unit}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={incrementQuantity}
                    disabled={quantity >= maxQuantity || isCartActionPending}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {cartActionPanel}

            <Separator />

            <Card>
              <CardContent className="p-4 space-y-4">
                <h4 className="font-semibold">From {product.producerName}</h4>
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
                    <p className="text-gray-500">Delivery lead time</p>
                    <p className="font-medium">{producerDeliveryLeadTime} hours minimum</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <section className="mt-8">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">Customer Reviews</h3>
                  {averageRating !== null ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <ReviewStars rating={Math.round(averageRating)} />
                      <span className="font-semibold text-gray-900">{averageRating.toFixed(1)}</span>
                      <span className="text-gray-500">
                        ({reviews.length} review{reviews.length === 1 ? '' : 's'})
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No reviews yet</p>
                  )}
                </div>
                {user?.role === 'CUSTOMER' && !hasExistingReview ? (
                  <Button variant="outline" size="sm" onClick={openReviewForm}>
                    Write a review
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled>
                    Write a review
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                New reviews can be submitted by signed-in customer accounts. Verified purchase badges remain limited to existing backend data until catalog products are linked directly to delivered orders.
              </p>

              {!user ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5">
                  <p className="font-medium text-gray-700">Log in to write a review.</p>
                  <p className="mt-1 text-sm text-gray-500">
                    You can browse reviews without signing in, but posting a review requires a customer account.
                  </p>
                  <Button className="mt-4" variant="outline" onClick={() => navigate('/login')}>
                    Login to review
                  </Button>
                </div>
              ) : user.role !== 'CUSTOMER' ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                  Reviews can only be posted from customer accounts.
                </div>
              ) : hasExistingReview ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-800">
                  You have already reviewed this product. Thanks for sharing your feedback.
                </div>
              ) : (
                <div id="review-form" className="rounded-lg border bg-gray-50 p-4 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900">Write your review</p>
                    <p className="text-sm text-gray-500">
                      Rate the product and leave an optional comment. Reviews are posted immediately.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Your rating</Label>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => {
                        const starValue = index + 1;
                        const active = starValue <= reviewRating;
                        return (
                          <button
                            key={starValue}
                            type="button"
                            onClick={() => setReviewRating(starValue)}
                            className="rounded p-1 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                            aria-label={`Rate ${starValue} star${starValue === 1 ? '' : 's'}`}
                          >
                            <Star
                              className={`size-6 ${active ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="review-comment">Comment</Label>
                    <Textarea
                      id="review-comment"
                      placeholder="Tell other customers what you thought about this product."
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value.slice(0, 500))}
                      rows={4}
                    />
                    <p className="text-xs text-gray-500">{reviewComment.length}/500 characters</p>
                  </div>

                  {reviewFormError && <p className="text-sm text-red-600">{reviewFormError}</p>}

                  <div className="flex justify-end">
                    <Button onClick={handleReviewSubmit} disabled={isSubmittingReview || reviewRating === 0}>
                      {isSubmittingReview ? 'Posting review...' : 'Post review'}
                    </Button>
                  </div>
                </div>
              )}

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
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
                  <p className="font-medium text-gray-700">No reviews yet for this product.</p>
                  <p className="mt-2 text-sm text-gray-500">
                    {user?.role === 'CUSTOMER'
                      ? 'Be the first customer to rate and review this item.'
                      : 'Customer reviews will appear here once they are submitted.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div key={review.id} className="border-t pt-6 first:border-t-0 first:pt-0">
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200">
                          <UserIcon className="size-5 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="font-medium">{review.reviewerName}</span>
                            {review.verifiedPurchase && (
                              <Badge variant="secondary" className="text-xs">
                                Verified purchase
                              </Badge>
                            )}
                          </div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <ReviewStars rating={review.rating} />
                            <span className="text-sm text-gray-500">{formatReviewDate(review.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{review.comment || 'No written comment.'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <div className="mt-8">
          <Accordion type="single" collapsible className="space-y-2">
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
                  postcode={product.producerPostcode || ''}
                  coordinates={product.producerCoordinates}
                  foodMiles={product.foodMiles}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="recipes" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <ChefHat className="size-5 text-green-600" />
                  <span className="font-medium">Recipe Suggestions</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {linkedRecipesLoading ? (
                  <p className="text-sm text-gray-600">Loading linked recipes...</p>
                ) : linkedRecipes.length > 0 ? (
                  <div className="space-y-3">
                    {linkedRecipes.map((recipe) => {
                      const isExpanded = expandedRecipeIds.includes(recipe.id);
                      return (
                        <div key={recipe.id} className="rounded-lg border bg-gray-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-gray-900">{recipe.title}</p>
                              <p className="mt-1 text-sm text-gray-600">
                                {recipe.description || `By ${recipe.producer_name}`}
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleLinkedRecipe(recipe.id)}
                            >
                              {isExpanded ? 'Hide Recipe' : 'View Full Recipe'}
                            </Button>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 space-y-3">
                              {recipe.image_url && (
                                <img
                                  src={recipe.image_url}
                                  alt={recipe.title}
                                  className="h-44 w-full rounded-md object-cover"
                                />
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900">Ingredients</p>
                                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                                  {recipe.ingredients}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">Instructions</p>
                                <p className="mt-1 whitespace-pre-line text-sm text-gray-700">
                                  {recipe.instructions}
                                </p>
                              </div>
                              {recipe.linked_products.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-500">Linked products</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {recipe.linked_products.map((linkedProduct) => (
                                      <Button
                                        key={linkedProduct.id}
                                        variant="outline"
                                        size="sm"
                                        onClick={() => navigate(`/product/${linkedProduct.id}`)}
                                      >
                                        {linkedProduct.name}
                                      </Button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : product.recipeIdeas && product.recipeIdeas.length > 0 ? (
                  <div className="space-y-2">
                    {product.recipeIdeas.map((recipe) => (
                      <div key={recipe} className="rounded-md border bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        {recipe}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Recipe suggestions coming soon.</p>
                )}

                {product.storageTips && (
                  <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-900">Storage Guidance</p>
                    <p className="mt-1 text-sm text-emerald-800">{product.storageTips}</p>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

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
                    <Badge variant="secondary">Lead time: {producerDeliveryLeadTime} hours</Badge>
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


