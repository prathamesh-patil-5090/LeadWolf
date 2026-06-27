import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ContactVerificationEngine } from './contact-verification.engine';
import { LEAD_CONTACT_VERIFICATION_QUEUE } from './constants';
import { LeadContactVerificationController } from './lead-contact-verification.controller';
import { LeadContactVerificationProcessor } from './lead-contact-verification.processor';
import { LeadContactVerificationService } from './lead-contact-verification.service';

@Module({})
export class LeadContactVerificationModule {
  static register(): DynamicModule {
    const useQueue =
      (process.env.LEAD_CONTACT_VERIFICATION_SYNC ?? 'true') !== 'true' &&
      Boolean(process.env.REDIS_URL);

    return {
      module: LeadContactVerificationModule,
      imports: useQueue
        ? [BullModule.registerQueue({ name: LEAD_CONTACT_VERIFICATION_QUEUE })]
        : [],
      controllers: [LeadContactVerificationController],
      providers: [
        LeadContactVerificationService,
        ContactVerificationEngine,
        ...(useQueue ? [LeadContactVerificationProcessor] : []),
      ],
      exports: [LeadContactVerificationService],
    };
  }
}
