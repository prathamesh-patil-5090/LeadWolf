import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { LEAD_PIPELINE_QUEUE } from './constants';
import { LeadPipelineService } from './lead-pipeline.service';
import { PipelineJobPayload } from './lead-pipeline-queue.service';
import { isRetryablePipelineError } from './pipeline-step.error';

@Processor(LEAD_PIPELINE_QUEUE, { concurrency: 1 })
export class LeadPipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(LeadPipelineProcessor.name);

  constructor(private readonly pipelineService: LeadPipelineService) {
    super();
  }

  async process(job: Job<PipelineJobPayload>) {
    this.logger.log(
      `Processing pipeline job ${job.id} for lead ${job.data.leadId}`,
    );

    try {
      const lead = await this.pipelineService.processLeadById(
        job.data.leadId,
        job.data.resumeFromStep,
      );

      return {
        leadId: lead.id,
        status: lead.status,
      };
    } catch (error) {
      if (isRetryablePipelineError(error)) {
        this.logger.warn(
          `Retryable pipeline failure for lead ${job.data.leadId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }

      throw error;
    }
  }
}
