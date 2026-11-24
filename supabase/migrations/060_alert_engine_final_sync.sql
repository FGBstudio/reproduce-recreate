-- Migration: Drop Blocking Unique Index, Align Offline Thresholds & Restore System Health Mirroring
-- Version: 060
-- Description: Drops legacy full UNIQUE(alert_key) index so resolved alerts can re-trigger safely,
--              aligns evaluate_sensor_health() with detect_offline_sensors() thresholds & virtual-device exclusions,
--              restores sensor_health -> site_alerts mirroring & auto-resolve, and restores site_kpis evaluation.

-- 1. Drop legacy full UNIQUE(alert_key) constraint/index and redundant active-only index
--    (idx_site_alerts_open_key enforces uniqueness across active + acknowledged rows only)
ALTER TABLE public.site_alerts DROP CONSTRAINT IF EXISTS site_alerts_key_unique;
DROP INDEX IF EXISTS public.site_alerts_key_unique;
DROP INDEX IF EXISTS public.idx_site_alerts_one_active_per_key;

-- Normalize open system health alerts back to site_id:device_id:metric so mirroring upserts match existing rows
WITH ranked_sys AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY site_id, device_id, metric
               ORDER BY triggered_at DESC, id DESC
           ) AS rn
    FROM public.site_alerts
    WHERE status IN ('active', 'acknowledged')
      AND metric IN ('system.connectivity', 'system.connectivity_energy', 'system.data_quality')
      AND device_id IS NOT NULL
)
UPDATE public.site_alerts
SET status = 'resolved',
    resolved_at = now(),
    resolution_reason = 'deduplicated_alert_key'
WHERE id IN (SELECT id FROM ranked_sys WHERE rn > 1);

UPDATE public.site_alerts
SET alert_key = concat(site_id, ':', device_id, ':', metric)
WHERE status IN ('active', 'acknowledged')
  AND metric IN ('system.connectivity', 'system.connectivity_energy', 'system.data_quality')
  AND device_id IS NOT NULL
  AND alert_key IS DISTINCT FROM concat(site_id, ':', device_id, ':', metric);

-- 2. Align evaluate_sensor_health() with detect_offline_sensors() (30m air, 4h energy, exclude virtual devices)
CREATE OR REPLACE FUNCTION public.evaluate_sensor_health()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_hour TIMESTAMPTZ := date_trunc('hour', now() - INTERVAL '1 hour');
    v_device RECORD;
    v_sample_count INTEGER;
    v_is_flatline BOOLEAN;
    v_new_offline BOOLEAN;
    v_new_flapping INTEGER;
    v_packet_loss FLOAT;
    v_actual_last_seen TIMESTAMPTZ;
    v_flatline_metadata JSONB;
    v_prev_flatline_start TIMESTAMPTZ;
    v_flatline_duration_hours FLOAT;
    v_dynamic_score INTEGER;
