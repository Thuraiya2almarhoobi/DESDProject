/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the CheckoutPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft, CreditCard, CheckCircle, LoaderCircle, XCircle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useSafeBack } from '../lib/navigation';
import { isBuyerRole } from '../lib/ordering';
import { SiteHeader } from '../components/SiteHeader';
import { AddressLookupFields } from '../components/AddressLookupFields';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { addDays, format } from 'date-fns';
import { ApiOrderDetail, apiJson } from '../lib/api';

type CheckoutStep = 'address' | 'delivery' | 'payment' | 'confirm';

/**
 * PENDING_STRIPE_CHECKOUT_STORAGE_KEY boundary.
 *
 * This exported unit supports the file role: Implements the CheckoutPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const PENDING_STRIPE_CHECKOUT_STORAGE_KEY = 'desd_pending_stripe_checkout';
const LEGACY_PENDING_STRIPE_ORDER_STORAGE_KEY = 'desd_pending_stripe_order_id';

interface PendingStripeCheckoutState {
  orderId: number;
  recurringTemplateId?: number | null;
}

function readPendingStripeCheckout(): PendingStripeCheckoutState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  // Session storage bridges the redirect to Stripe and back. It is intentionally
  // per-tab, not localStorage, so stale checkout ids do not survive a new visit.
  const raw = window.sessionStorage.getItem(PENDING_STRIPE_CHECKOUT_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<PendingStripeCheckoutState>;
      if (typeof parsed.orderId === 'number') {
        return {
          orderId: parsed.orderId,
          recurringTemplateId:
            typeof parsed.recurringTemplateId === 'number' ? parsed.recurringTemplateId : null,
        };
      }
    } catch {
      // Fall through to the legacy order-id storage format.
    }
  }

  const legacyOrderId = window.sessionStorage.getItem(LEGACY_PENDING_STRIPE_ORDER_STORAGE_KEY);
  if (!legacyOrderId) {
    return null;
  }

  const parsedLegacyId = Number(legacyOrderId);
  if (!Number.isFinite(parsedLegacyId)) {
    return null;
  }
  return { orderId: parsedLegacyId, recurringTemplateId: null };
}

function persistPendingStripeCheckout(state: PendingStripeCheckoutState): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(PENDING_STRIPE_CHECKOUT_STORAGE_KEY, JSON.stringify(state));
  window.sessionStorage.setItem(LEGACY_PENDING_STRIPE_ORDER_STORAGE_KEY, String(state.orderId));
}

function clearPendingStripeCheckout(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PENDING_STRIPE_CHECKOUT_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_PENDING_STRIPE_ORDER_STORAGE_KEY);
}

function currentStripeRedirectUrls(): { success_url: string; cancel_url: string } | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return {
    success_url: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${window.location.origin}/checkout/cancel`,
  };
}

function minDeliveryDate(leadHours: number): string {
  const minHours = Math.max(48, leadHours || 48);
  const minDays = Math.ceil(minHours / 24);
  return format(addDays(new Date(), minDays), 'yyyy-MM-dd');
}

function dateOrDefault(value: string | undefined, leadHours: number): string {
  if (value) {
    return value;
  }
  return minDeliveryDate(leadHours);
}

/**
 * CheckoutPage boundary.
 *
 * This exported unit supports the file role: Implements the CheckoutPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBackToCart = useSafeBack('/cart');
  const { user, addresses } = useAuth();
  const {
    items,
    selectedItems,
    selectedCartItemIds,
    getSelectedCartByProducer,
    getSelectedGrandTotal,
    refreshCart,
  } = useCart();

  const [step, setStep] = useState<CheckoutStep>('address');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [deliveryAddressLabel, setDeliveryAddressLabel] = useState('');
  const [foodMiles, setFoodMiles] = useState<{
    total: number;
    maxProducer: number;
    withinTwentyMiles: boolean;
  }>({ total: 0, maxProducer: 0, withinTwentyMiles: true });
  const [deliveryDates, setDeliveryDates] = useState<Record<string, string>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'fortnightly'>('weekly');
  const [orderDay, setOrderDay] = useState(0);
  const [deliveryDay, setDeliveryDay] = useState(2);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [createdRecurringTemplateId, setCreatedRecurringTemplateId] = useState<number | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ApiOrderDetail | null>(null);

  const cartByProducer = getSelectedCartByProducer();
  const grandTotal = getSelectedGrandTotal();
  const commission = grandTotal * 0.05;
  const producerPayout = grandTotal - commission;
  const total = grandTotal;
  const isCustomerCheckout = user?.role === 'CUSTOMER';
  const isCommunityCheckout = user?.role === 'COMMUNITY';
  const isRestaurantCheckout = user?.role === 'RESTAURANT';
  const usesStripeCheckout = isBuyerRole(user?.role);
  const isMultiProducerCheckout = cartByProducer.length > 1;
  const isStripeSuccessReturn = location.pathname === '/checkout/success';
  const isStripeCancelReturn = location.pathname === '/checkout/cancel';
  const isStripeReturnPath = isStripeSuccessReturn || isStripeCancelReturn;
  const weekdayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const savedAddressOptions = useMemo(() => addresses || [], [addresses]);
  const selectedCartItemKey = useMemo(() => selectedCartItemIds.join(','), [selectedCartItemIds]);
  const currentAccountTypeLabel = isCommunityCheckout
    ? 'community organisation'
    : isRestaurantCheckout
      ? 'restaurant'
      : 'customer';
  const backToCartButton = (
    <Button variant="ghost" onClick={goBackToCart}>
      <ArrowLeft className="mr-2 size-4" />
      Back to Cart
    </Button>
  );
  const handleAddressFieldChange = (
    field: 'line1' | 'line2' | 'city' | 'postcode',
    value: string,
  ) => {
    // manual address edits detach the form from a saved address record
    setSelectedAddressId(null);
    setDeliveryAddressLabel('Lookup address');
    if (field === 'line1') {
      setAddressLine1(value);
    } else if (field === 'line2') {
      setAddressLine2(value);
    } else if (field === 'city') {
      setCity(value);
    } else {
      setPostcode(value);
    }
  };

  useEffect(() => {
    // profile loading prefers saved structured addresses over legacy text address
    let mounted = true;

    const loadProfile = async () => {
      try {
        const profile = await apiJson<{
          delivery_address: string;
          postcode: string;
        }>('/api/orders/profile/');

        if (!mounted) {
          return;
        }

        if (savedAddressOptions.length > 0) {
          const defaultAddress = savedAddressOptions.find((entry) => entry.is_default) || savedAddressOptions[0];
          setSelectedAddressId(defaultAddress.id);
          setDeliveryAddressLabel(defaultAddress.label || 'Saved address');
          setAddressLine1(defaultAddress.line1 || '');
          setAddressLine2(defaultAddress.line2 || '');
          setCity(defaultAddress.city || '');
          setPostcode(defaultAddress.postcode || '');
          return;
        }

        const fullAddress = profile.delivery_address || '';
        if (fullAddress.includes(',')) {
          const parts = fullAddress.split(',').map((part) => part.trim()).filter(Boolean);
          setAddressLine1(parts[0] || '');
          setAddressLine2(parts.length > 2 ? parts.slice(1, -1).join(', ') : '');
          setCity(parts.length > 1 ? parts[parts.length - 1] : '');
        } else {
          setAddressLine1(fullAddress);
          setAddressLine2('');
        }
        setPostcode(profile.postcode || '');
      } catch {
        if (mounted) {
          setAddressLine1('');
          setAddressLine2('');
          setCity('');
          setPostcode('');
        }
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [savedAddressOptions]);

  useEffect(() => {
    if (!postcode.trim() || selectedItems.length === 0) {
      setFoodMiles({ total: 0, maxProducer: 0, withinTwentyMiles: true });
      return;
    }

    let mounted = true;
    const loadFoodMiles = async () => {
      try {
        // food miles are recalculated from selected cart rows and the current postcode
        const query = new URLSearchParams({ postcode: postcode.trim() });
        selectedCartItemKey.split(',').filter(Boolean).forEach((cartItemId) => {
          query.append('cart_item_id', String(cartItemId));
        });
        const payload = await apiJson<{
          total_food_miles?: string | number;
          max_producer_distance?: string | number;
          within_twenty_miles?: boolean;
        }>(`/api/geo/food-miles/cart/?${query.toString()}`);
        if (!mounted) {
          return;
        }
        const maxProducer = Number(payload.max_producer_distance || 0);
        setFoodMiles({
          total: Number(payload.total_food_miles || 0),
          maxProducer,
          withinTwentyMiles: payload.within_twenty_miles ?? maxProducer <= 20,
        });
      } catch {
        if (mounted) {
          setFoodMiles({ total: 0, maxProducer: 0, withinTwentyMiles: true });
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void loadFoodMiles();
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, [postcode, selectedCartItemKey, selectedItems.length]);

  useEffect(() => {
    if (cartByProducer.length === 0) {
      return;
    }

    // each producer keeps its own delivery date because lead times differ
    setDeliveryDates((previous) => {
      const next: Record<string, string> = { ...previous };
      cartByProducer.forEach((group) => {
        next[group.producerId] = dateOrDefault(previous[group.producerId], group.deliveryLeadTime);
      });
      return next;
    });
  }, [cartByProducer]);

  useEffect(() => {
    if (!usesStripeCheckout || !isStripeReturnPath) {
      return;
    }

    let mounted = true;
    const query = new URLSearchParams(location.search);

    const handleStripeReturn = async () => {
      // checkout return paths reconcile stripe stock cart and order state
      setStep('payment');
      setPaymentProcessing(true);
      setPaymentError('');
      setPaymentNotice('');

      try {
        if (isStripeSuccessReturn) {
          const sessionId = query.get('session_id');
          const pendingCheckout = readPendingStripeCheckout();
          if (!sessionId) {
            throw new Error('Stripe did not return a checkout session ID.');
          }

          const response = await apiJson<{
            confirmed: boolean;
            payment_status: string;
            checkout_status?: string;
            order: ApiOrderDetail;
          }>('/api/payments/stripe/checkout-session/confirm/', {
            method: 'POST',
            body: JSON.stringify({ session_id: sessionId }),
          });

          if (!mounted) {
            return;
          }

          if (response.confirmed && response.order.payment_status === 'paid') {
            setCreatedOrder(response.order);
            setCreatedRecurringTemplateId(pendingCheckout?.recurringTemplateId ?? null);
            setOrderComplete(true);
            setStep('confirm');
            setPaymentNotice('');
            clearPendingStripeCheckout();
            await refreshCart();
            return;
          }

          if (response.checkout_status === 'expired') {
            setPaymentError('Your Stripe checkout session expired. Your stock reservation has been released.');
          } else {
            setPaymentNotice('Stripe is still finalising your test payment. Refresh this page in a moment.');
          }
          return;
        }

        const pendingCheckout = readPendingStripeCheckout();
        const pendingOrderId = pendingCheckout?.orderId;

        if (pendingOrderId) {
          await apiJson<{ cancelled: boolean; order: ApiOrderDetail }>(
            '/api/payments/stripe/checkout-session/cancel/',
            {
              method: 'POST',
              body: JSON.stringify({ order_id: pendingOrderId }),
            },
          );
          clearPendingStripeCheckout();
          await refreshCart();
        }

        if (!mounted) {
          return;
        }

        setPaymentError(
          pendingCheckout?.recurringTemplateId
            ? 'Stripe checkout was cancelled. Your reserved stock has been returned to the cart flow, and the recurring template remains available in Recurring Orders.'
            : 'Stripe checkout was cancelled. Your reserved stock has been returned to the cart flow.',
        );
      } catch (error) {
        if (!mounted) {
          return;
        }
        setPaymentError(error instanceof Error ? error.message : 'Unable to confirm the Stripe checkout result.');
      } finally {
        if (mounted) {
          setPaymentProcessing(false);
        }
      }
    };

    void handleStripeReturn();

    return () => {
      mounted = false;
    };
  }, [
    isStripeCancelReturn,
    isStripeReturnPath,
    isStripeSuccessReturn,
    location.search,
    refreshCart,
    usesStripeCheckout,
  ]);

  if ((items.length === 0 || selectedItems.length === 0) && !orderComplete && !isStripeReturnPath) {
    navigate('/cart');
    return null;
  }

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodMiles.withinTwentyMiles) {
      // the local food radius blocks checkout before payment starts
      setPaymentError('This delivery address is outside the 20-mile local food network radius. Select a closer saved address before checkout.');
      return;
    }
    setPaymentError('');
    setStep('delivery');
  };

  const handleDeliverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('payment');
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentProcessing(true);
    setPaymentError('');
    setPaymentNotice('');

    try {
      const fullAddress = [addressLine1, addressLine2, city].filter(Boolean).join(', ');

      // selected cart item ids keep partial checkout separate from the rest of cart
      const payload: Record<string, unknown> = {
        delivery_address: fullAddress,
        customer_postcode: postcode,
        delivery_address_label: deliveryAddressLabel || 'Checkout address',
        selected_address_id: selectedAddressId,
        payment_method: usesStripeCheckout ? 'stripe_checkout' : 'test_card',
        payment_terms: isCommunityCheckout || isRestaurantCheckout ? 'invoice_terms_may_apply' : 'pay_online_now',
        purchase_order_number: isCommunityCheckout || isRestaurantCheckout ? purchaseOrderNumber.trim() : '',
        payment_token: '',
        selected_cart_item_ids: selectedCartItemIds.map((cartItemId) => Number(cartItemId)),
      };
      if (usesStripeCheckout) {
        Object.assign(payload, currentStripeRedirectUrls());
      }
      if (specialInstructions.trim()) {
        payload.special_instructions = specialInstructions.trim();
      }

      // multi producer checkout sends dates by producer so lead times can differ
      if (cartByProducer.length === 1) {
        payload.delivery_date = deliveryDates[cartByProducer[0].producerId];
      } else {
        const producerDates: Record<string, string> = {};
        cartByProducer.forEach((group) => {
          producerDates[group.producerId] = deliveryDates[group.producerId];
        });
        payload.producer_delivery_dates = producerDates;
      }

      // restaurant recurring checkout uses its own endpoint but shares the same cart payload
      if (isRestaurantCheckout && makeRecurring) {
        payload.frequency = recurringFrequency;
        payload.order_day = orderDay;
        payload.delivery_day = deliveryDay;

        const response = await apiJson<{
          message: string;
          template: { id: number };
          initial_order: ApiOrderDetail;
          payment: {
            checkout_session_id: string;
            checkout_url: string;
          };
        }>('/api/restaurant/recurring-orders/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        persistPendingStripeCheckout({
          orderId: response.initial_order.id,
          recurringTemplateId: response.template.id,
        });
        if (typeof window !== 'undefined') {
          window.location.assign(response.payment.checkout_url);
        }
        return;
      } else if (isCommunityCheckout) {
        const response = await apiJson<{
          message: string;
          order: ApiOrderDetail;
          payment: {
            checkout_session_id: string;
            checkout_url: string;
          };
        }>('/api/community/bulk-checkout/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        persistPendingStripeCheckout({ orderId: response.order.id, recurringTemplateId: null });
        if (typeof window !== 'undefined') {
          window.location.assign(response.payment.checkout_url);
        }
        return;
      } else {
        const response = await apiJson<{
          message: string;
          order: ApiOrderDetail;
          payment: {
            checkout_session_id: string;
            checkout_url: string;
          };
        }>('/api/orders/checkout/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        persistPendingStripeCheckout({ orderId: response.order.id, recurringTemplateId: null });
        if (typeof window !== 'undefined') {
          window.location.assign(response.payment.checkout_url);
        }
        return;
      }
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setPaymentProcessing(false);
    }
  };

/**
 * StepIndicator boundary.
 *
 * This exported unit supports the file role: Implements the CheckoutPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center gap-2">
        {(['address', 'delivery', 'payment', 'confirm'] as CheckoutStep[]).map((s, idx) => (
          <div key={s} className="flex items-center">
            <div
              className={`size-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s
                  ? 'bg-green-600 text-white'
                  : idx < (['address', 'delivery', 'payment', 'confirm'] as CheckoutStep[]).indexOf(step)
                  ? 'bg-green-200 text-green-700'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {idx + 1}
            </div>
            {idx < 3 && (
              <div
                className={`w-12 h-0.5 ${
                  idx < (['address', 'delivery', 'payment', 'confirm'] as CheckoutStep[]).indexOf(step)
                    ? 'bg-green-200'
                    : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );

  if (orderComplete && createdOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <SiteHeader showNavigation={false} />

        <main className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="mb-6 text-2xl font-semibold">
            {isCommunityCheckout
              ? 'Community Bulk Checkout'
              : isRestaurantCheckout
              ? 'Restaurant Checkout'
              : isMultiProducerCheckout
              ? 'Order Confirmation'
              : 'Order Confirmation'}
          </h1>
          <Card className="text-center">
            <CardContent className="py-12">
              <div className="size-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="size-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Order Confirmed!</h2>
              <p className="text-gray-600 mb-6">
                {isCommunityCheckout
                  ? 'Your Stripe test payment was captured successfully and the community bulk order has been recorded.'
                  : isRestaurantCheckout && createdRecurringTemplateId
                  ? 'Your Stripe test payment was captured successfully and the recurring kitchen template is now active.'
                  : usesStripeCheckout
                  ? 'Your Stripe test payment was captured successfully and the order has been recorded.'
                  : 'Your order has been successfully placed in test mode.'}
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-6 inline-block">
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="text-xl font-semibold">{createdOrder.order_number}</p>
              </div>
              {createdOrder.payment_reference && (
                <div className="bg-gray-50 p-4 rounded-lg mb-6 inline-block ml-0 sm:ml-4">
                  <p className="text-sm text-gray-600">Payment ID</p>
                  <p className="text-xl font-semibold">{createdOrder.payment_reference}</p>
                </div>
              )}

              <div className="space-y-4 max-w-md mx-auto text-left">
                <h3 className="font-semibold">
                  {createdOrder.sub_orders.length > 1 ? 'Producer Breakdown' : 'Producer Delivery Details'}
                </h3>
                {createdOrder.sub_orders.map((subOrder) => (
                  <div key={subOrder.id} className="border-l-4 border-green-500 pl-4">
                    <p className="font-medium">{subOrder.producer.business_name}</p>
                    <p className="text-sm text-gray-600">
                      Delivery: {format(new Date(subOrder.delivery_date), 'MMMM d, yyyy')}
                    </p>
                    {(subOrder.producer_contact_phone || subOrder.producer_contact_email) && (
                      <p className="text-sm text-gray-600">
                        Contact: {subOrder.producer_contact_phone || 'n/a'}
                        {subOrder.producer_contact_email ? ` | ${subOrder.producer_contact_email}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {createdOrder.special_instructions && (
                <div className="mt-6 max-w-md mx-auto text-left rounded-md border bg-gray-50 p-3">
                  <p className="text-sm font-medium">Special delivery instructions</p>
                  <p className="text-sm text-gray-700">{createdOrder.special_instructions}</p>
                </div>
              )}

              {createdRecurringTemplateId && (
                <div className="mt-6 max-w-md mx-auto text-left rounded-md border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-900">
                    Recurring template created (#{createdRecurringTemplateId})
                  </p>
                  <p className="text-sm text-green-800">
                    You can modify next week's instance without changing the template defaults.
                  </p>
                </div>
              )}

              <div className="mt-8 flex gap-3 justify-center">
                <Button onClick={() => navigate('/orders/history')}>View Order History</Button>
                {createdRecurringTemplateId && (
                  <Button variant="outline" onClick={() => navigate('/restaurant/recurring-orders')}>
                    Manage Recurring Orders
                  </Button>
                )}
                <Button variant="outline" onClick={() => navigate('/marketplace')}>Continue Shopping</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isStripeReturnPath && paymentProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <SiteHeader showNavigation={false} />

        <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 py-12">
          <Card className="w-full max-w-xl">
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <LoaderCircle className="size-10 animate-spin text-green-700" />
              <h1 className="text-2xl font-semibold">Confirming Stripe Payment</h1>
              <p className="max-w-md text-sm text-gray-600">
                Checking the Stripe test checkout result and syncing your order, payment record, and stock levels.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader showNavigation={false} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">{backToCartButton}</div>
        <h1 className="text-3xl font-semibold mb-2">
          {isCommunityCheckout
            ? 'Community Bulk Checkout'
            : isRestaurantCheckout
            ? 'Restaurant Checkout'
            : isMultiProducerCheckout
            ? 'Multi-Producer Checkout'
            : 'Checkout'}
        </h1>
        {(isCommunityCheckout || isRestaurantCheckout || isMultiProducerCheckout) && (
          <p className="text-sm text-gray-600 mb-8">
            {isCommunityCheckout
              ? 'Role: COMMUNITY | Multi-producer bulk ordering interface'
              : isRestaurantCheckout
              ? 'Role: RESTAURANT | Recurring-order capable checkout interface'
              : 'Separate producer sections are shown so delivery dates and payment breakdowns stay clear.'}
          </p>
        )}

        {(isCommunityCheckout || isRestaurantCheckout) && (
          <Card className="mb-8 border-[oklch(0.84_0.05_145)] bg-[linear-gradient(135deg,rgba(243,249,244,0.96),rgba(255,255,255,0.94))]">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.42_0.07_145)]">
                  {isCommunityCheckout ? 'Community checkout flow' : 'Restaurant checkout flow'}
                </p>
                <h2 className="text-xl font-semibold text-[oklch(0.24_0.03_145)]">
                  {isCommunityCheckout
                    ? 'Confirm a single coordinated order for your organisation'
                    : 'Turn this kitchen order into a confirmed purchase or a reusable recurring template'}
                </h2>
                <p className="text-sm text-gray-600">
                  {isCommunityCheckout
                    ? 'Delivery notes and producer contacts stay grouped by supplier so volunteers and receiving teams can coordinate clearly.'
                    : 'Producer sections stay separate so you can schedule deliveries, then optionally convert the order into a weekly or fortnightly template.'}
                </p>
              </div>
              <div className="grid gap-2 rounded-2xl border border-white/80 bg-white/80 p-4 text-sm text-gray-700 lg:min-w-[17rem]">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">Per-product cap</span>
                  <Badge variant="secondary">Producer stock limit</Badge>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">Producer groups</span>
                  <span>{cartByProducer.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-medium">Selected lines</span>
                  <span>{selectedCartItemIds.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <StepIndicator />

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === 'address' && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isCommunityCheckout
                      ? 'Community Delivery Address'
                      : isRestaurantCheckout
                        ? 'Restaurant Delivery Address'
                        : 'Delivery Address'}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Select a saved delivery address. The 20-mile local network check updates before checkout.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddressSubmit} className="space-y-4">
                    {savedAddressOptions.length > 0 && (
                      <div>
                        <Label htmlFor="saved-address">Saved Address</Label>
                        <select
                          id="saved-address"
                          value={selectedAddressId ?? ''}
                          onChange={(event) => {
                            const nextId = Number(event.target.value);
                            const nextAddress = savedAddressOptions.find((entry) => entry.id === nextId);
                            if (!nextAddress) {
                              return;
                            }
                            setSelectedAddressId(nextAddress.id);
                            setDeliveryAddressLabel(nextAddress.label || 'Saved address');
                            setAddressLine1(nextAddress.line1 || '');
                            setAddressLine2(nextAddress.line2 || '');
                            setCity(nextAddress.city || '');
                            setPostcode(nextAddress.postcode || '');
                          }}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          {savedAddressOptions.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.label || 'Saved address'}{entry.is_default ? ' (default)' : ''} - {entry.postcode}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <AddressLookupFields
                      key={selectedAddressId ?? 'lookup-address'}
                      idPrefix="checkout-delivery"
                      line1={addressLine1}
                      line2={addressLine2}
                      city={city}
                      postcode={postcode}
                      onChange={handleAddressFieldChange}
                      lookupLabel="Find delivery address or postcode"
                      required
                    />
                    <div
                      className={`rounded-md border p-3 text-sm ${
                        foodMiles.withinTwentyMiles
                          ? 'border-green-200 bg-green-50 text-green-900'
                          : 'border-red-200 bg-red-50 text-red-900'
                      }`}
                    >
                      <p className="font-medium">Food miles for this address</p>
                      <p className="mt-1">
                        Selected-order food miles: {foodMiles.total.toFixed(2)} miles. The local delivery
                        radius is checked against the 20-mile network commitment.
                      </p>
                      {!foodMiles.withinTwentyMiles && (
                        <p className="mt-1">
                          Checkout is blocked because this address is outside the 20-mile local food network radius.
                        </p>
                      )}
                    </div>
                    {paymentError && step === 'address' && (
                      <Alert variant="destructive">
                        <XCircle className="size-4" />
                        <AlertDescription>{paymentError}</AlertDescription>
                      </Alert>
                    )}
                    <Button type="submit" className="w-full">Continue to Delivery</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 'delivery' && (
              <Card>
                <CardHeader>
                  <CardTitle>{isMultiProducerCheckout ? 'Delivery Dates' : 'Delivery Date'}</CardTitle>
                  <p className="text-sm text-gray-600">
                    {isMultiProducerCheckout
                      ? 'Each producer can have a different delivery date.'
                      : 'The delivery date must respect the producer’s minimum 48-hour lead time.'}
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleDeliverySubmit} className="space-y-6">
                    {cartByProducer.map((group) => {
                      const minDate = minDeliveryDate(group.deliveryLeadTime);
                      return (
                        <div key={group.producerId} className="border p-4 rounded-lg">
                          <h4 className="font-medium mb-2">{group.producerName}</h4>
                          <p className="text-sm text-gray-600 mb-3">Minimum {Math.max(48, group.deliveryLeadTime)} hours lead time</p>
                          <Label htmlFor={`date-${group.producerId}`}>Delivery Date</Label>
                          <Input
                            id={`date-${group.producerId}`}
                            type="date"
                            min={minDate}
                            value={deliveryDates[group.producerId] || ''}
                            onChange={(e) =>
                              setDeliveryDates((prev) => ({
                                ...prev,
                                [group.producerId]: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                      );
                    })}
                    {isCommunityCheckout && (
                      <div className="border p-4 rounded-lg">
                        <p className="mb-3 text-sm text-gray-600">
                          Add any site access notes, receiving contact details, or unloading guidance for the community drop-off point.
                        </p>
                        <Label htmlFor="special-instructions">Special Delivery Instructions</Label>
                        <Input
                          id="special-instructions"
                          value={specialInstructions}
                          onChange={(e) => setSpecialInstructions(e.target.value)}
                          placeholder="Delivery to kitchen entrance, contact kitchen manager"
                        />
                      </div>
                    )}
                    {isRestaurantCheckout && (
                      <div className="border p-4 rounded-lg space-y-3">
                        <p className="text-sm text-gray-600">
                          Enable recurring if this order should become the template for regular kitchen replenishment.
                        </p>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={makeRecurring}
                            onChange={(event) => setMakeRecurring(event.target.checked)}
                          />
                          <span>Make this a recurring order</span>
                        </label>
                        {makeRecurring && (
                          <div className="grid md:grid-cols-3 gap-3">
                            <div>
                              <Label htmlFor="recurring-frequency">Frequency</Label>
                              <select
                                id="recurring-frequency"
                                value={recurringFrequency}
                                onChange={(event) =>
                                  setRecurringFrequency(event.target.value as 'weekly' | 'fortnightly')
                                }
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                <option value="weekly">Weekly</option>
                                <option value="fortnightly">Fortnightly</option>
                              </select>
                            </div>
                            <div>
                              <Label htmlFor="order-day">Order Day</Label>
                              <select
                                id="order-day"
                                value={orderDay}
                                onChange={(event) => setOrderDay(Number(event.target.value))}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                {weekdayOptions.map((label, index) => (
                                  <option key={label} value={index}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <Label htmlFor="delivery-day">Delivery Day</Label>
                              <select
                                id="delivery-day"
                                value={deliveryDay}
                                onChange={(event) => setDeliveryDay(Number(event.target.value))}
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              >
                                {weekdayOptions.map((label, index) => (
                                  <option key={label} value={index}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button type="button" variant="outline" onClick={() => setStep('address')}>Back</Button>
                      <Button type="submit" className="flex-1">Continue to Payment</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 'payment' && (
              <Card>
                <CardHeader>
                <CardTitle>Payment Method</CardTitle>
                <p className="text-sm text-gray-600">
                    {usesStripeCheckout
                      ? 'This checkout uses Stripe test mode. You will be redirected to the hosted checkout page to finish payment.'
                      : 'Sandbox payment. No real payment will be processed.'}
                  </p>
                </CardHeader>
                <CardContent>
                  {paymentError && (
                    <Alert variant="destructive" className="mb-4">
                      <XCircle className="size-4" />
                      <AlertDescription>{paymentError}</AlertDescription>
                    </Alert>
                  )}
                  {paymentNotice && (
                    <Alert className="mb-4">
                      <CreditCard className="size-4" />
                      <AlertDescription>{paymentNotice}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handlePayment} className="space-y-4">
                    {usesStripeCheckout ? (
                      <>
                        <Alert>
                          <CreditCard className="size-4" />
                          <AlertDescription>
                            Stripe test mode only. Use a Stripe test card such as `4242 4242 4242 4242` on the hosted checkout page.
                          </AlertDescription>
                        </Alert>

                        <div className="rounded-lg border border-dashed border-[oklch(0.82_0.04_145)] bg-[oklch(0.98_0.01_145)] p-4 text-sm text-gray-700">
                          <p className="font-medium text-gray-900">Selected Payment Method</p>
                          <p className="mt-2">
                            {isCommunityCheckout
                              ? 'Stripe Test Checkout for Community Orders'
                              : isRestaurantCheckout
                              ? 'Stripe Test Checkout for Restaurant Orders'
                              : 'Stripe Test Checkout'}
                          </p>
                        </div>

                        <div className="rounded-lg border border-dashed border-[oklch(0.82_0.04_145)] bg-[oklch(0.98_0.01_145)] p-4 text-sm text-gray-700">
                          <p className="font-medium text-gray-900">What happens next</p>
                          <p className="mt-2">
                            Your selected stock is reserved before the Stripe redirect. If payment succeeds, the order is marked paid and the checked cart lines are cleared. If you cancel or Stripe expires the session, the stock is released again.
                          </p>
                          <p className="mt-2">
                            {isRestaurantCheckout && makeRecurring
                              ? 'This payment also activates the recurring supply template you configured in the delivery step.'
                              : isCommunityCheckout
                              ? 'Producer contacts and community delivery notes stay grouped after payment so your receiving team can coordinate clearly.'
                              : 'You will return here automatically after Stripe confirms the test payment.'}
                          </p>
                          {(isCommunityCheckout || isRestaurantCheckout) && (
                            <p className="mt-2">
                              Invoice terms may apply for this {currentAccountTypeLabel}, but the demo payment still uses Stripe test mode and the platform commission remains 5%.
                            </p>
                          )}
                        </div>
                        {(isCommunityCheckout || isRestaurantCheckout) && (
                          <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-950">
                            <p className="font-medium">Institutional payment terms</p>
                            <p className="mt-2">
                              This prototype still captures the order through Stripe test checkout immediately.
                              The order record also stores that invoice terms may apply, so the demo can explain
                              institutional workflows such as purchase orders, monthly billing, or 30-day terms.
                            </p>
                            <div className="mt-3">
                              <Label htmlFor="purchase-order-number">Purchase order number (optional)</Label>
                              <Input
                                id="purchase-order-number"
                                value={purchaseOrderNumber}
                                onChange={(event) => setPurchaseOrderNumber(event.target.value)}
                                placeholder="Example: PO-2026-001"
                                disabled={paymentProcessing}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <Label htmlFor="cardNumber">Card Number</Label>
                          <Input id="cardNumber" placeholder="4242 4242 4242 4242" required disabled={paymentProcessing} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="expiry">Expiry Date</Label>
                            <Input id="expiry" placeholder="MM/YY" required disabled={paymentProcessing} />
                          </div>
                          <div>
                            <Label htmlFor="cvv">CVV</Label>
                            <Input id="cvv" placeholder="123" required disabled={paymentProcessing} />
                          </div>
                        </div>

                        <Alert>
                          <CreditCard className="size-4" />
                          <AlertDescription>Test mode only. Use any valid-looking values.</AlertDescription>
                        </Alert>
                      </>
                    )}

                    <div className="flex gap-3">
                      <Button type="button" variant="outline" onClick={() => setStep('delivery')} disabled={paymentProcessing}>
                        Back
                      </Button>
                      <Button type="submit" className="flex-1" disabled={paymentProcessing || !foodMiles.withinTwentyMiles}>
                        {paymentProcessing
                          ? usesStripeCheckout
                            ? 'Opening Stripe...'
                            : 'Processing...'
                          : usesStripeCheckout
                          ? isCommunityCheckout
                            ? 'Continue to Stripe for Community Payment'
                            : isRestaurantCheckout && makeRecurring
                            ? 'Continue to Stripe and Create Template'
                            : isRestaurantCheckout
                            ? 'Continue to Stripe for Restaurant Payment'
                            : 'Continue to Stripe Checkout'
                          : isRestaurantCheckout && makeRecurring
                          ? `Create Recurring Order (£${total.toFixed(2)})`
                          : `Pay £${total.toFixed(2)}`}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>
                  {isCommunityCheckout
                    ? 'Community Order Summary'
                    : isRestaurantCheckout
                      ? 'Restaurant Order Summary'
                      : 'Order Summary'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {cartByProducer.map((group) => (
                    <div key={group.producerId} className="rounded-lg border border-[oklch(0.88_0.02_145)] bg-[oklch(0.99_0.004_145)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{group.producerName}</p>
                          <p className="text-xs text-gray-600">{group.items.length} item(s)</p>
                        </div>
                        {isMultiProducerCheckout && (
                          <Badge variant="outline">Producer Section</Badge>
                        )}
                      </div>
                      <div className="mt-3 space-y-2">
                        {group.items.map((item) => {
                          const hasSurplusPrice =
                            Boolean(item.product.isSurplus) &&
                            typeof item.product.surplusOriginalPrice === 'number' &&
                            item.product.surplusOriginalPrice > item.product.price;
                          const originalLineTotal = hasSurplusPrice
                            ? (item.product.surplusOriginalPrice || item.product.price) * item.quantity
                            : item.product.price * item.quantity;
                          const saleLineTotal = item.product.price * item.quantity;
                          const discountAmount = Math.max(0, originalLineTotal - saleLineTotal);

                          return (
                            <div key={item.cartItemId || item.product.id} className="rounded-md bg-white/70 px-2 py-1.5 text-xs text-gray-700">
                              <div className="flex justify-between gap-2">
                                <span>
                                  {item.product.name} • {item.quantity} {item.product.unit}
                                </span>
                                <span className="font-medium">£{saleLineTotal.toFixed(2)}</span>
                              </div>
                              {hasSurplusPrice && (
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-amber-800">
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium">Surplus deal</span>
                                  <span className="line-through text-gray-500">Was £{originalLineTotal.toFixed(2)}</span>
                                  <span>Save £{discountAmount.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {deliveryDates[group.producerId] && (
                        <p className="mt-2 text-xs text-gray-600">
                          Delivery: {format(new Date(deliveryDates[group.producerId]), 'MMM d, yyyy')}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-medium">Producer Subtotal: £{group.subtotal.toFixed(2)}</p>
                      <p className="mt-1 text-xs text-gray-600">
                        Platform 5%: £{(group.subtotal * 0.05).toFixed(2)} | Producer payout 95%: £{(group.subtotal * 0.95).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>£{grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Network Commission (5%, included)</span>
                    <span>£{commission.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Producer Payout (95%)</span>
                    <span>£{producerPayout.toFixed(2)}</span>
                  </div>
                  <div className={`flex justify-between ${foodMiles.withinTwentyMiles ? 'text-gray-600' : 'text-red-700'}`}>
                    <span>Food miles</span>
                    <span>{foodMiles.total.toFixed(2)} selected-order miles</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-green-700">£{total.toFixed(2)}</span>
                </div>

                {addressLine1 && (
                  <>
                    <Separator />
                    <div className="text-xs text-gray-600">
                      <p className="font-medium mb-1">Delivering to:</p>
                      {deliveryAddressLabel && <p>{deliveryAddressLabel}</p>}
                      <p>{addressLine1}</p>
                      {addressLine2 && <p>{addressLine2}</p>}
                      <p>{city}, {postcode}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
