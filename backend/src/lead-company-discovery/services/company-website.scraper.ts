import { Injectable } from '@nestjs/common';
import { normalizeWebsiteUrl } from '../../lead-search/utils/github-profile.parser';
import { fetchWebsiteText } from '../../lead-enrichment/utils/website-content.parser';
import {
  parseAllEmailsFromText,
} from '../../shared/email/email.utils';
import { CompanyScrapeResult } from '../interfaces/company-discovery.interface';
import { extractDomain } from '../utils/extract-domain';
import { htmlToText } from '../utils/html-to-text';

const PAGE_PATHS = [
  '',
  '/about',
  '/about-us',
  '/team',
  '/contact',
  '/contact-us',
];

const MAX_CONTENT_LENGTH = 12_000;

@Injectable()
export class CompanyWebsiteScraper {
  async scrape(website: string): Promise<CompanyScrapeResult | null> {
    const normalized = normalizeWebsiteUrl(website);
    if (!normalized) {
      return null;
    }

    const domain = extractDomain(normalized);
    if (!domain) {
      return null;
    }

    const origin = new URL(normalized).origin;
    const pagesScraped: string[] = [];
    const textParts: string[] = [];
    const emails: CompanyScrapeResult['emails'] = [];
    const seenEmails = new Set<string>();

    for (const path of PAGE_PATHS) {
      const pageUrl = path ? `${origin}${path}` : normalized;
      const html = await fetchWebsiteText(pageUrl);
      if (!html) {
        continue;
      }

      pagesScraped.push(pageUrl);
      const text = htmlToText(html);
      if (text) {
        textParts.push(`--- ${pageUrl} ---\n${text}`);
      }

      const source = path.includes('contact')
        ? 'company_contact_page'
        : path.includes('team')
          ? 'company_team_page'
          : path.includes('about')
            ? 'company_about_page'
            : 'company_homepage';

      for (const entry of parseAllEmailsFromText(html, pageUrl, source)) {
        if (seenEmails.has(entry.email)) {
          continue;
        }
        seenEmails.add(entry.email);
        emails.push(entry);
      }
    }

    if (!pagesScraped.length) {
      return null;
    }

    return {
      website: normalized,
      domain,
      pagesScraped,
      textContent: textParts.join('\n\n').slice(0, MAX_CONTENT_LENGTH),
      emails,
    };
  }
}
