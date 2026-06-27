import { OutreachEmailContext } from '../interfaces/email-generation.interface';

export function buildOutreachEmailPrompt(context: OutreachEmailContext): string {
  const hooks =
    context.personalizationHooks.length > 0
      ? context.personalizationHooks.map((hook) => `- ${hook}`).join('\n')
      : '- No specific hooks available — use company summary only';

  return `Write a personalized cold outreach email to a technical professional.

Recipient:
- Name: ${context.leadName}
- Role: ${context.leadRole}
- Company: ${context.leadCompany}
- Location: ${context.leadLocation ?? 'unknown'}
- Website: ${context.leadWebsite ?? 'unknown'}
- GitHub: ${context.leadGithub ?? 'unknown'}

Company context:
- Industry: ${context.companyIndustry ?? 'unknown'}
- Products: ${context.companyProducts ?? 'unknown'}
- Summary: ${context.companySummary ?? 'No company summary available.'}

Personalization hooks:
${hooks}

Sender pitch (one line about why you are reaching out):
${context.senderPitch}

Tone and language (very important):
- Write like a real person sending a quick email, not a marketing brochure
- Use simple, everyday English — short sentences, plain words
- Avoid heavy or formal words (e.g. leverage, utilize, synergy, innovative, cutting-edge, delighted, esteemed, furthermore, consequently)
- Subject line: short, casual, specific — 4–8 simple words max
- Body: warm and direct, under 120 words before the signature
- No "I hope this finds you well", no corporate fluff, no bullet points

Content rules:
- Mention their role and company naturally
- Reference one real observation from the company context or hooks
- Do not invent facts not supported by the context

Signature — end the body with this block exactly (copy verbatim, including line breaks):
${context.signatureBlock}

Return JSON only (no markdown fences):
{
  "subject": "simple casual subject line",
  "body": "email body ending with the signature block above, use \\n for line breaks"
}`;
}

export function parseEmailDraftResponse(content: string): {
  subject: string;
  body: string;
} | null {
  const jsonText = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonText) as {
      subject?: string;
      body?: string;
    };

    if (!parsed.subject?.trim() || !parsed.body?.trim()) {
      return null;
    }

    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim().replace(/\\n/g, '\n'),
    };
  } catch {
    const subjectMatch = jsonText.match(/^Subject:\s*(.+)$/im);
    const body = jsonText.replace(/^Subject:.*$/im, '').trim();

    if (subjectMatch && body) {
      return {
        subject: subjectMatch[1].trim(),
        body,
      };
    }

    return null;
  }
}
