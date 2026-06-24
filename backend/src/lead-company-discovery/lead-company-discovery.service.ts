import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Lead, LeadStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LEAD_COMPANY_DISCOVERY_QUEUE } from './constants';
import { DiscoverCompanyDto } from './dto/discover-company.dto';
import { CompanyScrapeResult } from './interfaces/company-discovery.interface';
import { CompanyDomainResolver } from './services/company-domain.resolver';
import { CompanyWebsiteScraper } from './services/company-website.scraper';
import { GrokSummarizerService } from './services/grok-summarizer.service';
import {
  normalizeDiscoveredContacts,
  parseStoredDiscoveredContacts,
} from '../shared/email/email.utils';

@Injectable()
export class LeadCompanyDiscoveryService {
  private readonly logger = new Logger(LeadCompanyDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly domainResolver: CompanyDomainResolver,
    private readonly websiteScraper: CompanyWebsiteScraper,
    private readonly grokSummarizer: GrokSummarizerService,
    @Optional()
    @InjectQueue(LEAD_COMPANY_DISCOVERY_QUEUE)
    private readonly discoveryQueue?: Queue,
  ) {}

  async discoverByLeadId(leadId: string, resummarize = false) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.discoverForLead(lead, resummarize);
  }

  async startBatchDiscovery(dto: DiscoverCompanyDto) {
    const limit = dto.limit ?? 25;
    const leads = await this.resolveLeads(dto, limit);

    if (this.shouldRunSynchronously()) {
      const results = [];
      for (const lead of leads) {
        results.push(await this.discoverForLead(lead, dto.resummarize ?? false));
      }

      return { processed: results.length, results };
    }

    for (const lead of leads) {
      await this.discoveryQueue!.add(
        'discover',
        { leadId: lead.id, resummarize: dto.resummarize ?? false },
        {
          jobId: `company-${lead.id}-${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    }

    return {
      queued: leads.length,
      leadIds: leads.map((lead) => lead.id),
    };
  }

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { leads: { select: { id: true, name: true, role: true } } },
    });

    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    return company;
  }

  async listCompanies(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.company.count(),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async discoverForLead(lead: Lead, resummarize = false) {
    const website = await this.domainResolver.resolve(
      lead.company,
      lead.companyWebsite,
    );

    if (!website) {
      this.logger.warn(`No company website found for lead ${lead.id}`);
      return { lead, company: null, skipped: true, reason: 'no_website' };
    }

    const scrapeResult = await this.websiteScraper.scrape(website);
    if (!scrapeResult) {
      return {
        lead,
        company: null,
        skipped: true,
        reason: 'scrape_failed',
        website,
      };
    }

    const company = await this.upsertCompany(lead, scrapeResult);
    const summarizedCompany = await this.maybeSummarize(
      company,
      lead,
      scrapeResult.textContent,
      scrapeResult.website,
      resummarize,
    );

    const status = this.resolveStatus(summarizedCompany, lead.status);

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        companyId: summarizedCompany.id,
        companyWebsite: scrapeResult.website,
        status,
      },
    });

    this.logger.log(
      `Company discovery for lead ${lead.id} → ${status} (${summarizedCompany.domain})`,
    );

    return {
      lead: updatedLead,
      company: summarizedCompany,
      emailsFound: scrapeResult.emails.length,
      skipped: false,
    };
  }

  private async upsertCompany(lead: Lead, scrapeResult: CompanyScrapeResult) {
    const existing = await this.prisma.company.findUnique({
      where: { domain: scrapeResult.domain },
      select: { discoveredEmails: true },
    });

    const mergedEmails = normalizeDiscoveredContacts([
      ...parseStoredDiscoveredContacts(existing?.discoveredEmails),
      ...scrapeResult.emails,
    ]);

    const emails = mergedEmails as unknown as Prisma.InputJsonValue;

    return this.prisma.company.upsert({
      where: { domain: scrapeResult.domain },
      create: {
        name: lead.company,
        domain: scrapeResult.domain,
        website: scrapeResult.website,
        scrapedContent: scrapeResult.textContent,
        discoveredEmails: emails,
        discoveredAt: new Date(),
      },
      update: {
        name: lead.company,
        website: scrapeResult.website,
        scrapedContent: scrapeResult.textContent,
        discoveredEmails: emails,
        discoveredAt: new Date(),
      },
    });
  }

  private async maybeSummarize(
    company: {
      id: string;
      summary: string | null;
      domain: string;
    },
    lead: Lead,
    scrapedContent: string,
    website: string,
    resummarize: boolean,
  ) {
    if (company.summary && !resummarize) {
      return company;
    }

    if (!scrapedContent.trim()) {
      return company;
    }

    const summary = await this.grokSummarizer.summarize({
      companyName: lead.company,
      leadRole: lead.role,
      website,
      scrapedContent,
    });

    if (!summary) {
      return company;
    }

    return this.prisma.company.update({
      where: { id: company.id },
      data: {
        summary: summary.summary,
        industry: summary.industry,
        products: summary.products,
        personalizationHooks:
          summary.personalizationHooks as unknown as Prisma.InputJsonValue,
        summarizedAt: new Date(),
      },
    });
  }

  private async resolveLeads(dto: DiscoverCompanyDto, limit: number) {
    if (dto.leadIds?.length) {
      return this.prisma.lead.findMany({
        where: { id: { in: dto.leadIds } },
        take: limit,
      });
    }

    return this.prisma.lead.findMany({
      where: {
        status: dto.status ?? LeadStatus.ENRICHED,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private resolveStatus(
    company: { summary: string | null; website?: string | null },
    current: LeadStatus,
  ): LeadStatus {
    if (company.summary || company.website) {
      return LeadStatus.DOMAIN_FOUND;
    }

    return current === LeadStatus.NEW ? LeadStatus.DOMAIN_FOUND : current;
  }

  private shouldRunSynchronously() {
    return (
      this.configService.get<string>(
        'LEAD_COMPANY_DISCOVERY_SYNC',
        'true',
      ) === 'true'
    );
  }
}
