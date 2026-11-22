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


## Install as an app
NFL Vegas Tracker can be installed as a Progressive Web App (PWA) on supported browsers. Open the production URL and choose **Install App** (or the browser's install option). On iPhone/iPad, open the site in Safari, tap **Share**, then **Add to Home Screen**. The app uses the existing Neon database and does not require an account or login.

The app shell can open from cache when offline, but live game data and edits require an internet connection. API responses are deliberately not cached.


## Market predictions

The **Market Predictions** page contains three connected stages:

1. **Historical backtest** — chronological walk-forward testing. Each game's forecast is generated before that game's score is added to the model. The model combines Elo team ratings, home-field advantage, and each team's recent scoring and points allowed. Ratings regress toward league average between seasons.
2. **Upcoming forecasts** — predictions for future games in the schedule. Winner probabilities and projected scores are available even when Vegas lines have not been entered. Add a spread and/or total in Game Tracker to enable ATS and over/under probabilities and record a separate market snapshot.
3. **Forecast performance** — saved forecasts are matched to final scores and graded. Winner ties, ATS pushes, and total pushes are excluded from the relevant accuracy denominators. The latest market snapshot for each game is used in the current performance summary; earlier snapshots remain stored.

Forecast snapshots are append-only and keyed by matchup plus the recorded spread and total. Re-running the page on the same day does not create duplicate snapshots for unchanged lines; a new day or a changed completed-game dataset creates a fresh forecast snapshot using the latest available results. This is a historical-data model, not a live odds feed; injuries, weather, line movement, and lineup changes are not included. Probabilities are estimates, not betting advice.


## Free prediction data feeds

The Market Predictions model now has a separate external-data layer. It does not overwrite or modify any rows in `public.games`.

- **Existing game history:** remains the source for scores, spreads, totals, Elo ratings, and the walk-forward baseline.
- **nflverse team stats:** weekly team box-score/stat rows for the last seven seasons.
- **nflverse player stats:** weekly player production, including quarterback performance, for the last seven seasons.
- **nflverse injury reports:** weekly injury and practice participation reports for the last seven seasons. Current quarterback injury adjustments are only applied when the injured player matches the team's leading recent passer in the imported weekly stats.
- **Open-Meteo:** daily stadium forecasts for upcoming games across a seven-day forecast window. Indoor/retractable-roof venues are marked separately and do not receive outdoor-weather penalties.

The refresh job runs daily at 08:15 UTC using Vercel Cron. Market Predictions also has a manual refresh button; unauthenticated manual refreshes are rate-limited to one per 20 hours, with shorter recovery windows after failures or stale runs. It downloads public CSV/CSV.GZ releases from nflverse and calls the Open-Meteo forecast API; no paid API key is required. Set `CRON_SECRET` as a sensitive **Production** environment variable in Vercel so the scheduled endpoint can authenticate. The endpoint is `/api/data-refresh`.

The first external-data refresh runs at the next scheduled time after deployment. Data feed health and record counts are shown in Market Predictions. Upcoming forecasts use the newest imported team, player, injury, and weather context. The historical backtest remains the original game-history-only baseline until historical point-in-time external snapshots can be reconstructed; do not compare the contextual live forecast version to that baseline as though they were identical models.

Open-Meteo's no-key API is free for non-commercial use and its data is licensed under CC BY 4.0; attribution is required wherever weather is displayed. Before using this feed in a commercial or monetized version of the app, review Open-Meteo's commercial-use terms and move to an appropriate paid plan or licensed source. nflverse datasets are community-maintained public data; see the [nflverse data schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) for refresh timing and source details.


## ESPN closing lines

The app can import the highest-priority sportsbook closing spread and game total from ESPN's public, undocumented NFL odds endpoints. Completed games are matched to ESPN events by game date and both teams. ESPN's provider priority is used to select one sportsbook consistently; live-only and model providers are excluded.

Closing values are stored separately from manually entered lines in `public.games` (`closing_spread_points`, `closing_over_under_line`, `closing_favorite_team`, `closing_provider`). The existing manual spread and total fields are preserved. Where an ESPN closing value exists, it becomes the default line used by ATS, over/under, team splits, trends, and prediction history; otherwise the app falls back to the manually entered line. The game editor continues to edit the manual values and displays ESPN's closing line separately.

The scheduled job runs daily at 08:45 UTC through `/api/closing-lines`. The endpoint requires the same sensitive `CRON_SECRET` used by the existing data refresh. The Market Predictions page also has **Refresh ESPN closing lines**, which imports up to 80 completed games per batch; run it again after the five-minute manual refresh cooldown to continue the historical backfill. ESPN requests are rate-limited to a small concurrency.

ESPN's historical coverage varies. Its odds feed has broad historical sportsbook coverage from around 2014; explicit opening/closing snapshots are available in newer data, while older completed-game odds are taken from the provider's final pregame snapshot where available. The 2013 season is not included in this ESPN backfill. Games with no matching event or no usable odds are marked separately rather than having a made-up line. ESPN's odds endpoints are undocumented and may change without notice; this feed is not an official ESPN integration.
