-- Seed Data for FGB IoT Dashboard Testing
-- Run after migrations to populate test data

-- =====================================================
-- HOLDINGS
-- =====================================================
INSERT INTO holdings (id, name, description) VALUES
  ('h-lvmh', 'LVMH', 'LVMH Moët Hennessy Louis Vuitton'),
  ('h-kering', 'Kering', 'Kering Group')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- BRANDS
-- =====================================================
INSERT INTO brands (id, holding_id, name, logo_url, primary_color) VALUES
  ('b-fendi', 'h-lvmh', 'Fendi', '/logos/fendi.svg', '#F0C14B'),
  ('b-dior', 'h-lvmh', 'Dior', '/logos/dior.svg', '#000000'),
  ('b-lv', 'h-lvmh', 'Louis Vuitton', '/logos/lv.svg', '#8B4513'),
  ('b-gucci', 'h-kering', 'Gucci', '/logos/gucci.svg', '#006400'),
  ('b-balenciaga', 'h-kering', 'Balenciaga', '/logos/balenciaga.svg', '#1C1C1C')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SITES (Stores/Projects)
-- =====================================================
INSERT INTO sites (id, brand_id, name, address, city, country, region, lat, lon, timezone, sqm, store_type, opened_at) VALUES
  -- Fendi stores
  ('s-fendi-milan', 'b-fendi', 'Fendi Milano Montenapoleone', 'Via Montenapoleone 3', 'Milano', 'Italy', 'EMEA', 45.4685, 9.1952, 'Europe/Rome', 850, 'flagship', '2020-01-15'),
  ('s-fendi-rome', 'b-fendi', 'Fendi Roma Palazzo', 'Largo Goldoni', 'Roma', 'Italy', 'EMEA', 41.9062, 12.4788, 'Europe/Rome', 2200, 'flagship', '2015-03-01'),
  ('s-fendi-paris', 'b-fendi', 'Fendi Paris Champs-Élysées', '51 Avenue Montaigne', 'Paris', 'France', 'EMEA', 48.8663, 2.3051, 'Europe/Paris', 620, 'boutique', '2019-06-20'),
  ('s-fendi-tokyo', 'b-fendi', 'Fendi Tokyo Ginza', '6-10-1 Ginza', 'Tokyo', 'Japan', 'APAC', 35.6722, 139.7649, 'Asia/Tokyo', 480, 'boutique', '2018-11-10'),
  ('s-fendi-dubai', 'b-fendi', 'Fendi Dubai Mall', 'Fashion Avenue', 'Dubai', 'UAE', 'MEA', 25.1976, 55.2783, 'Asia/Dubai', 750, 'boutique', '2017-09-05'),
  
  -- Dior stores
  ('s-dior-paris', 'b-dior', 'Dior Paris Montaigne', '30 Avenue Montaigne', 'Paris', 'France', 'EMEA', 48.8660, 2.3045, 'Europe/Paris', 1800, 'flagship', '2022-03-06'),
  ('s-dior-london', 'b-dior', 'Dior London New Bond', '160 New Bond Street', 'London', 'UK', 'EMEA', 51.5129, -0.1456, 'Europe/London', 920, 'flagship', '2021-07-15'),
  ('s-dior-nyc', 'b-dior', 'Dior New York 5th Ave', '767 Fifth Avenue', 'New York', 'USA', 'AMER', 40.7640, -73.9730, 'America/New_York', 1100, 'flagship', '2019-12-01'),
  
  -- Gucci stores
  ('s-gucci-florence', 'b-gucci', 'Gucci Garden Firenze', 'Piazza della Signoria', 'Firenze', 'Italy', 'EMEA', 43.7696, 11.2558, 'Europe/Rome', 1600, 'flagship', '2018-01-09'),
  ('s-gucci-shanghai', 'b-gucci', 'Gucci Shanghai Plaza 66', 'Nanjing Xi Lu', 'Shanghai', 'China', 'APAC', 31.2304, 121.4548, 'Asia/Shanghai', 890, 'boutique', '2020-08-25')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- DEVICES
