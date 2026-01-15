-- Migration: Aggregation Triggers and Functions
-- Version: 009
-- Description: Auto-update latest values and aggregation helpers

-- ============================================================
-- UPDATE LATEST VALUES ON INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION update_telemetry_latest()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO telemetry_latest (device_id, metric, ts, value, unit, quality)
    VALUES (NEW.device_id, NEW.metric, NEW.ts, NEW.value, NEW.unit, NEW.quality)
    ON CONFLICT (device_id, metric)
    DO UPDATE SET
        ts = EXCLUDED.ts,
        value = EXCLUDED.value,
        unit = EXCLUDED.unit,
        quality = EXCLUDED.quality
    WHERE telemetry_latest.ts < EXCLUDED.ts;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_latest ON telemetry;
CREATE TRIGGER trg_update_latest
    AFTER INSERT ON telemetry
    FOR EACH ROW
    EXECUTE FUNCTION update_telemetry_latest();

-- ============================================================
-- UPDATE DEVICE LAST_SEEN ON TELEMETRY
-- ============================================================
CREATE OR REPLACE FUNCTION update_device_last_seen()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE devices
    SET 
        last_seen = NEW.ts,
        status = 'online'
    WHERE id = NEW.device_id
      AND (last_seen IS NULL OR last_seen < NEW.ts);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_device_seen ON telemetry;
CREATE TRIGGER trg_update_device_seen
    AFTER INSERT ON telemetry
    FOR EACH ROW
    EXECUTE FUNCTION update_device_last_seen();

-- ============================================================
-- HOURLY AGGREGATION FUNCTION (call via cron)
-- ============================================================
CREATE OR REPLACE FUNCTION aggregate_hourly(
    p_hour TIMESTAMPTZ DEFAULT date_trunc('hour', now() - INTERVAL '1 hour')
) RETURNS INTEGER AS $$
DECLARE
    rows_inserted INTEGER;
BEGIN
    INSERT INTO telemetry_hourly (device_id, ts_hour, metric, value_avg, value_min, value_max, value_sum, sample_count, unit)
    SELECT
        device_id,
        date_trunc('hour', ts) AS ts_hour,
        metric,
        AVG(value)::NUMERIC AS value_avg,
        MIN(value)::NUMERIC AS value_min,
        MAX(value)::NUMERIC AS value_max,
        SUM(value)::NUMERIC AS value_sum,
        COUNT(*)::INTEGER AS sample_count,
        MAX(unit) AS unit
    FROM telemetry
    WHERE ts >= p_hour
      AND ts < p_hour + INTERVAL '1 hour'
      AND quality IS DISTINCT FROM 'bad'
    GROUP BY date_trunc('hour', ts), device_id, metric
    ON CONFLICT (device_id, ts_hour, metric)
    DO UPDATE SET
        value_avg = EXCLUDED.value_avg,
        value_min = EXCLUDED.value_min,
        value_max = EXCLUDED.value_max,
        value_sum = EXCLUDED.value_sum,
        sample_count = EXCLUDED.sample_count;
    
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- DAILY AGGREGATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION aggregate_daily(
    p_date DATE DEFAULT CURRENT_DATE - 1
) RETURNS INTEGER AS $$
DECLARE
    rows_inserted INTEGER;
BEGIN
    INSERT INTO telemetry_daily (device_id, ts_day, metric, value_avg, value_min, value_max, value_sum, sample_count, unit)
    SELECT
        device_id,
        ts_hour::DATE AS ts_day,
        metric,
        AVG(value_avg)::NUMERIC AS value_avg,
        MIN(value_min)::NUMERIC AS value_min,
        MAX(value_max)::NUMERIC AS value_max,
        SUM(value_sum)::NUMERIC AS value_sum,
        SUM(sample_count)::INTEGER AS sample_count,
        MAX(unit) AS unit
    FROM telemetry_hourly
    WHERE ts_hour >= p_date::TIMESTAMPTZ
      AND ts_hour < (p_date + 1)::TIMESTAMPTZ
    GROUP BY ts_hour::DATE, device_id, metric
    ON CONFLICT (device_id, ts_day, metric)
    DO UPDATE SET
        value_avg = EXCLUDED.value_avg,
        value_min = EXCLUDED.value_min,
        value_max = EXCLUDED.value_max,
        value_sum = EXCLUDED.value_sum,
        sample_count = EXCLUDED.sample_count;
    
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MARK STALE DEVICES AS OFFLINE
-- ============================================================
CREATE OR REPLACE FUNCTION mark_stale_devices_offline(
    p_threshold_minutes INTEGER DEFAULT 15
) RETURNS INTEGER AS $$
DECLARE
    rows_updated INTEGER;
BEGIN
    UPDATE devices
    SET status = 'offline'
    WHERE status = 'online'
      AND last_seen < now() - (p_threshold_minutes || ' minutes')::INTERVAL;
    
    GET DIAGNOSTICS rows_updated = ROW_COUNT;
    RETURN rows_updated;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION aggregate_hourly TO authenticated;
GRANT EXECUTE ON FUNCTION aggregate_daily TO authenticated;
GRANT EXECUTE ON FUNCTION mark_stale_devices_offline TO authenticated;

COMMENT ON FUNCTION aggregate_hourly IS 'Aggregate raw telemetry into hourly buckets. Call hourly via cron.';
COMMENT ON FUNCTION aggregate_daily IS 'Aggregate hourly data into daily buckets. Call daily via cron.';
COMMENT ON FUNCTION mark_stale_devices_offline IS 'Mark devices without recent data as offline. Call every 5 min via cron.';
