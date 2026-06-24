import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LEAD_CONTACT_DISCOVERY_QUEUE } from './constants';
import { LeadContactDiscoveryService } from './lead-contact-discovery.service';

interface ContactDiscoveryJobPayload {
  leadId: string;
}

@Processor(LEAD_CONTACT_DISCOVERY_QUEUE)
export class LeadContactDiscoveryProcessor extends WorkerHost {
  constructor(
    private readonly contactDiscoveryService: LeadContactDiscoveryService,
  ) {
    super();
  }

  async process(job: Job<ContactDiscoveryJobPayload>) {
    await this.contactDiscoveryService.discoverByLeadId(job.data.leadId);
  }
}
