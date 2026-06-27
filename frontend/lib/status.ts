import type { LeadStatus } from './types';

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'New',
  ENRICHED: 'Enriched',
  DOMAIN_FOUND: 'Domain found',
  CONTACT_FOUND: 'Contact found',
  VERIFIED: 'Verified',
  EMAIL_GENERATED: 'Email ready',
  SENT: 'Sent',
  OPENED: 'Opened',
  REPLIED: 'Replied',
  BOUNCED: 'Bounced',
  FAILED_ENRICHMENT: 'Failed: enrich',
  FAILED_COMPANY_DISCOVERY: 'Failed: company',
  FAILED_CONTACT_DISCOVERY: 'Failed: contacts',
  FAILED_VERIFICATION: 'Failed: verify',
  FAILED_EMAIL_GENERATION: 'Failed: email',
  FAILED_CAMPAIGN_SENDING: 'Failed: send',
};

export function isFailedStatus(status: LeadStatus) {
  return status.startsWith('FAILED_');
}

export function statusVariant(
  status: LeadStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (isFailedStatus(status)) return 'destructive';
  if (status === 'REPLIED') return 'default';
  if (status === 'SENT' || status === 'OPENED') return 'secondary';
  if (status === 'VERIFIED' || status === 'EMAIL_GENERATED') return 'outline';
  return 'secondary';
}
