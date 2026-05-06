/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the AdminCommissionPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { Calendar, ChevronDown, Download, FileSpreadsheet, Loader2, Search, Wallet } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { PageLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '../../components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
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

type ExportFormat = 'csv' | 'pdf' | 'xlsx';

const exportFormats: ExportFormat[] = ['csv', 'pdf', 'xlsx'];
const exportFormatLabels: Record<ExportFormat, { title: string; description: string }> = {
  csv: {
    title: 'CSV',
    description: 'Recommended for spreadsheet checks and audit reconciliation.',
  },
  pdf: {
    title: 'PDF',
    description: 'Best for sharing a fixed report snapshot.',
  },
  xlsx: {
    title: 'XLSX',
    description: 'Excel workbook for finance analysis.',
  },
};
const defaultRange = getDefaultAdminDateRange();
const panelClass = 'min-w-0 overflow-hidden rounded-3xl border border-[#d6ddd0] bg-[#fbfcf8] shadow-[0_10px_24px_rgba(18,31,21,0.06)]';
const monthFormatter = new Intl.DateTimeFormat('en-GB', { month: 'short' });

const monthlyChartConfig = {
  orderValue: { label: 'Order value', color: '#6b8a6f' },
  commission: { label: 'Commission', color: '#256843' },
};

const producerChartConfig = {
  payouts: { label: 'Producer payouts', color: '#55725b' },
};

const splitChartConfig = {
  commission: { label: 'Commission', color: '#256843' },
  payouts: { label: 'Producer payouts', color: '#c7a95b' },
};

function hasAdditionalDetail(detail: CommissionOrderDetail): boolean {
  return Boolean(
    detail.payment ||
      detail.payment_status ||
      detail.calculation.formula ||
      detail.calculation.commission_rate ||
      detail.producer_breakdown.some((producer) => producer.subtotal_amount || producer.payout_amount),
  );
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value || 0);
}

function monthLabel(year: string, month: number): string {
  const parsedYear = Number(year);
  if (Number.isNaN(parsedYear)) {
    return `M${month}`;
  }
  return monthFormatter.format(new Date(parsedYear, month - 1, 1));
}

function formatCurrencyValue(value: unknown): string {
  return formatAdminCurrency(String(value ?? 0));
}

interface ReportDownloadMenuProps {
  disabled: boolean;
  isDownloading: boolean;
  onExport: (format: ExportFormat) => void;
}

