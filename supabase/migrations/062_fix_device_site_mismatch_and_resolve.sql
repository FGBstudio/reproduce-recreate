-- Migration: Fix Device-Site Mismatch & Trust-Score Resolution Blocking
-- Version: 062
-- Description: Resolves open alerts attached to a device's old site_id, syncs telemetry_latest/energy_latest/sensor_health
--              site_id from devices.site_id, updates evaluators to always use devices.site_id as single source of truth,
--              and ensures trust_score < 80 only blocks new triggers (never auto-resolution) without breaking 15m smoothing.

-- 1. One-Time Cleanup: Resolve open alerts whose device moved to another site (or no longer exists)
UPDATE public.site_alerts sa
SET status = 'resolved',
    resolved_at = now(),
    resolution_reason = 'device_moved_site'
WHERE sa.status IN ('active', 'acknowledged')
  AND sa.device_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = sa.device_id
        AND d.site_id = sa.site_id
  );

-- 2. Sync telemetry_latest, energy_latest, and sensor_health site_id to match devices.site_id
UPDATE public.telemetry_latest tl
SET site_id = d.site_id
FROM public.devices d
WHERE tl.device_id = d.id
  AND d.site_id IS NOT NULL
  AND tl.site_id IS DISTINCT FROM d.site_id;

UPDATE public.energy_latest el
SET site_id = d.site_id
FROM public.devices d
WHERE el.device_id = d.id
  AND d.site_id IS NOT NULL
  AND el.site_id IS DISTINCT FROM d.site_id;

UPDATE public.sensor_health sh
SET site_id = d.site_id
FROM public.devices d
WHERE sh.sensor_id = d.id
  AND d.site_id IS NOT NULL
  AND sh.site_id IS DISTINCT FROM d.site_id;

