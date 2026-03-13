import { mockProducts } from "../data/mockData";
import { getBasicAuthToken } from "../lib/api";
import { getAccessToken } from "../lib/tokenStorage";
import { AvailabilityType, Product, ProductReview, ProductUnit } from "../types";

const API_BASE_URL =
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api").replace(/\/+$/, "");
const ORDERS_API_BASE_URL = `${API_BASE_URL}/orders`;
const USE_MOCK_PRODUCTS =
  ((import.meta.env.VITE_USE_MOCK_PRODUCTS as string | undefined) || "").toLowerCase() === "true";
const DEFAULT_IMAGE_URL =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800";

interface ProductQueryParams {
  search?: string;
  category?: string;
  organic?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

interface ApiCategory {
  id: number;
  name: string;
  slug: string;
}

interface ApiReview {
  id: number;
  user_id?: number | null;
  reviewer_name?: string;
  rating?: number;
  comment?: string;
  verified_purchase?: boolean;
  created_at?: string;
}

interface CreateReviewPayload {
  rating: number;
  comment: string;
}

interface ApiProduct {
  id: number;
  name?: string;
  description?: string;
  price?: number | string;
  unit?: string;
  producer_id?: number;
  producer_name?: string;
  producer_location?: string;
  producer_description?: string;
  producer_delivery_lead_time?: number;
  producer_postcode?: string;
  producer_latitude?: number | string | null;
  producer_longitude?: number | string | null;
  category?: string;
  category_slug?: string;
  harvest_date?: string;
  availability?: string;
  seasonal_dates?: string;
  is_organic?: boolean;
  organic_certification?: string;
  allergens?: unknown;
  image_url?: string;
  stock?: number;
  food_miles?: number;
  is_surplus?: boolean;
  surplus_discount?: number | null;
  surplus_original_price?: number | string | null;
  surplus_expires_at?: string | null;
  surplus_best_before?: string;
  storage_tips?: string;
  recipe_ideas?: unknown;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeAllergens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeRecipeIdeas(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  return [];
}

function normalizeUnit(unit: string | undefined): ProductUnit {
  if (unit === "kg" || unit === "litre" || unit === "dozen" || unit === "each") {
    return unit;
  }
  return "each";
}

function normalizeAvailability(value: string | undefined): AvailabilityType {
  if (value === "in-season" || value === "year-round" || value === "unavailable") {
    return value;
  }
  return "year-round";
}

function deriveSeasonalDates(product: ApiProduct): string | undefined {
  if (product.seasonal_dates) {
    return product.seasonal_dates;
  }
  return undefined;
}

function mapProduct(apiProduct: ApiProduct): Product {
  const producerLatitude = toNumber(apiProduct.producer_latitude);
  const producerLongitude = toNumber(apiProduct.producer_longitude);
  const parsedPrice = toNumber(apiProduct.price) ?? 0;
  const parsedOriginalPrice = toNumber(apiProduct.surplus_original_price);
  const parsedStock = toNumber(apiProduct.stock) ?? 0;
  const parsedFoodMiles = toNumber(apiProduct.food_miles) ?? 0;

  return {
    id: String(apiProduct.id),
    name: apiProduct.name || "Unnamed Product",
    description: apiProduct.description || "",
    price: parsedPrice,
    unit: normalizeUnit(apiProduct.unit),
    producerId: String(apiProduct.producer_id || ""),
    producerName: apiProduct.producer_name || "Unknown Producer",
    producerLocation: apiProduct.producer_location || "Unknown location",
    producerDescription: apiProduct.producer_description || undefined,
    producerDeliveryLeadTime: apiProduct.producer_delivery_lead_time || 48,
    producerPostcode: apiProduct.producer_postcode || undefined,
    producerCoordinates:
      producerLatitude !== null && producerLongitude !== null
        ? { lat: producerLatitude, lng: producerLongitude }
        : undefined,
    category: apiProduct.category || "Uncategorized",
    harvestDate: apiProduct.harvest_date || new Date().toISOString().slice(0, 10),
    availability: normalizeAvailability(apiProduct.availability),
    seasonalDates: deriveSeasonalDates(apiProduct),
    isOrganic: Boolean(apiProduct.is_organic),
    organicCertification: apiProduct.organic_certification || undefined,
    allergens: normalizeAllergens(apiProduct.allergens),
    imageUrl: apiProduct.image_url || DEFAULT_IMAGE_URL,
    stock: parsedStock,
    foodMiles: parsedFoodMiles,
    isSurplus: Boolean(apiProduct.is_surplus),
    surplusDiscount: apiProduct.surplus_discount ?? undefined,
    surplusOriginalPrice: parsedOriginalPrice ?? undefined,
    surplusExpiresAt: apiProduct.surplus_expires_at || undefined,
    surplusBestBefore: apiProduct.surplus_best_before || undefined,
    storageTips: apiProduct.storage_tips || undefined,
    recipeIdeas: normalizeRecipeIdeas(apiProduct.recipe_ideas),
  };
}

function mapReview(review: ApiReview): ProductReview {
  return {
    id: String(review.id),
    userId: review.user_id === null || review.user_id === undefined ? undefined : String(review.user_id),
    reviewerName: review.reviewer_name || "Anonymous",
    rating: review.rating || 0,
    comment: review.comment || "",
    verifiedPurchase: Boolean(review.verified_purchase),
    createdAt: review.created_at || new Date().toISOString(),
  };
}

function applyMockFilters(products: Product[], params: ProductQueryParams): Product[] {
  return products.filter((product) => {
    if (params.search) {
      const query = params.search.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.producerName.toLowerCase().includes(query);
      if (!matchesSearch) {
        return false;
      }
    }

    if (params.category) {
      const categories = params.category
        .split(",")
        .map((category) => category.trim().toLowerCase())
        .filter(Boolean);
      if (categories.length > 0) {
        const productCategory = product.category.toLowerCase();
        if (!categories.includes(productCategory)) {
          return false;
        }
      }
    }

    if (params.organic === true && !product.isOrganic) {
      return false;
    }

    if (params.minPrice !== undefined && product.price < params.minPrice) {
      return false;
    }

    if (params.maxPrice !== undefined && product.price > params.maxPrice) {
      return false;
    }

    return true;
  });
}

function errorMessageFromPayload(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        return value;
      }
      if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
        return value[0];
      }
    }
  }
  return fallback;
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (!headers.has("Authorization")) {
    const accessToken = getAccessToken();
    const basicToken = getBasicAuthToken();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    } else if (basicToken) {
      headers.set("Authorization", `Basic ${basicToken}`);
    }
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });
  const payload = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(errorMessageFromPayload(payload, `Request failed (${response.status})`));
  }
  return payload as T;
}

