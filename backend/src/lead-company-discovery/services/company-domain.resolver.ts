import { Injectable } from '@nestjs/common';
import { normalizeWebsiteUrl } from '../../lead-search/utils/github-profile.parser';

@Injectable()
export class CompanyDomainResolver {
  async resolve(
    companyName: string,
    existingWebsite?: string | null,
  ): Promise<string | undefined> {
    const known = normalizeWebsiteUrl(existingWebsite);
    if (known && (await this.domainResponds(known))) {
      return known;
    }

    const slug = this.companyToSlug(companyName);
    if (!slug) {
      return undefined;
    }

    const candidates = [
      `https://${slug}.com`,
      `https://www.${slug}.com`,
      `https://${slug}.io`,
      `https://${slug}.ai`,
      `https://${slug}.co`,
    ];

    for (const candidate of candidates) {
      if (await this.domainResponds(candidate)) {
        return candidate;
      }
    }

    return undefined;
  }

  private companyToSlug(company: string): string | undefined {
    const cleaned = company
      .replace(/^@/, '')
      .replace(/\b(inc|llc|ltd|pvt|corp|co)\b/gi, '')
      .replace(/[^a-zA-Z0-9]+/g, '')
      .toLowerCase();

    return cleaned.length >= 3 ? cleaned : undefined;
  }

  private async domainResponds(url: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'User-Agent': 'LeadWolfBot/1.0' },
      });

      return response.status >= 200 && response.status < 400;
    } catch {
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'LeadWolfBot/1.0' },
        });
        return response.status >= 200 && response.status < 400;
      } catch {
        return false;
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}