-- =====================================================
INSERT INTO devices (id, site_id, device_id, mac_address, model, device_type, location, floor, zone, firmware_version, status, last_seen) VALUES
  -- Fendi Milano devices
  ('d-fm-aq1', 's-fendi-milan', 'WEEL0076', 'AA:BB:CC:DD:DD:8A', 'WEEL', 'air_quality', 'Ground Floor - Entrance', 0, 'entrance', '2.1.0', 'online', NOW() - INTERVAL '5 minutes'),
  ('d-fm-aq2', 's-fendi-milan', 'WEEL0077', 'AA:BB:CC:DD:DD:8B', 'WEEL', 'air_quality', 'First Floor - Women', 1, 'retail', '2.1.0', 'online', NOW() - INTERVAL '3 minutes'),
  ('d-fm-en1', 's-fendi-milan', 'PAN120001', 'AA:BB:CC:EE:77:71', 'PAN12', 'energy_single', 'Electrical Room', -1, 'utility', '1.5.2', 'online', NOW() - INTERVAL '1 minute'),
  ('d-fm-en2', 's-fendi-milan', 'SCH3P001', 'AA:BB:CC:C8:CF:01', 'SCHNEIDER_3P', 'energy_three_phase', 'Main Panel', -1, 'utility', '3.0.1', 'online', NOW() - INTERVAL '2 minutes'),
  
  -- Fendi Roma devices
  ('d-fr-aq1', 's-fendi-rome', 'LEED0025', 'AA:BB:CC:74:46:00', 'LEED', 'air_quality', 'Atrium', 0, 'entrance', '2.0.5', 'online', NOW() - INTERVAL '4 minutes'),
  ('d-fr-aq2', 's-fendi-rome', 'LEED0026', 'AA:BB:CC:74:46:01', 'LEED', 'air_quality', 'VIP Lounge', 2, 'vip', '2.0.5', 'online', NOW() - INTERVAL '6 minutes'),
  ('d-fr-en1', 's-fendi-rome', 'SCH3P002', 'AA:BB:CC:C8:CF:02', 'SCHNEIDER_3P', 'energy_three_phase', 'Main Distribution', -1, 'utility', '3.0.1', 'online', NOW() - INTERVAL '1 minute'),
  ('d-fr-wt1', 's-fendi-rome', 'WATER001', 'AA:BB:CC:WA:TE:01', 'WATERFLOW', 'water', 'Main Water Inlet', -1, 'utility', '1.2.0', 'online', NOW() - INTERVAL '10 minutes'),
  
  -- Dior Paris devices
  ('d-dp-aq1', 's-dior-paris', 'WEEL0100', 'AA:BB:CC:DD:00:01', 'WEEL', 'air_quality', 'Gallery Level', 0, 'retail', '2.1.0', 'online', NOW() - INTERVAL '2 minutes'),
  ('d-dp-en1', 's-dior-paris', 'SCH3P003', 'AA:BB:CC:C8:CF:03', 'SCHNEIDER_3P', 'energy_three_phase', 'Transformer Room', -2, 'utility', '3.0.1', 'online', NOW() - INTERVAL '1 minute'),
  
  -- Gucci Florence devices
  ('d-gf-aq1', 's-gucci-florence', 'LEED0050', 'AA:BB:CC:74:50:00', 'LEED', 'air_quality', 'Museum Area', 1, 'museum', '2.0.5', 'online', NOW() - INTERVAL '8 minutes'),
  ('d-gf-en1', 's-gucci-florence', 'PAN120010', 'AA:BB:CC:EE:77:10', 'PAN12', 'energy_single', 'Kitchen', 0, 'restaurant', '1.5.2', 'online', NOW() - INTERVAL '3 minutes')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- TELEMETRY LATEST VALUES
