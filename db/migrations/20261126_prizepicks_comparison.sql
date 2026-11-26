CREATE TABLE IF NOT EXISTS public.prizepicks_projection_snapshots (
  id BIGSERIAL PRIMARY KEY,
  projection_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_starts_at TIMESTAMPTZ,
  player_id TEXT,
  player_name TEXT NOT NULL,
  team TEXT,
  position TEXT,
  opponent TEXT,
  stat TEXT NOT NULL,
  period TEXT,
  line NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  tier TEXT,
  more_available BOOLEAN,
  less_available BOOLEAN,
  source_updated_at TIMESTAMPTZ,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS prizepicks_snapshot_week_idx
  ON public.prizepicks_projection_snapshots (week_start, captured_at DESC);
CREATE INDEX IF NOT EXISTS prizepicks_snapshot_player_stat_idx
  ON public.prizepicks_projection_snapshots (week_start, player_name, stat, captured_at DESC);
CREATE INDEX IF NOT EXISTS prizepicks_snapshot_projection_idx
  ON public.prizepicks_projection_snapshots (projection_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.prizepicks_import_runs (
  id BIGSERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error TEXT,
  source_status TEXT
);
CREATE INDEX IF NOT EXISTS prizepicks_import_runs_week_idx
  ON public.prizepicks_import_runs (week_start, imported_at DESC);
