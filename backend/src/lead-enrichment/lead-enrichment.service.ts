import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Lead, LeadStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LEAD_ENRICHMENT_QUEUE } from './constants';
import { CompanyDomainEnricher } from './enrichers/company-domain.enricher';
import { GithubProfileEnricher } from './enrichers/github-profile.enricher';
import { WebsiteEnricher } from './enrichers/website.enricher';
import { EnrichLeadsDto } from './dto/enrich-leads.dto';
import { EnrichmentData } from './interfaces/enrichment-result.interface';

@Injectable()
export class LeadEnrichmentService {
  private readonly logger = new Logger(LeadEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly githubEnricher: GithubProfileEnricher,
    private readonly websiteEnricher: WebsiteEnricher,
    private readonly companyDomainEnricher: CompanyDomainEnricher,
    @Optional()
    @InjectQueue(LEAD_ENRICHMENT_QUEUE)
    private readonly enrichmentQueue?: Queue,
  ) {}

  async enrichLeadById(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.enrichLead(lead);
  }

  async startBatchEnrichment(dto: EnrichLeadsDto) {
    const limit = dto.limit ?? 25;
    const leads = await this.resolveLeadsForEnrichment(dto, limit);

    if (this.shouldRunSynchronously()) {
      const enriched = [];
      for (const lead of leads) {
        enriched.push(await this.enrichLead(lead));
      }

      return {
        processed: enriched.length,
        leads: enriched,
      };
    }

    for (const lead of leads) {
      await this.enrichmentQueue!.add(
        'enrich',
        { leadId: lead.id },
        {
          jobId: `enrich-${lead.id}-${Date.now()}`,
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

  async enrichLead(lead: Lead) {
    let data = this.leadToEnrichmentData(lead);

    data = this.applyPatch(data, await this.githubEnricher.enrich(lead));
    data = this.applyPatch(data, await this.websiteEnricher.enrich({
      ...lead,
      website: data.website ?? lead.website,
      email: data.email ?? lead.email,
      linkedinUrl: data.linkedinUrl ?? lead.linkedinUrl,
    }));
    data = this.applyPatch(
      data,
      await this.companyDomainEnricher.enrich({
        ...lead,
        company: data.company ?? lead.company,
        companyWebsite: data.companyWebsite ?? lead.companyWebsite,
      }),
    );

    const status = this.resolveStatus(data, lead.status);

    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        role: data.role ?? lead.role,
        company: data.company ?? lead.company,
        location: data.location,
        website: data.website,
        portfolioUrl: data.portfolioUrl,
        companyWebsite: data.companyWebsite,
        companySize: data.companySize,
        githubUrl: data.githubUrl,
        linkedinUrl: data.linkedinUrl,
        email: data.email,
        status,
      },
    });

    this.logger.log(`Enriched lead ${lead.id} → ${status}`);
    return updated;
  }

  private leadToEnrichmentData(lead: Lead): EnrichmentData {
    return {
      role: lead.role,
      company: lead.company,
      location: lead.location ?? undefined,
      website: lead.website ?? undefined,
      portfolioUrl: lead.portfolioUrl ?? undefined,
      companyWebsite: lead.companyWebsite ?? undefined,
      companySize: lead.companySize ?? undefined,
      githubUrl: lead.githubUrl ?? undefined,
      linkedinUrl: lead.linkedinUrl ?? undefined,
      email: lead.email ?? undefined,
    };
  }

  private applyPatch(
    current: EnrichmentData,
    patch: EnrichmentData,
  ): EnrichmentData {
    return {
      role: patch.role ?? current.role,
      company: patch.company ?? current.company,
      location: patch.location ?? current.location,
      website: patch.website ?? current.website,
      portfolioUrl: patch.portfolioUrl ?? current.portfolioUrl,
      companyWebsite: patch.companyWebsite ?? current.companyWebsite,
      companySize: patch.companySize ?? current.companySize,
      githubUrl: patch.githubUrl ?? current.githubUrl,
      linkedinUrl: patch.linkedinUrl ?? current.linkedinUrl,
      email: patch.email ?? current.email,
    };
  }

  private async resolveLeadsForEnrichment(dto: EnrichLeadsDto, limit: number) {
    if (dto.leadIds?.length) {
      return this.prisma.lead.findMany({
        where: { id: { in: dto.leadIds } },
        take: limit,
      });
    }

    return this.prisma.lead.findMany({
      where: {
        status: dto.status ?? LeadStatus.NEW,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private resolveStatus(data: EnrichmentData, current: LeadStatus): LeadStatus {
    if (data.email) {
      return LeadStatus.CONTACT_FOUND;
    }

    if (data.companyWebsite) {
      return LeadStatus.DOMAIN_FOUND;
    }

    if (
      data.location ||
      data.website ||
      data.portfolioUrl ||
      data.githubUrl ||
      data.linkedinUrl
    ) {
      return LeadStatus.ENRICHED;
    }

    return current;
  }

  private shouldRunSynchronously() {
    return (
      this.configService.get<string>('LEAD_ENRICHMENT_SYNC', 'true') === 'true'
    );
  }
}
