import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LEAD_COMPANY_DISCOVERY_QUEUE } from './constants';
import { LeadCompanyDiscoveryController } from './lead-company-discovery.controller';
import { LeadCompanyDiscoveryProcessor } from './lead-company-discovery.processor';
import { LeadCompanyDiscoveryService } from './lead-company-discovery.service';
import { CompanyDomainResolver } from './services/company-domain.resolver';
import { CompanyWebsiteScraper } from './services/company-website.scraper';

@Module({})
export class LeadCompanyDiscoveryModule {
  static register(): DynamicModule {
    const useQueue =
      (process.env.LEAD_COMPANY_DISCOVERY_SYNC ?? 'true') !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadCompanyDiscoveryModule,
      imports: useQueue
        ? [BullModule.registerQueue({ name: LEAD_COMPANY_DISCOVERY_QUEUE })]
        : [],
      controllers: [LeadCompanyDiscoveryController],
      providers: [
        LeadCompanyDiscoveryService,
        CompanyDomainResolver,
        CompanyWebsiteScraper,
        ...(useQueue ? [LeadCompanyDiscoveryProcessor] : []),
      ],
      exports: [LeadCompanyDiscoveryService],
    };
  }
}
