import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BrevoEmailClient } from './brevo-email.client';
import { LEAD_CAMPAIGN_SENDING_QUEUE } from './constants';
import { LeadCampaignSendingController } from './lead-campaign-sending.controller';
import { LeadCampaignSendingProcessor } from './lead-campaign-sending.processor';
import { LeadCampaignSendingService } from './lead-campaign-sending.service';

@Module({})
export class LeadCampaignSendingModule {
  static register(): DynamicModule {
    const useQueue =
      (process.env.LEAD_CAMPAIGN_SENDING_SYNC ?? 'true') !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadCampaignSendingModule,
      imports: useQueue
        ? [BullModule.registerQueue({ name: LEAD_CAMPAIGN_SENDING_QUEUE })]
        : [],
      controllers: [LeadCampaignSendingController],
      providers: [
        LeadCampaignSendingService,
        BrevoEmailClient,
        ...(useQueue ? [LeadCampaignSendingProcessor] : []),
      ],
      exports: [LeadCampaignSendingService],
    };
  }
}
