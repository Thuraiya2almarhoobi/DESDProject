/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ProductDetailPage browser route and coordinates the UI state for that screen.
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
import { Link, useParams, useNavigate, useSearchParams } from 'react-router';
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  ChefHat,
  MapPin,
  Sprout,
  AlertCircle,
  Flag,
  Star,
  User as UserIcon,
  CreditCard,
  Bookmark,
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
  updateProductReview,
} from '../api/catalog';
import { getQuantityCapForRole, isBulkBuyerRole, isBuyerRole } from '../lib/ordering';
import { getDashboardPathForRole } from '../lib/roleRouting';
import { useSafeBack } from '../lib/navigation';
import { ApiRecipe, apiJson } from '../lib/api';
import { fetchMyModerationReportStatus, ModerationTargetType, reportModerationTarget } from '../lib/moderation';

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

/**
 * ReviewStars boundary.
 *
 * This exported unit supports the file role: Implements the ProductDetailPage browser route and coordinates the UI state for that screen.
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

function scrollToReviewForm(): void {
  window.setTimeout(() => {
    document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 0);
}

/**
 * ProductDetailPage boundary.
 *
 * This exported unit supports the file role: Implements the ProductDetailPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const goBack = useSafeBack('/marketplace');
  const {
    addToCartAndWait,
    removeFromCartAndWait,
    isProductInCart,
    getProductCartQuantity,
    prepareSingleItemCheckout,
  } = useCart();
  const { user } = useAuth();
  const isAdminReadOnly = user?.role === 'ADMIN';
  const requestedAdminReturnTo = searchParams.get('returnTo');
  const adminReturnTo = requestedAdminReturnTo?.startsWith('/admin') ? requestedAdminReturnTo : '/admin/moderation';

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
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
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
  const [savingRecipeIds, setSavingRecipeIds] = useState<number[]>([]);
  const [activeReportKey, setActiveReportKey] = useState<string | null>(null);
  const [reportedProductIds, setReportedProductIds] = useState<Set<string>>(new Set());

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
    if (!product || !user || isAdminReadOnly) {
      return;
    }

    let mounted = true;
    fetchMyModerationReportStatus('product', product.id)
      .then((payload) => {
        if (!mounted || !payload.reported) {
          return;
        }
        setReportedProductIds((previous) => new Set(previous).add(String(product.id)));
      })
      .catch(() => {
        // Reporting status is a progressive UI hint; product browsing should not fail if unavailable.
      });

    return () => {
      mounted = false;
    };
  }, [product, user, isAdminReadOnly]);

  useEffect(() => {
    if (!id || isAdminReadOnly) {
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
  }, [id, user, isAdminReadOnly]);

  useEffect(() => {
    if (!product) {
      setHasReviewedAllergens(false);
      setAllergenConfirmationError('');
      return;
    }

    setHasReviewedAllergens(product.allergens.length === 0);
    setAllergenConfirmationError('');

    if (product.allergens.length > 0 && user && !isAdminReadOnly) {
      // server acknowledgement stops allergen review from being only a browser checkbox
      apiJson<{ acknowledged: boolean }>(`/api/orders/products/${product.id}/allergen-acknowledgement/`)
        .then((payload) => {
          setHasReviewedAllergens(payload.acknowledged);
        })
        .catch(() => {
          setHasReviewedAllergens(false);
        });
    }
  }, [product, user, isAdminReadOnly]);

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
    // visible products can still be unavailable so purchase actions check live status
    if (!product) {
      return false;
    }
    return (product.effectiveAvailability || product.availability) !== 'unavailable' && product.stock > 0;
  }, [product]);

  const maxQuantity = useMemo(() => {
    if (!product) {
      return 1;
    }
    // keep quantity limits role aware so bulk buyers can use live stock
    return Math.max(1, getQuantityCapForRole(user?.role, product.stock));
  }, [product, user?.role]);

  const requiresAllergenReview = Boolean(product && product.allergens.length > 0);
  const isBulkBuyer = isBulkBuyerRole(user?.role);
  const producerDeliveryLeadTime = product?.producerDeliveryLeadTime || 48;
  const hasExistingReview = Boolean(reviewEligibility?.hasExistingReview);
  const existingReview = reviewEligibility?.existingReview;
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
    // cart state decides whether remove and view cart actions should be shown
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
    // subtract cart quantity before enabling another add action
    return Math.max(0, maxQuantity - cartQuantity);
  }, [cartQuantity, maxQuantity, product]);

  const showAdminReadOnlyNotice = () => {
    toast.info('Admin preview is read-only. Use moderation tools from the admin dashboard.');
  };

  const validateBuyerPurchaseAction = () => {
    // every buy path comes through here so role and allergen checks stay same
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return false;
    }
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
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
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
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
    navigate('/cart');
  };

  const handleReport = async (targetType: ModerationTargetType, objectId: string | number, label: string) => {
    // reporting is read only from this page except for creating a moderation case
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
    if (!user) {
      toast.error('Please sign in to report this item.');
      return;
    }

    const key = `${targetType}:${objectId}`;
    if (targetType === 'product' && reportedProductIds.has(String(objectId))) {
      toast.info('Product already reported.');
      return;
    }

    setActiveReportKey(key);
    try {
      await reportModerationTarget(targetType, objectId, `Reported from product detail page: ${label}`);
      if (targetType === 'product') {
        setReportedProductIds((previous) => new Set(previous).add(String(objectId)));
      }
      toast.success(`${label} reported to moderation.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to report ${label.toLowerCase()}.`;
      if (targetType === 'product' && message.toLowerCase().includes('already reported')) {
        setReportedProductIds((previous) => new Set(previous).add(String(objectId)));
      }
      toast.error(message);
    } finally {
      setActiveReportKey(null);
    }
  };

  const backToMarketplaceButton = (
    <Button variant="ghost" onClick={() => (isAdminReadOnly ? navigate(adminReturnTo) : goBack())}>
      <ArrowLeft className="mr-2 size-4" />
      {isAdminReadOnly ? 'Back to moderation' : 'Back to Marketplace'}
    </Button>
  );

  const cartActionPanel = isAvailable ? (
    <div className="space-y-3">
      {/* keep main purchase actions high in the card so the first viewport has them */}
      {(isBulkBuyer || isInCart) && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
          {isBulkBuyer && <span>{user?.role === 'COMMUNITY' ? 'Community bulk ordering' : 'Restaurant order planning'}</span>}
          {isInCart && <span>In cart: {cartQuantity} {product?.unit}</span>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {/* both primary actions share the same validation path before touching the cart */}
        <Button
          size="lg"
          onClick={() => void handleBuyNow()}
          disabled={isCartActionPending || isBlockedByAllergenReview}
          className="h-10"
        >
          <CreditCard className="size-5" />
          {activeCartAction === 'buy'
            ? 'Preparing Checkout...'
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

  const handleAllergenReviewToggle = async (checked: boolean) => {
    // save acknowledgement when possible but keep the checkbox usable if api fails
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
    if (!product) {
      return;
    }

    if (checked && user) {
      try {
        await apiJson(`/api/orders/products/${product.id}/allergen-acknowledgement/`, {
          method: 'POST',
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to save allergen acknowledgement.');
        return;
      }
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
    if (!id || isAdminReadOnly) {
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
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
    if (isReviewEligibilityLoading) {
      toast.info('Checking whether this product can be reviewed.');
      return;
    }
    if (existingReview) {
      setEditingReviewId(existingReview.id);
      setReviewRating(existingReview.rating);
      setReviewTitle(existingReview.title || '');
      setReviewComment(existingReview.comment || '');
      setReviewIsAnonymous(Boolean(existingReview.isAnonymous));
      setReviewFormError('');
      scrollToReviewForm();
      return;
    }
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
    scrollToReviewForm();
  };

  const handleReviewSubmit = async () => {
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
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

    if (!canSubmitReview && !editingReviewId) {
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
      const reviewPayload = {
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        isAnonymous: reviewIsAnonymous,
      };
      const savedReview = editingReviewId
        ? await updateProductReview(id, editingReviewId, reviewPayload)
        : await createProductReview(id, reviewPayload);
      if (savedReview.moderationStatus === 'pending') {
        setPendingReviewNotice('Your review was submitted and is waiting for approval.');
        toast.success('Your review was submitted and is waiting for approval.');
      } else {
        setPendingReviewNotice('');
        setReviews((currentReviews) => {
          const withoutSavedReview = currentReviews.filter((review) => review.id !== savedReview.id);
          return [savedReview, ...withoutSavedReview];
        });
        toast.success(editingReviewId ? 'Your review was updated.' : 'Your review is now live on this product.');
      }
      setReviewRating(0);
      setReviewTitle('');
      setReviewComment('');
      setReviewIsAnonymous(false);
      setEditingReviewId(null);
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
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
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

  const handleSaveRecipe = async (recipe: ApiRecipe) => {
    if (isAdminReadOnly) {
      showAdminReadOnlyNotice();
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
    setSavingRecipeIds((previous) => [...previous, recipe.id]);
    try {
      const response = await apiJson<{ saved: boolean }>(`/api/content/recipes/${recipe.id}/save/`, {
        method: 'POST',
      });
      setLinkedRecipes((current) =>
        current.map((entry) => (entry.id === recipe.id ? { ...entry, saved: response.saved } : entry)),
      );
      toast.success(response.saved ? 'Recipe saved.' : 'Recipe removed from saved recipes.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update saved recipe.');
    } finally {
      setSavingRecipeIds((previous) => previous.filter((currentId) => currentId !== recipe.id));
    }
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
  const isProductReported = reportedProductIds.has(String(product.id));
  const effectiveAvailability = product.effectiveAvailability || product.availability;
  const configuredAvailability = product.configuredAvailability || product.availability;
  const isOutOfStock = product.stock <= 0;
  const isOutOfSeason = !isOutOfStock && configuredAvailability === 'in-season' && effectiveAvailability === 'unavailable';
  const seasonalEducationCopy =
    'Seasonal information helps customers understand local food systems: producer-set windows explain when crops are naturally available, when year-round supply is stable, and why out-of-season items may be unavailable instead of imported from further away.';

  return (
    <div className="min-h-screen bg-[#f3fbf1]">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 lg:px-6">
        <div className="mb-6">{backToMarketplaceButton}</div>
        {isAdminReadOnly && (
          <div className="mb-6 rounded-3xl border border-[#d6cab8] bg-[#fff8e8] px-5 py-4 text-sm text-[#6a4f45] shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-[#3b2c24]">Admin read-only product preview</p>
                <p className="mt-1">
                  Inspect the reported product, reviews, recipes, allergens, stock, and producer details without buyer
                  actions enabled.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(adminReturnTo)}>
                Back to moderation
              </Button>
            </div>
          </div>
        )}

        <section>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
            <div className="grid gap-5 sm:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="relative h-36 overflow-hidden rounded-3xl bg-[#f2efe5] sm:h-[24rem] lg:h-[24rem] xl:h-[24.5rem]">
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <AvailabilityBadge availability={effectiveAvailability} />
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
                    <Badge variant={product.isOrganic ? 'default' : 'outline'}>
                      {product.isOrganic ? 'Certified Organic' : 'Not Certified Organic'}
                    </Badge>
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-[var(--rich-soil)] sm:text-4xl">{product.name}</h1>
                    <Link
                      to={`/producers/${product.producerId}`}
                      className="mt-2 inline-flex text-lg font-medium text-[var(--forest-green)] hover:underline"
                    >
                      {product.producerName}
                    </Link>
                    <p className="mt-3 hidden max-w-2xl text-sm leading-6 text-[var(--warm-earth)] sm:block">{product.description}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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
                    {!isAdminReadOnly && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full border-[#d6cab8] bg-[#fbfaf4] text-[#6a4f45] hover:bg-[#f3eee5] hover:text-[#4b382f]"
                        disabled={activeReportKey === `product:${product.id}` || isProductReported}
                        onClick={() => void handleReport('product', product.id, 'Product')}
                      >
                        <Flag className="mr-2 size-4" />
                        {isProductReported
                          ? 'Product reported'
                          : activeReportKey === `product:${product.id}`
                            ? 'Reporting...'
                            : 'Report product'}
                      </Button>
                    )}
                  </div>

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

                  <div className="max-w-2xl overflow-hidden rounded-3xl border border-[#dfe8d9] bg-white/80 text-sm shadow-sm">
                    <div className="grid grid-cols-3 divide-x divide-[#e7eee2]">
                      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                          Order status
                        </span>
                        <span className="mt-1 block font-semibold leading-snug text-[var(--rich-soil)]">
                          {isAvailable ? 'Available to order' : isOutOfStock ? 'Out of stock' : isOutOfSeason ? 'Out of season' : 'Unavailable'}
                        </span>
                      </div>
                      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                          Estimated fulfilment
                        </span>
                        <span className="mt-1 block font-semibold leading-snug text-[var(--rich-soil)]">
                          {producerDeliveryLeadTime} hours
                        </span>
                      </div>
                      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                          Stock
                        </span>
                        <span className="mt-1 block font-semibold leading-snug text-[var(--rich-soil)]">
                          {product.stock} {formatUnit(product.unit, product.stock)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 divide-x divide-[#e7eee2] border-t border-[#e7eee2]">
                      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                          Allergens
                        </span>
                        <span className="mt-1 block font-semibold leading-snug text-[var(--rich-soil)]">
                          {product.allergens.length > 0 ? product.allergens.join(', ') : 'No common allergens'}
                        </span>
                      </div>

                      <div className="px-3 py-2.5 sm:px-4 sm:py-3">
                        <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                          Certification status
                        </span>
                        <Badge variant={product.isOrganic ? 'default' : 'outline'} className="mt-2 w-fit">
                          {product.isOrganic ? 'Certified Organic' : 'Not Certified Organic'}
                        </Badge>
                      </div>
                    </div>

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
                  {isAvailable ? 'Available to order' : isOutOfStock ? 'Out of stock' : isOutOfSeason ? 'Out of season' : 'Unavailable'}
                </Badge>
              </div>

              {isAvailable && !isAdminReadOnly && (
                <div className="mt-4 rounded-2xl border border-[#dfe8d9] bg-[#fbfff7] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <span className="border-l border-r border-[#d6cab8] px-4 text-sm text-[var(--warm-earth)]">
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

                  {isBulkBuyer && (
                    <div className="mt-3 rounded-xl border border-[#e4e1d8] bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-[var(--rich-soil)]">
                            {user?.role === 'COMMUNITY' ? 'Community bulk ordering' : 'Restaurant order planning'}
                          </p>
                          <p className="mt-1 text-xs text-[var(--warm-earth)]">
                            Use quick quantities here, then complete checkout through your role-specific order flow.
                          </p>
                        </div>
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
                      </div>
                    </div>
                  )}
                </div>
              )}

              {requiresAllergenReview && (
                <div className="mt-3 space-y-2">
                  <div className="rounded-2xl border border-orange-200 bg-orange-50/80 px-3 py-2 text-sm text-orange-900">
                    <p className="font-semibold">Allergen warning</p>
                    <p className="mt-1">Contains: <strong>{product.allergens.join(', ')}</strong></p>
                  </div>
                  {!isAdminReadOnly && (
                    <>
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
                    </>
                  )}
                </div>
              )}

              <div className="mt-4 border-t border-[#dfe8d9] pt-4">
                {isAdminReadOnly ? (
                  <div className="rounded-2xl border border-[#d6cab8] bg-[#fbfaf4] px-4 py-3 text-sm text-[#6a4f45]">
                    <p className="font-semibold text-[#3b2c24]">Ordering disabled in admin preview</p>
                    <p className="mt-1">
                      Admins can inspect product information here, but cart, checkout, and saved buyer actions are
                      intentionally unavailable.
                    </p>
                  </div>
                ) : (
                  cartActionPanel
                )}
              </div>

            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-[#dfe8d9] bg-white/80 p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--earth-accent)]">
                  Seasonal context
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--rich-soil)]">
                  {product.seasonalDates || 'Year-round availability'}
                </h2>
              </div>
              <Badge variant="secondary" className="w-fit">
                {isOutOfSeason ? 'Out of season' : effectiveAvailability === 'unavailable' ? 'Unavailable' : 'Local supply'}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--rich-soil)]">
              {product.seasonalStatusMessage || product.seasonalDates || 'Year-round'}
            </p>
            <p className="mt-3 text-sm leading-6 text-green-900">
              {seasonalEducationCopy}
            </p>
          </div>

          <div className="rounded-3xl border border-[#dfe8d9] bg-white/80 p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--earth-accent)]">
                  Certification details
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--rich-soil)]">
                  {product.isOrganic ? 'Organic certification' : 'Organic status'}
                </h2>
              </div>
              <Badge variant={product.isOrganic ? 'default' : 'outline'} className="w-fit">
                {product.isOrganic ? 'Certified Organic' : 'Not Certified Organic'}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                  Certification record
                </span>
                <span className="mt-1 block font-semibold leading-snug text-[var(--rich-soil)]">
                  {product.isOrganic
                    ? product.organicCertification || 'Certification details not supplied'
                    : 'No organic certification registered'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
                  Allergen statement
                </span>
                <span className="mt-1 block font-semibold leading-snug text-[var(--rich-soil)]">
                  {product.allergens.length > 0 ? product.allergens.join(', ') : 'No common allergens'}
                </span>
              </div>
            </div>
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
                {!isAdminReadOnly && (
                  user?.role === 'CUSTOMER' ? (
                    <Button variant="outline" size="sm" onClick={openReviewForm}>
                      {existingReview ? 'Edit your review' : 'Write a review'}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={openReviewForm} disabled={isReviewEligibilityLoading}>
                      {user?.role === 'PRODUCER' && canRespondToReviews ? 'Respond as producer below' : 'Write a review'}
                    </Button>
                  )
                )}
              </div>
              <p className="text-xs text-gray-500">
                Reviews use a clear 1 to 5 star scale. Only logged-in customers with a delivered purchase can submit a review. Verified purchases are labelled clearly, and reported reviews are sent to admin moderation.
              </p>
              {pendingReviewNotice && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {pendingReviewNotice}
                </div>
              )}

              {isAdminReadOnly ? (
                <div className="rounded-lg border border-dashed border-[#d6cab8] bg-[#fbfaf4] px-4 py-5 text-sm text-[#6a4f45]">
                  Reviews are visible for moderation inspection only. Admin review, report, and reply actions are
                  disabled on this preview page.
                </div>
              ) : !user ? (
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
              ) : hasExistingReview && !editingReviewId ? (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-5 text-sm text-green-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p>{reviewEligibility?.reason || 'You have already reviewed this product. Thanks for sharing your feedback.'}</p>
                    {existingReview && (
                      <Button variant="outline" size="sm" onClick={openReviewForm}>
                        Edit review
                      </Button>
                    )}
                  </div>
                </div>
              ) : isReviewEligibilityLoading ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                  Checking review eligibility...
                </div>
              ) : !canSubmitReview && !editingReviewId ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-sm text-gray-600">
                  {reviewEligibility?.reason || 'You cannot review this product yet.'}
                </div>
              ) : (
                <div id="review-form" className="rounded-lg border bg-gray-50 p-4 space-y-4">
                  <div>
                    <p className="font-medium text-gray-900">{editingReviewId ? 'Edit your review' : 'Write your review'}</p>
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
                      {isSubmittingReview
                        ? editingReviewId
                          ? 'Saving review...'
                          : 'Posting review...'
                        : editingReviewId
                          ? 'Save review'
                          : 'Post review'}
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
                            {user?.role === 'CUSTOMER' && review.userId && String(user.id) === review.userId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
                                onClick={() => {
                                  setEditingReviewId(review.id);
                                  setReviewRating(review.rating);
                                  setReviewTitle(review.title || '');
                                  setReviewComment(review.comment || '');
                                  setReviewIsAnonymous(Boolean(review.isAnonymous));
                                  setReviewFormError('');
                                  scrollToReviewForm();
                                }}
                              >
                                Edit
                              </Button>
                            )}
                            {!isAdminReadOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-[#6a4f45] hover:bg-[#f3eee5] hover:text-[#4b382f]"
                                disabled={activeReportKey === `review:${review.id}`}
                                onClick={() => void handleReport('review', review.id, 'Review')}
                              >
                                <Flag className="mr-1.5 size-3.5" />
                                {activeReportKey === `review:${review.id}` ? 'Reporting...' : 'Report'}
                              </Button>
                            )}
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
                          {!isAdminReadOnly && canRespondToReviews && (
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
                <div className="grid w-full gap-2 sm:w-auto sm:min-w-64">
                  <Badge variant="outline" className="justify-center border-[#d6cab8] bg-[#fbfaf4] text-[var(--rich-soil)]">
                    {recipeCount} {recipeCount === 1 ? 'idea' : 'ideas'}
                  </Badge>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">Storage</p>
                      {product.storageTips && product.storageTipsAiGenerated && (
                        <Badge variant="outline" className="border-emerald-300 bg-white text-emerald-800">
                          AI
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-emerald-800">
                      {product.storageTips || 'No storage information at the moment.'}
                    </p>
                  </div>
                </div>
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
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleLinkedRecipe(recipe.id)}
                            >
                              {isExpanded ? 'Hide Recipe' : 'View Full Recipe'}
                            </Button>
                            {!isAdminReadOnly && (
                              <Button
                                variant={recipe.saved ? 'secondary' : 'outline'}
                                size="sm"
                                disabled={savingRecipeIds.includes(recipe.id)}
                                onClick={() => void handleSaveRecipe(recipe)}
                              >
                                <Bookmark className="mr-2 size-4" />
                                {savingRecipeIds.includes(recipe.id)
                                  ? 'Saving...'
                                  : recipe.saved
                                    ? 'Saved'
                                    : 'Save Recipe'}
                              </Button>
                            )}
                            {!isAdminReadOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#6a4f45] hover:bg-[#f3eee5] hover:text-[#4b382f]"
                                disabled={activeReportKey === `recipe:${recipe.id}`}
                                onClick={() => void handleReport('recipe', recipe.id, 'Recipe')}
                              >
                                <Flag className="mr-2 size-4" />
                                {activeReportKey === `recipe:${recipe.id}` ? 'Reporting...' : 'Report'}
                              </Button>
                            )}
                          </div>
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
	                    <h3 className="text-xl font-semibold text-[var(--rich-soil)]">
                      About{' '}
                      <Link to={`/producers/${product.producerId}`} className="text-[var(--forest-green)] hover:underline">
                        {product.producerName}
                      </Link>
                    </h3>
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
