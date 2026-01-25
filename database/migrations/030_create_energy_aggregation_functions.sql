-- Migration: Energy Aggregation Functions
-- Version: 030
-- Description: Aggregation functions for dedicated energy tables

-- ============================================================
-- HOURLY AGGREGATION FOR ENERGY
-- ============================================================
CREATE OR REPLACE FUNCTION aggregate_energy_hourly(
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
    FROM energy_telemetry
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
        FROM energy_telemetry
        WHERE ts >= p_hour 
          AND ts < p_hour + INTERVAL '1 hour'
          AND value IS NOT NULL
        GROUP BY device_id, site_id, metric
    ),
    upserted AS (
        INSERT INTO energy_hourly (device_id, site_id, ts_hour, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
        SELECT * FROM aggregated
        ON CONFLICT (device_id, ts_hour, metric) 
        DO UPDATE SET
            value_avg = EXCLUDED.value_avg,
            value_min = EXCLUDED.value_min,
            value_max = EXCLUDED.value_max,
            value_sum = EXCLUDED.value_sum,
            sample_count = EXCLUDED.sample_count,
            site_id = COALESCE(EXCLUDED.site_id, energy_hourly.site_id),
            labels = EXCLUDED.labels
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM upserted;
    
    -- Count distinct metrics
    SELECT COUNT(DISTINCT metric) INTO v_metrics
    FROM energy_telemetry
    WHERE ts >= p_hour AND ts < p_hour + INTERVAL '1 hour';
    
    RETURN QUERY SELECT v_processed, v_inserted, v_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DAILY AGGREGATION FOR ENERGY (from hourly)
-- ============================================================
CREATE OR REPLACE FUNCTION aggregate_energy_daily(
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
    FROM energy_hourly
    WHERE ts_hour >= p_date::TIMESTAMPTZ 
      AND ts_hour < (p_date + 1)::TIMESTAMPTZ;
    
    -- Aggregate hourly to daily and upsert
    WITH aggregated AS (
        SELECT 
            device_id,
            site_id,
            p_date as ts_day,
            metric,
            AVG(value_avg) as value_avg,
            MIN(value_min) as value_min,
            MAX(value_max) as value_max,
            SUM(value_sum) as value_sum,
            SUM(sample_count)::INTEGER as sample_count,
            MAX(unit) as unit,
            jsonb_build_object(
                'hourly_rows', COUNT(*),
                'aggregated_at', now()
            ) as labels
        FROM energy_hourly
        WHERE ts_hour >= p_date::TIMESTAMPTZ 
          AND ts_hour < (p_date + 1)::TIMESTAMPTZ
        GROUP BY device_id, site_id, metric
    ),
    upserted AS (
        INSERT INTO energy_daily (device_id, site_id, ts_day, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
        SELECT * FROM aggregated
        ON CONFLICT (device_id, ts_day, metric) 
        DO UPDATE SET
            value_avg = EXCLUDED.value_avg,
            value_min = EXCLUDED.value_min,
            value_max = EXCLUDED.value_max,
            value_sum = EXCLUDED.value_sum,
            sample_count = EXCLUDED.sample_count,
            site_id = COALESCE(EXCLUDED.site_id, energy_daily.site_id),
            labels = EXCLUDED.labels
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM upserted;
    
    -- Count distinct metrics
    SELECT COUNT(DISTINCT metric) INTO v_metrics
    FROM energy_hourly
    WHERE ts_hour >= p_date::TIMESTAMPTZ 
      AND ts_hour < (p_date + 1)::TIMESTAMPTZ;
    
    RETURN QUERY SELECT v_processed, v_inserted, v_metrics;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- UPDATE ENERGY_LATEST ON INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION update_energy_latest()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO energy_latest (device_id, site_id, metric, value, unit, ts, quality)
    VALUES (NEW.device_id, NEW.site_id, NEW.metric, NEW.value, NEW.unit, NEW.ts, NEW.quality)
    ON CONFLICT (device_id, metric) 
    DO UPDATE SET
        value = EXCLUDED.value,
        unit = EXCLUDED.unit,
        ts = EXCLUDED.ts,
        quality = EXCLUDED.quality,
        site_id = COALESCE(EXCLUDED.site_id, energy_latest.site_id)
    WHERE energy_latest.ts < EXCLUDED.ts;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating latest
DROP TRIGGER IF EXISTS trigger_update_energy_latest ON energy_telemetry;
CREATE TRIGGER trigger_update_energy_latest
    AFTER INSERT ON energy_telemetry
    FOR EACH ROW EXECUTE FUNCTION update_energy_latest();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION aggregate_energy_hourly TO service_role;
GRANT EXECUTE ON FUNCTION aggregate_energy_daily TO service_role;

COMMENT ON FUNCTION aggregate_energy_hourly IS 'Aggregate raw energy telemetry to hourly buckets';
COMMENT ON FUNCTION aggregate_energy_daily IS 'Aggregate hourly energy data to daily buckets';
