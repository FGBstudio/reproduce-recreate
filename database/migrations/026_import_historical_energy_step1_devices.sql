-- Migration: Import Historical Energy - Step 1: Create Virtual Devices
-- Version: 026
-- Description: Create virtual devices for historical circuits that don't have device_id

-- Create devices based on historical_energy circuit names
-- Excludes Milan (fe102b55-ec8a-4f4f-b797-26ee6c132381) which has known device mapping
INSERT INTO devices (site_id, name, device_id, device_type, status, metadata, created_at)
SELECT DISTINCT 
    h.site_id, 
    h.circuit_name as name,
    -- Generate unique fictional ID like "HIST-CircuitName-SiteXYZ"
    'HIST-' || regexp_replace(h.circuit_name, '\s+', '', 'g') || '-' || LEFT(h.site_id::text, 8) as device_id,
    'energy_monitor'::device_type,
    'offline'::device_status,
    jsonb_build_object(
        'source', 'historical_import',
        'virtual', true,
        'original_circuit', h.circuit_name,
        'imported_at', now()
    ) as metadata,
    now()
FROM historical_energy h
LEFT JOIN devices d ON d.site_id = h.site_id AND d.name = h.circuit_name
WHERE d.id IS NULL
  -- Exclude Milan (managed separately with known device)
  AND h.site_id != 'fe102b55-ec8a-4f4f-b797-26ee6c132381'
ON CONFLICT (device_id, broker) DO NOTHING;

COMMENT ON TABLE devices IS 'Registry of all IoT devices/sensors - includes virtual devices for historical imports';
