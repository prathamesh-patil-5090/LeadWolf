export const BREVO_EVENT_SOURCE = 'brevo';
export const BREVO_INBOUND_SOURCE = 'brevo_inbound';
export const GMAIL_REPLY_SOURCE = 'gmail_api';

export const BREVO_EVENT_TYPE_MAP: Record<string, string> = {
  request: 'SENT',
  delivered: 'DELIVERED',
  opened: 'OPENED',
  unique_opened: 'OPENED',
  uniqueOpened: 'OPENED',
  first_opening: 'OPENED',
  proxy_open: 'OPENED',
  unique_proxy_open: 'OPENED',
  click: 'CLICKED',
  hard_bounce: 'BOUNCED',
  hardBounce: 'BOUNCED',
  soft_bounce: 'SOFT_BOUNCE',
  softBounce: 'SOFT_BOUNCE',
  spam: 'SPAM',
  unsubscribed: 'UNSUBSCRIBED',
  reply: 'REPLIED',
};
