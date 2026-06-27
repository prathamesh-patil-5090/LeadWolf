# LeadWolf Backend

NestJS API for LeadWolf. Phase 1 implements **Lead Search** (discovery) and **Lead Enrichment** (profile + company data).

## Prerequisites

- Node.js 20+
- PostgreSQL
- Redis (optional when `LEAD_SEARCH_SYNC=true`)
- Playwright Chromium (`npx playwright install chromium`)

## Setup

```bash
cd backend
cp .env.example .env
npm install
npx playwright install chromium
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

API runs at `http://localhost:3001/api`.

## Lead Discovery

Discovers public LinkedIn profiles from natural-language search criteria:

- `Senior Software Engineers India`
- `CTO AI Startups India`
- `Founders SaaS Companies`

Each lead is stored as:

```json
{
  "name": "Jane Doe",
  "role": "Senior Software Engineer",
  "company": "Acme AI",
  "profileUrl": "https://www.linkedin.com/in/janedoe"
}
```

**Default: GitHub Search API (free)** — finds technical professionals on GitHub. No API key required; optional `GITHUB_TOKEN` (free personal access token) increases rate limits.

| Provider | Cost | Best for |
|----------|------|----------|
| `github` (default) | Free | Developers, CTOs, engineers |
| `playwright` | Free | LinkedIn via scraping (often blocked by CAPTCHAs) |
| `mock` | Free | Offline dev/testing |
| `brave` / `google_cse` | Paid / legacy | Optional if you already have access |