-- =====================================================
INSERT INTO telemetry_latest (device_id, metric, value, unit, ts) VALUES
  -- Fendi Milano Air Quality
  ('d-fm-aq1', 'temperature', 21.5, '°C', NOW() - INTERVAL '5 minutes'),
  ('d-fm-aq1', 'humidity', 45.2, '%', NOW() - INTERVAL '5 minutes'),
  ('d-fm-aq1', 'co2', 650, 'ppm', NOW() - INTERVAL '5 minutes'),
  ('d-fm-aq1', 'voc', 280, 'ppb', NOW() - INTERVAL '5 minutes'),
  ('d-fm-aq1', 'pm25', 12.5, 'µg/m³', NOW() - INTERVAL '5 minutes'),
  ('d-fm-aq1', 'pm10', 18.3, 'µg/m³', NOW() - INTERVAL '5 minutes'),
  
  ('d-fm-aq2', 'temperature', 22.1, '°C', NOW() - INTERVAL '3 minutes'),
  ('d-fm-aq2', 'humidity', 42.8, '%', NOW() - INTERVAL '3 minutes'),
  ('d-fm-aq2', 'co2', 720, 'ppm', NOW() - INTERVAL '3 minutes'),
  ('d-fm-aq2', 'voc', 315, 'ppb', NOW() - INTERVAL '3 minutes'),
  
  -- Fendi Milano Energy
  ('d-fm-en1', 'power', 2850, 'W', NOW() - INTERVAL '1 minute'),
  ('d-fm-en1', 'current', 12.4, 'A', NOW() - INTERVAL '1 minute'),
  ('d-fm-en1', 'voltage', 230, 'V', NOW() - INTERVAL '1 minute'),
  ('d-fm-en1', 'energy_total', 15420, 'kWh', NOW() - INTERVAL '1 minute'),
  ('d-fm-en1', 'rssi', -58, 'dBm', NOW() - INTERVAL '1 minute'),
  
  ('d-fm-en2', 'power', 18500, 'W', NOW() - INTERVAL '2 minutes'),
  ('d-fm-en2', 'current_l1', 28.5, 'A', NOW() - INTERVAL '2 minutes'),
  ('d-fm-en2', 'current_l2', 27.8, 'A', NOW() - INTERVAL '2 minutes'),
  ('d-fm-en2', 'current_l3', 29.1, 'A', NOW() - INTERVAL '2 minutes'),
  ('d-fm-en2', 'voltage_l1', 222.5, 'V', NOW() - INTERVAL '2 minutes'),
  ('d-fm-en2', 'voltage_l2', 223.1, 'V', NOW() - INTERVAL '2 minutes'),
  ('d-fm-en2', 'voltage_l3', 221.8, 'V', NOW() - INTERVAL '2 minutes'),
  
  -- Fendi Roma
  ('d-fr-aq1', 'temperature', 20.8, '°C', NOW() - INTERVAL '4 minutes'),
  ('d-fr-aq1', 'humidity', 48.5, '%', NOW() - INTERVAL '4 minutes'),
  ('d-fr-aq1', 'co2', 580, 'ppm', NOW() - INTERVAL '4 minutes'),
  ('d-fr-aq1', 'voc', 195, 'ppb', NOW() - INTERVAL '4 minutes'),
  
  ('d-fr-en1', 'power', 45200, 'W', NOW() - INTERVAL '1 minute'),
  ('d-fr-en1', 'energy_total', 89750, 'kWh', NOW() - INTERVAL '1 minute'),
  
  ('d-fr-wt1', 'flow_rate', 2.5, 'L/min', NOW() - INTERVAL '10 minutes'),
  ('d-fr-wt1', 'daily_consumption', 850, 'L', NOW() - INTERVAL '10 minutes'),
  
  -- Dior Paris
  ('d-dp-aq1', 'temperature', 21.2, '°C', NOW() - INTERVAL '2 minutes'),
  ('d-dp-aq1', 'humidity', 50.1, '%', NOW() - INTERVAL '2 minutes'),
  ('d-dp-aq1', 'co2', 520, 'ppm', NOW() - INTERVAL '2 minutes'),
  
  ('d-dp-en1', 'power', 35800, 'W', NOW() - INTERVAL '1 minute'),
  ('d-dp-en1', 'energy_total', 125680, 'kWh', NOW() - INTERVAL '1 minute'),
  
  -- Gucci Florence
  ('d-gf-aq1', 'temperature', 19.5, '°C', NOW() - INTERVAL '8 minutes'),
  ('d-gf-aq1', 'humidity', 55.2, '%', NOW() - INTERVAL '8 minutes'),
  ('d-gf-aq1', 'co2', 480, 'ppm', NOW() - INTERVAL '8 minutes'),
  
  ('d-gf-en1', 'power', 4200, 'W', NOW() - INTERVAL '3 minutes'),
  ('d-gf-en1', 'energy_total', 8920, 'kWh', NOW() - INTERVAL '3 minutes')
