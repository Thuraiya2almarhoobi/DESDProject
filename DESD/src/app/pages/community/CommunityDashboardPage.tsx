import {
  BookOpenText,
  Building2,
  ClipboardList,
  MapPinned,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { SiteHeader } from '../../components/SiteHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export function CommunityDashboardPage() {
  const navigate = useNavigate();
  const quickActions = [
    { label: 'Marketplace', icon: ShoppingCart, path: '/marketplace', variant: 'default' as const },
    { label: 'Order Cart', icon: ClipboardList, path: '/cart', variant: 'outline' as const },
    { label: 'Orders', icon: ReceiptText, path: '/orders/history', variant: 'outline' as const },
    { label: 'Near Me', icon: MapPinned, path: '/map', variant: 'outline' as const },
    { label: 'Recipes', icon: BookOpenText, path: '/content/recipes', variant: 'outline' as const },
  ];
  const workflowCards = [
    {
      title: 'Build one basket',
      body: 'Group products by producer.',
      icon: Users,
    },
    {
      title: 'Buyer tools included',
      body: 'Orders, maps, recipes, settings.',
      icon: Sparkles,
    },
    {
      title: 'Pay with Stripe',
      body: 'Hosted checkout for bulk orders.',
      icon: PackageCheck,
    },
  ];
  const insightCards = [
    {
      title: 'Bulk checkout discipline',
      body: 'Selected cart lines move into checkout while unselected ones stay saved for later cycles, which keeps volunteer ordering cleaner.',
      icon: ClipboardList,
    },
    {
      title: 'Drop-off coordination',
      body: 'Producer sections remain visible throughout checkout so site access notes, unloading instructions, and contact details stay easy to review.',
      icon: Truck,
    },
    {
      title: 'Local sourcing visibility',
      body: 'The map and food-mile tools stay available for community accounts so you can make lower-distance sourcing decisions before placing the order.',
      icon: MapPinned,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Community Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Role: COMMUNITY | Buyer workspace for large multi-producer orders and organised community delivery coordination
          </p>
        </div>

        <Card className="overflow-hidden border-[oklch(0.84_0.05_145)] bg-[linear-gradient(135deg,rgba(243,249,244,0.98),rgba(255,255,255,0.95))]">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="size-5 text-green-700" />
                  Community Bulk Ordering Workspace
                </CardTitle>
                <p className="mt-2 text-sm text-gray-600">
                  Build one shared order across producers, keep delivery notes organised, and use the same polished buyer tools available in the customer marketplace flow.
                </p>
              </div>
                <Badge variant="secondary">Producer stock limit</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {workflowCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.title} className="rounded-2xl border bg-white/85 p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-[oklch(0.45_0.11_150)]">
                        <Icon className="size-4" />
                        <p className="text-xs font-semibold uppercase tracking-[0.16em]">Workspace</p>
                      </div>
                      <p className="mt-3 font-semibold text-gray-900">{card.title}</p>
                      <p className="mt-1 text-sm text-gray-600">{card.body}</p>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.label}
                      variant={action.variant}
                      onClick={() => navigate(action.path)}
                      className="h-auto min-h-20 flex-col gap-2 py-4"
                    >
                      <Icon className="size-5" />
                      <span className="text-center text-xs font-medium leading-tight">{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border bg-white/88 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Operational notes</p>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-4 text-green-700" />
                  <span>Each producer stays grouped so drop-off planning remains clear for schools, charities, food banks, and community kitchens.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Truck className="mt-0.5 size-4 text-green-700" />
                  <span>Add unloading notes, access points, and receiving contacts directly during checkout.</span>
                </div>
                <div className="flex items-start gap-3">
                  <PackageCheck className="mt-0.5 size-4 text-green-700" />
                  <span>Large quantities are supported, with each product limited by the producer&apos;s live available stock.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 text-green-700" />
                  <span>Community checkout now follows the same polished buyer journey and Stripe payment handoff used by the main customer marketplace.</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="size-5 text-green-700" />
            <h2 className="text-lg font-semibold">Community ordering highlights</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {insightCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.title} className="border-[oklch(0.88_0.02_145)] bg-white/90">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Icon className="size-4 text-green-700" />
                      {card.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600">{card.body}</CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Card className="border-[oklch(0.88_0.02_145)] bg-white/92">
          <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[oklch(0.26_0.03_145)]">
                Ready to place a coordinated community order?
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Start in the marketplace, organise the order cart by producer, and move to Stripe once the basket is ready.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/marketplace')}>Start Community Order</Button>
              <Button variant="outline" onClick={() => navigate('/cart')}>
                Review Order Cart
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
