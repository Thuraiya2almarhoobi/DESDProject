import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Edit,
  Eye,
  HelpCircle,
  Loader2,
  Plus,
  Tag,
  XCircle,
} from 'lucide-react';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../../components/ProductBadges';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { AvailabilityType, Product, ProductUnit } from '../../types';
import {
  createProducerProductInApi,
  fetchProducerProductsFromApi,
  patchProducerProductInApi,
} from '../../services/productApi';

type HealthFilter = 'all' | 'low-stock' | 'out-of-stock' | 'season-ending';

interface ProductDraft {
  stock: string;
  availability: AvailabilityType;
  harvestDate: string;
  isSurplus: boolean;
  surplusDiscountPercent: string;
}

interface NewProductForm {
  name: string;
  category: string;
  description: string;
  price: string;
  unit: ProductUnit;
  availability: AvailabilityType;
  stock: string;
  allergens: string[];
  harvestDate: string;
  imageUrl: string;
  isSurplus: boolean;
  surplusDiscountPercent: string;
}

const UNIT_OPTIONS: ProductUnit[] = ['kg', 'litre', 'dozen', 'each'];
const ALLERGEN_OPTIONS = [
  'Celery',
  'Cereals containing gluten (such as wheat, rye, barley, and oats)',
  'Crustaceans (such as prawns, crabs, and lobsters)',
  'Eggs',
  'Fish',
  'Lupin',
  'Milk',
  'Molluscs (such as mussels and oysters)',
  'Mustard',
  'Peanuts',
  'Sesame',
  'Soybeans',
  'Sulphur dioxide and sulphites (at concentrations of more than 10 parts per million)',
  'Tree nuts (almonds, hazelnuts, walnuts, brazil nuts, cashews, pecans, pistachios, and macadamia nuts)',
] as const;

function toggleSelectedAllergen(selected: string[], allergen: string, checked: boolean): string[] {
  if (checked) {
    return selected.includes(allergen) ? selected : [...selected, allergen];
  }
  return selected.filter((item) => item !== allergen);
}

