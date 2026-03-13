import { CalendarClock, ListChecks, LogOut, UtensilsCrossed } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';

export function RestaurantDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Restaurant Dashboard</h1>
            <p className="text-sm text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-600 mt-1">Role: RESTAURANT | Interface: Recurring and multi-producer ordering</p>
          </div>
          <Button variant="ghost" onClick={logout}>
            <LogOut className="size-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">
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
