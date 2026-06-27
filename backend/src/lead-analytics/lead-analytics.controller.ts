import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { EmailEventType, LeadStatus } from '../../generated/prisma/client';
import { RateLimitService } from '../shared/rate-limit/rate-limit.service';
import { GmailReplySyncService } from './gmail-reply-sync.service';
import { LeadAnalyticsService } from './lead-analytics.service';

@Controller('analytics')
export class LeadAnalyticsController {
  constructor(
    private readonly analyticsService: LeadAnalyticsService,
    private readonly gmailReplySyncService: GmailReplySyncService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get('summary')
  getSummary() {
    return this.analyticsService.getSummary();
  }

  @Get('quota')
  getQuota() {
    return this.rateLimitService.getQuotaSnapshot();
  }

  @Get('events')
  listEvents(
    @Query('leadId') leadId?: string,
    @Query('outreachEmailId') outreachEmailId?: string,
    @Query('eventType') eventType?: EmailEventType,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.listEvents({
      leadId,
      outreachEmailId,
      eventType,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('sent-emails')
  listSentEmails(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('leadStatus') leadStatus?: LeadStatus,
    @Query('hasReply') hasReply?: string,
  ) {
    return this.analyticsService.listSentEmails({
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      leadStatus,
      hasReply: hasReply === 'true',
    });
  }

  @Get('sent-emails/:id')
  async getSentEmailDetail(@Param('id') id: string) {
    const detail = await this.analyticsService.getSentEmailDetail(id);
    if (!detail) {
      throw new NotFoundException(`Sent email ${id} not found`);
    }
    return detail;
  }

  @Get('leads/:id/timeline')
  getLeadTimeline(@Param('id') id: string) {
    return this.analyticsService.getLeadTimeline(id);
  }

  @Post('sync-gmail-replies')
  syncGmailReplies(@Body() body: { limit?: number }) {
    return this.gmailReplySyncService.syncReplies(body?.limit ?? 20);
  }
}
