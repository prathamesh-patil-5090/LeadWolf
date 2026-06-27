import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { EmailEventType } from '../../generated/prisma/client';
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

  @Get('leads/:id/timeline')
  getLeadTimeline(@Param('id') id: string) {
    return this.analyticsService.getLeadTimeline(id);
  }

  @Post('sync-gmail-replies')
  syncGmailReplies(@Body() body: { limit?: number }) {
    return this.gmailReplySyncService.syncReplies(body?.limit ?? 20);
  }
}
