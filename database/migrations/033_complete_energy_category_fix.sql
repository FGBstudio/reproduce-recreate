-- Migration: Complete Energy Category Fix
-- Version: 033
-- Description: Robust solution to populate device categories and update energy metrics

-- ============================================================
-- STEP 1: Add category column to devices if not exists
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'devices' AND column_name = 'category'
    ) THEN
        ALTER TABLE devices ADD COLUMN category TEXT;
        RAISE NOTICE 'Added category column to devices table';
    ELSE
        RAISE NOTICE 'Category column already exists';
    END IF;
END $$;

-- ============================================================
-- STEP 2: Populate category based on circuit_name patterns
-- ============================================================

-- HVAC category: AC, Heating, Cooling, HVAC, Outdoor units
UPDATE devices SET category = 'hvac'
WHERE circuit_name IS NOT NULL
  AND category IS NULL
  AND (
    circuit_name ILIKE '%hvac%'
    OR circuit_name ILIKE '%heating%'
    OR circuit_name ILIKE '%cooling%'
    OR circuit_name ILIKE 'ac %'
    OR circuit_name ILIKE '% ac %'
    OR circuit_name ILIKE '%ac - total%'
    OR circuit_name ILIKE '%outdoor unit%'
    OR circuit_name ILIKE '%climatizzazione%'
    OR circuit_name ILIKE '%condizionamento%'
  );

-- Lighting category: Lights, Lighting, Luci, Illuminazione
UPDATE devices SET category = 'lighting'
WHERE circuit_name IS NOT NULL
  AND category IS NULL
  AND (
    circuit_name ILIKE '%light%'
    OR circuit_name ILIKE '%luci%'
    OR circuit_name ILIKE '%illumin%'
    OR circuit_name ILIKE '%lamp%'
  );

-- Plugs category: Plugs, Prese, Outlets, Misc, Other (not totals)
UPDATE devices SET category = 'plugs'
WHERE circuit_name IS NOT NULL
  AND category IS NULL
  AND (
    circuit_name ILIKE '%plug%'
    OR circuit_name ILIKE '%prese%'
    OR circuit_name ILIKE '%outlet%'
    OR circuit_name ILIKE '%socket%'
    OR circuit_name ILIKE '%misc%'
    OR circuit_name ILIKE '%other%'
  )
  AND circuit_name NOT ILIKE '% - total%';

-- General category: Main, Mains, General, Generale, Arrivo, Sub-panel, etc.
-- Also: Store-level totals (e.g., "Boucheron Vendome - Total")
UPDATE devices SET category = 'general'
WHERE circuit_name IS NOT NULL
  AND category IS NULL
  AND (
    circuit_name ILIKE '%main%'
    OR circuit_name ILIKE '%general%'
    OR circuit_name ILIKE '%arrivo%'
    OR circuit_name ILIKE '%sub-panel%'
    OR circuit_name ILIKE '%sub panel%'
    OR circuit_name ILIKE '%quadro%'
    OR circuit_name ILIKE '%rete%'
    -- Store/Project totals
    OR circuit_name ILIKE '%boucheron%'
    OR circuit_name ILIKE '%fendi%'
    OR circuit_name ILIKE '%michael kors%'
    OR circuit_name ILIKE '%shanghai%'
    OR circuit_name ILIKE '%hangzhou%'
    OR circuit_name ILIKE '%xiamen%'
    OR circuit_name ILIKE '%fgb-studio%'
  );

-- Catch-all: remaining devices with circuit_name get 'general'
UPDATE devices SET category = 'general'
WHERE circuit_name IS NOT NULL
  AND category IS NULL;

-- Log category distribution
DO $$
DECLARE
    v_hvac BIGINT;
    v_lighting BIGINT;
    v_plugs BIGINT;
    v_general BIGINT;
    v_null BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_hvac FROM devices WHERE category = 'hvac';
    SELECT COUNT(*) INTO v_lighting FROM devices WHERE category = 'lighting';
    SELECT COUNT(*) INTO v_plugs FROM devices WHERE category = 'plugs';
    SELECT COUNT(*) INTO v_general FROM devices WHERE category = 'general';
    SELECT COUNT(*) INTO v_null FROM devices WHERE category IS NULL AND circuit_name IS NOT NULL;
    
    RAISE NOTICE '=== DEVICE CATEGORY DISTRIBUTION ===';
    RAISE NOTICE 'HVAC devices: %', v_hvac;
    RAISE NOTICE 'Lighting devices: %', v_lighting;
    RAISE NOTICE 'Plugs devices: %', v_plugs;
    RAISE NOTICE 'General devices: %', v_general;
    RAISE NOTICE 'Uncategorized (with circuit_name): %', v_null;
