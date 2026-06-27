import { Module } from '@nestjs/common';
import { BrevoWebhookController } from './brevo-webhook.controller';
import { BrevoWebhookService } from './brevo-webhook.service';
import { GmailReplySyncService } from './gmail-reply-sync.service';
import { LeadAnalyticsController } from './lead-analytics.controller';
import { LeadAnalyticsService } from './lead-analytics.service';

@Module({
  controllers: [LeadAnalyticsController, BrevoWebhookController],
  providers: [LeadAnalyticsService, BrevoWebhookService, GmailReplySyncService],
  exports: [LeadAnalyticsService],
})
export class LeadAnalyticsModule {}
