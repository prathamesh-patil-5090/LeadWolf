import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DiscoveredLead,
  LeadSearchCriteria,
  LeadSearchProvider,
  LeadSearchResult,
} from '../interfaces/lead-search-provider.interface';
import {
  resolveSearchRoles,
  TECH_ROLE_PATTERNS,
} from '../constants/tech-positions';
import { buildGithubSearchQuery } from '../utils/github-query.builder';
import { roleCursorKey } from '../utils/search-key.util';
import {
  normalizeWebsiteUrl,
  parseEmailFromText,
  parseLinkedInUrl,
} from '../utils/github-profile.parser';

interface GithubSearchUser {
  login: string;
  html_url: string;
}

interface GithubSearchResponse {
  items?: GithubSearchUser[];
}

interface GithubUserProfile {
  login: string;
  name: string | null;
  company: string | null;
  bio: string | null;
  blog: string | null;
  email: string | null;
  location: string | null;
  html_url: string;
}

interface GithubSocialAccount {
  provider: string;
  url: string;
}

@Injectable()
export class GithubLeadSearchProvider implements LeadSearchProvider {
  private readonly logger = new Logger(GithubLeadSearchProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async search(criteria: LeadSearchCriteria): Promise<LeadSearchResult> {
    const token = this.configService.get<string>('GITHUB_TOKEN');
    const roles = resolveSearchRoles(criteria);
    const rolesToSearch = roles.length > 0 ? roles : [undefined];
    const perRoleCap = Math.max(
      3,
      Math.ceil(criteria.limit / rolesToSearch.length),
    );
    const leads: DiscoveredLead[] = [];
    const seen = new Set<string>();
    const roleEndPages: Record<string, number> = {};
    let pagesFetched = 0;
    let skippedExisting = 0;

    for (const role of rolesToSearch) {
      if (leads.length >= criteria.limit) {
        break;
      }

      const batchResult = await this.searchSingleRole(
        { ...criteria, role },
        token,
        Math.min(criteria.limit - leads.length, perRoleCap),
      );

      pagesFetched += batchResult.pagesFetched;
      skippedExisting += batchResult.skippedExisting;
      roleEndPages[batchResult.roleKey] = batchResult.nextPage;

      for (const lead of batchResult.leads) {
        if (seen.has(lead.profileUrl)) {
          continue;
        }

        seen.add(lead.profileUrl);
        leads.push(lead);

        if (leads.length >= criteria.limit) {
          break;
        }
      }

      await this.pauseBetweenSearches();
    }

    this.logger.log(
      `Discovered ${leads.length} new leads via GitHub (${rolesToSearch.length} role searches, skipped ${skippedExisting} existing) for "${criteria.query}"`,
    );

    return {
      leads: leads.slice(0, criteria.limit),
      roleEndPages,
      pagesFetched,
      skippedExisting,
    };
  }

  private async searchSingleRole(
    criteria: LeadSearchCriteria,
    token: string | undefined,
    remaining: number,
  ): Promise<{
    leads: DiscoveredLead[];
    roleKey: string;
    nextPage: number;
    pagesFetched: number;
    skippedExisting: number;
  }> {
    const query = buildGithubSearchQuery(criteria);
    const leads: DiscoveredLead[] = [];
    const exclude = new Set(criteria.excludeProfileUrls ?? []);
    const roleKey = roleCursorKey(criteria.role);
    let page = criteria.roleStartPages?.[roleKey] ?? 1;
    let pagesFetched = 0;
    let skippedExisting = 0;
    const maxPage = 34;

    while (leads.length < remaining && page <= maxPage) {
      const url = new URL('https://api.github.com/search/users');
      url.searchParams.set('q', query);
      url.searchParams.set('per_page', '30');
      url.searchParams.set('page', String(page));

      const response = await this.githubFetch(url.toString(), token);
      const body = await response.text();
      pagesFetched += 1;

      if (!response.ok) {
        if (response.status === 403 && body.includes('rate limit')) {
          throw new Error(
            'GitHub API rate limit exceeded. Add GITHUB_TOKEN to .env for higher limits.',
          );
        }

        this.logger.warn(
          `Skipping role "${criteria.role ?? 'any'}" — GitHub search failed (${response.status})`,
        );
        break;
      }

      const data = JSON.parse(body) as GithubSearchResponse;
      const users = data.items ?? [];

      if (users.length === 0) {
        page = 1;
        break;
      }

      const newUsers = users.filter((user) => {
        const profileUrl = `https://github.com/${user.login}`;
        if (exclude.has(profileUrl)) {
          skippedExisting += 1;
          return false;
        }

        return true;
      });

      const profiles = await Promise.all(
        newUsers.map((user) => this.fetchEnrichedProfile(user.login, token)),
      );

      for (const profile of profiles) {
        if (!profile) {
          continue;
        }

        if (exclude.has(profile.profileUrl)) {
          skippedExisting += 1;
          continue;
        }

        leads.push(profile);

        if (leads.length >= remaining) {
          break;
        }
      }

      page += 1;

      if (users.length < 30) {
        page = 1;
        break;
      }
    }

    return {
      leads,
      roleKey,
      nextPage: page,
      pagesFetched,
      skippedExisting,
    };
  }

  private pauseBetweenSearches() {
    return new Promise((resolve) => setTimeout(resolve, 400));
  }

  private async fetchEnrichedProfile(
    login: string,
    token?: string,
  ): Promise<DiscoveredLead | null> {
    const [profile, socialAccounts] = await Promise.all([
      this.fetchUserProfile(login, token),
      this.fetchSocialAccounts(login, token),
    ]);

    if (!profile) {
      return null;
    }

    return this.toDiscoveredLead(profile, socialAccounts);
  }

  private async fetchUserProfile(
    login: string,
    token?: string,
  ): Promise<GithubUserProfile | null> {
    const response = await this.githubFetch(
      `https://api.github.com/users/${login}`,
      token,
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as GithubUserProfile;
  }

  private async fetchSocialAccounts(
    login: string,
    token?: string,
  ): Promise<GithubSocialAccount[]> {
    const response = await this.githubFetch(
      `https://api.github.com/users/${login}/social_accounts`,
      token,
    );

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as GithubSocialAccount[];
  }

  private githubFetch(url: string, token?: string) {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, { headers });
  }

  private toDiscoveredLead(
    profile: GithubUserProfile,
    socialAccounts: GithubSocialAccount[],
  ): DiscoveredLead {
    const role = this.inferRole(profile.bio) ?? 'Software Engineer';
    const company = profile.company?.replace(/^@/, '').trim() || 'Unknown';
    const linkedinFromSocial = socialAccounts.find(
      (account) => account.provider === 'linkedin',
    )?.url;

    const email =
      parseEmailFromText(profile.email, profile.bio) ??
      undefined;
    const linkedinUrl =
      linkedinFromSocial ??
      parseLinkedInUrl(profile.bio, profile.blog) ??
      undefined;
    const website = normalizeWebsiteUrl(profile.blog);

    return {
      name: profile.name ?? profile.login,
      role,
      company,
      profileUrl: profile.html_url,
      githubUrl: profile.html_url,
      email,
      website,
      linkedinUrl,
    };
  }

  private inferRole(bio: string | null): string | null {
    if (!bio) {
      return null;
    }

    for (const entry of TECH_ROLE_PATTERNS) {
      if (entry.pattern.test(bio)) {
        return entry.role;
      }
    }

    return null;
  }
}
