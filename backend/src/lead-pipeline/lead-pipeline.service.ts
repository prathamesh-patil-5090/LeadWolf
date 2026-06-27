import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lead, LeadStatus, PipelineStep } from '../../generated/prisma/client';
import { LeadCampaignSendingService } from '../lead-campaign-sending/lead-campaign-sending.service';
import { LeadCompanyDiscoveryService } from '../lead-company-discovery/lead-company-discovery.service';
import { LeadContactDiscoveryService } from '../lead-contact-discovery/lead-contact-discovery.service';
import { LeadContactVerificationService } from '../lead-contact-verification/lead-contact-verification.service';
import { LeadEmailPersonalizationService } from '../lead-email-personalization/lead-email-personalization.service';
import { LeadEnrichmentService } from '../lead-enrichment/lead-enrichment.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeadAnalyticsModule } from '../lead-analytics/lead-analytics.module';
import { GmailReplySyncService } from '../lead-analytics/gmail-reply-sync.service';
import {
  LEAD_PIPELINE_AUTO,
  LEAD_PIPELINE_AUTO_GMAIL_SYNC,
  LEAD_PIPELINE_AUTO_SEND,
  PIPELINE_FAILED_STATUS,
} from './constants';
import {
  PipelineStepError,
  toPipelineStepError,
} from './pipeline-step.error';
import {
  resolvePipelineStartStep,
  shouldRunPipelineStep,
} from './pipeline-step.util';

@Injectable()
export class LeadPipelineService {
  private readonly logger = new Logger(LeadPipelineService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly enrichmentService: LeadEnrichmentService,
    private readonly companyDiscoveryService: LeadCompanyDiscoveryService,
    private readonly contactDiscoveryService: LeadContactDiscoveryService,
    private readonly contactVerificationService: LeadContactVerificationService,
    private readonly emailPersonalizationService: LeadEmailPersonalizationService,
    private readonly campaignSendingService: LeadCampaignSendingService,
    private readonly gmailReplySyncService: GmailReplySyncService,
  ) {}

  isAutoEnabled(): boolean {
    return this.configService.get<string>(LEAD_PIPELINE_AUTO, 'true') === 'true';
  }

  isAutoSendEnabled(): boolean {
    return (
      this.configService.get<string>(LEAD_PIPELINE_AUTO_SEND, 'true') === 'true'
    );
  }

  isAutoGmailSyncEnabled(): boolean {
    return (
      this.configService.get<string>(LEAD_PIPELINE_AUTO_GMAIL_SYNC, 'true') ===
      'true'
    );
  }

  async processLead(lead: Lead): Promise<Lead> {
    return this.processLeadById(lead.id);
  }

  async processLeadById(
    leadId: string,
    resumeFromStep?: PipelineStep,
  ): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    const startStep = resolvePipelineStartStep(lead, resumeFromStep);
    if (!startStep) {
      this.logger.debug(`Lead ${leadId} already completed pipeline`);
      return lead;
    }

    this.logger.log(
      `Pipeline start for lead ${leadId} (${lead.name}) from ${startStep}`,
    );

    let current = lead;

