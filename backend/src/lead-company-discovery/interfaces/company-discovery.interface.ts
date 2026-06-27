export type { DiscoveredContact } from '../../shared/email/email.utils';

export interface CompanyScrapeResult {
  website: string;
  domain: string;
  pagesScraped: string[];
  textContent: string;
  emails: import('../../shared/email/email.utils').DiscoveredContact[];
}

export interface CompanySummaryResult {
  summary: string;
  industry?: string;
  products?: string;
  personalizationHooks: string[];
}
