/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Frontend source file for productApi.
 *
 * Frontend context:
 *   Frontend source module for the React/Vite application.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { Product, AvailabilityType } from '../types';
import { resolveApiPathBase } from '../lib/apiBase';
import { apiJson } from '../lib/api';
import { DEFAULT_PRODUCT_IMAGE_URL } from '../api/catalog';

/**
 * Marketplace and producer-product API helpers.
 *
 * The backend returns compact REST payloads, while the frontend needs a richer
 * Product shape for cards, detail views, filters, and producer inventory
 * screens. This module translates between those two models.
 */
type BackendAvailability = 'in_season' | 'year_round' | 'unavailable';

interface BackendProduct {
  id: number;
  producer_id: number;
  producer_name: string;
  producer_email: string;
  producer_location: string;
  name: string;
  category: string;
  description: string;
  price: string;
  unit: Product['unit'];
  availability: BackendAvailability;
  effective_availability?: BackendAvailability;
  season_start_month?: number | null;
  season_end_month?: number | null;
  seasonal_window_label?: string;
  season_status_message?: string;
  season_reminder_message?: string;
  is_currently_in_season?: boolean;
  stock_quantity: number;
  low_stock_threshold?: number;
  is_organic?: boolean;
  organic_certification?: string;
  allergen_information: string | string[];
  no_known_allergens_confirmed?: boolean;
  storage_tips?: string;
  storage_tips_ai_generated?: boolean;
  harvest_date: string;
  image_url: string;
  is_surplus: boolean;
  surplus_discount_percent: number | null;
  surplus_expires_at?: string | null;
  surplus_best_before?: string;
  surplus_note?: string;
}

interface ProducerCreatePayload {
  name: string;
  category: string;
  description: string;
  price: number;
  unit: Product['unit'];
  availability: AvailabilityType;
  stock: number;
  lowStockThreshold?: number;
  isOrganic?: boolean;
  organicCertification?: string;
  allergens?: string[];
  noKnownAllergensConfirmed?: boolean;
  storageTips?: string;
  storageTipsAiGenerated?: boolean;
  harvestDate: string;
  seasonStartMonth?: number;
  seasonEndMonth?: number;
  imageUrl?: string;
  isSurplus?: boolean;
  surplusDiscountPercent?: number;
  surplusExpiresAt?: string;
  surplusBestBefore?: string;
  surplusNote?: string;
}

export interface ProducerProductHistoryEvent {
  id: number;
  product_id: number;
  product_name: string;
  actor_email?: string;
  actor_role?: string;
  event_type: string;
  previous_stock_quantity?: number | null;
  new_stock_quantity?: number | null;
  previous_availability?: string;
  new_availability?: string;
  changed_fields: string[];
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  note: string;
  created_at: string;
}

const configuredBase = resolveApiPathBase(import.meta.env.VITE_API_BASE_URL, '/api');
const apiUrl = (path: string) => (configuredBase ? `${configuredBase}${path}` : path);

function toBackendAvailability(availability: AvailabilityType): BackendAvailability {
  if (availability === 'in-season') {
    return 'in_season';
  }
  if (availability === 'year-round') {
    return 'year_round';
  }
  return 'unavailable';
}

function toFrontendAvailability(availability: BackendAvailability): AvailabilityType {
  if (availability === 'in_season') {
    return 'in-season';
  }
  if (availability === 'year_round') {
    return 'year-round';
  }
  return 'unavailable';
}

