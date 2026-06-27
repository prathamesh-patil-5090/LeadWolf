export interface WebhookLeadContext {
  leadId?: string;
  outreachEmailId?: string;
}

export function parseLeadContextFromTags(
  tags: unknown,
): WebhookLeadContext {
  if (!Array.isArray(tags)) {
    return {};
  }

  const context: WebhookLeadContext = {};
  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue;
    }

    if (tag.startsWith('lead:')) {
      context.leadId = tag.slice('lead:'.length);
    } else if (tag.startsWith('outreach:')) {
      context.outreachEmailId = tag.slice('outreach:'.length);
    }
  }

  return context;
}

export function parseLeadContextFromCustomHeader(
  value: unknown,
): WebhookLeadContext {
  if (typeof value !== 'string' || !value.includes(':')) {
    return {};
  }

  const [leadId, outreachEmailId] = value.split(':');
  return {
    leadId: leadId || undefined,
    outreachEmailId: outreachEmailId || undefined,
  };
}

export function parseLeadIdFromReplyAddress(email: string): string | undefined {
  const match = email.match(/^lead\+([^@+]+)@/i);
  return match?.[1];
}
