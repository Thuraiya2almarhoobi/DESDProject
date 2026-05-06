/**
 * DESD Marketplace documentation.
 *
 * File role:
 *   Implements the ProducerPaymentsPage browser route and coordinates the UI state for that screen.
 *
 * Frontend context:
 *   Route-level React page layer: one component per main browser page or role-specific workspace.
 *
 * Implementation notes:
 *   Keep comments focused on state ownership, role-specific routing, API calls,
 *   and non-obvious UI decisions. Styling-only class names are left uncommented
 *   unless they communicate an important layout or accessibility choice.
 */

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, ChevronDown, Download, Loader2 } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { apiBlob, apiJson } from '../../lib/api';
import { useSafeBack } from '../../lib/navigation';
import { SiteHeader } from '../../components/SiteHeader';
import { PageLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';

interface WeeklySettlementApi {
  id: number;
  week_start: string;
  week_end: string;
  gross_amount: string;
  commission_amount: string;
  net_amount: string;
  status: string;
  transaction_reference: string;
  order_count: number;
  running_tax_year_total: string;
}

type ExportFormat = 'csv' | 'pdf' | 'xlsx';

const exportFormats: ExportFormat[] = ['csv', 'pdf', 'xlsx'];
const exportFormatLabels: Record<ExportFormat, { title: string; description: string }> = {
  csv: {
    title: 'CSV',
    description: 'Recommended for spreadsheets and reconciliation.',
  },
  pdf: {
    title: 'PDF',
    description: 'Best for sharing a fixed statement.',
  },
  xlsx: {
    title: 'XLSX',
    description: 'Excel workbook with structured rows.',
  },
};

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string): string {
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return value;
  }
  return format(parsed, 'MMM d, yyyy');
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

interface SettlementDownloadMenuProps {
  disabled: boolean;
  isDownloading: boolean;
  label: string;
  onExport: (format: ExportFormat) => void;
  size?: 'default' | 'sm';
  variant?: 'default' | 'outline';
}

function SettlementDownloadMenu({
  disabled,
  isDownloading,
  label,
  onExport,
  size = 'default',
  variant = 'default',
}: SettlementDownloadMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={disabled} className="whitespace-nowrap">
          {isDownloading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Download className="size-4 mr-2" />}
          {isDownloading ? 'Downloading' : label}
          {!isDownloading ? <ChevronDown className="ml-2 size-4" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-2xl border-[#d7dfd2] p-2 shadow-xl">
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
 * ProducerPaymentsPage boundary.
 *
 * This exported unit supports the file role: Implements the ProducerPaymentsPage browser route and coordinates the UI state for that screen.
 * It belongs to: Route-level React page layer: one component per main browser page or role-specific workspace.
 * Keep role checks, API coordination, and cross-page side effects visible here
 * so future contributors can trace behavior during sprint reviews.
 */
export function ProducerPaymentsPage() {
  const goBack = useSafeBack('/producer/dashboard');
  const [settlements, setSettlements] = useState<WeeklySettlementApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadSettlements = async () => {
      setLoading(true);
      try {
        const payload = await apiJson<WeeklySettlementApi[]>('/api/payments/settlements/');
        if (!mounted) {
          return;
        }
        setSettlements(payload);
      } catch (error) {
        if (mounted) {
          const message = error instanceof Error ? error.message : 'Unable to load settlement history.';
          toast.error(message);
          setSettlements([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadSettlements();
    return () => {
      mounted = false;
    };
  }, []);

  const totalEarnings = useMemo(
    () => settlements.reduce((sum, settlement) => sum + toNumber(settlement.net_amount), 0),
    [settlements],
  );
  const totalSales = useMemo(
    () => settlements.reduce((sum, settlement) => sum + toNumber(settlement.gross_amount), 0),
    [settlements],
  );
  const totalCommission = useMemo(
    () => settlements.reduce((sum, settlement) => sum + toNumber(settlement.commission_amount), 0),
    [settlements],
  );

  const exportSettlement = async (settlement: WeeklySettlementApi, format: ExportFormat = 'csv') => {
    setExportingId(settlement.id);
    try {
      const query = `?format=${format}`;
      const blob = await apiBlob(`/api/payments/settlements/${settlement.id}/export/${query}`);
      const filename = `settlement-${settlement.week_start}-${settlement.week_end}.${format}`;
      triggerDownload(blob, filename);
      toast.success(`Exported ${settlement.transaction_reference} as ${format.toUpperCase()}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to export settlement ${format.toUpperCase()}.`;
      toast.error(message);
    } finally {
      setExportingId(null);
    }
  };

  const exportLatest = async (format: ExportFormat) => {
    const latest = settlements[0];
    if (!latest) {
      toast.info('No settlements available to export yet.');
      return;
    }
    await exportSettlement(latest, format);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold">Payment History</h1>
            <p className="text-gray-600">Weekly settlement reports with CSV, PDF, and Excel exports</p>
          </div>
          <SettlementDownloadMenu
            disabled={loading || settlements.length === 0 || exportingId !== null}
            isDownloading={exportingId !== null}
            label="Download latest"
            onExport={(format) => void exportLatest(format)}
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
              <p className="text-3xl font-semibold text-green-700">£{totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">After 5% commission</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Total Sales</p>
              <p className="text-3xl font-semibold">£{totalSales.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Gross revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-gray-600 mb-1">Platform Commission</p>
              <p className="text-3xl font-semibold text-gray-700">£{totalCommission.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">5% of sales</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Statements</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoadingSkeleton rows={3} cards={2} />
            ) : settlements.length === 0 ? (
              <div className="py-10 text-center text-gray-600">No weekly settlements found yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Commission (5%)</TableHead>
                    <TableHead className="text-right">Your Earnings</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Exports</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-gray-400" />
                          <div>
                            <p className="font-medium">
                              {formatDate(settlement.week_start)} - {formatDate(settlement.week_end)}
                            </p>
                            <p className="text-xs text-gray-500">{settlement.transaction_reference}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{settlement.order_count}</TableCell>
                      <TableCell className="text-right">£{toNumber(settlement.gross_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right text-gray-600">
                        -£{toNumber(settlement.commission_amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-700">
                        £{toNumber(settlement.net_amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{settlement.status.replaceAll('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <SettlementDownloadMenu
                            disabled={exportingId !== null}
                            isDownloading={exportingId === settlement.id}
                            label="Download"
                            onExport={(format) => void exportSettlement(settlement, format)}
                            size="sm"
                            variant="outline"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Payment Information</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Settlements are processed weekly and include delivered orders only.</p>
              <p>Platform commission is fixed at 5% per settlement line.</p>
              <p>Use CSV, PDF, or Excel export for finance reconciliation and evidence in reports.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
