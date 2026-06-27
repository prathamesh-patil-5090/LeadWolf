import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Lead, LeadSearchJobStatus, LeadStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LEAD_SEARCH_PROVIDER, LEAD_SEARCH_QUEUE } from './constants';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { SearchLeadsDto } from './dto/search-leads.dto';
import type { LeadSearchProvider } from './interfaces/lead-search-provider.interface';
import {
  DiscoveredLead,
} from './interfaces/lead-search-provider.interface';
import { LeadPipelineQueueService } from '../lead-pipeline/lead-pipeline-queue.service';
import { buildSearchKey } from './utils/search-key.util';

@Injectable()
export class LeadSearchService {
  private readonly logger = new Logger(LeadSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(LEAD_SEARCH_PROVIDER)
    private readonly searchProvider: LeadSearchProvider,
    @Optional()
    @InjectQueue(LEAD_SEARCH_QUEUE)
    private readonly leadSearchQueue?: Queue,
    @Optional()
    private readonly leadPipelineQueueService?: LeadPipelineQueueService,
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
      const searchKey = buildSearchKey({
        query: job.query,
        role: job.role,
        roles: job.roles,
        location: job.location,
        company: job.company,
        expandTechRoles: job.expandTechRoles,
      });

      const [cursor, existingLeads] = await Promise.all([
        this.prisma.leadSearchCursor.findUnique({ where: { searchKey } }),
        this.prisma.lead.findMany({ select: { profileUrl: true } }),
      ]);

      const roleStartPages =
        cursor?.rolePages && typeof cursor.rolePages === 'object'
          ? (cursor.rolePages as Record<string, number>)
          : {};

      const searchResult = await this.searchProvider.search({
        query: job.query,
        role: job.role ?? undefined,
        roles: job.roles.length > 0 ? job.roles : undefined,
        expandTechRoles: job.expandTechRoles,
        location: job.location ?? undefined,
        company: job.company ?? undefined,
        limit: job.limit,
        excludeProfileUrls: existingLeads.map((lead) => lead.profileUrl),
        roleStartPages,
      });

      await this.prisma.leadSearchCursor.upsert({
        where: { searchKey },
        create: {
          searchKey,
          rolePages: searchResult.roleEndPages,
          totalFetched: searchResult.leads.length,
        },
        update: {
          rolePages: searchResult.roleEndPages,
          totalFetched: { increment: searchResult.leads.length },
        },
      });

      const persistStats = await this.persistDiscoveredLeads(
        jobId,
        searchResult.leads,
      );

      return this.prisma.leadSearchJob.update({
        where: { id: jobId },
        data: {
          status: LeadSearchJobStatus.COMPLETED,
          leadsFound: searchResult.leads.length,
          newLeadsFound: persistStats.newLeads,
          skippedExisting: searchResult.skippedExisting + persistStats.updatedLeads,
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
    const lead = await this.prisma.lead.upsert({
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

    if (
      this.leadPipelineQueueService &&
      this.configService.get<string>('LEAD_PIPELINE_AUTO', 'true') === 'true'
    ) {
      try {
        return await this.leadPipelineQueueService.enqueueLead(lead.id);
      } catch (error) {
        this.logger.warn(
          `Pipeline enqueue failed for lead ${lead.id}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    return lead;
  }

  private async persistDiscoveredLeads(
    jobId: string,
    discovered: DiscoveredLead[],
  ) {
    const newLeads: Lead[] = [];
    let updatedLeads = 0;

    for (const lead of discovered) {
      const githubUrl = lead.githubUrl ?? this.extractGithubUrl(lead.profileUrl);
      const existing = await this.prisma.lead.findUnique({
        where: { profileUrl: lead.profileUrl },
        select: { id: true },
      });

      const saved = await this.prisma.lead.upsert({
        where: { profileUrl: lead.profileUrl },
        update: {
          name: lead.name,
          role: lead.role,
          company: lead.company,
          email: lead.email,
          website: lead.website,
          location: lead.location,
          githubUrl,
          linkedinUrl: lead.linkedinUrl,
          searchJobId: jobId,
          ...(lead.email || lead.website || lead.linkedinUrl || lead.location
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
          location: lead.location,
          githubUrl,
          linkedinUrl: lead.linkedinUrl,
          searchJobId: jobId,
          status:
            lead.email || lead.website || lead.linkedinUrl || lead.location
              ? LeadStatus.ENRICHED
              : LeadStatus.NEW,
        },
      });

      if (!existing) {
        newLeads.push(saved);
      } else {
        updatedLeads += 1;
      }
    }

    if (
      newLeads.length > 0 &&
      this.leadPipelineQueueService &&
      this.configService.get<string>('LEAD_PIPELINE_AUTO', 'true') === 'true'
    ) {
      const enqueueResult = await this.leadPipelineQueueService.enqueueLeads(
        newLeads.map((lead) => lead.id),
      );

      this.logger.log(
        `Queued ${enqueueResult.queued} lead(s) for pipeline (${enqueueResult.processedSync} sync)`,
      );
    }

    return {
      newLeads: newLeads.length,
      updatedLeads,
      pipelined: newLeads.length,
      queued: newLeads.length,
    };
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
