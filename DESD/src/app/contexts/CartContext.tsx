/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the CartContext React context/provider and exposes shared state to child components.
 *
 * Frontend context:
 *   React context layer: owns cross-page state such as authentication and cart contents.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { toast } from 'sonner';
import { Product, CartItem, CartByProducer } from '../types';
import { ApiCart, ApiCartGroup, ApiCartItem, apiJson } from '../lib/api';
import { useAuth } from './AuthContext';
import { DEFAULT_PRODUCT_IMAGE_URL } from '../api/catalog';

/**
 * Cart context coordinates the buyer-side ordering flow.
 *
 * The server remains the source of truth for pricing, grouping, and stock
 * rules. This provider reshapes that server cart into UI-friendly data for:
 * - cart pages
 * - checkout
 * - mini-cart indicators
 * - add/remove/update actions
 */
interface CartContextType {
  items: CartItem[];
  selectedCartItemIds: string[];
  selectedItems: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  addToCartAndWait: (product: Product, quantity: number) => Promise<string | null>;
  removeFromCart: (productId: string) => void;
  removeFromCartAndWait: (productId: string) => Promise<boolean>;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartByProducer: () => CartByProducer[];
  getSelectedCartByProducer: () => CartByProducer[];
  getTotalItems: () => number;
  getGrandTotal: () => number;
  getSelectedGrandTotal: () => number;
  isProductInCart: (productId: string) => boolean;
  getProductCartQuantity: (productId: string) => number;
  isCartItemSelected: (cartItemId: string) => boolean;
  setCartItemSelection: (cartItemIds: string[], checked: boolean) => void;
  selectAllCartItems: () => void;
  clearCartSelection: () => void;
  prepareSingleItemCheckout: (product: Product, quantity: number) => Promise<boolean>;
  undoLastAdd: () => void;
  lastAddedItem: { product: Product; quantity: number } | null;
  refreshCart: () => Promise<void>;
  isLoading: boolean;
}

