# LeadWolf Backend

NestJS API for LeadWolf. Phase 1 implements **Lead Search** — discover and store technical professionals based on search criteria.

## Prerequisites

- Node.js 20+
- PostgreSQL
- Redis (optional when `LEAD_SEARCH_SYNC=true`)

## Setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev
```

API runs at `http://localhost:3001/api`.

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
LeadSearchProvider (MockLeadSearchProvider by default)
      ↓
Lead records stored (name, role, company, profileUrl)
```

Swap `MockLeadSearchProvider` for a Playwright or external API provider in `lead-search.module.ts` when ready.

## Environment

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Upstash Redis TCP URL (`rediss://...`) for BullMQ |
| `LEAD_SEARCH_SYNC` | `true` = run search in-process (no Redis) |
| `PORT` | API port (default 3001) |
