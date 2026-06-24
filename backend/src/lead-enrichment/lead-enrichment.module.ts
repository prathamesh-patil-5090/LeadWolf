import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LEAD_ENRICHMENT_QUEUE } from './constants';
import { CompanyDomainEnricher } from './enrichers/company-domain.enricher';
import { GithubProfileEnricher } from './enrichers/github-profile.enricher';
import { WebsiteEnricher } from './enrichers/website.enricher';
import { LeadEnrichmentController } from './lead-enrichment.controller';
import { LeadEnrichmentProcessor } from './lead-enrichment.processor';
import { LeadEnrichmentService } from './lead-enrichment.service';

@Module({})
export class LeadEnrichmentModule {
  static register(): DynamicModule {
    const useQueue =
      (process.env.LEAD_ENRICHMENT_SYNC ?? 'true') !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadEnrichmentModule,
      imports: useQueue
        ? [BullModule.registerQueue({ name: LEAD_ENRICHMENT_QUEUE })]
        : [],
      controllers: [LeadEnrichmentController],
      providers: [
        LeadEnrichmentService,
        GithubProfileEnricher,
        WebsiteEnricher,
        CompanyDomainEnricher,
        ...(useQueue ? [LeadEnrichmentProcessor] : []),
      ],
      exports: [LeadEnrichmentService],
    };
  }
}
