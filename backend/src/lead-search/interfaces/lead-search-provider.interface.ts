export interface DiscoveredLead {
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  email?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  location?: string;
}

export interface LeadSearchCriteria {
  query: string;
  role?: string;
  roles?: string[];
  expandTechRoles?: boolean;
  location?: string;
  company?: string;
  limit: number;
  excludeProfileUrls?: string[];
  roleStartPages?: Record<string, number>;
  /** Extra LinkedIn profile URLs to scrape (e.g. from GitHub leads). */
  seedLinkedInUrls?: string[];
}

export interface LeadSearchResult {
  leads: DiscoveredLead[];
  roleEndPages: Record<string, number>;
  pagesFetched: number;
  skippedExisting: number;
}

export interface LeadSearchProvider {
  search(criteria: LeadSearchCriteria): Promise<LeadSearchResult>;
}

export function wrapSearchResult(
  leads: DiscoveredLead[],
  criteria: LeadSearchCriteria,
  roleEndPages: Record<string, number> = {},
  pagesFetched = 0,
  skippedExisting = 0,
): LeadSearchResult {
  const exclude = new Set(criteria.excludeProfileUrls ?? []);
  const filtered: DiscoveredLead[] = [];
  let skipped = skippedExisting;

  for (const lead of leads) {
    if (exclude.has(lead.profileUrl)) {
      skipped += 1;
      continue;
    }

    filtered.push(lead);
    if (filtered.length >= criteria.limit) {
      break;
    }
  }

  return {
    leads: filtered,
    roleEndPages,
    pagesFetched,
    skippedExisting: skipped,
  };
}
