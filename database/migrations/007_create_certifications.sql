-- Migration: Create Certifications tables
-- Version: 007
-- Description: LEED/BREEAM certifications tracking

-- Certifications for sites
CREATE TABLE IF NOT EXISTS certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    
    cert_type TEXT NOT NULL,            -- LEED, BREEAM, WELL, etc.
    level TEXT,                         -- Platinum, Gold, Silver, Certified
    score NUMERIC,                      -- Overall score
    target_score NUMERIC,
    
    status TEXT DEFAULT 'in_progress',  -- in_progress, achieved, expired
    
    issued_date DATE,
    expiry_date DATE,
    
    categories JSONB DEFAULT '{}',      -- Category scores (energy, water, materials, etc.)
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Certification milestones/checkpoints
CREATE TABLE IF NOT EXISTS certification_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    certification_id UUID NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
    
    category TEXT NOT NULL,             -- Energy, Water, IEQ, Materials, etc.
    requirement TEXT NOT NULL,
    
    status TEXT DEFAULT 'pending',      -- pending, in_progress, achieved, failed
    score NUMERIC,
    max_score NUMERIC,
    
    due_date DATE,
    completed_date DATE,
    
    notes TEXT,
    evidence_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_certifications_site_id ON certifications(site_id);
CREATE INDEX idx_certifications_type ON certifications(cert_type);
CREATE INDEX idx_certifications_status ON certifications(status);
CREATE INDEX idx_cert_milestones_cert_id ON certification_milestones(certification_id);
CREATE INDEX idx_cert_milestones_status ON certification_milestones(status);

-- Apply trigger
CREATE TRIGGER update_certifications_updated_at
    BEFORE UPDATE ON certifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE certification_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Certifications are viewable by everyone"
    ON certifications FOR SELECT USING (true);

CREATE POLICY "Certification milestones are viewable by everyone"
    ON certification_milestones FOR SELECT USING (true);

COMMENT ON TABLE certifications IS 'Green building certifications (LEED, BREEAM, WELL)';
COMMENT ON TABLE certification_milestones IS 'Individual requirements/credits for certifications';
