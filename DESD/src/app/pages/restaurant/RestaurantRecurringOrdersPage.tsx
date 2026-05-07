/**
 * desd marketplace notes
 *
 * restaurant recurring order workspace for templates overrides and manual runs
 * comments here explain api ownership and one off next instance behavior
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Clock3, PauseCircle, PlayCircle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiJson } from '../../lib/api';
import { SiteHeader } from '../../components/SiteHeader';
import { PageLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

interface RecurringTemplateItem {
  id: number;
  product_id: number;
  product_name: string;
  producer_id: number;
  producer_name: string;
  available_stock: string;
  default_quantity: string;
  unit_price?: string;
  default_line_total?: string;
}

interface RecurringTemplateAlert {
  product_id: number;
  product_name: string;
  reason: string;
  available_stock: string;
  required_quantity: string;
}

interface RecurringTemplatePayload {
  id: number;
  frequency: 'weekly' | 'fortnightly';
  order_day: number;
  delivery_day: number;
  next_order_date: string;
  next_run_date: string;
  is_paused: boolean;
  is_cancelled: boolean;
  items: RecurringTemplateItem[];
  alerts: RecurringTemplateAlert[];
  next_instance_override: {
    items: Array<{ product_id: number; quantity: string }>;
  } | null;
}

function weekdayName(value: number): string {
  const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return names[value] || 'Unknown';
}

function formatWhole(value: string | number): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return String(value);
  }
  return String(Math.round(parsed));
}

function money(value: string | number): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `£${parsed.toFixed(2)}` : '£0.00';
}

/**
 * recurring restaurant orders page boundary
 *
 * the page shows template defaults beside the editable next instance
 * generated orders and payments remain owned by the backend service
 */
export function RestaurantRecurringOrdersPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<RecurringTemplatePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTemplateId, setSavingTemplateId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<number, Record<number, string>>>({});
  const [overrideWarnings, setOverrideWarnings] = useState<Record<number, Record<number, string>>>({});

  const loadTemplates = async () => {
    // rebuild drafts from api data so cancelled edits never hang around
    // each refresh treats the backend as owner of template and override state
    setLoading(true);
    try {
      const payload = await apiJson<RecurringTemplatePayload[]>('/api/restaurant/recurring-orders/');
      setTemplates(payload);
      const nextDrafts: Record<number, Record<number, string>> = {};
      const nextWarnings: Record<number, Record<number, string>> = {};
      payload.forEach((template) => {
        const itemDrafts: Record<number, string> = {};
        const itemWarnings: Record<number, string> = {};
        template.items.forEach((item) => {
          const overridden = template.next_instance_override?.items.find(
            (row) => row.product_id === item.product_id,
          );
          // override drafts start from the next instance when it exists
          // otherwise the editable quantities mirror the original template
          itemDrafts[item.product_id] = overridden?.quantity || item.default_quantity;
          itemWarnings[item.product_id] = '';
        });
        nextDrafts[template.id] = itemDrafts;
        nextWarnings[template.id] = itemWarnings;
      });
      setOverrideDrafts(nextDrafts);
      setOverrideWarnings(nextWarnings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load recurring templates.');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const activeTemplates = useMemo(
    // hide cancelled templates without deleting their history from backend
    // cancelled rows can still support future audit or settlement checks
    () => templates.filter((template) => !template.is_cancelled),
    [templates],
  );

  const updateTemplate = async (templateId: number, payload: Record<string, unknown>) => {
    // route all template patch actions through one refresh path
    // pause resume and cancel share the same backend permission check
    setSavingTemplateId(templateId);
    try {
      await apiJson(`/api/restaurant/recurring-orders/${templateId}/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update template.');
    } finally {
      setSavingTemplateId(null);
    }
  };

  const saveNextOverride = async (template: RecurringTemplatePayload) => {
    // clamp next instance quantities so the template itself stays unchanged
    // this keeps one off kitchen changes separate from the recurring base order
    setSavingTemplateId(template.id);
    try {
      const draft = overrideDrafts[template.id] || {};
      const items = template.items.map((item) => ({
        product_id: item.product_id,
        quantity: (() => {
          // next instance edits are rounded to whole quantities for restaurant ux
          // stock limits are applied before the override reaches the api
          const rawValue = Number(draft[item.product_id] || item.default_quantity);
          const availableStock = Number(item.available_stock);
          if (!Number.isFinite(rawValue)) {
            return item.default_quantity;
          }
          if (!Number.isFinite(availableStock) || availableStock <= 0) {
            return '0.01';
          }
          return String(Math.max(1, Math.min(Math.round(rawValue), Math.floor(availableStock))));
        })(),
      }));
      await apiJson(`/api/restaurant/recurring-orders/${template.id}/next-instance/`, {
        method: 'PATCH',
        body: JSON.stringify({ items }),
      });
      toast.success('Next recurring instance updated.');
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update next instance.');
    } finally {
      setSavingTemplateId(null);
    }
  };

  const runGeneration = async () => {
    // generated recurring orders create normal orders plus payment rows
    // producers then see advance demand and generated orders in their own pages
    setRunning(true);
    try {
      const payload = await apiJson<{ generated_count: number; results: Array<{ unavailable_products: unknown[] }> }>(
        '/api/restaurant/recurring-orders/run/',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );
      const unavailableCount = payload.results.reduce(
        // unavailable products are counted so the demo can prove stock checks ran
        // the toast keeps stock failures visible without leaving the page
        (sum, row) => sum + (row.unavailable_products?.length || 0),
        0,
      );
      toast.success(
        `Recurring run complete. Generated ${payload.generated_count} order(s). Unavailable items: ${unavailableCount}.`,
      );
      await loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to run recurring generation.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.98_0.01_145)] to-[oklch(0.96_0.02_150)]">
      <SiteHeader />

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Restaurant Recurring Orders</h1>
            <p className="mt-1 text-sm text-gray-600">Role: RESTAURANT | Recurring template management interface</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/marketplace')}>
            Create From Marketplace
          </Button>
        </div>
        <Card className="border-[oklch(0.84_0.05_145)] bg-[linear-gradient(135deg,rgba(243,249,244,0.96),rgba(255,255,255,0.94))]">
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[oklch(0.42_0.07_145)]">
                Restaurant scheduling workspace
              </p>
              <p className="mt-2 text-sm text-gray-600">
                Use this page to manage repeat kitchen orders, adjust only the next run when needed, and keep each producer quantity within the live stock available from that producer.
              </p>
            </div>
            <Badge variant="secondary">Producer stock limit</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-wrap items-center gap-4 justify-between">
            <div>
              <p className="text-sm text-gray-600">Run due recurring templates and generate order instances.</p>
              <p className="text-xs text-gray-500 mt-1">
                Each generated instance creates its own paid order and payment transaction, so payment is processed per recurring order instance rather than only on the template.
              </p>
            </div>
            <Button onClick={runGeneration} disabled={running}>
              <RefreshCw className="size-4 mr-2" />
              {running ? 'Running...' : 'Run Recurring Orders'}
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <PageLoadingSkeleton rows={3} cards={2} />
        ) : activeTemplates.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-gray-600">
              No recurring templates yet. Create an order from marketplace checkout and enable recurring.
            </CardContent>
          </Card>
        ) : (
          activeTemplates.map((template, index) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">Template {index + 1}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={template.is_paused ? 'secondary' : 'default'}>
                      {template.is_paused ? 'Paused' : 'Active'}
                    </Badge>
                    <Badge variant="outline">{template.frequency}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Clock3 className="size-4" />
                    Order day: {weekdayName(template.order_day)}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="size-4" />
                    Delivery day: {weekdayName(template.delivery_day)}
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="size-4" />
                    Next run: {template.next_run_date}
                  </div>
                </div>

                <div className="border rounded-md">
                  <div className="grid grid-cols-5 gap-2 p-3 text-xs font-semibold text-gray-600 border-b">
                    <span>Product</span>
                    <span>Producer</span>
                    <span>Default Qty</span>
                    <span>Original Amount</span>
                    <span>Next Instance Qty</span>
                  </div>
                  {template.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-5 gap-2 p-3 text-sm border-b last:border-b-0">
                      {/* product and producer names behave like marketplace links
                          this lets restaurant buyers inspect the item or farm before the next run */}
                      <button
                        type="button"
                        onClick={() => navigate(`/product/${item.product_id}`)}
                        className="text-left font-medium text-[var(--forest-green)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)]"
                      >
                        {item.product_name}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/producers/${item.producer_id}`)}
                        className="text-left font-medium text-[var(--forest-green)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest-green)]"
                      >
                        {item.producer_name}
                      </button>
                      <span>{formatWhole(item.default_quantity)}</span>
                      <span>{money(item.default_line_total || Number(item.default_quantity) * Number(item.unit_price || 0))}</span>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`override-${template.id}-${item.product_id}`} className="sr-only">
                            Next quantity
                          </Label>
                          <Input
                            id={`override-${template.id}-${item.product_id}`}
                            type="number"
                            min="1"
                            max={item.available_stock}
                            step="1"
                            value={formatWhole(overrideDrafts[template.id]?.[item.product_id] || item.default_quantity)}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              setOverrideWarnings((previous) => ({
                                ...previous,
                                [template.id]: {
                                  ...(previous[template.id] || {}),
                                  [item.product_id]:
                                    Number.isFinite(next) && next > Number(item.available_stock)
                                      ? `Above stock. Max ${formatWhole(item.available_stock)}.`
                                      : '',
                                },
                              }));
                              setOverrideDrafts((previous) => ({
                                ...previous,
                                [template.id]: {
                                  ...(previous[template.id] || {}),
                                  [item.product_id]: event.target.value,
                                },
                              }));
                            }}
                          />
                          <span className="text-[11px] text-gray-500">Stock {formatWhole(item.available_stock)}</span>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Next amount {money(Number(overrideDrafts[template.id]?.[item.product_id] || item.default_quantity) * Number(item.unit_price || 0))}
                        </p>
                        {overrideWarnings[template.id]?.[item.product_id] ? (
                          <p className="text-[11px] text-orange-600">
                            {overrideWarnings[template.id][item.product_id]}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {template.alerts.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                    <p className="font-medium text-amber-900 mb-1">Availability alerts</p>
                    {template.alerts.map((alert) => (
                      <p key={`${template.id}-${alert.product_id}`} className="text-amber-900">
                        {alert.product_name}: {alert.reason} (required {alert.required_quantity}, stock {alert.available_stock})
                      </p>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Override quantities follow each producer&apos;s live available stock for the selected product.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => updateTemplate(template.id, { is_paused: !template.is_paused })}
                    disabled={savingTemplateId === template.id}
                  >
                    {template.is_paused ? <PlayCircle className="size-4 mr-2" /> : <PauseCircle className="size-4 mr-2" />}
                    {template.is_paused ? 'Resume' : 'Pause'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => saveNextOverride(template)}
                    disabled={savingTemplateId === template.id}
                  >
                    Save Next Instance
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateTemplate(template.id, { is_cancelled: true })}
                    disabled={savingTemplateId === template.id}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
