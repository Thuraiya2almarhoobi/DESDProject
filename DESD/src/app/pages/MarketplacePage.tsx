import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Filter, X, Plus, Minus, AlertCircle, AlertTriangle, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Product, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { fetchCategories, fetchProducts } from '../api/catalog';
import { getQuantityCapForRole, isBulkBuyerRole, isBuyerRole } from '../lib/ordering';
import { getDashboardPathForRole } from '../lib/roleRouting';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { SurplusInfo } from '../components/SurplusInfo';
import { Card, CardContent } from '../components/ui/card';
import { SiteHeader } from '../components/SiteHeader';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';

const fallbackCategories = ['All', 'Vegetables', 'Fruit', 'Dairy Products', 'Bakery', 'Preserves'];
const commonAllergens = [
  'Celery',
  'Cereals containing Gluten',
  'Crustaceans',
  'Eggs',
  'Fish',
  'Lupin',
  'Milk',
  'Molluscs',
  'Mustard',
  'Nuts',
  'Peanuts',
  'Sesame',
  'Soybeans',
  'Sulphites',
];

type SortOption = 'relevance' | 'price-low' | 'price-high' | 'nearest' | 'harvest-newest' | 'ending-soon';
type ViewMode = 'all' | 'surplus';
type PriceFilter = 'any' | 'under-3' | '3-to-6' | 'over-6';

