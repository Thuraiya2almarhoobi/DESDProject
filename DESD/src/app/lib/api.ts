import { Product } from '../types';
import { resolveApiOriginBase } from './apiBase';
import { clearAuthStorage, getAccessToken, getRefreshToken, setAuthTokens } from './tokenStorage';

const AUTH_STORAGE_KEY = 'desd_basic_auth_token';
const API_BASE = resolveApiOriginBase(import.meta.env.VITE_API_BASE, '');

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

export interface ApiDeliveryInfo {
  id: number;
  provider: string;
  provider_reference: string;
  package_reference: string;
  client_reference: string;
  status: string;
  tracking_url: string;
  client_tracking_url: string;
  eta?: string | null;
  courier?: {
    name?: string;
    phone?: string;
    transport_type?: string;
  } | null;
  last_coordinates?: {
    lat: number;
    lng: number;
  } | null;
  pickup_address_snapshot?: {
    full_address?: string;
    postcode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    } | null;
  } | null;
  dropoff_address_snapshot?: {
    full_address?: string;
    postcode?: string;
    coordinates?: {
      lat: number;
      lng: number;
    } | null;
  } | null;
  quote_amount?: string | null;
  quote_currency?: string;
  last_error?: string;
  test_mode: boolean;
  simulation_started_at?: string | null;
  simulation_duration_seconds?: number;
  created_at: string;
  updated_at: string;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  cancelled_at?: string | null;
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
  season_start_month?: number | null;
  season_end_month?: number | null;
  seasonal_window_label?: string;
  season_status_message?: string;
  season_reminder_message?: string;
  is_currently_in_season?: boolean;
  average_rating?: number | string | null;
  review_count?: number | string;
  verified_review_count?: number | string;
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
  availability?: Product['availability'];
  seasonal_dates?: string;
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
  delivery_date_from: string | null;
  delivery_date_to: string | null;
  subtotal_amount: string;
  commission_amount: string;
  total_amount: string;
  producer_names: string[];
}

export interface ApiOrderItem {
  id: number;
  product_id?: number | null;
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
  producer_contact_email?: string;
  producer_contact_phone?: string;
  status: string;
  delivery_date: string;
  subtotal_amount: string;
  commission_amount: string;
  payout_amount: string;
  notes?: string;
  delivery?: ApiDeliveryInfo | null;
}

export interface ApiOrderDetail {
  id: number;
  order_number: string;
  status: string;
  payment_status: string;
  delivery_address: string;
  customer_postcode: string;
  special_instructions?: string;
  subtotal_amount: string;
  commission_rate: string;
  commission_amount: string;
  producer_payout_total: string;
  total_amount: string;
  payment_method: string;
  payment_reference: string;
  is_recurring_instance?: boolean;
  recurring_scheduled_for?: string | null;
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
  const accessToken = getAccessToken();
  const basicToken = getBasicAuthToken();

  if (!headers.has('Authorization')) {
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    } else if (basicToken) {
      headers.set('Authorization', `Basic ${basicToken}`);
    }
  }

  return headers;
}

function isAuthEndpoint(url: string): boolean {
  return (
    url.includes('/accounts/auth/login/')
    || url.includes('/accounts/auth/refresh/')
    || url.includes('/accounts/auth/register/')
  );
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthStorage();
    setBasicAuthToken(null);
    return null;
  }

  const response = await fetch(toUrl('/api/accounts/auth/refresh/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  const payload = await readResponseBody(response);
  const nextAccessToken =
    payload && typeof payload === 'object' ? (payload as { access?: unknown }).access : undefined;

  if (!response.ok || typeof nextAccessToken !== 'string' || !nextAccessToken.trim()) {
    clearAuthStorage();
    setBasicAuthToken(null);
    return null;
  }

  setAuthTokens(nextAccessToken, refreshToken);
  return nextAccessToken;
}

async function performApiRequest(path: string, init: RequestInit = {}, allowRefresh = true): Promise<Response> {
  const url = toUrl(path);
  const headers = buildHeaders(init.headers);

  if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(url, {
    ...init,
    headers,
  });

  if (response.status !== 401 || !allowRefresh || isAuthEndpoint(url)) {
    return response;
  }

  const nextAccessToken = await tryRefreshAccessToken();
  if (!nextAccessToken) {
    return response;
  }

  const retryHeaders = buildHeaders(init.headers);
  retryHeaders.set('Authorization', `Bearer ${nextAccessToken}`);
  if (init.body && !retryHeaders.has('Content-Type') && !(init.body instanceof FormData)) {
    retryHeaders.set('Content-Type', 'application/json');
  }

  response = await fetch(url, {
    ...init,
    headers: retryHeaders,
  });
  return response;
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
  const response = await performApiRequest(path, init);
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
  const response = await performApiRequest(path, init);

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

export async function uploadImageFile(
  file: File,
  scope: 'general' | 'products' | 'recipes' | 'stories' = 'general',
): Promise<{ url: string; relative_url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('scope', scope);

  return apiJson<{ url: string; relative_url: string }>('/api/accounts/uploads/images/', {
    method: 'POST',
    body: formData,
  });
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
    configuredAvailability: apiProduct.in_season ? 'in-season' : 'year-round',
    effectiveAvailability: toAvailability(apiProduct.is_available, stock, apiProduct.in_season),
    seasonalDates: apiProduct.seasonal_window_label || (apiProduct.in_season ? 'In season now' : 'Year-round'),
    seasonStartMonth: apiProduct.season_start_month ?? undefined,
    seasonEndMonth: apiProduct.season_end_month ?? undefined,
    seasonalStatusMessage: apiProduct.season_status_message || undefined,
    seasonalReminderMessage: apiProduct.season_reminder_message || undefined,
    isCurrentlyInSeason: apiProduct.is_currently_in_season,
    isOrganic: apiProduct.in_season,
    allergens: parseAllergens(apiProduct.allergen_info),
    imageUrl: imageForProduct(apiProduct.id),
    stock: Number.isFinite(stock) ? stock : 0,
    foodMiles: producerDistanceMiles ?? 0,
    storageTips: 'Keep refrigerated where appropriate and consume while fresh.',
    recipeIdeas: [],
    averageRating: apiProduct.average_rating !== undefined && apiProduct.average_rating !== null ? Number(apiProduct.average_rating) : undefined,
    reviewCount: apiProduct.review_count !== undefined ? Number(apiProduct.review_count) : undefined,
    verifiedReviewCount:
      apiProduct.verified_review_count !== undefined ? Number(apiProduct.verified_review_count) : undefined,
  };
}
