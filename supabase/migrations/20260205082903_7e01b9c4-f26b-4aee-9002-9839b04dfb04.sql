-- Migration: Sync telemetry to energy tables with category mapping
-- Version: 039
-- Description: Create sync function and integrate into scheduled jobs

-- ============================================================
-- SYNC FUNCTION: telemetry → energy_telemetry with category mapping
-- ============================================================
CREATE OR REPLACE FUNCTION sync_telemetry_to_energy(
    p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '1 hour'
)
RETURNS TABLE (
    rows_synced BIGINT,
    rows_skipped BIGINT
) AS $$
DECLARE
    v_synced BIGINT := 0;
    v_skipped BIGINT := 0;
BEGIN
    -- Sync energy metrics from telemetry to energy_telemetry
    -- Apply category-based metric mapping from devices table
    WITH source_data AS (
        SELECT 
            t.device_id,
            t.site_id,
            t.ts,
            -- Map metric based on device category (from migration 033 logic)
            CASE 
                WHEN d.category = 'hvac' AND t.metric = 'energy.power_kw' THEN 'energy.hvac_kw'
                WHEN d.category = 'lighting' AND t.metric = 'energy.power_kw' THEN 'energy.lighting_kw'
                WHEN d.category = 'plugs' AND t.metric = 'energy.power_kw' THEN 'energy.plugs_kw'
                WHEN d.category = 'general' AND t.metric = 'energy.power_kw' THEN 'energy.power_kw'
                ELSE t.metric
            END as metric,
            t.value,
            t.unit,
            COALESCE(t.quality, 'good') as quality,
            t.labels
        FROM telemetry t
        LEFT JOIN devices d ON t.device_id = d.id
        WHERE t.ts >= p_since
          AND t.metric LIKE 'energy.%'
    ),
    inserted AS (
        INSERT INTO energy_telemetry (device_id, site_id, ts, metric, value, unit, quality, labels)
        SELECT 
            device_id,
            site_id,
            ts,
            metric,
            value,
            unit,
            quality,
            labels
        FROM source_data
        ON CONFLICT (device_id, ts, metric) DO UPDATE SET
            value = EXCLUDED.value,
            site_id = COALESCE(EXCLUDED.site_id, energy_telemetry.site_id),
            unit = COALESCE(EXCLUDED.unit, energy_telemetry.unit),
            quality = EXCLUDED.quality,
            labels = EXCLUDED.labels
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_synced FROM inserted;

    -- Update energy_latest cache
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
    WHERE ts >= p_since
    ORDER BY device_id, metric, ts DESC
    ON CONFLICT (device_id, metric) DO UPDATE SET
        value = EXCLUDED.value,
        site_id = COALESCE(EXCLUDED.site_id, energy_latest.site_id),
        unit = EXCLUDED.unit,
        ts = EXCLUDED.ts,
        quality = EXCLUDED.quality;

    RETURN QUERY SELECT v_synced, v_skipped;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATE SCHEDULED JOBS: Include energy sync and aggregation
-- ============================================================
CREATE OR REPLACE FUNCTION run_scheduled_jobs()
RETURNS TABLE (
    job_name TEXT,
    status TEXT,
    details JSONB
) AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- 1. Materialize power metrics
    SELECT * INTO v_result FROM materialize_power_metrics(now() - INTERVAL '1 hour');
    RETURN QUERY SELECT 'materialize_power'::TEXT, 'success'::TEXT, 
        jsonb_build_object('records_created', v_result.records_created);
    
    -- 2. Hourly aggregation (general telemetry)
    SELECT * INTO v_result FROM aggregate_telemetry_hourly(date_trunc('hour', now() - INTERVAL '1 hour'));
    RETURN QUERY SELECT 'hourly_aggregation'::TEXT, 'success'::TEXT,
        jsonb_build_object('processed', v_result.rows_processed, 'inserted', v_result.rows_inserted);
    
    -- 3. Mark stale devices offline
    PERFORM mark_stale_devices_offline(30);
    RETURN QUERY SELECT 'mark_stale_offline'::TEXT, 'success'::TEXT, '{}'::JSONB;

    -- 4. NEW: Sync telemetry to energy tables
    SELECT * INTO v_result FROM sync_telemetry_to_energy(now() - INTERVAL '2 hours');
    RETURN QUERY SELECT 'sync_telemetry_to_energy'::TEXT, 'success'::TEXT,
        jsonb_build_object('synced', v_result.rows_synced);

    -- 5. NEW: Hourly energy aggregation
    SELECT * INTO v_result FROM aggregate_energy_hourly(date_trunc('hour', now() - INTERVAL '1 hour'));
    RETURN QUERY SELECT 'energy_hourly_aggregation'::TEXT, 'success'::TEXT,
        jsonb_build_object('processed', v_result.rows_processed, 'inserted', v_result.rows_inserted);
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'error'::TEXT, SQLERRM, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATE DAILY JOBS: Include energy daily aggregation
-- ============================================================
CREATE OR REPLACE FUNCTION run_daily_jobs()
RETURNS TABLE (
    job_name TEXT,
    status TEXT,
    details JSONB
) AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- 1. Daily aggregation (general telemetry)
    SELECT * INTO v_result FROM aggregate_telemetry_daily(CURRENT_DATE - 1);
    RETURN QUERY SELECT 'daily_aggregation'::TEXT, 'success'::TEXT,
        jsonb_build_object('processed', v_result.rows_processed, 'inserted', v_result.rows_inserted);
    
    -- 2. Purge old data
    SELECT * INTO v_result FROM purge_old_telemetry(90, 365, 7);
    RETURN QUERY SELECT 'purge_old_data'::TEXT, 'success'::TEXT,
        jsonb_build_object('raw_deleted', v_result.raw_deleted, 'hourly_deleted', v_result.hourly_deleted, 
                          'mqtt_deleted', v_result.mqtt_raw_deleted);

    -- 3. NEW: Daily energy aggregation
    SELECT * INTO v_result FROM aggregate_energy_daily(CURRENT_DATE - 1);
    RETURN QUERY SELECT 'energy_daily_aggregation'::TEXT, 'success'::TEXT,
        jsonb_build_object('processed', v_result.rows_processed, 'inserted', v_result.rows_inserted);
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'error'::TEXT, SQLERRM, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_telemetry_to_energy TO service_role;

COMMENT ON FUNCTION sync_telemetry_to_energy IS 'Sync energy.* metrics from telemetry to energy_telemetry with category-based metric mapping';

-- ============================================================
-- BACKFILL: Sync last 7 days of data
-- ============================================================
DO $$
DECLARE
    v_result RECORD;
    v_total_synced BIGINT := 0;
BEGIN
    RAISE NOTICE 'Starting backfill sync for last 7 days...';
    
    -- Sync all energy data from last 7 days
    SELECT * INTO v_result FROM sync_telemetry_to_energy(now() - INTERVAL '7 days');
    v_total_synced := v_result.rows_synced;
    
    RAISE NOTICE 'Backfill complete: % rows synced to energy_telemetry', v_total_synced;
END $$;