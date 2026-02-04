-- =============================================================================
-- Reprocess Function: Apply trigger logic to existing unprocessed messages
-- =============================================================================

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
            
            -- Normalize device ID
            v_normalized_ext := normalize_device_id(v_row.device_external_id);
            IF v_normalized_ext IS NULL THEN
                v_normalized_ext := normalize_device_id(
                    COALESCE(
                        v_row.payload->>'sensor_sn',
                        v_row.payload->>'deviceId',
                        v_row.payload->>'device_id',
                        v_row.payload->>'MAC',
                        v_row.payload->>'mac'
                    )
                );
            END IF;
            
            IF v_normalized_ext IS NULL THEN
                UPDATE mqtt_messages_raw 
                SET processed = TRUE, error_message = 'No device identifier'
                WHERE id = v_row.id;
                v_errors := v_errors + 1;
                CONTINUE;
            END IF;
            
            -- Get or create device
            v_device_type := infer_device_type_from_topic(v_row.topic);
            v_default_name := 'Auto: ' || v_normalized_ext;
            v_default_model := COALESCE(
                v_row.payload->>'Model', v_row.payload->>'model', v_row.payload->>'type',
                CASE v_device_type
                    WHEN 'air_quality' THEN 'IAQ Sensor'
                    WHEN 'energy_monitor' THEN 'Energy Monitor'
                    ELSE 'Unknown'
                END
            );
            
            INSERT INTO devices (device_id, broker, device_type, topic, site_id, name, model, status, last_seen, metadata)
            VALUES (v_normalized_ext, COALESCE(v_row.broker, 'mqtt://unknown'), v_device_type, v_row.topic, NULL, v_default_name, v_default_model, 'online', v_row.received_at, '{"auto_created": true}')
            ON CONFLICT (device_id, broker) DO UPDATE SET
                last_seen = GREATEST(devices.last_seen, EXCLUDED.last_seen),
                site_id = COALESCE(devices.site_id, EXCLUDED.site_id),
                name = COALESCE(NULLIF(devices.name, ''), EXCLUDED.name),
                status = 'online'
            RETURNING id, site_id INTO v_device_uuid, v_site_uuid;
            
            -- Extract timestamp
            v_ts := extract_mqtt_timestamp(v_row.payload, v_row.received_at);
            
            -- Process each metric
            FOR v_json_key IN SELECT * FROM jsonb_object_keys(v_row.payload)
            LOOP
                CONTINUE WHEN lower(v_json_key) IN (
                    'mac', 'model', 'msgid', 'deviceid', 'timestamp', 'token', 
                    'broker', 'topic', 'id', 'device_id', 'ts', 'time', 'datetime',
                    'created_at', 'updated_at', 'type', 'sensor_sn', 'rssi_dbm',
                    'address', 'name', 'serial', 'firmware', 'version', 'status'
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
                
                -- Map metric
                CASE upper(v_json_key)
                    WHEN 'TEMP' THEN v_mapped_metric := 'env.temperature'; v_unit := '°C';
                    WHEN 'HUM', 'HUMIDITY' THEN v_mapped_metric := 'env.humidity'; v_unit := '%';
                    WHEN 'CO2' THEN v_mapped_metric := 'iaq.co2'; v_unit := 'ppm';
                    WHEN 'VOC', 'TVOC' THEN v_mapped_metric := 'iaq.voc'; v_unit := 'µg/m³';
                    WHEN 'PM2.5', 'PM25' THEN v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
                    WHEN 'PM10' THEN v_mapped_metric := 'iaq.pm10'; v_unit := 'µg/m³';
                    WHEN 'CURRENT_A' THEN v_mapped_metric := 'energy.current_a'; v_unit := 'A';
                    WHEN 'I1' THEN v_mapped_metric := 'energy.current_l1'; v_unit := 'A';
                    WHEN 'I2' THEN v_mapped_metric := 'energy.current_l2'; v_unit := 'A';
                    WHEN 'I3' THEN v_mapped_metric := 'energy.current_l3'; v_unit := 'A';
                    WHEN 'V1' THEN v_mapped_metric := 'energy.voltage_l1'; v_unit := 'V';
                    WHEN 'V2' THEN v_mapped_metric := 'energy.voltage_l2'; v_unit := 'V';
                    WHEN 'V3' THEN v_mapped_metric := 'energy.voltage_l3'; v_unit := 'V';
                    ELSE v_mapped_metric := lower(v_json_key); v_unit := NULL;
                END CASE;
                
                -- Insert telemetry
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
            
            UPDATE mqtt_messages_raw
            SET processed = TRUE, error_message = NULL
            WHERE id = v_row.id;
            
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