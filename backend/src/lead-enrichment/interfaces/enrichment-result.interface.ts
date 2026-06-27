import { Lead } from '../../../generated/prisma/client';

export interface EnrichmentData {
  location?: string;
  website?: string;
  portfolioUrl?: string;
  companyWebsite?: string;
  companySize?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  email?: string;
  role?: string;
  company?: string;
}

export type LeadEnrichmentInput = Pick<
  Lead,
  | 'name'
  | 'role'
  | 'company'
  | 'profileUrl'
  | 'githubUrl'
  | 'website'
  | 'email'
  | 'linkedinUrl'
  | 'location'
  | 'portfolioUrl'
  | 'companyWebsite'
  | 'companySize'
>;

export interface LeadEnricher {
  enrich(input: LeadEnrichmentInput): Promise<EnrichmentData>;
}
