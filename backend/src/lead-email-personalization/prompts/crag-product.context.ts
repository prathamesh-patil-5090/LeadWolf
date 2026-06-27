export const CRAG_ELEVATOR_PITCH =
  'CRag automatically understands GitHub, GitLab, and Bitbucket repositories, internal documentation, APIs, and engineering workflows to generate continuously updated developer documentation and provide a source-backed AI assistant for your entire engineering organization.';

export const CRAG_POSITIONING =
  'AI-Powered Engineering Knowledge Platform — not a chatbot, not a generic doc tool.';

export const CRAG_PROBLEMS = [
  'Outdated documentation and documentation drift',
  'Knowledge trapped with senior developers',
  'Long developer onboarding times',
  'Information scattered across repos and wikis',
  'Repetitive technical questions interrupting senior engineers',
  'Lost knowledge when engineers leave',
];

export const CRAG_BENEFITS = [
  'Reduce developer onboarding time',
  'Eliminate documentation drift',
  'Make engineering knowledge instantly searchable',
  'Automatically generate and keep developer docs in sync with code',
  'Reduce dependency on tribal knowledge',
  'Help developers find answers with source-backed references (no hallucinations)',
];

export const CRAG_FEATURES_SUMMARY = `Core capabilities:
- Repository intelligence (GitHub, GitLab, Bitbucket): indexes code, READMEs, wikis, architecture
- AI developer documentation: project overview, install guides, API docs, onboarding guides — auto-synced with repos
- AI knowledge search: developers ask natural questions, answers cite source files
- API discovery: REST/GraphQL endpoints, controllers, models — searchable API docs
- Organizational knowledge: docs, PDFs, markdown, SOPs in one engineering knowledge base`;

export const CRAG_OUTREACH_RULES = `Messaging rules:
- Lead with business outcomes for engineering teams — never lead with RAG, LLM, embeddings, vector search, or "AI chatbot"
- Use positioning: "AI Engineering Knowledge Platform" or "Developer Intelligence Platform"
- Professional, conversational tone — not salesy or hypey
- Never exaggerate or invent facts about the recipient's company
- Do not use: leverage, synergy, cutting-edge, delighted, esteemed, game-changer
- Goal: secure a 15-minute discovery call or product demo — NOT to sell in the first email
- Single clear CTA at the end asking for a 15-minute call or demo`;

export const CRAG_IDEAL_BUYERS = [
  'CTO',
  'VP Engineering',
  'Engineering Manager',
  'Technical Lead',
  'Engineering Director',
  'Head of Engineering',
  'Founder (technical startups)',
];

export const CRAG_TARGET_COMPANIES =
  'Software companies, SaaS, product startups, IT consulting firms, enterprise engineering teams (typically 10–1000 engineers).';

export const EMAIL_GENERATION_SYSTEM_PROMPT = `You write personalized B2B outreach emails for CRag, an AI-Powered Engineering Knowledge Platform.

Write like a thoughtful founder reaching out to an engineering leader — professional, specific, human. Not a marketing blast.

Return ONLY valid JSON: {"subject":"...","body":"..."}
The body must end with the exact signature block provided in the user message.
No markdown fences. No extra keys.`;
