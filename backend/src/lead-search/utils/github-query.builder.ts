import { LeadSearchCriteria } from '../interfaces/lead-search-provider.interface';

/** GitHub user search works better with short keywords than full job titles */
const ROLE_GITHUB_KEYWORDS: Record<string, string> = {
  CTO: 'CTO',
  'Chief Technology Officer': 'CTO',
  'VP Engineering': 'VP engineering',
  'Engineering Manager': 'engineering manager',
  'Tech Lead': 'tech lead',
  'Staff Engineer': 'staff engineer',
  'Principal Engineer': 'principal engineer',
  'Distinguished Engineer': 'distinguished engineer',
  Architect: 'architect',
  'Solutions Architect': 'architect',
  'Senior Software Engineer': 'senior engineer',
  'Software Engineer': 'engineer',
  'Backend Engineer': 'backend engineer',
  'Frontend Engineer': 'frontend engineer',
  'Full Stack Engineer': 'fullstack',
  'Fullstack Developer': 'fullstack',
  'DevOps Engineer': 'devops',
  SRE: 'SRE',
  'Site Reliability Engineer': 'SRE',
  'Cloud Engineer': 'cloud engineer',
  'Platform Engineer': 'platform engineer',
  'Infrastructure Engineer': 'infrastructure',
  'Data Engineer': 'data engineer',
  'Data Scientist': 'data scientist',
  'ML Engineer': 'machine learning',
  'Machine Learning Engineer': 'machine learning',
  'AI Engineer': 'AI engineer',
  'MLOps Engineer': 'mlops',
  Founder: 'founder',
  'Co-Founder': 'founder',
  'Technical Co-Founder': 'founder',
  'Startup Founder': 'founder',
  'Product Engineer': 'product engineer',
  'Security Engineer': 'security engineer',
  'Cybersecurity Engineer': 'security',
  'Mobile Developer': 'mobile developer',
  'iOS Developer': 'iOS developer',
  'Android Developer': 'android developer',
  'React Developer': 'react developer',
  'Node.js Developer': 'nodejs',
  'Python Developer': 'python developer',
  'Golang Developer': 'golang',
  'Rust Developer': 'rust developer',
  'Blockchain Developer': 'blockchain',
  'Web3 Developer': 'web3',
  'Embedded Engineer': 'embedded',
  'Firmware Engineer': 'firmware',
  'QA Engineer': 'QA engineer',
  SDET: 'SDET',
  'Test Engineer': 'test engineer',
  'Engineering Director': 'engineering director',
  'Head of Engineering': 'head of engineering',
  'Head of Technology': 'head of technology',
};

export function toGithubSearchKeyword(role: string): string {
  return ROLE_GITHUB_KEYWORDS[role] ?? role;
}

export function buildGithubSearchQuery(criteria: LeadSearchCriteria): string {
  const roleKeyword = criteria.role
    ? toGithubSearchKeyword(criteria.role)
    : undefined;

  const terms = [
    roleKeyword,
    criteria.query,
    criteria.company,
    criteria.location ? `location:${criteria.location}` : undefined,
    'type:user',
  ].filter((term): term is string => Boolean(term?.trim()));

  return terms.join(' ');
}
