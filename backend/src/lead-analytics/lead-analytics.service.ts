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

    const links = await this.resolveEventLinks(
      input.leadId,
      input.outreachEmailId,
    );

    const event = await this.prisma.emailEvent.create({
      data: {
        eventType: input.eventType,
        source: input.source,
        externalId: input.externalId,
        leadId: links.leadId,
        outreachEmailId: links.outreachEmailId,
        recipientEmail: input.recipientEmail,
        payload: input.payload as object | undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    if (links.leadId) {
      await this.updateLeadStatusFromEvent(links.leadId, input.eventType);
    }

    return { event, created: true };
  }

  private async resolveEventLinks(
    leadId?: string,
    outreachEmailId?: string,
  ): Promise<{ leadId?: string; outreachEmailId?: string }> {
    let resolvedLeadId = leadId;
    let resolvedOutreachEmailId = outreachEmailId;

    if (outreachEmailId) {
      const outreachEmail = await this.prisma.outreachEmail.findUnique({
        where: { id: outreachEmailId },
        select: { id: true, leadId: true },
      });

      if (!outreachEmail) {
        resolvedOutreachEmailId = undefined;
      } else {
        resolvedOutreachEmailId = outreachEmail.id;
        resolvedLeadId = outreachEmail.leadId;
      }
    }

    if (resolvedLeadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: resolvedLeadId },
        select: { id: true },
      });

      if (!lead) {
        resolvedLeadId = undefined;
      }
    }

    return {
      leadId: resolvedLeadId,
      outreachEmailId: resolvedOutreachEmailId,
    };
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

  async listSentEmails(options: {
    page?: number;
    pageSize?: number;
    leadStatus?: LeadStatus;
    hasReply?: boolean;
  }) {
    const page = options.page ?? 1;
    const pageSize = Math.min(options.pageSize ?? 20, 100);
    const skip = (page - 1) * pageSize;

    const where = {
      sentAt: { not: null },
      isPrimary: true,
      ...(options.leadStatus ? { lead: { status: options.leadStatus } } : {}),
      ...(options.hasReply
        ? { emailEvents: { some: { eventType: 'REPLIED' as EmailEventType } } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.outreachEmail.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              role: true,
              company: true,
              email: true,
              status: true,
              verified: true,
            },
          },
          emailEvents: {
            orderBy: { occurredAt: 'asc' },
            select: {
              id: true,
              eventType: true,
              source: true,
              occurredAt: true,
            },
          },
        },
      }),
      this.prisma.outreachEmail.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        ...row,
        engagement: summarizeEngagement(row.emailEvents),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  async getSentEmailDetail(outreachEmailId: string) {
    const outreachEmail = await this.prisma.outreachEmail.findUnique({
      where: { id: outreachEmailId },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            role: true,
            company: true,
            email: true,
            status: true,
            verified: true,
            contactConfidence: true,
            profileUrl: true,
            githubUrl: true,
            linkedinUrl: true,
            pipelineFailedStep: true,
            pipelineError: true,
          },
        },
        emailEvents: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!outreachEmail || !outreachEmail.sentAt) {
      return null;
    }

    return {
      outreachEmail,
      engagement: summarizeEngagement(outreachEmail.emailEvents),
    };
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

function summarizeEngagement(
  events: { eventType: EmailEventType; source: string; occurredAt: Date }[],
) {
  const types = new Set(events.map((e) => e.eventType));
  const gmailReply = events.some(
    (e) => e.eventType === 'REPLIED' && e.source.toLowerCase().includes('gmail'),
  );
  const brevoReply = events.some(
    (e) =>
      e.eventType === 'REPLIED' &&
      (e.source.toLowerCase().includes('brevo') ||
        e.source.toLowerCase().includes('inbound')),
  );

  return {
    sent: types.has('SENT') || types.has('DELIVERED'),
    delivered: types.has('DELIVERED'),
    opened: types.has('OPENED'),
    clicked: types.has('CLICKED'),
    replied: types.has('REPLIED'),
    bounced: types.has('BOUNCED') || types.has('SOFT_BOUNCE'),
    spam: types.has('SPAM'),
    gmailReplyDetected: gmailReply,
    brevoReplyDetected: brevoReply,
    lastEventAt: events.length
      ? events[events.length - 1]!.occurredAt
      : null,
  };
}
