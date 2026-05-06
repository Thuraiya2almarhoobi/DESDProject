/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the LandingPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect, useMemo, useState } from 'react';
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
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { Link } from 'react-router';

import { MarketingImageCard } from '../components/MarketingImageCard';
import { AnimatedText, Reveal, RevealGroup } from '../components/motion/Motion';
import { SiteHeader } from '../components/SiteHeader';
import { Button } from '../components/ui/button';
import { fetchProducts } from '../api/catalog';
import { Product } from '../types';
import farmFeatureImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.34 (8).jpeg';
import freshProduceImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.33 (16).jpeg';
import shorterRoutesImage from '../../assets/homepage/WhatsApp Image 2026-04-29 at 21.27.33 (10).jpeg';

const stats = [
  { number: '28+', label: 'Local producers' },
  { number: '500+', label: 'Fresh products' },
  { number: '48h', label: 'Typical delivery' },
];

interface FeaturedFarm {
  id: string;
  badge: string;
  name: string;
  locationLabel: string;
  href: string;
  metrics: string[];
}

function shuffle<T>(items: T[]): T[] {
  const nextItems = [...items];
  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }
  return nextItems;
}

function buildFeaturedFarms(products: Product[]): FeaturedFarm[] {
  const byProducer = new Map<string, Product[]>();
  products.forEach((product) => {
    if (!product.producerId || !product.producerName) {
      return;
    }
    const current = byProducer.get(product.producerId) || [];
    current.push(product);
    byProducer.set(product.producerId, current);
  });

  const farms = Array.from(byProducer.entries()).map(([producerId, producerProducts]) => {
    const firstProduct = producerProducts[0];
    const categories = Array.from(new Set(producerProducts.map((product) => product.category).filter(Boolean))).slice(0, 2);
    const averageFoodMiles =
      producerProducts.reduce((total, product) => total + (Number.isFinite(product.foodMiles) ? product.foodMiles : 0), 0) /
      Math.max(1, producerProducts.length);

    return {
      id: producerId,
      badge: 'Local farms',
      name: firstProduct.producerName,
      locationLabel: firstProduct.producerPostcode || firstProduct.producerLocation || 'Near Bristol',
      href: `/producers/${producerId}`,
      metrics: [
        `${averageFoodMiles.toFixed(1)} food miles`,
        `${producerProducts.length} product${producerProducts.length === 1 ? '' : 's'}`,
        categories.length > 0 ? categories.join(' / ') : `${firstProduct.producerDeliveryLeadTime || 48}h delivery window`,
      ],
    };
  });

  const sortedByProductCount = farms.sort((a, b) => {
    const aCount = Number.parseInt(a.metrics[1], 10) || 0;
    const bCount = Number.parseInt(b.metrics[1], 10) || 0;
    return bCount - aCount || a.name.localeCompare(b.name);
  });
  const pool = sortedByProductCount.slice(0, Math.max(4, Math.min(8, sortedByProductCount.length)));
  const selectionCount = Math.min(pool.length, pool.length >= 4 ? 4 : 3);
  return shuffle(pool).slice(0, selectionCount);
}

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

const homeContextCards = [
  {
    image: freshProduceImage,
    alt: 'Fresh fruit and vegetables displayed together in a market stall.',
    icon: ShoppingBasket,
    label: 'Marketplace context',
    title: 'Origin stays visible',
    body: 'Producer, season, and route detail stay close to the products buyers are actually comparing.',
    imagePosition: 'object-center',
  },
  {
    image: shorterRoutesImage,
    alt: 'A Bristol bridge and surrounding landscape representing local delivery routes.',
    icon: Route,
    label: 'Shorter routes',
    title: 'Delivery context is clear',
    body: 'Food miles and timing stay readable before checkout starts, not after it.',
    imagePosition: 'object-center',
  },
  {
    image: farmFeatureImage,
    alt: 'A local farm landscape representing buyer confidence in source and quality.',
    icon: ShieldCheck,
    label: 'Buyer confidence',
    title: 'Signals stay in the product view',
    body: 'Allergens, organic status, and seasonal availability stay visible where decisions happen.',
    imagePosition: 'object-center',
  },
];

