-- Migration: Import Historical Energy - Step 3: Generate Hourly and Daily Aggregates
-- Version: 028
-- Description: Backfill telemetry_hourly and telemetry_daily from imported raw data

-- Run aggregation backfill for historical data
DO $$
DECLARE
    -- Find the earliest imported data timestamp
    v_start_ts TIMESTAMPTZ := (
        SELECT MIN(date_trunc('hour', ts)) 
        FROM telemetry 
        WHERE labels->>'source' = 'historical_import'
    );
    v_end_ts   TIMESTAMPTZ := date_trunc('hour', now());
    v_curr_ts  TIMESTAMPTZ;
    v_hour_count INTEGER := 0;
    v_day_count INTEGER := 0;
BEGIN
    -- If no imported data found, skip
    IF v_start_ts IS NULL THEN 
        RAISE NOTICE 'No historical_import data found in telemetry. Skipping aggregation.';
        RETURN;
    END IF;

    RAISE NOTICE 'Starting aggregation backfill from % to %', v_start_ts, v_end_ts;

    -- 1. Generate TELEMETRY_HOURLY
    v_curr_ts := v_start_ts;
    WHILE v_curr_ts < v_end_ts LOOP
        PERFORM aggregate_telemetry_hourly(v_curr_ts);
        v_hour_count := v_hour_count + 1;
        
        -- Progress logging every 24 hours
        IF v_hour_count % 24 = 0 THEN
            RAISE NOTICE 'Hourly aggregation progress: % hours processed (current: %)', v_hour_count, v_curr_ts;
        END IF;
        
        v_curr_ts := v_curr_ts + INTERVAL '1 hour';
    END LOOP;
    
    RAISE NOTICE 'Hourly aggregation complete: % hours processed. Starting daily...', v_hour_count;

    -- 2. Generate TELEMETRY_DAILY
    v_curr_ts := date_trunc('day', v_start_ts);
    v_end_ts  := date_trunc('day', now());

    WHILE v_curr_ts < v_end_ts LOOP
        PERFORM aggregate_telemetry_daily(v_curr_ts::DATE);
        v_day_count := v_day_count + 1;
        
        -- Progress logging every 30 days
        IF v_day_count % 30 = 0 THEN
            RAISE NOTICE 'Daily aggregation progress: % days processed (current: %)', v_day_count, v_curr_ts;
        END IF;
        
        v_curr_ts := v_curr_ts + INTERVAL '1 day';
    END LOOP;

    RAISE NOTICE 'Aggregation backfill complete! Hours: %, Days: %', v_hour_count, v_day_count;
    RAISE NOTICE 'Historical energy charts should now display correctly.';
END $$;

-- Verify the import
DO $$
DECLARE
    v_raw_count BIGINT;
    v_hourly_count BIGINT;
    v_daily_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_raw_count 
    FROM telemetry WHERE labels->>'source' = 'historical_import';
    
    SELECT COUNT(*) INTO v_hourly_count 
    FROM telemetry_hourly WHERE labels->>'source_rows' IS NOT NULL;
    
    SELECT COUNT(*) INTO v_daily_count 
    FROM telemetry_daily WHERE labels->>'hourly_rows' IS NOT NULL;
    
    RAISE NOTICE '=== IMPORT VERIFICATION ===';
    RAISE NOTICE 'Raw telemetry rows imported: %', v_raw_count;
    RAISE NOTICE 'Hourly aggregates generated: %', v_hourly_count;
    RAISE NOTICE 'Daily aggregates generated: %', v_daily_count;
END $$;
