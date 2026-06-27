import { Injectable } from '@nestjs/common';
import { extractDomain } from '../lead-company-discovery/utils/extract-domain';
import { normalizeEmail } from '../shared/email/email.utils';
import { checkDomainMatch } from './checkers/domain-match.checker';
import { isDisposableEmailDomain } from './checkers/disposable-email.checker';
import { checkMxRecords } from './checkers/mx-record.checker';
import { VERIFICATION_MIN_CONFIDENCE } from './constants';
import {
  ContactVerificationResult,
  VerificationChecks,
} from './interfaces/verification-result.interface';

@Injectable()
export class ContactVerificationEngine {
  async verify(
    email: string,
    companyDomain?: string,
  ): Promise<ContactVerificationResult> {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      return this.failedResult(email, 'Invalid email format');
    }

    const emailDomain = normalized.split('@')[1] ?? '';
    const failures: string[] = [];

    const format: VerificationChecks['format'] = {
      passed: true,
      score: 15,
      detail: 'Valid email format',
    };

    const disposablePassed = !isDisposableEmailDomain(emailDomain);
    const disposable = {
      passed: disposablePassed,
      score: disposablePassed ? 25 : 0,
      detail: disposablePassed
        ? 'Not a known disposable domain'
        : `Disposable domain: ${emailDomain}`,
    };
    if (!disposablePassed) {
      failures.push(disposable.detail!);
    }

    const mx = await checkMxRecords(emailDomain);
    if (!mx.passed) {
      failures.push(mx.detail ?? 'MX check failed');
    }

    const domainMatch = checkDomainMatch(emailDomain, companyDomain);
    if (!domainMatch.passed && domainMatch.detail) {
      failures.push(domainMatch.detail);
    }

    const checks: VerificationChecks = {
      format,
      disposable,
      mx,
      domainMatch,
    };

    const confidence =
      format.score +
      (disposable.passed ? disposable.score : 0) +
      (mx.passed ? mx.score : 0) +
      domainMatch.score;

    const verified =
      disposable.passed &&
      mx.passed &&
      confidence >= VERIFICATION_MIN_CONFIDENCE;

    return {
      verified,
      confidence,
      email: normalized,
      checks,
      failures,
    };
  }

  resolveCompanyDomain(
    companyWebsite?: string | null,
    companyRecordDomain?: string | null,
  ): string | undefined {
    return (
      companyRecordDomain ??
      (companyWebsite ? extractDomain(companyWebsite) : undefined)
    );
  }

  private failedResult(email: string, reason: string): ContactVerificationResult {
    return {
      verified: false,
      confidence: 0,
      email,
      checks: {
        format: { passed: false, score: 0, detail: reason },
        disposable: { passed: false, score: 0 },
        mx: { passed: false, score: 0 },
        domainMatch: { passed: false, score: 0 },
      },
      failures: [reason],
    };
  }
}
