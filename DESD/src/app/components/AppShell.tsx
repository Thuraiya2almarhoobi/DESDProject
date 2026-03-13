import { Outlet } from 'react-router';

import { RouteScrollManager } from './RouteScrollManager';

export function AppShell() {
  return (
    <>
      <RouteScrollManager />
      <Outlet />
    </>
  );
}
