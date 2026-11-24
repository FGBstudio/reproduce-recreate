-- Migration: Enterprise Alert Engine Hardening & Secure Acknowledge RPC
-- Version: 058
-- Description: Fixes schema/index bugs, preserves 049 advisory locks & history, adds physical sanity bounds,
--              severity dominance, offline/malfunction lifecycle, and secure acknowledge_site_alert RPC.

-- 1. Schema Upgrades
ALTER TABLE public.alert_rules
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS min_valid_value NUMERIC,
    ADD COLUMN IF NOT EXISTS max_valid_value NUMERIC;

-- Sync legacy `enabled` column into `is_active` if `enabled` exists in the live DB
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'alert_rules' AND column_name = 'enabled'
    ) THEN
        EXECUTE 'UPDATE public.alert_rules SET is_active = COALESCE(enabled, true) WHERE is_active IS DISTINCT FROM COALESCE(enabled, true)';
    END IF;
END $$;

ALTER TABLE public.site_alerts
    ADD COLUMN IF NOT EXISTS resolution_reason TEXT,
    ADD COLUMN IF NOT EXISTS incident_group_key TEXT,
    ADD COLUMN IF NOT EXISTS threshold_value NUMERIC,
    ADD COLUMN IF NOT EXISTS current_value NUMERIC,
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS acknowledged_by_name TEXT;

-- Clean up any duplicate open alerts before enforcing partial UNIQUE index
WITH ranked_open AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY alert_key ORDER BY triggered_at DESC) AS rn
    FROM public.site_alerts
    WHERE status IN ('active', 'acknowledged')
      AND alert_key IS NOT NULL
)
UPDATE public.site_alerts
SET status = 'resolved',
    resolved_at = now(),
    resolution_reason = 'deduplicated_on_migration'
WHERE id IN (SELECT id FROM ranked_open WHERE rn > 1);

DROP INDEX IF EXISTS public.idx_site_alerts_active_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_site_alerts_open_key
    ON public.site_alerts (alert_key)
    WHERE status IN ('active', 'acknowledged');

CREATE INDEX IF NOT EXISTS idx_site_alerts_group_key
    ON public.site_alerts (site_id, incident_group_key)
    WHERE status IN ('active', 'acknowledged');

-- 2. Set Physical Sanity Bounds & Move Environmental Rules to 15-Min Sustained Window
UPDATE public.alert_rules ar
SET min_valid_value = 250,
    max_valid_value = 5000,
    duration_minutes = CASE
        WHEN ar.duration_minutes = 0 AND NOT EXISTS (
            SELECT 1 FROM public.alert_rules dup
            WHERE dup.metric = ar.metric
              AND dup.severity = ar.severity
              AND dup.condition = ar.condition
              AND dup.duration_minutes = 15
              AND dup.site_id IS NOT DISTINCT FROM ar.site_id
        ) THEN 15
        ELSE ar.duration_minutes
    END
WHERE ar.metric = 'iaq.co2';

UPDATE public.alert_rules ar
SET min_valid_value = -10,
    max_valid_value = 60,
    duration_minutes = CASE
        WHEN ar.duration_minutes = 0 AND NOT EXISTS (
            SELECT 1 FROM public.alert_rules dup
            WHERE dup.metric = ar.metric
              AND dup.severity = ar.severity
              AND dup.condition = ar.condition
              AND dup.duration_minutes = 15
              AND dup.site_id IS NOT DISTINCT FROM ar.site_id
        ) THEN 15
        ELSE ar.duration_minutes
    END
WHERE ar.metric = 'env.temperature';

UPDATE public.alert_rules ar
SET min_valid_value = 0,
    max_valid_value = 100,
    duration_minutes = CASE
        WHEN ar.duration_minutes = 0 AND NOT EXISTS (
            SELECT 1 FROM public.alert_rules dup
            WHERE dup.metric = ar.metric
              AND dup.severity = ar.severity
              AND dup.condition = ar.condition
              AND dup.duration_minutes = 15
              AND dup.site_id IS NOT DISTINCT FROM ar.site_id
        ) THEN 15
        ELSE ar.duration_minutes
    END
