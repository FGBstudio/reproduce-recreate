-- Migration: Auto-create devices in MQTT trigger
-- Version: 038
-- Description: When a message arrives and the device doesn't exist, create it automatically
--
-- PROBLEM SOLVED:
-- Currently the trigger exits early if device not found → most messages never become telemetry.
-- This migration makes the trigger create orphan devices (site_id = NULL) automatically.
--
-- FLOW AFTER THIS MIGRATION:
-- 1. Message arrives in mqtt_messages_raw
-- 2. Trigger looks up device by device_external_id or topic
-- 3. IF NOT FOUND → creates device with site_id = NULL
-- 4. Writes metrics to telemetry + telemetry_latest
-- 5. Admin assigns device to site later via UI

-- =============================================================================
-- 1. HELPER FUNCTION: Infer device type from topic
-- =============================================================================

CREATE OR REPLACE FUNCTION infer_device_type_from_topic(p_topic TEXT)
RETURNS device_type
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_topic ILIKE '%fosensor%' OR p_topic ILIKE '%iaq%' OR p_topic ILIKE '%air%' THEN
        RETURN 'air_quality'::device_type;
    ELSIF p_topic ILIKE '%bridge%' OR p_topic ILIKE '%pan12%' THEN
        RETURN 'energy_monitor'::device_type;
    ELSIF p_topic ILIKE '%mschn%' OR p_topic ILIKE '%schneider%' THEN
        RETURN 'energy_monitor'::device_type;
    ELSIF p_topic ILIKE '%water%' THEN
        RETURN 'water_meter'::device_type;
    ELSE
        RETURN 'other'::device_type;
    END IF;
END;
$$;

-- =============================================================================
-- 2. UPDATED TRIGGER: Auto-create device if missing
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
    v_device_type device_type;
    v_model TEXT;
    v_broker TEXT;
