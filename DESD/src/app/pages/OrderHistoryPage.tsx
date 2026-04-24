import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  ExternalLink,
  ReceiptText,
  RotateCcw,
  Route,
  Truck,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ApiDeliveryInfo, ApiOrderDetail, ApiOrderSummary, apiBlob, apiJson } from '../lib/api';
import { getDeliverySimulationPollMs } from '../lib/deliverySimulation';
import {
  getEffectiveDeliveryEta,
  getEffectiveDeliveryStatus,
  getSimulationCompletionMs,
  isSimulatedSandboxDelivery,
  isTerminalDeliveryStatus,
} from '../lib/deliveryTracking';
import { useSafeBack } from '../lib/navigation';
import { LiveDeliveryMap } from '../components/LiveDeliveryMap';
import { SiteHeader } from '../components/SiteHeader';
import { PageLoadingSkeleton } from '../components/LoadingSkeletons';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cn } from '../components/ui/utils';

const CURRENT_ORDER_STATUSES = new Set(['pending', 'confirmed', 'ready']);
const TRACKING_STEPS = [
  { key: 'pending', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'picking_up', label: 'Picking Up' },
  { key: 'delivering', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
] as const;
const DELIVERY_POLL_MS = getDeliverySimulationPollMs();

function maskPaymentReference(reference: string): string {
  if (!reference || reference.length < 6) {
    return 'N/A';
  }
  return `${reference.slice(0, 4)}***${reference.slice(-3)}`;
}

function formatStatusLabel(status: string): string {
  if (!status) {
    return 'Unknown';
  }

  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isCurrentOrderStatus(status: string): boolean {
  return CURRENT_ORDER_STATUSES.has(status);
}

function hasActiveDelivery(delivery?: ApiDeliveryInfo | null, nowMs = Date.now()): boolean {
  const effectiveStatus = getEffectiveDeliveryStatus(delivery, nowMs) || delivery?.status;
  return Boolean(effectiveStatus && !isTerminalDeliveryStatus(effectiveStatus));
}

function getTrackingMessage(status: string, deliveryStatus?: string | null): string {
  switch (deliveryStatus) {
    case 'assigned':
      return 'A rider has been assigned and is preparing to collect the order from the producer.';
    case 'waiting_pickup':
    case 'picking_up':
      return 'The rider is at the producer pickup point and preparing the collection.';
    case 'picked_up':
      return 'The order has been collected and is about to start the delivery route.';
    case 'delivering':
      return 'Out for delivery. The rider is currently on the way to the delivery address.';
    case 'delivered':
      return 'This order has been delivered successfully.';
    default:
      break;
  }

  switch (status) {
    case 'pending':
      return 'Order placed. The producer still needs to confirm and prepare the delivery.';
    case 'confirmed':
      return 'The producer has confirmed the order and is getting it ready for dispatch.';
    case 'ready':
      return 'The order is ready and currently in the delivery stage.';
    case 'delivered':
      return 'This order has been delivered successfully.';
    case 'cancelled':
      return 'This order was cancelled and is no longer moving through the delivery flow.';
    default:
      return 'Tracking information is being prepared.';
  }
}

function getTrackingStepIndex(status: string, deliveryStatus?: string | null): number {
  switch (deliveryStatus) {
    case 'assigned':
      return 2;
    case 'waiting_pickup':
    case 'picking_up':
    case 'picked_up':
      return 3;
    case 'delivering':
      return 4;
    case 'delivered':
      return 5;
    default:
      break;
  }

  switch (status) {
    case 'pending':
      return 0;
    case 'confirmed':
      return 1;
    case 'ready':
      return 1;
    case 'delivered':
      return 5;
    default:
      return -1;
  }
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'confirmed':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ready':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function formatReceiptDate(value: string): string {
  return format(new Date(value), 'MMM d, yyyy, h:mm a');
}

function formatDeliveryStatusLabel(status?: string | null): string {
  if (!status) {
    return 'No delivery job';
  }
  if (status === 'delivering') {
    return 'Out for Delivery';
  }
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDisplayStatusLabel(status?: string | null): string {
  if (!status) {
    return 'Unknown';
  }
  const deliveryStatuses = new Set([
    'created',
    'assigned',
    'waiting_pickup',
    'picking_up',
    'picked_up',
    'delivering',
    'delivered',
    'cancelled',
    'failed',
  ]);
  return deliveryStatuses.has(status) ? formatDeliveryStatusLabel(status) : formatStatusLabel(status);
}

function getDisplayStatusBadgeClass(status?: string | null): string {
  if (!status) {
    return getStatusBadgeClass('');
  }
  const deliveryStatuses = new Set([
    'created',
    'assigned',
    'waiting_pickup',
    'picking_up',
    'picked_up',
    'delivering',
    'delivered',
    'cancelled',
    'failed',
  ]);
  return deliveryStatuses.has(status) ? getDeliveryStatusBadgeClass(status) : getStatusBadgeClass(status);
}

function getSubOrderDisplayStatus(
  subOrder: ApiOrderDetail['sub_orders'][number],
  nowMs: number,
): string {
  return getEffectiveDeliveryStatus(subOrder.delivery, nowMs) || subOrder.delivery?.status || subOrder.status;
}

function getPrimaryDeliveryStatus(
  subOrders: ApiOrderDetail['sub_orders'],
  nowMs: number,
): string | null {
  const activeSubOrder = subOrders.find((subOrder) => hasActiveDelivery(subOrder.delivery, nowMs));
  if (activeSubOrder?.delivery) {
    return getEffectiveDeliveryStatus(activeSubOrder.delivery, nowMs) || activeSubOrder.delivery.status;
  }

  const latestDelivery = subOrders.find((subOrder) => subOrder.delivery)?.delivery;
  if (!latestDelivery) {
    return null;
  }
  return getEffectiveDeliveryStatus(latestDelivery, nowMs) || latestDelivery.status;
}

function getOrderDisplayStatus(detail: ApiOrderDetail, nowMs: number): string {
  const statuses = detail.sub_orders.map((subOrder) => getSubOrderDisplayStatus(subOrder, nowMs));
  if (statuses.length === 0) {
    return detail.status;
  }

  if (statuses.every((status) => status === 'delivered')) {
    return 'delivered';
  }
  if (statuses.some((status) => status === 'delivering')) {
    return 'delivering';
  }
  if (statuses.some((status) => ['picked_up', 'picking_up', 'waiting_pickup'].includes(status))) {
    return 'picking_up';
  }
  if (statuses.some((status) => ['assigned', 'created'].includes(status))) {
    return 'assigned';
  }
  if (statuses.some((status) => status === 'ready')) {
    return 'ready';
  }
  if (statuses.some((status) => status === 'confirmed')) {
    return 'confirmed';
  }
  if (statuses.some((status) => status === 'pending')) {
    return 'pending';
  }
  if (statuses.every((status) => status === 'cancelled')) {
    return 'cancelled';
  }
  return detail.status;
}

function getDeliveryStatusBadgeClass(status?: string | null): string {
  switch (status) {
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'delivering':
    case 'picked_up':
    case 'picking_up':
    case 'assigned':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'created':
    case 'waiting_pickup':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'failed':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const goBack = useSafeBack('/marketplace');
  const [orders, setOrders] = useState<ApiOrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ApiOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);
  const [activeOrderView, setActiveOrderView] = useState<'details' | 'tracking' | null>(null);
  const [producerNameFilter, setProducerNameFilter] = useState('all');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [producerOptions, setProducerOptions] = useState<string[]>([]);
  const [currentOrdersOpen, setCurrentOrdersOpen] = useState(true);
  const [previousOrdersOpen, setPreviousOrdersOpen] = useState(true);
  const [simulationNow, setSimulationNow] = useState(() => Date.now());
  const backToMarketplaceButton = (
    <Button variant="ghost" onClick={goBack}>
      <ArrowLeft className="mr-2 size-4" />
      Back to Marketplace
    </Button>
  );

  const hasActiveFilters = producerNameFilter !== 'all' || Boolean(fromDateFilter) || Boolean(toDateFilter);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    if (producerNameFilter !== 'all') {
      query.set('producer_name', producerNameFilter);
    }
    if (fromDateFilter) {
      query.set('from_date', fromDateFilter);
    }
    if (toDateFilter) {
      query.set('to_date', toDateFilter);
    }
    const value = query.toString();
    return value ? `?${value}` : '';
  }, [producerNameFilter, fromDateFilter, toDateFilter]);

  useEffect(() => {
    let mounted = true;

    const loadHistoryAndFilters = async () => {
      setLoading(true);
      try {
        const [allHistory, filteredHistory] = await Promise.all([
          apiJson<ApiOrderSummary[]>('/api/orders/history/'),
          apiJson<ApiOrderSummary[]>(`/api/orders/history/${queryString}`),
        ]);

        if (mounted) {
          setOrders(filteredHistory);
          const names = Array.from(
            new Set(allHistory.flatMap((order) => order.producer_names).filter(Boolean)),
          ).sort((a, b) => a.localeCompare(b));
          setProducerOptions(names);

          if (activeOrderId && !filteredHistory.some((order) => order.id === activeOrderId)) {
            setActiveOrderId(null);
            setActiveOrderView(null);
            setSelectedOrder(null);
          }
        }
      } catch (error) {
        if (mounted) {
          toast.error('Unable to load order history.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadHistoryAndFilters();

    return () => {
      mounted = false;
    };
  }, [queryString]);

  const loadOrderDetail = useCallback(async (orderId: number, background = false) => {
    if (!background) {
      setDetailLoading(true);
    }
    try {
      const detail = await apiJson<ApiOrderDetail>(`/api/orders/history/${orderId}/`);
      setSelectedOrder(detail);
      setOrders((previous) =>
        previous.map((order) =>
          order.id === detail.id
            ? {
                ...order,
                status: detail.status,
              }
            : order,
        ),
      );
      return detail;
    } finally {
      if (!background) {
        setDetailLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (
      activeOrderView !== 'tracking' ||
      !selectedOrder?.sub_orders.some((subOrder) => isSimulatedSandboxDelivery(subOrder.delivery))
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSimulationNow(Date.now());
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeOrderView, selectedOrder]);

  useEffect(() => {
    if (activeOrderView !== 'tracking' || !activeOrderId || !selectedOrder) {
      return;
    }

    if (
      !selectedOrder.sub_orders.some(
        (subOrder) =>
          subOrder.delivery &&
          !isSimulatedSandboxDelivery(subOrder.delivery) &&
          hasActiveDelivery(subOrder.delivery, Date.now()),
      )
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadOrderDetail(activeOrderId, true);
    }, DELIVERY_POLL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeOrderId, activeOrderView, loadOrderDetail, selectedOrder]);

  useEffect(() => {
    if (activeOrderView !== 'tracking' || !activeOrderId || !selectedOrder) {
      return;
    }

    const upcomingCompletionTimes = selectedOrder.sub_orders
      .map((subOrder) => getSimulationCompletionMs(subOrder.delivery))
      .filter((value): value is number => Boolean(value && value > simulationNow));

    if (upcomingCompletionTimes.length === 0) {
      return;
    }

    const nextRefreshInMs = Math.max(500, Math.min(...upcomingCompletionTimes) - simulationNow + 1000);
    const timeoutId = window.setTimeout(() => {
      void loadOrderDetail(activeOrderId, true);
    }, nextRefreshInMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeOrderId, activeOrderView, loadOrderDetail, selectedOrder, simulationNow]);

  const openOrderPanel = async (orderId: number, view: 'details' | 'tracking') => {
    if (activeOrderId === orderId && activeOrderView === view) {
      setActiveOrderId(null);
      setActiveOrderView(null);
      setSelectedOrder(null);
      return;
    }

    setActiveOrderId(orderId);
    setActiveOrderView(view);

    if (selectedOrder?.id === orderId) {
      return;
    }

    try {
      await loadOrderDetail(orderId, false);
    } catch (error) {
      toast.error('Unable to load order details.');
      setActiveOrderId(null);
      setActiveOrderView(null);
      setSelectedOrder(null);
    }
  };

  const reorderOrder = async (orderId: number) => {
    try {
      const payload = await apiJson<{
        added_items: Array<{ product_name: string }>;
        unavailable_items: Array<{ product_name: string }>;
      }>(`/api/orders/history/${orderId}/reorder/`, { method: 'POST' });

      if (payload.unavailable_items.length > 0) {
        toast.warning(`${payload.unavailable_items.length} item(s) unavailable and were skipped.`);
      } else {
        toast.success('Items added back to your cart.');
      }

      navigate('/cart');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reorder.');
    }
  };

  const downloadReceipt = async (order: ApiOrderSummary) => {
    try {
      const blob = await apiBlob(`/api/orders/history/${order.id}/receipt/`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${order.order_number}-receipt.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Unable to download receipt.');
    }
  };

  const renderDeliveryWindow = (order: ApiOrderSummary): string => {
    if (!order.delivery_date_from) {
      return 'N/A';
    }
    if (!order.delivery_date_to || order.delivery_date_to === order.delivery_date_from) {
      return format(new Date(order.delivery_date_from), 'MMM d, yyyy');
    }
    return `${format(new Date(order.delivery_date_from), 'MMM d')} - ${format(new Date(order.delivery_date_to), 'MMM d, yyyy')}`;
  };

  const currentOrders = useMemo(
    () => orders.filter((order) => isCurrentOrderStatus(order.status)),
    [orders],
  );

  const previousOrders = useMemo(
    () => orders.filter((order) => !isCurrentOrderStatus(order.status)),
    [orders],
  );

  const renderTrackingMap = (order: ApiOrderDetail, subOrder: ApiOrderDetail['sub_orders'][number]) => {
    const delivery = subOrder.delivery;
    const displayDeliveryStatus = getEffectiveDeliveryStatus(delivery, simulationNow) || delivery?.status;
    const displaySubOrderStatus = getSubOrderDisplayStatus(subOrder, simulationNow);
    const displayDeliveryEta = getEffectiveDeliveryEta(delivery, simulationNow);
    const stepIndex = getTrackingStepIndex(displaySubOrderStatus, displayDeliveryStatus);
    const deliveryEta = displayDeliveryEta ? new Date(displayDeliveryEta) : null;

    return (
      <div key={subOrder.id} className="rounded-xl border border-[oklch(0.88_0.02_145)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">{subOrder.producer.business_name}</p>
            <p className="text-sm text-gray-600">
              Tracking route: {subOrder.producer.postcode} to {order.customer_postcode}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('border', getDisplayStatusBadgeClass(displaySubOrderStatus))}>
              {getDisplayStatusLabel(displaySubOrderStatus)}
            </Badge>
            {delivery && (
              <Badge className={cn('border', getDeliveryStatusBadgeClass(displayDeliveryStatus))}>
                Stuart {formatDeliveryStatusLabel(displayDeliveryStatus)}
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-[oklch(0.985_0.01_145)] p-3 text-sm text-gray-700">
          {getTrackingMessage(displaySubOrderStatus, displayDeliveryStatus)}
        </div>

        {delivery && (
          <div className="mt-4 rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.99_0.005_145)] p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
              <div>
                <p className="text-gray-500">Stuart Job</p>
                <p className="font-medium">{delivery.provider_reference || 'Pending'}</p>
              </div>
              <div>
                <p className="text-gray-500">ETA</p>
                <p className="font-medium">
                  {deliveryEta && !Number.isNaN(deliveryEta.getTime())
                    ? format(deliveryEta, 'MMM d, yyyy h:mm a')
                    : 'Awaiting courier ETA'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Courier</p>
                <p className="font-medium">
                  {delivery.courier?.name || 'Courier pending'}
                  {delivery.courier?.transport_type ? ` • ${delivery.courier.transport_type}` : ''}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Last Update</p>
                <p className="font-medium">
                  {delivery.updated_at ? format(new Date(delivery.updated_at), 'MMM d, h:mm a') : 'N/A'}
                </p>
              </div>
            </div>

            {delivery.last_error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {delivery.last_error}
              </div>
            )}

            {(delivery.tracking_url || delivery.client_tracking_url) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {delivery.tracking_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={delivery.tracking_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 size-4" />
                      Customer Tracking Link
                    </a>
                  </Button>
                )}
                {delivery.client_tracking_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={delivery.client_tracking_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 size-4" />
                      Stuart Live Tracking
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {TRACKING_STEPS.map((step, index) => {
            const isComplete = stepIndex >= index;
            const isCancelled = displaySubOrderStatus === 'cancelled';

            return (
              <div
                key={`${subOrder.id}-${step.key}`}
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                  isCancelled
                    ? 'border-red-100 bg-red-50 text-red-600'
                    : isComplete
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500',
                )}
              >
                {step.label}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <LiveDeliveryMap
            pickup={delivery?.pickup_address_snapshot || { postcode: subOrder.producer.postcode }}
            dropoff={delivery?.dropoff_address_snapshot || { full_address: order.delivery_address, postcode: order.customer_postcode }}
            courierCoordinates={delivery?.last_coordinates}
            pickupLabel={subOrder.producer.business_name}
            dropoffLabel="Delivery Address"
            courierLabel={delivery?.courier?.name || 'Sandbox Rider'}
            deliveryStatus={formatDeliveryStatusLabel(displayDeliveryStatus || subOrder.status)}
            simulationStartedAt={delivery?.simulation_started_at}
            simulationDurationSeconds={delivery?.simulation_duration_seconds}
            testMode={delivery?.test_mode}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>Delivery target: {format(new Date(subOrder.delivery_date), 'MMM d, yyyy')}</span>
          {delivery?.client_tracking_url && (
            <a
              href={delivery.client_tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-green-700 underline"
            >
              Stuart tracking fallback
            </a>
          )}
        </div>
      </div>
    );
  };

  const renderOrderCard = (order: ApiOrderSummary, sectionLabel: 'current' | 'previous') => {
    const displayOrderStatus =
      selectedOrder?.id === order.id ? getOrderDisplayStatus(selectedOrder, simulationNow) : order.status;
    const isCurrent = sectionLabel === 'current';
    const isDetailsOpen = activeOrderId === order.id && activeOrderView === 'details';
    const isTrackingOpen = activeOrderId === order.id && activeOrderView === 'tracking';
    const isPanelOpen = activeOrderId === order.id;

    return (
      <Card key={order.id}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-3 justify-between items-start">
            <div>
              <CardTitle className="text-lg">{order.order_number}</CardTitle>
              <p className="text-sm text-gray-600">
                Placed {format(new Date(order.created_at), 'MMM d, yyyy, h:mm a')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn('border', getDisplayStatusBadgeClass(displayOrderStatus))}>
                {getDisplayStatusLabel(displayOrderStatus)}
              </Badge>
              <Badge variant="outline">{formatStatusLabel(order.payment_status)}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-500">Producers</p>
              <p className="font-medium">{order.producer_names.join(', ')}</p>
            </div>
            <div>
              <p className="text-gray-500">Delivery Date</p>
              <p className="font-medium">{renderDeliveryWindow(order)}</p>
            </div>
            <div>
              <p className="text-gray-500">Order Status</p>
              <p className="font-medium text-gray-800">
                {displayOrderStatus === 'delivered'
                  ? 'Completed'
                  : displayOrderStatus === 'cancelled'
                    ? 'Order closed'
                    : getDisplayStatusLabel(displayOrderStatus)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Total Paid</p>
              <p className="font-medium text-green-700">£{Number(order.total_amount).toFixed(2)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isCurrent ? (
              <>
                <Button
                  variant={isDetailsOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => openOrderPanel(order.id, 'details')}
                >
                  {isDetailsOpen ? 'Hide Order Details' : 'Display Order Details'}
                </Button>
                <Button
                  variant={isTrackingOpen ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => openOrderPanel(order.id, 'tracking')}
                >
                  {isTrackingOpen ? 'Hide Tracking' : 'Track Order'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadReceipt(order)}>
                  <Download className="size-4 mr-2" />
                  Download Receipt
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => openOrderPanel(order.id, 'details')}>
                  {isDetailsOpen ? 'Hide Details' : 'View Details'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => downloadReceipt(order)}>
                  <Download className="size-4 mr-2" />
                  Download Receipt
                </Button>
                <Button size="sm" onClick={() => reorderOrder(order.id)}>
                  <RotateCcw className="size-4 mr-2" />
                  Reorder
                </Button>
              </>
            )}
          </div>

          {isPanelOpen && (
            <>
              <Separator />
              {detailLoading || !selectedOrder ? (
                <PageLoadingSkeleton rows={2} cards={2} />
              ) : (
                <>
                  {activeOrderView === 'details' && (
                    <div className="space-y-5">
                      {(() => {
                        const primaryDeliveryStatus = getPrimaryDeliveryStatus(selectedOrder.sub_orders, simulationNow);
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.985_0.01_145)] p-4">
                            <div>
                              <p className="text-sm font-medium text-green-900">Live Order Status</p>
                              <p className="mt-1 text-sm text-gray-700">
                                {getTrackingMessage(selectedOrder.status, primaryDeliveryStatus)}
                              </p>
                            </div>
                            {primaryDeliveryStatus && (
                              <Badge className={cn('border', getDeliveryStatusBadgeClass(primaryDeliveryStatus))}>
                                {formatDeliveryStatusLabel(primaryDeliveryStatus)}
                              </Badge>
                            )}
                          </div>
                        );
                      })()}

                      <div className="grid sm:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Delivery Address</p>
                          <p className="font-medium">{selectedOrder.delivery_address}</p>
                          <p className="text-gray-600">{selectedOrder.customer_postcode}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Payment Reference</p>
                          <p className="font-medium">{maskPaymentReference(selectedOrder.payment_reference)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">{isCurrent ? 'Order Status' : 'Final Status'}</p>
                          <p className="font-medium">{getTrackingMessage(selectedOrder.status)}</p>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-sm font-medium">Items</p>
                        <div className="space-y-2">
                          {selectedOrder.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-start rounded-md border bg-gray-50 p-3">
                              <div>
                                <p className="font-medium">{item.product_name}</p>
                                <p className="text-xs text-gray-600">
                                  {item.producer_name} • {item.quantity} {item.unit} × £{Number(item.unit_price).toFixed(2)}
                                </p>
                              </div>
                              <p className="font-medium">£{Number(item.line_total).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Producer Sub-orders</p>
                        <div className="space-y-2">
                            {selectedOrder.sub_orders.map((subOrder) => {
                              const delivery = subOrder.delivery;
                              const displaySubOrderStatus = getSubOrderDisplayStatus(subOrder, simulationNow);
                              const displayDeliveryStatus =
                                getEffectiveDeliveryStatus(delivery, simulationNow) || delivery?.status;
                              const displayDeliveryEta = getEffectiveDeliveryEta(delivery, simulationNow);

                              return (
                                <div key={subOrder.id} className="border-l-4 border-green-500 pl-3">
                                  <p className="font-medium">{subOrder.producer.business_name}</p>
                                  <p className="text-xs text-gray-600">
                                  Delivery {format(new Date(subOrder.delivery_date), 'MMM d, yyyy')} • Status {getDisplayStatusLabel(displaySubOrderStatus)}
                                  </p>
                                  {delivery && (
                                    <p className="text-xs text-gray-600">
                                      Stuart {formatDeliveryStatusLabel(displayDeliveryStatus)}
                                    {displayDeliveryEta ? ` • ETA ${format(new Date(displayDeliveryEta), 'MMM d, h:mm a')}` : ''}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {selectedOrder.payment_status !== 'cancelled' && (
                        <div className="rounded-2xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.99_0.004_145)] p-5 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <ReceiptText className="size-4 text-green-700" />
                                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-green-900">
                                  Receipt
                                </p>
                              </div>
                              <p className="mt-2 text-lg font-semibold text-gray-900">
                                {selectedOrder.order_number}
                              </p>
                              <p className="text-sm text-gray-600">
                                Issued {formatReceiptDate(selectedOrder.created_at)}
                              </p>
                            </div>
                            {!isCurrent && (
                              <Button variant="outline" size="sm" onClick={() => downloadReceipt(order)}>
                                <Download className="mr-2 size-4" />
                                Download Receipt
                              </Button>
                            )}
                          </div>

                          <Separator className="my-4" />

                          <div className="grid gap-4 text-sm sm:grid-cols-3">
                            <div>
                              <p className="text-gray-500">Payment Status</p>
                              <p className="font-medium">{formatStatusLabel(selectedOrder.payment_status)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Payment Reference</p>
                              <p className="font-medium">{maskPaymentReference(selectedOrder.payment_reference)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Delivery Window</p>
                              <p className="font-medium">{renderDeliveryWindow(order)}</p>
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border bg-white p-4">
                            <div className="space-y-2">
                              {selectedOrder.items.map((item) => (
                                <div
                                  key={`receipt-${item.id}`}
                                  className="flex items-start justify-between gap-3 text-sm"
                                >
                                  <div>
                                    <p className="font-medium text-gray-900">{item.product_name}</p>
                                    <p className="text-gray-600">
                                      {item.quantity} {item.unit} from {item.producer_name}
                                    </p>
                                  </div>
                                  <p className="font-medium text-gray-900">£{Number(item.line_total).toFixed(2)}</p>
                                </div>
                              ))}
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-2 text-sm">
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">Subtotal</span>
                                <span className="font-medium">£{Number(selectedOrder.subtotal_amount).toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-gray-600">
                                  Commission ({Number(selectedOrder.commission_rate).toFixed(0)}%)
                                </span>
                                <span className="font-medium">£{Number(selectedOrder.commission_amount).toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between border-t pt-2 text-base">
                                <span className="font-semibold text-gray-900">Total Paid</span>
                                <span className="font-semibold text-green-700">
                                  £{Number(selectedOrder.total_amount).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeOrderView === 'tracking' && isCurrent && (
                    <div className="space-y-5">
                      <div className="rounded-xl border border-[oklch(0.88_0.02_145)] bg-[oklch(0.985_0.01_145)] p-4">
                        {(() => {
                          const primaryDeliveryStatus = getPrimaryDeliveryStatus(selectedOrder.sub_orders, simulationNow);
                          return (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Truck className="size-4 text-green-700" />
                                  <p className="text-sm font-medium text-green-900">Current order tracking</p>
                                </div>
                                {primaryDeliveryStatus && (
                                  <Badge className={cn('border', getDeliveryStatusBadgeClass(primaryDeliveryStatus))}>
                                    {formatDeliveryStatusLabel(primaryDeliveryStatus)}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-2 text-sm text-gray-700">
                                {getTrackingMessage(selectedOrder.status, primaryDeliveryStatus)}
                              </p>
                            </>
                          );
                        })()}
                      </div>

                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Route className="size-4 text-green-700" />
                          <p className="text-sm font-medium">Producer Route Tracking</p>
                        </div>
                        <div className="space-y-4">
                          {selectedOrder.sub_orders.map((subOrder) => renderTrackingMap(selectedOrder, subOrder))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeOrderView === 'tracking' && !isCurrent && (
                    <div className="rounded-xl border border-[oklch(0.88_0.02_145)] bg-gray-50 p-4 text-sm text-gray-600">
                      Tracking is only available for current orders.
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">{backToMarketplaceButton}</div>
        <div>
          <h1 className="text-3xl font-semibold">Order History</h1>
          <p className="text-sm text-gray-600 mt-1">Review past purchases, download receipts, reorder favourites, and track current deliveries.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Filter Orders by Producer or Date Range</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="order-filter-producer">Producer</Label>
                <Select value={producerNameFilter} onValueChange={setProducerNameFilter}>
                  <SelectTrigger id="order-filter-producer">
                    <SelectValue placeholder="All producers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All producers</SelectItem>
                    {producerOptions.map((producerName) => (
                      <SelectItem key={producerName} value={producerName}>
                        {producerName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="order-filter-from-date">From Date</Label>
                <Input
                  id="order-filter-from-date"
                  type="date"
                  value={fromDateFilter}
                  onChange={(event) => setFromDateFilter(event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="order-filter-to-date">To Date</Label>
                <Input
                  id="order-filter-to-date"
                  type="date"
                  value={toDateFilter}
                  onChange={(event) => setToDateFilter(event.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setProducerNameFilter('all');
                    setFromDateFilter('');
                    setToDateFilter('');
                  }}
                  disabled={!hasActiveFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <PageLoadingSkeleton rows={4} cards={3} />
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <ReceiptText className="size-10 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-700 mb-4">
                {hasActiveFilters ? 'No orders matched your filters.' : 'No orders yet.'}
              </p>
              {hasActiveFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setProducerNameFilter('all');
                    setFromDateFilter('');
                    setToDateFilter('');
                  }}
                >
                  Reset Filters
                </Button>
              ) : (
                <Button onClick={() => navigate('/marketplace')}>Browse Products</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card className="border-[oklch(0.85_0.05_150)] bg-[linear-gradient(135deg,rgba(237,248,240,0.9),rgba(255,255,255,0.96))]">
              <CardContent className="grid gap-4 p-5 md:grid-cols-3">
                <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-green-800">
                    <Clock3 className="size-4" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">Current Orders</p>
                  </div>
                  <p className="mt-2 text-3xl font-semibold">{currentOrders.length}</p>
                  <p className="text-sm text-gray-600">Still moving through the delivery flow.</p>
                </div>
                <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="size-4" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">Previous Orders</p>
                  </div>
                  <p className="mt-2 text-3xl font-semibold">{previousOrders.length}</p>
                  <p className="text-sm text-gray-600">Delivered or closed order records.</p>
                </div>
                <div className="rounded-xl bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-blue-800">
                    <Route className="size-4" />
                    <p className="text-xs font-semibold uppercase tracking-[0.18em]">Tracking View</p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-900">Open any order to view producer-by-producer route maps.</p>
                  <p className="mt-1 text-sm text-gray-600">Current orders show live progress state, previous orders keep route history visible.</p>
                </div>
              </CardContent>
            </Card>

            <Collapsible open={currentOrdersOpen} onOpenChange={setCurrentOrdersOpen}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Current Orders</CardTitle>
                      <p className="text-sm text-gray-600">Orders that are still pending, confirmed, or out for delivery.</p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm">
                        {currentOrdersOpen ? <ChevronUp className="size-4 mr-2" /> : <ChevronDown className="size-4 mr-2" />}
                        {currentOrdersOpen ? 'Hide Section' : 'Show Section'}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {currentOrders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[oklch(0.85_0.05_150)] bg-[oklch(0.985_0.01_145)] px-4 py-8 text-center text-sm text-gray-600">
                        No current orders right now.
                      </div>
                    ) : (
                      currentOrders.map((order) => renderOrderCard(order, 'current'))
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <Collapsible open={previousOrdersOpen} onOpenChange={setPreviousOrdersOpen}>
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Previous Orders</CardTitle>
                      <p className="text-sm text-gray-600">Delivered or cancelled orders kept for receipts, history, and reorders.</p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm">
                        {previousOrdersOpen ? <ChevronUp className="size-4 mr-2" /> : <ChevronDown className="size-4 mr-2" />}
                        {previousOrdersOpen ? 'Hide Section' : 'Show Section'}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {previousOrders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                        No previous orders yet.
                      </div>
                    ) : (
                      previousOrders.map((order) => renderOrderCard(order, 'previous'))
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        )}
      </main>
    </div>
  );
}