ON CONFLICT (device_id, metric) DO UPDATE SET
  value = EXCLUDED.value,
  ts = EXCLUDED.ts;

-- =====================================================
-- TELEMETRY RAW (Last 24 hours sample)
-- =====================================================
INSERT INTO telemetry (device_id, metric, value, unit, ts)
SELECT 
  'd-fm-aq1',
  'temperature',
  20 + random() * 4,
  '°C',
  NOW() - (n || ' minutes')::INTERVAL
FROM generate_series(1, 1440, 5) AS n;

INSERT INTO telemetry (device_id, metric, value, unit, ts)
SELECT 
  'd-fm-aq1',
  'co2',
  400 + random() * 600,
  'ppm',
  NOW() - (n || ' minutes')::INTERVAL
FROM generate_series(1, 1440, 5) AS n;

INSERT INTO telemetry (device_id, metric, value, unit, ts)
SELECT 
  'd-fm-en2',
  'power',
  15000 + random() * 10000,
  'W',
  NOW() - (n || ' minutes')::INTERVAL
FROM generate_series(1, 1440, 1) AS n;

-- =====================================================
-- SITE KPIs
-- =====================================================
INSERT INTO site_kpis (site_id, date, metric, value, unit) VALUES
  -- Fendi Milano - Last 7 days
  ('s-fendi-milan', CURRENT_DATE - 6, 'energy_consumption', 485.5, 'kWh'),
  ('s-fendi-milan', CURRENT_DATE - 5, 'energy_consumption', 512.3, 'kWh'),
  ('s-fendi-milan', CURRENT_DATE - 4, 'energy_consumption', 498.7, 'kWh'),
  ('s-fendi-milan', CURRENT_DATE - 3, 'energy_consumption', 521.2, 'kWh'),
  ('s-fendi-milan', CURRENT_DATE - 2, 'energy_consumption', 495.8, 'kWh'),
  ('s-fendi-milan', CURRENT_DATE - 1, 'energy_consumption', 508.4, 'kWh'),
  ('s-fendi-milan', CURRENT_DATE, 'energy_consumption', 245.2, 'kWh'),
  
  ('s-fendi-milan', CURRENT_DATE - 6, 'aqi_avg', 72, NULL),
  ('s-fendi-milan', CURRENT_DATE - 5, 'aqi_avg', 68, NULL),
  ('s-fendi-milan', CURRENT_DATE - 4, 'aqi_avg', 75, NULL),
  ('s-fendi-milan', CURRENT_DATE - 3, 'aqi_avg', 82, NULL),
  ('s-fendi-milan', CURRENT_DATE - 2, 'aqi_avg', 78, NULL),
  ('s-fendi-milan', CURRENT_DATE - 1, 'aqi_avg', 71, NULL),
  ('s-fendi-milan', CURRENT_DATE, 'aqi_avg', 74, NULL),
  
  -- Fendi Roma
  ('s-fendi-rome', CURRENT_DATE - 6, 'energy_consumption', 1120.5, 'kWh'),
  ('s-fendi-rome', CURRENT_DATE - 5, 'energy_consumption', 1185.3, 'kWh'),
  ('s-fendi-rome', CURRENT_DATE - 4, 'energy_consumption', 1098.7, 'kWh'),
  ('s-fendi-rome', CURRENT_DATE - 3, 'energy_consumption', 1210.2, 'kWh'),
  ('s-fendi-rome', CURRENT_DATE - 2, 'energy_consumption', 1145.8, 'kWh'),
  ('s-fendi-rome', CURRENT_DATE - 1, 'energy_consumption', 1178.4, 'kWh'),
  ('s-fendi-rome', CURRENT_DATE, 'energy_consumption', 580.2, 'kWh'),
  
  ('s-fendi-rome', CURRENT_DATE, 'water_consumption', 850, 'L'),
  
  -- Dior Paris
  ('s-dior-paris', CURRENT_DATE - 6, 'energy_consumption', 892.5, 'kWh'),
  ('s-dior-paris', CURRENT_DATE - 5, 'energy_consumption', 915.3, 'kWh'),
  ('s-dior-paris', CURRENT_DATE - 4, 'energy_consumption', 878.7, 'kWh'),
  ('s-dior-paris', CURRENT_DATE - 3, 'energy_consumption', 945.2, 'kWh'),
  ('s-dior-paris', CURRENT_DATE - 2, 'energy_consumption', 901.8, 'kWh'),
  ('s-dior-paris', CURRENT_DATE - 1, 'energy_consumption', 928.4, 'kWh'),
  ('s-dior-paris', CURRENT_DATE, 'energy_consumption', 425.2, 'kWh')
