import { OutreachEmailContext } from '../interfaces/email-generation.interface';
import {
  CRAG_BENEFITS,
  CRAG_ELEVATOR_PITCH,
  CRAG_FEATURES_SUMMARY,
  CRAG_IDEAL_BUYERS,
  CRAG_OUTREACH_RULES,
  CRAG_POSITIONING,
  CRAG_PROBLEMS,
  CRAG_TARGET_COMPANIES,
} from './crag-product.context';

export function buildOutreachEmailPrompt(context: OutreachEmailContext): string {
  const hooks =
    context.personalizationHooks.length > 0
      ? context.personalizationHooks.map((hook) => `- ${hook}`).join('\n')
      : '- No specific hooks — infer one reasonable observation from company summary/products only';

  const problems = CRAG_PROBLEMS.map((item) => `- ${item}`).join('\n');
  const benefits = CRAG_BENEFITS.map((item) => `- ${item}`).join('\n');
  const buyers = CRAG_IDEAL_BUYERS.join(', ');

  return `Write a personalized cold outreach email from ${context.senderName} (${context.senderCompany || 'CRag'}) to sell a discovery call for CRag.

=== RECIPIENT ===
Name: ${context.leadName}
Role: ${context.leadRole}
Company: ${context.leadCompany}
Location: ${context.leadLocation ?? 'unknown'}
Website: ${context.leadWebsite ?? 'unknown'}
GitHub: ${context.leadGithub ?? 'unknown'}

=== RECIPIENT COMPANY CONTEXT ===
Industry: ${context.companyIndustry ?? 'unknown'}
Products / focus: ${context.companyProducts ?? 'unknown'}
Summary: ${context.companySummary ?? 'No company summary available.'}

Personalization hooks (use at least one if relevant):
${hooks}

=== PRODUCT: CRag ===
Positioning: ${CRAG_POSITIONING}

Elevator pitch: ${CRAG_ELEVATOR_PITCH}

${CRAG_FEATURES_SUMMARY}

Problems CRag solves:
${problems}

Outcomes for customers:
${benefits}

Ideal buyers: ${buyers}
Target companies: ${CRAG_TARGET_COMPANIES}

=== EMAIL STRUCTURE (follow this order) ===
1. Opening: greet by first name. Mention their role at ${context.leadCompany}.
2. Company-specific observation: ONE concrete detail from company context, products, industry, or hooks (e.g. what they build, their stack, or engineering scale). Do not invent facts.
3. Their likely pain: connect 1–2 problems CRag solves to what a ${context.leadRole} at a company like theirs typically faces (onboarding, doc drift, tribal knowledge, scattered repos).
4. CRag value: 2–3 sentences on what CRag does for their engineering org — living knowledge base, auto-synced docs, source-backed answers from repos and internal docs.
5. Specific benefit: one sentence on how ${context.leadCompany} could benefit given what you know about them.
6. CTA: ask for a 15-minute call or quick demo. Keep it low-pressure.

=== RULES ===
${CRAG_OUTREACH_RULES}
- Subject: specific to their company or role — 5–9 words, professional (not clickbait)
- Body length: 130–170 words BEFORE the signature (detailed but scannable — 4–6 short paragraphs)
- No bullet points in the email body
- No "I hope this email finds you well"
- Mention CRag by name once naturally

=== SIGNATURE (end body with this block exactly) ===
${context.signatureBlock}

Return JSON only:
{
  "subject": "professional specific subject line",
  "body": "full email ending with signature block, use \\n for line breaks"
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
      return extractDraftFromLooseText(jsonText);
    }

    return {
      subject: parsed.subject.trim(),
      body: parsed.body.trim().replace(/\\n/g, '\n'),
    };
  } catch {
    const extracted = extractDraftFieldsFromBrokenJson(jsonText);
    if (extracted) {
      return extracted;
    }

    return extractDraftFromLooseText(jsonText);
  }
}

function extractDraftFieldsFromBrokenJson(text: string) {
  const subject = extractJsonStringField(text, 'subject');
  const body = extractJsonStringField(text, 'body');

  if (subject && body) {
    return {
      subject,
      body: body.replace(/\\n/g, '\n'),
    };
  }

  return null;
}

function extractJsonStringField(text: string, field: string) {
  const pattern = new RegExp(
    `"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,
    'is',
  );
  const match = text.match(pattern);
  if (!match?.[1]) {
    return undefined;
  }

  return unescapeJsonString(match[1]).trim();
}

function unescapeJsonString(value: string) {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function extractDraftFromLooseText(text: string) {
  const subjectMatch =
    text.match(/^Subject:\s*(.+)$/im) ??
    text.match(/"subject"\s*:\s*"?([^"\n]+)"?/i);
  const bodyMatch = text.match(/^Body:\s*([\s\S]+)$/im);

  if (subjectMatch && bodyMatch) {
    return {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim(),
    };
  }

  const subject = extractJsonStringField(text, 'subject');
  const body = extractJsonStringField(text, 'body');
  if (subject && body) {
    return { subject, body: body.replace(/\\n/g, '\n') };
  }

  return null;
}
