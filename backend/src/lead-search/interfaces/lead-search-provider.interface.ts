export interface DiscoveredLead {
  name: string;
  role: string;
  company: string;
  profileUrl: string;
  email?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export interface LeadSearchCriteria {
  query: string;
  role?: string;
  roles?: string[];
  expandTechRoles?: boolean;
  location?: string;
  company?: string;
  limit: number;
}

export interface LeadSearchProvider {
  search(criteria: LeadSearchCriteria): Promise<DiscoveredLead[]>;
}
