import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async resetDatabase() {
    this.assertResetAllowed();

    const [emailEvents, outreachEmails, leads, companies, searchJobs, cursors] =
      await this.prisma.$transaction([
        this.prisma.emailEvent.deleteMany(),
        this.prisma.outreachEmail.deleteMany(),
        this.prisma.lead.deleteMany(),
        this.prisma.company.deleteMany(),
        this.prisma.leadSearchJob.deleteMany(),
        this.prisma.leadSearchCursor.deleteMany(),
      ]);

    return {
      success: true,
      deleted: {
        emailEvents: emailEvents.count,
        outreachEmails: outreachEmails.count,
        leads: leads.count,
        companies: companies.count,
        searchJobs: searchJobs.count,
        searchCursors: cursors.count,
      },
    };
  }

  async resetRedis() {
    this.assertResetAllowed();

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      throw new ServiceUnavailableException(
        'REDIS_URL is not configured — nothing to reset',
      );
    }

    const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
    try {
      await redis.flushall();
    } finally {
      await redis.quit();
    }

    return {
      success: true,
      message: 'Redis flushed (all keys removed, including BullMQ queues)',
    };
  }

  getStatus() {
    return {
      resetEnabled:
        this.configService.get<string>('ALLOW_DATA_RESET', 'false') === 'true',
      redisConfigured: Boolean(this.configService.get<string>('REDIS_URL')),
    };
  }

  private assertResetAllowed() {
    if (this.configService.get<string>('ALLOW_DATA_RESET', 'false') !== 'true') {
      throw new BadRequestException(
        'Data reset is disabled. Set ALLOW_DATA_RESET=true in backend .env to enable.',
      );
    }
  }
}
