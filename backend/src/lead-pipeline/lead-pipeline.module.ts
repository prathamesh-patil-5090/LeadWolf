import { Module } from '@nestjs/common';
import { LeadCompanyDiscoveryModule } from '../lead-company-discovery/lead-company-discovery.module';
import { LeadContactDiscoveryModule } from '../lead-contact-discovery/lead-contact-discovery.module';
import { LeadEnrichmentModule } from '../lead-enrichment/lead-enrichment.module';
import { LeadPipelineService } from './lead-pipeline.service';

@Module({
  imports: [
    LeadEnrichmentModule.register(),
    LeadCompanyDiscoveryModule.register(),
    LeadContactDiscoveryModule.register(),
  ],
  providers: [LeadPipelineService],
  exports: [LeadPipelineService],
})
export class LeadPipelineModule {}
