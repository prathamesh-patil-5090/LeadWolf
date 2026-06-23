export interface DiscoveredLead {
  name: string;
  role: string;
  company: string;
  profileUrl: string;
}

export interface LeadSearchCriteria {
  query: string;
  role?: string;
  location?: string;
  company?: string;
  limit: number;
}

export interface LeadSearchProvider {
  search(criteria: LeadSearchCriteria): Promise<DiscoveredLead[]>;
}
