# LeadWolf Backend

NestJS API for LeadWolf. Phase 1 implements **Lead Search** — discover and store technical professionals based on search criteria.

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

Set `LEAD_SEARCH_PROVIDER=mock` for offline development without Playwright.

## Environment

| Variable               | Description                                       |
| ---------------------- | ------------------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string                      |
| `REDIS_URL`            | Upstash Redis TCP URL (`rediss://...`) for BullMQ |
| `LEAD_SEARCH_SYNC`     | `true` = run search in-process (no Redis)         |
| `LEAD_SEARCH_PROVIDER` | `github` (default, free), `playwright`, `mock`, `brave`, `google_cse` |
| `GITHUB_TOKEN` | Optional free GitHub PAT for higher API rate limits |
| `BRAVE_SEARCH_API_KEY` | Optional paid Brave Search API key |
| `GOOGLE_CSE_CX`        | Google Programmable Search Engine ID              |
| `PLAYWRIGHT_HEADLESS`  | `true` to run browser headless (default)          |
| `PORT`                 | API port (default 3001)                           |
