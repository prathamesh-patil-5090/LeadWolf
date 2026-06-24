/** GitHub search keywords for broad technical lead discovery */
export const TECH_SEARCH_ROLES = [
  'CTO',
  'Chief Technology Officer',
  'VP Engineering',
  'Engineering Manager',
  'Tech Lead',
  'Staff Engineer',
  'Principal Engineer',
  'Distinguished Engineer',
  'Architect',
  'Solutions Architect',
  'Senior Software Engineer',
  'Software Engineer',
  'Backend Engineer',
  'Frontend Engineer',
  'Full Stack Engineer',
  'Fullstack Developer',
  'DevOps Engineer',
  'SRE',
  'Site Reliability Engineer',
  'Cloud Engineer',
  'Platform Engineer',
  'Infrastructure Engineer',
  'Data Engineer',
  'Data Scientist',
  'ML Engineer',
  'Machine Learning Engineer',
  'AI Engineer',
  'MLOps Engineer',
  'Founder',
  'Co-Founder',
  'Technical Co-Founder',
  'Startup Founder',
  'Product Engineer',
  'Security Engineer',
  'Cybersecurity Engineer',
  'Mobile Developer',
  'iOS Developer',
  'Android Developer',
  'React Developer',
  'Node.js Developer',
  'Python Developer',
  'Golang Developer',
  'Rust Developer',
  'Blockchain Developer',
  'Web3 Developer',
  'Embedded Engineer',
  'Firmware Engineer',
  'QA Engineer',
  'SDET',
  'Test Engineer',
  'Engineering Director',
  'Head of Engineering',
  'Head of Technology',
] as const;

/** Bio/title patterns mapped to normalized role labels */
export const TECH_ROLE_PATTERNS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /\bchief technology officer\b/i, role: 'CTO' },
  { pattern: /\bcto\b/i, role: 'CTO' },
  { pattern: /\bvp of engineering\b/i, role: 'VP Engineering' },
  { pattern: /\bvp engineering\b/i, role: 'VP Engineering' },
  { pattern: /\bengineering manager\b/i, role: 'Engineering Manager' },
  { pattern: /\bhead of engineering\b/i, role: 'Head of Engineering' },
  { pattern: /\btech lead\b/i, role: 'Tech Lead' },
  { pattern: /\bstaff engineer\b/i, role: 'Staff Engineer' },
  { pattern: /\bprincipal engineer\b/i, role: 'Principal Engineer' },
  { pattern: /\bsolutions architect\b/i, role: 'Solutions Architect' },
  { pattern: /\bco-founder\b/i, role: 'Co-Founder' },
  { pattern: /\bfounder\b/i, role: 'Founder' },
  { pattern: /\bdevops\b/i, role: 'DevOps Engineer' },
  { pattern: /\bsre\b/i, role: 'Site Reliability Engineer' },
  { pattern: /\bmlops\b/i, role: 'MLOps Engineer' },
  { pattern: /\bmachine learning engineer\b/i, role: 'Machine Learning Engineer' },
  { pattern: /\bml engineer\b/i, role: 'ML Engineer' },
  { pattern: /\bai engineer\b/i, role: 'AI Engineer' },
  { pattern: /\bdata engineer\b/i, role: 'Data Engineer' },
  { pattern: /\bdata scientist\b/i, role: 'Data Scientist' },
  { pattern: /\bfull[\s-]?stack\b/i, role: 'Full Stack Engineer' },
  { pattern: /\bfrontend engineer\b/i, role: 'Frontend Engineer' },
  { pattern: /\bbackend engineer\b/i, role: 'Backend Engineer' },
  { pattern: /\bsenior software engineer\b/i, role: 'Senior Software Engineer' },
  { pattern: /\bsoftware engineer\b/i, role: 'Software Engineer' },
  { pattern: /\bsecurity engineer\b/i, role: 'Security Engineer' },
  { pattern: /\bplatform engineer\b/i, role: 'Platform Engineer' },
  { pattern: /\bcloud engineer\b/i, role: 'Cloud Engineer' },
  { pattern: /\bios developer\b/i, role: 'iOS Developer' },
  { pattern: /\bandroid developer\b/i, role: 'Android Developer' },
  { pattern: /\bqa engineer\b/i, role: 'QA Engineer' },
];

export function resolveSearchRoles(criteria: {
  role?: string;
  roles?: string[];
  expandTechRoles?: boolean;
}): string[] {
  if (criteria.roles?.length) {
    return criteria.roles;
  }

  if (criteria.role) {
    return [criteria.role];
  }

  if (criteria.expandTechRoles !== false) {
    return [...TECH_SEARCH_ROLES];
  }

  return [];
}

export function chunkRoles(roles: string[], size: number): string[][] {
  const chunks: string[][] = [];

  for (let index = 0; index < roles.length; index += size) {
    chunks.push(roles.slice(index, index + size));
  }

  return chunks;
}
