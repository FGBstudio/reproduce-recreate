-- Fix: Handle case variations in metric keys (current_A vs CURRENT_A)
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
    v_upper_key TEXT;
BEGIN
    -- ==========================================================================
    -- A. NORMALIZE DEVICE EXTERNAL ID
    -- ==========================================================================
    v_normalized_ext := normalize_device_id(NEW.device_external_id);
    
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
    
    IF v_normalized_ext IS NULL THEN
        UPDATE mqtt_messages_raw 
        SET processed = TRUE, 
            error_message = 'No device identifier found'
        WHERE id = NEW.id;
        RETURN NEW;
    END IF;
    
    -- ==========================================================================
    -- B. GET OR CREATE DEVICE (NEVER BLOCK)
    -- ==========================================================================
    v_device_type := infer_device_type_from_topic(NEW.topic);
    v_default_name := 'Auto: ' || v_normalized_ext;
    v_default_model := COALESCE(
        NEW.payload->>'Model', NEW.payload->>'model',
        CASE v_device_type
            WHEN 'air_quality' THEN 'IAQ Sensor'
            WHEN 'energy_monitor' THEN 'Energy Monitor'
            WHEN 'water_meter' THEN 'Water Meter'
            ELSE 'Unknown'
        END
    );
    
    INSERT INTO devices (device_id, broker, device_type, topic, site_id, name, model, status, last_seen, metadata)
    VALUES (v_normalized_ext, COALESCE(NEW.broker, 'mqtt://unknown'), v_device_type, NEW.topic, NULL, v_default_name, v_default_model, 'online'::device_status, NEW.received_at, '{"auto_created": true, "source": "mqtt_trigger"}'::jsonb)
    ON CONFLICT (device_id, broker) DO UPDATE SET
        last_seen = GREATEST(devices.last_seen, EXCLUDED.last_seen),
        topic = COALESCE(NULLIF(devices.topic, ''), EXCLUDED.topic),
        site_id = COALESCE(devices.site_id, EXCLUDED.site_id),
        name = COALESCE(NULLIF(devices.name, ''), EXCLUDED.name),
        model = COALESCE(NULLIF(devices.model, ''), EXCLUDED.model),
        status = 'online'::device_status
    RETURNING id, site_id INTO v_device_uuid, v_site_uuid;
    
    -- ==========================================================================
    -- C. EXTRACT TIMESTAMP
    -- ==========================================================================
    v_ts := extract_mqtt_timestamp(NEW.payload, NEW.received_at);
    
    -- ==========================================================================
    -- D. PARSE PAYLOAD AND WRITE METRICS
    -- ==========================================================================
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- Use UPPER for case-insensitive matching
        v_upper_key := upper(v_json_key);
        
        -- Skip metadata fields
        CONTINUE WHEN v_upper_key IN (
            'MAC', 'MODEL', 'MSGID', 'DEVICEID', 'TIMESTAMP', 'TOKEN', 
            'BROKER', 'TOPIC', 'ID', 'DEVICE_ID', 'TS', 'TIME', 'DATETIME',
            'CREATED_AT', 'UPDATED_AT', 'TYPE', 'SENSOR_SN', 'RSSI_DBM',
            'ADDRESS', 'NAME', 'SERIAL', 'FIRMWARE', 'VERSION', 'STATUS'
        );
        
        v_raw_val := NEW.payload->v_json_key;
        
        -- Skip non-numeric types
        IF jsonb_typeof(v_raw_val) NOT IN ('number', 'string', 'object') THEN
            CONTINUE;
        END IF;
        
        -- Extract numeric value
        BEGIN
            IF jsonb_typeof(v_raw_val) = 'object' AND v_raw_val ? 'value' THEN
                v_json_value := (v_raw_val->>'value')::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'number' THEN
                v_json_value := v_raw_val::TEXT::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'string' THEN
                IF (v_raw_val#>>'{}') ~ '^-?[0-9]+\.?[0-9]*$' THEN
                    v_json_value := (v_raw_val#>>'{}')::NUMERIC;
                ELSE
                    CONTINUE;
                END IF;
            ELSE
                CONTINUE;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
        
        -- Skip invalid values
        IF v_json_value IS NULL OR v_json_value < -50000 OR v_json_value > 1e12 THEN
            CONTINUE;
        END IF;
        
        -- Map metric name (case-insensitive via v_upper_key)
        CASE v_upper_key
            -- Air Quality
            WHEN 'TEMP' THEN v_mapped_metric := 'env.temperature'; v_unit := '°C';
            WHEN 'HUM' THEN v_mapped_metric := 'env.humidity'; v_unit := '%';
            WHEN 'HUMIDITY' THEN v_mapped_metric := 'env.humidity'; v_unit := '%';
            WHEN 'CO2' THEN v_mapped_metric := 'iaq.co2'; v_unit := 'ppm';
            WHEN 'VOC' THEN v_mapped_metric := 'iaq.voc'; v_unit := 'µg/m³';
            WHEN 'TVOC' THEN v_mapped_metric := 'iaq.voc'; v_unit := 'µg/m³';
            WHEN 'PM2.5' THEN v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
            WHEN 'PM25' THEN v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
            WHEN 'PM10' THEN v_mapped_metric := 'iaq.pm10'; v_unit := 'µg/m³';
            WHEN 'CO' THEN v_mapped_metric := 'iaq.co'; v_unit := 'ppm';
            WHEN 'O3' THEN v_mapped_metric := 'iaq.o3'; v_unit := 'ppb';
            WHEN 'NOISE' THEN v_mapped_metric := 'env.noise'; v_unit := 'dB';
            WHEN 'LUX' THEN v_mapped_metric := 'env.illuminance'; v_unit := 'lx';
            -- Energy Single Phase (FIX: current_A → CURRENT_A)
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
            WHEN 'POWER_W' THEN v_mapped_metric := 'energy.power_w'; v_unit := 'W';
            WHEN 'POWER_KW' THEN v_mapped_metric := 'energy.power_kw'; v_unit := 'kW';
            WHEN 'ACTIVE_POWER' THEN v_mapped_metric := 'energy.power_w'; v_unit := 'W';
            WHEN 'ENERGY_KWH' THEN v_mapped_metric := 'energy.active_import_kwh'; v_unit := 'kWh';
            WHEN 'TOTAL_ACTIVE_ENERGY_IMPORT' THEN v_mapped_metric := 'energy.active_import_kwh'; v_unit := 'kWh';
            -- Water
            WHEN 'FLOW_RATE' THEN v_mapped_metric := 'water.flow_rate'; v_unit := 'L/min';
            WHEN 'TOTAL_VOLUME' THEN v_mapped_metric := 'water.consumption'; v_unit := 'm³';
            -- Default: use lowercase key
            ELSE v_mapped_metric := lower(v_json_key); v_unit := NULL;
        END CASE;
        
        -- ==========================================================================
        -- E. INSERT INTO TELEMETRY
        -- ==========================================================================
        BEGIN
            INSERT INTO telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric) DO UPDATE SET 
                value = EXCLUDED.value,
                ts = EXCLUDED.ts,
                site_id = COALESCE(EXCLUDED.site_id, telemetry_latest.site_id),
                quality = EXCLUDED.quality;
            
            INSERT INTO telemetry (device_id, site_id, ts, metric, value, unit, quality, raw_payload)
            VALUES (v_device_uuid, v_site_uuid, v_ts, v_mapped_metric, v_json_value, v_unit, 'good', NEW.payload)
            ON CONFLICT (device_id, metric, ts) DO UPDATE SET
                value = EXCLUDED.value,
                unit = COALESCE(EXCLUDED.unit, telemetry.unit),
                quality = EXCLUDED.quality;
            
            v_metrics_written := v_metrics_written + 1;
        EXCEPTION WHEN OTHERS THEN
            NULL; -- Continue with other metrics
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

-- Also update the reprocess function with same fix
CREATE OR REPLACE FUNCTION reprocess_unprocessed_mqtt_messages(p_limit INT DEFAULT 5000)
RETURNS TABLE(processed_count INT, error_count INT, telemetry_created INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row RECORD;
    v_processed INT := 0;
    v_errors INT := 0;
    v_telemetry INT := 0;
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
    v_metrics_written INT;
    v_default_name TEXT;
    v_default_model TEXT;
    v_upper_key TEXT;
BEGIN
    FOR v_row IN 
        SELECT id, device_external_id, topic, broker, payload, received_at
        FROM mqtt_messages_raw
        WHERE processed = FALSE OR error_message IS NOT NULL
        ORDER BY received_at DESC
        LIMIT p_limit
    LOOP
        BEGIN
            v_metrics_written := 0;
            
            v_normalized_ext := normalize_device_id(v_row.device_external_id);
            IF v_normalized_ext IS NULL THEN
                v_normalized_ext := normalize_device_id(
                    COALESCE(v_row.payload->>'sensor_sn', v_row.payload->>'deviceId', v_row.payload->>'MAC')
                );
            END IF;
            
            IF v_normalized_ext IS NULL THEN
                UPDATE mqtt_messages_raw SET processed = TRUE, error_message = 'No device identifier' WHERE id = v_row.id;
                v_errors := v_errors + 1;
                CONTINUE;
            END IF;
            
            v_device_type := infer_device_type_from_topic(v_row.topic);
            v_default_name := 'Auto: ' || v_normalized_ext;
            v_default_model := COALESCE(v_row.payload->>'Model', v_row.payload->>'model', 
                CASE v_device_type WHEN 'air_quality' THEN 'IAQ Sensor' WHEN 'energy_monitor' THEN 'Energy Monitor' ELSE 'Unknown' END);
            
            INSERT INTO devices (device_id, broker, device_type, topic, site_id, name, model, status, last_seen, metadata)
            VALUES (v_normalized_ext, COALESCE(v_row.broker, 'mqtt://unknown'), v_device_type, v_row.topic, NULL, v_default_name, v_default_model, 'online', v_row.received_at, '{"auto_created": true}')
            ON CONFLICT (device_id, broker) DO UPDATE SET
                last_seen = GREATEST(devices.last_seen, EXCLUDED.last_seen),
                site_id = COALESCE(devices.site_id, EXCLUDED.site_id),
                name = COALESCE(NULLIF(devices.name, ''), EXCLUDED.name),
                status = 'online'
            RETURNING id, site_id INTO v_device_uuid, v_site_uuid;
            
            v_ts := extract_mqtt_timestamp(v_row.payload, v_row.received_at);
            
            FOR v_json_key IN SELECT * FROM jsonb_object_keys(v_row.payload)
            LOOP
                v_upper_key := upper(v_json_key);
                
                CONTINUE WHEN v_upper_key IN (
                    'MAC', 'MODEL', 'MSGID', 'DEVICEID', 'TIMESTAMP', 'TOKEN', 
                    'BROKER', 'TOPIC', 'ID', 'DEVICE_ID', 'TS', 'TIME', 'DATETIME',
                    'CREATED_AT', 'UPDATED_AT', 'TYPE', 'SENSOR_SN', 'RSSI_DBM',
                    'ADDRESS', 'NAME', 'SERIAL', 'FIRMWARE', 'VERSION', 'STATUS'
                );
                
                v_raw_val := v_row.payload->v_json_key;
                
                BEGIN
                    IF jsonb_typeof(v_raw_val) = 'number' THEN
                        v_json_value := v_raw_val::TEXT::NUMERIC;
                    ELSIF jsonb_typeof(v_raw_val) = 'string' AND (v_raw_val#>>'{}') ~ '^-?[0-9]+\.?[0-9]*$' THEN
                        v_json_value := (v_raw_val#>>'{}')::NUMERIC;
                    ELSE
                        CONTINUE;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    CONTINUE;
                END;
                
                IF v_json_value IS NULL OR v_json_value < -50000 OR v_json_value > 1e12 THEN
                    CONTINUE;
                END IF;
                
                -- Case-insensitive metric mapping
                CASE v_upper_key
                    WHEN 'TEMP' THEN v_mapped_metric := 'env.temperature'; v_unit := '°C';
                    WHEN 'HUM', 'HUMIDITY' THEN v_mapped_metric := 'env.humidity'; v_unit := '%';
                    WHEN 'CO2' THEN v_mapped_metric := 'iaq.co2'; v_unit := 'ppm';
                    WHEN 'VOC', 'TVOC' THEN v_mapped_metric := 'iaq.voc'; v_unit := 'µg/m³';
                    WHEN 'PM25', 'PM2.5' THEN v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
                    WHEN 'PM10' THEN v_mapped_metric := 'iaq.pm10'; v_unit := 'µg/m³';
                    WHEN 'CURRENT_A' THEN v_mapped_metric := 'energy.current_a'; v_unit := 'A';
                    WHEN 'I1' THEN v_mapped_metric := 'energy.current_l1'; v_unit := 'A';
                    WHEN 'I2' THEN v_mapped_metric := 'energy.current_l2'; v_unit := 'A';
                    WHEN 'I3' THEN v_mapped_metric := 'energy.current_l3'; v_unit := 'A';
                    WHEN 'V1' THEN v_mapped_metric := 'energy.voltage_l1'; v_unit := 'V';
                    WHEN 'V2' THEN v_mapped_metric := 'energy.voltage_l2'; v_unit := 'V';
                    WHEN 'V3' THEN v_mapped_metric := 'energy.voltage_l3'; v_unit := 'V';
                    WHEN 'POWER_W', 'ACTIVE_POWER' THEN v_mapped_metric := 'energy.power_w'; v_unit := 'W';
                    WHEN 'ENERGY_KWH' THEN v_mapped_metric := 'energy.active_import_kwh'; v_unit := 'kWh';
                    ELSE v_mapped_metric := lower(v_json_key); v_unit := NULL;
                END CASE;
                
                INSERT INTO telemetry_latest (device_id, site_id, metric, value, ts, quality)
                VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
                ON CONFLICT (device_id, metric) DO UPDATE SET 
                    value = EXCLUDED.value, ts = EXCLUDED.ts, 
                    site_id = COALESCE(EXCLUDED.site_id, telemetry_latest.site_id);
                
                INSERT INTO telemetry (device_id, site_id, ts, metric, value, unit, quality, raw_payload)
                VALUES (v_device_uuid, v_site_uuid, v_ts, v_mapped_metric, v_json_value, v_unit, 'good', v_row.payload)
                ON CONFLICT (device_id, metric, ts) DO UPDATE SET value = EXCLUDED.value;
                
                v_metrics_written := v_metrics_written + 1;
            END LOOP;
            
            UPDATE mqtt_messages_raw SET processed = TRUE, error_message = NULL WHERE id = v_row.id;
            v_processed := v_processed + 1;
            v_telemetry := v_telemetry + v_metrics_written;
            
        EXCEPTION WHEN OTHERS THEN
            UPDATE mqtt_messages_raw SET error_message = SQLERRM WHERE id = v_row.id;
            v_errors := v_errors + 1;
        END;
    END LOOP;
    
    RETURN QUERY SELECT v_processed, v_errors, v_telemetry;
END;
$$;