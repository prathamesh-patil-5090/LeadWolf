import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BrightDataModule } from '../shared/bright-data/bright-data.module';
import { BrightDataService } from '../shared/bright-data/bright-data.service';
import { BrowserService } from './browser/browser.service';
import { LEAD_SEARCH_PROVIDER, LEAD_SEARCH_QUEUE } from './constants';
import { LeadSearchController } from './lead-search.controller';
import { LeadSearchProcessor } from './lead-search.processor';
import { LeadSearchService } from './lead-search.service';
import { BrightDataLinkedInLeadSearchProvider } from './providers/bright-data-linkedin-lead-search.provider';
import { CombinedLeadSearchProvider } from './providers/combined-lead-search.provider';
import { GithubLeadSearchProvider } from './providers/github-lead-search.provider';
import { createLeadSearchProvider } from './providers/lead-search-provider.factory';
import { LinkedInUrlDiscoveryService } from './services/linkedin-url-discovery.service';

@Module({})
export class LeadSearchModule {
  static register(): DynamicModule {
    const useQueue =
      process.env.LEAD_SEARCH_SYNC !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadSearchModule,
      imports: [
        BrightDataModule,
        ...(useQueue
          ? [BullModule.registerQueue({ name: LEAD_SEARCH_QUEUE })]
          : []),
      ],
      controllers: [LeadSearchController],
      providers: [
        LeadSearchService,
        BrowserService,
        GithubLeadSearchProvider,
        LinkedInUrlDiscoveryService,
        BrightDataLinkedInLeadSearchProvider,
        CombinedLeadSearchProvider,
        ...(useQueue ? [LeadSearchProcessor] : []),
        {
          provide: LEAD_SEARCH_PROVIDER,
          inject: [
            ConfigService,
            BrowserService,
            BrightDataService,
            CombinedLeadSearchProvider,
            LinkedInUrlDiscoveryService,
            BrightDataLinkedInLeadSearchProvider,
          ],
          useFactory: createLeadSearchProvider,
        },
      ],
      exports: [LeadSearchService],
    };
  }
}

export function bullRootImports() {
  const searchUseQueue =
    process.env.LEAD_SEARCH_SYNC !== 'true' &&
    Boolean(process.env.REDIS_URL);
  const enrichmentUseQueue =
    (process.env.LEAD_ENRICHMENT_SYNC ?? 'true') !== 'true' &&
    Boolean(process.env.REDIS_URL);
  const companyDiscoveryUseQueue =
    (process.env.LEAD_COMPANY_DISCOVERY_SYNC ?? 'true') !== 'true' &&
    Boolean(process.env.REDIS_URL);
  const contactDiscoveryUseQueue =
    (process.env.LEAD_CONTACT_DISCOVERY_SYNC ?? 'true') !== 'true' &&
    Boolean(process.env.REDIS_URL);
  const contactVerificationUseQueue =
    (process.env.LEAD_CONTACT_VERIFICATION_SYNC ?? 'true') !== 'true' &&
    Boolean(process.env.REDIS_URL);
  const emailPersonalizationUseQueue =
    (process.env.LEAD_EMAIL_PERSONALIZATION_SYNC ?? 'true') !== 'true' &&
    Boolean(process.env.REDIS_URL);
  const campaignSendingUseQueue =
    (process.env.LEAD_CAMPAIGN_SENDING_SYNC ?? 'true') !== 'true' &&
    Boolean(process.env.REDIS_URL);
  const pipelineUseQueue =
    process.env.LEAD_PIPELINE_SYNC !== 'true' && Boolean(process.env.REDIS_URL);
  const useQueue =
    searchUseQueue ||
    enrichmentUseQueue ||
    companyDiscoveryUseQueue ||
    contactDiscoveryUseQueue ||
    contactVerificationUseQueue ||
    emailPersonalizationUseQueue ||
    campaignSendingUseQueue ||
    pipelineUseQueue;

  if (!useQueue) {
    return [];
  }

  return [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
  ];
}
