import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LEAD_COMPANY_DISCOVERY_QUEUE } from './constants';
import { LeadCompanyDiscoveryService } from './lead-company-discovery.service';

interface CompanyDiscoveryJobPayload {
  leadId: string;
  resummarize?: boolean;
}

@Processor(LEAD_COMPANY_DISCOVERY_QUEUE)
export class LeadCompanyDiscoveryProcessor extends WorkerHost {
  constructor(
    private readonly companyDiscoveryService: LeadCompanyDiscoveryService,
  ) {
    super();
  }

  async process(job: Job<CompanyDiscoveryJobPayload>) {
    await this.companyDiscoveryService.discoverByLeadId(
      job.data.leadId,
      job.data.resummarize ?? false,
    );
  }
}
