/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for deliveryTracking concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { ApiDeliveryInfo } from './api';

type DeliveryCoordinates = { lat: number; lng: number };

/**
 * TERMINAL_DELIVERY_STATUSES boundary.
 *
 * This exported unit supports the file role: Contains reusable helper functions for deliveryTracking concerns across the frontend.
 * It belongs to: Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
const TERMINAL_DELIVERY_STATUSES = new Set(['delivered', 'cancelled', 'failed']);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolateCoordinates(
  from: DeliveryCoordinates,
  to: DeliveryCoordinates,
  progress: number,
): DeliveryCoordinates {
  const safeProgress = clamp(progress, 0, 1);
  return {
    lat: from.lat + (to.lat - from.lat) * safeProgress,
    lng: from.lng + (to.lng - from.lng) * safeProgress,
  };
}

function getSnapshotCoordinates(
  snapshot?: ApiDeliveryInfo['pickup_address_snapshot'] | ApiDeliveryInfo['dropoff_address_snapshot'] | null,
): DeliveryCoordinates | null {
  const coordinates = snapshot?.coordinates;
  if (!coordinates) {
    return null;
  }
  if (!Number.isFinite(coordinates.lat) || !Number.isFinite(coordinates.lng)) {
    return null;
  }
  return coordinates;
}

export function isTerminalDeliveryStatus(status?: string | null): boolean {
  return Boolean(status && TERMINAL_DELIVERY_STATUSES.has(status));
}

export function isSimulatedSandboxDelivery(delivery?: ApiDeliveryInfo | null): boolean {
  return Boolean(
    delivery?.test_mode &&
      delivery.simulation_started_at &&
      delivery.simulation_duration_seconds &&
      delivery.simulation_duration_seconds > 0 &&
      !isTerminalDeliveryStatus(delivery.status),
  );
}

export function getEffectiveDeliveryStatus(delivery?: ApiDeliveryInfo | null, nowMs = Date.now()): string | null {
  if (!isSimulatedSandboxDelivery(delivery)) {
    return delivery?.status || null;
  }

  const startedAt = Date.parse(delivery!.simulation_started_at!);
  if (!Number.isFinite(startedAt)) {
    return delivery?.status || null;
  }

  const durationMs = Math.max(1, Number(delivery!.simulation_duration_seconds) * 1000);
  const progress = clamp((nowMs - startedAt) / durationMs, 0, 1);

  if (progress >= 1) {
    return 'delivered';
  }
  if (progress < 0.10) {
    return 'assigned';
  }
  if (progress < 0.25) {
    return 'picking_up';
  }
  if (progress < 0.40) {
    return 'picked_up';
  }
  return 'delivering';
}

export function getEffectiveDeliveryEta(delivery?: ApiDeliveryInfo | null, nowMs = Date.now()): string | null | undefined {
  if (!isSimulatedSandboxDelivery(delivery)) {
    return delivery?.eta;
  }

  const startedAt = Date.parse(delivery!.simulation_started_at!);
  if (!Number.isFinite(startedAt)) {
    return delivery?.eta;
  }

  const durationMs = Math.max(1, Number(delivery!.simulation_duration_seconds) * 1000);
  const completionMs = startedAt + durationMs;
  return new Date(Math.max(nowMs, completionMs)).toISOString();
}

export function getEffectiveCourierCoordinates(
  delivery?: ApiDeliveryInfo | null,
  nowMs = Date.now(),
): DeliveryCoordinates | null {
  if (!isSimulatedSandboxDelivery(delivery)) {
    return delivery?.last_coordinates || null;
  }

  const pickupCoordinates = getSnapshotCoordinates(delivery?.pickup_address_snapshot);
  const dropoffCoordinates = getSnapshotCoordinates(delivery?.dropoff_address_snapshot);
  if (!pickupCoordinates || !dropoffCoordinates) {
    return delivery?.last_coordinates || null;
  }

  const startedAt = Date.parse(delivery!.simulation_started_at!);
  if (!Number.isFinite(startedAt)) {
    return delivery?.last_coordinates || null;
  }

  const durationMs = Math.max(1, Number(delivery!.simulation_duration_seconds) * 1000);
  const progress = clamp((nowMs - startedAt) / durationMs, 0, 1);
  const effectiveStatus = getEffectiveDeliveryStatus(delivery, nowMs);

  if (effectiveStatus === 'assigned' || effectiveStatus === 'picking_up' || effectiveStatus === 'picked_up') {
    return pickupCoordinates;
  }
  if (effectiveStatus === 'delivered') {
    return dropoffCoordinates;
  }

  const routeProgress = clamp((progress - 0.40) / 0.60, 0, 1);
  return interpolateCoordinates(pickupCoordinates, dropoffCoordinates, routeProgress);
}

export function getSimulationCompletionMs(delivery?: ApiDeliveryInfo | null): number | null {
  if (!isSimulatedSandboxDelivery(delivery)) {
    return null;
  }
  const startedAt = Date.parse(delivery!.simulation_started_at!);
  if (!Number.isFinite(startedAt)) {
    return null;
  }
  return startedAt + Math.max(1, Number(delivery!.simulation_duration_seconds) * 1000);
}
