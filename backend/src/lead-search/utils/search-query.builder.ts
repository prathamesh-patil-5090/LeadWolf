import { LeadSearchCriteria } from '../interfaces/lead-search-provider.interface';

export function buildDiscoveryQuery(criteria: LeadSearchCriteria): string {
  const terms = [
    'site:linkedin.com/in',
    criteria.query,
    criteria.role,
    criteria.location,
    criteria.company,
  ].filter((term): term is string => Boolean(term?.trim()));

  return terms.join(' ');
}

export function buildCseDiscoveryQuery(criteria: LeadSearchCriteria): string {
  const terms = [
    criteria.query,
    criteria.role,
    criteria.location,
    criteria.company,
  ].filter((term): term is string => Boolean(term?.trim()));

  return terms.join(' ');
}
