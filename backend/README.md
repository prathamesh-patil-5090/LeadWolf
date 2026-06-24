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
NEW → ENRICHED → DOMAIN_FOUND → CONTACT_FOUND
```

(enrich → discover-company → discover-contacts)

You only need:

```bash
POST /api/leads/search
{ "query": "CTO AI startups India", "limit": 5 }
```

Set `LEAD_PIPELINE_AUTO=false` to disable and call each step manually.

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
| `LEAD_PIPELINE_AUTO` | `true` = auto-run enrich → company → contacts after search |
| `XAI_API_KEY` | xAI API key for Grok company summaries |
| `XAI_MODEL` | Grok model (default `grok-3-mini`) |
| `LEAD_SEARCH_PROVIDER` | `github` (default, free), `playwright`, `mock`, `brave`, `google_cse` |
| `GITHUB_TOKEN` | Optional free GitHub PAT for higher API rate limits |
| `BRAVE_SEARCH_API_KEY` | Optional paid Brave Search API key |
| `GOOGLE_CSE_CX`        | Google Programmable Search Engine ID              |
| `PLAYWRIGHT_HEADLESS`  | `true` to run browser headless (default)          |
| `PORT`                 | API port (default 3001)                           |
