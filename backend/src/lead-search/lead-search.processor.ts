import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LEAD_SEARCH_QUEUE } from './constants';
import { LeadSearchService } from './lead-search.service';

interface LeadSearchJobPayload {
  jobId: string;
}

@Processor(LEAD_SEARCH_QUEUE)
export class LeadSearchProcessor extends WorkerHost {
  constructor(private readonly leadSearchService: LeadSearchService) {
    super();
  }

  async process(job: Job<LeadSearchJobPayload>) {
    await this.leadSearchService.executeSearch(job.data.jobId);
  }
}
