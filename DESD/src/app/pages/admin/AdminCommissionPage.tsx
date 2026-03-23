import { Calendar, Download, FileSpreadsheet, LineChart, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ApiProducer, apiBlob, apiJson } from '../../lib/api';
import { formatAdminCurrency, formatAdminDate, getDefaultAdminDateRange } from '../../lib/adminReporting';

interface CommissionReportOrderRow {
  order_id: number;
  order_number: string;
  order_date: string;
  total_amount: string;
  commission_amount: string;
  producer_payout_total: string;
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
  producer_payout_total: string;
  payment_status: string;
  calculation: {
    formula: string;
    commission_rate: string;
    commission_amount: string;
  };
  payment: {
    provider: string;
    provider_reference: string;
    amount: string;
    status: string;
    currency: string;
    created_at: string;
  } | null;
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
  total_producer_payouts: string;
}

interface YTDSummary {
  number_of_orders: number;
  total_order_value: string;
  total_commission: string;
  total_producer_payouts: string;
}

const defaultRange = getDefaultAdminDateRange();

function hasAdditionalDetail(detail: CommissionOrderDetail): boolean {
  return Boolean(
    detail.payment ||
      detail.payment_status ||
      detail.calculation.formula ||
      detail.calculation.commission_rate ||
      detail.producer_breakdown.some((producer) => producer.subtotal_amount || producer.payout_amount),
  );
}

