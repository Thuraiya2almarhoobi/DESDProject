import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { useSafeBack } from '../lib/navigation';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { cn } from '../components/ui/utils';

export function CartPage() {
  const navigate = useNavigate();
  const goBack = useSafeBack('/marketplace');
  const {
    items,
    selectedCartItemIds,
    updateQuantity,
    removeFromCart,
    getCartByProducer,
    getSelectedCartByProducer,
    getGrandTotal,
    getSelectedGrandTotal,
    isCartItemSelected,
    setCartItemSelection,
    selectAllCartItems,
    clearCartSelection,
  } = useCart();
  const { user } = useAuth();
  const [producerFoodMiles, setProducerFoodMiles] = useState<Record<string, number>>({});
  const [productFoodMiles, setProductFoodMiles] = useState<Record<string, number>>({});

  const cartByProducer = getCartByProducer();
  const selectedCartByProducer = getSelectedCartByProducer();
  const grandTotal = getGrandTotal();
  const selectedGrandTotal = getSelectedGrandTotal();
  const commission = selectedGrandTotal * 0.05;
  const isBulkRole = user?.role === 'COMMUNITY' || user?.role === 'RESTAURANT';
  const selectedLineCount = selectedCartItemIds.length;
  const totalLineCount = items.length;
  const allCartItemIds = items
    .map((item) => item.cartItemId)
    .filter((cartItemId): cartItemId is string => Boolean(cartItemId));
  const allSelected = totalLineCount > 0 && selectedLineCount === allCartItemIds.length;

  useEffect(() => {
    let mounted = true;

    const loadFoodMiles = async () => {
      if (items.length === 0) {
        setProducerFoodMiles({});
        setProductFoodMiles({});
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

  const selectedFoodMiles = useMemo(
    () =>
      selectedCartByProducer.reduce(
        (total, group) =>
          total +
          group.items.reduce(
            (groupTotal, item) => groupTotal + (productFoodMiles[item.product.id] ?? 0),
            0,
          ),
        0,
      ),
    [productFoodMiles, selectedCartByProducer],
  );
  const savedForLaterTotal = useMemo(
    () => Math.max(0, grandTotal - selectedGrandTotal),
    [grandTotal, selectedGrandTotal],
  );
  const totalWithCommission = useMemo(
    () => selectedGrandTotal + commission,
    [selectedGrandTotal, commission],
  );

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-4">
            <Button variant="ghost" onClick={goBack}>
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
              <Button onClick={goBack}>
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
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
        </div>
      </header>

      {/* Cart Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 space-y-4">
          <div>
            <h1 className="text-3xl font-semibold">
              {user?.role === 'COMMUNITY'
                ? 'Community Bulk Cart'
                : user?.role === 'RESTAURANT'
                ? 'Restaurant Order Cart'
                : 'Shopping Cart'}
            </h1>
            {isBulkRole ? (
              <p className="mt-1 text-sm text-gray-600">
                Bulk mode enabled: you can type quantities directly or use +/- quick controls.
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-600">
                Tick the items you want to buy now. Unticked items stay in your cart.
              </p>
            )}
          </div>

          <Card className="border-[oklch(0.86_0.05_150)] bg-white/90 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[oklch(0.45_0.12_155)]">
                  <CheckCircle2 className="size-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">Checkout Picker</span>
                </div>
                <div>
                  <p className="text-lg font-semibold">Choose what to buy today</p>
                  <p className="text-sm text-gray-600">
                    {selectedLineCount} of {totalLineCount} cart line{totalLineCount === 1 ? '' : 's'} selected for checkout.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={allSelected ? 'default' : 'outline'}
                  onClick={selectAllCartItems}
                  disabled={allSelected}
                >
                  Select all
                </Button>
                <Button
                  variant='outline'
                  onClick={clearCartSelection}
                  disabled={selectedLineCount === 0}
                >
                  Clear selection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Cart Items - Grouped by Producer (TC-006/007) */}
          <div className="lg:col-span-2 space-y-6">
            {cartByProducer.map((group) => {
              const groupCartItemIds = group.items
                .map((item) => item.cartItemId)
                .filter((cartItemId): cartItemId is string => Boolean(cartItemId));
              const selectedGroupCount = groupCartItemIds.filter((cartItemId) => isCartItemSelected(cartItemId)).length;
              const selectedGroupSubtotal = group.items.reduce((sum, item) => {
                if (!item.cartItemId || !isCartItemSelected(item.cartItemId)) {
                  return sum;
                }
                return sum + item.product.price * item.quantity;
              }, 0);

              return (
              <Card key={group.producerId} className="overflow-hidden">
                <CardHeader className="border-b bg-[linear-gradient(135deg,rgba(245,250,246,0.95),rgba(255,255,255,0.95))]">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={
                        selectedGroupCount === 0
                          ? false
                          : selectedGroupCount === groupCartItemIds.length
                            ? true
                            : 'indeterminate'
                      }
                      onCheckedChange={(checked) => setCartItemSelection(groupCartItemIds, checked === true)}
                      aria-label={`Select items from ${group.producerName}`}
                      className="mt-1 size-5 rounded-md"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <CardTitle className="text-lg">{group.producerName}</CardTitle>
                        <Badge variant={selectedGroupCount === group.items.length ? 'default' : 'secondary'}>
                          {selectedGroupCount}/{group.items.length} selected
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        Delivery lead time: {group.deliveryLeadTime} hours minimum
                      </p>
                      {producerFoodMiles[group.producerId] !== undefined && (
                        <p className="text-xs text-gray-500">
                          Approx. distance: {producerFoodMiles[group.producerId].toFixed(2)} miles
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {group.items.map((item) => {
                      const isSelected = item.cartItemId ? isCartItemSelected(item.cartItemId) : false;
                      return (
                      <div
                        key={item.cartItemId || item.product.id}
                        className={cn(
                          'p-4 transition-colors',
                          isSelected ? 'bg-[oklch(0.985_0.01_145)]' : 'bg-white/70',
                        )}
                      >
                        <div className="flex gap-4">
                          <div className="pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                item.cartItemId ? setCartItemSelection([item.cartItemId], checked === true) : undefined
                              }
                              aria-label={`Select ${item.product.name} for checkout`}
                              className="size-5 rounded-md"
                            />
                          </div>
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="size-20 rounded object-cover flex-shrink-0"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                            <h3 className="font-medium">{item.product.name}</h3>
                            <Badge variant={isSelected ? 'default' : 'outline'} className="shrink-0">
                              {isSelected ? 'Ready to buy' : 'Saved in cart'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            Â£{item.product.price.toFixed(2)} per {item.product.unit}
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
                            Â£{(item.product.price * item.quantity).toFixed(2)}
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
                      </div>
                    );
                    })}
                  </div>
                  
                  {/* Producer Subtotal */}
                  <div className="p-4 bg-gray-50 border-t">
                    {selectedGroupCount === group.items.length ? (
                      <div className="flex justify-between font-medium">
                        <span>{group.producerName} Subtotal:</span>
                        <span>Â£{group.subtotal.toFixed(2)}</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>Selected from {group.producerName}:</span>
                          <span>Â£{selectedGroupSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Full producer cart total:</span>
                          <span>Â£{group.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Per-Producer Breakdown */}
                {selectedCartByProducer.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCartByProducer.map((group) => (
                      <div key={group.producerId} className="flex justify-between text-sm">
                        <span className="text-gray-600">{group.producerName}</span>
                        <span>Â£{group.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[oklch(0.86_0.05_150)] bg-[oklch(0.985_0.01_145)] p-4 text-sm text-gray-600">
                    Tick one or more items to enable checkout.
                  </div>
                )}

                <Separator />

                {/* Subtotal */}
                <div className="flex justify-between">
                  <span>Selected Subtotal</span>
                  <span>Â£{selectedGrandTotal.toFixed(2)}</span>
                </div>

                {/* Commission (TC-008) */}
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Platform Commission (5%)</span>
                  <span>Â£{commission.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Food Miles</span>
                  <span>{selectedFoodMiles.toFixed(2)} miles â€¢ Go Green</span>
                </div>

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Saved for Later</span>
                  <span>Â£{savedForLaterTotal.toFixed(2)}</span>
                </div>

                <Separator />

                {/* Total */}
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-green-700">Â£{totalWithCommission.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate('/checkout')}
                  disabled={selectedLineCount === 0}
                >
                  Checkout Selected Items
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={goBack}
                >
                  Continue Shopping
                </Button>

                {/* Delivery Note */}
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                  <p className="font-medium mb-1">Delivery Information</p>
                  <p>Only ticked items will be processed. Unticked items stay in your cart for later.</p>
                  <p className="mt-1">Orders are delivered directly by each producer with a minimum 48-hour lead time.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
