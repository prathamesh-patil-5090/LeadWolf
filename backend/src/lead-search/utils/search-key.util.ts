import { createHash } from 'node:crypto';

export interface SearchKeyInput {
  query: string;
  role?: string | null;
  roles?: string[];
  location?: string | null;
  company?: string | null;
  expandTechRoles?: boolean;
}

export function buildSearchKey(input: SearchKeyInput): string {
  const normalized = {
    query: input.query.trim().toLowerCase(),
    role: input.role?.trim().toLowerCase() ?? '',
    roles: [...(input.roles ?? [])].map((role) => role.trim().toLowerCase()).sort(),
    location: input.location?.trim().toLowerCase() ?? '',
    company: input.company?.trim().toLowerCase() ?? '',
    expandTechRoles: input.expandTechRoles ?? true,
  };

  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function roleCursorKey(role?: string) {
  return role?.trim() || '__default__';
}
