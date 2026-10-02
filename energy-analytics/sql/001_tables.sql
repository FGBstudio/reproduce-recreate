-- energy-analytics: output tables (additive only, no changes to existing schema)
-- Applied to production 30/09/2026. Rollback: drop the four tables.

-- Custom retail/holiday events beyond civil holidays (sales, CNY, closures).
-- Civil holidays are computed in Python (`holidays` package) and NOT stored:
-- this table is only for what a calendar library cannot know.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('country','site')),
  country text,            -- ISO-3166 alpha-2 when scope='country'
  site_id uuid references public.sites(id) on delete cascade,
  event_date date not null,
  end_date date,           -- inclusive; null = single day
  kind text not null check (kind in ('holiday','sale','event','closure')),
  label text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_calendar_events_date on public.calendar_events (event_date);

-- One row per training/backtest run: without this registry no forecast is trustworthy.
create table if not exists public.model_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  model text not null,               -- 'xgb-daily-v1'
  kind text not null check (kind in ('backtest','train','forecast')),
  params jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,   -- global + per-site MAPE/RMSE/coverage
  notes text
);

-- Daily forecast per site, with uncertainty band. The frontend NEVER shows
-- these as measurements: always badged FORECAST.
create table if not exists public.energy_forecast_daily (
  site_id uuid not null references public.sites(id) on delete cascade,
  ts_day date not null,
  kwh_pred numeric not null,
  kwh_p10 numeric,
  kwh_p90 numeric,
  model text not null,
  run_id uuid references public.model_runs(id),
  created_at timestamptz not null default now(),
  primary key (site_id, ts_day, model)
);

-- Typed findings from the analytics: anomalies (falle) and opportunities.
create table if not exists public.energy_insights (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('leak','baseload','hvac_drift','saving_opportunity','data_quality')),
  period_start date not null,
  period_end date not null,
  severity text not null check (severity in ('info','warning','critical')),
  observed_kwh numeric,
  expected_kwh numeric,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'new' check (status in ('new','seen','resolved','dismissed')),
  run_id uuid references public.model_runs(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_energy_insights_site on public.energy_insights (site_id, status);
