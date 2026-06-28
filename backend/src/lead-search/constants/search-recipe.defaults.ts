export interface DefaultSearchRecipe {
  slug: string;
  name: string;
  description: string;
  query: string;
  role?: string;
  roles: string[];
  location?: string;
  company?: string;
  limit: number;
  expandTechRoles: boolean;
  sortOrder: number;
}

export const DEFAULT_SEARCH_RECIPES: DefaultSearchRecipe[] = [
  {
    slug: 'india-saas-startups',
    name: 'India SaaS / product startups',
    description:
      'CTO, VP Eng, and Eng Managers at Indian SaaS companies. Good starting point for CRag outreach.',
    query: 'SaaS startup',
    roles: ['CTO', 'VP Engineering', 'Engineering Manager'],
    location: 'India',
    company: '',
    limit: 15,
    expandTechRoles: false,
    sortOrder: 1,
  },
  {
    slug: 'remote-global-leaders',
    name: 'Remote-first / global eng leaders',
    description:
      'Senior engineering leaders at remote-first or developer-tools companies.',
    query: 'remote engineering',
    roles: ['CTO', 'Head of Engineering', 'Engineering Director'],
    location: 'United States',
    company: '',
    limit: 15,
    expandTechRoles: false,
    sortOrder: 2,
  },
  {
    slug: 'doc-onboarding-pain',
    name: 'Doc / onboarding pain',
    description:
      'Platform and eng managers at teams likely to feel documentation drift.',
    query: 'platform team',
    roles: ['Engineering Manager', 'Platform Engineer', 'Tech Lead'],
    location: 'India',
    company: '',
    limit: 10,
    expandTechRoles: false,
    sortOrder: 3,
  },
  {
    slug: 'technical-founders',
    name: 'Technical founders',
    description: 'Founders at seed/Series A startups — fast yes/no conversations.',
    query: 'seed startup',
    role: 'Founder',
    roles: [],
    location: 'India',
    company: '',
    limit: 10,
    expandTechRoles: false,
    sortOrder: 4,
  },
  {
    slug: 'named-account',
    name: 'Named account',
    description:
      'Target one company — edit the company field (e.g. Razorpay, Postman).',
    query: 'engineering',
    role: 'CTO',
    roles: [],
    location: '',
    company: 'Razorpay',
    limit: 5,
    expandTechRoles: false,
    sortOrder: 5,
  },
];
