import { promises as dns } from 'node:dns';
import { VerificationCheckResult } from '../interfaces/verification-result.interface';

const MX_LOOKUP_TIMEOUT_MS = 5_000;

export async function checkMxRecords(
  domain: string,
): Promise<VerificationCheckResult> {
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MX lookup timeout')), MX_LOOKUP_TIMEOUT_MS),
      ),
    ]);

    if (!records.length) {
      return {
        passed: false,
        score: 0,
        detail: 'No MX records found',
      };
    }

    const exchanges = records
      .sort((a, b) => a.priority - b.priority)
      .map((record) => record.exchange)
      .join(', ');

    return {
      passed: true,
      score: 40,
      detail: exchanges,
    };
  } catch (error) {
    return {
      passed: false,
      score: 0,
      detail:
        error instanceof Error ? error.message : 'MX lookup failed',
    };
  }
}
