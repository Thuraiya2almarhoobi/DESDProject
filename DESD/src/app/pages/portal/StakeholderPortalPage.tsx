import { Link } from 'react-router';

import { useAuth } from '../../contexts/AuthContext';
import { PublicPortalShell } from '../../components/portal/PublicPortalShell';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { getPortalDefinition, PortalRole } from '../../lib/portalConfig';
import { getDashboardPathForRole } from '../../lib/roleRouting';

interface StakeholderPortalPageProps {
  role: PortalRole;
}

export function StakeholderPortalPage({ role }: StakeholderPortalPageProps) {
  const definition = getPortalDefinition(role);
  const { user } = useAuth();
  const Icon = definition.icon;
  const canOpenDashboard = user?.role === role;

  return (
    <PublicPortalShell
      eyebrow={definition.title}
      title={definition.portalHeading}
      description={definition.portalDescription}
      accentClassName={definition.accentClassName}
      backHref="/"
      backLabel="Back to Landing"
      insight={definition.highlight}
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[oklch(0.95_0.03_145)] shadow-sm">
            <Icon className="size-6 text-[oklch(0.46_0.08_145)]" />
          </div>
          <div className="space-y-2">
            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em]">
              {definition.audience}
            </Badge>
            <p className="text-sm leading-6 text-[oklch(0.36_0.03_145)]">
              Use this portal if your account belongs to the {definition.shortTitle.toLowerCase()} stakeholder flow.
            </p>
          </div>
        </div>

        <Card className="border-[oklch(0.86_0.02_145)] bg-[oklch(0.99_0.005_145)] shadow-sm">
          <CardContent className="space-y-4 p-5">
            <div>
              <p className="text-sm font-semibold text-[oklch(0.24_0.02_145)]">Choose your next step</p>
              <p className="mt-2 text-sm leading-6 text-[oklch(0.36_0.03_145)]">
                The backend login remains shared, but this portal makes the entry point and expected account type explicit.
              </p>
            </div>

            <div className="grid gap-3">
              <Button asChild size="lg" className="justify-between">
                <Link to={definition.loginPath}>{definition.loginButtonLabel}</Link>
              </Button>

              {definition.registerPath ? (
                <Button asChild size="lg" variant="outline" className="justify-between">
                  <Link to={definition.registerPath}>{definition.registerButtonLabel}</Link>
                </Button>
              ) : (
                <div className="rounded-2xl border border-[oklch(0.86_0.02_145)] bg-white p-4 text-sm leading-6 text-[oklch(0.36_0.03_145)]">
                  Admin accounts are created internally. Use the admin login entry above.
                </div>
              )}

              {canOpenDashboard ? (
                <Button asChild variant="ghost" className="justify-between">
                  <Link to={getDashboardPathForRole(role)}>Open Existing Dashboard</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicPortalShell>
  );
}
