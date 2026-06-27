import { Type } from 'class-transformer';
import { LeadStatus } from '../../../generated/prisma/client';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class VerifyContactsDto {
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
}
