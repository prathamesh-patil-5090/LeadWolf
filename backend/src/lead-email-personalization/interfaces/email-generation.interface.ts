export interface OutreachEmailContext {
  leadName: string;
  leadRole: string;
  leadCompany: string;
  leadEmail: string;
  leadLocation?: string;
  leadWebsite?: string;
  leadGithub?: string;
  leadLinkedin?: string;
  leadProfileUrl?: string;
  companySummary?: string;
  companyIndustry?: string;
  companyProducts?: string;
  personalizationHooks: string[];
  personalizeViaProfile: boolean;
  /** True when sending to a shared inbox (info@, contact@, etc.). */
  addressAsCompanyInbox: boolean;
  senderName: string;
  senderTitle: string;
  senderCompany: string;
  senderLinkedin: string;
  senderGithub: string;
  senderWhatsapp: string;
  senderEmail: string;
  senderPitch: string;
  signatureBlock: string;
}

export interface GeneratedEmailDraft {
  subject: string;
  body: string;
}

export interface ProviderGenerationResult {
  provider: string;
  model: string;
  draft?: GeneratedEmailDraft;
  latencyMs: number;
  error?: string;
}
