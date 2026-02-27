import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calendar,
  Clock,
  Eye,
  FileDown,
  Loader2,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { differenceInHours, format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { apiJson } from '../../lib/api';
import { fetchProducerProductsFromApi } from '../../services/productApi';
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
  availability: 'in-season' | 'year-round' | 'unavailable';
  isSurplus?: boolean;
}

interface WeeklySettlementApi {
  id: number;
  week_start: string;
  week_end: string;
  net_amount: string;
  commission_amount: string;
  status: string;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return `£${value.toFixed(2)}`;
}

function isUrgentOrder(order: ProducerSubOrderApi): boolean {
  const deliveryDate = parseISO(order.delivery_date);
  if (!isValid(deliveryDate)) {
    return false;
  }
  const hours = differenceInHours(deliveryDate, new Date());
  return hours > 0 && hours < 24 && order.status !== 'delivered' && order.status !== 'cancelled';
}

export function ProducerDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
            availability: product.availability,
            isSurplus: product.isSurplus,
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

  const lowStockProducts = useMemo(() => products.filter((product) => product.stock > 0 && product.stock < 10), [products]);
  const outOfStockProducts = useMemo(() => products.filter((product) => product.stock === 0), [products]);
  const unavailableProducts = useMemo(
    () => products.filter((product) => product.availability === 'unavailable'),
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
      .slice(0, 3);
  }, [deliveredOrders]);

  const actionQueue = useMemo(() => {
    const queue: Array<{
      id: string;
      title: string;
      description: string;
      path: string;
      urgent?: boolean;
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      icon: typeof Clock;
      action: string;
    }> = [];

    if (pendingOrders.length > 0) {
      queue.push({
        id: 'pending-orders',
        title: `${pendingOrders.length} order${pendingOrders.length === 1 ? '' : 's'} waiting confirmation`,
        description: urgentOrders.length > 0 ? `${urgentOrders.length} due in < 24h` : 'Review and confirm incoming orders',
        path: '/producer/orders',
        urgent: urgentOrders.length > 0,
        variant: urgentOrders.length > 0 ? 'destructive' : 'default',
        icon: ShoppingBag,
        action: 'View orders',
      });
    }

    if (lowStockProducts.length > 0) {
      queue.push({
        id: 'low-stock',
        title: `${lowStockProducts.length} low-stock product${lowStockProducts.length === 1 ? '' : 's'}`,
        description: lowStockProducts.slice(0, 2).map((product) => product.name).join(', '),
        path: '/producer/inventory',
        variant: 'default',
        icon: AlertTriangle,
        action: 'Update stock',
      });
    }

    if (outOfStockProducts.length > 0 || unavailableProducts.length > 0) {
      queue.push({
        id: 'unavailable-products',
        title: `${outOfStockProducts.length} out of stock, ${unavailableProducts.length} unavailable`,
        description: 'Adjust stock/availability so customers can buy again',
        path: '/producer/inventory',
        variant: 'secondary',
        icon: TrendingDown,
        action: 'Manage inventory',
      });
    }

    queue.push({
      id: 'payments',
      title: latestSettlement
        ? `Latest settlement ${formatCurrency(latestSettlementNet)}`
        : `Estimated payout in pipeline ${formatCurrency(payoutInPipeline)}`,
      description: latestSettlementWeek ? `Week: ${latestSettlementWeek}` : 'No historical settlement yet',
      path: '/producer/payments',
      variant: 'secondary',
      icon: Banknote,
      action: 'View payout',
    });

    return queue;
  }, [
    lowStockProducts,
    outOfStockProducts,
    pendingOrders,
    payoutInPipeline,
    unavailableProducts,
    urgentOrders.length,
    latestSettlement,
    latestSettlementNet,
    latestSettlementWeek,
  ]);

  const primaryActions = [
    { label: 'Add product', icon: Plus, path: '/producer/inventory', variant: 'default' as const },
    { label: 'Update stock', icon: RefreshCw, path: '/producer/inventory', variant: 'outline' as const },
    { label: 'View orders', icon: ShoppingBag, path: '/producer/orders', variant: 'outline' as const },
    { label: 'Create surplus deal', icon: Tag, path: '/producer/inventory', variant: 'outline' as const },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Producer Dashboard</h1>
              <p className="text-sm text-gray-700">Signed in as {producerEmail}</p>
            </div>
            <Button variant="ghost" onClick={logout} className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
              <LogOut className="size-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-gray-600">
              <Loader2 className="size-7 animate-spin mx-auto mb-3" />
              Loading live producer metrics...
            </CardContent>
          </Card>
        ) : (
          <>
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="size-5 text-green-700" />
                <h2 className="text-lg font-semibold">Today's work</h2>
                <Badge variant="secondary" className="ml-2">{actionQueue.length} items</Badge>
              </div>
              <div className="space-y-3">
                {actionQueue.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Card key={item.id} className={`transition-shadow hover:shadow-md ${item.urgent ? 'border-red-300 bg-red-50/50' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`size-10 rounded-lg flex items-center justify-center ${item.urgent ? 'bg-red-100' : 'bg-green-100'}`}>
                              <Icon className={`size-5 ${item.urgent ? 'text-red-700' : 'text-green-700'}`} />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.title}</p>
                              <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
                            </div>
                          </div>
                          <Button variant={item.variant} size="sm" onClick={() => navigate(item.path)}>
                            {item.action}
                            <ArrowRight className="size-4 ml-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            <Separator />

            <section>
              <h2 className="text-lg font-semibold mb-4">Quick actions</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {primaryActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.label}
                      variant={action.variant}
                      onClick={() => navigate(action.path)}
                      className="h-auto py-4 flex-col gap-2"
                    >
                      <Icon className="size-5" />
                      <span className="text-sm">{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </section>

            <Separator />

            <section className="grid md:grid-cols-2 gap-6">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/producer/orders')}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="size-12 bg-blue-500 rounded-lg flex items-center justify-center">
                      <ShoppingBag className="size-6 text-white" />
                    </div>
                    <div>
                      <CardTitle>Orders</CardTitle>
                      <CardDescription>Manage incoming customer checkout orders</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Pending ({pendingOrders.length})</Badge>
                    <Badge variant="outline">Confirmed ({confirmedOrders.length})</Badge>
                    <Badge variant="outline">Ready ({readyOrders.length})</Badge>
                    <Badge variant="outline">Delivered ({deliveredOrders.length})</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Orders in pipeline</span>
                    <span className="font-semibold">{orders.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Estimated producer payout</span>
                    <span className="font-semibold text-green-700">{formatCurrency(payoutInPipeline)}</span>
                  </div>
                  {urgentOrders.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                      <AlertCircle className="size-4 text-red-600 flex-shrink-0" />
                      <span className="text-red-800 font-medium">{urgentOrders.length} orders due in &lt; 24h</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/producer/inventory')}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="size-12 bg-green-500 rounded-lg flex items-center justify-center">
                      <Package className="size-6 text-white" />
                    </div>
                    <div>
                      <CardTitle>Inventory</CardTitle>
                      <CardDescription>Stock visibility and product health</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg border border-orange-200 bg-orange-50">
                      <AlertCircle className="size-4 text-orange-600 mb-1" />
                      <p className="text-2xl font-semibold text-orange-600">{lowStockProducts.length}</p>
                      <p className="text-xs text-gray-600">Low stock</p>
                    </div>
                    <div className="p-3 rounded-lg border border-red-200 bg-red-50">
                      <TrendingDown className="size-4 text-red-600 mb-1" />
                      <p className="text-2xl font-semibold text-red-600">{outOfStockProducts.length}</p>
                      <p className="text-xs text-gray-600">Out of stock</p>
                    </div>
                    <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                      <Calendar className="size-4 text-blue-600 mb-1" />
                      <p className="text-2xl font-semibold text-blue-600">{products.length}</p>
                      <p className="text-xs text-gray-600">Total products</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Products bought by customers are reflected in Orders, and product stock can be managed from Inventory.</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/producer/payments')}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="size-12 bg-purple-500 rounded-lg flex items-center justify-center">
                      <Wallet className="size-6 text-white" />
                    </div>
                    <div>
                      <CardTitle>Payments</CardTitle>
                      <CardDescription>Settlement and commission history</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Latest settlement</span>
                    <span className="font-semibold">{latestSettlement ? formatCurrency(latestSettlementNet) : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Settlement week</span>
                    <span className="text-gray-800">{latestSettlementWeek || 'No settlements yet'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Open order payout pipeline</span>
                    <span className="text-green-700 font-semibold">{formatCurrency(payoutInPipeline)}</span>
                  </div>
                  <Separator />
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={(event) => {
                    event.stopPropagation();
                    navigate('/producer/payments');
                  }}>
                    <FileDown className="size-4" />
                    Open settlement exports
                  </Button>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-green-200 bg-green-50/30" onClick={() => navigate('/producer/inventory')}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="size-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                      <Sparkles className="size-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Surplus deals
                        <Badge className="bg-green-600">Live</Badge>
                      </CardTitle>
                      <CardDescription>Discount and clear inventory nearing risk</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Active deals</span>
                    <span className="font-semibold text-green-700">{activeSurplusDeals.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Delivered product lines</span>
                    <span className="font-semibold">{soldItemsSummary.reduce((sum, [, qty]) => sum + qty, 0).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="text-xs text-gray-600 space-y-1">
                    {soldItemsSummary.length === 0 ? (
                      <p>No delivered sales yet. Confirm and deliver orders to populate sold-item stats.</p>
                    ) : (
                      soldItemsSummary.map(([name, qty]) => (
                        <p key={name}>{name}: {qty.toFixed(2)} sold</p>
                      ))
                    )}
                  </div>
                  <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={(event) => {
                    event.stopPropagation();
                    navigate('/producer/inventory');
                  }}>
                    <Tag className="size-4" />
                    Manage surplus + stock
                  </Button>
                </CardContent>
              </Card>
            </section>

            <section>
              <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Eye className="size-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">Preview customer storefront</p>
                        <p className="text-sm text-gray-600">Verify your products and pricing as customers see them.</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/marketplace')}>
                      <Eye className="size-4 mr-2" />
                      Preview as customer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
