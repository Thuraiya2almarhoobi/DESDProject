import { SiteHeader } from './SiteHeader';

type MarketingAuthNavProps = {
  active?: 'login' | 'register' | null;
};

export function MarketingAuthNav({ active: _active = null }: MarketingAuthNavProps) {
  return <SiteHeader />;
}
