import { Injectable } from '@nestjs/common';
import { Lead } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyWebsiteScraper } from '../../lead-company-discovery/services/company-website.scraper';
import { extractDomain } from '../../lead-company-discovery/utils/extract-domain';
import {
  DiscoveredContact,
  parseStoredDiscoveredContacts,
} from '../../shared/email/email.utils';

@Injectable()
export class CompanyContactDiscoverer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly websiteScraper: CompanyWebsiteScraper,
  ) {}

  async discover(lead: Lead): Promise<DiscoveredContact[]> {
    const contacts: DiscoveredContact[] = [];

    if (lead.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: lead.companyId },
      });

      if (company?.discoveredEmails) {
        contacts.push(...parseStoredDiscoveredContacts(company.discoveredEmails));
      }

      if (company?.website && !contacts.length) {
        const scrapeResult = await this.websiteScraper.scrape(company.website);
        if (scrapeResult) {
          contacts.push(...scrapeResult.emails);
        }
      }
    } else if (lead.companyWebsite) {
      const scrapeResult = await this.websiteScraper.scrape(lead.companyWebsite);
      if (scrapeResult) {
        contacts.push(...scrapeResult.emails);
      }
    }

    const domain = extractDomain(lead.companyWebsite ?? '');
    if (domain) {
      return contacts.map((contact) => ({
        ...contact,
        source: contact.source.startsWith('company_')
          ? contact.source
          : `company_${contact.source}`,
      }));
    }

    return contacts;
  }
}
