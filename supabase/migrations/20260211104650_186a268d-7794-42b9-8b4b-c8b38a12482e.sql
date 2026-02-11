
-- ============================================================
-- Migration: Reassign air quality devices per projects_output-3.json
-- Also updates device names and syncs telemetry site_ids
-- ============================================================

-- STEP 1: Reassign devices and rename them per JSON mapping
-- Each UPDATE moves the device to its correct site and sets the project name

-- 2412270086 → P036 Tanger Outlets Deer Park - The Arches
UPDATE devices SET site_id = '6a20930e-1681-4f38-9184-d45dabd8e78a', name = 'P036 Tanger Outlets Deer Park - The Arches' WHERE device_id = '2412270086';
-- 2412270087 → 5308 The Shops at Pembroke Gardens
UPDATE devices SET site_id = '9806b32c-26a9-4b34-83cb-e8e91a6f4b9f', name = '5308 The Shops at Pembroke Gardens' WHERE device_id = '2412270087';
-- 2412270088 → 3746 Tanger Outlets Myrtle Beach HWY 501
UPDATE devices SET site_id = '7ad1982a-c6b8-471b-b302-79b0e4f0d286', name = '3746 Tanger Outlets Myrtle Beach HWY 501' WHERE device_id = '2412270088';
-- 2412270089 → 3195 MIRACLE MILE SHOPS
UPDATE devices SET site_id = '02b48263-4276-4376-948b-7e44a4e1f46c', name = '3195 MIRACLE MILE SHOPS' WHERE device_id = '2412270089';
-- 2412270091 → 3271 845 Lincoln Road
UPDATE devices SET site_id = '9e290df9-e556-406c-92f9-dfd827b21326', name = '3271 845 Lincoln Road' WHERE device_id = '2412270091';
-- 2412270092 → 3421 Tanger Outlets Hershey
UPDATE devices SET site_id = '3335dbd9-2941-465e-bbbb-123d54db09a1', name = '3421 Tanger Outlets Hershey' WHERE device_id = '2412270092';
-- 2412270093 → 2856 Tanger Outlets Texas City
UPDATE devices SET site_id = 'a90d3ca5-fff6-4c20-82f1-e04820b00e5c', name = '2856 Tanger Outlets Texas City' WHERE device_id = '2412270093';
-- 2412270094 → A810 Downtown Palm Springs
UPDATE devices SET site_id = '056a830c-416e-42ab-b418-a1a9791b0d02', name = 'A810 Downtown Palm Springs' WHERE device_id = '2412270094';
-- 2412270095 → F353 Kimball on Main
UPDATE devices SET site_id = 'd3a38d1a-9b61-40ab-9806-91053e923244', name = 'F353 Kimball on Main' WHERE device_id = '2412270095';
-- 2412270096 → 4098 Lime Ridge Mall
UPDATE devices SET site_id = '145890a8-6d84-4a1b-983e-7c17c71f5158', name = '4098 Lime Ridge Mall' WHERE device_id = '2412270096';
-- 2412270097 → 5167 Pinnacle Hills Promenade
UPDATE devices SET site_id = '28b372c8-3db6-4efe-8783-1a9df2267d80', name = '5167 Pinnacle Hills Promenade' WHERE device_id = '2412270097';
-- 2412270098 → 1914 French Mountain Outlet Center
UPDATE devices SET site_id = 'acf99500-301a-4243-a992-b0ae299b99b7', name = '1914 French Mountain Outlet Center' WHERE device_id = '2412270098';
-- 2412270099 → F557 Pierside Pavilion
UPDATE devices SET site_id = 'f5fc038b-911a-4eed-8890-97b3d87e1c7d', name = 'F557 Pierside Pavilion' WHERE device_id = '2412270099';

-- 2501090002 → Boucheron Siam Paragon
UPDATE devices SET site_id = 'f962d9e9-c98c-4444-8c3e-8cd6605d27af', name = 'Boucheron Siam Paragon' WHERE device_id = '2501090002';

