import {
  normalizeProfileUrl,
  parseLinkedInResult,
  resolveLinkedInProfileUrl,
} from './linkedin-result.parser';
import {
  extractDuckDuckGoHits,
  mapSearchHitsToLeads,
} from './search-results.parser';

describe('linkedin-result.parser', () => {
  it('resolves duckduckgo redirect urls to linkedin profiles', () => {
    const url = resolveLinkedInProfileUrl(
      '//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fjanedoe',
    );

    expect(url).toBe('https://www.linkedin.com/in/janedoe');
  });

  it('parses linkedin search result titles', () => {
    const lead = parseLinkedInResult(
      'Jane Doe - Senior Software Engineer - Acme AI | LinkedIn',
      'https://www.linkedin.com/in/janedoe',
    );

    expect(lead).toEqual({
      name: 'Jane Doe',
      role: 'Senior Software Engineer',
      company: 'Acme AI',
      profileUrl: 'https://www.linkedin.com/in/janedoe',
    });
  });

  it('parses role at company from title', () => {
    const lead = parseLinkedInResult(
      'John Smith - CTO at FinTech Labs | LinkedIn',
      'https://www.linkedin.com/in/johnsmith',
    );

    expect(lead).toEqual({
      name: 'John Smith',
      role: 'CTO',
      company: 'FinTech Labs',
      profileUrl: 'https://www.linkedin.com/in/johnsmith',
    });
  });

  it('normalizes linkedin profile urls', () => {
    expect(
      normalizeProfileUrl(
        'https://www.linkedin.com/in/janedoe?trk=public_profile',
      ),
    ).toBe('https://www.linkedin.com/in/janedoe');
  });
});

describe('search-results.parser', () => {
  it('maps search hits into discovered leads', () => {
    const leads = mapSearchHitsToLeads([
      {
        title: 'Jane Doe - CTO - Acme AI | LinkedIn',
        href: 'https://www.linkedin.com/in/janedoe',
        snippet: 'CTO at Acme AI',
      },
    ]);

    expect(leads).toHaveLength(1);
    expect(leads[0].profileUrl).toBe('https://www.linkedin.com/in/janedoe');
  });

  it('throws when duckduckgo returns a captcha page', () => {
    expect(() =>
      extractDuckDuckGoHits(
        '<div class="anomaly-modal__title">bots use DuckDuckGo</div>',
      ),
    ).toThrow(/CAPTCHA detected/i);
  });
});

describe('search-query.builder', () => {
  it('builds a linkedin site search query from criteria', async () => {
    const { buildDiscoveryQuery } = await import('./search-query.builder');

    expect(
      buildDiscoveryQuery({
        query: 'CTO AI Startups India',
        limit: 25,
      }),
    ).toBe('site:linkedin.com/in CTO AI Startups India');
  });

  it('dedupes repeated role and location terms', async () => {
    const { buildDiscoveryQuery, buildLangSearchQuery } = await import(
      './search-query.builder'
    );

    expect(
      buildDiscoveryQuery({
        query: 'AI startup',
        role: 'Founder',
        location: 'India',
        limit: 10,
      }),
    ).toBe('site:linkedin.com/in AI startup Founder India');

    expect(
      buildLangSearchQuery({
        query: 'AI startup',
        role: 'Founder',
        location: 'India',
        limit: 10,
      }),
    ).toBe('LinkedIn profile Founder AI startup India');
  });
});
