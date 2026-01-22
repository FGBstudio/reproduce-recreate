-- Migration: Auto-enable modules when devices are assigned to sites
-- This migration:
-- 1. Adds module_* columns to sites table for direct module configuration
-- 2. Creates a trigger that auto-enables modules based on device type when assigned

-- =====================================================
-- STEP 1: Add module columns to sites table
-- =====================================================

-- Add module configuration columns directly to sites table
ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS module_energy_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS module_air_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS module_water_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS module_energy_show_demo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS module_air_show_demo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS module_water_show_demo BOOLEAN DEFAULT false;

-- Add index for quick module filtering
CREATE INDEX IF NOT EXISTS idx_sites_modules ON sites(module_energy_enabled, module_air_enabled, module_water_enabled);

COMMENT ON COLUMN sites.module_energy_enabled IS 'Whether energy dashboard is enabled for this site';
COMMENT ON COLUMN sites.module_air_enabled IS 'Whether air quality dashboard is enabled for this site';
COMMENT ON COLUMN sites.module_water_enabled IS 'Whether water dashboard is enabled for this site';

-- =====================================================
-- STEP 2: Create function to auto-enable module on device assignment
-- =====================================================

CREATE OR REPLACE FUNCTION auto_enable_site_module_on_device_assign()
RETURNS TRIGGER AS $$
DECLARE
    device_type_val device_type;
    target_site_id UUID;
    inbox_site_id UUID := '00000000-0000-0000-0000-000000000003';
BEGIN
    -- Only process when site_id changes from inbox to a real site
    -- Or when a new device is inserted with a non-inbox site
    
    IF TG_OP = 'UPDATE' THEN
        -- Device is being moved to a new site
        IF OLD.site_id IS DISTINCT FROM NEW.site_id AND NEW.site_id IS NOT NULL AND NEW.site_id != inbox_site_id THEN
            target_site_id := NEW.site_id;
            device_type_val := NEW.device_type;
        ELSE
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        -- New device assigned directly to a site (not inbox)
        IF NEW.site_id IS NOT NULL AND NEW.site_id != inbox_site_id THEN
            target_site_id := NEW.site_id;
            device_type_val := NEW.device_type;
        ELSE
            RETURN NEW;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    -- Enable the corresponding module based on device type
    CASE device_type_val
        WHEN 'energy_monitor' THEN
            UPDATE sites SET module_energy_enabled = true, updated_at = NOW() WHERE id = target_site_id;
            RAISE NOTICE 'Auto-enabled ENERGY module for site %', target_site_id;
        WHEN 'air_quality' THEN
            UPDATE sites SET module_air_enabled = true, updated_at = NOW() WHERE id = target_site_id;
            RAISE NOTICE 'Auto-enabled AIR module for site %', target_site_id;
        WHEN 'water_meter' THEN
            UPDATE sites SET module_water_enabled = true, updated_at = NOW() WHERE id = target_site_id;
            RAISE NOTICE 'Auto-enabled WATER module for site %', target_site_id;
        WHEN 'hvac' THEN
            -- HVAC contributes to energy monitoring
            UPDATE sites SET module_energy_enabled = true, updated_at = NOW() WHERE id = target_site_id;
            RAISE NOTICE 'Auto-enabled ENERGY module (HVAC) for site %', target_site_id;
        WHEN 'lighting' THEN
            -- Lighting contributes to energy monitoring
            UPDATE sites SET module_energy_enabled = true, updated_at = NOW() WHERE id = target_site_id;
            RAISE NOTICE 'Auto-enabled ENERGY module (Lighting) for site %', target_site_id;
        ELSE
            -- Other device types don't auto-enable modules
            NULL;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 3: Create triggers
-- =====================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_enable_module_on_device_assign ON devices;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER trigger_auto_enable_module_on_device_assign
    AFTER INSERT OR UPDATE OF site_id ON devices
    FOR EACH ROW
    EXECUTE FUNCTION auto_enable_site_module_on_device_assign();

-- =====================================================
-- STEP 4: Backfill existing data
-- =====================================================

-- Enable modules for sites that already have devices assigned
UPDATE sites s SET 
    module_energy_enabled = true,
    updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM devices d 
    WHERE d.site_id = s.id 
    AND d.device_type IN ('energy_monitor', 'hvac', 'lighting')
)
AND s.id != '00000000-0000-0000-0000-000000000003';

UPDATE sites s SET 
    module_air_enabled = true,
    updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM devices d 
    WHERE d.site_id = s.id 
    AND d.device_type = 'air_quality'
)
AND s.id != '00000000-0000-0000-0000-000000000003';

UPDATE sites s SET 
    module_water_enabled = true,
    updated_at = NOW()
WHERE EXISTS (
    SELECT 1 FROM devices d 
    WHERE d.site_id = s.id 
    AND d.device_type = 'water_meter'
)
AND s.id != '00000000-0000-0000-0000-000000000003';

-- =====================================================
-- STEP 5: Add helpful comments
-- =====================================================

COMMENT ON FUNCTION auto_enable_site_module_on_device_assign() IS 
    'Automatically enables the corresponding dashboard module when a device is assigned to a site. '
    'Maps device_type to module: energy_monitor/hvac/lighting -> energy, air_quality -> air, water_meter -> water.';

COMMENT ON TRIGGER trigger_auto_enable_module_on_device_assign ON devices IS 
    'Fires when a device is assigned to a site, enabling the appropriate module in the sites table.';
