-- Migration: Enterprise Alert Engine
-- Version: 042
-- Description: Unified rules engine for IAQ, Energy, and Water with high-performance micro-batching

-- 1. Create the Master Rules Table
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE, -- Null means global default
    metric TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
    condition TEXT CHECK (condition IN ('>', '<', '>=', '<=', 'outside_range')),
    threshold NUMERIC NOT NULL,
    hysteresis_pct NUMERIC DEFAULT 5.0,
    duration_minutes INTEGER DEFAULT 0, -- 0 = Instant, 15 = Sustained, 1440 = Daily
    building_type TEXT, -- e.g. 'office', 'retail'
    message_template TEXT,
    recommendation_template TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Unique constraint that handles NULL site_id correctly
    UNIQUE(metric, severity, site_id)
);

-- 2. Upgrade the EXISTING tables (Non-destructive)
DO $$ 
BEGIN
    -- UPGRADE alert_rules
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alert_rules' AND column_name='hysteresis_pct') THEN
        ALTER TABLE public.alert_rules ADD COLUMN hysteresis_pct NUMERIC DEFAULT 5.0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alert_rules' AND column_name='building_type') THEN
        ALTER TABLE public.alert_rules ADD COLUMN building_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='alert_rules' AND column_name='message_template') THEN
        ALTER TABLE public.alert_rules ADD COLUMN message_template TEXT;
    END IF;

    -- UPGRADE site_alerts
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_alerts' AND column_name='rule_id') THEN
        ALTER TABLE public.site_alerts ADD COLUMN rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_alerts' AND column_name='value_at_trigger') THEN
        ALTER TABLE public.site_alerts ADD COLUMN value_at_trigger NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_alerts' AND column_name='alert_key') THEN
        ALTER TABLE public.site_alerts ADD COLUMN alert_key TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='site_alerts' AND column_name='status') THEN
        ALTER TABLE public.site_alerts ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved'));
    END IF;
END $$;

