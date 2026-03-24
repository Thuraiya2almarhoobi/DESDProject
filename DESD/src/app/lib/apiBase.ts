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
