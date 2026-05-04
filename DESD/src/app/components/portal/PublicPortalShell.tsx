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

import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

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
  compact = false,
  centered = false,
  showSupportCard = true,
  children,
}: PublicPortalShellProps) {
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
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,oklch(0.985_0.01_145),oklch(0.955_0.02_145))]">
      <SiteHeader />

      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[oklch(0.88_0.06_145/.45)] blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-64 w-64 rounded-full bg-[oklch(0.9_0.04_60/.35)] blur-3xl" />
        <div className="absolute bottom-[-7rem] left-1/3 h-80 w-80 rounded-full bg-[oklch(0.88_0.05_200/.2)] blur-3xl" />
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
            <section className="w-full max-w-3xl space-y-3 text-center">
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
                  {title}
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
            </section>

            <section className="w-full max-w-4xl">
              <Card className={`border-[oklch(0.87_0.02_145)] bg-white/90 shadow-xl ${accentClassName ?? ''}`}>
                <CardContent className={cn(compact ? 'p-4 sm:p-5' : 'p-6 sm:p-8')}>{children}</CardContent>
              </Card>
            </section>
          </div>
        ) : (
          <div
            className={cn(
              'grid',
              compact ? 'gap-5 lg:grid-cols-[0.78fr_1.22fr]' : 'gap-8 lg:grid-cols-[1.1fr_0.9fr]',
            )}
          >
            <section className={cn(compact ? 'space-y-4' : 'space-y-6')}>
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
                  {title}
                </h1>
                <p className={cn('max-w-xl text-[oklch(0.36_0.03_145)]', compact ? 'text-base leading-7' : 'text-lg leading-8')}>
                  {description}
                </p>
              </div>

              {showSupportCard ? (
                <Card className={`border bg-white/82 shadow-lg ${accentClassName ?? ''}`}>
                  <CardContent className={cn(compact ? 'space-y-3 p-5' : 'space-y-4 p-6')}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.45_0.05_145)] uppercase">
                          Portal Experience
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[oklch(0.34_0.03_145)]">
                          Each stakeholder signs in through a dedicated portal while the existing platform authentication and RBAC stay unchanged.
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold tracking-[0.2em] text-[oklch(0.45_0.05_145)] uppercase">
                          Platform Focus
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[oklch(0.34_0.03_145)]">
                          Shared backend, role-matched portal access, and stakeholder-specific copy and entry points.
                        </p>
                      </div>
                    </div>

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
            </section>

            <section>
              <Card className="border-[oklch(0.87_0.02_145)] bg-white/90 shadow-xl">
                <CardContent className={cn(compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8')}>{children}</CardContent>
              </Card>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
