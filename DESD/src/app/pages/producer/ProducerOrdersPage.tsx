/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ProducerOrdersPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  TrendingUp,
  Truck,
  XCircle,
} from 'lucide-react';
import { differenceInHours, format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { ApiDeliveryInfo, apiJson } from '../../lib/api';
import { getDeliverySimulationPollMs } from '../../lib/deliverySimulation';
import {
  getEffectiveDeliveryEta,
  getEffectiveDeliveryStatus,
  getSimulationCompletionMs,
  isSimulatedSandboxDelivery,
  isTerminalDeliveryStatus,
} from '../../lib/deliveryTracking';
import { useSafeBack } from '../../lib/navigation';
import { LiveDeliveryMap } from '../../components/LiveDeliveryMap';
import { SiteHeader } from '../../components/SiteHeader';
import { PageLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';

type ProducerOrderStatus = 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';
/**
 * DELIVERY_POLL_MS boundary.
 *
 * This exported unit supports the file role: Implements the ProducerOrdersPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const DELIVERY_POLL_MS = getDeliverySimulationPollMs();

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
  delivery?: ApiDeliveryInfo | null;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBusinessStatus(status: ProducerOrderStatus): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
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

/**
 * ProducerOrdersPage boundary.
 *
 * This exported unit supports the file role: Implements the ProducerOrdersPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ProducerOrdersPage() {
  const goBack = useSafeBack('/producer/dashboard');
  const [orders, setOrders] = useState<ProducerSubOrderApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulationNow, setSimulationNow] = useState(() => Date.now());
  const [statusFilter, setStatusFilter] = useState<ProducerOrderStatus | 'all'>('all');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [deliveryActionOrderId, setDeliveryActionOrderId] = useState<number | null>(null);
  const [deliveryErrors, setDeliveryErrors] = useState<Record<number, string>>({});

  const loadOrders = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
    }
    try {
      const payload = await apiJson<ProducerSubOrderApi[]>('/api/orders/producer/sub-orders/');
      setOrders(payload);
      setDeliveryErrors((previous) => {
        const next = { ...previous };
        for (const order of payload) {
          if (order.delivery?.last_error) {
            next[order.id] = order.delivery.last_error;
          } else if (order.delivery) {
            delete next[order.id];
          }
        }
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load producer orders.';
      toast.error(message);
      setOrders([]);
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) {
        return;
      }
      await loadOrders(false);
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [loadOrders]);

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
      setDeliveryErrors((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      toast.success(`Order ${updated.order_number} updated to ${updated.status}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update order status.';
      if (nextStatus === 'ready') {
        setDeliveryErrors((previous) => ({
          ...previous,
          [order.id]: message,
        }));
      }
      toast.error(message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const retryDelivery = async (order: ProducerSubOrderApi) => {
    setDeliveryActionOrderId(order.id);
    try {
      await apiJson<{ delivery: ApiDeliveryInfo; sub_order_status: string }>(
        `/api/delivery/producer/sub-orders/${order.id}/delivery/retry/`,
        {
          method: 'POST',
        },
      );
      setDeliveryErrors((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      toast.success(`Stuart dispatch created for ${order.order_number}.`);
      await loadOrders(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to retry Stuart dispatch.';
      setDeliveryErrors((previous) => ({
        ...previous,
        [order.id]: message,
      }));
      toast.error(message);
    } finally {
      setDeliveryActionOrderId(null);
    }
  };

  const refreshDelivery = async (order: ProducerSubOrderApi) => {
    setDeliveryActionOrderId(order.id);
    try {
      await apiJson<{ delivery: ApiDeliveryInfo; sub_order_status: string }>(
        `/api/delivery/producer/sub-orders/${order.id}/delivery/refresh/`,
        {
          method: 'POST',
        },
      );
      setDeliveryErrors((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      toast.success(`Stuart delivery refreshed for ${order.order_number}.`);
      await loadOrders(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh Stuart delivery.';
      setDeliveryErrors((previous) => ({
        ...previous,
        [order.id]: message,
      }));
      toast.error(message);
    } finally {
      setDeliveryActionOrderId(null);
    }
  };

  const cancelDelivery = async (order: ProducerSubOrderApi) => {
    setDeliveryActionOrderId(order.id);
    try {
      await apiJson<{ delivery: ApiDeliveryInfo; sub_order_status: string }>(
        `/api/delivery/producer/sub-orders/${order.id}/delivery/cancel/`,
        {
          method: 'POST',
        },
      );
      setDeliveryErrors((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      toast.success(`Stuart delivery cancelled for ${order.order_number}.`);
      await loadOrders(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to cancel Stuart delivery.';
      setDeliveryErrors((previous) => ({
        ...previous,
        [order.id]: message,
      }));
      toast.error(message);
    } finally {
      setDeliveryActionOrderId(null);
    }
  };

  const restartSimulation = async (order: ProducerSubOrderApi) => {
    setDeliveryActionOrderId(order.id);
    try {
      await apiJson<{ delivery: ApiDeliveryInfo; sub_order_status: string }>(
        `/api/delivery/producer/sub-orders/${order.id}/delivery/restart-simulation/`,
        {
          method: 'POST',
        },
      );
      setDeliveryErrors((previous) => {
        const next = { ...previous };
        delete next[order.id];
        return next;
      });
      toast.success(`Sandbox rider restarted for ${order.order_number}.`);
      await loadOrders(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to restart delivery simulation.';
      setDeliveryErrors((previous) => ({
        ...previous,
        [order.id]: message,
      }));
      toast.error(message);
    } finally {
      setDeliveryActionOrderId(null);
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

  const formatDeliveryStatus = (status: string | undefined) => {
    if (!status) {
      return 'No delivery job';
    }
    if (status === 'delivering') {
      return 'Out for Delivery';
    }
    return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const getDeliveryStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'delivering':
      case 'picked_up':
      case 'picking_up':
      case 'assigned':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'created':
      case 'waiting_pickup':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'cancelled':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'failed':
        return 'bg-rose-100 text-rose-700 border-rose-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const hasActiveDelivery = (delivery?: ApiDeliveryInfo | null, nowMs = simulationNow) => {
    const effectiveStatus = getEffectiveDeliveryStatus(delivery, nowMs) || delivery?.status;
    return Boolean(effectiveStatus && !isTerminalDeliveryStatus(effectiveStatus));
  };

  useEffect(() => {
    if (!filteredOrders.some((order) => isSimulatedSandboxDelivery(order.delivery))) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSimulationNow(Date.now());
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [filteredOrders]);

  useEffect(() => {
    if (
      !filteredOrders.some(
        (order) =>
          order.delivery &&
          !isSimulatedSandboxDelivery(order.delivery) &&
          hasActiveDelivery(order.delivery, Date.now()),
      )
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadOrders(true);
    }, DELIVERY_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [filteredOrders, loadOrders]);

  useEffect(() => {
    const upcomingCompletionTimes = filteredOrders
      .map((order) => getSimulationCompletionMs(order.delivery))
      .filter((value): value is number => Boolean(value && value > simulationNow));

    if (upcomingCompletionTimes.length === 0) {
      return;
    }

    const nextRefreshInMs = Math.max(500, Math.min(...upcomingCompletionTimes) - simulationNow + 1000);
    const timeoutId = window.setTimeout(() => {
      void loadOrders(true);
    }, nextRefreshInMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [filteredOrders, loadOrders, simulationNow]);

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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--earth-accent)]">Producer sales</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sales Orders</h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-700">
              <TrendingUp className="size-4" />
              Live checkout orders for your producer account
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-xl border border-[#eee8dc] bg-white/70 px-3 py-2">
              <p className="text-gray-500">Pending</p>
              <p className="text-lg font-semibold">{statusCounts.pending}</p>
            </div>
            <div className="rounded-xl border border-[#eee8dc] bg-white/70 px-3 py-2">
              <p className="text-gray-500">Ready</p>
              <p className="text-lg font-semibold">{statusCounts.ready}</p>
            </div>
            <div className="rounded-xl border border-[#eee8dc] bg-white/70 px-3 py-2">
              <p className="text-gray-500">Delivered</p>
              <p className="text-lg font-semibold">{statusCounts.delivered}</p>
            </div>
            <div className="rounded-xl border border-[#eee8dc] bg-white/70 px-3 py-2">
              <p className="text-gray-500">Total</p>
              <p className="text-lg font-semibold">{orders.length}</p>
            </div>
          </div>
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
          <PageLoadingSkeleton rows={4} cards={3} />
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
              const delivery = order.delivery;
              const inlineDeliveryError = delivery?.last_error || deliveryErrors[order.id];
              const displayDeliveryStatus = getEffectiveDeliveryStatus(delivery, simulationNow) || delivery?.status;
              const displayDeliveryEta = getEffectiveDeliveryEta(delivery, simulationNow);
              const deliveryEta = displayDeliveryEta ? parseISO(displayDeliveryEta) : null;
              const deliveryBusy = deliveryActionOrderId === order.id;
              const deliveryActive = Boolean(displayDeliveryStatus && !isTerminalDeliveryStatus(displayDeliveryStatus));
              const headerStatusLabel = displayDeliveryStatus
                ? formatDeliveryStatus(displayDeliveryStatus)
                : formatBusinessStatus(order.status);
              const headerStatusClass = displayDeliveryStatus
                ? getDeliveryStatusColor(displayDeliveryStatus)
                : getStatusColor(order.status);

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
                        {delivery && (
                          <p className="mt-2 text-sm font-medium text-green-800">
                            Live delivery status: {formatDeliveryStatus(displayDeliveryStatus)}
                            {deliveryEta && isValid(deliveryEta) ? ` • ETA ${format(deliveryEta, 'h:mm a')}` : ''}
                          </p>
                        )}
                      </div>
                      <Badge className={`${headerStatusClass} border`}>{headerStatusLabel}</Badge>
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
                        {delivery && (
                          <p className="mt-2 text-xs text-gray-600">
                            Delivery phase updates automatically while the sandbox simulation is running.
                          </p>
                        )}
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

                    <Separator />

                    <div className="rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.985_0.01_145)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Truck className="size-4 text-green-700" />
                            <p className="text-sm font-semibold text-gray-900">Stuart Delivery</p>
                          </div>
                          <p className="mt-1 text-xs text-gray-600">
                            Dispatch is created automatically when an order is moved to Ready.
                          </p>
                        </div>
                        <Badge className={`${getDeliveryStatusColor(displayDeliveryStatus)} border`}>
                          {formatDeliveryStatus(displayDeliveryStatus)}
                        </Badge>
                      </div>

                      {delivery ? (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                            <div>
                              <p className="text-gray-500">Job Reference</p>
                              <p className="font-medium text-gray-900">{delivery.provider_reference || 'Pending'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Package Reference</p>
                              <p className="font-medium text-gray-900">{delivery.package_reference || 'Pending'}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">ETA</p>
                              <p className="font-medium text-gray-900">
                                {deliveryEta && isValid(deliveryEta) ? format(deliveryEta, 'MMM d, yyyy h:mm a') : 'Awaiting courier ETA'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Last Sync</p>
                              <p className="font-medium text-gray-900">
                                {delivery.updated_at ? format(parseISO(delivery.updated_at), 'MMM d, h:mm a') : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {(delivery.courier?.name || delivery.courier?.transport_type || delivery.courier?.phone) && (
                            <div className="rounded-lg border bg-white p-3 text-sm">
                              <p className="font-medium text-gray-900">Courier</p>
                              <p className="text-gray-700">
                                {delivery.courier?.name || 'Courier assigned'}
                                {delivery.courier?.transport_type ? ` • ${delivery.courier.transport_type}` : ''}
                                {delivery.courier?.phone ? ` • ${delivery.courier.phone}` : ''}
                              </p>
                            </div>
                          )}

                          {inlineDeliveryError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                              {inlineDeliveryError}
                            </div>
                          )}

                          <LiveDeliveryMap
                            pickup={delivery.pickup_address_snapshot}
                            dropoff={delivery.dropoff_address_snapshot}
                            courierCoordinates={delivery.last_coordinates}
                            pickupLabel="Producer Pickup"
                            dropoffLabel={order.customer_name}
                            courierLabel={delivery.courier?.name || 'Sandbox Rider'}
                            deliveryStatus={formatDeliveryStatus(displayDeliveryStatus)}
                            simulationStartedAt={delivery.simulation_started_at}
                            simulationDurationSeconds={delivery.simulation_duration_seconds}
                            testMode={delivery.test_mode}
                          />

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => refreshDelivery(order)}
                              disabled={deliveryBusy}
                            >
                              {deliveryBusy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                              Refresh
                            </Button>
                            {deliveryActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => cancelDelivery(order)}
                                disabled={deliveryBusy}
                              >
                                <XCircle className="size-4" />
                                Cancel Delivery
                              </Button>
                            )}
                            {['failed', 'cancelled'].includes(delivery.status) && (
                              <Button size="sm" className="gap-2" onClick={() => retryDelivery(order)} disabled={deliveryBusy}>
                                <Truck className="size-4" />
                                Retry Dispatch
                              </Button>
                            )}
                            {delivery.test_mode && deliveryActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => restartSimulation(order)}
                                disabled={deliveryBusy}
                              >
                                <RefreshCw className="size-4" />
                                Restart Simulation
                              </Button>
                            )}
                            {delivery.client_tracking_url && (
                              <Button variant="ghost" size="sm" className="gap-2" asChild>
                                <a href={delivery.client_tracking_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="size-4" />
                                  Stuart Tracking Fallback
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 rounded-lg border bg-white p-3 text-sm text-gray-700">
                          {order.status === 'ready'
                            ? 'This order is ready, but no Stuart delivery job is currently attached. Use Retry Dispatch to create one.'
                            : 'No Stuart delivery has been created yet for this producer order.'}
                          {inlineDeliveryError && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                              {inlineDeliveryError}
                            </div>
                          )}
                          {order.status !== 'delivered' && order.status !== 'cancelled' && (
                            <div className="mt-3">
                              <Button size="sm" className="gap-2" onClick={() => retryDelivery(order)} disabled={deliveryBusy}>
                                {deliveryBusy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
                                Retry Dispatch
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
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
