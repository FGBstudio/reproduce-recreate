
-- Fix aggregate_telemetry_daily: same site_id dedup issue
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
    SELECT COUNT(*) INTO v_processed
    FROM telemetry_hourly
    WHERE ts_hour >= p_date::TIMESTAMPTZ 
      AND ts_hour < (p_date + 1)::TIMESTAMPTZ;
    
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
        FROM telemetry_hourly
        WHERE ts_hour >= p_date::TIMESTAMPTZ 
          AND ts_hour < (p_date + 1)::TIMESTAMPTZ
        GROUP BY device_id, site_id, metric
    ),
    deduped AS (
        SELECT DISTINCT ON (device_id, ts_day, metric)
            device_id, site_id, ts_day, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels
        FROM aggregated
        ORDER BY device_id, ts_day, metric, site_id NULLS LAST
    ),
    upserted AS (
        INSERT INTO telemetry_daily (device_id, site_id, ts_day, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
        SELECT * FROM deduped
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
    
    SELECT COUNT(DISTINCT metric) INTO v_metrics
    FROM telemetry_hourly
    WHERE ts_hour >= p_date::TIMESTAMPTZ 
      AND ts_hour < (p_date + 1)::TIMESTAMPTZ;
    
    RETURN QUERY SELECT v_processed, v_inserted, v_metrics;
END;
$$ LANGUAGE plpgsql;
