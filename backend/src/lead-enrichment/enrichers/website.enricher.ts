import { Injectable } from '@nestjs/common';
import { normalizeWebsiteUrl } from '../../lead-search/utils/github-profile.parser';
import { EnrichmentData, LeadEnricher, LeadEnrichmentInput } from '../interfaces/enrichment-result.interface';
import {
  fetchWebsiteText,
  parseWebsiteContent,
} from '../utils/website-content.parser';

@Injectable()
export class WebsiteEnricher implements LeadEnricher {
  async enrich(input: LeadEnrichmentInput): Promise<EnrichmentData> {
    const website = normalizeWebsiteUrl(input.website);
    if (!website) {
      return {};
    }

    const html = await fetchWebsiteText(website);
    if (!html) {
      return { website };
    }

    const parsed = parseWebsiteContent(html, website);

    return {
      website,
      portfolioUrl: parsed.portfolioUrl,
      email: parsed.email ?? input.email ?? undefined,
      linkedinUrl: parsed.linkedinUrl ?? input.linkedinUrl ?? undefined,
    };
  }
}
