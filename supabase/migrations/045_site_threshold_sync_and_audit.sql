-- Migration: Site Threshold Sync (Comprehensive IAQ & Dynamic Health)
-- Version: 045.9.2
-- Description: Pure SQL Set-Based synchronization with Condition-Aware Conflict Targeting.

-- =============================================================================
-- 1. Schema Expansion
-- =============================================================================
ALTER TABLE public.site_thresholds 
ADD COLUMN IF NOT EXISTS air_voc_warning_ppb NUMERIC,
ADD COLUMN IF NOT EXISTS air_voc_critical_ppb NUMERIC,
ADD COLUMN IF NOT EXISTS air_pm25_warning_ugm3 NUMERIC,
ADD COLUMN IF NOT EXISTS air_pm25_critical_ugm3 NUMERIC,
ADD COLUMN IF NOT EXISTS air_pm10_warning_ugm3 NUMERIC,
ADD COLUMN IF NOT EXISTS air_pm10_critical_ugm3 NUMERIC,
ADD COLUMN IF NOT EXISTS air_co_warning_ppm NUMERIC,
ADD COLUMN IF NOT EXISTS air_co_critical_ppm NUMERIC,
ADD COLUMN IF NOT EXISTS air_o3_warning_ppb NUMERIC,
ADD COLUMN IF NOT EXISTS air_o3_critical_ppb NUMERIC,
ADD COLUMN IF NOT EXISTS connectivity_offline_threshold_min INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS connectivity_offline_threshold_energy_min INTEGER DEFAULT 240,
ADD COLUMN IF NOT EXISTS energy_target_eui_kwh_m2 NUMERIC DEFAULT 200;

-- =============================================================================
-- 2. Pure Set-Based Sync Logic (Condition-Aware)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_site_settings_to_rules(p_site_id UUID)
RETURNS void AS $$
BEGIN
    -- [IAQ: CO2]
    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'iaq.co2', 'warning', '>', air_co2_warning_ppm, 0, 'CO₂ is elevated'
    FROM public.site_thresholds WHERE site_id = p_site_id AND air_co2_warning_ppm IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'iaq.co2', 'critical', '>', air_co2_critical_ppm, 0, 'CO₂ is CRITICAL'
    FROM public.site_thresholds WHERE site_id = p_site_id AND air_co2_critical_ppm IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    -- [IAQ: TVOC]
    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'iaq.voc', 'warning', '>', air_voc_warning_ppb, 0, 'VOC is elevated'
    FROM public.site_thresholds WHERE site_id = p_site_id AND air_voc_warning_ppb IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    -- [IAQ: PM2.5]
    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'iaq.pm25', 'warning', '>', air_pm25_warning_ugm3, 0, 'PM2.5 is high'
    FROM public.site_thresholds WHERE site_id = p_site_id AND air_pm25_warning_ugm3 IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    -- [IAQ: PM10]
    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'iaq.pm10', 'warning', '>', air_pm10_warning_ugm3, 0, 'PM10 is high'
    FROM public.site_thresholds WHERE site_id = p_site_id AND air_pm10_warning_ugm3 IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    -- [ENV: Temp]
    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'env.temperature', 'warning', '>', air_temp_max_c, 0, 'Temperature is high'
    FROM public.site_thresholds WHERE site_id = p_site_id AND air_temp_max_c IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'energy.power_kw', 'critical', '>', energy_power_limit_kw, 0, 'Power limit exceeded'
    FROM public.site_thresholds WHERE site_id = p_site_id AND energy_power_limit_kw IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    -- [ENERGY: EUI Benchmark]
    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'energy.eui', 'warning', '>', energy_target_eui_kwh_m2, 0, 'Site EUI exceeds benchmark'
    FROM public.site_thresholds WHERE site_id = p_site_id AND energy_target_eui_kwh_m2 IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    -- [HEALTH: Connectivity]
    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'system.connectivity', 'critical', '>', connectivity_offline_threshold_min, 0, 'Air Sensor is OFFLINE'
    FROM public.site_thresholds WHERE site_id = p_site_id AND connectivity_offline_threshold_min IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;

    INSERT INTO public.alert_rules (site_id, metric, severity, condition, threshold, duration_minutes, message_template)
    SELECT site_id, 'system.connectivity_energy', 'critical', '>', connectivity_offline_threshold_energy_min, 0, 'Energy Meter is OFFLINE'
    FROM public.site_thresholds WHERE site_id = p_site_id AND connectivity_offline_threshold_energy_min IS NOT NULL
    ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE SET threshold = EXCLUDED.threshold;
END;
$$ LANGUAGE plpgsql;

-- Trigger logic remains the same (calls the updated function)
CREATE OR REPLACE FUNCTION public.tr_sync_site_rules_hardened()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        PERFORM public.sync_site_settings_to_rules(NEW.site_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Alert sync failed for site %: %', NEW.site_id, SQLERRM;
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_site_threshold_sync ON public.site_thresholds;
CREATE TRIGGER tr_site_threshold_sync
AFTER INSERT OR UPDATE ON public.site_thresholds
FOR EACH ROW EXECUTE FUNCTION public.tr_sync_site_rules_hardened();

ALTER TABLE public.site_thresholds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Site members can manage thresholds" ON public.site_thresholds;
CREATE POLICY "Site members can manage thresholds"
    ON public.site_thresholds FOR ALL 
    TO authenticated
    USING (public.can_access_site(auth.uid(), site_id) OR public.is_admin(auth.uid()));
