ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS opening_spread_points NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS opening_over_under_line NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS opening_favorite_team TEXT,
  ADD COLUMN IF NOT EXISTS opening_provider TEXT,
  ADD COLUMN IF NOT EXISTS opening_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS games_opening_line_lookup
  ON public.games (season, game_date, competition_type, source_game_id);
