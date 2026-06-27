import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LEAD_CONTACT_VERIFICATION_QUEUE } from './constants';
import { LeadContactVerificationService } from './lead-contact-verification.service';

interface ContactVerificationJobPayload {
  leadId: string;
}

@Processor(LEAD_CONTACT_VERIFICATION_QUEUE)
export class LeadContactVerificationProcessor extends WorkerHost {
  constructor(
    private readonly verificationService: LeadContactVerificationService,
  ) {
    super();
  }

  async process(job: Job<ContactVerificationJobPayload>) {
    await this.verificationService.verifyByLeadId(job.data.leadId);
  }
}