export function AdminCommissionPage() {
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [producerId, setProducerId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<CommissionReportResponse | null>(null);
  const [producers, setProducers] = useState<ApiProducer[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [ytdSummary, setYtdSummary] = useState<YTDSummary | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLoadingOrderId, setDetailLoadingOrderId] = useState<number | null>(null);
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<CommissionReportOrderRow | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CommissionOrderDetail | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, CommissionOrderDetail>>({});
  const [hiddenDetailOrderIds, setHiddenDetailOrderIds] = useState<number[]>([]);

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
      setSelectedDetail(null);
      setSelectedDetailOrder(null);
      setDetailDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load commission report.');
      setReport(null);
      setMonthlySummary([]);
      setYtdSummary(null);
      setSelectedDetail(null);
      setSelectedDetailOrder(null);
      setDetailDialogOpen(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCommissionReport();
  }, []);

  const fetchDetail = async (row: CommissionReportOrderRow) => {
    if (hiddenDetailOrderIds.includes(row.order_id)) {
      return;
    }

    const cachedDetail = detailCache[row.order_id];
    if (cachedDetail) {
      setSelectedDetailOrder(row);
      setSelectedDetail(cachedDetail);
      setDetailDialogOpen(true);
      return;
    }

    setDetailLoadingOrderId(row.order_id);
    try {
      const payload = await apiJson<CommissionOrderDetail>(`/api/admin/commission-report/${row.order_id}/`);

      if (!hasAdditionalDetail(payload)) {
        setHiddenDetailOrderIds((current) =>
          current.includes(row.order_id) ? current : [...current, row.order_id],
        );
        toast('No additional details are available for this order.');
        return;
      }

      setDetailCache((current) => ({
        ...current,
        [row.order_id]: payload,
      }));
      setSelectedDetailOrder(row);
      setSelectedDetail(payload);
      setDetailDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load order drilldown.');
    } finally {
      setDetailLoadingOrderId(null);
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

  const hasOrders = (report?.orders.length || 0) > 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm">
          <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 shadow-none hover:bg-emerald-100">
                Network commission oversight
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Generate reportable commission snapshots across every completed marketplace order.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Use the controls below to audit a specific date range, verify 5% network commission, inspect multi-vendor
                payout lines, export CSV for accounting, and review monthly or year-to-date totals.
              </p>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Quick validation guide</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="font-semibold text-slate-950">Single order example</p>
                  <p className="mt-1 text-sm text-slate-600">100.00 total -&gt; 5.00 commission -&gt; 95.00 producer payout.</p>
                </div>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="font-semibold text-slate-950">Multi-vendor example</p>
                  <p className="mt-1 text-sm text-slate-600">
                    150.00 total -&gt; 7.50 commission -&gt; 76.00 and 66.50 producer payouts.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-slate-950 text-white shadow-sm">
          <CardHeader>
            <CardTitle>Why admins use this screen</CardTitle>
            <CardDescription className="text-slate-300">
              Every panel below is aimed at financial accuracy, sustainability tracking, and audit-ready exports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-200">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              1. Total order value, commission value, producer payouts, and order count for the selected period.
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              2. Drilldown into an individual order to validate formulas and supplier payout breakdowns.
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              3. CSV export, monthly summary, and year-to-date totals for accounting software and reports.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filters and report generation</CardTitle>
          <CardDescription>Select a period, narrow by producer or status, then regenerate the report.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-6">
          <div>
            <Label htmlFor="date-from">From</Label>
            <Input id="date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="date-to">To</Label>
            <Input id="date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="producer-filter">Producer</Label>
            <select
              id="producer-filter"
              value={producerId}
              onChange={(event) => setProducerId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
            <Input id="year-filter" type="number" value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" onClick={() => void loadCommissionReport()} className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800" disabled={loading}>
              {loading ? 'Loading...' : 'Generate'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleExport()}>
              <Download className="mr-2 size-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Total order value</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatAdminCurrency(report?.totals.total_order_value || '0')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">5% commission</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-700">
              {formatAdminCurrency(report?.totals.total_commission || '0')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Producer payouts</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatAdminCurrency(report?.totals.total_producer_payouts || '0')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Orders processed</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">{report?.totals.number_of_orders || 0}</p>
          </CardContent>
        </Card>
      </section>

      {!hasOrders && !loading ? (
        <Alert>
          <AlertDescription>
            No orders matched the selected filters. Adjust the range or status and generate the report again.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Order breakdown</CardTitle>
          <CardDescription>
            Use View details to open the full commission drilldown for orders that have more information available.
          </CardDescription>
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
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Producer payouts</TableHead>
                  <TableHead>Breakdown</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.orders || []).map((row) => (
                  <TableRow key={row.order_id}>
                    <TableCell className="font-medium">{row.order_number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-slate-700">
                        <Calendar className="size-3" />
                        {formatAdminDate(row.order_date)}
                      </div>
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-right">{formatAdminCurrency(row.total_amount)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{formatAdminCurrency(row.commission_amount)}</TableCell>
                    <TableCell className="text-right">{formatAdminCurrency(row.producer_payout_total)}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs text-slate-700">
                        {row.producer_breakdown.map((producer) => (
                          <div key={`${row.order_id}-${producer.producer_id}`}>
                            {producer.producer_name}: subtotal {formatAdminCurrency(producer.subtotal_amount)} | payout{' '}
                            {formatAdminCurrency(producer.payout_amount)}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {hiddenDetailOrderIds.includes(row.order_id) ? null : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void fetchDetail(row)}
                          disabled={detailLoadingOrderId === row.order_id}
                        >
                          {detailLoadingOrderId === row.order_id ? 'Loading...' : 'View details'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly summary ({selectedYear})</CardTitle>
            <CardDescription>Use this section for monthly reporting and accounting rollups.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <LineChart className="size-10 rounded-2xl bg-white p-2 text-slate-700 shadow-sm" />
                <div>
                  <p className="text-sm text-slate-500">Year commission total</p>
                  <p className="text-2xl font-semibold text-slate-950">{formatAdminCurrency(monthlyTotalCommission)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              {monthlySummary
                .filter((row) => Number(row.number_of_orders) > 0)
                .map((row) => (
                  <div key={`month-${row.month}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="font-medium text-slate-950">Month {row.month}</p>
                    <p className="mt-1">Orders {row.number_of_orders}</p>
                    <p>Order value {formatAdminCurrency(row.total_order_value)}</p>
                    <p>Commission {formatAdminCurrency(row.total_commission)}</p>
                    <p>Producer payouts {formatAdminCurrency(row.total_producer_payouts)}</p>
                  </div>
                ))}
              {monthlySummary.filter((row) => Number(row.number_of_orders) > 0).length === 0 ? (
                <p>No monthly orders have been recorded for the selected year.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Year-to-date commission</CardTitle>
            <CardDescription>Summary totals across the selected financial year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="size-10 rounded-2xl bg-white p-2 text-slate-700 shadow-sm" />
                <div>
                  <p className="text-sm text-slate-500">Orders</p>
                  <p className="text-2xl font-semibold text-slate-950">{ytdSummary?.number_of_orders || 0}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">Total order value: {formatAdminCurrency(ytdSummary?.total_order_value || '0')}</div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">Total commission: {formatAdminCurrency(ytdSummary?.total_commission || '0')}</div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">Total producer payouts: {formatAdminCurrency(ytdSummary?.total_producer_payouts || '0')}</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedDetailOrder?.order_number || 'Order detail'}</DialogTitle>
            <DialogDescription>
              Full commission drilldown, payout validation, and payment metadata for the selected order.
            </DialogDescription>
          </DialogHeader>

          {selectedDetail ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Order total</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{formatAdminCurrency(selectedDetail.total_amount)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Commission amount</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-700">
                    {formatAdminCurrency(selectedDetail.commission_amount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Producer payout total</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">
                    {formatAdminCurrency(selectedDetail.producer_payout_total)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Payment status</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{selectedDetail.payment_status}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <Wallet className="mt-1 size-10 rounded-2xl bg-white p-2 text-emerald-700 shadow-sm" />
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950">Commission calculation</p>
                    <p className="text-sm text-slate-600">{selectedDetail.calculation.formula}</p>
                    <p className="text-sm text-slate-600">Rate: {selectedDetail.calculation.commission_rate}</p>
                    <p className="text-sm text-slate-600">
                      Recorded commission: {formatAdminCurrency(selectedDetail.calculation.commission_amount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <p className="font-semibold text-slate-950">Producer payout lines</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedDetail.producer_breakdown.map((producer) => (
                    <div key={`${selectedDetail.order_number}-${producer.producer_name}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <p className="font-medium text-slate-950">{producer.producer_name}</p>
                      <p className="mt-1">Subtotal {formatAdminCurrency(producer.subtotal_amount)}</p>
                      <p>Payout {formatAdminCurrency(producer.payout_amount)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDetail.payment ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="font-semibold text-slate-950">Payment record</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <p>Provider: {selectedDetail.payment.provider}</p>
                      <p className="mt-1">Reference: {selectedDetail.payment.provider_reference}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <p>Amount: {formatAdminCurrency(selectedDetail.payment.amount)}</p>
                      <p className="mt-1">Currency: {selectedDetail.payment.currency}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <p>Status: {selectedDetail.payment.status}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      <p>Created at: {selectedDetail.payment.created_at}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
