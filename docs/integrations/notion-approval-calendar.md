# Notion Approval Calendar Structure

## Goal

When an internal approval is approved in the AICC operation portal, create or
track a matching item in a Notion calendar database. The first supported target
is HR leave/trip approvals.

## Current flow

1. A user submits a leave, half-day, business trip, or trip expense request.
2. The request creates a `leave_requests` row and a pending `approval_steps` row.
3. An approver approves the item from `/approvals`.
4. `decideApproval` updates the approval and request status.
5. If the decision is `APPROVED`, the app calls the Notion calendar adapter.
6. The sync result is stored in `approval_calendar_syncs`.
7. The approval page shows whether the Notion sync completed, failed, or ran in
   mock mode.

## Data model

`approval_calendar_syncs` stores external calendar mapping state.

- `target_type`: currently `LEAVE_REQUEST`
- `target_id`: approved request id
- `provider`: currently `NOTION`
- `sync_status`: `PENDING`, `SYNCED`, or `FAILED`
- `external_page_id`: Notion page id
- `external_url`: Notion page URL
- `last_error`: latest sync failure message
- `synced_at`: successful sync timestamp

## Runtime behavior

The Notion adapter uses mock mode when either `NOTION_API_KEY` or
`NOTION_APPROVAL_CALENDAR_DATABASE_ID` is missing. This lets local development
verify the approval flow without a real Notion workspace.

When both values exist, the adapter creates a Notion page with:

- `Name`: request type and requester
- `Date`: request start/end date
- `Status`: `Approved`
- `Type`: request type label
- `Requester`: requester name
- `Approval ID`: source request id

## Files

- `app/lib/db/hr.ts`: approval decision and sync orchestration
- `app/lib/integrations/notionCalendar.ts`: Notion API adapter
- `app/api/approvals/route.ts`: approval API response
- `app/(main)/approvals/page.tsx`: approval result feedback
- `docs/db/mysql-schema.sql`: `approval_calendar_syncs` table

## Next steps

1. Create a Notion database with the required properties.
2. Share the database with the Notion integration.
3. Set `NOTION_API_KEY` and `NOTION_APPROVAL_CALENDAR_DATABASE_ID` in
   `.env.local`.
4. Run `npm run db:schema` against the active MySQL database.
5. Approve a test request from `/approvals` and confirm the Notion page is
   created.
