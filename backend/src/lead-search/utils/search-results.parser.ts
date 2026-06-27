import { DiscoveredLead } from '../interfaces/lead-search-provider.interface';
import {
  parseLinkedInResult,
  resolveLinkedInProfileUrl,
} from './linkedin-result.parser';

export interface RawSearchHit {
  title: string;
  href: string;
  snippet?: string;
}

export function mapSearchHitsToLeads(hits: RawSearchHit[]): DiscoveredLead[] {
  const leads: DiscoveredLead[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    const profileUrl = resolveLinkedInProfileUrl(hit.href);
    if (!profileUrl || seen.has(profileUrl)) {
      continue;
    }

    const lead = parseLinkedInResult(hit.title, profileUrl, hit.snippet ?? '');
    if (!lead) {
      continue;
    }

    seen.add(profileUrl);
    leads.push(lead);
  }

  return leads;
}

export function extractDuckDuckGoHits(html: string): RawSearchHit[] {
  if (html.includes('anomaly-modal') || html.includes('bots use DuckDuckGo')) {
    throw new Error(
      'Search engine CAPTCHA detected. Set LANGSEARCH_API_KEY or use LEAD_SEARCH_PROVIDER=github for reliable lead discovery.',
    );
  }

  const hits: RawSearchHit[] = [];
  const anchorPattern =
    /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const snippet = extractSnippet(html, match.index);
    hits.push({
      href: match[1],
      title: stripHtml(match[2]),
      snippet,
    });
  }

  return hits;
}

function extractSnippet(html: string, anchorIndex: number): string {
  const slice = html.slice(anchorIndex, anchorIndex + 1200);
  const snippetMatch = slice.match(
    /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/,
  );

  return snippetMatch ? stripHtml(snippetMatch[1]) : '';
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}
