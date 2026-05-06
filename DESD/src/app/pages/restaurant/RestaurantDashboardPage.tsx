/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the RestaurantDashboardPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import {
  BookOpenText,
  CalendarClock,
  ClipboardList,
  ListChecks,
  MapPinned,
  PackageCheck,
  ReceiptText,
  ShoppingCart,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { SiteHeader } from '../../components/SiteHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

/**
 * RestaurantDashboardPage boundary.
 *
 * This exported unit supports the file role: Implements the RestaurantDashboardPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function RestaurantDashboardPage() {
  const navigate = useNavigate();
  const quickActions = [
    { label: 'Marketplace', icon: ShoppingCart, path: '/marketplace', variant: 'default' as const },
    { label: 'Order Cart', icon: ClipboardList, path: '/cart', variant: 'outline' as const },
    { label: 'Orders', icon: ReceiptText, path: '/orders/history', variant: 'outline' as const },
    { label: 'Recurring', icon: CalendarClock, path: '/restaurant/recurring-orders', variant: 'outline' as const },
    { label: 'Near Me', icon: MapPinned, path: '/map', variant: 'outline' as const },
    { label: 'Content', icon: BookOpenText, path: '/content/recipes', variant: 'outline' as const },
  ];
  const workflowCards = [
    {
      title: 'Buyer tools included',
      body: 'Orders, maps, recipes, settings.',
      icon: Sparkles,
    },
    {
      title: 'Organise baskets',
      body: 'Clear producer sections for kitchen orders.',
      icon: PackageCheck,
    },
    {
      title: 'Save recurring supply',
      body: 'Weekly or fortnightly templates.',
      icon: CalendarClock,
    },
  ];
  const insightCards = [
    {
      title: 'Recurring supply planning',
      body: 'Recurring templates preserve producer-by-producer quantities while letting you override only the next instance when the kitchen plan changes.',
      icon: CalendarClock,
    },
    {
      title: 'Stripe-enabled restaurant checkout',
      body: 'Restaurant one-off and recurring starter orders can now move through the same hosted Stripe test flow used by the buyer marketplace experience.',
      icon: Sparkles,
    },
    {
      title: 'Sourcing and recipe discovery',
      body: 'Use recipes, stories, and map tools while building orders so chefs and buyers can compare both product inspiration and distance-based sourcing.',
      icon: BookOpenText,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Restaurant Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Role: RESTAURANT | Buyer workspace for organised kitchen ordering and recurring supplier planning
          </p>
        </div>

        <Card className="overflow-hidden border-[oklch(0.84_0.05_145)] bg-[linear-gradient(135deg,rgba(243,249,244,0.98),rgba(255,255,255,0.95))]">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="size-5 text-green-700" />
                  Restaurant Ordering Workspace
                </CardTitle>
                <p className="mt-2 text-sm text-gray-600">
                  Build producer orders for the kitchen, confirm one-off deliveries, and convert stable demand into recurring templates without losing the cleaner buyer-style interface.
                </p>
              </div>
                <Badge variant="secondary">Producer stock limit</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {workflowCards.map((card) => {
/**
 * Icon boundary.
 *
 * This exported unit supports the file role: Implements the RestaurantDashboardPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {quickActions.map((action) => {
/**
 * Icon boundary.
 *
 * This exported unit supports the file role: Implements the RestaurantDashboardPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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
                  <ClipboardList className="mt-0.5 size-4 text-green-700" />
                  <span>Producer sections remain separate so kitchen receiving and supplier timing stay easy to read during checkout.</span>
                </div>
                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 size-4 text-green-700" />
                  <span>Recurring templates let you schedule weekly or fortnightly replenishment without rebuilding the order from scratch.</span>
                </div>
                <div className="flex items-start gap-3">
                  <PackageCheck className="mt-0.5 size-4 text-green-700" />
                  <span>Large quantities are supported, with each product limited by the producer&apos;s live available stock.</span>
                </div>
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 text-green-700" />
                  <span>Stripe checkout is now available for restaurant purchases, so hosted payment and buyer-side order flow stay consistent.</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <ListChecks className="size-5 text-green-700" />
            <h2 className="text-lg font-semibold">Restaurant ordering highlights</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {insightCards.map((card) => {
/**
 * Icon boundary.
 *
 * This exported unit supports the file role: Implements the RestaurantDashboardPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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
                Ready to build or repeat a kitchen order?
              </p>
              <p className="mt-1 text-sm text-gray-600">
                Start with the marketplace for one-off sourcing, then open recurring orders when a supplier mix becomes part of your standard weekly rhythm.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigate('/marketplace')}>Create Kitchen Order</Button>
              <Button variant="outline" onClick={() => navigate('/restaurant/recurring-orders')}>
                Open Recurring Orders
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
