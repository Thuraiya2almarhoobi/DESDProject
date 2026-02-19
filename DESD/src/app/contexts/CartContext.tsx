import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Product, CartItem, CartByProducer } from '../types';
import { mockProducers } from '../data/mockData';

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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [lastAddedItem, setLastAddedItem] = useState<{ product: Product; quantity: number } | null>(null);

  const addToCart = (product: Product, quantity: number) => {
    setLastAddedItem({ product, quantity });
    setItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const undoLastAdd = () => {
    if (!lastAddedItem) return;
    
    const { product, quantity } = lastAddedItem;
    setItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (!existing) return prev;
      
      const newQuantity = existing.quantity - quantity;
      if (newQuantity <= 0) {
        return prev.filter(item => item.product.id !== product.id);
      }
      return prev.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: newQuantity }
          : item
      );
    });
    setLastAddedItem(null);
  };

  const removeFromCart = (productId: string) => {
    setItems(prev => prev.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const getCartByProducer = (): CartByProducer[] => {
    const grouped = items.reduce((acc, item) => {
      const producerId = item.product.producerId;
      if (!acc[producerId]) {
        acc[producerId] = [];
      }
      acc[producerId].push(item);
      return acc;
    }, {} as Record<string, CartItem[]>);

    return Object.entries(grouped).map(([producerId, producerItems]) => {
      const producer = mockProducers.find(p => p.id === producerId);
      const subtotal = producerItems.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
      );

      return {
        producerId,
        producerName: producer?.name || 'Unknown Producer',
        deliveryLeadTime: producer?.deliveryLeadTime || 48,
        items: producerItems,
        subtotal,
      };
    });
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getGrandTotal = () => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
    return subtotal;
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