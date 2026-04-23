import { useEffect } from 'react';
import {
  ArrowRight,
  Building2,
  Lock,
  MapPin,
  ShieldCheck,
  ShoppingBasket,
  Sprout,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { Link } from 'react-router';

import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

const stats = [
  { number: '28+', label: 'Local Producers' },
  { number: '500+', label: 'Fresh Products' },
  { number: '48h', label: 'Average Delivery' },
];

const featureCards = [
  {
    icon: Sprout,
    title: 'See exactly where it comes from',
    description:
      'Producer location, food miles, and delivery context visible throughout browsing — not hidden until checkout.',
    accent: '#1a5c35',
  },
  {
    icon: MapPin,
    title: 'Seasonal availability, always visible',
    description:
      'Harvest windows and seasonal context shown on every product so you know what to expect across the year.',
    accent: '#2d7a4a',
  },
  {
    icon: Truck,
    title: 'Delivered in 48 hours or less',
    description:
      'Coordinated community deliveries with multiple options. Choose what suits your schedule.',
    accent: '#4a9a64',
  },
  {
    icon: ShieldCheck,
    title: 'Allergens and organic status inline',
    description:
      'Full compliance detail sits inside the product view — not buried in a separate document or gated behind sign-up.',
    accent: '#7dba94',
  },
];

const roles = [
  {
    icon: ShoppingBasket,
    title: 'Customer',
    description:
      'Shop fresh local produce and products. Support local farmers while enjoying the highest quality ingredients.',
    cta: 'Browse as customer',
    href: '/browse',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurant',
    description:
      'Source consistent supply of premium local ingredients. Create repeatable orders and manage your supply chain efficiently.',
    cta: 'Restaurant access',
    href: '/portal/restaurant',
  },
  {
    icon: Users,
    title: 'Community',
    description:
      'Coordinate bulk orders across your network. Manage community deliveries and support local food access for all.',
    cta: 'Community portal',
    href: '/portal/community',
  },
  {
    icon: Building2,
    title: 'Producer',
    description:
      'Sell directly to your local community. Reach customers who value quality and are willing to pay fairly for your work.',
    cta: 'Producer information',
    href: '/producers',
  },
];

const panelClass =
  'landing-snap-panel flex items-center py-6 sm:py-8';

export function LandingPage() {
  useEffect(() => {
    document.documentElement.classList.add('landing-snap-mode');
    document.body.classList.add('landing-snap-mode');

    return () => {
      document.documentElement.classList.remove('landing-snap-mode');
      document.body.classList.remove('landing-snap-mode');
    };
  }, []);

  return (
    <div className="landing-page-shell min-h-screen bg-[linear-gradient(180deg,oklch(0.988_0.008_145),oklch(0.958_0.02_145))]">
      <SiteHeader showLocationBar locationCity="Bristol" />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <section aria-labelledby="home-hero-heading" className={panelClass}>
          <div className="relative w-full py-4 sm:py-6">
            <div className="pointer-events-none absolute left-1/2 top-14 h-72 w-[min(92vw,54rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(0.93_0.03_145)_0%,rgba(255,255,255,0)_72%)] opacity-90" />
            <div className="pointer-events-none absolute left-[8%] top-24 h-28 w-28 rounded-full bg-[#edf5ef] opacity-70 blur-2xl" />
            <div className="pointer-events-none absolute right-[10%] top-10 h-36 w-36 rounded-full bg-[#e5f1e8] opacity-80 blur-3xl" />

            <div className="relative space-y-8 text-center sm:space-y-10">
              <div className="mx-auto max-w-4xl space-y-5">
                <div className="inline-flex rounded-full border border-[oklch(0.88_0.02_145)] bg-white/75 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#1a5c35] shadow-sm">
                  Local marketplace
                </div>
                <h1
                  id="home-hero-heading"
                  className="text-balance text-4xl font-bold tracking-tight text-[oklch(0.24_0.02_145)] sm:text-5xl lg:text-6xl"
                >
                  Local Food, Fresher Every Day
                </h1>
                <p className="mx-auto max-w-3xl text-lg leading-8 text-[oklch(0.36_0.03_145)] sm:text-xl">
                  Connect directly with local farmers, producers, and community vendors. Buy fresh, eat local, support
                  your neighbors.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="min-h-11 bg-[#1a5c35] px-7 text-white hover:bg-[#154a2a]">
                  <Link to="/browse">Get Started</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="min-h-11 border-[#1a5c35] bg-white/70 px-7 text-[#1a5c35] hover:bg-[#f4f9f5] hover:text-[#1a5c35]"
                >
                  <Link to="/about">Learn More</Link>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm leading-6 text-[oklch(0.38_0.03_145)]">
                <Lock className="size-4 shrink-0 text-[#1a5c35]" />
                <span>No account required to browse. Sign in only when ordering.</span>
              </div>

              <div className="mx-auto max-w-5xl">
                <Card className="overflow-hidden rounded-[2rem] border-[oklch(0.88_0.02_145)] bg-white/94 shadow-lg">
                  <CardContent className="p-0">
                    <dl className="grid divide-y divide-[oklch(0.9_0.02_145)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                      {stats.map((stat) => (
                        <div key={stat.label} className="px-6 py-8">
                          <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-[oklch(0.43_0.04_145)]">
                            {stat.label}
                          </dt>
                          <dd className="mt-3 text-4xl font-bold tracking-tight text-[#1a5c35]">{stat.number}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="home-features" className={panelClass}>
          <div className="w-full py-4 sm:py-6">
            <div className="space-y-8">
              <div className="mx-auto max-w-3xl space-y-4 text-center">
                <div className="inline-flex rounded-full bg-[#edf5ef] px-4 py-1.5 text-xs font-semibold tracking-[0.01em] text-[#1a5c35]">
                  Why it works
                </div>
                <h2
                  id="home-features"
                  className="text-balance text-3xl font-bold tracking-tight text-[oklch(0.24_0.02_145)] sm:text-4xl lg:text-5xl"
                >
                  Built so you can see everything before you order
                </h2>
                <p className="mx-auto max-w-2xl text-base leading-7 text-[oklch(0.36_0.03_145)] sm:text-lg">
                  Every step of the marketplace shows you the detail that usually gets hidden: who grew it, when it&apos;s
                  available, what&apos;s in it, and how far it travelled.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {featureCards.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <Card
                      key={feature.title}
                      className="h-full rounded-[8px] border-[oklch(0.88_0.02_145)] border-t-2 bg-[linear-gradient(180deg,white,oklch(0.986_0.008_145))] shadow-sm"
                      style={{ borderTopColor: feature.accent }}
                    >
                      <CardContent className="flex h-full flex-col gap-4 p-6">
                        <div className="flex size-9 items-center justify-center rounded-[8px] bg-[#1a5c35] shadow-sm">
                          <Icon className="size-4 text-white" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-[oklch(0.24_0.02_145)]">{feature.title}</h3>
                          <p className="text-sm leading-6 text-[oklch(0.36_0.03_145)]">{feature.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="home-roles" className={panelClass}>
          <div className="w-full bg-[#f7faf7] py-4 sm:py-6">
            <div className="space-y-8">
              <div className="mx-auto max-w-3xl space-y-4 text-center">
                <div className="inline-flex rounded-full bg-[#edf5ef] px-4 py-1.5 text-[11px] font-semibold tracking-[0.01em] text-[#1a5c35]">
                  Who is it for
                </div>
                <h2
                  id="home-roles"
                  className="text-balance text-3xl font-bold tracking-tight text-[oklch(0.24_0.02_145)] sm:text-4xl lg:text-5xl"
                >
                  The platform works differently depending on how you use it
                </h2>
                <p className="mx-auto max-w-2xl text-base leading-7 text-[oklch(0.36_0.03_145)] sm:text-lg">
                  Most visitors start as customers. You can take on other roles — or combine them — from the same account.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {roles.map((role, index) => {
                  const Icon = role.icon;
                  const isPrimary = index === 0;

                  return (
                    <Card
                      key={role.title}
                      className={`h-full rounded-[10px] bg-white text-[oklch(0.24_0.02_145)] shadow-sm ${
                        isPrimary ? 'border-2 border-[#1a5c35]' : 'border-[oklch(0.88_0.02_145)]'
                      }`}
                    >
                      <CardContent className="flex h-full flex-col gap-5 p-6 text-left">
                        {isPrimary ? (
                          <div className="w-fit rounded-full bg-[#ddf0e3] px-3 py-1 text-[11px] font-semibold text-[#1a5c35]">
                            Most visitors start here
                          </div>
                        ) : null}

                        <div
                          className={`flex size-12 items-center justify-center rounded-[10px] ${
                            isPrimary ? 'bg-[#1a5c35]' : 'bg-[#edf5ef]'
                          }`}
                        >
                          <Icon className={`size-5 ${isPrimary ? 'text-white' : 'text-[#1a5c35]'}`} />
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-2xl font-semibold text-[oklch(0.24_0.02_145)]">{role.title}</h3>
                          <p className="text-base leading-7 text-[oklch(0.36_0.03_145)]">{role.description}</p>
                        </div>

                        <Button
                          asChild
                          variant={isPrimary ? 'default' : 'outline'}
                          className={`mt-auto min-h-11 w-full justify-between ${
                            isPrimary
                              ? 'bg-[#1a5c35] text-white hover:bg-[#154a2a]'
                              : 'border-[#1a5c35] bg-transparent text-[#1a5c35] hover:bg-[#f4f9f5] hover:text-[#1a5c35]'
                          }`}
                        >
                          <Link to={role.href}>
                            {role.cta}
                            <ArrowRight className="size-4" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
