import { Injectable, Logger } from '@nestjs/common';
import { BrowserContext } from 'playwright';
import { BrowserService } from '../browser/browser.service';
import {
  DiscoveredLead,
  LeadSearchCriteria,
  LeadSearchProvider,
  wrapSearchResult,
} from '../interfaces/lead-search-provider.interface';
import { buildDiscoveryQuery } from '../utils/search-query.builder';
import {
  extractDuckDuckGoHits,
  mapSearchHitsToLeads,
} from '../utils/search-results.parser';

@Injectable()
export class PlaywrightLeadSearchProvider implements LeadSearchProvider {
  private readonly logger = new Logger(PlaywrightLeadSearchProvider.name);
  private static readonly RESULTS_PER_PAGE = 10;
  private static readonly MAX_PAGES = 5;

  constructor(private readonly browserService: BrowserService) {}

  async search(criteria: LeadSearchCriteria) {
    const query = buildDiscoveryQuery(criteria);
    const browser = await this.browserService.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    try {
      const leads: DiscoveredLead[] = [];
      const seenUrls = new Set<string>();
      let offset = 0;

      while (
        leads.length < criteria.limit &&
        offset / PlaywrightLeadSearchProvider.RESULTS_PER_PAGE <
          PlaywrightLeadSearchProvider.MAX_PAGES
      ) {
        const pageLeads = await this.scrapeResultsPage(context, query, offset);

        for (const lead of pageLeads) {
          if (seenUrls.has(lead.profileUrl)) {
            continue;
          }

          seenUrls.add(lead.profileUrl);
          leads.push(lead);

          if (leads.length >= criteria.limit) {
            break;
          }
        }

        if (pageLeads.length === 0) {
          break;
        }

        offset += PlaywrightLeadSearchProvider.RESULTS_PER_PAGE;
      }

      if (leads.length === 0) {
        throw new Error(
          'No leads discovered via Playwright. Configure GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX for reliable discovery.',
        );
      }

      this.logger.log(
        `Discovered ${leads.length} leads for query "${criteria.query}"`,
      );

      return wrapSearchResult(leads, criteria);
    } finally {
      await context.close();
    }
  }

  private async scrapeResultsPage(
    context: BrowserContext,
    query: string,
    offset: number,
  ): Promise<DiscoveredLead[]> {
    const body = new URLSearchParams({ q: query });
    if (offset > 0) {
      body.set('s', String(offset));
    }

    const response = await context.request.post(
      'https://html.duckduckgo.com/html/',
      {
        form: Object.fromEntries(body.entries()),
        timeout: 30_000,
      },
    );

    const html = await response.text();
    const hits = extractDuckDuckGoHits(html);

    return mapSearchHitsToLeads(hits);
  }
}
