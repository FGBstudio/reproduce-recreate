-- Migration: Create site_config table for module configuration
-- Version: 020
-- Description: Stores per-site module configuration (enabled, demo mode, lock copy)

-- =====================================================
-- SITE CONFIG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS site_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Module configurations (JSONB for flexibility)
    -- Structure: { "energy": {...}, "air": {...}, "water": {...} }
    modules JSONB DEFAULT '{
        "energy": {"enabled": true, "showDemo": false, "lockCopy": null, "ctaText": null},
        "air": {"enabled": true, "showDemo": false, "lockCopy": null, "ctaText": null},
        "water": {"enabled": true, "showDemo": false, "lockCopy": null, "ctaText": null}
    }',
    
    -- Certifications array
    certifications TEXT[] DEFAULT '{}',
    
    -- Project status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'archived')),
    
    -- Optional display name (if different from site name)
    display_name TEXT,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(site_id)
);

-- Index
CREATE INDEX idx_site_config_site_id ON site_config(site_id);
CREATE INDEX idx_site_config_status ON site_config(status);

-- Trigger
CREATE TRIGGER update_site_config_updated_at
    BEFORE UPDATE ON site_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Site config viewable by everyone"
    ON site_config FOR SELECT
    USING (true);

-- Admin can insert/update/delete
CREATE POLICY "Admin can manage site config"
    ON site_config FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'superuser')
        )
    );

-- Service role full access
CREATE POLICY "Service role can manage site config"
    ON site_config FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- ADD area_m2 TO SITES IF NOT EXISTS
-- =====================================================

ALTER TABLE sites ADD COLUMN IF NOT EXISTS area_m2 NUMERIC;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS energy_price_kwh NUMERIC DEFAULT 0.25;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE site_config IS 'Per-site configuration for modules and certifications';
COMMENT ON COLUMN site_config.modules IS 'JSONB with energy/air/water module settings: enabled, showDemo, lockCopy, ctaText';
COMMENT ON COLUMN site_config.certifications IS 'Array of certification types: LEED, WELL, BREEAM, ENERGY_AUDIT';
COMMENT ON COLUMN site_config.status IS 'Project status: active, inactive, pending, archived';
