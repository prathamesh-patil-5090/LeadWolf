import {
  normalizeWebsiteUrl,
  parseEmailFromText,
  parseLinkedInUrl,
} from './github-profile.parser';

describe('github-profile.parser', () => {
  it('parses email from bio text', () => {
    expect(
      parseEmailFromText(null, 'Reach me at contact@shivsingh.com for work'),
    ).toBe('contact@shivsingh.com');
  });

  it('ignores github noreply emails', () => {
    expect(parseEmailFromText('107933182+shivsinghin@users.noreply.github.com')).toBeUndefined();
  });

  it('parses linkedin short form', () => {
    expect(parseLinkedInUrl('in/shivsinghin')).toBe(
      'https://www.linkedin.com/in/shivsinghin',
    );
  });

  it('normalizes website urls', () => {
    expect(normalizeWebsiteUrl('shivsingh.com')).toBe('https://shivsingh.com');
  });
});
