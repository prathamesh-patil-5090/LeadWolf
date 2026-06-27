import { Module } from '@nestjs/common';
import { LeadCompanyDiscoveryModule } from '../lead-company-discovery/lead-company-discovery.module';
import { LeadContactDiscoveryModule } from '../lead-contact-discovery/lead-contact-discovery.module';
import { LeadContactVerificationModule } from '../lead-contact-verification/lead-contact-verification.module';
import { LeadEmailPersonalizationModule } from '../lead-email-personalization/lead-email-personalization.module';
import { LeadEnrichmentModule } from '../lead-enrichment/lead-enrichment.module';
import { LeadPipelineService } from './lead-pipeline.service';

@Module({
  imports: [
    LeadEnrichmentModule.register(),
    LeadCompanyDiscoveryModule.register(),
    LeadContactDiscoveryModule.register(),
    LeadContactVerificationModule.register(),
    LeadEmailPersonalizationModule.register(),
  ],
  providers: [LeadPipelineService],
  exports: [LeadPipelineService],
})
export class LeadPipelineModule {}
