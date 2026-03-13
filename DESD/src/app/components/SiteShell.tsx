import { Outlet } from 'react-router';

import { SiteFooter } from './SiteFooter';

export function SiteShell() {
  return (
    <>
      <Outlet />
      <SiteFooter />
    </>
  );
}