**Google Custom Search JSON API is closed to new customers** since January 2026 ([announcement](https://programmablesearchengine.googleblog.com/2026/01/updates-to-our-web-search-products.html)).

## Lead Search API

### Start a search

`POST /api/leads/search`

```json
{
  "query": "Senior Software Engineers India",
  "role": "Senior Software Engineer",
  "location": "India",
  "limit": 25
}
```

Returns a `LeadSearchJob`. With `LEAD_SEARCH_SYNC=true`, the search runs immediately and leads are stored before the response.

**Repeat searches with the same query** continue from the last GitHub page (stored in `LeadSearchCursor`) and skip profiles already in the database. Job fields:

- `newLeadsFound` — genuinely new leads
- `skippedExisting` — GitHub results already in DB
- `leadsFound` — new leads returned this run

### Get search job status

`GET /api/leads/search/:jobId`

### List leads

`GET /api/leads?role=CTO&company=AI&status=NEW&page=1&pageSize=20`

### Get one lead

`GET /api/leads/:id`

### Manually add a lead

`POST /api/leads`

```json
{
  "name": "Jane Doe",
  "role": "CTO",
  "company": "Acme AI",
  "profileUrl": "https://linkedin.com/in/janedoe"
}
```

## Lead Enrichment

Enriches stored leads with location, website, portfolio, company domain, GitHub/LinkedIn URLs, and email when publicly available.

Pipeline: **GitHub profile → personal website → company domain guess**.

Status transitions: `NEW` → `ENRICHED` → `DOMAIN_FOUND` → `CONTACT_FOUND` (when email is found).

### Enrich batch

`POST /api/leads/enrich`

```json
{
  "status": "NEW",
  "limit": 10
}
```

Or enrich specific leads:

```json
{
  "leadIds": ["clx..."],
  "limit": 5
}
```

With `LEAD_ENRICHMENT_SYNC=true` (default), enrichment runs immediately in-process.

### Enrich one lead

`POST /api/leads/:id/enrich`

Enriched fields on `Lead`:

```json
{
  "location": "Bengaluru, India",
  "website": "https://example.dev",
  "portfolioUrl": "https://example.dev/projects",
  "companyWebsite": "https://acme.ai",
  "companySize": "GitHub org",
  "githubUrl": "https://github.com/janedoe",
  "linkedinUrl": "https://linkedin.com/in/janedoe",
  "email": "jane@example.com",
  "status": "CONTACT_FOUND"
}
```

## Company Discovery

Discovers the company website, scrapes public pages, normalizes emails into `Company.discoveredEmails`, and summarizes the company with **xAI Grok** for later email personalization.

Pipeline: **resolve domain → scrape site → normalize emails → Grok summary → store `Company` record**.

Does **not** assign the lead's contact email — that is handled by Contact Discovery.

### Discover batch

`POST /api/leads/discover-company`

```json
{
  "status": "ENRICHED",
  "limit": 10,
  "resummarize": false
}
```

Or specific leads:

```json
{
  "leadIds": ["clx..."],
  "limit": 5
}
```

### Discover one lead

`POST /api/leads/:id/discover-company`

Optional body: `{ "resummarize": true }` to regenerate the Grok summary.

### List / get companies

`GET /api/companies?page=1&pageSize=20`

`GET /api/companies/:id`

Stored `Company` fields:

```json
{
  "name": "Rhodawk AI",
  "domain": "rhodawkai.com",
  "website": "https://rhodawkai.com",
  "summary": "AI-powered ...",
  "industry": "Artificial Intelligence",
  "products": "voice agents, automation",
  "personalizationHooks": ["Mention their voice AI focus", "..."],
  "discoveredEmails": [
    { "email": "hello@rhodawkai.com", "source": "company_contact_page", "page": "..." }
  ]
}
```

Leads link to companies via `companyId`. Emails on `Company.discoveredEmails` are lowercased, trimmed, and deduplicated.

With `LEAD_COMPANY_DISCOVERY_SYNC=true` (default), discovery runs in-process.

## Contact Discovery

Finds publicly available contact emails for each lead from multiple sources:

- GitHub profile / bio
- Personal website & portfolio
- Company site emails (from `Company.discoveredEmails`)

Picks the best match (name + company domain), stores all contacts on `Lead.discoveredContacts`, and sets `email` + `emailSource`.

### Discover batch

`POST /api/leads/discover-contacts`

```json
{
  "status": "DOMAIN_FOUND",
  "limit": 10
}
```

### Discover one lead

`POST /api/leads/:id/discover-contacts`

Example `discoveredContacts`:

```json
[
  { "email": "founder@rhodawkai.com", "source": "company_homepage", "page": "https://rhodawkai.com" },
  { "email": "architect89@proton.me", "source": "github_profile", "page": "https://github.com/Architect8989" }
]
```

With `LEAD_CONTACT_DISCOVERY_SYNC=true` (default), runs in-process.

## Automated pipeline

When `LEAD_PIPELINE_AUTO=true` (default), every lead from search or manual create automatically runs:

```text
NEW → ENRICHED → DOMAIN_FOUND → CONTACT_FOUND → VERIFIED → EMAIL_GENERATED
```

(enrich → discover-company → discover-contacts → verify → generate-emails)

Grok and OpenRouter run **in parallel**; both drafts are stored in `OutreachEmail`, fastest successful one marked `isPrimary`.

You only need:

```bash
POST /api/leads/search
{ "query": "CTO AI startups India", "limit": 5 }
```

Set `LEAD_PIPELINE_AUTO=false` to disable and call each step manually.

## Contact Verification

Validates discovered emails before outreach.

Checks:

- **Format** — valid email structure
- **Disposable** — blocks known throwaway domains
- **MX records** — domain can receive mail
- **Domain match** — email domain vs company domain (confidence boost)

### Verify batch

`POST /api/leads/verify`

```json
{
  "status": "CONTACT_FOUND",
  "limit": 10
}
```

### Verify one lead

`POST /api/leads/:id/verify`

Example result:

```json
{
  "verified": true,
  "confidence": 80,
  "email": "founder@rhodawkai.com",
  "checks": {
    "format": { "passed": true, "score": 15 },
    "disposable": { "passed": true, "score": 25 },
    "mx": { "passed": true, "score": 40, "detail": "aspmx.l.google.com" },
    "domainMatch": { "passed": true, "score": 20 }
  },
  "failures": []
}
```

Leads with `verified: true` and `confidence >= 60` move to `VERIFIED` status.

With `LEAD_CONTACT_VERIFICATION_SYNC=true` (default), runs in-process.

## AI Email Personalization

Generates personalized cold emails using **Grok (xAI)** and **OpenRouter** in parallel. Both drafts are saved to `OutreachEmail`; the fastest successful response is marked `isPrimary`.

Uses `Company.summary`, `personalizationHooks`, and lead profile data.

### Generate batch

`POST /api/leads/generate-emails`

```json
{
  "status": "VERIFIED",
  "limit": 5,
  "regenerate": false
}
```

### Generate one lead

`POST /api/leads/:id/generate-email`

Optional body: `{ "regenerate": true }`

### List stored emails

`GET /api/leads/:id/emails`

Example `OutreachEmail` record:

```json
{
  "provider": "grok",
  "model": "grok-3-mini",
  "subject": "MACS and autonomous bug-fixing at Rhodawk",
  "body": "Hi Architect89,\n\n...",
  "isPrimary": true,
  "latencyMs": 3200
}
```

With `LEAD_EMAIL_PERSONALIZATION_SYNC=true` (default), runs in-process.

## Campaign Sending (Brevo)

Sends the primary `OutreachEmail` via Brevo transactional API. Lead status moves to `SENT`.

**Test mode (default on):** when `BREVO_TEST_MODE=true`, all sends go only to `BREVO_TEST_RECIPIENT` — never to the lead's real email.

### Send one lead

`POST /api/leads/:id/send`

```json
{ "force": false }
```

### Send batch

`POST /api/leads/send`

```json
{
  "status": "EMAIL_GENERATED",
  "limit": 5
}
```

To send to real lead emails in production, set `BREVO_TEST_MODE=false`.

## Analytics (Phase 4)

Tracks email engagement: delivered, opened, clicked, bounced, and replied.

### Summary metrics

`GET /api/analytics/summary`

Returns lead counts, event totals, and open/reply/bounce rates.

### Event log

`GET /api/analytics/events?leadId=...&eventType=OPENED&limit=50`

### Lead timeline

`GET /api/analytics/leads/:id/timeline`

### Brevo webhooks

Register two webhook URLs in [Brevo → Transactional → Webhooks](https://app.brevo.com/):

| URL | Type | Events |
|-----|------|--------|
| `https://your-vps/api/webhooks/brevo/transactional` | transactional | `delivered`, `opened`, `click`, `hardBounce`, `softBounce`, `spam` |
| `https://your-vps/api/webhooks/brevo/inbound` | inbound | `inboundEmailProcessed` |

Optional: set `BREVO_WEBHOOK_SECRET` and pass `Authorization: Bearer <secret>` on webhook calls.

Outbound emails include Brevo `tags` (`lead:{id}`, `outreach:{id}`) and `X-Mailin-custom` header for reliable event matching.

### Reply detection

**Gmail has no free push webhooks.** Replies to a Gmail sender land in your Gmail inbox — Brevo cannot see them unless you use one of these:

| Approach | Cost | How it works |
|----------|------|--------------|
| **Gmail API sync** (built-in) | Free | OAuth refresh token; `POST /api/analytics/sync-gmail-replies` polls inbox and matches replies from lead emails |
| **Brevo inbound parsing** | Free on Brevo | Set `BREVO_REPLY_DOMAIN=reply.yourdomain.com`, point DNS MX to Brevo, use inbound webhook above. Set `Reply-To: lead+{id}@reply.yourdomain.com` (automatic when domain is set) |
| **Gmail Pub/Sub** | GCP free tier | Advanced: `users.watch` + Cloud Pub/Sub — not implemented here |

For Gmail API sync, create OAuth credentials in Google Cloud Console (Gmail API enabled), obtain a refresh token with `gmail.readonly` scope, then set:

```env
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
```

Trigger sync manually or via cron:

`POST /api/analytics/sync-gmail-replies`

```json
{ "limit": 30 }
```

## Architecture

```text
POST /leads/search
      ↓
LeadSearchJob (PostgreSQL)
      ↓
BullMQ queue (or sync when LEAD_SEARCH_SYNC=true)
      ↓
LeadSearchProvider (PlaywrightLeadSearchProvider by default)
      ↓
Lead records stored (name, role, company, profileUrl)
```

Enrichment flow:

```text
POST /leads/enrich
      ↓
BullMQ queue (or sync when LEAD_ENRICHMENT_SYNC=true)
      ↓
GitHub → Website → Company domain enrichers
      ↓
Lead updated (location, website, companyWebsite, email, status)
```

Set `LEAD_SEARCH_PROVIDER=mock` for offline development without Playwright.

## Environment

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                      |
| `REDIS_URL`            | Upstash Redis TCP URL (`rediss://...`) for BullMQ |
| `LEAD_SEARCH_SYNC`     | `true` = run search in-process (no Redis)         |
| `LEAD_ENRICHMENT_SYNC` | `true` = run enrichment in-process (no Redis)     |
| `LEAD_COMPANY_DISCOVERY_SYNC` | `true` = run company discovery in-process |
| `LEAD_CONTACT_DISCOVERY_SYNC` | `true` = run contact discovery in-process |
| `LEAD_PIPELINE_AUTO` | `true` = auto-run full pipeline after search |
| `LEAD_CONTACT_VERIFICATION_SYNC` | `true` = run verification in-process |
| `LEAD_EMAIL_PERSONALIZATION_SYNC` | `true` = run email generation in-process |
| `XAI_API_KEY` | xAI Grok API key |
| `XAI_MODEL` | Grok model (default `grok-3-mini`) |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `OPENROUTER_MODEL` | Free model e.g. `meta-llama/llama-3.3-70b-instruct:free` |
| `OUTREACH_SENDER_NAME` | Your name in generated emails |
| `OUTREACH_SENDER_TITLE` | Your job title in the signature |
| `OUTREACH_SENDER_COMPANY` | Company name in the signature |
| `OUTREACH_SENDER_LINKEDIN` | LinkedIn URL in the signature |
| `OUTREACH_SENDER_GITHUB` | GitHub URL in the signature |
| `OUTREACH_SENDER_WHATSAPP` | WhatsApp number in the signature |
| `OUTREACH_SENDER_EMAIL` | Contact email in the signature |
| `OUTREACH_SENDER_PITCH` | One-line pitch about what you are building |
| `BREVO_API_KEY` | Brevo transactional email API key |
| `BREVO_TEST_MODE` | `true` = send only to test recipient (safe default) |
| `BREVO_TEST_RECIPIENT` | Test inbox while `BREVO_TEST_MODE=true` |
| `LEAD_CAMPAIGN_SENDING_SYNC` | `true` = send in-process |
| `BREVO_REPLY_DOMAIN` | Subdomain for Brevo inbound reply routing (e.g. `reply.yourdomain.com`) |
| `BREVO_WEBHOOK_SECRET` | Optional bearer token for webhook auth |
| `GMAIL_CLIENT_ID` | Google OAuth client ID for Gmail reply sync |
| `GMAIL_CLIENT_SECRET` | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | Gmail API refresh token (`gmail.readonly`) |
| `GMAIL_REPLY_QUERY` | Gmail search query (default `in:inbox newer_than:30d`) |
| `LEAD_SEARCH_PROVIDER` | `github` (default, free), `playwright`, `mock`, `brave`, `google_cse` |
| `GITHUB_TOKEN` | Optional free GitHub PAT for higher API rate limits |
| `BRAVE_SEARCH_API_KEY` | Optional paid Brave Search API key |
| `GOOGLE_CSE_CX`        | Google Programmable Search Engine ID              |
| `PLAYWRIGHT_HEADLESS`  | `true` to run browser headless (default)          |
| `PORT`                 | API port (default 3001)                           |
| `GROQ_RATE_LIMIT_RPM` | Groq requests/min (default `30`) |
| `GROQ_RATE_LIMIT_RPD` | Groq requests/day (default `1000`) |
| `OPENROUTER_RATE_LIMIT_RPM` | OpenRouter requests/min (default `20`) |
| `BREVO_RATE_LIMIT_RPD` | Brevo sends/day (default `300`) |
| `LEAD_PIPELINE_MAX_LEADS_PER_SEARCH` | Max new leads auto-pipelined per search (default `25`) |

Check live quota usage: `GET /api/analytics/quota`
