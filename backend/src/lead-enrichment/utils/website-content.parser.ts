import {
  normalizeWebsiteUrl,
  parseEmailFromText,
  parseLinkedInUrl,
} from '../../lead-search/utils/github-profile.parser';

const PORTFOLIO_HOST_PATTERNS = [
  /portfolio/i,
  /about\.me/i,
  /dev\.to/i,
  /hashnode/i,
  /medium\.com/i,
  /substack\.com/i,
];

export function parseWebsiteContent(html: string, pageUrl: string) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  const email = parseEmailFromText(text);
  const linkedinUrl = parseLinkedInUrl(text);

  const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)].map(
    (match) => match[1],
  );

  let portfolioUrl: string | undefined;
  for (const href of hrefMatches) {
    const absolute = toAbsoluteUrl(href, pageUrl);
    if (!absolute) {
      continue;
    }

    if (
      PORTFOLIO_HOST_PATTERNS.some((pattern) => pattern.test(absolute)) ||
      /portfolio/i.test(href)
    ) {
      portfolioUrl = absolute;
      break;
    }
  }

  return { email, linkedinUrl, portfolioUrl };
}

function toAbsoluteUrl(href: string, baseUrl: string): string | undefined {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return undefined;
  }
}

export async function fetchWebsiteText(url: string): Promise<string | null> {
  const normalized = normalizeWebsiteUrl(url);
  if (!normalized) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'LeadWolfBot/1.0',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
