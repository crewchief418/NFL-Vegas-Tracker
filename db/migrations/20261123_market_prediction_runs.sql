CREATE TABLE IF NOT EXISTS public.market_prediction_runs (
  id BIGSERIAL PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  forecast_date DATE NOT NULL DEFAULT CURRENT_DATE,
  training_signature TEXT NOT NULL,
  forecast_count INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL
);
