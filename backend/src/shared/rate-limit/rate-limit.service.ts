import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlidingWindowRateLimiter } from './sliding-window-rate-limiter';

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly groq: SlidingWindowRateLimiter;
  private readonly openRouter: SlidingWindowRateLimiter;
  private readonly brevo: SlidingWindowRateLimiter;

  constructor(private readonly configService: ConfigService) {
    this.groq = new SlidingWindowRateLimiter(
      this.readInt('GROQ_RATE_LIMIT_RPM', 30),
      this.readInt('GROQ_RATE_LIMIT_RPD', 1000),
    );
    this.openRouter = new SlidingWindowRateLimiter(
      this.readInt('OPENROUTER_RATE_LIMIT_RPM', 20),
      this.readOptionalInt('OPENROUTER_RATE_LIMIT_RPD'),
    );
    this.brevo = new SlidingWindowRateLimiter(
      this.readInt('BREVO_RATE_LIMIT_RPM', 60),
      this.readInt('BREVO_RATE_LIMIT_RPD', 300),
    );
  }

  async acquireGroq(label?: string) {
    await this.acquire(this.groq, 'Groq', label);
  }

  async acquireOpenRouter(label?: string) {
    await this.acquire(this.openRouter, 'OpenRouter', label);
  }

  async acquireBrevo(label?: string) {
    await this.acquire(this.brevo, 'Brevo', label);
  }

  getQuotaSnapshot() {
    return {
      groq: {
        dailyUsed: this.groq.getDailyUsed(),
        dailyRemaining: this.groq.getDailyRemaining(),
      },
      openRouter: {
        dailyUsed: this.openRouter.getDailyUsed(),
        dailyRemaining: this.openRouter.getDailyRemaining(),
      },
      brevo: {
        dailyUsed: this.brevo.getDailyUsed(),
        dailyRemaining: this.brevo.getDailyRemaining(),
      },
    };
  }

  private async acquire(
    limiter: SlidingWindowRateLimiter,
    provider: string,
    label?: string,
  ) {
    const remaining = limiter.getDailyRemaining();
    if (remaining === 0) {
      throw new Error(
        `${provider} daily limit reached${label ? ` (${label})` : ''}`,
      );
    }

    const before = Date.now();
    await limiter.acquire();
    const waitedMs = Date.now() - before;

    if (waitedMs > 500) {
      this.logger.debug(
        `${provider} rate limit wait ${waitedMs}ms${label ? ` — ${label}` : ''}`,
      );
    }
  }

  private readInt(key: string, fallback: number) {
    const value = Number(this.configService.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private readOptionalInt(key: string) {
    const raw = this.configService.get<string>(key);
    if (!raw?.trim()) {
      return undefined;
    }

    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
}
