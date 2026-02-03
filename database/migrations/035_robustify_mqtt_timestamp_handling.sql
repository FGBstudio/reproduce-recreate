-- Migration: Robustify MQTT timestamp handling in trigger
-- Version: 035
-- Description: Improves timestamp parsing with multiple fallbacks and edge case handling
--
-- TIMESTAMP PARSING STRATEGY:
-- 1. Try payload.timestamp (epoch seconds or milliseconds)
-- 2. Try payload.ts (epoch seconds or milliseconds)  
-- 3. Try payload.Timestamp (ISO string or date string)
-- 4. Try payload.time (ISO string or date string)
-- 5. Fallback to received_at (server time)
--
-- VALIDATION:
-- - Reject timestamps before 2020-01-01 (likely invalid epoch)
-- - Reject timestamps more than 1 day in the future
-- - Handle both seconds and milliseconds epoch formats

-- =============================================================================
-- 1. ROBUST TIMESTAMP EXTRACTION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION extract_mqtt_timestamp(
    p_payload JSONB,
    p_received_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_ts TIMESTAMPTZ;
    v_epoch NUMERIC;
    v_str TEXT;
    v_min_valid TIMESTAMPTZ := '2020-01-01'::timestamptz;
    v_max_valid TIMESTAMPTZ := NOW() + INTERVAL '1 day';
BEGIN
    -- Strategy 1: Try numeric epoch fields (timestamp, ts)
    FOR v_epoch IN 
        SELECT val::numeric 
        FROM jsonb_each_text(p_payload) 
        WHERE key IN ('timestamp', 'ts', 'epoch', 'unix_ts')
          AND val ~ '^[0-9]+\.?[0-9]*$'
        LIMIT 1
    LOOP
        BEGIN
            -- Detect milliseconds vs seconds
            IF v_epoch > 1000000000000 THEN
                -- Milliseconds (13+ digits)
                v_ts := to_timestamp(v_epoch / 1000.0);
            ELSIF v_epoch > 1000000000 THEN
                -- Seconds (10 digits)
                v_ts := to_timestamp(v_epoch);
            ELSE
                -- Too small, likely invalid
                CONTINUE;
            END IF;
            
            -- Validate range
            IF v_ts >= v_min_valid AND v_ts <= v_max_valid THEN
                RETURN v_ts;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Invalid epoch, try next
            NULL;
        END;
    END LOOP;
    
    -- Strategy 2: Try string timestamp fields (Timestamp, time, datetime)
    FOR v_str IN 
        SELECT val 
        FROM jsonb_each_text(p_payload) 
        WHERE key IN ('Timestamp', 'time', 'datetime', 'created_at', 'recorded_at')
          AND val IS NOT NULL
          AND length(val) >= 10
        LIMIT 1
    LOOP
        BEGIN
            -- Handle common formats
            -- "2025-01-15 10:30:00" or "2025-01-15T10:30:00Z" or "2025-01-15T10:30:00+00:00"
            v_str := REPLACE(v_str, ' ', 'T');
            
            -- Add timezone if missing
            IF v_str !~ '[+-][0-9]{2}:[0-9]{2}$' AND v_str !~ 'Z$' THEN
                v_str := v_str || '+00:00';
            END IF;
            
            v_ts := v_str::timestamptz;
            
            -- Validate range
            IF v_ts >= v_min_valid AND v_ts <= v_max_valid THEN
                RETURN v_ts;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Invalid format, try next
            NULL;
        END;
    END LOOP;
    
    -- Strategy 3: Fallback to received_at
    RETURN COALESCE(p_received_at, NOW());
END;
$$;

COMMENT ON FUNCTION extract_mqtt_timestamp IS 
    'Extracts timestamp from MQTT payload with multiple format support and validation';

-- =============================================================================
-- 2. UPDATE MQTT PROCESSING TRIGGER (Replaces migration 024)
-- =============================================================================

CREATE OR REPLACE FUNCTION process_mqtt_message_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_device_uuid UUID;
    v_site_uuid UUID;
    v_json_key TEXT;         
    v_mapped_metric TEXT;    
    v_json_value NUMERIC;
    v_ts TIMESTAMPTZ;
    v_bucket_ts TIMESTAMPTZ;
    v_raw_val JSONB;
    v_unit TEXT;
BEGIN
    -- A. DEVICE LOOKUP (by device_external_id or topic)
    SELECT id, site_id INTO v_device_uuid, v_site_uuid
    FROM devices
    WHERE 
        device_id = NEW.device_external_id 
        OR topic = NEW.topic
    LIMIT 1;

    IF v_device_uuid IS NULL THEN
        UPDATE mqtt_messages_raw 
        SET processed = TRUE, 
            error_message = 'Device not found: ' || COALESCE(NEW.device_external_id, NEW.topic, 'Unknown')
        WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    -- B. TIMESTAMP EXTRACTION (using robust function)
    v_ts := extract_mqtt_timestamp(NEW.payload, NEW.received_at);
    
    -- C. 15-MINUTE BUCKET for idempotent history writes
    v_bucket_ts := date_bin(INTERVAL '15 minutes', v_ts, '2020-01-01'::timestamptz);

    -- D. PARSE, MAP & WRITE METRICS
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- Skip metadata fields
        CONTINUE WHEN lower(v_json_key) IN (
            'mac', 'model', 'msgid', 'deviceid', 'timestamp', 'token', 
            'broker', 'topic', 'id', 'device_id', 'ts', 'time', 'datetime',
            'created_at', 'updated_at', 'type', 'sensor_sn', 'rssi_dbm'
        );

        -- METRIC NAME MAPPING
        CASE upper(v_json_key)
            -- Air Quality (IAQ)
            WHEN 'TEMP'     THEN v_mapped_metric := 'env.temperature'; v_unit := '°C';
            WHEN 'HUM'      THEN v_mapped_metric := 'env.humidity'; v_unit := '%';
            WHEN 'HUMIDITY' THEN v_mapped_metric := 'env.humidity'; v_unit := '%';
            WHEN 'CO2'      THEN v_mapped_metric := 'iaq.co2'; v_unit := 'ppm';
            WHEN 'VOC'      THEN v_mapped_metric := 'iaq.voc'; v_unit := 'µg/m³';
            WHEN 'TVOC'     THEN v_mapped_metric := 'iaq.voc'; v_unit := 'µg/m³';
            WHEN 'PM2.5'    THEN v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
            WHEN 'PM25'     THEN v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
            WHEN 'PM10'     THEN v_mapped_metric := 'iaq.pm10'; v_unit := 'µg/m³';
            WHEN 'CO'       THEN v_mapped_metric := 'iaq.co'; v_unit := 'ppm';
            WHEN 'O3'       THEN v_mapped_metric := 'iaq.o3'; v_unit := 'ppb';
            -- Energy Single Phase
            WHEN 'CURRENT_A' THEN v_mapped_metric := 'energy.current_a'; v_unit := 'A';
            -- Energy Three Phase
            WHEN 'I1' THEN v_mapped_metric := 'energy.current_l1'; v_unit := 'A';
            WHEN 'I2' THEN v_mapped_metric := 'energy.current_l2'; v_unit := 'A';
            WHEN 'I3' THEN v_mapped_metric := 'energy.current_l3'; v_unit := 'A';
            WHEN 'V1' THEN v_mapped_metric := 'energy.voltage_l1'; v_unit := 'V';
            WHEN 'V2' THEN v_mapped_metric := 'energy.voltage_l2'; v_unit := 'V';
            WHEN 'V3' THEN v_mapped_metric := 'energy.voltage_l3'; v_unit := 'V';
            WHEN 'PF1' THEN v_mapped_metric := 'energy.pf_l1'; v_unit := '';
            WHEN 'PF2' THEN v_mapped_metric := 'energy.pf_l2'; v_unit := '';
            WHEN 'PF3' THEN v_mapped_metric := 'energy.pf_l3'; v_unit := '';
            -- Power (if pre-computed)
            WHEN 'POWER_W'  THEN v_mapped_metric := 'energy.power_w'; v_unit := 'W';
            WHEN 'POWER_KW' THEN v_mapped_metric := 'energy.power_kw'; v_unit := 'kW';
            -- Default: use lowercase key as metric
            ELSE v_mapped_metric := lower(v_json_key); v_unit := NULL;
        END CASE;

        -- VALUE EXTRACTION (handle nested objects like {"value": 20.5, "udm": "C"})
        v_raw_val := NEW.payload->v_json_key;
        
        BEGIN
            IF jsonb_typeof(v_raw_val) = 'object' AND v_raw_val ? 'value' THEN
                v_json_value := (v_raw_val->>'value')::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'number' THEN
                v_json_value := (v_raw_val::text)::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'string' AND (v_raw_val::text) ~ '^"?-?[0-9]+\.?[0-9]*"?$' THEN
                v_json_value := (v_raw_val#>>'{}')::NUMERIC;
            ELSE
                -- Not a numeric value, skip
                CONTINUE;
            END IF;
            
            -- VALIDATION: Skip placeholder values (e.g., -55555)
            IF v_json_value < -50000 OR v_json_value > 1e12 THEN
                CONTINUE;
            END IF;
            
            -- WRITE: LIVE (always update latest)
            INSERT INTO telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric) 
            DO UPDATE SET 
                value = EXCLUDED.value, 
                ts = EXCLUDED.ts,
                site_id = EXCLUDED.site_id,
                quality = EXCLUDED.quality;
            
            -- WRITE: HISTORY (1 point per 15-min bucket per metric, idempotent)
            INSERT INTO telemetry (device_id, site_id, ts, metric, value, unit, quality, raw_payload)
            VALUES (v_device_uuid, v_site_uuid, v_bucket_ts, v_mapped_metric, v_json_value, v_unit, 'good', NEW.payload)
            ON CONFLICT (device_id, metric, ts)
            DO UPDATE SET
                value = EXCLUDED.value,
                unit = COALESCE(EXCLUDED.unit, telemetry.unit),
                quality = EXCLUDED.quality,
                raw_payload = EXCLUDED.raw_payload;

        EXCEPTION WHEN OTHERS THEN
            -- Log error but continue processing other metrics
            UPDATE mqtt_messages_raw
            SET error_message = COALESCE(NULLIF(error_message, ''), '') || 
                                v_json_key || ': ' || SQLERRM || '; '
            WHERE id = NEW.id;
            CONTINUE;
        END;
    END LOOP;

    -- E. MARK AS PROCESSED
    UPDATE mqtt_messages_raw
    SET processed = TRUE
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_process_mqtt_message ON mqtt_messages_raw;
CREATE TRIGGER trg_process_mqtt_message
    AFTER INSERT ON mqtt_messages_raw
    FOR EACH ROW
    EXECUTE FUNCTION process_mqtt_message_trigger();

-- =============================================================================
-- 3. ENSURE UNIQUE CONSTRAINT FOR IDEMPOTENT WRITES
-- =============================================================================

-- This enables ON CONFLICT for history writes
DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'telemetry_device_metric_ts_key'
    ) THEN
        -- Create unique constraint for idempotent writes
        ALTER TABLE telemetry ADD CONSTRAINT telemetry_device_metric_ts_key 
            UNIQUE (device_id, metric, ts);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Constraint already exists
END $$;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- This migration improves timestamp handling with:
-- 1. Dedicated extract_mqtt_timestamp() function with multiple format support
-- 2. Epoch detection (seconds vs milliseconds)
-- 3. String timestamp parsing with timezone handling
-- 4. Validation against reasonable date range (2020 - now+1day)
-- 5. Fallback to received_at for reliability
-- 6. Idempotent history writes (ON CONFLICT DO UPDATE)
