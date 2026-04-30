import { useEffect } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  MapPin,
  Route,
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

const stats = [
  { number: '28+', label: 'Local producers' },
  { number: '500+', label: 'Fresh products' },
  { number: '48h', label: 'Typical delivery' },
];

const productSignals = [
  { icon: MapPin, title: 'Food miles visible', body: 'Producer location and journey context stay present while browsing.' },
  { icon: Sprout, title: 'Seasonal by default', body: 'Harvest windows and availability help buyers choose what makes sense now.' },
  { icon: ShieldCheck, title: 'Compliance in context', body: 'Allergens, organic status, and product detail sit inside the product view.' },
  { icon: Truck, title: 'Delivery made explicit', body: 'Orders can be grouped by producer and tracked through clear delivery timing.' },
];

const roles = [
  {
    icon: ShoppingBasket,
    title: 'Customer',
    description: 'Create a customer account for checkout, saved delivery details, and personal order tracking.',
    cta: 'Register as customer',
    href: '/register/customer',
  },
  {
    icon: Building2,
    title: 'Producer',
    description: 'Review the selling flow, then register your farm or supply business from the producer page.',
    cta: 'Producer information',
    href: '/producers',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Register a school, charity, or community group for coordinated bulk local food orders.',
    cta: 'Register community group',
    href: '/register/community',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurant',
    description: 'Register a restaurant account for supplier baskets, recurring demand, and kitchen orders.',
    cta: 'Register restaurant',
    href: '/register/restaurant',
  },
];

