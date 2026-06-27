import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { LeadStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildSenderSignatureBlock,
  loadSenderSignatureConfig,
  refreshEmailSignature,
} from '../lead-email-personalization/utils/sender-signature.util';
import { BrevoEmailClient } from './brevo-email.client';
import { LEAD_CAMPAIGN_SENDING_QUEUE } from './constants';
import { SendCampaignDto } from './dto/send-campaign.dto';

@Injectable()
export class LeadCampaignSendingService {
  private readonly logger = new Logger(LeadCampaignSendingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly brevoClient: BrevoEmailClient,
    @Optional()
    @InjectQueue(LEAD_CAMPAIGN_SENDING_QUEUE)
    private readonly sendQueue?: Queue,
  ) {}

  async sendByLeadId(leadId: string, force = false) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        outreachEmails: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${leadId} not found`);
    }

    return this.sendForLead(lead, force);
  }

  async startBatchSend(dto: SendCampaignDto) {
    const limit = dto.limit ?? 25;
    const leads = await this.resolveLeads(dto, limit);

    if (this.shouldRunSynchronously()) {
      const results = [];
      for (const lead of leads) {
        const fullLead = await this.prisma.lead.findUnique({
          where: { id: lead.id },
          include: {
            outreachEmails: { where: { isPrimary: true }, take: 1 },
          },
        });
        if (fullLead) {
          results.push(await this.sendForLead(fullLead, dto.force ?? false));
        }
      }

      return { processed: results.length, results };
    }

    for (const lead of leads) {
      await this.sendQueue!.add(
        'send',
        { leadId: lead.id, force: dto.force ?? false },
        {
          jobId: `send-${lead.id}-${Date.now()}`,
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

  private async sendForLead(
    lead: {
      id: string;
      name: string;
      email: string | null;
      status: LeadStatus;
      outreachEmails: Array<{
        id: string;
        subject: string;
        body: string;
        sentAt: Date | null;
        error: string | null;
      }>;
    },
    force: boolean,
  ) {
    const outreachEmail = lead.outreachEmails[0];
    if (!outreachEmail?.subject || !outreachEmail.body || outreachEmail.error) {
      throw new BadRequestException(
        `Lead ${lead.id} has no primary outreach email ready to send`,
      );
    }

    if (outreachEmail.sentAt && !force) {
      return {
        lead,
        skipped: true,
        reason: 'already_sent',
        outreachEmail,
      };
    }

    const recipient = this.resolveRecipient(lead.name, lead.email);
    const sender = loadSenderSignatureConfig(this.configService);
    const signatureBlock = buildSenderSignatureBlock(sender);
    const bodyWithSignature = refreshEmailSignature(
      outreachEmail.body,
      signatureBlock,
    );

    const subject = recipient.testMode
      ? `[TEST for ${lead.name}] ${outreachEmail.subject}`
      : outreachEmail.subject;

    const testBanner = recipient.testMode
      ? `--- TEST MODE ---\nThis email was generated for lead: ${lead.name}\nOriginal recipient would be: ${lead.email ?? 'unknown'}\n---\n\n`
      : '';

    try {
      const replyToEmail = this.resolveReplyToEmail(lead.id, sender.senderEmail);

      const result = await this.brevoClient.sendTransactionalEmail({
        senderName: sender.senderName,
        senderEmail: sender.senderEmail,
        toEmail: recipient.email,
        toName: recipient.name,
        subject,
        textContent: `${testBanner}${bodyWithSignature}`,
        replyToEmail,
        leadId: lead.id,
        outreachEmailId: outreachEmail.id,
      });

      const updatedEmail = await this.prisma.outreachEmail.update({
        where: { id: outreachEmail.id },
        data: {
          body: bodyWithSignature,
          sentAt: new Date(),
          sentTo: recipient.email,
          brevoMessageId: result.messageId,
          sendError: null,
        },
      });

      const updatedLead = await this.prisma.lead.update({
        where: { id: lead.id },
        data: { status: LeadStatus.SENT },
      });

      this.logger.log(
        `Sent email for lead ${lead.id} → ${recipient.email} (testMode=${recipient.testMode}) messageId=${result.messageId}`,
      );

      return {
        lead: updatedLead,
        skipped: false,
        testMode: recipient.testMode,
        intendedRecipient: lead.email,
        actualRecipient: recipient.email,
        brevoMessageId: result.messageId,
        outreachEmail: updatedEmail,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Brevo send failed';

      await this.prisma.outreachEmail.update({
        where: { id: outreachEmail.id },
        data: { sendError: message },
      });

      throw new BadRequestException(message);
    }
  }

  private resolveReplyToEmail(leadId: string, senderEmail: string) {
    const replyDomain = this.configService.get<string>('BREVO_REPLY_DOMAIN');
    if (replyDomain?.trim()) {
      return `lead+${leadId}@${replyDomain.trim().toLowerCase()}`;
    }

    return senderEmail?.trim() || undefined;
  }

  private resolveRecipient(leadName: string, leadEmail: string | null) {
    const testMode =
      this.configService.get<string>('BREVO_TEST_MODE', 'true') === 'true';
    const testRecipient = this.configService.get<string>(
      'BREVO_TEST_RECIPIENT',
      'prathampatil8421@gmail.com',
    );

    if (testMode) {
      if (!testRecipient?.trim()) {
        throw new BadRequestException(
          'BREVO_TEST_MODE is on but BREVO_TEST_RECIPIENT is empty',
        );
      }

      return {
        email: testRecipient.trim().toLowerCase(),
        name: 'Test Recipient',
        testMode: true,
      };
    }

    if (!leadEmail) {
      throw new BadRequestException('Lead has no email address to send to');
    }

    return {
      email: leadEmail.trim().toLowerCase(),
      name: leadName,
      testMode: false,
    };
  }

  private async resolveLeads(dto: SendCampaignDto, limit: number) {
    if (dto.leadIds?.length) {
      return this.prisma.lead.findMany({
        where: { id: { in: dto.leadIds } },
        take: limit,
      });
    }

    return this.prisma.lead.findMany({
      where: {
        status: dto.status ?? LeadStatus.EMAIL_GENERATED,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private shouldRunSynchronously() {
    return (
      this.configService.get<string>('LEAD_CAMPAIGN_SENDING_SYNC', 'true') ===
      'true'
    );
  }
}
