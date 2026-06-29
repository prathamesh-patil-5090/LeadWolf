import { ConfigService } from '@nestjs/config';
import { isGenericCompanyInbox } from '../../shared/email/email.utils';
import { OutreachEmailContext } from '../interfaces/email-generation.interface';
import {
  buildProfilePersonalizationHooks,
  shouldPersonalizeViaProfile,
} from './profile-context.util';

export interface SenderSignatureConfig {
  senderName: string;
  senderTitle: string;
  senderCompany: string;
  senderLinkedin: string;
  senderGithub: string;
  senderWhatsapp: string;
  senderEmail: string;
  senderContactEmails: string;
  senderPitch: string;
}

export function loadSenderSignatureConfig(
  configService: ConfigService,
): SenderSignatureConfig {
  return {
    senderName: configService.get<string>('OUTREACH_SENDER_NAME', 'Your Name'),
    senderTitle: configService.get<string>(
      'OUTREACH_SENDER_TITLE',
      'Full-Stack AI Engineer',
    ),
    senderCompany: configService.get<string>('OUTREACH_SENDER_COMPANY', 'CRag'),
    senderLinkedin: configService.get<string>('OUTREACH_SENDER_LINKEDIN', ''),
    senderGithub: configService.get<string>('OUTREACH_SENDER_GITHUB', ''),
    senderWhatsapp: configService.get<string>('OUTREACH_SENDER_WHATSAPP', ''),
    senderEmail: configService.get<string>('OUTREACH_SENDER_EMAIL', ''),
    senderContactEmails: resolveContactEmails(configService),
    senderPitch: configService.get<string>(
      'OUTREACH_SENDER_PITCH',
      'CRag is an AI-Powered Engineering Knowledge Platform that reduces onboarding time and eliminates documentation drift',
    ),
  };
}

export function buildSenderSignatureBlock(
  config: Pick<
    SenderSignatureConfig,
    | 'senderName'
    | 'senderTitle'
    | 'senderCompany'
    | 'senderLinkedin'
    | 'senderGithub'
    | 'senderWhatsapp'
    | 'senderEmail'
    | 'senderContactEmails'
  >,
): string {
  const lines = ['Best regards,', '', config.senderName];

  if (config.senderCompany?.trim()) {
    lines.push(`Founder, ${config.senderCompany.trim()}`);
  }

  lines.push(config.senderTitle);

  if (config.senderLinkedin?.trim()) {
    lines.push('', 'LinkedIn:', config.senderLinkedin.trim());
  }

  if (config.senderGithub?.trim()) {
    lines.push('', 'GitHub:', config.senderGithub.trim());
  }

  if (config.senderContactEmails?.trim()) {
    lines.push('', `Contact: ${config.senderContactEmails.trim()}`);
  }

  if (config.senderWhatsapp?.trim()) {
    lines.push(`Contact & WhatsApp No: ${config.senderWhatsapp.trim()}`);
  }

  return lines.join('\n');
}

function resolveContactEmails(configService: ConfigService) {
  const explicit = configService.get<string>('OUTREACH_SENDER_CONTACT_EMAILS');
  if (explicit?.trim()) {
    return explicit.trim();
  }

  const primary = configService.get<string>('OUTREACH_SENDER_EMAIL', '').trim();
  const alt = configService.get<string>('OUTREACH_SENDER_ALT_EMAIL', '').trim();

  if (primary && alt) {
    return `${primary} / ${alt}`;
  }

  return primary || alt;
}

const SIGNATURE_START_PATTERN = /(\n|^)\s*Best regards,\s*(\n|$)/i;

export function refreshEmailSignature(
  body: string,
  signatureBlock: string,
): string {
  const trimmedBody = body.trim();
  const signatureStart = trimmedBody.search(SIGNATURE_START_PATTERN);
  const messageBody =
    signatureStart >= 0
      ? trimmedBody.slice(0, signatureStart).trim()
      : trimmedBody;

  if (!messageBody) {
    return signatureBlock;
  }

  return `${messageBody}\n\n${signatureBlock}`;
}

export function ensureEmailSignature(
  body: string,
  signatureBlock: string,
  _senderEmail?: string,
): string {
  return refreshEmailSignature(body, signatureBlock);
}

export function toOutreachEmailContext(
  lead: {
    name: string;
    role: string;
    company: string;
    email: string | null;
    location: string | null;
    website: string | null;
    companyWebsite: string | null;
    profileUrl: string;
    githubUrl: string | null;
    linkedinUrl: string | null;
    companyRecord: {
      summary: string | null;
      industry: string | null;
      products: string | null;
      personalizationHooks: unknown;
    } | null;
  },
  sender: SenderSignatureConfig,
): OutreachEmailContext {
  const companyHooks = Array.isArray(lead.companyRecord?.personalizationHooks)
    ? lead.companyRecord.personalizationHooks.filter(
        (hook): hook is string => typeof hook === 'string',
      )
    : [];

  const profileHooks = buildProfilePersonalizationHooks({
    githubUrl: lead.githubUrl,
    linkedinUrl: lead.linkedinUrl,
    profileUrl: lead.profileUrl,
    location: lead.location,
    website: lead.website ?? lead.companyWebsite,
  });

  const signatureBlock = buildSenderSignatureBlock(sender);
  const addressAsCompanyInbox = isGenericCompanyInbox(lead.email);

  const context: OutreachEmailContext = {
    leadName: lead.name,
    leadRole: lead.role,
    leadCompany: lead.company,
    leadEmail: lead.email!,
    leadLocation: lead.location ?? undefined,
    leadWebsite: lead.website ?? lead.companyWebsite ?? undefined,
    leadGithub: lead.githubUrl ?? undefined,
    leadLinkedin: lead.linkedinUrl ?? undefined,
    leadProfileUrl: lead.profileUrl ?? undefined,
    companySummary: lead.companyRecord?.summary ?? undefined,
    companyIndustry: lead.companyRecord?.industry ?? undefined,
    companyProducts: lead.companyRecord?.products ?? undefined,
    personalizationHooks: addressAsCompanyInbox
      ? companyHooks
      : [...profileHooks, ...companyHooks],
    personalizeViaProfile: false,
    addressAsCompanyInbox,
    senderName: sender.senderName,
    senderTitle: sender.senderTitle,
    senderCompany: sender.senderCompany,
    senderLinkedin: sender.senderLinkedin,
    senderGithub: sender.senderGithub,
    senderWhatsapp: sender.senderWhatsapp,
    senderEmail: sender.senderEmail,
    senderPitch: sender.senderPitch,
    signatureBlock,
  };

  context.personalizeViaProfile = shouldPersonalizeViaProfile(context);

  return context;
}
