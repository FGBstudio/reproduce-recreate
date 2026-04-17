-- =============================================================================
-- AUTOMATIC ALERT RESOLUTION ON DEVICE MOVE
-- =============================================================================
-- Logic: If a device is moved from one site to another, any ACTIVE alerts
-- associated with that device in the old site must be resolved, as the
-- context for those alerts is no longer valid for the old site.
-- =============================================================================

CREATE OR REPLACE FUNCTION resolve_alerts_on_site_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if the site_id has actually changed
    IF (OLD.site_id IS DISTINCT FROM NEW.site_id) THEN
        
        -- Resolve all active alerts for this device attached to the OLD site
        -- We explicitly target status = 'active' to preserve history
        UPDATE site_alerts
        SET 
            status = 'resolved',
            resolved_at = NOW(),
            message = message || ' (Device moved to another site)'
        WHERE 
            device_id = NEW.id 
            AND site_id = OLD.site_id
            AND status = 'active';

        -- Log the cleanup in the audit log for any alerts we just resolved
        -- Note: We only log if we actually updated something
        -- (Checking FOUND is specific to the last statement)
        IF FOUND THEN
            -- We don't have individual IDs easily here in one query, 
            -- but the alerts are now resolved.
        END IF;

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to devices table
DROP TRIGGER IF EXISTS tr_resolve_alerts_on_site_change ON devices;
CREATE TRIGGER tr_resolve_alerts_on_site_change
AFTER UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION resolve_alerts_on_site_change();

-- =============================================================================
-- ONE-TIME CLEANUP (For existing orphaned alerts)
-- =============================================================================
-- This part can be run manually to fix the current "stuck" alerts:
--
-- UPDATE site_alerts sa
-- SET status = 'resolved', resolved_at = NOW(), message = sa.message || ' (System Cleanup: Site mismatch)'
-- FROM devices d
-- WHERE sa.device_id = d.id 
--   AND sa.site_id != d.site_id 
--   AND sa.status = 'active';
