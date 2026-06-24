import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lead } from '../../../generated/prisma/client';
import {
  DiscoveredContact,
  normalizeEmail,
  parseAllEmailsFromText,
} from '../../shared/email/email.utils';
import { parseEmailFromText } from '../../lead-search/utils/github-profile.parser';
import { extractGithubLogin } from '../../lead-enrichment/utils/extract-github-login';

interface GithubUserProfile {
  login: string;
  email: string | null;
  bio: string | null;
  blog: string | null;
  html_url: string;
}

@Injectable()
export class GithubContactDiscoverer {
  constructor(private readonly configService: ConfigService) {}

  async discover(lead: Lead): Promise<DiscoveredContact[]> {
    const login =
      extractGithubLogin(lead.githubUrl) ??
      extractGithubLogin(lead.profileUrl);

    if (!login) {
      return [];
    }

    const token = this.configService.get<string>('GITHUB_TOKEN');
    const profile = await this.fetchJson<GithubUserProfile>(
      `https://api.github.com/users/${login}`,
      token,
    );

    if (!profile) {
      return [];
    }

    const contacts: DiscoveredContact[] = [];
    const profileEmail = normalizeEmail(
      parseEmailFromText(profile.email, profile.bio) ?? '',
    );

    if (profileEmail) {
      contacts.push({
        email: profileEmail,
        source: 'github_profile',
        page: profile.html_url ?? `https://github.com/${login}`,
      });
    }

    const bioEmail = parseEmailFromText(profile.bio);
    if (bioEmail) {
      contacts.push({
        email: bioEmail,
        source: 'github_bio',
        page: `https://github.com/${login}`,
      });
    }

    return contacts;
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