function getSelectedAllergenSummary(allergens: string[]): string {
  if (allergens.length === 0) {
    return 'Select allergens';
  }
  if (allergens.length <= 2) {
    return allergens.join(', ');
  }
  return `${allergens.length} allergens selected`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialNewProductForm(): NewProductForm {
  return {
    name: '',
    category: 'Vegetables',
    description: '',
    price: '',
    unit: 'kg',
    availability: 'in-season',
    stock: '0',
    allergens: [],
    harvestDate: todayIso(),
    imageUrl: '',
    isSurplus: false,
    surplusDiscountPercent: '20',
  };
}

function toDraft(product: Product): ProductDraft {
  return {
    stock: String(product.stock),
    availability: product.availability,
    harvestDate: product.harvestDate || todayIso(),
    isSurplus: Boolean(product.isSurplus),
    surplusDiscountPercent: String(product.surplusDiscount ?? 20),
  };
}

function isSeasonEndingSoon(product: Product): boolean {
  if (product.availability !== 'in-season' || !product.harvestDate) {
    return false;
  }
  const parsed = parseISO(product.harvestDate);
  if (!isValid(parsed)) {
    return false;
  }
  const days = differenceInCalendarDays(parsed, new Date());
  return days >= 0 && days <= 14;
}

function formatHarvestDate(value: string): string {
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return value;
  }
  return format(parsed, 'MMM d, yyyy');
}
export function ProducerInventoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const demoUserEmail = (user?.email || 'producer@example.com').trim().toLowerCase();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAllOutOfStock, setSavingAllOutOfStock] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [filterHealthStatus, setFilterHealthStatus] = useState<HealthFilter>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState<NewProductForm>(initialNewProductForm);
  const [creatingProduct, setCreatingProduct] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadProducts = async () => {
      setLoading(true);
      try {
        const payload = await fetchProducerProductsFromApi(demoUserEmail);
        if (!mounted) {
          return;
        }
        setProducts(payload);
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : 'Unable to load producer inventory.';
          toast.error(message);
          setProducts([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadProducts();

    return () => {
      mounted = false;
    };
  }, [demoUserEmail]);

  const lowStockItems = useMemo(() => products.filter((product) => product.stock > 0 && product.stock < 10), [products]);
  const outOfStockItems = useMemo(() => products.filter((product) => product.stock === 0), [products]);
  const seasonEndingItems = useMemo(() => products.filter((product) => isSeasonEndingSoon(product)), [products]);

  const filteredProducts = useMemo(() => {
    if (filterHealthStatus === 'low-stock') {
      return lowStockItems;
    }
    if (filterHealthStatus === 'out-of-stock') {
      return outOfStockItems;
    }
    if (filterHealthStatus === 'season-ending') {
      return seasonEndingItems;
    }
    return products;
  }, [filterHealthStatus, lowStockItems, outOfStockItems, products, seasonEndingItems]);

  const openEditor = (product: Product) => {
    if (editingId === product.id) {
      setEditingId(null);
      return;
    }
    setDrafts((previous) => ({
      ...previous,
      [product.id]: previous[product.id] || toDraft(product),
    }));
    setEditingId(product.id);
  };

  const updateDraft = (productId: string, field: keyof ProductDraft, value: string | boolean) => {
    setDrafts((previous) => {
      const existing = previous[productId];
      if (!existing) {
        return previous;
      }
      return {
        ...previous,
        [productId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const saveDraft = async (productId: string) => {
    const draft = drafts[productId];
    if (!draft) {
      return;
    }

    const parsedStock = Number.parseInt(draft.stock, 10);
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      toast.error('Stock quantity must be zero or greater.');
      return;
    }

    const payload: {
      stock: number;
      availability: AvailabilityType;
      harvestDate: string;
      isSurplus: boolean;
      surplusDiscountPercent?: number;
    } = {
      stock: parsedStock,
      availability: draft.availability,
      harvestDate: draft.harvestDate || todayIso(),
      isSurplus: draft.isSurplus,
    };

    if (draft.isSurplus) {
      const parsedDiscount = Number.parseInt(draft.surplusDiscountPercent, 10);
      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 10 || parsedDiscount > 50) {
        toast.error('Surplus discount must be between 10 and 50.');
        return;
      }
      payload.surplusDiscountPercent = parsedDiscount;
    }

    try {
      const updated = await patchProducerProductInApi(productId, payload, demoUserEmail);
      setProducts((previous) =>
        previous.map((product) => (product.id === updated.id ? updated : product)),
      );
      setDrafts((previous) => ({
        ...previous,
        [productId]: toDraft(updated),
      }));
      toast.success('Product updated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update product.';
      toast.error(message);
    }
  };

  const toggleInStock = async (product: Product) => {
    const newStock = product.stock === 0 ? 10 : 0;
    const newAvailability: AvailabilityType =
      newStock === 0 ? 'unavailable' : product.availability === 'unavailable' ? 'year-round' : product.availability;

    try {
      const updated = await patchProducerProductInApi(
        product.id,
        {
          stock: newStock,
          availability: newAvailability,
        },
        demoUserEmail,
      );
      setProducts((previous) =>
        previous.map((row) => (row.id === updated.id ? updated : row)),
      );
      setDrafts((previous) => ({
        ...previous,
        [product.id]: toDraft(updated),
      }));
      toast.success(newStock === 0 ? 'Product marked out of stock.' : 'Product marked in stock.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update stock.';
      toast.error(message);
    }
  };

  const markAllOutOfStock = async () => {
    const inStockProducts = products.filter((product) => product.stock > 0);
    if (inStockProducts.length === 0) {
      toast.info('All products are already out of stock.');
      return;
    }

    setSavingAllOutOfStock(true);
    try {
      const updates = await Promise.all(
        inStockProducts.map((product) =>
          patchProducerProductInApi(
            product.id,
            {
              stock: 0,
              availability: 'unavailable',
            },
            demoUserEmail,
          ),
        ),
      );

      const byId = new Map(updates.map((product) => [product.id, product]));
      setProducts((previous) => previous.map((product) => byId.get(product.id) || product));
      setDrafts((previous) => {
        const next = { ...previous };
        updates.forEach((product) => {
          next[product.id] = toDraft(product);
        });
        return next;
      });
      toast.success(`Marked ${updates.length} product(s) out of stock.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update all products.';
      toast.error(message);
    } finally {
      setSavingAllOutOfStock(false);
    }
  };

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const price = Number.parseFloat(newProduct.price);
    const stock = Number.parseInt(newProduct.stock, 10);
    if (!newProduct.name.trim() || !newProduct.category.trim() || !newProduct.description.trim()) {
      toast.error('Name, category, and description are required.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Price must be greater than zero.');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      toast.error('Stock must be zero or greater.');
      return;
    }

    let parsedDiscount: number | undefined;
    if (newProduct.isSurplus) {
      parsedDiscount = Number.parseInt(newProduct.surplusDiscountPercent, 10);
      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 10 || parsedDiscount > 50) {
        toast.error('Surplus discount must be between 10 and 50.');
        return;
      }
    }

    setCreatingProduct(true);
    try {
      const created = await createProducerProductInApi(
        {
          name: newProduct.name.trim(),
          category: newProduct.category.trim(),
          description: newProduct.description.trim(),
          price,
          unit: newProduct.unit,
          availability: newProduct.availability,
          stock,
          allergens: newProduct.allergens,
          harvestDate: newProduct.harvestDate || todayIso(),
          imageUrl: newProduct.imageUrl.trim(),
          isSurplus: newProduct.isSurplus,
          surplusDiscountPercent: parsedDiscount,
        },
        demoUserEmail,
      );

      setProducts((previous) => [created, ...previous]);
      setCreateDialogOpen(false);
      setNewProduct(initialNewProductForm());
      toast.success('Product created and saved to the database.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create product.';
      toast.error(message);
    } finally {
      setCreatingProduct(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/producer/dashboard')}
              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/marketplace')}
              className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <Eye className="size-4" />
              Preview as customer
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Inventory Management</h1>
            <p className="text-gray-700 mt-1">Manage your products, stock levels, and seasonal availability</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setFilterHealthStatus('low-stock')}
              className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <Tag className="size-4" />
              Create surplus deal
            </Button>
            <Button
              className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              onClick={() => setCreateDialogOpen(true)}
            >
              <Plus className="size-4" />
              Add New Product
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${filterHealthStatus === 'all' ? 'ring-2 ring-green-600' : ''}`}
            onClick={() => setFilterHealthStatus('all')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">All products</p>
                  <p className="text-2xl font-semibold text-gray-900">{products.length}</p>
                </div>
                <CheckCircle2 className="size-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-orange-200 bg-orange-50/30 ${filterHealthStatus === 'low-stock' ? 'ring-2 ring-orange-600' : ''}`}
            onClick={() => setFilterHealthStatus('low-stock')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Low stock</p>
                  <p className="text-2xl font-semibold text-orange-700">{lowStockItems.length}</p>
                </div>
                <AlertCircle className="size-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-red-200 bg-red-50/30 ${filterHealthStatus === 'out-of-stock' ? 'ring-2 ring-red-600' : ''}`}
            onClick={() => setFilterHealthStatus('out-of-stock')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Out of stock</p>
                  <p className="text-2xl font-semibold text-red-700">{outOfStockItems.length}</p>
                </div>
                <XCircle className="size-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-blue-200 bg-blue-50/30 ${filterHealthStatus === 'season-ending' ? 'ring-2 ring-blue-600' : ''}`}
            onClick={() => setFilterHealthStatus('season-ending')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Season ending</p>
                  <p className="text-2xl font-semibold text-blue-700">{seasonEndingItems.length}</p>
                </div>
                <Calendar className="size-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              Showing {filteredProducts.length} of {products.length} products
            </Badge>
            {filterHealthStatus !== 'all' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterHealthStatus('all')}
                className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                Clear filter
              </Button>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={savingAllOutOfStock}
                className="gap-2 text-red-600 border-red-300 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              >
                {savingAllOutOfStock ? <Loader2 className="size-4 animate-spin" /> : <AlertTriangle className="size-4" />}
                Mark all out of stock
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark all products out of stock?</AlertDialogTitle>
                <AlertDialogDescription>
                  This sets stock to 0 for all currently in-stock products and hides them from customer searches.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={markAllOutOfStock}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Mark all out of stock
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-600">
              <Loader2 className="size-6 animate-spin mx-auto mb-3" />
              Loading producer inventory...
            </CardContent>
          </Card>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">No products found for this filter</p>
              <Button
                variant="outline"
                onClick={() => setFilterHealthStatus('all')}
                className="mt-4"
              >
                View all products
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {filteredProducts.map((product) => {
              const draft = drafts[product.id] || toDraft(product);

              return (
                <Card key={product.id} className="transition-shadow hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="size-20 rounded object-cover flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <CardTitle className="text-lg mb-2">{product.name}</CardTitle>
                            <div className="flex gap-2 flex-wrap">
                              <AvailabilityBadge availability={product.availability} />
                              {product.isOrganic && <OrganicBadge />}
                              {product.isSurplus && <SurplusBadge />}
                              {product.stock === 0 && (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="size-3" />
                                  Out of stock
                                </Badge>
                              )}
                              {product.stock > 0 && product.stock < 10 && (
                                <Badge variant="outline" className="gap-1 border-orange-300 bg-orange-50 text-orange-700">
                                  <AlertCircle className="size-3" />
                                  Low stock
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={product.stock === 0 ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => toggleInStock(product)}
                              className="gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            >
                              {product.stock === 0 ? (
                                <>
                                  <CheckCircle2 className="size-4" />
                                  Mark in stock
                                </>
                              ) : (
                                <>
                                  <XCircle className="size-4" />
                                  Mark out of stock
                                </>
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditor(product)}
                              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            >
                              <Edit className="size-4 mr-2" />
                              {editingId === product.id ? 'Done' : 'Edit'}
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{product.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Price</p>
                        <p className="font-semibold">Â£{product.price.toFixed(2)}/{product.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Category</p>
                        <p className="font-medium">{product.category}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Current Stock</p>
                        <p className="font-medium">{product.stock} {product.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Harvest Date</p>
                        <p className="font-medium">{formatHarvestDate(product.harvestDate)}</p>
                      </div>
                    </div>

                    {editingId === product.id && (
                      <div className="pt-4 border-t space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor={`stock-${product.id}`} className="flex items-center gap-2">
                              Update Stock Level
                              <HelpCircle className="size-3 text-gray-400" />
                            </Label>
                            <div className="flex gap-2">
                              <Input
                                id={`stock-${product.id}`}
                                type="number"
                                min="0"
                                value={draft.stock}
                                onChange={(event) => updateDraft(product.id, 'stock', event.target.value)}
                                className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                              />
                              <div className="flex items-center px-3 border rounded-md bg-gray-50 text-sm text-gray-700 font-medium min-w-[4rem] justify-center">
                                {product.unit}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`avail-${product.id}`} className="flex items-center gap-2">
                              Availability
                              <HelpCircle className="size-3 text-gray-400" />
                            </Label>
                            <Select
                              value={draft.availability}
                              onValueChange={(value) => updateDraft(product.id, 'availability', value as AvailabilityType)}
                            >
                              <SelectTrigger
                                id={`avail-${product.id}`}
                                className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="in-season">In season</SelectItem>
                                <SelectItem value="year-round">Year-round</SelectItem>
                                <SelectItem value="unavailable">Unavailable</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor={`harvest-${product.id}`}>Harvest Date</Label>
                            <Input
                              id={`harvest-${product.id}`}
                              type="date"
                              value={draft.harvestDate}
                              onChange={(event) => updateDraft(product.id, 'harvestDate', event.target.value)}
                              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 pt-6">
                              <Switch
                                id={`surplus-${product.id}`}
                                checked={draft.isSurplus}
                                onCheckedChange={(value) => updateDraft(product.id, 'isSurplus', value)}
                              />
                              <Label htmlFor={`surplus-${product.id}`}>Mark as surplus deal</Label>
                            </div>
                            {draft.isSurplus && (
                              <div className="space-y-2">
                                <Label htmlFor={`discount-${product.id}`}>Discount % (10-50)</Label>
                                <Input
                                  id={`discount-${product.id}`}
                                  type="number"
                                  min="10"
                                  max="50"
                                  value={draft.surplusDiscountPercent}
                                  onChange={(event) => updateDraft(product.id, 'surplusDiscountPercent', event.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            onClick={() => saveDraft(product.id)}
                            className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                          >
                            Save Changes
                          </Button>
                        </div>

                        <Separator />

                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <div className="flex gap-3">
                            <HelpCircle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-2 text-sm text-blue-900">
                              <p className="font-medium">Quick tips:</p>
                              <ul className="space-y-1 text-blue-800">
                                <li>Stock level 0 hides products from customer search.</li>
                                <li>Use harvest date + in-season status for seasonal visibility.</li>
                                <li>Use surplus deals to move low-stock or short-life items quickly.</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              This saves directly to the producer inventory table and immediately surfaces in customer-facing product flows.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-name">Product Name</Label>
                <Input
                  id="new-name"
                  value={newProduct.name}
                  onChange={(event) => setNewProduct((previous) => ({ ...previous, name: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-category">Category</Label>
                <Input
                  id="new-category"
                  value={newProduct.category}
                  onChange={(event) => setNewProduct((previous) => ({ ...previous, category: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-description">Description</Label>
              <Textarea
                id="new-description"
                value={newProduct.description}
                onChange={(event) => setNewProduct((previous) => ({ ...previous, description: event.target.value }))}
                required
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-price">Price (GBP)</Label>
                <Input
                  id="new-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newProduct.price}
                  onChange={(event) => setNewProduct((previous) => ({ ...previous, price: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-unit">Unit</Label>
                <Select
                  value={newProduct.unit}
                  onValueChange={(value) => setNewProduct((previous) => ({ ...previous, unit: value as ProductUnit }))}
                >
                  <SelectTrigger id="new-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-stock">Stock Quantity</Label>
                <Input
                  id="new-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={newProduct.stock}
                  onChange={(event) => setNewProduct((previous) => ({ ...previous, stock: event.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-availability">Availability</Label>
                <Select
                  value={newProduct.availability}
                  onValueChange={(value) => setNewProduct((previous) => ({ ...previous, availability: value as AvailabilityType }))}
                >
                  <SelectTrigger id="new-availability">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in-season">In season</SelectItem>
                    <SelectItem value="year-round">Year-round</SelectItem>
                    <SelectItem value="unavailable">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-harvest-date">Harvest Date</Label>
                <Input
                  id="new-harvest-date"
                  type="date"
                  value={newProduct.harvestDate}
                  onChange={(event) => setNewProduct((previous) => ({ ...previous, harvestDate: event.target.value }))}
                  required
                />
              </div>
            </div>            <div className="grid md:grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <Label htmlFor="new-allergens">Allergen Information</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="new-allergens"
                      type="button"
                      variant="outline"
                      className="w-full items-start justify-between gap-3 text-left font-normal whitespace-normal"
                    >
                      <span>{getSelectedAllergenSummary(newProduct.allergens)}</span>
                      <ChevronDown className="size-4 shrink-0 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[min(32rem,calc(100vw-3rem))] p-0">
                    <div className="border-b px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">UK allergen checklist</p>
                      <p className="text-sm text-slate-600">Tick every allergen present in this product. Leave all unchecked if none apply.</p>
                    </div>
                    <ScrollArea className="h-64">
                      <div className="space-y-1 p-2">
                        {ALLERGEN_OPTIONS.map((allergen, index) => {
                          const checkboxId = `new-allergen-${index}`;
                          return (
                            <label
                              key={allergen}
                              htmlFor={checkboxId}
                              className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 hover:bg-slate-50"
                            >
                              <Checkbox
                                id={checkboxId}
                                checked={newProduct.allergens.includes(allergen)}
                                onCheckedChange={(checked) =>
                                  setNewProduct((previous) => ({
                                    ...previous,
                                    allergens: toggleSelectedAllergen(previous.allergens, allergen, checked === true),
                                  }))
                                }
                                className="mt-0.5"
                              />
                              <span className="text-sm leading-5 text-slate-700">{allergen}</span>
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                <p className="text-sm text-gray-500">Choose from the 14 UK law allergens instead of typing them manually.</p>
                {newProduct.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newProduct.allergens.map((allergen) => (
                      <Badge key={allergen} variant="secondary" className="max-w-full whitespace-normal">
                        {allergen}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-image">Image URL (optional)</Label>
                <Input
                  id="new-image"
                  value={newProduct.imageUrl}
                  onChange={(event) => setNewProduct((previous) => ({ ...previous, imageUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="new-is-surplus"
                  checked={newProduct.isSurplus}
                  onCheckedChange={(checked) => setNewProduct((previous) => ({ ...previous, isSurplus: checked }))}
                />
                <Label htmlFor="new-is-surplus">Mark as surplus deal</Label>
              </div>
              {newProduct.isSurplus && (
                <div className="space-y-2">
                  <Label htmlFor="new-discount">Surplus Discount % (10-50)</Label>
                  <Input
                    id="new-discount"
                    type="number"
                    min="10"
                    max="50"
                    value={newProduct.surplusDiscountPercent}
                    onChange={(event) =>
                      setNewProduct((previous) => ({ ...previous, surplusDiscountPercent: event.target.value }))
                    }
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creatingProduct}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creatingProduct}>
                {creatingProduct ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  'Create Product'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


