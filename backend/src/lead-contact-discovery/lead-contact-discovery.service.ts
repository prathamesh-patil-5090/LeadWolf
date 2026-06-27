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
import { extractDomain } from '../lead-company-discovery/utils/extract-domain';
import {
  DiscoveredContact,
  normalizeDiscoveredContacts,
  normalizeEmail,
  parseStoredDiscoveredContacts,
  pickEmailForLead,
} from '../shared/email/email.utils';
import { LEAD_CONTACT_DISCOVERY_QUEUE } from './constants';
import { CompanyContactDiscoverer } from './discoverers/company-contact.discoverer';
import { GithubContactDiscoverer } from './discoverers/github-contact.discoverer';
import { WebsiteContactDiscoverer } from './discoverers/website-contact.discoverer';
import { DiscoverContactsDto } from './dto/discover-contacts.dto';

@Injectable()
export class LeadContactDiscoveryService {
  private readonly logger = new Logger(LeadContactDiscoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly githubDiscoverer: GithubContactDiscoverer,
    private readonly websiteDiscoverer: WebsiteContactDiscoverer,
    private readonly companyDiscoverer: CompanyContactDiscoverer,
    @Optional()
    @InjectQueue(LEAD_CONTACT_DISCOVERY_QUEUE)
    private readonly contactQueue?: Queue,
  ) {}

  async discoverByLeadId(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.discoverForLead(lead);
  }

  async startBatchDiscovery(dto: DiscoverContactsDto) {
    const limit = dto.limit ?? 25;
    const leads = await this.resolveLeads(dto, limit);

    if (this.shouldRunSynchronously()) {
      const results = [];
      for (const lead of leads) {
        results.push(await this.discoverForLead(lead));
      }

      return { processed: results.length, results };
    }

    for (const lead of leads) {
      await this.contactQueue!.add(
        'discover',
        { leadId: lead.id },
        {
          jobId: `contact-${lead.id}-${Date.now()}`,
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

  async discoverForLead(lead: Lead) {
    const existing = parseStoredDiscoveredContacts(lead.discoveredContacts);
    const fromGithub = await this.githubDiscoverer.discover(lead);
    const fromWebsite = await this.websiteDiscoverer.discover(lead);
    const fromCompany = await this.companyDiscoverer.discover(lead);

    const leadEmail =
      lead.email && normalizeEmail(lead.email)
        ? [
            {
              email: normalizeEmail(lead.email)!,
              source: lead.emailSource ?? 'lead_record',
            },
          ]
        : [];

    const contacts = normalizeDiscoveredContacts([
      ...existing,
      ...leadEmail,
      ...fromGithub,
      ...fromWebsite,
      ...fromCompany,
    ]);

    const companyDomain =
      extractDomain(lead.companyWebsite ?? '') ??
      (lead.companyId
        ? await this.resolveCompanyDomain(lead.companyId)
        : undefined);

    const picked = pickEmailForLead(contacts, lead.name, companyDomain);
    const normalizedEmail = picked?.email ?? normalizeEmail(lead.email ?? '');

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        discoveredContacts:
          contacts as unknown as Prisma.InputJsonValue,
        email: normalizedEmail ?? lead.email,
        emailSource: picked?.source ?? lead.emailSource,
        status: normalizedEmail ? LeadStatus.CONTACT_FOUND : lead.status,
      },
    });

    this.logger.log(
      `Contact discovery for lead ${lead.id} → ${contacts.length} contacts, email=${normalizedEmail ?? 'none'}`,
    );

    return {
      lead: updatedLead,
      contactsFound: contacts.length,
      picked: picked ?? null,
      sources: {
        github: fromGithub.length,
        website: fromWebsite.length,
        company: fromCompany.length,
      },
    };
  }

  private async resolveCompanyDomain(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { domain: true, website: true },
    });

    return (
      company?.domain ??
      (company?.website ? extractDomain(company.website) : undefined)
    );
  }

  private async resolveLeads(dto: DiscoverContactsDto, limit: number) {
    if (dto.leadIds?.length) {
      return this.prisma.lead.findMany({
        where: { id: { in: dto.leadIds } },
        take: limit,
      });
    }

    return this.prisma.lead.findMany({
      where: {
        status: dto.status ?? LeadStatus.DOMAIN_FOUND,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private shouldRunSynchronously() {
    return (
      this.configService.get<string>(
        'LEAD_CONTACT_DISCOVERY_SYNC',
        'true',
      ) === 'true'
    );
  }
}
