import { getEmailDomain, isFreeEmailDomain } from './free-email-domains';

export interface DiscoveredContact {
  email: string;
  source: string;
  page?: string;
}

const EMAIL_PATTERN =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;

const BLOCKED_EMAIL_PATTERNS = [
  /@users\.noreply\.github\.com$/i,
  /@example\.(com|org|net)$/i,
  /^(noreply|no-reply|donotreply|mailer-daemon)@/i,
  /\.(png|jpg|jpeg|gif|svg|webp)$/i,
  /^.{0,2}@/,
];

const GENERIC_COMPANY_INBOX_LOCAL_PARTS = new Set([
  'info',
  'contact',
  'hello',
  'hi',
  'team',
  'sales',
  'support',
  'help',
  'enquiries',
  'enquiry',
  'inquiries',
  'inquiry',
  'admin',
  'office',
  'careers',
  'jobs',
  'hr',
  'marketing',
  'press',
  'media',
  'billing',
  'accounts',
  'service',
  'customerservice',
  'customer',
  'feedback',
  'general',
  'mail',
  'reception',
  'partners',
  'business',
  'corporate',
  'founder',
  'founders',
]);

/** Shared inboxes like info@company.com — not a named individual. */
export function isGenericCompanyInbox(email?: string | null): boolean {
  const normalized = normalizeEmail(email ?? '');
  if (!normalized) {
    return false;
  }

  const localPart = normalized.split('@')[0]?.split('+')[0] ?? '';
  return GENERIC_COMPANY_INBOX_LOCAL_PARTS.has(localPart);
}

export function normalizeEmail(raw: string): string | undefined {
  if (!raw?.trim()) {
    return undefined;
  }

  let email = raw.trim().toLowerCase();
  email = email.replace(/^mailto:/i, '');
  email = email.replace(/[>,;)\]}'"]+$/g, '');
  email = email.replace(/^[<'"(]+/g, '');

  if (!EMAIL_PATTERN.test(email) || isBlockedEmail(email)) {
    return undefined;
  }

  return email;
}

export function normalizeDiscoveredContacts(
  contacts: DiscoveredContact[],
): DiscoveredContact[] {
  const seen = new Set<string>();
  const results: DiscoveredContact[] = [];

  for (const contact of contacts) {
    const email = normalizeEmail(contact.email);
    if (!email || seen.has(email)) {
      continue;
    }

    seen.add(email);
    results.push({
      email,
      source: contact.source.trim(),
      page: contact.page?.trim() || undefined,
    });
  }

  return results;
}

export function parseStoredDiscoveredContacts(value: unknown): DiscoveredContact[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const contacts: DiscoveredContact[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const record = entry as Record<string, unknown>;
    if (typeof record.email !== 'string' || typeof record.source !== 'string') {
      continue;
    }

    contacts.push({
      email: record.email,
      source: record.source,
      page: typeof record.page === 'string' ? record.page : undefined,
    });
  }

  return normalizeDiscoveredContacts(contacts);
}

export function parseAllEmailsFromText(
  text: string,
  page: string,
  source: string,
): DiscoveredContact[] {
  const loosePattern =
    /\b[A-Z0-9](?:[A-Z0-9._%+-]*[A-Z0-9])?@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+/gi;

  const matches = text.match(loosePattern) ?? [];
  return normalizeDiscoveredContacts(
    matches.map((email) => ({ email, source, page })),
  );
}

export function pickEmailForLead(
  contacts: DiscoveredContact[],
  leadName: string,
  companyDomain?: string,
): DiscoveredContact | undefined {
  if (!contacts.length) {
    return undefined;
  }

  const firstName = leadName.trim().split(/\s+/)[0]?.toLowerCase();
  const localPart = (email: string) => email.split('@')[0]?.toLowerCase() ?? '';

  if (firstName && firstName.length >= 2) {
    const companyNameMatch = contacts.find(
      (entry) =>
        localPart(entry.email).includes(firstName) &&
        companyDomain &&
        entry.email.endsWith(`@${companyDomain}`),
    );
    if (companyNameMatch) {
      return companyNameMatch;
    }

    const freeEmailNameMatch = contacts.find((entry) => {
      const domain = getEmailDomain(entry.email);
      return (
        domain &&
        isFreeEmailDomain(domain) &&
        localPart(entry.email).includes(firstName)
      );
    });
    if (freeEmailNameMatch) {
      return freeEmailNameMatch;
    }
  }

  if (companyDomain) {
    const domainMatch = contacts.find((entry) =>
      entry.email.endsWith(`@${companyDomain}`),
    );
    if (domainMatch) {
      return domainMatch;
    }
  }

  const freeEmailMatch = contacts.find((entry) => {
    const domain = getEmailDomain(entry.email);
    return domain && isFreeEmailDomain(domain);
  });
  if (freeEmailMatch) {
    return freeEmailMatch;
  }

  const contactMatch = contacts.find((entry) =>
    isGenericCompanyInbox(entry.email),
  );
  if (contactMatch) {
    return contactMatch;
  }

  return contacts[0];
}

function isBlockedEmail(email: string): boolean {
  return BLOCKED_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}
