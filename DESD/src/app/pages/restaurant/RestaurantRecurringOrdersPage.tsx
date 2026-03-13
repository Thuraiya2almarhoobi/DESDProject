import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Clock3, PauseCircle, PlayCircle, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { apiJson } from '../../lib/api';
import { SiteHeader } from '../../components/SiteHeader';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';

interface RecurringTemplateItem {
  id: number;
  product_id: number;
  product_name: string;
  producer_name: string;
  default_quantity: string;
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

export function RestaurantRecurringOrdersPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<RecurringTemplatePayload[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTemplateId, setSavingTemplateId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<number, Record<number, string>>>({});

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const payload = await apiJson<RecurringTemplatePayload[]>('/api/restaurant/recurring-orders/');
      setTemplates(payload);
      const nextDrafts: Record<number, Record<number, string>> = {};
      payload.forEach((template) => {
        const itemDrafts: Record<number, string> = {};
        template.items.forEach((item) => {
          const overridden = template.next_instance_override?.items.find(
            (row) => row.product_id === item.product_id,
          );
          itemDrafts[item.product_id] = overridden?.quantity || item.default_quantity;
        });
        nextDrafts[template.id] = itemDrafts;
      });
      setOverrideDrafts(nextDrafts);
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
    () => templates.filter((template) => !template.is_cancelled),
    [templates],
  );

  const updateTemplate = async (templateId: number, payload: Record<string, unknown>) => {
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
    setSavingTemplateId(template.id);
    try {
      const draft = overrideDrafts[template.id] || {};
      const items = template.items.map((item) => ({
        product_id: item.product_id,
        quantity: draft[item.product_id] || item.default_quantity,
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
        <Card>
          <CardContent className="p-6 flex flex-wrap items-center gap-4 justify-between">
            <div>
              <p className="text-sm text-gray-600">Run due recurring templates and generate order instances.</p>
              <p className="text-xs text-gray-500 mt-1">Each generated instance creates its own payment record.</p>
            </div>
            <Button onClick={runGeneration} disabled={running}>
              <RefreshCw className="size-4 mr-2" />
              {running ? 'Running...' : 'Run Recurring Orders'}
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-gray-600">Loading recurring templates...</CardContent>
          </Card>
        ) : activeTemplates.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-gray-600">
              No recurring templates yet. Create an order from marketplace checkout and enable recurring.
            </CardContent>
          </Card>
        ) : (
          activeTemplates.map((template) => (
            <Card key={template.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">Template #{template.id}</CardTitle>
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
                  <div className="grid grid-cols-4 gap-2 p-3 text-xs font-semibold text-gray-600 border-b">
                    <span>Product</span>
                    <span>Producer</span>
                    <span>Default Qty</span>
                    <span>Next Instance Qty</span>
                  </div>
                  {template.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-4 gap-2 p-3 text-sm border-b last:border-b-0">
                      <span>{item.product_name}</span>
                      <span>{item.producer_name}</span>
                      <span>{item.default_quantity}</span>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`override-${template.id}-${item.product_id}`} className="sr-only">
                          Next quantity
                        </Label>
                        <Input
                          id={`override-${template.id}-${item.product_id}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={overrideDrafts[template.id]?.[item.product_id] || item.default_quantity}
                          onChange={(event) =>
                            setOverrideDrafts((previous) => ({
                              ...previous,
                              [template.id]: {
                                ...(previous[template.id] || {}),
                                [item.product_id]: event.target.value,
                              },
                            }))
                          }
                        />
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
