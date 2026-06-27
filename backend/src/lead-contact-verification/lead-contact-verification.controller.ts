import { Body, Controller, Param, Post } from '@nestjs/common';
import { VerifyContactsDto } from './dto/verify-contacts.dto';
import { LeadContactVerificationService } from './lead-contact-verification.service';

@Controller('leads')
export class LeadContactVerificationController {
  constructor(
    private readonly verificationService: LeadContactVerificationService,
  ) {}

  @Post('verify')
  verifyBatch(@Body() dto: VerifyContactsDto) {
    return this.verificationService.startBatchVerification(dto);
  }

  @Post(':id/verify')
  verifyOne(@Param('id') id: string) {
    return this.verificationService.verifyByLeadId(id);
  }
}
