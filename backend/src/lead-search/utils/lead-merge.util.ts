import { DiscoveredLead } from '../interfaces/lead-search-provider.interface';
import { normalizeProfileUrl } from './linkedin-result.parser';

function normalizeLinkedIn(url?: string) {
  return url ? normalizeProfileUrl(url) : null;
}

function isUnknown(value?: string) {
  return !value?.trim() || value.trim().toLowerCase() === 'unknown';
}

function pickBetter(primary?: string, fallback?: string) {
  if (!isUnknown(primary)) {
    return primary!.trim();
  }

  if (!isUnknown(fallback)) {
    return fallback!.trim();
  }

  return primary?.trim() || fallback?.trim() || 'Unknown';
}

function mergePair(
  primary: DiscoveredLead,
  secondary: DiscoveredLead,
): DiscoveredLead {
  const primaryIsGithub = primary.profileUrl.includes('github.com');
  const base = primaryIsGithub ? primary : secondary;
  const extra = primaryIsGithub ? secondary : primary;

  return {
    name: pickBetter(base.name, extra.name),
    role: pickBetter(base.role, extra.role),
    company: pickBetter(base.company, extra.company),
    profileUrl: base.profileUrl,
    email: base.email ?? extra.email,
    website: base.website ?? extra.website,
    githubUrl:
      base.githubUrl ??
      extra.githubUrl ??
      (base.profileUrl.includes('github.com') ? base.profileUrl : undefined),
    linkedinUrl:
      normalizeLinkedIn(extra.linkedinUrl ?? extra.profileUrl) ??
      normalizeLinkedIn(base.linkedinUrl) ??
      undefined,
    location: base.location ?? extra.location,
  };
}

export function mergeDiscoveredLeadSources(
  githubLeads: DiscoveredLead[],
  linkedinLeads: DiscoveredLead[],
) {
  const byLinkedIn = new Map<string, DiscoveredLead>();
  const linkedinOnly: DiscoveredLead[] = [];

  for (const lead of linkedinLeads) {
    const key =
      normalizeLinkedIn(lead.linkedinUrl ?? lead.profileUrl) ??
      lead.profileUrl;
    byLinkedIn.set(key, lead);
  }

  const merged: DiscoveredLead[] = [];
  const consumedLinkedIn = new Set<string>();

  for (const githubLead of githubLeads) {
    const linkedinKey = normalizeLinkedIn(githubLead.linkedinUrl);

    if (linkedinKey && byLinkedIn.has(linkedinKey)) {
      merged.push(mergePair(githubLead, byLinkedIn.get(linkedinKey)!));
      consumedLinkedIn.add(linkedinKey);
      continue;
    }

    merged.push(githubLead);
  }

  for (const lead of linkedinLeads) {
    const key =
      normalizeLinkedIn(lead.linkedinUrl ?? lead.profileUrl) ??
      lead.profileUrl;

    if (consumedLinkedIn.has(key)) {
      continue;
    }

    linkedinOnly.push(lead);
  }

  return [...merged, ...linkedinOnly];
}

export function dedupeDiscoveredLeads(leads: DiscoveredLead[]) {
  const seenProfileUrls = new Set<string>();
  const seenLinkedIn = new Set<string>();
  const unique: DiscoveredLead[] = [];

  for (const lead of leads) {
    if (seenProfileUrls.has(lead.profileUrl)) {
      continue;
    }

    const linkedinKey = normalizeLinkedIn(lead.linkedinUrl ?? lead.profileUrl);
    if (linkedinKey && seenLinkedIn.has(linkedinKey)) {
      continue;
    }

    seenProfileUrls.add(lead.profileUrl);
    if (linkedinKey) {
      seenLinkedIn.add(linkedinKey);
    }

    unique.push(lead);
  }

  return unique;
}
