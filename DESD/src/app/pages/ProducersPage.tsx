import { ArrowRight, BadgeCheck, Boxes, ClipboardList, Wallet } from 'lucide-react';
import { Link } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { getPortalDefinition } from '../lib/portalConfig';

const producerDefinition = getPortalDefinition('PRODUCER');

const producerBenefits = [
  {
    icon: Boxes,
    title: 'Manage inventory in one place',
    description:
      'Add products, update stock, upload images, and keep marketplace availability aligned with what can actually be sold.',
  },
  {
    icon: ClipboardList,
    title: 'Track incoming orders clearly',
    description:
      'Producer workflows include order inboxes, delivery timing, and status progression so fulfilment is explicit rather than hidden.',
  },
  {
    icon: Wallet,
    title: 'Keep payout visibility',
    description:
      'Payment records and order totals stay visible alongside stock movement so sold quantities and settlement context line up.',
  },
  {
    icon: BadgeCheck,
    title: 'Publish recipes and stories',
    description:
      'Producer content can surface recipes and farm stories to help customers understand products beyond the listing alone.',
  },
];

const producerHighlights = [
  'List products with stock, harvest dates, allergens, pricing, and imagery.',
  'Receive marketplace demand from customer, community, and restaurant ordering flows.',
  'See sold stock reflected back into producer inventory management.',
  'Use the same platform without losing role-specific producer operations.',
];

export function ProducersPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,oklch(0.985_0.01_145),oklch(0.955_0.02_145))]">
      <SiteHeader />

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:py-14">
        <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6">
            <Badge className="rounded-full border border-[oklch(0.82_0.03_145)] bg-white/80 px-4 py-1 text-[0.7rem] font-semibold tracking-[0.22em] text-[oklch(0.42_0.05_145)] uppercase shadow-sm">
              {producerDefinition.title}
            </Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)] sm:text-5xl">
                Sell through a producer workflow that stays operationally clear.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-[oklch(0.36_0.03_145)]">
                {producerDefinition.portalDescription} This page is for understanding the producer side before entering
                the producer portal itself.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={producerDefinition.portalPath}>
                  Producer Portal
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={producerDefinition.registerPath ?? '/select-portal?mode=register'}>Create Producer Account</Link>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <Link to="/browse">Browse Marketplace</Link>
              </Button>
            </div>
          </div>

          <Card className="border-[oklch(0.84_0.03_145)] bg-[linear-gradient(145deg,white,oklch(0.98_0.01_145))] shadow-lg">
            <CardContent className="space-y-4 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.45_0.05_145)]">Producer fit</p>
              <p className="text-sm leading-6 text-[oklch(0.35_0.03_145)]">
                {producerDefinition.highlight}
              </p>
              <div className="space-y-3">
                {producerHighlights.map((highlight) => (
                  <div key={highlight} className="rounded-2xl border border-[oklch(0.9_0.02_145)] bg-white/80 p-4 text-sm leading-6 text-[oklch(0.34_0.03_145)]">
                    {highlight}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-5">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[oklch(0.45_0.05_145)]">Producer capabilities</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)]">
              What producers can do inside the platform
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {producerBenefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Card key={benefit.title} className="border-[oklch(0.87_0.02_145)] bg-white/88 shadow-sm">
                  <CardContent className="space-y-4 p-6">
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-[oklch(0.95_0.03_145)]">
                      <Icon className="size-5 text-[oklch(0.45_0.08_145)]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-[oklch(0.24_0.02_145)]">{benefit.title}</h3>
                      <p className="text-sm leading-6 text-[oklch(0.36_0.03_145)]">{benefit.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
