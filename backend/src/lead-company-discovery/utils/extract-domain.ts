import { normalizeWebsiteUrl } from '../../lead-search/utils/github-profile.parser';

export function extractDomain(url: string): string | undefined {
  const normalized = normalizeWebsiteUrl(url);
  if (!normalized) {
    return undefined;
  }

  try {
    const hostname = new URL(normalized).hostname.toLowerCase();
    return hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}
