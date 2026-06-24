import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LEAD_ENRICHMENT_QUEUE } from './constants';
import { LeadEnrichmentService } from './lead-enrichment.service';

interface LeadEnrichmentJobPayload {
  leadId: string;
}

@Processor(LEAD_ENRICHMENT_QUEUE)
export class LeadEnrichmentProcessor extends WorkerHost {
  constructor(private readonly leadEnrichmentService: LeadEnrichmentService) {
    super();
  }

  async process(job: Job<LeadEnrichmentJobPayload>) {
    await this.leadEnrichmentService.enrichLeadById(job.data.leadId);
  }
}
