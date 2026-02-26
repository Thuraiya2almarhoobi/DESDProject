import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Download, RotateCcw, ReceiptText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ApiOrderDetail, ApiOrderSummary, apiBlob, apiJson } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';

function maskPaymentReference(reference: string): string {
  if (!reference || reference.length < 6) {
    return 'N/A';
  }
  return `${reference.slice(0, 4)}***${reference.slice(-3)}`;
}

export function OrderHistoryPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ApiOrderSummary[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ApiOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const history = await apiJson<ApiOrderSummary[]>('/api/orders/history/');
        if (mounted) {
          setOrders(history);
        }
      } catch (error) {
        if (mounted) {
          toast.error('Unable to load order history.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      mounted = false;
    };
  }, []);

  const openOrder = async (orderId: number) => {
    if (activeOrderId === orderId) {
      setActiveOrderId(null);
      setSelectedOrder(null);
      return;
    }

    setActiveOrderId(orderId);
    setDetailLoading(true);
    try {
      const detail = await apiJson<ApiOrderDetail>(`/api/orders/history/${orderId}/`);
      setSelectedOrder(detail);
    } catch (error) {
      toast.error('Unable to load order details.');
      setActiveOrderId(null);
      setSelectedOrder(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const reorderOrder = async (orderId: number) => {
    try {
      const payload = await apiJson<{
        added_items: Array<{ product_name: string }>;
        unavailable_items: Array<{ product_name: string }>;
      }>(`/api/orders/history/${orderId}/reorder/`, { method: 'POST' });

      if (payload.unavailable_items.length > 0) {
        toast.warning(`${payload.unavailable_items.length} item(s) unavailable and were skipped.`);
      } else {
        toast.success('Items added back to your cart.');
      }

      navigate('/cart');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to reorder.');
    }
  };

  const downloadReceipt = async (order: ApiOrderSummary) => {
    try {
      const blob = await apiBlob(`/api/orders/history/${order.id}/receipt/`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${order.order_number}-receipt.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Unable to download receipt.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Button variant="ghost" onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Marketplace
          </Button>
          <Button variant="outline" onClick={() => navigate('/cart')}>Go to Cart</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold">Order History</h1>
          <p className="text-sm text-gray-600 mt-1">View receipts, inspect order breakdowns, and reorder quickly.</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-600">Loading your previous orders...</CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <ReceiptText className="size-10 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-700 mb-4">No orders yet.</p>
              <Button onClick={() => navigate('/marketplace')}>Browse Products</Button>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap gap-3 justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{order.order_number}</CardTitle>
                    <p className="text-sm text-gray-600">
                      Placed {format(new Date(order.created_at), 'MMM d, yyyy, h:mm a')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{order.status}</Badge>
                    <Badge variant="outline">{order.payment_status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Producers</p>
                    <p className="font-medium">{order.producer_names.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Subtotal</p>
                    <p className="font-medium">£{Number(order.subtotal_amount).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Paid</p>
                    <p className="font-medium text-green-700">£{Number(order.total_amount).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => openOrder(order.id)}>
                    {activeOrderId === order.id ? 'Hide Details' : 'View Details'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadReceipt(order)}>
                    <Download className="size-4 mr-2" />
                    Receipt
                  </Button>
                  <Button size="sm" onClick={() => reorderOrder(order.id)}>
                    <RotateCcw className="size-4 mr-2" />
                    Reorder
                  </Button>
                </div>

                {activeOrderId === order.id && (
                  <>
                    <Separator />
                    {detailLoading || !selectedOrder ? (
                      <p className="text-sm text-gray-600">Loading order details...</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Delivery Address</p>
                            <p className="font-medium">{selectedOrder.delivery_address}</p>
                            <p className="text-gray-600">{selectedOrder.customer_postcode}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Payment Reference</p>
                            <p className="font-medium">{maskPaymentReference(selectedOrder.payment_reference)}</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Items</p>
                          <div className="space-y-2">
                            {selectedOrder.items.map((item) => (
                              <div key={item.id} className="flex justify-between items-start border rounded-md p-3 bg-gray-50">
                                <div>
                                  <p className="font-medium">{item.product_name}</p>
                                  <p className="text-xs text-gray-600">
                                    {item.producer_name} • {item.quantity} {item.unit} × £{Number(item.unit_price).toFixed(2)}
                                  </p>
                                </div>
                                <p className="font-medium">£{Number(item.line_total).toFixed(2)}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Producer Sub-orders</p>
                          <div className="space-y-2">
                            {selectedOrder.sub_orders.map((subOrder) => (
                              <div key={subOrder.id} className="border-l-4 border-green-500 pl-3">
                                <p className="font-medium">{subOrder.producer.business_name}</p>
                                <p className="text-xs text-gray-600">
                                  Delivery {format(new Date(subOrder.delivery_date), 'MMM d, yyyy')} • Status {subOrder.status}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
