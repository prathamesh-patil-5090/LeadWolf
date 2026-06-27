import { createHash } from 'node:crypto';
import { EMAIL_PROVIDERS } from '../constants';

export type SplitEmailProvider = 'groq' | 'openrouter';

export function assignEmailProviderForLead(leadId: string): SplitEmailProvider {
  const hash = createHash('sha256').update(leadId).digest();
  return hash[0]! % 2 === 0 ? 'groq' : 'openrouter';
}

export function toSplitProviderLabel(provider: SplitEmailProvider) {
  return provider === 'groq' ? EMAIL_PROVIDERS.GROQ : EMAIL_PROVIDERS.OPENROUTER;
}
