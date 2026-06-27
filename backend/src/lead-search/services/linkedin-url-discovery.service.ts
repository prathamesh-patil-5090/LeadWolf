import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrowserContext } from 'playwright';
import { BrowserService } from '../browser/browser.service';
import { LeadSearchCriteria } from '../interfaces/lead-search-provider.interface';
import { buildDiscoveryQuery, buildLangSearchQueryVariants } from '../utils/search-query.builder';
import {
  extractDuckDuckGoHits,
  mapSearchHitsToLeads,
} from '../utils/search-results.parser';
import { normalizeProfileUrl } from '../utils/linkedin-result.parser';

interface LangSearchWebPage {
  url?: string;
  name?: string;
  snippet?: string;
}

interface LangSearchResponse {
  code?: number | string;
  message?: string;
  msg?: string | null;
  data?: {
    webPages?: {
      value?: LangSearchWebPage[];
    };
  };
  webPages?: {
    value?: LangSearchWebPage[];
  };
}

const LANGSEARCH_API_URL = 'https://api.langsearch.com/v1/web-search';

@Injectable()
export class LinkedInUrlDiscoveryService {
  private readonly logger = new Logger(LinkedInUrlDiscoveryService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly browserService: BrowserService,
  ) {}

  async discoverProfileUrls(criteria: LeadSearchCriteria) {
    const siteQuery = buildDiscoveryQuery(criteria);
    const langSearchKey = this.configService.get<string>('LANGSEARCH_API_KEY');

    if (langSearchKey) {
      try {
        return await this.discoverViaLangSearch(criteria, langSearchKey);
      } catch (error) {
        this.logger.warn(
          `LangSearch LinkedIn URL discovery failed, trying next provider: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    try {
      return await this.discoverViaPlaywright(siteQuery, criteria.limit);
    } catch (error) {
      this.logger.warn(
        `Playwright LinkedIn URL discovery failed: ${
          error instanceof Error ? error.message : error
        }`,
      );
      return [];
    }
  }

  private async discoverViaLangSearch(
    criteria: LeadSearchCriteria,
    apiKey: string,
  ) {
    const queries = buildLangSearchQueryVariants(criteria);
    if (queries.length === 0) {
      throw new Error('LinkedIn URL discovery requires a query or role');
    }

    let lastError: Error | undefined;

    for (const query of queries) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const urls = await this.requestLangSearch(
            query,
            criteria.limit,
            apiKey,
          );

          if (urls.length > 0) {
            this.logger.log(
              `Discovered ${urls.length} LinkedIn URL(s) via LangSearch (${query})`,
            );
            return urls;
          }

          lastError = new Error(
            `LangSearch returned no LinkedIn profile URLs for "${query}"`,
          );
          break;
        } catch (error) {
          lastError =
            error instanceof Error ? error : new Error(String(error));

          if (lastError.message.includes('429')) {
            throw lastError;
          }

          if (lastError.message.includes('500') && attempt < 3) {
            await this.sleep(1000 * attempt);
            continue;
          }

          break;
        }
      }
    }

    throw lastError ?? new Error('LangSearch discovery failed');
  }

  private async requestLangSearch(
    query: string,
    limit: number,
    apiKey: string,
  ) {
    const response = await fetch(LANGSEARCH_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        query,
        count: Math.min(Math.max(limit * 2, limit), 50),
        summary: false,
        freshness: 'oneYear',
      }),
    });

    const body = await response.text();

    if (response.status === 429) {
      throw new Error(`LangSearch rate limit reached (429): ${body.slice(0, 200)}`);
    }

    if (!response.ok) {
      throw new Error(
        `LangSearch failed (${response.status}): ${body.slice(0, 300)}`,
      );
    }

    const data = JSON.parse(body) as LangSearchResponse;
    const responseCode = Number(data.code ?? 200);

    if (responseCode === 429) {
      throw new Error(
        `LangSearch rate limit reached (429): ${data.message ?? data.msg ?? body.slice(0, 200)}`,
      );
    }

    if (responseCode !== 200) {
      throw new Error(
        data.message ?? data.msg ?? `LangSearch returned code ${data.code}`,
      );
    }

    const pages = data.data?.webPages?.value ?? data.webPages?.value ?? [];
    return this.extractLinkedInProfileUrls(pages).slice(0, limit);
  }

  private extractLinkedInProfileUrls(pages: LangSearchWebPage[]) {
    const seen = new Set<string>();
    const urls: string[] = [];

    for (const page of pages) {
      const normalized = normalizeProfileUrl(page.url ?? '');
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      urls.push(normalized);
    }

    const parsedLeads = mapSearchHitsToLeads(
      pages.map((item) => ({
        title: item.name ?? '',
        href: item.url ?? '',
        snippet: item.snippet ?? '',
      })),
    );

    for (const lead of parsedLeads) {
      const normalized = normalizeProfileUrl(lead.profileUrl);
      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      urls.push(normalized);
    }

    return urls;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async discoverViaPlaywright(query: string, limit: number) {
    const browser = await this.browserService.getBrowser();
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    try {
      const urls: string[] = [];
      const seen = new Set<string>();
      let offset = 0;

      while (urls.length < limit && offset <= 40) {
        const pageUrls = await this.scrapeDuckDuckGoPage(context, query, offset);

        if (pageUrls.length === 0) {
          break;
        }

        for (const profileUrl of pageUrls) {
          if (seen.has(profileUrl)) {
            continue;
          }

          seen.add(profileUrl);
          urls.push(profileUrl);

          if (urls.length >= limit) {
            break;
          }
        }

        offset += 10;
      }

      if (urls.length === 0) {
        throw new Error(
          'No LinkedIn profile URLs discovered. Set LANGSEARCH_API_KEY (free at langsearch.com).',
        );
      }

      this.logger.log(`Discovered ${urls.length} LinkedIn URL(s) via Playwright`);
      return urls;
    } finally {
      await context.close();
    }
  }

  private async scrapeDuckDuckGoPage(
    context: BrowserContext,
    query: string,
    offset: number,
  ) {
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

    return mapSearchHitsToLeads(hits)
      .map((lead) => normalizeProfileUrl(lead.profileUrl))
      .filter((profileUrl): profileUrl is string => Boolean(profileUrl));
  }
}