ON CONFLICT (site_id, date, metric) DO UPDATE SET
  value = EXCLUDED.value;

-- =====================================================
-- EVENTS/ALERTS
-- =====================================================
INSERT INTO events (site_id, device_id, event_type, severity, title, description, status, created_at) VALUES
  ('s-fendi-milan', 'd-fm-aq2', 'threshold', 'warning', 'CO2 Level High', 'CO2 exceeded 800 ppm in First Floor - Women area', 'open', NOW() - INTERVAL '2 hours'),
  ('s-fendi-rome', 'd-fr-wt1', 'anomaly', 'info', 'Unusual Water Flow', 'Water flow detected outside business hours', 'acknowledged', NOW() - INTERVAL '1 day'),
  ('s-dior-paris', 'd-dp-en1', 'threshold', 'critical', 'Power Spike Detected', 'Power consumption exceeded 50kW threshold', 'resolved', NOW() - INTERVAL '3 days'),
  ('s-gucci-florence', 'd-gf-aq1', 'threshold', 'warning', 'Humidity Alert', 'Humidity level above 60% in Museum Area', 'open', NOW() - INTERVAL '30 minutes')
ON CONFLICT DO NOTHING;

-- =====================================================
-- CERTIFICATIONS
-- =====================================================
INSERT INTO certifications (id, site_id, cert_type, target_level, current_level, status, started_at) VALUES
  ('c-fm-leed', 's-fendi-milan', 'LEED', 'Gold', 'Silver', 'in_progress', '2024-01-15'),
  ('c-fr-well', 's-fendi-rome', 'WELL', 'Platinum', NULL, 'in_progress', '2024-06-01'),
  ('c-dp-breeam', 's-dior-paris', 'BREEAM', 'Excellent', 'Excellent', 'certified', '2023-03-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO certification_milestones (certification_id, milestone, status, target_date, completed_at) VALUES
  ('c-fm-leed', 'Energy Audit Complete', 'completed', '2024-03-01', '2024-02-28'),
  ('c-fm-leed', 'Water Efficiency Assessment', 'completed', '2024-05-01', '2024-04-15'),
  ('c-fm-leed', 'Indoor Air Quality Testing', 'in_progress', '2024-08-01', NULL),
  ('c-fm-leed', 'Final Certification Review', 'pending', '2024-12-01', NULL),
  
  ('c-fr-well', 'Air Quality Baseline', 'completed', '2024-08-01', '2024-07-20'),
  ('c-fr-well', 'Light Measurement', 'in_progress', '2024-10-01', NULL),
  ('c-fr-well', 'Thermal Comfort Assessment', 'pending', '2024-12-01', NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- WATER ZONES
-- =====================================================
INSERT INTO water_zones (id, site_id, name, zone_type, expected_flow_lpm) VALUES
  ('wz-fr-main', 's-fendi-rome', 'Main Building Supply', 'main_supply', 15.0),
  ('wz-fr-hvac', 's-fendi-rome', 'HVAC System', 'hvac', 5.0),
  ('wz-fr-sanitary', 's-fendi-rome', 'Sanitary Facilities', 'sanitary', 8.0)
ON CONFLICT (id) DO NOTHING;
