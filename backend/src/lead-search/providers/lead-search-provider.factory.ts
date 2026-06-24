import { ConfigService } from '@nestjs/config';
import { BrowserService } from '../browser/browser.service';
import { LeadSearchProvider } from '../interfaces/lead-search-provider.interface';
import { BraveSearchLeadSearchProvider } from './brave-search-lead-search.provider';
import { GithubLeadSearchProvider } from './github-lead-search.provider';
import { GoogleCseLeadSearchProvider } from './google-cse-lead-search.provider';
import { MockLeadSearchProvider } from './mock-lead-search.provider';
import { PlaywrightLeadSearchProvider } from './playwright-lead-search.provider';

export function createLeadSearchProvider(
  configService: ConfigService,
  browserService: BrowserService,
): LeadSearchProvider {
  const configured = configService.get<string>('LEAD_SEARCH_PROVIDER', 'github');

  if (configured === 'mock') {
    return new MockLeadSearchProvider();
  }

  if (configured === 'playwright') {
    return new PlaywrightLeadSearchProvider(browserService);
  }

  if (configured === 'brave' && configService.get('BRAVE_SEARCH_API_KEY')) {
    return new BraveSearchLeadSearchProvider(configService);
  }

  if (
    configured === 'google_cse' &&
    configService.get('GOOGLE_CSE_API_KEY') &&
    configService.get('GOOGLE_CSE_CX')
  ) {
    return new GoogleCseLeadSearchProvider(configService);
  }

  if (configured === 'github' || !configured) {
    return new GithubLeadSearchProvider(configService);
  }

  return new GithubLeadSearchProvider(configService);
}
