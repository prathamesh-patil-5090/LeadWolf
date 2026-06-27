export class SlidingWindowRateLimiter {
  private minuteTimestamps: number[] = [];
  private dailyCount = 0;
  private dailyWindowStart = startOfUtcDay();

  constructor(
    private readonly maxPerMinute: number,
    private readonly maxPerDay?: number,
  ) {}

  async acquire(): Promise<void> {
    while (true) {
      this.resetDailyIfNeeded();
      this.pruneMinuteWindow();

      if (this.maxPerDay !== undefined && this.dailyCount >= this.maxPerDay) {
        const waitMs = this.dailyWindowStart + 86_400_000 - Date.now();
        await sleep(Math.max(waitMs, 1000));
        continue;
      }

      if (this.minuteTimestamps.length < this.maxPerMinute) {
        this.minuteTimestamps.push(Date.now());
        this.dailyCount += 1;
        return;
      }

      const oldest = this.minuteTimestamps[0]!;
      const waitMs = oldest + 60_000 - Date.now() + 50;
      await sleep(Math.max(waitMs, 50));
    }
  }

  getDailyRemaining(): number | undefined {
    this.resetDailyIfNeeded();
    if (this.maxPerDay === undefined) {
      return undefined;
    }

    return Math.max(0, this.maxPerDay - this.dailyCount);
  }

  getDailyUsed(): number {
    this.resetDailyIfNeeded();
    return this.dailyCount;
  }

  private pruneMinuteWindow() {
    const cutoff = Date.now() - 60_000;
    this.minuteTimestamps = this.minuteTimestamps.filter((ts) => ts > cutoff);
  }

  private resetDailyIfNeeded() {
    const dayStart = startOfUtcDay();
    if (dayStart !== this.dailyWindowStart) {
      this.dailyWindowStart = dayStart;
      this.dailyCount = 0;
    }
  }
}

function startOfUtcDay() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