function parseAllergens(raw: string | string[]): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => item.trim()).filter(Boolean);
  }
  if (!raw.trim()) {
    return [];
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeAllergens(allergens?: string[]): string {
  if (!allergens || allergens.length === 0) {
    return '';
  }
  return allergens.join(', ');
}

export function backendProductToFrontend(product: BackendProduct): Product {
  // Enrich the backend payload with UI-ready derived data such as display
  // labels, fallback imagery, and surplus pricing context.
  const allergens = parseAllergens(product.allergen_information);
  const price = Number(product.price);
  const discount = product.surplus_discount_percent ?? undefined;
  const originalPrice = discount ? Number((price / (1 - discount / 100)).toFixed(2)) : undefined;
  const configuredAvailability = toFrontendAvailability(product.availability);
  const effectiveAvailability = toFrontendAvailability(product.effective_availability ?? product.availability);

  return {
    id: String(product.id),
    name: product.name,
    description: product.description,
    price,
    unit: product.unit,
    producerId: `db-producer-${product.producer_id}`,
    producerName: product.producer_name || 'Producer',
    producerLocation: product.producer_location || 'Bristol, UK',
    category: product.category,
    harvestDate: product.harvest_date,
    availability: effectiveAvailability,
    configuredAvailability,
    effectiveAvailability,
    seasonalDates: product.seasonal_window_label || (effectiveAvailability === 'in-season' ? 'Current season' : undefined),
    seasonStartMonth: product.season_start_month ?? undefined,
    seasonEndMonth: product.season_end_month ?? undefined,
    seasonalStatusMessage: product.season_status_message || undefined,
    seasonalReminderMessage: product.season_reminder_message || undefined,
    isCurrentlyInSeason: product.is_currently_in_season,
    isOrganic: Boolean(product.is_organic),
    organicCertification: product.organic_certification || undefined,
    allergens,
    imageUrl: product.image_url || DEFAULT_PRODUCT_IMAGE_URL,
    stock: product.stock_quantity,
    lowStockThreshold: product.low_stock_threshold ?? 10,
    foodMiles: 12,
    isSurplus: product.is_surplus,
    surplusDiscount: discount,
    surplusOriginalPrice: originalPrice,
    surplusExpiresAt: product.surplus_expires_at || undefined,
    surplusBestBefore: product.surplus_best_before || undefined,
    surplusNote: product.surplus_note || undefined,
    storageTips: product.storage_tips || undefined,
    storageTipsAiGenerated: Boolean(product.storage_tips_ai_generated && product.storage_tips),
  };
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const details = await res.text();
    throw new Error(details || `Request failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchMarketplaceProductsFromApi(): Promise<Product[]> {
  const res = await fetch(apiUrl('/producer/public/products/'));
  const products = await parseResponse<BackendProduct[]>(res);
  return products.map(backendProductToFrontend);
}

export async function fetchPublicMarketplaceProductById(productId: string): Promise<Product> {
  const res = await fetch(apiUrl(`/producer/public/products/${productId}/`));
  const product = await parseResponse<BackendProduct>(res);
  return backendProductToFrontend(product);
}

export async function fetchProducerProductsFromApi(demoUserEmail: string): Promise<Product[]> {
  void demoUserEmail;
  const products = await apiJson<BackendProduct[]>('/api/producer/products/');
  return products.map(backendProductToFrontend);
}

export async function createProducerProductInApi(
  payload: ProducerCreatePayload,
  demoUserEmail: string,
): Promise<Product> {
  const body = {
    name: payload.name,
    category: payload.category,
    description: payload.description,
    price: payload.price.toFixed(2),
    unit: payload.unit,
    availability: toBackendAvailability(payload.availability),
    season_start_month: payload.availability === 'in-season' ? payload.seasonStartMonth ?? null : null,
    season_end_month: payload.availability === 'in-season' ? payload.seasonEndMonth ?? null : null,
    stock_quantity: payload.stock,
    low_stock_threshold: payload.lowStockThreshold ?? 10,
    is_organic: Boolean(payload.isOrganic),
    organic_certification: payload.isOrganic ? payload.organicCertification?.trim() ?? '' : '',
    allergen_information: serializeAllergens(payload.allergens),
    no_known_allergens_confirmed: Boolean(payload.noKnownAllergensConfirmed || !payload.allergens || payload.allergens.length === 0),
    storage_tips: payload.storageTips?.trim() ?? '',
    storage_tips_ai_generated: Boolean(payload.storageTips?.trim() && payload.storageTipsAiGenerated),
    harvest_date: payload.harvestDate,
    image_url: payload.imageUrl ?? '',
    is_surplus: Boolean(payload.isSurplus),
    surplus_discount_percent: payload.isSurplus ? payload.surplusDiscountPercent ?? 20 : null,
    surplus_expires_at: payload.isSurplus && payload.surplusExpiresAt ? payload.surplusExpiresAt : null,
    surplus_best_before: payload.isSurplus ? payload.surplusBestBefore?.trim() ?? '' : '',
    surplus_note: payload.isSurplus ? payload.surplusNote?.trim() ?? '' : '',
  };

  void demoUserEmail;
  const product = await apiJson<BackendProduct>('/api/producer/products/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return backendProductToFrontend(product);
}

export async function patchProducerProductInApi(
  productId: string,
  partialPayload: Partial<ProducerCreatePayload>,
  demoUserEmail: string,
): Promise<Product> {
  const body: Record<string, unknown> = {};
  if (partialPayload.name !== undefined) body.name = partialPayload.name;
  if (partialPayload.category !== undefined) body.category = partialPayload.category;
  if (partialPayload.description !== undefined) body.description = partialPayload.description;
  if (partialPayload.price !== undefined) body.price = partialPayload.price.toFixed(2);
  if (partialPayload.unit !== undefined) body.unit = partialPayload.unit;
  if (partialPayload.availability !== undefined) body.availability = toBackendAvailability(partialPayload.availability);
  if (partialPayload.seasonStartMonth !== undefined) body.season_start_month = partialPayload.seasonStartMonth;
  if (partialPayload.seasonEndMonth !== undefined) body.season_end_month = partialPayload.seasonEndMonth;
  if (partialPayload.stock !== undefined) body.stock_quantity = partialPayload.stock;
  if (partialPayload.lowStockThreshold !== undefined) body.low_stock_threshold = partialPayload.lowStockThreshold;
  if (partialPayload.isOrganic !== undefined) body.is_organic = partialPayload.isOrganic;
  if (partialPayload.organicCertification !== undefined) {
    body.organic_certification = partialPayload.isOrganic === false ? '' : partialPayload.organicCertification.trim();
  }
  if (partialPayload.allergens !== undefined) body.allergen_information = serializeAllergens(partialPayload.allergens);
  if (partialPayload.noKnownAllergensConfirmed !== undefined) {
    body.no_known_allergens_confirmed = partialPayload.noKnownAllergensConfirmed;
  }
  if (partialPayload.storageTips !== undefined) body.storage_tips = partialPayload.storageTips.trim();
  if (partialPayload.storageTipsAiGenerated !== undefined) {
    body.storage_tips_ai_generated = Boolean(partialPayload.storageTips?.trim() && partialPayload.storageTipsAiGenerated);
  }
  if (partialPayload.harvestDate !== undefined) body.harvest_date = partialPayload.harvestDate;
  if (partialPayload.imageUrl !== undefined) body.image_url = partialPayload.imageUrl;
  if (partialPayload.isSurplus !== undefined) body.is_surplus = partialPayload.isSurplus;
  if (partialPayload.surplusDiscountPercent !== undefined) {
    body.surplus_discount_percent = partialPayload.surplusDiscountPercent;
  }
  if (partialPayload.surplusExpiresAt !== undefined) body.surplus_expires_at = partialPayload.surplusExpiresAt || null;
  if (partialPayload.surplusBestBefore !== undefined) body.surplus_best_before = partialPayload.surplusBestBefore.trim();
  if (partialPayload.surplusNote !== undefined) body.surplus_note = partialPayload.surplusNote.trim();
  if (partialPayload.isSurplus === false) {
    body.surplus_discount_percent = null;
    body.surplus_expires_at = null;
    body.surplus_best_before = '';
    body.surplus_note = '';
  }
  if (partialPayload.availability !== undefined && partialPayload.availability !== 'in-season') {
    body.season_start_month = null;
    body.season_end_month = null;
  }

  void demoUserEmail;
  const product = await apiJson<BackendProduct>(`/api/producer/products/${productId}/`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return backendProductToFrontend(product);
}

export async function deleteProducerProductInApi(
  productId: string,
  demoUserEmail: string,
): Promise<void> {
  void demoUserEmail;
  await apiJson<null>(`/api/producer/products/${productId}/`, {
    method: 'DELETE',
  });
}

export async function fetchProducerProductHistoryFromApi(
  productId: string,
): Promise<ProducerProductHistoryEvent[]> {
  return apiJson<ProducerProductHistoryEvent[]>(`/api/producer/products/${productId}/history/`);
}
