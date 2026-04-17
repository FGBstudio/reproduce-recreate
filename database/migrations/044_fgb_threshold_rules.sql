-- Migration: FGB Threshold Rules and Cron Setup
-- Version: 044
-- Description: Seeds the FGB environmental thresholds into the DB and activates the instant alert cron job

-- 1. Seed FGB Studio Rules for Temperature
INSERT INTO public.alert_rules (metric, severity, condition, threshold, hysteresis_pct, message_template)
SELECT * FROM (VALUES 
    -- Temperature Warning (Moderate)
    ('env.temperature', 'warning', '>', 25.0, 2.0, 'Temperature slightly high (> 25°C)'),
    ('env.temperature', 'warning', '<', 20.0, 2.0, 'Temperature slightly low (< 20°C)'),
    -- Temperature Critical (Poor)
    ('env.temperature', 'critical', '>', 27.0, 2.0, 'Temperature critically high (> 27°C)'),
    ('env.temperature', 'critical', '<', 18.0, 2.0, 'Temperature critically low (< 18°C)'),

    -- Humidity Warning (Moderate)
    ('env.humidity', 'warning', '>', 60.0, 5.0, 'Humidity slightly high (> 60%)'),
    ('env.humidity', 'warning', '<', 40.0, 5.0, 'Humidity slightly low (< 40%)'),
    -- Humidity Critical (Poor)
    ('env.humidity', 'critical', '>', 70.0, 5.0, 'Humidity critically high (> 70%)'),
    ('env.humidity', 'critical', '<', 30.0, 5.0, 'Humidity critically low (< 30%)')
) AS v(metric, severity, condition, threshold, hysteresis_pct, message_template)
WHERE NOT EXISTS (
    SELECT 1 FROM public.alert_rules ar 
    WHERE ar.metric = v.metric 
      AND ar.severity = v.severity 
      AND ar.condition = v.condition
      AND ar.site_id IS NULL
);

-- 2. Schedule the continuous Instant Alert rule checker to run every minute
SELECT cron.schedule(
    'enterprise-instant-alerts', 
    '* * * * *', 
    'SELECT public.evaluate_instant_alerts()'
);
