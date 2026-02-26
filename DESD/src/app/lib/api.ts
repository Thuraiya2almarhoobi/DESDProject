import { Product } from '../types';

const AUTH_STORAGE_KEY = 'desd_basic_auth_token';
const API_BASE = import.meta.env.VITE_API_BASE || '';

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export interface ApiProducer {
  id: number;
  business_name: string;
  postcode: string;
  lead_time_hours: number;
}

export interface ApiProduct {
  id: number;
  producer: ApiProducer;
  name: string;
  category: string;
  description: string;
  unit: string;
  price: string;
  stock_quantity: string;
  is_available: boolean;
  in_season: boolean;
  harvest_date: string | null;
  allergen_info: string;
}

export interface ApiCartItem {
  cart_item_id: number;
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  available_stock: string;
}

export interface ApiCartGroup {
  producer_id: number;
  producer_name: string;
  lead_time_hours: number;
  subtotal: string;
  items: ApiCartItem[];
}

export interface ApiCart {
  item_count: string;
  producer_count: number;
  subtotal: string;
  commission_rate: string;
  commission_amount: string;
  total: string;
  groups: ApiCartGroup[];
}

export interface ApiOrderSummary {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  created_at: string;
  subtotal_amount: string;
  commission_amount: string;
  total_amount: string;
  producer_names: string[];
}

export interface ApiOrderItem {
  id: number;
  product_name: string;
  producer_name: string;
  unit: string;
  quantity: string;
  unit_price: string;
  line_total: string;
}

export interface ApiProducerSubOrder {
  id: number;
  producer: ApiProducer;
  status: string;
  delivery_date: string;
  subtotal_amount: string;
  commission_amount: string;
  payout_amount: string;
}

export interface ApiOrderDetail {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  delivery_address: string;
  customer_postcode: string;
  subtotal_amount: string;
  commission_rate: string;
  commission_amount: string;
  producer_payout_total: string;
  total_amount: string;
  payment_method: string;
  payment_reference: string;
  created_at: string;
  sub_orders: ApiProducerSubOrder[];
  items: ApiOrderItem[];
}

export interface ApiProfile {
  full_name: string;
  phone: string;
  delivery_address: string;
  postcode: string;
}

export interface ApiFeedEntry {
  type: 'recipe' | 'story';
  id: number;
  title: string;
  description: string;
  producer_name: string;
  seasonal_tag: string;
  created_at: string;
}

export interface ApiRecipe {
  id: number;
  producer: number;
  producer_name: string;
  title: string;
  description: string;
  ingredients: string;
  instructions: string;
  seasonal_tag: string;
  image_url: string;
  is_published: boolean;
  created_at: string;
  linked_products: Array<{ id: number; name: string; unit: string; price: string }>;
  saved: boolean;
}

export interface ApiStory {
  id: number;
  producer: number;
  producer_name: string;
  title: string;
  body: string;
  seasonal_tag: string;
  image_url: string;
  is_published: boolean;
  created_at: string;
}

export function setBasicAuthToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (token) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function getBasicAuthToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

function toUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${API_BASE}${path}`;
}

function buildHeaders(inputHeaders?: HeadersInit): Headers {
  const headers = new Headers(inputHeaders);
  const token = getBasicAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Basic ${token}`);
  }

  return headers;
}

function parseApiErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }
  return fallback;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = buildHeaders(init.headers);

  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(toUrl(path), {
    ...init,
    headers,
  });

  const payload = await readResponseBody(response);

  if (!response.ok) {
    throw new ApiError(
      parseApiErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function apiBlob(path: string, init: RequestInit = {}): Promise<Blob> {
  const headers = buildHeaders(init.headers);
  const response = await fetch(toUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await readResponseBody(response);
    throw new ApiError(
      parseApiErrorMessage(payload, `Request failed with status ${response.status}`),
      response.status,
      payload,
    );
  }

  return response.blob();
}

const PRODUCT_IMAGE_LIBRARY = [
  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=900',
  'https://images.unsplash.com/photo-1518843875459-f738682238a6?w=900',
  'https://images.unsplash.com/photo-1471194402529-8e0f5a675de6?w=900',
  'https://images.unsplash.com/photo-1506617420156-8e4536971650?w=900',
  'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=900',
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=900',
  'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=900',
  'https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=900',
];

function toAvailability(isAvailable: boolean, stock: number, inSeason: boolean): Product['availability'] {
  if (!isAvailable || stock <= 0) {
    return 'unavailable';
  }
  if (inSeason) {
    return 'in-season';
  }
  return 'year-round';
}

function parseAllergens(raw: string): string[] {
  return raw
    .split(',')
    .map((allergen) => allergen.trim())
    .filter(Boolean);
}

function imageForProduct(productId: number): string {
  return PRODUCT_IMAGE_LIBRARY[productId % PRODUCT_IMAGE_LIBRARY.length];
}

export function mapApiProductToProduct(apiProduct: ApiProduct, producerDistanceMiles?: number): Product {
  const stock = Number(apiProduct.stock_quantity);
  const price = Number(apiProduct.price);

  return {
    id: String(apiProduct.id),
    name: apiProduct.name,
    description: apiProduct.description || 'Fresh local produce from trusted producers.',
    price: Number.isFinite(price) ? price : 0,
    unit: (apiProduct.unit || 'each') as Product['unit'],
    producerId: String(apiProduct.producer.id),
    producerName: apiProduct.producer.business_name,
    producerLocation: apiProduct.producer.postcode,
    category: apiProduct.category || 'Uncategorised',
    harvestDate: apiProduct.harvest_date || new Date().toISOString().slice(0, 10),
    availability: toAvailability(apiProduct.is_available, stock, apiProduct.in_season),
    seasonalDates: apiProduct.in_season ? 'In season now' : 'Year-round',
    isOrganic: apiProduct.in_season,
    allergens: parseAllergens(apiProduct.allergen_info),
    imageUrl: imageForProduct(apiProduct.id),
    stock: Number.isFinite(stock) ? stock : 0,
    foodMiles: producerDistanceMiles ?? 0,
    storageTips: 'Keep refrigerated where appropriate and consume while fresh.',
    recipeIdeas: [],
  };
}
