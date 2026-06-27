import { DiscoveredLead } from '../../lead-search/interfaces/lead-search-provider.interface';
import { EnrichmentData } from '../../lead-enrichment/interfaces/enrichment-result.interface';
import { normalizeProfileUrl } from '../../lead-search/utils/linkedin-result.parser';

export interface BrightDataLinkedInRecord {
  url?: string;
  input_url?: string;
  profile_link?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  subtitle?: string;
  position?: string | null;
  city?: string;
  location?: string;
  country_code?: string;
  about?: string | null;
  current_company?: { name?: string; link?: string } | null;
  current_company_name?: string;
  bio_links?: Array<{ link?: string; title?: string }> | null;
  experience?: Array<{ title?: string; company?: string }> | null;
}

export function mapBrightDataRecordToDiscoveredLead(
  record: BrightDataLinkedInRecord,
): DiscoveredLead | null {
  const profileUrl = resolveProfileUrl(record);
  if (!profileUrl) {
    return null;
  }

  const name = resolveName(record);
  const { role, company } = resolveRoleAndCompany(record);
  const website = resolveWebsite(record);

  return {
    name,
    role,
    company,
    profileUrl,
    linkedinUrl: profileUrl,
    location: resolveLocation(record),
    website,
  };
}

export function mapBrightDataRecordToEnrichment(
  record: BrightDataLinkedInRecord,
): EnrichmentData {
  const lead = mapBrightDataRecordToDiscoveredLead(record);
  if (!lead) {
    return {};
  }

  return {
    role: lead.role,
    company: lead.company,
    location: lead.location,
    website: lead.website,
    linkedinUrl: lead.linkedinUrl,
  };
}

function resolveProfileUrl(record: BrightDataLinkedInRecord) {
  return (
    normalizeProfileUrl(record.url ?? '') ??
    normalizeProfileUrl(record.input_url ?? '') ??
    normalizeProfileUrl(record.profile_link ?? '')
  );
}

function resolveName(record: BrightDataLinkedInRecord) {
  if (record.name?.trim()) {
    return record.name.trim();
  }

  const parts = [record.first_name, record.last_name]
    .map((part) => part?.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : 'Unknown';
}

function resolveRoleAndCompany(record: BrightDataLinkedInRecord) {
  const fromPosition = parsePosition(record.position ?? undefined);
  if (fromPosition.role !== 'Unknown' || fromPosition.company !== 'Unknown') {
    return fromPosition;
  }

  const fromSubtitle = parsePosition(record.subtitle ?? undefined);
  if (fromSubtitle.role !== 'Unknown' || fromSubtitle.company !== 'Unknown') {
    return fromSubtitle;
  }

  const latestExperience = record.experience?.find(
    (entry) => entry.title?.trim() || entry.company?.trim(),
  );

  if (latestExperience) {
    return {
      role: latestExperience.title?.trim() || 'Unknown',
      company: latestExperience.company?.trim() || 'Unknown',
    };
  }

  const company =
    record.current_company?.name?.trim() ||
    record.current_company_name?.trim() ||
    'Unknown';

  return { role: 'Unknown', company };
}

function parsePosition(value?: string) {
  if (!value?.trim()) {
    return { role: 'Unknown', company: 'Unknown' };
  }

  const trimmed = value.trim();
  const atMatch = trimmed.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch) {
    return {
      role: atMatch[1].trim() || 'Unknown',
      company: atMatch[2].trim() || 'Unknown',
    };
  }

  const dashParts = trimmed
    .split(/\s+[-–—|]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (dashParts.length >= 2) {
    return {
      role: dashParts[0] || 'Unknown',
      company: dashParts[dashParts.length - 1] || 'Unknown',
    };
  }

  return { role: trimmed, company: 'Unknown' };
}

function resolveLocation(record: BrightDataLinkedInRecord) {
  return record.city?.trim() || record.location?.trim() || undefined;
}

function resolveWebsite(record: BrightDataLinkedInRecord) {
  for (const link of record.bio_links ?? []) {
    const url = link.link?.trim();
    if (url && !url.includes('linkedin.com')) {
      return url;
    }
  }

  return undefined;
}
