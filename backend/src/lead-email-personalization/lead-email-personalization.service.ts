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
import { LeadCampaignSendingService } from '../lead-campaign-sending/lead-campaign-sending.service';
import { GmailReplySyncService } from '../lead-analytics/gmail-reply-sync.service';
import { SplitEmailGenerationService } from './services/split-email-generation.service';
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
    private readonly splitGeneration: SplitEmailGenerationService,
    private readonly campaignSendingService: LeadCampaignSendingService,
    private readonly gmailReplySyncService: GmailReplySyncService,
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
    const assignedProvider = this.splitGeneration.resolveProvider(lead.id);
    const result = await this.splitGeneration.generateForLead(lead.id, context);

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
        isPrimary: true,
      },
    });

    const successful = !saved.error && saved.subject && saved.body;

    const updatedLead = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: successful ? LeadStatus.EMAIL_GENERATED : lead.status,
      },
    });

    this.logger.log(
      `Generated email for lead ${lead.id} via ${assignedProvider} (success=${successful})`,
    );

    if (!successful) {
      return {
        lead: updatedLead,
        skipped: false,
        assignedProvider,
        emails: [saved],
        providers: [
          {
            provider: result.provider,
            model: result.model,
            success: false,
            latencyMs: result.latencyMs,
            error: result.error,
          },
        ],
      };
    }

    const sendResult = await this.autoSendAfterGeneration(lead.id, regenerate);

    const finalLead = await this.prisma.lead.findUniqueOrThrow({
      where: { id: lead.id },
    });

    return {
      lead: finalLead,
      skipped: false,
      assignedProvider,
      emails: [saved],
      send: sendResult,
      providers: [
        {
          provider: result.provider,
          model: result.model,
          success: true,
          latencyMs: result.latencyMs,
          error: result.error,
        },
      ],
    };
  }

  private async autoSendAfterGeneration(leadId: string, forceResend: boolean) {
    if (
      this.configService.get<string>('LEAD_PIPELINE_AUTO_SEND', 'true') !== 'true'
    ) {
      return { skipped: true, reason: 'auto_send_disabled' };
    }

    try {
      const sendResult = await this.campaignSendingService.sendByLeadId(
        leadId,
        forceResend,
      );

      if (sendResult.skipped) {
        return sendResult;
      }

      this.logger.log(
        `Auto-sent email for lead ${leadId} → ${sendResult.actualRecipient} (testMode=${sendResult.testMode})`,
      );

      if (
        this.configService.get<string>('LEAD_PIPELINE_AUTO_GMAIL_SYNC', 'true') ===
        'true'
      ) {
        try {
          await this.gmailReplySyncService.syncReplyForLead(leadId);
        } catch (error) {
          this.logger.warn(
            `Gmail sync after send failed for ${leadId}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }

      return sendResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Brevo send failed';

      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.FAILED_CAMPAIGN_SENDING,
          pipelineFailedStep: 'CAMPAIGN_SENDING',
          pipelineError: message.slice(0, 2000),
          pipelineFailedAt: new Date(),
        },
      });

      this.logger.warn(`Auto-send failed for lead ${leadId}: ${message}`);
      return { skipped: false, error: message };
    }
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
