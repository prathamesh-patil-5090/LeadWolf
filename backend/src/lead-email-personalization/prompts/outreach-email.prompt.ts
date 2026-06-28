import { OutreachEmailContext } from '../interfaces/email-generation.interface';
import {
  isUnknownLeadField,
  shouldPersonalizeViaProfile,
} from '../utils/profile-context.util';
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
  const profileFirst = shouldPersonalizeViaProfile(context);
  const hooks =
    context.personalizationHooks.length > 0
      ? context.personalizationHooks.map((hook) => `- ${hook}`).join('\n')
      : profileFirst
        ? '- Use their GitHub or LinkedIn presence as the main personalization anchor'
        : '- No specific hooks — infer one reasonable observation from company summary/products only';

  const problems = CRAG_PROBLEMS.map((item) => `- ${item}`).join('\n');
  const benefits = CRAG_BENEFITS.map((item) => `- ${item}`).join('\n');
  const buyers = CRAG_IDEAL_BUYERS.join(', ');

  const roleLine = isUnknownLeadField(context.leadRole)
    ? 'Role: not available — do NOT mention a job title'
    : `Role: ${context.leadRole}`;

  const companyLine = isUnknownLeadField(context.leadCompany)
    ? 'Company: not available — do NOT mention an employer or say "your company"'
    : `Company: ${context.leadCompany}`;

  const emailStructure = profileFirst
    ? buildProfileFirstStructure(context)
    : buildCompanyFirstStructure(context);

  const subjectRule = profileFirst
    ? '- Subject: reference their engineering work or developer profile — 5–9 words, professional (no company name, no "Unknown")'
    : '- Subject: specific to their company or role — 5–9 words, professional (not clickbait)';

  const profileRules = profileFirst
    ? `
=== PROFILE-FIRST RULES (role and/or company unknown) ===
- Open with their first name only — never say "Unknown" or guess a title/employer
- Personalize using their GitHub and/or LinkedIn (see hooks below) — e.g. "I came across your GitHub…" or "your work on GitHub…"
- Do NOT invent repo names, employers, team size, or job titles
- Do NOT write "as a [role] at [company]" — that information is missing
- After the profile observation, bridge naturally to engineering knowledge/onboarding pains, then introduce CRag
`
    : '';

  return `Write a personalized cold outreach email from ${context.senderName} (${context.senderCompany || 'CRag'}) to sell a discovery call for CRag.

=== RECIPIENT ===
Name: ${context.leadName}
${roleLine}
${companyLine}
Location: ${context.leadLocation ?? 'unknown'}
Website: ${context.leadWebsite ?? 'unknown'}
GitHub: ${context.leadGithub ?? 'unknown'}
LinkedIn: ${context.leadLinkedin ?? 'unknown'}
Profile URL: ${context.leadProfileUrl ?? 'unknown'}

=== RECIPIENT COMPANY CONTEXT ===
Industry: ${context.companyIndustry ?? 'unknown'}
Products / focus: ${context.companyProducts ?? 'unknown'}
Summary: ${context.companySummary ?? 'No company summary available.'}

Personalization hooks (use at least one if relevant):
${hooks}
${profileRules}
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

${emailStructure}

=== RULES ===
${CRAG_OUTREACH_RULES}
${subjectRule}
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

function buildProfileFirstStructure(context: OutreachEmailContext) {
  const platforms = [
    context.leadGithub ? 'GitHub' : null,
    context.leadLinkedin ? 'LinkedIn' : null,
  ]
    .filter(Boolean)
    .join(' and ');

  return `=== EMAIL STRUCTURE (profile-first — use ${platforms || 'their public profile'}) ===
1. Opening: greet by first name only.
2. Profile observation: ONE warm, specific line about their public engineering presence on ${platforms || 'GitHub or LinkedIn'} — e.g. open source work, developer activity, or building in public. Do not invent projects or employers.
3. Bridge: connect engineers who share work publicly to pains CRag solves — documentation drift, onboarding friction, knowledge scattered across repos and wikis.
4. CRag value: 2–3 sentences — living engineering knowledge base, auto-synced docs, source-backed answers from repos and internal docs.
5. CTA: ask for a 15-minute call or quick demo. Keep it low-pressure.`;
}

function buildCompanyFirstStructure(context: OutreachEmailContext) {
  const openingCompany = isUnknownLeadField(context.leadCompany)
    ? 'their organization'
    : context.leadCompany;

  const openingRole = isUnknownLeadField(context.leadRole)
    ? 'your work in engineering'
    : `your role as ${context.leadRole}`;

  return `=== EMAIL STRUCTURE (follow this order) ===
1. Opening: greet by first name. Reference ${openingRole}${isUnknownLeadField(context.leadCompany) ? '' : ` at ${openingCompany}`}.
2. Company-specific observation: ONE concrete detail from company context, products, industry, or hooks (e.g. what they build, their stack, or engineering scale). Do not invent facts.
3. Their likely pain: connect 1–2 problems CRag solves to what they typically face (onboarding, doc drift, tribal knowledge, scattered repos).
4. CRag value: 2–3 sentences on what CRag does for their engineering org — living knowledge base, auto-synced docs, source-backed answers from repos and internal docs.
5. Specific benefit: one sentence on how ${openingCompany} could benefit given what you know about them.
6. CTA: ask for a 15-minute call or quick demo. Keep it low-pressure.`;
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
