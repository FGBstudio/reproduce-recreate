-- Migration: Create Telemetry tables (raw + aggregated)
-- Version: 003
-- Description: Time-series telemetry with multi-granularity aggregation

-- Raw telemetry table (high-frequency ingestion)
CREATE TABLE IF NOT EXISTS telemetry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    metric TEXT NOT NULL,               -- Metric name: co2, voc, temp, humidity, current_a, power_w, etc.
    value NUMERIC NOT NULL,
    unit TEXT,                          -- Unit: ppm, µg/m³, °C, %, A, V, W, kWh, L, etc.
    quality TEXT,                       -- Data quality indicator: good, warning, error
    raw_payload JSONB                   -- Original MQTT payload for debugging
);

-- Partitioning by time (create partitions for each month)
-- Note: In production, use pg_partman or TimescaleDB for automatic partition management

-- Hourly aggregated telemetry
CREATE TABLE IF NOT EXISTS telemetry_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ts_hour TIMESTAMPTZ NOT NULL,       -- Start of hour (truncated)
    metric TEXT NOT NULL,
    value_avg NUMERIC,
    value_min NUMERIC,
    value_max NUMERIC,
    value_sum NUMERIC,
    sample_count INTEGER DEFAULT 0,
    unit TEXT,
    UNIQUE(device_id, ts_hour, metric)
);

-- Daily aggregated telemetry
CREATE TABLE IF NOT EXISTS telemetry_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ts_day DATE NOT NULL,               -- Day (date only)
    metric TEXT NOT NULL,
    value_avg NUMERIC,
    value_min NUMERIC,
    value_max NUMERIC,
    value_sum NUMERIC,
    sample_count INTEGER DEFAULT 0,
    unit TEXT,
    UNIQUE(device_id, ts_day, metric)
);

-- Latest values cache (real-time dashboard)
CREATE TABLE IF NOT EXISTS telemetry_latest (
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT,
    ts TIMESTAMPTZ NOT NULL,
    quality TEXT,
    PRIMARY KEY (device_id, metric)
);

-- Indexes for raw telemetry (time-range queries)
CREATE INDEX idx_telemetry_device_ts ON telemetry(device_id, ts DESC);
CREATE INDEX idx_telemetry_ts ON telemetry(ts DESC);
CREATE INDEX idx_telemetry_metric ON telemetry(metric);
CREATE INDEX idx_telemetry_device_metric_ts ON telemetry(device_id, metric, ts DESC);

-- Indexes for hourly
CREATE INDEX idx_telemetry_hourly_device_ts ON telemetry_hourly(device_id, ts_hour DESC);
CREATE INDEX idx_telemetry_hourly_ts ON telemetry_hourly(ts_hour DESC);

-- Indexes for daily
CREATE INDEX idx_telemetry_daily_device_ts ON telemetry_daily(device_id, ts_day DESC);
CREATE INDEX idx_telemetry_daily_ts ON telemetry_daily(ts_day DESC);

-- Indexes for latest
CREATE INDEX idx_telemetry_latest_ts ON telemetry_latest(ts DESC);

-- Enable RLS
ALTER TABLE telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_latest ENABLE ROW LEVEL SECURITY;

-- RLS Policies (read-only for dashboard)
CREATE POLICY "Telemetry is viewable by everyone"
    ON telemetry FOR SELECT USING (true);

CREATE POLICY "Telemetry hourly is viewable by everyone"
    ON telemetry_hourly FOR SELECT USING (true);

CREATE POLICY "Telemetry daily is viewable by everyone"
    ON telemetry_daily FOR SELECT USING (true);

CREATE POLICY "Telemetry latest is viewable by everyone"
    ON telemetry_latest FOR SELECT USING (true);

COMMENT ON TABLE telemetry IS 'Raw high-frequency telemetry data from sensors';
COMMENT ON TABLE telemetry_hourly IS 'Hourly aggregated telemetry for trend analysis';
COMMENT ON TABLE telemetry_daily IS 'Daily aggregated telemetry for long-term analysis';
COMMENT ON TABLE telemetry_latest IS 'Latest value cache for real-time dashboard';
