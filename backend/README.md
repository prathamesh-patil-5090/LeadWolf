# LeadWolf Backend

NestJS API for **AI-powered developer outreach**. It discovers technical leads, enriches profiles, finds and verifies contact emails, generates personalized CRag-branded cold emails, sends them via Brevo, and tracks engagement (opens, clicks, replies).

There is **no frontend yet** — everything is driven through the REST API.

---

## What is implemented

| Area | Status | Description |
|------|--------|-------------|
| **Lead search** | Done | GitHub API (free), optional Bright Data LinkedIn scraping, combined parallel search |
| **Lead enrichment** | Done | GitHub profile, personal site, company domain, LinkedIn URL via Bright Data |
| **Company discovery** | Done | Resolve domain, scrape public pages, extract company emails |
| **Contact discovery** | Done | GitHub, personal site, company site — picks best email per lead |
| **Contact verification** | Done | Format, disposable domain, MX records, domain match scoring |
| **Email personalization** | Done | **Groq** + **OpenRouter** 50/50 split per lead; CRag product context + signature |
| **Campaign sending** | Done | Brevo transactional API with safe test mode |
| **Analytics** | Done | Brevo webhooks, event log, summary metrics, Gmail reply sync |
| **Automated pipeline** | Done | BullMQ queue: search → enrich → company → contacts → verify → email → send → Gmail sync |
| **Resumable failures** | Done | Failed leads store step + error; re-queue from failed step |

---

## Tech stack

- **Runtime:** Node.js 20+, NestJS 11
- **Database:** PostgreSQL + Prisma 7
- **Queue:** BullMQ + Redis (Upstash recommended)
- **Search/scrape:** GitHub API, LangSearch, Playwright, Bright Data
- **LLMs:** Groq (`llama-3.3-70b-versatile`), OpenRouter (free instruct models)
- **Email:** Brevo transactional + optional Gmail OAuth for reply detection

---

## Prerequisites

