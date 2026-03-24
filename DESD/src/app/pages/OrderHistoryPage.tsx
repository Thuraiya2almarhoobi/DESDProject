import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  ReceiptText,
  RotateCcw,
  Route,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createProductReview, fetchProductReviewEligibility } from '../api/catalog';
import { ApiOrderDetail, ApiOrderSummary, apiBlob, apiJson } from '../lib/api';
import { getGoogleMapsDirectionsEmbedUrl, getGoogleMapsDirectionsUrl } from '../lib/googleMaps';
import { useSafeBack } from '../lib/navigation';
import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cn } from '../components/ui/utils';
import { ReviewEligibility } from '../types';

const CURRENT_ORDER_STATUSES = new Set(['pending', 'confirmed', 'ready']);
const TRACKING_STEPS = [
  { key: 'pending', label: 'Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'ready', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
] as const;

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

function getTrackingMessage(status: string): string {
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

function getTrackingStepIndex(status: string): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'confirmed':
      return 1;
    case 'ready':
      return 2;
    case 'delivered':
      return 3;
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
  const [activeReviewItemId, setActiveReviewItemId] = useState<number | null>(null);
  const [reviewEligibilityByProductId, setReviewEligibilityByProductId] = useState<Record<number, ReviewEligibility>>({});
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewIsAnonymous, setReviewIsAnonymous] = useState(false);
  const [reviewFormError, setReviewFormError] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
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

  useEffect(() => {
    resetReviewForm();
  }, [activeOrderId, activeOrderView]);

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

    setDetailLoading(true);
    try {
      const detail = await apiJson<ApiOrderDetail>(`/api/orders/history/${orderId}/`);
      setSelectedOrder(detail);
    } catch (error) {
      toast.error('Unable to load order details.');
      setActiveOrderId(null);
      setActiveOrderView(null);
      setSelectedOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const resetReviewForm = () => {
    setActiveReviewItemId(null);
    setReviewTitle('');
    setReviewComment('');
    setReviewRating(0);
    setReviewIsAnonymous(false);
    setReviewFormError('');
    setIsSubmittingReview(false);
  };

  const getEligibilityForProduct = async (productId: number): Promise<ReviewEligibility> => {
    const cached = reviewEligibilityByProductId[productId];
    if (cached) {
      return cached;
    }

    const eligibility = await fetchProductReviewEligibility(String(productId));
    setReviewEligibilityByProductId((current) => ({
      ...current,
      [productId]: eligibility,
    }));
    return eligibility;
  };

  const openReviewFormForItem = async (item: ApiOrderDetail['items'][number]) => {
    if (!item.product_id) {
      toast.error('This order item is missing its product link, so a review cannot be created from here.');
      return;
    }

    try {
      const eligibility = await getEligibilityForProduct(item.product_id);
      if (!eligibility.canSubmit) {
        toast.info(eligibility.reason);
        return;
      }
      setReviewFormError('');
      setActiveReviewItemId((current) => (current === item.id ? null : item.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to check review eligibility.');
    }
  };

  const submitReviewForItem = async (item: ApiOrderDetail['items'][number]) => {
    if (!item.product_id) {
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      setReviewFormError('Please choose a star rating before submitting.');
      return;
    }

    if (!reviewTitle.trim()) {
      setReviewFormError('Please add a review title before submitting.');
      return;
    }

    setReviewFormError('');
    setIsSubmittingReview(true);

    try {
      const createdReview = await createProductReview(String(item.product_id), {
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        isAnonymous: reviewIsAnonymous,
      });

      const updatedEligibility = await fetchProductReviewEligibility(String(item.product_id));
      setReviewEligibilityByProductId((current) => ({
        ...current,
        [item.product_id as number]: updatedEligibility,
      }));

      if (createdReview.moderationStatus === 'pending') {
        toast.success('Your review was submitted and is waiting for approval.');
      } else {
        toast.success('Your review is now live on the product page.');
      }

      resetReviewForm();
    } catch (error) {
      setReviewFormError(error instanceof Error ? error.message : 'Unable to submit review.');
    } finally {
      setIsSubmittingReview(false);
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
    const mapUrl = getGoogleMapsDirectionsEmbedUrl(subOrder.producer.postcode, order.customer_postcode);
    const routeUrl = getGoogleMapsDirectionsUrl(subOrder.producer.postcode, order.customer_postcode);
    const stepIndex = getTrackingStepIndex(subOrder.status);

    return (
      <div key={subOrder.id} className="rounded-xl border border-[oklch(0.88_0.02_145)] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold">{subOrder.producer.business_name}</p>
            <p className="text-sm text-gray-600">
              Tracking route: {subOrder.producer.postcode} to {order.customer_postcode}
            </p>
          </div>
          <Badge className={cn('border', getStatusBadgeClass(subOrder.status))}>
            {formatStatusLabel(subOrder.status)}
          </Badge>
        </div>

        <div className="mt-3 rounded-lg bg-[oklch(0.985_0.01_145)] p-3 text-sm text-gray-700">
          {getTrackingMessage(subOrder.status)}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {TRACKING_STEPS.map((step, index) => {
            const isComplete = stepIndex >= index;
            const isCancelled = subOrder.status === 'cancelled';

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

        <div className="mt-4 overflow-hidden rounded-xl border bg-gray-50">
          <div className="aspect-[16/7]">
            {mapUrl ? (
              <iframe
                title={`Tracking map for ${subOrder.producer.business_name}`}
                src={mapUrl}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-600">
                Tracking map is unavailable right now, but the route details are still shown for this order.
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>Delivery target: {format(new Date(subOrder.delivery_date), 'MMM d, yyyy')}</span>
          {routeUrl && (
            <a
              href={routeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-green-700 underline"
            >
              Open route in Google Maps
            </a>
          )}
        </div>
      </div>
    );
  };

  const renderOrderCard = (order: ApiOrderSummary, sectionLabel: 'current' | 'previous') => {
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
              <Badge className={cn('border', getStatusBadgeClass(order.status))}>
                {formatStatusLabel(order.status)}
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
                {isCurrent ? 'Still in progress' : order.status === 'cancelled' ? 'Order closed' : 'Completed'}
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
                <p className="text-sm text-gray-600">Loading order details...</p>
              ) : (
                <>
                  {activeOrderView === 'details' && (
                    <div className="space-y-5">
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
                            <div key={item.id} className="rounded-md border bg-gray-50 p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{item.product_name}</p>
                                  <p className="text-xs text-gray-600">
                                    {item.producer_name} • {item.quantity} {item.unit} × £{Number(item.unit_price).toFixed(2)}
                                  </p>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <p className="font-medium">£{Number(item.line_total).toFixed(2)}</p>
                                  {item.product_id ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => void openReviewFormForItem(item)}
                                    >
                                      {activeReviewItemId === item.id ? 'Hide Review Form' : 'Write Review'}
                                    </Button>
                                  ) : null}
                                </div>
                              </div>

                              {item.product_id && activeReviewItemId === item.id ? (
                                <div className="mt-4 rounded-xl border bg-white p-4 space-y-4">
                                  <div>
                                    <p className="font-medium text-gray-900">Rate {item.product_name}</p>
                                    <p className="text-sm text-gray-500">
                                      Only delivered purchases can be reviewed. Verified reviews appear on the product page for other customers.
                                    </p>
                                  </div>

                                  <div className="space-y-2">
                                    <Label>Your rating (1 to 5 stars)</Label>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: 5 }).map((_, index) => {
                                        const starValue = index + 1;
                                        const active = starValue <= reviewRating;
                                        return (
                                          <button
                                            key={`${item.id}-${starValue}`}
                                            type="button"
                                            onClick={() => setReviewRating(starValue)}
                                            className="rounded p-1 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600"
                                            aria-label={`Rate ${starValue} star${starValue === 1 ? '' : 's'}`}
                                          >
                                            <Star
                                              className={`size-5 ${active ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`review-title-${item.id}`}>Review title</Label>
                                    <Input
                                      id={`review-title-${item.id}`}
                                      placeholder="Excellent quality and flavour"
                                      value={reviewTitle}
                                      onChange={(event) => setReviewTitle(event.target.value.slice(0, 120))}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`review-comment-${item.id}`}>Review text</Label>
                                    <Textarea
                                      id={`review-comment-${item.id}`}
                                      placeholder="Tell other customers what you thought about this product."
                                      value={reviewComment}
                                      onChange={(event) => setReviewComment(event.target.value.slice(0, 500))}
                                      rows={4}
                                    />
                                    <p className="text-xs text-gray-500">{reviewComment.length}/500 characters</p>
                                  </div>

                                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                                    <div className="flex items-start gap-3">
                                      <Checkbox
                                        id={`review-anonymous-${item.id}`}
                                        checked={reviewIsAnonymous}
                                        onCheckedChange={(checked) => setReviewIsAnonymous(checked === true)}
                                        aria-label="Post review anonymously"
                                        className="mt-0.5"
                                      />
                                      <div className="space-y-1">
                                        <Label htmlFor={`review-anonymous-${item.id}`} className="font-medium">
                                          Post this review anonymously
                                        </Label>
                                        <p className="text-xs text-gray-600">
                                          If selected, the product page will show “Anonymous” instead of your name.
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {reviewEligibilityByProductId[item.product_id]?.reason ? (
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                      {reviewEligibilityByProductId[item.product_id].reason}
                                    </div>
                                  ) : null}

                                  {reviewFormError ? <p className="text-sm text-red-600">{reviewFormError}</p> : null}

                                  <div className="flex justify-end gap-2">
                                    <Button variant="ghost" onClick={resetReviewForm} disabled={isSubmittingReview}>
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => void submitReviewForItem(item)}
                                      disabled={isSubmittingReview || reviewRating === 0 || !reviewTitle.trim()}
                                    >
                                      {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Producer Sub-orders</p>
                        <div className="space-y-2">
                          {selectedOrder.sub_orders.map((subOrder) => (
                            <div key={subOrder.id} className="border-l-4 border-green-500 pl-3">
                              <p className="font-medium">{subOrder.producer.business_name}</p>
                              <p className="text-xs text-gray-600">
                                Delivery {format(new Date(subOrder.delivery_date), 'MMM d, yyyy')} • Status {formatStatusLabel(subOrder.status)}
                              </p>
                            </div>
                          ))}
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Truck className="size-4 text-green-700" />
                          <p className="text-sm font-medium text-green-900">Current order tracking</p>
                        </div>
                        <p className="mt-2 text-sm text-gray-700">{getTrackingMessage(selectedOrder.status)}</p>
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
          <Card>
            <CardContent className="py-10 text-center text-gray-600">Loading your orders...</CardContent>
          </Card>
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
