CREATE OR REPLACE FUNCTION public._apply_tz_fix(p_site_id UUID, p_tz TEXT)
RETURNS TABLE(rows_raw BIGINT, rows_hourly BIGINT)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_raw BIGINT := 0;
  v_hourly BIGINT := 0;
  v_dev RECORD;
  v_count BIGINT;
BEGIN
  -- Disable per-statement timeout for this transaction
  PERFORM set_config('statement_timeout', '0', true);

  IF EXISTS (SELECT 1 FROM public.tz_fix_log WHERE site_id = p_site_id AND fix_version = 'v1') THEN
    RAISE NOTICE 'TZ fix already applied for site %, skipping', p_site_id;
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  -- Process each device independently to keep work units small
  FOR v_dev IN
    SELECT id FROM public.devices WHERE site_id = p_site_id
  LOOP
    -- Stage shifted+deduped raw for this device
    DROP TABLE IF EXISTS _tz_dev_tmp;
    CREATE TEMP TABLE _tz_dev_tmp AS
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
      WHERE device_id = v_dev.id
    ) s
    GROUP BY device_id, metric, ts_fixed;

    DELETE FROM public.energy_telemetry WHERE device_id = v_dev.id;

    INSERT INTO public.energy_telemetry (device_id, metric, ts, value, unit, quality, site_id, labels)
    SELECT device_id, metric, ts, value, unit, quality, site_id, labels FROM _tz_dev_tmp;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_raw := v_raw + v_count;

    -- Rebuild hourly for this device
    DELETE FROM public.energy_hourly WHERE device_id = v_dev.id;

    INSERT INTO public.energy_hourly
      (ts_hour, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
    SELECT date_trunc('hour', ts), device_id, metric,
           AVG(value), SUM(value), MIN(value), MAX(value), COUNT(*),
           (array_agg(site_id))[1]
    FROM public.energy_telemetry
    WHERE device_id = v_dev.id
    GROUP BY 1,2,3;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_hourly := v_hourly + v_count;

    -- Rebuild daily for this device
    DELETE FROM public.energy_daily WHERE device_id = v_dev.id;

    INSERT INTO public.energy_daily
      (ts_day, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
    SELECT date_trunc('day', ts_hour)::date, device_id, metric,
           AVG(value_avg),
           SUM(COALESCE(value_sum, value_avg)),
           MIN(value_min), MAX(value_max),
           SUM(COALESCE(sample_count,1)),
           (array_agg(site_id))[1]
    FROM public.energy_hourly
    WHERE device_id = v_dev.id
    GROUP BY 1,2,3;

    -- Rebuild latest for this device
    DELETE FROM public.energy_latest WHERE device_id = v_dev.id;

    INSERT INTO public.energy_latest (device_id, metric, value, unit, ts, quality, site_id)
    SELECT DISTINCT ON (device_id, metric)
      device_id, metric, value, unit, ts, quality, site_id
    FROM public.energy_telemetry
    WHERE device_id = v_dev.id
    ORDER BY device_id, metric, ts DESC;
  END LOOP;

  INSERT INTO public.tz_fix_log (site_id, fix_version, rows_raw, rows_hourly)
  VALUES (p_site_id, 'v1', v_raw, v_hourly);

  RETURN QUERY SELECT v_raw, v_hourly;
END $$;
