import { LogOut, UtensilsCrossed } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';

export function RestaurantDashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Restaurant Dashboard</h1>
            <p className="text-sm text-gray-700">{user?.name}</p>
          </div>
          <Button variant="ghost" onClick={logout}>
            <LogOut className="size-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="size-5 text-green-700" />
              Recurring Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Restaurant stakeholders now use shared login and are routed to a dedicated recurring-orders surface.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
