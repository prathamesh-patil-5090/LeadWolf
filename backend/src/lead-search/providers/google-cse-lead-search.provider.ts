import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredLead,
  LeadSearchCriteria,
  LeadSearchProvider,
  wrapSearchResult,
} from '../interfaces/lead-search-provider.interface';
import { buildCseDiscoveryQuery } from '../utils/search-query.builder';
import { mapSearchHitsToLeads } from '../utils/search-results.parser';

interface GoogleCseErrorResponse {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GoogleCseItem {
  title?: string;
  link?: string;
  snippet?: string;
}

interface GoogleCseResponse {
  items?: GoogleCseItem[];
}

@Injectable()
export class GoogleCseLeadSearchProvider implements LeadSearchProvider {
  private readonly logger = new Logger(GoogleCseLeadSearchProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async search(criteria: LeadSearchCriteria) {
    const apiKey = this.configService.getOrThrow<string>('GOOGLE_CSE_API_KEY');
    const cx = this.configService.getOrThrow<string>('GOOGLE_CSE_CX');
    const query = buildCseDiscoveryQuery(criteria);
    const leads: DiscoveredLead[] = [];
    const seen = new Set<string>();
    let start = 1;

    while (leads.length < criteria.limit && start <= 91) {
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', apiKey);
      url.searchParams.set('cx', cx);
      url.searchParams.set('q', query);
      url.searchParams.set(
        'num',
        String(Math.min(10, criteria.limit - leads.length)),
      );
      url.searchParams.set('start', String(start));

      const response = await fetch(url);
      const body = await response.text();

      if (!response.ok) {
        throw new Error(this.formatApiError(response.status, body));
      }

      const data = JSON.parse(body) as GoogleCseResponse;
      const pageLeads = mapSearchHitsToLeads(
        (data.items ?? []).map((item) => ({
          title: item.title ?? '',
          href: item.link ?? '',
          snippet: item.snippet ?? '',
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

      start += 10;
    }

    this.logger.log(
      `Discovered ${leads.length} leads via Google CSE for "${criteria.query}"`,
    );

    return wrapSearchResult(leads, criteria);
  }

  private formatApiError(status: number, body: string): string {
    try {
      const parsed = JSON.parse(body) as GoogleCseErrorResponse;
      const message = parsed.error?.message;

      if (status === 403 && message?.includes('Custom Search JSON API')) {
        return 'Google Custom Search JSON API is not available for new Google Cloud projects (closed to new customers since Jan 2026). Use LangSearch instead: set LANGSEARCH_API_KEY. See https://programmablesearchengine.googleblog.com/2026/01/updates-to-our-web-search-products.html';
      }

      if (message) {
        return `Google Custom Search failed (${status}): ${message}`;
      }
    } catch {
      // fall through to raw body
    }

    return `Google Custom Search failed (${status}): ${body}`;
  }
}
