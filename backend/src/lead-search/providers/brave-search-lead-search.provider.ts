import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredLead,
  LeadSearchCriteria,
  LeadSearchProvider,
} from '../interfaces/lead-search-provider.interface';
import { buildDiscoveryQuery } from '../utils/search-query.builder';
import { mapSearchHitsToLeads } from '../utils/search-results.parser';

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

@Injectable()
export class BraveSearchLeadSearchProvider implements LeadSearchProvider {
  private readonly logger = new Logger(BraveSearchLeadSearchProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async search(criteria: LeadSearchCriteria): Promise<DiscoveredLead[]> {
    const apiKey = this.configService.getOrThrow<string>('BRAVE_SEARCH_API_KEY');
    const query = buildDiscoveryQuery(criteria);
    const leads: DiscoveredLead[] = [];
    const seen = new Set<string>();
    let offset = 0;

    while (leads.length < criteria.limit && offset <= 20) {
      const url = new URL('https://api.search.brave.com/res/v1/web/search');
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(Math.min(20, criteria.limit - leads.length)));
      url.searchParams.set('offset', String(offset));

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
      });

      const body = await response.text();

      if (!response.ok) {
        throw new Error(
          `Brave Search failed (${response.status}): ${body.slice(0, 300)}`,
        );
      }

      const data = JSON.parse(body) as BraveSearchResponse;
      const pageLeads = mapSearchHitsToLeads(
        (data.web?.results ?? []).map((item) => ({
          title: item.title ?? '',
          href: item.url ?? '',
          snippet: item.description ?? '',
        })),
      );

      if (pageLeads.length === 0) {
        break;
      }

      for (const lead of pageLeads) {
        if (seen.has(lead.profileUrl)) {
          continue;
        }

        seen.add(lead.profileUrl);
        leads.push(lead);

        if (leads.length >= criteria.limit) {
          break;
        }
      }

      offset += 20;
    }

    this.logger.log(
      `Discovered ${leads.length} leads via Brave Search for "${criteria.query}"`,
    );

    return leads.slice(0, criteria.limit);
  }
}