/**
 * LandingPage boundary.
 *
 * This exported unit supports the file role: Implements the LandingPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function LandingPage() {
  const [activeFarmIndex, setActiveFarmIndex] = useState(0);
  const [carouselDirection, setCarouselDirection] = useState(1);
  const [isShowcasePaused, setIsShowcasePaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [marketplaceProducts, setMarketplaceProducts] = useState<Product[]>([]);

  const featuredFarms = useMemo(() => buildFeaturedFarms(marketplaceProducts), [marketplaceProducts]);

  useEffect(() => {
    let mounted = true;
    fetchProducts({})
      .then((products) => {
        if (mounted) {
          setMarketplaceProducts(products);
        }
      })
      .catch(() => {
        if (mounted) {
          setMarketplaceProducts([]);
        }
      });
    return () => {
      mounted = false;
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
    if (activeFarmIndex >= featuredFarms.length) {
      setActiveFarmIndex(0);
    }
  }, [activeFarmIndex, featuredFarms.length]);

  useEffect(() => {
    if (prefersReducedMotion || isShowcasePaused || featuredFarms.length <= 1) {
      return;
    }

    const rotationTimer = window.setInterval(() => {
      setCarouselDirection(1);
      setActiveFarmIndex((currentIndex) => (currentIndex + 1) % featuredFarms.length);
    }, 5500);

    return () => window.clearInterval(rotationTimer);
  }, [featuredFarms.length, isShowcasePaused, prefersReducedMotion]);

  const switchToFarm = (nextIndex: number) => {
    if (nextIndex === activeFarmIndex) {
      return;
    }

    setCarouselDirection(nextIndex > activeFarmIndex ? 1 : -1);
    setActiveFarmIndex(nextIndex);
  };

  const stepFeaturedFarm = (offset: number) => {
    if (featuredFarms.length <= 1) {
      return;
    }
    setCarouselDirection(offset > 0 ? 1 : -1);
    setActiveFarmIndex((currentIndex) => (currentIndex + offset + featuredFarms.length) % featuredFarms.length);
  };

  return (
    <div className="market-page landing-page-shell min-h-screen">
      <SiteHeader showLocationBar locationCity="Bristol" />

      <main>
        <section aria-labelledby="home-hero-heading" className={`${panelClass} market-section-cream relative overflow-hidden`}>
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <img src={farmFeatureImage} alt="" className="h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(251,250,244,0.99)_0%,rgba(251,250,244,0.96)_18%,rgba(251,250,244,0.9)_34%,rgba(251,250,244,0.58)_56%,rgba(18,39,25,0.38)_78%,rgba(18,39,25,0.62)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(251,250,244,0.3)_0%,rgba(251,250,244,0.12)_42%,rgba(22,40,26,0.3)_100%)]" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4">
            <div className="grid min-w-0 gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center xl:gap-10">
              <RevealGroup className="min-w-0 space-y-6 xl:space-y-8" amount={0.28} stagger={0.13}>
                <div className="space-y-4 xl:space-y-5">
                  <AnimatedText
                    id="home-hero-heading"
                    as="h1"
                    text="Food with its route still attached."
                    className="market-hero-title max-w-5xl"
                    stagger={0.055}
                  />
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

                  <RevealGroup className="grid gap-3 sm:grid-cols-2" stagger={0.11} delayChildren={0.06}>
                    <Link
                      to="/login"
                      className="group flex min-h-16 cursor-pointer items-center justify-between gap-5 rounded-md border border-[#d9d4c8] bg-white/82 px-7 py-4 text-left shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--forest-green)] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.82rem] font-medium text-[oklch(0.42_0.032_118)]">Already have an account?</span>
                        <span className="mt-1 block max-w-[15rem] text-[1.05rem] font-semibold leading-tight text-[var(--forest-green)] sm:text-[1.08rem]">
                          Sign in
                        </span>
                      </span>
                      <ArrowRight className="size-[1.15rem] shrink-0 text-[var(--forest-green)] transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>

                    <Link
                      to="/select-portal?mode=register"
                      className="group flex min-h-16 cursor-pointer items-center justify-between gap-5 rounded-md border border-[#d9d4c8] bg-white/86 px-7 py-4 text-left shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--forest-green)] hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2"
                    >
                      <span className="min-w-0">
                        <span className="block text-[0.82rem] font-medium text-[oklch(0.42_0.032_118)]">New to the marketplace?</span>
                        <span className="mt-1 block max-w-[15rem] text-[1.06rem] font-semibold leading-tight text-[oklch(0.23_0.034_87)] sm:text-[1.1rem]">
                          Sign up
                        </span>
                      </span>
                      <ArrowRight className="size-[1.15rem] shrink-0 text-[var(--forest-green)] transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </RevealGroup>

                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[0.9rem] text-[oklch(0.42_0.032_118)]">
                    <span className="font-medium">Interested in selling?</span>
                    <Link
                      to="/register/producer"
                      className="group inline-flex items-center gap-1.5 font-semibold text-[var(--forest-green)] transition-colors hover:text-[oklch(0.28_0.06_140)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2"
                    >
                      <span>Join us as a producer</span>
                      <ArrowRight className="size-[1.02rem] shrink-0 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </p>
                </div>
              </RevealGroup>

              <Reveal
                className="relative w-full min-w-0 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[1.85rem] border border-white/55 bg-white/62 p-4 shadow-[0_24px_56px_rgba(18,28,20,0.18)] backdrop-blur-[18px] sm:max-w-full sm:p-5 xl:p-6"
                delay={0.08}
                variant="card"
              >
                <div className="relative grid gap-4 xl:gap-5">
                  <RevealGroup className="grid min-w-0 grid-cols-3 gap-3" stagger={0.045} delayChildren={0.1}>
                    {stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="min-w-0 rounded-[1rem] border border-white/55 bg-white/78 p-3 shadow-[0_10px_24px_rgba(18,28,20,0.05)] backdrop-blur-sm sm:p-4"
                      >
                        <p className="text-2xl font-bold text-[var(--forest-green)] sm:text-4xl">{stat.number}</p>
                        <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-[oklch(0.42_0.035_110)] sm:text-xs sm:tracking-[0.12em]">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </RevealGroup>

                  <div
                    className="overflow-hidden rounded-[1.25rem] border border-white/22 bg-[var(--forest-green)] text-white shadow-[0_18px_50px_rgba(18,31,21,0.22)] backdrop-blur-md"
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
                    <div className="relative min-h-[13.75rem] sm:min-h-[14.25rem] xl:min-h-[14.5rem]">
                      {featuredFarms.length === 0 ? (
                        <div className="absolute inset-0 grid content-stretch">
                          <div className="grid h-full gap-4 p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-5">
                              <div className="min-w-0 space-y-3">
                                <span className="inline-flex w-fit rounded-full bg-white/13 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/95 ring-1 ring-white/10 backdrop-blur-sm">
                                  Local farms
                                </span>
                                <div>
                                  <p className="text-sm font-medium text-white/58">Loading producer data</p>
                                  <p className="mt-1 text-2xl font-semibold leading-tight sm:text-[1.7rem]">Real local producers will appear here</p>
                                </div>
                              </div>
                              <Route className="mt-2 size-7 shrink-0 text-white/58" />
                            </div>
                            <div className="mt-auto grid gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-sm font-medium text-white/78 backdrop-blur-sm sm:grid-cols-3">
                              <span>Live marketplace data</span>
                              <span>Producer profiles</span>
                              <span>Product availability</span>
                            </div>
                          </div>
                        </div>
                      ) : featuredFarms.map((farm, index) => {
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
                            className={`absolute inset-0 grid content-stretch transition-[opacity,transform] duration-700 ease-out ${
                              isActive ? 'z-10' : 'z-0 pointer-events-none'
                            } ${motionClass}`}
                          >
                            <Link to={farm.href} className="grid h-full gap-4 p-4 transition-colors hover:bg-white/[0.03] sm:p-5">
                              <div className="flex items-start justify-between gap-5">
                                <div className="min-w-0 space-y-3">
                                  <span className="inline-flex w-fit rounded-full bg-white/13 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/95 ring-1 ring-white/10 backdrop-blur-sm">
                                    {farm.badge}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium text-white/58">{farm.locationLabel}</p>
                                    <p className="mt-1 text-2xl font-semibold leading-tight underline-offset-4 hover:underline sm:text-[1.7rem]">{farm.name}</p>
                                  </div>
                                </div>
                                <Route className="mt-2 size-7 shrink-0 text-white/58" />
                              </div>

                              <div className="mt-auto grid gap-2 rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-sm font-medium text-white/78 backdrop-blur-sm sm:grid-cols-3">
                                {farm.metrics.map((metric) => (
                                  <span key={metric}>{metric}</span>
                                ))}
                              </div>
                            </Link>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[rgba(8,54,33,0.72)] px-4 py-3 backdrop-blur-md">
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
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white transition-colors hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--forest-green)]"
                        >
                          <ChevronLeft className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => stepFeaturedFarm(1)}
                          aria-label="Next featured farm"
                          className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white transition-colors hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--forest-green)]"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="hidden gap-3 sm:grid sm:grid-cols-2">
                    <div className="rounded-[1.05rem] border border-white/55 bg-white/78 p-3.5 shadow-[0_10px_24px_rgba(18,28,20,0.05)] backdrop-blur-sm xl:p-4">
                      <p className="text-sm font-semibold text-[var(--forest-green)]">Seasonal signal</p>
                      <p className="mt-2 text-sm leading-6 text-[oklch(0.4_0.035_110)]">
                        Product pages show harvest dates, availability windows, and source detail together.
                      </p>
                    </div>
                    <div className="rounded-[1.05rem] border border-white/55 bg-[#f4f2eb]/85 p-3.5 shadow-[0_10px_24px_rgba(18,28,20,0.05)] backdrop-blur-sm xl:p-4">
                      <p className="text-sm font-semibold text-[var(--forest-green)]">Buyer confidence</p>
                      <p className="mt-2 text-sm leading-6 text-[oklch(0.4_0.035_78)]">
                        Allergens and organic status appear inline before checkout.
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section aria-labelledby="home-context" className="market-section market-section-white">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:py-20">
            <Reveal className="max-w-3xl space-y-5">
              <AnimatedText
                id="home-context"
                as="h2"
                text="The detail is not buried at the end."
                className="market-section-title max-w-3xl text-[oklch(0.23_0.034_87)]"
              />
              <p className="market-copy max-w-2xl">
                Every step of the marketplace keeps the important context in view: who produced it, when it is
                available, what is inside it, and how it gets to the buyer.
              </p>
            </Reveal>

            <RevealGroup className="mt-10 grid gap-6 md:grid-cols-3" stagger={0.08}>
              {homeContextCards.map((card) => (
                <MarketingImageCard
                  key={card.title}
                  image={card.image}
                  alt={card.alt}
                  icon={card.icon}
                  label={card.label}
                  title={card.title}
                  body={card.body}
                  imagePosition={card.imagePosition}
                  minHeightClassName="min-h-[18.25rem]"
                  bodyClassName="max-w-sm"
                />
              ))}
            </RevealGroup>
          </div>
        </section>

        <section aria-labelledby="home-roles" className="market-section market-section-green">
          <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <Reveal className="space-y-5">
                <AnimatedText
                  id="home-roles"
                  as="h2"
                  text="Different jobs, one consistent flow."
                  className="market-section-title max-w-3xl"
                />
                <p className="market-copy max-w-xl">
                  Customers, producers, community buyers, and restaurants use role-specific tools without splitting the
                  marketplace into disconnected experiences.
                </p>
              </Reveal>

              <RevealGroup className="grid gap-5 md:grid-cols-2" stagger={0.07} delayChildren={0.05}>
                {roles.map((role, index) => {
/**
 * Icon boundary.
 *
 * This exported unit supports the file role: Implements the LandingPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
                  const Icon = role.icon;

                  return (
                    <Link
                      key={role.title}
                      to={role.href}
                      className="group block min-h-[clamp(10rem,24svh,13.25rem)] overflow-hidden rounded-[1.35rem] border border-white/18 bg-white/[0.11] p-5 shadow-[0_16px_34px_rgba(9,22,13,0.16)] backdrop-blur-sm ring-1 ring-white/[0.03] transition-[background-color,border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:border-white/28 hover:bg-white/[0.16] hover:shadow-[0_20px_42px_rgba(9,22,13,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--forest-green)]"
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
              </RevealGroup>
            </div>
          </div>
        </section>

        <section aria-labelledby="home-cta" className="market-section market-section-brown">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:py-20 lg:grid-cols-[0.96fr_1.04fr] lg:items-start xl:gap-10">
            <Reveal className="space-y-5">
              <AnimatedText
                id="home-cta"
                as="h2"
                text="Start with public browsing, then choose the role you need."
                className="market-section-title max-w-4xl"
              />
              <p className="market-copy max-w-2xl">
                Browse products, compare producers, and see availability before creating an account.
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
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-[0.9rem] text-[oklch(0.42_0.032_118)]">
                <span className="font-medium">Selling food locally?</span>
                <Link
                  to="/register/producer"
                  className="group inline-flex items-center gap-1.5 font-semibold text-[var(--forest-green)] transition-colors hover:text-[oklch(0.28_0.06_140)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)] focus-visible:ring-offset-2"
                >
                  <span>Join us as a producer</span>
                  <ArrowRight className="size-[1.02rem] shrink-0 transition-transform group-hover:translate-x-1" />
                </Link>
              </p>
            </Reveal>

            <Reveal className="space-y-5 rounded-[1.55rem] border border-[#e4e1d8] bg-white/72 p-5 shadow-[0_18px_42px_rgba(18,28,20,0.08)] sm:p-6" delay={0.06} variant="card">
              {['Browse products and producers', 'Compare food miles and seasonal detail', 'Create an account only at checkout'].map((item) => (
                <div key={item} className="flex items-center gap-3 text-lg font-semibold">
                  <CheckCircle2 className="size-5 shrink-0 text-[var(--forest-green)]" />
                  <span>{item}</span>
                </div>
              ))}
            </Reveal>
          </div>
        </section>
      </main>
    </div>
  );
}
