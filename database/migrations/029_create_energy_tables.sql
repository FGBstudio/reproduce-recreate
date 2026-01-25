-- Migration: Create Dedicated Energy Telemetry Tables
-- Version: 029
-- Description: Separate tables for energy data to optimize queries and avoid performance issues

-- ============================================================
-- ENERGY RAW TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS energy_telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    metric TEXT NOT NULL,               -- energy.power_kw, energy.current_a, energy.active_energy, etc.
    value NUMERIC NOT NULL,
    unit TEXT,                          -- kW, A, kWh, V
    quality TEXT,                       -- good, computed, historical
    labels JSONB DEFAULT '{}'           -- source, circuit, phase info
);

-- Indexes for raw energy telemetry
CREATE INDEX idx_energy_telemetry_device_ts ON energy_telemetry(device_id, ts DESC);
CREATE INDEX idx_energy_telemetry_site_ts ON energy_telemetry(site_id, ts DESC);
CREATE INDEX idx_energy_telemetry_ts ON energy_telemetry(ts DESC);
CREATE INDEX idx_energy_telemetry_metric ON energy_telemetry(metric);
CREATE INDEX idx_energy_telemetry_device_metric_ts ON energy_telemetry(device_id, metric, ts DESC);
CREATE INDEX idx_energy_telemetry_site_metric_ts ON energy_telemetry(site_id, metric, ts DESC);

-- Unique constraint for deduplication
CREATE UNIQUE INDEX idx_energy_telemetry_unique ON energy_telemetry(device_id, ts, metric);

-- ============================================================
-- ENERGY HOURLY AGGREGATES
-- ============================================================
CREATE TABLE IF NOT EXISTS energy_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    ts_hour TIMESTAMPTZ NOT NULL,       -- Start of hour (truncated)
    metric TEXT NOT NULL,
    value_avg NUMERIC,
    value_min NUMERIC,
    value_max NUMERIC,
    value_sum NUMERIC,
    sample_count INTEGER DEFAULT 0,
    unit TEXT,
    labels JSONB DEFAULT '{}',
    UNIQUE(device_id, ts_hour, metric)
);

-- Indexes for hourly
CREATE INDEX idx_energy_hourly_device_ts ON energy_hourly(device_id, ts_hour DESC);
CREATE INDEX idx_energy_hourly_site_ts ON energy_hourly(site_id, ts_hour DESC);
CREATE INDEX idx_energy_hourly_ts ON energy_hourly(ts_hour DESC);
CREATE INDEX idx_energy_hourly_metric ON energy_hourly(metric);

-- ============================================================
-- ENERGY DAILY AGGREGATES
-- ============================================================
CREATE TABLE IF NOT EXISTS energy_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    ts_day DATE NOT NULL,               -- Day (date only)
    metric TEXT NOT NULL,
    value_avg NUMERIC,
    value_min NUMERIC,
    value_max NUMERIC,
    value_sum NUMERIC,
    sample_count INTEGER DEFAULT 0,
    unit TEXT,
    labels JSONB DEFAULT '{}',
    UNIQUE(device_id, ts_day, metric)
);

-- Indexes for daily
CREATE INDEX idx_energy_daily_device_ts ON energy_daily(device_id, ts_day DESC);
CREATE INDEX idx_energy_daily_site_ts ON energy_daily(site_id, ts_day DESC);
CREATE INDEX idx_energy_daily_ts ON energy_daily(ts_day DESC);
CREATE INDEX idx_energy_daily_metric ON energy_daily(metric);

-- ============================================================
-- ENERGY LATEST (real-time cache)
-- ============================================================
CREATE TABLE IF NOT EXISTS energy_latest (
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    metric TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT,
    ts TIMESTAMPTZ NOT NULL,
    quality TEXT,
    PRIMARY KEY (device_id, metric)
);

CREATE INDEX idx_energy_latest_site ON energy_latest(site_id);
CREATE INDEX idx_energy_latest_ts ON energy_latest(ts DESC);

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE energy_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_latest ENABLE ROW LEVEL SECURITY;

-- Read access for all
CREATE POLICY "Energy telemetry viewable by all" ON energy_telemetry FOR SELECT USING (true);
CREATE POLICY "Energy hourly viewable by all" ON energy_hourly FOR SELECT USING (true);
CREATE POLICY "Energy daily viewable by all" ON energy_daily FOR SELECT USING (true);
CREATE POLICY "Energy latest viewable by all" ON energy_latest FOR SELECT USING (true);

-- Service role full access for ingestion
CREATE POLICY "Service role energy_telemetry" ON energy_telemetry FOR ALL 
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role energy_hourly" ON energy_hourly FOR ALL 
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role energy_daily" ON energy_daily FOR ALL 
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role energy_latest" ON energy_latest FOR ALL 
    USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE energy_telemetry IS 'Raw high-frequency energy telemetry (dedicated for performance)';
COMMENT ON TABLE energy_hourly IS 'Hourly aggregated energy data';
COMMENT ON TABLE energy_daily IS 'Daily aggregated energy data';
COMMENT ON TABLE energy_latest IS 'Latest energy values cache for real-time dashboard';
