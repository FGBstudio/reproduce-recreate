-- Migration: Create downsampling and retention functions
-- Version: 015
-- Description: Scheduled aggregation (raw→1h→1d) and data retention

-- ============================================================
-- HOURLY AGGREGATION
-- ============================================================
CREATE OR REPLACE FUNCTION aggregate_telemetry_hourly(
    p_hour TIMESTAMPTZ DEFAULT date_trunc('hour', now() - INTERVAL '1 hour')
)
RETURNS TABLE (
    rows_processed BIGINT,
    rows_inserted BIGINT,
    metrics_aggregated BIGINT
) AS $$
DECLARE
    v_processed BIGINT := 0;
    v_inserted BIGINT := 0;
    v_metrics BIGINT := 0;
BEGIN
    -- Count rows to process
    SELECT COUNT(*) INTO v_processed
    FROM telemetry
    WHERE ts >= p_hour AND ts < p_hour + INTERVAL '1 hour';
    
    -- Aggregate and upsert
    WITH aggregated AS (
        SELECT 
            device_id,
            site_id,
            p_hour as ts_hour,
            metric,
            AVG(value) as value_avg,
            MIN(value) as value_min,
            MAX(value) as value_max,
            SUM(value) as value_sum,
            COUNT(*)::INTEGER as sample_count,
            MAX(unit) as unit,
            jsonb_build_object(
                'source_rows', COUNT(*),
                'aggregated_at', now()
            ) as labels
        FROM telemetry
        WHERE ts >= p_hour 
          AND ts < p_hour + INTERVAL '1 hour'
          AND value IS NOT NULL
        GROUP BY device_id, site_id, metric
    ),
    upserted AS (
        INSERT INTO telemetry_hourly (device_id, site_id, ts_hour, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
        SELECT * FROM aggregated
        ON CONFLICT (device_id, ts_hour, metric) 
        DO UPDATE SET
            value_avg = EXCLUDED.value_avg,
            value_min = EXCLUDED.value_min,
            value_max = EXCLUDED.value_max,
            value_sum = EXCLUDED.value_sum,
            sample_count = EXCLUDED.sample_count,
            site_id = COALESCE(EXCLUDED.site_id, telemetry_hourly.site_id),
            labels = EXCLUDED.labels
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM upserted;
    
    -- Count distinct metrics
    SELECT COUNT(DISTINCT metric) INTO v_metrics
    FROM telemetry
    WHERE ts >= p_hour AND ts < p_hour + INTERVAL '1 hour';
    
    RETURN QUERY SELECT v_processed, v_inserted, v_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DAILY AGGREGATION (from hourly)
-- ============================================================
CREATE OR REPLACE FUNCTION aggregate_telemetry_daily(
    p_date DATE DEFAULT (CURRENT_DATE - 1)
)
RETURNS TABLE (
    rows_processed BIGINT,
    rows_inserted BIGINT,
    metrics_aggregated BIGINT
) AS $$
DECLARE
    v_processed BIGINT := 0;
    v_inserted BIGINT := 0;
    v_metrics BIGINT := 0;
BEGIN
    -- Count hourly rows to process
    SELECT COUNT(*) INTO v_processed
    FROM telemetry_hourly
    WHERE ts_hour >= p_date::TIMESTAMPTZ 
      AND ts_hour < (p_date + 1)::TIMESTAMPTZ;
    
    -- Aggregate hourly to daily and upsert
    WITH aggregated AS (
        SELECT 
            device_id,
            site_id,
            p_date as ts_day,
            metric,
            AVG(value_avg) as value_avg,  -- Average of hourly averages (weighted would be better)
            MIN(value_min) as value_min,
            MAX(value_max) as value_max,
            SUM(value_sum) as value_sum,
            SUM(sample_count)::INTEGER as sample_count,
            MAX(unit) as unit,
            jsonb_build_object(
                'hourly_rows', COUNT(*),
                'aggregated_at', now()
            ) as labels
        FROM telemetry_hourly
        WHERE ts_hour >= p_date::TIMESTAMPTZ 
          AND ts_hour < (p_date + 1)::TIMESTAMPTZ
        GROUP BY device_id, site_id, metric
    ),
    upserted AS (
        INSERT INTO telemetry_daily (device_id, site_id, ts_day, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
        SELECT * FROM aggregated
        ON CONFLICT (device_id, ts_day, metric) 
        DO UPDATE SET
            value_avg = EXCLUDED.value_avg,
            value_min = EXCLUDED.value_min,
            value_max = EXCLUDED.value_max,
            value_sum = EXCLUDED.value_sum,
            sample_count = EXCLUDED.sample_count,
            site_id = COALESCE(EXCLUDED.site_id, telemetry_daily.site_id),
            labels = EXCLUDED.labels
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM upserted;
    
    -- Count distinct metrics
    SELECT COUNT(DISTINCT metric) INTO v_metrics
    FROM telemetry_hourly
    WHERE ts_hour >= p_date::TIMESTAMPTZ 
      AND ts_hour < (p_date + 1)::TIMESTAMPTZ;
    
    RETURN QUERY SELECT v_processed, v_inserted, v_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RETENTION / PURGE
-- ============================================================
CREATE OR REPLACE FUNCTION purge_old_telemetry(
    p_raw_retention_days INTEGER DEFAULT 90,
    p_hourly_retention_days INTEGER DEFAULT 365,
    p_mqtt_raw_retention_days INTEGER DEFAULT 7
)
RETURNS TABLE (
    raw_deleted BIGINT,
    hourly_deleted BIGINT,
    mqtt_raw_deleted BIGINT
) AS $$
DECLARE
    v_raw_deleted BIGINT := 0;
    v_hourly_deleted BIGINT := 0;
    v_mqtt_deleted BIGINT := 0;
BEGIN
    -- Delete old raw telemetry
    WITH deleted AS (
        DELETE FROM telemetry
        WHERE ts < now() - (p_raw_retention_days || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_raw_deleted FROM deleted;
    
    -- Delete old hourly telemetry
    WITH deleted AS (
        DELETE FROM telemetry_hourly
        WHERE ts_hour < now() - (p_hourly_retention_days || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_hourly_deleted FROM deleted;
    
    -- Delete old MQTT raw messages
    WITH deleted AS (
        DELETE FROM mqtt_messages_raw
        WHERE received_at < now() - (p_mqtt_raw_retention_days || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_mqtt_deleted FROM deleted;
    
    RETURN QUERY SELECT v_raw_deleted, v_hourly_deleted, v_mqtt_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMPUTE POWER METRICS (materialize energy.power_kw from I/V)
-- ============================================================
CREATE OR REPLACE FUNCTION materialize_power_metrics(
    p_since TIMESTAMPTZ DEFAULT now() - INTERVAL '1 hour'
)
RETURNS TABLE (
    records_created BIGINT
) AS $$
DECLARE
    v_created BIGINT := 0;
BEGIN
    -- Find timestamps where we have I/V but no power_kw
    WITH power_calcs AS (
        SELECT 
            t.device_id,
            t.site_id,
            date_trunc('minute', t.ts) as ts_bucket,
            MAX(CASE WHEN t.metric = 'energy.current_l1' THEN t.value END) as i1,
            MAX(CASE WHEN t.metric = 'energy.current_l2' THEN t.value END) as i2,
            MAX(CASE WHEN t.metric = 'energy.current_l3' THEN t.value END) as i3,
            MAX(CASE WHEN t.metric = 'energy.voltage_l1' THEN t.value END) as v1,
            MAX(CASE WHEN t.metric = 'energy.voltage_l2' THEN t.value END) as v2,
            MAX(CASE WHEN t.metric = 'energy.voltage_l3' THEN t.value END) as v3,
            MAX(CASE WHEN t.metric = 'energy.current_a' THEN t.value END) as current_a
        FROM telemetry t
        WHERE t.ts >= p_since
          AND t.metric IN (
              'energy.current_l1', 'energy.current_l2', 'energy.current_l3',
              'energy.voltage_l1', 'energy.voltage_l2', 'energy.voltage_l3',
              'energy.current_a'
          )
        GROUP BY t.device_id, t.site_id, date_trunc('minute', t.ts)
    ),
    with_power AS (
        SELECT 
            pc.device_id,
            pc.site_id,
            pc.ts_bucket,
            CASE 
                WHEN pc.i1 IS NOT NULL OR pc.i2 IS NOT NULL OR pc.i3 IS NOT NULL THEN
                    (SELECT cpw.power_w FROM compute_power_w(
                        pc.i1, pc.i2, pc.i3,
                        pc.v1, pc.v2, pc.v3,
                        NULL, NULL, NULL,
                        COALESCE(cfg.wiring_type, 'WYE'),
                        COALESCE(cfg.pf_default, 0.95),
                        COALESCE(cfg.vln_default, 230.0),
                        COALESCE(cfg.vll_default, 400.0)
                    ) cpw)
                WHEN pc.current_a IS NOT NULL THEN
                    (SELECT cps.power_w FROM compute_power_w_single(
                        pc.current_a,
                        NULL, NULL,
                        COALESCE(cfg.vln_default, 230.0),
                        COALESCE(cfg.pf_default, 0.95)
                    ) cps)
            END as power_w,
            CASE 
                WHEN pc.i1 IS NOT NULL OR pc.i2 IS NOT NULL OR pc.i3 IS NOT NULL THEN 'three_phase'
                ELSE 'single_phase'
            END as phase_type
        FROM power_calcs pc
        LEFT JOIN panel_config cfg ON (
            cfg.device_id = pc.device_id OR 
            (cfg.device_id IS NULL AND cfg.site_id = pc.site_id)
        )
    ),
    inserted AS (
        INSERT INTO telemetry (device_id, site_id, ts, metric, value, unit, quality, labels)
        SELECT 
            device_id,
            site_id,
            ts_bucket,
            'energy.power_kw',
            power_w / 1000.0,  -- Convert W to kW
            'kW',
            'computed',
            jsonb_build_object('phase_type', phase_type, 'computed', true)
        FROM with_power
        WHERE power_w IS NOT NULL
        ON CONFLICT DO NOTHING  -- Avoid duplicates
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_created FROM inserted;
    
    RETURN QUERY SELECT v_created;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SCHEDULED JOB WRAPPER (call from cron/edge function)
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
    
    -- 2. Hourly aggregation (previous hour)
    SELECT * INTO v_result FROM aggregate_telemetry_hourly(date_trunc('hour', now() - INTERVAL '1 hour'));
    RETURN QUERY SELECT 'hourly_aggregation'::TEXT, 'success'::TEXT,
        jsonb_build_object('processed', v_result.rows_processed, 'inserted', v_result.rows_inserted);
    
    -- 3. Mark stale devices offline
    PERFORM mark_stale_devices_offline(30);
    RETURN QUERY SELECT 'mark_stale_offline'::TEXT, 'success'::TEXT, '{}'::JSONB;
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'error'::TEXT, SQLERRM, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Daily job wrapper
CREATE OR REPLACE FUNCTION run_daily_jobs()
RETURNS TABLE (
    job_name TEXT,
    status TEXT,
    details JSONB
) AS $$
DECLARE
    v_result RECORD;
BEGIN
    -- 1. Daily aggregation (yesterday)
    SELECT * INTO v_result FROM aggregate_telemetry_daily(CURRENT_DATE - 1);
    RETURN QUERY SELECT 'daily_aggregation'::TEXT, 'success'::TEXT,
        jsonb_build_object('processed', v_result.rows_processed, 'inserted', v_result.rows_inserted);
    
    -- 2. Purge old data
    SELECT * INTO v_result FROM purge_old_telemetry(90, 365, 7);
    RETURN QUERY SELECT 'purge_old_data'::TEXT, 'success'::TEXT,
        jsonb_build_object('raw_deleted', v_result.raw_deleted, 'hourly_deleted', v_result.hourly_deleted, 
                          'mqtt_deleted', v_result.mqtt_raw_deleted);
    
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'error'::TEXT, SQLERRM, '{}'::JSONB;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION aggregate_telemetry_hourly TO service_role;
GRANT EXECUTE ON FUNCTION aggregate_telemetry_daily TO service_role;
GRANT EXECUTE ON FUNCTION purge_old_telemetry TO service_role;
GRANT EXECUTE ON FUNCTION materialize_power_metrics TO service_role;
GRANT EXECUTE ON FUNCTION run_scheduled_jobs TO service_role;
GRANT EXECUTE ON FUNCTION run_daily_jobs TO service_role;

COMMENT ON FUNCTION aggregate_telemetry_hourly IS 'Aggregate raw telemetry to hourly buckets';
COMMENT ON FUNCTION aggregate_telemetry_daily IS 'Aggregate hourly telemetry to daily buckets';
COMMENT ON FUNCTION purge_old_telemetry IS 'Delete old telemetry data based on retention policy';
COMMENT ON FUNCTION materialize_power_metrics IS 'Compute power_kw from I/V measurements and insert into telemetry';
COMMENT ON FUNCTION run_scheduled_jobs IS 'Hourly scheduled job runner';
COMMENT ON FUNCTION run_daily_jobs IS 'Daily scheduled job runner';
