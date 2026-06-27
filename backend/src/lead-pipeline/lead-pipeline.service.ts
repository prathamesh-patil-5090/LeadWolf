import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Lead } from '../../generated/prisma/client';
import { LeadCompanyDiscoveryService } from '../lead-company-discovery/lead-company-discovery.service';
import { LeadContactDiscoveryService } from '../lead-contact-discovery/lead-contact-discovery.service';
import { LeadContactVerificationService } from '../lead-contact-verification/lead-contact-verification.service';
import { LeadEmailPersonalizationService } from '../lead-email-personalization/lead-email-personalization.service';
import { LeadEnrichmentService } from '../lead-enrichment/lead-enrichment.service';
import { LEAD_PIPELINE_AUTO } from './constants';

@Injectable()
export class LeadPipelineService {
  private readonly logger = new Logger(LeadPipelineService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly enrichmentService: LeadEnrichmentService,
    private readonly companyDiscoveryService: LeadCompanyDiscoveryService,
    private readonly contactDiscoveryService: LeadContactDiscoveryService,
    private readonly contactVerificationService: LeadContactVerificationService,
    private readonly emailPersonalizationService: LeadEmailPersonalizationService,
  ) {}

  isAutoEnabled(): boolean {
    return this.configService.get<string>(LEAD_PIPELINE_AUTO, 'true') === 'true';
  }

  async processLead(lead: Lead): Promise<Lead> {
    this.logger.log(`Pipeline start for lead ${lead.id} (${lead.name})`);

    let current = await this.enrichmentService.enrichLead(lead);
    const companyResult = await this.companyDiscoveryService.discoverForLead(
      current,
      false,
    );
    current = companyResult.lead;

    const contactResult =
      await this.contactDiscoveryService.discoverForLead(current);
    current = contactResult.lead;

    if (current.email) {
      const verifyResult =
        await this.contactVerificationService.verifyByLeadId(current.id);
      current = verifyResult.lead;
    }

    if (current.verified && current.email) {
      const emailResult = await this.emailPersonalizationService.generateByLeadId(
        current.id,
      );
      if (!emailResult.skipped) {
        current = emailResult.lead;
      }
    }

    this.logger.log(
      `Pipeline done for lead ${lead.id} → ${current.status}`,
    );

    return current;
  }

  async processLeads(leads: Lead[]): Promise<Lead[]> {
    const processed: Lead[] = [];

    for (const lead of leads) {
      processed.push(await this.processLead(lead));
    }

    return processed;
  }
}
