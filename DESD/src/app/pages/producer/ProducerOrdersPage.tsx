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
import { useLocation, useNavigate } from 'react-router';
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
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { OrderHistoryPage } from '../OrderHistoryPage';

type ProducerOrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
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
  unit_price?: string;
  line_total: string;
  product_image_url?: string;
  allergen_info?: string;
  is_organic?: boolean;
  organic_certification?: string;
  is_surplus?: boolean;
  surplus_discount_percent?: number | null;
  surplus_best_before?: string;
  surplus_note?: string;
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
  customer_phone?: string;
  customer_account_type?: string;
  customer_account_type_label?: string;
  delivery_address: string;
  delivery_address_label?: string;
  customer_postcode: string;
  payment_status?: string;
  commission_rate?: string;
  total_food_miles?: string;
  max_food_miles?: string;
  is_recurring_instance?: boolean;
  recurring_template_id?: number | null;
  recurring_scheduled_for?: string | null;
  preparation_details?: string;
  lead_time_hours: number;
  order_created_at: string;
  notes?: string;
  status_history?: Array<{
    id: number;
    previous_status: string;
    new_status: string;
    note: string;
    created_at: string;
    actor_role?: string;
    actor_name?: string;
    producer_name?: string;
  }>;
  items: ProducerSubOrderItemApi[];
  delivery?: ApiDeliveryInfo | null;
}

interface ProducerRecurringDemandItemApi {
  product_id: number;
  product_name: string;
  quantity: string;
  default_quantity: string;
  unit: string;
  unit_price: string;
  line_total: string;
  available_stock: string;
  is_available: boolean;
}

interface ProducerRecurringDemandApi {
  id: number;
  restaurant_name: string;
  restaurant_email: string;
  frequency: string;
  order_day: number;
  delivery_day: number;
  next_order_date: string;
  delivery_address: string;
  customer_postcode: string;
  payment_method: string;
  is_paused: boolean;
  last_generated_at?: string | null;
  next_instance_override?: unknown | null;
  producer_subtotal: string;
  unavailable_products: string[];
  items: ProducerRecurringDemandItemApi[];
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
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useSafeBack('/producer/dashboard');
  const activeOrdersView = new URLSearchParams(location.search).get('view') === 'purchases' ? 'purchases' : 'sales';
  const searchQuery = new URLSearchParams(location.search).get('q') || '';
  const [orders, setOrders] = useState<ProducerSubOrderApi[]>([]);
  const [recurringDemand, setRecurringDemand] = useState<ProducerRecurringDemandApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [recurringLoading, setRecurringLoading] = useState(true);
  const [simulationNow, setSimulationNow] = useState(() => Date.now());
  const [statusFilter, setStatusFilter] = useState<ProducerOrderStatus | 'all'>('all');
  const [customerFilter, setCustomerFilter] = useState('all');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [deliveryActionOrderId, setDeliveryActionOrderId] = useState<number | null>(null);
  const [deliveryErrors, setDeliveryErrors] = useState<Record<number, string>>({});
  const [focusedUrgentOrderId, setFocusedUrgentOrderId] = useState<number | null>(null);
  const [noteDialogOrder, setNoteDialogOrder] = useState<ProducerSubOrderApi | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [isRecurringDemandOpen, setIsRecurringDemandOpen] = useState(false);
  const weekdayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

