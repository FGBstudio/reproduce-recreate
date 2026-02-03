-- Migration: Make device site_id optional for orphan device registration
-- Version: 034
-- Description: Allows MQTT ingestion to register devices before site assignment
-- 
-- RATIONALE:
-- When a new device starts sending MQTT data, we want to:
-- 1. Immediately register it in the devices table
-- 2. Start recording its telemetry data
-- 3. Allow later assignment to a site via the admin UI
--
-- This removes the hard requirement for DEFAULT_SITE_ID in the ingestion service.

-- =============================================================================
-- 1. ALTER DEVICES TABLE: Make site_id nullable
-- =============================================================================

ALTER TABLE devices ALTER COLUMN site_id DROP NOT NULL;

-- =============================================================================
-- 2. CHANGE FK CONSTRAINT: Use SET NULL instead of CASCADE
-- =============================================================================
-- CASCADE would delete devices and all their telemetry if a site is deleted.
-- SET NULL preserves devices and data, just orphans them for reassignment.

ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_site_id_fkey;

ALTER TABLE devices 
    ADD CONSTRAINT devices_site_id_fkey 
    FOREIGN KEY (site_id) REFERENCES sites(id) 
    ON DELETE SET NULL;

COMMENT ON COLUMN devices.site_id IS 
    'Site this device belongs to. NULL = unassigned/orphan device awaiting assignment via admin UI. Uses SET NULL on site deletion to preserve device and telemetry data.';

-- =============================================================================
-- 3. CREATE "Inbox" site for orphan devices (optional, for UI convenience)
-- =============================================================================

INSERT INTO sites (id, name, address, latitude, longitude, brand_id, metadata)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Inbox / Unassigned Devices',
    'System-generated site for orphan devices',
    0, 0,
    (SELECT id FROM brands LIMIT 1),
    '{"system": true, "description": "Devices not yet assigned to a project"}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM sites WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- =============================================================================
-- 4. CREATE VIEW for orphan devices (admin convenience)
-- =============================================================================

CREATE OR REPLACE VIEW devices_orphan AS
SELECT 
    d.*,
    tl.ts as last_data_ts,
    COUNT(DISTINCT t.id) as telemetry_count_24h
FROM devices d
LEFT JOIN telemetry_latest tl ON tl.device_id = d.id
LEFT JOIN telemetry t ON t.device_id = d.id AND t.ts > NOW() - INTERVAL '24 hours'
WHERE d.site_id IS NULL
GROUP BY d.id, tl.ts
ORDER BY d.last_seen DESC NULLS LAST;

COMMENT ON VIEW devices_orphan IS 
    'View of unassigned devices with their latest telemetry info. Use for admin assignment UI.';

-- =============================================================================
-- 5. HELPER FUNCTION: Assign device to site
-- =============================================================================

CREATE OR REPLACE FUNCTION assign_device_to_site(
    p_device_id UUID,
    p_site_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify site exists
    IF NOT EXISTS (SELECT 1 FROM sites WHERE id = p_site_id) THEN
        RAISE EXCEPTION 'Site % does not exist', p_site_id;
    END IF;
    
    -- Update device
    UPDATE devices
    SET 
        site_id = p_site_id,
        updated_at = NOW()
    WHERE id = p_device_id;
    
    -- The trigger sync_telemetry_latest_site_id (migration 022) 
    -- will automatically update telemetry_latest.site_id
    
    RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION assign_device_to_site IS 
    'Assigns an orphan device to a site. Triggers automatic telemetry site_id sync.';

-- =============================================================================
-- 6. INDEX for NULL site_id queries (admin orphan device listing)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_devices_site_id_null ON devices(id) WHERE site_id IS NULL;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- After applying this migration:
-- 1. The MQTT ingestion service can register devices without DEFAULT_SITE_ID
-- 2. Orphan devices (site_id = NULL) will collect telemetry normally
-- 3. Admins can use the devices_orphan view or API to assign devices to sites
-- 4. When a device is assigned, the trigger updates telemetry_latest.site_id automatically
-- 5. Deleting a site will SET NULL on device.site_id (not cascade delete)
