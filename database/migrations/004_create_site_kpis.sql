-- Migration: Create Site KPIs table
-- Version: 004
-- Description: Pre-computed KPIs per site for dashboard performance

-- Site KPIs (computed periodically)
CREATE TABLE IF NOT EXISTS site_kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    ts_computed TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Energy KPIs
    energy_total_kwh NUMERIC,
    energy_hvac_kwh NUMERIC,
    energy_lighting_kwh NUMERIC,
    energy_plugs_kwh NUMERIC,
    energy_intensity_kwh_m2 NUMERIC,
    energy_cost_usd NUMERIC,
    
    -- Air Quality KPIs
    aq_index TEXT,                      -- EXCELLENT, GOOD, MODERATE, POOR, CRITICAL
    aq_co2_avg NUMERIC,
    aq_co2_max NUMERIC,
    aq_voc_avg NUMERIC,
    aq_temp_avg NUMERIC,
    aq_humidity_avg NUMERIC,
    aq_pm25_avg NUMERIC,
    aq_pm10_avg NUMERIC,
    
    -- Water KPIs
    water_consumption_liters NUMERIC,
    water_target_liters NUMERIC,
    water_leak_count INTEGER DEFAULT 0,
    
    -- Device Health
    devices_online INTEGER DEFAULT 0,
    devices_total INTEGER DEFAULT 0,
    devices_critical INTEGER DEFAULT 0,
    
    -- Alerts
    alerts_critical INTEGER DEFAULT 0,
    alerts_warning INTEGER DEFAULT 0,
    
    -- Period
    period_type TEXT DEFAULT 'day',     -- hour, day, week, month
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    
    UNIQUE(site_id, period_type, period_start)
);

-- Indexes
CREATE INDEX idx_site_kpis_site_ts ON site_kpis(site_id, ts_computed DESC);
CREATE INDEX idx_site_kpis_period ON site_kpis(period_type, period_start DESC);

-- Enable RLS
ALTER TABLE site_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site KPIs are viewable by everyone"
    ON site_kpis FOR SELECT USING (true);

COMMENT ON TABLE site_kpis IS 'Pre-computed KPIs per site for fast dashboard queries';
