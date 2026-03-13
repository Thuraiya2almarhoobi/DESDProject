import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Filter, X, Plus, Minus, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { fetchCategories, fetchProducts } from '../api/catalog';
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
import { ProductMeta } from '../components/ProductMeta';
import { SurplusInfo } from '../components/SurplusInfo';
import { Card, CardContent } from '../components/ui/card';
import { SiteHeader } from '../components/SiteHeader';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

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
  const { user } = useAuth();
  const { addToCartAndWait, getProductCartQuantity, undoLastAdd } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(fallbackCategories);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
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

    if (user.role !== 'CUSTOMER') {
      toast.error('Only customer accounts can place orders.', {
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
    const remainingStock = Math.max(0, Math.floor(product.stock) - currentCartQuantity);
    if (remainingStock <= 0) {
      toast.error(`You already have the maximum available quantity of ${product.name} in your cart.`);
      return;
    }

    const quantityToAdd = Math.min(quantity, remainingStock);
    const cartItemId = await addToCartAndWait(product, quantityToAdd);
    if (!cartItemId) {
      return;
    }

    toast.success(`Added: ${product.name} (${quantityToAdd} ${product.unit})`, {
      action: {
        label: 'Undo',
        onClick: () => undoLastAdd(),
      },
      duration: 4000,
    });
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {sortedProducts.map(product => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    handleAddToCart={handleAddToCart} 
                    currentCartQuantity={getProductCartQuantity(product.id)}
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
  currentCartQuantity,
}: { 
  product: Product; 
  handleAddToCart: (product: Product, quantity: number, e: React.MouseEvent) => Promise<void>;
  currentCartQuantity: number;
}) {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

  const isAvailable = product.availability !== 'unavailable' && product.stock > 0;
  const hasAllergens = product.allergens && product.allergens.length > 0;
  const remainingStock = Math.max(0, Math.floor(product.stock) - currentCartQuantity);
  const maxQuantity = Math.max(1, remainingStock);

  useEffect(() => {
    setQuantity((previous) => Math.max(1, Math.min(previous, maxQuantity)));
  }, [maxQuantity]);

  const incrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < maxQuantity) {
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  const updateQuantity = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) {
      return;
    }
    setQuantity(Math.max(1, Math.min(maxQuantity, Math.floor(next))));
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
      onClick={() => navigate(`/product/${product.id}`)}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/product/${product.id}`)}
    >
      {/* E) Standardized card structure */}
      <div className="aspect-video relative overflow-hidden bg-gray-100">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-full object-cover"
        />
        {/* Badges row (consistent position) */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <AvailabilityBadge availability={product.availability} />
          {product.isOrganic && <OrganicBadge />}
          {product.isSurplus && <SurplusBadge />}
        </div>
      </div>
      
      <CardContent className="p-4 space-y-3">
        {/* Title */}
        <div>
          <h3 className="font-semibold mb-1">{product.name}</h3>
          
          {/* Producer */}
          <p className="text-sm text-gray-600 mb-2">{product.producerName}</p>
          <p className="text-xs text-gray-500 mb-2">{product.category}</p>
          
          {/* Meta row: distance + harvested */}
          <ProductMeta
            producerName={product.producerName}
            producerLocation={product.producerLocation}
            harvestDate={product.harvestDate}
            foodMiles={product.foodMiles}
            seasonalDates={product.seasonalDates}
            compact
          />
        </div>
        
        {/* F) Accessible allergen warning - not color-only */}
        {hasAllergens && (
          <Badge 
            variant="outline" 
            className="w-fit gap-1.5 border-orange-300 bg-orange-50 text-orange-800"
          >
            <AlertTriangle className="size-3" />
            <span className="text-xs">Contains: {product.allergens?.join(', ')}</span>
          </Badge>
        )}

        {/* Price or Surplus Info */}
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
            <span className="text-lg font-semibold text-green-700">
              £{product.price.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500">/{product.unit}</span>
          </div>
        )}

        {!isAvailable && (
          <Badge variant="secondary" className="text-xs">
            Out of stock
          </Badge>
        )}
        
        {/* B) Quantity stepper + CTA */}
        {isAvailable && (
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
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
                className="h-8 w-16 rounded-none border-0 text-center text-sm font-medium shadow-none focus-visible:ring-1"
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
            <Button
              size="sm"
              className="flex-1 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              onClick={(e) => handleAddToCart(product, quantity, e)}
              disabled={remainingStock <= 0}
              aria-label={`Add ${quantity} ${product.unit} of ${product.name} to cart`}
            >
              {remainingStock <= 0 ? 'Max in cart' : `Add ${quantity} ${product.unit}`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