WHERE ar.metric = 'env.humidity';

UPDATE public.alert_rules
SET min_valid_value = 0, max_valid_value = 10000
WHERE metric = 'energy.power_kw';

UPDATE public.alert_rules
SET min_valid_value = 0, max_valid_value = 100000
WHERE metric IN ('energy.daily_consumption', 'energy.energy_kwh');

-- 3. Harden Sensor Health Trust Layer (Preserves 049 advisory lock 101 & flatline decay; once-per-hour flapping increment)
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
        FOR v_device IN SELECT id, site_id, device_type FROM public.devices LOOP
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

            -- Check both latest tables regardless of device_type label
            SELECT GREATEST(
                (SELECT MAX(ts) FROM public.telemetry_latest WHERE device_id = v_device.id),
                (SELECT MAX(ts) FROM public.energy_latest WHERE device_id = v_device.id)
            ) INTO v_actual_last_seen;

            v_new_offline := (v_actual_last_seen IS NULL OR v_actual_last_seen < now() - INTERVAL '2 hours');
            v_new_flapping := CASE WHEN NOT v_new_offline AND v_sample_count BETWEEN 1 AND 2 THEN 1 ELSE 0 END;

            IF v_new_offline THEN
                v_packet_loss := 100.0;
            ELSE
                v_packet_loss := GREATEST(0.0, LEAST(100.0, (1.0 - (v_sample_count::float / 4.0)) * 100.0));
            END IF;

            -- Flatline immediately drops trust_score to <= 70 (< 80 threshold) so frozen sensors are suppressed
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
                -- Only increment flapping_count_24h once per hour even if cron runs every 15m
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

-- 4. Hardened Instant Alert Evaluator (Advisory lock 102, is_active, NaN/Inf/sanity bounds, freshness, severity dominance)
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
        -- STEP A: Trigger valid, fresh breaches
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
            COALESCE(ar.message_template, 'Threshold breach on ' || l.metric),
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
          -- Freshness gate (45m supports 15m polling intervals safely)
          AND l.ts > now() - INTERVAL '45 minutes'
          -- Reject NULL, NaN, Infinity, and physically impossible readings
          AND l.value IS NOT NULL
          AND l.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
          AND (ar.min_valid_value IS NULL OR l.value >= ar.min_valid_value)
          AND (ar.max_valid_value IS NULL OR l.value <= ar.max_valid_value)
          -- Trust layer check
          AND (sh.trust_score IS NULL OR sh.trust_score >= 80)
          -- Threshold breach check
          AND (
              (ar.condition = '>' AND l.value > ar.threshold) OR
              (ar.condition = '<' AND l.value < ar.threshold) OR
              (ar.condition = '>=' AND l.value >= ar.threshold) OR
              (ar.condition = '<=' AND l.value <= ar.threshold)
          )
          -- Suppress warning if a critical alert for the same device + metric is open
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
            current_value = EXCLUDED.current_value;

        -- STEP B: Auto-escalate (resolve open warnings when critical is active for same device + metric)
        UPDATE public.site_alerts warn
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = 'escalated_to_critical'
        WHERE warn.severity = 'warning'
          AND warn.status IN ('active', 'acknowledged')
          AND EXISTS (
              SELECT 1 FROM public.site_alerts crit
              WHERE crit.device_id = warn.device_id
                AND crit.metric = warn.metric
                AND crit.severity = 'critical'
                AND crit.status IN ('active', 'acknowledged')
          );

        -- STEP C: Resolve fresh readings that returned within hysteresis band
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
          AND l.ts > now() - INTERVAL '45 minutes'
          AND l.value IS NOT NULL
          AND l.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
          AND (ar.min_valid_value IS NULL OR l.value >= ar.min_valid_value)
          AND (ar.max_valid_value IS NULL OR l.value <= ar.max_valid_value)
          AND (
              (ar.condition IN ('>', '>=') AND l.value <= (ar.threshold - (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0)))) OR
              (ar.condition IN ('<', '<=') AND l.value >= (ar.threshold + (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0))))
          );
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(102);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(102);
END;
$$;

