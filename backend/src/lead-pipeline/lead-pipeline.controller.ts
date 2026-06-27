import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PipelineStep } from '../../generated/prisma/client';
import { LeadPipelineQueueService } from './lead-pipeline-queue.service';

@Controller('pipeline')
export class LeadPipelineController {
  constructor(private readonly pipelineQueueService: LeadPipelineQueueService) {}

  @Get('queue/status')
  getQueueStatus() {
    return this.pipelineQueueService.getQueueStatus();
  }

  @Get('logs')
  getPipelineLogs(@Query('limit') limit?: string) {
    return this.pipelineQueueService.getPipelineLogs(
      limit ? Math.min(Number(limit), 200) : 50,
    );
  }

  @Post('queue/enqueue/:leadId')
  enqueueLead(
    @Param('leadId') leadId: string,
    @Body() body: { resumeFromStep?: PipelineStep },
  ) {
    return this.pipelineQueueService.enqueueLead(leadId, body?.resumeFromStep);
  }

  @Post('queue/retry-stalled')
  retryStalledJobs() {
    return this.pipelineQueueService.retryAllFailedJobs();
  }

  @Post('retry-failed')
  retryFailed(@Query('limit') limit?: string) {
    return this.pipelineQueueService.retryFailedLeads(
      limit ? Number(limit) : 25,
    );
  }

  @Post('retry-pending')
  retryPending(@Query('limit') limit?: string) {
    return this.pipelineQueueService.retryPendingLeads(
      limit ? Math.min(Number(limit), 200) : 50,
    );
  }
}
