
-- Fix metric mapping to handle both lowercase and uppercase keys
-- The WEEL payload uses lowercase keys: temp, hum, CO2, PM2.5, etc.

CREATE OR REPLACE FUNCTION process_mqtt_message_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_device_uuid UUID;
    v_site_uuid UUID;
    v_json_key TEXT;
    v_upper_key TEXT;
    v_mapped_metric TEXT;
    v_json_value NUMERIC;
    v_ts TIMESTAMPTZ;
    v_bucket_ts TIMESTAMPTZ;
    v_raw_val JSONB;
    v_unit TEXT;
    v_metrics_count INT := 0;
    v_err_msg TEXT := '';
BEGIN
    -- ==========================================================================
    -- A. DEVICE LOOKUP OR AUTO-CREATE
    -- ==========================================================================
    
    SELECT id, site_id INTO v_device_uuid, v_site_uuid
    FROM devices
    WHERE 
        (NEW.device_external_id IS NOT NULL AND device_id = NEW.device_external_id)
        OR topic = NEW.topic
    LIMIT 1;

    IF v_device_uuid IS NULL THEN
        IF NEW.device_external_id IS NULL OR TRIM(NEW.device_external_id) = '' THEN
            UPDATE mqtt_messages_raw 
            SET processed = TRUE, 
                error_message = 'Cannot create device: no external ID'
            WHERE id = NEW.id;
            RETURN NEW;
        END IF;
        
        INSERT INTO devices (
            device_id, name, model, device_type, site_id, 
            topic, broker, status, last_seen, metadata
        ) VALUES (
            NEW.device_external_id,
            'Auto: ' || NEW.device_external_id,
            COALESCE(NEW.payload->>'model', NEW.payload->>'Model', NEW.payload->>'type', 'Unknown'),
            infer_device_type_from_topic(NEW.topic),
            NULL,
            NEW.topic,
            COALESCE(NEW.broker, 'mqtt://unknown'),
            'online'::device_status,
            NEW.received_at,
            jsonb_build_object('auto_created', true, 'source', 'mqtt_trigger')
        )
        ON CONFLICT (device_id, broker) DO UPDATE SET
            last_seen = EXCLUDED.last_seen,
            status = 'online'::device_status
        RETURNING id, site_id INTO v_device_uuid, v_site_uuid;
        
        IF v_device_uuid IS NULL THEN
            UPDATE mqtt_messages_raw 
            SET processed = TRUE, error_message = 'Failed to create device'
            WHERE id = NEW.id;
            RETURN NEW;
        END IF;
    ELSE
        UPDATE devices SET last_seen = NEW.received_at, status = 'online'::device_status
        WHERE id = v_device_uuid;
    END IF;

    -- ==========================================================================
    -- B. TIMESTAMP EXTRACTION
    -- ==========================================================================
    
    v_ts := extract_mqtt_timestamp(NEW.payload, NEW.received_at);
    v_bucket_ts := date_bin(INTERVAL '15 minutes', v_ts, '2020-01-01'::timestamptz);

    -- ==========================================================================
    -- C. PARSE, MAP & WRITE METRICS
    -- ==========================================================================
    
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- Normalize key to uppercase for matching
        v_upper_key := upper(v_json_key);
        
        -- Skip metadata fields
        CONTINUE WHEN v_upper_key IN (
            'MAC', 'MODEL', 'MSGID', 'DEVICEID', 'TIMESTAMP', 'TOKEN', 
            'BROKER', 'TOPIC', 'ID', 'DEVICE_ID', 'TS', 'TIME', 'DATETIME',
            'CREATED_AT', 'UPDATED_AT', 'TYPE', 'SENSOR_SN', 'RSSI_DBM',
            'ADDRESS', 'NAME', 'SERIAL', 'FIRMWARE', 'VERSION', 'STATUS',
            'VALUE_MAX', 'VALUE_MIN', 'LABEL', 'UDM'
        );

        -- METRIC NAME MAPPING (handle both cases)
        v_mapped_metric := NULL;
        v_unit := NULL;
        
        -- Match against known metric patterns
        IF v_upper_key IN ('TEMP', 'TEMPERATURE') THEN
            v_mapped_metric := 'env.temperature'; v_unit := '°C';
        ELSIF v_upper_key IN ('HUM', 'HUMIDITY') THEN
            v_mapped_metric := 'env.humidity'; v_unit := '%';
        ELSIF v_upper_key = 'CO2' THEN
            v_mapped_metric := 'iaq.co2'; v_unit := 'ppm';
        ELSIF v_upper_key IN ('VOC', 'TVOC') THEN
            v_mapped_metric := 'iaq.voc'; v_unit := 'ppb';
        ELSIF v_upper_key IN ('PM2.5', 'PM25') THEN
            v_mapped_metric := 'iaq.pm25'; v_unit := 'µg/m³';
        ELSIF v_upper_key = 'PM10' THEN
            v_mapped_metric := 'iaq.pm10'; v_unit := 'µg/m³';
        ELSIF v_upper_key = 'CO' THEN
            v_mapped_metric := 'iaq.co'; v_unit := 'ppm';
        ELSIF v_upper_key = 'O3' THEN
            v_mapped_metric := 'iaq.o3'; v_unit := 'ppb';
        ELSIF v_upper_key = 'NOISE' THEN
            v_mapped_metric := 'env.noise'; v_unit := 'dB';
        ELSIF v_upper_key = 'LUX' THEN
            v_mapped_metric := 'env.illuminance'; v_unit := 'lx';
        ELSIF v_upper_key = 'RADON' THEN
            v_mapped_metric := 'env.radon'; v_unit := 'Bq/m³';
        ELSIF v_upper_key = 'CURRENT_A' THEN
            v_mapped_metric := 'energy.current_a'; v_unit := 'A';
        ELSIF v_upper_key = 'I1' THEN
            v_mapped_metric := 'energy.current_l1'; v_unit := 'A';
        ELSIF v_upper_key = 'I2' THEN
            v_mapped_metric := 'energy.current_l2'; v_unit := 'A';
        ELSIF v_upper_key = 'I3' THEN
            v_mapped_metric := 'energy.current_l3'; v_unit := 'A';
        ELSIF v_upper_key = 'V1' THEN
            v_mapped_metric := 'energy.voltage_l1'; v_unit := 'V';
        ELSIF v_upper_key = 'V2' THEN
            v_mapped_metric := 'energy.voltage_l2'; v_unit := 'V';
        ELSIF v_upper_key = 'V3' THEN
            v_mapped_metric := 'energy.voltage_l3'; v_unit := 'V';
        ELSIF v_upper_key IN ('POWER_W', 'ACTIVE_POWER') THEN
            v_mapped_metric := 'energy.power_w'; v_unit := 'W';
        ELSIF v_upper_key = 'POWER_KW' THEN
            v_mapped_metric := 'energy.power_kw'; v_unit := 'kW';
        ELSIF v_upper_key IN ('ENERGY_KWH', 'TOTAL_ACTIVE_ENERGY_IMPORT') THEN
            v_mapped_metric := 'energy.active_import_kwh'; v_unit := 'kWh';
        ELSIF v_upper_key = 'TOTAL_ACTIVE_ENERGY_EXPORT' THEN
            v_mapped_metric := 'energy.active_export_kwh'; v_unit := 'kWh';
        ELSIF v_upper_key = 'FLOW_RATE' THEN
            v_mapped_metric := 'water.flow_rate'; v_unit := 'L/min';
        ELSIF v_upper_key = 'TOTAL_VOLUME' THEN
            v_mapped_metric := 'water.consumption'; v_unit := 'm³';
        ELSE
            -- Skip unknown keys that don't look like metrics
            CONTINUE;
        END IF;

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
                CONTINUE;
            END IF;
            
            -- Skip placeholder/invalid values
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

            v_metrics_count := v_metrics_count + 1;

        EXCEPTION WHEN OTHERS THEN
            v_err_msg := v_err_msg || v_json_key || ':' || SQLERRM || '; ';
            CONTINUE;
        END;
    END LOOP;

    -- ==========================================================================
    -- E. MARK AS PROCESSED
    -- ==========================================================================
    
    IF v_metrics_count > 0 THEN
        UPDATE mqtt_messages_raw
        SET processed = TRUE, error_message = NULLIF(v_err_msg, '')
        WHERE id = NEW.id;
    ELSE
        UPDATE mqtt_messages_raw
        SET processed = TRUE, 
            error_message = COALESCE(NULLIF(v_err_msg, ''), 'No valid metrics found in payload')
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
