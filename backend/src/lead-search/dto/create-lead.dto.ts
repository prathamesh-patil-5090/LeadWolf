import { IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  role!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  company!: string;

  @IsUrl()
  profileUrl!: string;
}
