import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailEventType } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GMAIL_REPLY_SOURCE } from './constants';
import { LeadAnalyticsService } from './lead-analytics.service';

interface GmailMessageHeader {
  name: string;
  value: string;
}

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: GmailMessageHeader[];
  };
}

@Injectable()
export class GmailReplySyncService {
  private readonly logger = new Logger(GmailReplySyncService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly analyticsService: LeadAnalyticsService,
  ) {}

  isConfigured() {
    return Boolean(
      this.configService.get<string>('GMAIL_CLIENT_ID') &&
        this.configService.get<string>('GMAIL_CLIENT_SECRET') &&
        this.configService.get<string>('GMAIL_REFRESH_TOKEN'),
    );
  }

  async syncReplyForLead(leadId: string) {
    if (!this.isConfigured()) {
      return {
        configured: false,
        matched: false,
        leadId,
        message: 'Gmail OAuth not configured',
      };
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, email: true, status: true },
    });

    if (!lead?.email) {
      return { configured: true, matched: false, leadId, reason: 'no_lead_email' };
    }

    if (lead.status !== 'SENT' && lead.status !== 'OPENED') {
      return {
        configured: true,
        matched: false,
        leadId,
        reason: `lead_status_${lead.status}`,
      };
    }

    const outreachEmail = await this.prisma.outreachEmail.findFirst({
      where: { leadId, isPrimary: true, sentAt: { not: null } },
      orderBy: { sentAt: 'desc' },
      select: { id: true, subject: true },
    });

    if (!outreachEmail) {
      return { configured: true, matched: false, leadId, reason: 'no_sent_email' };
    }

    const accessToken = await this.fetchAccessToken();
    const query = `from:${lead.email} newer_than:30d`;
    const listResponse = await this.gmailFetch<GmailMessageListResponse>(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&q=${encodeURIComponent(query)}`,
    );

    const messages = listResponse.messages ?? [];

    for (const message of messages) {
      const fullMessage = await this.gmailFetch<GmailMessageResponse>(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
      );

      const headers = fullMessage.payload?.headers ?? [];
      const subject = this.headerValue(headers, 'Subject') ?? '';
      const fromEmail = extractEmailAddress(this.headerValue(headers, 'From'));

      if (fromEmail !== lead.email.toLowerCase()) {
        continue;
      }

      const looksLikeReply =
        /^re:/i.test(subject) ||
        subject
          .toLowerCase()
          .includes(outreachEmail.subject.toLowerCase().slice(0, 24));

      if (!looksLikeReply) {
        continue;
      }

      const occurredAt = fullMessage.internalDate
        ? new Date(Number(fullMessage.internalDate))
        : new Date();

      const result = await this.analyticsService.recordEvent({
        eventType: EmailEventType.REPLIED,
        source: GMAIL_REPLY_SOURCE,
        externalId: `gmail:${fullMessage.id}`,
        leadId: lead.id,
        outreachEmailId: outreachEmail.id,
        recipientEmail: fromEmail,
        payload: {
          gmailMessageId: fullMessage.id,
          threadId: fullMessage.threadId,
          subject,
          snippet: fullMessage.snippet,
        },
        occurredAt,
      });

      if (result.created) {
        this.logger.log(`Gmail reply detected for lead ${leadId} from ${fromEmail}`);
        return { configured: true, matched: true, leadId, replied: true };
      }

      return { configured: true, matched: true, leadId, replied: true, duplicate: true };
    }

    return { configured: true, matched: false, leadId, replied: false };
  }

  async syncReplies(limit = 20) {
    if (!this.isConfigured()) {
      return {
        configured: false,
        processed: 0,
        matched: 0,
        message:
          'Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN to enable Gmail reply sync',
      };
    }

    const accessToken = await this.fetchAccessToken();
    const query = this.configService.get<string>(
      'GMAIL_REPLY_QUERY',
      'in:inbox newer_than:30d',
    );

    const listResponse = await this.gmailFetch<GmailMessageListResponse>(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=${encodeURIComponent(query)}`,
    );

    const messages = listResponse.messages ?? [];
    let matched = 0;

    for (const message of messages) {
      const fullMessage = await this.gmailFetch<GmailMessageResponse>(
        accessToken,
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=References`,
      );

      const headers = fullMessage.payload?.headers ?? [];
      const from = this.headerValue(headers, 'From');
      const subject = this.headerValue(headers, 'Subject') ?? '';
      const fromEmail = extractEmailAddress(from);

      if (!fromEmail) {
        continue;
      }

      const lead = await this.prisma.lead.findFirst({
        where: {
          email: fromEmail,
          status: { in: ['SENT', 'OPENED'] },
        },
        select: { id: true },
      });

      if (!lead) {
        continue;
      }

      const outreachEmail = await this.prisma.outreachEmail.findFirst({
        where: { leadId: lead.id, isPrimary: true, sentAt: { not: null } },
        orderBy: { sentAt: 'desc' },
        select: { id: true, subject: true },
      });

      if (!outreachEmail) {
        continue;
      }

      const looksLikeReply =
        /^re:/i.test(subject) ||
        subject
          .toLowerCase()
          .includes(outreachEmail.subject.toLowerCase().slice(0, 24));

      if (!looksLikeReply) {
        continue;
      }

      const occurredAt = fullMessage.internalDate
        ? new Date(Number(fullMessage.internalDate))
        : new Date();

      const result = await this.analyticsService.recordEvent({
        eventType: EmailEventType.REPLIED,
        source: GMAIL_REPLY_SOURCE,
        externalId: `gmail:${fullMessage.id}`,
        leadId: lead.id,
        outreachEmailId: outreachEmail.id,
        recipientEmail: fromEmail,
        payload: {
          gmailMessageId: fullMessage.id,
          threadId: fullMessage.threadId,
          subject,
          snippet: fullMessage.snippet,
        },
        occurredAt,
      });

      if (result.created) {
        matched += 1;
      }
    }

    this.logger.log(
      `Gmail reply sync processed ${messages.length} messages, matched ${matched} replies`,
    );

    return {
      configured: true,
      processed: messages.length,
      matched,
    };
  }

  private async fetchAccessToken() {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.configService.get<string>('GMAIL_REFRESH_TOKEN');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken!,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Gmail token refresh failed: ${raw.slice(0, 300)}`);
    }

    const data = JSON.parse(raw) as { access_token?: string };
    if (!data.access_token) {
      throw new Error('Gmail token refresh missing access_token');
    }

    return data.access_token;
  }

  private async gmailFetch<T>(accessToken: string, url: string) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20_000),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`Gmail API ${response.status}: ${raw.slice(0, 300)}`);
    }

    return JSON.parse(raw) as T;
  }

  private headerValue(headers: GmailMessageHeader[], name: string) {
    return headers.find(
      (header) => header.name.toLowerCase() === name.toLowerCase(),
    )?.value;
  }
}

function extractEmailAddress(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}
