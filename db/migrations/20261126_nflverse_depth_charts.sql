CREATE TABLE IF NOT EXISTS public.nflverse_depth_charts (
  season INTEGER NOT NULL,
  team TEXT NOT NULL,
  player_name TEXT NOT NULL,
  gsis_id TEXT,
  position TEXT NOT NULL,
  position_name TEXT,
  depth_rank INTEGER NOT NULL,
  snapshot_dt TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS nflverse_depth_charts_lookup
  ON public.nflverse_depth_charts (season, team, position, depth_rank, snapshot_dt DESC);
CREATE INDEX IF NOT EXISTS nflverse_depth_charts_player
  ON public.nflverse_depth_charts (season, gsis_id);
