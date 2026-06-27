import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { GenerateEmailsDto } from './dto/generate-emails.dto';
import { LeadEmailPersonalizationService } from './lead-email-personalization.service';

@Controller('leads')
export class LeadEmailPersonalizationController {
  constructor(
    private readonly personalizationService: LeadEmailPersonalizationService,
  ) {}

  @Post('generate-emails')
  generateBatch(@Body() dto: GenerateEmailsDto) {
    return this.personalizationService.startBatchGeneration(dto);
  }

  @Post(':id/generate-email')
  generateOne(
    @Param('id') id: string,
    @Body() body: { regenerate?: boolean },
  ) {
    return this.personalizationService.generateByLeadId(
      id,
      body?.regenerate ?? false,
      { requireVerified: false },
    );
  }

  @Get(':id/emails')
  listEmails(@Param('id') id: string) {
    return this.personalizationService.listEmailsForLead(id);
  }
}