-- 5. Hardened Sustained Alert Evaluator (15-min rolling average with site_id filter, explicit ::numeric cast, sanity bounds & severity dominance)
CREATE OR REPLACE FUNCTION public.evaluate_sustained_alerts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rule RECORD;
    v_row RECORD;
BEGIN
    IF NOT pg_try_advisory_lock(103) THEN
        RAISE WARNING 'evaluate_sustained_alerts is already running. Skipping this cycle.';
        RETURN;
    END IF;

    BEGIN
        FOR v_rule IN
            SELECT * FROM public.alert_rules
            WHERE is_active = true AND duration_minutes > 0 AND duration_minutes < 1440
        LOOP
            FOR v_row IN
                SELECT
                    c.device_id,
                    c.site_id,
                    AVG(c.value)::numeric AS avg_val,
                    COUNT(*) AS sample_cnt
                FROM (
                    SELECT device_id, site_id, value FROM public.telemetry
                    WHERE metric = v_rule.metric
                      AND ts > now() - (v_rule.duration_minutes || ' minutes')::INTERVAL
                    UNION ALL
                    SELECT device_id, site_id, value FROM public.energy_telemetry
                    WHERE metric = v_rule.metric
                      AND ts > now() - (v_rule.duration_minutes || ' minutes')::INTERVAL
                ) c
                LEFT JOIN public.sensor_health sh ON c.device_id = sh.sensor_id
                WHERE (v_rule.site_id IS NULL OR c.site_id = v_rule.site_id)
                  AND c.value IS NOT NULL
                  AND c.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
                  AND (v_rule.min_valid_value IS NULL OR c.value >= v_rule.min_valid_value)
                  AND (v_rule.max_valid_value IS NULL OR c.value <= v_rule.max_valid_value)
                  AND (sh.trust_score IS NULL OR sh.trust_score >= 80)
                GROUP BY c.device_id, c.site_id
            LOOP
                IF (v_rule.condition IN ('>', '>=') AND (
                        (v_rule.condition = '>' AND v_row.avg_val > v_rule.threshold) OR
                        (v_rule.condition = '>=' AND v_row.avg_val >= v_rule.threshold)
                    )) OR
                   (v_rule.condition IN ('<', '<=') AND (
                        (v_rule.condition = '<' AND v_row.avg_val < v_rule.threshold) OR
                        (v_rule.condition = '<=' AND v_row.avg_val <= v_rule.threshold)
                    )) THEN

                    -- Skip warning if critical is already open for this device + metric
                    IF v_rule.severity = 'warning' AND EXISTS (
                        SELECT 1 FROM public.site_alerts crit
                        WHERE crit.device_id = v_row.device_id
                          AND crit.metric = v_rule.metric
                          AND crit.severity = 'critical'
                          AND crit.status IN ('active', 'acknowledged')
                    ) THEN
                        CONTINUE;
                    END IF;

                    INSERT INTO public.site_alerts (
                        site_id, device_id, rule_id, metric, severity, status,
                        message, value_at_trigger, current_value, threshold_value,
                        triggered_at, alert_key, incident_group_key
                    )
                    VALUES (
                        v_row.site_id, v_row.device_id, v_rule.id, v_rule.metric, v_rule.severity, 'active',
                        COALESCE(v_rule.message_template, v_rule.metric) || ' (' || v_rule.duration_minutes || 'm avg: ' || ROUND(v_row.avg_val::numeric, 1) || ')',
                        ROUND(v_row.avg_val::numeric, 2), ROUND(v_row.avg_val::numeric, 2), v_rule.threshold,
                        now(),
                        concat(v_row.site_id, ':', v_row.device_id, ':', v_rule.id),
                        concat(v_row.site_id, ':', split_part(v_rule.metric, '.', 1))
                    )
                    ON CONFLICT (alert_key) WHERE status IN ('active', 'acknowledged')
                    DO UPDATE SET
                        current_value = EXCLUDED.current_value,
                        message = EXCLUDED.message;

                    -- Escalate any lower warning on the same device + metric
                    IF v_rule.severity = 'critical' THEN
                        UPDATE public.site_alerts
                        SET status = 'resolved',
                            resolved_at = now(),
                            resolution_reason = 'escalated_to_critical'
                        WHERE device_id = v_row.device_id
                          AND metric = v_rule.metric
                          AND severity = 'warning'
                          AND status IN ('active', 'acknowledged');
                    END IF;

                ELSE
                    UPDATE public.site_alerts sa
                    SET status = 'resolved',
                        resolved_at = now(),
                        resolution_reason = 'returned_to_normal'
                    WHERE sa.alert_key = concat(v_row.site_id, ':', v_row.device_id, ':', v_rule.id)
                      AND sa.status IN ('active', 'acknowledged')
                      AND (
                          (v_rule.condition IN ('>', '>=') AND v_row.avg_val <= (v_rule.threshold - (v_rule.threshold * (COALESCE(v_rule.hysteresis_pct, 0) / 100.0)))) OR
                          (v_rule.condition IN ('<', '<=') AND v_row.avg_val >= (v_rule.threshold + (v_rule.threshold * (COALESCE(v_rule.hysteresis_pct, 0) / 100.0))))
                      );
                END IF;
            END LOOP;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(103);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(103);
