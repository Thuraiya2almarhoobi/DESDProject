import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { PublicPortalShell } from '../../components/portal/PublicPortalShell';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { getLoginPathForRole, getPortalDefinition, getRegisterPathForRole } from '../../lib/portalConfig';

const selectableRoles = ['CUSTOMER', 'RESTAURANT', 'COMMUNITY'] as const;

export function PortalSelectPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requestedMode = searchParams.get('mode');
  const mode = requestedMode === 'login' ? 'login' : 'register';

  return (
    <PublicPortalShell
      eyebrow="Marketplace entry"
      title="Select the best fit"
      description="Choose your account type to continue."
      backHref="/"
      backLabel="Back to home"
      insight={
        mode === 'login'
          ? 'You are continuing to sign in. Choose the role that matches your existing account.'
          : 'You are continuing to sign up. Choose the role that matches how you will use the marketplace.'
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[oklch(0.24_0.02_145)]">Choose your account type to continue</p>
            <p className="mt-1 text-sm text-[oklch(0.36_0.03_145)]">
              Customer, Restaurant, and Community each continue to their existing role-specific auth pages.
            </p>
          </div>
          <Badge className="border-[oklch(0.82_0.03_145)] bg-[oklch(0.96_0.03_145)] text-[oklch(0.3_0.04_145)]">
            {mode === 'login' ? 'Sign in mode' : 'Sign up mode'}
          </Badge>
        </div>

        <div className="grid gap-4">
          {selectableRoles.map((role) => {
            const portal = getPortalDefinition(role);
            const Icon = portal.icon;
            const targetPath = mode === 'login' ? getLoginPathForRole(role) : getRegisterPathForRole(role);

            return (
              <Card
                key={role}
                className={`border bg-[linear-gradient(180deg,white,oklch(0.985_0.008_145))] shadow-sm ${portal.accentClassName}`}
              >
                <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/85 shadow-sm">
                      <Icon className="size-5 text-[oklch(0.46_0.08_145)]" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-[oklch(0.45_0.05_145)] uppercase">
                        {portal.shortTitle}
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-[oklch(0.24_0.02_145)]">{portal.title}</h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-[oklch(0.36_0.03_145)]">{portal.highlight}</p>
                    </div>
                  </div>

                  <Button asChild className="min-w-32 justify-between">
                    <Link to={targetPath}>
                      Continue
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="rounded-2xl border border-[oklch(0.86_0.02_145)] bg-[oklch(0.99_0.006_145)] px-4 py-3 text-sm text-[oklch(0.36_0.03_145)]">
          Are you a producer?{' '}
          <Link
            to="/portal/producer"
            className="font-semibold text-[oklch(0.44_0.08_150)] underline decoration-[oklch(0.72_0.05_145)] underline-offset-4"
          >
            Join here
          </Link>
        </div>
      </div>
    </PublicPortalShell>
  );
}
