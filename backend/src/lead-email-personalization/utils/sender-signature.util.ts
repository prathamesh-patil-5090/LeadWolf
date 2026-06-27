import { ConfigService } from '@nestjs/config';
import { OutreachEmailContext } from '../interfaces/email-generation.interface';

export interface SenderSignatureConfig {
  senderName: string;
  senderTitle: string;
  senderCompany: string;
  senderLinkedin: string;
  senderGithub: string;
  senderWhatsapp: string;
  senderEmail: string;
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
    senderCompany: configService.get<string>('OUTREACH_SENDER_COMPANY', ''),
    senderLinkedin: configService.get<string>('OUTREACH_SENDER_LINKEDIN', ''),
    senderGithub: configService.get<string>('OUTREACH_SENDER_GITHUB', ''),
    senderWhatsapp: configService.get<string>('OUTREACH_SENDER_WHATSAPP', ''),
    senderEmail: configService.get<string>('OUTREACH_SENDER_EMAIL', ''),
    senderPitch: configService.get<string>(
      'OUTREACH_SENDER_PITCH',
      'building affordable developer outreach tools for solo founders',
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
  >,
): string {
  const lines = [
    'Best regards,',
    '',
    config.senderName,
    config.senderTitle,
  ];

  if (config.senderCompany?.trim()) {
    lines.push(config.senderCompany.trim());
  }

  if (config.senderLinkedin?.trim()) {
    lines.push(`LinkedIn: ${config.senderLinkedin.trim()}`);
  }

  if (config.senderGithub?.trim()) {
    lines.push(`GitHub: ${config.senderGithub.trim()}`);
  }

  if (config.senderWhatsapp?.trim()) {
    lines.push(`WhatsApp NO: ${config.senderWhatsapp.trim()}`);
  }

  if (config.senderEmail?.trim()) {
    lines.push(`Contact mail: ${config.senderEmail.trim()}`);
  }

  return lines.join('\n');
}

export function ensureEmailSignature(
  body: string,
  signatureBlock: string,
  senderEmail?: string,
): string {
  const trimmedBody = body.trim();
  const marker = senderEmail?.trim() || 'Best regards,';

  if (trimmedBody.includes(marker)) {
    return trimmedBody;
  }

  return `${trimmedBody}\n\n${signatureBlock}`;
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
    githubUrl: string | null;
    companyRecord: {
      summary: string | null;
      industry: string | null;
      products: string | null;
      personalizationHooks: unknown;
    } | null;
  },
  sender: SenderSignatureConfig,
): OutreachEmailContext {
  const hooks = Array.isArray(lead.companyRecord?.personalizationHooks)
    ? lead.companyRecord.personalizationHooks.filter(
        (hook): hook is string => typeof hook === 'string',
      )
    : [];

  const signatureBlock = buildSenderSignatureBlock(sender);

  return {
    leadName: lead.name,
    leadRole: lead.role,
    leadCompany: lead.company,
    leadEmail: lead.email!,
    leadLocation: lead.location ?? undefined,
    leadWebsite: lead.website ?? lead.companyWebsite ?? undefined,
    leadGithub: lead.githubUrl ?? undefined,
    companySummary: lead.companyRecord?.summary ?? undefined,
    companyIndustry: lead.companyRecord?.industry ?? undefined,
    companyProducts: lead.companyRecord?.products ?? undefined,
    personalizationHooks: hooks,
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
}
