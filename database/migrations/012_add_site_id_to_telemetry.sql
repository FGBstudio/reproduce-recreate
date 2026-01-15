-- Migration: Add site_id and labels to telemetry tables
-- Version: 012
-- Description: Add site_id for direct queries and labels for metadata

-- Add site_id to raw telemetry
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id);
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}';

-- Add site_id to hourly telemetry
ALTER TABLE telemetry_hourly ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id);
ALTER TABLE telemetry_hourly ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}';

-- Add site_id to daily telemetry
ALTER TABLE telemetry_daily ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id);
ALTER TABLE telemetry_daily ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}';

-- Add site_id to latest telemetry
ALTER TABLE telemetry_latest ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id);
ALTER TABLE telemetry_latest ADD COLUMN IF NOT EXISTS labels JSONB DEFAULT '{}';

-- Create indexes for site-based queries
CREATE INDEX IF NOT EXISTS idx_telemetry_site_metric_ts ON telemetry(site_id, metric, ts DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_site ON telemetry_hourly(site_id, metric, ts_hour DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_daily_site ON telemetry_daily(site_id, metric, ts_day DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_latest_site ON telemetry_latest(site_id, metric);

-- Backfill site_id from devices table (for existing data)
UPDATE telemetry t 
SET site_id = d.site_id 
FROM devices d 
WHERE t.device_id = d.id AND t.site_id IS NULL;

UPDATE telemetry_hourly t 
SET site_id = d.site_id 
FROM devices d 
WHERE t.device_id = d.id AND t.site_id IS NULL;

UPDATE telemetry_daily t 
SET site_id = d.site_id 
FROM devices d 
WHERE t.device_id = d.id AND t.site_id IS NULL;

UPDATE telemetry_latest t 
SET site_id = d.site_id 
FROM devices d 
WHERE t.device_id = d.id AND t.site_id IS NULL;

COMMENT ON COLUMN telemetry.site_id IS 'Direct reference to site for fast filtering';
COMMENT ON COLUMN telemetry.labels IS 'Additional metadata: wiring_type, source, quality_flags';
