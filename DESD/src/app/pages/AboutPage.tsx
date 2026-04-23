import { ArrowRight, MapPin, ShieldCheck, ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { Link } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const valueCards = [
  {
    icon: Sprout,
    title: 'Built around local supply',
    description:
      'The platform keeps producers, households, restaurants, and community buyers in one operational flow without hiding where food comes from.',
  },
  {
    icon: MapPin,
    title: 'Food miles kept visible',
    description:
      'Marketplace and product views surface location context and food miles so buyers can compare convenience with local impact.',
  },
  {
    icon: Truck,
    title: 'Coordinated delivery windows',
    description:
      'Orders can be grouped, split by producer when needed, and tracked through order history with clear delivery timing.',
  },
  {
    icon: ShieldCheck,
    title: 'Clearer account and order data',
    description:
      'Profiles, receipts, delivery settings, and order records stay explicit so users can manage repeat ordering cleanly.',
  },
];

const workflow = [
  'Browse local products, view producer details, and compare food miles before ordering.',
  'Add items to cart, including mixed baskets from different producers when needed.',
  'Complete checkout with delivery details and payment tracking recorded against the order.',
  'Return to order history for receipts, reorder actions, and current-order tracking.',
];

export function AboutPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,oklch(0.985_0.01_145),oklch(0.955_0.02_145))]">
      <SiteHeader />

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)] sm:text-5xl">
                Local ordering with clearer producer, delivery, and payment visibility.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[oklch(0.36_0.03_145)]">
                Local Food Marketplace is designed for direct local-food ordering without hiding the operational detail.
                Buyers can browse produce, understand delivery context, and track orders, while producers keep inventory
                and order handling in one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/browse">
                  Browse Marketplace
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Sign In</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/select-portal?mode=register">Create Account</Link>
              </Button>
            </div>
          </div>

          <Card className="border-[oklch(0.86_0.02_145)] bg-white/88 shadow-lg">
            <CardContent className="space-y-4 p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.45_0.05_145)]">
                  What the platform covers
                </p>
                <p className="mt-3 text-sm leading-6 text-[oklch(0.35_0.03_145)]">
                  Household ordering, community bulk buying, restaurant demand planning, and producer stock management
                  all sit on the same marketplace base.
                </p>
              </div>
              <div className="rounded-3xl border border-[oklch(0.9_0.02_145)] bg-[oklch(0.985_0.006_145)] p-4">
                <p className="text-sm font-semibold text-[oklch(0.24_0.03_145)]">Core user paths</p>
                <div className="mt-3 grid gap-3 text-sm leading-6 text-[oklch(0.36_0.03_145)]">
                  <p>Customers: marketplace, cart, checkout, receipts, reorder.</p>
                  <p>Producers: inventory, order inbox, payment visibility, content publishing.</p>
                  <p>Community and restaurant buyers: multi-producer ordering with role-specific workflows.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.45_0.05_145)]">Platform value</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)]">Why the marketplace is structured this way</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {valueCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border-[oklch(0.87_0.02_145)] bg-white/88 shadow-sm">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[oklch(0.95_0.03_145)]">
                      <Icon className="size-5 text-[oklch(0.45_0.08_145)]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-[oklch(0.24_0.02_145)]">{card.title}</h3>
                      <p className="text-sm leading-6 text-[oklch(0.36_0.03_145)]">{card.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="border-[oklch(0.86_0.02_145)] bg-white/88 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[oklch(0.95_0.03_145)]">
                  <ShoppingBasket className="size-5 text-[oklch(0.45_0.08_145)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[oklch(0.24_0.02_145)]">Ordering flow</h3>
                  <p className="text-sm text-[oklch(0.38_0.03_145)]">The platform is designed around an explicit operational path.</p>
                </div>
              </div>
              <div className="space-y-3">
                {workflow.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl border border-[oklch(0.9_0.02_145)] bg-[oklch(0.985_0.006_145)] p-4">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[oklch(0.94_0.05_145)] text-sm font-semibold text-[oklch(0.3_0.06_145)]">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-[oklch(0.35_0.03_145)]">{step}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[oklch(0.84_0.03_145)] bg-[linear-gradient(145deg,white,oklch(0.98_0.01_145))] shadow-lg">
            <CardContent className="space-y-5 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.45_0.05_145)]">Useful next step</p>
              <h3 className="text-2xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)]">
                Browse the public marketplace before creating an account.
              </h3>
              <p className="max-w-2xl text-sm leading-7 text-[oklch(0.36_0.03_145)]">
                Public browsing is read-only by design. Visitors can inspect products, producers, and marketplace
                quality before signing in, while ordering remains gated behind authenticated buyer accounts.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/browse">Open Public Browse</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/producers">Producer Information</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
