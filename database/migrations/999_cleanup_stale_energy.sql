-- ============================================================
-- AGGRESSIVE CLEANUP FOR LIVE DASHBOARD
-- Description: 
-- Keep 'energy_latest' strictly for CURRENTLY ONLINE devices.
-- If a device is silent for > 2 hours, remove it from the Card calculation.
-- Does NOT affect historical graphs (energy_telemetry).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION delete_stale_energy_latest()
RETURNS void AS $$
BEGIN
  -- 1. Aggressive Cleanup: Delete ANY device silent for > 2 hours
  -- This ensures the "Live Card" never sums old stalled values.
  DELETE FROM energy_latest 
  WHERE ts < NOW() - INTERVAL '2 hours';

  -- 2. Future Protection: Delete invalid future dates (+24h buffer for timezones)
  DELETE FROM energy_latest 
  WHERE ts > NOW() + INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Schedule to run frequently (Every 15 minutes)
-- (pg_cron.schedule with a name automatically updates the job if it exists)
SELECT cron.schedule(
  'cleanup-stale-energy', -- Job Name
  '*/15 * * * *',         -- Cron: Every 15 minutes
  $$SELECT delete_stale_energy_latest()$$
);

-- ============================================================
-- 4. RUN ONCE IMMEDIATELY (So you don't wait 15 mins)
-- ============================================================
SELECT delete_stale_energy_latest();


-- ============================================================
-- HOW TO UNDO (Turn it OFF in future)
-- Run this command:
-- SELECT cron.unschedule('cleanup-stale-energy');

-- HOW TO VERIFY (Check if running)
-- Run this command:
-- SELECT * FROM cron.job;
-- ============================================================
