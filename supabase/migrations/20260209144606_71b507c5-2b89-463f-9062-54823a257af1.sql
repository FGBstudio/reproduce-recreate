
-- Fix device-project associations to match the authoritative JSON

-- 1. Assign 2307270002 to A060 MI-MILANO PIAZZA SAN BABILA (was NULL)
UPDATE devices 
SET site_id = 'fc80adbc-52fb-4a0f-9f76-7e79ce258e00',
    name = 'A060 113 MI-MILANO PIAZZA SAN BABILA'
WHERE device_id = '2307270002';

-- 2. Unassign 2412270008 from A060 (not in JSON, move to Inbox)
UPDATE devices 
SET site_id = (SELECT id FROM sites WHERE name = 'Inbox / Unassigned' LIMIT 1),
    status = 'maintenance'
WHERE device_id = '2412270008';

-- 3. Unassign 2504090014 from FGB Milan Office (not in JSON, move to Inbox)
UPDATE devices 
SET site_id = (SELECT id FROM sites WHERE name = 'Inbox / Unassigned' LIMIT 1),
    status = 'maintenance'
WHERE device_id = '2504090014';

-- 4. Unassign 5031646D9EB8 (MAC device) from FGB Milan Office (move to Inbox)
UPDATE devices 
SET site_id = (SELECT id FROM sites WHERE name = 'Inbox / Unassigned' LIMIT 1),
    status = 'maintenance'
WHERE device_id = '5031646D9EB8';

-- 5. Unassign 5031DF05F4E9 (MAC device) from Boucheron Tokyo (move to Inbox)
UPDATE devices 
SET site_id = (SELECT id FROM sites WHERE name = 'Inbox / Unassigned' LIMIT 1),
    status = 'maintenance'
WHERE device_id = '5031DF05F4E9';

-- 6. Update telemetry_latest site_id for the moved device 2307270002
UPDATE telemetry_latest 
SET site_id = 'fc80adbc-52fb-4a0f-9f76-7e79ce258e00'
WHERE device_id = (SELECT id FROM devices WHERE device_id = '2307270002');

-- 7. Update device_provisioning_map: ensure 2307270002 maps to A060
INSERT INTO device_provisioning_map (device_external_id, site_uuid, project_name)
VALUES ('2307270002', 'fc80adbc-52fb-4a0f-9f76-7e79ce258e00', 'A060 113 MI-MILANO PIAZZA SAN BABILA')
ON CONFLICT (device_external_id) DO UPDATE SET 
  site_uuid = EXCLUDED.site_uuid,
  project_name = EXCLUDED.project_name;

-- 8. Remove provisioning entries for devices not in JSON (if they exist)
DELETE FROM device_provisioning_map WHERE device_external_id IN ('2412270008', '2504090014', '5031646D9EB8', '5031DF05F4E9');
