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
- `npm run db:seed:campaigns`
- `npm run db:seed:contracts`
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
`monitoring_run_events`.

- `app/api/campaigns/route.ts`
- `app/api/campaigns/[id]/route.ts`
- `app/lib/db/mysql.ts`
- `app/lib/db/campaigns.ts`
- `app/api/contracts/deals/route.ts`
- `app/lib/db/contracts.ts`
- `app/lib/notice/store.ts`
- `app/lib/dynnode/store.ts`
- `app/lib/db/authorGuides.ts`
- `app/lib/monitoring/store.ts`
