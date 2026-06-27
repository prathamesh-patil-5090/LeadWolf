import { Type } from 'class-transformer';
import { LeadStatus } from '../../../generated/prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class DiscoverCompanyDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadIds?: string[];

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsBoolean()
  resummarize?: boolean;
}
