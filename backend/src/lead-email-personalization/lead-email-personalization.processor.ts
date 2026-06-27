import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LEAD_EMAIL_PERSONALIZATION_QUEUE } from './constants';
import { LeadEmailPersonalizationService } from './lead-email-personalization.service';

interface EmailPersonalizationJobPayload {
  leadId: string;
  regenerate?: boolean;
}

@Processor(LEAD_EMAIL_PERSONALIZATION_QUEUE)
export class LeadEmailPersonalizationProcessor extends WorkerHost {
  constructor(
    private readonly personalizationService: LeadEmailPersonalizationService,
  ) {
    super();
  }

  async process(job: Job<EmailPersonalizationJobPayload>) {
    await this.personalizationService.generateByLeadId(
      job.data.leadId,
      job.data.regenerate ?? false,
    );
  }
}
