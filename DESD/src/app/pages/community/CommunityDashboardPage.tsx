import { Building2, Truck, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { SiteHeader } from '../../components/SiteHeader';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export function CommunityDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div>
          <h1 className="text-3xl font-semibold">Community Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Role: COMMUNITY | Interface: Multi-producer bulk ordering</p>
        </div>
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
