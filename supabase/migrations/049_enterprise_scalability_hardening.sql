-- Migration: Enterprise Scalability Hardening
-- Version: 049
-- Description: Implement concurrency locks (advisory locks) and alert archiving strategy.

-- =============================================================================
-- 1. Create Archive Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.site_alerts_history (
    id UUID PRIMARY KEY,
    site_id UUID,
    device_id UUID,
    rule_id UUID,
    metric TEXT,
    severity TEXT,
    status TEXT,
    message TEXT,
    value_at_trigger NUMERIC,
    triggered_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    alert_key TEXT,
    metadata JSONB,
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sah_site_id ON public.site_alerts_history(site_id);
CREATE INDEX IF NOT EXISTS idx_sah_resolved_at ON public.site_alerts_history(resolved_at);

-- =============================================================================
-- 2. Archiving Logic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.archive_resolved_alerts(p_retention_days INTEGER DEFAULT 7)
RETURNS void AS $$
BEGIN
    -- Move resolved alerts older than X days to history
    INSERT INTO public.site_alerts_history (
        id, site_id, device_id, rule_id, metric, severity, status, 
        message, value_at_trigger, triggered_at, resolved_at, alert_key, metadata
    )
    SELECT 
        id, site_id, device_id, rule_id, metric, severity, status, 
        message, value_at_trigger, triggered_at, resolved_at, alert_key, metadata
    FROM public.site_alerts
    WHERE status = 'resolved' AND resolved_at < (now() - (p_retention_days || ' days')::interval);

    -- Delete moved rows
    DELETE FROM public.site_alerts
    WHERE status = 'resolved' AND resolved_at < (now() - (p_retention_days || ' days')::interval);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. Hardened Evaluation Functions (Advisory Locks)
-- =============================================================================

-- A. Hardened Health Engine
CREATE OR REPLACE FUNCTION public.evaluate_sensor_health()
RETURNS void AS $$
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
    v_health_msg TEXT;
    v_prev_flatline_start TIMESTAMPTZ;
    v_flatline_duration_hours FLOAT;
    v_dynamic_score INTEGER;
BEGIN
    -- [CONCURRENCY LOCK] ID 101: Sensor Health
    IF NOT pg_try_advisory_lock(101) THEN
        RAISE WARNING 'evaluate_sensor_health is already running. Skipping this cycle.';
        RETURN;
    END IF;

    FOR v_device IN SELECT id, site_id, device_type, name FROM public.devices LOOP
        -- A. Fetch Sample Count
        SELECT COALESCE(MAX(sample_count), 0) INTO v_sample_count
        FROM (
            SELECT sample_count FROM public.telemetry_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
            UNION ALL
            SELECT sample_count FROM public.energy_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
        ) s;

        -- B. Check for Flatlining
        v_is_flatline := false;
        v_flatline_metadata := NULL;
        SELECT jsonb_build_object('metric', metric, 'value', value_max, 'samples', sample_count) INTO v_flatline_metadata
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
        ) f LIMIT 1;
        IF v_flatline_metadata IS NOT NULL THEN v_is_flatline := true; END IF;

        -- C. Get Previous Flatline State
        SELECT flatline_started_at INTO v_prev_flatline_start 
        FROM public.sensor_health WHERE sensor_id = v_device.id;

        -- D. Manage Flatline Start Timestamp
        IF v_is_flatline THEN
            IF v_prev_flatline_start IS NULL THEN
                v_prev_flatline_start := now(); 
            END IF;
        ELSE
            v_prev_flatline_start := NULL; 
        END IF;

        -- E. Pull Actual Last Seen
        IF v_device.device_type = 'energy_monitor' THEN
            SELECT MAX(ts) INTO v_actual_last_seen FROM public.energy_latest WHERE device_id = v_device.id;
        ELSE
            SELECT MAX(ts) INTO v_actual_last_seen FROM public.telemetry_latest WHERE device_id = v_device.id;
        END IF;

        -- F. Base Statuses
        v_new_offline := (v_sample_count = 0) OR CASE 
            WHEN v_device.device_type = 'air_quality' THEN (v_actual_last_seen IS NULL OR v_actual_last_seen < now() - INTERVAL '30 minutes')
            ELSE (v_actual_last_seen IS NULL OR v_actual_last_seen < now() - INTERVAL '4 hours')
        END;
        v_new_flapping := CASE WHEN NOT v_new_offline AND v_sample_count BETWEEN 1 AND 2 THEN 1 ELSE 0 END;
        
        -- G. Packet Loss Logic
        IF v_new_offline THEN v_packet_loss := 100.0;
        ELSE v_packet_loss := GREATEST(0.0, LEAST(100.0, (1.0 - (v_sample_count::float / 4.0)) * 100.0));
        END IF;

        -- H. Dynamic Trust Score Calculation
        IF v_new_offline THEN v_dynamic_score := 0;
        ELSIF v_is_flatline THEN
            v_flatline_duration_hours := EXTRACT(EPOCH FROM (now() - v_prev_flatline_start)) / 3600.0;
            v_dynamic_score := GREATEST(20, ROUND(80 - (v_flatline_duration_hours * 20)))::integer;
        ELSIF v_packet_loss > 0 THEN
            v_dynamic_score := (100 - v_packet_loss)::integer;
        ELSE v_dynamic_score := 100;
        END IF;

        -- I. Upsert Diagnostic Snapshot
        INSERT INTO public.sensor_health (
            sensor_id, site_id, last_seen, is_offline, is_flatlining, is_degraded, 
            health_message, flapping_count_24h, packet_loss_pct, trust_score, 
            flatline_started_at, last_evaluated_at, metadata
        )
        VALUES (
            v_device.id, v_device.site_id, v_actual_last_seen, v_new_offline, v_is_flatline, (v_packet_loss > 0),
            CASE WHEN v_new_offline THEN 'Offline' WHEN v_is_flatline THEN 'Flattening' ELSE 'Healthy' END,
            v_new_flapping, v_packet_loss, v_dynamic_score, v_prev_flatline_start, now(), '{}'
        )
        ON CONFLICT (sensor_id) DO UPDATE SET 
            trust_score = EXCLUDED.trust_score,
            flatline_started_at = EXCLUDED.flatline_started_at,
            last_evaluated_at = now();
    END LOOP;

    PERFORM pg_advisory_unlock(101);
