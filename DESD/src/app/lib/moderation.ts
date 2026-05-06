import { apiJson } from './api';

export type ModerationTargetType =
  | 'customer_account'
  | 'producer_account'
  | 'product'
  | 'review'
  | 'recipe'
  | 'farm_story';

export interface ModerationReport {
  id: number;
  target_type: ModerationTargetType;
  object_id: number;
  target_label: string;
  target_exists: boolean;
  reported_by_email?: string;
  reported_by_role?: string;
  reason: string;
  status: 'open' | 'kept' | 'removed';
  target_snapshot: Record<string, unknown>;
  target_context?: {
    profile?: Record<string, unknown>;
    related_items?: Array<{
      type: string;
      id: number;
      label: string;
      status?: string;
    }>;
  };
  resolved_by_email?: string;
  resolution_note?: string;
  removed_at?: string | null;
  kept_at?: string | null;
  created_at: string;
}

export interface ModerationSummary {
  open: number;
  kept: number;
  removed: number;
  open_by_type: Record<string, number>;
}

export interface ModerationReportStatus {
  reported: boolean;
  report_id?: number | null;
  status?: 'open' | 'kept' | 'removed' | null;
}

export interface ModerationUser {
  id: number;
  email: string;
  role: string;
  is_active: boolean;
  date_joined: string;
  open_report_count: number;
  total_report_count: number;
  moderation_context?: ModerationReport['target_context'];
}

export interface ModerationAction {
  id: number;
  target_type: ModerationTargetType;
  object_id: number;
  action: 'remove' | 'restore' | 'deactivate' | 'reactivate' | 'keep_live';
  note: string;
  admin_email?: string;
  before_snapshot: Record<string, unknown>;
  after_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface ModerationItem {
  target_type: ModerationTargetType;
  object_id: number;
  label: string;
  subtitle: string;
  visibility: 'active' | 'deactivated' | 'live' | 'removed' | 'unknown';
  owner: {
    id?: number | null;
    label?: string;
    email?: string;
    role?: string;
  };
  snapshot: Record<string, unknown>;
  public_url?: string;
  open_report_count: number;
  total_report_count: number;
  kept_report_count: number;
  removed_report_count: number;
  keep_action_count: number;
  removal_action_count: number;
  last_updated?: string | null;
}

export interface ModerationItemDetail extends ModerationItem {
  context?: ModerationReport['target_context'];
  reports: ModerationReport[];
  actions: ModerationAction[];
}

export interface ModerationItemsResponse {
  count: number;
  page: number;
  page_size: number;
  results: ModerationItem[];
}

export async function reportModerationTarget(
  targetType: ModerationTargetType,
  objectId: string | number,
  reason = '',
): Promise<ModerationReport> {
  return apiJson<ModerationReport>('/api/moderation/reports/', {
    method: 'POST',
    body: JSON.stringify({
      target_type: targetType,
      object_id: Number(objectId),
      reason,
    }),
  });
}

export async function fetchMyModerationReportStatus(
  targetType: ModerationTargetType,
  objectId: string | number,
): Promise<ModerationReportStatus> {
  const query = new URLSearchParams({
    target_type: targetType,
    object_id: String(objectId),
  });
  return apiJson<ModerationReportStatus>(`/api/moderation/reports/my-status/?${query.toString()}`);
}

export async function fetchModerationReports(status = 'open', targetType = '', search = ''): Promise<ModerationReport[]> {
  const query = new URLSearchParams({ status });
  if (targetType) {
    query.set('target_type', targetType);
  }
  if (search.trim()) {
    query.set('q', search.trim());
  }
  return apiJson<ModerationReport[]>(`/api/moderation/reports/?${query.toString()}`);
}

export async function fetchModerationSummary(): Promise<ModerationSummary> {
  return apiJson<ModerationSummary>('/api/moderation/summary/');
}

export async function fetchModerationItems(filters: {
  q?: string;
  type?: string;
  visibility?: string;
  reported?: string;
  owner?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<ModerationItemsResponse> {
  const query = new URLSearchParams();
  if (filters.q?.trim()) {
    query.set('q', filters.q.trim());
  }
  if (filters.type) {
    query.set('type', filters.type);
  }
  if (filters.visibility) {
    query.set('visibility', filters.visibility);
  }
  if (filters.reported) {
    query.set('reported', filters.reported);
  }
  if (filters.owner?.trim()) {
    query.set('owner', filters.owner.trim());
  }
  if (filters.page) {
    query.set('page', String(filters.page));
  }
  if (filters.pageSize) {
    query.set('page_size', String(filters.pageSize));
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiJson<ModerationItemsResponse>(`/api/moderation/items/${suffix}`);
}

export async function fetchModerationItemDetail(targetType: ModerationTargetType, objectId: number): Promise<ModerationItemDetail> {
  return apiJson<ModerationItemDetail>(`/api/moderation/items/${targetType}/${objectId}/`);
}

export async function applyModerationItemAction(
  targetType: ModerationTargetType,
  objectId: number,
  action: ModerationAction['action'],
  note: string,
): Promise<ModerationItemDetail> {
  return apiJson<ModerationItemDetail>(`/api/moderation/items/${targetType}/${objectId}/action/`, {
    method: 'POST',
    body: JSON.stringify({ action, note }),
  });
}

export async function fetchModerationUsers(role = '', accountStatus = '', search = ''): Promise<ModerationUser[]> {
  const query = new URLSearchParams();
  if (role) {
    query.set('role', role);
  }
  if (accountStatus) {
    query.set('account_status', accountStatus);
  }
  if (search.trim()) {
    query.set('q', search.trim());
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiJson<ModerationUser[]>(`/api/moderation/users/${suffix}`);
}

export async function updateModerationUserStatus(userId: number, action: 'deactivate' | 'reactivate'): Promise<ModerationUser> {
  return apiJson<ModerationUser>(`/api/moderation/users/${userId}/action/`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

export async function removeModerationReport(reportId: number, note = ''): Promise<ModerationReport> {
  return apiJson<ModerationReport>(`/api/moderation/reports/${reportId}/remove/`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function keepModerationReport(reportId: number, note = ''): Promise<ModerationReport> {
  return apiJson<ModerationReport>(`/api/moderation/reports/${reportId}/keep/`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}
