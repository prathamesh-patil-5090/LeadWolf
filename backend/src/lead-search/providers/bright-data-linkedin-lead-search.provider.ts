import { Injectable, Logger } from '@nestjs/common';
import {
  LeadSearchCriteria,
  LeadSearchProvider,
  wrapSearchResult,
} from '../interfaces/lead-search-provider.interface';
import { BrightDataService } from '../../shared/bright-data/bright-data.service';
import { LinkedInUrlDiscoveryService } from '../services/linkedin-url-discovery.service';
import { normalizeProfileUrl } from '../utils/linkedin-result.parser';

@Injectable()
export class BrightDataLinkedInLeadSearchProvider implements LeadSearchProvider {
  private readonly logger = new Logger(BrightDataLinkedInLeadSearchProvider.name);

  constructor(
    private readonly brightDataService: BrightDataService,
    private readonly linkedInUrlDiscovery: LinkedInUrlDiscoveryService,
  ) {}

  async search(criteria: LeadSearchCriteria) {
    const discoveryLimit = Math.min(Math.max(criteria.limit * 2, criteria.limit), 100);

    this.logger.log(
      `Discovering LinkedIn profile URLs, then scraping via Bright Data (limit=${criteria.limit})`,
    );

    const discoveredUrls = await this.linkedInUrlDiscovery.discoverProfileUrls({
      ...criteria,
      limit: discoveryLimit,
    });

    const seedUrls = (criteria.seedLinkedInUrls ?? [])
      .map((url) => normalizeProfileUrl(url))
      .filter((url): url is string => Boolean(url));

    const profileUrls = [...new Set([...discoveredUrls, ...seedUrls])]
      .filter((url) => !(criteria.excludeProfileUrls ?? []).includes(url))
      .slice(0, criteria.limit);

    if (profileUrls.length === 0) {
      throw new Error('No LinkedIn profile URLs found to scrape with Bright Data');
    }

    const leads = await this.brightDataService.collectLinkedInProfiles(profileUrls);

    this.logger.log(
      `Bright Data scraped ${leads.length} LinkedIn profile(s) from ${profileUrls.length} URL(s)`,
    );

    return wrapSearchResult(leads, criteria);
  }
}
