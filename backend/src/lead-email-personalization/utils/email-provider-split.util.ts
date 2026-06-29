import { createHash } from 'node:crypto';
import { EMAIL_PROVIDERS } from '../constants';

export type SplitEmailProvider = 'groq' | 'openrouter';

export const DEFAULT_EMAIL_GROQ_SPLIT_PERCENT = 70;

export function parseGroqSplitPercent(raw?: string): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_EMAIL_GROQ_SPLIT_PERCENT;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_EMAIL_GROQ_SPLIT_PERCENT;
  }

  return Math.min(100, Math.max(0, parsed));
}

export function assignEmailProviderForLead(
  leadId: string,
  groqPercent = DEFAULT_EMAIL_GROQ_SPLIT_PERCENT,
): SplitEmailProvider {
  const hash = createHash('sha256').update(leadId).digest();
  const bucket = hash[0]! % 100;
  return bucket < groqPercent ? 'groq' : 'openrouter';
}

export function oppositeEmailProvider(
  provider: SplitEmailProvider,
): SplitEmailProvider {
  return provider === 'groq' ? 'openrouter' : 'groq';
}

export function toSplitProviderLabel(provider: SplitEmailProvider) {
  return provider === 'groq' ? EMAIL_PROVIDERS.GROQ : EMAIL_PROVIDERS.OPENROUTER;
}
