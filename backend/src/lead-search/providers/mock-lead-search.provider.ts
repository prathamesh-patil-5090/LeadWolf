import { Injectable } from '@nestjs/common';
import {
  DiscoveredLead,
  LeadSearchCriteria,
  LeadSearchProvider,
  wrapSearchResult,
} from '../interfaces/lead-search-provider.interface';

@Injectable()
export class MockLeadSearchProvider implements LeadSearchProvider {
  async search(criteria: LeadSearchCriteria) {
    const role = criteria.role ?? this.inferRole(criteria.query);
    const location = criteria.location ?? this.inferLocation(criteria.query);
    const companyType = criteria.company ?? this.inferCompanyType(criteria.query);
    const count = Math.min(criteria.limit, 10);
    const startPage = Object.values(criteria.roleStartPages ?? {})[0] ?? 1;

    const leads = Array.from({ length: count }, (_, index) => {
      const id = (startPage - 1) * count + index + 1;
      const company = `${companyType} ${location} Labs ${id}`;

      return {
        name: `Sample Lead ${id}`,
        role,
        company,
        profileUrl: `https://linkedin.com/in/sample-lead-${id}`,
      };
    });

    return wrapSearchResult(leads, criteria, { __default__: startPage + 1 });
  }

  private inferRole(query: string): string {
    const normalized = query.toLowerCase();

    if (normalized.includes('cto')) return 'CTO';
    if (normalized.includes('founder')) return 'Founder';
    if (normalized.includes('senior')) return 'Senior Software Engineer';

    return 'Software Engineer';
  }

  private inferLocation(query: string): string {
    const normalized = query.toLowerCase();

    if (normalized.includes('india')) return 'India';
    if (normalized.includes('europe')) return 'Europe';
    if (normalized.includes('us') || normalized.includes('usa')) return 'US';

    return 'Global';
  }

  private inferCompanyType(query: string): string {
    const normalized = query.toLowerCase();

    if (normalized.includes('ai')) return 'AI Startup';
    if (normalized.includes('saas')) return 'SaaS';
    if (normalized.includes('fintech')) return 'Fintech';

    return 'Tech';
  }
}
