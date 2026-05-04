/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Contains reusable helper functions for apiBase concerns across the frontend.
 *
 * Frontend context:
 *   Frontend utility layer: route helpers, token storage, API clients, formatting, maps, and domain helpers.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

/**
 * API base resolution helpers.
 *
 * The same frontend can run:
 * - inside Django on port 8000
 * - in a standalone Vite dev server
 *
 * When served by Django we intentionally use same-origin API paths so the SPA
 * and backend behave like one application.
 */
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isDjangoServedApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.port === '8000';
}

export function resolveApiPathBase(configuredValue: string | undefined, fallback = '/api'): string {
  if (isDjangoServedApp()) {
    return trimTrailingSlash(fallback);
  }

  return trimTrailingSlash(configuredValue || fallback);
}

export function resolveApiOriginBase(configuredValue: string | undefined, fallback = ''): string {
  if (isDjangoServedApp()) {
    return trimTrailingSlash(fallback);
  }

  return trimTrailingSlash(configuredValue || fallback);
}
