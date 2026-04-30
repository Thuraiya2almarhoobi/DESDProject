import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  LineChart,
  Package,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { apiJson } from '../../lib/api';
import { fetchProducerProductsFromApi } from '../../services/productApi';
import { SiteHeader } from '../../components/SiteHeader';
import { PageLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';

type ProducerOrderStatus = 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';

interface ProducerSubOrderItemApi {
  product_name: string;
  quantity: string;
  unit: string;
  line_total: string;
}

interface ProducerSubOrderApi {
  id: number;
  order_number: string;
  status: ProducerOrderStatus;
  delivery_date: string;
  subtotal_amount: string;
  commission_amount: string;
  payout_amount: string;
  customer_name: string;
  customer_email: string;
  items: ProducerSubOrderItemApi[];
}

interface ProducerProductApiView {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  availability: 'in-season' | 'year-round' | 'unavailable';
  configuredAvailability?: 'in-season' | 'year-round' | 'unavailable';
  effectiveAvailability?: 'in-season' | 'year-round' | 'unavailable';
  isSurplus?: boolean;
  seasonalReminderMessage?: string;
}

interface WeeklySettlementApi {
  id: number;
  week_start: string;
  week_end: string;
  net_amount: string;
  commission_amount: string;
  status: string;
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  path: string;
  tone: 'urgent' | 'warning' | 'neutral' | 'success';
  icon: LucideIcon;
  action: string;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return `£${value.toFixed(2)}`;
}

function getLowStockThreshold(product: ProducerProductApiView): number {
  return Math.max(1, product.lowStockThreshold || 10);
}

function isLowStock(product: ProducerProductApiView): boolean {
  return product.stock > 0 && product.stock <= getLowStockThreshold(product);
}

function isUrgentOrder(order: ProducerSubOrderApi): boolean {
  const deliveryDate = parseISO(order.delivery_date);
  if (!isValid(deliveryDate)) {
    return false;
  }
  const hours = Math.ceil((deliveryDate.getTime() - Date.now()) / 3_600_000);
  return hours > 0 && hours < 24 && order.status !== 'delivered' && order.status !== 'cancelled';
}

function chartCurrencyTick(value: number): string {
  if (value >= 1000) {
    return `£${Math.round(value / 1000)}k`;
  }
  return `£${value}`;
}

const PIE_COLORS = ['#1a5c35', '#9b9184', '#7a7063', '#c35b3f'];

export function ProducerDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const producerEmail = (user?.email || 'producer@example.com').trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ProducerSubOrderApi[]>([]);
  const [products, setProducts] = useState<ProducerProductApiView[]>([]);
  const [settlements, setSettlements] = useState<WeeklySettlementApi[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const [orderPayload, productPayload, settlementPayload] = await Promise.all([
          apiJson<ProducerSubOrderApi[]>('/api/orders/producer/sub-orders/'),
          fetchProducerProductsFromApi(producerEmail),
          apiJson<WeeklySettlementApi[]>('/api/payments/settlements/'),
        ]);

        if (!mounted) {
          return;
        }

        setOrders(orderPayload);
        setProducts(
          productPayload.map((product) => ({
            id: product.id,
            name: product.name,
            stock: product.stock,
            lowStockThreshold: product.lowStockThreshold ?? 10,
            availability: product.availability,
            configuredAvailability: product.configuredAvailability,
            effectiveAvailability: product.effectiveAvailability,
            isSurplus: product.isSurplus,
            seasonalReminderMessage: product.seasonalReminderMessage,
          })),
        );
        setSettlements(settlementPayload);
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : 'Unable to load producer dashboard data.';
          toast.error(message);
          setOrders([]);
          setProducts([]);
          setSettlements([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadDashboardData();
    return () => {
      mounted = false;
    };
  }, [producerEmail]);

  const pendingOrders = useMemo(() => orders.filter((order) => order.status === 'pending'), [orders]);
  const confirmedOrders = useMemo(() => orders.filter((order) => order.status === 'confirmed'), [orders]);
  const readyOrders = useMemo(() => orders.filter((order) => order.status === 'ready'), [orders]);
  const deliveredOrders = useMemo(() => orders.filter((order) => order.status === 'delivered'), [orders]);
  const urgentOrders = useMemo(() => orders.filter((order) => isUrgentOrder(order)), [orders]);

  const lowStockProducts = useMemo(() => products.filter((product) => isLowStock(product)), [products]);
  const outOfStockProducts = useMemo(() => products.filter((product) => product.stock === 0), [products]);
  const unavailableProducts = useMemo(
    () => products.filter((product) => (product.effectiveAvailability ?? product.availability) === 'unavailable'),
    [products],
  );
  const seasonStartingSoonProducts = useMemo(
    () => products.filter((product) => Boolean(product.seasonalReminderMessage)),
    [products],
  );
  const activeSurplusDeals = useMemo(() => products.filter((product) => product.isSurplus && product.stock > 0), [products]);

  const payoutInPipeline = useMemo(
    () =>
      orders
        .filter((order) => order.status !== 'cancelled')
        .reduce((sum, order) => sum + toNumber(order.payout_amount), 0),
    [orders],
  );

  const latestSettlement = settlements[0] || null;
  const latestSettlementNet = latestSettlement ? toNumber(latestSettlement.net_amount) : 0;
  const latestSettlementWeek =
    latestSettlement && isValid(parseISO(latestSettlement.week_start)) && isValid(parseISO(latestSettlement.week_end))
      ? `${format(parseISO(latestSettlement.week_start), 'MMM d')} - ${format(parseISO(latestSettlement.week_end), 'MMM d')}`
      : null;

  const soldItemsSummary = useMemo(() => {
    const totals = new Map<string, number>();
    for (const order of deliveredOrders) {
      for (const item of order.items) {
        totals.set(item.product_name, (totals.get(item.product_name) || 0) + toNumber(item.quantity));
      }
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [deliveredOrders]);

  const payoutTrendData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const order of orders.filter((row) => row.status !== 'cancelled')) {
      const parsed = parseISO(order.delivery_date);
      const label = isValid(parsed) ? format(parsed, 'MMM') : 'Now';
      totals.set(label, (totals.get(label) || 0) + toNumber(order.payout_amount));
    }

    if (totals.size === 0) {
      return [{ label: 'No sales', payout: 0 }];
    }

    return Array.from(totals.entries()).map(([label, payout]) => ({ label, payout: Number(payout.toFixed(2)) }));
  }, [orders]);

  const orderStatusData = useMemo(
    () => [
      { label: 'Pending', count: pendingOrders.length },
      { label: 'Confirmed', count: confirmedOrders.length },
      { label: 'Ready', count: readyOrders.length },
      { label: 'Delivered', count: deliveredOrders.length },
    ],
    [confirmedOrders.length, deliveredOrders.length, pendingOrders.length, readyOrders.length],
  );

  const inventoryHealthData = useMemo(
    () => [
      { label: 'Healthy', value: Math.max(0, products.length - lowStockProducts.length - outOfStockProducts.length) },
      { label: 'Low', value: lowStockProducts.length },
      { label: 'Surplus', value: activeSurplusDeals.length },
      { label: 'Out', value: outOfStockProducts.length },
    ],
    [activeSurplusDeals.length, lowStockProducts.length, outOfStockProducts.length, products.length],
  );

  const notifications = useMemo(() => {
    const queue: NotificationItem[] = [];

    if (urgentOrders.length > 0) {
      queue.push({
        id: 'urgent-orders',
        title: `${urgentOrders.length} sales order${urgentOrders.length === 1 ? '' : 's'} due in under 24h`,
        description: 'Prioritise confirmation, preparation, and delivery updates.',
        path: '/producer/orders',
        tone: 'urgent',
        icon: AlertCircle,
        action: 'Open sales',
      });
    }

    if (pendingOrders.length > 0) {
      queue.push({
        id: 'pending-orders',
        title: `${pendingOrders.length} order${pendingOrders.length === 1 ? '' : 's'} waiting confirmation`,
        description: 'Customers see status updates as soon as you confirm.',
        path: '/producer/orders',
        tone: 'warning',
        icon: ShoppingBag,
        action: 'Review',
      });
    }

    if (lowStockProducts.length > 0) {
      queue.push({
        id: 'low-stock',
        title: `${lowStockProducts.length} low-stock product${lowStockProducts.length === 1 ? '' : 's'}`,
        description: lowStockProducts
          .slice(0, 2)
          .map((product) => `${product.name} (${product.stock}/${getLowStockThreshold(product)})`)
          .join(', '),
        path: '/producer/inventory',
        tone: 'warning',
        icon: AlertTriangle,
        action: 'Restock',
      });
    }

    if (outOfStockProducts.length > 0 || unavailableProducts.length > 0) {
      queue.push({
        id: 'unavailable-products',
        title: `${outOfStockProducts.length} out of stock, ${unavailableProducts.length} unavailable`,
        description: 'Adjust stock and availability so customers only see accurate listings.',
        path: '/producer/inventory',
        tone: 'urgent',
        icon: TrendingDown,
        action: 'Fix stock',
      });
    }

    if (seasonStartingSoonProducts.length > 0) {
      queue.push({
        id: 'season-starting',
        title: `${seasonStartingSoonProducts.length} seasonal product${seasonStartingSoonProducts.length === 1 ? '' : 's'} starting soon`,
        description: seasonStartingSoonProducts[0]?.seasonalReminderMessage || 'Review seasonal dates.',
        path: '/producer/inventory',
        tone: 'neutral',
        icon: Calendar,
        action: 'Review',
      });
    }

    if (queue.length === 0) {
      queue.push({
        id: 'clear',
        title: 'No urgent actions right now',
        description: 'Sales, inventory, and seasonal signals are currently stable.',
        path: '/producer/orders',
        tone: 'success',
        icon: Clock,
        action: 'View sales',
      });
    }

    return queue;
  }, [
    lowStockProducts,
    outOfStockProducts,
    pendingOrders,
    unavailableProducts,
    urgentOrders,
    seasonStartingSoonProducts,
  ]);

  const primaryActions: Array<{ label: string; description: string; icon: LucideIcon; path: string; variant: 'default' | 'outline' }> = [
    { label: 'Add product', description: 'Create a listing', icon: Plus, path: '/producer/inventory?create=product', variant: 'default' },
    { label: 'Stock', description: 'Inventory health', icon: RefreshCw, path: '/producer/inventory', variant: 'outline' },
    { label: 'Surplus', description: 'Discount excess', icon: Tag, path: '/producer/inventory?focus=surplus', variant: 'outline' },
    { label: 'Publish', description: 'Recipes and stories', icon: Sparkles, path: '/producer/publish', variant: 'outline' },
    { label: 'Buy produce', description: 'Shop as customer', icon: ShoppingBag, path: '/marketplace', variant: 'outline' },
    { label: 'Purchases', description: 'Track orders', icon: ReceiptText, path: '/orders/history', variant: 'outline' },
  ];

  const notificationToneClass: Record<NotificationItem['tone'], string> = {
    urgent: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    neutral: 'border-[#ded5c6] bg-[#f5f0e8] text-[var(--rich-soil)]',
    success: 'border-[color-mix(in_srgb,var(--forest-green)_25%,white)] bg-[color-mix(in_srgb,var(--forest-green)_7%,white)] text-[var(--forest-green)]',
  };

  return (
    <div className="min-h-screen bg-[#fbfaf4]">
      <SiteHeader />

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-5 sm:px-5 lg:min-h-[calc(100svh-60px)] lg:grid-rows-[auto_1fr] lg:px-6">
        {loading ? (
          <PageLoadingSkeleton rows={3} cards={3} />
        ) : (
          <>
            <section className="overflow-hidden rounded-2xl border border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
              <div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--earth-accent)]">
                        Producer workspace
                      </p>
                      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--rich-soil)] sm:text-4xl">
                        Sales, stock, stories, and customer buying in one place.
                      </h1>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--warm-earth)]">
                        Manage producer operations without losing access to the customer marketplace, cart, checkout,
                        and purchase tracking.
                      </p>
                    </div>
                    <Button onClick={() => navigate('/marketplace')} className="bg-[var(--forest-green)]">
                      <ShoppingBag className="mr-2 size-4" />
                      Shop market
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-[#e4e1d8] bg-[#fbfaf4] p-4">
                      <p className="text-sm text-[var(--warm-earth)]">Open sales</p>
                      <p className="mt-2 text-3xl font-semibold text-[var(--rich-soil)]">{orders.length}</p>
                    </div>
                    <div className="rounded-xl border border-[#e4e1d8] bg-[#fbfaf4] p-4">
                      <p className="text-sm text-[var(--warm-earth)]">Payout pipeline</p>
                      <p className="mt-2 text-3xl font-semibold text-[var(--forest-green)]">{formatCurrency(payoutInPipeline)}</p>
                    </div>
                    <div className="rounded-xl border border-[#e4e1d8] bg-[#fbfaf4] p-4">
                      <p className="text-sm text-[var(--warm-earth)]">Live products</p>
                      <p className="mt-2 text-3xl font-semibold text-[var(--rich-soil)]">{products.length}</p>
                    </div>
                    <div className="rounded-xl border border-[#e4e1d8] bg-[#fbfaf4] p-4">
                      <p className="text-sm text-[var(--warm-earth)]">Surplus deals</p>
                      <p className="mt-2 text-3xl font-semibold text-[var(--earth-accent)]">{activeSurplusDeals.length}</p>
                    </div>
                  </div>
                </div>

                <aside className="border-t border-[#e4e1d8] bg-[#f5f0e8] p-5 lg:border-l lg:border-t-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-[var(--rich-soil)]">Notifications</h2>
                      <p className="text-sm text-[var(--warm-earth)]">Urgent items are shown first.</p>
                    </div>
                    <Badge variant="secondary">{notifications.length}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {notifications.slice(0, 4).map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => navigate(item.path)}
                          className={`rounded-xl border p-3 text-left transition-transform hover:-translate-y-0.5 ${notificationToneClass[item.tone]}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="mt-0.5 size-5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">{item.title}</p>
                              <p className="mt-1 text-xs opacity-80">{item.description}</p>
                            </div>
                            <ArrowRight className="size-4 shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-6">
                <Card className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <LineChart className="size-5 text-[var(--forest-green)]" />
                      Producer analytics
                    </CardTitle>
                    <CardDescription>Real-time view from orders, stock, and settlements.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="h-64 rounded-xl border border-[#eee9df] bg-[#fbfaf4] p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={payoutTrendData} margin={{ left: 4, right: 12, top: 10, bottom: 0 }}>
                          <CartesianGrid stroke="#e4e1d8" strokeDasharray="3 3" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} />
                          <YAxis tickFormatter={chartCurrencyTick} tickLine={false} axisLine={false} width={42} />
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                          <Area
                            type="monotone"
                            dataKey="payout"
                            stroke="#1a5c35"
                            fill="#1a5c35"
                            fillOpacity={0.16}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid gap-4">
                      <div className="h-32 rounded-xl border border-[#eee9df] bg-[#fbfaf4] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={orderStatusData} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
                            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#1a5c35" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="h-32 rounded-xl border border-[#eee9df] bg-[#fbfaf4] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={inventoryHealthData} dataKey="value" nameKey="label" innerRadius={30} outerRadius={48}>
                              {inventoryHealthData.map((entry, index) => (
                                <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Fast actions</CardTitle>
                    <CardDescription>Focused shortcuts for tested producer and buyer workflows.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {primaryActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <Button
                          key={action.label}
                          variant={action.variant}
                          onClick={() => navigate(action.path)}
                          className="h-auto justify-start gap-3 rounded-xl border-[#ded5c6] px-4 py-4 text-left"
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--forest-green)_9%,white)] text-[var(--forest-green)]">
                            <Icon className="size-4" />
                          </span>
                          <span>
                            <span className="block font-semibold">{action.label}</span>
                            <span className="block text-xs font-normal opacity-70">{action.description}</span>
                          </span>
                        </Button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6">
                <Card className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Package className="size-5 text-[var(--earth-accent)]" />
                      Inventory health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { label: 'Low stock', value: lowStockProducts.length, icon: AlertTriangle, color: 'bg-amber-500' },
                      { label: 'Out of stock', value: outOfStockProducts.length, icon: TrendingDown, color: 'bg-red-500' },
                      { label: 'Season starting', value: seasonStartingSoonProducts.length, icon: Calendar, color: 'bg-[var(--forest-green)]' },
                      { label: 'Surplus deals', value: activeSurplusDeals.length, icon: Tag, color: 'bg-[var(--earth-accent)]' },
                    ].map((row) => {
                      const Icon = row.icon;
                      const max = Math.max(1, products.length);
                      return (
                        <div key={row.label}>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 text-[var(--rich-soil)]">
                              <Icon className="size-4 text-[var(--warm-earth)]" />
                              {row.label}
                            </span>
                            <span className="font-semibold">{row.value}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-[#eee9df]">
                            <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.min(100, (row.value / max) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Banknote className="size-5 text-[var(--forest-green)]" />
                      Payouts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--warm-earth)]">Latest settlement</span>
                      <span className="font-semibold">{latestSettlement ? formatCurrency(latestSettlementNet) : 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--warm-earth)]">Settlement week</span>
                      <span className="text-[var(--rich-soil)]">{latestSettlementWeek || 'No settlements yet'}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--warm-earth)]">Open payout pipeline</span>
                      <span className="font-semibold text-[var(--forest-green)]">{formatCurrency(payoutInPipeline)}</span>
                    </div>
                    <Separator />
                    <Button variant="outline" className="w-full gap-2" onClick={() => navigate('/producer/payments')}>
                      <Wallet className="size-4" />
                      View settlement exports
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CreditCard className="size-5 text-[var(--earth-accent)]" />
                      Buying as a producer
                    </CardTitle>
                    <CardDescription>Your producer account can now use the customer purchasing flow.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/cart')}>
                      <ShoppingBag className="size-4" />
                      Cart
                    </Button>
                    <Button variant="outline" className="justify-start gap-2" onClick={() => navigate('/orders/history')}>
                      <ReceiptText className="size-4" />
                      Purchase tracking
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-[#e4e1d8] bg-[#fffdf8] shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="size-5 text-[var(--forest-green)]" />
                      Top delivered items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {soldItemsSummary.length === 0 ? (
                      <p className="text-sm text-[var(--warm-earth)]">
                        Delivered sales will appear here after orders are completed.
                      </p>
                    ) : (
                      soldItemsSummary.map(([name, qty]) => (
                        <div key={name} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate text-[var(--rich-soil)]">{name}</span>
                          <span className="font-semibold text-[var(--forest-green)]">{qty.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
