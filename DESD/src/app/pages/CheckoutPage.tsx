import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useSafeBack } from '../lib/navigation';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { addDays, format } from 'date-fns';
import { ApiOrderDetail, apiJson } from '../lib/api';

type CheckoutStep = 'address' | 'delivery' | 'payment' | 'confirm';

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
  const goBackToCart = useSafeBack('/cart');
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
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<ApiOrderDetail | null>(null);

  const cartByProducer = getSelectedCartByProducer();
  const grandTotal = getSelectedGrandTotal();
  const commission = grandTotal * 0.05;
  const total = grandTotal + commission;

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

  if ((items.length === 0 || selectedItems.length === 0) && !orderComplete) {
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

    try {
      const fullAddress = [address, city].filter(Boolean).join(', ');

      const payload: Record<string, unknown> = {
        delivery_address: fullAddress,
        customer_postcode: postcode,
        payment_method: 'test_card',
        payment_token: 'tok_demo',
        selected_cart_item_ids: selectedCartItemIds.map((cartItemId) => Number(cartItemId)),
      };

      if (cartByProducer.length === 1) {
        payload.delivery_date = deliveryDates[cartByProducer[0].producerId];
      } else {
        const producerDates: Record<string, string> = {};
        cartByProducer.forEach((group) => {
          producerDates[group.producerId] = deliveryDates[group.producerId];
        });
        payload.producer_delivery_dates = producerDates;
      }

      const response = await apiJson<{ message: string; order: ApiOrderDetail }>('/api/orders/checkout/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCreatedOrder(response.order);
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
        <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-semibold">Checkout</h1>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8">
          <Card className="text-center">
            <CardContent className="py-12">
              <div className="size-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="size-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Order Confirmed!</h2>
              <p className="text-gray-600 mb-6">Your order has been successfully placed in test mode.</p>
              <div className="bg-gray-50 p-4 rounded-lg mb-6 inline-block">
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="text-xl font-semibold">{createdOrder.order_number}</p>
              </div>

              <div className="space-y-4 max-w-md mx-auto text-left">
                <h3 className="font-semibold">Producer Delivery Breakdown</h3>
                {createdOrder.sub_orders.map((subOrder) => (
                  <div key={subOrder.id} className="border-l-4 border-green-500 pl-4">
                    <p className="font-medium">{subOrder.producer.business_name}</p>
                    <p className="text-sm text-gray-600">
                      Delivery: {format(new Date(subOrder.delivery_date), 'MMMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3 justify-center">
                <Button onClick={() => navigate('/orders/history')}>View Order History</Button>
                <Button variant="outline" onClick={() => navigate('/marketplace')}>Continue Shopping</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={goBackToCart}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Cart
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-8">Checkout</h1>

        <StepIndicator />

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {step === 'address' && (
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Address</CardTitle>
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
                  <CardTitle>Delivery Dates</CardTitle>
                  <p className="text-sm text-gray-600">Each producer can have a different delivery date.</p>
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
                  <CardTitle>Payment Information</CardTitle>
                  <p className="text-sm text-gray-600">Sandbox payment. No real payment will be processed.</p>
                </CardHeader>
                <CardContent>
                  {paymentError && (
                    <Alert variant="destructive" className="mb-4">
                      <XCircle className="size-4" />
                      <AlertDescription>{paymentError}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handlePayment} className="space-y-4">
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

                    <div className="flex gap-3">
                      <Button type="button" variant="outline" onClick={() => setStep('delivery')} disabled={paymentProcessing}>
                        Back
                      </Button>
                      <Button type="submit" className="flex-1" disabled={paymentProcessing}>
                        {paymentProcessing ? 'Processing...' : `Pay £${total.toFixed(2)}`}
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
                    <div key={group.producerId} className="border-l-4 border-green-500 pl-3">
                      <p className="font-medium text-sm">{group.producerName}</p>
                      <p className="text-xs text-gray-600">{group.items.length} item(s)</p>
                      {deliveryDates[group.producerId] && (
                        <p className="text-xs text-gray-600">
                          Delivery: {format(new Date(deliveryDates[group.producerId]), 'MMM d')}
                        </p>
                      )}
                      <p className="text-sm font-medium">£{group.subtotal.toFixed(2)}</p>
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
                    <span>Commission (5%)</span>
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
