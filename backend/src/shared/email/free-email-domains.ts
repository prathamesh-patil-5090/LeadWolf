const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'me.com',
  'aol.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'fastmail.com',
  'hey.com',
]);

export function isFreeEmailDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().trim();
  return FREE_EMAIL_DOMAINS.has(normalized);
}

export function getEmailDomain(email: string): string | undefined {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : undefined;
}
