-- Migration: Create Events and Alerts table
-- Version: 005
-- Description: System events and alerts for monitoring

-- Event severity enum
CREATE TYPE event_severity AS ENUM (
    'info',
    'warning',
    'critical'
);

-- Event status enum
CREATE TYPE event_status AS ENUM (
    'active',
    'acknowledged',
    'resolved'
);

-- Events/Alerts table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL,           -- threshold_exceeded, device_offline, leak_detected, etc.
    severity event_severity NOT NULL DEFAULT 'info',
    status event_status NOT NULL DEFAULT 'active',
    
    title TEXT NOT NULL,
    message TEXT,
    metric TEXT,                        -- Related metric if applicable
    value NUMERIC,                      -- Value that triggered the event
    threshold NUMERIC,                  -- Threshold that was exceeded
    
    ts_created TIMESTAMPTZ NOT NULL DEFAULT now(),
    ts_acknowledged TIMESTAMPTZ,
    ts_resolved TIMESTAMPTZ,
    acknowledged_by TEXT,
    resolved_by TEXT,
    
    metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_events_site_id ON events(site_id);
CREATE INDEX idx_events_device_id ON events(device_id);
CREATE INDEX idx_events_severity ON events(severity);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_ts_created ON events(ts_created DESC);
CREATE INDEX idx_events_active ON events(status, severity) WHERE status = 'active';

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
    ON events FOR SELECT USING (true);

COMMENT ON TABLE events IS 'System events and alerts for monitoring';
