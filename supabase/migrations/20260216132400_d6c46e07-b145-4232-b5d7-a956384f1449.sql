
-- Backfill energy_hourly from energy_telemetry (full recompute with UPSERT)
INSERT INTO energy_hourly (device_id, site_id, ts_hour, metric, value_avg, value_min, value_max, value_sum, sample_count, unit, labels)
SELECT 
  device_id,
  site_id,
  date_trunc('hour', ts) as ts_hour,
  metric,
  AVG(value) as value_avg,
  MIN(value) as value_min,
  MAX(value) as value_max,
  SUM(value) as value_sum,
  COUNT(*)::integer as sample_count,
  MAX(unit) as unit,
  jsonb_build_object('backfill', true) as labels
FROM energy_telemetry
WHERE ts <= now()
GROUP BY device_id, site_id, date_trunc('hour', ts), metric
ON CONFLICT (device_id, ts_hour, metric)
DO UPDATE SET
  value_avg = EXCLUDED.value_avg,
  value_min = EXCLUDED.value_min,
  value_max = EXCLUDED.value_max,
  value_sum = EXCLUDED.value_sum,
  sample_count = EXCLUDED.sample_count,
  site_id = COALESCE(EXCLUDED.site_id, energy_hourly.site_id),
  labels = EXCLUDED.labels;
