CREATE OR REPLACE FUNCTION public._shift_energy_site_timestamps(
  p_site_id      uuid,
  p_shift        interval,
  p_fix_version  text
)
RETURNS TABLE(rows_raw bigint, rows_hourly bigint, rows_daily bigint, rows_latest bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '600s'
AS $$
DECLARE
  v_dev RECORD;
  v_raw    bigint := 0;
  v_hourly bigint := 0;
  v_daily  bigint := 0;
  v_latest bigint := 0;
  v_count  bigint;
BEGIN
  IF p_site_id IS NULL OR p_fix_version IS NULL OR p_shift IS NULL THEN
    RAISE EXCEPTION 'site_id, shift and fix_version are required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tz_fix_log
    WHERE site_id = p_site_id AND fix_version = p_fix_version
  ) THEN
    RAISE NOTICE 'shift already applied (site=% version=%) — skipping', p_site_id, p_fix_version;
    RETURN QUERY SELECT 0::bigint, 0::bigint, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  FOR v_dev IN SELECT id FROM public.devices WHERE site_id = p_site_id LOOP
    DROP TABLE IF EXISTS _tz_shift_dev_tmp;
    CREATE TEMP TABLE _tz_shift_dev_tmp AS
    SELECT
      device_id, metric, ts_shifted AS ts,
      AVG(value)              AS value,
      (array_agg(unit))[1]    AS unit,
      MIN(quality)            AS quality,
      (array_agg(site_id))[1] AS site_id,
      jsonb_build_object(p_fix_version, true) AS labels
    FROM (
      SELECT device_id, metric, (ts + p_shift) AS ts_shifted,
             value, unit, quality, site_id
      FROM public.energy_telemetry
      WHERE device_id = v_dev.id
    ) s
    GROUP BY device_id, metric, ts_shifted;

    DELETE FROM public.energy_telemetry WHERE device_id = v_dev.id;

    INSERT INTO public.energy_telemetry
      (device_id, metric, ts, value, unit, quality, site_id, labels)
    SELECT device_id, metric, ts, value, unit, quality, site_id, labels
    FROM _tz_shift_dev_tmp;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_raw := v_raw + v_count;

    DELETE FROM public.energy_hourly WHERE device_id = v_dev.id;
    INSERT INTO public.energy_hourly
      (ts_hour, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
    SELECT date_trunc('hour', ts), device_id, metric,
           AVG(value), SUM(value), MIN(value), MAX(value), COUNT(*),
           (array_agg(site_id))[1]
    FROM public.energy_telemetry WHERE device_id = v_dev.id
    GROUP BY 1,2,3;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_hourly := v_hourly + v_count;

    DELETE FROM public.energy_daily WHERE device_id = v_dev.id;
    INSERT INTO public.energy_daily
      (ts_day, device_id, metric, value_avg, value_sum, value_min, value_max, sample_count, site_id)
    SELECT date_trunc('day', ts_hour)::date, device_id, metric,
           AVG(value_avg),
           SUM(COALESCE(value_sum, value_avg)),
           MIN(value_min), MAX(value_max),
           SUM(COALESCE(sample_count, 1)),
           (array_agg(site_id))[1]
    FROM public.energy_hourly WHERE device_id = v_dev.id
    GROUP BY 1,2,3;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_daily := v_daily + v_count;

    DELETE FROM public.energy_latest WHERE device_id = v_dev.id;
    INSERT INTO public.energy_latest
      (device_id, metric, value, unit, ts, quality, site_id)
    SELECT DISTINCT ON (device_id, metric)
      device_id, metric, value, unit, ts, quality, site_id
    FROM public.energy_telemetry WHERE device_id = v_dev.id
    ORDER BY device_id, metric, ts DESC;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_latest := v_latest + v_count;
  END LOOP;

  INSERT INTO public.tz_fix_log (site_id, fix_version, rows_raw, rows_hourly)
  VALUES (p_site_id, p_fix_version, v_raw, v_hourly)
  ON CONFLICT (site_id, fix_version) DO NOTHING;

  RETURN QUERY SELECT v_raw, v_hourly, v_daily, v_latest;
END $$;

REVOKE EXECUTE ON FUNCTION public._shift_energy_site_timestamps(uuid, interval, text) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public._shift_energy_site_timestamps(uuid, interval, text) TO service_role;