function ReportDownloadMenu({ disabled, isDownloading, onExport }: ReportDownloadMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-[#c7d0c1] bg-white text-[var(--forest-green)] hover:bg-[#edf2eb] hover:text-[var(--forest-green)]"
          disabled={disabled}
        >
          {isDownloading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
          {isDownloading ? 'Downloading' : 'Download report'}
          {!isDownloading ? <ChevronDown className="ml-2 size-4" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-2xl border-[#d7dfd2] p-2 shadow-xl">
        <DropdownMenuLabel className="px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#667461]">
          Choose export format
        </DropdownMenuLabel>
        {exportFormats.map((format) => {
          const metadata = exportFormatLabels[format];
          return (
            <DropdownMenuItem
              key={format}
              className="items-start rounded-xl px-3 py-3"
              onSelect={() => onExport(format)}
            >
              <div className="flex w-full items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1d2a20]">{metadata.title}</span>
                    {format === 'csv' ? (
                      <span className="rounded-full bg-[#e7f1e4] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--forest-green)]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#687567]">{metadata.description}</p>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * AdminCommissionPage boundary.
 *
 * This exported unit supports the file role: Implements the AdminCommissionPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
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
  const [reportSearch, setReportSearch] = useState('');
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const dateFromInputRef = useRef<HTMLInputElement | null>(null);
  const dateToInputRef = useRef<HTMLInputElement | null>(null);

  const openDatePicker = (input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }

    if ('showPicker' in input) {
      input.showPicker();
      return;
    }

    input.focus();
  };

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
        apiJson<{ months: MonthlySummary[] }>(`/api/admin/commission-report/summary/monthly?year=${selectedYear}`),
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

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    try {
      const query = new URLSearchParams({
        start: dateFrom,
        end: dateTo,
        format,
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
      anchor.download = `commission-report-${dateFrom}-${dateTo}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success(`Commission ${format.toUpperCase()} exported.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to export ${format.toUpperCase()}.`);
    } finally {
      setExportingFormat(null);
    }
  };

  const monthlyTotalCommission = useMemo(
    () => monthlySummary.reduce((sum, row) => sum + Number(row.total_commission || 0), 0),
    [monthlySummary],
  );

  const hasOrders = (report?.orders.length || 0) > 0;
  const visibleReportOrders = useMemo(() => {
    const normalizedSearch = reportSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return report?.orders || [];
    }
    return (report?.orders || []).filter((row) => {
      return (
        row.order_number.toLowerCase().includes(normalizedSearch) ||
        row.status.toLowerCase().includes(normalizedSearch) ||
        row.payment_status.toLowerCase().includes(normalizedSearch) ||
        row.producer_breakdown.some((producer) => producer.producer_name.toLowerCase().includes(normalizedSearch))
      );
    });
  }, [report, reportSearch]);
  const activeMonthlyRows = useMemo(
    () => monthlySummary.filter((row) => Number(row.number_of_orders) > 0),
    [monthlySummary],
  );

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
      label: 'Orders',
      value: String(report?.totals.number_of_orders || 0),
      tone: 'text-[#182219]',
    },
  ];

  const monthlyChartData = useMemo(
    () =>
      activeMonthlyRows.map((row) => ({
        label: monthLabel(selectedYear, row.month),
        orderValue: toNumber(row.total_order_value),
        commission: toNumber(row.total_commission),
      })),
    [activeMonthlyRows, selectedYear],
  );

  const producerPayoutData = useMemo(() => {
    const totals = (report?.orders || []).reduce<Record<string, number>>((current, row) => {
      row.producer_breakdown.forEach((producer) => {
        current[producer.producer_name] = (current[producer.producer_name] || 0) + toNumber(producer.payout_amount);
      });
      return current;
    }, {});

    return Object.entries(totals)
      .map(([producer, payouts]) => ({ producer, payouts }))
      .sort((left, right) => right.payouts - left.payouts)
      .slice(0, 6);
  }, [report]);

  const splitData = useMemo(
    () => [
      { name: 'commission', value: toNumber(report?.totals.total_commission), fill: '#256843' },
      { name: 'payouts', value: toNumber(report?.totals.total_producer_payouts), fill: '#c7a95b' },
    ],
    [report],
  );

  return (
    <div className="space-y-6">
      <section className={`${panelClass} p-6`}>
        <div className="flex flex-col gap-4 border-b border-[#e5eadf] pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Report builder</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#182219]">Commission reporting workspace</h2>
            <p className="mt-2 text-sm leading-6 text-[#5f6d61]">
              Filter by period, producer, and order status. Generate reports, review order drilldowns, and export CSV, PDF, or XLSX.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => void loadCommissionReport()}
              className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Generate report'}
            </Button>
            <ReportDownloadMenu
              disabled={loading || exportingFormat !== null}
              isDownloading={exportingFormat !== null}
              onExport={(format) => void handleExport(format)}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <Label htmlFor="date-from" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              From
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={dateFromInputRef}
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-2xl border border-[#ccd4c5] bg-white px-4 text-sm text-[#223026] outline-none transition-[color,box-shadow] [color-scheme:light] focus-visible:border-[var(--forest-green)] focus-visible:ring-3 focus-visible:ring-[rgba(37,104,67,0.18)] [&::-webkit-calendar-picker-indicator]:hidden"
              />
              <button
                type="button"
                onClick={() => openDatePicker(dateFromInputRef.current)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ccd4c5] bg-white text-[#46614c] transition hover:border-[var(--forest-green)] hover:text-[var(--forest-green)]"
                aria-label="Open from date picker"
              >
                <Calendar className="size-4" />
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="date-to" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              To
            </Label>
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={dateToInputRef}
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-11 min-w-0 flex-1 rounded-2xl border border-[#ccd4c5] bg-white px-4 text-sm text-[#223026] outline-none transition-[color,box-shadow] [color-scheme:light] focus-visible:border-[var(--forest-green)] focus-visible:ring-3 focus-visible:ring-[rgba(37,104,67,0.18)] [&::-webkit-calendar-picker-indicator]:hidden"
              />
              <button
                type="button"
                onClick={() => openDatePicker(dateToInputRef.current)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#ccd4c5] bg-white text-[#46614c] transition hover:border-[var(--forest-green)] hover:text-[var(--forest-green)]"
                aria-label="Open to date picker"
              >
                <Calendar className="size-4" />
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="producer-filter" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Producer
            </Label>
            <select
              id="producer-filter"
              value={producerId}
              onChange={(event) => setProducerId(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-[#ccd4c5] bg-white px-4 text-sm text-[#223026]"
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
            <Label htmlFor="status-filter" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Order status
            </Label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-[#ccd4c5] bg-white px-4 text-sm text-[#223026]"
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
            <Label htmlFor="year-filter" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Summary year
            </Label>
            <Input
              id="year-filter"
              type="number"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="mt-2 h-11 rounded-2xl border-[#ccd4c5] bg-white"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] px-4 py-3 text-sm leading-6 text-[#4f5f53]">
              Default window uses the previous two weeks for TC-025 reporting.
            </div>
          </div>
        </div>
      </section>

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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(300px,0.9fr)]">
        <div className={`${panelClass} p-6`}>
          <div className="flex items-center justify-between gap-4 border-b border-[#e5eadf] pb-4">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Trend</p>
              <h3 className="mt-2 text-xl font-semibold text-[#182219]">Monthly commission vs order value</h3>
            </div>
            <FileSpreadsheet className="size-5 text-[var(--forest-green)]" />
          </div>

          <div className="mt-5">
            {loading ? (
              <PageLoadingSkeleton rows={1} cards={1} />
            ) : monthlyChartData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
                No monthly activity has been recorded for the selected year.
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a786c]">Monthly order value and commission</p>
                  <p className="mt-1 text-sm text-[#4f5f53]">Month-by-month comparison of gross order value against commission retained.</p>
                </div>
                <ChartContainer config={monthlyChartConfig} className="h-[280px] w-full min-w-0 aspect-auto">
                  <AreaChart data={monthlyChartData} margin={{ left: 4, right: 8, top: 12, bottom: 0 }}>
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
                    <Area dataKey="orderValue" fill="var(--color-orderValue)" fillOpacity={0.16} stroke="var(--color-orderValue)" strokeWidth={2.2} type="monotone" />
                    <Area dataKey="commission" fill="var(--color-commission)" fillOpacity={0.2} stroke="var(--color-commission)" strokeWidth={2.2} type="monotone" />
                  </AreaChart>
                </ChartContainer>
              </div>
            )}
          </div>
        </div>

        <div className={`${panelClass} p-6`}>
          <div className="flex items-center justify-between gap-4 border-b border-[#e5eadf] pb-4">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Producer ranking</p>
              <h3 className="mt-2 text-xl font-semibold text-[#182219]">Top producer payouts</h3>
            </div>
            <Wallet className="size-5 text-[var(--forest-green)]" />
          </div>

          <div className="mt-5">
            {loading ? (
              <PageLoadingSkeleton rows={1} cards={1} />
            ) : producerPayoutData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
                Producer payout ranking will appear once the current filters return completed orders.
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a786c]">Producer payout ranking</p>
                  <p className="mt-1 text-sm text-[#4f5f53]">Producers ranked by payout value within the current report filters.</p>
                </div>
                <ChartContainer config={producerChartConfig} className="h-[280px] w-full min-w-0 aspect-auto">
                  <BarChart data={producerPayoutData} layout="vertical" margin={{ left: 8, right: 8, top: 12, bottom: 0 }}>
                    <CartesianGrid horizontal={false} stroke="#e3e8de" />
                    <XAxis axisLine={false} tickLine={false} type="number" tickFormatter={(value) => `£${value}`} />
                    <YAxis axisLine={false} dataKey="producer" tickLine={false} type="category" width={100} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <div className="flex min-w-[9rem] items-center justify-between gap-4">
                              <span className="text-[#5f6d61]">Payout</span>
                              <span className="font-mono font-medium text-[#182219]">{formatCurrencyValue(value)}</span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="payouts" fill="var(--color-payouts)" radius={[8, 8, 8, 8]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <div className={`${panelClass} p-6`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Current split</p>
                <h3 className="mt-2 text-xl font-semibold text-[#182219]">Commission share</h3>
              </div>
              <Badge className="rounded-full bg-[#edf4ee] px-3 py-1 text-[var(--forest-green)] shadow-none hover:bg-[#edf4ee]">
                5% target
              </Badge>
            </div>
            <div className="mt-5">
              {splitData.some((entry) => entry.value > 0) ? (
                <div>
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6a786c]">Commission share split</p>
                    <p className="mt-1 text-sm text-[#4f5f53]">Current split between commission retained and payouts distributed to producers.</p>
                  </div>
                  <ChartContainer config={splitChartConfig} className="h-[250px] w-full min-w-0 aspect-auto">
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
                      <Pie data={splitData} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">
                        {splitData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartLegend content={<ChartLegendContent nameKey="name" className="flex-wrap gap-3 pt-4 text-center" />} />
                    </PieChart>
                  </ChartContainer>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
                  No split data is available for the selected filters.
                </div>
              )}
            </div>
          </div>

          <div className={`${panelClass} p-6`}>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Validation samples</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#4f5f53]">
              <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                <p className="font-semibold text-[#182219]">Single order</p>
                <p className="mt-2">100.00 total -&gt; 5.00 commission -&gt; 95.00 producer payout.</p>
              </div>
              <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                <p className="font-semibold text-[#182219]">Multi-vendor order</p>
                <p className="mt-2">150.00 total -&gt; 7.50 commission -&gt; 76.00 and 66.50 producer payouts.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <div className={`${panelClass} p-6`}>
          <div className="flex flex-col gap-4 border-b border-[#e5eadf] pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Order breakdown</p>
              <h2 className="mt-2 text-xl font-semibold text-[#182219]">Detailed commission report</h2>
            </div>
            {!hasOrders && !loading ? (
              <Badge className="rounded-full bg-[#f7ecd2] px-3 py-1 text-[#6a4e11] shadow-none hover:bg-[#f7ecd2]">
                No matching orders
              </Badge>
            ) : null}
          </div>

          <div className="mt-4">
            <Label htmlFor="commission-report-search" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Search report rows
            </Label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7a867d]" />
              <Input
                id="commission-report-search"
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
                placeholder="Order number, producer, order status, payment status"
                className="h-11 rounded-2xl border-[#ccd4c5] bg-white pl-10"
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#dde4d7] bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#ecefe8] bg-[#f5f7f2] hover:bg-[#f5f7f2]">
                    <TableHead className="whitespace-nowrap">Order</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Total</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Commission</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Producer payouts</TableHead>
                    <TableHead>Breakdown</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleReportOrders.map((row) => (
                    <TableRow key={row.order_id} className="border-[#eef1eb] hover:bg-[#fbfcf8]">
                      <TableCell className="font-medium text-[#182219]">{row.order_number}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-[#5f6d61]">
                          <Calendar className="size-3" />
                          {formatAdminDate(row.order_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="rounded-full border border-[#e4e1d8] bg-white px-3 py-1 text-[#46564a] shadow-none hover:bg-white">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-[#182219]">{formatAdminCurrency(row.total_amount)}</TableCell>
                      <TableCell className="text-right font-medium text-[var(--forest-green)]">
                        {formatAdminCurrency(row.commission_amount)}
                      </TableCell>
                      <TableCell className="text-right text-[#182219]">
                        {formatAdminCurrency(row.producer_payout_total)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs leading-5 text-[#5f6d61]">
                          {row.producer_breakdown.map((producer) => (
                            <div key={`${row.order_id}-${producer.producer_id}`}>
                              {producer.producer_name}: subtotal {formatAdminCurrency(producer.subtotal_amount)} / payout{' '}
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
                            className="border-[#c7d0c1] bg-white text-[#405043] hover:bg-[#edf2eb] hover:text-[#405043]"
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
          </div>
          {hasOrders && visibleReportOrders.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-6 text-sm leading-6 text-[#5f6d61]">
              No commission rows match the current search.
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <div className={`${panelClass} p-6`}>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Monthly summary</p>
            <div className="mt-4 rounded-2xl border border-[#d6ddd0] bg-white p-4">
              <p className="text-sm text-[#6a786c]">Year commission total</p>
              <p className="mt-2 text-2xl font-semibold text-[#182219]">{formatAdminCurrency(String(monthlyTotalCommission))}</p>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#4f5f53]">
              {activeMonthlyRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d6ddd0] bg-[#f4f7f1] p-5">
                  No monthly rows are available for the selected year.
                </div>
              ) : (
                activeMonthlyRows.map((row) => (
                  <div key={`month-${row.month}`} className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                    <p className="font-semibold text-[#182219]">{monthLabel(selectedYear, row.month)}</p>
                    <p className="mt-2">Orders: {row.number_of_orders}</p>
                    <p>Order value: {formatAdminCurrency(row.total_order_value)}</p>
                    <p>Commission: {formatAdminCurrency(row.total_commission)}</p>
                    <p>Producer payouts: {formatAdminCurrency(row.total_producer_payouts)}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`${panelClass} p-6`}>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#6a786c]">Year-to-date</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#4f5f53]">
              <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                <p className="text-sm text-[#6a786c]">Orders</p>
                <p className="mt-2 text-2xl font-semibold text-[#182219]">{ytdSummary?.number_of_orders || 0}</p>
              </div>
              <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                Total order value: {formatAdminCurrency(ytdSummary?.total_order_value || '0')}
              </div>
              <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                Total commission: {formatAdminCurrency(ytdSummary?.total_commission || '0')}
              </div>
              <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                Total producer payouts: {formatAdminCurrency(ytdSummary?.total_producer_payouts || '0')}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-[#d6ddd0] bg-[#fbfcf8] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold tracking-tight text-[#182219]">
              {selectedDetailOrder?.order_number || 'Order detail'}
            </DialogTitle>
            <DialogDescription className="text-[#5f6d61]">
              Commission formula, payout validation, and payment metadata for the selected order.
            </DialogDescription>
          </DialogHeader>

          {selectedDetail ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                  <p className="text-sm text-[#6a786c]">Order total</p>
                  <p className="mt-1 text-xl font-semibold text-[#182219]">{formatAdminCurrency(selectedDetail.total_amount)}</p>
                </div>
                <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                  <p className="text-sm text-[#6a786c]">Commission amount</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--forest-green)]">
                    {formatAdminCurrency(selectedDetail.commission_amount)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                  <p className="text-sm text-[#6a786c]">Producer payout total</p>
                  <p className="mt-1 text-xl font-semibold text-[#182219]">
                    {formatAdminCurrency(selectedDetail.producer_payout_total)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#d6ddd0] bg-white p-4">
                  <p className="text-sm text-[#6a786c]">Payment status</p>
                  <p className="mt-1 text-xl font-semibold text-[#182219]">{selectedDetail.payment_status}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-[#d9e3d7] bg-[#edf4ee] p-5">
                <div className="flex items-start gap-3">
                  <Wallet className="mt-1 size-10 rounded-2xl bg-white p-2 text-[var(--forest-green)] shadow-sm" />
                  <div className="space-y-1">
                    <p className="font-semibold text-[#182219]">Commission calculation</p>
                    <p className="text-sm text-[#4f5f53]">Rate: {selectedDetail.calculation.commission_rate}</p>
                    <p className="text-sm text-[#4f5f53]">
                      Recorded commission: {formatAdminCurrency(selectedDetail.calculation.commission_amount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-[#d6ddd0] bg-white p-5">
                <p className="font-semibold text-[#182219]">Producer payout lines</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedDetail.producer_breakdown.map((producer) => (
                    <div key={`${selectedDetail.order_number}-${producer.producer_name}`} className="rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] p-4 text-sm leading-6 text-[#4f5f53]">
                      <p className="font-medium text-[#182219]">{producer.producer_name}</p>
                      <p className="mt-1">Subtotal {formatAdminCurrency(producer.subtotal_amount)}</p>
                      <p>Payout {formatAdminCurrency(producer.payout_amount)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedDetail.payment ? (
                <div className="rounded-3xl border border-[#d6ddd0] bg-white p-5">
                  <p className="font-semibold text-[#182219]">Payment record</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] p-4 text-sm leading-6 text-[#4f5f53]">
                      <p>Provider: {selectedDetail.payment.provider}</p>
                      <p className="mt-1">Reference: {selectedDetail.payment.provider_reference}</p>
                    </div>
                    <div className="rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] p-4 text-sm leading-6 text-[#4f5f53]">
                      <p>Amount: {formatAdminCurrency(selectedDetail.payment.amount)}</p>
                      <p className="mt-1">Currency: {selectedDetail.payment.currency}</p>
                    </div>
                    <div className="rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] p-4 text-sm leading-6 text-[#4f5f53]">
                      <p>Status: {selectedDetail.payment.status}</p>
                    </div>
                    <div className="rounded-2xl border border-[#d6ddd0] bg-[#f4f7f1] p-4 text-sm leading-6 text-[#4f5f53]">
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
