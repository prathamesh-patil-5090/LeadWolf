import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BREVO_API_URL } from './constants';
import { RateLimitService } from '../shared/rate-limit/rate-limit.service';

export interface BrevoSendPayload {
  senderName: string;
  senderEmail: string;
  toEmail: string;
  toName: string;
  subject: string;
  textContent: string;
  replyToEmail?: string;
  leadId?: string;
  outreachEmailId?: string;
}

export interface BrevoSendResult {
  messageId: string;
}

@Injectable()
export class BrevoEmailClient {
  private readonly logger = new Logger(BrevoEmailClient.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async sendTransactionalEmail(
    payload: BrevoSendPayload,
  ): Promise<BrevoSendResult> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      throw new Error('BREVO_API_KEY not set');
    }

    await this.rateLimitService.acquireBrevo('transactional-send');

    const tags: string[] = [];
    if (payload.leadId) {
      tags.push(`lead:${payload.leadId}`);
    }
    if (payload.outreachEmailId) {
      tags.push(`outreach:${payload.outreachEmailId}`);
    }

    const customHeaders: Record<string, string> = {};
    if (payload.leadId && payload.outreachEmailId) {
      customHeaders['X-Mailin-custom'] =
        `${payload.leadId}:${payload.outreachEmailId}`;
    }

    const body: Record<string, unknown> = {
      sender: {
        name: payload.senderName,
        email: payload.senderEmail,
      },
      to: [{ email: payload.toEmail, name: payload.toName }],
      subject: payload.subject,
      textContent: payload.textContent,
    };

    if (payload.replyToEmail) {
      body.replyTo = { email: payload.replyToEmail };
    }

    if (tags.length) {
      body.tags = tags;
    }

    if (Object.keys(customHeaders).length) {
      body.headers = customHeaders;
    }

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    const raw = await response.text();

    if (!response.ok) {
      this.logger.warn(`Brevo API ${response.status}: ${raw.slice(0, 300)}`);
      throw new Error(`Brevo API ${response.status}: ${raw.slice(0, 300)}`);
    }

    const data = JSON.parse(raw) as { messageId?: string };
    if (!data.messageId) {
      throw new Error('Brevo response missing messageId');
    }

    return { messageId: data.messageId };
  }
}
