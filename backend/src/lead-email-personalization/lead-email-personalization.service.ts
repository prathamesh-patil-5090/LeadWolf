import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Lead, LeadStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LEAD_EMAIL_PERSONALIZATION_QUEUE } from './constants';
import { GenerateEmailsDto } from './dto/generate-emails.dto';
import { OutreachEmailContext } from './interfaces/email-generation.interface';
import { ParallelEmailGenerationService } from './services/parallel-email-generation.service';
import {
  ensureEmailSignature,
  loadSenderSignatureConfig,
  toOutreachEmailContext,
} from './utils/sender-signature.util';

type LeadWithCompany = Lead & {
  companyRecord: {
    summary: string | null;
    industry: string | null;
    products: string | null;
    personalizationHooks: unknown;
  } | null;
};

@Injectable()
export class LeadEmailPersonalizationService {
  private readonly logger = new Logger(LeadEmailPersonalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly parallelGeneration: ParallelEmailGenerationService,
    @Optional()
    @InjectQueue(LEAD_EMAIL_PERSONALIZATION_QUEUE)
    private readonly personalizationQueue?: Queue,
  ) {}

  async generateByLeadId(leadId: string, regenerate = false) {
    const lead = await this.loadLead(leadId);
    return this.generateForLead(lead, regenerate);
  }

  async startBatchGeneration(dto: GenerateEmailsDto) {
    const limit = dto.limit ?? 25;
    const leads = await this.resolveLeads(dto, limit);

    if (this.shouldRunSynchronously()) {
      const results = [];
      for (const lead of leads) {
        const fullLead = await this.loadLead(lead.id);
        results.push(
          await this.generateForLead(fullLead, dto.regenerate ?? false),
        );
      }

      return { processed: results.length, results };
    }

    for (const lead of leads) {
      await this.personalizationQueue!.add(
        'generate',
        { leadId: lead.id, regenerate: dto.regenerate ?? false },
        {
          jobId: `email-${lead.id}-${Date.now()}`,
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

  async listEmailsForLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.prisma.outreachEmail.findMany({
      where: { leadId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async generateForLead(lead: LeadWithCompany, regenerate = false) {
    if (!lead.verified || !lead.email) {
      return {
        lead,
        skipped: true,
        reason: !lead.email ? 'no_email' : 'not_verified',
        emails: [],
      };
    }

    if (!regenerate) {
      const existing = await this.prisma.outreachEmail.findMany({
        where: { leadId: lead.id, error: null },
      });
      if (existing.length > 0) {
        return {
          lead,
          skipped: true,
          reason: 'already_generated',
          emails: existing,
        };
      }
    } else {
      await this.prisma.outreachEmail.deleteMany({ where: { leadId: lead.id } });
    }

    const senderConfig = loadSenderSignatureConfig(this.configService);
    const context = toOutreachEmailContext(lead, senderConfig);
    const providerResults =
      await this.parallelGeneration.generateInParallel(context);

    const savedEmails = [];
    for (const result of providerResults) {
      const draft = result.draft
        ? {
            subject: result.draft.subject,
            body: ensureEmailSignature(
              result.draft.body,
              context.signatureBlock,
              context.senderEmail,
            ),
          }
        : undefined;

      const saved = await this.prisma.outreachEmail.create({
        data: {
          leadId: lead.id,
          provider: result.provider,
          model: result.model,
          subject: draft?.subject ?? '',
          body: draft?.body ?? '',
          latencyMs: result.latencyMs,
          error: result.error ?? (draft ? undefined : 'Generation failed'),
        },
      });
      savedEmails.push(saved);
    }

    const successful = savedEmails.filter(
      (email) => !email.error && email.subject && email.body,
    );

    if (successful.length > 0) {
      const fastest = [...successful].sort(
        (a, b) => (a.latencyMs ?? 0) - (b.latencyMs ?? 0),
      )[0];

      await this.prisma.outreachEmail.updateMany({
        where: { leadId: lead.id },
        data: { isPrimary: false },
      });

      await this.prisma.outreachEmail.update({
        where: { id: fastest.id },
        data: { isPrimary: true },
      });
    }

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        status:
          successful.length > 0 ? LeadStatus.EMAIL_GENERATED : lead.status,
      },
    });

    const emails = await this.prisma.outreachEmail.findMany({
      where: { leadId: lead.id },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    this.logger.log(
      `Generated ${successful.length}/${providerResults.length} emails for lead ${lead.id}`,
    );

    return {
      lead: updatedLead,
      skipped: false,
      emails,
      providers: providerResults.map((result) => ({
        provider: result.provider,
        model: result.model,
        success: Boolean(result.draft),
        latencyMs: result.latencyMs,
        error: result.error,
      })),
    };
  }

  private async loadLead(leadId: string): Promise<LeadWithCompany> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        companyRecord: {
          select: {
            summary: true,
            industry: true,
            products: true,
            personalizationHooks: true,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return lead;
  }

  private async resolveLeads(dto: GenerateEmailsDto, limit: number) {
    if (dto.leadIds?.length) {
      return this.prisma.lead.findMany({
        where: { id: { in: dto.leadIds } },
        take: limit,
      });
    }

    return this.prisma.lead.findMany({
      where: {
        status: dto.status ?? LeadStatus.VERIFIED,
        verified: true,
        email: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private shouldRunSynchronously() {
    return (
      this.configService.get<string>(
        'LEAD_EMAIL_PERSONALIZATION_SYNC',
        'true',
      ) === 'true'
    );
  }
}
