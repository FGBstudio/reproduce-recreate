-- Migration: Telemetry site_id FK with SET NULL
-- Version: 036
-- Description: Ensures telemetry tables use SET NULL on site deletion to preserve data
--
-- RATIONALE:
-- If a site is deleted, we want to preserve telemetry data (orphan it) rather than 
-- cascade delete potentially years of historical data. The data can then be reassigned
-- to a new site or archived.

-- =============================================================================
-- 1. TELEMETRY TABLE: Update FK constraint to SET NULL
-- =============================================================================

ALTER TABLE telemetry DROP CONSTRAINT IF EXISTS telemetry_site_id_fkey;

ALTER TABLE telemetry 
    ADD CONSTRAINT telemetry_site_id_fkey 
    FOREIGN KEY (site_id) REFERENCES sites(id) 
    ON DELETE SET NULL;

-- =============================================================================
-- 2. TELEMETRY_HOURLY TABLE: Update FK constraint to SET NULL
-- =============================================================================

ALTER TABLE telemetry_hourly DROP CONSTRAINT IF EXISTS telemetry_hourly_site_id_fkey;

ALTER TABLE telemetry_hourly 
    ADD CONSTRAINT telemetry_hourly_site_id_fkey 
    FOREIGN KEY (site_id) REFERENCES sites(id) 
    ON DELETE SET NULL;

-- =============================================================================
-- 3. TELEMETRY_DAILY TABLE: Update FK constraint to SET NULL
-- =============================================================================

ALTER TABLE telemetry_daily DROP CONSTRAINT IF EXISTS telemetry_daily_site_id_fkey;

ALTER TABLE telemetry_daily 
    ADD CONSTRAINT telemetry_daily_site_id_fkey 
    FOREIGN KEY (site_id) REFERENCES sites(id) 
    ON DELETE SET NULL;

-- =============================================================================
-- 4. TELEMETRY_LATEST TABLE: Update FK constraint to SET NULL
-- =============================================================================

ALTER TABLE telemetry_latest DROP CONSTRAINT IF EXISTS telemetry_latest_site_id_fkey;

ALTER TABLE telemetry_latest 
    ADD CONSTRAINT telemetry_latest_site_id_fkey 
    FOREIGN KEY (site_id) REFERENCES sites(id) 
    ON DELETE SET NULL;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN telemetry.site_id IS 
    'Site reference for fast filtering. NULL = orphan data. Uses SET NULL on site deletion to preserve historical data.';

COMMENT ON COLUMN telemetry_hourly.site_id IS 
    'Site reference for aggregated data. Uses SET NULL on site deletion.';

COMMENT ON COLUMN telemetry_daily.site_id IS 
    'Site reference for daily aggregates. Uses SET NULL on site deletion.';

COMMENT ON COLUMN telemetry_latest.site_id IS 
    'Site reference for real-time cache. Uses SET NULL on site deletion.';

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- This migration ensures:
-- 1. Deleting a site will NOT delete associated telemetry data
-- 2. Telemetry data becomes "orphaned" (site_id = NULL) instead
-- 3. Orphaned telemetry can be reassigned via the admin interface
-- 4. This is especially important for energy/air quality data that may span years
