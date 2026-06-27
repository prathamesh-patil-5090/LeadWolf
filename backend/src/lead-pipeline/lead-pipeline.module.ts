import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LeadCampaignSendingModule } from '../lead-campaign-sending/lead-campaign-sending.module';
import { LeadCompanyDiscoveryModule } from '../lead-company-discovery/lead-company-discovery.module';
import { LeadContactDiscoveryModule } from '../lead-contact-discovery/lead-contact-discovery.module';
import { LeadContactVerificationModule } from '../lead-contact-verification/lead-contact-verification.module';
import { LeadEmailPersonalizationModule } from '../lead-email-personalization/lead-email-personalization.module';
import { LeadEnrichmentModule } from '../lead-enrichment/lead-enrichment.module';
import { LeadAnalyticsModule } from '../lead-analytics/lead-analytics.module';
import { LEAD_PIPELINE_QUEUE } from './constants';
import { LeadPipelineController } from './lead-pipeline.controller';
import { LeadPipelineProcessor } from './lead-pipeline.processor';
import { LeadPipelineQueueService } from './lead-pipeline-queue.service';
import { LeadPipelineService } from './lead-pipeline.service';

@Module({})
export class LeadPipelineModule {
  static register(): DynamicModule {
    const useQueue =
      Boolean(process.env.REDIS_URL) &&
      process.env.LEAD_PIPELINE_SYNC !== 'true';

    return {
      module: LeadPipelineModule,
      global: true,
      imports: [
        LeadAnalyticsModule,
        LeadEnrichmentModule.register(),
        LeadCompanyDiscoveryModule.register(),
        LeadContactDiscoveryModule.register(),
        LeadContactVerificationModule.register(),
        LeadEmailPersonalizationModule.register(),
        LeadCampaignSendingModule.register(),
        ...(useQueue
          ? [BullModule.registerQueue({ name: LEAD_PIPELINE_QUEUE })]
          : []),
      ],
      controllers: [LeadPipelineController],
      providers: [
        LeadPipelineService,
        LeadPipelineQueueService,
        ...(useQueue ? [LeadPipelineProcessor] : []),
      ],
      exports: [LeadPipelineService, LeadPipelineQueueService],
    };
  }
}
