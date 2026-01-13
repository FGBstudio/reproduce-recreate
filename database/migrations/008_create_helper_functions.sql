-- Migration: Create helper functions for telemetry queries
-- Version: 008
-- Description: Optimized functions for dashboard queries

-- Function to get time bucket based on range
CREATE OR REPLACE FUNCTION get_time_bucket(
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
) RETURNS TEXT AS $$
DECLARE
    v_diff INTERVAL;
BEGIN
    v_diff := p_end - p_start;
    
    IF v_diff <= INTERVAL '1 day' THEN
        RETURN '1 hour';
    ELSIF v_diff <= INTERVAL '7 days' THEN
        RETURN '1 hour';
    ELSIF v_diff <= INTERVAL '31 days' THEN
        RETURN '1 day';
    ELSIF v_diff <= INTERVAL '365 days' THEN
        RETURN '1 week';
    ELSE
        RETURN '1 month';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to aggregate telemetry by time bucket
CREATE OR REPLACE FUNCTION get_telemetry_timeseries(
    p_device_ids UUID[],
    p_metrics TEXT[],
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ,
    p_bucket TEXT DEFAULT NULL
) RETURNS TABLE (
    ts_bucket TIMESTAMPTZ,
    device_id UUID,
    metric TEXT,
    value_avg NUMERIC,
    value_min NUMERIC,
    value_max NUMERIC,
    sample_count BIGINT
) AS $$
DECLARE
    v_bucket TEXT;
    v_diff INTERVAL;
BEGIN
    -- Auto-determine bucket if not specified
    IF p_bucket IS NULL THEN
        v_bucket := get_time_bucket(p_start, p_end);
    ELSE
        v_bucket := p_bucket;
    END IF;
    
    v_diff := p_end - p_start;
    
    -- Use appropriate source table based on time range
    IF v_diff <= INTERVAL '7 days' THEN
        -- Use raw telemetry for short ranges
        RETURN QUERY
        SELECT 
            date_trunc(CASE 
                WHEN v_bucket = '1 hour' THEN 'hour'
                WHEN v_bucket = '1 day' THEN 'day'
                ELSE 'hour'
            END, t.ts) AS ts_bucket,
            t.device_id,
            t.metric,
            AVG(t.value)::NUMERIC AS value_avg,
            MIN(t.value)::NUMERIC AS value_min,
            MAX(t.value)::NUMERIC AS value_max,
            COUNT(*)::BIGINT AS sample_count
        FROM telemetry t
        WHERE t.device_id = ANY(p_device_ids)
          AND t.metric = ANY(p_metrics)
          AND t.ts BETWEEN p_start AND p_end
        GROUP BY 1, 2, 3
        ORDER BY 1;
        
    ELSIF v_diff <= INTERVAL '90 days' THEN
        -- Use hourly aggregates for medium ranges
        RETURN QUERY
        SELECT 
            date_trunc(CASE 
                WHEN v_bucket = '1 day' THEN 'day'
                WHEN v_bucket = '1 week' THEN 'week'
                ELSE 'day'
            END, th.ts_hour) AS ts_bucket,
            th.device_id,
            th.metric,
            AVG(th.value_avg)::NUMERIC AS value_avg,
            MIN(th.value_min)::NUMERIC AS value_min,
            MAX(th.value_max)::NUMERIC AS value_max,
            SUM(th.sample_count)::BIGINT AS sample_count
        FROM telemetry_hourly th
        WHERE th.device_id = ANY(p_device_ids)
          AND th.metric = ANY(p_metrics)
          AND th.ts_hour BETWEEN p_start AND p_end
        GROUP BY 1, 2, 3
        ORDER BY 1;
        
    ELSE
        -- Use daily aggregates for long ranges
        RETURN QUERY
        SELECT 
            date_trunc(CASE 
                WHEN v_bucket = '1 week' THEN 'week'
                WHEN v_bucket = '1 month' THEN 'month'
                ELSE 'month'
            END, td.ts_day::TIMESTAMPTZ) AS ts_bucket,
            td.device_id,
            td.metric,
            AVG(td.value_avg)::NUMERIC AS value_avg,
            MIN(td.value_min)::NUMERIC AS value_min,
            MAX(td.value_max)::NUMERIC AS value_max,
            SUM(td.sample_count)::BIGINT AS sample_count
        FROM telemetry_daily td
        WHERE td.device_id = ANY(p_device_ids)
          AND td.metric = ANY(p_metrics)
          AND td.ts_day BETWEEN p_start::DATE AND p_end::DATE
        GROUP BY 1, 2, 3
        ORDER BY 1;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get site energy summary
CREATE OR REPLACE FUNCTION get_site_energy_summary(
    p_site_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
) RETURNS TABLE (
    total_kwh NUMERIC,
    hvac_kwh NUMERIC,
    lighting_kwh NUMERIC,
    plugs_kwh NUMERIC,
    avg_power_kw NUMERIC,
    peak_power_kw NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH device_ids AS (
        SELECT d.id FROM devices d WHERE d.site_id = p_site_id AND d.device_type = 'energy_monitor'
    ),
    energy_data AS (
        SELECT 
            t.metric,
            SUM(t.value) AS total_value,
            AVG(t.value) AS avg_value,
            MAX(t.value) AS max_value
        FROM telemetry t
        WHERE t.device_id IN (SELECT id FROM device_ids)
          AND t.ts BETWEEN p_start AND p_end
          AND t.metric IN ('energy_kwh', 'hvac_kwh', 'lighting_kwh', 'plugs_kwh', 'power_kw')
        GROUP BY t.metric
    )
    SELECT 
        COALESCE((SELECT total_value FROM energy_data WHERE metric = 'energy_kwh'), 0)::NUMERIC,
        COALESCE((SELECT total_value FROM energy_data WHERE metric = 'hvac_kwh'), 0)::NUMERIC,
        COALESCE((SELECT total_value FROM energy_data WHERE metric = 'lighting_kwh'), 0)::NUMERIC,
        COALESCE((SELECT total_value FROM energy_data WHERE metric = 'plugs_kwh'), 0)::NUMERIC,
        COALESCE((SELECT avg_value FROM energy_data WHERE metric = 'power_kw'), 0)::NUMERIC,
        COALESCE((SELECT max_value FROM energy_data WHERE metric = 'power_kw'), 0)::NUMERIC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_time_bucket TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_telemetry_timeseries TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_site_energy_summary TO anon, authenticated;

COMMENT ON FUNCTION get_telemetry_timeseries IS 'Get time-bucketed telemetry with auto-aggregation based on range';
COMMENT ON FUNCTION get_site_energy_summary IS 'Get energy consumption summary for a site';
