const EMAIL_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

const LINKEDIN_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i;

const LINKEDIN_SHORT_PATTERN = /\bin\/([a-zA-Z0-9_-]+)\b/;

export function parseEmailFromText(...sources: Array<string | null | undefined>) {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    const match = source.match(EMAIL_PATTERN);
    if (match && !isDisposableGithubEmail(match[0])) {
      return match[0].toLowerCase();
    }
  }

  return undefined;
}

export function parseLinkedInUrl(
  ...sources: Array<string | null | undefined>
): string | undefined {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    const fullMatch = source.match(LINKEDIN_PATTERN);
    if (fullMatch) {
      return normalizeLinkedInUrl(fullMatch[0]);
    }

    const shortMatch = source.match(LINKEDIN_SHORT_PATTERN);
    if (shortMatch) {
      return `https://www.linkedin.com/in/${shortMatch[1]}`;
    }
  }

  return undefined;
}

export function normalizeWebsiteUrl(url?: string | null): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }

  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function normalizeLinkedInUrl(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
  if (!match) {
    return url;
  }

  return `https://www.linkedin.com/in/${match[1]}`;
}

function isDisposableGithubEmail(email: string): boolean {
  return email.endsWith('@users.noreply.github.com');
}
