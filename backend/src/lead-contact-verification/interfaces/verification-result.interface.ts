export interface VerificationCheckResult {
  passed: boolean;
  score: number;
  detail?: string;
}

export interface VerificationChecks {
  format: VerificationCheckResult;
  disposable: VerificationCheckResult;
  mx: VerificationCheckResult;
  domainMatch: VerificationCheckResult;
}

export interface ContactVerificationResult {
  verified: boolean;
  confidence: number;
  email: string;
  checks: VerificationChecks;
  failures: string[];
}
