import { Injectable } from '@nestjs/common';
import { normalizeWebsiteUrl } from '../../lead-search/utils/github-profile.parser';
import { EnrichmentData, LeadEnricher, LeadEnrichmentInput } from '../interfaces/enrichment-result.interface';

@Injectable()
export class CompanyDomainEnricher implements LeadEnricher {
  async enrich(input: LeadEnrichmentInput): Promise<EnrichmentData> {
    if (input.companyWebsite) {
      return { companyWebsite: normalizeWebsiteUrl(input.companyWebsite) };
    }

    const slug = this.companyToSlug(input.company);
    if (!slug) {
      return {};
    }

    const candidates = [
      `https://${slug}.com`,
      `https://www.${slug}.com`,
      `https://${slug}.io`,
      `https://${slug}.ai`,
    ];

    for (const candidate of candidates) {
      if (await this.domainResponds(candidate)) {
        return { companyWebsite: candidate };
      }
    }

    return {};
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
