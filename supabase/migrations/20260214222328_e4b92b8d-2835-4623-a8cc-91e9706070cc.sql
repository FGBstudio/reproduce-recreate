
-- Trigger function: auto-aggregate into energy_hourly on every energy_telemetry INSERT
CREATE OR REPLACE FUNCTION auto_aggregate_energy_hourly()
RETURNS TRIGGER AS $$
DECLARE
  v_hour TIMESTAMPTZ := date_trunc('hour', NEW.ts);
BEGIN
  INSERT INTO energy_hourly (device_id, site_id, ts_hour, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
  VALUES (
    NEW.device_id,
    NEW.site_id,
    v_hour,
    NEW.metric,
    NEW.value,
    NEW.value,
    NEW.value,
    NEW.value,
    1,
    NEW.unit,
    jsonb_build_object('auto_agg', true)
  )
  ON CONFLICT (device_id, ts_hour, metric)
  DO UPDATE SET
    value_avg = (
      (energy_hourly.value_avg * energy_hourly.sample_count + EXCLUDED.value_avg) 
      / (energy_hourly.sample_count + 1)
    ),
    value_min = LEAST(energy_hourly.value_min, EXCLUDED.value_min),
    value_max = GREATEST(energy_hourly.value_max, EXCLUDED.value_max),
    value_sum = energy_hourly.value_sum + EXCLUDED.value_sum,
    sample_count = energy_hourly.sample_count + 1,
    site_id = COALESCE(EXCLUDED.site_id, energy_hourly.site_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger (runs AFTER the existing update_energy_latest trigger)
DROP TRIGGER IF EXISTS trigger_auto_agg_energy_hourly ON energy_telemetry;
CREATE TRIGGER trigger_auto_agg_energy_hourly
  AFTER INSERT ON energy_telemetry
  FOR EACH ROW EXECUTE FUNCTION auto_aggregate_energy_hourly();

-- Same pattern for energy_daily: auto-aggregate on energy_hourly INSERT
CREATE OR REPLACE FUNCTION auto_aggregate_energy_daily()
RETURNS TRIGGER AS $$
DECLARE
  v_day DATE := NEW.ts_hour::DATE;
BEGIN
  INSERT INTO energy_daily (device_id, site_id, ts_day, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
  VALUES (
    NEW.device_id,
    NEW.site_id,
    v_day,
    NEW.metric,
    NEW.value_avg,
    NEW.value_min,
    NEW.value_max,
    NEW.value_sum,
    NEW.sample_count,
    NEW.unit,
    jsonb_build_object('auto_agg', true)
  )
  ON CONFLICT (device_id, ts_day, metric)
  DO UPDATE SET
    value_avg = (
      (energy_daily.value_avg * energy_daily.sample_count + EXCLUDED.value_avg * EXCLUDED.sample_count)
      / NULLIF(energy_daily.sample_count + EXCLUDED.sample_count, 0)
    ),
    value_min = LEAST(energy_daily.value_min, EXCLUDED.value_min),
    value_max = GREATEST(energy_daily.value_max, EXCLUDED.value_max),
    value_sum = energy_daily.value_sum + EXCLUDED.value_sum,
    sample_count = energy_daily.sample_count + EXCLUDED.sample_count,
    site_id = COALESCE(EXCLUDED.site_id, energy_daily.site_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_agg_energy_daily ON energy_hourly;
CREATE TRIGGER trigger_auto_agg_energy_daily
  AFTER INSERT OR UPDATE ON energy_hourly
  FOR EACH ROW EXECUTE FUNCTION auto_aggregate_energy_daily();

COMMENT ON FUNCTION auto_aggregate_energy_hourly IS 'Auto-upsert energy_hourly on every energy_telemetry insert - no manual cron needed';
COMMENT ON FUNCTION auto_aggregate_energy_daily IS 'Auto-upsert energy_daily on every energy_hourly insert/update - cascading aggregation';