-- 3. Harden device-move trigger so it resolves BOTH active & acknowledged alerts and syncs downstream tables
CREATE OR REPLACE FUNCTION public.resolve_alerts_on_site_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.site_id IS DISTINCT FROM NEW.site_id) THEN
        UPDATE public.site_alerts
        SET status = 'resolved',
            resolved_at = NOW(),
            resolution_reason = 'device_moved_site',
            message = COALESCE(message, '') || ' (Device moved to another site)'
        WHERE device_id = NEW.id
          AND site_id IS DISTINCT FROM NEW.site_id
          AND status IN ('active', 'acknowledged');

        IF NEW.site_id IS NOT NULL THEN
            UPDATE public.telemetry_latest SET site_id = NEW.site_id WHERE device_id = NEW.id;
            UPDATE public.energy_latest SET site_id = NEW.site_id WHERE device_id = NEW.id;
            UPDATE public.sensor_health SET site_id = NEW.site_id WHERE sensor_id = NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Update evaluate_instant_alerts() to use devices.site_id (never stale telemetry_latest.site_id)
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
        -- STEP A: Trigger valid, fresh device breaches using devices.site_id
        INSERT INTO public.site_alerts (
            site_id, device_id, rule_id, metric, severity, status,
            message, value_at_trigger, current_value, threshold_value,
            triggered_at, alert_key, incident_group_key
        )
        SELECT
            d.site_id,
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
            concat(d.site_id, ':', l.device_id, ':', ar.id),
            concat(d.site_id, ':', split_part(l.metric, '.', 1))
        FROM (
            SELECT device_id, metric, value, ts FROM public.telemetry_latest
            UNION ALL
            SELECT device_id, metric, value, ts FROM public.energy_latest
        ) l
        JOIN public.devices d ON d.id = l.device_id
        JOIN public.alert_rules ar
            ON l.metric = ar.metric
            AND (ar.site_id IS NULL OR ar.site_id = d.site_id)
        LEFT JOIN public.sensor_health sh ON l.device_id = sh.sensor_id
        WHERE d.site_id IS NOT NULL
          AND ar.is_active = true
          AND ar.duration_minutes = 0
          AND ar.metric NOT LIKE 'system.%'
          AND (
              ar.site_id IS NOT NULL
              OR NOT EXISTS (
                  SELECT 1 FROM public.alert_rules sr
                  WHERE sr.site_id = d.site_id
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
        JOIN public.devices d ON d.id = l.device_id
        JOIN public.alert_rules ar ON l.metric = ar.metric
        WHERE sa.device_id = l.device_id
          AND sa.site_id = d.site_id
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

-- 5. Update evaluate_sustained_alerts() to use devices.site_id & never block auto-resolve on trust_score < 80
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
            WHERE is_active = true
              AND duration_minutes > 0
              AND duration_minutes < 1440
              AND metric NOT LIKE 'system.%'
            ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END
        LOOP
            FOR v_row IN
                SELECT
                    c.device_id,
                    d.site_id,
                    AVG(c.value)::numeric AS avg_val,
                    COUNT(*) AS sample_cnt,
                    COALESCE(MAX(sh.trust_score), 100) AS trust_score
                FROM (
                    SELECT device_id, value FROM public.telemetry
                    WHERE metric = v_rule.metric
                      AND ts > now() - (v_rule.duration_minutes || ' minutes')::INTERVAL
                    UNION ALL
                    SELECT device_id, value FROM public.energy_telemetry
                    WHERE metric = v_rule.metric
                      AND ts > now() - (v_rule.duration_minutes || ' minutes')::INTERVAL
                ) c
                JOIN public.devices d ON d.id = c.device_id
                LEFT JOIN public.sensor_health sh ON c.device_id = sh.sensor_id
                WHERE d.site_id IS NOT NULL
                  AND (v_rule.site_id IS NULL OR d.site_id = v_rule.site_id)
                  AND (
                      v_rule.site_id IS NOT NULL
                      OR NOT EXISTS (
                          SELECT 1 FROM public.alert_rules sr
                          WHERE sr.site_id = d.site_id
                            AND sr.metric = v_rule.metric
                            AND sr.severity = v_rule.severity
                            AND sr.condition = v_rule.condition
                            AND sr.is_active = true
                      )
                  )
                  AND c.value IS NOT NULL
                  AND c.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
                  AND (v_rule.min_valid_value IS NULL OR c.value >= v_rule.min_valid_value)
                  AND (v_rule.max_valid_value IS NULL OR c.value <= v_rule.max_valid_value)
                GROUP BY c.device_id, d.site_id
            LOOP
                IF (v_rule.condition IN ('>', '>=') AND (
                        (v_rule.condition = '>' AND v_row.avg_val > v_rule.threshold) OR
                        (v_rule.condition = '>=' AND v_row.avg_val >= v_rule.threshold)
                    )) OR
                   (v_rule.condition IN ('<', '<=') AND (
                        (v_rule.condition = '<' AND v_row.avg_val < v_rule.threshold) OR
                        (v_rule.condition = '<=' AND v_row.avg_val <= v_rule.threshold)
                    )) THEN

                    -- Only trigger/update if trust_score >= 80
                    IF v_row.trust_score < 80 THEN
                        CONTINUE;
                    END IF;

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
                    -- Always resolve when sustained average returns within hysteresis (even if trust_score < 80)
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

        -- Fallback resolution strictly when the sustained window had 0 samples (latest reading is between duration_minutes and 45m old)
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = 'returned_to_normal'
        FROM (
            SELECT device_id, metric, value, ts FROM public.telemetry_latest
            UNION ALL
            SELECT device_id, metric, value, ts FROM public.energy_latest
        ) l
        JOIN public.devices d ON d.id = l.device_id
        JOIN public.alert_rules ar ON l.metric = ar.metric
        WHERE sa.device_id = l.device_id
          AND sa.site_id = d.site_id
          AND sa.rule_id = ar.id
          AND sa.status IN ('active', 'acknowledged')
          AND ar.duration_minutes > 0
          AND ar.duration_minutes < 1440
          AND ar.metric NOT LIKE 'system.%'
          AND l.ts > now() - INTERVAL '45 minutes'
          AND l.ts <= now() - (ar.duration_minutes || ' minutes')::INTERVAL
          AND l.value IS NOT NULL
          AND l.value::float8 NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
          AND (ar.min_valid_value IS NULL OR l.value >= ar.min_valid_value)
          AND (ar.max_valid_value IS NULL OR l.value <= ar.max_valid_value)
          AND (
              (ar.condition IN ('>', '>=') AND l.value <= (ar.threshold - (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0)))) OR
              (ar.condition IN ('<', '<=') AND l.value >= (ar.threshold + (ar.threshold * (COALESCE(ar.hysteresis_pct, 0) / 100.0))))
          );
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(103);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(103);
END;
$$;

-- 6. Update sweep_stale_and_faulty_alerts() to use devices.site_id everywhere & catch moved devices
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
        -- A. Resolve metric alerts whose source sensor moved site or went silent beyond its offline window
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = CASE
                WHEN sa.site_id IS DISTINCT FROM d.site_id THEN 'device_moved_site'
                ELSE 'source_sensor_offline'
            END
        FROM public.devices d
        WHERE sa.device_id = d.id
          AND sa.status IN ('active', 'acknowledged')
          AND sa.metric NOT LIKE 'system.%'
          AND (
              sa.site_id IS DISTINCT FROM d.site_id
              OR COALESCE(
                  (SELECT GREATEST(
                      (SELECT MAX(ts) FROM public.telemetry_latest tl WHERE tl.device_id = sa.device_id),
                      (SELECT MAX(ts) FROM public.energy_latest el WHERE el.device_id = sa.device_id)
                  )),
                  '1970-01-01'::timestamptz
              ) < now() - CASE WHEN d.device_type = 'energy_monitor' THEN INTERVAL '4 hours' ELSE INTERVAL '2 hours' END
          );

        -- B. Resolve metric alerts & flag sensor_malfunction using devices.site_id
        WITH faulty_metrics AS (
            SELECT DISTINCT
                d.site_id,
                l.device_id,
                l.metric,
                CASE
                    WHEN l.value IS NULL OR l.value::float8 IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
                    THEN 0::numeric
                    ELSE l.value::numeric
                END AS safe_value,
                COALESCE(l.value::text, 'NULL') AS raw_text
            FROM (
                SELECT device_id, metric, value, ts FROM public.telemetry_latest
                UNION ALL
                SELECT device_id, metric, value, ts FROM public.energy_latest
            ) l
            JOIN public.devices d ON d.id = l.device_id
            JOIN public.alert_rules ar
                ON l.metric = ar.metric
                AND (ar.site_id IS NULL OR ar.site_id = d.site_id)
            WHERE d.site_id IS NOT NULL
              AND ar.is_active = true
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

        -- C. Auto-resolve sensor_malfunction when device moved site, went offline, or readings return inside bounds
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM public.devices d
                    WHERE d.id = sa.device_id AND d.site_id = sa.site_id
                ) THEN 'device_moved_site'
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
              NOT EXISTS (
                  SELECT 1 FROM public.devices d
                  WHERE d.id = sa.device_id AND d.site_id = sa.site_id
              )
              OR COALESCE(
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
                          SELECT device_id, metric, value, ts FROM public.telemetry_latest
                          UNION ALL
                          SELECT device_id, metric, value, ts FROM public.energy_latest
                      ) l
                      JOIN public.devices d ON d.id = l.device_id
                      JOIN public.alert_rules ar
                          ON l.metric = ar.metric
                          AND (ar.site_id IS NULL OR ar.site_id = d.site_id)
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

        -- E. Auto-resolve mirrored system health alerts when sensor_health recovers (or device becomes virtual / moved)
        UPDATE public.site_alerts sa
        SET status = 'resolved',
            resolved_at = now(),
            resolution_reason = CASE
                WHEN sa.site_id IS DISTINCT FROM d.site_id THEN 'device_moved_site'
                WHEN sa.metric LIKE 'system.connectivity%' THEN 'device_reconnected'
                ELSE 'returned_to_normal'
            END
        FROM public.sensor_health sh
        JOIN public.devices d ON d.id = sh.sensor_id
        WHERE sa.device_id = sh.sensor_id
          AND sa.status IN ('active', 'acknowledged')
          AND sa.metric IN ('system.connectivity', 'system.connectivity_energy', 'system.data_quality')
          AND (
              sa.site_id IS DISTINCT FROM d.site_id
              OR COALESCE((d.metadata->>'virtual')::boolean, false) = true
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

-- Re-assert strict permissions
REVOKE ALL ON FUNCTION public.evaluate_instant_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_instant_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.evaluate_sustained_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_sustained_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.sweep_stale_and_faulty_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_and_faulty_alerts() TO service_role;