function buildProductsQueryString(params: ProductQueryParams): string {
  const query = new URLSearchParams();
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.category) {
    query.set("category", params.category);
  }
  if (params.organic === true) {
    query.set("organic", "true");
  }
  if (params.minPrice !== undefined) {
    query.set("min_price", String(params.minPrice));
  }
  if (params.maxPrice !== undefined) {
    query.set("max_price", String(params.maxPrice));
  }
  return query.toString();
}

export async function fetchProducts(params: ProductQueryParams = {}): Promise<Product[]> {
  if (USE_MOCK_PRODUCTS) {
    return applyMockFilters(mockProducts, params);
  }

  const queryString = buildProductsQueryString(params);
  const baseUrl = `${ORDERS_API_BASE_URL}/products`;
  const url = queryString ? `${baseUrl}?available=true&${queryString}` : `${baseUrl}?available=true`;
  const data = await requestJson<ApiProduct[]>(url);
  return data.map(mapProduct);
}

export async function fetchProductById(productId: string): Promise<Product> {
  if (USE_MOCK_PRODUCTS) {
    const product = mockProducts.find((item) => item.id === productId);
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }

  const data = await requestJson<ApiProduct>(`${ORDERS_API_BASE_URL}/products/${productId}/`);
  return mapProduct(data);
}

export async function fetchCategories(): Promise<string[]> {
  if (USE_MOCK_PRODUCTS) {
    return Array.from(new Set(mockProducts.map((product) => product.category))).sort();
  }

  const products = await requestJson<ApiProduct[]>(`${ORDERS_API_BASE_URL}/products/?available=true`);
  return Array.from(new Set(products.map((product) => product.category || "Uncategorised"))).sort();
}

export async function fetchProductReviews(productId: string): Promise<ProductReview[]> {
  if (USE_MOCK_PRODUCTS) {
    return [];
  }

  const reviews = await requestJson<ApiReview[]>(`${ORDERS_API_BASE_URL}/products/${productId}/reviews/`);
  return reviews.map(mapReview);
}

export async function createProductReview(
  productId: string,
  payload: CreateReviewPayload,
): Promise<ProductReview> {
  if (USE_MOCK_PRODUCTS) {
    throw new Error("Review submission is unavailable while mock catalog data is enabled.");
  }

  const review = await requestJson<ApiReview>(`${ORDERS_API_BASE_URL}/products/${productId}/reviews/`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapReview(review);
}
