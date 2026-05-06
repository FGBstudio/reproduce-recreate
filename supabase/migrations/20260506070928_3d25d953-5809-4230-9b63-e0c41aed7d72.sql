-- Get list of devices for a site
CREATE OR REPLACE FUNCTION public._tz_fix_list_devices(p_site_id UUID)
RETURNS TABLE(device_id UUID)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.devices WHERE site_id = p_site_id ORDER BY id;
$$;

-- Apply TZ fix to a single device
CREATE OR REPLACE FUNCTION public._apply_tz_fix_device(p_device_id UUID, p_tz TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  -- Stage shifted+deduped raw for this device
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

  -- Rebuild hourly for this device
  DELETE FROM public.energy_hourly WHERE device_id = p_device_id;
  INSERT INTO public.energy_hourly
    (ts_hour, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
  SELECT date_trunc('hour', ts), device_id, metric,
         AVG(value), SUM(value), MIN(value), MAX(value), COUNT(*),
         (array_agg(site_id))[1]
  FROM public.energy_telemetry
  WHERE device_id = p_device_id
  GROUP BY 1,2,3;

  -- Rebuild daily for this device
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

  -- Rebuild latest for this device
  DELETE FROM public.energy_latest WHERE device_id = p_device_id;
  INSERT INTO public.energy_latest (device_id, metric, value, unit, ts, quality, site_id)
  SELECT DISTINCT ON (device_id, metric)
    device_id, metric, value, unit, ts, quality, site_id
  FROM public.energy_telemetry
  WHERE device_id = p_device_id
  ORDER BY device_id, metric, ts DESC;

  RETURN v_count;
END $$;

-- Mark site as completed
CREATE OR REPLACE FUNCTION public._tz_fix_mark_done(p_site_id UUID, p_rows BIGINT)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.tz_fix_log (site_id, fix_version, rows_raw, rows_hourly)
  VALUES (p_site_id, 'v1', p_rows, 0)
  ON CONFLICT (site_id, fix_version) DO NOTHING;
$$;
