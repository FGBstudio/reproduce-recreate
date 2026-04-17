-- ============================================================
-- RESTORE SCRIPT (Last 24 Hours Only)
-- ============================================================

-- 1. STOP the Cleanup Job (Safe Mode)
SELECT cron.unschedule('cleanup-stale-energy');

-- 2. REFILL 'energy_latest' 
-- Only grabs data from the last 24 HOURS.
-- This brings back Shanghai (recent) but ignores the old "ghosts".

INSERT INTO energy_latest (device_id, site_id, metric, value, unit, ts, quality)
SELECT DISTINCT ON (device_id, metric)
    device_id, 
    site_id, 
    metric, 
    value, 
    unit, 
    ts, 
    quality
FROM energy_telemetry
WHERE ts > NOW() - INTERVAL '24 hours'  -- <--- The Filter You Asked For
ORDER BY device_id, metric, ts DESC
ON CONFLICT (device_id, metric) DO UPDATE SET
    value = EXCLUDED.value,
    ts = EXCLUDED.ts,
    quality = EXCLUDED.quality,
    site_id = EXCLUDED.site_id;

-- 3. STATUS
SELECT 'Restored recent data (24h). Cleanup job stopped.' as status;
