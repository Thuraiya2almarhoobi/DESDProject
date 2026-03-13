import { useEffect, useMemo, useState } from 'react';
import { Calendar, Download, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { useAuth } from '../../contexts/AuthContext';
import { ApiProducer, apiBlob, apiJson } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

interface CommissionReportOrderRow {
  order_id: number;
  order_number: string;
  order_date: string;
  total_amount: string;
  commission_amount: string;
  status: string;
  payment_status: string;
  producer_breakdown: Array<{
    producer_id: number;
    producer_name: string;
    subtotal_amount: string;
    payout_amount: string;
  }>;
}

interface CommissionReportResponse {
  totals: {
    total_order_value: string;
    total_commission: string;
    total_producer_payouts: string;
    number_of_orders: number;
  };
  orders: CommissionReportOrderRow[];
}

interface CommissionOrderDetail {
  order_number: string;
  total_amount: string;
  commission_amount: string;
  payment_status: string;
  calculation: {
    formula: string;
    commission_amount: string;
  };
  producer_breakdown: Array<{
    producer_name: string;
    subtotal_amount: string;
    payout_amount: string;
  }>;
}

interface MonthlySummary {
  month: number;
  number_of_orders: number;
  total_order_value: string;
  total_commission: string;
}

interface YTDSummary {
  number_of_orders: number;
  total_order_value: string;
  total_commission: string;
  total_producer_payouts: string;
}

function toCurrency(value: string): string {
  const amount = Number(value);
  return `£${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

export function AdminCommissionPage() {
  const { logout } = useAuth();
  const [dateFrom, setDateFrom] = useState('2026-02-23');
  const [dateTo, setDateTo] = useState('2026-03-09');
  const [producerId, setProducerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<CommissionReportResponse | null>(null);
  const [detail, setDetail] = useState<CommissionOrderDetail | null>(null);
  const [producers, setProducers] = useState<ApiProducer[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [ytdSummary, setYtdSummary] = useState<YTDSummary | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const loadCommissionReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        start: dateFrom,
        end: dateTo,
      });
      if (producerId) {
        query.set('producer_id', producerId);
      }
      if (statusFilter) {
        query.set('status', statusFilter);
      }

      const [reportPayload, producersPayload, monthlyPayload, ytdPayload] = await Promise.all([
        apiJson<CommissionReportResponse>(`/api/admin/commission-report/?${query.toString()}`),
        apiJson<ApiProducer[]>('/api/orders/producers/'),
        apiJson<{ months: MonthlySummary[] }>(
          `/api/admin/commission-report/summary/monthly?year=${selectedYear}`,
        ),
        apiJson<YTDSummary>(`/api/admin/commission-report/summary/ytd?year=${selectedYear}`),
      ]);
      setReport(reportPayload);
      setProducers(producersPayload);
      setMonthlySummary(monthlyPayload.months);
      setYtdSummary(ytdPayload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load commission report.');
      setReport(null);
      setMonthlySummary([]);
      setYtdSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCommissionReport();
  }, []);

  const fetchDetail = async (orderId: number) => {
    try {
      const payload = await apiJson<CommissionOrderDetail>(`/api/admin/commission-report/${orderId}/`);
      setDetail(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load order drilldown.');
    }
  };

  const handleExport = async () => {
    try {
      const query = new URLSearchParams({
        start: dateFrom,
        end: dateTo,
      });
      if (producerId) {
        query.set('producer_id', producerId);
      }
      if (statusFilter) {
        query.set('status', statusFilter);
      }

      const blob = await apiBlob(`/api/admin/commission-report/export.csv?${query.toString()}`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `commission-report-${dateFrom}-${dateTo}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success('Commission CSV exported.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to export CSV.');
    }
  };

  const monthlyTotalCommission = useMemo(() => {
    return monthlySummary.reduce((sum, row) => sum + Number(row.total_commission || 0), 0);
  }, [monthlySummary]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <header className="bg-white/80 backdrop-blur-sm border-b border-[oklch(0.88_0.02_145)] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Network Commission / Financial Reports</h1>
              <p className="text-sm text-gray-600">5% platform commission with producer payout traceability</p>
              <p className="text-xs text-gray-500">Role: ADMIN | Commission monitoring and reporting interface</p>
            </div>
            <Button variant="ghost" onClick={logout}>
              <LogOut className="size-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-6 gap-4">
              <div>
                <Label htmlFor="date-from">From</Label>
                <Input id="date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="date-to">To</Label>
                <Input id="date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="producer-filter">Producer</Label>
                <select
                  id="producer-filter"
                  value={producerId}
                  onChange={(e) => setProducerId(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All producers</option>
                  {producers.map((producer) => (
                    <option key={producer.id} value={producer.id}>
                      {producer.business_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="status-filter">Order status</Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="ready">Ready</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <Label htmlFor="year-filter">Summary year</Label>
                <Input
                  id="year-filter"
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={() => void loadCommissionReport()} className="flex-1" disabled={loading}>
                  {loading ? 'Loading...' : 'Apply'}
                </Button>
                <Button variant="outline" onClick={() => void handleExport()}>
                  <Download className="size-4 mr-2" />
                  CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-600">Total Order Value</p>
              <p className="text-2xl font-semibold">{toCurrency(report?.totals.total_order_value || '0')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-600">Total Commission</p>
              <p className="text-2xl font-semibold text-green-700">
                {toCurrency(report?.totals.total_commission || '0')}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-600">Total Producer Payouts</p>
              <p className="text-2xl font-semibold">{toCurrency(report?.totals.total_producer_payouts || '0')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-gray-600">Orders</p>
              <p className="text-2xl font-semibold">{report?.totals.number_of_orders || 0}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Order Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Commission (5%)</TableHead>
                    <TableHead>Producer Payout Breakdown</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report?.orders || []).map((row) => (
                    <TableRow key={row.order_id} className="cursor-pointer" onClick={() => void fetchDetail(row.order_id)}>
                      <TableCell className="font-medium">{row.order_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-gray-700">
                          <Calendar className="size-3" />
                          {format(new Date(row.order_date), 'yyyy-MM-dd')}
                        </div>
                      </TableCell>
                      <TableCell>{row.status}</TableCell>
                      <TableCell className="text-right">{toCurrency(row.total_amount)}</TableCell>
                      <TableCell className="text-right text-green-700">{toCurrency(row.commission_amount)}</TableCell>
                      <TableCell>
                        {row.producer_breakdown.map((producer) => (
                          <div key={`${row.order_id}-${producer.producer_id}`} className="text-xs text-gray-700">
                            {producer.producer_name}: subtotal {toCurrency(producer.subtotal_amount)} | payout {toCurrency(producer.payout_amount)}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {detail && (
          <Card>
            <CardHeader>
              <CardTitle>Order Drilldown: {detail.order_number}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Total: {toCurrency(detail.total_amount)}</p>
              <p>Commission: {toCurrency(detail.commission_amount)}</p>
              <p>Payment status: {detail.payment_status}</p>
              <p>Formula: {detail.calculation.formula}</p>
              {detail.producer_breakdown.map((producer) => (
                <p key={`${detail.order_number}-${producer.producer_name}`}>
                  {producer.producer_name} {'->'} subtotal {toCurrency(producer.subtotal_amount)}, payout {toCurrency(producer.payout_amount)}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Summary ({selectedYear})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">Year commission total: £{monthlyTotalCommission.toFixed(2)}</p>
              {monthlySummary
                .filter((row) => Number(row.number_of_orders) > 0)
                .map((row) => (
                  <p key={`month-${row.month}`}>
                    Month {row.month}: orders {row.number_of_orders}, commission {toCurrency(row.total_commission)}
                  </p>
                ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Year-To-Date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>Orders: {ytdSummary?.number_of_orders || 0}</p>
              <p>Total order value: {toCurrency(ytdSummary?.total_order_value || '0')}</p>
              <p>Total commission: {toCurrency(ytdSummary?.total_commission || '0')}</p>
              <p>Total producer payouts: {toCurrency(ytdSummary?.total_producer_payouts || '0')}</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
