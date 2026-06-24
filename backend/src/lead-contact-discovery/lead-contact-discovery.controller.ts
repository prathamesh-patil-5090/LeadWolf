import { Body, Controller, Param, Post } from '@nestjs/common';
import { DiscoverContactsDto } from './dto/discover-contacts.dto';
import { LeadContactDiscoveryService } from './lead-contact-discovery.service';

@Controller('leads')
export class LeadContactDiscoveryController {
  constructor(
    private readonly contactDiscoveryService: LeadContactDiscoveryService,
  ) {}

  @Post('discover-contacts')
  discoverBatch(@Body() dto: DiscoverContactsDto) {
    return this.contactDiscoveryService.startBatchDiscovery(dto);
  }

  @Post(':id/discover-contacts')
  discoverOne(@Param('id') id: string) {
    return this.contactDiscoveryService.discoverByLeadId(id);
  }
}
