import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';

export function CartPage() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, getCartByProducer, getGrandTotal } = useCart();
  const { user } = useAuth();
  const [totalFoodMiles, setTotalFoodMiles] = useState(0);
  const [producerFoodMiles, setProducerFoodMiles] = useState<Record<string, number>>({});
  const [productFoodMiles, setProductFoodMiles] = useState<Record<string, number>>({});

  const cartByProducer = getCartByProducer();
  const grandTotal = getGrandTotal();
  const commission = grandTotal * 0.05;
  const isBulkRole = user?.role === 'COMMUNITY' || user?.role === 'RESTAURANT';

  useEffect(() => {
    let mounted = true;

    const loadFoodMiles = async () => {
      if (items.length === 0) {
        setTotalFoodMiles(0);
        setProducerFoodMiles({});
        return;
      }

      try {
        const payload = await apiJson<{
          total_food_miles: string;
          producer_totals: Array<{ producer_id: number; distance_miles: string }>;
          items: Array<{ product_id: number; distance_miles: string }>;
        }>('/api/geo/food-miles/cart/');

        if (!mounted) {
          return;
        }

        setTotalFoodMiles(Number(payload.total_food_miles || 0));
        const byProducer: Record<string, number> = {};
        payload.producer_totals.forEach((row) => {
          byProducer[String(row.producer_id)] = Number(row.distance_miles || 0);
        });
        setProducerFoodMiles(byProducer);

        const byProduct: Record<string, number> = {};
        payload.items.forEach((row) => {
          byProduct[String(row.product_id)] = Number(row.distance_miles || 0);
        });
        setProductFoodMiles(byProduct);
      } catch {
        if (mounted) {
          setTotalFoodMiles(0);
          setProducerFoodMiles({});
          setProductFoodMiles({});
        }
      }
    };

    void loadFoodMiles();

    return () => {
      mounted = false;
    };
  }, [items]);

  const totalWithCommission = useMemo(() => grandTotal + commission, [grandTotal, commission]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={() => navigate('/marketplace')}>
              <ArrowLeft className="size-4 mr-2" />
              Back to Marketplace
            </Button>
          </div>
        </header>
        
        <div className="max-w-5xl mx-auto px-4 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="size-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">Start adding some local products!</p>
              <Button onClick={() => navigate('/marketplace')}>
                Browse Marketplace
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </header>

      {/* Cart Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold mb-3">
          {user?.role === 'COMMUNITY'
            ? 'Community Bulk Cart'
            : user?.role === 'RESTAURANT'
            ? 'Restaurant Order Cart'
            : 'Shopping Cart'}
        </h1>
        {isBulkRole && (
          <p className="text-sm text-gray-600 mb-8">
            Bulk mode enabled: you can type quantities directly or use +/- quick controls.
          </p>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items - Grouped by Producer (TC-006/007) */}
          <div className="lg:col-span-2 space-y-6">
            {cartByProducer.map(group => (
              <Card key={group.producerId}>
                <CardHeader className="bg-gray-50">
                  <CardTitle className="text-lg">
                    {group.producerName}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Delivery lead time: {group.deliveryLeadTime} hours minimum
                  </p>
                  {producerFoodMiles[group.producerId] !== undefined && (
                    <p className="text-xs text-gray-500">
                      Approx. distance: {producerFoodMiles[group.producerId].toFixed(2)} miles
                    </p>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {group.items.map(item => (
                      <div key={item.product.id} className="p-4 flex gap-4">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="size-20 rounded object-cover flex-shrink-0"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium mb-1">{item.product.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">
                            £{item.product.price.toFixed(2)} per {item.product.unit}
                          </p>
                          {productFoodMiles[item.product.id] !== undefined && (
                            <p className="text-xs text-gray-500 mb-2">
                              Food miles: {productFoodMiles[item.product.id].toFixed(2)} miles
                            </p>
                          )}
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            >
                              <Minus className="size-3" />
                            </Button>
                            {isBulkRole ? (
                              <Input
                                type="number"
                                min="1"
                                max={item.product.stock}
                                step="1"
                                className="w-20 h-8 text-center"
                                value={item.quantity}
                                onChange={(event) => {
                                  const next = Number(event.target.value);
                                  if (!Number.isFinite(next)) {
                                    return;
                                  }
                                  updateQuantity(item.product.id, next);
                                }}
                              />
                            ) : (
                              <span className="w-12 text-center text-sm">
                                {item.quantity}
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8"
                              onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                              disabled={item.quantity >= item.product.stock}
                            >
                              <Plus className="size-3" />
                            </Button>
                            {isBulkRole && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 10))}
                                >
                                  -10
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    updateQuantity(item.product.id, Math.min(item.product.stock, item.quantity + 10))
                                  }
                                >
                                  +10
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end justify-between">
                          <p className="font-semibold">
                            £{(item.product.price * item.quantity).toFixed(2)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.product.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Producer Subtotal */}
                  <div className="p-4 bg-gray-50 border-t">
                    <div className="flex justify-between font-medium">
                      <span>{group.producerName} Subtotal:</span>
                      <span>£{group.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Per-Producer Breakdown */}
                <div className="space-y-2">
                  {cartByProducer.map(group => (
                    <div key={group.producerId} className="flex justify-between text-sm">
                      <span className="text-gray-600">{group.producerName}</span>
                      <span>£{group.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Subtotal */}
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>£{grandTotal.toFixed(2)}</span>
                </div>

                {/* Commission (TC-008) */}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Platform Commission (5%)</span>
                  <span>£{commission.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Food Miles</span>
                  <span>{totalFoodMiles.toFixed(2)} miles • Go Green</span>
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-green-700">£{totalWithCommission.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate('/checkout')}
                >
                  Proceed to Checkout
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/marketplace')}
                >
                  Continue Shopping
                </Button>

                {/* Delivery Note */}
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                  <p className="font-medium mb-1">Delivery Information</p>
                  <p>Orders are delivered directly by each producer with a minimum 48-hour lead time.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
