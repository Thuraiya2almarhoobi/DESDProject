import { ArrowRight, ShoppingBasket, Store, Truck } from 'lucide-react';
import { Link } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const marketSignals = [
  {
    label: 'Local producers',
    value: '28',
    detail: 'Fresh produce, dairy, and pantry staples',
    icon: Store,
  },
  {
    label: 'Orders moving today',
    value: '146',
    detail: 'Mixed baskets, community supply, and restaurant runs',
    icon: ShoppingBasket,
  },
  {
    label: 'Delivery coordination',
    value: '48h',
    detail: 'Average lead time across the Bristol network',
    icon: Truck,
  },
];

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,oklch(0.99_0.008_145),oklch(0.955_0.022_145))]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-7rem] h-80 w-80 rounded-full bg-[oklch(0.9_0.05_145/.38)] blur-3xl" />
        <div className="absolute right-[-8rem] top-16 h-96 w-96 rounded-full bg-[oklch(0.94_0.04_70/.28)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.89_0.05_200/.16)] blur-3xl" />
      </div>

      <div className="relative z-10">
        <SiteHeader />
      </div>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-20">
          <div className="space-y-8">
            <Badge className="rounded-full border border-[oklch(0.82_0.03_145)] bg-white/85 px-4 py-1 text-[0.7rem] font-semibold tracking-[0.22em] text-[oklch(0.42_0.05_145)] uppercase shadow-sm">
              Local food buying, simplified
            </Badge>

            <div className="space-y-5">
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-[oklch(0.22_0.02_145)] sm:text-6xl">
                Buy local today.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[oklch(0.36_0.03_145)]">
                Shop fresh produce from Bristol suppliers, place repeat restaurant orders, or coordinate community
                deliveries through one marketplace with role-based entry points.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="min-w-36">
                <Link to="/select-portal">
                  Buy today
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-w-32">
                <Link to="/select-portal?mode=login">Sign In</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="min-w-32">
                <Link to="/select-portal?mode=register">Sign Up</Link>
              </Button>
            </div>

            <p className="text-sm text-[oklch(0.36_0.03_145)]">
              Are you a producer?{' '}
              <Link
                to="/portal/producer"
                className="font-semibold text-[oklch(0.44_0.08_150)] underline decoration-[oklch(0.72_0.05_145)] underline-offset-4"
              >
                Join now
              </Link>
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              {marketSignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <Card key={signal.label} className="border-[oklch(0.86_0.02_145)] bg-white/84 shadow-sm">
                    <CardContent className="space-y-3 p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[oklch(0.95_0.03_145)]">
                        <Icon className="size-5 text-[oklch(0.46_0.08_145)]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] text-[oklch(0.45_0.05_145)] uppercase">
                          {signal.label}
                        </p>
                        <p className="mt-2 text-3xl font-semibold text-[oklch(0.24_0.02_145)]">{signal.value}</p>
                        <p className="mt-2 text-sm leading-6 text-[oklch(0.36_0.03_145)]">{signal.detail}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
