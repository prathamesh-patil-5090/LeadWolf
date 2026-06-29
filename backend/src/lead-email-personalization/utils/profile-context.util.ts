import { OutreachEmailContext } from '../interfaces/email-generation.interface';

export function isUnknownLeadField(value?: string | null): boolean {
  if (!value?.trim()) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === 'unknown' ||
    normalized === 'n/a' ||
    normalized === '—' ||
    normalized === '-'
  );
}

export function hasRichCompanyContext(context: OutreachEmailContext): boolean {
  return (
    !isUnknownLeadField(context.companySummary) ||
    !isUnknownLeadField(context.companyIndustry) ||
    !isUnknownLeadField(context.companyProducts) ||
    context.personalizationHooks.some((hook) => hook.trim().length > 0)
  );
}

export function shouldPersonalizeViaProfile(
  context: OutreachEmailContext,
): boolean {
  if (context.addressAsCompanyInbox) {
    return false;
  }

  const sparseProfessional =
    isUnknownLeadField(context.leadRole) ||
    isUnknownLeadField(context.leadCompany);

  if (!sparseProfessional) {
    return false;
  }

  return Boolean(
    context.leadGithub?.trim() ||
      context.leadLinkedin?.trim() ||
      context.leadProfileUrl?.trim(),
  );
}

export function buildProfilePersonalizationHooks(input: {
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  profileUrl?: string | null;
  location?: string | null;
  website?: string | null;
}): string[] {
  const hooks: string[] = [];

  if (input.githubUrl?.trim()) {
    const handle = extractGithubHandle(input.githubUrl);
    hooks.push(
      handle
        ? `GitHub (@${handle}): ${input.githubUrl.trim()} — mention their public engineering work or OSS presence; do not invent specific repo or project names`
        : `GitHub: ${input.githubUrl.trim()} — mention their public engineering work; do not invent specific repo names`,
    );
  }

  if (input.linkedinUrl?.trim()) {
    hooks.push(
      `LinkedIn: ${input.linkedinUrl.trim()} — mention their professional developer profile at a high level; do not invent employers or job titles`,
    );
  }

  if (
    input.profileUrl?.trim() &&
    input.profileUrl.trim() !== input.githubUrl?.trim() &&
    input.profileUrl.trim() !== input.linkedinUrl?.trim()
  ) {
    hooks.push(
      `Profile: ${input.profileUrl.trim()} — use as additional context only`,
    );
  }

  if (input.location?.trim()) {
    hooks.push(`Location: ${input.location.trim()}`);
  }

  if (input.website?.trim()) {
    hooks.push(
      `Personal site: ${input.website.trim()} — optional context only; do not invent details`,
    );
  }

  return hooks;
}

function extractGithubHandle(url: string) {
  const match = url.match(/github\.com\/([^/?#]+)/i);
  const handle = match?.[1];
  if (!handle || ['orgs', 'organizations', 'settings'].includes(handle)) {
    return undefined;
  }

  return handle;
}
