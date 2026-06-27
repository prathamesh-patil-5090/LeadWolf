import { LeadSearchCriteria } from '../interfaces/lead-search-provider.interface';

function dedupeTerms(terms: Array<string | undefined>) {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const term of terms) {
    const trimmed = term?.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(trimmed);
  }

  return unique;
}

export function buildLinkedInDiscoveryKeyword(
  criteria: LeadSearchCriteria,
): string {
  return dedupeTerms([
    criteria.query,
    criteria.role,
    ...(criteria.roles ?? []),
    criteria.location,
    criteria.company,
  ]).join(' ');
}

export function buildDiscoveryQuery(criteria: LeadSearchCriteria): string {
  return [
    'site:linkedin.com/in',
    ...dedupeTerms([
      criteria.query,
      criteria.role,
      ...(criteria.roles ?? []),
      criteria.location,
      criteria.company,
    ]),
  ].join(' ');
}

export function buildLangSearchQuery(criteria: LeadSearchCriteria): string {
  const terms = dedupeTerms([
    criteria.role,
    ...(criteria.roles ?? []),
    criteria.query,
    criteria.company,
    criteria.location,
  ]);

  if (terms.length === 0) {
    return '';
  }

  return `LinkedIn profile ${terms.join(' ')}`.trim();
}

export function buildLangSearchQueryVariants(criteria: LeadSearchCriteria) {
  const terms = dedupeTerms([
    criteria.role,
    ...(criteria.roles ?? []),
    criteria.query,
    criteria.company,
    criteria.location,
  ]);

  const variants = [
    buildLangSearchQuery(criteria),
    terms.length ? `${terms.join(' ')} LinkedIn` : '',
    terms.length ? `linkedin.com/in ${terms.join(' ')}` : '',
  ].filter(Boolean);

  return [...new Set(variants)];
}

export function buildCseDiscoveryQuery(criteria: LeadSearchCriteria): string {
  return dedupeTerms([
    criteria.query,
    criteria.role,
    ...(criteria.roles ?? []),
    criteria.location,
    criteria.company,
  ]).join(' ');
}
