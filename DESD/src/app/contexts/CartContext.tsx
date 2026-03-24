import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { toast } from 'sonner';
import { Product, CartItem, CartByProducer } from '../types';
import { ApiCart, ApiCartGroup, ApiCartItem, apiJson } from '../lib/api';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartByProducer: () => CartByProducer[];
  getTotalItems: () => number;
  getGrandTotal: () => number;
  undoLastAdd: () => void;
  lastAddedItem: { product: Product; quantity: number } | null;
  refreshCart: () => Promise<void>;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_IMAGE_LIBRARY = [
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600',
  'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=600',
  'https://images.unsplash.com/photo-1471194402529-8e0f5a675de6?w=600',
  'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=600',
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=600',
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600',
];

function imageForCartItem(productId: number): string {
  return CART_IMAGE_LIBRARY[productId % CART_IMAGE_LIBRARY.length];
}

function toNumber(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapApiCartItemToProduct(group: ApiCartGroup, item: ApiCartItem): Product {
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
    isOrganic: false,
    allergens: [],
    imageUrl: imageForCartItem(item.product_id),
    stock,
    foodMiles: 0,
  };
}

function mapApiCartToItems(cart: ApiCart | null): CartItem[] {
  if (!cart) {
    return [];
  }

  return cart.groups.flatMap((group) =>
    group.items.map((item) => ({
      product: mapApiCartItemToProduct(group, item),
      quantity: toNumber(item.quantity),
    })),
  );
}

function findApiCartItem(cart: ApiCart | null, productId: string): ApiCartItem | null {
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

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<ApiCart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<{ product: Product; quantity: number } | null>(null);

  const items = useMemo(() => mapApiCartToItems(cart), [cart]);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart(null);
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

  const addToCart = (product: Product, quantity: number) => {
    const productId = Number(product.id);
    if (!Number.isInteger(productId)) {
      toast.error('Invalid product selected.');
      return;
    }

    void (async () => {
      try {
        const result = await apiJson<{ message: string; cart: ApiCart }>('/api/orders/cart/items/', {
          method: 'POST',
          body: JSON.stringify({ product_id: productId, quantity }),
        });
        setCart(result.cart);
        setLastAddedItem({ product, quantity });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to add item to cart.';
        toast.error(message);
      }
    })();
  };

  const removeFromCart = (productId: string) => {
    const cartItem = findApiCartItem(cart, productId);
    if (!cartItem) {
      return;
    }

    void (async () => {
      try {
        const result = await apiJson<{ message: string; cart: ApiCart }>(
          `/api/orders/cart/items/${cartItem.cart_item_id}/`,
          {
            method: 'DELETE',
          },
        );
        setCart(result.cart);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to remove item from cart.';
        toast.error(message);
      }
    })();
  };

  const updateQuantity = (productId: string, quantity: number) => {
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
    if (!cart) {
      return [];
    }

    return cart.groups.map((group) => ({
      producerId: String(group.producer_id),
      producerName: group.producer_name,
      deliveryLeadTime: group.lead_time_hours,
      items: group.items.map((item) => ({
        product: mapApiCartItemToProduct(group, item),
        quantity: toNumber(item.quantity),
      })),
      subtotal: toNumber(group.subtotal),
    }));
  };

  const getTotalItems = () => {
    return toNumber(cart?.item_count || 0);
  };

  const getGrandTotal = () => {
    return toNumber(cart?.subtotal || 0);
  };

  const undoLastAdd = () => {
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
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartByProducer,
        getTotalItems,
        getGrandTotal,
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

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}
