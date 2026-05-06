CREATE OR REPLACE FUNCTION public._apply_tz_fix_device(p_device_id UUID, p_tz TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '600s'
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _tz_dev_tmp (
    device_id UUID, metric TEXT, ts TIMESTAMPTZ, value NUMERIC,
    unit TEXT, quality TEXT, site_id UUID, labels JSONB
  ) ON COMMIT DROP;
  TRUNCATE _tz_dev_tmp;

  INSERT INTO _tz_dev_tmp
  SELECT device_id, metric, ts_fixed AS ts,
         AVG(value) AS value,
         (array_agg(unit))[1] AS unit,
         MIN(quality) AS quality,
         (array_agg(site_id))[1] AS site_id,
         jsonb_build_object('tz_fix_v1', true) AS labels
  FROM (
    SELECT device_id, metric,
           ((ts AT TIME ZONE 'UTC')::timestamp AT TIME ZONE p_tz) AS ts_fixed,
           value, unit, quality, site_id
    FROM public.energy_telemetry
    WHERE device_id = p_device_id
  ) s
  GROUP BY device_id, metric, ts_fixed;

  DELETE FROM public.energy_telemetry WHERE device_id = p_device_id;

  INSERT INTO public.energy_telemetry (device_id, metric, ts, value, unit, quality, site_id, labels)
  SELECT device_id, metric, ts, value, unit, quality, site_id, labels FROM _tz_dev_tmp;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  DELETE FROM public.energy_hourly WHERE device_id = p_device_id;
  INSERT INTO public.energy_hourly
    (ts_hour, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
  SELECT date_trunc('hour', ts), device_id, metric,
         AVG(value), SUM(value), MIN(value), MAX(value), COUNT(*),
         (array_agg(site_id))[1]
  FROM public.energy_telemetry
  WHERE device_id = p_device_id
  GROUP BY 1,2,3;

  DELETE FROM public.energy_daily WHERE device_id = p_device_id;
  INSERT INTO public.energy_daily
    (ts_day, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
  SELECT date_trunc('day', ts_hour)::date, device_id, metric,
         AVG(value_avg),
         SUM(COALESCE(value_sum, value_avg)),
         MIN(value_min), MAX(value_max),
         SUM(COALESCE(sample_count,1)),
         (array_agg(site_id))[1]
  FROM public.energy_hourly
  WHERE device_id = p_device_id
  GROUP BY 1,2,3;

  DELETE FROM public.energy_latest WHERE device_id = p_device_id;
  INSERT INTO public.energy_latest (device_id, metric, value, unit, ts, quality, site_id)
  SELECT DISTINCT ON (device_id, metric)
    device_id, metric, value, unit, ts, quality, site_id
  FROM public.energy_telemetry
  WHERE device_id = p_device_id
  ORDER BY device_id, metric, ts DESC;

  RETURN v_count;
END $$;

REVOKE EXECUTE ON FUNCTION public._apply_tz_fix_device(UUID, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_tz_fix_device(UUID, TEXT) TO service_role;
