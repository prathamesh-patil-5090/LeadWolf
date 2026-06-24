import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import {
  bullRootImports,
  LeadSearchModule,
} from './lead-search/lead-search.module';
import { LeadEnrichmentModule } from './lead-enrichment/lead-enrichment.module';
import { LeadCompanyDiscoveryModule } from './lead-company-discovery/lead-company-discovery.module';
import { LeadContactDiscoveryModule } from './lead-contact-discovery/lead-contact-discovery.module';
import { LeadPipelineModule } from './lead-pipeline/lead-pipeline.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...bullRootImports(),
    PrismaModule,
    LeadSearchModule.register(),
    LeadEnrichmentModule.register(),
    LeadCompanyDiscoveryModule.register(),
    LeadContactDiscoveryModule.register(),
    LeadPipelineModule,
  ],
})
export class AppModule {}
