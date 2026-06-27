const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'sharklasers.com',
  'grr.la',
  'tempmail.com',
  'temp-mail.org',
  'throwaway.email',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'fakeinbox.com',
  'mintemail.com',
  'mytemp.email',
  'tempail.com',
  'emailondeck.com',
  'mailnesia.com',
  'spam4.me',
  'harakirimail.com',
  'mailcatch.com',
  '10minutemail.com',
  '20minutemail.com',
  '33mail.com',
  'anonbox.net',
  'burnermail.io',
  'discard.email',
  'dropmail.me',
  'fakemailgenerator.com',
  'inboxkitten.com',
  'mailpoof.com',
  'mohmal.com',
  'tempr.email',
  'tmpmail.net',
  'tmpmail.org',
]);

export function isDisposableEmailDomain(domain: string): boolean {
  const normalized = domain.toLowerCase().trim();

  if (DISPOSABLE_EMAIL_DOMAINS.has(normalized)) {
    return true;
  }

  const parts = normalized.split('.');
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join('.');
    return DISPOSABLE_EMAIL_DOMAINS.has(parentDomain);
  }

  return false;
}
