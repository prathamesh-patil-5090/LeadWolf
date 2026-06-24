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
  if (firstName && firstName.length >= 2) {
    const nameMatch = contacts.find(
      (entry) =>
        entry.email.includes(firstName) &&
        (!companyDomain || entry.email.endsWith(`@${companyDomain}`)),
    );
    if (nameMatch) {
      return nameMatch;
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

  const contactMatch = contacts.find((entry) =>
    /^(contact|hello|info|team|sales|support|founder)@/i.test(entry.email),
  );
  if (contactMatch) {
    return contactMatch;
  }

  return contacts[0];
}

function isBlockedEmail(email: string): boolean {
  return BLOCKED_EMAIL_PATTERNS.some((pattern) => pattern.test(email));
}