END;
$$ LANGUAGE plpgsql;

-- B. Hardened Alert Engine
CREATE OR REPLACE FUNCTION public.evaluate_instant_alerts()
RETURNS void AS $$
BEGIN
    -- [CONCURRENCY LOCK] ID 102: Instant Alerts
    IF NOT pg_try_advisory_lock(102) THEN
        RAISE WARNING 'evaluate_instant_alerts is already running. Skipping this cycle.';
        RETURN;
    END IF;

    -- 1. [IAQ/Energy Threshold Execution]
    INSERT INTO public.site_alerts (site_id, device_id, rule_id, metric, severity, status, message, value_at_trigger, triggered_at, alert_key)
    SELECT DISTINCT ON (d.site_id, l.device_id, l.metric)
        d.site_id, l.device_id, r.id, l.metric, r.severity, 'active',
        COALESCE(r.message_template, 'Threshold breach: ' || l.metric),
        l.value, now(),
        concat(d.site_id, ':', l.device_id, ':', l.metric)
    FROM (
        SELECT device_id, metric, value FROM public.telemetry_latest UNION ALL
        SELECT device_id, metric, value FROM public.energy_latest
    ) l
    JOIN public.devices d ON d.id = l.device_id
    JOIN public.alert_rules r ON l.metric = r.metric AND (r.site_id IS NULL OR r.site_id = d.site_id)
    WHERE r.enabled = true AND d.site_id IS NOT NULL AND r.duration_minutes = 0
      AND (
          (r.condition = '>' AND l.value > r.threshold) OR 
          (r.condition = '<' AND l.value < r.threshold)
      )
    ORDER BY d.site_id, l.device_id, l.metric, severity ASC
    ON CONFLICT (alert_key) DO UPDATE SET 
        status = 'active', resolved_at = NULL, value_at_trigger = EXCLUDED.value_at_trigger;

    -- 2. [Site-Wide Virtual Metrics] (EUI Benchmark)
    INSERT INTO public.site_alerts (site_id, device_id, rule_id, metric, severity, status, message, value_at_trigger, triggered_at, alert_key)
    SELECT DISTINCT ON (s.site_id, r.metric)
        s.site_id, s.site_id, r.id, r.metric, r.severity, 'active',
        r.message_template,
        s.value, now(),
        concat(s.site_id, ':', s.site_id, ':', r.metric)
    FROM (
        SELECT site_id, metric, value FROM public.site_kpis 
        WHERE (site_id, metric, ts) IN (SELECT site_id, metric, MAX(ts) FROM public.site_kpis GROUP BY 1, 2)
    ) s
    JOIN public.alert_rules r ON r.metric = s.metric AND (r.site_id IS NULL OR r.site_id = s.site_id)
    WHERE r.enabled = true AND r.duration_minutes = 0
      AND (
          (r.condition = '>' AND s.value > r.threshold) OR 
          (r.condition = '<' AND s.value < r.threshold)
      )
    ORDER BY s.site_id, r.metric, severity ASC
    ON CONFLICT (alert_key) DO UPDATE SET 
        status = 'active', resolved_at = NULL, value_at_trigger = EXCLUDED.value_at_trigger;

    -- 3. [Mirror System Health]
    INSERT INTO public.site_alerts (site_id, device_id, rule_id, metric, severity, status, message, value_at_trigger, triggered_at, alert_key)
    SELECT DISTINCT ON (d.site_id, sh.sensor_id, l.m_name)
        d.site_id, sh.sensor_id, r.id, l.m_name, r.severity, 'active',
        COALESCE(sh.health_message, 'System Health Alert'),
        CASE WHEN l.m_name = 'system.data_quality' THEN sh.packet_loss_pct ELSE 0 END,
        now(),
        concat(d.site_id, ':', sh.sensor_id, ':', l.m_name)
    FROM public.sensor_health sh
    JOIN public.devices d ON d.id = sh.sensor_id
    CROSS JOIN LATERAL (
        VALUES 
            (CASE WHEN d.device_type = 'air_quality' THEN 'system.connectivity' ELSE 'system.connectivity_energy' END),
            ('system.data_quality')
    ) l(m_name)
    JOIN public.alert_rules r ON r.metric = l.m_name AND (r.site_id = d.site_id OR r.site_id IS NULL)
    WHERE r.enabled = true AND d.site_id IS NOT NULL
      AND (
          (l.m_name LIKE 'system.connectivity%' AND sh.is_offline) OR
          (l.m_name = 'system.data_quality' AND NOT sh.is_offline AND (sh.is_flatlining OR sh.is_degraded))
      )
    ORDER BY d.site_id, sh.sensor_id, l.m_name, r.site_id DESC
    ON CONFLICT (alert_key) DO UPDATE SET 
        status = 'active', resolved_at = NULL, severity = EXCLUDED.severity, message = EXCLUDED.message;

    -- 4. [Auto-Resolve]
    UPDATE public.site_alerts sa
    SET status = 'resolved', resolved_at = now()
    WHERE sa.status = 'active'
      AND NOT EXISTS (
          SELECT 1 FROM public.alert_rules r 
          JOIN (SELECT device_id as id, metric, value FROM public.telemetry_latest UNION ALL SELECT device_id as id, metric, value FROM public.energy_latest) cur 
          ON cur.id = sa.device_id AND cur.metric = sa.metric
          WHERE (r.metric = sa.metric AND (r.id = sa.rule_id OR sa.rule_id IS NULL))
            AND ( (r.condition IN ('>', '>=') AND cur.value > (r.threshold - (r.threshold * (r.hysteresis_pct / 100.0))))
               OR (r.condition IN ('<', '<=') AND cur.value < (r.threshold + (r.threshold * (r.hysteresis_pct / 100.0)))) )
      )
      AND sa.metric NOT LIKE 'system.%'; -- Hardware uses mirror logic

    UPDATE public.site_alerts sa
    SET status = 'resolved', resolved_at = now()
    FROM public.sensor_health sh
    WHERE sa.device_id = sh.sensor_id AND sa.status = 'active' AND sa.metric LIKE 'system.%'
      AND NOT (
          (sa.metric LIKE 'system.connectivity%' AND sh.is_offline) OR
          (sa.metric = 'system.data_quality' AND NOT sh.is_offline AND (sh.is_flatlining OR sh.is_degraded))
      );

    PERFORM pg_advisory_unlock(102);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 4. Scheduling
-- =============================================================================

-- Weekly Archiving (Sunday at 2 AM)
SELECT cron.schedule('weekly-alert-archive', '0 2 * * 0', $$SELECT public.archive_resolved_alerts(7)$$);