    try {
      if (shouldRunPipelineStep(PipelineStep.ENRICHMENT, startStep)) {
        current = await this.runStep(PipelineStep.ENRICHMENT, async () => {
          return this.enrichmentService.enrichLead(current);
        });
      }

      if (shouldRunPipelineStep(PipelineStep.COMPANY_DISCOVERY, startStep)) {
        const companyResult = await this.runStep(
          PipelineStep.COMPANY_DISCOVERY,
          async () => this.companyDiscoveryService.discoverForLead(current, false),
        );
        current = companyResult.lead;
      }

      if (shouldRunPipelineStep(PipelineStep.CONTACT_DISCOVERY, startStep)) {
        const contactResult = await this.runStep(
          PipelineStep.CONTACT_DISCOVERY,
          async () => this.contactDiscoveryService.discoverForLead(current),
        );
        current = contactResult.lead;

        if (!current.email) {
          throw new PipelineStepError(
            PipelineStep.CONTACT_DISCOVERY,
            'No contact email discovered',
            false,
          );
        }
      }

      if (
        shouldRunPipelineStep(PipelineStep.VERIFICATION, startStep) &&
        current.email
      ) {
        const verifyResult = await this.runStep(
          PipelineStep.VERIFICATION,
          async () => this.contactVerificationService.verifyByLeadId(current.id),
        );
        current = verifyResult.lead;

        if (!current.verified) {
          throw new PipelineStepError(
            PipelineStep.VERIFICATION,
            `Contact verification failed (confidence ${current.contactConfidence ?? 0})`,
            false,
          );
        }
      }

      if (
        shouldRunPipelineStep(PipelineStep.EMAIL_GENERATION, startStep) &&
        current.verified &&
        current.email
      ) {
        const emailResult = await this.runStep(
          PipelineStep.EMAIL_GENERATION,
          async () =>
            this.emailPersonalizationService.generateByLeadId(current.id),
        );
        current = emailResult.lead;

        if (emailResult.skipped) {
          if (emailResult.reason === 'already_generated') {
            // resume — primary email already exists
          } else {
            throw new PipelineStepError(
              PipelineStep.EMAIL_GENERATION,
              `Email generation skipped: ${emailResult.reason ?? 'unknown'}`,
              false,
            );
          }
        } else if (
          !emailResult.emails?.some((email) => !email.error && email.subject)
        ) {
          const providerErrors =
            emailResult.providers
              ?.map((entry) => `${entry.provider}: ${entry.error ?? 'failed'}`)
              .filter(Boolean)
              .join('; ') ?? 'No provider generated a valid email';

          throw new PipelineStepError(
            PipelineStep.EMAIL_GENERATION,
            providerErrors,
            /rate.?limit|429|daily limit/i.test(providerErrors),
          );
        }
      }

      if (
        this.isAutoSendEnabled() &&
        shouldRunPipelineStep(PipelineStep.CAMPAIGN_SENDING, startStep)
      ) {
        await this.runStep(PipelineStep.CAMPAIGN_SENDING, async () => {
          const sendResult = await this.campaignSendingService.sendByLeadId(
            current.id,
          );

          if (sendResult.skipped && sendResult.reason !== 'already_sent') {
            throw new PipelineStepError(
              PipelineStep.CAMPAIGN_SENDING,
              `Send skipped: ${sendResult.reason ?? 'unknown'}`,
              false,
            );
          }

          return sendResult;
        });

        current = await this.prisma.lead.findUniqueOrThrow({
          where: { id: current.id },
        });
      }

      if (
        this.isAutoGmailSyncEnabled() &&
        shouldRunPipelineStep(PipelineStep.GMAIL_SYNC, startStep) &&
        (current.status === LeadStatus.SENT || current.status === LeadStatus.OPENED)
      ) {
        try {
          await this.gmailReplySyncService.syncReplyForLead(current.id);
        } catch (error) {
          this.logger.warn(
            `Gmail sync failed for lead ${current.id}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }

        current = await this.prisma.lead.findUniqueOrThrow({
          where: { id: current.id },
        });
      }

      await this.clearPipelineFailure(current.id);

      this.logger.log(`Pipeline done for lead ${leadId} → ${current.status}`);
      return current;
    } catch (error) {
      const stepError = error instanceof PipelineStepError
        ? error
        : toPipelineStepError(startStep, error);

      await this.markPipelineFailure(leadId, stepError);
      throw stepError;
    }
  }

  private async runStep<T>(
    step: PipelineStep,
    action: () => Promise<T>,
  ): Promise<T> {
    try {
      const result = await action();
      await this.clearPipelineFailureOnStep(step);
      return result;
    } catch (error) {
      throw toPipelineStepError(step, error);
    }
  }

  private async markPipelineFailure(leadId: string, error: PipelineStepError) {
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: PIPELINE_FAILED_STATUS[error.step],
        pipelineFailedStep: error.step,
        pipelineError: error.message.slice(0, 2000),
        pipelineFailedAt: new Date(),
        pipelineRetryCount: { increment: 1 },
      },
    });

    this.logger.warn(
      `Pipeline failed for lead ${leadId} at ${error.step}: ${error.message}`,
    );
  }

  private async clearPipelineFailure(leadId: string) {
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineFailedStep: null,
        pipelineError: null,
        pipelineFailedAt: null,
      },
    });
  }

  private async clearPipelineFailureOnStep(step: PipelineStep) {
    // cleared on full success; partial clears happen via successful step progression
    void step;
  }
}
