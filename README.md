# LeadWolf 🐺

AI-powered developer outreach and lead generation platform.

## Vision

LeadWolf helps a solo founder discover technical professionals, enrich their profiles, find publicly available business contact information, generate personalized outreach emails using AI, and send campaigns through Brevo.

The goal is to create an affordable outreach workflow that runs on a personal VPS and minimizes reliance on expensive lead-generation platforms.

---

# Problem Statement

Platforms such as Apollo, Hunter, RocketReach, and Snov provide verified contact databases but heavily restrict free usage.

LeadWolf aims to:

- Discover technical professionals.
- Enrich professional information.
- Discover publicly available business contact channels.
- Verify contact validity.
- Generate personalized outreach.
- Send and track campaigns.

---

# High Level Architecture

```text
Lead Search
      ↓
Profile Collection
      ↓
Profile Enrichment
      ↓
Company Discovery
      ↓
Contact Discovery
      ↓
Contact Verification
      ↓
AI Personalization
      ↓
Campaign Sending
      ↓
Analytics
```

---

# Core Features

## 1. Lead Discovery

Collect professionals based on search criteria.

Example:

```text
Senior Software Engineers India

CTO AI Startups India

Founders SaaS Companies
```

Store:

```json
{
  "name": "",
  "role": "",
  "company": "",
  "profile_url": ""
}
```

---

## 2. Lead Enrichment

Enrich discovered leads with:

```json
{
  "company_website": "",
  "location": "",
  "github_url": "",
  "portfolio_url": "",
  "company_size": ""
}
```

Sources:

- Public company websites
- GitHub
- Personal websites
- Public directories

---

## 3. Company Discovery

Input:

```json
{
  "company": "Acme"
}
```

Output:

```json
{
  "website": "acme.com"
}
```

Purpose:

Find the company's official domain.

---

## 4. Contact Discovery

Goal:

Identify publicly available business contact information.

Possible sources:

- Team pages
- About pages
- Contact pages
- Public websites
- Public GitHub repositories
- Public portfolios

Extract:

```json
{
  "email": "",
  "source": ""
}
```

---

## 5. Contact Verification

Validate discovered contact information.

Checks:

- MX records
- Disposable email detection
- Domain validation
- SMTP verification

Result:

```json
{
  "verified": true,
  "confidence": 95
}
```

---

## 6. AI Personalization

Generate personalized cold emails.

Input:

```json
{
  "name": "",
  "role": "",
  "company": "",
  "website": "",
  "github": ""
}
```

Prompt Goals:

- Mention role
- Mention company
- Mention recent observation
- Keep concise
- Avoid generic sales language

Output:

```text
Personalized outreach email
```

Provider:

OpenRouter

Preferred Models:

- Qwen
- DeepSeek
- Llama

---

## 7. Campaign Sending

Provider:

Brevo

Capabilities:

- Single email send
- Batch campaigns
- Rate limiting
- Retry failed sends

Flow:

```text
Verified Lead
      ↓
Generated Email
      ↓
Brevo
      ↓
Sent
```

---

## 8. Analytics

Track:

```text
Sent
Opened
Clicked
Replied
Bounced
```

Metrics:

```text
Open Rate
Reply Rate
Bounce Rate
```

---

# Suggested Tech Stack

## Frontend

- Next.js
- TypeScript
- Tailwind CSS
- Shadcn UI

---

## Backend

- NestJS
- TypeScript

---

## Database

PostgreSQL

---

## ORM

Prisma

---

## Queue

BullMQ

Redis

---

## Scraping

Playwright

---

## AI

OpenRouter

---

## Email

Brevo

---

## Hosting

DigitalOcean VPS

---

# Database Design

## Lead

```prisma
model Lead {
  id             String   @id @default(cuid())

  name           String
  role           String
  company        String

  profileUrl     String

  website        String?
  githubUrl      String?

  email          String?

  verified       Boolean @default(false)

  status         LeadStatus

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

---

## Campaign

```prisma
model Campaign {
  id           String   @id @default(cuid())

  name         String

  createdAt    DateTime @default(now())

  emailsSent   Int      @default(0)
}
```

---

## Email Activity

```prisma
model EmailActivity {
  id          String   @id @default(cuid())

  leadId      String

  sentAt      DateTime?

  openedAt    DateTime?

  clickedAt   DateTime?

  replied     Boolean @default(false)

  bounced     Boolean @default(false)
}
```

---

# Lead Status Workflow

```text
NEW
 ↓
ENRICHED
 ↓
DOMAIN_FOUND
 ↓
CONTACT_FOUND
 ↓
VERIFIED
 ↓
EMAIL_GENERATED
 ↓
SENT
 ↓
OPENED
 ↓
REPLIED
```

---

# Queue Architecture

## Enrichment Queue

```text
Lead
 ↓
Company Discovery
 ↓
Website Discovery
 ↓
GitHub Discovery
```

---

## Contact Queue

```text
Lead
 ↓
Contact Discovery
 ↓
Contact Verification
```

---

## Personalization Queue

```text
Lead
 ↓
OpenRouter
 ↓
Email Draft
```

---

## Sending Queue

```text
Email Draft
 ↓
Brevo
 ↓
Webhook Tracking
```

---

# Dashboard Pages

## /dashboard

Overview metrics

- Leads
- Verified Contacts
- Campaigns
- Open Rate

---

## /leads

Lead management

Filters:

- Role
- Company
- Status

---

## /campaigns

Campaign management

- Create campaign
- Send campaign
- View analytics

---

## /settings

Configuration

- OpenRouter API Key
- Brevo API Key
- Rate Limits
- Sending Domains

---

# MVP Scope

Phase 1:

- Lead storage
- Lead dashboard
- Basic enrichment

Phase 2:

- Company discovery
- Contact discovery
- Verification

Phase 3:

- AI personalization
- Campaign sending

Phase 4:

- Analytics
- Workflow automation

---

# Future Features

## AI Agent

Example command:

```text
Find CTOs of AI startups in India
```

Agent automatically:

```text
Search
 ↓
Collect Leads
 ↓
Enrich
 ↓
Discover Contacts
 ↓
Verify
 ↓
Generate Outreach
 ↓
Prepare Campaign
```

---

# Success Criteria

A successful LeadWolf workflow should:

1. Collect relevant technical professionals.
2. Enrich their professional profile.
3. Discover publicly available business contact channels.
4. Verify contact validity.
5. Generate personalized outreach.
6. Send campaigns.
7. Track engagement metrics.

The system should be deployable on a single VPS and usable by a solo founder.
