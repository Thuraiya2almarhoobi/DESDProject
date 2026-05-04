/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Frontend source file for types.
 *
 * Frontend context:
 *   Frontend source module for the React/Vite application.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

// User and Auth Types
export type UserRole = 'CUSTOMER' | 'PRODUCER' | 'COMMUNITY' | 'RESTAURANT' | 'ADMIN';
export type CustomerType = 'standard' | 'community' | 'restaurant';

export interface User {
  id: number | string;
  email: string;
  role: UserRole;
  name: string;
  producerId?: string; // For producers
  customerType?: CustomerType; // For customers
  profile?: Record<string, unknown> | null;
}

// Product Types
export type ProductUnit = 'kg' | 'litre' | 'dozen' | 'each';
export type AvailabilityType = 'in-season' | 'year-round' | 'unavailable';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: ProductUnit;
  producerId: string;
  producerName: string;
  producerLocation: string;
  producerDescription?: string;
  producerDeliveryLeadTime?: number;
  producerPostcode?: string;
  producerCoordinates?: {
    lat: number;
    lng: number;
  };
  category: string;
  harvestDate: string;
  availability: AvailabilityType;
  configuredAvailability?: AvailabilityType;
  effectiveAvailability?: AvailabilityType;
  seasonalDates?: string; // e.g., "May - September"
  seasonStartMonth?: number;
  seasonEndMonth?: number;
  seasonalStatusMessage?: string;
  seasonalReminderMessage?: string;
  isCurrentlyInSeason?: boolean;
  isOrganic: boolean;
  organicCertification?: string;
  allergens: string[];
  imageUrl: string;
  stock: number;
  lowStockThreshold?: number;
  foodMiles: number;
  isSurplus?: boolean;
  surplusDiscount?: number; // percentage discount
  surplusOriginalPrice?: number;
  surplusExpiresAt?: string; // ISO date string
  surplusBestBefore?: string; // e.g., "3 days"
  storageTips?: string;
  recipeIdeas?: string[];
  averageRating?: number;
  reviewCount?: number;
  verifiedReviewCount?: number;
}

export type ReviewModerationStatus = 'published' | 'pending' | 'rejected';

export interface ProductReview {
  id: string;
  userId?: string;
  title?: string;
  reviewerName: string;
  isAnonymous?: boolean;
  rating: number;
  comment: string;
  verifiedPurchase: boolean;
  moderationStatus?: ReviewModerationStatus;
  moderationReason?: string;
  producerResponse?: string;
  producerResponseAt?: string;
  createdAt: string;
}

export interface ReviewEligibility {
  canSubmit: boolean;
  reason: string;
  hasVerifiedPurchase: boolean;
  hasExistingReview: boolean;
  dailyLimitReached: boolean;
  isCustomer: boolean;
  isAuthenticated: boolean;
  canRespond: boolean;
  responseReason: string;
}

// Cart Types
export interface CartItem {
  cartItemId?: string;
  product: Product;
  quantity: number;
}

export interface CartByProducer {
  producerId: string;
  producerName: string;
  deliveryLeadTime: number; // in hours
  items: CartItem[];
  subtotal: number;
}

// Order Types
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  producerId: string;
  producerName: string;
  items: CartItem[];
  subtotal: number;
  commission: number; // 5%
  total: number;
  status: OrderStatus;
  deliveryDate: string;
  deliveryAddress: string;
  createdAt: string;
}

// Producer Types
export interface Producer {
  id: string;
  name: string;
  location: string;
  description: string;
  deliveryLeadTime: number; // in hours, min 48
  coordinates?: {
    lat: number;
    lng: number;
  };
  postcode?: string;
}

// Commission Types
export interface CommissionRecord {
  id: string;
  producerId: string;
  producerName: string;
  weekStart: string;
  weekEnd: string;
  totalSales: number;
  commissionAmount: number; // 5%
  ordersCount: number;
}