-- 2503040004 → Insediamento DiMar Group
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2503040004';
-- 2503040006 → Insediamento DiMar Group
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2503040006';

-- 2504090005 → Versace Chongqing Florentia Outlet
UPDATE devices SET site_id = '77e8995e-cd49-4565-a794-6a854ba199d9', name = 'Versace Chongqing Florentia Outlet' WHERE device_id = '2504090005';
-- 2504090006 → HIG killarney
UPDATE devices SET site_id = '0cdb99ee-abc3-48ff-b512-1070ec06fadb', name = 'HIG killarney' WHERE device_id = '2504090006';
-- 2504090010 → BRIONI DUBAI MALL
UPDATE devices SET site_id = '243d5575-5c14-4c90-970a-07e84de88853', name = 'BRIONI DUBAI MALL' WHERE device_id = '2504090010';
-- 2504090011 → HIG Douglas
UPDATE devices SET site_id = 'b0b4c8eb-9e7d-4e6e-8ce1-cd69d0dd5573', name = 'HIG Douglas' WHERE device_id = '2504090011';
-- 2504090013 → Versace Chengdu IFS
UPDATE devices SET site_id = 'b3af71d8-4b05-4588-b040-288e61e423a9', name = 'Versace Chengdu IFS' WHERE device_id = '2504090013';
-- 2504090015 → Balenciaga Nice
UPDATE devices SET site_id = '16a8dd2b-851d-4919-a142-4f3ae0728460', name = 'Balenciaga Nice' WHERE device_id = '2504090015';
-- 2504090020 → Miu Miu Highland park
UPDATE devices SET site_id = 'd031ceb3-f7e7-4a78-8b2a-dc0b755e87bf', name = 'Miu Miu Highland park' WHERE device_id = '2504090020';
-- 2504090021 → Versace Bangkok central Embassy
UPDATE devices SET site_id = '08a6e34b-6547-44d1-a276-a0bd559b00d6', name = 'Versace Bangkok central Embassy' WHERE device_id = '2504090021';
-- 2504090022 → HIG Greenhills
UPDATE devices SET site_id = '714d1207-892e-4831-883b-40a81a2a5e51', name = 'HIG Greenhills' WHERE device_id = '2504090022';
-- 2504090023 → Pomellato Cannes
UPDATE devices SET site_id = 'a57965b3-500f-4910-b6e6-92e3a11b350c', name = 'Pomellato Cannes' WHERE device_id = '2504090023';
-- 2504090024 → Boucheron Busan Shinseage Centum
UPDATE devices SET site_id = '210245ac-836a-413d-bade-085633279173', name = 'Boucheron Busan Shinseage Centum' WHERE device_id = '2504090024';
-- 2504090025 → Versace Shinsegae Main
UPDATE devices SET site_id = '9320e88c-ea33-4907-85d1-b7d66d8bc49e', name = 'Versace Shinsegae Main' WHERE device_id = '2504090025';
-- 2504090030 → Boucheron Hyundai Seoul
UPDATE devices SET site_id = 'e8910964-7ea8-4da7-9435-7912eb9ed7c2', name = 'Boucheron Hyundai Seoul' WHERE device_id = '2504090030';
-- 2504090035 → Saint Laurent Napoli
UPDATE devices SET site_id = 'b708e2e0-a098-4888-b78b-2aa7e011c20a', name = 'Saint Laurent Napoli' WHERE device_id = '2504090035';
-- 2504090042 → Prada Westfield Sydney
UPDATE devices SET site_id = '4de1a0ac-78fb-4915-a17d-b7d6c5963778', name = 'Prada Westfield Sydney' WHERE device_id = '2504090042';

-- Insediamento DiMar Group batch (2504160xxx)
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160010';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160012';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160019';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160020';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160024';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160027';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160029';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160037';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160040';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160042';
UPDATE devices SET site_id = 'd62b6b17-06af-4347-aa64-7b3f09682952', name = 'Insediamento DiMar Group' WHERE device_id = '2504160053';