END $$;

-- ============================================================
-- STEP 3: Update energy_telemetry.metric based on device category
-- ============================================================

-- First, check current state
DO $$
DECLARE
    v_before_power BIGINT;
    v_before_hvac BIGINT;
    v_before_lighting BIGINT;
    v_before_plugs BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_before_power FROM energy_telemetry WHERE metric = 'energy.power_kw';
    SELECT COUNT(*) INTO v_before_hvac FROM energy_telemetry WHERE metric = 'energy.hvac_kw';
    SELECT COUNT(*) INTO v_before_lighting FROM energy_telemetry WHERE metric = 'energy.lighting_kw';
    SELECT COUNT(*) INTO v_before_plugs FROM energy_telemetry WHERE metric = 'energy.plugs_kw';
    
    RAISE NOTICE '=== BEFORE METRIC UPDATE ===';
    RAISE NOTICE 'energy.power_kw: %', v_before_power;
    RAISE NOTICE 'energy.hvac_kw: %', v_before_hvac;
    RAISE NOTICE 'energy.lighting_kw: %', v_before_lighting;
    RAISE NOTICE 'energy.plugs_kw: %', v_before_plugs;
END $$;

-- Update HVAC metrics
UPDATE energy_telemetry et
SET metric = 'energy.hvac_kw'
FROM devices d
WHERE et.device_id = d.id
  AND d.category = 'hvac'
  AND et.metric = 'energy.power_kw';

-- Update Lighting metrics
UPDATE energy_telemetry et
SET metric = 'energy.lighting_kw'
FROM devices d
WHERE et.device_id = d.id
  AND d.category = 'lighting'
  AND et.metric = 'energy.power_kw';

-- Update Plugs metrics
UPDATE energy_telemetry et
SET metric = 'energy.plugs_kw'
FROM devices d
WHERE et.device_id = d.id
  AND d.category = 'plugs'
  AND et.metric = 'energy.power_kw';

-- General stays as energy.power_kw (no change needed)

-- Log after state
DO $$
DECLARE
    v_after_power BIGINT;
    v_after_hvac BIGINT;
    v_after_lighting BIGINT;
    v_after_plugs BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_after_power FROM energy_telemetry WHERE metric = 'energy.power_kw';
    SELECT COUNT(*) INTO v_after_hvac FROM energy_telemetry WHERE metric = 'energy.hvac_kw';
    SELECT COUNT(*) INTO v_after_lighting FROM energy_telemetry WHERE metric = 'energy.lighting_kw';
    SELECT COUNT(*) INTO v_after_plugs FROM energy_telemetry WHERE metric = 'energy.plugs_kw';
    
    RAISE NOTICE '=== AFTER METRIC UPDATE ===';
    RAISE NOTICE 'energy.power_kw: %', v_after_power;
    RAISE NOTICE 'energy.hvac_kw: %', v_after_hvac;
    RAISE NOTICE 'energy.lighting_kw: %', v_after_lighting;
    RAISE NOTICE 'energy.plugs_kw: %', v_after_plugs;
END $$;

-- ============================================================
-- STEP 4: Clear and regenerate hourly/daily aggregates
-- ============================================================

-- Clear existing aggregates for categorized devices
DELETE FROM energy_hourly 
WHERE device_id IN (SELECT id FROM devices WHERE category IS NOT NULL);

DELETE FROM energy_daily 
WHERE device_id IN (SELECT id FROM devices WHERE category IS NOT NULL);

RAISE NOTICE 'Cleared existing hourly/daily aggregates for categorized devices';

-- ============================================================
-- STEP 5: Regenerate Hourly and Daily Aggregates
-- ============================================================
DO $$
DECLARE
    v_start_ts TIMESTAMPTZ;
    v_end_ts   TIMESTAMPTZ := date_trunc('hour', now());
    v_curr_ts  TIMESTAMPTZ;
    v_hour_count INTEGER := 0;
    v_day_count INTEGER := 0;
