import { AlertCircle, AlertTriangle, Calendar, Clock, ShoppingBag, TrendingDown, type LucideIcon } from 'lucide-react';

import { apiJson } from './api';
import { fetchProducerProductsFromApi } from '../services/productApi';

export type ProducerOrderStatus = 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';
export type NotificationTone = 'urgent' | 'warning' | 'neutral' | 'success';

export interface ProducerSubOrderNotificationSource {
  id: number;
  order_number: string;
  status: ProducerOrderStatus;
  delivery_date: string;
  customer_name: string;
  customer_email: string;
  items: Array<{ product_name: string; quantity: string; unit: string }>;
}

export interface ProducerProductNotificationSource {
  id: string;
  name: string;
  stock: number;
  lowStockThreshold?: number;
  availability: 'in-season' | 'year-round' | 'unavailable';
  effectiveAvailability?: 'in-season' | 'year-round' | 'unavailable';
  seasonalReminderMessage?: string;
}

export interface ProducerNotificationItem {
  id: string;
  title: string;
  description: string;
  path: string;
  tone: NotificationTone;
  urgency: 'High' | 'Medium' | 'Low' | 'Clear';
  icon: LucideIcon;
}

export function getLowStockThreshold(product: ProducerProductNotificationSource): number {
  return Math.max(1, product.lowStockThreshold || 10);
}

export function isLowStock(product: ProducerProductNotificationSource): boolean {
  return product.stock > 0 && product.stock <= getLowStockThreshold(product);
}

export function isUrgentOrder(order: ProducerSubOrderNotificationSource): boolean {
  const deliveryDate = new Date(order.delivery_date);
  if (Number.isNaN(deliveryDate.getTime())) {
    return false;
  }
  const hours = Math.ceil((deliveryDate.getTime() - Date.now()) / 3_600_000);
  return hours > 0 && hours < 24 && order.status !== 'delivered' && order.status !== 'cancelled';
}

export function buildProducerNotifications(
  orders: ProducerSubOrderNotificationSource[],
  products: ProducerProductNotificationSource[],
): ProducerNotificationItem[] {
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const urgentOrders = orders.filter((order) => isUrgentOrder(order));
  const lowStockProducts = products.filter((product) => isLowStock(product));
  const outOfStockProducts = products.filter((product) => product.stock === 0);
  const unavailableProducts = products.filter(
    (product) => (product.effectiveAvailability ?? product.availability) === 'unavailable',
  );
  const seasonStartingSoonProducts = products.filter((product) => Boolean(product.seasonalReminderMessage));
  const queue: ProducerNotificationItem[] = [];

  if (urgentOrders.length > 0) {
    queue.push({
      id: 'urgent-orders',
      title: `${urgentOrders.length} sales order${urgentOrders.length === 1 ? '' : 's'} due in under 24h`,
      description: 'Prioritise confirmation, preparation, and delivery updates.',
      path: '/producer/orders?view=sales',
      tone: 'urgent',
      urgency: 'High',
      icon: AlertCircle,
    });
  }
  if (pendingOrders.length > 0) {
    queue.push({
      id: 'pending-orders',
      title: `${pendingOrders.length} order${pendingOrders.length === 1 ? '' : 's'} waiting confirmation`,
      description: 'Customers see status updates as soon as you confirm.',
      path: '/producer/orders?view=sales',
      tone: 'warning',
      urgency: 'Medium',
      icon: ShoppingBag,
    });
  }
  if (lowStockProducts.length > 0) {
    queue.push({
      id: 'low-stock',
      title: `${lowStockProducts.length} low-stock product${lowStockProducts.length === 1 ? '' : 's'}`,
      description: lowStockProducts.map((product) => `${product.name} (${product.stock}/${getLowStockThreshold(product)})`).join(', '),
      path: '/producer/inventory',
      tone: 'warning',
      urgency: 'Medium',
      icon: AlertTriangle,
    });
  }
  if (outOfStockProducts.length > 0 || unavailableProducts.length > 0) {
    queue.push({
      id: 'unavailable-products',
      title: `${outOfStockProducts.length} out of stock, ${unavailableProducts.length} unavailable`,
      description: 'Adjust stock and availability so customers only see accurate listings.',
      path: '/producer/inventory',
      tone: 'urgent',
      urgency: 'High',
      icon: TrendingDown,
    });
  }
  if (seasonStartingSoonProducts.length > 0) {
    queue.push({
      id: 'season-starting',
      title: `${seasonStartingSoonProducts.length} seasonal product${seasonStartingSoonProducts.length === 1 ? '' : 's'} starting soon`,
      description: seasonStartingSoonProducts.map((product) => product.seasonalReminderMessage || product.name).join(', '),
      path: '/producer/inventory',
      tone: 'neutral',
      urgency: 'Low',
      icon: Calendar,
    });
  }
  if (queue.length === 0) {
    queue.push({
      id: 'clear',
      title: 'No urgent actions right now',
      description: 'Sales, inventory, and seasonal signals are currently stable.',
      path: '/producer/orders?view=sales',
      tone: 'success',
      urgency: 'Clear',
      icon: Clock,
    });
  }

  return queue;
}

export async function fetchProducerNotifications(producerEmail: string): Promise<ProducerNotificationItem[]> {
  const [orders, products] = await Promise.all([
    apiJson<ProducerSubOrderNotificationSource[]>('/api/orders/producer/sub-orders/'),
    fetchProducerProductsFromApi(producerEmail),
  ]);
  return buildProducerNotifications(orders, products);
}

export function getProducerNotificationBadgeCount(notifications: ProducerNotificationItem[]): number {
  return notifications.filter((item) => item.id !== 'clear').length;
}
