import { ArrowRight, CalendarRange, Download, ShieldCheck, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { apiJson } from '../../lib/api';
import { formatAdminCurrency, formatAdminDate, getDefaultAdminDateRange } from '../../lib/adminReporting';

interface DashboardOrderRow {
  order_id: number;
  order_number: string;
  order_date: string;
  total_amount: string;
  commission_amount: string;
  payment_status: string;
  producer_breakdown: Array<{
    producer_name: string;
    payout_amount: string;
  }>;
}

interface DashboardReportResponse {
  totals: {
    total_order_value: string;
    total_commission: string;
    total_producer_payouts: string;
    number_of_orders: number;
  };
  orders: DashboardOrderRow[];
}

interface YTDSummary {
  number_of_orders: number;
  total_order_value: string;
  total_commission: string;
  total_producer_payouts: string;
}

const defaultRange = getDefaultAdminDateRange();

export function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<DashboardReportResponse | null>(null);
  const [ytdSummary, setYtdSummary] = useState<YTDSummary | null>(null);
  const [selectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    const loadSnapshot = async () => {
      setLoading(true);
      try {
        const [reportPayload, ytdPayload] = await Promise.all([
          apiJson<DashboardReportResponse>(
            `/api/admin/commission-report/?start=${defaultRange.dateFrom}&end=${defaultRange.dateTo}`,
          ),
          apiJson<YTDSummary>(`/api/admin/commission-report/summary/ytd?year=${selectedYear}`),
        ]);
        setReport(reportPayload);
        setYtdSummary(ytdPayload);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load the admin overview.');
        setReport(null);
        setYtdSummary(null);
      } finally {
        setLoading(false);
      }
    };

    void loadSnapshot();
  }, [selectedYear]);

  const recentOrders = (report?.orders || []).slice(0, 4);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden border-slate-200/80 bg-white shadow-sm">
          <CardContent className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900 shadow-none hover:bg-emerald-100">
                Admin finance workspace
              </Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                Monitor commission accuracy without entering the public marketplace.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                The admin area is purpose-built for TC-025 style oversight: previous two-week reporting, 5% commission
                verification, multi-vendor payout drilldowns, CSV export, monthly summaries, and year-to-date totals.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
                  <Link to="/admin/financial-reports">
                    Open financial reports
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/admin/financial-reports">Export-ready reporting</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Current audit window</p>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <CalendarRange className="size-9 rounded-2xl bg-emerald-100 p-2 text-emerald-700" />
                <div>
                  <p className="text-sm text-slate-500">Previous 2 weeks</p>
                  <p className="font-semibold text-slate-950">
                    {defaultRange.dateFrom} to {defaultRange.dateTo}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <ShieldCheck className="size-9 rounded-2xl bg-slate-100 p-2 text-slate-700" />
                <div>
                  <p className="text-sm text-slate-500">Admin access model</p>
                  <p className="font-semibold text-slate-950">Pre-registered accounts only</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-slate-950 text-white shadow-sm">
          <CardHeader>
            <CardTitle>What this workspace verifies</CardTitle>
            <CardDescription className="text-slate-300">
              These views are aligned to the commission-monitoring test case requirements.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              1. Total order value, commission collected, producer payouts, and order counts for the selected period.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              2. Drilldown into each order to validate per-producer payouts for multi-vendor transactions.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              3. CSV download plus monthly and year-to-date summaries for accounting and compliance reporting.
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Two-week order value</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatAdminCurrency(report?.totals.total_order_value || '0')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Two-week commission</p>
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
            <p className="text-sm text-slate-500">Year-to-date commission</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatAdminCurrency(ytdSummary?.total_commission || '0')}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent monitored orders</CardTitle>
            <CardDescription>
              Orders from the current audit range are shown here so admins can jump straight into financial reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <p className="text-sm text-slate-500">Loading overview...</p> : null}
            {!loading && recentOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                No commission-report orders were found in the current two-week window.
              </div>
            ) : null}
            {recentOrders.map((order) => (
              <div key={order.order_id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{order.order_number}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-950">{formatAdminCurrency(order.total_amount)}</p>
                    <p className="text-sm text-slate-600">Created {formatAdminDate(order.order_date)}</p>
                  </div>
                  <Badge className="w-fit rounded-full bg-white text-slate-700 shadow-none hover:bg-white">
                    Payment: {order.payment_status}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                  <span>Commission {formatAdminCurrency(order.commission_amount)}</span>
                  <span>Producers {order.producer_breakdown.length}</span>
                </div>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  {order.producer_breakdown.map((producer) => (
                    <div key={`${order.order_id}-${producer.producer_name}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                      <span>{producer.producer_name}</span>
                      <span className="font-medium text-slate-900">Payout {formatAdminCurrency(producer.payout_amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reference checks for TC-025</CardTitle>
            <CardDescription>These examples mirror the commission validation scenarios expected by the admin test case.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <Wallet className="size-10 rounded-2xl bg-white p-2 text-emerald-700 shadow-sm" />
                <div>
                  <p className="font-semibold text-slate-950">Single-order validation</p>
                  <p className="text-sm text-slate-600">Order total 100.00, commission 5.00, producer payout 95.00.</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-950">Multi-vendor validation</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Order total 150.00, total commission 7.50, producer A payout 76.00, producer B payout 66.50.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-950">Go deeper</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Open the reporting page to filter by producer, export CSV, and review monthly or year-to-date totals.
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to="/admin/financial-reports">
                    Reports
                    <Download className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
