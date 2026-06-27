import { Body, Controller, Param, Post } from '@nestjs/common';
import { SendCampaignDto } from './dto/send-campaign.dto';
import { LeadCampaignSendingService } from './lead-campaign-sending.service';

@Controller('leads')
export class LeadCampaignSendingController {
  constructor(
    private readonly campaignSendingService: LeadCampaignSendingService,
  ) {}

  @Post('send')
  sendBatch(@Body() dto: SendCampaignDto) {
    return this.campaignSendingService.startBatchSend(dto);
  }

  @Post(':id/send')
  sendOne(@Param('id') id: string, @Body() body: { force?: boolean }) {
    return this.campaignSendingService.sendByLeadId(id, body?.force ?? false);
  }
}
