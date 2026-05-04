/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ProducerInventoryPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Edit,
  HelpCircle,
  Loader2,
  Plus,
  Tag,
  XCircle,
} from 'lucide-react';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useSafeBack } from '../../lib/navigation';
import { AvailabilityBadge, OrganicBadge, SurplusBadge } from '../../components/ProductBadges';
import { ImageSourceField } from '../../components/ImageSourceField';
import { SiteHeader } from '../../components/SiteHeader';
import { PageLoadingSkeleton } from '../../components/LoadingSkeletons';
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

type HealthFilter = 'all' | 'low-stock' | 'out-of-stock' | 'surplus' | 'season-ending' | 'season-starting';
type MonthOption = { value: number; label: string };

interface ProductDraft {
  stock: string;
  lowStockThreshold: string;
  availability: AvailabilityType;
  harvestDate: string;
  seasonStartMonth: string;
  seasonEndMonth: string;
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
  lowStockThreshold: string;
  allergens: string[];
  harvestDate: string;
  seasonStartMonth: string;
  seasonEndMonth: string;
  imageUrl: string;
  isSurplus: boolean;
  surplusDiscountPercent: string;
}

/**
 * UNIT_OPTIONS boundary.
 *
 * This exported unit supports the file role: Implements the ProducerInventoryPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const UNIT_OPTIONS: ProductUnit[] = ['kg', 'litre', 'dozen', 'each'];
const MONTH_OPTIONS: MonthOption[] = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];
/**
 * ALLERGEN_OPTIONS boundary.
 *
 * This exported unit supports the file role: Implements the ProducerInventoryPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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

function currentMonthNumber(): number {
  return new Date().getMonth() + 1;
}

function defaultSeasonEndMonth(startMonth: number): number {
  return ((startMonth + 2 - 1) % 12) + 1;
}

function getEffectiveAvailability(product: Product): AvailabilityType {
  return product.effectiveAvailability ?? product.availability;
}

function initialNewProductForm(): NewProductForm {
  const startMonth = currentMonthNumber();
  return {
    name: '',
    category: 'Vegetables',
    description: '',
    price: '',
    unit: 'kg',
    availability: 'in-season',
    stock: '0',
    lowStockThreshold: '10',
    allergens: [],
    harvestDate: todayIso(),
    seasonStartMonth: String(startMonth),
    seasonEndMonth: String(defaultSeasonEndMonth(startMonth)),
    imageUrl: '',
    isSurplus: false,
    surplusDiscountPercent: '20',
  };
}

function toDraft(product: Product): ProductDraft {
  const configuredAvailability = product.configuredAvailability ?? product.availability;
  const startMonth = product.seasonStartMonth ?? currentMonthNumber();
  return {
    stock: String(product.stock),
    lowStockThreshold: String(product.lowStockThreshold ?? 10),
    availability: configuredAvailability,
    harvestDate: product.harvestDate || todayIso(),
    seasonStartMonth: String(startMonth),
    seasonEndMonth: String(product.seasonEndMonth ?? defaultSeasonEndMonth(startMonth)),
    isSurplus: Boolean(product.isSurplus),
    surplusDiscountPercent: String(product.surplusDiscount ?? 20),
  };
}

function isSeasonEndingSoon(product: Product): boolean {
  if (getEffectiveAvailability(product) !== 'in-season') {
    return false;
  }
  if (!product.seasonEndMonth) {
    if (!product.harvestDate) {
      return false;
    }
    const parsed = parseISO(product.harvestDate);
    if (!isValid(parsed)) {
      return false;
    }
    const days = differenceInCalendarDays(parsed, new Date());
    return days >= 0 && days <= 14;
  }

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  let endYear = currentYear;
  if (product.seasonStartMonth && product.seasonStartMonth > product.seasonEndMonth && currentMonth <= product.seasonEndMonth) {
    endYear = currentYear;
  } else if (product.seasonStartMonth && product.seasonStartMonth > product.seasonEndMonth && currentMonth > product.seasonStartMonth) {
    endYear = currentYear + 1;
  }
  const seasonEndDate = new Date(endYear, product.seasonEndMonth, 0);
  const days = differenceInCalendarDays(seasonEndDate, today);
  return days >= 0 && days <= 30;
}

function isSeasonStartingSoon(product: Product): boolean {
  return Boolean(product.seasonalReminderMessage);
}

function parseMonthInput(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) {
    return undefined;
  }
  return parsed;
}

function formatHarvestDate(value: string): string {
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return value;
  }
  return format(parsed, 'MMM d, yyyy');
}

function getLowStockThreshold(product: Product): number {
  return Math.max(1, product.lowStockThreshold ?? 10);
}

function isLowStock(product: Product): boolean {
  return product.stock > 0 && product.stock <= getLowStockThreshold(product);
}
/**
 * ProducerInventoryPage boundary.
 *
 * This exported unit supports the file role: Implements the ProducerInventoryPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ProducerInventoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSafeBack('/producer/dashboard');
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('create') === 'product') {
      setCreateDialogOpen(true);
    }
    if (params.get('focus') === 'surplus') {
      setFilterHealthStatus('surplus');
    }
  }, [location.search]);

  const handleCreateDialogChange = (open: boolean) => {
    setCreateDialogOpen(open);
    if (!open) {
      const params = new URLSearchParams(location.search);
      if (params.get('create') === 'product') {
        navigate('/producer/inventory', { replace: true });
      }
    }
  };

  const lowStockItems = useMemo(() => products.filter((product) => isLowStock(product)), [products]);
  const outOfStockItems = useMemo(() => products.filter((product) => product.stock === 0), [products]);
  const surplusItems = useMemo(() => products.filter((product) => product.isSurplus), [products]);
  const seasonEndingItems = useMemo(() => products.filter((product) => isSeasonEndingSoon(product)), [products]);
  const seasonStartingItems = useMemo(() => products.filter((product) => isSeasonStartingSoon(product)), [products]);

  const filteredProducts = useMemo(() => {
    if (filterHealthStatus === 'low-stock') {
      return lowStockItems;
    }
    if (filterHealthStatus === 'out-of-stock') {
      return outOfStockItems;
    }
    if (filterHealthStatus === 'surplus') {
      return surplusItems;
    }
    if (filterHealthStatus === 'season-ending') {
      return seasonEndingItems;
    }
    if (filterHealthStatus === 'season-starting') {
      return seasonStartingItems;
    }
    return products;
  }, [filterHealthStatus, lowStockItems, outOfStockItems, products, seasonEndingItems, seasonStartingItems, surplusItems]);

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
    const parsedLowStockThreshold = Number.parseInt(draft.lowStockThreshold, 10);
    if (!Number.isFinite(parsedLowStockThreshold) || parsedLowStockThreshold < 1) {
      toast.error('Low-stock threshold must be 1 or greater.');
      return;
    }

    const payload: {
      stock: number;
      lowStockThreshold: number;
      availability: AvailabilityType;
      harvestDate: string;
      seasonStartMonth?: number;
      seasonEndMonth?: number;
      isSurplus: boolean;
      surplusDiscountPercent?: number;
    } = {
      stock: parsedStock,
      lowStockThreshold: parsedLowStockThreshold,
      availability: draft.availability,
      harvestDate: draft.harvestDate || todayIso(),
      isSurplus: draft.isSurplus,
    };

    if (draft.availability === 'in-season') {
      const seasonStartMonth = parseMonthInput(draft.seasonStartMonth);
      const seasonEndMonth = parseMonthInput(draft.seasonEndMonth);
      if (!seasonStartMonth || !seasonEndMonth) {
        toast.error('Choose a season start and end month for seasonal products.');
        return;
      }
      payload.seasonStartMonth = seasonStartMonth;
      payload.seasonEndMonth = seasonEndMonth;
    }

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
    const currentConfiguredAvailability = product.configuredAvailability ?? product.availability;
    const newAvailability: AvailabilityType =
      newStock === 0
        ? currentConfiguredAvailability
        : currentConfiguredAvailability === 'unavailable'
          ? 'year-round'
          : currentConfiguredAvailability;

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
              availability: product.configuredAvailability ?? product.availability,
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
    const lowStockThreshold = Number.parseInt(newProduct.lowStockThreshold, 10);
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
    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 1) {
      toast.error('Low-stock threshold must be 1 or greater.');
      return;
    }
    if (newProduct.availability === 'in-season') {
      const seasonStartMonth = parseMonthInput(newProduct.seasonStartMonth);
      const seasonEndMonth = parseMonthInput(newProduct.seasonEndMonth);
      if (!seasonStartMonth || !seasonEndMonth) {
        toast.error('Choose a season start and end month for seasonal products.');
        return;
      }
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
          lowStockThreshold,
          allergens: newProduct.allergens,
          harvestDate: newProduct.harvestDate || todayIso(),
          seasonStartMonth:
            newProduct.availability === 'in-season' ? parseMonthInput(newProduct.seasonStartMonth) : undefined,
          seasonEndMonth:
            newProduct.availability === 'in-season' ? parseMonthInput(newProduct.seasonEndMonth) : undefined,
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
      <SiteHeader />

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:min-h-[calc(100svh-60px)] lg:px-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={goBack}
            className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#e4e1d8] bg-[#fffefa] p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--earth-accent)]">Producer inventory</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Stock Management</h1>
            <p className="mt-1 text-sm text-gray-700">Product availability, low-stock alerts, allergens, seasons, and surplus deals.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setFilterHealthStatus('surplus')}
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

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
            className={`cursor-pointer transition-all hover:shadow-md border-[#d8d0c0] bg-[#f5f0e8] ${filterHealthStatus === 'surplus' ? 'ring-2 ring-[var(--earth-accent)]' : ''}`}
            onClick={() => setFilterHealthStatus('surplus')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Surplus deals</p>
                  <p className="text-2xl font-semibold text-[var(--earth-accent)]">{surplusItems.length}</p>
                </div>
                <Tag className="size-8 text-[var(--earth-accent)]" />
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

          <Card
            className={`cursor-pointer transition-all hover:shadow-md border-emerald-200 bg-emerald-50/30 ${filterHealthStatus === 'season-starting' ? 'ring-2 ring-emerald-600' : ''}`}
            onClick={() => setFilterHealthStatus('season-starting')}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">Season starting soon</p>
                  <p className="text-2xl font-semibold text-emerald-700">{seasonStartingItems.length}</p>
                </div>
                <Calendar className="size-8 text-emerald-600" />
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
          <PageLoadingSkeleton rows={4} cards={3} />
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
                              <AvailabilityBadge availability={getEffectiveAvailability(product)} />
                              {product.isOrganic && <OrganicBadge />}
                              {product.isSurplus && <SurplusBadge />}
                              {product.stock === 0 && (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="size-3" />
                                  Out of stock
                                </Badge>
                              )}
                              {isLowStock(product) && (
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
                        <p className="font-semibold">£{product.price.toFixed(2)}/{product.unit}</p>
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
                        <p className="text-sm text-gray-600">Low-stock Threshold</p>
                        <p className="font-medium">{getLowStockThreshold(product)} {product.unit}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Harvest Date</p>
                        <p className="font-medium">{formatHarvestDate(product.harvestDate)}</p>
                      </div>
                    </div>
                    {(product.seasonalDates || product.seasonalStatusMessage || product.seasonalReminderMessage) && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-1">
                        <p className="text-sm font-medium text-emerald-900">
                          Seasonal window: {product.seasonalDates || 'Configured from producer settings'}
                        </p>
                        {product.seasonalStatusMessage && (
                          <p className="text-sm text-emerald-800">{product.seasonalStatusMessage}</p>
                        )}
                        {product.seasonalReminderMessage && (
                          <p className="text-sm font-medium text-emerald-700">{product.seasonalReminderMessage}</p>
                        )}
                      </div>
                    )}

                    {editingId === product.id && (
                      <div className="pt-4 border-t space-y-6">
                        <div className="grid md:grid-cols-3 gap-6">
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
                            <Label htmlFor={`low-stock-threshold-${product.id}`} className="flex items-center gap-2">
                              Low-stock Threshold
                              <HelpCircle className="size-3 text-gray-400" />
                            </Label>
                            <Input
                              id={`low-stock-threshold-${product.id}`}
                              type="number"
                              min="1"
                              step="1"
                              value={draft.lowStockThreshold}
                              onChange={(event) => updateDraft(product.id, 'lowStockThreshold', event.target.value)}
                              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            />
                            <p className="text-xs text-gray-500">
                              Trigger a dashboard notification when stock reaches this level or lower.
                            </p>
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
                          {draft.availability === 'in-season' && (
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                Seasonal window
                                <HelpCircle className="size-3 text-gray-400" />
                              </Label>
                              <div className="grid grid-cols-2 gap-3">
                                <Select
                                  value={draft.seasonStartMonth}
                                  onValueChange={(value) => updateDraft(product.id, 'seasonStartMonth', value)}
                                >
                                  <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                                    <SelectValue placeholder="Start month" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MONTH_OPTIONS.map((month) => (
                                      <SelectItem key={`start-${month.value}`} value={String(month.value)}>
                                        {month.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Select
                                  value={draft.seasonEndMonth}
                                  onValueChange={(value) => updateDraft(product.id, 'seasonEndMonth', value)}
                                >
                                  <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                                    <SelectValue placeholder="End month" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MONTH_OPTIONS.map((month) => (
                                      <SelectItem key={`end-${month.value}`} value={String(month.value)}>
                                        {month.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="text-xs text-gray-500">
                                Customers can order this product only during the chosen months.
                              </p>
                            </div>
                          )}
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
                                <li>Use a seasonal window for produce that should automatically appear and disappear through the year.</li>
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

      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
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

            <div className="grid md:grid-cols-4 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="new-low-stock-threshold">Low-stock Threshold</Label>
                <Input
                  id="new-low-stock-threshold"
                  type="number"
                  min="1"
                  step="1"
                  value={newProduct.lowStockThreshold}
                  onChange={(event) =>
                    setNewProduct((previous) => ({ ...previous, lowStockThreshold: event.target.value }))
                  }
                  required
                />
                <p className="text-xs text-gray-500">
                  A notification will appear on the producer dashboard when stock reaches this amount or lower.
                </p>
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
            </div>

            {newProduct.availability === 'in-season' && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-season-start">Season starts</Label>
                  <Select
                    value={newProduct.seasonStartMonth}
                    onValueChange={(value) => setNewProduct((previous) => ({ ...previous, seasonStartMonth: value }))}
                  >
                    <SelectTrigger id="new-season-start">
                      <SelectValue placeholder="Select start month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((month) => (
                        <SelectItem key={`new-start-${month.value}`} value={String(month.value)}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-season-end">Season ends</Label>
                  <Select
                    value={newProduct.seasonEndMonth}
                    onValueChange={(value) => setNewProduct((previous) => ({ ...previous, seasonEndMonth: value }))}
                  >
                    <SelectTrigger id="new-season-end">
                      <SelectValue placeholder="Select end month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_OPTIONS.map((month) => (
                        <SelectItem key={`new-end-${month.value}`} value={String(month.value)}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 items-start">
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
              <ImageSourceField
                id="new-image"
                label="Image URL (optional)"
                value={newProduct.imageUrl}
                onChange={(value) => setNewProduct((previous) => ({ ...previous, imageUrl: value }))}
                uploadScope="products"
                helpText="Paste an image URL or upload a product photo from your computer."
              />
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