-- 2508140xxx batch
UPDATE devices SET site_id = '716d34d9-d36f-4d60-ae53-2fd97ab48078', name = 'Saint Laurent Avenue Montaigne' WHERE device_id = '2508140003';
UPDATE devices SET site_id = '716d34d9-d36f-4d60-ae53-2fd97ab48078', name = 'Saint Laurent Avenue Montaigne' WHERE device_id = '2508140006';
UPDATE devices SET site_id = '716d34d9-d36f-4d60-ae53-2fd97ab48078', name = 'Saint Laurent Avenue Montaigne' WHERE device_id = '2508140007';
UPDATE devices SET site_id = 'a5a789a3-d515-4fa4-aa73-8cd678c2f362', name = 'Balenciaga Serravalle' WHERE device_id = '2508140008';
UPDATE devices SET site_id = '716d34d9-d36f-4d60-ae53-2fd97ab48078', name = 'Saint Laurent Avenue Montaigne' WHERE device_id = '2508140010';
UPDATE devices SET site_id = 'b022c8f2-eea5-48ed-95d3-71137f071a76', name = 'Boucheron Doha Lagoona Mall' WHERE device_id = '2508140011';
UPDATE devices SET site_id = '4de1a0ac-78fb-4915-a17d-b7d6c5963778', name = 'Prada Westfield Sydney' WHERE device_id = '2508140012';
UPDATE devices SET site_id = '4de1a0ac-78fb-4915-a17d-b7d6c5963778', name = 'Prada Westfield Sydney' WHERE device_id = '2508140013';
UPDATE devices SET site_id = '4de1a0ac-78fb-4915-a17d-b7d6c5963778', name = 'Prada Westfield Sydney' WHERE device_id = '2508140014';
UPDATE devices SET site_id = '2574afc6-3d1c-4e5d-8bf3-88a9fbb7c9a3', name = 'Boucheron Shanghai Xintiandi' WHERE device_id = '2508140021';
UPDATE devices SET site_id = '733bb17c-fd26-4b13-9ad8-97f3fb028133', name = 'Saint Laurent Frankfurt' WHERE device_id = '2508140026';
UPDATE devices SET site_id = '6391ab5f-6cd9-4aaa-9740-1ccd8b46874a', name = 'Audemars Piguet Chengdu TKL' WHERE device_id = '2508140031';
UPDATE devices SET site_id = '1b89fbff-52b4-47db-8d17-05ecd0bb76b3', name = 'PRADA Taipei Breeze Nanshan' WHERE device_id = '2508140034';
UPDATE devices SET site_id = '93a99c3a-7fc3-4dff-a6cc-22d6aa0b90f5', name = 'Michael Kors Taipei 101' WHERE device_id = '2508140037';

-- STEP 2: Update telemetry_latest site_id to match new device assignments
-- The trigger_sync_telemetry_site_id should handle this automatically on device UPDATE,
-- but let's also do a manual sync for safety
UPDATE telemetry_latest tl
SET site_id = d.site_id
FROM devices d
WHERE tl.device_id = d.id
AND tl.site_id IS DISTINCT FROM d.site_id;

-- STEP 3: Update recent telemetry site_id (last 7 days)
UPDATE telemetry t
SET site_id = d.site_id
FROM devices d
WHERE t.device_id = d.id
AND t.site_id IS DISTINCT FROM d.site_id
AND t.ts >= now() - interval '7 days';

-- STEP 4: Update telemetry_hourly site_id (last 7 days)
UPDATE telemetry_hourly th
SET site_id = d.site_id
FROM devices d
WHERE th.device_id = d.id
AND th.site_id IS DISTINCT FROM d.site_id
AND th.ts_hour >= now() - interval '7 days';

-- STEP 5: Update telemetry_daily site_id (last 30 days)
UPDATE telemetry_daily td
SET site_id = d.site_id
FROM devices d
WHERE td.device_id = d.id
AND td.site_id IS DISTINCT FROM d.site_id
AND td.ts_day >= CURRENT_DATE - interval '30 days';
