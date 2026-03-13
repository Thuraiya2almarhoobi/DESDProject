import { Product, AvailabilityType } from '../types';

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
  stock_quantity: number;
  allergen_information: string | string[];
  harvest_date: string;
  image_url: string;
  is_surplus: boolean;
  surplus_discount_percent: number | null;
}

interface ProducerCreatePayload {
  name: string;
  category: string;
  description: string;
  price: number;
  unit: Product['unit'];
  availability: AvailabilityType;
  stock: number;
  allergens?: string[];
  harvestDate: string;
  imageUrl?: string;
  isSurplus?: boolean;
  surplusDiscountPercent?: number;
}

const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
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
  const allergens = parseAllergens(product.allergen_information);
  const price = Number(product.price);
  const discount = product.surplus_discount_percent ?? undefined;
  const originalPrice = discount ? Number((price / (1 - discount / 100)).toFixed(2)) : undefined;

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
    availability: toFrontendAvailability(product.availability),
    seasonalDates: product.availability === 'in_season' ? 'Current season' : undefined,
    isOrganic: /organic/i.test(product.name) || /organic/i.test(product.description),
    allergens,
    imageUrl: product.image_url || 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800',
    stock: product.stock_quantity,
    foodMiles: 12,
    isSurplus: product.is_surplus,
    surplusDiscount: discount,
    surplusOriginalPrice: originalPrice,
    surplusExpiresAt: discount ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() : undefined,
    surplusBestBefore: discount ? '2 days' : undefined,
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
  const res = await fetch(apiUrl('/api/producer/public/products/'));
  const products = await parseResponse<BackendProduct[]>(res);
  return products.map(backendProductToFrontend);
}

export async function fetchProducerProductsFromApi(demoUserEmail: string): Promise<Product[]> {
  const res = await fetch(apiUrl('/api/producer/products/'), {
    headers: {
      'X-Demo-User': demoUserEmail,
    },
  });
  const products = await parseResponse<BackendProduct[]>(res);
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
    stock_quantity: payload.stock,
    allergen_information: serializeAllergens(payload.allergens),
    harvest_date: payload.harvestDate,
    image_url: payload.imageUrl ?? '',
    is_surplus: Boolean(payload.isSurplus),
    surplus_discount_percent: payload.isSurplus ? payload.surplusDiscountPercent ?? 20 : null,
  };

  const res = await fetch(apiUrl('/api/producer/products/'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-User': demoUserEmail,
    },
    body: JSON.stringify(body),
  });
  const product = await parseResponse<BackendProduct>(res);
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
  if (partialPayload.stock !== undefined) body.stock_quantity = partialPayload.stock;
  if (partialPayload.allergens !== undefined) body.allergen_information = serializeAllergens(partialPayload.allergens);
  if (partialPayload.harvestDate !== undefined) body.harvest_date = partialPayload.harvestDate;
  if (partialPayload.imageUrl !== undefined) body.image_url = partialPayload.imageUrl;
  if (partialPayload.isSurplus !== undefined) body.is_surplus = partialPayload.isSurplus;
  if (partialPayload.surplusDiscountPercent !== undefined) {
    body.surplus_discount_percent = partialPayload.surplusDiscountPercent;
  }
  if (partialPayload.isSurplus === false) {
    body.surplus_discount_percent = null;
  }

  const res = await fetch(apiUrl(`/api/producer/products/${productId}/`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-User': demoUserEmail,
    },
    body: JSON.stringify(body),
  });
  const product = await parseResponse<BackendProduct>(res);
  return backendProductToFrontend(product);
}


