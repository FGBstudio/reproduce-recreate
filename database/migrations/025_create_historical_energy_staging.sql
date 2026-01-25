-- Migration: Create Historical Energy Staging Table
-- Version: 025
-- Description: Staging table for importing historical energy data before processing

-- Staging table for historical energy import
CREATE TABLE IF NOT EXISTS historical_energy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    circuit_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    metric_type TEXT NOT NULL,  -- 'Power', 'Current', 'Energy'
    value NUMERIC NOT NULL,
    unit TEXT,                  -- 'W', 'A', 'kWh', etc.
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient processing
CREATE INDEX idx_historical_energy_site ON historical_energy(site_id);
CREATE INDEX idx_historical_energy_ts ON historical_energy(timestamp);
CREATE INDEX idx_historical_energy_circuit ON historical_energy(circuit_name);

-- Enable RLS
ALTER TABLE historical_energy ENABLE ROW LEVEL SECURITY;

-- Service role can insert/read
CREATE POLICY "Service role full access to historical_energy"
    ON historical_energy
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Admins can read for verification
CREATE POLICY "Admins can view historical_energy"
    ON historical_energy
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('ADMIN_FGB', 'ADMIN_HOLDING', 'ADMIN_BRAND')
        )
    );

COMMENT ON TABLE historical_energy IS 'Staging table for importing historical energy data before processing into telemetry';
