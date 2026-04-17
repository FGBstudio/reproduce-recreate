-- Migration: Sustained Alert Logic
-- Version: 043
-- Description: Implements the 15-minute rolling average logic for sustained breaches (Peak Power, etc.)

CREATE OR REPLACE FUNCTION public.evaluate_sustained_alerts()
RETURNS void AS $$
DECLARE
    v_rule RECORD;
    v_avg_value NUMERIC;
    v_site_id UUID;
    v_device_id UUID;
BEGIN
    -- Loop through all active SUSTAINED rules (duration_minutes > 0)
    FOR v_rule IN 
        SELECT * FROM public.alert_rules 
        WHERE is_active = true AND duration_minutes > 0
    LOOP
        -- Calculate rolling average for each device/metric combination in the last N minutes
        -- This logic handles both IAQ (telemetry) and Energy (energy_telemetry)
        FOR v_device_id, v_site_id, v_avg_value IN
            SELECT 
                device_id, 
                site_id,
                AVG(value) as avg_val
            FROM (
                SELECT device_id, site_id, value FROM public.telemetry 
                WHERE metric = v_rule.metric AND ts > now() - (v_rule.duration_minutes || ' minutes')::INTERVAL
                UNION ALL
                SELECT device_id, site_id, value FROM public.energy_telemetry 
                WHERE metric = v_rule.metric AND ts > now() - (v_rule.duration_minutes || ' minutes')::INTERVAL
            ) combined
            GROUP BY device_id, site_id
        LOOP
            -- 1. TRIGGER BREACH
            IF (v_rule.condition = '>' AND v_avg_value > v_rule.threshold) OR
               (v_rule.condition = '<' AND v_avg_value < v_rule.threshold) THEN
                
                INSERT INTO public.site_alerts (site_id, device_id, rule_id, metric, severity, status, message, value_at_trigger, triggered_at, alert_key)
                VALUES (
                    v_site_id, v_device_id, v_rule.id, v_rule.metric, v_rule.severity, 'active',
                    v_rule.message_template || ' (Sustained ' || v_rule.duration_minutes || 'm Avg: ' || ROUND(v_avg_value, 2) || ')',
                    v_avg_value, now(),
                    concat(v_site_id, ':', v_device_id, ':', v_rule.id)
                )
                ON CONFLICT (alert_key) WHERE status = 'active' DO UPDATE 
                SET current_value = EXCLUDED.value_at_trigger,
                    triggered_at = now(); -- Keep it fresh

            -- 2. RESOLVE BREACH (with Hysteresis)
            ELSE
                UPDATE public.site_alerts sa
                SET status = 'resolved',
                    resolved_at = now()
                WHERE sa.alert_key = concat(v_site_id, ':', v_device_id, ':', v_rule.id)
                  AND sa.status IN ('active', 'acknowledged')
                  AND (
                      (v_rule.condition = '>' AND v_avg_value <= (v_rule.threshold - (v_rule.threshold * (v_rule.hysteresis_pct / 100.0)))) OR
                      (v_rule.condition = '<' AND v_avg_value >= (v_rule.threshold + (v_rule.threshold * (v_rule.hysteresis_pct / 100.0))))
                  );
            END IF;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule the sustained evaluator every 15 minutes
-- This aligns with standard utility demand-charge windows
SELECT cron.schedule('evaluate-sustained-alerts', '*/15 * * * *', 'SELECT public.evaluate_sustained_alerts()');

GRANT EXECUTE ON FUNCTION public.evaluate_sustained_alerts TO service_role;
