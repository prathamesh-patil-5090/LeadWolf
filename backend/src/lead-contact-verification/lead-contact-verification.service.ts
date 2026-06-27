import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Lead, LeadStatus, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContactVerificationEngine } from './contact-verification.engine';
import { LEAD_CONTACT_VERIFICATION_QUEUE } from './constants';
import { VerifyContactsDto } from './dto/verify-contacts.dto';

@Injectable()
export class LeadContactVerificationService {
  private readonly logger = new Logger(LeadContactVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly verificationEngine: ContactVerificationEngine,
    @Optional()
    @InjectQueue(LEAD_CONTACT_VERIFICATION_QUEUE)
    private readonly verificationQueue?: Queue,
  ) {}

  async verifyByLeadId(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { companyRecord: { select: { domain: true } } },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.verifyForLead(lead);
  }

  async startBatchVerification(dto: VerifyContactsDto) {
    const limit = dto.limit ?? 25;
    const leads = await this.resolveLeads(dto, limit);

    if (this.shouldRunSynchronously()) {
      const results = [];
      for (const lead of leads) {
        const fullLead = await this.prisma.lead.findUnique({
          where: { id: lead.id },
          include: { companyRecord: { select: { domain: true } } },
        });
        if (fullLead) {
          results.push(await this.verifyForLead(fullLead));
        }
      }

      return { processed: results.length, results };
    }

    for (const lead of leads) {
      await this.verificationQueue!.add(
        'verify',
        { leadId: lead.id },
        {
          jobId: `verify-${lead.id}-${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    }

    return {
      queued: leads.length,
      leadIds: leads.map((lead) => lead.id),
    };
  }

  async verifyForLead(
    lead: Lead & { companyRecord?: { domain: string } | null },
  ) {
    if (!lead.email) {
      this.logger.warn(`No email to verify for lead ${lead.id}`);
      return {
        lead,
        skipped: true,
        reason: 'no_email',
        verification: null,
      };
    }

    const companyDomain = this.verificationEngine.resolveCompanyDomain(
      lead.companyWebsite,
      lead.companyRecord?.domain,
    );

    const verification = await this.verificationEngine.verify(
      lead.email,
      companyDomain,
    );

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        email: verification.email,
        verified: verification.verified,
        contactConfidence: verification.confidence,
        verificationDetails: verification as unknown as Prisma.InputJsonValue,
        status: verification.verified
          ? LeadStatus.VERIFIED
          : lead.status === LeadStatus.CONTACT_FOUND
            ? LeadStatus.CONTACT_FOUND
            : lead.status,
      },
    });

    this.logger.log(
      `Verified lead ${lead.id} → verified=${verification.verified}, confidence=${verification.confidence}`,
    );

    return {
      lead: updatedLead,
      skipped: false,
      verification,
    };
  }

  private async resolveLeads(dto: VerifyContactsDto, limit: number) {
    if (dto.leadIds?.length) {
      return this.prisma.lead.findMany({
        where: { id: { in: dto.leadIds } },
        take: limit,
      });
    }

    return this.prisma.lead.findMany({
      where: {
        status: dto.status ?? LeadStatus.CONTACT_FOUND,
        email: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private shouldRunSynchronously() {
    return (
      this.configService.get<string>(
        'LEAD_CONTACT_VERIFICATION_SYNC',
        'true',
      ) === 'true'
    );
  }
}