-- 3. Audit Log for traceability
CREATE TABLE IF NOT EXISTS public.alert_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_alert_id UUID REFERENCES public.site_alerts(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'triggered', 'acknowledged', 'resolved'
    details JSONB,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Logic: Instant Alert Evaluator (Micro-Batching - 1 min)
CREATE OR REPLACE FUNCTION public.evaluate_instant_alerts()
RETURNS void AS $$
BEGIN
    -- STEP A: TRIGGER NEW BREACHES
    -- We join latest tables with rules, filtering for healthy sensors (Trust Layer)
    -- STEP A: TRIGGER NEW BREACHES
    INSERT INTO public.site_alerts (site_id, device_id, rule_id, metric, severity, status, message, value_at_trigger, triggered_at, alert_key)
    SELECT 
        l.site_id,
        l.device_id,
        ar.id as rule_id,
        l.metric,
        ar.severity,
        'active',
        COALESCE(ar.message_template, 'Threshold breach on ' || l.metric),
        l.value as value_at_trigger,
        now(),
        concat(l.site_id, ':', l.device_id, ':', ar.id) as alert_key
    FROM (
        SELECT site_id, device_id, metric, value, ts FROM public.telemetry_latest
        UNION ALL
        SELECT site_id, device_id, metric, value, ts FROM public.energy_latest
    ) l
    JOIN public.alert_rules ar 
        ON l.metric = ar.metric 
        AND (ar.site_id IS NULL OR ar.site_id = l.site_id)
    LEFT JOIN public.sensor_health sh ON l.device_id = sh.sensor_id
    WHERE ar.enabled = true 
      AND ar.duration_minutes = 0
      AND (sh.trust_score IS NULL OR sh.trust_score >= 80)
      AND (
          (ar.condition = '>' AND l.value > ar.threshold) OR
          (ar.condition = '<' AND l.value < ar.threshold) OR
          (ar.condition = '>=' AND l.value >= ar.threshold) OR
          (ar.condition = '<=' AND l.value <= ar.threshold)
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.site_alerts sa 
          WHERE sa.alert_key = concat(l.site_id, ':', l.device_id, ':', ar.id)
            AND sa.status IN ('active', 'acknowledged')
      )
    ON CONFLICT DO NOTHING;

    -- STEP B: RESOLVE BREACHES (Hysteresis)
    -- Note: Included >= and <= rules.
    UPDATE public.site_alerts sa
    SET status = 'resolved', 
        resolved_at = now()
    FROM (
        SELECT device_id, metric, value FROM public.telemetry_latest
        UNION ALL
        SELECT device_id, metric, value FROM public.energy_latest
    ) l
    JOIN public.alert_rules ar ON l.metric = ar.metric
    WHERE sa.device_id = l.device_id 
      AND sa.rule_id = ar.id
      AND sa.status IN ('active', 'acknowledged')
      AND (
          -- Resolves > and >= 
          (ar.condition IN ('>', '>=') AND l.value <= (ar.threshold - (ar.threshold * (ar.hysteresis_pct / 100.0)))) OR
          -- Resolves < and <=
          (ar.condition IN ('<', '<=') AND l.value >= (ar.threshold + (ar.threshold * (ar.hysteresis_pct / 100.0))))
      );
END;
$$ LANGUAGE plpgsql;

-- 5. Logic: Daily Alert Evaluator (Budget/EUI)
CREATE OR REPLACE FUNCTION public.evaluate_daily_alerts()
RETURNS void AS $$
BEGIN
    INSERT INTO public.site_alerts (site_id, device_id, rule_id, metric, severity, status, message, value_at_trigger, triggered_at, alert_key)
    SELECT 
        d.site_id,
        d.device_id,
        ar.id as rule_id,
        d.metric,
        ar.severity,
        'active',
        'Daily budget exceeded for ' || d.metric,
        d.value_sum,
        now(),
        concat(d.site_id, ':', d.device_id, ':', ar.id) as alert_key
    FROM (
        SELECT site_id, device_id, metric, value_sum FROM public.telemetry_daily WHERE ts_day = CURRENT_DATE - 1
        UNION ALL
        SELECT site_id, device_id, metric, value_sum FROM public.energy_daily WHERE ts_day = CURRENT_DATE - 1
    ) d
    JOIN public.alert_rules ar 
        ON d.metric = ar.metric 
        AND (ar.site_id IS NULL OR ar.site_id = d.site_id)
    WHERE ar.is_active = true 
      AND ar.duration_minutes = 1440 -- Marker for daily rules
      AND d.value_sum > ar.threshold
      -- Use concat() for NULL safety in deduplication
      AND NOT EXISTS (
          SELECT 1 FROM public.site_alerts sa 
          WHERE sa.alert_key = concat(d.site_id, ':', d.device_id, ':', ar.id)
            AND sa.status IN ('active', 'acknowledged')
            AND sa.triggered_at > now() - INTERVAL '24 hours'
      );
END;
$$ LANGUAGE plpgsql;

-- 6. Indices & Maintenance
CREATE INDEX IF NOT EXISTS idx_site_alerts_active_key ON public.site_alerts (alert_key) WHERE status = 'active';

-- Clean up any existing triggers to make fresh start for Micro-Batching
DROP TRIGGER IF EXISTS tr_process_telemetry_alerts ON public.telemetry_latest;
DROP TRIGGER IF EXISTS trg_evaluate_alerts ON public.telemetry_latest;

-- 7. Rule Seeding (Defaults)
INSERT INTO public.alert_rules (metric, severity, condition, threshold, hysteresis_pct, message_template)
SELECT * FROM (VALUES 
    ('iaq.co2', 'warning', '>', 900.0, 5.0, 'CO₂ is elevated (> 900 ppm)'),
    ('iaq.co2', 'critical', '>', 1200.0, 5.0, 'CO₂ is critical (> 1200 ppm)'),
    ('energy.power_kw', 'critical', '>', 100.0, 5.0, 'Peak Power exceeds 100kW limit'),
    ('energy.daily_consumption', 'warning', '>', 500.0, 0.0, 'Daily energy budget exceeded')
) AS v(metric, severity, condition, threshold, hysteresis_pct, message_template)
WHERE NOT EXISTS (
    SELECT 1 FROM public.alert_rules ar 
    WHERE ar.metric = v.metric 
      AND ar.severity = v.severity 
      AND ar.site_id IS NULL
);

GRANT EXECUTE ON FUNCTION public.evaluate_instant_alerts TO service_role;
GRANT EXECUTE ON FUNCTION public.evaluate_daily_alerts TO service_role;
