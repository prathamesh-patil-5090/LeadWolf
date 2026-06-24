import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LeadSearchJobStatus, LeadStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LEAD_SEARCH_PROVIDER, LEAD_SEARCH_QUEUE } from './constants';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { SearchLeadsDto } from './dto/search-leads.dto';
import type { LeadSearchProvider } from './interfaces/lead-search-provider.interface';
import {
  DiscoveredLead,
} from './interfaces/lead-search-provider.interface';

@Injectable()
export class LeadSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(LEAD_SEARCH_PROVIDER)
    private readonly searchProvider: LeadSearchProvider,
    @Optional()
    @InjectQueue(LEAD_SEARCH_QUEUE)
    private readonly leadSearchQueue?: Queue,
  ) {}

  async startSearch(dto: SearchLeadsDto) {
    const limit = dto.limit ?? 25;

    const job = await this.prisma.leadSearchJob.create({
      data: {
        query: dto.query,
        role: dto.role,
        roles: dto.roles ?? [],
        expandTechRoles: dto.expandTechRoles ?? true,
        location: dto.location,
        company: dto.company,
        limit,
      },
    });

    if (this.shouldRunSynchronously()) {
      await this.executeSearch(job.id);
      return this.getSearchJob(job.id);
    }

    await this.leadSearchQueue!.add(
      'search',
      { jobId: job.id },
      {
        jobId: job.id,
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return job;
  }

  async executeSearch(jobId: string) {
    const job = await this.prisma.leadSearchJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Lead search job ${jobId} not found`);
    }

    if (
      job.status === LeadSearchJobStatus.COMPLETED ||
      job.status === LeadSearchJobStatus.RUNNING
    ) {
      return job;
    }

    await this.prisma.leadSearchJob.update({
      where: { id: jobId },
      data: { status: LeadSearchJobStatus.RUNNING, error: null },
    });

    try {
      const discovered = await this.searchProvider.search({
        query: job.query,
        role: job.role ?? undefined,
        roles: job.roles.length > 0 ? job.roles : undefined,
        expandTechRoles: job.expandTechRoles,
        location: job.location ?? undefined,
        company: job.company ?? undefined,
        limit: job.limit,
      });

      await this.persistDiscoveredLeads(jobId, discovered);

      return this.prisma.leadSearchJob.update({
        where: { id: jobId },
        data: {
          status: LeadSearchJobStatus.COMPLETED,
          leadsFound: discovered.length,
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Lead search failed';

      return this.prisma.leadSearchJob.update({
        where: { id: jobId },
        data: {
          status: LeadSearchJobStatus.FAILED,
          error: message,
        },
      });
    }
  }

  async getSearchJob(jobId: string) {
    return this.prisma.leadSearchJob.findUniqueOrThrow({
      where: { id: jobId },
      include: {
        leads: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async listLeads(query: ListLeadsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(query.role ? { role: { contains: query.role, mode: 'insensitive' as const } } : {}),
      ...(query.company
        ? { company: { contains: query.company, mode: 'insensitive' as const } }
        : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getLead(id: string) {
    return this.prisma.lead.findUniqueOrThrow({ where: { id } });
  }

  async createLead(dto: CreateLeadDto) {
    return this.prisma.lead.upsert({
      where: { profileUrl: dto.profileUrl },
      update: {
        name: dto.name,
        role: dto.role,
        company: dto.company,
      },
      create: {
        name: dto.name,
        role: dto.role,
        company: dto.company,
        profileUrl: dto.profileUrl,
      },
    });
  }

  private async persistDiscoveredLeads(
    jobId: string,
    discovered: DiscoveredLead[],
  ) {
    for (const lead of discovered) {
      const githubUrl = lead.githubUrl ?? this.extractGithubUrl(lead.profileUrl);

      await this.prisma.lead.upsert({
        where: { profileUrl: lead.profileUrl },
        update: {
          name: lead.name,
          role: lead.role,
          company: lead.company,
          email: lead.email,
          website: lead.website,
          githubUrl,
          linkedinUrl: lead.linkedinUrl,
          searchJobId: jobId,
          ...(lead.email || lead.website || lead.linkedinUrl
            ? { status: LeadStatus.ENRICHED }
            : {}),
        },
        create: {
          name: lead.name,
          role: lead.role,
          company: lead.company,
          profileUrl: lead.profileUrl,
          email: lead.email,
          website: lead.website,
          githubUrl,
          linkedinUrl: lead.linkedinUrl,
          searchJobId: jobId,
          status:
            lead.email || lead.website || lead.linkedinUrl
              ? LeadStatus.ENRICHED
              : LeadStatus.NEW,
        },
      });
    }
  }

  private extractGithubUrl(profileUrl: string): string | undefined {
    try {
      const parsed = new URL(profileUrl);
      if (parsed.hostname === 'github.com') {
        return profileUrl;
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  private shouldRunSynchronously() {
    return this.configService.get<string>('LEAD_SEARCH_SYNC', 'false') === 'true';
  }
}
