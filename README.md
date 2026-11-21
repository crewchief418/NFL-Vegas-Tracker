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
4. Set `IMPORT_SECRET` to the protected workbook-import key if you need to run the one-time import.
5. Run `npm run dev`.

## Database
The `public.games` table stores regular-season and playoff games in one table. Original IDs are unique within each competition type, so overlapping source IDs are preserved. Original spread text is stored separately from its numeric value, allowing pick'em games to remain labeled `PK`.

The source workbook's regular-season `Covered` values are preserved in `source_covered_team`. The app stores a separate calculated ATS result in `covered_team` / `ats_result`; these are not used to overwrite the source column. Missing source totals remain NULL.

## Historical workbook import
Use **Import Workbook** in the app and select the original `NFL Scores.xlsx` file. The protected endpoint imports only:
- `Data_Picks` — regular-season games
- `Playoff_Data_Picks` — playoff games

The importer skips headings and metadata rows, keeps source sheet/row references, treats the 2015 Patriots–Seahawks pick'em as `PK` / zero points, and is safe to retry because duplicate source game IDs are ignored. The import key is held in Vercel's sensitive environment variables and must not be committed.

## Environment variables
- `DATABASE_URL`: Neon PostgreSQL connection string. Set this in Vercel project environment settings; never commit it.
- `IMPORT_SECRET`: Sensitive key required by the historical workbook import endpoint; never commit it.