const panelClass = 'landing-snap-panel market-section flex items-center';

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
    <div className="market-page landing-page-shell min-h-screen">
      <SiteHeader showLocationBar locationCity="Bristol" />

      <main>
        <section aria-labelledby="home-hero-heading" className={`${panelClass} market-section-cream`}>
          <div className="mx-auto grid w-full min-w-0 max-w-7xl gap-6 px-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-center xl:gap-10">
            <div className="min-w-0 space-y-6 xl:space-y-8">
              <div className="space-y-4 xl:space-y-5">
                <h1 id="home-hero-heading" className="market-hero-title max-w-5xl">
                  <span className="block">Food with its</span>
                  <span className="block">route still</span>
                  <span className="block">attached.</span>
                </h1>
                <p className="market-copy max-w-2xl">
                  Connect directly with local farmers, producers, and community vendors. Buy fresh, eat local, and see
                  the origin, season, and delivery context before an account is ever required.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="market-button-primary min-h-11 px-7">
                  <Link to="/browse">
                    Start browsing
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="market-button-outline min-h-11 bg-white/45 px-7">
                  <Link to="/about">How it works</Link>
                </Button>
              </div>

              <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <Link
                  to="/register/producer"
                  className="group rounded-2xl border border-[#e4e1d8] bg-[#fffefa]/80 p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--forest-green)] hover:shadow-md"
                >
                  <span className="text-sm font-semibold text-[var(--forest-green)]">Interested in selling?</span>
                  <span className="mt-1 flex items-center justify-between gap-3 text-lg font-semibold text-[oklch(0.23_0.034_87)]">
                    Join us as a producer
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
                <Link
                  to="/login"
                  className="group rounded-2xl border border-[#e4e1d8] bg-white/45 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--forest-green)] hover:bg-[#fffefa]"
                >
                  <span className="text-sm font-semibold text-[oklch(0.42_0.032_118)]">Already have an account?</span>
                  <span className="mt-1 flex items-center justify-between gap-3 text-lg font-semibold text-[var(--forest-green)]">
                    Sign in
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </div>
            </div>

            <div className="market-display-panel relative w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[2rem] p-4 sm:max-w-full sm:p-6 xl:p-7">
              <div className="absolute inset-x-6 top-1/2 h-px market-route-line" />
              <div className="relative grid gap-4 xl:gap-5">
                <div className="grid min-w-0 grid-cols-3 gap-3">
                  {stats.map((stat) => (
                    <div key={stat.label} className="min-w-0 border-l border-[oklch(0.78_0.04_80)] pl-3 sm:pl-4">
                      <p className="text-2xl font-bold text-[var(--forest-green)] sm:text-4xl">{stat.number}</p>
                      <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[oklch(0.42_0.035_110)] sm:text-xs sm:tracking-[0.12em]">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 rounded-[1.25rem] bg-[var(--forest-green)] p-4 text-white xl:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-white/62">Today near Bristol</p>
                      <p className="mt-1 text-2xl font-semibold">Green Valley Farm</p>
                    </div>
                    <Route className="size-8 text-white/70" />
                  </div>
                  <div className="grid gap-2 text-sm text-white/74 sm:grid-cols-3">
                    <span>18.4 food miles</span>
                    <span>Harvested this week</span>
                    <span>48h delivery window</span>
                  </div>
                </div>

                <div className="hidden gap-3 sm:grid sm:grid-cols-2">
                  <div className="rounded-[1rem] bg-white/68 p-3.5 xl:p-4">
                    <p className="text-sm font-semibold text-[var(--forest-green)]">Seasonal signal</p>
                    <p className="mt-2 text-sm leading-6 text-[oklch(0.4_0.035_110)]">
                      Product pages show harvest dates, availability windows, and source detail together.
                    </p>
                  </div>
                  <div className="rounded-[1rem] bg-[#f4f2eb] p-3.5 xl:p-4">
                    <p className="text-sm font-semibold text-[var(--forest-green)]">Buyer confidence</p>
                    <p className="mt-2 text-sm leading-6 text-[oklch(0.4_0.035_78)]">
                      Allergens and organic status appear inline before checkout.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="home-signals" className={`${panelClass} market-section-white`}>
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center xl:gap-10">
            <div className="space-y-5">
              <h2 id="home-signals" className="market-section-title max-w-3xl text-[oklch(0.23_0.034_87)]">
                The detail is not buried at the end.
              </h2>
              <p className="market-copy max-w-xl">
                Every step of the marketplace keeps the important context in view: who produced it, when it is
                available, what is inside it, and how it gets to the buyer.
              </p>
            </div>

            <div className="grid gap-x-8 gap-y-7 md:grid-cols-2">
              {productSignals.map((signal) => {
                const Icon = signal.icon;

                return (
                  <div key={signal.title} className="grid grid-cols-[2.75rem_1fr] gap-4 border-t border-[oklch(0.84_0.035_100)] pt-5">
                    <div className="flex size-11 items-center justify-center rounded-[0.8rem] bg-[color-mix(in_srgb,var(--forest-green)_7%,white)]">
                      <Icon className="size-5 text-[var(--forest-green)]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[oklch(0.24_0.035_92)]">{signal.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[oklch(0.42_0.032_118)]">{signal.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section aria-labelledby="home-roles" className={`${panelClass} market-section-green`}>
          <div className="mx-auto w-full max-w-7xl px-4">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
              <div className="space-y-5">
                <h2 id="home-roles" className="market-section-title max-w-3xl">
                  Different jobs, one consistent flow.
                </h2>
                <p className="market-copy max-w-xl">
                  Choose the role you are registering for. Everyone signs in through one shared account screen, while
                  registration collects only the details needed for that role.
                </p>
              </div>

              <div className="grid gap-1 overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/10 p-1 md:grid-cols-2">
                {roles.map((role, index) => {
                  const Icon = role.icon;

                  return (
                    <Link
                      key={role.title}
                      to={role.href}
                      className="group min-h-[clamp(9.5rem,22svh,13rem)] bg-white/[0.08] p-5 transition-colors hover:bg-white/[0.16]"
                    >
                      <div className="flex h-full flex-col">
                        <div className="flex items-start justify-between gap-4">
                          <Icon className="size-6 text-[oklch(0.84_0.08_80)]" />
                          <span className="text-sm text-white/45">0{index + 1}</span>
                        </div>
                        <div className="mt-auto space-y-3">
                          <h3 className="text-2xl font-semibold">{role.title}</h3>
                          <p className="text-sm leading-6 text-white/70">{role.description}</p>
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                            {role.cta}
                            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="home-cta" className={`${panelClass} market-section-brown`}>
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 lg:grid-cols-[1fr_0.8fr] lg:items-center xl:gap-8">
            <div className="space-y-5">
              <h2 id="home-cta" className="market-section-title max-w-4xl">
                Inspect the market before you commit to it.
              </h2>
              <p className="market-copy max-w-2xl">
                Public browsing is read-only by design. You can inspect products and producers freely, then sign in when
                you are ready to place a real order.
              </p>
            </div>

            <div className="space-y-5 border-l border-[#e4e1d8] pl-6">
              {['Browse products and producers', 'Compare food miles and seasonal detail', 'Create an account only at checkout'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-lg font-semibold">
                  <CheckCircle2 className="size-5 shrink-0 text-[var(--forest-green)]" />
                  <span>{item}</span>
                </div>
              ))}
              <Button asChild size="lg" className="market-button-primary mt-3 min-h-11 px-7">
                <Link to="/browse">
                  Open public browse
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
