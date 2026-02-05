
-- =============================================================================
-- Migration: Migrate telemetry and deprecate MAC-based devices
-- Part 2/3: Handle telemetry migration and device deprecation
-- =============================================================================

-- Create migration log table for tracking
CREATE TABLE IF NOT EXISTS device_migration_log (
    id SERIAL PRIMARY KEY,
    old_device_id UUID NOT NULL,
    new_device_id UUID NOT NULL,
    mac_device_id TEXT,
    serial TEXT,
    mac_site_id UUID,
    serial_site_id UUID,
    telemetry_migrated INT DEFAULT 0,
    migrated_at TIMESTAMPTZ DEFAULT now()
);

-- Clear previous log
TRUNCATE device_migration_log;

-- Build mapping between MAC-based devices and serial-based devices
INSERT INTO device_migration_log (old_device_id, new_device_id, mac_device_id, serial, mac_site_id, serial_site_id)
SELECT 
    mac_dev.id,
    serial_dev.id,
    mac_dev.device_id,
    serial_dev.device_id,
    mac_dev.site_id,
    serial_dev.site_id
FROM devices mac_dev
JOIN device_serial_mac_map m ON mac_dev.device_id = m.mac OR mac_dev.mac_address = m.mac
JOIN devices serial_dev ON serial_dev.device_id = m.serial
WHERE mac_dev.device_type = 'air_quality'
  AND serial_dev.device_type = 'air_quality'
  AND mac_dev.id != serial_dev.id;

-- Inherit site_id from MAC-based to serial-based if serial has NULL
UPDATE devices d
SET 
    site_id = dmm.mac_site_id,
    updated_at = now()
FROM device_migration_log dmm
WHERE d.id = dmm.new_device_id
  AND d.site_id IS NULL
  AND dmm.mac_site_id IS NOT NULL;

-- Delete conflicting telemetry records before migration
DELETE FROM telemetry t
USING device_migration_log dmm
WHERE t.device_id = dmm.old_device_id
  AND EXISTS (
      SELECT 1 FROM telemetry t2 
      WHERE t2.device_id = dmm.new_device_id 
        AND t2.metric = t.metric 
        AND t2.ts = t.ts
  );

-- Delete conflicting telemetry_latest
DELETE FROM telemetry_latest tl
USING device_migration_log dmm
WHERE tl.device_id = dmm.old_device_id
  AND EXISTS (
      SELECT 1 FROM telemetry_latest tl2 
      WHERE tl2.device_id = dmm.new_device_id 
        AND tl2.metric = tl.metric
  );

-- Delete conflicting hourly
DELETE FROM telemetry_hourly th
USING device_migration_log dmm
WHERE th.device_id = dmm.old_device_id
  AND EXISTS (
      SELECT 1 FROM telemetry_hourly th2 
      WHERE th2.device_id = dmm.new_device_id 
        AND th2.metric = th.metric 
        AND th2.ts_hour = th.ts_hour
  );

-- Delete conflicting daily
DELETE FROM telemetry_daily td
USING device_migration_log dmm
WHERE td.device_id = dmm.old_device_id
  AND EXISTS (
      SELECT 1 FROM telemetry_daily td2 
      WHERE td2.device_id = dmm.new_device_id 
        AND td2.metric = td.metric 
        AND td2.ts_day = td.ts_day
  );

-- Now migrate remaining telemetry
UPDATE telemetry t
SET 
    device_id = dmm.new_device_id,
    site_id = COALESCE(dmm.serial_site_id, dmm.mac_site_id, t.site_id)
FROM device_migration_log dmm
WHERE t.device_id = dmm.old_device_id;

UPDATE telemetry_latest tl
SET 
    device_id = dmm.new_device_id,
    site_id = COALESCE(dmm.serial_site_id, dmm.mac_site_id, tl.site_id)
FROM device_migration_log dmm
WHERE tl.device_id = dmm.old_device_id;

UPDATE telemetry_hourly th
SET 
    device_id = dmm.new_device_id,
    site_id = COALESCE(dmm.serial_site_id, dmm.mac_site_id, th.site_id)
FROM device_migration_log dmm
WHERE th.device_id = dmm.old_device_id;

UPDATE telemetry_daily td
SET 
    device_id = dmm.new_device_id,
    site_id = COALESCE(dmm.serial_site_id, dmm.mac_site_id, td.site_id)
FROM device_migration_log dmm
WHERE td.device_id = dmm.old_device_id;

-- Deprecate MAC-based devices
UPDATE devices d
SET 
    device_id = 'LEGACY-' || d.device_id,
    name = '[LEGACY] ' || COALESCE(d.name, d.device_id),
    status = 'maintenance'::device_status,
    metadata = COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object(
        'deprecated', true,
        'deprecated_at', now(),
        'deprecated_reason', 'Merged with serial-based canonical device',
        'original_device_id', d.device_id,
        'migrated_to', dmm.new_device_id
    ),
    updated_at = now()
FROM device_migration_log dmm
WHERE d.id = dmm.old_device_id
  AND d.device_id NOT LIKE 'LEGACY-%';

-- Mark any remaining MAC-based devices for review
UPDATE devices d
SET 
    metadata = COALESCE(d.metadata, '{}'::jsonb) || jsonb_build_object(
        'needs_mapping_review', true,
        'flagged_at', now()
    ),
    updated_at = now()
WHERE d.device_type = 'air_quality'
  AND d.device_id = d.mac_address  
  AND d.device_id NOT LIKE 'LEGACY-%'
  AND NOT EXISTS (SELECT 1 FROM device_migration_log dmm WHERE dmm.old_device_id = d.id);
