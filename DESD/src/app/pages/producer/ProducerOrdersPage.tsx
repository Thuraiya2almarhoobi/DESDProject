import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Package, Calendar, MapPin, Clock, AlertCircle, MessageCircle, FileText, TrendingUp } from 'lucide-react';
import { mockOrders, mockProducts } from '../../data/mockData';
import { OrderStatus } from '../../types';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Separator } from '../../components/ui/separator';
import { toast } from 'sonner';
import { format, differenceInHours, parseISO } from 'date-fns';

export function ProducerOrdersPage() {
  const navigate = useNavigate();
  
  const now = new Date();
  const addHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();

  const supplementalOrders = [
    {
      id: 'order-3',
      customerId: 'user-4',
      customerName: 'St. Mary School Kitchen',
      customerEmail: 'kitchen@stmaryschool.org',
      producerId: 'producer-1',
      producerName: 'Green Valley Farm',
      items: [
        { product: mockProducts[7], quantity: 12 },
        { product: mockProducts[2], quantity: 4 },
      ],
      subtotal: 34.40,
      commission: 1.72,
      total: 36.12,
      status: 'pending' as OrderStatus,
      deliveryDate: addHours(72),
      deliveryAddress: '10 Education Road, Bristol, UK',
      createdAt: addHours(0),
    },
    {
      id: 'order-4',
      customerId: 'user-5',
      customerName: 'The Green Table Restaurant',
      customerEmail: 'orders@greentable.co.uk',
      producerId: 'producer-1',
      producerName: 'Green Valley Farm',
      items: [
        { product: mockProducts[0], quantity: 8 },
      ],
      subtotal: 36.00,
      commission: 1.80,
      total: 37.80,
      status: 'confirmed' as OrderStatus,
      deliveryDate: addHours(96),
      deliveryAddress: '22 Clifton Place, Bristol, UK',
      createdAt: addHours(20),
    },
    {
      id: 'order-5',
      customerId: 'user-1',
      customerName: 'Jane Customer',
      customerEmail: 'customer@example.com',
      producerId: 'producer-1',
      producerName: 'Green Valley Farm',
      items: [
        { product: mockProducts[9], quantity: 6 },
      ],
      subtotal: 16.80,
      commission: 0.84,
      total: 17.64,
      status: 'ready' as OrderStatus,
      deliveryDate: addHours(120),
      deliveryAddress: '123 Main Street, London, UK',
      createdAt: addHours(40),
    },
  ];

  // Filter orders for current producer (producer-1 in mock data)
  const producerOrders = [...mockOrders, ...supplementalOrders]
    .filter(order => order.producerId === 'producer-1')
    .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()); // 3) Sort by delivery date (earliest first)

  const [orders, setOrders] = useState(producerOrders);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  // 3) Calculate order counts by status
  const statusCounts = useMemo(() => {
    return {
      pending: orders.filter(o => o.status === 'pending').length,
      confirmed: orders.filter(o => o.status === 'confirmed').length,
      preparing: orders.filter(o => o.status === 'preparing').length,
      ready: orders.filter(o => o.status === 'ready').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
    };
  }, [orders]);

  // 3) Calculate urgent orders (delivery < 24h)
  const urgentOrders = useMemo(() => {
    const now = new Date();
    return orders.filter(order => {
      const deliveryDate = parseISO(order.deliveryDate);
      const hoursUntilDelivery = differenceInHours(deliveryDate, now);
      return hoursUntilDelivery < 24 && hoursUntilDelivery > 0 && order.status !== 'delivered' && order.status !== 'cancelled';
    });
  }, [orders]);

  // Filter orders by status
  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, status } : order
      )
    );
    toast.success(`Order ${orderId} status updated to ${status}`);
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors: Record<OrderStatus, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      preparing: 'bg-purple-100 text-purple-800 border-purple-300',
      ready: 'bg-green-100 text-green-800 border-green-300',
      delivered: 'bg-gray-100 text-gray-800 border-gray-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status];
  };

  const isOrderUrgent = (order: typeof orders[0]) => {
    const deliveryDate = parseISO(order.deliveryDate);
    const hoursUntilDelivery = differenceInHours(deliveryDate, now);
    return hoursUntilDelivery < 24 && hoursUntilDelivery > 0 && order.status !== 'delivered' && order.status !== 'cancelled';
  };

  const getLeadTimeHours = (order: typeof orders[0]) => {
    return differenceInHours(parseISO(order.deliveryDate), parseISO(order.createdAt));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/producer/dashboard')}
            className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-semibold">Orders</h1>
            <p className="text-gray-700 mt-1 flex items-center gap-2">
              <TrendingUp className="size-4" />
              Sorted by delivery date (earliest first)
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1.5">
            {orders.length} total orders
          </Badge>
        </div>

        {/* 3) Urgent Orders Warning */}
        {urgentOrders.length > 0 && (
          <Card className="mb-6 border-red-300 bg-red-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Clock className="size-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-red-900">
                    {urgentOrders.length} order{urgentOrders.length !== 1 ? 's' : ''} due to dispatch in &lt; 24h
                  </p>
                  <p className="text-sm text-red-700 mt-0.5">
                    Review and update status to avoid delivery delays
                  </p>
                </div>
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={() => setStatusFilter('pending')}
                  className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                >
                  View urgent
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 3) Status Filter Tabs */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filter by status:</span>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                  onClick={() => setStatusFilter('all')}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('all')}
                >
                  All ({orders.length})
                </Badge>
                <Badge
                  variant={statusFilter === 'pending' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-yellow-100 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                  onClick={() => setStatusFilter('pending')}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('pending')}
                >
                  <div className="size-2 rounded-full bg-yellow-500 mr-1.5" />
                  New ({statusCounts.pending})
                </Badge>
                <Badge
                  variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-blue-100 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                  onClick={() => setStatusFilter('confirmed')}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('confirmed')}
                >
                  <div className="size-2 rounded-full bg-blue-500 mr-1.5" />
                  Confirmed ({statusCounts.confirmed})
                </Badge>
                <Badge
                  variant={statusFilter === 'preparing' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-purple-100 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                  onClick={() => setStatusFilter('preparing')}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('preparing')}
                >
                  <div className="size-2 rounded-full bg-purple-500 mr-1.5" />
                  Packing ({statusCounts.preparing})
                </Badge>
                <Badge
                  variant={statusFilter === 'ready' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-green-100 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                  onClick={() => setStatusFilter('ready')}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('ready')}
                >
                  <div className="size-2 rounded-full bg-green-500 mr-1.5" />
                  Ready ({statusCounts.ready})
                </Badge>
                <Badge
                  variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-green-600"
                  onClick={() => setStatusFilter('delivered')}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setStatusFilter('delivered')}
                >
                  <div className="size-2 rounded-full bg-gray-500 mr-1.5" />
                  Completed ({statusCounts.delivered})
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="size-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {statusFilter === 'all' ? 'No orders yet' : `No ${statusFilter} orders`}
              </p>
              {statusFilter !== 'all' && (
                <Button 
                  variant="outline" 
                  onClick={() => setStatusFilter('all')}
                  className="mt-4"
                >
                  View all orders
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map(order => {
              const urgent = isOrderUrgent(order);
              return (
                <Card 
                  key={order.id}
                  className={`transition-shadow hover:shadow-md ${
                    urgent ? 'border-red-300 bg-red-50/30' : ''
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg">
                            Order #{order.id}
                          </CardTitle>
                          {urgent && (
                            <Badge variant="destructive" className="gap-1">
                              <Clock className="size-3" />
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">
                          {order.customerName} • {order.customerEmail}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(order.status)} border`}>
                        {order.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Order Items */}
                    <div>
                      <h4 className="font-medium mb-2 text-gray-900">Items</h4>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              {item.product.name} × {item.quantity} {item.product.unit}
                            </span>
                            <span className="font-medium text-gray-900">
                              £{(item.product.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    {/* Delivery Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-2">
                        <Calendar className="size-4 mt-0.5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Delivery Date</p>
                          <p className="text-sm text-gray-700">
                            {format(parseISO(order.deliveryDate), 'MMMM d, yyyy')}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Order date: {format(parseISO(order.createdAt), 'MMMM d, yyyy')}
                          </p>
                          <p className="text-xs text-gray-600">
                            Lead time: {getLeadTimeHours(order)} hours
                          </p>
                          {urgent && (
                            <p className="text-xs text-red-600 mt-1 font-medium">
                              ⚠ Less than 24 hours
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="size-4 mt-0.5 text-gray-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                          <p className="text-sm text-gray-700">{order.deliveryAddress}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Order Total */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span className="text-gray-900">£{order.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Commission (5%)</span>
                        <span className="text-gray-700">-£{order.commission.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span className="text-gray-900">Your Earnings</span>
                        <span className="text-green-700">£{order.subtotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Actions Row */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Status Update */}
                      <div>
                        <label className="text-sm font-medium mb-2 block text-gray-900">Update Status</label>
                        <Select
                          value={order.status}
                          onValueChange={(value) => updateOrderStatus(order.id, value as OrderStatus)}
                        >
                          <SelectTrigger className="focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="preparing">Preparing</SelectItem>
                            <SelectItem value="ready">Ready for Delivery</SelectItem>
                            <SelectItem value="delivered">Delivered</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 3) Contact Buyer / Delivery Note */}
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-gray-900">Actions</label>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1 gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            onClick={() => toast.info('Contact buyer feature coming soon')}
                          >
                            <MessageCircle className="size-4" />
                            Contact
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="flex-1 gap-2 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                            onClick={() => toast.info('Delivery note feature coming soon')}
                          >
                            <FileText className="size-4" />
                            Note
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 8) Help text */}
                    {order.status === 'pending' && (
                      <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                        <p className="text-xs text-blue-900 flex items-start gap-2">
                          <AlertCircle className="size-3 mt-0.5 flex-shrink-0" />
                          <span>Confirm orders within 12 hours to maintain high seller ratings</span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
