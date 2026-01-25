-- Migration: Import Historical Energy into Dedicated Tables
-- Version: 031
-- Description: Import from historical_energy into energy_telemetry and run aggregation

-- ============================================================
-- STEP 1: Create Virtual Devices (if not exists)
-- ============================================================
INSERT INTO devices (site_id, name, device_id, device_type, status, metadata, created_at)
SELECT DISTINCT 
    h.site_id, 
    h.circuit_name as name,
    'HIST-' || regexp_replace(h.circuit_name, '\s+', '', 'g') || '-' || LEFT(h.site_id::text, 8) as device_id,
    'energy_monitor'::device_type,
    'offline'::device_status,
    jsonb_build_object(
        'source', 'historical_import',
        'virtual', true,
        'original_circuit', h.circuit_name,
        'imported_at', now()
    ) as metadata,
    now()
FROM historical_energy h
LEFT JOIN devices d ON d.site_id = h.site_id AND d.name = h.circuit_name
WHERE d.id IS NULL
  AND h.site_id != 'fe102b55-ec8a-4f4f-b797-26ee6c132381'
ON CONFLICT (device_id, broker) DO NOTHING;

-- ============================================================
-- STEP 2: Insert into energy_telemetry (RAW)
-- ============================================================
INSERT INTO energy_telemetry (ts, value, unit, metric, site_id, device_id, quality, labels)
SELECT 
    h.timestamp as ts,
    
    -- Value conversion
    CASE 
        WHEN h.metric_type = 'Power' AND h.unit = 'W' THEN h.value / 1000.0
        ELSE h.value
    END as value,

    -- Unit normalization
    CASE 
        WHEN h.metric_type = 'Power' THEN 'kW'
        WHEN h.metric_type = 'Current' THEN 'A'
        WHEN h.metric_type = 'Energy' THEN 'kWh'
        WHEN h.metric_type = 'Voltage' THEN 'V'
        ELSE COALESCE(h.unit, 'unknown')
    END as unit,

    -- Metric mapping
    CASE 
        WHEN h.metric_type = 'Power' THEN 'energy.power_kw'
        WHEN h.metric_type = 'Current' THEN 'energy.current_a'
        WHEN h.metric_type = 'Energy' THEN 'energy.active_energy'
        WHEN h.metric_type = 'Voltage' THEN 'energy.voltage'
        ELSE 'energy.unknown'
    END as metric,

    h.site_id,

    -- Device assignment
    CASE 
        WHEN h.site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381' THEN (
            SELECT id FROM devices 
            WHERE site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381' 
            AND (device_id ILIKE '%Milan-Office-Bridge-01%' OR name ILIKE '%Milan-Office-Bridge-01%')
            LIMIT 1
        )
        ELSE d.id
    END as device_id,

    'historical' as quality,

    jsonb_build_object(
        'source', 'historical_import', 
        'original_circuit', h.circuit_name,
        'original_metric', h.metric_type,
        'original_unit', h.unit,
        'imported_at', now()::text
    ) as labels

FROM historical_energy h
LEFT JOIN devices d ON h.site_id = d.site_id AND d.name = h.circuit_name
WHERE (
    (h.site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381') 
    OR 
    (d.id IS NOT NULL)
)
ON CONFLICT (device_id, ts, metric) DO NOTHING;

-- ============================================================
-- STEP 3: Generate Hourly and Daily Aggregates
-- ============================================================
DO $$
DECLARE
    v_start_ts TIMESTAMPTZ := (
        SELECT MIN(date_trunc('hour', ts)) 
        FROM energy_telemetry 
        WHERE labels->>'source' = 'historical_import'
    );
    v_end_ts   TIMESTAMPTZ := date_trunc('hour', now());
    v_curr_ts  TIMESTAMPTZ;
    v_hour_count INTEGER := 0;
    v_day_count INTEGER := 0;
BEGIN
    IF v_start_ts IS NULL THEN 
        RAISE NOTICE 'No historical_import data found in energy_telemetry. Skipping aggregation.';
        RETURN;
    END IF;

    RAISE NOTICE 'Starting energy aggregation from % to %', v_start_ts, v_end_ts;

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

    RAISE NOTICE 'Energy aggregation complete! Hours: %, Days: %', v_hour_count, v_day_count;
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
    v_raw_count BIGINT;
    v_hourly_count BIGINT;
    v_daily_count BIGINT;
    v_latest_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_raw_count FROM energy_telemetry;
    SELECT COUNT(*) INTO v_hourly_count FROM energy_hourly;
    SELECT COUNT(*) INTO v_daily_count FROM energy_daily;
    SELECT COUNT(*) INTO v_latest_count FROM energy_latest;
    
    RAISE NOTICE '=== ENERGY IMPORT VERIFICATION ===';
    RAISE NOTICE 'Raw energy rows: %', v_raw_count;
    RAISE NOTICE 'Hourly aggregates: %', v_hourly_count;
    RAISE NOTICE 'Daily aggregates: %', v_daily_count;
    RAISE NOTICE 'Latest cache entries: %', v_latest_count;
END $$;
