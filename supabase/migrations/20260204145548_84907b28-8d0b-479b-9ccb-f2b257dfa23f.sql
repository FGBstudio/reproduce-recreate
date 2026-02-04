-- =============================================================================
-- FIX: Robust MQTT → Telemetry Pipeline
-- =============================================================================
-- PROBLEMA: Il trigger fallisce su campi non numerici come "type": "PAN12"
-- SOLUZIONE: Normalizzazione device_id + skip fields non numerici + auto-create device
-- =============================================================================

-- Step 1: Add unique constraint on telemetry for idempotent inserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_device_metric_ts 
ON telemetry(device_id, metric, ts);

-- Step 2: Fix extract_mqtt_timestamp to be STABLE (not IMMUTABLE)
CREATE OR REPLACE FUNCTION extract_mqtt_timestamp(p_payload JSONB, p_fallback TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_raw_ts NUMERIC;
    v_ts TIMESTAMPTZ;
    v_year_3000_epoch NUMERIC := 32503680000; -- Epoch for year 3000
BEGIN
    -- Try common timestamp field names
    v_raw_ts := COALESCE(
        (p_payload->>'ts')::NUMERIC,
        (p_payload->>'timestamp')::NUMERIC,
        (p_payload->>'time')::NUMERIC,
        (p_payload->>'Timestamp')::NUMERIC,
        NULL
    );
    
    IF v_raw_ts IS NULL THEN
        RETURN p_fallback;
    END IF;
    
    -- Detect unit: seconds, milliseconds, microseconds, nanoseconds
    IF v_raw_ts > v_year_3000_epoch * 1000000 THEN
        -- Nanoseconds
        v_ts := to_timestamp(v_raw_ts / 1000000000.0);
    ELSIF v_raw_ts > v_year_3000_epoch * 1000 THEN
        -- Microseconds
        v_ts := to_timestamp(v_raw_ts / 1000000.0);
    ELSIF v_raw_ts > v_year_3000_epoch THEN
        -- Milliseconds
        v_ts := to_timestamp(v_raw_ts / 1000.0);
    ELSE
        -- Seconds
        v_ts := to_timestamp(v_raw_ts);
    END IF;
    
    -- Guardrail: if timestamp is too far from received_at (>24h), use fallback
    IF ABS(EXTRACT(EPOCH FROM (v_ts - p_fallback))) > 86400 THEN
        RETURN p_fallback;
    END IF;
    
    RETURN v_ts;
EXCEPTION WHEN OTHERS THEN
    RETURN p_fallback;
END;
$$;

-- Step 3: Normalize device_external_id function
CREATE OR REPLACE FUNCTION normalize_device_id(p_device_id TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NULLIF(
        regexp_replace(
            regexp_replace(
                trim(COALESCE(p_device_id, '')), 
                '[[:cntrl:]]', '', 'g'
            ),
            '[[:space:]]+', '', 'g'
        ),
        ''
    );
$$;

-- Step 4: REPLACE the trigger function with robust version
CREATE OR REPLACE FUNCTION process_mqtt_message_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_normalized_ext TEXT;
    v_device_uuid UUID;
    v_site_uuid UUID;
    v_device_type device_type;
    v_ts TIMESTAMPTZ;
    v_json_key TEXT;
    v_raw_val JSONB;
    v_json_value NUMERIC;
    v_mapped_metric TEXT;
    v_unit TEXT;
    v_metrics_written INT := 0;
    v_default_name TEXT;
    v_default_model TEXT;
BEGIN
    -- ==========================================================================
    -- A. NORMALIZE DEVICE EXTERNAL ID
    -- ==========================================================================
    v_normalized_ext := normalize_device_id(NEW.device_external_id);
    
    -- If no valid device ID, try to extract from payload
    IF v_normalized_ext IS NULL THEN
        v_normalized_ext := normalize_device_id(
            COALESCE(
                NEW.payload->>'sensor_sn',
                NEW.payload->>'deviceId',
                NEW.payload->>'device_id',
                NEW.payload->>'MAC',
                NEW.payload->>'mac'
            )
        );
    END IF;
    
    -- Still no device ID? Mark as error and exit
    IF v_normalized_ext IS NULL THEN
        UPDATE mqtt_messages_raw 
        SET processed = TRUE, 
            error_message = 'No device identifier found in topic or payload'
        WHERE id = NEW.id;
        RETURN NEW;
    END IF;
    
    -- ==========================================================================
    -- B. GET OR CREATE DEVICE (NEVER BLOCK)
    -- ==========================================================================
    
    -- Infer device type from topic
    v_device_type := infer_device_type_from_topic(NEW.topic);
    
    -- Default name and model
    v_default_name := 'Auto: ' || v_normalized_ext;
    v_default_model := COALESCE(
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
    
    -- Upsert device - NEVER overwrite existing site_id or name
    INSERT INTO devices (
        device_id,
        broker,
        device_type,
        topic,
        site_id,
        name,
        model,
        status,
        last_seen,
        metadata
    ) VALUES (
        v_normalized_ext,
        COALESCE(NEW.broker, 'mqtt://unknown'),
        v_device_type,
        NEW.topic,
        NULL,  -- site_id starts as NULL for new devices
        v_default_name,
        v_default_model,
        'online'::device_status,
        NEW.received_at,
        jsonb_build_object('auto_created', true, 'source', 'mqtt_trigger')
    )
    ON CONFLICT (device_id, broker) DO UPDATE SET
        last_seen = GREATEST(devices.last_seen, EXCLUDED.last_seen),
        topic = COALESCE(NULLIF(devices.topic, ''), EXCLUDED.topic),
        -- NEVER overwrite existing values with NULL:
        site_id = COALESCE(devices.site_id, EXCLUDED.site_id),
        name = COALESCE(NULLIF(devices.name, ''), EXCLUDED.name),
        model = COALESCE(NULLIF(devices.model, ''), EXCLUDED.model),
        status = 'online'::device_status
    RETURNING id, site_id INTO v_device_uuid, v_site_uuid;
    
    -- ==========================================================================
    -- C. EXTRACT TIMESTAMP (robust with fallback)
    -- ==========================================================================
    v_ts := extract_mqtt_timestamp(NEW.payload, NEW.received_at);
    
    -- ==========================================================================
    -- D. PARSE PAYLOAD AND WRITE METRICS TO TELEMETRY
    -- ==========================================================================
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- Skip metadata fields (non-measurement fields)
        CONTINUE WHEN lower(v_json_key) IN (
            'mac', 'model', 'msgid', 'deviceid', 'timestamp', 'token', 
            'broker', 'topic', 'id', 'device_id', 'ts', 'time', 'datetime',
            'created_at', 'updated_at', 'type', 'sensor_sn', 'rssi_dbm',
            'address', 'name', 'serial', 'firmware', 'version', 'status'
        );
        
        -- Get raw value
        v_raw_val := NEW.payload->v_json_key;
        
        -- CRITICAL: Skip non-numeric values early (this was the bug!)
        IF jsonb_typeof(v_raw_val) NOT IN ('number', 'string', 'object') THEN
            CONTINUE;
        END IF;
        
        -- Try to extract numeric value
        BEGIN
            IF jsonb_typeof(v_raw_val) = 'object' AND v_raw_val ? 'value' THEN
                v_json_value := (v_raw_val->>'value')::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'number' THEN
                v_json_value := v_raw_val::TEXT::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'string' THEN
                -- Only try to parse if it looks like a number
                IF (v_raw_val#>>'{}') ~ '^-?[0-9]+\.?[0-9]*$' THEN
                    v_json_value := (v_raw_val#>>'{}')::NUMERIC;
                ELSE
                    CONTINUE; -- Skip non-numeric strings like "PAN12"
                END IF;
            ELSE
                CONTINUE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE; -- Skip on any conversion error
        END;
        
        -- Skip invalid/placeholder values
        IF v_json_value IS NULL OR v_json_value < -50000 OR v_json_value > 1e12 THEN
            CONTINUE;
        END IF;
        
        -- Map metric name and unit
        CASE upper(v_json_key)
            -- Air Quality
            WHEN 'TEMP' THEN v_mapped_metric := 'env.temperature'; v_unit := '°C';
            WHEN 'HUM', 'HUMIDITY' THEN v_mapped_metric := 'env.humidity'; v_unit := '%';
            WHEN 'CO2' THEN v_mapped_metric := 'iaq.co2'; v_unit := 'ppm';
            WHEN 'VOC', 'TVOC' THEN v_mapped_metric := 'iaq.voc'; v_unit := 'µg/m³';
            WHEN 'PM2.5', 'PM25' THEN v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
            WHEN 'PM10' THEN v_mapped_metric := 'iaq.pm10'; v_unit := 'µg/m³';
            -- Energy
            WHEN 'CURRENT_A' THEN v_mapped_metric := 'energy.current_a'; v_unit := 'A';
            WHEN 'I1' THEN v_mapped_metric := 'energy.current_l1'; v_unit := 'A';
            WHEN 'I2' THEN v_mapped_metric := 'energy.current_l2'; v_unit := 'A';
            WHEN 'I3' THEN v_mapped_metric := 'energy.current_l3'; v_unit := 'A';
            WHEN 'V1' THEN v_mapped_metric := 'energy.voltage_l1'; v_unit := 'V';
            WHEN 'V2' THEN v_mapped_metric := 'energy.voltage_l2'; v_unit := 'V';
            WHEN 'V3' THEN v_mapped_metric := 'energy.voltage_l3'; v_unit := 'V';
            WHEN 'POWER_W', 'ACTIVE_POWER' THEN v_mapped_metric := 'energy.power_w'; v_unit := 'W';
            WHEN 'ENERGY_KWH' THEN v_mapped_metric := 'energy.active_import_kwh'; v_unit := 'kWh';
            -- Default
            ELSE v_mapped_metric := lower(v_json_key); v_unit := NULL;
        END CASE;
        
        -- ==========================================================================
        -- E. INSERT INTO TELEMETRY (idempotent with ON CONFLICT)
        -- ==========================================================================
        BEGIN
            -- Update telemetry_latest (always latest value)
            INSERT INTO telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric) DO UPDATE SET 
                value = EXCLUDED.value,
                ts = EXCLUDED.ts,
                site_id = COALESCE(EXCLUDED.site_id, telemetry_latest.site_id),
                quality = EXCLUDED.quality;
            
            -- Insert into telemetry history (idempotent)
            INSERT INTO telemetry (device_id, site_id, ts, metric, value, unit, quality, raw_payload)
            VALUES (v_device_uuid, v_site_uuid, v_ts, v_mapped_metric, v_json_value, v_unit, 'good', NEW.payload)
            ON CONFLICT (device_id, metric, ts) DO UPDATE SET
                value = EXCLUDED.value,
                unit = COALESCE(EXCLUDED.unit, telemetry.unit),
                quality = EXCLUDED.quality;
            
            v_metrics_written := v_metrics_written + 1;
        EXCEPTION WHEN OTHERS THEN
            -- Log but continue with other metrics
            NULL;
        END;
    END LOOP;
    
    -- ==========================================================================
    -- F. MARK AS PROCESSED
    -- ==========================================================================
    UPDATE mqtt_messages_raw
    SET processed = TRUE,
        error_message = CASE 
            WHEN v_metrics_written > 0 THEN NULL 
            ELSE 'No valid metrics found in payload'
        END
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Step 5: Ensure only ONE trigger exists (drop duplicates)
DROP TRIGGER IF EXISTS tr_process_mqtt_message_raw ON mqtt_messages_raw;
DROP TRIGGER IF EXISTS trg_process_mqtt_message ON mqtt_messages_raw;

-- Recreate single trigger
CREATE TRIGGER trg_process_mqtt_message
    AFTER INSERT ON mqtt_messages_raw
    FOR EACH ROW
    EXECUTE FUNCTION process_mqtt_message_trigger();

-- =============================================================================
-- VERIFICATION COMMENT
-- =============================================================================
-- After this migration, run these queries to verify:
-- 
-- 1. Check unprocessed count (should decrease):
--    SELECT COUNT(*) FROM mqtt_messages_raw WHERE processed = FALSE;
--
-- 2. Check telemetry is being populated:
--    SELECT COUNT(*) FROM telemetry WHERE ts > NOW() - INTERVAL '1 hour';
--
-- 3. Verify all devices from raw exist in devices table:
--    SELECT COUNT(*) FROM mqtt_messages_raw r
--    LEFT JOIN devices d ON d.device_id = normalize_device_id(r.device_external_id) 
--                       AND d.broker = r.broker
--    WHERE r.device_external_id IS NOT NULL AND d.id IS NULL;
-- =============================================================================