import {
  dedupeDiscoveredLeads,
  mergeDiscoveredLeadSources,
} from './lead-merge.util';
import { DiscoveredLead } from '../interfaces/lead-search-provider.interface';

describe('lead-merge.util', () => {
  it('merges github and linkedin records for the same person', () => {
    const merged = mergeDiscoveredLeadSources(
      [
        {
          name: 'Jane Doe',
          role: 'Engineer',
          company: 'Unknown',
          profileUrl: 'https://github.com/janedoe',
          email: 'jane@example.com',
          githubUrl: 'https://github.com/janedoe',
          linkedinUrl: 'https://www.linkedin.com/in/janedoe',
        },
      ],
      [
        {
          name: 'Jane Doe',
          role: 'CTO',
          company: 'Acme AI',
          profileUrl: 'https://www.linkedin.com/in/janedoe',
          linkedinUrl: 'https://www.linkedin.com/in/janedoe',
          location: 'India',
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      profileUrl: 'https://github.com/janedoe',
      role: 'Engineer',
      company: 'Acme AI',
      email: 'jane@example.com',
      linkedinUrl: 'https://www.linkedin.com/in/janedoe',
      location: 'India',
    });
  });

  it('keeps unmatched github and linkedin leads', () => {
    const merged = mergeDiscoveredLeadSources(
      [
        {
          name: 'Git User',
          role: 'Dev',
          company: 'GitCo',
          profileUrl: 'https://github.com/gituser',
        },
      ],
      [
        {
          name: 'Linked User',
          role: 'Founder',
          company: 'LinkedCo',
          profileUrl: 'https://www.linkedin.com/in/linkeduser',
          linkedinUrl: 'https://www.linkedin.com/in/linkeduser',
        },
      ],
    );

    expect(merged).toHaveLength(2);
  });

  it('dedupes linkedin-only leads by profile url', () => {
    const unique = dedupeDiscoveredLeads([
      {
        name: 'A',
        role: 'CTO',
        company: 'Co',
        profileUrl: 'https://www.linkedin.com/in/user-a',
      },
      {
        name: 'A duplicate',
        role: 'CTO',
        company: 'Co',
        profileUrl: 'https://www.linkedin.com/in/user-a?trk=foo',
        linkedinUrl: 'https://www.linkedin.com/in/user-a',
      },
    ]);

    expect(unique).toHaveLength(1);
  });
});
