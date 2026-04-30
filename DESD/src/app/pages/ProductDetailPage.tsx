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
import { FarmLocationMap } from '../components/FarmLocationMap';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { SiteHeader } from '../components/SiteHeader';
import { toast } from 'sonner';
import { Product, ProductReview, ReviewEligibility } from '../types';
import {
  createProductReview,
  fetchProductById,
  fetchProductReviewEligibility,
  fetchProductReviews,
  respondToProductReview,
} from '../api/catalog';
import { isBulkBuyerRole, isBuyerRole, MAX_ORDER_ITEM_QUANTITY } from '../lib/ordering';
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

function formatUnit(unit: string, quantity: number): string {
  if (unit === 'litre') {
    return quantity === 1 ? 'litre' : 'litres';
  }
  return unit;
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
  const [reviewEligibility, setReviewEligibility] = useState<ReviewEligibility | null>(null);
  const [isReviewEligibilityLoading, setIsReviewEligibilityLoading] = useState(true);
  const [hasReviewedAllergens, setHasReviewedAllergens] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewIsAnonymous, setReviewIsAnonymous] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [allergenConfirmationError, setAllergenConfirmationError] = useState('');
  const [pendingReviewNotice, setPendingReviewNotice] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [producerReplyDrafts, setProducerReplyDrafts] = useState<Record<string, string>>({});
  const [producerReplyErrors, setProducerReplyErrors] = useState<Record<string, string>>({});
  const [activeProducerReplyId, setActiveProducerReplyId] = useState<string | null>(null);
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
    if (!id) {
      setReviewEligibility(null);
      setIsReviewEligibilityLoading(false);
      return;
    }

    let mounted = true;
    setIsReviewEligibilityLoading(true);

    fetchProductReviewEligibility(id)
      .then((eligibility) => {
        if (!mounted) {
          return;
        }
        setReviewEligibility(eligibility);
      })
      .catch(() => {
        if (mounted) {
          setReviewEligibility(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsReviewEligibilityLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id, user]);

  useEffect(() => {
    if (!product) {
      setHasReviewedAllergens(false);
      setAllergenConfirmationError('');
      return;
    }

    setHasReviewedAllergens(product.allergens.length === 0);
    setAllergenConfirmationError('');
  }, [product]);

  useEffect(() => {
    setProducerReplyDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts };
      for (const review of reviews) {
        if (nextDrafts[review.id] === undefined && review.producerResponse) {
          nextDrafts[review.id] = review.producerResponse;
        }
      }
      return nextDrafts;
    });
  }, [reviews]);

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
    return Math.max(1, Math.min(MAX_ORDER_ITEM_QUANTITY, Math.floor(product.stock)));
  }, [product]);

  const requiresAllergenReview = Boolean(product && product.allergens.length > 0);
  const isBulkBuyer = isBulkBuyerRole(user?.role);
  const producerDeliveryLeadTime = product?.producerDeliveryLeadTime || 48;
  const hasExistingReview = Boolean(reviewEligibility?.hasExistingReview);
  const canSubmitReview = Boolean(reviewEligibility?.canSubmit);
  const canRespondToReviews = Boolean(reviewEligibility?.canRespond);
  const reviewApprovalOutcomeLabel = 'Verified purchase';
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
  const isBlockedByAllergenReview = requiresAllergenReview && !hasReviewedAllergens;
  const remainingAddToCartQuantity = useMemo(() => {
    if (!product) {
      return 0;
    }
    return Math.max(0, Math.min(MAX_ORDER_ITEM_QUANTITY, product.stock) - cartQuantity);
  }, [cartQuantity, product]);

  const validateBuyerPurchaseAction = () => {
    if (!product || !isAvailable) {
      return false;
    }
    if (requiresAllergenReview && !hasReviewedAllergens) {
      setAllergenConfirmationError('Please confirm you have reviewed the allergen information before checkout.');
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

    if (!isBuyerRole(user.role)) {
      toast.error('This portal does not support marketplace ordering.', {
        action: {
          label: 'Dashboard',
          onClick: () => navigate(getDashboardPathForRole(user.role)),
        },
      });
      return false;
    }

    return true;
  };

  const handleAddToCart = async () => {
    if (!product || !validateBuyerPurchaseAction()) {
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
      toast.success(
        `Added ${quantityToAdd} ${product.unit} of ${product.name} to ${isBulkBuyer ? 'your order cart' : 'cart'}`,
      );
    } finally {
      setActiveCartAction(null);
    }
  };

  const handleBuyNow = async () => {
    if (!product || !validateBuyerPurchaseAction()) {
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
    <div className="space-y-3">
      {(isBulkBuyer || isInCart) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          {isBulkBuyer && <span>{user?.role === 'COMMUNITY' ? 'Community bulk ordering' : 'Restaurant order planning'}</span>}
          {isInCart && <span>In cart: {cartQuantity} {product?.unit}</span>}
        </div>
      )}

      {isBulkBuyer && (
        <div className="rounded-2xl border border-[#e4e1d8] bg-[#fffdf8] p-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">
            {user?.role === 'COMMUNITY' ? 'Community ordering workspace' : 'Restaurant ordering workspace'}
          </p>
          <p className="mt-1">
            Build larger producer orders here, then continue through the dedicated {user?.role === 'COMMUNITY' ? 'bulk checkout' : 'restaurant checkout'} flow.
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Maximum quantity per product: {MAX_ORDER_ITEM_QUANTITY} units.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          size="lg"
          onClick={() => void handleBuyNow()}
          disabled={isCartActionPending || isBlockedByAllergenReview}
          className="h-10"
        >
          <CreditCard className="size-5" />
          {activeCartAction === 'buy'
            ? 'Preparing Checkout...'
            : isBulkBuyer
              ? user?.role === 'COMMUNITY'
                ? 'Review Community Checkout'
                : 'Review Restaurant Checkout'
              : 'Buy Now'}
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => void handleAddToCart()}
          disabled={isCartActionPending || isBlockedByAllergenReview || remainingAddToCartQuantity <= 0}
          className="h-10"
        >
          <ShoppingCart className="size-5" />
          {activeCartAction === 'add'
            ? 'Adding to Cart...'
            : remainingAddToCartQuantity <= 0
              ? 'Max in Cart'
              : isBulkBuyer
                ? user?.role === 'COMMUNITY'
                  ? 'Add to Community Order'
                  : 'Add to Restaurant Cart'
                : 'Add to Cart'}
        </Button>
      </div>

      {isBulkBuyer && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 10))}
            disabled={quantity >= maxQuantity || isCartActionPending}
          >
            +10
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuantity(maxQuantity)}
            disabled={quantity >= maxQuantity || isCartActionPending}
          >
            Use Max ({maxQuantity})
          </Button>
        </div>
      )}

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
    if (checked) {
      setAllergenConfirmationError('');
    } else if (requiresAllergenReview) {
      setAllergenConfirmationError('Please confirm you have reviewed the allergen information before checkout.');
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

  const refreshReviewEligibility = async () => {
    if (!id) {
      return;
    }

    try {
      const eligibility = await fetchProductReviewEligibility(id);
      setReviewEligibility(eligibility);
    } catch {
      setReviewEligibility(null);
    }
  };

  const openReviewForm = () => {
    if (!canSubmitReview) {
      if (!user) {
        navigate('/login');
        return;
      }
      if (reviewEligibility?.reason) {
        toast.info(reviewEligibility.reason);
      }
      return;
    }
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

    if (!canSubmitReview) {
      const reason = reviewEligibility?.reason || 'You cannot review this product yet.';
      setReviewFormError(reason);
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewFormError('Please choose a star rating before submitting.');
      return;
    }

    if (!reviewTitle.trim()) {
      setReviewFormError('Please add a short review title before submitting.');
      return;
    }

    setReviewFormError('');
    setIsSubmittingReview(true);

    try {
      const createdReview = await createProductReview(id, {
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        isAnonymous: reviewIsAnonymous,
      });
      if (createdReview.moderationStatus === 'pending') {
        setPendingReviewNotice('Your review was submitted and is waiting for approval.');
        toast.success('Your review was submitted and is waiting for approval.');
      } else {
        setPendingReviewNotice('');
        setReviews((currentReviews) => [createdReview, ...currentReviews]);
        toast.success('Your review is now live on this product.');
      }
      setReviewRating(0);
      setReviewTitle('');
      setReviewComment('');
      setReviewIsAnonymous(false);
      setHasReviewsError(false);
      await refreshReviewEligibility();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to submit review.';
      setReviewFormError(message);
      toast.error(message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleProducerResponseSubmit = async (reviewId: string) => {
    if (!id) {
      return;
    }

    const responseText = (producerReplyDrafts[reviewId] || '').trim();
    if (!responseText) {
      setProducerReplyErrors((current) => ({
        ...current,
        [reviewId]: 'Producer response cannot be empty.',
      }));
      return;
    }

    setProducerReplyErrors((current) => ({ ...current, [reviewId]: '' }));
    setActiveProducerReplyId(reviewId);

    try {
      const updatedReview = await respondToProductReview(id, reviewId, {
        producer_response: responseText,
      });
      setReviews((currentReviews) =>
        currentReviews.map((review) => (review.id === reviewId ? updatedReview : review)),
      );
      toast.success('Producer response saved.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save producer response.';
      setProducerReplyErrors((current) => ({
        ...current,
        [reviewId]: message,
      }));
      toast.error(message);
    } finally {
      setActiveProducerReplyId(null);
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

  const displayedAverageRating = averageRating ?? product.averageRating ?? null;
  const displayedReviewCount = reviews.length || product.reviewCount || 0;
  const displayedVerifiedReviewCount =
    reviews.filter((review) => review.verifiedPurchase).length || product.verifiedReviewCount || 0;
  const firstReview = reviews[0];
  const recipeCount = linkedRecipes.length || product.recipeIdeas?.length || 0;

  return (
    <div className="min-h-screen bg-[#f3fbf1]">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 lg:px-6">
        <div className="mb-6">{backToMarketplaceButton}</div>

        <section>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="grid gap-5 sm:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)] lg:h-[28.5rem] xl:h-[29rem]">
              <div className="space-y-4">
                <div className="relative h-36 overflow-hidden rounded-3xl bg-[#f2efe5] sm:h-[24rem] lg:h-[24rem] xl:h-[24.5rem]">
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <AvailabilityBadge availability={product.availability} />
                    {product.isOrganic && <OrganicBadge />}
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
                      {recipeCount ? `${recipeCount} idea${recipeCount === 1 ? '' : 's'}` : 'Coming soon'}
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-3 lg:h-full">
                <div className="space-y-3">
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
                    href="#reviews"
                    className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[#d6cab8] bg-[#fbfaf4] px-4 py-2 text-sm transition hover:border-[var(--forest-green)]"
                  >
                    {displayedAverageRating !== null ? (
                      <>
                        <ReviewStars rating={Math.round(displayedAverageRating)} />
                        <span className="font-semibold text-[var(--rich-soil)]">{displayedAverageRating.toFixed(1)}</span>
                        <span className="text-[var(--warm-earth)]">
                          {displayedReviewCount} review{displayedReviewCount === 1 ? '' : 's'}
                        </span>
                        {displayedVerifiedReviewCount > 0 && (
                          <span className="text-[var(--earth-accent)]">{displayedVerifiedReviewCount} verified</span>
                        )}
                      </>
                    ) : (
                      <>
                        <ReviewStars rating={0} />
                        <span className="font-semibold text-[var(--rich-soil)]">No customer ratings yet</span>
                      </>
                    )}
                  </a>

                  {firstReview && (
                    <div className="max-w-2xl border-l-2 border-[#d6cab8] pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <ReviewStars rating={firstReview.rating} iconClassName="size-3.5" />
                        <span className="text-sm font-medium text-[var(--rich-soil)]">{firstReview.title || 'Recent review'}</span>
                        {firstReview.verifiedPurchase && <Badge variant="secondary">Verified</Badge>}
                      </div>
                      <p className="mt-2 max-h-10 overflow-hidden text-sm text-[var(--warm-earth)]">
                        {firstReview.comment || `${firstReview.reviewerName} rated this product ${firstReview.rating} stars.`}
                      </p>
                    </div>
                  )}
                </div>

                <div className="hidden max-w-2xl rounded-3xl bg-[#f5fbef] px-4 py-3 text-sm leading-6 text-[var(--warm-earth)] sm:block">
                  <p className="font-semibold text-[var(--rich-soil)]">Order with context</p>
                  <p className="mt-1">
                    This product is available to order today, with fulfilment estimated at {producerDeliveryLeadTime} hours from {product.producerLocation}.
                  </p>
                </div>

                <div className="hidden max-w-2xl gap-3 border-t border-[#e4e1d8] pt-4 text-sm sm:grid sm:grid-cols-3">
                  <div>
                    <p className="text-[var(--muted-foreground)]">Season</p>
                    <p className="font-medium text-[var(--rich-soil)]">{product.seasonalDates || 'Year-round'}</p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Lead time</p>
                    <p className="font-medium text-[var(--rich-soil)]">{producerDeliveryLeadTime} hours</p>
                  </div>
                  <div>
                    <p className="text-[var(--muted-foreground)]">Stock</p>
                    <p className="font-medium text-[var(--rich-soil)]">
                      {product.stock} {formatUnit(product.unit, product.stock)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-3xl border border-[#dfe8d9] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--earth-accent)]">Order</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-[var(--forest-green)]">£{product.price.toFixed(2)}</span>
                    <span className="text-lg text-[var(--warm-earth)]">per {product.unit}</span>
                  </div>
                  {product.stock > 0 && product.stock < 10 && (
                    <p className="mt-2 text-sm text-orange-700">Only {product.stock} {product.unit} remaining</p>
                  )}
                </div>
                <Badge variant={isAvailable ? 'secondary' : 'outline'}>
                  {isAvailable ? 'Available to order' : 'Unavailable'}
                </Badge>
              </div>

              <div className="mt-2 grid gap-1 border-t border-[#dfe8d9] pt-2.5 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted-foreground)]">Order status</span>
                  <span className="font-semibold text-[var(--rich-soil)]">
                    {isAvailable ? 'Available to order' : 'Unavailable'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted-foreground)]">Estimated fulfilment</span>
                  <span className="font-semibold text-[var(--rich-soil)]">{producerDeliveryLeadTime} hours</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[var(--muted-foreground)]">Stock</span>
                  <span className="font-semibold text-[var(--rich-soil)]">
                    {product.stock} {formatUnit(product.unit, product.stock)}
                  </span>
                </div>
              </div>

              {isAvailable && (
                <div className="mt-4 flex items-center justify-between gap-5">
                  <label className="shrink-0 text-sm font-medium text-[var(--rich-soil)]">Quantity</label>
                  <div className="inline-flex items-center overflow-hidden rounded-2xl border border-[#d6cab8] bg-[#fffdf8]">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={decrementQuantity}
                      disabled={quantity <= 1 || isCartActionPending}
                      aria-label="Decrease quantity"
                      className="rounded-none"
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      aria-label={`Quantity in ${formatUnit(product.unit, quantity)}`}
                      value={quantity}
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => {
                        const next = Number(event.target.value.replace(/\D/g, ''));
                        if (!Number.isFinite(next)) {
                          return;
                        }
                        setQuantity(Math.max(1, Math.min(maxQuantity, Math.floor(next || 1))));
                      }}
                      className="h-10 w-16 rounded-none border-0 bg-transparent text-center shadow-none focus-visible:ring-0"
                      disabled={isCartActionPending}
                    />
                    <span className="border-l border-r border-[#d6cab8] px-5 text-sm text-[var(--warm-earth)]">
                      {formatUnit(product.unit, quantity)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={incrementQuantity}
                      disabled={quantity >= maxQuantity || isCartActionPending}
                      aria-label="Increase quantity"
                      className="rounded-none"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                </div>
              )}

              {requiresAllergenReview && (
                <div className="mt-2.5 space-y-2 border-t border-[#dfe8d9] pt-2.5">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-3 py-2 text-sm text-orange-900">
                    <p className="font-semibold">Allergen warning</p>
                    <p className="mt-1">Contains: <strong>{product.allergens.join(', ')}</strong></p>
                  </div>
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-3 py-2">
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
                        <p className="text-xs text-gray-600">Required before checkout.</p>
                      </div>
                    </div>
                  </div>
                  {allergenConfirmationError && (
                    <p className="text-sm font-medium text-red-700">
                      {allergenConfirmationError}
                    </p>
                  )}
                </div>
              )}

              <div className={requiresAllergenReview ? 'mt-2.5' : 'mt-5 border-t border-[#dfe8d9] pt-4'}>
                {cartActionPanel}
              </div>
            </aside>
          </div>
        </section>

        <section id="reviews" className="mt-8 lg:mt-10">
          <Card className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
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
                      {reviews.some((review) => review.verifiedPurchase) && (
                        <span className="text-gray-500">
                          {reviews.filter((review) => review.verifiedPurchase).length} verified
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No reviews yet</p>
                  )}
                </div>
                {user?.role === 'CUSTOMER' && canSubmitReview ? (
                  <Button variant="outline" size="sm" onClick={openReviewForm}>
                    Write a review
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled={isReviewEligibilityLoading}>
                    {user?.role === 'PRODUCER' && canRespondToReviews ? 'Respond as producer below' : 'Write a review'}
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Reviews use a clear 1 to 5 star scale. Only logged-in customers with a delivered purchase can submit a review. Verified purchases are labelled clearly, and suspicious reviews can still be held for approval.
              </p>
              {pendingReviewNotice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {pendingReviewNotice}
                </div>
              )}

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
                  {canRespondToReviews
                    ? 'Customers review here, and you can reply beneath published reviews as the producer.'
                    : 'Reviews can only be posted from customer accounts.'}
                </div>
              ) : hasExistingReview ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-800">
                  {reviewEligibility?.reason || 'You have already reviewed this product. Thanks for sharing your feedback.'}
                </div>
              ) : isReviewEligibilityLoading ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                  Checking review eligibility...
                </div>
              ) : !canSubmitReview ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                  {reviewEligibility?.reason || 'You cannot review this product yet.'}
                </div>
              ) : (
                <div id="review-form" className="rounded-lg border bg-gray-50 p-4 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900">Write your review</p>
                    <p className="text-sm text-gray-500">
                      Rate the product from 1 to 5 stars, add a short title, and leave an optional comment. Because this review comes from a delivered order, it will show as {reviewApprovalOutcomeLabel}.
                    </p>
                  </div>
                  {reviewEligibility?.reason && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      {reviewEligibility.reason}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Your rating (1 to 5 stars)</Label>
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
                    <Label htmlFor="review-title">Review title</Label>
                    <Input
                      id="review-title"
                      placeholder="Excellent quality and flavour"
                      value={reviewTitle}
                      onChange={(event) => setReviewTitle(event.target.value.slice(0, 120))}
                    />
                    <p className="text-xs text-gray-500">{reviewTitle.length}/120 characters</p>
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

                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="review-anonymous"
                        checked={reviewIsAnonymous}
                        onCheckedChange={(checked) => setReviewIsAnonymous(checked === true)}
                        aria-label="Post review anonymously"
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="review-anonymous" className="font-medium">
                          Post this review anonymously
                        </Label>
                        <p className="text-xs text-gray-600">
                          If selected, other customers will see “Anonymous” instead of your name.
                        </p>
                      </div>
                    </div>
                  </div>

                  {reviewFormError && <p className="text-sm text-red-600">{reviewFormError}</p>}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleReviewSubmit}
                      disabled={isSubmittingReview || reviewRating === 0 || !reviewTitle.trim()}
                    >
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
                            <Badge variant="secondary" className="text-xs">
                              {review.verifiedPurchase ? 'Verified purchase' : 'Unverified purchase'}
                            </Badge>
                          </div>
                          {review.title && <p className="text-sm font-semibold text-gray-900">{review.title}</p>}
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <ReviewStars rating={review.rating} />
                            <span className="text-sm text-gray-500">{formatReviewDate(review.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700">{review.comment || 'No written comment.'}</p>
                          {review.producerResponse && (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-emerald-900">Producer response</span>
                                {review.producerResponseAt && (
                                  <span className="text-xs text-emerald-800">
                                    {formatReviewDate(review.producerResponseAt)}
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-emerald-900">{review.producerResponse}</p>
                            </div>
                          )}
                          {canRespondToReviews && (
                            <div className="mt-4 rounded-lg border bg-gray-50 p-4 space-y-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {review.producerResponse ? 'Update producer response' : 'Respond as producer'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Producer replies help customers understand how feedback is being addressed.
                                </p>
                              </div>
                              <Textarea
                                value={producerReplyDrafts[review.id] ?? ''}
                                onChange={(event) =>
                                  setProducerReplyDrafts((current) => ({
                                    ...current,
                                    [review.id]: event.target.value.slice(0, 1000),
                                  }))
                                }
                                rows={3}
                                placeholder="Write a helpful response to this review."
                              />
                              {producerReplyErrors[review.id] && (
                                <p className="text-sm text-red-600">{producerReplyErrors[review.id]}</p>
                              )}
                              <div className="flex justify-end">
                                <Button
                                  variant="outline"
                                  onClick={() => void handleProducerResponseSubmit(review.id)}
                                  disabled={activeProducerReplyId === review.id}
                                >
                                  {activeProducerReplyId === review.id ? 'Saving response...' : 'Save response'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card id="recipes" className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <ChefHat className="size-5 text-[var(--forest-green)]" />
                    <h3 className="text-xl font-semibold text-[var(--rich-soil)]">Recipe Suggestions</h3>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Linked ideas and storage notes for cooking with this product.
                  </p>
                </div>
                <Badge variant="outline" className="border-[#d6cab8] bg-[#fbfaf4] text-[var(--rich-soil)]">
                  {recipeCount} {recipeCount === 1 ? 'idea' : 'ideas'}
                </Badge>
              </div>

              {linkedRecipesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : linkedRecipes.length > 0 ? (
                <div className="space-y-3">
                  {linkedRecipes.map((recipe) => {
                    const isExpanded = expandedRecipeIds.includes(recipe.id);
                    return (
                      <div key={recipe.id} className="rounded-2xl border border-[#e4e1d8] bg-[#fbfaf4] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
	                            <div className="flex flex-wrap items-center gap-2">
	                              <p className="font-medium text-[var(--rich-soil)]">{recipe.title}</p>
	                              {recipe.is_ai_generated && (
	                                <Badge variant="outline" className="border-[#d6cab8] bg-white text-[var(--earth-accent)]">
	                                  AI generated
	                                </Badge>
	                              )}
	                            </div>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
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
                                className="h-44 w-full rounded-xl object-cover"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium text-[var(--rich-soil)]">Ingredients</p>
                              <p className="mt-1 whitespace-pre-line text-sm text-[var(--muted-foreground)]">
                                {recipe.ingredients}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[var(--rich-soil)]">Instructions</p>
                              <p className="mt-1 whitespace-pre-line text-sm text-[var(--muted-foreground)]">
                                {recipe.instructions}
                              </p>
                            </div>
                            {recipe.linked_products.length > 0 && (
                              <div>
                                <p className="text-xs text-[var(--muted-foreground)]">Linked products</p>
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
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-[var(--forest-green)]" />
                    <h3 className="text-xl font-semibold text-[var(--rich-soil)]">Farm Location</h3>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    Origin and distance are kept visible for local buying decisions.
                  </p>
                </div>
                <FarmLocationMap
                  producerName={product.producerName}
                  location={product.producerLocation}
                  postcode={product.producerPostcode || ''}
                  coordinates={product.producerCoordinates}
                  foodMiles={product.foodMiles}
                />
              </CardContent>
            </Card>

            <Card id="producer" className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Sprout className="size-5 text-[var(--forest-green)]" />
                    <h3 className="text-xl font-semibold text-[var(--rich-soil)]">About {product.producerName}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
                    {product.producerDescription || 'Producer description coming soon.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[#e4e1d8] pt-4">
                  <Badge variant="secondary">Lead time: {producerDeliveryLeadTime} hours</Badge>
                  <Badge variant="outline" className="border-[#d6cab8]">
                    {product.producerLocation}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}


