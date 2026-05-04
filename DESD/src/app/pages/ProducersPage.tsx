/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ProducersPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  ClipboardList,
  Images,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router';

import marketDemandImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.33 (17).jpeg';
import fieldHarvestImage from '../../assets/producers/greenforce-staffing-bYZn_C-RswQ-unsplash.jpg';
import seedlingImage from '../../assets/producers/annie-spratt-JMjNnQ2xFoY-unsplash.jpg';
import stockImage from '../../assets/producers/elaine-casap-qgHGDbbSNm8-unsplash.jpg';
import producerFlowImage from '../../assets/producers/tim-mossholder-xDwEa2kaeJA-unsplash.jpg';
import { MarketingImageCard } from '../components/MarketingImageCard';
import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';
import { getPortalDefinition } from '../lib/portalConfig';

const producerDefinition = getPortalDefinition('PRODUCER');

const producerTools = [
  {
    icon: Boxes,
    label: 'Inventory',
    title: 'Stock that reflects reality',
    body: 'Add products, update quantities, set harvest windows, and keep availability aligned with what can actually be sold.',
    image: stockImage,
    alt: 'Fresh tomatoes being gathered into a bowl to represent producer stock handling.',
    imagePosition: 'object-center',
  },
  {
    icon: ClipboardList,
    label: 'Fulfilment',
    title: 'Orders with fulfilment context',
    body: 'Incoming orders, producer-specific status, and delivery timing stay visible so fulfilment is easier to manage.',
    image: fieldHarvestImage,
    alt: 'Harvest workers carrying produce crates across a field to represent order fulfilment.',
    imagePosition: 'object-center',
  },
  {
    icon: Images,
    label: 'Storytelling',
    title: 'Recipes and farm stories',
    body: 'Producers can publish content that helps customers understand products beyond the listing alone.',
    image: seedlingImage,
    alt: 'Hands planting a seedling to represent producer stories and recipe context rooted in farm practice.',
    imagePosition: 'object-center',
  },
  {
    icon: TrendingUp,
    label: 'Buyer demand',
    title: 'Demand from several buyer types',
    body: 'Customer, community, and restaurant ordering flows can all surface producer stock without losing context.',
    image: marketDemandImage,
    alt: 'A local produce market display representing demand from different types of buyers.',
    imagePosition: 'object-center',
  },
] satisfies Array<{
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  image?: string;
  alt?: string;
  imagePosition?: string;
}>;

const producerChecks = [
  'Sold quantities flow back into inventory management.',
  'Role-specific producer operations stay separate from buyer workflows.',
  'Product context remains visible to customers before checkout.',
];

/**
 * ProducerToolCard boundary.
 *
 * This exported unit supports the file role: Implements the ProducersPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
function ProducerToolCard({
  icon: Icon,
  label,
  title,
  body,
  image,
  alt,
  imagePosition = 'object-center',
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  image?: string;
  alt?: string;
  imagePosition?: string;
}) {
  if (image && alt) {
    return (
      <MarketingImageCard
        image={image}
        alt={alt}
        icon={Icon}
        label={label}
        title={title}
        body={body}
        imagePosition={imagePosition}
        minHeightClassName="min-h-[21.25rem]"
      />
    );
  }

  return (
    <article className="relative flex min-h-[21.25rem] flex-col overflow-hidden rounded-[1.35rem] border border-white/18 bg-[linear-gradient(180deg,rgba(17,42,25,0.96)_0%,rgba(11,28,17,0.92)_100%)] shadow-[0_18px_38px_rgba(18,28,20,0.16)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(125,186,148,0.18),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_32%)]" />
      <div className="relative z-10 flex h-full flex-col justify-between p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <span className="rounded-full bg-white/14 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/92 backdrop-blur-sm">
            {label}
          </span>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[rgba(9,29,17,0.58)] text-white backdrop-blur-sm">
            <Icon className="size-4.5" />
          </span>
        </div>

        <div className="space-y-3">
          <h3 className="text-2xl font-semibold tracking-tight text-white">{title}</h3>
          <p className="text-sm leading-7 text-white/82">{body}</p>
        </div>

        <div className="rounded-[1.15rem] border border-white/14 bg-white/7 p-4 text-sm leading-7 text-white/84 backdrop-blur-sm">
          Settlement stays connected to the same producer-side order record used for stock and fulfilment.
        </div>
      </div>
    </article>
  );
}

/**
 * ProducersPage boundary.
 *
 * This exported unit supports the file role: Implements the ProducersPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ProducersPage() {
  return (
    <div className="market-page min-h-screen">
      <SiteHeader />

      <main>
        <section className="market-section market-section-cream relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <img src={fieldHarvestImage} alt="" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(249,246,238,0.98)_0%,rgba(249,246,238,0.96)_16%,rgba(249,246,238,0.88)_28%,rgba(249,246,238,0.52)_42%,rgba(249,246,238,0.12)_58%,rgba(17,31,21,0.14)_74%,rgba(17,31,21,0.42)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(249,246,238,0.08)_0%,rgba(249,246,238,0.02)_32%,rgba(17,31,21,0.24)_100%)]" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-20">
            <div className="max-w-3xl space-y-6 lg:min-h-[30rem] lg:content-center lg:py-8">
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
          </div>
        </section>

        <section className="market-section market-section-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
            <div className="max-w-3xl space-y-5">
              <h2 className="market-section-title max-w-4xl text-[oklch(0.23_0.034_87)]">
                The producer tools are practical first.
              </h2>
              <p className="market-copy max-w-2xl">
                The portal is built for changing stock, visible fulfilment, and clear payment context rather than a
                generic storefront profile.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {producerTools.map((tool) => (
                <ProducerToolCard
                  key={tool.title}
                  icon={tool.icon}
                  label={tool.label}
                  title={tool.title}
                  body={tool.body}
                  image={tool.image}
                  alt={tool.alt}
                  imagePosition={tool.imagePosition}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="market-section market-section-brown relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <img
              src={producerFlowImage}
              alt=""
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,18,13,0.74)_0%,rgba(10,18,13,0.6)_22%,rgba(10,18,13,0.4)_42%,rgba(10,18,13,0.26)_60%,rgba(10,18,13,0.3)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,18,13,0.2)_0%,rgba(10,18,13,0.14)_30%,rgba(10,18,13,0.5)_100%)]" />
          </div>

          <div className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:py-20">
            <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div className="space-y-5">
                <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-white/92 backdrop-blur-sm">
                  Producer flow
                </span>
                <h2 className="market-section-title max-w-3xl text-white">
                  Sell locally without losing control of the details.
                </h2>
                <p className="market-copy max-w-xl text-white/86">{producerDefinition.highlight}</p>
                <Button asChild size="lg" className="market-button-primary min-h-11 px-7">
                  <Link to="/browse">See the public marketplace</Link>
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
                {producerChecks.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-3 rounded-[1.2rem] border border-white/18 bg-[rgba(24,42,29,0.38)] p-4 text-white shadow-[0_12px_24px_rgba(12,22,16,0.18)] backdrop-blur-md"
                  >
                    <BadgeCheck className="mt-0.5 size-5 shrink-0 text-white/88" />
                    <p className="text-sm leading-7 text-white/92">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
