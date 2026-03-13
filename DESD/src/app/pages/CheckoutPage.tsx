import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowLeft, CreditCard, CheckCircle, LoaderCircle, XCircle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useSafeBack } from '../lib/navigation';
import { SiteHeader } from '../components/SiteHeader';
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

const PENDING_STRIPE_ORDER_STORAGE_KEY = 'desd_pending_stripe_order_id';

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

export function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const goBackToCart = useSafeBack('/cart');
  const { user } = useAuth();
  const {
    items,
    selectedItems,
    selectedCartItemIds,
    getSelectedCartByProducer,
    getSelectedGrandTotal,
    refreshCart,
  } = useCart();

  const [step, setStep] = useState<CheckoutStep>('address');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [deliveryDates, setDeliveryDates] = useState<Record<string, string>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'fortnightly'>('weekly');
  const [orderDay, setOrderDay] = useState(0);
  const [deliveryDay, setDeliveryDay] = useState(2);
  const [createdRecurringTemplateId, setCreatedRecurringTemplateId] = useState<number | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentNotice, setPaymentNotice] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ApiOrderDetail | null>(null);

  const cartByProducer = getSelectedCartByProducer();
  const grandTotal = getSelectedGrandTotal();
  const commission = grandTotal * 0.05;
  const total = grandTotal + commission;
  const isCustomerCheckout = user?.role === 'CUSTOMER';
  const isCommunityCheckout = user?.role === 'COMMUNITY';
  const isRestaurantCheckout = user?.role === 'RESTAURANT';
  const isMultiProducerCheckout = cartByProducer.length > 1;
  const isStripeSuccessReturn = location.pathname === '/checkout/success';
  const isStripeCancelReturn = location.pathname === '/checkout/cancel';
  const isStripeReturnPath = isStripeSuccessReturn || isStripeCancelReturn;
  const weekdayOptions = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const backToCartButton = (
    <Button variant="ghost" onClick={goBackToCart}>
      <ArrowLeft className="mr-2 size-4" />
      Back to Cart
    </Button>
  );

  useEffect(() => {
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

        const fullAddress = profile.delivery_address || '';
        if (fullAddress.includes(',')) {
          const parts = fullAddress.split(',').map((part) => part.trim()).filter(Boolean);
          setAddress(parts[0] || '');
          setCity(parts.slice(1).join(', '));
        } else {
          setAddress(fullAddress);
        }
        setPostcode(profile.postcode || '');
      } catch {
        if (mounted) {
          setAddress('');
          setCity('');
          setPostcode('');
        }
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (cartByProducer.length === 0) {
      return;
    }

    setDeliveryDates((previous) => {
      const next: Record<string, string> = { ...previous };
      cartByProducer.forEach((group) => {
        next[group.producerId] = dateOrDefault(previous[group.producerId], group.deliveryLeadTime);
      });
      return next;
    });
  }, [cartByProducer]);

  useEffect(() => {
    if (!isCustomerCheckout || !isStripeReturnPath) {
      return;
    }

    let mounted = true;
    const query = new URLSearchParams(location.search);

    const handleStripeReturn = async () => {
      setStep('payment');
      setPaymentProcessing(true);
      setPaymentError('');
      setPaymentNotice('');

      try {
        if (isStripeSuccessReturn) {
          const sessionId = query.get('session_id');
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
            setOrderComplete(true);
            setStep('confirm');
            setPaymentNotice('');
            if (typeof window !== 'undefined') {
              window.sessionStorage.removeItem(PENDING_STRIPE_ORDER_STORAGE_KEY);
            }
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

        const pendingOrderId =
          typeof window !== 'undefined'
            ? window.sessionStorage.getItem(PENDING_STRIPE_ORDER_STORAGE_KEY)
            : null;

        if (pendingOrderId) {
          await apiJson<{ cancelled: boolean; order: ApiOrderDetail }>(
            '/api/payments/stripe/checkout-session/cancel/',
            {
              method: 'POST',
              body: JSON.stringify({ order_id: Number(pendingOrderId) }),
            },
          );
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(PENDING_STRIPE_ORDER_STORAGE_KEY);
          }
          await refreshCart();
        }

        if (!mounted) {
          return;
        }

        setPaymentError('Stripe checkout was cancelled. Your reserved stock has been returned to the cart flow.');
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
    isCustomerCheckout,
    isStripeCancelReturn,
    isStripeReturnPath,
    isStripeSuccessReturn,
    location.search,
    navigate,
    refreshCart,
  ]);

  if ((items.length === 0 || selectedItems.length === 0) && !orderComplete && !isStripeReturnPath) {
    navigate('/cart');
    return null;
  }

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
      const fullAddress = [address, city].filter(Boolean).join(', ');

      const payload: Record<string, unknown> = {
        delivery_address: fullAddress,
        customer_postcode: postcode,
        payment_method: isCustomerCheckout ? 'stripe_checkout' : 'test_card',
        payment_token: isCustomerCheckout ? '' : 'tok_demo',
        selected_cart_item_ids: selectedCartItemIds.map((cartItemId) => Number(cartItemId)),
      };
      if (specialInstructions.trim()) {
        payload.special_instructions = specialInstructions.trim();
      }

      if (cartByProducer.length === 1) {
        payload.delivery_date = deliveryDates[cartByProducer[0].producerId];
      } else {
        const producerDates: Record<string, string> = {};
        cartByProducer.forEach((group) => {
          producerDates[group.producerId] = deliveryDates[group.producerId];
        });
        payload.producer_delivery_dates = producerDates;
      }

      if (isRestaurantCheckout && makeRecurring) {
        payload.frequency = recurringFrequency;
        payload.order_day = orderDay;
        payload.delivery_day = deliveryDay;

        const response = await apiJson<{
          message: string;
          template: { id: number };
          initial_order: ApiOrderDetail;
        }>('/api/restaurant/recurring-orders/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setCreatedOrder(response.initial_order);
        setCreatedRecurringTemplateId(response.template.id);
      } else if (isCommunityCheckout) {
        const response = await apiJson<{ message: string; order: ApiOrderDetail }>('/api/community/bulk-checkout/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setCreatedOrder(response.order);
        setCreatedRecurringTemplateId(null);
      } else if (isCustomerCheckout) {
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
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(PENDING_STRIPE_ORDER_STORAGE_KEY, String(response.order.id));
          window.location.assign(response.payment.checkout_url);
        }
        return;
      } else {
        const response = await apiJson<{ message: string; order: ApiOrderDetail }>('/api/orders/checkout/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setCreatedOrder(response.order);
        setCreatedRecurringTemplateId(null);
      }

      setOrderComplete(true);
      setStep('confirm');
      await refreshCart();
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Payment failed. Please try again.');
    } finally {
      setPaymentProcessing(false);
    }
  };

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
                {isCustomerCheckout
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

        <StepIndicator />

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === 'address' && (
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Address</CardTitle>
                  <p className="text-sm text-gray-600">
                    Your saved delivery address is pre-filled here and can be edited before checkout.
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddressSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="address">Street Address</Label>
                      <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required />
                      </div>
                      <div>
                        <Label htmlFor="postcode">Postcode</Label>
                        <Input id="postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} required />
                      </div>
                    </div>
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
                    {isCustomerCheckout
                      ? 'Choose the Stripe test payment method. You will be redirected to Stripe to finish payment.'
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
                    {isCustomerCheckout ? (
                      <>
                        <Alert>
                          <CreditCard className="size-4" />
                          <AlertDescription>
                            Stripe test mode only. Use a Stripe test card such as `4242 4242 4242 4242` on the hosted checkout page.
                          </AlertDescription>
                        </Alert>

                        <div className="rounded-lg border border-dashed border-[oklch(0.82_0.04_145)] bg-[oklch(0.98_0.01_145)] p-4 text-sm text-gray-700">
                          <p className="font-medium text-gray-900">Selected Payment Method</p>
                          <p className="mt-2">Stripe Test Card</p>
                        </div>

                        <div className="rounded-lg border border-dashed border-[oklch(0.82_0.04_145)] bg-[oklch(0.98_0.01_145)] p-4 text-sm text-gray-700">
                          <p className="font-medium text-gray-900">What happens next</p>
                          <p className="mt-2">
                            Your selected stock is reserved before the Stripe redirect. If payment succeeds, the order is marked paid and the cart lines are cleared. If you cancel or Stripe expires the session, the stock is released again.
                          </p>
                        </div>
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
                      <Button type="submit" className="flex-1" disabled={paymentProcessing}>
                        {paymentProcessing
                          ? isCustomerCheckout
                            ? 'Opening Stripe...'
                            : 'Processing...'
                          : isCustomerCheckout
                          ? 'Continue to Stripe Checkout'
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
                <CardTitle>Order Summary</CardTitle>
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
                        {group.items.map((item) => (
                          <div key={item.cartItemId || item.product.id} className="flex justify-between gap-2 text-xs text-gray-700">
                            <span>
                              {item.product.name} • {item.quantity} {item.product.unit}
                            </span>
                            <span>£{(item.product.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      {deliveryDates[group.producerId] && (
                        <p className="mt-2 text-xs text-gray-600">
                          Delivery: {format(new Date(deliveryDates[group.producerId]), 'MMM d, yyyy')}
                        </p>
                      )}
                      <p className="mt-2 text-sm font-medium">Producer Subtotal: £{group.subtotal.toFixed(2)}</p>
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
                    <span>Network Commission (5%)</span>
                    <span>£{commission.toFixed(2)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-green-700">£{total.toFixed(2)}</span>
                </div>

                {address && (
                  <>
                    <Separator />
                    <div className="text-xs text-gray-600">
                      <p className="font-medium mb-1">Delivering to:</p>
                      <p>{address}</p>
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
