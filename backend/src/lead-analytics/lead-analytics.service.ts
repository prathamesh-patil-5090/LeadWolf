import { Injectable } from '@nestjs/common';
import { EmailEventType, LeadStatus } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordEmailEventInput {
  eventType: EmailEventType;
  source: string;
  externalId?: string;
  leadId?: string;
  outreachEmailId?: string;
  recipientEmail?: string;
  payload?: unknown;
  occurredAt?: Date;
}

@Injectable()
export class LeadAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(input: RecordEmailEventInput) {
    if (input.externalId) {
      const existing = await this.prisma.emailEvent.findUnique({
        where: {
          source_externalId: {
            source: input.source,
            externalId: input.externalId,
          },
        },
      });

      if (existing) {
        return { event: existing, created: false };
      }
    }

    const event = await this.prisma.emailEvent.create({
      data: {
        eventType: input.eventType,
        source: input.source,
        externalId: input.externalId,
        leadId: input.leadId,
        outreachEmailId: input.outreachEmailId,
        recipientEmail: input.recipientEmail,
        payload: input.payload as object | undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    if (input.leadId) {
      await this.updateLeadStatusFromEvent(input.leadId, input.eventType);
    }

    return { event, created: true };
  }

  async getSummary() {
    const [
      totalLeads,
      sentLeads,
      openedLeads,
      repliedLeads,
      bouncedLeads,
      eventCounts,
    ] = await Promise.all([
      this.prisma.lead.count(),
      this.prisma.lead.count({ where: { status: LeadStatus.SENT } }),
      this.prisma.lead.count({
        where: {
          status: { in: [LeadStatus.OPENED, LeadStatus.REPLIED] },
        },
      }),
      this.prisma.lead.count({ where: { status: LeadStatus.REPLIED } }),
      this.prisma.lead.count({ where: { status: LeadStatus.BOUNCED } }),
      this.prisma.emailEvent.groupBy({
        by: ['eventType'],
        _count: { _all: true },
      }),
    ]);

    const sentEmails = await this.prisma.outreachEmail.count({
      where: { sentAt: { not: null } },
    });

    const openedEvents = eventCounts.find((e) => e.eventType === 'OPENED')?._count
      ._all ?? 0;
    const clickedEvents = eventCounts.find((e) => e.eventType === 'CLICKED')
      ?._count._all ?? 0;
    const repliedEvents = eventCounts.find((e) => e.eventType === 'REPLIED')
      ?._count._all ?? 0;
    const bouncedEvents =
      (eventCounts.find((e) => e.eventType === 'BOUNCED')?._count._all ?? 0) +
      (eventCounts.find((e) => e.eventType === 'SOFT_BOUNCE')?._count._all ??
        0);

    const openRate = sentEmails > 0 ? openedEvents / sentEmails : 0;
    const replyRate = sentEmails > 0 ? repliedEvents / sentEmails : 0;
    const bounceRate = sentEmails > 0 ? bouncedEvents / sentEmails : 0;

    return {
      leads: {
        total: totalLeads,
        sent: sentLeads,
        opened: openedLeads,
        replied: repliedLeads,
        bounced: bouncedLeads,
      },
      emails: {
        sent: sentEmails,
        opened: openedEvents,
        clicked: clickedEvents,
        replied: repliedEvents,
        bounced: bouncedEvents,
      },
      rates: {
        openRate: roundRate(openRate),
        replyRate: roundRate(replyRate),
        bounceRate: roundRate(bounceRate),
      },
    };
  }

  async listEvents(options: {
    leadId?: string;
    outreachEmailId?: string;
    eventType?: EmailEventType;
    limit?: number;
  }) {
    return this.prisma.emailEvent.findMany({
      where: {
        leadId: options.leadId,
        outreachEmailId: options.outreachEmailId,
        eventType: options.eventType,
      },
      orderBy: { occurredAt: 'desc' },
      take: options.limit ?? 50,
      include: {
        lead: { select: { id: true, name: true, email: true, status: true } },
        outreachEmail: {
          select: { id: true, subject: true, sentAt: true, brevoMessageId: true },
        },
      },
    });
  }

  async getLeadTimeline(leadId: string) {
    const [lead, events] = await Promise.all([
      this.prisma.lead.findUnique({
        where: { id: leadId },
        include: {
          outreachEmails: {
            where: { isPrimary: true },
            take: 1,
          },
        },
      }),
      this.listEvents({ leadId, limit: 100 }),
    ]);

    return { lead, events };
  }

  private async updateLeadStatusFromEvent(
    leadId: string,
    eventType: EmailEventType,
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { status: true },
    });

    if (!lead) {
      return;
    }

    const nextStatus = this.resolveNextLeadStatus(lead.status, eventType);
    if (!nextStatus || nextStatus === lead.status) {
      return;
    }

    await this.prisma.lead.update({
      where: { id: leadId },
      data: { status: nextStatus },
    });
  }

  private resolveNextLeadStatus(
    current: LeadStatus,
    eventType: EmailEventType,
  ): LeadStatus | undefined {
    if (eventType === 'REPLIED') {
      return LeadStatus.REPLIED;
    }

    if (
      eventType === 'BOUNCED' ||
      eventType === 'SOFT_BOUNCE' ||
      eventType === 'SPAM'
    ) {
      return LeadStatus.BOUNCED;
    }

    if (eventType === 'OPENED' || eventType === 'CLICKED') {
      if (
        current === LeadStatus.SENT ||
        current === LeadStatus.OPENED
      ) {
        return LeadStatus.OPENED;
      }
    }

    return undefined;
  }
}

function roundRate(value: number) {
  return Math.round(value * 10_000) / 100;
}
