import { DynamicModule, Module } from '@nestjs/common';
import { LeadCampaignSendingModule } from '../lead-campaign-sending/lead-campaign-sending.module';
import { LeadAnalyticsModule } from '../lead-analytics/lead-analytics.module';
import { BullModule } from '@nestjs/bullmq';
import { LEAD_EMAIL_PERSONALIZATION_QUEUE } from './constants';
import { LeadEmailPersonalizationController } from './lead-email-personalization.controller';
import { LeadEmailPersonalizationProcessor } from './lead-email-personalization.processor';
import { LeadEmailPersonalizationService } from './lead-email-personalization.service';
import { GroqEmailGenerator } from './providers/groq-email.generator';
import { OpenRouterEmailGenerator } from './providers/openrouter-email.generator';
import { SplitEmailGenerationService } from './services/split-email-generation.service';

@Module({})
export class LeadEmailPersonalizationModule {
  static register(): DynamicModule {
    const useQueue =
      (process.env.LEAD_EMAIL_PERSONALIZATION_SYNC ?? 'true') !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadEmailPersonalizationModule,
      imports: [
        LeadCampaignSendingModule.register(),
        LeadAnalyticsModule,
        ...(useQueue
          ? [BullModule.registerQueue({ name: LEAD_EMAIL_PERSONALIZATION_QUEUE })]
          : []),
      ],
      controllers: [LeadEmailPersonalizationController],
      providers: [
        LeadEmailPersonalizationService,
        SplitEmailGenerationService,
        GroqEmailGenerator,
        OpenRouterEmailGenerator,
        ...(useQueue ? [LeadEmailPersonalizationProcessor] : []),
      ],
      exports: [LeadEmailPersonalizationService],
    };
  }
}
