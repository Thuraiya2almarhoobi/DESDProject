import { ArrowRight, BadgeCheck, Boxes, ClipboardList, Images, TrendingUp, Wallet } from 'lucide-react';
import { Link } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';
import { getPortalDefinition } from '../lib/portalConfig';

const producerDefinition = getPortalDefinition('PRODUCER');

const capabilities = [
  {
    icon: Boxes,
    title: 'Stock that reflects reality',
    body: 'Add products, update quantities, set harvest windows, and keep availability aligned with what can actually be sold.',
  },
  {
    icon: ClipboardList,
    title: 'Orders with fulfilment context',
    body: 'Incoming orders, producer-specific status, and delivery timing stay visible so fulfilment is easier to manage.',
  },
  {
    icon: Wallet,
    title: 'Payout visibility',
    body: 'Payment records and order totals remain close to stock movement, making settlement easier to check.',
  },
];

const productRequirements = [
  'Stock and unit pricing',
  'Harvest date and seasonal window',
  'Allergens and organic status',
  'Product imagery and producer story',
];

export function ProducersPage() {
  return (
    <div className="market-page min-h-screen">
      <SiteHeader />

      <main>
        <section className="market-section market-section-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="space-y-6">
              <h1 className="market-section-title max-w-4xl text-[oklch(0.23_0.034_87)]">
                A selling workflow for food that changes by season, stock, and route.
              </h1>
              <p className="market-copy max-w-2xl">
                {producerDefinition.portalDescription} This page explains the producer flow before entering the portal.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="market-button-primary min-h-11 px-7">
                  <Link to={producerDefinition.portalPath}>
                    Producer portal
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="market-button-outline min-h-11 bg-white/45 px-7">
                  <Link to={producerDefinition.registerPath ?? '/select-portal?mode=register'}>
                    Create producer account
                  </Link>
                </Button>
              </div>
            </div>

            <div className="market-display-panel overflow-hidden rounded-[2rem]">
              <div className="bg-[var(--forest-green)] p-6 text-white">
                <p className="text-sm text-white/62">Producer dashboard preview</p>
                <p className="mt-2 text-3xl font-semibold">Inventory, orders, payouts</p>
              </div>
              <div className="grid gap-px bg-[oklch(0.84_0.035_100)] md:grid-cols-2">
                {productRequirements.map((item, index) => (
                  <div key={item} className="bg-white/76 p-5">
                    <p className="text-sm font-semibold text-[var(--forest-green)]">0{index + 1}</p>
                    <p className="mt-3 text-lg font-semibold text-[oklch(0.26_0.035_92)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="market-section market-section-brown">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="space-y-5">
              <h2 className="market-section-title max-w-3xl">The producer tools are practical first.</h2>
              <p className="market-copy max-w-xl">
                The portal is built for changing stock, visible fulfilment, and clear payment context rather than a
                generic storefront profile.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {capabilities.map((capability) => {
                const Icon = capability.icon;

                return (
                  <div key={capability.title} className="border-t border-[#e4e1d8] pt-5">
                    <Icon className="size-7 text-[var(--forest-green)]" />
                    <h3 className="mt-5 text-xl font-semibold">{capability.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[oklch(0.42_0.032_118)]">{capability.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="market-section market-section-cream">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="grid gap-1 overflow-hidden rounded-[2rem] border border-[oklch(0.84_0.035_100)] bg-[var(--forest-green)] p-1 text-white sm:grid-cols-2">
              <div className="min-h-[15rem] bg-white/[0.08] p-6">
                <Images className="size-7 text-white/70" />
                <p className="mt-16 text-2xl font-semibold">Recipes and farm stories</p>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  Producers can publish content that helps customers understand products beyond the listing alone.
                </p>
              </div>
              <div className="min-h-[15rem] bg-white/[0.08] p-6">
                <TrendingUp className="size-7 text-white/70" />
                <p className="mt-16 text-2xl font-semibold">Demand from several buyer types</p>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  Customer, community, and restaurant ordering flows can all surface producer stock.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <h2 className="market-section-title max-w-3xl text-[oklch(0.23_0.034_87)]">
                Sell locally without losing control of the details.
              </h2>
              <p className="market-copy max-w-xl">{producerDefinition.highlight}</p>
              <div className="space-y-4">
                {[
                  'Sold quantities flow back into inventory management.',
                  'Role-specific producer operations stay separate from buyer workflows.',
                  'Product context remains visible to customers before checkout.',
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3 border-t border-[oklch(0.84_0.035_100)] pt-4">
                    <BadgeCheck className="mt-0.5 size-5 shrink-0 text-[var(--forest-green)]" />
                    <p className="text-sm leading-7 text-[oklch(0.42_0.032_118)]">{item}</p>
                  </div>
                ))}
              </div>
              <Button asChild size="lg" className="market-button-brown min-h-11 px-7">
                <Link to="/browse">See the public marketplace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