/**
 * CartContext boundary.
 *
 * This exported unit supports the file role: Provides the CartContext React context/provider and exposes shared state to child components.
 * It belongs to: React context layer: owns cross-page state such as authentication and cart contents.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const CartContext = createContext<CartContextType | undefined>(undefined);

function toNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAllergens(value?: string): string[] {
  // backend stores allergen labels as text so the cart normalises them for filters
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item && !['none', 'no allergens', 'no common allergens'].includes(item.toLowerCase()));
}

function mapApiCartItemToProduct(group: ApiCartGroup, item: ApiCartItem): Product {
  // cart product data is rebuilt from api snapshots so images and prices stay real
  const stock = toNumber(item.available_stock);
  const unitPrice = toNumber(item.unit_price);

  return {
    id: String(item.product_id),
    name: item.product_name,
    description: '',
    price: unitPrice,
    unit: (item.unit || 'each') as Product['unit'],
    producerId: String(group.producer_id),
    producerName: group.producer_name,
    producerLocation: '',
    category: item.category || 'Uncategorised',
    harvestDate: new Date().toISOString().slice(0, 10),
    availability: item.availability || (stock > 0 ? 'in-season' : 'unavailable'),
    seasonalDates: item.seasonal_dates || undefined,
    isOrganic: Boolean(item.is_organic),
    organicCertification: item.organic_certification || undefined,
    allergens: parseAllergens(item.allergen_info),
    imageUrl: item.image_url || DEFAULT_PRODUCT_IMAGE_URL,
    stock,
    foodMiles: 0,
    isSurplus: Boolean(item.is_surplus),
    surplusDiscount: item.surplus_discount_percent ?? undefined,
    surplusOriginalPrice: item.original_unit_price ? toNumber(item.original_unit_price) : undefined,
    surplusBestBefore: item.surplus_best_before || undefined,
    surplusNote: item.surplus_note || undefined,
  };
}

function mapApiCartToItems(cart: ApiCart | null): CartItem[] {
  if (!cart) {
    return [];
  }

  return cart.groups.flatMap((group) =>
    group.items.map((item) => ({
      cartItemId: String(item.cart_item_id),
      product: mapApiCartItemToProduct(group, item),
      quantity: toNumber(item.quantity),
    })),
  );
}

function buildCartByProducer(cart: ApiCart | null, selectedCartItemIds?: string[]): CartByProducer[] {
  // producer grouping drives delivery dates commission rows and checkout sections
  if (!cart) {
    return [];
  }

  const selectedSet = selectedCartItemIds ? new Set(selectedCartItemIds) : null;

  return cart.groups
    .map((group) => {
      const items = group.items
        .filter((item) => !selectedSet || selectedSet.has(String(item.cart_item_id)))
        .map((item) => ({
          cartItemId: String(item.cart_item_id),
          product: mapApiCartItemToProduct(group, item),
          quantity: toNumber(item.quantity),
        }));

      if (items.length === 0) {
        return null;
      }

      const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      return {
        producerId: String(group.producer_id),
        producerName: group.producer_name,
        deliveryLeadTime: group.lead_time_hours,
        items,
        subtotal,
      };
    })
    .filter((group): group is CartByProducer => Boolean(group));
}

function findApiCartItem(cart: ApiCart | null, productId: string): ApiCartItem | null {
  // api updates need cart row ids but callers usually know the product id first
  if (!cart) {
    return null;
  }

  const numericId = Number(productId);
  if (!Number.isInteger(numericId)) {
    return null;
  }

  for (const group of cart.groups) {
    for (const item of group.items) {
      if (item.product_id === numericId) {
        return item;
      }
    }
  }

  return null;
}

function cartItemIdsFromApiCart(cart: ApiCart | null): string[] {
  if (!cart) {
    return [];
  }

  return cart.groups.flatMap((group) => group.items.map((item) => String(item.cart_item_id)));
}

/**
 * CartProvider boundary.
 *
 * This exported unit supports the file role: Provides the CartContext React context/provider and exposes shared state to child components.
 * It belongs to: React context layer: owns cross-page state such as authentication and cart contents.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  // cart data refreshes from django when the signed in user changes
  const { user } = useAuth();
  const [cart, setCart] = useState<ApiCart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<{ product: Product; quantity: number } | null>(null);
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<string[]>([]);
  const previousCartItemIdsRef = useRef<string[]>([]);

  const items = useMemo(() => mapApiCartToItems(cart), [cart]);
  const cartByProducer = useMemo(() => buildCartByProducer(cart), [cart]);
  const selectedCartByProducer = useMemo(
    () => buildCartByProducer(cart, selectedCartItemIds),
    [cart, selectedCartItemIds],
  );
  const selectedItems = useMemo(
    () => selectedCartByProducer.flatMap((group) => group.items),
    [selectedCartByProducer],
  );

  const refreshCart = useCallback(async () => {
    // no user means no server cart should remain visible in this browser session
    if (!user) {
      setCart(null);
      setSelectedCartItemIds([]);
      previousCartItemIdsRef.current = [];
      return;
    }

    setIsLoading(true);
    try {
      const payload = await apiJson<ApiCart>('/api/orders/cart/');
      setCart(payload);
    } catch (error) {
      setCart(null);
      toast.error('Unable to load cart from server.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    // selection follows server rows so deleted cart items are never submitted
    const validIds = items.map((item) => item.cartItemId).filter((value): value is string => Boolean(value));
    const previousIds = previousCartItemIdsRef.current;

    setSelectedCartItemIds((previous) => {
      const validSet = new Set(validIds);
      const kept = previous.filter((id) => validSet.has(id));
      const keptSet = new Set(kept);
      const newIds = validIds.filter((id) => !previousIds.includes(id) && !keptSet.has(id));
      return [...kept, ...newIds];
    });

    previousCartItemIdsRef.current = validIds;
  }, [items]);

  const addToCartAndWait = useCallback(async (product: Product, quantity: number) => {
    // add to cart goes through django so stock and role rules stay server side
    const productId = Number(product.id);
    if (!Number.isInteger(productId)) {
      toast.error('Invalid product selected.');
      return null;
    }

    try {
      const result = await apiJson<{ message: string; cart: ApiCart }>('/api/orders/cart/items/', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity }),
      });
      const matchingCartItem = findApiCartItem(result.cart, product.id);
      const matchingCartItemId = matchingCartItem ? String(matchingCartItem.cart_item_id) : null;

      setCart(result.cart);
      if (matchingCartItemId) {
        const validCartItemIds = cartItemIdsFromApiCart(result.cart);
        setSelectedCartItemIds((previous) => {
          const next = new Set(previous);
          next.add(matchingCartItemId);
          return validCartItemIds.filter((cartItemId) => next.has(cartItemId));
        });
      }
      setLastAddedItem({ product, quantity });
      return matchingCartItemId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add item to cart.';
      toast.error(message);
      return null;
    }
  }, []);

  const addToCart = (product: Product, quantity: number) => {
    void addToCartAndWait(product, quantity);
  };

  const removeFromCartAndWait = useCallback(async (productId: string) => {
    const cartItem = findApiCartItem(cart, productId);
    if (!cartItem) {
      return false;
    }

    try {
      const result = await apiJson<{ message: string; cart: ApiCart }>(
        `/api/orders/cart/items/${cartItem.cart_item_id}/`,
        {
          method: 'DELETE',
        },
      );
      setCart(result.cart);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to remove item from cart.';
      toast.error(message);
      return false;
    }
  }, [cart]);

  const removeFromCart = (productId: string) => {
    void removeFromCartAndWait(productId);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    // quantity edits use the cart row id because product ids are not patch targets
    const cartItem = findApiCartItem(cart, productId);
    if (!cartItem) {
      return;
    }

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    void (async () => {
      try {
        const result = await apiJson<{ message: string; cart: ApiCart }>(
          `/api/orders/cart/items/${cartItem.cart_item_id}/`,
          {
            method: 'PATCH',
            body: JSON.stringify({ quantity }),
          },
        );
        setCart(result.cart);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update quantity.';
        toast.error(message);
      }
    })();
  };

  const clearCart = () => {
    if (!cart) {
      return;
    }

    void (async () => {
      try {
        await Promise.all(
          cart.groups.flatMap((group) =>
            group.items.map((item) =>
              apiJson<{ message: string; cart: ApiCart }>(`/api/orders/cart/items/${item.cart_item_id}/`, {
                method: 'DELETE',
              }),
            ),
          ),
        );
        await refreshCart();
      } catch {
        toast.error('Unable to clear cart.');
      }
    })();
  };

  const getCartByProducer = (): CartByProducer[] => {
    return cartByProducer;
  };

  const getSelectedCartByProducer = (): CartByProducer[] => {
    return selectedCartByProducer;
  };

  const getTotalItems = () => {
    return toNumber(cart?.item_count || 0);
  };

  const getGrandTotal = () => {
    return toNumber(cart?.subtotal || 0);
  };

  const getSelectedGrandTotal = () => {
    return selectedCartByProducer.reduce((sum, group) => sum + group.subtotal, 0);
  };

  const isProductInCart = (productId: string) => {
    return Boolean(findApiCartItem(cart, productId));
  };

  const getProductCartQuantity = (productId: string) => {
    const cartItem = findApiCartItem(cart, productId);
    return cartItem ? toNumber(cartItem.quantity) : 0;
  };

  const isCartItemSelected = (cartItemId: string) => {
    return selectedCartItemIds.includes(cartItemId);
  };

  const setCartItemSelection = (cartItemIds: string[], checked: boolean) => {
    // selected ids allow partial checkout without removing the rest of the cart
    setSelectedCartItemIds((previous) => {
      const next = new Set(previous);
      cartItemIds.forEach((cartItemId) => {
        if (checked) {
          next.add(cartItemId);
        } else {
          next.delete(cartItemId);
        }
      });

      return items
        .map((item) => item.cartItemId)
        .filter((cartItemId): cartItemId is string => Boolean(cartItemId) && next.has(cartItemId));
    });
  };

  const selectAllCartItems = () => {
    setSelectedCartItemIds(
      items
        .map((item) => item.cartItemId)
        .filter((cartItemId): cartItemId is string => Boolean(cartItemId)),
    );
  };

  const clearCartSelection = () => {
    setSelectedCartItemIds([]);
  };

  const prepareSingleItemCheckout = useCallback(async (product: Product, quantity: number) => {
    // buy now prepares one selected row so checkout can submit only that item
    const productId = Number(product.id);
    if (!Number.isInteger(productId)) {
      toast.error('Invalid product selected.');
      return false;
    }

    const existingCartItem = findApiCartItem(cart, product.id);
    if (existingCartItem && toNumber(existingCartItem.quantity) === quantity) {
      setSelectedCartItemIds([String(existingCartItem.cart_item_id)]);
      return true;
    }

    try {
      let nextCart: ApiCart;

      if (existingCartItem) {
        const result = await apiJson<{ message: string; cart: ApiCart }>(
          `/api/orders/cart/items/${existingCartItem.cart_item_id}/`,
          {
            method: 'PATCH',
            body: JSON.stringify({ quantity }),
          },
        );
        nextCart = result.cart;
      } else {
        const result = await apiJson<{ message: string; cart: ApiCart }>('/api/orders/cart/items/', {
          method: 'POST',
          body: JSON.stringify({ product_id: productId, quantity }),
        });
        nextCart = result.cart;
        setLastAddedItem({ product, quantity });
      }

      const preparedCartItem = findApiCartItem(nextCart, product.id);
      if (!preparedCartItem) {
        toast.error('Unable to prepare checkout for this product.');
        return false;
      }

      setCart(nextCart);
      setSelectedCartItemIds([String(preparedCartItem.cart_item_id)]);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare checkout.';
      toast.error(message);
      return false;
    }
  }, [cart]);

  const undoLastAdd = () => {
    // undo removes only the last added quantity rather than the whole product
    if (!lastAddedItem) {
      return;
    }

    const existing = findApiCartItem(cart, lastAddedItem.product.id);
    if (!existing) {
      setLastAddedItem(null);
      return;
    }

    const nextQuantity = toNumber(existing.quantity) - lastAddedItem.quantity;
    setLastAddedItem(null);

    if (nextQuantity <= 0) {
      removeFromCart(lastAddedItem.product.id);
      return;
    }

    updateQuantity(lastAddedItem.product.id, nextQuantity);
  };

  return (
    <CartContext.Provider
      value={{
        items,
        selectedCartItemIds,
        selectedItems,
        addToCart,
        addToCartAndWait,
        removeFromCart,
        removeFromCartAndWait,
        updateQuantity,
        clearCart,
        getCartByProducer,
        getSelectedCartByProducer,
        getTotalItems,
        getGrandTotal,
        getSelectedGrandTotal,
        isProductInCart,
        getProductCartQuantity,
        isCartItemSelected,
        setCartItemSelection,
        selectAllCartItems,
        clearCartSelection,
        prepareSingleItemCheckout,
        undoLastAdd,
        lastAddedItem,
        refreshCart,
        isLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/**
 * useCart boundary.
 *
 * This exported unit supports the file role: Provides the CartContext React context/provider and exposes shared state to child components.
 * It belongs to: React context layer: owns cross-page state such as authentication and cart contents.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
