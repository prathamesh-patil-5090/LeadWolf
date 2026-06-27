import { VerificationCheckResult } from '../interfaces/verification-result.interface';
import { isFreeEmailDomain } from '../../shared/email/free-email-domains';

export function checkDomainMatch(
  emailDomain: string,
  companyDomain?: string,
): VerificationCheckResult {
  const normalizedEmailDomain = emailDomain.toLowerCase();

  if (isFreeEmailDomain(normalizedEmailDomain)) {
    return {
      passed: true,
      score: 15,
      detail: `Allowed personal email (${normalizedEmailDomain})`,
    };
  }

  if (!companyDomain) {
    return {
      passed: false,
      score: 5,
      detail: 'No company domain to compare',
    };
  }

  const normalizedCompanyDomain = companyDomain
    .toLowerCase()
    .replace(/^www\./, '');

  if (
    normalizedEmailDomain === normalizedCompanyDomain ||
    normalizedEmailDomain.endsWith(`.${normalizedCompanyDomain}`)
  ) {
    return {
      passed: true,
      score: 20,
      detail: `Matches company domain ${normalizedCompanyDomain}`,
    };
  }

  return {
    passed: false,
    score: 5,
    detail: `Email domain ${normalizedEmailDomain} does not match ${normalizedCompanyDomain}`,
  };
}
