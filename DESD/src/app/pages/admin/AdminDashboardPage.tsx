/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the AdminDashboardPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { ArrowRight, CalendarRange, ShieldCheck, Star, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { FeedLoadingSkeleton, PageLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '../../components/ui/chart';
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

interface PendingReviewModerationRow {
  id: number;
  order_product_id: number | null;
  product_name: string;
  producer_name: string;
  title?: string;
  reviewer_name: string;
  rating: number;
  comment: string;
  moderation_status: 'pending' | 'published' | 'rejected';
  moderation_reason?: string;
  has_verified_purchase: boolean;
  purchase_label: string;
  created_at: string;
}

const defaultRange = getDefaultAdminDateRange();
const panelClass = 'min-w-0 overflow-hidden rounded-3xl border border-[#d6ddd0] bg-[#fbfcf8] shadow-[0_10px_24px_rgba(18,31,21,0.06)]';
const shortDateFormatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' });

const trendChartConfig = {
  total: { label: 'Order total', color: '#6b8a6f' },
  commission: { label: 'Commission', color: '#256843' },
  payouts: { label: 'Producer payouts', color: '#c7a95b' },
};

const splitChartConfig = {
  commission: { label: 'Commission', color: '#256843' },
  payouts: { label: 'Producer payouts', color: '#c7a95b' },
};

const statusChartConfig = {
  count: { label: 'Orders', color: '#55725b' },
};

function toNumber(value: string | number | null | undefined): number {
  return Number(value || 0);
}

function formatShortDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return shortDateFormatter.format(parsed);
}

function formatCurrencyValue(value: unknown): string {
  return formatAdminCurrency(String(value ?? 0));
}

/**
 * AdminDashboardPage boundary.
 *
 * This exported unit supports the file role: Implements the AdminDashboardPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<DashboardReportResponse | null>(null);
  const [ytdSummary, setYtdSummary] = useState<YTDSummary | null>(null);
  const [pendingReviews, setPendingReviews] = useState<PendingReviewModerationRow[]>([]);
  const [pendingReviewsLoading, setPendingReviewsLoading] = useState(true);
  const [activeModerationReviewId, setActiveModerationReviewId] = useState<number | null>(null);
  const [selectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    const loadSnapshot = async () => {
      setLoading(true);
      setPendingReviewsLoading(true);
      try {
        const [reportPayload, ytdPayload, pendingReviewsPayload] = await Promise.all([
          apiJson<DashboardReportResponse>(
            `/api/admin/commission-report/?start=${defaultRange.dateFrom}&end=${defaultRange.dateTo}`,
          ),
          apiJson<YTDSummary>(`/api/admin/commission-report/summary/ytd?year=${selectedYear}`),
          apiJson<PendingReviewModerationRow[]>(`/api/orders/reviews/moderation-queue/`),
        ]);
        setReport(reportPayload);
        setYtdSummary(ytdPayload);
        setPendingReviews(pendingReviewsPayload);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to load the admin overview.');
        setReport(null);
        setYtdSummary(null);
        setPendingReviews([]);
      } finally {
        setLoading(false);
        setPendingReviewsLoading(false);
      }
    };

    void loadSnapshot();
  }, [selectedYear]);

  const recentOrders = useMemo(() => (report?.orders || []).slice(0, 6), [report]);

  const summaryCards = [
    {
      label: 'Order value',
      value: formatAdminCurrency(report?.totals.total_order_value || '0'),
      tone: 'text-[#182219]',
    },
    {
      label: 'Commission',
      value: formatAdminCurrency(report?.totals.total_commission || '0'),
      tone: 'text-[var(--forest-green)]',
    },
    {
      label: 'Producer payouts',
      value: formatAdminCurrency(report?.totals.total_producer_payouts || '0'),
      tone: 'text-[#182219]',
    },
    {
      label: 'YTD commission',
      value: formatAdminCurrency(ytdSummary?.total_commission || '0'),
      tone: 'text-[#182219]',
    },
  ];

  const trendData = useMemo(
    () =>
      recentOrders
        .slice()
        .reverse()
        .map((order) => ({
          label: formatShortDate(order.order_date),
          total: toNumber(order.total_amount),
          commission: toNumber(order.commission_amount),
          payouts: order.producer_breakdown.reduce((sum, producer) => sum + toNumber(producer.payout_amount), 0),
          orderNumber: order.order_number,
        })),
    [recentOrders],
  );

  const splitData = useMemo(
    () => [
      { name: 'commission', value: toNumber(report?.totals.total_commission), fill: '#256843' },
      { name: 'payouts', value: toNumber(report?.totals.total_producer_payouts), fill: '#c7a95b' },
    ],
    [report],
  );

  const paymentStatusData = useMemo(() => {
    const counts = (report?.orders || []).reduce<Record<string, number>>((current, order) => {
      const key = order.payment_status?.trim() || 'Unknown';
      current[key] = (current[key] || 0) + 1;
      return current;
    }, {});

    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5);
  }, [report]);

  const handleModerationAction = async (
    review: PendingReviewModerationRow,
    moderationStatus: 'published' | 'rejected',
  ) => {
    if (!review.order_product_id) {
      toast.error('This review is not linked to a checkout product, so it cannot be moderated from this queue.');
      return;
    }

    setActiveModerationReviewId(review.id);
    try {
      await apiJson<unknown>(
        `/api/orders/products/${review.order_product_id}/reviews/${review.id}/moderate/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            moderation_status: moderationStatus,
            moderation_reason: moderationStatus === 'published' ? '' : 'Rejected by moderator.',
          }),
        },
      );
      setPendingReviews((currentReviews) => currentReviews.filter((currentReview) => currentReview.id !== review.id));
      toast.success(
        moderationStatus === 'published'
          ? `${review.reviewer_name}'s review is now published.`
          : `${review.reviewer_name}'s review was rejected.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update review moderation status.');
    } finally {
      setActiveModerationReviewId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <PageLoadingSkeleton rows={1} cards={4} />
        ) : (
          summaryCards.map((card) => (
            <div key={card.label} className={`${panelClass} p-5`}>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">{card.label}</p>
              <p className={`mt-4 text-3xl font-semibold tracking-tight ${card.tone}`}>{card.value}</p>
            </div>
          ))
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className={`${panelClass} p-6`}>
          <div className="flex flex-col gap-4 border-b border-[#e5eadf] pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Period performance</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#182219]">Commission and payout trend</h2>
              <p className="mt-2 text-sm leading-6 text-[#5f6d61]">
                Recent audited orders across the active two-week reporting window.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-[#d6ddd0] bg-white px-4 py-3">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#738176]">Audit window</p>
                <p className="mt-1 text-sm font-medium text-[#223026]">
                  {defaultRange.dateFrom} to {defaultRange.dateTo}
                </p>
              </div>
              <Button asChild variant="outline" className="border-[#c7d0c1] bg-white text-[var(--forest-green)] hover:bg-[#edf2eb] hover:text-[var(--forest-green)]">
                <Link to="/admin/financial-reports">
                  Open reports
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6">
            {loading ? (
              <PageLoadingSkeleton rows={1} cards={1} />
            ) : trendData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
                No completed orders were found in the current reporting window.
              </div>
            ) : (
              <ChartContainer config={trendChartConfig} className="h-[300px] w-full min-w-0 aspect-auto">
                <AreaChart data={trendData} margin={{ left: 4, right: 8, top: 12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#dde5d7" />
                  <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={10} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `£${value}`} width={72} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex min-w-[10rem] items-center justify-between gap-6">
                            <span className="text-[#5f6d61]">{name}</span>
                            <span className="font-mono font-medium text-[#182219]">{formatCurrencyValue(value)}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Area dataKey="total" fill="var(--color-total)" fillOpacity={0.16} stroke="var(--color-total)" strokeWidth={2.2} type="monotone" />
                  <Area dataKey="commission" fill="var(--color-commission)" fillOpacity={0.18} stroke="var(--color-commission)" strokeWidth={2.2} type="monotone" />
                  <Area dataKey="payouts" fill="var(--color-payouts)" fillOpacity={0.12} stroke="var(--color-payouts)" strokeWidth={2} type="monotone" />
                </AreaChart>
              </ChartContainer>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Commission split</p>
                <h3 className="mt-2 text-xl font-semibold text-[#182219]">Network vs producer share</h3>
              </div>
              <Badge className="rounded-full bg-[#edf4ee] px-3 py-1 text-[var(--forest-green)] shadow-none hover:bg-[#edf4ee]">
                5% / 95%
              </Badge>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center">
              {splitData.some((entry) => entry.value > 0) ? (
                <ChartContainer config={splitChartConfig} className="h-[240px] w-full min-w-0 aspect-auto">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          hideIndicator
                          formatter={(value, name) => (
                            <div className="flex min-w-[9rem] items-center justify-between gap-4">
                              <span className="text-[#5f6d61]">{name}</span>
                              <span className="font-mono font-medium text-[#182219]">{formatCurrencyValue(value)}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={splitData}
                      dataKey="value"
                      innerRadius={58}
                      outerRadius={84}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {splitData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap gap-3 pt-4 text-center" />} />
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
                  No financial totals are available yet for the current period.
                </div>
              )}

              <div className="space-y-3">
                <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                  <p className="text-sm text-[#6a786c]">Commission amount</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--forest-green)]">
                    {formatAdminCurrency(report?.totals.total_commission || '0')}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                  <p className="text-sm text-[#6a786c]">Producer payouts</p>
                  <p className="mt-2 text-2xl font-semibold text-[#182219]">
                    {formatAdminCurrency(report?.totals.total_producer_payouts || '0')}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] p-4 text-sm leading-6 text-[#4f5f53]">
                  Period model: network commission is recorded separately from producer payout allocation for every completed order.
                </div>
              </div>
            </div>
          </div>

          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Payment status</p>
                <h3 className="mt-2 text-xl font-semibold text-[#182219]">Current order mix</h3>
              </div>
              <Wallet className="size-5 text-[var(--forest-green)]" />
            </div>

            <div className="mt-5">
              {loading ? (
                <PageLoadingSkeleton rows={1} cards={1} />
              ) : paymentStatusData.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
                  No payment-status data is available for the current report.
                </div>
              ) : (
                <ChartContainer config={statusChartConfig} className="h-[220px] w-full min-w-0 aspect-auto">
                  <BarChart data={paymentStatusData} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="#e3e8de" />
                    <XAxis axisLine={false} tickLine={false} type="number" allowDecimals={false} />
                    <YAxis axisLine={false} dataKey="status" tickLine={false} type="category" width={92} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <div className="flex min-w-[8rem] items-center justify-between gap-4">
                              <span className="text-[#5f6d61]">Orders</span>
                              <span className="font-mono font-medium text-[#182219]">{String(value)}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[8, 8, 8, 8]} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <div className={`${panelClass} p-6`}>
          <div className="flex items-center justify-between gap-4 border-b border-[#e5eadf] pb-4">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Recent orders</p>
              <h2 className="mt-2 text-xl font-semibold text-[#182219]">Audited order activity</h2>
            </div>
            <Badge className="rounded-full bg-[#edf4ee] px-3 py-1 text-[var(--forest-green)] shadow-none hover:bg-[#edf4ee]">
              {report?.totals.number_of_orders || 0} orders
            </Badge>
          </div>

          <div className="mt-4 hidden grid-cols-[1.05fr_0.9fr_0.9fr_1fr] gap-4 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#738176] md:grid">
            <span>Order</span>
            <span>Total</span>
            <span>Commission</span>
            <span>Producer payouts</span>
          </div>

          <div className="mt-3 space-y-3">
            {loading ? (
              <PageLoadingSkeleton rows={2} cards={2} />
            ) : recentOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
                No recent orders are available in the current reporting window.
              </div>
            ) : (
              recentOrders.map((order) => {
                const payoutTotal = order.producer_breakdown.reduce(
                  (sum, producer) => sum + toNumber(producer.payout_amount),
                  0,
                );

                return (
                  <div key={order.order_id} className="rounded-2xl border border-[#dde4d7] bg-white px-4 py-4">
                    <div className="grid gap-3 md:grid-cols-[1.05fr_0.9fr_0.9fr_1fr] md:items-start md:gap-4">
                      <div>
                        <p className="font-semibold text-[#182219]">{order.order_number}</p>
                        <p className="mt-1 text-sm text-[#5f6d61]">{formatAdminDate(order.order_date)}</p>
                        <Badge className="mt-3 rounded-full bg-[#f1f5ef] px-3 py-1 text-[#4a5b4e] shadow-none hover:bg-[#f1f5ef]">
                          {order.payment_status}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm text-[#6a786c] md:hidden">Total</p>
                        <p className="font-medium text-[#182219]">{formatAdminCurrency(order.total_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#6a786c] md:hidden">Commission</p>
                        <p className="font-medium text-[var(--forest-green)]">{formatAdminCurrency(order.commission_amount)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-[#6a786c] md:hidden">Producer payouts</p>
                        <p className="font-medium text-[#182219]">{formatAdminCurrency(String(payoutTotal))}</p>
                        <div className="mt-2 space-y-1 text-xs leading-5 text-[#5f6d61]">
                          {order.producer_breakdown.map((producer) => (
                            <div key={`${order.order_id}-${producer.producer_name}`}>
                              {producer.producer_name}: {formatAdminCurrency(producer.payout_amount)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={`${panelClass} p-6`}>
          <div className="flex items-center justify-between gap-4 border-b border-[#e5eadf] pb-4">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Moderation</p>
              <h2 className="mt-2 text-xl font-semibold text-[#182219]">Pending review queue</h2>
            </div>
            <ShieldCheck className="size-5 text-[var(--forest-green)]" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] p-4 text-sm leading-6 text-[#4f5f53]">
              Use this queue to approve or reject new marketplace reviews without leaving the admin workspace.
            </div>

            {pendingReviewsLoading ? (
              <FeedLoadingSkeleton rows={3} />
            ) : pendingReviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-white p-6 text-sm leading-6 text-[#5f6d61]">
                There are no reviews waiting for moderation right now.
              </div>
            ) : (
              <div className="max-h-[540px] space-y-3 overflow-y-auto pr-1">
                {pendingReviews.map((review) => (
                  <div key={review.id} className="rounded-2xl border border-[#dde4d7] bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#738176]">
                          {review.product_name}
                        </p>
                        <p className="mt-2 font-semibold text-[#182219]">{review.reviewer_name}</p>
                        {review.title ? <p className="mt-1 text-sm font-medium text-[#2b382c]">{review.title}</p> : null}
                        <p className="mt-2 text-sm text-[#5f6d61]">
                          {review.producer_name} - {new Date(review.created_at).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <Badge className="rounded-full bg-[#f7ecd2] px-3 py-1 text-[#6a4e11] shadow-none hover:bg-[#f7ecd2]">
                        Pending
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full border border-[#e4e1d8] bg-white px-3 py-1 text-[#46564a] shadow-none hover:bg-white">
                        {review.purchase_label}
                      </Badge>
                      <div className="flex items-center gap-1 text-amber-500">
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={`${review.id}-${index}`}
                            className={`size-4 ${index < review.rating ? 'fill-current' : 'text-[#d9d2c3]'}`}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="mt-3 text-sm leading-7 text-[#324033]">{review.comment || 'No written comment provided.'}</p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]"
                        disabled={activeModerationReviewId === review.id || !review.order_product_id}
                        onClick={() => void handleModerationAction(review, 'published')}
                      >
                        {activeModerationReviewId === review.id ? 'Updating...' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-[#c7d0c1] bg-white text-[#405043] hover:bg-[#edf2eb] hover:text-[#405043]"
                        disabled={activeModerationReviewId === review.id || !review.order_product_id}
                        onClick={() => void handleModerationAction(review, 'rejected')}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
