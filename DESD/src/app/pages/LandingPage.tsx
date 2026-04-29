import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
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
import farmFeatureImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.34 (8).jpeg';
import localFarmsImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.33.jpeg';
import freshProduceImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.33 (16).jpeg';
import shorterRoutesImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.33 (10).jpeg';
import hillsideDairyImage from '../../assets/about/WhatsApp Image 2026-04-29 at 21.27.34 (6).jpeg';

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

const featuredFarms = [
  {
    id: 'green-valley',
    badge: 'Local farms',
    name: 'Green Valley Farm',
    locationLabel: 'Today near Bristol',
    image: farmFeatureImage,
    imageAlt: 'Pasture and barn at Green Valley Farm near Bristol.',
    metrics: ['18.4 food miles', 'Harvested this week', '48h delivery window'],
  },
  {
    id: 'hillside-dairy',
    badge: 'Local farms',
    name: 'Hillside Dairy Farm',
    locationLabel: 'Today near Bristol',
    image: hillsideDairyImage,
    imageAlt: 'Dairy cows grazing at Hillside Dairy Farm near Bristol.',
    metrics: ['9.6 food miles', 'Fresh dairy this week', '48h delivery window'],
  },
] as const;

const roles = [
  {
    icon: ShoppingBasket,
    title: 'Customer',
    description: 'Browse local products, compare origin detail, and order only when ready.',
    cta: 'Browse public market',
    href: '/browse',
  },
  {
    icon: Building2,
    title: 'Producer',
    description: 'Manage stock, orders, payment visibility, and product storytelling in one place.',
    cta: 'Producer information',
    href: '/producers',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Coordinate multi-producer buying for groups that need cleaner local food access.',
    cta: 'Community portal',
    href: '/portal/community',
  },
  {
    icon: UtensilsCrossed,
    title: 'Restaurant',
    description: 'Plan repeatable demand for local ingredients without losing supply context.',
    cta: 'Restaurant access',
    href: '/portal/restaurant',
  },
];

const panelClass = 'landing-snap-panel market-section flex items-center';

const heroImageStrip = [
  {
    src: localFarmsImage,
    alt: 'Aerial view of a local orchard with neat crop rows.',
    label: 'Local farms',
    body: 'See the growing landscape behind each producer before you decide to order.',
  },
  {
    src: freshProduceImage,
    alt: 'Fresh fruit and vegetables displayed together in a market stall.',
    label: 'Fresh produce',
    body: 'Marketplace detail stays connected to the kind of food buyers actually recognise and compare.',
  },
  {
    src: shorterRoutesImage,
    alt: 'A Bristol bridge and surrounding landscape representing local delivery routes.',
    label: 'Shorter routes',
    body: 'Journey context and delivery timing stay clear, so buyers understand how food reaches them.',
  },
];