BEGIN
    IF NOT pg_try_advisory_lock(101) THEN
        RAISE WARNING 'evaluate_sensor_health is already running. Skipping this cycle.';
        RETURN;
    END IF;

    BEGIN
        FOR v_device IN
            SELECT id, site_id, device_type
            FROM public.devices
            WHERE NOT COALESCE((metadata->>'virtual')::boolean, false)
        LOOP
            SELECT COALESCE(MAX(sample_count), 0) INTO v_sample_count
            FROM (
                SELECT sample_count FROM public.telemetry_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
                UNION ALL
                SELECT sample_count FROM public.energy_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
            ) s;

            v_is_flatline := false;
            v_flatline_metadata := NULL;

            SELECT jsonb_build_object('metric', metric, 'value', value_max, 'samples', sample_count)
            INTO v_flatline_metadata
            FROM (
                SELECT metric, value_max, sample_count FROM public.telemetry_hourly
                WHERE device_id = v_device.id AND ts_hour = v_hour
                  AND value_min = value_max AND sample_count > 2 AND value_max > 0
                  AND metric NOT IN ('iaq.o3', 'iaq.co', 'status', 'battery', 'voltage', 'rssi', 'signal_strength')
                UNION ALL
                SELECT metric, value_max, sample_count FROM public.energy_hourly
                WHERE device_id = v_device.id AND ts_hour = v_hour
                  AND value_min = value_max AND sample_count > 2 AND value_max > 0
                  AND metric NOT IN ('status', 'battery', 'voltage', 'rssi', 'signal_strength')
            ) f
            LIMIT 1;

            IF v_flatline_metadata IS NOT NULL THEN
                v_is_flatline := true;
            END IF;

            SELECT flatline_started_at INTO v_prev_flatline_start
            FROM public.sensor_health WHERE sensor_id = v_device.id;

            IF v_is_flatline THEN
                IF v_prev_flatline_start IS NULL THEN
                    v_prev_flatline_start := now();
                END IF;
            ELSE
                v_prev_flatline_start := NULL;
            END IF;

            SELECT GREATEST(
                (SELECT MAX(ts) FROM public.telemetry_latest WHERE device_id = v_device.id),
                (SELECT MAX(ts) FROM public.energy_latest WHERE device_id = v_device.id)
            ) INTO v_actual_last_seen;

            -- Matches detect_offline_sensors() thresholds so jobs 43 & 61 never conflict
            v_new_offline := CASE
                WHEN v_actual_last_seen IS NULL THEN true
                WHEN v_device.device_type = 'air_quality' THEN v_actual_last_seen < now() - INTERVAL '30 minutes'
                WHEN v_device.device_type = 'energy_monitor' THEN v_actual_last_seen < now() - INTERVAL '4 hours'
                ELSE v_actual_last_seen < now() - INTERVAL '2 hours'
            END;

            v_new_flapping := CASE WHEN NOT v_new_offline AND v_sample_count BETWEEN 1 AND 2 THEN 1 ELSE 0 END;

            IF v_new_offline THEN
                v_packet_loss := 100.0;
            ELSE
                v_packet_loss := GREATEST(0.0, LEAST(100.0, (1.0 - (v_sample_count::float / 4.0)) * 100.0));
            END IF;

            IF v_new_offline THEN
                v_dynamic_score := 0;
            ELSIF v_is_flatline THEN
                v_flatline_duration_hours := EXTRACT(EPOCH FROM (now() - v_prev_flatline_start)) / 3600.0;
                v_dynamic_score := GREATEST(20, ROUND(70 - (v_flatline_duration_hours * 20)))::integer;
            ELSIF v_packet_loss > 0 THEN
                v_dynamic_score := GREATEST(0, (100 - v_packet_loss)::integer);
            ELSE
                v_dynamic_score := 100;
            END IF;

            INSERT INTO public.sensor_health (
                sensor_id, site_id, last_seen, is_offline, is_flatlining, is_degraded,
                health_message, flapping_count_24h, packet_loss_pct, trust_score,
                flatline_started_at, last_evaluated_at, metadata
            )
            VALUES (
                v_device.id, v_device.site_id, v_actual_last_seen, v_new_offline, v_is_flatline, (v_packet_loss > 0),
                CASE WHEN v_new_offline THEN 'Offline' WHEN v_is_flatline THEN 'Flatlining' ELSE 'Healthy' END,
                v_new_flapping, v_packet_loss, v_dynamic_score,
                v_prev_flatline_start, now(), COALESCE(v_flatline_metadata, '{}'::JSONB)
            )
            ON CONFLICT (sensor_id) DO UPDATE SET
                last_seen = COALESCE(EXCLUDED.last_seen, sensor_health.last_seen),
                is_offline = EXCLUDED.is_offline,
                is_flatlining = EXCLUDED.is_flatlining,
                is_degraded = EXCLUDED.is_degraded,
                health_message = EXCLUDED.health_message,
                flapping_count_24h = CASE
                    WHEN sensor_health.last_evaluated_at IS NULL
                      OR date_trunc('hour', sensor_health.last_evaluated_at) IS DISTINCT FROM date_trunc('hour', now())
                    THEN sensor_health.flapping_count_24h + EXCLUDED.flapping_count_24h
                    ELSE sensor_health.flapping_count_24h
                END,
                packet_loss_pct = EXCLUDED.packet_loss_pct,
                metadata = EXCLUDED.metadata,
                flatline_started_at = EXCLUDED.flatline_started_at,
                last_evaluated_at = now(),
                trust_score = EXCLUDED.trust_score;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(101);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(101);
END;
$$;

