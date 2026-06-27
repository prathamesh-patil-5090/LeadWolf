import { DiscoveredLead } from '../interfaces/lead-search-provider.interface';

const LINKEDIN_PROFILE_PATTERN = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/i;

export function resolveLinkedInProfileUrl(href: string): string | null {
  if (!href) {
    return null;
  }

  try {
    const absolute = href.startsWith('//')
      ? `https:${href}`
      : href.startsWith('http')
        ? href
        : `https://${href}`;

    const parsed = new URL(absolute);

    if (
      parsed.hostname.includes('duckduckgo.com') &&
      parsed.searchParams.has('uddg')
    ) {
      return normalizeProfileUrl(
        decodeURIComponent(parsed.searchParams.get('uddg') ?? ''),
      );
    }

    return normalizeProfileUrl(absolute);
  } catch {
    return null;
  }
}

export function normalizeProfileUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.href.match(LINKEDIN_PROFILE_PATTERN);

    if (!match) {
      return null;
    }

    const slug = match[0].replace(/linkedin\.com\/in\//i, '');
    return `https://www.linkedin.com/in/${slug.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
}

export function parseLinkedInResult(
  title: string,
  profileUrl: string,
  snippet = '',
): DiscoveredLead | null {
  const cleanedTitle = title
    .replace(/\s*\|\s*LinkedIn.*$/i, '')
    .replace(/\s*-\s*LinkedIn.*$/i, '')
    .trim();

  if (!cleanedTitle) {
    return null;
  }

  const titleParts = cleanedTitle
    .split(/\s+[-–—|]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const name = titleParts[0] ?? 'Unknown';
  let role = titleParts[1] ?? '';
  let company = titleParts[2] ?? '';

  const atMatch = role.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atMatch && !company) {
    role = atMatch[1].trim();
    company = atMatch[2].trim();
  }

  if (!role || !company) {
    const snippetMatch = snippet.match(
      /([^.]+?)\s+at\s+([^.]+?)(?:\.|$)/i,
    );
    if (snippetMatch) {
      role = role || snippetMatch[1].trim();
      company = company || snippetMatch[2].trim();
    }
  }

  return {
    name,
    role: role || 'Unknown',
    company: company || 'Unknown',
    profileUrl,
  };
}