export function LandingPage() {
  const [activeFarmIndex, setActiveFarmIndex] = useState(0);
  const [carouselDirection, setCarouselDirection] = useState(1);
  const [isShowcasePaused, setIsShowcasePaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('landing-snap-mode');
    document.body.classList.add('landing-snap-mode');

    return () => {
      document.documentElement.classList.remove('landing-snap-mode');
      document.body.classList.remove('landing-snap-mode');
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncMotionPreference();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMotionPreference);
      return () => mediaQuery.removeEventListener('change', syncMotionPreference);
    }

    mediaQuery.addListener(syncMotionPreference);
    return () => mediaQuery.removeListener(syncMotionPreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isShowcasePaused) {
      return;
    }

    const rotationTimer = window.setInterval(() => {
      setCarouselDirection(1);
      setActiveFarmIndex((currentIndex) => (currentIndex + 1) % featuredFarms.length);
    }, 5500);

    return () => window.clearInterval(rotationTimer);
  }, [isShowcasePaused, prefersReducedMotion]);

  const switchToFarm = (nextIndex: number) => {
    if (nextIndex === activeFarmIndex) {
      return;
    }

    setCarouselDirection(nextIndex > activeFarmIndex ? 1 : -1);
    setActiveFarmIndex(nextIndex);
  };

  const stepFeaturedFarm = (offset: number) => {
    setCarouselDirection(offset > 0 ? 1 : -1);
    setActiveFarmIndex((currentIndex) => (currentIndex + offset + featuredFarms.length) % featuredFarms.length);
  };

  return (
    <div className="market-page landing-page-shell min-h-screen">
      <SiteHeader showLocationBar locationCity="Bristol" />

      <main>
        <section aria-labelledby="home-hero-heading" className={`${panelClass} market-section-cream`}>
          <div className="mx-auto w-full max-w-7xl px-4">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center xl:gap-10">
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
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="market-button-outline h-10 border-[color-mix(in_srgb,var(--forest-green)_28%,white)] bg-white/15 px-6 text-[0.95rem] font-medium shadow-none"
                  >
                    <Link to="/about">How it works</Link>
                  </Button>
                </div>

                <div className="max-w-2xl space-y-3.5">
                  <p className="text-[0.76rem] font-semibold uppercase tracking-[0.16em] text-[oklch(0.42_0.032_118)]">
                    Choose how to continue
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      to="/register"
                      className="group flex min-h-[7.5rem] cursor-pointer flex-col justify-center rounded-[1.35rem] border border-[color-mix(in_srgb,var(--forest-green)_22%,#e4e1d8)] bg-[color-mix(in_srgb,var(--forest-green)_5%,#fffefa)] p-[1.1rem] text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--forest-green)] hover:bg-[color-mix(in_srgb,var(--forest-green)_8%,#fffefa)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2 sm:p-5"
                    >
                      <span className="text-[0.84rem] font-medium text-[oklch(0.42_0.032_118)]">New to the marketplace?</span>
                      <div className="mt-2.5 flex items-center justify-between gap-4">
                        <span className="max-w-[15rem] text-[1.06rem] font-semibold leading-tight text-[oklch(0.23_0.034_87)] sm:text-[1.1rem]">
                          Create account
                        </span>
                        <ArrowRight className="size-[1.15rem] shrink-0 text-[var(--forest-green)] transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>

                    <Link
                      to="/login"
                      className="group flex min-h-[7.5rem] cursor-pointer flex-col justify-center rounded-[1.35rem] border border-[#e4e1d8] bg-white/55 p-[1.1rem] text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--forest-green)] hover:bg-[#fffefa] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2 sm:p-5"
                    >
                      <span className="text-[0.84rem] font-medium text-[oklch(0.42_0.032_118)]">Already have an account?</span>
                      <div className="mt-2.5 flex items-center justify-between gap-4">
                        <span className="max-w-[15rem] text-[1.05rem] font-semibold leading-tight text-[var(--forest-green)] sm:text-[1.08rem]">
                          Sign in
                        </span>
                        <ArrowRight className="size-[1.15rem] shrink-0 text-[var(--forest-green)] transition-transform group-hover:translate-x-1" />
                      </div>
                    </Link>
                  </div>

                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[0.9rem] text-[oklch(0.42_0.032_118)]">
                    <span className="font-medium">Interested in selling?</span>
                    <Link
                      to="/producers"
                      className="group inline-flex items-center gap-1.5 font-semibold text-[var(--forest-green)] transition-colors hover:text-[oklch(0.28_0.06_140)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2"
                    >
                      <span>Join us as a producer</span>
                      <ArrowRight className="size-[1.02rem] shrink-0 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </p>
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

                  <div
                    className="overflow-hidden rounded-[1.25rem] bg-[var(--forest-green)] text-white shadow-[0_18px_50px_rgba(18,31,21,0.22)]"
                    role="region"
                    aria-roledescription="carousel"
                    aria-label="Featured local farms"
                    onMouseEnter={() => setIsShowcasePaused(true)}
                    onMouseLeave={() => setIsShowcasePaused(false)}
                    onFocusCapture={() => setIsShowcasePaused(true)}
                    onBlurCapture={(event) => {
                      const nextFocusTarget = event.relatedTarget;
                      if (!(nextFocusTarget instanceof Node) || !event.currentTarget.contains(nextFocusTarget)) {
                        setIsShowcasePaused(false);
                      }
                    }}
                  >
                    <div className="relative h-[20rem] sm:h-[18.75rem] xl:h-[19rem]">
                      {featuredFarms.map((farm, index) => {
                        const isActive = index === activeFarmIndex;
                        const motionClass = prefersReducedMotion
                          ? isActive
                            ? 'translate-x-0 opacity-100'
                            : 'translate-x-0 opacity-0'
                          : isActive
                            ? 'translate-x-0 opacity-100'
                            : carouselDirection > 0
                              ? '-translate-x-4 opacity-0'
                              : 'translate-x-4 opacity-0';

                        return (
                          <div
                            key={farm.id}
                            aria-hidden={!isActive}
                            className={`absolute inset-0 grid grid-rows-[9rem_1fr] bg-[var(--forest-green)] transition-[opacity,transform] duration-700 ease-out ${
                              isActive ? 'z-10' : 'z-0 pointer-events-none'
                            } ${motionClass}`}
                          >
                            <div className="relative overflow-hidden">
                              <img src={farm.image} alt={farm.imageAlt} className="h-full w-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(13,41,24,0.72)] via-[rgba(13,41,24,0.18)] to-transparent" />
                              <span className="absolute left-4 top-4 rounded-full bg-white/16 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                                {farm.badge}
                              </span>
                            </div>
                            <div className="grid content-start gap-3 p-4 xl:p-5">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <p className="text-sm text-white/62">{farm.locationLabel}</p>
                                  <p className="mt-1 text-2xl font-semibold">{farm.name}</p>
                                </div>
                                <Route className="size-8 text-white/70" />
                              </div>
                              <div className="grid gap-2 text-sm text-white/74 sm:grid-cols-3">
                                {farm.metrics.map((metric) => (
                                  <span key={metric}>{metric}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[color-mix(in_srgb,var(--forest-green)_92%,black)] px-4 py-3">
                      <div className="flex items-center gap-2" aria-label="Featured farm selection">
                        {featuredFarms.map((farm, index) => {
                          const isActive = index === activeFarmIndex;

                          return (
                            <button
                              key={farm.id}
                              type="button"
                              onClick={() => switchToFarm(index)}
                              aria-label={`Show ${farm.name}`}
                              aria-pressed={isActive}
                              className={`size-3 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--forest-green)] ${
                                isActive ? 'border-white bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.18)]' : 'border-white/45 bg-white/18 hover:bg-white/30'
                              }`}
                            />
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => stepFeaturedFarm(-1)}
                          aria-label="Previous featured farm"
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-white/18 bg-white/10 text-white transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--forest-green)]"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => stepFeaturedFarm(1)}
                          aria-label="Next featured farm"
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-white/18 bg-white/10 text-white transition-colors hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--forest-green)]"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
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

            <div className="mt-6 grid gap-3 lg:grid-cols-3">
              {heroImageStrip.map((imageCard) => (
                <figure
                  key={imageCard.label}
                  className="overflow-hidden rounded-[1.4rem] border border-[#e4e1d8] bg-[#fffefa]/82 shadow-sm"
                >
                  <img
                    src={imageCard.src}
                    alt={imageCard.alt}
                    className="h-36 w-full object-cover"
                  />
                  <figcaption className="space-y-2 p-4">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[var(--forest-green)]">
                      {imageCard.label}
                    </p>
                    <p className="text-sm leading-6 text-[oklch(0.39_0.032_122)]">{imageCard.body}</p>
                  </figcaption>
                </figure>
              ))}
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
                  Customers, producers, community buyers, and restaurants use role-specific tools without splitting the
                  marketplace into disconnected experiences.
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