BEGIN
    -- ==========================================================================
    -- A. DEVICE LOOKUP OR AUTO-CREATE
    -- ==========================================================================
    
    -- First try to find existing device
    SELECT id, site_id INTO v_device_uuid, v_site_uuid
    FROM devices
    WHERE 
        (NEW.device_external_id IS NOT NULL AND device_id = NEW.device_external_id)
        OR topic = NEW.topic
    LIMIT 1;

    -- If device not found AND we have an external ID, create it as orphan
    IF v_device_uuid IS NULL THEN
        -- Need an external ID to create device
        IF NEW.device_external_id IS NULL OR TRIM(NEW.device_external_id) = '' THEN
            UPDATE mqtt_messages_raw 
            SET processed = TRUE, 
                error_message = 'Cannot create device: no external ID in topic or payload'
            WHERE id = NEW.id;
            RETURN NEW;
        END IF;
        
        -- Infer device type from topic
        v_device_type := infer_device_type_from_topic(NEW.topic);
        
        -- Extract model from payload if available
        v_model := COALESCE(
            NEW.payload->>'Model',
            NEW.payload->>'model',
            NEW.payload->>'type',
            CASE v_device_type
                WHEN 'air_quality' THEN 'IAQ Sensor'
                WHEN 'energy_monitor' THEN 'Energy Monitor'
                WHEN 'water_meter' THEN 'Water Meter'
                ELSE 'Unknown'
            END
        );
        
        -- Extract broker
        v_broker := COALESCE(
            NEW.broker,
            NEW.payload->>'Broker',
            'mqtt://unknown'
        );
        
        -- Create orphan device (site_id = NULL)
        INSERT INTO devices (
            device_id,
            name,
            model,
            device_type,
            site_id,
            topic,
            broker,
            status,
            last_seen,
            metadata
        ) VALUES (
            NEW.device_external_id,
            'Auto: ' || NEW.device_external_id,
            v_model,
            v_device_type,
            NULL,  -- Orphan: will be assigned via admin UI
            NEW.topic,
            v_broker,
            'online'::device_status,
            NEW.received_at,
            jsonb_build_object(
                'auto_created', true,
                'created_at', NEW.received_at,
                'source', 'mqtt_trigger'
            )
        )
        ON CONFLICT (device_id, broker) DO UPDATE SET
            last_seen = EXCLUDED.last_seen,
            status = 'online'::device_status
        RETURNING id, site_id INTO v_device_uuid, v_site_uuid;
        
        -- If still null after insert, something's wrong
        IF v_device_uuid IS NULL THEN
            UPDATE mqtt_messages_raw 
            SET processed = TRUE, 
                error_message = 'Failed to create device: ' || NEW.device_external_id
            WHERE id = NEW.id;
            RETURN NEW;
        END IF;
        
        -- Log successful device creation (optional: check via query)
        RAISE NOTICE 'Auto-created device: % (type: %, uuid: %)', 
            NEW.device_external_id, v_device_type, v_device_uuid;
    ELSE
        -- Device exists, update last_seen
        UPDATE devices 
        SET last_seen = NEW.received_at, status = 'online'::device_status
        WHERE id = v_device_uuid;
    END IF;

    -- ==========================================================================
    -- B. TIMESTAMP EXTRACTION (using robust function from migration 035)
    -- ==========================================================================
    
    v_ts := extract_mqtt_timestamp(NEW.payload, NEW.received_at);
    
    -- 15-minute bucket for idempotent history writes
    v_bucket_ts := date_bin(INTERVAL '15 minutes', v_ts, '2020-01-01'::timestamptz);

    -- ==========================================================================
    -- C. PARSE, MAP & WRITE METRICS
    -- ==========================================================================
    
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- Skip metadata fields that are not measurements
        CONTINUE WHEN lower(v_json_key) IN (
            'mac', 'model', 'msgid', 'deviceid', 'timestamp', 'token', 
            'broker', 'topic', 'id', 'device_id', 'ts', 'time', 'datetime',
            'created_at', 'updated_at', 'type', 'sensor_sn', 'rssi_dbm',
            'address', 'name', 'serial', 'firmware', 'version', 'status'
        );

        -- METRIC NAME MAPPING (canonical names from metrics_catalog.md)
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
            WHEN 'NOISE'    THEN v_mapped_metric := 'env.noise'; v_unit := 'dB';
            WHEN 'LUX'      THEN v_mapped_metric := 'env.illuminance'; v_unit := 'lx';
            WHEN 'RADON'    THEN v_mapped_metric := 'env.radon'; v_unit := 'Bq/m³';
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
            WHEN 'ACTIVE_POWER' THEN v_mapped_metric := 'energy.power_w'; v_unit := 'W';
            -- Energy counters
            WHEN 'ENERGY_KWH' THEN v_mapped_metric := 'energy.active_import_kwh'; v_unit := 'kWh';
            WHEN 'TOTAL_ACTIVE_ENERGY_IMPORT' THEN v_mapped_metric := 'energy.active_import_kwh'; v_unit := 'kWh';
            WHEN 'TOTAL_ACTIVE_ENERGY_EXPORT' THEN v_mapped_metric := 'energy.active_export_kwh'; v_unit := 'kWh';
            -- Water
            WHEN 'FLOW_RATE' THEN v_mapped_metric := 'water.flow_rate'; v_unit := 'L/min';
            WHEN 'TOTAL_VOLUME' THEN v_mapped_metric := 'water.consumption'; v_unit := 'm³';
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
            ELSIF jsonb_typeof(v_raw_val) = 'string' AND (v_raw_val#>>'{}') ~ '^-?[0-9]+\.?[0-9]*$' THEN
                v_json_value := (v_raw_val#>>'{}')::NUMERIC;
            ELSE
                -- Not a numeric value, skip
                CONTINUE;
            END IF;
            
            -- VALIDATION: Skip placeholder values (e.g., -55555)
            IF v_json_value < -50000 OR v_json_value > 1e12 THEN
                CONTINUE;
            END IF;
            
            -- ==========================================================================
            -- D. WRITE TO DATABASE
            -- ==========================================================================
            
            -- LIVE: Always update latest value
            INSERT INTO telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric) 
            DO UPDATE SET 
                value = EXCLUDED.value, 
                ts = EXCLUDED.ts,
                site_id = EXCLUDED.site_id,
                quality = EXCLUDED.quality;
            
            -- HISTORY: 1 point per 15-min bucket per metric (idempotent)
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

    -- ==========================================================================
    -- E. MARK AS PROCESSED
    -- ==========================================================================
    
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
-- 3. REPROCESS UNPROCESSED MESSAGES (optional - run manually if needed)
-- =============================================================================

-- This function can be called to reprocess messages that failed before this fix
CREATE OR REPLACE FUNCTION reprocess_failed_mqtt_messages(p_limit INT DEFAULT 1000)
RETURNS TABLE(processed_count INT, error_count INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_row RECORD;
    v_processed INT := 0;
    v_errors INT := 0;
BEGIN
    FOR v_row IN 
        SELECT id, device_external_id, topic, payload, received_at, broker
        FROM mqtt_messages_raw
        WHERE processed = FALSE 
           OR error_message LIKE '%Device not found%'
        ORDER BY received_at DESC
        LIMIT p_limit
    LOOP
        BEGIN
            -- Reset for reprocessing
            UPDATE mqtt_messages_raw
            SET processed = FALSE, error_message = NULL
            WHERE id = v_row.id;
            
            -- The trigger will fire automatically on the original insert,
            -- but we need to manually invoke the logic for existing rows
            PERFORM process_mqtt_message_trigger();
            
            v_processed := v_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            v_errors := v_errors + 1;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_processed, v_errors;
END;
$$;

-- =============================================================================
-- 4. BACKFILL: Process existing unprocessed messages
-- =============================================================================

-- Run this once after applying migration to catch up
DO $$
DECLARE
    v_row RECORD;
    v_device_uuid UUID;
    v_site_uuid UUID;
    v_device_type device_type;
    v_processed INT := 0;
BEGIN
    -- For each message with 'Device not found' error, create the device and reprocess
    FOR v_row IN 
        SELECT device_external_id, topic, broker, 
               MAX(received_at) as last_seen,
               (array_agg(payload ORDER BY received_at DESC))[1] as sample_payload
        FROM mqtt_messages_raw
        WHERE (error_message LIKE '%Device not found%' OR processed = FALSE)
          AND device_external_id IS NOT NULL
          AND TRIM(device_external_id) <> ''
        GROUP BY device_external_id, topic, broker
        LIMIT 500
    LOOP
        -- Infer device type
        v_device_type := infer_device_type_from_topic(v_row.topic);
        
        -- Insert device if not exists
        INSERT INTO devices (
            device_id, name, model, device_type, site_id, 
            topic, broker, status, last_seen, metadata
        ) VALUES (
            v_row.device_external_id,
            'Auto: ' || v_row.device_external_id,
            COALESCE(v_row.sample_payload->>'Model', v_row.sample_payload->>'model', 'Unknown'),
            v_device_type,
            NULL,
            v_row.topic,
            COALESCE(v_row.broker, 'mqtt://unknown'),
            'offline'::device_status,
            v_row.last_seen,
            '{"auto_created": true, "source": "migration_038_backfill"}'::jsonb
        )
        ON CONFLICT (device_id, broker) DO UPDATE SET
            last_seen = GREATEST(devices.last_seen, EXCLUDED.last_seen)
        RETURNING id, site_id INTO v_device_uuid, v_site_uuid;
        
        v_processed := v_processed + 1;
    END LOOP;
    
    RAISE NOTICE 'Backfill created/updated % devices', v_processed;
END $$;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================
-- After applying this migration:
-- 1. New MQTT messages will auto-create devices if they don't exist
-- 2. Orphan devices (site_id = NULL) will be visible in devices_orphan view
-- 3. Admins can assign devices to sites via the UI
-- 4. Run this query to check success:
--    SELECT COUNT(*) FROM mqtt_messages_raw WHERE processed = FALSE AND received_at > NOW() - INTERVAL '1 hour';
--    (Should be 0 or very low after trigger is active)
