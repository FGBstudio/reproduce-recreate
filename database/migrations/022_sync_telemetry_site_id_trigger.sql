-- Migration: Sync telemetry_latest.site_id when device moves
-- Version: 022
-- Description: Trigger to automatically update site_id in telemetry_latest when a device is moved to a new project

-- Function to sync site_id in telemetry_latest when device.site_id changes
CREATE OR REPLACE FUNCTION sync_telemetry_latest_site_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only act if site_id actually changed
    IF OLD.site_id IS DISTINCT FROM NEW.site_id THEN
        UPDATE telemetry_latest
        SET site_id = NEW.site_id
        WHERE device_id = NEW.id;
        
        -- Also update telemetry_hourly for recent data (optional, for consistency)
        UPDATE telemetry_hourly
        SET site_id = NEW.site_id
        WHERE device_id = NEW.id
          AND ts_hour >= NOW() - INTERVAL '7 days';
        
        -- Also update telemetry_daily for recent data (optional, for consistency)
        UPDATE telemetry_daily
        SET site_id = NEW.site_id
        WHERE device_id = NEW.id
          AND ts_day >= CURRENT_DATE - INTERVAL '30 days';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on devices table
DROP TRIGGER IF EXISTS trigger_sync_telemetry_site_id ON devices;

CREATE TRIGGER trigger_sync_telemetry_site_id
    AFTER UPDATE OF site_id ON devices
    FOR EACH ROW
    EXECUTE FUNCTION sync_telemetry_latest_site_id();

-- Add helpful comment
COMMENT ON FUNCTION sync_telemetry_latest_site_id() IS 
    'Automatically updates site_id in telemetry tables when a device is moved to a new project';
