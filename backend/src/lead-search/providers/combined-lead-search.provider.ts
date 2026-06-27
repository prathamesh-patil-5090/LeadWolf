import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredLead,
  LeadSearchCriteria,
  LeadSearchProvider,
} from '../interfaces/lead-search-provider.interface';
import { BrightDataService } from '../../shared/bright-data/bright-data.service';
import { GithubLeadSearchProvider } from './github-lead-search.provider';
import { LinkedInUrlDiscoveryService } from '../services/linkedin-url-discovery.service';
import {
  dedupeDiscoveredLeads,
  mergeDiscoveredLeadSources,
} from '../utils/lead-merge.util';
import { normalizeProfileUrl } from '../utils/linkedin-result.parser';

@Injectable()
export class CombinedLeadSearchProvider implements LeadSearchProvider {
  private readonly logger = new Logger(CombinedLeadSearchProvider.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly githubProvider: GithubLeadSearchProvider,
    private readonly linkedInUrlDiscovery: LinkedInUrlDiscoveryService,
    private readonly brightDataService: BrightDataService,
  ) {}

  async search(criteria: LeadSearchCriteria) {
    const githubLimit = this.resolveGithubLimit(criteria.limit);
    const brightDataLimit = this.resolveBrightDataLimit(criteria.limit);

    this.logger.log(
      `Running combined search: GitHub limit=${githubLimit}, Bright Data limit=${brightDataLimit}`,
    );

    const [githubResult, urlDiscoveryResult] = await Promise.allSettled([
      this.githubProvider.search({ ...criteria, limit: githubLimit }),
      this.linkedInUrlDiscovery.discoverProfileUrls({
        ...criteria,
        limit: Math.min(brightDataLimit * 2, 100),
      }),
    ]);

    const githubLeads =
      githubResult.status === 'fulfilled' ? githubResult.value.leads : [];
    const discoveredUrls =
      urlDiscoveryResult.status === 'fulfilled' ? urlDiscoveryResult.value : [];

    if (githubResult.status === 'rejected') {
      this.logger.warn(
        `GitHub search failed in combined mode: ${this.formatError(githubResult.reason)}`,
      );
    }

    if (urlDiscoveryResult.status === 'rejected') {
      this.logger.warn(
        `LinkedIn URL discovery failed in combined mode: ${this.formatError(urlDiscoveryResult.reason)}`,
      );
    }

    const seedUrls = githubLeads
      .map((lead) => lead.linkedinUrl)
      .map((url) => (url ? normalizeProfileUrl(url) : null))
      .filter((url): url is string => Boolean(url));

    const profileUrls = [...new Set([...discoveredUrls, ...seedUrls])]
      .filter((url) => !(criteria.excludeProfileUrls ?? []).includes(url))
      .slice(0, brightDataLimit);

    let brightDataLeads: DiscoveredLead[] = [];
    if (profileUrls.length > 0 && this.brightDataService.isConfigured()) {
      try {
        brightDataLeads = await this.brightDataService.collectLinkedInProfiles(
          profileUrls,
        );
      } catch (error) {
        this.logger.warn(
          `Bright Data profile scrape failed in combined mode: ${this.formatError(error)}`,
        );
      }
    }

    if (githubLeads.length === 0 && brightDataLeads.length === 0) {
      const errors = [githubResult, urlDiscoveryResult]
        .filter((result) => result.status === 'rejected')
        .map((result) =>
          result.status === 'rejected'
            ? this.formatError(result.reason)
            : '',
        )
        .filter(Boolean);

      throw new Error(
        errors.length > 0
          ? `Combined search failed: ${errors.join(' | ')}`
          : 'Combined search returned no leads',
      );
    }

    const merged = dedupeDiscoveredLeads(
      mergeDiscoveredLeadSources(githubLeads, brightDataLeads),
    );

    const githubStats =
      githubResult.status === 'fulfilled' ? githubResult.value : null;

    this.logger.log(
      `Combined search merged ${merged.length} lead(s) (${githubLeads.length} GitHub, ${brightDataLeads.length} LinkedIn scraped)`,
    );

    return {
      leads: merged.slice(0, criteria.limit * 2),
      roleEndPages: githubStats?.roleEndPages ?? {},
      pagesFetched: githubStats?.pagesFetched ?? 0,
      skippedExisting: githubStats?.skippedExisting ?? 0,
    };
  }

  private resolveGithubLimit(totalLimit: number) {
    const configured = Number(
      this.configService.get<string>('LEAD_SEARCH_GITHUB_LIMIT'),
    );

    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }

    return totalLimit;
  }

  private resolveBrightDataLimit(totalLimit: number) {
    const configured = Number(
      this.configService.get<string>('LEAD_SEARCH_BRIGHT_DATA_LIMIT'),
    );

    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }

    return totalLimit;
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
