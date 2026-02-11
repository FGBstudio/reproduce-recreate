
-- Fix 3 orphaned air quality devices per projects_output-2.json

-- 2412270098 → 1914 French Mountain Outlet Center
UPDATE devices SET site_id = 'acf99500-301a-4243-a992-b0ae299b99b7'
WHERE id = '37bc120b-933f-4e6f-8195-797fc888f4b9' AND device_id = '2412270098';

-- 2501090002 → Boucheron Siam Paragon
UPDATE devices SET site_id = 'f962d9e9-c98c-4444-8c3e-8cd6605d27af'
WHERE id = '4a4c4998-8929-4039-bf41-cc787f3654d4' AND device_id = '2501090002';

-- 2508140030 → Boucheron Tokyo Ikebukuro Seibu
UPDATE devices SET site_id = 'f6aa529b-14e6-4de7-a5be-c3332975f32a'
WHERE id = 'ae26c188-7456-4c9b-843f-bc700a58f897' AND device_id = '2508140030';

-- Rename BACKFILL device for FGB Milan Office
UPDATE devices SET name = 'WEEL - 0002'
WHERE device_id = '2503040002' AND device_type = 'air_quality';

-- Delete future timestamp anomaly (2030)
DELETE FROM telemetry WHERE ts > '2027-01-01';

-- Fix aggregate_telemetry_hourly to handle site_id correctly
-- The issue: GROUP BY includes site_id but UNIQUE is (device_id, ts_hour, metric)
-- When same device has NULL and non-NULL site_id in same hour, it produces duplicate rows
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
    SELECT COUNT(*) INTO v_processed
    FROM telemetry
    WHERE ts >= p_hour AND ts < p_hour + INTERVAL '1 hour';
    
    WITH aggregated AS (
        SELECT 
            t.device_id,
            COALESCE(t.site_id, d.site_id) as site_id,
            p_hour as ts_hour,
            t.metric,
            AVG(t.value) as value_avg,
            MIN(t.value) as value_min,
            MAX(t.value) as value_max,
            SUM(t.value) as value_sum,
            COUNT(*)::INTEGER as sample_count,
            MAX(t.unit) as unit,
            jsonb_build_object(
                'source_rows', COUNT(*),
                'aggregated_at', now()
            ) as labels
        FROM telemetry t
        LEFT JOIN devices d ON d.id = t.device_id
        WHERE t.ts >= p_hour 
          AND t.ts < p_hour + INTERVAL '1 hour'
          AND t.value IS NOT NULL
        GROUP BY t.device_id, t.metric, COALESCE(t.site_id, d.site_id)
    ),
    -- Deduplicate: pick the row with non-null site_id if both exist
    deduped AS (
        SELECT DISTINCT ON (device_id, ts_hour, metric)
            device_id, site_id, ts_hour, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels
        FROM aggregated
        ORDER BY device_id, ts_hour, metric, site_id NULLS LAST
    ),
    upserted AS (
        INSERT INTO telemetry_hourly (device_id, site_id, ts_hour, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
        SELECT * FROM deduped
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
    
    SELECT COUNT(DISTINCT metric) INTO v_metrics
    FROM telemetry
    WHERE ts >= p_hour AND ts < p_hour + INTERVAL '1 hour';
    
    RETURN QUERY SELECT v_processed, v_inserted, v_metrics;
END;
$$ LANGUAGE plpgsql;
