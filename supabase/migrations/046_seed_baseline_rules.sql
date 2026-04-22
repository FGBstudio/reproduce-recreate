-- Migration: Seed Master Architect Baseline Rules (Dynamic Health Version)
-- Version: 046.5.1
-- Description: Non-destructive seeding with Condition-Aware Conflict Targeting.

-- 1. Seed Global Defaults
INSERT INTO public.alert_rules (metric, severity, condition, threshold, hysteresis_pct, duration_minutes, message_template, recommendation_template)
VALUES 
    -- [IAQ: CO2]
    ('iaq.co2', 'warning', '>', 800, 2, 0, 'CO₂ is Moderate (> 800 ppm)', 'Check ventilation.'),
    ('iaq.co2', 'critical', '>', 1000, 2, 0, 'CO₂ is POOR (> 1000 ppm)', 'Immediate ventilation required.'),
    
    -- [IAQ: TVOC]
    ('iaq.voc', 'warning', '>', 300, 5, 0, 'VOC levels are Moderate (> 300 ppb)', 'Check for pollutants.'),
    ('iaq.voc', 'critical', '>', 500, 5, 0, 'VOC levels are POOR (> 500 ppb)', 'Ventilate area.'),

    -- [IAQ: PMs & Gases]
    ('iaq.pm25', 'warning', '>', 15, 5, 0, 'PM2.5 is Moderate (> 15 µg/m³)', 'Check filtration.'),
    ('iaq.pm25', 'critical', '>', 35, 5, 0, 'PM2.5 is POOR (> 35 µg/m³)', 'High particulate count.'),
    ('iaq.pm10', 'warning', '>', 25, 5, 0, 'PM10 is Moderate (> 25 µg/m³)', 'Check air intake.'),
    ('iaq.pm10', 'critical', '>', 50, 5, 0, 'PM10 is POOR (> 50 µg/m³)', 'Elevated dust levels.'),
    ('iaq.co', 'warning', '>', 4, 5, 0, 'Carbon Monoxide is Moderate (> 4 ppm)', 'Check heating sources.'),
    ('iaq.co', 'critical', '>', 9, 5, 0, 'Carbon Monoxide is POOR (> 9 ppm)', 'DANGEROUS CO levels.'),
    ('iaq.o3', 'warning', '>', 50, 5, 0, 'Ozone is Moderate (> 50 ppb)', 'Check filtrations.'),
    ('iaq.o3', 'critical', '>', 100, 5, 0, 'Ozone is POOR (> 100 ppb)', 'High ozone detected.'),

    -- [ENV: Temperature] (Now distinct targets thanks to 'condition' inclusion)
    ('env.temperature', 'warning', '>', 25, 1, 0, 'Temperature is high (> 25°C)', 'Check HVAC.'),
    ('env.temperature', 'critical', '>', 27, 1, 0, 'Temperature is POOR (> 27°C)', 'Immediate inspection.'),
    ('env.temperature', 'warning', '<', 20, 1, 0, 'Temperature is low (< 20°C)', 'Check heating.'),
    ('env.temperature', 'critical', '<', 18, 1, 0, 'Temperature is POOR (< 18°C)', 'Critical low temperature.'),

    -- [ENERGY]
    ('energy.power_kw', 'critical', '>', 100, 2, 0, 'Peak Power limit exceeded', 'Review load shedding.'),
    ('energy.energy_kwh', 'warning', '>', 500, 2, 1440, 'Daily budget exceeded', 'Analyze patterns.'),
    ('energy.eui', 'warning', '>', 250, 2, 1440, 'EUI Benchmark exceeded', 'Intensity higher than target.'),

    -- [HEALTH: IAQ Connectivity (30m)]
    ('system.connectivity', 'critical', '>', 30, 0, 0, 'Air Sensor is OFFLINE (> 30m)', 'Check sensor battery and signal.'),
    
    -- [HEALTH: Energy Connectivity (4h)]
    ('system.connectivity_energy', 'critical', '>', 240, 0, 0, 'Energy Meter is OFFLINE (> 4h)', 'Check gateway power and meter connection.'),

    -- [HEALTH: Data Quality (Flatlining)]
    ('system.data_quality', 'critical', '>', 30, 0, 0, 'Sensor data is FLATLINING (Frozen)', 'Device may be frozen. Power cycle the sensor.')

ON CONFLICT (metric, severity, condition, duration_minutes, site_id) DO UPDATE 
SET threshold = EXCLUDED.threshold, message_template = EXCLUDED.message_template;

-- [Initial Sync]
DO $$
DECLARE
    v_site_id UUID;
BEGIN
    FOR v_site_id IN SELECT site_id FROM public.site_thresholds LOOP
        PERFORM public.sync_site_settings_to_rules(v_site_id);
    END LOOP;
END $$;
