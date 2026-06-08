# AICC Console MySQL Setup

## 1. Configure local environment

Create `.env.local` in `aicc-console`.

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=aicc_console
```

## 2. Create schema and seed campaign data

```bash
npm run db:setup
```

This runs:

- `npm run db:schema`
- `npm run db:seed:auth`
- `npm run db:seed:campaigns`
- `npm run db:seed:contracts`
- `npm run db:seed:business-lines`
- `npm run db:seed:board`
- `npm run db:seed:monitoring`

## 3. Check DB connection

```bash
npm run db:check
```

The app also exposes a DB health route:

```txt
GET /api/health/db
```

For Vercel or Railway deployment variables, see `docs/db/deployment.md`.

## Current migration scope

The first DB-backed vertical slices are `campaigns`, `contract_deals`,
`notices`, `author_guides`, `dynnode_posts`, `monitoring_runs`, and
`monitoring_run_events`. HR approval data is also stored in MySQL, including
`leave_requests`, `approval_steps`, `notifications`, and Notion calendar sync
history in `approval_calendar_syncs`.

- `app/api/campaigns/route.ts`
- `app/api/campaigns/[id]/route.ts`
- `app/lib/db/mysql.ts`
- `app/lib/db/campaigns.ts`
- `app/api/contracts/deals/route.ts`
- `app/lib/db/contracts.ts`
- `app/lib/notice/store.ts`
- `app/lib/db/authorGuides.ts`
- `app/lib/dynnode/store.ts`
- `app/lib/monitoring/store.ts`
- `app/lib/db/hr.ts`
- `app/lib/integrations/notionCalendar.ts`

## Notion approval calendar sync

Approved leave or trip requests can be mapped into a Notion calendar database.
Without Notion credentials, the app records a mock sync result so the local
approval flow can be tested before the external integration is ready.

Add these values to `.env.local` when the Notion database is ready:

```env
NOTION_API_KEY=
NOTION_APPROVAL_CALENDAR_DATABASE_ID=
NOTION_VERSION=2022-06-28
```

The target Notion database should include these properties:

- `Name` as title
- `Date` as date
- `Status` as status
- `Type` as select
- `Requester` as text
- `Approval ID` as text
