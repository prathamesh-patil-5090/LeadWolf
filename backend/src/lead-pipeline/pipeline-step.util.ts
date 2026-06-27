import { Lead, LeadStatus, PipelineStep } from '../../generated/prisma/client';
import {
  PIPELINE_RESUME_STATUS,
  PIPELINE_STEP_ORDER,
} from './constants';

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
