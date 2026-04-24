import { ArrowRight, Clock3, MapPin, ReceiptText, ShoppingBasket, Sprout, Truck } from 'lucide-react';
import { Link } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';

const operatingPrinciples = [
  {
    icon: Sprout,
    title: 'Local supply stays legible',
    body: 'Producer identity, product detail, and availability stay connected across browsing, checkout, and order history.',
  },
  {
    icon: MapPin,
    title: 'Distance is part of the decision',
    body: 'Food miles and location context help buyers compare local impact before they order.',
  },
  {
    icon: Truck,
    title: 'Delivery is operational, not decorative',
    body: 'Mixed baskets can stay clear because delivery timing is tracked through producer-specific order handling.',
  },
];

const timeline = [
  { label: 'Browse', text: 'Inspect products, producers, food miles, seasonal windows, allergens, and organic status.' },
  { label: 'Build', text: 'Add items from one or multiple producers while the cart keeps producer groups explicit.' },
  { label: 'Order', text: 'Complete checkout with delivery and payment details recorded against the order.' },
  { label: 'Track', text: 'Return to order history for receipts, reorder actions, and route status updates.' },
];

export function AboutPage() {
  return (
    <div className="market-page min-h-screen">
      <SiteHeader />

      <main>
        <section className="market-section market-section-cream">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="space-y-6">
              <h1 className="market-section-title max-w-4xl text-[oklch(0.23_0.034_87)]">
                A local-food system that keeps the operational detail visible.
              </h1>
            </div>
            <div className="space-y-6">
              <p className="market-copy">
                Local Food Marketplace is designed for direct local-food ordering without hiding where food comes from,
                how it moves, or who is responsible for fulfilment.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="market-button-primary min-h-11 px-7">
                  <Link to="/browse">
                    Browse marketplace
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="market-button-outline min-h-11 bg-white/45 px-7">
                  <Link to="/select-portal?mode=register">Create account</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="market-section market-section-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="space-y-4">
              <h2 className="max-w-xl text-4xl font-bold leading-tight text-[oklch(0.23_0.034_87)] sm:text-5xl">
                One marketplace base, several buying patterns.
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {operatingPrinciples.map((principle) => {
                const Icon = principle.icon;

                return (
                  <div key={principle.title} className="border-t-2 border-[var(--forest-green)] pt-5">
                    <Icon className="size-7 text-[var(--forest-green)]" />
                    <h3 className="mt-5 text-xl font-semibold text-[oklch(0.24_0.035_92)]">{principle.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[oklch(0.42_0.032_118)]">{principle.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="market-section market-section-green">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="space-y-5">
              <h2 className="market-section-title max-w-3xl">From inspection to receipt, the flow stays explicit.</h2>
              <p className="market-copy max-w-xl">
                The platform supports household ordering, community bulk buying, restaurant demand planning, and
                producer stock management without repeating the same generic marketplace steps on every page.
              </p>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-6 hidden h-[calc(100%-3rem)] w-px bg-white/24 sm:block" />
              <div className="space-y-5">
                {timeline.map((step, index) => (
                  <div key={step.label} className="relative grid gap-4 rounded-[1.25rem] bg-white/[0.08] p-5 sm:grid-cols-[4.5rem_1fr]">
                    <div className="flex size-12 items-center justify-center rounded-[1rem] bg-white text-[var(--forest-green)]">
                      {index === 0 ? <ShoppingBasket className="size-5" /> : index === 1 ? <ReceiptText className="size-5" /> : index === 2 ? <Truck className="size-5" /> : <Clock3 className="size-5" />}
                    </div>
                    <div>
                      <p className="text-xl font-semibold">{step.label}</p>
                      <p className="mt-2 text-sm leading-7 text-white/72">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="market-section market-section-brown">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:py-20 lg:grid-cols-[1fr_0.85fr] lg:items-center">
            <div className="space-y-5">
              <h2 className="market-section-title max-w-4xl">Start with public browsing, then choose the role you need.</h2>
            </div>
            <div className="space-y-5">
              <p className="market-copy">
                Visitors can inspect products, producers, and marketplace quality before signing in. Ordering remains
                gated behind authenticated buyer accounts so real purchases keep clean records.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="market-button-primary min-h-11 px-7">
                  <Link to="/browse">Open public browse</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="market-button-outline min-h-11 bg-white/45 px-7">
                  <Link to="/producers">Producer information</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
