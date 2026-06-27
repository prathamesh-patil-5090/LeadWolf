import { LeadStatus, PipelineStep } from '../../generated/prisma/client';

export const LEAD_PIPELINE_QUEUE = 'lead-pipeline';
export const LEAD_PIPELINE_AUTO = 'LEAD_PIPELINE_AUTO';
export const LEAD_PIPELINE_AUTO_SEND = 'LEAD_PIPELINE_AUTO_SEND';
export const LEAD_PIPELINE_AUTO_GMAIL_SYNC = 'LEAD_PIPELINE_AUTO_GMAIL_SYNC';
export const LEAD_PIPELINE_AUTO_RETRY = 'LEAD_PIPELINE_AUTO_RETRY';

export const PIPELINE_STEP_ORDER: PipelineStep[] = [
  PipelineStep.ENRICHMENT,
  PipelineStep.COMPANY_DISCOVERY,
  PipelineStep.CONTACT_DISCOVERY,
  PipelineStep.VERIFICATION,
  PipelineStep.EMAIL_GENERATION,
  PipelineStep.CAMPAIGN_SENDING,
  PipelineStep.GMAIL_SYNC,
];

export const PIPELINE_FAILED_STATUS: Record<PipelineStep, LeadStatus> = {
  [PipelineStep.ENRICHMENT]: LeadStatus.FAILED_ENRICHMENT,
  [PipelineStep.COMPANY_DISCOVERY]: LeadStatus.FAILED_COMPANY_DISCOVERY,
  [PipelineStep.CONTACT_DISCOVERY]: LeadStatus.FAILED_CONTACT_DISCOVERY,
  [PipelineStep.VERIFICATION]: LeadStatus.FAILED_VERIFICATION,
  [PipelineStep.EMAIL_GENERATION]: LeadStatus.FAILED_EMAIL_GENERATION,
  [PipelineStep.CAMPAIGN_SENDING]: LeadStatus.FAILED_CAMPAIGN_SENDING,
  [PipelineStep.GMAIL_SYNC]: LeadStatus.SENT,
};

export const PIPELINE_RESUME_STATUS: Partial<Record<LeadStatus, PipelineStep>> = {
  [LeadStatus.NEW]: PipelineStep.ENRICHMENT,
  [LeadStatus.FAILED_ENRICHMENT]: PipelineStep.ENRICHMENT,
  [LeadStatus.ENRICHED]: PipelineStep.COMPANY_DISCOVERY,
  [LeadStatus.DOMAIN_FOUND]: PipelineStep.CONTACT_DISCOVERY,
  [LeadStatus.FAILED_COMPANY_DISCOVERY]: PipelineStep.COMPANY_DISCOVERY,
  [LeadStatus.CONTACT_FOUND]: PipelineStep.VERIFICATION,
  [LeadStatus.FAILED_CONTACT_DISCOVERY]: PipelineStep.CONTACT_DISCOVERY,
  [LeadStatus.VERIFIED]: PipelineStep.EMAIL_GENERATION,
  [LeadStatus.FAILED_VERIFICATION]: PipelineStep.VERIFICATION,
  [LeadStatus.EMAIL_GENERATED]: PipelineStep.CAMPAIGN_SENDING,
  [LeadStatus.FAILED_EMAIL_GENERATION]: PipelineStep.EMAIL_GENERATION,
  [LeadStatus.FAILED_CAMPAIGN_SENDING]: PipelineStep.CAMPAIGN_SENDING,
  [LeadStatus.SENT]: PipelineStep.GMAIL_SYNC,
  [LeadStatus.OPENED]: PipelineStep.GMAIL_SYNC,
};

export const PIPELINE_FAILED_STATUSES: LeadStatus[] = [
  LeadStatus.FAILED_ENRICHMENT,
  LeadStatus.FAILED_COMPANY_DISCOVERY,
  LeadStatus.FAILED_CONTACT_DISCOVERY,
  LeadStatus.FAILED_VERIFICATION,
  LeadStatus.FAILED_EMAIL_GENERATION,
  LeadStatus.FAILED_CAMPAIGN_SENDING,
];