| Requirement | Required for | Notes |
|-------------|--------------|-------|
| **Node.js 20+** | Always | |
| **PostgreSQL** | Always | Neon, Supabase, or local Postgres |
| **Redis** | Async mode | Upstash free tier works; skip if all `*_SYNC=true` |
| **Playwright Chromium** | LinkedIn URL fallback | `npx playwright install chromium` |
| **GitHub token** | Recommended | Free PAT — higher rate limits for search |
| **Groq + OpenRouter keys** | Email generation | At least one required; both recommended. See [free-tier limits](#external-service-rate-limits-free-tier) |
| **Brevo API key** | Sending emails | Test mode redirects to your inbox. Free plan: 300 emails/day |
| **LangSearch key** | LinkedIn URL discovery | Free at [langsearch.com](https://langsearch.com/) — 1,000 queries/day |
| **Bright Data key** | LinkedIn profile data | Optional; 5,000 credits/month on free tier |

---

## Getting started (new developers)

### 1. Clone and install

```bash
cd backend
npm install
npx playwright install chromium
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`. At minimum you need:

```env
DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
PORT=3001
```

### 3. Database setup

```bash
npx prisma generate
npx prisma migrate deploy
```

Optional — inspect data:

```bash
npm run prisma:studio
```

### 4. Start the API

```bash
npm run start:dev
```

API base URL: **`http://localhost:3001/api`**

Health check: `GET http://localhost:3001/api/leads?page=1&pageSize=1`

---

## Configuration tiers

Choose a setup based on what you want to test.

### Tier A — Local smoke test (no external APIs)

Best for verifying the app boots and the DB works.

```env
LEAD_SEARCH_PROVIDER=mock
LEAD_SEARCH_SYNC=true
LEAD_ENRICHMENT_SYNC=true
LEAD_PIPELINE_AUTO=false
```

Run a mock search — returns fake leads instantly.

### Tier B — Real search, manual pipeline steps

Good for learning each stage without Redis.

```env
DATABASE_URL=...
GITHUB_TOKEN=ghp_...          # optional but recommended
LEAD_SEARCH_SYNC=true
LEAD_ENRICHMENT_SYNC=true
LEAD_COMPANY_DISCOVERY_SYNC=true
LEAD_CONTACT_DISCOVERY_SYNC=true
LEAD_CONTACT_VERIFICATION_SYNC=true
LEAD_EMAIL_PERSONALIZATION_SYNC=true
LEAD_CAMPAIGN_SENDING_SYNC=true
LEAD_PIPELINE_AUTO=false      # call each step yourself
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
BREVO_API_KEY=xkeysib-...
BREVO_TEST_MODE=true
BREVO_TEST_RECIPIENT=your@gmail.com
```

### Tier C — Full automation (recommended for end-to-end)

Requires Redis. Every new lead from search runs the full pipeline automatically.

```env
DATABASE_URL=...
REDIS_URL=rediss://default:...@....upstash.io:6379

LEAD_SEARCH_SYNC=false
LEAD_PIPELINE_SYNC=false
LEAD_PIPELINE_AUTO=true
LEAD_PIPELINE_AUTO_SEND=true

GITHUB_TOKEN=ghp_...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
BREVO_API_KEY=xkeysib-...
BREVO_TEST_MODE=true
BREVO_TEST_RECIPIENT=your@gmail.com

# Optional — LinkedIn + Bright Data combined search
LEAD_SEARCH_PROVIDER=github
LEAD_SEARCH_BRIGHT_DATA_PARALLEL=true
LANGSEARCH_API_KEY=...
BRIGHT_DATA_API_KEY=...
```

With `LEAD_SEARCH_BRIGHT_DATA_PARALLEL=true` and a Bright Data key, GitHub search runs **in parallel** with LinkedIn URL discovery → Bright Data profile scraping. Results are merged and deduplicated.

---

## Step-by-step: test the full flow

All examples use `curl`. Replace IDs with values from your responses.

### Step 1 — Start a lead search

```bash
curl -X POST http://localhost:3001/api/leads/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Senior Software Engineers India",
    "role": "Senior Software Engineer",
    "location": "India",
    "limit": 5
  }'
```

**Async search** (`LEAD_SEARCH_SYNC=false`): response returns a job in `PENDING` state. Poll until complete:

```bash
curl http://localhost:3001/api/leads/search/<jobId>
```

**Sync search** (`LEAD_SEARCH_SYNC=true`): leads are stored before the response returns.

### Step 2 — List discovered leads

```bash
curl "http://localhost:3001/api/leads?status=NEW&page=1&pageSize=20"
```

### Step 3 — Run pipeline steps manually (Tier B only)

Skip this if `LEAD_PIPELINE_AUTO=true` — the queue handles it.

```bash
# Enrich profiles (GitHub, website, company domain)
curl -X POST http://localhost:3001/api/leads/enrich \
  -H "Content-Type: application/json" \
  -d '{"status": "NEW", "limit": 5}'

# Scrape company websites
curl -X POST http://localhost:3001/api/leads/discover-company \
  -H "Content-Type: application/json" \
  -d '{"status": "ENRICHED", "limit": 5}'

# Find contact emails
curl -X POST http://localhost:3001/api/leads/discover-contacts \
  -H "Content-Type: application/json" \
  -d '{"status": "DOMAIN_FOUND", "limit": 5}'

# Verify email (MX, disposable, domain match)
curl -X POST http://localhost:3001/api/leads/verify \
  -H "Content-Type: application/json" \
  -d '{"status": "CONTACT_FOUND", "limit": 5}'

# Generate personalized email (Groq or OpenRouter — 50/50 per lead)
curl -X POST http://localhost:3001/api/leads/generate-emails \
  -H "Content-Type: application/json" \
  -d '{"status": "VERIFIED", "limit": 5}'

# Send via Brevo (test mode → BREVO_TEST_RECIPIENT only)
curl -X POST http://localhost:3001/api/leads/send \
  -H "Content-Type: application/json" \
  -d '{"status": "EMAIL_GENERATED", "limit": 5}'
```

### Step 4 — Inspect a single lead

```bash
curl http://localhost:3001/api/leads/<leadId>
curl http://localhost:3001/api/leads/<leadId>/emails
```

### Step 5 — Monitor the queue (Tier C)

```bash
curl http://localhost:3001/api/pipeline/queue/status
```

Re-queue a failed lead:

```bash
curl -X POST http://localhost:3001/api/pipeline/queue/enqueue/<leadId>
```

Retry all retryable failures:

```bash
curl -X POST "http://localhost:3001/api/pipeline/retry-failed?limit=25"
```

### Step 6 — Analytics

```bash
curl http://localhost:3001/api/analytics/summary
curl http://localhost:3001/api/analytics/quota
curl http://localhost:3001/api/analytics/leads/<leadId>/timeline
```

Gmail reply sync (requires OAuth — see [Gmail setup](#gmail-reply-sync)):

```bash
curl -X POST http://localhost:3001/api/analytics/sync-gmail-replies \
  -H "Content-Type: application/json" \
  -d '{"limit": 30}'
```

Or use the helper script:

```bash
npm run gmail:oauth-setup
```

---

## Architecture

LeadWolf is a **REST API with no frontend**. You call endpoints; NestJS modules orchestrate discovery, enrichment, AI email generation, sending, and analytics. PostgreSQL is the source of truth; Redis/BullMQ runs async jobs when sync mode is off.

### Architecture overview (image)

![LeadWolf backend architecture](./docs/leadwolf-architecture.png)

### 1. High-level system

```mermaid
flowchart TB
  subgraph Client
    API[REST Client / curl]
  end

  subgraph NestJS["NestJS API — localhost:3001/api"]
    LS[Lead Search]
    LE[Lead Enrichment]
    CD[Company Discovery]
    CT[Contact Discovery]
    CV[Contact Verification]
    EP[Email Personalization]
    CS[Campaign Sending]
    AN[Analytics]
    PL[Pipeline Orchestrator]
  end

  subgraph Storage
    PG[(PostgreSQL)]
    RQ[(Redis / BullMQ)]
  end

  subgraph External
    GH[GitHub API]
    LSrch[LangSearch]
    BD[Bright Data]
    PW[Playwright / DuckDuckGo]
    GQ[Groq API]
    OR[OpenRouter]
    BR[Brevo]
    GM[Gmail API]
  end

  API --> LS & LE & CD & CT & CV & EP & CS & AN & PL

  LS --> PG & RQ
  PL --> RQ
  PL --> LE --> CD --> CT --> CV --> EP --> CS
  LE & CD & CT & CV & EP & CS & AN --> PG

  LS --> GH & LSrch & BD & PW
  EP --> GQ & OR
  CS --> BR
  AN --> BR & GM
```

**In plain terms:** You hit the REST API. NestJS modules do the work. PostgreSQL stores leads, companies, emails, and events. Redis/BullMQ runs async jobs (search + full pipeline). External APIs handle discovery, AI, email, and analytics.

### 2. End-to-end pipeline (happy path)

```mermaid
flowchart LR
  S[POST /leads/search] --> Q[lead-pipeline queue]
  Q --> E[1. Enrich]
  E --> C[2. Company scrape]
  C --> CT[3. Find contacts]
  CT --> V[4. Verify email]
  V --> G[5. Generate email]
  G --> SN[6. Send via Brevo]
  SN --> GM[7. Gmail reply sync]
  GM --> OK[Lead: SENT / REPLIED]

  E -.->|error| F[FAILED_* status]
  C -.-> F
  CT -.-> F
  V -.-> F
  G -.-> F
  SN -.-> F
```

- **Concurrency:** 1 lead at a time (protects API rate limits)
- **Resume:** re-enqueue a failed lead — continues from `pipelineFailedStep`
- **Auto-retry:** retryable errors (429, timeouts) re-queued every 60s when idle
- **Sync fallback:** set all `*_SYNC=true` and omit `REDIS_URL` to run everything in-process

### 3. NestJS module layout

```text
AppModule
├── PrismaModule                    → PostgreSQL
├── RateLimitModule                 → Groq / OpenRouter / Brevo quotas
├── BrightDataModule                → LinkedIn profile scraping
├── LeadPipelineModule              → BullMQ orchestrator + auto-retry
├── LeadSearchModule                → Discovery + search job queue
├── LeadEnrichmentModule            → GitHub / website / company domain
├── LeadCompanyDiscoveryModule      → Domain resolve + site scrape
├── LeadContactDiscoveryModule      → Email from GitHub, site, company
├── LeadContactVerificationModule   → Format, MX, disposable, domain match
├── LeadEmailPersonalizationModule  → Groq + OpenRouter (50/50 per lead)
├── LeadCampaignSendingModule       → Brevo transactional send
└── LeadAnalyticsModule             → Webhooks, metrics, Gmail sync
```

### 4. Lead status lifecycle

```mermaid
stateDiagram-v2
  [*] --> NEW: search / manual create

  NEW --> ENRICHED: enrichment
  ENRICHED --> DOMAIN_FOUND: company discovery
  DOMAIN_FOUND --> CONTACT_FOUND: contact discovery
  CONTACT_FOUND --> VERIFIED: verification passed
  VERIFIED --> EMAIL_GENERATED: AI email
  EMAIL_GENERATED --> SENT: Brevo send
  SENT --> OPENED: Brevo webhook
  OPENED --> REPLIED: Gmail / inbound webhook
  SENT --> BOUNCED: bounce webhook

  NEW --> FAILED_ENRICHMENT
  ENRICHED --> FAILED_COMPANY_DISCOVERY
  DOMAIN_FOUND --> FAILED_CONTACT_DISCOVERY
  CONTACT_FOUND --> FAILED_VERIFICATION
  VERIFIED --> FAILED_EMAIL_GENERATION
  EMAIL_GENERATED --> FAILED_CAMPAIGN_SENDING
```

Failed leads store `pipelineFailedStep`, `pipelineError`, and `pipelineFailedAt`. Re-enqueue resumes from the failed step.

### 5. Lead search architecture

```mermaid
flowchart TB
  REQ[POST /api/leads/search] --> JOB[LeadSearchJob]
  JOB --> PROV{Provider}

  PROV -->|mock| MOCK[Mock — offline dev]
  PROV -->|github| GH[GithubLeadSearchProvider]
  PROV -->|parallel + BD key| COMB[CombinedLeadSearchProvider]

  COMB --> GH2[GitHub search]
  COMB --> URL[LinkedIn URL discovery]

  URL --> LANG[LangSearch API]
  URL -->|fallback| PW[Playwright + DuckDuckGo]

  URL --> BD[Bright Data collect-by-url]
  GH2 --> MERGE[Merge + dedupe]
  BD --> MERGE
  MERGE --> DB[(Lead records)]

  GH --> DB
  MOCK --> DB
```

**Default behavior:** `LEAD_SEARCH_PROVIDER=github`. When `BRIGHT_DATA_API_KEY` is set and `LEAD_SEARCH_BRIGHT_DATA_PARALLEL=true`, the factory automatically uses `CombinedLeadSearchProvider`.

Repeat searches with the same query continue from the last GitHub page (`LeadSearchCursor`) and skip profiles already in the database.

### 6. Data model (simplified)

```mermaid
erDiagram
  LeadSearchJob ||--o{ Lead : discovers
  Lead ||--o| Company : belongs_to
  Lead ||--o{ OutreachEmail : has
  Lead ||--o{ EmailEvent : tracks
  Company ||--o{ Lead : employs

  Lead {
    string status
    string email
    string profileUrl
    string pipelineFailedStep
  }
  Company {
    string domain
    string scrapedContent
    json discoveredEmails
  }
  OutreachEmail {
    string provider
    string subject
    boolean isPrimary
  }
```

### 7. Email generation split

Each lead is assigned **Groq** or **OpenRouter** deterministically (50/50 hash of `leadId`). One provider generates the primary email per lead. Prompts include CRag product context; the sender signature is refreshed at send time.

```mermaid
flowchart LR
  L[Lead ID] --> H[Hash leadId]
  H -->|even| GQ[Groq — llama-3.3-70b]
  H -->|odd| OR[OpenRouter — free instruct model]
  GQ --> EM[OutreachEmail stored]
  OR --> EM
  EM --> SIG[CRag signature refreshed at send]
  SIG --> BR[Brevo]
```

At least one of `GROQ_API_KEY` or `OPENROUTER_API_KEY` must be set for email generation to succeed.

---

## Lead discovery providers

| Provider | Env | Cost | Best for |
|----------|-----|------|----------|
| `github` (default) | `GITHUB_TOKEN` optional | Free | Developers, engineers, CTOs on GitHub |
| Combined (auto) | `BRIGHT_DATA_API_KEY` + parallel flag | Paid BD + free GitHub | GitHub + LinkedIn profiles |
| `bright_data` | `BRIGHT_DATA_API_KEY` | Paid | LinkedIn profiles by URL only |
| `playwright` | — | Free | LinkedIn via scraping (CAPTCHA-prone) |
| `mock` | — | Free | Offline dev / CI |
| `google_cse` | `GOOGLE_CSE_*` | Legacy | Closed to new Google Cloud customers since Jan 2026 |

**LinkedIn URL discovery order:** LangSearch → Playwright (DuckDuckGo). Bright Data scrapes discovered URLs (collect-by-url; keyword discovery is not available on most accounts).

---

## API reference

### Search & leads

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/leads/search` | Start a search job |
| `GET` | `/api/leads/search/:jobId` | Poll search job status |
| `GET` | `/api/leads` | List leads (filter by status, role, company) |
| `GET` | `/api/leads/:id` | Get one lead |
| `POST` | `/api/leads` | Manually add a lead |

### Pipeline steps

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/leads/enrich` | Batch enrich |
| `POST` | `/api/leads/:id/enrich` | Enrich one lead |
| `POST` | `/api/leads/discover-company` | Batch company discovery |
| `POST` | `/api/leads/:id/discover-company` | Company discovery for one lead |
| `POST` | `/api/leads/discover-contacts` | Batch contact discovery |
| `POST` | `/api/leads/:id/discover-contacts` | Contact discovery for one lead |
| `POST` | `/api/leads/verify` | Batch verify emails |
| `POST` | `/api/leads/:id/verify` | Verify one lead |
| `POST` | `/api/leads/generate-emails` | Batch generate emails |
| `POST` | `/api/leads/:id/generate-email` | Generate for one lead (`{"regenerate": true}`) |
| `GET` | `/api/leads/:id/emails` | List stored outreach emails |
| `POST` | `/api/leads/send` | Batch send |
| `POST` | `/api/leads/:id/send` | Send one lead (`{"force": true}`) |

### Pipeline queue

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/pipeline/queue/status` | Queue depth and idle state |
| `POST` | `/api/pipeline/queue/enqueue/:leadId` | Enqueue / resume a lead |
| `POST` | `/api/pipeline/retry-failed?limit=25` | Re-queue failed leads |

### Companies & analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/companies` | List companies |
| `GET` | `/api/companies/:id` | Get company + scraped data |
| `GET` | `/api/analytics/summary` | Lead counts, open/reply/bounce rates |
| `GET` | `/api/analytics/events` | Event log |
| `GET` | `/api/analytics/leads/:id/timeline` | Per-lead engagement timeline |
| `GET` | `/api/analytics/quota` | Live rate-limit usage |
| `POST` | `/api/analytics/sync-gmail-replies` | Poll Gmail for replies |
| `POST` | `/api/webhooks/brevo/transactional` | Brevo delivery/open/click webhooks |
| `POST` | `/api/webhooks/brevo/inbound` | Brevo inbound reply webhook |

---

## Email generation

See [§7. Email generation split](#7-email-generation-split) for the diagram.

Each lead is assigned **Groq** or **OpenRouter** deterministically (50/50 hash of `leadId`). One provider generates the primary email per lead.

- **Groq:** `GROQ_API_KEY` + `GROQ_MODEL` (default `llama-3.3-70b-versatile`)
- **OpenRouter:** `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` (free instruct models)

Prompts include CRag product context. The sender signature (name, title, dual emails, WhatsApp, LinkedIn, GitHub) is refreshed at send time.

At least one of `GROQ_API_KEY` or `OPENROUTER_API_KEY` must be set for email generation to succeed.

---

## Campaign sending (Brevo)

**Test mode is on by default.** When `BREVO_TEST_MODE=true`, all sends go to `BREVO_TEST_RECIPIENT` — never to the lead's real email.

Set `BREVO_TEST_MODE=false` only in production when you are ready to email real leads.

---

## Gmail reply sync

Gmail has no free push webhooks. This app polls your inbox via the Gmail API.

1. Enable Gmail API in Google Cloud Console
2. Create OAuth credentials
3. Run `npm run gmail:oauth-setup` to obtain a refresh token
4. Set in `.env`:

```env
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_REPLY_QUERY=in:inbox newer_than:30d
```

Alternative: configure **Brevo inbound parsing** with `BREVO_REPLY_DOMAIN` and the inbound webhook.

---

## Brevo webhooks

Register in [Brevo → Transactional → Webhooks](https://app.brevo.com/):

| URL | Events |
|-----|--------|
| `https://your-host/api/webhooks/brevo/transactional` | `delivered`, `opened`, `click`, `hardBounce`, `softBounce`, `spam` |
| `https://your-host/api/webhooks/brevo/inbound` | `inboundEmailProcessed` |

Optional: set `BREVO_WEBHOOK_SECRET` and send `Authorization: Bearer <secret>` on webhook calls.

---

## External service rate limits (free tier)

LeadWolf also enforces **client-side** rate limits (see [App-side rate limit tuning](#app-side-rate-limit-tuning)) so the pipeline does not burn through provider quotas. The table below lists **provider-documented free-tier limits** as of mid-2026. Check each vendor’s docs before production — limits change and may vary by account.

### Summary table

| Service | Used for | Free tier limits | LeadWolf default cap | Docs |
|---------|----------|------------------|----------------------|------|
| **GitHub API** | Lead search, enrichment | **Search:** 30 req/min (auth), 10 req/min (no token). **Core API:** 5,000 req/hr (auth), 60 req/hr (no token) | — | [Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) |
| **LangSearch** | LinkedIn URL discovery | **1 QPS**, **60 req/min**, **1,000 req/day** | — | [API limits](https://docs.langsearch.com/limits/api-limits) |
| **Bright Data** | LinkedIn profile scrape | **5,000 credits/month** (~5K Web Scraper records; renews 1st of month, no rollover). LinkedIn dataset is collect-by-url | — | [Free tier](https://docs.brightdata.com/general/account/billing-and-pricing/free-tier) |
| **Groq** | Email generation (~50% of leads) | **`llama-3.3-70b-versatile`:** 30 RPM, **1,000 RPD**, 12,000 TPM | 30 RPM, 1,000 RPD | [Rate limits](https://console.groq.com/docs/rate-limits) |
| **OpenRouter** | Email generation (~50% of leads) | **20 RPM**. **50 RPD** if &lt; $10 lifetime credits; **1,000 RPD** after $10+ credits (one-time purchase, never expires) | 20 RPM | [Rate limits](https://openrouter.ai/docs/api/reference/limits) |
| **Brevo** | Transactional send | **300 emails/day** (marketing + transactional combined; resets daily, no rollover) | 300 RPD | [Free plan limits](https://help.brevo.com/hc/en-us/articles/208580669) |
| **Upstash Redis** | BullMQ job queues | **500,000 commands/month**, 256 MB storage, 10 GB bandwidth | — | [Redis pricing](https://upstash.com/pricing/redis) |
| **Gmail API** | Reply sync (optional) | **80M quota units/day** per GCP project; `messages.list` = 5 units, `messages.get` = 20 units. Free Gmail send cap: **500 emails/day** (separate from API) | — | [Gmail quotas](https://developers.google.com/workspace/gmail/api/reference/quota) |
| **Playwright / DuckDuckGo** | LinkedIn URL fallback | No API key; **no fixed quota** — often blocked by CAPTCHAs under automation | — | — |
| **PostgreSQL** | All persistent data | Depends on host (Neon, Supabase, local, etc.) — not enforced by LeadWolf | — | — |

### Per-service details

#### GitHub

Lead search uses the **Search API**, which has its own limit separate from the core REST budget:

| Auth | Search API | Core REST API |
|------|------------|---------------|
| With `GITHUB_TOKEN` | 30 requests/minute | 5,000 requests/hour |
| Without token | 10 requests/minute | 60 requests/hour |

Set `GITHUB_TOKEN` in `.env` — a free personal access token (no scopes required for public data) is enough for normal dev use.

#### LangSearch

Free tier ($0 recharge): **1 query/second**, **60/minute**, **1,000/day**. Combined search may fire multiple query variants per job; heavy parallel searches can hit 429 quickly. The app falls back to Playwright when LangSearch rate-limits.

Paid tiers (cumulative recharge): $10 → 5 QPS / 200 QPM / 2K QPD; $100 → 10 QPS / 500 QPM / 10K QPD.

#### Bright Data

New accounts get **5,000 recurring monthly credits** for Web Scraper / SERP / Unlocker (1 credit ≈ 1 record). That is roughly **~167 LinkedIn profiles/day** if used only for scraping. Credits reset on the 1st of each month and do not roll over. Proxy-only products use separate trial credits.

#### Groq

Default model in LeadWolf: `llama-3.3-70b-versatile`. Official free-tier limits for that model:

| Limit | Value |
|-------|-------|
| Requests per minute (RPM) | 30 |
| Requests per day (RPD) | 1,000 |
| Tokens per minute (TPM) | 12,000 |

Limits apply at the **organization** level (extra API keys do not multiply quota). Smaller models like `llama-3.1-8b-instant` allow up to 14,400 RPD if you switch `GROQ_MODEL`.

#### OpenRouter

Only **`:free` model variants** count toward free-tier caps. Failed requests still consume daily quota.

| Account | Free-model RPM | Free-model RPD |
|---------|----------------|----------------|
| No credits purchased | 20 | 50 |
| $10+ lifetime credits purchased | 20 | 1,000 |

Adding $10 in credits once permanently raises the daily cap; balance can drop to zero afterward.

#### Brevo

Free plan: **300 sends per day** total across campaigns and transactional API. Unused sends do not roll over. Transactional webhooks and API access are included on free.

#### Upstash Redis

Free tier: **500,000 Redis commands per month** (not per day). BullMQ uses several commands per job (enqueue, poll, complete). A busy pipeline with many leads can approach this on free Upstash — monitor usage in the Upstash console.

#### Gmail API (reply sync)

Reply polling uses `gmail.readonly`. For typical sync batches (`POST /api/analytics/sync-gmail-replies` with `limit: 30`), quota usage is negligible vs the 80M units/day project cap. The **500 emails/day** Gmail *send* limit applies only if you send mail through Gmail API (LeadWolf sends via Brevo instead).

### Practical free-tier bottlenecks

Rough maximum **fully automated** leads per day when using only free tiers (assuming contact email found and pipeline auto-send on):

| Bottleneck | Approx. max leads/day | Notes |
|------------|----------------------|-------|
| OpenRouter (no credits) | **~50** | 50 free-model requests/day ÷ ~0.5 (half of leads) |
| OpenRouter ($10+ credits) | **~1,000** | Matches Groq daily cap for the other half |
| Groq (`llama-3.3-70b`) | **~1,000** | ~500 leads if each lead gets one Groq email (50% split) |
| Brevo send | **300** | Hard daily cap on free plan |
| LangSearch discovery | **1,000 queries** | Multiple queries per search job; not 1,000 leads |
| Bright Data profiles | **~167/month** | 5,000 credits/month ÷ 30 days |

**Typical binding limit on a zero-cost stack:** OpenRouter **50 emails/day** (without the $10 credit bump) or Brevo **300 sends/day** once you enable auto-send.

Monitor in-app usage: `GET /api/analytics/quota` (Groq, OpenRouter, Brevo client-side counters).

---

## Environment variables

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Upstash Redis TCP URL for BullMQ |

### Sync vs async

When `*_SYNC=true`, that step runs in-process (no Redis queue for that module). When `false` and `REDIS_URL` is set, BullMQ handles it.

| Variable | Default | Description |
|----------|---------|-------------|
| `LEAD_SEARCH_SYNC` | `true` in `.env.example` | `false` = async search jobs |
| `LEAD_ENRICHMENT_SYNC` | `true` | |
| `LEAD_COMPANY_DISCOVERY_SYNC` | `true` | |
| `LEAD_CONTACT_DISCOVERY_SYNC` | `true` | |
| `LEAD_CONTACT_VERIFICATION_SYNC` | `true` | |
| `LEAD_EMAIL_PERSONALIZATION_SYNC` | `true` | |
| `LEAD_CAMPAIGN_SENDING_SYNC` | `true` | |
| `LEAD_PIPELINE_SYNC` | `false` when Redis set | `false` = pipeline via BullMQ |

### Pipeline automation

| Variable | Default | Description |
|----------|---------|-------------|
| `LEAD_PIPELINE_AUTO` | `true` | Auto-run pipeline for new leads |
| `LEAD_PIPELINE_AUTO_SEND` | `true` | Include Brevo send in pipeline |
| `LEAD_PIPELINE_AUTO_GMAIL_SYNC` | `true` | Gmail reply check after send |
| `LEAD_PIPELINE_AUTO_RETRY` | `true` | Re-queue retryable failures |
| `LEAD_PIPELINE_RETRY_INTERVAL_MS` | `60000` | Idle retry poll interval |
| `LEAD_PIPELINE_RETRY_BATCH` | `10` | Max leads per retry sweep |

### Lead search

| Variable | Default | Description |
|----------|---------|-------------|
| `LEAD_SEARCH_PROVIDER` | `github` | `github`, `combined`, `bright_data`, `mock`, `playwright`, `google_cse` |
| `LEAD_SEARCH_BRIGHT_DATA_PARALLEL` | `true` | GitHub + Bright Data in parallel when BD key is set |
| `GITHUB_TOKEN` | — | Optional GitHub PAT for higher rate limits |
| `LANGSEARCH_API_KEY` | — | Free web search for LinkedIn URL discovery |
| `BRIGHT_DATA_API_KEY` | — | Bright Data LinkedIn profile scraping |
| `BRIGHT_DATA_LINKEDIN_PROFILE_DATASET_ID` | `gd_l1viktl72bvl7bjuj0` | Profile dataset |
| `PLAYWRIGHT_HEADLESS` | `true` | Headless browser for Playwright fallback |

### LLM (email generation)

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | Groq API key (`gsk_...`) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Groq model |
| `OPENROUTER_API_KEY` | — | OpenRouter API key |
| `OPENROUTER_MODEL` | — | e.g. `nvidia/nemotron-3-nano-30b-a3b:free` |
| `OPENROUTER_FALLBACK_MODELS` | — | Comma-separated fallback models |

### Outreach signature

| Variable | Description |
|----------|-------------|
| `OUTREACH_SENDER_NAME` | Your name |
| `OUTREACH_SENDER_TITLE` | Job title |
| `OUTREACH_SENDER_COMPANY` | Company (CRag) |
| `OUTREACH_SENDER_EMAIL` | Primary contact email |
| `OUTREACH_SENDER_ALT_EMAIL` | Secondary email |
| `OUTREACH_SENDER_WHATSAPP` | WhatsApp number |
| `OUTREACH_SENDER_LINKEDIN` | LinkedIn URL |
| `OUTREACH_SENDER_GITHUB` | GitHub URL |
| `OUTREACH_SENDER_PITCH` | One-line product pitch |

### Brevo & Gmail

| Variable | Default | Description |
|----------|---------|-------------|
| `BREVO_API_KEY` | — | Brevo transactional API key |
| `BREVO_TEST_MODE` | `true` | Safe mode — sends only to test recipient |
| `BREVO_TEST_RECIPIENT` | — | Your inbox while test mode is on |
| `BREVO_REPLY_DOMAIN` | — | Subdomain for inbound reply routing |
| `BREVO_WEBHOOK_SECRET` | — | Optional webhook auth token |
| `GMAIL_CLIENT_ID` | — | Google OAuth client ID |
| `GMAIL_CLIENT_SECRET` | — | Google OAuth client secret |
| `GMAIL_REFRESH_TOKEN` | — | Gmail API refresh token |

### App-side rate limit tuning

LeadWolf throttles outbound calls to Groq, OpenRouter, and Brevo **before** hitting provider walls. Tune these to stay at or below the [free-tier limits](#external-service-rate-limits-free-tier) above:

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_RATE_LIMIT_RPM` | `30` | Groq requests per minute (matches Groq free tier) |
| `GROQ_RATE_LIMIT_RPD` | `1000` | Groq requests per day (`llama-3.3-70b-versatile` free cap) |
| `OPENROUTER_RATE_LIMIT_RPM` | `20` | OpenRouter requests per minute |
| `OPENROUTER_RATE_LIMIT_RPD` | — | Optional daily cap (unset = no client-side daily limit) |
| `BREVO_RATE_LIMIT_RPM` | `60` | Brevo requests per minute |
| `BREVO_RATE_LIMIT_RPD` | `300` | Brevo sends per day (matches free plan) |

---

## Known limitations

- **No frontend** — API only for now
- **Free-tier quotas** — see [External service rate limits](#external-service-rate-limits-free-tier); OpenRouter (50/day without credits) and Brevo (300/day) are usually the first caps hit
- **LangSearch free tier** — 1,000 queries/day; combined search can exhaust this quickly; Playwright fallback is CAPTCHA-prone
- **Bright Data** — 5,000 credits/month on free; most accounts support collect-by-url only, not keyword discovery
- **Contact discovery** — many leads fail if no public email exists (`FAILED_CONTACT_DISCOVERY`)
- **OpenRouter free models** — occasional bad JSON; Groq handles the other 50% of leads
- **Production deploy** — no API auth middleware yet; protect with reverse proxy / firewall on VPS

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run start:prod` | Run compiled app |
| `npm test` | Unit tests |
| `npm run prisma:migrate` | Create / apply migrations (dev) |
| `npm run prisma:studio` | Database GUI |
| `npm run gmail:oauth-setup` | Obtain Gmail refresh token |
