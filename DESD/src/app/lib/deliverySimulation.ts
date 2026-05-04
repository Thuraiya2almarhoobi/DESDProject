/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for deliverySimulation concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

export function getDeliverySimulationPollMs(): number {
  const seconds = Number(import.meta.env.VITE_DELIVERY_SIMULATION_POLL_SECONDS || 15);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 15000;
  }
  return Math.max(5000, Math.round(seconds * 1000));
}
