import { DiscoveredContact } from '../../shared/email/email.utils';

export type { DiscoveredContact };

export interface ContactDiscoveryResult {
  contacts: DiscoveredContact[];
  picked?: DiscoveredContact;
}
