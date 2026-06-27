import { Body, Controller, Param, Post } from '@nestjs/common';
import { EnrichLeadsDto } from './dto/enrich-leads.dto';
import { LeadEnrichmentService } from './lead-enrichment.service';

@Controller('leads')
export class LeadEnrichmentController {
  constructor(private readonly leadEnrichmentService: LeadEnrichmentService) {}

  @Post('enrich')
  enrichBatch(@Body() dto: EnrichLeadsDto) {
    return this.leadEnrichmentService.startBatchEnrichment(dto);
  }

  @Post(':id/enrich')
  enrichOne(@Param('id') id: string) {
    return this.leadEnrichmentService.enrichLeadById(id);
  }
}
