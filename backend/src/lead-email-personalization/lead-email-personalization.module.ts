import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LEAD_EMAIL_PERSONALIZATION_QUEUE } from './constants';
import { LeadEmailPersonalizationController } from './lead-email-personalization.controller';
import { LeadEmailPersonalizationProcessor } from './lead-email-personalization.processor';
import { LeadEmailPersonalizationService } from './lead-email-personalization.service';
import { GrokEmailGenerator } from './providers/grok-email.generator';
import { GroqEmailGenerator } from './providers/groq-email.generator';
import { OpenRouterEmailGenerator } from './providers/openrouter-email.generator';
import { ParallelEmailGenerationService } from './services/parallel-email-generation.service';

@Module({})
export class LeadEmailPersonalizationModule {
  static register(): DynamicModule {
    const useQueue =
      (process.env.LEAD_EMAIL_PERSONALIZATION_SYNC ?? 'true') !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadEmailPersonalizationModule,
      imports: useQueue
        ? [BullModule.registerQueue({ name: LEAD_EMAIL_PERSONALIZATION_QUEUE })]
        : [],
      controllers: [LeadEmailPersonalizationController],
      providers: [
        LeadEmailPersonalizationService,
        ParallelEmailGenerationService,
        GrokEmailGenerator,
        GroqEmailGenerator,
        OpenRouterEmailGenerator,
        ...(useQueue ? [LeadEmailPersonalizationProcessor] : []),
      ],
      exports: [LeadEmailPersonalizationService],
    };
  }
}
