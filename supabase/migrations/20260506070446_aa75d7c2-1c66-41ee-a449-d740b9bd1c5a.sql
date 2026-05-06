CREATE OR REPLACE FUNCTION public._apply_tz_fix(p_site_id UUID, p_tz TEXT)
RETURNS TABLE(rows_raw BIGINT, rows_hourly BIGINT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_raw BIGINT := 0;
  v_hourly BIGINT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tz_fix_log WHERE site_id = p_site_id AND fix_version = 'v1') THEN
    RAISE NOTICE 'TZ fix already applied for site %, skipping', p_site_id;
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  -- Build shifted+deduped raw into a temp table
  CREATE TEMP TABLE IF NOT EXISTS _tz_tmp_raw (
    device_id UUID, metric TEXT, ts TIMESTAMPTZ, value NUMERIC,
    unit TEXT, quality TEXT, site_id UUID, labels JSONB
  ) ON COMMIT DROP;
  TRUNCATE _tz_tmp_raw;

  INSERT INTO _tz_tmp_raw
  SELECT device_id, metric, ts_fixed AS ts,
         AVG(value) AS value,
         (array_agg(unit))[1] AS unit,
         MIN(quality) AS quality,
         (array_agg(site_id))[1] AS site_id,
         jsonb_build_object('tz_fix_v1', true) AS labels
  FROM (
    SELECT et.device_id, et.metric,
           ((et.ts AT TIME ZONE 'UTC')::timestamp AT TIME ZONE p_tz) AS ts_fixed,
           et.value, et.unit, et.quality, et.site_id
    FROM public.energy_telemetry et
    JOIN public.devices d ON d.id = et.device_id
    WHERE d.site_id = p_site_id
  ) s
  GROUP BY device_id, metric, ts_fixed;

  -- Replace raw
  DELETE FROM public.energy_telemetry et
  USING public.devices d
  WHERE d.id = et.device_id AND d.site_id = p_site_id;

  WITH ins AS (
    INSERT INTO public.energy_telemetry (device_id, metric, ts, value, unit, quality, site_id, labels)
    SELECT device_id, metric, ts, value, unit, quality, site_id, labels FROM _tz_tmp_raw
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_raw FROM ins;

  -- Rebuild hourly
  DELETE FROM public.energy_hourly eh
  USING public.devices d
  WHERE d.id = eh.device_id AND d.site_id = p_site_id;

  WITH ins AS (
    INSERT INTO public.energy_hourly
      (ts_hour, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
    SELECT date_trunc('hour', et.ts), et.device_id, et.metric,
           AVG(et.value), SUM(et.value), MIN(et.value), MAX(et.value), COUNT(*),
           (array_agg(d.site_id))[1]
    FROM public.energy_telemetry et
    JOIN public.devices d ON d.id = et.device_id
    WHERE d.site_id = p_site_id
    GROUP BY 1,2,3
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_hourly FROM ins;

  -- Rebuild daily
  DELETE FROM public.energy_daily ed
  USING public.devices d
  WHERE d.id = ed.device_id AND d.site_id = p_site_id;

  INSERT INTO public.energy_daily
    (ts_day, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
  SELECT date_trunc('day', eh.ts_hour)::date, eh.device_id, eh.metric,
         AVG(eh.value_avg),
         SUM(COALESCE(eh.value_sum, eh.value_avg)),
         MIN(eh.value_min), MAX(eh.value_max),
         SUM(COALESCE(eh.sample_count,1)),
         (array_agg(d.site_id))[1]
  FROM public.energy_hourly eh
  JOIN public.devices d ON d.id = eh.device_id
  WHERE d.site_id = p_site_id
  GROUP BY 1,2,3;

  -- Rebuild latest
  DELETE FROM public.energy_latest el
  USING public.devices d
  WHERE d.id = el.device_id AND d.site_id = p_site_id;

  INSERT INTO public.energy_latest (device_id, metric, value, unit, ts, quality, site_id)
  SELECT DISTINCT ON (et.device_id, et.metric)
    et.device_id, et.metric, et.value, et.unit, et.ts, et.quality, d.site_id
  FROM public.energy_telemetry et
  JOIN public.devices d ON d.id = et.device_id
  WHERE d.site_id = p_site_id
  ORDER BY et.device_id, et.metric, et.ts DESC;

  INSERT INTO public.tz_fix_log (site_id, fix_version, rows_raw, rows_hourly)
  VALUES (p_site_id, 'v1', v_raw, v_hourly);

  RETURN QUERY SELECT v_raw, v_hourly;
END $$;
