import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, Filter, ShoppingCart, LogOut, X, Plus, Minus, AlertCircle, AlertTriangle, User } from 'lucide-react';
import { toast } from 'sonner';
import { mockProducts } from '../data/mockData';
import { Product } from '../types';
import { fetchMarketplaceProductsFromApi } from '../services/productApi';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Skeleton } from '../components/ui/skeleton';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../components/ProductBadges';
import { ProductMeta } from '../components/ProductMeta';
import { SurplusInfo } from '../components/SurplusInfo';
import { Card, CardContent } from '../components/ui/card';
import { Sprout } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';

const categories = ['All', 'Vegetables', 'Fruit', 'Dairy', 'Eggs', 'Dairy & Eggs', 'Preserves', 'Bakery'];
const commonAllergens = ['Milk', 'Eggs', 'Gluten', 'Nuts', 'Soy', 'Fish', 'Shellfish'];

type SortOption = 'relevance' | 'price-low' | 'price-high' | 'nearest' | 'harvest-newest' | 'ending-soon';
type ViewMode = 'all' | 'surplus';

export function MarketplacePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { getTotalItems, addToCart, undoLastAdd } = useCart();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All']);
  const [showOnlyOrganic, setShowOnlyOrganic] = useState(false);
  const [showOnlyInSeason, setShowOnlyInSeason] = useState(false);
  const [showOnlyInStock, setShowOnlyInStock] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [apiProducts, setApiProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);

  async function loadProducts() {
    setHasError(false);
    setIsLoading(true);
    try {
      const persistedProducts = await fetchMarketplaceProductsFromApi();
      setApiProducts(persistedProducts);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const allProducts = useMemo(() => {
    const merged = new Map<string, Product>();
    mockProducts.forEach((product) => merged.set(product.id, product));
    apiProducts.forEach((product) => merged.set(product.id, product));
    return Array.from(merged.values());
  }, [apiProducts]);

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

  // Show skeleton briefly on filter change (G)
  useEffect(() => {
    setIsFilterChanging(true);
    const timer = setTimeout(() => {
      setIsFilterChanging(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategories, showOnlyOrganic, showOnlyInSeason, showOnlyInStock, excludedAllergens, viewMode, sortBy]);

  // Filter products (TC-004/005/014)
  const filteredProducts = useMemo(() => {
    return allProducts.filter(product => {
      // View mode filter (surplus vs all)
      if (viewMode === 'surplus' && !product.isSurplus) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          product.name.toLowerCase().includes(query) ||
          product.producerName.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          product.description.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (!selectedCategories.includes('All') && !selectedCategories.includes(product.category)) {
        return false;
      }

      // Organic filter
      if (showOnlyOrganic && !product.isOrganic) {
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
  }, [searchQuery, selectedCategories, showOnlyOrganic, showOnlyInSeason, showOnlyInStock, excludedAllergens, viewMode, allProducts]);

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
    (showOnlyInSeason ? 1 : 0) +
    (!showOnlyInStock ? 1 : 0) +
    excludedAllergens.length +
    (viewMode === 'surplus' ? 1 : 0) +
    (sortBy !== 'relevance' ? 1 : 0);

  const handleAddToCart = (product: Product, quantity: number, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, quantity);
    toast.success(`Added: ${product.name} (${quantity} ${product.unit})`, {
      action: {
        label: 'Undo',
        onClick: () => undoLastAdd(),
      },
      duration: 4000,
    });
  };

  const retryLoad = () => {
    void loadProducts();
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
      case 'price-low': return 'Price (low → high)';
      case 'price-high': return 'Price (high → low)';
      case 'nearest': return 'Nearest';
      case 'harvest-newest': return 'Harvested newest';
      case 'ending-soon': return 'Ending soon';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* D) Tightened Header with Account Menu */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-gradient-to-br from-[oklch(0.45_0.12_155)] to-[oklch(0.55_0.10_150)] rounded-full flex items-center justify-center shadow-sm">
                <Sprout className="size-5 text-white" />
              </div>
              <h1 className="text-2xl font-semibold">Local Food Marketplace</h1>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Search on desktop (D - reduce noise) */}
              
              {/* Cart Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/cart')}
                className="relative focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                <ShoppingCart className="size-4 sm:mr-2" />
                <span className="hidden sm:inline">Cart</span>
                {getTotalItems() > 0 && (
                  <Badge className="ml-2 px-1.5 min-w-5 h-5 flex items-center justify-center">
                    {getTotalItems()}
                  </Badge>
                )}
              </Button>
              
              {/* Account Menu (D - compact) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                  >
                    <User className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Hello, {user?.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="size-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search products, producers, categories... (Press / to focus)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 hidden sm:block"
              id="marketplace-search"
            />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 sm:hidden"
              id="marketplace-search-mobile"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </header>

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
                      {allProducts.filter(p => p.isSurplus).length}
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
                    <SelectItem value="price-low">Price (low → high)</SelectItem>
                    <SelectItem value="price-high">Price (high → low)</SelectItem>
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
                    <p className="text-gray-700 font-medium">No products match these filters</p>
                    <p className="text-sm text-gray-500">Try adjusting your filters to see more results</p>
                    <div className="flex flex-wrap gap-2 justify-center">
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
  handleAddToCart 
}: { 
  product: Product; 
  handleAddToCart: (product: Product, quantity: number, e: React.MouseEvent) => void;
}) {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

  const isAvailable = product.availability !== 'unavailable' && product.stock > 0;
  const hasAllergens = product.allergens && product.allergens.length > 0;
  const maxQuantity = Math.min(product.stock, 99);

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
              <div className="px-3 py-1 text-sm font-medium min-w-[3rem] text-center">
                {quantity}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-l-none focus-visible:ring-2 focus-visible:ring-green-600"
                onClick={incrementQuantity}
                disabled={quantity >= maxQuantity}
                aria-label="Increase quantity"
              >
                <Plus className="size-3" />
              </Button>
            </div>
            <Button
              size="sm"
              className="flex-1 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              onClick={(e) => handleAddToCart(product, quantity, e)}
              aria-label={`Add ${quantity} ${product.unit} of ${product.name} to cart`}
            >
              Add {quantity} {product.unit}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
