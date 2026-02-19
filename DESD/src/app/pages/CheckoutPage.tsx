import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, CreditCard, CheckCircle, XCircle } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { addDays, format } from 'date-fns';

type CheckoutStep = 'address' | 'delivery' | 'payment' | 'confirm';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, getCartByProducer, getGrandTotal, clearCart } = useCart();

  const [step, setStep] = useState<CheckoutStep>('address');
  const [address, setAddress] = useState('123 Main Street');
  const [city, setCity] = useState('London');
  const [postcode, setPostcode] = useState('SW1A 1AA');
  
  const [deliveryDates, setDeliveryDates] = useState<Record<string, string>>({});
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');

  const cartByProducer = getCartByProducer();
  const grandTotal = getGrandTotal();
  const commission = grandTotal * 0.05;
  const total = grandTotal + commission;

  if (items.length === 0 && !orderComplete) {
    navigate('/cart');
    return null;
  }

  // Initialize delivery dates with minimum lead times
  if (Object.keys(deliveryDates).length === 0 && cartByProducer.length > 0) {
    const dates: Record<string, string> = {};
    cartByProducer.forEach(group => {
      const minDate = addDays(new Date(), Math.ceil(group.deliveryLeadTime / 24));
      dates[group.producerId] = format(minDate, 'yyyy-MM-dd');
    });
    setDeliveryDates(dates);
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

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate random payment success/failure for demo
    const success = Math.random() > 0.3; // 70% success rate

    if (success) {
      const newOrderId = `ORD-${Date.now().toString().slice(-8)}`;
      setOrderId(newOrderId);
      setOrderComplete(true);
      clearCart();
      setStep('confirm');
    } else {
      setPaymentError('Payment failed. Please check your card details and try again. Your order was not created.');
    }

    setPaymentProcessing(false);
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

  if (orderComplete) {
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
              <p className="text-gray-600 mb-6">
                Your order has been successfully placed.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-6 inline-block">
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="text-xl font-semibold">{orderId}</p>
              </div>
              
              <div className="space-y-4 max-w-md mx-auto text-left">
                <h3 className="font-semibold">Delivery Schedule</h3>
                {cartByProducer.map(group => (
                  <div key={group.producerId} className="border-l-4 border-green-500 pl-4">
                    <p className="font-medium">{group.producerName}</p>
                    <p className="text-sm text-gray-600">
                      Delivery: {format(new Date(deliveryDates[group.producerId]), 'MMMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3 justify-center">
                <Button onClick={() => navigate('/marketplace')}>
                  Continue Shopping
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/cart')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Cart
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-8">Checkout</h1>

        <StepIndicator />

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Checkout Form */}
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
                      <Input
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="postcode">Postcode</Label>
                        <Input
                          id="postcode"
                          value={postcode}
                          onChange={(e) => setPostcode(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">
                      Continue to Delivery
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 'delivery' && (
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Dates</CardTitle>
                  <p className="text-sm text-gray-600">
                    Each producer has their own delivery schedule
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleDeliverySubmit} className="space-y-6">
                    {cartByProducer.map(group => {
                      const minDate = addDays(new Date(), Math.ceil(group.deliveryLeadTime / 24));
                      return (
                        <div key={group.producerId} className="border p-4 rounded-lg">
                          <h4 className="font-medium mb-2">{group.producerName}</h4>
                          <p className="text-sm text-gray-600 mb-3">
                            Minimum {group.deliveryLeadTime} hours lead time
                          </p>
                          <Label htmlFor={`date-${group.producerId}`}>Delivery Date</Label>
                          <Input
                            id={`date-${group.producerId}`}
                            type="date"
                            min={format(minDate, 'yyyy-MM-dd')}
                            value={deliveryDates[group.producerId] || ''}
                            onChange={(e) =>
                              setDeliveryDates(prev => ({
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
                      <Button type="button" variant="outline" onClick={() => setStep('address')}>
                        Back
                      </Button>
                      <Button type="submit" className="flex-1">
                        Continue to Payment
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 'payment' && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Information</CardTitle>
                  <p className="text-sm text-gray-600">
                    Sandbox payment - use any card details
                  </p>
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
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        required
                        disabled={paymentProcessing}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expiry">Expiry Date</Label>
                        <Input
                          id="expiry"
                          placeholder="MM/YY"
                          required
                          disabled={paymentProcessing}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cvv">CVV</Label>
                        <Input
                          id="cvv"
                          placeholder="123"
                          required
                          disabled={paymentProcessing}
                        />
                      </div>
                    </div>

                    <Alert>
                      <CreditCard className="size-4" />
                      <AlertDescription>
                        This is a sandbox payment. No real charges will be made.
                      </AlertDescription>
                    </Alert>

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep('delivery')}
                        disabled={paymentProcessing}
                      >
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

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Per-Producer Sections (TC-008) */}
                <div className="space-y-3">
                  {cartByProducer.map(group => (
                    <div key={group.producerId} className="border-l-4 border-green-500 pl-3">
                      <p className="font-medium text-sm">{group.producerName}</p>
                      <p className="text-xs text-gray-600">
                        {group.items.length} item(s)
                      </p>
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