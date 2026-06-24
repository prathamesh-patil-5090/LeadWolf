import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CompanyWebsiteScraper } from '../lead-company-discovery/services/company-website.scraper';
import { LEAD_CONTACT_DISCOVERY_QUEUE } from './constants';
import { CompanyContactDiscoverer } from './discoverers/company-contact.discoverer';
import { GithubContactDiscoverer } from './discoverers/github-contact.discoverer';
import { WebsiteContactDiscoverer } from './discoverers/website-contact.discoverer';
import { LeadContactDiscoveryController } from './lead-contact-discovery.controller';
import { LeadContactDiscoveryProcessor } from './lead-contact-discovery.processor';
import { LeadContactDiscoveryService } from './lead-contact-discovery.service';

@Module({})
export class LeadContactDiscoveryModule {
  static register(): DynamicModule {
    const useQueue =
      (process.env.LEAD_CONTACT_DISCOVERY_SYNC ?? 'true') !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadContactDiscoveryModule,
      imports: useQueue
        ? [BullModule.registerQueue({ name: LEAD_CONTACT_DISCOVERY_QUEUE })]
        : [],
      controllers: [LeadContactDiscoveryController],
      providers: [
        LeadContactDiscoveryService,
        GithubContactDiscoverer,
        WebsiteContactDiscoverer,
        CompanyContactDiscoverer,
        CompanyWebsiteScraper,
        ...(useQueue ? [LeadContactDiscoveryProcessor] : []),
      ],
      exports: [LeadContactDiscoveryService],
    };
  }
}
