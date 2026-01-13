-- Migration: Create Devices table
-- Version: 002
-- Description: Device/sensor registry for all IoT devices

-- Device types enum
CREATE TYPE device_type AS ENUM (
    'air_quality',      -- WEEL, LEED sensors (VOC, CO2, Temp, Humidity, O3, CO, PM2.5, PM10)
    'energy_monitor',   -- PAN12, Schneider sensors (Current, Voltage, Power)
    'water_meter',      -- Water flow/quality sensors
    'occupancy',        -- Occupancy/presence sensors
    'hvac',             -- HVAC control/monitoring
    'lighting',         -- Smart lighting systems
    'other'
);

-- Device status enum
CREATE TYPE device_status AS ENUM (
    'online',
    'offline',
    'warning',
    'error',
    'maintenance'
);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,           -- External device identifier (e.g., "******0076")
    mac_address TEXT,                   -- MAC address if available
    model TEXT,                         -- Device model (e.g., WEEL, LEED, PAN12)
    device_type device_type NOT NULL,
    broker TEXT,                        -- MQTT broker source
    topic TEXT,                         -- MQTT topic
    name TEXT,                          -- Human-readable name
    location TEXT,                      -- Location within site (e.g., "Floor 1", "Main Hall")
    status device_status DEFAULT 'offline',
    last_seen TIMESTAMPTZ,
    rssi_dbm NUMERIC,                   -- Signal strength
    firmware_version TEXT,
    metadata JSONB DEFAULT '{}',        -- Additional device-specific data
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(device_id, broker)
);

-- Indexes
CREATE INDEX idx_devices_site_id ON devices(site_id);
CREATE INDEX idx_devices_device_type ON devices(device_type);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_last_seen ON devices(last_seen DESC);
CREATE INDEX idx_devices_model ON devices(model);

-- Apply trigger
CREATE TRIGGER update_devices_updated_at
    BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- RLS Policy (read-only for dashboard)
CREATE POLICY "Devices are viewable by everyone"
    ON devices FOR SELECT
    USING (true);

COMMENT ON TABLE devices IS 'Registry of all IoT devices/sensors';
COMMENT ON COLUMN devices.device_id IS 'External identifier from MQTT payload';
COMMENT ON COLUMN devices.model IS 'Device model: WEEL, LEED (air), PAN12 (energy)';
