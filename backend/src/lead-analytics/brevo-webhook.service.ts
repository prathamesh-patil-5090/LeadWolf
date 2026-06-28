import { Injectable, Logger } from '@nestjs/common';
import { EmailEventType } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  BREVO_EVENT_SOURCE,
  BREVO_EVENT_TYPE_MAP,
  BREVO_INBOUND_SOURCE,
} from './constants';
import { LeadAnalyticsService } from './lead-analytics.service';
import {
  parseLeadContextFromCustomHeader,
  parseLeadContextFromTags,
  parseLeadIdFromReplyAddress,
} from './utils/webhook-context.util';

@Injectable()
export class BrevoWebhookService {
  private readonly logger = new Logger(BrevoWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: LeadAnalyticsService,
  ) {}

  async handleTransactionalEvent(payload: Record<string, unknown>) {
    const rawEvent = String(payload.event ?? '');
    const mappedType = BREVO_EVENT_TYPE_MAP[rawEvent] ?? BREVO_EVENT_TYPE_MAP[rawEvent.toLowerCase()];
    if (!mappedType) {
      this.logger.debug(`Ignoring unsupported Brevo event: ${rawEvent}`);
      return { ignored: true, reason: 'unsupported_event', event: rawEvent };
    }

    const eventType = mappedType as EmailEventType;
    const messageId = this.readString(payload['message-id']);
    const recipientEmail = this.readString(payload.email);
    const occurredAt = this.resolveOccurredAt(payload);

    const tagContext = parseLeadContextFromTags(payload.tags);
    const headerContext = parseLeadContextFromCustomHeader(
      payload['X-Mailin-custom'],
    );

    let leadId = tagContext.leadId ?? headerContext.leadId;
    let outreachEmailId =
      tagContext.outreachEmailId ?? headerContext.outreachEmailId;

    if (messageId) {
      const normalizedId = normalizeMessageId(messageId);
      const outreachEmail = await this.prisma.outreachEmail.findFirst({
        where: {
          OR: [
            { brevoMessageId: messageId },
            { brevoMessageId: normalizedId },
            { brevoMessageId: `<${normalizedId}>` },
          ],
        },
        select: { id: true, leadId: true },
      });

      if (outreachEmail) {
        outreachEmailId = outreachEmail.id;
        leadId = outreachEmail.leadId;
      }
    }

    const externalId = [
      rawEvent,
      messageId ?? 'no-message',
      String(payload.ts_event ?? payload.ts_epoch ?? occurredAt.getTime()),
    ].join(':');

    const result = await this.analyticsService.recordEvent({
      eventType,
      source: BREVO_EVENT_SOURCE,
      externalId,
      leadId,
      outreachEmailId,
      recipientEmail,
      payload,
      occurredAt,
    });

    return {
      ignored: false,
      created: result.created,
      eventType,
      leadId,
      outreachEmailId,
    };
  }

  async handleInboundReply(payload: Record<string, unknown>) {
    const fromEmail = this.extractInboundFromEmail(payload);
    const toEmails = this.extractInboundToEmails(payload);
    const subject = this.readString(payload.Subject) ?? this.readString(payload.subject);
    const occurredAt = this.resolveInboundOccurredAt(payload);

    let leadId: string | undefined;
    for (const address of toEmails) {
      leadId = parseLeadIdFromReplyAddress(address);
      if (leadId) {
        break;
      }
    }

    let outreachEmailId: string | undefined;
    if (leadId) {
      const outreachEmail = await this.prisma.outreachEmail.findFirst({
        where: { leadId, isPrimary: true, sentAt: { not: null } },
        orderBy: { sentAt: 'desc' },
        select: { id: true },
      });
      outreachEmailId = outreachEmail?.id;
    } else if (fromEmail) {
      const lead = await this.prisma.lead.findFirst({
        where: { email: fromEmail.toLowerCase() },
        select: { id: true },
      });
      leadId = lead?.id;

      if (leadId) {
        const outreachEmail = await this.prisma.outreachEmail.findFirst({
          where: { leadId, isPrimary: true, sentAt: { not: null } },
          orderBy: { sentAt: 'desc' },
          select: { id: true },
        });
        outreachEmailId = outreachEmail?.id;
      }
    }

    const uuid = this.readString(payload.Uuid) ?? this.readString(payload.uuid);
    const externalId = uuid ?? `inbound:${fromEmail ?? 'unknown'}:${occurredAt.getTime()}`;

    const result = await this.analyticsService.recordEvent({
      eventType: EmailEventType.REPLIED,
      source: BREVO_INBOUND_SOURCE,
      externalId,
      leadId,
      outreachEmailId,
      recipientEmail: fromEmail,
      payload: {
        subject,
        from: fromEmail,
        to: toEmails,
        excerpt: this.readString(payload.ExtractedMarkdownMessage)?.slice(0, 500),
        raw: payload,
      },
      occurredAt,
    });

    return {
      created: result.created,
      leadId,
      outreachEmailId,
      fromEmail,
    };
  }

  private resolveOccurredAt(payload: Record<string, unknown>) {
    const tsEpoch = Number(payload.ts_epoch);
    if (Number.isFinite(tsEpoch) && tsEpoch > 0) {
      return new Date(tsEpoch);
    }

    const tsEvent = Number(payload.ts_event ?? payload.ts);
    if (Number.isFinite(tsEvent) && tsEvent > 0) {
      return new Date(tsEvent * 1000);
    }

    const date =
      this.readString(payload.date) ?? this.readString(payload.Date);
    if (date) {
      const normalized = date.includes('T') ? date : date.replace(' ', 'T');
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }

  private resolveInboundOccurredAt(payload: Record<string, unknown>) {
    const date = this.readString(payload.Date) ?? this.readString(payload.date);
    if (date) {
      const parsed = new Date(date);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return new Date();
  }

  private extractInboundFromEmail(payload: Record<string, unknown>) {
    const from = payload.From;
    if (typeof from === 'string') {
      return normalizeEmailAddress(from);
    }

    if (from && typeof from === 'object') {
      const record = from as Record<string, unknown>;
      return normalizeEmailAddress(
        this.readString(record.Address) ?? this.readString(record.address),
      );
    }

    return normalizeEmailAddress(this.readString(payload.from));
  }

  private extractInboundToEmails(payload: Record<string, unknown>) {
    const recipients = payload.Recipients ?? payload.recipients ?? payload.To;
    const addresses: string[] = [];

    if (typeof recipients === 'string') {
      addresses.push(normalizeEmailAddress(recipients) ?? recipients);
    } else if (Array.isArray(recipients)) {
      for (const entry of recipients) {
        if (typeof entry === 'string') {
          const normalized = normalizeEmailAddress(entry);
          if (normalized) {
            addresses.push(normalized);
          }
        } else if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          const normalized = normalizeEmailAddress(
            this.readString(record.Address) ?? this.readString(record.address),
          );
          if (normalized) {
            addresses.push(normalized);
          }
        }
      }
    }

    return addresses.filter(Boolean);
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}

function normalizeEmailAddress(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function normalizeMessageId(value?: string | null) {
  if (!value?.trim()) {
    return '';
  }

  return value.replace(/^<|>$/g, '').trim();
}
