import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from '../shared/rate-limit/rate-limit.service';
import { BREVO_EVENTS_API_URL } from './constants';
import { BrevoWebhookService } from './brevo-webhook.service';
import { PrismaService } from '../prisma/prisma.service';

export interface BrevoTransactionalEvent {
  email?: string;
  date?: string;
  event?: string;
  messageId?: string;
  subject?: string;
  tag?: string;
  tags?: string[];
  ip?: string;
  from?: string;
  link?: string;
}

interface BrevoEventsResponse {
  events?: BrevoTransactionalEvent[];
}

export interface SyncBrevoEventsOptions {
  days?: number;
  startDate?: string;
  endDate?: string;
  outreachEmailId?: string;
  leadId?: string;
  limit?: number;
}

@Injectable()
export class BrevoEventSyncService {
  private readonly logger = new Logger(BrevoEventSyncService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimitService: RateLimitService,
    private readonly prisma: PrismaService,
    private readonly brevoWebhookService: BrevoWebhookService,
  ) {}

  isConfigured() {
    return Boolean(this.configService.get<string>('BREVO_API_KEY'));
  }

  async syncEvents(options: SyncBrevoEventsOptions = {}) {
    if (!this.isConfigured()) {
      return {
        configured: false,
        fetched: 0,
        processed: 0,
        created: 0,
        skipped: 0,
        message: 'BREVO_API_KEY not set',
      };
    }

    const endDate = options.endDate ?? toBrevoDate(new Date());
    const startDate =
      options.startDate ??
      toBrevoDate(
        new Date(Date.now() - (options.days ?? 30) * 24 * 60 * 60 * 1000),
      );

    const messageIdFilter = await this.resolveMessageIdFilter(options);
    const maxEvents = Math.min(options.limit ?? 5000, 5000);
    const pageSize = 2500;
    const knownMessageIds = messageIdFilter
      ? null
      : await this.loadKnownBrevoMessageIds();

    let offset = 0;
    let fetched = 0;
    let processed = 0;
    let created = 0;
    let skipped = 0;

    while (fetched < maxEvents) {
      const batchLimit = Math.min(pageSize, maxEvents - fetched);
      const response = await this.fetchEvents({
        startDate,
        endDate,
        messageId: messageIdFilter,
        limit: batchLimit,
        offset,
      });

      const events = response.events ?? [];
      if (!events.length) {
        break;
      }

      fetched += events.length;

      for (const event of events) {
        if (messageIdFilter && !messageIdsMatch(event.messageId, messageIdFilter)) {
          skipped += 1;
          continue;
        }

        if (
          knownMessageIds &&
          !knownMessageIds.has(normalizeMessageId(event.messageId))
        ) {
          skipped += 1;
          continue;
        }

        const payload = this.toWebhookPayload(event);
        try {
          const result = await this.brevoWebhookService.handleTransactionalEvent(
            payload,
          );

          processed += 1;
          if (!result.ignored && result.created) {
            created += 1;
          } else {
            skipped += 1;
          }
        } catch (error) {
          this.logger.warn(
            `Skipping Brevo event ${event.event ?? 'unknown'}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          skipped += 1;
        }
      }

      if (events.length < batchLimit) {
        break;
      }

      offset += events.length;
    }

    this.logger.log(
      `Brevo event sync ${startDate}..${endDate}: fetched=${fetched} processed=${processed} created=${created}`,
    );

    return {
      configured: true,
      startDate,
      endDate,
      fetched,
      processed,
      created,
      skipped,
    };
  }

  async syncForOutreachEmail(outreachEmailId: string) {
    const outreachEmail = await this.prisma.outreachEmail.findUnique({
      where: { id: outreachEmailId },
      select: {
        id: true,
        brevoMessageId: true,
        sentAt: true,
      },
    });

    if (!outreachEmail?.sentAt) {
      return {
        configured: this.isConfigured(),
        error: 'not_sent',
        outreachEmailId,
      };
    }

    const startDate = toBrevoDate(
      new Date(outreachEmail.sentAt.getTime() - 24 * 60 * 60 * 1000),
    );
    const endDate = toBrevoDate(new Date());

    return this.syncEvents({
      startDate,
      endDate,
      outreachEmailId,
    });
  }

  private async loadKnownBrevoMessageIds() {
    const rows = await this.prisma.outreachEmail.findMany({
      where: {
        sentAt: { not: null },
        brevoMessageId: { not: null },
      },
      select: { brevoMessageId: true },
    });

    return new Set(
      rows
        .map((row) => normalizeMessageId(row.brevoMessageId))
        .filter((id) => id.length > 0),
    );
  }

  private async resolveMessageIdFilter(options: SyncBrevoEventsOptions) {
    if (options.outreachEmailId) {
      const outreachEmail = await this.prisma.outreachEmail.findUnique({
        where: { id: options.outreachEmailId },
        select: { brevoMessageId: true },
      });
      return outreachEmail?.brevoMessageId ?? undefined;
    }

    if (options.leadId) {
      const outreachEmail = await this.prisma.outreachEmail.findFirst({
        where: {
          leadId: options.leadId,
          isPrimary: true,
          sentAt: { not: null },
        },
        orderBy: { sentAt: 'desc' },
        select: { brevoMessageId: true },
      });
      return outreachEmail?.brevoMessageId ?? undefined;
    }

    return undefined;
  }

  private async fetchEvents(params: {
    startDate: string;
    endDate: string;
    messageId?: string;
    limit: number;
    offset: number;
  }) {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      throw new Error('BREVO_API_KEY not set');
    }

    await this.rateLimitService.acquireBrevo('transactional-events');

    const query = new URLSearchParams({
      startDate: params.startDate,
      endDate: params.endDate,
      limit: String(params.limit),
      offset: String(params.offset),
      sort: 'asc',
    });

    if (params.messageId) {
      query.set('messageId', params.messageId);
    }

    const response = await fetch(`${BREVO_EVENTS_API_URL}?${query}`, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });

    const raw = await response.text();

    if (!response.ok) {
      this.logger.warn(`Brevo events API ${response.status}: ${raw.slice(0, 300)}`);
      throw new Error(`Brevo events API ${response.status}: ${raw.slice(0, 300)}`);
    }

    return JSON.parse(raw) as BrevoEventsResponse;
  }

  private toWebhookPayload(event: BrevoTransactionalEvent): Record<string, unknown> {
    const tags = event.tags?.length
      ? event.tags
      : event.tag
        ? [event.tag]
        : [];

    const occurredAt = parseBrevoEventDate(event.date);

    return {
      event: event.event,
      email: event.email,
      'message-id': event.messageId,
      subject: event.subject,
      tags,
      date: event.date,
      ts_event: occurredAt ? Math.floor(occurredAt.getTime() / 1000) : undefined,
      link: event.link,
      ip: event.ip,
      from: event.from,
    };
  }
}

function toBrevoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseBrevoEventDate(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.includes('T')
    ? value
    : value.replace(' ', 'T');

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeMessageId(value?: string | null) {
  if (!value?.trim()) {
    return '';
  }

  return value.replace(/^<|>$/g, '').trim();
}

function messageIdsMatch(a?: string | null, b?: string | null) {
  if (!a || !b) {
    return false;
  }

  return normalizeMessageId(a) === normalizeMessageId(b);
}
