
-- Enable RLS on tables that have policies but RLS disabled
-- These tables already have permissive SELECT USING(true) policies,
-- so data flow to the frontend remains unchanged.
-- service_role bypasses RLS entirely, so ingestion is unaffected.

ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telemetry_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_telemetry ENABLE ROW LEVEL SECURITY;
