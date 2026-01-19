-- Migration: Fix devices RLS for service role inserts
-- Version: 019
-- Description: Allow service_role to insert devices for MQTT ingestion auto-registration

-- =============================================================================
-- IMPORTANT: Service Role Key Behavior
-- =============================================================================
-- The SUPABASE_SERVICE_ROLE_KEY should bypass RLS by default when used correctly.
-- However, if the ingestion service is experiencing RLS violations, we add
-- explicit policies for the service_role to ensure INSERT operations work.

-- =============================================================================
-- Option 1: Add explicit service_role policies (recommended for clarity)
-- =============================================================================

-- Allow service_role to insert devices (for MQTT ingestion auto-registration)
DROP POLICY IF EXISTS "Service role can insert devices" ON public.devices;
CREATE POLICY "Service role can insert devices"
    ON public.devices FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Allow service_role to update devices
DROP POLICY IF EXISTS "Service role can update devices" ON public.devices;
CREATE POLICY "Service role can update devices"
    ON public.devices FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow service_role to select devices
DROP POLICY IF EXISTS "Service role can select devices" ON public.devices;
CREATE POLICY "Service role can select devices"
    ON public.devices FOR SELECT
    TO service_role
    USING (true);

-- =============================================================================
-- Also add service_role policies for telemetry and raw tables
-- =============================================================================

-- Telemetry table
DROP POLICY IF EXISTS "Service role can insert telemetry" ON public.telemetry;
CREATE POLICY "Service role can insert telemetry"
    ON public.telemetry FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can select telemetry" ON public.telemetry;
CREATE POLICY "Service role can select telemetry"
    ON public.telemetry FOR SELECT
    TO service_role
    USING (true);

-- Telemetry latest table
DROP POLICY IF EXISTS "Service role can insert telemetry_latest" ON public.telemetry_latest;
CREATE POLICY "Service role can insert telemetry_latest"
    ON public.telemetry_latest FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update telemetry_latest" ON public.telemetry_latest;
CREATE POLICY "Service role can update telemetry_latest"
    ON public.telemetry_latest FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can select telemetry_latest" ON public.telemetry_latest;
CREATE POLICY "Service role can select telemetry_latest"
    ON public.telemetry_latest FOR SELECT
    TO service_role
    USING (true);

-- Raw MQTT messages table
DROP POLICY IF EXISTS "Service role can insert raw messages" ON public.mqtt_messages_raw;
CREATE POLICY "Service role can insert raw messages"
    ON public.mqtt_messages_raw FOR INSERT
    TO service_role
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can select raw messages" ON public.mqtt_messages_raw;
CREATE POLICY "Service role can select raw messages"
    ON public.mqtt_messages_raw FOR SELECT
    TO service_role
    USING (true);

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON POLICY "Service role can insert devices" ON public.devices IS 
    'Allows MQTT ingestion service using service_role key to auto-register new devices';

COMMENT ON POLICY "Service role can insert telemetry" ON public.telemetry IS 
    'Allows MQTT ingestion service to insert telemetry data';

COMMENT ON POLICY "Service role can insert raw messages" ON public.mqtt_messages_raw IS 
    'Allows MQTT ingestion service to store raw MQTT messages';