  const loadRecurringDemand = useCallback(async (background = false) => {
    // keep recurring demand separate from sales orders so producers can plan ahead
    if (!background) {
      setRecurringLoading(true);
    }
    try {
      const payload = await apiJson<ProducerRecurringDemandApi[]>('/api/orders/producer/recurring-demand/');
      setRecurringDemand(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load recurring demand.';
      toast.error(message);
      setRecurringDemand([]);
    } finally {
      if (!background) {
        setRecurringLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) {
        return;
      }
      await Promise.all([loadOrders(false), loadRecurringDemand(false)]);
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [loadOrders, loadRecurringDemand]);

  const statusCounts = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === 'pending').length,
      confirmed: orders.filter((order) => order.status === 'confirmed').length,
      preparing: orders.filter((order) => order.status === 'preparing').length,
      ready: orders.filter((order) => order.status === 'ready').length,
      delivered: orders.filter((order) => order.status === 'delivered').length,
      cancelled: orders.filter((order) => order.status === 'cancelled').length,
    }),
    [orders],
  );

  const urgentOrders = useMemo(() => orders.filter((order) => isOrderUrgent(order)), [orders]);
  const recurringDemandSummary = useMemo(
    () => ({
      active: recurringDemand.filter((template) => !template.is_paused).length,
      unavailable: recurringDemand.reduce((count, template) => count + template.unavailable_products.length, 0),
      totalValue: recurringDemand.reduce((sum, template) => sum + toNumber(template.producer_subtotal), 0),
    }),
    [recurringDemand],
  );
  const customerOptions = useMemo(
    () => Array.from(new Set(orders.map((order) => order.customer_name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [orders],
  );
  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }
      if (customerFilter !== 'all' && order.customer_name !== customerFilter) {
        return false;
      }
      if (fromDateFilter && order.delivery_date < fromDateFilter) {
        return false;
      }
      if (toDateFilter && order.delivery_date > toDateFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const searchableText = [
        order.order_number,
        order.status,
        order.customer_name,
        order.customer_email,
        order.delivery_address,
        order.customer_postcode,
        ...order.items.map((item) => `${item.product_name} ${item.quantity} ${item.unit}`),
      ]
        .join(' ')
        .toLowerCase();
      return searchableText.includes(normalizedSearch);
    });
  }, [customerFilter, fromDateFilter, orders, searchQuery, statusFilter, toDateFilter]);

  const handleViewUrgentOrder = () => {
    const urgentOrder = urgentOrders[0];
    if (!urgentOrder) {
      return;
    }

    setStatusFilter('all');
    setCustomerFilter('all');
    setFromDateFilter('');
    setToDateFilter('');
    setFocusedUrgentOrderId(urgentOrder.id);

    if (searchQuery) {
      navigate('/producer/orders?view=sales', { replace: true });
    }
  };

  useEffect(() => {
    if (!focusedUrgentOrderId || loading) {
      return;
    }

    const urgentOrderCard = document.getElementById(`producer-order-${focusedUrgentOrderId}`);
    if (!urgentOrderCard) {
      return;
    }

    window.requestAnimationFrame(() => {
      urgentOrderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      urgentOrderCard.focus({ preventScroll: true });
      setFocusedUrgentOrderId(null);
    });
  }, [filteredOrders, focusedUrgentOrderId, loading]);

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

  const openNoteDialog = (order: ProducerSubOrderApi) => {
    // notes open in a dialog so status updates stay uncluttered
    setNoteDialogOrder(order);
    setNoteDraft('');
  };

  const saveOrderNote = async () => {
    if (!noteDialogOrder) {
      return;
    }
    const note = noteDraft.trim();
    if (!note) {
      toast.error('Write a note before saving.');
      return;
    }

    setUpdatingOrderId(noteDialogOrder.id);
    try {
      const updated = await apiJson<ProducerSubOrderApi>(
        `/api/orders/producer/sub-orders/${noteDialogOrder.id}/status/`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: noteDialogOrder.status, note }),
        },
      );
      setOrders((previous) => previous.map((row) => (row.id === updated.id ? updated : row)));
      toast.success(`Note saved for ${updated.order_number}.`);
      setNoteDialogOrder(null);
      setNoteDraft('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save note.');
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
      preparing: 'bg-indigo-100 text-indigo-800 border-indigo-300',
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

  const ordersViewToggle = (
    <div className="inline-flex rounded-xl border border-[#d7dfd0] bg-white p-1 shadow-sm">
      <Button
        type="button"
        variant={activeOrdersView === 'sales' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => navigate('/producer/orders?view=sales')}
      >
        Sales
      </Button>
      <Button
        type="button"
        variant={activeOrdersView === 'purchases' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => navigate('/producer/orders?view=purchases')}
      >
        Purchases
      </Button>
    </div>
  );

  if (activeOrdersView === 'purchases') {
    return <OrderHistoryPage producerOrdersMode />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader searchPlaceholder="Search sales by order, customer, product, postcode..." />

      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-5 lg:min-h-[calc(100svh-60px)] lg:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={goBack}
            className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Button>
          {ordersViewToggle}
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
                <Button variant="destructive" size="sm" onClick={handleViewUrgentOrder}>
                  View urgent
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-blue-200 bg-blue-50/40">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Recurring demand</p>
                <CardTitle className="mt-1 text-xl">Upcoming Restaurant Templates</CardTitle>
                <p className="mt-1 text-sm text-blue-900">
                  Producers receive advance notice here before recurring restaurant templates become normal producer orders.
                  Use this panel to plan harvest, kitchen prep, and low-stock replenishment before the next instance is generated.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg border border-blue-100 bg-white/80 px-3 py-2">
                  <p className="text-blue-700">Active</p>
                  <p className="font-semibold">{recurringDemandSummary.active}</p>
                </div>
                <div className="rounded-lg border border-blue-100 bg-white/80 px-3 py-2">
                  <p className="text-blue-700">Value</p>
                  <p className="font-semibold">£{recurringDemandSummary.totalValue.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-blue-100 bg-white/80 px-3 py-2">
                  <p className="text-blue-700">Alerts</p>
                  <p className="font-semibold">{recurringDemandSummary.unavailable}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-blue-950">
                  {recurringDemandSummary.active} active template{recurringDemandSummary.active === 1 ? '' : 's'} include your products.
                </p>
                <p className="text-xs text-blue-800">Details are hidden by default for a cleaner producer orders view.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-blue-200 bg-white text-blue-800 hover:bg-blue-50"
                onClick={() => setIsRecurringDemandOpen((current) => !current)}
              >
                {isRecurringDemandOpen ? 'Hide recurring templates' : 'Show recurring templates'}
              </Button>
            </div>
            {/* keep template details hidden until producer asks for them */}
            {isRecurringDemandOpen && (
              <div className="mt-4">
                {recurringLoading ? (
                  <p className="text-sm text-blue-900">Loading recurring demand...</p>
                ) : recurringDemand.length === 0 ? (
                  <p className="text-sm text-blue-900">No active restaurant recurring templates currently include your products.</p>
                ) : (
                  <div className="space-y-3">
                    {recurringDemand.map((template, index) => (
                      <div key={template.id} className="rounded-xl border border-blue-100 bg-white p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-gray-900">Template {index + 1}: {template.restaurant_name}</p>
                              <Badge variant={template.is_paused ? 'secondary' : 'default'}>
                                {template.is_paused ? 'Paused' : 'Active'}
                              </Badge>
                              <Badge variant="outline">{template.frequency}</Badge>
                              {template.next_instance_override && (
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                  Next instance edited
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              {template.restaurant_email} • Next order {template.next_order_date} • Delivery day {weekdayOptions[template.delivery_day] || template.delivery_day}
                            </p>
                            <p className="mt-1 text-sm font-medium text-blue-800">
                              Advance notice active: this template is visible before the restaurant generates the next order instance.
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {template.delivery_address} • {template.customer_postcode}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-gray-500">Your next-instance subtotal</p>
                            <p className="text-lg font-semibold text-blue-800">£{toNumber(template.producer_subtotal).toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {template.items.map((item) => (
                            <div key={item.product_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-blue-50/60 px-3 py-2 text-sm">
                              <button
                                type="button"
                                onClick={() => navigate(`/product/${item.product_id}`)}
                                className="text-left font-medium text-[var(--forest-green)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)]"
                              >
                                {item.product_name} • {toNumber(item.quantity).toFixed(0)} {item.unit}
                              </button>
                              <span className={item.is_available ? 'text-gray-700' : 'font-medium text-red-700'}>
                                Stock {toNumber(item.available_stock).toFixed(0)} • £{toNumber(item.line_total).toFixed(2)}
                                {!item.is_available ? ' • Unavailable for next run' : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
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
                  variant={statusFilter === 'preparing' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setStatusFilter('preparing')}
                >
                  Preparing ({statusCounts.preparing})
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
              <div className="grid gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Customer</label>
                  <Select value={customerFilter} onValueChange={setCustomerFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All customers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All customers</SelectItem>
                      {customerOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">From date</label>
                  <input
                    type="date"
                    value={fromDateFilter}
                    onChange={(event) => setFromDateFilter(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">To date</label>
                  <input
                    type="date"
                    value={toDateFilter}
                    onChange={(event) => setToDateFilter(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setStatusFilter('all');
                      setCustomerFilter('all');
                      setFromDateFilter('');
                      setToDateFilter('');
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              </div>
              {searchQuery && (
                <p className="text-sm text-gray-600">
                  Search: <span className="font-medium text-gray-900">{searchQuery}</span>
                </p>
              )}
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
                <Card
                  key={order.id}
                  id={`producer-order-${order.id}`}
                  tabIndex={-1}
                  className={`scroll-mt-24 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 ${urgent ? 'border-red-300 bg-red-50/30' : ''}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">Order {order.order_number}</CardTitle>
                          {order.is_recurring_instance && (
                            <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-blue-800">
                              <Calendar className="size-3" />
                              Recurring
                            </Badge>
                          )}
                          {urgent && (
                            <Badge variant="destructive" className="gap-1">
                              <Clock className="size-3" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">
                          {order.customer_name} • {order.customer_email}
                          {order.customer_phone ? ` • ${order.customer_phone}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          Account type: {order.customer_account_type_label || order.customer_account_type || 'Customer'} • Payment: {order.payment_status || 'pending'}
                          {order.recurring_scheduled_for ? ` • Recurring date: ${order.recurring_scheduled_for}` : ''}
                        </p>
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
                          <div key={`${order.id}-${item.product_name}-${index}`} className="flex gap-3 rounded-lg border bg-white p-3 text-sm">
                            {item.product_image_url && (
                              <img src={item.product_image_url} alt={item.product_name} className="size-12 rounded object-cover" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex justify-between gap-3">
                                <span className="font-medium text-gray-800">
                                  {item.product_name} × {item.quantity} {item.unit}
                                </span>
                                <span className="font-medium text-gray-900">£{toNumber(item.line_total).toFixed(2)}</span>
                              </div>
                              <p className="mt-1 text-xs text-gray-600">
                                Unit: £{toNumber(item.unit_price || '0').toFixed(2)} • Allergens: {item.allergen_info || 'No common allergens'}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                {item.is_organic ? item.organic_certification || 'Certified Organic' : 'Not Certified Organic'}
                                {item.is_surplus ? ` • Surplus ${item.surplus_discount_percent || 0}% off${item.surplus_best_before ? ` • best before ${item.surplus_best_before}` : ''}` : ''}
                              </p>
                            </div>
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
                          {order.delivery_address_label && (
                            <p className="text-xs font-medium text-gray-600">{order.delivery_address_label}</p>
                          )}
                          <p className="text-sm text-gray-700">{order.delivery_address}</p>
                          <p className="text-xs text-gray-600">
                            Food miles: {toNumber(order.total_food_miles || '0').toFixed(2)} total / {toNumber(order.max_food_miles || '0').toFixed(2)} local-radius check
                          </p>
                        </div>
                      </div>
                    </div>

                    {(order.notes || order.preparation_details) && (
                      <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                        <p className="font-medium">Preparation and customer notes</p>
                        {order.preparation_details && <p className="mt-1">{order.preparation_details}</p>}
                        {order.notes && <p className="mt-1">{order.notes}</p>}
                      </div>
                    )}

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
                            onClick={() => openNoteDialog(order)}
                          >
                            <FileText className="size-4" />
                            Note
                          </Button>
                        </div>
                      </div>
                    </div>

                    {order.status_history && order.status_history.length > 0 && (
                      <>
                        <Separator />
                        <div className="rounded-xl border bg-gray-50 p-4">
                          <p className="mb-3 text-sm font-semibold text-gray-900">Status history and notes</p>
                          <div className="space-y-3">
                            {order.status_history.map((entry) => (
                              <div key={entry.id} className="rounded-lg border bg-white p-3 text-sm">
                                <div className="flex flex-wrap justify-between gap-2">
                                  <span className="font-medium text-gray-900">
                                    {entry.previous_status || 'Created'} {'->'} {entry.new_status}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {format(parseISO(entry.created_at), 'MMM d, yyyy h:mm a')}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-600">
                                  Actor: {entry.actor_name || entry.actor_role || 'System'}
                                  {entry.producer_name ? ` • Producer: ${entry.producer_name}` : ''}
                                </p>
                                {entry.note && <p className="mt-2 text-gray-700">{entry.note}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

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
      <Dialog
        open={Boolean(noteDialogOrder)}
        onOpenChange={(open) => {
          if (!open) {
            setNoteDialogOrder(null);
            setNoteDraft('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add producer note</DialogTitle>
            <DialogDescription>
              Save a timestamped note for {noteDialogOrder?.order_number}. The note is stored in the order audit trail with the current status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              rows={5}
              placeholder="Example: Customer requested delivery through side entrance. Packed chilled items separately."
            />
            <p className="text-xs text-gray-500">
              Current status: {noteDialogOrder ? formatBusinessStatus(noteDialogOrder.status) : 'N/A'}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNoteDialogOrder(null);
                setNoteDraft('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveOrderNote()} disabled={updatingOrderId === noteDialogOrder?.id}>
              {updatingOrderId === noteDialogOrder?.id ? 'Saving...' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
