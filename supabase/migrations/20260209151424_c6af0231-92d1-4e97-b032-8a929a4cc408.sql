-- Fix: Assign device 2503040002 to FGB Milan Office
UPDATE devices 
SET site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381', status = 'online'
WHERE device_id = '2503040002';

UPDATE telemetry_latest 
SET site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381' 
WHERE device_id = (SELECT id FROM devices WHERE device_id = '2503040002');