-- 3. Restore sensor_health -> site_alerts mirroring & auto-resolve inside sweep_stale_and_faulty_alerts()
CREATE OR REPLACE FUNCTION public.sweep_stale_and_faulty_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT pg_try_advisory_lock(104) THEN
        RAISE WARNING 'sweep_stale_and_faulty_alerts is already running. Skipping this cycle.';
        RETURN;
    END IF;

    BEGIN
        -- A. Resolve metric alerts whose source sensor has been silent beyond its offline window (4h energy, 2h other)
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = 'source_sensor_offline'
        FROM public.devices d
        WHERE sa.device_id = d.id
          AND sa.status IN ('active', 'acknowledged')
          AND sa.metric NOT LIKE 'system.%'
          AND COALESCE(
              (SELECT GREATEST(
                  (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = sa.device_id),
                  (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = sa.device_id)
              )),
              '1970-01-01'::timestamptz
          ) < now() - CASE WHEN d.device_type = 'energy_monitor' THEN INTERVAL '4 hours' ELSE INTERVAL '2 hours' END;

        -- B. Resolve metric alerts & flag sensor_malfunction (aggregated 1 row per device)
        WITH faulty_metrics AS (
            SELECT DISTINCT
                l.site_id,
                l.device_id,
                l.metric,
                CASE
                    WHEN l.value IS NULL OR l.value::float8 IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
                    THEN 0::numeric
                    ELSE l.value::numeric
                END AS safe_value,
                COALESCE(l.value::text, 'NULL') AS raw_text
            FROM (
                SELECT site_id, device_id, metric, value, ts FROM public.telemetry_latest
                UNION ALL
                SELECT site_id, device_id, metric, value, ts FROM public.energy_latest
            ) l
            JOIN public.alert_rules ar
                ON l.metric = ar.metric
                AND (ar.site_id IS NULL OR ar.site_id = l.site_id)
            WHERE ar.is_active = true
              AND ar.metric NOT LIKE 'system.%'
              AND l.ts > now() - INTERVAL '45 minutes'
              AND (
                  l.value IS NULL
                  OR l.value::float8 IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
                  OR (ar.min_valid_value IS NOT NULL AND l.value < ar.min_valid_value)
                  OR (ar.max_valid_value IS NOT NULL AND l.value > ar.max_valid_value)
              )
        ),
        resolved_faulty AS (
            UPDATE public.site_alerts sa
            SET status = 'resolved',
                resolved_at = now(),
                resolution_reason = 'sensor_malfunction'
            FROM faulty_metrics fm
            WHERE sa.device_id = fm.device_id
              AND sa.metric = fm.metric
              AND sa.status IN ('active', 'acknowledged')
            RETURNING sa.device_id
        ),
        faulty_devices AS (
            SELECT
                fm.site_id,
                fm.device_id,
                string_agg(fm.metric || '=' || fm.raw_text, ', ' ORDER BY fm.metric) AS details,
                MIN(fm.safe_value) AS sample_val
            FROM faulty_metrics fm
            GROUP BY fm.site_id, fm.device_id
        )
        INSERT INTO public.site_alerts (
            site_id, device_id, metric, severity, status,
            message, value_at_trigger, current_value, threshold_value,
            triggered_at, alert_key, incident_group_key
        )
        SELECT
            fd.site_id,
            fd.device_id,
            'system.sensor_malfunction',
            'warning',
            'active',
            'Out-of-range sensor reading (' || fd.details || ')',
            fd.sample_val, fd.sample_val, 0,
            now(),
            concat(fd.site_id, ':', fd.device_id, ':sensor_malfunction'),
            concat(fd.site_id, ':system')
        FROM faulty_devices fd
        ON CONFLICT (alert_key) WHERE status IN ('active', 'acknowledged')
        DO UPDATE SET
            current_value = EXCLUDED.current_value,
            message = EXCLUDED.message;

        -- C. Auto-resolve sensor_malfunction when readings return inside bounds OR device goes offline
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = CASE
                WHEN COALESCE(
                    (SELECT GREATEST(
                        (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = sa.device_id),
                        (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = sa.device_id)
                    )),
                    '1970-01-01'::timestamptz
                ) < now() - INTERVAL '2 hours'
                THEN 'source_sensor_offline'
                ELSE 'returned_to_normal'
            END
        WHERE sa.metric = 'system.sensor_malfunction'
          AND sa.status IN ('active', 'acknowledged')
          AND sa.device_id IS NOT NULL
          AND (
              COALESCE(
                  (SELECT GREATEST(
                      (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = sa.device_id),
                      (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = sa.device_id)
                  )),
                  '1970-01-01'::timestamptz
              ) < now() - INTERVAL '2 hours'
              OR (
                  EXISTS (
                      SELECT 1
                      FROM (
                          SELECT device_id, ts FROM public.telemetry_latest
                          UNION ALL
                          SELECT device_id, ts FROM public.energy_latest
                      ) fresh
                      WHERE fresh.device_id = sa.device_id
                        AND fresh.ts > now() - INTERVAL '45 minutes'
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM (
                          SELECT site_id, device_id, metric, value, ts FROM public.telemetry_latest
                          UNION ALL
                          SELECT site_id, device_id, metric, value, ts FROM public.energy_latest
                      ) l
                      JOIN public.alert_rules ar
                          ON l.metric = ar.metric
                          AND (ar.site_id IS NULL OR ar.site_id = l.site_id)
                      WHERE ar.is_active = true
                        AND ar.metric NOT LIKE 'system.%'
                        AND l.device_id = sa.device_id
                        AND l.ts > now() - INTERVAL '45 minutes'
                        AND (
                            l.value IS NULL
                            OR l.value::float8 IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
                            OR (ar.min_valid_value IS NOT NULL AND l.value < ar.min_valid_value)
                            OR (ar.max_valid_value IS NOT NULL AND l.value > ar.max_valid_value)
                        )
                  )
              )
          );

        -- D. Mirror sensor_health -> site_alerts (system.connectivity, system.connectivity_energy, system.data_quality)
        INSERT INTO public.site_alerts (
            site_id, device_id, rule_id, metric, severity, status,
            message, value_at_trigger, current_value, threshold_value,
            triggered_at, alert_key, incident_group_key
        )
        SELECT DISTINCT ON (d.site_id, sh.sensor_id, l.m_name)
            d.site_id,
            sh.sensor_id,
            r.id,
            l.m_name,
            r.severity,
            'active',
            COALESCE(NULLIF(sh.health_message, ''), CASE WHEN l.m_name LIKE 'system.connectivity%' THEN 'Sensor offline' ELSE 'Data quality degraded' END),
            CASE WHEN l.m_name = 'system.data_quality' THEN COALESCE(sh.packet_loss_pct, 0) ELSE 0 END,
            CASE WHEN l.m_name = 'system.data_quality' THEN COALESCE(sh.packet_loss_pct, 0) ELSE 0 END,
            r.threshold,
            now(),
            concat(d.site_id, ':', sh.sensor_id, ':', l.m_name),
            concat(d.site_id, ':system')
        FROM public.sensor_health sh
        JOIN public.devices d ON d.id = sh.sensor_id
        CROSS JOIN LATERAL (
            VALUES
                (CASE WHEN d.device_type = 'air_quality' THEN 'system.connectivity' ELSE 'system.connectivity_energy' END),
                ('system.data_quality')
        ) l(m_name)
        JOIN public.alert_rules r
            ON r.metric = l.m_name
            AND (r.site_id = d.site_id OR r.site_id IS NULL)
        WHERE r.is_active = true
          AND d.site_id IS NOT NULL
          AND NOT COALESCE((d.metadata->>'virtual')::boolean, false)
          AND (
              (l.m_name LIKE 'system.connectivity%' AND sh.is_offline IS TRUE)
              OR (l.m_name = 'system.data_quality' AND sh.is_offline IS NOT TRUE AND (sh.is_flatlining IS TRUE OR sh.is_degraded IS TRUE))
          )
        ORDER BY d.site_id, sh.sensor_id, l.m_name, (r.site_id IS NULL) ASC
        ON CONFLICT (alert_key) WHERE status IN ('active', 'acknowledged')
        DO UPDATE SET
            severity = EXCLUDED.severity,
            message = EXCLUDED.message,
            current_value = EXCLUDED.current_value;

        -- E. Auto-resolve mirrored system health alerts when sensor_health recovers (or device becomes virtual)
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = CASE
                WHEN sa.metric LIKE 'system.connectivity%' THEN 'device_reconnected'
                ELSE 'returned_to_normal'
            END
        FROM public.sensor_health sh
        JOIN public.devices d ON d.id = sh.sensor_id
        WHERE sa.device_id = sh.sensor_id
          AND sa.status IN ('active', 'acknowledged')
          AND sa.metric IN ('system.connectivity', 'system.connectivity_energy', 'system.data_quality')
          AND (
              COALESCE((d.metadata->>'virtual')::boolean, false) = true
              OR NOT (
                  (sa.metric LIKE 'system.connectivity%' AND sh.is_offline IS TRUE)
                  OR (sa.metric = 'system.data_quality' AND sh.is_offline IS NOT TRUE AND (sh.is_flatlining IS TRUE OR sh.is_degraded IS TRUE))
              )
          );
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(104);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(104);
END;
$$;

