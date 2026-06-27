export type LeadStatus =
  | 'NEW'
  | 'ENRICHED'
  | 'DOMAIN_FOUND'
  | 'CONTACT_FOUND'
  | 'VERIFIED'
  | 'EMAIL_GENERATED'
  | 'SENT'
  | 'OPENED'
  | 'REPLIED'
  | 'BOUNCED'
  | 'FAILED_ENRICHMENT'
  | 'FAILED_COMPANY_DISCOVERY'
  | 'FAILED_CONTACT_DISCOVERY'
  | 'FAILED_VERIFICATION'
  | 'FAILED_EMAIL_GENERATION'
  | 'FAILED_CAMPAIGN_SENDING';

export type LeadSearchJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type PipelineStep =
  | 'ENRICHMENT'
  | 'COMPANY_DISCOVERY'
  | 'CONTACT_DISCOVERY'
  | 'VERIFICATION'
  | 'EMAIL_GENERATION'
  | 'CAMPAIGN_SENDING'
  | 'GMAIL_SYNC';

export interface Lead {
  id: string;
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  location?: string | null;
  website?: string | null;
  portfolioUrl?: string | null;
  companyWebsite?: string | null;
  companySize?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  email?: string | null;
  emailSource?: string | null;
  verified: boolean;
  contactConfidence?: number | null;
  status: LeadStatus;
  pipelineFailedStep?: PipelineStep | null;
  pipelineError?: string | null;
  pipelineFailedAt?: string | null;
  companyId?: string | null;
  searchJobId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedLeads {
  items: Lead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LeadSearchJob {
  id: string;
  query: string;
  role?: string | null;
  roles?: string[];
  expandTechRoles?: boolean;
  location?: string | null;
  company?: string | null;
  limit: number;
  status: LeadSearchJobStatus;
  leadsFound: number;
  newLeadsFound: number;
  skippedExisting: number;
  error?: string | null;
  leads?: Lead[];
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  website?: string | null;
  summary?: string | null;
  industry?: string | null;
  products?: string | null;
  scrapedContent?: string | null;
  personalizationHooks?: string[] | null;
  discoveredEmails?: DiscoveredCompanyEmail[] | null;
  discoveredAt?: string | null;
  summarizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredCompanyEmail {
  email: string;
  source: string;
  page?: string;
}

export interface CompanyDetail extends Company {
  leads?: Array<{ id: string; name: string; role: string }>;
}

export interface PaginatedCompanies {
  items: Company[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface OutreachEmail {
  id: string;
  leadId: string;
  provider: string;
  model: string;
  subject: string;
  body: string;
  isPrimary: boolean;
  latencyMs?: number | null;
  error?: string | null;
  sentAt?: string | null;
  sentTo?: string | null;
  createdAt: string;
}

export interface GenerateEmailResult {
  lead: Lead;
  skipped?: boolean;
  reason?: string;
  emails?: OutreachEmail[];
  providers?: Array<{
    provider: string;
    model: string;
    success: boolean;
    latencyMs?: number;
    error?: string | null;
  }>;
}

export interface AnalyticsSummary {
  leads: {
    total: number;
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
  };
  emails: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
  rates: {
    openRate: number;
    replyRate: number;
    bounceRate: number;
  };
}

export interface QuotaSnapshot {
  groq: { dailyUsed: number; dailyRemaining: number | null };
  openRouter: { dailyUsed: number; dailyRemaining: number | null };
  brevo: { dailyUsed: number; dailyRemaining: number | null };
}

export interface PipelineQueueStatus {
  enabled: boolean;
  isEmpty: boolean;
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  failedJobIds?: string[];
}

export interface PipelineLogEntry {
  leadId: string;
  leadName: string;
  company: string;
  email: string | null;
  status: LeadStatus;
  source: 'queue' | 'database';
  queueState?: string;
  jobId?: string;
  resumeFromStep?: PipelineStep;
  failedStep?: PipelineStep | null;
  error?: string | null;
  failedAt?: string | null;
  retryCount: number;
  updatedAt: string;
  completedSteps: PipelineStep[];
  nextStep: PipelineStep | null;
  attemptsMade?: number;
  processedAt?: string | null;
  finishedAt?: string | null;
}

export interface PipelineLogs {
  queue: PipelineQueueStatus;
  stepLabels: Record<PipelineStep, string>;
  pending: PipelineLogEntry[];
  failed: PipelineLogEntry[];
  completed: PipelineLogEntry[];
}

export interface EmailEvent {
  id: string;
  eventType: string;
  source: string;
  occurredAt: string;
  recipientEmail?: string | null;
}

export interface LeadTimeline {
  lead: Lead & { outreachEmails?: OutreachEmail[] };
  events: EmailEvent[];
}

export interface EmailEngagement {
  sent: boolean;
  delivered: boolean;
  opened: boolean;
  clicked: boolean;
  replied: boolean;
  bounced: boolean;
  spam: boolean;
  gmailReplyDetected: boolean;
  brevoReplyDetected: boolean;
  lastEventAt: string | null;
}

export interface SentEmailRow extends OutreachEmail {
  brevoMessageId?: string | null;
  sendError?: string | null;
  lead: {
    id: string;
    name: string;
    role: string;
    company: string;
    email: string | null;
    status: LeadStatus;
    verified: boolean;
  };
  emailEvents: EmailEvent[];
  engagement: EmailEngagement;
}

export interface PaginatedSentEmails {
  items: SentEmailRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SentEmailDetail {
  outreachEmail: SentEmailRow & {
    body: string;
    lead: SentEmailRow['lead'] & {
      contactConfidence?: number | null;
      profileUrl: string;
      githubUrl?: string | null;
      linkedinUrl?: string | null;
      pipelineFailedStep?: PipelineStep | null;
      pipelineError?: string | null;
    };
    emailEvents: (EmailEvent & { payload?: unknown })[];
  };
  engagement: EmailEngagement;
}
