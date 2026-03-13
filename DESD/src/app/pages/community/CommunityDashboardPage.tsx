import { Building2, LogOut, Truck, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';

export function CommunityDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Community Dashboard</h1>
            <p className="text-sm text-gray-700">{user?.name}</p>
            <p className="text-xs text-gray-600 mt-1">Role: COMMUNITY | Interface: Multi-producer bulk ordering</p>
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
              <Users className="size-5 text-green-700" />
              Community Bulk Ordering Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Build one order across multiple producers, enter large writable quantities, and pass special delivery instructions to suppliers.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/marketplace')}>Start Bulk Order</Button>
              <Button variant="outline" onClick={() => navigate('/orders/history')}>
                View Community Orders
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4 text-green-700" />
                Multi-Producer Coordination
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Checkout confirmation includes supplier contact details for direct delivery coordination.
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="size-4 text-green-700" />
                Delivery Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Add special instructions such as kitchen access points and delivery contact notes during checkout.
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
