-- Migration: Alert Engine Cleanup, Site-Override Precedence & IAQ Tuning
-- Version: 059
-- Description: Removes duplicate device_offline creation (keeps job 43 as single source of truth),
--              enforces site-override precedence over global rules, deduplicates legacy alert_keys,
--              adds sanity bounds + 15m windows for remaining IAQ metrics, and schedules 5m instant alerts.

-- 0. Drop legacy overloaded evaluate_instant_alerts(uuid) & full unique index on alert_key
-- (Full unique index site_alerts_key_unique would block re-inserting an alert_key after it resolves)
DROP FUNCTION IF EXISTS public.evaluate_instant_alerts(uuid);
ALTER TABLE public.site_alerts DROP CONSTRAINT IF EXISTS site_alerts_key_unique;
DROP INDEX IF EXISTS public.site_alerts_key_unique;
DROP INDEX IF EXISTS public.idx_site_alerts_one_active_per_key;

-- 1. One-Time Cleanup of Active Duplicate & Superseded Alerts

-- 1a. Clear the 316 system.device_offline alerts (detect_offline_sensors job 43 owns offline alerting)
UPDATE public.site_alerts
SET status = 'resolved',
    resolved_at = now(),
    resolution_reason = 'superseded_by_connectivity_job'
WHERE metric = 'system.device_offline'
  AND status IN ('active', 'acknowledged');

-- 1b. Resolve open global-rule alerts on sites that have their own active site-specific override
UPDATE public.site_alerts sa
SET status = 'resolved',
    resolved_at = now(),
    resolution_reason = 'superseded_by_site_override'
FROM public.alert_rules global_r
WHERE sa.rule_id = global_r.id
  AND global_r.site_id IS NULL
  AND sa.status IN ('active', 'acknowledged')
  AND EXISTS (
      SELECT 1 FROM public.alert_rules site_r
      WHERE site_r.site_id = sa.site_id
        AND site_r.metric = global_r.metric
        AND site_r.severity = global_r.severity
        AND site_r.condition = global_r.condition
        AND site_r.is_active = true
  );

-- 1c. Deduplicate any open alerts sharing the same (site_id, device_id, rule_id) with different legacy alert_keys
WITH ranked_rule_alerts AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY site_id, device_id, rule_id
               ORDER BY triggered_at DESC, id DESC
           ) AS rn
    FROM public.site_alerts
    WHERE status IN ('active', 'acknowledged')
      AND device_id IS NOT NULL
      AND rule_id IS NOT NULL
)
UPDATE public.site_alerts
SET status = 'resolved',
    resolved_at = now(),
    resolution_reason = 'deduplicated_alert_key'
WHERE id IN (SELECT id FROM ranked_rule_alerts WHERE rn > 1);

-- Normalize alert_key on remaining open rule alerts so future upserts always match
UPDATE public.site_alerts
SET alert_key = concat(site_id, ':', device_id, ':', rule_id)
WHERE status IN ('active', 'acknowledged')
  AND device_id IS NOT NULL
  AND rule_id IS NOT NULL
  AND alert_key IS DISTINCT FROM concat(site_id, ':', device_id, ':', rule_id);

-- 1d. Escalate any open warning where a critical alert is already active for the same (device_id, metric)
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

-- 2. Tune Remaining IAQ Sanity Bounds, 15m Sustained Windows & Daily Rules
-- (iaq.co2 remains min=250, max=5000, duration=15 to catch broken NDIR calibration)

UPDATE public.alert_rules ar
SET min_valid_value = 0,
    max_valid_value = 20000,
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
WHERE ar.metric = 'iaq.voc';

UPDATE public.alert_rules ar
SET min_valid_value = 0,
    max_valid_value = 1000,
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
WHERE ar.metric IN ('iaq.pm25', 'iaq.pm10', 'iaq.o3');

-- Safety metric: keep instant (0m), add sanity bounds
UPDATE public.alert_rules
SET min_valid_value = 0, max_valid_value = 1000
WHERE metric = 'iaq.co';

-- Fix legacy global energy.daily_consumption row stuck at duration_minutes = 0
UPDATE public.alert_rules ar
SET duration_minutes = 1440
WHERE ar.metric = 'energy.daily_consumption'
  AND ar.duration_minutes = 0
  AND NOT EXISTS (
      SELECT 1 FROM public.alert_rules dup
      WHERE dup.metric = ar.metric
        AND dup.severity = ar.severity
        AND dup.condition = ar.condition
        AND dup.duration_minutes = 1440
        AND dup.site_id IS NOT DISTINCT FROM ar.site_id
  );

-- 3. Update Instant Alert Evaluator (Adds site-override precedence & excludes system.% rules)
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
        -- STEP A: Trigger valid, fresh breaches (site-specific rules override global defaults)
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
          AND ar.metric NOT LIKE 'system.%'
          -- Site-override precedence: ignore global rule if site defines its own
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
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(102);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(102);
END;
$$;

-- 4. Update Sustained Alert Evaluator (Adds site-override precedence, critical-first ordering, excludes system.%)
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
        -- Evaluate critical rules before warnings so simultaneous breaches never create phantom warnings
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
                  -- Site-override precedence: ignore global rule if site defines its own
                  AND (
                      v_rule.site_id IS NOT NULL
                      OR NOT EXISTS (
                          SELECT 1 FROM public.alert_rules sr
                          WHERE sr.site_id = c.site_id
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

-- 5. Update Stale & Malfunction Sweeper (Removes duplicate device_offline creation; keeps job 43 as single source of truth)
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

        -- C. Auto-resolve sensor_malfunction when all fresh readings return inside valid bounds OR device goes offline > 2h
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
    EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(104);
        RAISE;
    END;

    PERFORM pg_advisory_unlock(104);
END;
$$;

-- Re-assert strict permissions on updated functions
REVOKE ALL ON FUNCTION public.evaluate_instant_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_instant_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.evaluate_sustained_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_sustained_alerts() TO service_role;

REVOKE ALL ON FUNCTION public.sweep_stale_and_faulty_alerts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_stale_and_faulty_alerts() TO service_role;

-- 6. Cron Cleanup & 5-Minute Instant Alert Scheduling
DO $$
DECLARE
    v_job RECORD;
BEGIN
    -- Remove duplicate midnight reset job (job 14) and any prior instant-alert cron
    FOR v_job IN
        SELECT jobid FROM cron.job
        WHERE jobname = 'enterprise-health-reset'
           OR command ILIKE '%evaluate_instant_alerts%'
    LOOP
        PERFORM cron.unschedule(v_job.jobid);
    END LOOP;
END $$;

SELECT cron.schedule('evaluate-instant-alerts', '*/5 * * * *', 'SELECT public.evaluate_instant_alerts()');
