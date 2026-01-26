-- Migration: Fix Energy Metrics Based on Device Category
-- Version: 032
-- Description: Update energy_telemetry.metric using devices.category and regenerate aggregates

-- ============================================================
-- STEP 1: Update energy_telemetry.metric based on device category
-- ============================================================
UPDATE energy_telemetry et
SET metric = CASE d.category
    WHEN 'hvac' THEN 'energy.hvac_kw'
    WHEN 'lighting' THEN 'energy.lighting_kw'
    WHEN 'plugs' THEN 'energy.plugs_kw'
    WHEN 'general' THEN 'energy.power_kw'
    ELSE 'energy.power_kw'
END
FROM devices d
WHERE et.device_id = d.id
  AND d.category IS NOT NULL
  AND et.metric = 'energy.power_kw';

-- Log how many rows were updated
DO $$
DECLARE
    v_hvac_count BIGINT;
    v_lighting_count BIGINT;
    v_plugs_count BIGINT;
    v_general_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_hvac_count FROM energy_telemetry WHERE metric = 'energy.hvac_kw';
    SELECT COUNT(*) INTO v_lighting_count FROM energy_telemetry WHERE metric = 'energy.lighting_kw';
    SELECT COUNT(*) INTO v_plugs_count FROM energy_telemetry WHERE metric = 'energy.plugs_kw';
    SELECT COUNT(*) INTO v_general_count FROM energy_telemetry WHERE metric = 'energy.power_kw';
    
    RAISE NOTICE '=== METRIC UPDATE RESULTS ===';
    RAISE NOTICE 'HVAC (energy.hvac_kw): %', v_hvac_count;
    RAISE NOTICE 'Lighting (energy.lighting_kw): %', v_lighting_count;
    RAISE NOTICE 'Plugs (energy.plugs_kw): %', v_plugs_count;
    RAISE NOTICE 'General (energy.power_kw): %', v_general_count;
END $$;

-- ============================================================
-- STEP 2: Clear existing aggregates for affected devices
-- ============================================================
DELETE FROM energy_hourly 
WHERE device_id IN (
    SELECT id FROM devices WHERE category IS NOT NULL
);

DELETE FROM energy_daily 
WHERE device_id IN (
    SELECT id FROM devices WHERE category IS NOT NULL
);

RAISE NOTICE 'Cleared existing hourly/daily aggregates for categorized devices';

-- ============================================================
-- STEP 3: Regenerate Hourly and Daily Aggregates
-- ============================================================
DO $$
DECLARE
    v_start_ts TIMESTAMPTZ := (
        SELECT MIN(date_trunc('hour', ts)) 
        FROM energy_telemetry et
        JOIN devices d ON et.device_id = d.id
        WHERE d.category IS NOT NULL
    );
    v_end_ts   TIMESTAMPTZ := date_trunc('hour', now());
    v_curr_ts  TIMESTAMPTZ;
    v_hour_count INTEGER := 0;
    v_day_count INTEGER := 0;
BEGIN
    IF v_start_ts IS NULL THEN 
        RAISE NOTICE 'No categorized device data found. Skipping aggregation.';
        RETURN;
    END IF;

    RAISE NOTICE 'Regenerating aggregates from % to %', v_start_ts, v_end_ts;

    -- Generate ENERGY_HOURLY
    v_curr_ts := v_start_ts;
    WHILE v_curr_ts < v_end_ts LOOP
        PERFORM aggregate_energy_hourly(v_curr_ts);
        v_hour_count := v_hour_count + 1;
        
        IF v_hour_count % 100 = 0 THEN
            RAISE NOTICE 'Hourly progress: % hours (current: %)', v_hour_count, v_curr_ts;
        END IF;
        
        v_curr_ts := v_curr_ts + INTERVAL '1 hour';
    END LOOP;
    
    RAISE NOTICE 'Hourly complete: % hours. Starting daily...', v_hour_count;

    -- Generate ENERGY_DAILY
    v_curr_ts := date_trunc('day', v_start_ts);
    v_end_ts  := date_trunc('day', now());

    WHILE v_curr_ts < v_end_ts LOOP
        PERFORM aggregate_energy_daily(v_curr_ts::DATE);
        v_day_count := v_day_count + 1;
        
        IF v_day_count % 30 = 0 THEN
            RAISE NOTICE 'Daily progress: % days (current: %)', v_day_count, v_curr_ts;
        END IF;
        
        v_curr_ts := v_curr_ts + INTERVAL '1 day';
    END LOOP;

    RAISE NOTICE 'Aggregation complete! Hours: %, Days: %', v_hour_count, v_day_count;
END $$;

-- ============================================================
-- STEP 4: Update energy_latest cache
-- ============================================================
INSERT INTO energy_latest (device_id, site_id, metric, value, unit, ts, quality)
SELECT DISTINCT ON (et.device_id, et.metric)
    et.device_id,
    et.site_id,
    et.metric,
    et.value,
    et.unit,
    et.ts,
    et.quality
FROM energy_telemetry et
JOIN devices d ON et.device_id = d.id
WHERE d.category IS NOT NULL
ORDER BY et.device_id, et.metric, et.ts DESC
ON CONFLICT (device_id, metric) DO UPDATE SET
    value = EXCLUDED.value,
    unit = EXCLUDED.unit,
    ts = EXCLUDED.ts,
    quality = EXCLUDED.quality;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
    v_raw_hvac BIGINT;
    v_raw_lighting BIGINT;
    v_raw_plugs BIGINT;
    v_hourly_count BIGINT;
    v_daily_count BIGINT;
    v_latest_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_raw_hvac FROM energy_telemetry WHERE metric = 'energy.hvac_kw';
    SELECT COUNT(*) INTO v_raw_lighting FROM energy_telemetry WHERE metric = 'energy.lighting_kw';
    SELECT COUNT(*) INTO v_raw_plugs FROM energy_telemetry WHERE metric = 'energy.plugs_kw';
    SELECT COUNT(*) INTO v_hourly_count FROM energy_hourly;
    SELECT COUNT(*) INTO v_daily_count FROM energy_daily;
    SELECT COUNT(*) INTO v_latest_count FROM energy_latest;
    
    RAISE NOTICE '=== MIGRATION 032 VERIFICATION ===';
    RAISE NOTICE 'Raw HVAC rows: %', v_raw_hvac;
    RAISE NOTICE 'Raw Lighting rows: %', v_raw_lighting;
    RAISE NOTICE 'Raw Plugs rows: %', v_raw_plugs;
    RAISE NOTICE 'Hourly aggregates: %', v_hourly_count;
    RAISE NOTICE 'Daily aggregates: %', v_daily_count;
    RAISE NOTICE 'Latest cache entries: %', v_latest_count;
END $$;
