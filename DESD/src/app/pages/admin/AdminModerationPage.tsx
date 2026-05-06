import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  History,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { FeedLoadingSkeleton } from '../../components/LoadingSkeletons';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  applyModerationItemAction,
  fetchModerationItemDetail,
  fetchModerationItems,
  fetchModerationSummary,
  ModerationAction,
  ModerationItem,
  ModerationItemDetail,
  ModerationSummary,
  ModerationTargetType,
} from '../../lib/moderation';

const targetLabels: Record<string, string> = {
  customer_account: 'User',
  producer_account: 'Producer',
  product: 'Product',
  review: 'Review',
  recipe: 'Recipe',
  farm_story: 'Farm Story',
};

const targetOptions: Array<{ value: '' | ModerationTargetType; label: string }> = [
  { value: '', label: 'All' },
  { value: 'customer_account', label: 'Users' },
  { value: 'producer_account', label: 'Producers' },
  { value: 'product', label: 'Products' },
  { value: 'review', label: 'Reviews' },
  { value: 'recipe', label: 'Recipes' },
  { value: 'farm_story', label: 'Farm Stories' },
];

const visibilityOptions = [
  { value: '', label: 'Any current status' },
  { value: 'live', label: 'Live uploads' },
  { value: 'active', label: 'Active accounts' },
  { value: 'removed', label: 'Currently removed uploads' },
  { value: 'deactivated', label: 'Deactivated accounts' },
];

const reportedOptions = [
  { value: '', label: 'Any case history' },
  { value: 'reported', label: 'Open reports' },
  { value: 'unreported', label: 'No reports' },
  { value: 'removed', label: 'Removed decisions' },
  { value: 'kept', label: 'Kept live decisions' },
];

