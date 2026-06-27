import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Browser, chromium } from 'playwright';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    if (!this.launching) {
      this.launching = chromium.launch({
        headless:
          this.configService.get<string>('PLAYWRIGHT_HEADLESS', 'true') ===
          'true',
      });
    }

    this.browser = await this.launching;
    this.launching = null;
    return this.browser;
  }

  async onModuleDestroy() {
    await this.browser?.close();
    this.browser = null;
  }
}
