import { ConfigService } from '@nestjs/config';
import { BrowserService } from '../browser/browser.service';
import { LeadSearchProvider } from '../interfaces/lead-search-provider.interface';
import { BrightDataLinkedInLeadSearchProvider } from './bright-data-linkedin-lead-search.provider';
import { GithubLeadSearchProvider } from './github-lead-search.provider';
import { GoogleCseLeadSearchProvider } from './google-cse-lead-search.provider';
import { MockLeadSearchProvider } from './mock-lead-search.provider';
import { PlaywrightLeadSearchProvider } from './playwright-lead-search.provider';
import { BrightDataService } from '../../shared/bright-data/bright-data.service';
import { LinkedInUrlDiscoveryService } from '../services/linkedin-url-discovery.service';
import { CombinedLeadSearchProvider } from './combined-lead-search.provider';

function shouldUseCombinedSearch(configService: ConfigService) {
  const provider = configService.get<string>('LEAD_SEARCH_PROVIDER', 'github');
  const brightDataKey = configService.get<string>('BRIGHT_DATA_API_KEY');

  if (provider === 'combined') {
    return Boolean(brightDataKey);
  }

  if (provider !== 'github') {
    return false;
  }

  if (!brightDataKey) {
    return false;
  }

  return (
    configService.get<string>('LEAD_SEARCH_BRIGHT_DATA_PARALLEL', 'true') ===
    'true'
  );
}

export function createLeadSearchProvider(
  configService: ConfigService,
  browserService: BrowserService,
  brightDataService: BrightDataService,
  combinedProvider: CombinedLeadSearchProvider,
  linkedInUrlDiscovery: LinkedInUrlDiscoveryService,
  brightDataLinkedInProvider: BrightDataLinkedInLeadSearchProvider,
): LeadSearchProvider {
  const configured = configService.get<string>('LEAD_SEARCH_PROVIDER', 'github');

  if (configured === 'mock') {
    return new MockLeadSearchProvider();
  }

  if (configured === 'playwright') {
    return new PlaywrightLeadSearchProvider(browserService);
  }

  if (shouldUseCombinedSearch(configService)) {
    return combinedProvider;
  }

  if (
    configured === 'bright_data' &&
    configService.get<string>('BRIGHT_DATA_API_KEY')
  ) {
    return brightDataLinkedInProvider;
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
