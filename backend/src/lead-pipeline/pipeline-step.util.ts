import { Lead, LeadStatus, PipelineStep } from '../../generated/prisma/client';
import {
  PIPELINE_FAILED_STATUSES,
  PIPELINE_RESUME_STATUS,
  PIPELINE_STEP_ORDER,
} from './constants';

export const PIPELINE_STEP_LABELS: Record<PipelineStep, string> = {
  [PipelineStep.ENRICHMENT]: 'Enrichment',
  [PipelineStep.COMPANY_DISCOVERY]: 'Company discovery',
  [PipelineStep.CONTACT_DISCOVERY]: 'Contact discovery',
  [PipelineStep.VERIFICATION]: 'Verification',
  [PipelineStep.EMAIL_GENERATION]: 'Email generation',
  [PipelineStep.CAMPAIGN_SENDING]: 'Send campaign',
  [PipelineStep.GMAIL_SYNC]: 'Gmail sync',
};

const IN_PROGRESS_STATUSES: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.ENRICHED,
  LeadStatus.DOMAIN_FOUND,
  LeadStatus.CONTACT_FOUND,
  LeadStatus.VERIFIED,
  LeadStatus.EMAIL_GENERATED,
];

const COMPLETED_STATUSES: LeadStatus[] = [
  LeadStatus.SENT,
  LeadStatus.OPENED,
  LeadStatus.REPLIED,
  LeadStatus.BOUNCED,
];

export function isPipelineInProgressStatus(status: LeadStatus) {
  return IN_PROGRESS_STATUSES.includes(status);
}

export function isPipelineCompletedStatus(status: LeadStatus) {
  return COMPLETED_STATUSES.includes(status);
}

export function isPipelineFailedStatus(status: LeadStatus) {
  return PIPELINE_FAILED_STATUSES.includes(status);
}

export function pipelineProgressForLead(
  lead: Pick<Lead, 'status' | 'pipelineFailedStep'>,
): { completedSteps: PipelineStep[]; nextStep: PipelineStep | null } {
  if (isPipelineFailedStatus(lead.status) && lead.pipelineFailedStep) {
    const failedIndex = PIPELINE_STEP_ORDER.indexOf(lead.pipelineFailedStep);
    return {
      completedSteps:
        failedIndex > 0 ? PIPELINE_STEP_ORDER.slice(0, failedIndex) : [],
      nextStep: lead.pipelineFailedStep,
    };
  }

  if (lead.status === LeadStatus.REPLIED || lead.status === LeadStatus.BOUNCED) {
    return { completedSteps: [...PIPELINE_STEP_ORDER], nextStep: null };
  }

  if (lead.status === LeadStatus.SENT || lead.status === LeadStatus.OPENED) {
    const gmailIndex = PIPELINE_STEP_ORDER.indexOf(PipelineStep.GMAIL_SYNC);
    return {
      completedSteps: PIPELINE_STEP_ORDER.slice(0, gmailIndex),
      nextStep: PipelineStep.GMAIL_SYNC,
    };
  }

  const nextStep = PIPELINE_RESUME_STATUS[lead.status] ?? null;
  if (!nextStep) {
    return { completedSteps: [], nextStep: null };
  }

  const nextIndex = PIPELINE_STEP_ORDER.indexOf(nextStep);
  return {
    completedSteps:
      nextIndex > 0 ? PIPELINE_STEP_ORDER.slice(0, nextIndex) : [],
    nextStep,
  };
}

export function resolvePipelineStartStep(
  lead: Pick<Lead, 'status'>,
  resumeFromStep?: PipelineStep,
): PipelineStep | null {
  if (resumeFromStep) {
    return resumeFromStep;
  }

  if (lead.status === LeadStatus.REPLIED || lead.status === LeadStatus.BOUNCED) {
    return null;
  }

  if (lead.status === LeadStatus.SENT || lead.status === LeadStatus.OPENED) {
    return PipelineStep.GMAIL_SYNC;
  }

  return PIPELINE_RESUME_STATUS[lead.status] ?? PipelineStep.ENRICHMENT;
}

export function shouldRunPipelineStep(
  step: PipelineStep,
  startStep: PipelineStep,
): boolean {
  const startIndex = PIPELINE_STEP_ORDER.indexOf(startStep);
  const stepIndex = PIPELINE_STEP_ORDER.indexOf(step);
  return stepIndex >= startIndex;
}
