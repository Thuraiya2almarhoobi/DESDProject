import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { apiJson } from '../lib/api';
import { MAX_ORDER_ITEM_QUANTITY } from '../lib/ordering';
import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { cn } from '../components/ui/utils';

export function CartPage() {
  const navigate = useNavigate();
  const goToMarketplace = () => navigate('/marketplace');
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
  const totalWithCommission = selectedGrandTotal + commission;
  const notSelectedTodayTotal = Math.max(0, grandTotal - selectedGrandTotal);
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

  const backToMarketplaceButton = (
    <Button variant="ghost" onClick={goToMarketplace}>
      <ArrowLeft className="mr-2 size-4" />
      Back to Marketplace
    </Button>
  );

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
        <SiteHeader showNavigation={false} />

        <main className="mx-auto max-w-5xl px-4 py-12">
          <div className="mb-6">{backToMarketplaceButton}</div>
          <Card>
            <CardContent className="py-12 text-center">
              <ShoppingBag className="mx-auto mb-4 size-12 text-muted-foreground" />
              <h2 className="mb-2 text-xl font-semibold">Your shopping cart is empty</h2>
              <p className="mb-6 text-muted-foreground">
                Start adding local products to build your next order.
              </p>
              <Button onClick={goToMarketplace}>Browse Marketplace</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader showNavigation={false} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6">{backToMarketplaceButton}</div>

        <div className="mb-8 space-y-4">
          <div>
            <h1 className="text-3xl font-semibold">
              {user?.role === 'COMMUNITY'
                ? 'Community Bulk Cart'
                : user?.role === 'RESTAURANT'
                  ? 'Restaurant Order Cart'
                  : user?.role === 'PRODUCER'
                    ? 'Producer Shopping Cart'
                  : 'Shopping Cart'}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {user?.role === 'PRODUCER'
                ? 'Buy from other local producers with the same account you use to manage your stall.'
                : 'Add products, update quantities, remove items, and review producer groups before checkout.'}
            </p>
          </div>

          {isBulkRole && (
            <Card className="border-[oklch(0.84_0.05_145)] bg-[linear-gradient(135deg,rgba(243,249,244,0.96),rgba(255,255,255,0.94))] shadow-sm">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.42_0.07_145)]">
                    {user?.role === 'COMMUNITY' ? 'Community Portal' : 'Restaurant Portal'}
                  </p>
                  <h2 className="text-xl font-semibold text-[oklch(0.24_0.03_145)]">
                    {user?.role === 'COMMUNITY'
                      ? 'Coordinate one bulk order across multiple producers'
                      : 'Shape one organised kitchen order before checkout'}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {user?.role === 'COMMUNITY'
                      ? 'Select the supplier lines you want to confirm today and keep the rest saved for the next bulk cycle.'
                      : 'Review each producer section, adjust larger quantities quickly, and move only the selected lines into checkout.'}
                  </p>
                </div>
                <div className="grid gap-2 rounded-2xl border border-white/80 bg-white/80 p-4 text-sm text-gray-700 lg:min-w-[17rem]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Per-product cap</span>
                    <Badge variant="secondary">{MAX_ORDER_ITEM_QUANTITY} units</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Producer groups</span>
                    <span>{cartByProducer.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium">Selected today</span>
                    <span>{selectedLineCount} lines</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-[oklch(0.86_0.05_150)] bg-white/90 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[oklch(0.45_0.12_155)]">
                  <CheckCircle2 className="size-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Cart Selection
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold">Choose the cart lines to order today</p>
                  <p className="text-sm text-gray-600">
                    {selectedLineCount} of {totalLineCount} cart line
                    {totalLineCount === 1 ? '' : 's'} selected for checkout.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={allSelected ? 'default' : 'outline'}
                  onClick={selectAllCartItems}
                  disabled={allSelected}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  onClick={clearCartSelection}
                  disabled={selectedLineCount === 0}
                >
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {cartByProducer.map((group) => {
              const groupCartItemIds = group.items
                .map((item) => item.cartItemId)
                .filter((cartItemId): cartItemId is string => Boolean(cartItemId));
              const selectedGroupCount = groupCartItemIds.filter((cartItemId) =>
                isCartItemSelected(cartItemId),
              ).length;
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
                        onCheckedChange={(checked) =>
                          setCartItemSelection(groupCartItemIds, checked === true)
                        }
                        aria-label={`Select items from ${group.producerName}`}
                        className="mt-1 size-5 rounded-md"
                      />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <CardTitle className="text-lg">{group.producerName}</CardTitle>
                          <Badge
                            variant={
                              selectedGroupCount === group.items.length ? 'default' : 'secondary'
                            }
                          >
                            {selectedGroupCount}/{group.items.length} selected
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          Delivery lead time: {group.deliveryLeadTime} hours minimum
                        </p>
                        {producerFoodMiles[group.producerId] !== undefined && (
                          <p className="text-xs text-gray-500">
                            Food miles from producer:{' '}
                            {producerFoodMiles[group.producerId].toFixed(2)} miles
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-0">
                    <div className="divide-y">
                      {group.items.map((item) => {
                        const isSelected = item.cartItemId
                          ? isCartItemSelected(item.cartItemId)
                          : false;
                        const maxQuantity = Math.max(
                          1,
                          Math.min(MAX_ORDER_ITEM_QUANTITY, Math.floor(item.product.stock)),
                        );

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
                                    item.cartItemId
                                      ? setCartItemSelection([item.cartItemId], checked === true)
                                      : undefined
                                  }
                                  aria-label={`Select ${item.product.name} for checkout`}
                                  className="size-5 rounded-md"
                                />
                              </div>

                              <img
                                src={item.product.imageUrl}
                                alt={item.product.name}
                                className="size-20 shrink-0 rounded object-cover"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                                  <h3 className="font-medium">{item.product.name}</h3>
                                  <Badge variant={isSelected ? 'default' : 'outline'} className="shrink-0">
                                    {isSelected ? 'Selected for checkout' : 'Saved in cart'}
                                  </Badge>
                                </div>
                                <p className="mb-2 text-sm text-gray-600">
                                  £{item.product.price.toFixed(2)} per {item.product.unit}
                                </p>
                                {productFoodMiles[item.product.id] !== undefined && (
                                  <p className="mb-2 text-xs text-gray-500">
                                    Food miles: {productFoodMiles[item.product.id].toFixed(2)} miles
                                    {' '}• Go Green
                                  </p>
                                )}

                                {isBulkRole && (
                                  <p className="mb-2 text-xs text-gray-500">
                                    Bulk cap: up to {MAX_ORDER_ITEM_QUANTITY} units per product.
                                  </p>
                                )}

                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                  >
                                    <Minus className="size-3" />
                                  </Button>
                                  <Input
                                    type="number"
                                    min="1"
                                    max={String(maxQuantity)}
                                    step="1"
                                    className="h-8 w-20 text-center"
                                    value={item.quantity}
                                    onFocus={(event) => event.target.select()}
                                    onChange={(event) => {
                                      const next = Number(event.target.value);
                                      if (!Number.isFinite(next)) {
                                        return;
                                      }
                                      updateQuantity(
                                        item.product.id,
                                        Math.max(1, Math.min(maxQuantity, Math.floor(next))),
                                      );
                                    }}
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="size-8"
                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                    disabled={item.quantity >= maxQuantity}
                                  >
                                    <Plus className="size-3" />
                                  </Button>
                                  {isBulkRole && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          updateQuantity(item.product.id, Math.max(1, item.quantity - 10))
                                        }
                                      >
                                        -10
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          updateQuantity(
                                            item.product.id,
                                            Math.min(maxQuantity, item.quantity + 10),
                                          )
                                        }
                                      >
                                        +10
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          updateQuantity(
                                            item.product.id,
                                            Math.min(maxQuantity, item.quantity + 25),
                                          )
                                        }
                                      >
                                        +25
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
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t bg-gray-50 p-4">
                      {selectedGroupCount === group.items.length ? (
                        <div className="flex justify-between font-medium">
                          <span>{group.producerName} Subtotal</span>
                          <span>£{group.subtotal.toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="flex justify-between font-medium">
                            <span>Selected from {group.producerName}</span>
                            <span>£{selectedGroupSubtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>Full producer cart total</span>
                            <span>£{group.subtotal.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCartByProducer.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCartByProducer.map((group) => (
                      <div key={group.producerId} className="flex justify-between text-sm">
                        <span className="text-gray-600">{group.producerName}</span>
                        <span>£{group.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-[oklch(0.86_0.05_150)] bg-[oklch(0.985_0.01_145)] p-4 text-sm text-gray-600">
                    Select one or more items to enable checkout.
                  </div>
                )}

                <Separator />

                <div className="flex justify-between">
                  <span>Selected Subtotal</span>
                  <span>£{selectedGrandTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Network Commission (5%)</span>
                  <span>£{commission.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Total Food Miles</span>
                  <span>{selectedFoodMiles.toFixed(2)} miles • Go Green</span>
                </div>

                <div className="flex justify-between text-sm text-gray-600">
                  <span>Not Selected Today</span>
                  <span>£{notSelectedTodayTotal.toFixed(2)}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-green-700">£{totalWithCommission.toFixed(2)}</span>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate('/checkout')}
                  disabled={selectedLineCount === 0}
                >
                  {user?.role === 'COMMUNITY'
                    ? 'Proceed to Community Checkout'
                    : user?.role === 'RESTAURANT'
                      ? 'Proceed to Restaurant Checkout'
                      : user?.role === 'PRODUCER'
                        ? 'Proceed as Producer Buyer'
                      : 'Proceed to Checkout'}
                </Button>

                <Button variant="outline" className="w-full" onClick={goToMarketplace}>
                  Continue Shopping
                </Button>

                <div className="rounded bg-gray-50 p-3 text-xs text-gray-500">
                  <p className="mb-1 font-medium">Delivery Information</p>
                  <p>Selected items move into checkout. Unticked items stay in your cart for later.</p>
                  <p className="mt-1">
                    Orders are delivered directly by each producer with a minimum 48-hour lead time.
                  </p>
                  {isBulkRole && (
                    <p className="mt-1">
                      Bulk quantities are capped at {MAX_ORDER_ITEM_QUANTITY} units per product for each order basket.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
