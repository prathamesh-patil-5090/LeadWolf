import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PipelineStep } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  LEAD_PIPELINE_AUTO_RETRY,
  LEAD_PIPELINE_QUEUE,
  PIPELINE_FAILED_STATUSES,
} from './constants';
import { GmailReplySyncService } from '../lead-analytics/gmail-reply-sync.service';
import { LeadPipelineService } from './lead-pipeline.service';

export interface PipelineJobPayload {
  leadId: string;
  resumeFromStep?: PipelineStep;
}

@Injectable()
export class LeadPipelineQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeadPipelineQueueService.name);
  private retryTimer?: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly pipelineService: LeadPipelineService,
    private readonly gmailReplySyncService: GmailReplySyncService,
    @Optional()
    @InjectQueue(LEAD_PIPELINE_QUEUE)
    private readonly pipelineQueue?: Queue,
  ) {}

  usesQueue() {
    return Boolean(this.pipelineQueue);
  }

  onModuleInit() {
    if (!this.pipelineQueue || !this.isAutoRetryEnabled()) {
      return;
    }

    const intervalMs = Number(
      this.configService.get<string>('LEAD_PIPELINE_RETRY_INTERVAL_MS', '60000'),
    );

    this.retryTimer = setInterval(() => {
      void this.retryFailedWhenIdle();
      void this.syncGmailWhenIdle();
    }, intervalMs);
  }

  onModuleDestroy() {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }
  }

  async enqueueLead(leadId: string, resumeFromStep?: PipelineStep) {
    if (!this.pipelineQueue) {
      await this.pipelineService.processLeadById(leadId, resumeFromStep);
      return { mode: 'sync' as const, leadId };
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { pipelineFailedStep: true },
    });

    const step = resumeFromStep ?? lead?.pipelineFailedStep ?? undefined;
    const jobId = `pipeline-${leadId}`;

    const existing = await this.pipelineQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed') {
        await existing.retry();
        this.logger.log(
          `Retried failed pipeline job ${jobId} for lead ${leadId}`,
        );
        return {
          mode: 'queued' as const,
          leadId,
          jobId: existing.id,
          action: 'retried_failed',
          resumeFromStep: step,
        };
      }

      if (state === 'waiting' || state === 'delayed' || state === 'active') {
        return {
          mode: 'queued' as const,
          leadId,
          jobId: existing.id,
          action: 'already_queued',
          state,
        };
      }

      await existing.remove();
    }

    const job = await this.pipelineQueue.add(
      'process',
      { leadId, resumeFromStep: step } satisfies PipelineJobPayload,
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: 100,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    );

    this.logger.log(
      `Enqueued pipeline job ${job.id} for lead ${leadId}${step ? ` from ${step}` : ''}`,
    );

    return { mode: 'queued' as const, leadId, jobId: job.id, action: 'enqueued' };
  }

  async enqueueLeads(leadIds: string[]) {
    const results = [];
    for (const leadId of leadIds) {
      results.push(await this.enqueueLead(leadId));
    }

    return {
      total: leadIds.length,
      queued: results.filter((entry) => entry.mode === 'queued').length,
      processedSync: results.filter((entry) => entry.mode === 'sync').length,
      results,
    };
  }

  async getQueueStatus() {
    if (!this.pipelineQueue) {
      return {
        enabled: false,
        isEmpty: true,
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
      };
    }

    const [waiting, active, delayed, completed, failed, failedJobs] =
      await Promise.all([
      this.pipelineQueue.getWaitingCount(),
      this.pipelineQueue.getActiveCount(),
      this.pipelineQueue.getDelayedCount(),
      this.pipelineQueue.getCompletedCount(),
      this.pipelineQueue.getFailedCount(),
      this.pipelineQueue.getFailed(0, 10),
    ]);

    return {
      enabled: true,
      isEmpty: waiting + active + delayed === 0,
      waiting,
      active,
      delayed,
      completed,
      failed,
      failedJobIds: failedJobs.map((job) => job.id),
    };
  }

  async retryAllFailedJobs() {
    if (!this.pipelineQueue) {
      return { retried: 0, message: 'Queue not enabled' };
    }

    const failedJobs = await this.pipelineQueue.getFailed(0, 100);
    let retried = 0;

    for (const job of failedJobs) {
      await job.retry();
      retried += 1;
    }

    this.logger.log(`Retried ${retried} failed pipeline job(s) in Redis`);

    return { retried, jobIds: failedJobs.map((job) => job.id) };
  }

  async retryFailedLeads(limit = 25) {
    const failedLeads = await this.prisma.lead.findMany({
      where: { status: { in: PIPELINE_FAILED_STATUSES } },
      orderBy: { pipelineFailedAt: 'asc' },
      take: limit,
      select: {
        id: true,
        pipelineFailedStep: true,
        pipelineError: true,
      },
    });

    const retried = [];
    for (const lead of failedLeads) {
      if (!lead.pipelineFailedStep) {
        continue;
      }

      const retryable =
        lead.pipelineError?.toLowerCase().includes('rate limit') ||
        lead.pipelineError?.toLowerCase().includes('rate-limited') ||
        lead.pipelineError?.toLowerCase().includes('daily limit') ||
        lead.pipelineError?.toLowerCase().includes('429') ||
        lead.pipelineError?.toLowerCase().includes('timeout');

      if (!retryable && !this.configService.get<string>('LEAD_PIPELINE_RETRY_ALL')) {
        continue;
      }

      retried.push(
        await this.enqueueLead(lead.id, lead.pipelineFailedStep),
      );
    }

    return {
      scanned: failedLeads.length,
      requeued: retried.length,
      results: retried,
    };
  }

  async retryFailedWhenIdle() {
    const status = await this.getQueueStatus();
    if (!status.enabled || !status.isEmpty) {
      return { skipped: true, reason: 'queue_busy' };
    }

    return this.retryFailedLeads(
      Number(this.configService.get<string>('LEAD_PIPELINE_RETRY_BATCH', '10')),
    );
  }

  async syncGmailWhenIdle() {
    if (
      !this.gmailReplySyncService.isConfigured() ||
      this.configService.get<string>('LEAD_PIPELINE_AUTO_GMAIL_SYNC', 'true') !==
        'true'
    ) {
      return { skipped: true, reason: 'gmail_not_configured' };
    }

    const status = await this.getQueueStatus();
    if (!status.isEmpty) {
      return { skipped: true, reason: 'queue_busy' };
    }

    return this.gmailReplySyncService.syncReplies(
      Number(this.configService.get<string>('GMAIL_REPLY_SYNC_BATCH', '30')),
    );
  }

  private isAutoRetryEnabled() {
    return (
      this.configService.get<string>(LEAD_PIPELINE_AUTO_RETRY, 'true') === 'true'
    );
  }
}
