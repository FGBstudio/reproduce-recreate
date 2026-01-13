-- Migration: Create Holdings, Brands, and Sites tables
-- Version: 001
-- Description: Core entity hierarchy for FGB IoT Dashboard

-- Holdings (parent companies)
CREATE TABLE IF NOT EXISTS holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Brands (belong to holdings)
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_id UUID NOT NULL REFERENCES holdings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Sites/Stores (belong to brands)
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    country TEXT,
    region TEXT, -- EU, AMER, APAC, MEA
    lat NUMERIC(10,7),
    lng NUMERIC(10,7),
    image_url TEXT,
    monitoring_types TEXT[] DEFAULT '{}', -- energy, air, water
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_brands_holding_id ON brands(holding_id);
CREATE INDEX idx_sites_brand_id ON sites(brand_id);
CREATE INDEX idx_sites_region ON sites(region);
CREATE INDEX idx_sites_location ON sites(lat, lng);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_holdings_updated_at
    BEFORE UPDATE ON holdings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
    BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- RLS Policies (read-only for anon/authenticated)
CREATE POLICY "Holdings are viewable by everyone"
    ON holdings FOR SELECT
    USING (true);

CREATE POLICY "Brands are viewable by everyone"
    ON brands FOR SELECT
    USING (true);

CREATE POLICY "Sites are viewable by everyone"
    ON sites FOR SELECT
    USING (true);

COMMENT ON TABLE holdings IS 'Parent companies (e.g., Kering, LVMH)';
COMMENT ON TABLE brands IS 'Brands belonging to holdings (e.g., Gucci, Dior)';
COMMENT ON TABLE sites IS 'Physical locations/stores belonging to brands';
