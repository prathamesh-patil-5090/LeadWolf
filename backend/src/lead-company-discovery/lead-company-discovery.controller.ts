import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DiscoverCompanyDto } from './dto/discover-company.dto';
import { LeadCompanyDiscoveryService } from './lead-company-discovery.service';

class ListCompaniesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

@Controller()
export class LeadCompanyDiscoveryController {
  constructor(
    private readonly companyDiscoveryService: LeadCompanyDiscoveryService,
  ) {}

  @Post('leads/discover-company')
  discoverBatch(@Body() dto: DiscoverCompanyDto) {
    return this.companyDiscoveryService.startBatchDiscovery(dto);
  }

  @Post('leads/:id/discover-company')
  discoverOne(
    @Param('id') id: string,
    @Body() body: { resummarize?: boolean },
  ) {
    return this.companyDiscoveryService.discoverByLeadId(
      id,
      body?.resummarize ?? false,
    );
  }

  @Get('companies')
  listCompanies(@Query() query: ListCompaniesQuery) {
    return this.companyDiscoveryService.listCompanies(
      query.page ?? 1,
      query.pageSize ?? 20,
    );
  }

  @Get('companies/:id')
  getCompany(@Param('id') id: string) {
    return this.companyDiscoveryService.getCompany(id);
  }
}
