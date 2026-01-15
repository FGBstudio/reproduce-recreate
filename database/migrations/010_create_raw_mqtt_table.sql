-- Migration: Create raw MQTT messages table
-- Version: 010
-- Description: Store raw MQTT payloads for auditing and reprocessing

-- Raw MQTT messages (append-only log)
CREATE TABLE IF NOT EXISTS mqtt_messages_raw (
    id BIGSERIAL PRIMARY KEY,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    broker TEXT NOT NULL,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    device_external_id TEXT,               -- Extracted device identifier (if parseable)
    source_type TEXT,                       -- fosensor, bridge, mschn, etc.
    processed BOOLEAN DEFAULT FALSE,        -- Flag for reprocessing
    error_message TEXT                      -- Parsing error if any
);

-- Indexes for raw messages
CREATE INDEX idx_mqtt_raw_received_at ON mqtt_messages_raw(received_at DESC);
CREATE INDEX idx_mqtt_raw_topic ON mqtt_messages_raw(topic);
CREATE INDEX idx_mqtt_raw_device_id ON mqtt_messages_raw(device_external_id) WHERE device_external_id IS NOT NULL;
CREATE INDEX idx_mqtt_raw_unprocessed ON mqtt_messages_raw(received_at) WHERE NOT processed;
CREATE INDEX idx_mqtt_raw_source ON mqtt_messages_raw(source_type);

-- Enable RLS
ALTER TABLE mqtt_messages_raw ENABLE ROW LEVEL SECURITY;

-- RLS Policy - service role only for write, read for debugging
CREATE POLICY "Raw messages viewable by everyone"
    ON mqtt_messages_raw FOR SELECT USING (true);

-- Retention: Auto-delete after 7 days (handled by cron)
-- See migration 013 for the purge function

COMMENT ON TABLE mqtt_messages_raw IS 'Raw MQTT payloads - append only log for auditing/reprocessing';
COMMENT ON COLUMN mqtt_messages_raw.device_external_id IS 'Device ID extracted from payload (MAC, sensor_sn, ID)';
COMMENT ON COLUMN mqtt_messages_raw.source_type IS 'Parser type: fosensor, bridge, mschn';
