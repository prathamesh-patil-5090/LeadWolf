import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LEAD_CAMPAIGN_SENDING_QUEUE } from './constants';
import { LeadCampaignSendingService } from './lead-campaign-sending.service';

interface CampaignSendJobPayload {
  leadId: string;
  force?: boolean;
}

@Processor(LEAD_CAMPAIGN_SENDING_QUEUE)
export class LeadCampaignSendingProcessor extends WorkerHost {
  constructor(
    private readonly campaignSendingService: LeadCampaignSendingService,
  ) {
    super();
  }

  async process(job: Job<CampaignSendJobPayload>) {
    await this.campaignSendingService.sendByLeadId(
      job.data.leadId,
      job.data.force ?? false,
    );
  }
}
