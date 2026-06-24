import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  normalizeWebsiteUrl,
  parseEmailFromText,
  parseLinkedInUrl,
} from '../../lead-search/utils/github-profile.parser';
import { TECH_ROLE_PATTERNS } from '../../lead-search/constants/tech-positions';
import { EnrichmentData, LeadEnricher, LeadEnrichmentInput } from '../interfaces/enrichment-result.interface';
import { extractGithubLogin } from '../utils/extract-github-login';

interface GithubUserProfile {
  login: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  bio: string | null;
  email: string | null;
  location: string | null;
  html_url: string;
}

interface GithubSocialAccount {
  provider: string;
  url: string;
}

interface GithubOrgProfile {
  blog: string | null;
  location: string | null;
  public_members_url: string;
}

@Injectable()
export class GithubProfileEnricher implements LeadEnricher {
  constructor(private readonly configService: ConfigService) {}

  async enrich(input: LeadEnrichmentInput): Promise<EnrichmentData> {
    const login =
      extractGithubLogin(input.githubUrl) ??
      extractGithubLogin(input.profileUrl);

    if (!login) {
      return {};
    }

    const token = this.configService.get<string>('GITHUB_TOKEN');
    const profile = await this.fetchJson<GithubUserProfile>(
      `https://api.github.com/users/${login}`,
      token,
    );

    if (!profile) {
      return { githubUrl: input.githubUrl ?? `https://github.com/${login}` };
    }

    const socialAccounts = await this.fetchJson<GithubSocialAccount[]>(
      `https://api.github.com/users/${login}/social_accounts`,
      token,
    );

    const linkedinFromSocial = socialAccounts?.find(
      (account) => account.provider === 'linkedin',
    )?.url;

    const companyName = profile.company?.replace(/^@/, '').trim() || input.company;
    let companyWebsite: string | undefined;
    let companySize: string | undefined;

    const orgSlug = profile.company?.trim().match(/^@([A-Za-z0-9-]+)/)?.[1];
    if (orgSlug) {
      const org = await this.fetchJson<GithubOrgProfile>(
        `https://api.github.com/orgs/${orgSlug}`,
        token,
      );
      companyWebsite = normalizeWebsiteUrl(org?.blog ?? undefined);
      if (org?.public_members_url) {
        companySize = 'GitHub org';
      }
    }

    return {
      githubUrl: profile.html_url,
      location: profile.location ?? undefined,
      website: normalizeWebsiteUrl(profile.blog) ?? input.website ?? undefined,
      company: companyName,
      role: this.inferRole(profile.bio) ?? input.role,
      email:
        parseEmailFromText(profile.email, profile.bio) ?? input.email ?? undefined,
      linkedinUrl:
        linkedinFromSocial ??
        parseLinkedInUrl(profile.bio, profile.blog) ??
        input.linkedinUrl ??
        undefined,
      companyWebsite,
      companySize,
    };
  }

  private inferRole(bio: string | null): string | undefined {
    if (!bio) {
      return undefined;
    }

    for (const entry of TECH_ROLE_PATTERNS) {
      if (entry.pattern.test(bio)) {
        return entry.role;
      }
    }

    return undefined;
  }

  private async fetchJson<T>(url: string, token?: string): Promise<T | null> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  }
}
