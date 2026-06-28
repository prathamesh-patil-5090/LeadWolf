export const BREVO_EVENT_SOURCE = 'brevo';
export const BREVO_INBOUND_SOURCE = 'brevo_inbound';
export const GMAIL_REPLY_SOURCE = 'gmail_api';

export const BREVO_EVENT_TYPE_MAP: Record<string, string> = {
  request: 'SENT',
  requests: 'SENT',
  delivered: 'DELIVERED',
  opened: 'OPENED',
  unique_opened: 'OPENED',
  uniqueOpened: 'OPENED',
  first_opening: 'OPENED',
  proxy_open: 'OPENED',
  unique_proxy_open: 'OPENED',
  loadedByProxy: 'OPENED',
  click: 'CLICKED',
  clicks: 'CLICKED',
  hard_bounce: 'BOUNCED',
  hardBounce: 'BOUNCED',
  hardBounces: 'BOUNCED',
  bounces: 'BOUNCED',
  soft_bounce: 'SOFT_BOUNCE',
  softBounce: 'SOFT_BOUNCE',
  softBounces: 'SOFT_BOUNCE',
  spam: 'SPAM',
  unsubscribed: 'UNSUBSCRIBED',
  reply: 'REPLIED',
  invalid: 'BOUNCED',
  blocked: 'SOFT_BOUNCE',
  deferred: 'SOFT_BOUNCE',
  error: 'SOFT_BOUNCE',
};

export const BREVO_EVENTS_API_URL =
  'https://api.brevo.com/v3/smtp/statistics/events';