BEGIN
    -- Find earliest data for categorized devices
    SELECT MIN(date_trunc('hour', ts)) INTO v_start_ts
    FROM energy_telemetry et
    JOIN devices d ON et.device_id = d.id
    WHERE d.category IS NOT NULL;

    IF v_start_ts IS NULL THEN 
        RAISE NOTICE 'No categorized device data found in energy_telemetry. Skipping aggregation.';
        RETURN;
    END IF;

    RAISE NOTICE 'Regenerating aggregates from % to %', v_start_ts, v_end_ts;

    -- Generate ENERGY_HOURLY
    v_curr_ts := v_start_ts;
    WHILE v_curr_ts < v_end_ts LOOP
        BEGIN
            PERFORM aggregate_energy_hourly(v_curr_ts);
        EXCEPTION WHEN OTHERS THEN
            -- Skip errors and continue
            NULL;
        END;
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
        BEGIN
            PERFORM aggregate_energy_daily(v_curr_ts::DATE);
        EXCEPTION WHEN OTHERS THEN
            -- Skip errors and continue
            NULL;
        END;
        v_day_count := v_day_count + 1;
        
        IF v_day_count % 30 = 0 THEN
            RAISE NOTICE 'Daily progress: % days (current: %)', v_day_count, v_curr_ts;
        END IF;
        
        v_curr_ts := v_curr_ts + INTERVAL '1 day';
    END LOOP;

    RAISE NOTICE 'Aggregation complete! Hours: %, Days: %', v_hour_count, v_day_count;
END $$;

-- ============================================================
-- STEP 6: Update energy_latest cache
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
-- FINAL VERIFICATION
-- ============================================================
DO $$
DECLARE
    v_devices_hvac BIGINT;
    v_devices_lighting BIGINT;
    v_devices_plugs BIGINT;
    v_devices_general BIGINT;
    v_raw_hvac BIGINT;
    v_raw_lighting BIGINT;
    v_raw_plugs BIGINT;
    v_raw_general BIGINT;
    v_hourly_count BIGINT;
    v_daily_count BIGINT;
    v_latest_count BIGINT;
BEGIN
    -- Device counts by category
    SELECT COUNT(*) INTO v_devices_hvac FROM devices WHERE category = 'hvac';
    SELECT COUNT(*) INTO v_devices_lighting FROM devices WHERE category = 'lighting';
    SELECT COUNT(*) INTO v_devices_plugs FROM devices WHERE category = 'plugs';
    SELECT COUNT(*) INTO v_devices_general FROM devices WHERE category = 'general';
    
    -- Telemetry counts by metric
    SELECT COUNT(*) INTO v_raw_hvac FROM energy_telemetry WHERE metric = 'energy.hvac_kw';
    SELECT COUNT(*) INTO v_raw_lighting FROM energy_telemetry WHERE metric = 'energy.lighting_kw';
    SELECT COUNT(*) INTO v_raw_plugs FROM energy_telemetry WHERE metric = 'energy.plugs_kw';
    SELECT COUNT(*) INTO v_raw_general FROM energy_telemetry WHERE metric = 'energy.power_kw';
    
    -- Aggregate counts
    SELECT COUNT(*) INTO v_hourly_count FROM energy_hourly;
    SELECT COUNT(*) INTO v_daily_count FROM energy_daily;
    SELECT COUNT(*) INTO v_latest_count FROM energy_latest;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE '=== MIGRATION 033 FINAL VERIFICATION ===';
    RAISE NOTICE '============================================';
    RAISE NOTICE '';
    RAISE NOTICE '--- DEVICES BY CATEGORY ---';
    RAISE NOTICE 'HVAC devices: %', v_devices_hvac;
    RAISE NOTICE 'Lighting devices: %', v_devices_lighting;
    RAISE NOTICE 'Plugs devices: %', v_devices_plugs;
    RAISE NOTICE 'General devices: %', v_devices_general;
    RAISE NOTICE '';
    RAISE NOTICE '--- ENERGY_TELEMETRY BY METRIC ---';
    RAISE NOTICE 'energy.hvac_kw rows: %', v_raw_hvac;
    RAISE NOTICE 'energy.lighting_kw rows: %', v_raw_lighting;
    RAISE NOTICE 'energy.plugs_kw rows: %', v_raw_plugs;
    RAISE NOTICE 'energy.power_kw rows: %', v_raw_general;
    RAISE NOTICE '';
    RAISE NOTICE '--- AGGREGATES ---';
    RAISE NOTICE 'Hourly aggregates: %', v_hourly_count;
    RAISE NOTICE 'Daily aggregates: %', v_daily_count;
    RAISE NOTICE 'Latest cache entries: %', v_latest_count;
    RAISE NOTICE '============================================';
END $$;
