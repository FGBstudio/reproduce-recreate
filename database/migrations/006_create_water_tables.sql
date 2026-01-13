-- Migration: Create Water monitoring tables
-- Version: 006
-- Description: Water zones and leak detection

-- Water zones within a site
CREATE TABLE IF NOT EXISTS water_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                 -- Zone name (e.g., "Bagni Piano 1", "Irrigazione")
    zone_type TEXT,                     -- sanitary, hvac, irrigation, kitchen, fountain, other
    flow_device_id UUID REFERENCES devices(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Water leak detection
CREATE TABLE IF NOT EXISTS water_leaks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES water_zones(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    
    leak_rate NUMERIC,                  -- L/hour or %
    status TEXT NOT NULL DEFAULT 'detected', -- detected, investigating, resolved
    
    ts_detected TIMESTAMPTZ NOT NULL DEFAULT now(),
    ts_resolved TIMESTAMPTZ,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_water_zones_site_id ON water_zones(site_id);
CREATE INDEX idx_water_leaks_site_id ON water_leaks(site_id);
CREATE INDEX idx_water_leaks_zone_id ON water_leaks(zone_id);
CREATE INDEX idx_water_leaks_status ON water_leaks(status);
CREATE INDEX idx_water_leaks_ts ON water_leaks(ts_detected DESC);

-- Enable RLS
ALTER TABLE water_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_leaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Water zones are viewable by everyone"
    ON water_zones FOR SELECT USING (true);

CREATE POLICY "Water leaks are viewable by everyone"
    ON water_leaks FOR SELECT USING (true);

COMMENT ON TABLE water_zones IS 'Water consumption zones within sites';
COMMENT ON TABLE water_leaks IS 'Detected water leaks with status tracking';
