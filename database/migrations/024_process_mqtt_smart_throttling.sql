-- Migration: Process MQTT Smart Throttling (Custom for WEEL Format)
-- Version: 024-WEEL

-- 1. Indice per velocità (Fondamentale)
CREATE INDEX IF NOT EXISTS idx_telemetry_device_ts_desc 
ON telemetry (device_id, ts DESC);

-- 2. Funzione Trigger Aggiornata
CREATE OR REPLACE FUNCTION process_mqtt_message_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_device_uuid UUID;
    v_site_uuid UUID;
    v_json_key TEXT;         
    v_mapped_metric TEXT;    
    v_json_value NUMERIC;
    v_ts TIMESTAMPTZ;
    v_last_history_ts TIMESTAMPTZ;
    v_should_save_history BOOLEAN;
    v_raw_val JSONB; -- Variabile temporanea per gestire l'oggetto nidificato
BEGIN
    -- A. IDENTIFICAZIONE DISPOSITIVO
    SELECT id, site_id INTO v_device_uuid, v_site_uuid
    FROM devices
    WHERE 
        device_id = NEW.device_external_id 
        OR 
        topic = NEW.topic
    LIMIT 1;

    IF v_device_uuid IS NULL THEN
        UPDATE mqtt_messages_raw 
        SET processed = TRUE, error_message = 'Device not found: ' || COALESCE(NEW.device_external_id, NEW.topic, 'Unknown')
        WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    -- B. TIMESTAMP (Gestione Millisecondi)
    -- Il tuo payload ha "timestamp": 956191699000. Se sono ms, va diviso per 1000.
    BEGIN
        IF (NEW.payload ? 'timestamp') THEN
            v_ts := to_timestamp((NEW.payload->>'timestamp')::NUMERIC / 1000.0);
        ELSE
            v_ts := NEW.received_at;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ts := NEW.received_at; -- Fallback se il timestamp è illeggibile
    END;

    -- C. LOGICA 15 MINUTI
    SELECT ts INTO v_last_history_ts
    FROM telemetry
    WHERE device_id = v_device_uuid
    ORDER BY ts DESC
    LIMIT 1;

    IF v_last_history_ts IS NULL OR v_ts >= (v_last_history_ts + INTERVAL '15 minutes') THEN
        v_should_save_history := TRUE;
    ELSE
        v_should_save_history := FALSE;
    END IF;

    -- D. PARSING, MAPPING & SCRITTURA
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- 1. Salta i metadati che non sono sensori
        CONTINUE WHEN v_json_key IN ('MAC', 'model', 'msgid', 'deviceid', 'timestamp', 'token');

        -- 2. TRADUZIONE (MAPPING)
        -- Collega le tue chiavi MQTT a quelle standard del Frontend (useRealTimeData.ts)
        CASE v_json_key
            WHEN 'temp'   THEN v_mapped_metric := 'env.temperature';
            WHEN 'hum'    THEN v_mapped_metric := 'env.humidity';
            WHEN 'CO2'    THEN v_mapped_metric := 'iaq.co2';
            WHEN 'VOC'    THEN v_mapped_metric := 'iaq.voc';
            WHEN 'PM2.5'  THEN v_mapped_metric := 'iaq.pm25';
            WHEN 'PM10'   THEN v_mapped_metric := 'iaq.pm10';
            WHEN 'CO'     THEN v_mapped_metric := 'iaq.co'; -- Extra utile
            WHEN 'O3'     THEN v_mapped_metric := 'iaq.o3'; -- Extra utile
            ELSE v_mapped_metric := v_json_key; -- Fallback (es. raw.temp)
        END CASE;

        -- 3. ESTRAZIONE VALORE (Gestione Oggetto vs Numero)
        v_raw_val := NEW.payload->v_json_key;
        
        BEGIN
            -- Se è un oggetto (es. {"value": 20.5, "udm": "C"}), estrai "value"
            IF jsonb_typeof(v_raw_val) = 'object' AND v_raw_val ? 'value' THEN
                v_json_value := (v_raw_val->>'value')::NUMERIC;
            -- Se è già un numero, usalo direttamente
            ELSIF jsonb_typeof(v_raw_val) = 'number' THEN
                v_json_value := (v_raw_val)::NUMERIC;
            ELSE
                -- Se è stringa o altro, salta
                CONTINUE;
            END IF;
            
            -- 4. SCRITTURA DB
            
            -- A) LIVE (Sempre)
            INSERT INTO telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric) 
            DO UPDATE SET 
                value = EXCLUDED.value, 
                ts = EXCLUDED.ts,
                site_id = EXCLUDED.site_id;

            -- B) STORICO (15 min)
            IF v_should_save_history THEN
                INSERT INTO telemetry (device_id, site_id, ts, metric, value, quality, raw_payload)
                VALUES (v_device_uuid, v_site_uuid, v_ts, v_mapped_metric, v_json_value, 'good', NEW.payload);
            END IF;

        EXCEPTION WHEN OTHERS THEN
            CONTINUE;
        END;
    END LOOP;

    -- E. FINE
    UPDATE mqtt_messages_raw 
    SET processed = TRUE, error_message = NULL
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attiva Trigger
DROP TRIGGER IF EXISTS trg_process_mqtt_message ON mqtt_messages_raw;
CREATE TRIGGER trg_process_mqtt_message
    AFTER INSERT ON mqtt_messages_raw
    FOR EACH ROW
    EXECUTE FUNCTION process_mqtt_message_trigger();
