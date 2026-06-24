import {
  resolveSearchRoles,
  TECH_SEARCH_ROLES,
} from '../constants/tech-positions';
import {
  buildGithubSearchQuery,
  toGithubSearchKeyword,
} from './github-query.builder';

describe('tech role search', () => {
  it('expands to all tech roles by default', () => {
    expect(resolveSearchRoles({ query: 'AI', expandTechRoles: true })).toEqual(
      TECH_SEARCH_ROLES,
    );
  });

  it('uses explicit roles when provided', () => {
    expect(
      resolveSearchRoles({
        roles: ['CTO', 'Founder'],
        expandTechRoles: true,
      }),
    ).toEqual(['CTO', 'Founder']);
  });

  it('maps co-founder to founder for github search', () => {
    expect(toGithubSearchKeyword('Co-Founder')).toBe('founder');
  });

  it('builds single-role github queries without parentheses', () => {
    expect(
      buildGithubSearchQuery({
        query: 'AI',
        role: 'CTO',
        location: 'India',
        limit: 10,
      }),
    ).toBe('CTO AI location:India type:user');
  });
});