-- 4. Restore site_kpis evaluation (e.g., energy.eui) & {{value}} template rendering inside evaluate_instant_alerts()
CREATE OR REPLACE FUNCTION public.evaluate_instant_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT pg_try_advisory_lock(102) THEN
        RAISE WARNING 'evaluate_instant_alerts is already running. Skipping this cycle.';
        RETURN;
    END IF;

    BEGIN
        -- STEP A: Trigger valid, fresh device breaches (site-specific rules override global defaults)
        INSERT INTO public.site_alerts (
            site_id, device_id, rule_id, metric, severity, status,
            message, value_at_trigger, current_value, threshold_value,
            triggered_at, alert_key, incident_group_key
        )
        SELECT
            l.site_id,
            l.device_id,
            ar.id,
            l.metric,
            ar.severity,
            'active',
            replace(COALESCE(ar.message_template, 'Threshold breach on ' || l.metric), '{{value}}', ROUND(l.value::numeric, 2)::text),
            l.value,
            l.value,
            ar.threshold,
            now(),
            concat(l.site_id, ':', l.device_id, ':', ar.id),
            concat(l.site_id, ':', split_part(l.metric, '.', 1))
        FROM (
            SELECT site_id, device_id, metric, value, ts FROM public.telemetry_latest
            UNION ALL
            SELECT site_id, device_id, metric, value, ts FROM public.energy_latest
        ) l
        JOIN public.alert_rules ar
            ON l.metric = ar.metric
            AND (ar.site_id IS NULL OR ar.site_id = l.site_id)
        LEFT JOIN public.sensor_health sh ON l.device_id = sh.sensor_id
        WHERE ar.is_active = true
          AND ar.duration_minutes = 0
          AND ar.metric NOT LIKE 'system.%'
          AND (
              ar.site_id IS NOT NULL
              OR NOT EXISTS (
                  SELECT 1 FROM public.alert_rules sr
                  WHERE sr.site_id = l.site_id
                    AND sr.metric = ar.metric
                    AND sr.severity = ar.severity
                    AND sr.condition = ar.condition
                    AND sr.is_active = true
              )
          )
          AND l.ts > now() - INTERVAL '45 minutes'
          AND l.value IS NOT NULL
          AND l.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
          AND (ar.min_valid_value IS NULL OR l.value >= ar.min_valid_value)
          AND (ar.max_valid_value IS NULL OR l.value <= ar.max_valid_value)
          AND (sh.trust_score IS NULL OR sh.trust_score >= 80)
          AND (
              (ar.condition = '>' AND l.value > ar.threshold) OR
              (ar.condition = '<' AND l.value < ar.threshold) OR
              (ar.condition = '>=' AND l.value >= ar.threshold) OR
              (ar.condition = '<=' AND l.value <= ar.threshold)
          )
          AND NOT (
              ar.severity = 'warning' AND EXISTS (
                  SELECT 1 FROM public.site_alerts crit
                  WHERE crit.device_id = l.device_id
                    AND crit.metric = l.metric
                    AND crit.severity = 'critical'
                    AND crit.status IN ('active', 'acknowledged')
              )
          )
        ON CONFLICT (alert_key) WHERE status IN ('active', 'acknowledged')
        DO UPDATE SET
            current_value = EXCLUDED.current_value,
            message = EXCLUDED.message;

        -- STEP B: Auto-escalate (resolve open warnings when critical is active for same device + metric)
        UPDATE public.site_alerts warn
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = 'escalated_to_critical'
        WHERE warn.severity = 'warning'
          AND warn.status IN ('active', 'acknowledged')
          AND warn.device_id IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM public.site_alerts crit
              WHERE crit.device_id = warn.device_id
                AND crit.metric = warn.metric
                AND crit.severity = 'critical'
                AND crit.status IN ('active', 'acknowledged')
          );

        -- STEP C: Resolve fresh device readings that returned within hysteresis band
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = 'returned_to_normal'
        FROM (
            SELECT device_id, metric, value, ts FROM public.telemetry_latest
            UNION ALL
            SELECT device_id, metric, value, ts FROM public.energy_latest
        ) l
        JOIN public.alert_rules ar ON l.metric = ar.metric
        WHERE sa.device_id = l.device_id
          AND sa.rule_id = ar.id
          AND sa.status IN ('active', 'acknowledged')
          AND ar.metric NOT LIKE 'system.%'
          AND l.ts > now() - INTERVAL '45 minutes'
          AND l.value IS NOT NULL
          AND l.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
          AND (ar.min_valid_value IS NULL OR l.value >= ar.min_valid_value)
          AND (ar.max_valid_value IS NULL OR l.value <= ar.max_valid_value)
          AND (
              (ar.condition IN ('>', '>=') AND l.value <= (ar.threshold - (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0)))) OR
              (ar.condition IN ('<', '<=') AND l.value >= (ar.threshold + (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0))))
          );

        -- STEP D: Evaluate site-wide virtual KPIs (e.g., energy.eui) if public.site_kpis exists
        IF to_regclass('public.site_kpis') IS NOT NULL THEN
            INSERT INTO public.site_alerts (
                site_id, device_id, rule_id, metric, severity, status,
                message, value_at_trigger, current_value, threshold_value,
                triggered_at, alert_key, incident_group_key
            )
            SELECT DISTINCT ON (s.site_id, ar.id)
                s.site_id,
                NULL,
                ar.id,
                ar.metric,
                ar.severity,
                'active',
                replace(COALESCE(ar.message_template, 'Site KPI threshold breach on ' || ar.metric), '{{value}}', ROUND(s.value::numeric, 2)::text),
                s.value,
                s.value,
                ar.threshold,
                now(),
                concat(s.site_id, ':site:', ar.id),
                concat(s.site_id, ':', split_part(ar.metric, '.', 1))
            FROM (
                SELECT DISTINCT ON (site_id, metric) site_id, metric, value, ts
                FROM public.site_kpis
                ORDER BY site_id, metric, ts DESC
            ) s
            JOIN public.alert_rules ar
                ON ar.metric = s.metric
                AND (ar.site_id IS NULL OR ar.site_id = s.site_id)
            WHERE ar.is_active = true
              AND ar.duration_minutes = 0
              AND ar.metric NOT LIKE 'system.%'
              AND (
                  ar.site_id IS NOT NULL
                  OR NOT EXISTS (
                      SELECT 1 FROM public.alert_rules sr
                      WHERE sr.site_id = s.site_id
                        AND sr.metric = ar.metric
                        AND sr.severity = ar.severity
                        AND sr.condition = ar.condition
                        AND sr.is_active = true
                  )
              )
              AND s.ts > now() - INTERVAL '24 hours'
              AND s.value IS NOT NULL
              AND s.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
              AND (
                  (ar.condition = '>' AND s.value > ar.threshold) OR
                  (ar.condition = '<' AND s.value < ar.threshold) OR
                  (ar.condition = '>=' AND s.value >= ar.threshold) OR
                  (ar.condition = '<=' AND s.value <= ar.threshold)
              )
            ORDER BY s.site_id, ar.id
            ON CONFLICT (alert_key) WHERE status IN ('active', 'acknowledged')
            DO UPDATE SET
                current_value = EXCLUDED.current_value,
                message = EXCLUDED.message;

            -- STEP E: Resolve site-wide KPI alerts returning within hysteresis
            UPDATE public.site_alerts sa
            SET status = 'resolved',
                resolved_at = now(),
                resolution_reason = 'returned_to_normal'
            FROM (
                SELECT DISTINCT ON (site_id, metric) site_id, metric, value, ts
                FROM public.site_kpis
                ORDER BY site_id, metric, ts DESC
            ) s
            JOIN public.alert_rules ar ON ar.metric = s.metric
            WHERE sa.site_id = s.site_id
              AND sa.rule_id = ar.id
              AND sa.device_id IS NULL
              AND sa.status IN ('active', 'acknowledged')
              AND s.ts > now() - INTERVAL '24 hours'
              AND s.value IS NOT NULL
              AND s.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
              AND (
                  (ar.condition IN ('>', '>=') AND s.value <= (ar.threshold - (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0)))) OR
                  (ar.condition IN ('<', '<=') AND s.value >= (ar.threshold + (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0))))
              );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(102);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(102);
END;
$$;

-- Re-assert strict permissions
REVOKE ALL ON FUNCTION public.evaluate_sensor_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_sensor_health() TO service_role;

REVOKE ALL ON FUNCTION public.evaluate_instant_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_instant_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.sweep_stale_and_faulty_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_and_faulty_alerts() TO service_role;
