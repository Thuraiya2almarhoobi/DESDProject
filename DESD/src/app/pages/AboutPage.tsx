import { ArrowRight, MapPin, Sprout, Truck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';

import heroRouteImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.33 (11).jpeg';
import supplyImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.33 (4).jpeg';
import distanceImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.33 (8).jpeg';
import deliveryImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.33 (13).jpeg';
import browseImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.34.jpeg';
import buildImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.33 (14).jpeg';
import orderImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.34 (4).jpeg';
import trackImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.33 (9).jpeg';
import publicBrowsingImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.33 (15).jpeg';
import producerRoleImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.34 (7).jpeg';
import { MarketingImageCard } from '../components/MarketingImageCard';
import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';

const operatingPrinciples = [
  {
    icon: Sprout,
    title: 'Local supply stays legible',
    body: 'Producer identity, product detail, and availability stay connected across browsing, checkout, and order history.',
    image: supplyImage,
    alt: 'Cattle grazing in a local field, representing clearly visible producer-side supply.',
    label: 'Local producers',
    imagePosition: 'object-center',
  },
  {
    icon: MapPin,
    title: 'Distance is part of the decision',
    body: 'Food miles and location context help buyers compare local impact before they order.',
    image: distanceImage,
    alt: 'Bristol waterfront landscape representing visible local geography and route context.',
    label: 'Food miles',
    imagePosition: 'object-center',
  },
  {
    icon: Truck,
    title: 'Delivery is operational, not decorative',
    body: 'Mixed baskets can stay clear because delivery timing is tracked through producer-specific order handling.',
    image: deliveryImage,
    alt: 'Fresh produce arranged together to represent delivery planning and fulfilment.',
    label: 'Delivery planning',
    imagePosition: 'object-center',
  },
] satisfies Array<{
  icon: LucideIcon;
  title: string;
  body: string;
  image: string;
  alt: string;
  label: string;
  imagePosition?: string;
}>;

const timeline = [
  {
    number: '01',
    label: 'Browse',
    text: 'Inspect products, producers, food miles, seasonal windows, allergens, and organic status.',
    image: browseImage,
    alt: 'Top-down market produce display representing browsing the marketplace.',
    imagePosition: 'object-center',
  },
  {
    number: '02',
    label: 'Build',
    text: 'Add items from one or multiple producers while the cart keeps producer groups explicit.',
    image: buildImage,
    alt: 'A grouped fruit display representing building a basket from local produce.',
    imagePosition: 'object-center',
  },
  {
    number: '03',
    label: 'Order',
    text: 'Complete checkout with delivery and payment details recorded against the order.',
    image: orderImage,
    alt: 'Shelved produce prepared for selection and fulfilment, representing ordering.',
    imagePosition: 'object-center',
  },
  {
    number: '04',
    label: 'Track',
    text: 'Return to order history for receipts, reorder actions, and route status updates.',
    image: trackImage,
    alt: 'A local waterside route and neighbourhood view representing delivery tracking.',
    imagePosition: 'object-center',
  },
];

const roleVisuals = [
  {
    image: publicBrowsingImage,
    alt: 'Fresh strawberries and produce representing public browsing of local food options.',
    label: 'Public browsing',
    body: 'Inspect products, producers, and marketplace detail before any account is required.',
    imagePosition: 'object-center',
  },
  {
    image: producerRoleImage,
    alt: 'Sheep in a local field representing the producer side of the marketplace.',
    label: 'Producer role',
    body: 'Switch into producer tools only when you need to manage stock, orders, and product context.',
    imagePosition: 'object-center',
  },
];

export function AboutPage() {
  return (
    <div className="market-page min-h-screen">
      <SiteHeader />

      <main>
        <section className="market-section market-section-cream relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <img src={heroRouteImage} alt="" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(249,246,238,0.98)_0%,rgba(249,246,238,0.96)_16%,rgba(249,246,238,0.88)_28%,rgba(249,246,238,0.52)_42%,rgba(249,246,238,0.12)_58%,rgba(17,31,21,0.14)_74%,rgba(17,31,21,0.42)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(249,246,238,0.08)_0%,rgba(249,246,238,0.02)_32%,rgba(17,31,21,0.24)_100%)]" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-20">
            <div className="max-w-3xl space-y-6 lg:min-h-[30rem] lg:content-center lg:py-8">
              <h1 className="market-section-title max-w-4xl text-[oklch(0.23_0.034_87)]">
                A local-food system that keeps the operational detail visible.
              </h1>
              <p className="market-copy max-w-2xl">
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
          <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
            <div className="max-w-3xl space-y-4">
              <h2 className="text-4xl font-bold leading-tight text-[oklch(0.23_0.034_87)] sm:text-5xl">
                One marketplace base, several buying patterns.
              </h2>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {operatingPrinciples.map((principle) => (
                <MarketingImageCard
                  key={principle.title}
                  image={principle.image}
                  alt={principle.alt}
                  label={principle.label}
                  title={principle.title}
                  body={principle.body}
                  icon={principle.icon}
                  imagePosition={principle.imagePosition}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="market-section market-section-green">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
            <div className="max-w-3xl space-y-5">
              <h2 className="market-section-title max-w-3xl">From inspection to receipt, the flow stays explicit.</h2>
              <p className="market-copy max-w-2xl text-white/82">
                The platform supports household ordering, community bulk buying, restaurant demand planning, and
                producer stock management without repeating the same generic marketplace steps on every page.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {timeline.map((step) => (
                <article
                  key={step.label}
                  className="relative min-h-[18.5rem] overflow-hidden rounded-[1.3rem] border border-white/12 bg-white/[0.08] shadow-[0_16px_34px_rgba(9,22,13,0.16)]"
                >
                  <img src={step.image} alt={step.alt} className={`absolute inset-0 h-full w-full ${step.imagePosition} object-cover`} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,21,13,0.18)_0%,rgba(9,21,13,0.52)_42%,rgba(9,21,13,0.9)_100%)]" />
                  <div className="relative z-10 flex h-full flex-col justify-between p-5 text-white">
                    <span className="flex w-fit items-center gap-2 rounded-full bg-white/14 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/92 backdrop-blur-sm">
                      <span className="flex size-7 items-center justify-center rounded-full bg-white text-[0.7rem] font-bold text-[var(--forest-green)]">
                        {step.number}
                      </span>
                      {step.label}
                    </span>

                    <p className="max-w-xs text-sm leading-7 text-white/82">{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="market-section market-section-brown">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:py-20 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="space-y-5">
              <h2 className="market-section-title max-w-4xl">Start with public browsing, then choose the role you need.</h2>
              <p className="market-copy max-w-2xl">
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

            <div className="grid gap-4 sm:grid-cols-2">
              {roleVisuals.map((visual) => (
                <article
                  key={visual.label}
                  className="relative min-h-[22rem] overflow-hidden rounded-[1.45rem] border border-white/18 bg-white/72 shadow-[0_18px_42px_rgba(18,28,20,0.12)]"
                >
                  <img src={visual.image} alt={visual.alt} className={`absolute inset-0 h-full w-full ${visual.imagePosition} object-cover`} />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,28,19,0.18)_0%,rgba(16,28,19,0.46)_38%,rgba(16,28,19,0.84)_100%)]" />
                  <div className="relative z-10 flex h-full flex-col justify-end p-5">
                    <div className="space-y-3 rounded-[1.25rem] border border-white/16 bg-[rgba(248,251,247,0.12)] p-4 text-white backdrop-blur-sm">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/82">{visual.label}</p>
                      <p className="text-base leading-7 text-white/88">{visual.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
