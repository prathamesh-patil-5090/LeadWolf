import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  bullRootImports,
  LeadSearchModule,
} from './lead-search/lead-search.module';
import { LeadEnrichmentModule } from './lead-enrichment/lead-enrichment.module';
import { LeadCompanyDiscoveryModule } from './lead-company-discovery/lead-company-discovery.module';
import { LeadContactDiscoveryModule } from './lead-contact-discovery/lead-contact-discovery.module';
import { LeadContactVerificationModule } from './lead-contact-verification/lead-contact-verification.module';
import { LeadEmailPersonalizationModule } from './lead-email-personalization/lead-email-personalization.module';
import { LeadCampaignSendingModule } from './lead-campaign-sending/lead-campaign-sending.module';
import { LeadAnalyticsModule } from './lead-analytics/lead-analytics.module';
import { LeadPipelineModule } from './lead-pipeline/lead-pipeline.module';
import { SettingsModule } from './settings/settings.module';
import { BrightDataModule } from './shared/bright-data/bright-data.module';
import { RateLimitModule } from './shared/rate-limit/rate-limit.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RateLimitModule,
    BrightDataModule,
    ...bullRootImports(),
    PrismaModule,
    LeadPipelineModule.register(),
    LeadSearchModule.register(),
    LeadEnrichmentModule.register(),
    LeadCompanyDiscoveryModule.register(),
    LeadContactDiscoveryModule.register(),
    LeadContactVerificationModule.register(),
    LeadEmailPersonalizationModule.register(),
    LeadCampaignSendingModule.register(),
    LeadAnalyticsModule,
    SettingsModule,
  ],
})
export class AppModule {}
