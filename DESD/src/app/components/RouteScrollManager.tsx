import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

export function RouteScrollManager() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.history.scrollRestoration = 'manual';
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  return null;
}

