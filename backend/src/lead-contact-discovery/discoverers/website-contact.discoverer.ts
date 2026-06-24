import { Injectable } from '@nestjs/common';
import { Lead } from '../../../generated/prisma/client';
import { fetchWebsiteText } from '../../lead-enrichment/utils/website-content.parser';
import { normalizeWebsiteUrl } from '../../lead-search/utils/github-profile.parser';
import {
  DiscoveredContact,
  parseAllEmailsFromText,
} from '../../shared/email/email.utils';

@Injectable()
export class WebsiteContactDiscoverer {
  async discover(lead: Lead): Promise<DiscoveredContact[]> {
    const urls = [lead.website, lead.portfolioUrl]
      .map((url) => normalizeWebsiteUrl(url))
      .filter((url): url is string => Boolean(url));

    const contacts: DiscoveredContact[] = [];

    for (const url of urls) {
      const html = await fetchWebsiteText(url);
      if (!html) {
        continue;
      }

      const source = url === normalizeWebsiteUrl(lead.portfolioUrl)
        ? 'portfolio'
        : 'personal_website';

      contacts.push(...parseAllEmailsFromText(html, url, source));
    }

    return contacts;
  }
}
