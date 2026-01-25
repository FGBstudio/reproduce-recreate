-- Migration: Import Historical Energy - Step 2: Insert into Telemetry (RAW)
-- Version: 027
-- Description: Transform historical data and insert into main telemetry table

-- Insert historical data into telemetry with proper metric mapping
INSERT INTO telemetry (ts, value, unit, metric, site_id, device_id, labels)
SELECT 
    h.timestamp as ts,
    
    -- VALUE CONVERSION (if needed)
    -- If historical Power is in Watts (W) and metric is power_kw, divide by 1000
    CASE 
        WHEN h.metric_type = 'Power' AND h.unit = 'W' THEN h.value / 1000.0
        ELSE h.value
    END as value,

    -- UNIT NORMALIZATION
    CASE 
        WHEN h.metric_type = 'Power' THEN 'kW'
        WHEN h.metric_type = 'Current' THEN 'A'
        WHEN h.metric_type = 'Energy' THEN 'kWh'
        ELSE COALESCE(h.unit, 'unknown')
    END as unit,

    -- METRIC NAME MAPPING (critical for charts)
    CASE 
        WHEN h.metric_type = 'Power' THEN 'energy.power_kw'
        WHEN h.metric_type = 'Current' THEN 'energy.current_a'
        WHEN h.metric_type = 'Energy' THEN 'energy.active_energy'
        WHEN h.metric_type = 'Voltage' THEN 'energy.voltage'
        ELSE 'energy.unknown'
    END as metric,

    h.site_id,

    -- SMART DEVICE_ID ASSIGNMENT
    CASE 
        -- MILAN CASE: Link everything to "Milan-Office-Bridge-01"
        WHEN h.site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381' THEN (
            SELECT id FROM devices 
            WHERE site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381' 
            AND (device_id ILIKE '%Milan-Office-Bridge-01%' OR name ILIKE '%Milan-Office-Bridge-01%')
            LIMIT 1
        )
        -- OTHER SITES: Find virtual device created in Step 1
        ELSE d.id
    END as device_id,

    -- Label for tracking these records in the future
    jsonb_build_object(
        'source', 'historical_import', 
        'original_circuit', h.circuit_name,
        'original_metric', h.metric_type,
        'original_unit', h.unit,
        'imported_at', now()::text
    ) as labels

FROM historical_energy h
LEFT JOIN devices d ON h.site_id = d.site_id AND d.name = h.circuit_name
-- Safety filter: only insert if we found a valid device
WHERE (
    (h.site_id = 'fe102b55-ec8a-4f4f-b797-26ee6c132381') 
    OR 
    (d.id IS NOT NULL)
)
ON CONFLICT DO NOTHING;

-- Update telemetry_latest for these devices
INSERT INTO telemetry_latest (device_id, metric, value, unit, ts, quality)
SELECT DISTINCT ON (t.device_id, t.metric)
    t.device_id,
    t.metric,
    t.value,
    t.unit,
    t.ts,
    'historical'
FROM telemetry t
WHERE t.labels->>'source' = 'historical_import'
ORDER BY t.device_id, t.metric, t.ts DESC
ON CONFLICT (device_id, metric) 
DO UPDATE SET
    value = EXCLUDED.value,
    unit = EXCLUDED.unit,
    ts = EXCLUDED.ts,
    quality = EXCLUDED.quality
WHERE telemetry_latest.ts < EXCLUDED.ts;
