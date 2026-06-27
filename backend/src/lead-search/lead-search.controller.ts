import { Controller, Get, Param, Post, Query, Body } from '@nestjs/common';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { SearchLeadsDto } from './dto/search-leads.dto';
import { LeadSearchService } from './lead-search.service';

@Controller('leads')
export class LeadSearchController {
  constructor(private readonly leadSearchService: LeadSearchService) {}

  @Post('search')
  search(@Body() dto: SearchLeadsDto) {
    return this.leadSearchService.startSearch(dto);
  }

  @Get('search/:jobId')
  getSearchJob(@Param('jobId') jobId: string) {
    return this.leadSearchService.getSearchJob(jobId);
  }

  @Get()
  list(@Query() query: ListLeadsDto) {
    return this.leadSearchService.listLeads(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.leadSearchService.getLead(id);
  }

  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadSearchService.createLead(dto);
  }
}
