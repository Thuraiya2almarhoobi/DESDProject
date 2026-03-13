import { CalendarClock, ListChecks, UtensilsCrossed } from 'lucide-react';
import { useNavigate } from 'react-router';
import { SiteHeader } from '../../components/SiteHeader';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export function RestaurantDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div>
          <h1 className="text-3xl font-semibold">Restaurant Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Role: RESTAURANT | Interface: Recurring and multi-producer ordering
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="size-5 text-green-700" />
              Restaurant Ordering Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Create a multi-producer order, enable recurring at checkout, then manage schedules and next-instance edits without changing template defaults.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/marketplace')}>Create Initial Order</Button>
              <Button variant="outline" onClick={() => navigate('/restaurant/recurring-orders')}>
                Open Recurring Orders
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarClock className="size-4 text-green-700" />
                Recurrence Setup
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Weekly and fortnightly templates with order day and delivery day controls.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ListChecks className="size-4 text-green-700" />
                Instance Overrides
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Adjust next run quantities per product while preserving template baselines.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
