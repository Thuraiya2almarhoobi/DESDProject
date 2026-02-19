import { useNavigate } from 'react-router';
import { 
  Package, 
  ShoppingBag, 
  Wallet, 
  LogOut, 
  Plus, 
  AlertCircle, 
  TrendingDown, 
  Calendar, 
  Banknote,
  Clock,
  Tag,
  FileDown,
  Eye,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';

export function ProducerDashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Mock action queue data (1)
  const actionQueue = [
    {
      id: 1,
      type: 'orders',
      icon: ShoppingBag,
      title: '3 orders need confirmation',
      description: '2 orders due to dispatch in < 24h',
      action: 'View orders',
      path: '/producer/orders',
      variant: 'destructive' as const,
      urgent: true,
    },
    {
      id: 2,
      type: 'stock',
      icon: AlertTriangle,
      title: '2 items low stock',
      description: 'Organic Kale, Fresh Whole Milk',
      action: 'Update stock',
      path: '/producer/inventory',
      variant: 'default' as const,
      urgent: false,
    },
    {
      id: 3,
      type: 'seasonal',
      icon: Calendar,
      title: '1 seasonal item ending in 14 days',
      description: 'Organic Tomatoes (May-Sep)',
      action: 'Edit season dates',
      path: '/producer/inventory',
      variant: 'secondary' as const,
      urgent: false,
    },
    {
      id: 4,
      type: 'payout',
      icon: Banknote,
      title: '1 payout scheduled Friday',
      description: 'Estimated: £245.80 (after 5% commission)',
      action: 'View payout',
      path: '/producer/payments',
      variant: 'secondary' as const,
      urgent: false,
    },
  ];

  // Primary action buttons (2)
  const primaryActions = [
    {
      label: 'Add product',
      icon: Plus,
      path: '/producer/inventory',
      variant: 'default' as const,
    },
    {
      label: 'Update stock',
      icon: RefreshCw,
      path: '/producer/inventory',
      variant: 'outline' as const,
    },
    {
      label: 'View orders',
      icon: ShoppingBag,
      path: '/producer/orders',
      variant: 'outline' as const,
    },
    {
      label: 'Create surplus deal',
      icon: Tag,
      path: '/producer/inventory',
      variant: 'outline' as const,
    },
  ];

  // Product health data (5)
  const productHealth = [
    {
      label: 'Low stock items',
      count: 2,
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
    {
      label: 'Season ending soon',
      count: 1,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      label: 'Out of stock',
      count: 1,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
  ];

  // Orders status data (3)
  const ordersStatus = [
    { label: 'New', count: 2, color: 'bg-blue-500' },
    { label: 'Packing', count: 1, color: 'bg-yellow-500' },
    { label: 'Ready', count: 0, color: 'bg-green-500' },
    { label: 'Completed', count: 5, color: 'bg-gray-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Producer Dashboard</h1>
              <p className="text-sm text-gray-700">Welcome back, {user?.name}</p>
            </div>
            <Button 
              variant="ghost" 
              onClick={logout}
              className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <LogOut className="size-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* 1) Action Queue - Today's Work */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="size-5 text-green-700" />
            <h2 className="text-lg font-semibold">Today's work</h2>
            <Badge variant="secondary" className="ml-2">{actionQueue.length} items</Badge>
          </div>
          
          <div className="space-y-3">
            {actionQueue.map((item) => {
              const Icon = item.icon;
              return (
                <Card 
                  key={item.id} 
                  className={`transition-shadow hover:shadow-md ${
                    item.urgent ? 'border-red-300 bg-red-50/50' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`size-10 rounded-lg flex items-center justify-center ${
                          item.urgent ? 'bg-red-100' : 'bg-green-100'
                        }`}>
                          <Icon className={`size-5 ${item.urgent ? 'text-red-700' : 'text-green-700'}`} />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-600 mt-0.5">{item.description}</p>
                        </div>
                      </div>
                      <Button
                        variant={item.variant}
                        size="sm"
                        onClick={() => navigate(item.path)}
                        className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                      >
                        {item.action}
                        <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* 2) Primary Actions Row - Compact */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Quick actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {primaryActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.label}
                  variant={action.variant}
                  onClick={() => navigate(action.path)}
                  className="h-auto py-4 flex-col gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                >
                  <Icon className="size-5" />
                  <span className="text-sm">{action.label}</span>
                </Button>
              );
            })}
          </div>
        </section>

        <Separator />

        {/* Dashboard Cards Grid */}
        <section className="grid md:grid-cols-2 gap-6">
          {/* 3) Orders Card - Enhanced with Status & Deadlines */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/producer/orders')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <ShoppingBag className="size-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Orders</CardTitle>
                    <CardDescription>Manage incoming orders</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status chips */}
              <div className="flex flex-wrap gap-2">
                {ordersStatus.map((status) => (
                  <Badge key={status.label} variant="outline" className="gap-2">
                    <div className={`size-2 rounded-full ${status.color}`} />
                    {status.label} ({status.count})
                  </Badge>
                ))}
              </div>
              
              {/* Deadline warning */}
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                <AlertCircle className="size-4 text-red-600 flex-shrink-0" />
                <span className="text-red-800 font-medium">2 orders due to dispatch in &lt; 24h</span>
              </div>

              {/* Helper text (8) */}
              <p className="text-xs text-gray-500 italic">
                Sorted by delivery date by default
              </p>
            </CardContent>
          </Card>

          {/* 4) Inventory Card - With Stock Controls Hint */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/producer/inventory')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 bg-green-500 rounded-lg flex items-center justify-center">
                    <Package className="size-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Inventory</CardTitle>
                    <CardDescription>Update stock & availability</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 5) Product Health - Actionable Stats */}
              <div className="grid grid-cols-3 gap-2">
                {productHealth.map((health) => {
                  const Icon = health.icon;
                  return (
                    <button
                      key={health.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/producer/inventory');
                      }}
                      className={`p-3 rounded-lg border ${health.borderColor} ${health.bgColor} transition-all hover:shadow-sm focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2`}
                    >
                      <Icon className={`size-4 ${health.color} mb-1`} />
                      <p className={`text-2xl font-semibold ${health.color}`}>{health.count}</p>
                      <p className="text-xs text-gray-600 mt-1">{health.label}</p>
                    </button>
                  );
                })}
              </div>

              {/* Helper text (8) */}
              <div className="space-y-2 text-xs text-gray-500">
                <p className="flex items-start gap-2">
                  <AlertCircle className="size-3 mt-0.5 flex-shrink-0" />
                  <span>When stock hits 0, product is hidden from customers</span>
                </p>
                <p className="flex items-start gap-2">
                  <Calendar className="size-3 mt-0.5 flex-shrink-0" />
                  <span>Seasonal dates control customer "In Season" badge</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 6) Payments Card - Enhanced with Next Payout Details */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/producer/payments')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 bg-purple-500 rounded-lg flex items-center justify-center">
                    <Wallet className="size-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Payments</CardTitle>
                    <CardDescription>View weekly settlements</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Next payout date:</span>
                  <Badge variant="outline" className="gap-1">
                    <Banknote className="size-3" />
                    Friday, Feb 20
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Estimated payout:</span>
                  <span className="text-lg font-semibold text-green-700">£245.80</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Commission deducted (5%):</span>
                  <span className="text-gray-700">£12.29</span>
                </div>
              </div>
              
              <Separator />
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  // Download statement action
                }}
              >
                <FileDown className="size-4" />
                Download weekly statement (CSV)
              </Button>
            </CardContent>
          </Card>

          {/* 7) Surplus Deals Card - New! */}
          <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-green-200 bg-green-50/30" onClick={() => navigate('/producer/inventory')}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-12 bg-gradient-to-br from-green-600 to-emerald-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="size-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Surplus deals
                      <Badge className="bg-green-600">New</Badge>
                    </CardTitle>
                    <CardDescription>Reduce waste, boost sales</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-green-600" />
                  <span className="text-sm text-gray-700">Active deals:</span>
                </div>
                <span className="font-semibold text-green-700">1</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-3 text-orange-600" />
                  <span className="text-sm text-gray-700">Expiring soon:</span>
                </div>
                <span className="font-semibold text-orange-600">1</span>
              </div>
              
              <Separator />
              
              <Button 
                className="w-full gap-2 bg-green-600 hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/producer/inventory');
                }}
              >
                <Tag className="size-4" />
                Create surplus deal
              </Button>

              {/* Helper text (8) */}
              <p className="text-xs text-gray-500 italic">
                Set discount %, end time, best-before date, and quantity cap
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 8) Help Section - Preview as Customer */}
        <section>
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Eye className="size-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">See how customers view your products</p>
                    <p className="text-sm text-gray-600">Preview your listings before they go live</p>
                  </div>
                </div>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/marketplace')}
                  className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                >
                  <Eye className="size-4 mr-2" />
                  Preview as customer
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
