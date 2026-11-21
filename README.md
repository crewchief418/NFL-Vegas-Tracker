# NFL Vegas Tracker

A mobile-friendly NFL historical results and betting analytics app, migrated from Google Apps Script / Google Sheets to Next.js, Vercel, and Neon PostgreSQL.

## Stack
- Next.js App Router
- Neon PostgreSQL
- Vercel deployment

## Local setup
1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to the Neon connection string.
4. Run `npm run dev`.

## Database
The `public.games` table stores regular-season and playoff games in one table. Original IDs are unique within each competition type, so overlapping source IDs are preserved. Original spread text is stored separately from its numeric value, allowing pick'em games to remain labeled `PK`.

Historical source workbook: `NFL Scores.xlsx` (maintained outside this repository; do not commit private or personal data).

## Historical migration status
The database schema has been created. The 3,833 historical records have not yet been imported. Import validation must preserve missing totals and spreads, exclude playoff section-heading rows, and verify ATS calculations against existing regular-season covered-team values before enabling recalculation.

## Environment variables
- `DATABASE_URL`: Neon PostgreSQL connection string. Set this in Vercel project environment settings; never commit it.
