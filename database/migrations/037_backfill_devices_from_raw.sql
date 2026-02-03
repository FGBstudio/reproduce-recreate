-- Migration: Backfill missing devices from mqtt_messages_raw
-- Version: 037
-- Description: One-time script to create devices for any messages in raw that don't have a corresponding device
--
-- RUN THIS MANUALLY after applying migrations 034-036
-- Adjust BROKER_URL to match your actual broker

-- =============================================================================
-- BACKFILL DEVICES FROM RAW MESSAGES
-- =============================================================================

-- 1) Air Quality devices (fosensor/iaq topics)
INSERT INTO devices (device_id, device_type, broker, topic, site_id, last_seen, name, model, status)
SELECT DISTINCT ON (m.device_external_id)
    m.device_external_id,
    'air_quality'::device_type,
    COALESCE(m.payload->>'Broker', 'mqtt://data.hub.fgb-studio.com'),
    m.topic,
    NULL,  -- Orphan - will be assigned via admin UI
    MAX(m.received_at) OVER (PARTITION BY m.device_external_id),
    'BACKFILL - ' || m.device_external_id,
    COALESCE(m.payload->>'Model', 'UNKNOWN'),
    'offline'::device_status
FROM mqtt_messages_raw m
LEFT JOIN devices d ON d.device_id = m.device_external_id
WHERE m.device_external_id IS NOT NULL
  AND d.id IS NULL
  AND (m.topic ILIKE '%iaq%' OR m.topic ILIKE '%air%' OR m.topic ILIKE '%fosensor%')
ON CONFLICT (device_id, broker) DO NOTHING;

-- 2) Energy devices - PAN12 (bridge topics)
INSERT INTO devices (device_id, device_type, broker, topic, site_id, last_seen, name, model, status)
SELECT DISTINCT ON (m.device_external_id)
    m.device_external_id,
    'energy_monitor'::device_type,
    COALESCE(m.payload->>'Broker', 'mqtt://data.hub.fgb-studio.com'),
    m.topic,
    NULL,
    MAX(m.received_at) OVER (PARTITION BY m.device_external_id),
    'BACKFILL - ' || m.device_external_id,
    COALESCE(m.payload->>'type', 'PAN12'),
    'offline'::device_status
FROM mqtt_messages_raw m
LEFT JOIN devices d ON d.device_id = m.device_external_id
WHERE m.device_external_id IS NOT NULL
  AND d.id IS NULL
  AND m.topic LIKE 'bridge/%'
ON CONFLICT (device_id, broker) DO NOTHING;

-- 3) Energy devices - MSCHN (Schneider topics)
INSERT INTO devices (device_id, device_type, broker, topic, site_id, last_seen, name, model, status)
SELECT DISTINCT ON (m.device_external_id)
    m.device_external_id,
    'energy_monitor'::device_type,
    COALESCE(m.payload->>'Broker', 'mqtt://data.hub.fgb-studio.com'),
    m.topic,
    NULL,
    MAX(m.received_at) OVER (PARTITION BY m.device_external_id),
    'BACKFILL - ' || m.device_external_id,
    'MSCHN',
    'offline'::device_status
FROM mqtt_messages_raw m
LEFT JOIN devices d ON d.device_id = m.device_external_id
WHERE m.device_external_id IS NOT NULL
  AND d.id IS NULL
  AND (m.topic ILIKE '%mschn%')
ON CONFLICT (device_id, broker) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- Run this after backfill to check for any remaining orphan messages:
--
-- SELECT COUNT(*) as orphan_messages
-- FROM mqtt_messages_raw m
-- LEFT JOIN devices d ON d.device_id = m.device_external_id
-- WHERE m.device_external_id IS NOT NULL
--   AND d.id IS NULL;
--
-- Expected result: 0 (all messages have corresponding devices)

-- =============================================================================
-- CHECK ORPHAN DEVICES
-- =============================================================================
-- Run this to see devices awaiting site assignment:
--
-- SELECT id, device_id, model, device_type, last_seen, created_at
-- FROM devices
-- WHERE site_id IS NULL
-- ORDER BY created_at DESC;
