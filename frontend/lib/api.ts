import type {
  AnalyticsSummary,
  Company,
  CompanyDetail,
  GenerateEmailResult,
  Lead,
  LeadSearchJob,
  LeadTimeline,
  OutreachEmail,
  PaginatedCompanies,
  PaginatedLeads,
  PaginatedSentEmails,
  PipelineQueueStatus,
  PipelineLogs,
  QuotaSnapshot,
  SentEmailDetail,
} from './types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ??
  'http://localhost:3001/api';

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text) as { message?: string | string[] };
      if (json.message) {
        message = Array.isArray(json.message)
          ? json.message.join(', ')
          : json.message;
      }
    } catch {
      // keep raw text
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  getSummary: () => request<AnalyticsSummary>('/analytics/summary'),
  getQuota: () => request<QuotaSnapshot>('/analytics/quota'),
  syncGmailReplies: (limit = 30) =>
    request<{ processed: number; matched: number; configured?: boolean }>(
      '/analytics/sync-gmail-replies',
      {
        method: 'POST',
        body: JSON.stringify({ limit }),
      },
    ),
  syncBrevoEvents: (params?: {
    days?: number;
    startDate?: string;
    endDate?: string;
    outreachEmailId?: string;
    leadId?: string;
    limit?: number;
  }) =>
    request<{
      configured: boolean;
      fetched?: number;
      processed?: number;
      created?: number;
      skipped?: number;
      startDate?: string;
      endDate?: string;
      message?: string;
      error?: string;
    }>('/analytics/sync-brevo-events', {
      method: 'POST',
      body: JSON.stringify(params ?? {}),
    }),

  listSentEmails: (params: {
    page?: number;
    pageSize?: number;
    leadStatus?: string;
    hasReply?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    if (params.leadStatus) q.set('leadStatus', params.leadStatus);
    if (params.hasReply) q.set('hasReply', 'true');
    return request<PaginatedSentEmails>(`/analytics/sent-emails?${q}`);
  },

  getSentEmailDetail: (id: string) =>
    request<SentEmailDetail>(`/analytics/sent-emails/${id}`),

  getPipelineStatus: () =>
    request<PipelineQueueStatus>('/pipeline/queue/status'),
  getPipelineLogs: (limit = 50) =>
    request<PipelineLogs>(`/pipeline/logs?limit=${limit}`),
  enqueueLead: (leadId: string) =>
    request<{ mode: string; action?: string }>(
      `/pipeline/queue/enqueue/${leadId}`,
      { method: 'POST', body: '{}' },
    ),
  retryFailed: (limit = 25) =>
    request<{ scanned: number; requeued: number }>(`/pipeline/retry-failed?limit=${limit}`, {
      method: 'POST',
      body: '{}',
    }),
  retryPending: (limit = 50) =>
    request<{ scanned: number; requeued: number; alreadyInQueue: number }>(
      `/pipeline/retry-pending?limit=${limit}`,
      { method: 'POST', body: '{}' },
    ),

  listLeads: (params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') q.set(k, String(v));
    }
    return request<PaginatedLeads>(`/leads?${q}`);
  },
  getLead: (id: string) => request<Lead>(`/leads/${id}`),
  getLeadEmails: (id: string) =>
    request<OutreachEmail[]>(`/leads/${id}/emails`),
  getLeadTimeline: (id: string) =>
    request<LeadTimeline>(`/analytics/leads/${id}/timeline`),

  startSearch: (body: {
    query: string;
    role?: string;
    roles?: string[];
    expandTechRoles?: boolean;
    location?: string;
    company?: string;
    limit?: number;
  }) =>
    request<LeadSearchJob>('/leads/search', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getSearchJob: (jobId: string) =>
    request<LeadSearchJob>(`/leads/search/${jobId}`),

  listCompanies: (page = 1, pageSize = 20) =>
    request<PaginatedCompanies>(
      `/companies?page=${page}&pageSize=${pageSize}`,
    ),
  getCompany: (id: string) => request<CompanyDetail>(`/companies/${id}`),

  enrichLead: (id: string) =>
    request(`/leads/${id}/enrich`, { method: 'POST', body: '{}' }),
  generateEmail: (id: string, regenerate = false) =>
    request<GenerateEmailResult>(`/leads/${id}/generate-email`, {
      method: 'POST',
      body: JSON.stringify({ regenerate }),
    }),
  verifyLead: (id: string) =>
    request(`/leads/${id}/verify`, { method: 'POST', body: '{}' }),
  sendLead: (id: string, force = false) =>
    request(`/leads/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),

  getSettingsStatus: () =>
    request<{ resetEnabled: boolean; redisConfigured: boolean }>(
      '/settings/status',
    ),
  resetDatabase: () =>
    request<{
      success: boolean;
      deleted: Record<string, number>;
    }>('/settings/reset-database', { method: 'POST', body: '{}' }),
  resetRedis: () =>
    request<{ success: boolean; message: string }>('/settings/reset-redis', {
      method: 'POST',
      body: '{}',
    }),
};

export { ApiError, API_BASE };
