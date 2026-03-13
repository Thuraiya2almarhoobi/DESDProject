import { ArrowLeft, Sprout } from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

interface PublicPortalShellProps {
  eyebrow: string;
  title: string;
  description: string;
  accentClassName?: string;
  backHref?: string;
  backLabel?: string;
  insight?: string;
  children: React.ReactNode;
}

export function PublicPortalShell({
  eyebrow,
  title,
  description,
  accentClassName,
  backHref,
  backLabel = 'Back',
  insight,
  children,
}: PublicPortalShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,oklch(0.985_0.01_145),oklch(0.955_0.02_145))]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[oklch(0.88_0.06_145/.45)] blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-64 w-64 rounded-full bg-[oklch(0.9_0.04_60/.35)] blur-3xl" />
        <div className="absolute bottom-[-7rem] left-1/3 h-80 w-80 rounded-full bg-[oklch(0.88_0.05_200/.2)] blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-[oklch(0.88_0.02_145)] bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,oklch(0.43_0.11_155),oklch(0.57_0.08_140))] shadow-sm">
              <Sprout className="size-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em] text-[oklch(0.42_0.06_150)] uppercase">
                Bristol Marketplace
              </p>
              <p className="text-sm text-[oklch(0.35_0.03_145)]">
                Local produce portals for buyers, producers, and institutions
              </p>
            </div>
          </Link>

          {backHref ? (
            <Button asChild variant="ghost">
              <Link to={backHref}>
                <ArrowLeft className="mr-2 size-4" />
                {backLabel}
              </Link>
            </Button>
          ) : (
            <Button asChild variant="ghost">
              <Link to="/login">Generic Login</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <section className="space-y-6">
          <Badge className="rounded-full border border-[oklch(0.82_0.03_145)] bg-white/80 px-4 py-1 text-[0.7rem] font-semibold tracking-[0.22em] text-[oklch(0.42_0.05_145)] uppercase shadow-sm">
            {eyebrow}
          </Badge>

          <div className="space-y-4">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-[oklch(0.24_0.02_145)] sm:text-5xl">
              {title}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-[oklch(0.36_0.03_145)]">
              {description}
            </p>
          </div>

          <Card className={`border bg-white/82 shadow-lg ${accentClassName ?? ''}`}>
            <CardContent className="space-y-4 p-6">
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
                <div className="rounded-2xl border border-white/70 bg-white/75 p-4 text-sm leading-6 text-[oklch(0.3_0.03_145)] shadow-sm">
                  {insight}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-[oklch(0.87_0.02_145)] bg-white/90 shadow-xl">
            <CardContent className="p-6 sm:p-8">{children}</CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