function getPriceBounds(priceFilter: PriceFilter): { minPrice?: number; maxPrice?: number } {
  switch (priceFilter) {
    case 'under-3':
      return { maxPrice: 3 };
    case '3-to-6':
      return { minPrice: 3, maxPrice: 6 };
    case 'over-6':
      return { minPrice: 6 };
    case 'any':
    default:
      return {};
  }
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  const { user } = useAuth();
  const { addToCartAndWait, getProductCartQuantity, prepareSingleItemCheckout, undoLastAdd } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(fallbackCategories);
  const [searchQuery, setSearchQuery] = useState(() => queryFromUrl);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => queryFromUrl);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [showOnlyOrganic, setShowOnlyOrganic] = useState(false);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('any');
  const [showOnlyInSeason, setShowOnlyInSeason] = useState(false);
  const [showOnlyInStock, setShowOnlyInStock] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const isBulkBuyer = isBulkBuyerRole(user?.role);

  useEffect(() => {
    let mounted = true;

    fetchCategories()
      .then((apiCategories) => {
        if (!mounted) {
          return;
        }
        if (apiCategories.length > 0) {
          setCategories(['All', ...apiCategories]);
        }
      })
      .catch(() => {
        if (mounted) {
          setCategories(fallbackCategories);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setHasError(false);

    const selectedCategoryValues = selectedCategories.filter((category) => category !== 'All');
    const { minPrice, maxPrice } = getPriceBounds(priceFilter);

    fetchProducts({
      search: debouncedSearchQuery || undefined,
      category: selectedCategoryValues.length > 0 ? selectedCategoryValues.join(',') : undefined,
      organic: showOnlyOrganic ? true : undefined,
      minPrice,
      maxPrice,
    })
      .then((apiProducts) => {
        if (mounted) {
          setProducts(apiProducts);
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
  }, [debouncedSearchQuery, selectedCategories, showOnlyOrganic, priceFilter, reloadKey]);

  // Auto-sort by "ending soon" when on Surplus tab (H)
  useEffect(() => {
    if (viewMode === 'surplus' && sortBy === 'relevance') {
      setSortBy('ending-soon');
    }
  }, [viewMode]);

  // Keyboard shortcut: "/" focuses search, Esc clears (I)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        document.getElementById('marketplace-search')?.focus();
      }
      if (e.key === 'Escape' && document.activeElement?.id === 'marketplace-search') {
        setSearchQuery('');
        (document.activeElement as HTMLElement)?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setSearchQuery((currentQuery) => (currentQuery === queryFromUrl ? currentQuery : queryFromUrl));
    setDebouncedSearchQuery((currentQuery) => (currentQuery === queryFromUrl ? currentQuery : queryFromUrl));
  }, [queryFromUrl]);

  useEffect(() => {
    if (queryFromUrl === debouncedSearchQuery) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    if (debouncedSearchQuery) {
      nextParams.set('q', debouncedSearchQuery);
    } else {
      nextParams.delete('q');
    }
    setSearchParams(nextParams, { replace: true });
  }, [debouncedSearchQuery, queryFromUrl, searchParams, setSearchParams]);

  // Show skeleton briefly on local filter/sort changes.
  useEffect(() => {
    setIsFilterChanging(true);
    const timer = setTimeout(() => {
      setIsFilterChanging(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [showOnlyInSeason, showOnlyInStock, excludedAllergens, viewMode, sortBy, priceFilter]);

  // Filter products (TC-004/005/014)
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // View mode filter (surplus vs all)
      if (viewMode === 'surplus' && !product.isSurplus) {
        return false;
      }

      // In season filter
      if (showOnlyInSeason && product.availability !== 'in-season') {
        return false;
      }

      // In stock filter
      if (showOnlyInStock && (product.availability === 'unavailable' || product.stock === 0)) {
        return false;
      }

      // Allergen filter (C - safer by default)
      if (excludedAllergens.length > 0 && product.allergens) {
        const hasExcludedAllergen = product.allergens.some(allergen => excludedAllergens.includes(allergen));
        if (hasExcludedAllergen) return false;
      }

      return true;
    });
  }, [products, showOnlyInSeason, showOnlyInStock, excludedAllergens, viewMode]);

  // Sort products (H - improved clarity)
  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];
    switch (sortBy) {
      case 'price-low':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price-high':
        return sorted.sort((a, b) => b.price - a.price);
      case 'nearest':
        return sorted.sort((a, b) => a.foodMiles - b.foodMiles);
      case 'harvest-newest':
        return sorted.sort((a, b) => new Date(b.harvestDate).getTime() - new Date(a.harvestDate).getTime());
      case 'ending-soon':
        return sorted.sort((a, b) => {
          if (!a.surplusExpiresAt) return 1;
          if (!b.surplusExpiresAt) return -1;
          return new Date(a.surplusExpiresAt).getTime() - new Date(b.surplusExpiresAt).getTime();
        });
      case 'relevance':
      default:
        return sorted;
    }
  }, [filteredProducts, sortBy]);

  const handleCategoryToggle = (category: string) => {
    if (category === 'All') {
      setSelectedCategories(['All']);
    } else {
      setSelectedCategories(prev => {
        const filtered = prev.filter(c => c !== 'All');
        if (filtered.includes(category)) {
          const newCategories = filtered.filter(c => c !== category);
          return newCategories.length === 0 ? ['All'] : newCategories;
        }
        return [...filtered, category];
      });
    }
  };

  const removeAllergenFilter = (allergen: string) => {
    setExcludedAllergens(prev => prev.filter(a => a !== allergen));
  };

  const clearFilters = () => {
    setSelectedCategories(['All']);
    setShowOnlyOrganic(false);
    setPriceFilter('any');
    setShowOnlyInSeason(false);
    setShowOnlyInStock(true);
    setSearchQuery('');
    setSortBy('relevance');
    setExcludedAllergens([]);
  };

  const clearAllergens = () => {
    setExcludedAllergens([]);
  };

  const activeFiltersCount = 
    (selectedCategories.includes('All') ? 0 : selectedCategories.length) +
    (showOnlyOrganic ? 1 : 0) +
    (priceFilter !== 'any' ? 1 : 0) +
    (showOnlyInSeason ? 1 : 0) +
    (!showOnlyInStock ? 1 : 0) +
    excludedAllergens.length +
    (viewMode === 'surplus' ? 1 : 0) +
    (sortBy !== 'relevance' ? 1 : 0);

  const handleAddToCart = async (product: Product, quantity: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast.error('Please sign in to add items to your cart.', {
        action: {
          label: 'Login',
          onClick: () => navigate('/login'),
        },
      });
      return;
    }

    if (!isBuyerRole(user.role)) {
      toast.error('This portal does not support ordering from the marketplace.', {
        action: {
          label: 'Dashboard',
          onClick: () => navigate(getDashboardPathForRole(user.role)),
        },
      });
      return;
    }

    const requiresAllergenReview = product.allergens.length > 0;
    const hasReviewedAllergens =
      typeof window !== 'undefined' &&
      window.localStorage.getItem(`allergen-reviewed-${product.id}`) === 'true';

    if (requiresAllergenReview && !hasReviewedAllergens) {
      toast.warning('Please review allergen information on the product page before adding to cart.');
      navigate(`/product/${product.id}`);
      return;
    }

    const currentCartQuantity = getProductCartQuantity(product.id);
    const remainingStock = Math.max(0, getQuantityCapForRole(user?.role, product.stock) - currentCartQuantity);
    if (remainingStock <= 0) {
      toast.error(
        `You already have the maximum available quantity of ${product.name} in your cart.`,
      );
      return;
    }

    const quantityToAdd = Math.min(quantity, remainingStock);
    const cartItemId = await addToCartAndWait(product, quantityToAdd);
    if (!cartItemId) {
      return;
    }

    toast.success(
      `${isBulkBuyer ? 'Added to order cart' : 'Added'}: ${product.name} (${quantityToAdd} ${product.unit})`,
      {
        action: {
          label: 'Undo',
          onClick: () => undoLastAdd(),
        },
        duration: 4000,
      },
    );
  };

  const handleBuyNow = async (product: Product, quantity: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!user) {
      toast.error('Please sign in to buy this item.', {
        action: {
          label: 'Login',
          onClick: () => navigate('/login'),
        },
      });
      return;
    }

    if (!isBuyerRole(user.role)) {
      toast.error('This portal does not support ordering from the marketplace.', {
        action: {
          label: 'Dashboard',
          onClick: () => navigate(getDashboardPathForRole(user.role)),
        },
      });
      return;
    }

    const requiresAllergenReview = product.allergens.length > 0;
    const hasReviewedAllergens =
      typeof window !== 'undefined' &&
      window.localStorage.getItem(`allergen-reviewed-${product.id}`) === 'true';

    if (requiresAllergenReview && !hasReviewedAllergens) {
      toast.warning('Please review allergen information on the product page before checkout.');
      navigate(`/product/${product.id}`);
      return;
    }

    const currentCartQuantity = getProductCartQuantity(product.id);
    const maxCheckoutQuantity = Math.max(0, getQuantityCapForRole(user?.role, product.stock));
    if (maxCheckoutQuantity <= 0) {
      toast.error(`${product.name} is currently unavailable.`);
      return;
    }

    const quantityToBuy = Math.min(quantity, maxCheckoutQuantity);
    const checkoutReady = await prepareSingleItemCheckout(product, quantityToBuy);
    if (!checkoutReady) {
      return;
    }

    if (currentCartQuantity > 0 && currentCartQuantity !== quantityToBuy) {
      toast.info(`${product.name} quantity updated for checkout.`);
    }
    navigate('/checkout');
  };

  const retryLoad = () => {
    setHasError(false);
    setReloadKey((value) => value + 1);
  };

  const FiltersContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Categories</h3>
        <div className="space-y-2">
          {categories.map(category => (
            <div key={category} className="flex items-center space-x-2">
              <Checkbox
                id={`cat-${category}`}
                checked={selectedCategories.includes(category)}
                onCheckedChange={() => handleCategoryToggle(category)}
                aria-label={`Filter by ${category}`}
                className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              />
              <Label htmlFor={`cat-${category}`} className="cursor-pointer">
                {category}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Attributes</h3>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="organic"
              checked={showOnlyOrganic}
              onCheckedChange={(checked) => setShowOnlyOrganic(checked as boolean)}
              aria-label="Show only organic products"
              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            />
            <Label htmlFor="organic" className="cursor-pointer">
              Organic only
            </Label>
          </div>
          <div className="space-y-2 pt-2">
            <Label htmlFor="price-range">Price range</Label>
            <Select
              value={priceFilter}
              onValueChange={(value) => setPriceFilter(value as PriceFilter)}
            >
              <SelectTrigger id="price-range" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any price</SelectItem>
                <SelectItem value="under-3">Under £3</SelectItem>
                <SelectItem value="3-to-6">£3 - £6</SelectItem>
                <SelectItem value="over-6">Over £6</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="in-season"
              checked={showOnlyInSeason}
              onCheckedChange={(checked) => setShowOnlyInSeason(checked as boolean)}
              aria-label="Show only in-season products"
              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            />
            <Label htmlFor="in-season" className="cursor-pointer">
              In season only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="in-stock"
              checked={showOnlyInStock}
              onCheckedChange={(checked) => setShowOnlyInStock(checked as boolean)}
              aria-label="Show only in-stock products"
              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            />
            <Label htmlFor="in-stock" className="cursor-pointer">
              In stock only
            </Label>
          </div>
        </div>
      </div>

      {/* C) Safer allergen filtering with inline hint */}
      <div>
        <h3 className="font-medium mb-3">Allergens (Exclude)</h3>
        {excludedAllergens.length > 0 && (
          <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800 flex items-start gap-2">
            <AlertTriangle className="size-4 flex-shrink-0 mt-0.5" />
            <span>Products containing selected allergens will be hidden from results.</span>
          </div>
        )}
        <div className="space-y-2">
          {commonAllergens.map(allergen => (
            <div key={allergen} className="flex items-center space-x-2">
              <Checkbox
                id={`allergen-${allergen}`}
                checked={excludedAllergens.includes(allergen)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setExcludedAllergens(prev => [...prev, allergen]);
                  } else {
                    setExcludedAllergens(prev => prev.filter(a => a !== allergen));
                  }
                }}
                aria-label={`Exclude ${allergen}`}
                className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              />
              <Label htmlFor={`allergen-${allergen}`} className="cursor-pointer">
                {allergen}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <Button onClick={clearFilters} variant="outline" className="w-full">
          Clear all filters
        </Button>
      )}
    </div>
  );

  // H) Get sort label for display
  const getSortLabel = (option: SortOption): string => {
    switch (option) {
      case 'relevance': return 'Relevance';
      case 'price-low': return 'Price (low to high)';
      case 'price-high': return 'Price (high to low)';
      case 'nearest': return 'Nearest';
      case 'harvest-newest': return 'Harvested newest';
      case 'ending-soon': return 'Ending soon';
    }
  };

  const getPriceFilterLabel = (filter: PriceFilter): string => {
    switch (filter) {
      case 'under-3':
        return 'Under £3';
      case '3-to-6':
        return '£3 - £6';
      case 'over-6':
        return 'Over £6';
      case 'any':
      default:
        return 'Any price';
    }
  };

  const emptyStateCopy = useMemo(() => {
    const hasCategoryFilter = !selectedCategories.includes('All');
    const hasSearch = debouncedSearchQuery.length > 0;

    if (showOnlyOrganic) {
      return {
        title: hasSearch ? 'No organic products found' : 'No organic products match these filters',
        description:
          hasCategoryFilter || hasSearch
            ? 'Try broadening your search or category filters, or turn off Organic only.'
            : 'Try turning off Organic only to view both organic and non-organic products.',
      };
    }

    if (viewMode === 'surplus') {
      return {
        title: 'No surplus deals match these filters',
        description: 'Try clearing one or more filters to see more discounted items.',
      };
    }

    if (hasSearch) {
      return {
        title: 'No results found',
        description: 'Try a different search term or clear some filters to see more products.',
      };
    }

    return {
      title: 'No products match these filters',
      description: 'Try adjusting your filters to see more results.',
    };
  }, [debouncedSearchQuery, selectedCategories, showOnlyOrganic, viewMode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader
        showSearch
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        searchPlaceholder="Search products, producers, categories... (Press / to focus)"
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="bg-white p-4 rounded-lg border sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Filters</h2>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary">{activeFiltersCount}</Badge>
                )}
              </div>
              <FiltersContent />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {isBulkBuyer && (
              <Card className="mb-4 overflow-hidden border-[oklch(0.82_0.07_145)] bg-[linear-gradient(135deg,rgba(240,248,241,0.98),rgba(255,255,255,0.96))]">
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.42_0.07_145)]">
                      {user?.role === 'COMMUNITY' ? 'Community Ordering Portal' : 'Restaurant Ordering Portal'}
                    </p>
                    <h2 className="text-2xl font-semibold text-[oklch(0.24_0.03_145)]">
                      {user?.role === 'COMMUNITY'
                        ? 'Build one shared order'
                        : 'Build one kitchen order'}
                    </h2>
                    <p className="max-w-3xl text-sm text-gray-600">
                      {user?.role === 'COMMUNITY'
                        ? 'Group products by producer, keep quantities clear, and move to bulk checkout when the basket is ready.'
                        : 'Source ingredients, keep supplier sections tidy, and save recurring supply from checkout when needed.'}
                    </p>
                  </div>
                  <div className="grid gap-3 rounded-2xl border border-white/80 bg-white/80 p-4 text-sm text-gray-700 shadow-sm lg:min-w-[18rem]">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">Per-product cap</span>
                      <Badge variant="secondary">Producer stock limit</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium">Checkout mode</span>
                      <span>{user?.role === 'COMMUNITY' ? 'Bulk order' : 'Recurring-ready'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => navigate('/cart')}>
                        Order Cart
                      </Button>
                      {user?.role === 'RESTAURANT' && (
                        <Button size="sm" variant="outline" onClick={() => navigate('/restaurant/recurring-orders')}>
                          Recurring
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* J) Renamed tabs - "Marketplace" instead of "All Products" */}
            <div className="mb-4">
              <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
                <TabsList>
                  <TabsTrigger 
                    value="all"
                    className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                  >
                    Marketplace
                  </TabsTrigger>
                  <TabsTrigger 
                    value="surplus"
                    className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                    title="Discounted items to reduce waste"
                  >
                    Surplus Deals
                    <Badge className="ml-2 px-1.5 min-w-5 h-5">
                      {products.filter(p => p.isSurplus).length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Top Controls Row */}
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4 flex-1">
                {/* A) Product count visible with filters */}
                <p className="text-sm text-gray-600 font-medium">
                  {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''} found
                </p>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* H) Improved Sort Dropdown */}
                <Select
                  value={sortBy}
                  onValueChange={(value) => setSortBy(value as SortOption)}
                >
                  <SelectTrigger 
                    className="w-full sm:w-[220px] focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2" 
                    aria-label="Sort products"
                  >
                    <SelectValue>
                      {getSortLabel(sortBy)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price-low">Price (low to high)</SelectItem>
                    <SelectItem value="price-high">Price (high to low)</SelectItem>
                    <SelectItem value="nearest">Nearest</SelectItem>
                    <SelectItem value="harvest-newest">Harvested newest</SelectItem>
                    {viewMode === 'surplus' && (
                      <SelectItem value="ending-soon">Ending soon</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                
                {/* Mobile Filter Button */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="lg:hidden focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2" 
                      aria-label="Open filters"
                    >
                      <Filter className="size-4 mr-2" />
                      Filters
                      {activeFiltersCount > 0 && (
                        <Badge className="ml-2 px-1.5 min-w-5 h-5">
                          {activeFiltersCount}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[80vh]">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 overflow-y-auto h-[calc(80vh-80px)]">
                      <FiltersContent />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* A) Applied Filters Chips - Enhanced */}
            {activeFiltersCount > 0 && (
              <div className="mb-4 p-3 bg-white rounded-lg border">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500 font-medium">Applied filters:</span>
                  
                  {/* Category chips */}
                  {!selectedCategories.includes('All') && selectedCategories.map(cat => (
                    <Badge 
                      key={cat} 
                      variant="secondary" 
                      className="gap-1 cursor-pointer hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-green-600" 
                      onClick={() => handleCategoryToggle(cat)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleCategoryToggle(cat)}
                    >
                      {cat}
                      <X className="size-3" />
                    </Badge>
                  ))}
                  
                  {/* Attribute chips */}
                  {showOnlyOrganic && (
                    <Badge 
                      variant="secondary" 
                      className="gap-1 cursor-pointer hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-green-600" 
                      onClick={() => setShowOnlyOrganic(false)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setShowOnlyOrganic(false)}
                    >
                      Organic
                      <X className="size-3" />
                    </Badge>
                  )}
                  {priceFilter !== 'any' && (
                    <Badge 
                      variant="secondary" 
                      className="gap-1 cursor-pointer hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-green-600" 
                      onClick={() => setPriceFilter('any')}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setPriceFilter('any')}
                    >
                      Price: {getPriceFilterLabel(priceFilter)}
                      <X className="size-3" />
                    </Badge>
                  )}
                  {showOnlyInSeason && (
                    <Badge 
                      variant="secondary" 
                      className="gap-1 cursor-pointer hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-green-600" 
                      onClick={() => setShowOnlyInSeason(false)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setShowOnlyInSeason(false)}
                    >
                      In Season
                      <X className="size-3" />
                    </Badge>
                  )}
                  {!showOnlyInStock && (
                    <Badge 
                      variant="secondary" 
                      className="gap-1 cursor-pointer hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-green-600" 
                      onClick={() => setShowOnlyInStock(true)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setShowOnlyInStock(true)}
                    >
                      Include out of stock
                      <X className="size-3" />
                    </Badge>
                  )}
                  
                  {/* Allergen chips */}
                  {excludedAllergens.map(allergen => (
                    <Badge 
                      key={allergen}
                      variant="destructive"
                      className="gap-1 cursor-pointer hover:bg-red-700 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                      onClick={() => removeAllergenFilter(allergen)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && removeAllergenFilter(allergen)}
                    >
                      No {allergen}
                      <X className="size-3" />
                    </Badge>
                  ))}
                  
                  {/* View mode chip */}
                  {viewMode === 'surplus' && (
                    <Badge 
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                      onClick={() => setViewMode('all')}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setViewMode('all')}
                    >
                      Surplus only
                      <X className="size-3" />
                    </Badge>
                  )}
                  
                  {/* Sort chip */}
                  {sortBy !== 'relevance' && (
                    <Badge 
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-gray-300 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                      onClick={() => setSortBy('relevance')}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSortBy('relevance')}
                    >
                      Sort: {getSortLabel(sortBy)}
                      <X className="size-3" />
                    </Badge>
                  )}
                  
                  {/* Clear all button */}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="h-6 text-xs px-2 ml-auto focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                  >
                    Clear all
                  </Button>
                </div>
              </div>
            )}

            {/* Products Grid */}
            {/* G) Show skeleton on filter change */}
            {isLoading || isFilterChanging ? (
              <div className="grid grid-cols-1 auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="overflow-hidden">
                    <div className="aspect-video relative overflow-hidden bg-gray-100">
                      <Skeleton className="w-full h-full" />
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <div className="flex items-center justify-between pt-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : hasError ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="flex flex-col items-center">
                    <AlertCircle className="size-12 text-red-500 mb-4" />
                    <p className="text-gray-700 font-medium mb-2">Failed to load products</p>
                    <p className="text-sm text-gray-500 mb-4">Please check your connection and try again</p>
                    <Button onClick={retryLoad} variant="outline">
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : sortedProducts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="space-y-4">
                    <p className="text-gray-700 font-medium">{emptyStateCopy.title}</p>
                    <p className="text-sm text-gray-500">{emptyStateCopy.description}</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {showOnlyOrganic && (
                        <Button onClick={() => setShowOnlyOrganic(false)} variant="outline" size="sm">
                          Show all products
                        </Button>
                      )}
                      {excludedAllergens.length > 0 && (
                        <Button onClick={clearAllergens} variant="outline" size="sm">
                          Clear allergens
                        </Button>
                      )}
                      <Button onClick={clearFilters} variant="outline" size="sm">
                        Clear all filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 auto-rows-fr gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {sortedProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    handleAddToCart={handleAddToCart} 
                    handleBuyNow={handleBuyNow}
                    currentCartQuantity={getProductCartQuantity(product.id)}
                    isBulkBuyer={isBulkBuyer}
                    userRole={user?.role}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// B) Product card with quantity stepper
function ProductCard({ 
  product, 
  handleAddToCart,
  handleBuyNow,
  currentCartQuantity,
  isBulkBuyer,
  userRole,
}: { 
  product: Product; 
  handleAddToCart: (product: Product, quantity: number, e: React.MouseEvent) => Promise<void>;
  handleBuyNow: (product: Product, quantity: number, e: React.MouseEvent) => Promise<void>;
  currentCartQuantity: number;
  isBulkBuyer: boolean;
  userRole?: UserRole | null;
}) {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [quantityLimitMessage, setQuantityLimitMessage] = useState('');
  const [activeAction, setActiveAction] = useState<'add' | 'buy' | null>(null);

  const isAvailable = product.availability !== 'unavailable' && product.stock > 0;
  const hasAllergens = product.allergens && product.allergens.length > 0;
  const remainingStock = Math.max(0, getQuantityCapForRole(userRole, product.stock) - currentCartQuantity);
  const maxQuantity = Math.max(1, remainingStock);

  useEffect(() => {
    setQuantity((previous) => Math.max(1, Math.min(previous, maxQuantity)));
    setQuantityLimitMessage('');
  }, [maxQuantity]);

  const incrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < maxQuantity) {
      setQuantityLimitMessage('');
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) {
      setQuantityLimitMessage('');
      setQuantity(q => q - 1);
    }
  };

  const updateQuantity = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) {
      return;
    }
    if (isBulkBuyer && next > maxQuantity) {
      setQuantityLimitMessage(`Only ${maxQuantity} ${product.unit} available in stock.`);
    } else {
      setQuantityLimitMessage('');
    }
    setQuantity(Math.max(1, Math.min(maxQuantity, Math.floor(next))));
  };

  return (
    <Card 
      className="group h-full gap-0 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
      onClick={() => navigate(`/product/${product.id}`)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/product/${product.id}`)}
    >
      {/* E) Standardized card structure */}
      <div className="relative h-56 overflow-hidden bg-[linear-gradient(180deg,#f8faf8_0%,#edf3ea_100%)] sm:h-60">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {/* Badges row (consistent position) */}
        <div className="absolute right-3 top-3 flex flex-col gap-1">
          <AvailabilityBadge availability={product.availability} />
          {product.isOrganic && <OrganicBadge />}
          {product.isSurplus && <SurplusBadge />}
        </div>
      </div>
      
      <CardContent className="flex flex-1 flex-col justify-between px-4 pb-3.5 pt-4">
        {/* Title */}
        <div className="space-y-2">
          <div className="mb-1 flex items-start gap-2">
            <h3 className="line-clamp-2 flex-1 font-semibold leading-tight">{product.name}</h3>
            {hasAllergens && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-orange-300 bg-orange-50 text-orange-700 transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                    aria-label={`Allergy warning for ${product.name}`}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <AlertTriangle className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-56 rounded-md bg-[oklch(0.23_0.02_145)] px-3 py-2 text-left text-[11px] leading-5 text-white">
                  Contains: {product.allergens?.join(', ')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          
          {/* Producer */}
          <p className="mb-1 line-clamp-1 text-sm text-gray-600">{product.producerName}</p>
          <p className="mb-2 line-clamp-1 text-xs text-gray-500">{product.category}</p>
          
          {/* Meta row: distance + harvested */}
          {isBulkBuyer ? (
            <div className="space-y-1.5 text-xs text-gray-600">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="px-2 py-0.5 text-[11px] font-medium">
                  {product.producerLocation}
                </Badge>
                <Badge variant="outline" className="px-2 py-0.5 text-[11px] font-medium">
                  {product.foodMiles.toFixed(1)} mi
                </Badge>
                <Badge variant="secondary" className="px-2 py-0.5 text-[11px] font-medium">
                  {product.seasonalDates}
                </Badge>
              </div>
              <p className="text-[11px] text-gray-500">
                {new Date(product.harvestDate).toDateString() === new Date().toDateString()
                  ? 'Harvested today'
                  : 'Fresh local supply'}
              </p>
            </div>
          ) : (
            <div className="space-y-1 text-xs text-gray-600">
              <p className="line-clamp-1">{product.producerLocation} • Food Miles: {product.foodMiles.toFixed(2)} miles • Go Green</p>
              <p className="line-clamp-1">
                {new Date(product.harvestDate).toDateString() === new Date().toDateString()
                  ? 'Harvested today'
                  : 'Harvested this week'}
              </p>
              <p className="line-clamp-1 font-medium text-green-700">Available: {product.seasonalDates || 'Current season'}</p>
            </div>
          )}
          {product.averageRating !== undefined && product.reviewCount ? (
            <div className="mt-2 flex min-h-5 flex-wrap items-center gap-2 text-sm">
              <div className="flex items-center gap-1 text-amber-500">
                <Star className="size-4 fill-current" />
                <span className="font-medium text-gray-900">{product.averageRating.toFixed(1)}</span>
              </div>
              <span className="text-gray-500">
                {product.reviewCount} review{product.reviewCount === 1 ? '' : 's'}
              </span>
              {product.verifiedReviewCount ? (
                <span className="text-gray-500">{product.verifiedReviewCount} verified</span>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 min-h-5 text-sm text-gray-500">No customer ratings yet</p>
          )}
        </div>

        <div className="space-y-2.5 pt-2">
          {!isAvailable && (
            <Badge variant="secondary" className="text-xs">
              Out of stock
            </Badge>
          )}

          {/* Price + quantity row */}
          <div className="space-y-1">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              {product.isSurplus && product.surplusDiscount && product.surplusOriginalPrice && product.surplusExpiresAt && product.surplusBestBefore ? (
                <div className="min-w-0 flex-1">
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
                <div className="flex min-w-0 items-baseline gap-1">
                  <span className="text-lg font-semibold text-green-700">
                    £{product.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500">/{product.unit}</span>
                </div>
              )}

              {isAvailable && (
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center rounded-md border bg-white">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-r-none focus-visible:ring-2 focus-visible:ring-green-600"
                      onClick={decrementQuantity}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      max={String(maxQuantity)}
                      step="1"
                      value={quantity}
                      onClick={(event) => event.stopPropagation()}
                      onFocus={(event) => {
                        event.stopPropagation();
                        event.target.select();
                      }}
                      onChange={updateQuantity}
                      className="h-8 w-10 rounded-none border-0 px-0 text-center text-sm font-medium shadow-none focus-visible:ring-1"
                      aria-label="Enter quantity"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-l-none focus-visible:ring-2 focus-visible:ring-green-600"
                      onClick={incrementQuantity}
                      disabled={remainingStock <= 0 || quantity >= maxQuantity}
                      aria-label="Increase quantity"
                    >
                      <Plus className="size-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            {isBulkBuyer && quantityLimitMessage ? (
              <p className="text-[11px] text-orange-600">{quantityLimitMessage}</p>
            ) : null}
          </div>

          {/* B) CTA */}
          {isAvailable && (
            <div className="space-y-2">
              {isBulkBuyer && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      setQuantity((current) => Math.min(maxQuantity, current + 10));
                    }}
                  >
                    +10
                  </Button>
                  <Badge variant="secondary" className="px-2 py-1 text-[11px]">
                    Stock limit
                  </Badge>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-[var(--forest-green)] text-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_8%,white)] hover:text-[var(--forest-green)] focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                  onClick={async (e) => {
                    setActiveAction('add');
                    try {
                      await handleAddToCart(product, quantity, e);
                    } finally {
                      setActiveAction(null);
                    }
                  }}
                  disabled={remainingStock <= 0 || activeAction !== null}
                  aria-label={`Add ${quantity} ${product.unit} of ${product.name} to cart`}
                >
                  {activeAction === 'add' ? 'Adding...' : remainingStock <= 0 ? 'Max in cart' : 'Add to cart'}
                </Button>
                <Button
                  size="sm"
                  className="w-full focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                  onClick={async (e) => {
                    setActiveAction('buy');
                    try {
                      await handleBuyNow(product, quantity, e);
                    } finally {
                      setActiveAction(null);
                    }
                  }}
                  disabled={remainingStock <= 0 || activeAction !== null}
                  aria-label={`Buy ${quantity} ${product.unit} of ${product.name} now`}
                >
                  {activeAction === 'buy' ? 'Preparing...' : 'Buy now'}
                </Button>
              </div>
              {isBulkBuyer && (
                <p className="text-xs text-gray-500">
                  Large-order mode. Each product is capped by the producer&apos;s live available stock.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
