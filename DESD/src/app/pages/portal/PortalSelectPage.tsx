import { ArrowRight } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router';

import { PublicPortalShell } from '../../components/portal/PublicPortalShell';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { getPortalDefinition, getRegisterPathForRole } from '../../lib/portalConfig';

const selectableRoles = ['CUSTOMER', 'RESTAURANT', 'COMMUNITY'] as const;
const roleStyles = {
  CUSTOMER: {
    card: 'border-[oklch(0.66_0.08_145)] bg-[linear-gradient(145deg,oklch(0.35_0.07_145),oklch(0.29_0.06_145))]',
    iconWrap: 'bg-white/14 ring-1 ring-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]',
    icon: 'text-white',
    eyebrow: 'text-white/75',
    title: 'text-white',
    body: 'text-white/87',
  },
  RESTAURANT: {
    card: 'border-[oklch(0.73_0.06_72)] bg-[linear-gradient(145deg,oklch(0.39_0.06_78),oklch(0.33_0.05_66))]',
    iconWrap: 'bg-white/14 ring-1 ring-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]',
    icon: 'text-white',
    eyebrow: 'text-white/75',
    title: 'text-white',
    body: 'text-white/87',
  },
  COMMUNITY: {
    card: 'border-[oklch(0.68_0.06_165)] bg-[linear-gradient(145deg,oklch(0.35_0.06_162),oklch(0.3_0.05_152))]',
    iconWrap: 'bg-white/14 ring-1 ring-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]',
    icon: 'text-white',
    eyebrow: 'text-white/75',
    title: 'text-white',
    body: 'text-white/87',
  },
} as const;

export function PortalSelectPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedMode = searchParams.get('mode');

  if (requestedMode === 'login') {
    return <Navigate to="/login" replace />;
  }

  return (
    <PublicPortalShell
      eyebrow="Marketplace entry"
      title="Select the best fit"
      description="Choose your account type to continue."
      backHref="/"
      backLabel="Back to home"
      compact
      centered
      insight="Pick the role that matches how you will use the marketplace."
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-[oklch(0.84_0.03_145)] bg-[linear-gradient(180deg,white,oklch(0.985_0.008_145))] p-3 shadow-sm">
          <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div>
              <p className="text-sm font-semibold text-[oklch(0.24_0.02_145)]">Choose your account type to continue</p>
              <p className="mt-1 text-sm leading-5 text-[oklch(0.36_0.03_145)]">
                Customer, Restaurant, and Community each continue to a role-specific registration page.
              </p>
            </div>

            <div className="flex flex-col items-start gap-1.5 xl:items-end">
              <Badge className="border-[oklch(0.82_0.03_145)] bg-[oklch(0.96_0.03_145)] text-[oklch(0.3_0.04_145)]">
                Sign up mode
              </Badge>
              <p className="text-xs text-[oklch(0.37_0.03_145)] sm:text-sm">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-[oklch(0.43_0.08_150)] underline decoration-[oklch(0.68_0.06_145)] underline-offset-4"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {selectableRoles.map((role) => {
            const portal = getPortalDefinition(role);
            const Icon = portal.icon;
            const targetPath = getRegisterPathForRole(role);
            const styles = roleStyles[role];

            return (
              <Card
                key={role}
                className={`group relative overflow-hidden rounded-[1.6rem] border shadow-[0_10px_24px_rgba(17,32,17,0.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(17,32,17,0.2)] ${styles.card}`}
              >
                <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-white/14 blur-2xl transition-transform duration-500 group-hover:scale-110" />
                <div className="pointer-events-none absolute -bottom-14 -left-10 size-32 rounded-full bg-black/18 blur-3xl" />

                <CardContent className="relative z-10 flex h-full flex-col gap-2.5 p-3.5">
                  <div className="flex items-start gap-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${styles.iconWrap}`}>
                      <Icon className={`size-4 ${styles.icon}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${styles.eyebrow}`}>
                        {portal.shortTitle}
                      </p>
                      <h2 className={`mt-1 text-[15px] font-semibold leading-5 ${styles.title}`}>{portal.title}</h2>
                      <p className={`mt-1.5 text-sm leading-5 ${styles.body}`}>{portal.highlight}</p>
                    </div>
                  </div>

                  <Button
                    asChild
                    className="mt-auto h-9.5 w-full justify-between rounded-xl border border-white/45 bg-white px-3.5 text-sm font-semibold text-[oklch(0.27_0.05_145)] shadow-md transition-all duration-300 hover:bg-[oklch(0.98_0.01_145)]"
                  >
                    <Link to={targetPath}>
                      Continue
                      <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[oklch(0.83_0.04_145)] bg-[linear-gradient(180deg,oklch(0.99_0.01_145),white)] px-4 py-2.5 text-sm leading-5 text-[oklch(0.34_0.03_145)] shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-3">
          <div>
            <span className="font-medium">Want to be a producer or want to sell?</span>{' '}
            <span>Use the producer registration route.</span>
          </div>
          <Link
            to="/register/producer"
            className="mt-1.5 inline-block shrink-0 font-semibold text-[oklch(0.43_0.08_150)] underline decoration-[oklch(0.68_0.06_145)] underline-offset-4 sm:mt-0"
          >
            Join now
          </Link>
        </div>
      </div>
    </PublicPortalShell>
  );
}