END;
$$;

-- 6. Stale & Malfunction Sweeper (Auto-resolves dead/corrupt metric alerts, raises 1 device fault per device, auto-resolves malfunctions)
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
        -- A. Resolve metric alerts whose source sensor has been silent > 2 hours
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = 'source_sensor_offline'
        WHERE sa.status IN ('active', 'acknowledged')
          AND sa.metric NOT LIKE 'system.%'
          AND sa.device_id IS NOT NULL
          AND COALESCE(
              (SELECT GREATEST(
                  (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = sa.device_id),
                  (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = sa.device_id)
              )),
              '1970-01-01'::timestamptz
          ) < now() - INTERVAL '2 hours';

        -- B. Raise 1 consolidated device_offline alert per silent device (that has reported at least once)
        INSERT INTO public.site_alerts (
            site_id, device_id, metric, severity, status,
            message, value_at_trigger, current_value, threshold_value,
            triggered_at, alert_key, incident_group_key
        )
        SELECT
            d.site_id,
            d.id,
            'system.device_offline',
            'warning',
            'active',
            'Sensor offline (> 2h without telemetry)',
            0, 0, 120,
            now(),
            concat(d.site_id, ':', d.id, ':device_offline'),
            concat(d.site_id, ':system')
        FROM public.devices d
        CROSS JOIN LATERAL (
            SELECT GREATEST(
                (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = d.id),
                (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = d.id)
            ) AS last_ts
        ) lat
        WHERE d.site_id IS NOT NULL
          AND d.status IS DISTINCT FROM 'maintenance'
          AND lat.last_ts IS NOT NULL
          AND lat.last_ts < now() - INTERVAL '2 hours'
        ON CONFLICT (alert_key) WHERE status IN ('active', 'acknowledged')
        DO NOTHING;

        -- C. Auto-resolve device_offline alerts as soon as fresh telemetry resumes (< 30m)
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = 'device_reconnected'
        WHERE sa.metric = 'system.device_offline'
          AND sa.status IN ('active', 'acknowledged')
          AND COALESCE(
              (SELECT GREATEST(
                  (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = sa.device_id),
                  (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = sa.device_id)
              )),
              '1970-01-01'::timestamptz
          ) > now() - INTERVAL '30 minutes';

        -- D. Resolve metric alerts & flag sensor_malfunction (aggregated 1 row per device to avoid ON CONFLICT collision)
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
            WHERE l.ts > now() - INTERVAL '45 minutes'
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

        -- E. Auto-resolve sensor_malfunction when all fresh readings return inside valid bounds OR device goes offline > 2h
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
              -- Case 1: Device went offline > 2 hours
              COALESCE(
                  (SELECT GREATEST(
                      (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = sa.device_id),
                      (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = sa.device_id)
                  )),
                  '1970-01-01'::timestamptz
              ) < now() - INTERVAL '2 hours'
              OR (
                  -- Case 2: Has fresh telemetry (< 45m) and zero out-of-range metrics remain
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
                      WHERE l.device_id = sa.device_id
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
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(104);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(104);
END;
$$;

-- Lock down cron functions so only service_role can execute them
REVOKE ALL ON FUNCTION public.evaluate_sensor_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_sensor_health() TO service_role;

REVOKE ALL ON FUNCTION public.evaluate_instant_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_instant_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.evaluate_sustained_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_sustained_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.sweep_stale_and_faulty_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_and_faulty_alerts() TO service_role;

-- 7. Secure Acknowledge RPC (Replaces raw UPDATE RLS; locks row FOR UPDATE; derives user & audit entry server-side)
CREATE OR REPLACE FUNCTION public.acknowledge_site_alert(p_alert_id UUID)
RETURNS TABLE (
    id UUID,
    status TEXT,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID,
    acknowledged_by_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_site_id UUID;
    v_status TEXT;
    v_user_name TEXT;
    v_ack_at TIMESTAMPTZ := now();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT sa.site_id, sa.status
    INTO v_site_id, v_status
    FROM public.site_alerts sa
    WHERE sa.id = p_alert_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Alert not found';
    END IF;

    IF NOT public.can_access_site(v_user_id, v_site_id) THEN
        RAISE EXCEPTION 'Access denied for this site';
    END IF;

    IF v_status = 'resolved' THEN
        RAISE EXCEPTION 'Cannot acknowledge an already resolved alert';
    END IF;

    -- Resolve operator display name from profiles (columns verified in 016_create_profiles_and_roles.sql)
    SELECT COALESCE(
        NULLIF(TRIM(p.display_name), ''),
        NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
        NULLIF(split_part(p.email, '@', 1), ''),
        NULLIF(split_part(u.email, '@', 1), ''),
        'Operator'
    )
    INTO v_user_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_user_id;

    v_user_name := COALESCE(v_user_name, 'Operator');

    -- Idempotent if already acknowledged
    UPDATE public.site_alerts sa
    SET status = 'acknowledged',
        acknowledged_at = COALESCE(sa.acknowledged_at, v_ack_at),
        acknowledged_by = COALESCE(sa.acknowledged_by, v_user_id),
        acknowledged_by_name = COALESCE(sa.acknowledged_by_name, v_user_name)
    WHERE sa.id = p_alert_id
      AND sa.status IN ('active', 'acknowledged');

    IF v_status = 'active' THEN
        INSERT INTO public.alert_audit_log (site_alert_id, action, details)
        VALUES (
            p_alert_id,
            'acknowledged',
            jsonb_build_object(
                'acknowledged_by', v_user_id,
                'acknowledged_by_name', v_user_name,
                'acknowledged_at', v_ack_at
            )
        );
    END IF;

    RETURN QUERY
    SELECT sa.id, sa.status, sa.acknowledged_at, sa.acknowledged_by, sa.acknowledged_by_name
    FROM public.site_alerts sa
    WHERE sa.id = p_alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_site_alert(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_site_alert(UUID) TO authenticated;

-- 8. Schedule Cron Jobs Safely (Unschedule any duplicate or legacy sensor-health jobs first)
DO $$
DECLARE
    v_job RECORD;
BEGIN
    PERFORM cron.unschedule('evaluate-sustained-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'evaluate-sustained-alerts');
    PERFORM cron.unschedule('sweep-stale-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-stale-alerts');
    PERFORM cron.unschedule('sensor-health-15m') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sensor-health-15m');

    FOR v_job IN
        SELECT jobid FROM cron.job WHERE command ILIKE '%evaluate_sensor_health%'
    LOOP
        PERFORM cron.unschedule(v_job.jobid);
    END LOOP;
END $$;

-- Run sustained evaluator every 5 minutes (evaluates 15m rolling window promptly)
SELECT cron.schedule('evaluate-sustained-alerts', '*/5 * * * *', 'SELECT public.evaluate_sustained_alerts()');
-- Run stale & malfunction sweeper every 5 minutes
SELECT cron.schedule('sweep-stale-alerts', '*/5 * * * *', 'SELECT public.sweep_stale_and_faulty_alerts()');
-- Run sensor health every 15 minutes
SELECT cron.schedule('sensor-health-15m', '*/15 * * * *', 'SELECT public.evaluate_sensor_health()');