function formatDate(value?: string | null): string {
  if (!value) {
    return 'Not recorded';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function detailRows(values?: Record<string, unknown>): Array<[string, string]> {
  if (!values) {
    return [];
  }
  return Object.entries(values)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .slice(0, 10)
    .map(([key, value]) => [titleCase(key), typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)]);
}

function actionLabel(action: ModerationAction['action']): string {
  return titleCase(action);
}

function statusBadgeVariant(visibility: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (visibility === 'removed' || visibility === 'deactivated') {
    return 'destructive';
  }
  if (visibility === 'live' || visibility === 'active') {
    return 'outline';
  }
  return 'secondary';
}

function availableActions(item: ModerationItemDetail | ModerationItem): Array<{
  action: ModerationAction['action'];
  label: string;
  tone: 'danger' | 'normal';
}> {
  if (item.target_type === 'customer_account' || item.target_type === 'producer_account') {
    return item.visibility === 'deactivated'
      ? [{ action: 'reactivate', label: 'Reactivate account', tone: 'normal' }]
      : [{ action: 'deactivate', label: 'Deactivate account', tone: 'danger' }];
  }
  return item.visibility === 'removed'
    ? [{ action: 'restore', label: 'Restore', tone: 'normal' }]
    : [{ action: 'remove', label: 'Remove', tone: 'danger' }];
}

export function AdminModerationPage() {
  const [items, setItems] = useState<ModerationItem[]>([]);
  const [selected, setSelected] = useState<ModerationItemDetail | null>(null);
  const [summary, setSummary] = useState<ModerationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [reportedFilter, setReportedFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [actionNote, setActionNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState<ModerationAction['action'] | null>(null);

  const activeFilterCount = [
    searchQuery.trim(),
    ownerFilter.trim(),
    typeFilter,
    visibilityFilter,
    reportedFilter,
  ].filter(Boolean).length;

  const loadItems = async (
    overrides: Partial<{
      q: string;
      type: string;
      visibility: string;
      reported: string;
      owner: string;
    }> = {},
  ) => {
    setLoading(true);
    try {
      const [itemPayload, summaryPayload] = await Promise.all([
        fetchModerationItems({
          q: overrides.q ?? searchQuery,
          type: overrides.type ?? typeFilter,
          visibility: overrides.visibility ?? visibilityFilter,
          reported: overrides.reported ?? reportedFilter,
          owner: overrides.owner ?? ownerFilter,
          pageSize: 60,
        }),
        fetchModerationSummary(),
      ]);
      setItems(itemPayload.results);
      setSummary(summaryPayload);
      if (!selected && itemPayload.results[0]) {
        void loadDetail(itemPayload.results[0]);
      }
      if (selected && !itemPayload.results.some((item) => item.target_type === selected.target_type && item.object_id === selected.object_id)) {
        setSelected(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load moderation workspace.');
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (item: ModerationItem) => {
    setDetailLoading(true);
    setActionNote('');
    try {
      const payload = await fetchModerationItemDetail(item.target_type, item.object_id);
      setSelected(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load moderation detail.');
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [typeFilter, visibilityFilter, reportedFilter]);

  const summaryCards = useMemo(
    () => [
      { label: 'Open reports', value: summary?.open ?? 0 },
      { label: 'Removed', value: summary?.removed ?? 0 },
      { label: 'Kept live', value: summary?.kept ?? 0 },
      { label: 'Result items', value: items.length },
    ],
    [items.length, summary],
  );

  const submitAction = async (action: ModerationAction['action']) => {
    if (!selected || submittingAction) {
      return;
    }
    if (!actionNote.trim()) {
      toast.error('Add a moderation note before submitting.');
      return;
    }
    setSubmittingAction(action);
    try {
      const updated = await applyModerationItemAction(selected.target_type, selected.object_id, action, actionNote);
      setSelected(updated);
      setActionNote('');
      toast.success(`${updated.label} updated.`);
      await loadItems();
      setSelected(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to apply moderation action.');
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleCaseFilterChange = (value: string) => {
    setReportedFilter(value);
    if (value) {
      setVisibilityFilter('');
    }
  };

  const handleVisibilityFilterChange = (value: string) => {
    setVisibilityFilter(value);
    if (value) {
      setReportedFilter('');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setOwnerFilter('');
    setTypeFilter('');
    setVisibilityFilter('');
    setReportedFilter('');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-[#d6ddd0] bg-[#fbfcf8] p-6 shadow-[0_10px_24px_rgba(18,31,21,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[#6a786c]">Moderation</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#182219]">Universal control workspace</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6d61]">
              Search users, producer companies, products, reviews, recipes, and farm stories. Direct actions are soft-removal only and always require an audit note.
            </p>
          </div>
          <Button onClick={() => void loadItems()} variant="outline">
            Refresh
          </Button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-3xl border border-[#e0e6dc] bg-white p-4">
              <p className="text-sm text-[#6a786c]">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-[#182219]">{card.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px_220px_220px]">
          <div>
            <Label htmlFor="moderation-search" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Global search
            </Label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7a867d]" />
              <Input
                id="moderation-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Names, companies, products, reviews, recipes, stories"
                className="h-11 rounded-2xl border-[#ccd4c5] bg-white pl-10"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void loadItems();
                  }
                }}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="moderation-owner" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Owner
            </Label>
            <Input
              id="moderation-owner"
              value={ownerFilter}
              onChange={(event) => setOwnerFilter(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void loadItems()}
              placeholder="Owner/company"
              className="mt-2 h-11 rounded-2xl border-[#ccd4c5] bg-white"
            />
          </div>
          <div>
            <Label htmlFor="moderation-visibility" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Current status
            </Label>
            {/* current status means what the item is right now */}
            <select
              id="moderation-visibility"
              value={visibilityFilter}
              onChange={(event) => handleVisibilityFilterChange(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-[#ccd4c5] bg-white px-4 text-sm text-[#223026]"
            >
              {visibilityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="moderation-reported" className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#6a786c]">
              Case history
            </Label>
            {/* case history means what moderation decided before */}
            <select
              id="moderation-reported"
              value={reportedFilter}
              onChange={(event) => handleCaseFilterChange(event.target.value)}
              className="mt-2 h-11 w-full rounded-2xl border border-[#ccd4c5] bg-white px-4 text-sm text-[#223026]"
            >
              {reportedOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {/* type buttons keep browsing fast without hiding the search fields */}
          {targetOptions.map((option) => (
            <Button
              key={option.label}
              type="button"
              variant={typeFilter === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void loadItems()}
          >
            Apply search
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={activeFilterCount === 0}
            onClick={() => {
              clearFilters();
              void loadItems({ q: '', type: '', visibility: '', reported: '', owner: '' });
            }}
          >
            Clear filters
          </Button>
        </div>

        <div className="mt-3 rounded-2xl border border-[#e0e6dc] bg-white px-4 py-3 text-sm text-[#5f6d61]">
          Use <span className="font-semibold text-[#243127]">Current status</span> for what is live or hidden now. Use{' '}
          <span className="font-semibold text-[#243127]">Case history</span> for report decisions such as open reports,
          removed decisions, and kept-live decisions.
        </div>
      </section>

      {loading ? (
        <FeedLoadingSkeleton rows={4} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="grid content-start gap-3">
            {items.length === 0 ? (
              <Card className="border-[#d6ddd0] bg-[#fbfcf8]">
                <CardContent className="py-14 text-center text-[#5f6d61]">No moderation items match these filters.</CardContent>
              </Card>
            ) : (
              items.map((item) => {
                const isSelected = selected?.target_type === item.target_type && selected?.object_id === item.object_id;
                return (
                  /* item card is a button so keyboard users can open details too */
                  <button
                    key={`${item.target_type}-${item.object_id}`}
                    type="button"
                    onClick={() => void loadDetail(item)}
                    className={`rounded-2xl border bg-[#fbfcf8] p-4 text-left shadow-[0_10px_24px_rgba(18,31,21,0.04)] transition hover:border-[#8aa57d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 ${
                      isSelected ? 'border-[#2f6b45] ring-2 ring-[#cfe0ca]' : 'border-[#d6ddd0]'
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-[#e7efe5] text-[#256843] hover:bg-[#e7efe5]">
                            {targetLabels[item.target_type] || item.target_type}
                          </Badge>
                          <Badge variant={statusBadgeVariant(item.visibility)}>{titleCase(item.visibility)}</Badge>
                          {item.open_report_count > 0 ? (
                            <Badge variant="destructive">{item.open_report_count} open reports</Badge>
                          ) : item.kept_report_count + item.keep_action_count > 0 ? (
                            /* kept live appears even when the item is still public */
                            <Badge variant="outline">Kept live</Badge>
                          ) : item.removed_report_count + item.removal_action_count > 0 ? (
                            <Badge variant="secondary">Removed history</Badge>
                          ) : (
                            <Badge variant="outline">{item.total_report_count} total reports</Badge>
                          )}
                        </div>
                        <h3 className="mt-3 truncate text-lg font-semibold text-[#182219]">{item.label}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-[#5f6d61]">{item.subtitle || item.owner?.label || 'No extra context'}</p>
                      </div>
                      <div className="text-sm text-[#6a786c] sm:text-right">
                        <p>{item.owner?.label || item.owner?.email || 'No owner'}</p>
                        <p>{formatDate(item.last_updated)}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </section>

          <aside className="xl:sticky xl:top-24 xl:self-start">
            <Card className="border-[#d6ddd0] bg-[#fbfcf8] shadow-[0_10px_24px_rgba(18,31,21,0.05)]">
              <CardContent className="p-5">
                {detailLoading ? (
                  <FeedLoadingSkeleton rows={2} />
                ) : selected ? (
                  <div className="space-y-5">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-[#e7efe5] text-[#256843] hover:bg-[#e7efe5]">
                          {targetLabels[selected.target_type] || selected.target_type}
                        </Badge>
                        <Badge variant={statusBadgeVariant(selected.visibility)}>{titleCase(selected.visibility)}</Badge>
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#182219]">{selected.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#5f6d61]">{selected.subtitle}</p>
                      {selected.public_url ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => window.open(selected.public_url, '_blank', 'noopener,noreferrer')}
                        >
                          <ArrowUpRight className="size-4" />
                          Open public page
                        </Button>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-[#e0e6dc] bg-white p-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a786c]">
                        <FileText className="size-4" />
                        Owner and item context
                      </p>
                      <dl className="mt-3 grid gap-2 text-sm">
                        {detailRows(selected.context?.profile || selected.snapshot).map(([label, value]) => (
                          <div key={label} className="grid grid-cols-[125px_minmax(0,1fr)] gap-2">
                            <dt className="text-[#6a786c]">{label}</dt>
                            <dd className="break-words font-medium text-[#243127]">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <div className="rounded-2xl border border-[#e0e6dc] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6a786c]">Linked uploads</p>
                      <div className="mt-3 grid gap-2 text-sm">
                        {(selected.context?.related_items || []).length > 0 ? (
                          selected.context?.related_items?.slice(0, 8).map((item) => (
                            <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f8f4] px-3 py-2">
                              <span className="min-w-0 truncate text-[#243127]">{item.label}</span>
                              <Badge variant="outline" className="shrink-0">{item.type}{item.status ? ` · ${item.status}` : ''}</Badge>
                            </div>
                          ))
                        ) : (
                          <p className="text-[#6a786c]">No linked uploads found.</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#e0e6dc] bg-white p-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a786c]">
                        <ShieldAlert className="size-4" />
                        Direct action
                      </p>
                      <Textarea
                        value={actionNote}
                        onChange={(event) => setActionNote(event.target.value)}
                        placeholder="Required moderation note"
                        className="mt-3 min-h-24 rounded-2xl"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {availableActions(selected).map((action) => (
                          <Button
                            key={action.action}
                            type="button"
                            disabled={submittingAction !== null}
                            variant={action.tone === 'danger' ? 'default' : 'outline'}
                            className={action.tone === 'danger' ? 'bg-red-700 text-white hover:bg-red-800' : ''}
                            onClick={() => void submitAction(action.action)}
                          >
                            {action.action === 'deactivate' ? <UserX className="size-4" /> : null}
                            {action.action === 'reactivate' ? <UserCheck className="size-4" /> : null}
                            {action.action === 'remove' ? <Trash2 className="size-4" /> : null}
                            {action.action === 'restore' ? <RotateCcw className="size-4" /> : null}
                            {submittingAction === action.action ? 'Working...' : action.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#e0e6dc] bg-white p-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#6a786c]">
                        <History className="size-4" />
                        Reports and action history
                      </p>
                      <div className="mt-3 grid gap-3 text-sm">
                        {selected.reports.map((report) => (
                          <div key={`report-${report.id}`} className="rounded-xl bg-[#f7f8f4] px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={report.status === 'open' ? 'destructive' : 'outline'}>{report.status}</Badge>
                              <span className="text-[#6a786c]">{formatDate(report.created_at)}</span>
                            </div>
                            <p className="mt-1 text-[#243127]">{report.reason || 'No reason supplied.'}</p>
                            <p className="mt-1 text-xs text-[#6a786c]">By {report.reported_by_email || 'Unknown user'}</p>
                          </div>
                        ))}
                        {selected.actions.map((action) => (
                          <div key={`action-${action.id}`} className="rounded-xl bg-[#f7f8f4] px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{actionLabel(action.action)}</Badge>
                              <span className="text-[#6a786c]">{formatDate(action.created_at)}</span>
                            </div>
                            <p className="mt-1 text-[#243127]">{action.note}</p>
                            <p className="mt-1 text-xs text-[#6a786c]">By {action.admin_email || 'Unknown admin'}</p>
                          </div>
                        ))}
                        {selected.reports.length === 0 && selected.actions.length === 0 ? (
                          <p className="text-[#6a786c]">No reports or moderation actions yet.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-[#6a786c]">
                    <CheckCircle2 className="mx-auto mb-3 size-10 text-[#73946f]" />
                    Select an item to inspect and manage it.
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
