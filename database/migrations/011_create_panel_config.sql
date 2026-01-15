-- Migration: Create panel configuration table
-- Version: 011
-- Description: Electrical panel configuration for power calculations (WYE/DELTA)

-- Wiring type enum
CREATE TYPE wiring_type AS ENUM ('WYE', 'DELTA');

-- Panel configuration table
CREATE TABLE IF NOT EXISTS panel_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,  -- NULL = site-wide default
    name TEXT,                              -- Human readable name
    wiring_type wiring_type NOT NULL DEFAULT 'WYE',
    pf_default DOUBLE PRECISION DEFAULT 0.95,       -- Default power factor
    pf_l1 DOUBLE PRECISION,                         -- Phase-specific PF (optional)
    pf_l2 DOUBLE PRECISION,
    pf_l3 DOUBLE PRECISION,
    vln_default DOUBLE PRECISION DEFAULT 230.0,     -- Line-to-neutral voltage
    vll_default DOUBLE PRECISION DEFAULT 400.0,     -- Line-to-line voltage
    use_measured_voltage BOOLEAN DEFAULT TRUE,      -- Use measured V if available
    use_measured_pf BOOLEAN DEFAULT TRUE,           -- Use measured PF if available
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(site_id, device_id)
);

-- Index for fast lookup
CREATE INDEX idx_panel_config_site ON panel_config(site_id);
CREATE INDEX idx_panel_config_device ON panel_config(device_id) WHERE device_id IS NOT NULL;

-- Apply trigger
CREATE TRIGGER update_panel_config_updated_at
    BEFORE UPDATE ON panel_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE panel_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Panel config viewable by everyone"
    ON panel_config FOR SELECT USING (true);

COMMENT ON TABLE panel_config IS 'Electrical panel configuration for power calculations';
COMMENT ON COLUMN panel_config.wiring_type IS 'WYE (Star/Y) or DELTA (Triangle) wiring configuration';
COMMENT ON COLUMN panel_config.pf_default IS 'Default power factor when not measured (0.0-1.0)';
COMMENT ON COLUMN panel_config.vln_default IS 'Default line-to-neutral voltage (V) when not measured';
COMMENT ON COLUMN panel_config.vll_default IS 'Default line-to-line voltage (V) when not measured';
