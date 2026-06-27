import {
  mapBrightDataRecordToDiscoveredLead,
} from './linkedin-profile.mapper';

describe('linkedin-profile.mapper', () => {
  it('maps a full Bright Data profile to a discovered lead', () => {
    const lead = mapBrightDataRecordToDiscoveredLead({
      url: 'https://www.linkedin.com/in/janedoe',
      name: 'Jane Doe',
      position: 'CTO at Acme AI',
      city: 'Bangalore, Karnataka, India',
      current_company: { name: 'Acme AI' },
      bio_links: [{ link: 'https://acme.ai' }],
    });

    expect(lead).toEqual({
      name: 'Jane Doe',
      role: 'CTO',
      company: 'Acme AI',
      profileUrl: 'https://www.linkedin.com/in/janedoe',
      linkedinUrl: 'https://www.linkedin.com/in/janedoe',
      location: 'Bangalore, Karnataka, India',
      website: 'https://acme.ai',
    });
  });

  it('maps discovery-style records with subtitle', () => {
    const lead = mapBrightDataRecordToDiscoveredLead({
      url: 'https://www.linkedin.com/in/johnsmith',
      name: 'John Smith',
      subtitle: 'Founder at Creative Humans AI',
      location: 'India',
    });

    expect(lead?.role).toBe('Founder');
    expect(lead?.company).toBe('Creative Humans AI');
  });
});
