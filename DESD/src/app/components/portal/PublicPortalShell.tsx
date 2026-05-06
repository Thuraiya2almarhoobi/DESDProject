/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Provides the reusable PublicPortalShell component used by pages or layout shells.
 *
 * Frontend context:
 *   Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { ArrowLeft, BellRing, CheckCircle2, LayoutDashboard, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';

import { AnimatedText, Reveal, RevealGroup } from '../motion/Motion';
import { SiteHeader } from '../SiteHeader';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';

interface PublicPortalShellProps {
  eyebrow?: string;
  title: string;
  description: string;
  accentClassName?: string;
  backHref?: string;
  backLabel?: string;
  insight?: string;
  supportItems?: string[];
  supportSteps?: string[];
  supportHighlights?: string[];
  compact?: boolean;
  centered?: boolean;
  showSupportCard?: boolean;
  children: React.ReactNode;
}

/**
 * PublicPortalShell boundary.
 *
 * This exported unit supports the file role: Provides the reusable PublicPortalShell component used by pages or layout shells.
 * It belongs to: Reusable React component layer: shared layout, maps, product metadata, protection wrappers, and UI building blocks.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function PublicPortalShell({
  eyebrow,
  title,
  description,
  accentClassName,
  backHref,
  backLabel = 'Back',
  insight,
  supportItems,
  supportSteps,
  supportHighlights,
  compact = false,
  centered = false,
  showSupportCard = true,
  children,
}: PublicPortalShellProps) {
  const highlightIcons = [ShieldCheck, LayoutDashboard, BellRing] as const;
  const backAction = backHref ? (
    <Button asChild variant="ghost" className="w-fit">
      <Link to={backHref}>
        <ArrowLeft className="mr-2 size-4" />
        {backLabel}
      </Link>
    </Button>
  ) : (
    <Button asChild variant="ghost" className="w-fit">
      <Link to="/login">Generic Login</Link>
    </Button>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,oklch(0.975_0.028_145)_0%,oklch(0.94_0.045_145)_48%,oklch(0.965_0.026_130)_100%)]">
      <SiteHeader />

      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[oklch(0.83_0.09_145/.36)] blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-64 w-64 rounded-full bg-[oklch(0.88_0.075_128/.3)] blur-3xl" />
        <div className="absolute bottom-[-7rem] left-1/3 h-80 w-80 rounded-full bg-[oklch(0.9_0.05_160/.28)] blur-3xl" />
      </div>

      <main
        className={cn(
          'relative z-10 mx-auto w-full px-4',
          centered
            ? 'max-w-5xl min-h-[calc(100vh-4.5rem)] py-4 pb-16 lg:min-h-[calc(100vh-5rem)] lg:py-6 lg:pb-20'
            : compact
              ? 'max-w-7xl py-6 lg:py-8'
              : 'max-w-6xl py-10 lg:py-16',
        )}
      >
        {centered ? (
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4">
            <div className="flex w-full max-w-3xl justify-start">{backAction}</div>
            <RevealGroup as="section" className="w-full max-w-3xl space-y-3 text-center" stagger={0.1}>
              {eyebrow ? (
                <div className="flex justify-center">
                  <Badge className="rounded-full border border-[oklch(0.82_0.03_145)] bg-white/80 px-4 py-1 text-[0.7rem] font-semibold tracking-[0.22em] text-[oklch(0.42_0.05_145)] uppercase shadow-sm">
                    {eyebrow}
                  </Badge>
                </div>
              ) : null}

              <div className={cn(compact ? 'space-y-2.5' : 'space-y-4')}>
                <h1
                  className={cn(
                    'mx-auto max-w-2xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)]',
                    compact ? 'text-2xl sm:text-3xl' : 'text-4xl sm:text-5xl',
                  )}
                >
                  <AnimatedText as="span" text={title} />
                </h1>
                <p
                  className={cn(
                    'mx-auto max-w-2xl text-[oklch(0.36_0.03_145)]',
                    compact ? 'text-sm leading-6 sm:text-base' : 'text-lg leading-8',
                  )}
                >
                  {description}
                </p>
                {insight ? <p className="mx-auto max-w-2xl text-sm leading-5 text-[oklch(0.34_0.03_145)]">{insight}</p> : null}
              </div>
            </RevealGroup>

            <Reveal as="section" className="w-full max-w-4xl" variant="card" delay={0.12}>
              <Card className={`border-[oklch(0.87_0.02_145)] bg-white/90 shadow-xl ${accentClassName ?? ''}`}>
                <CardContent className={cn(compact ? 'p-4 sm:p-5' : 'p-6 sm:p-8')}>{children}</CardContent>
              </Card>
            </Reveal>
          </div>
        ) : (
          <div
            className={cn(
              'grid',
              compact ? 'gap-5 lg:grid-cols-[0.78fr_1.22fr]' : 'gap-8 lg:grid-cols-[1.1fr_0.9fr]',
            )}
          >
            <RevealGroup
              as="section"
              className={cn(
                'flex h-full flex-col [&>*:last-child]:flex-1 [&>*:last-child>*]:h-full',
                compact ? 'gap-4' : 'gap-6',
              )}
              stagger={0.1}
            >
              {backAction}

              {eyebrow ? (
                <Badge className="rounded-full border border-[oklch(0.82_0.03_145)] bg-white/80 px-4 py-1 text-[0.7rem] font-semibold tracking-[0.22em] text-[oklch(0.42_0.05_145)] uppercase shadow-sm">
                  {eyebrow}
                </Badge>
              ) : null}

              <div className={cn(compact ? 'space-y-3' : 'space-y-4')}>
                <h1
                  className={cn(
                    'max-w-2xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)]',
                    compact ? 'text-3xl sm:text-4xl' : 'text-4xl sm:text-5xl',
                  )}
                >
                  <AnimatedText as="span" text={title} />
                </h1>
                <p className={cn('max-w-xl text-[oklch(0.36_0.03_145)]', compact ? 'text-base leading-7' : 'text-lg leading-8')}>
                  {description}
                </p>
              </div>

              {showSupportCard ? (
                <Card className={`h-full border bg-white/82 shadow-lg ${accentClassName ?? ''}`}>
                  <CardContent className={cn('flex h-full flex-col', compact ? 'gap-4 p-5' : 'gap-5 p-6')}>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.45_0.05_145)] uppercase">
                          Account setup
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[oklch(0.34_0.03_145)]">
                          Create one secure marketplace account, then use the workspace that matches your ordering or selling role.
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.45_0.05_145)] uppercase">
                          Role details
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[oklch(0.34_0.03_145)]">
                          The form asks only for the contact, delivery, or business information needed for that role.
                        </p>
                      </div>
                    </div>

                    {supportItems?.length ? (
                      <div className="rounded-2xl border border-white/70 bg-white/68 p-4 shadow-sm">
                        <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.45_0.05_145)] uppercase">
                          What you&apos;ll need
                        </p>
                        <div className="mt-4 grid gap-3">
                          {supportItems.map((item) => (
                            <div key={item} className="flex items-start gap-3 text-sm leading-6 text-[oklch(0.31_0.03_145)]">
                              <CheckCircle2 className="mt-1 size-4 shrink-0 text-[var(--forest-green)]" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {supportSteps?.length ? (
                      <div className="flex flex-1 flex-col rounded-2xl border border-[color-mix(in_srgb,var(--forest-green)_12%,white)] bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(255,255,255,0.42))] p-4 shadow-sm">
                        <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.45_0.05_145)] uppercase">
                          After you submit
                        </p>
                        <div className="mt-4 flex flex-1 flex-col justify-between gap-5">
                          <div className="relative">
                            <div className="absolute bottom-4 left-4 top-4 w-px bg-[color-mix(in_srgb,var(--forest-green)_16%,white)]" />
                            <div className="grid gap-3">
                              {supportSteps.map((step, index) => (
                                <div
                                  key={step}
                                  className="relative grid grid-cols-[2rem_1fr] gap-3 rounded-xl bg-white/58 p-3 text-sm leading-6 text-[oklch(0.31_0.03_145)] ring-1 ring-white/60"
                                >
                                  <span className="relative z-10 flex size-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--forest-green)_10%,white)] text-xs font-semibold text-[var(--forest-green)] shadow-sm">
                                    {String(index + 1).padStart(2, '0')}
                                  </span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {supportHighlights?.length ? (
                            <div className="border-t border-[color-mix(in_srgb,var(--forest-green)_10%,white)] pt-4">
                              <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.45_0.05_145)] uppercase">
                                You&apos;ll be ready to
                              </p>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                                {supportHighlights.map((item, index) => {
                                  const Icon = highlightIcons[index % highlightIcons.length];
                                  return (
                                    <div
                                      key={item}
                                      className="flex min-h-[5.5rem] flex-col justify-between rounded-xl bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(238,245,239,0.84))] px-3 py-3 text-[oklch(0.31_0.03_145)] ring-1 ring-white/75"
                                    >
                                      <Icon className="size-4 text-[var(--forest-green)]" />
                                      <span className="text-sm font-medium leading-5">{item}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {insight ? (
                      <div
                        className={cn(
                          'rounded-2xl border border-white/70 bg-white/75 text-sm text-[oklch(0.3_0.03_145)] shadow-sm',
                          compact ? 'p-3 leading-5' : 'p-4 leading-6',
                        )}
                      >
                        {insight}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </RevealGroup>

            <Reveal as="section" className="h-full [&>*]:h-full" variant="card" delay={0.14}>
              <Card className="h-full border-[oklch(0.87_0.02_145)] bg-white/90 shadow-xl">
                <CardContent className={cn(compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8')}>{children}</CardContent>
              </Card>
            </Reveal>
          </div>
        )}
      </main>
    </div>
  );
}
