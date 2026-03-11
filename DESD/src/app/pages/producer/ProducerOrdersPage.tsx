import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  TrendingUp,
} from 'lucide-react';
import { differenceInHours, format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { apiJson } from '../../lib/api';
import { useSafeBack } from '../../lib/navigation';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
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
  allowed_next_statuses: ProducerOrderStatus[];
  delivery_date: string;
  subtotal_amount: string;
  commission_amount: string;
  payout_amount: string;
  customer_name: string;
  customer_email: string;
  delivery_address: string;
  customer_postcode: string;
  lead_time_hours: number;
  order_created_at: string;
  items: ProducerSubOrderItemApi[];
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isOrderUrgent(order: ProducerSubOrderApi): boolean {
  const parsedDelivery = parseISO(order.delivery_date);
  if (!isValid(parsedDelivery)) {
    return false;
  }
  const hoursUntilDelivery = differenceInHours(parsedDelivery, new Date());
  return (
    hoursUntilDelivery > 0 &&
    hoursUntilDelivery < 24 &&
    order.status !== 'delivered' &&
    order.status !== 'cancelled'
  );
}

export function ProducerOrdersPage() {
  const navigate = useNavigate();
  const goBack = useSafeBack('/producer/dashboard');
  const [orders, setOrders] = useState<ProducerSubOrderApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ProducerOrderStatus | 'all'>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadOrders = async () => {
      setLoading(true);
      try {
        const payload = await apiJson<ProducerSubOrderApi[]>('/api/orders/producer/sub-orders/');
        if (!mounted) {
          return;
        }
        setOrders(payload);
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : 'Unable to load producer orders.';
          toast.error(message);
          setOrders([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadOrders();
    return () => {
      mounted = false;
    };
  }, []);

  const statusCounts = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === 'pending').length,
      confirmed: orders.filter((order) => order.status === 'confirmed').length,
      ready: orders.filter((order) => order.status === 'ready').length,
      delivered: orders.filter((order) => order.status === 'delivered').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
    }),
    [orders],
  );

  const urgentOrders = useMemo(() => orders.filter((order) => isOrderUrgent(order)), [orders]);
  const filteredOrders = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((order) => order.status === statusFilter)),
    [orders, statusFilter],
  );

  const updateOrderStatus = async (order: ProducerSubOrderApi, nextStatus: ProducerOrderStatus) => {
    if (nextStatus === order.status) {
      return;
    }

    setUpdatingOrderId(order.id);
    try {
      const updated = await apiJson<ProducerSubOrderApi>(`/api/orders/producer/sub-orders/${order.id}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setOrders((previous) => previous.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(`Order ${updated.order_number} updated to ${updated.status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update order status.';
      toast.error(message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getStatusColor = (status: ProducerOrderStatus) => {
    const colors: Record<ProducerOrderStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      ready: 'bg-green-100 text-green-800 border-green-300',
      delivered: 'bg-gray-100 text-gray-800 border-gray-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={goBack}
            className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Orders</h1>
            <p className="text-gray-700 mt-1 flex items-center gap-2">
              <TrendingUp className="size-4" />
              Live checkout orders for your producer account
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1.5">
            {orders.length} total orders
          </Badge>
        </div>

        {urgentOrders.length > 0 && (
          <Card className="mb-6 border-red-300 bg-red-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Clock className="size-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-red-900">
                    {urgentOrders.length} order{urgentOrders.length === 1 ? '' : 's'} due to dispatch in &lt; 24h
                  </p>
                  <p className="text-sm text-red-700 mt-0.5">Prioritise these first to avoid delays</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setStatusFilter('pending')}>
                  View urgent
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filter by status:</span>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('all')}
                >
                  All ({orders.length})
                </Badge>
                <Badge
                  variant={statusFilter === 'pending' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('pending')}
                >
                  Pending ({statusCounts.pending})
                </Badge>
                <Badge
                  variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('confirmed')}
                >
                  Confirmed ({statusCounts.confirmed})
                </Badge>
                <Badge
                  variant={statusFilter === 'ready' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('ready')}
                >
                  Ready ({statusCounts.ready})
                </Badge>
                <Badge
                  variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('delivered')}
                >
                  Delivered ({statusCounts.delivered})
                </Badge>
                <Badge
                  variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('cancelled')}
                >
                  Cancelled ({statusCounts.cancelled})
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-600">
              <Loader2 className="size-6 animate-spin mx-auto mb-3" />
              Loading producer orders...
            </CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="size-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {statusFilter === 'all' ? 'No orders yet' : `No ${statusFilter} orders`}
              </p>
              {statusFilter !== 'all' && (
                <Button variant="outline" onClick={() => setStatusFilter('all')} className="mt-4">
                  View all orders
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const urgent = isOrderUrgent(order);
              const subtotal = toNumber(order.subtotal_amount);
              const commission = toNumber(order.commission_amount);
              const payout = toNumber(order.payout_amount);
              const parsedDate = parseISO(order.delivery_date);
              const statusOptions = order.allowed_next_statuses || [order.status];

              return (
                <Card key={order.id} className={`transition-shadow hover:shadow-md ${urgent ? 'border-red-300 bg-red-50/30' : ''}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">Order {order.order_number}</CardTitle>
                          {urgent && (
                            <Badge variant="destructive" className="gap-1">
                              <Clock className="size-3" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{order.customer_name} • {order.customer_email}</p>
                      </div>
                      <Badge className={`${getStatusColor(order.status)} border`}>{order.status}</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2 text-gray-900">Items</h4>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div key={`${order.id}-${item.product_name}-${index}`} className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              {item.product_name} × {item.quantity} {item.unit}
                            </span>
                            <span className="font-medium text-gray-900">£{toNumber(item.line_total).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="size-4 mt-0.5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Delivery Date</p>
                          <p className="text-sm text-gray-700">
                            {isValid(parsedDate) ? format(parsedDate, 'MMMM d, yyyy') : order.delivery_date}
                          </p>
                          {urgent && <p className="text-xs text-red-600 mt-1 font-medium">Less than 24 hours</p>}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="size-4 mt-0.5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                          <p className="text-sm text-gray-700">{order.delivery_address}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-900">£{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Commission (5%)</span>
                        <span className="text-gray-700">-£{commission.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span className="text-gray-900">Your Earnings</span>
                        <span className="text-green-700">£{payout.toFixed(2)}</span>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block text-gray-900">Update Status</label>
                        <Select
                          value={order.status}
                          onValueChange={(value) => updateOrderStatus(order, value as ProducerOrderStatus)}
                          disabled={updatingOrderId === order.id}
                        >
                          <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-900">Actions</label>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => toast.info(`Contact ${order.customer_name} at ${order.customer_email}`)}
                          >
                            <MessageCircle className="size-4" />
                            Contact
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => toast.info(`Delivery postcode: ${order.customer_postcode}`)}
                          >
                            <FileText className="size-4" />
                            Note
                          </Button>
                        </div>
                      </div>
                    </div>

                    {order.status === 'pending' && (
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        <p className="text-xs text-blue-900 flex items-start gap-2">
                          <AlertCircle className="size-3 mt-0.5 flex-shrink-0" />
                          <span>Confirm pending orders quickly so customers get status updates.</span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
