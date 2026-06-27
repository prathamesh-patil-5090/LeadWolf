import { Injectable } from '@nestjs/common';
import { Lead } from '../../../generated/prisma/client';
import { BrightDataService } from '../../shared/bright-data/bright-data.service';
import { EnrichmentData } from '../interfaces/enrichment-result.interface';

@Injectable()
export class BrightDataLinkedInEnricher {
  constructor(private readonly brightDataService: BrightDataService) {}

  async enrich(lead: Lead): Promise<EnrichmentData> {
    if (!this.brightDataService.isConfigured()) {
      return {};
    }

    const linkedinUrl = lead.linkedinUrl ?? this.resolveLinkedInProfileUrl(lead.profileUrl);
    if (!linkedinUrl) {
      return {};
    }

    if (lead.profileUrl.includes('linkedin.com/in/')) {
      return {};
    }

    if (
      lead.linkedinUrl &&
      lead.location &&
      !this.isUnknown(lead.role) &&
      !this.isUnknown(lead.company)
    ) {
      return {};
    }

    const profile = await this.brightDataService.collectLinkedInProfile(linkedinUrl);
    if (!profile) {
      return {};
    }

    return {
      role: profile.role,
      company: profile.company,
      location: profile.location,
      website: profile.website,
      linkedinUrl: profile.linkedinUrl,
    };
  }

  private resolveLinkedInProfileUrl(profileUrl: string) {
    return profileUrl.includes('linkedin.com/in/') ? profileUrl : undefined;
  }

  private isUnknown(value: string) {
    return !value?.trim() || value.trim().toLowerCase() === 'unknown';
  }
}
