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
    v_bucket_ts TIMESTAMPTZ;
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
    DECLARE
        v_epoch NUMERIC;
        v_ts_candidate TIMESTAMPTZ;
    BEGIN
        -- Default: server receive time
        v_ts := NEW.received_at;
    
        IF (NEW.payload ? 'timestamp') THEN
            v_epoch := (NEW.payload->>'timestamp')::NUMERIC;
    
            -- ms vs sec heuristic
            IF v_epoch >= 1000000000000 THEN
                v_ts_candidate := to_timestamp(v_epoch / 1000.0);
            ELSE
                v_ts_candidate := to_timestamp(v_epoch);
            END IF;
    
            -- Range check: se < 2024 (o troppo nel futuro) usa received_at
            IF v_ts_candidate >= '2024-01-01'::timestamptz
               AND v_ts_candidate <= (now() + interval '1 day') THEN
                v_ts := v_ts_candidate;
            ELSE
                v_ts := NEW.received_at;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_ts := NEW.received_at;
    END;

    -- C. BUCKET 15 MINUTI (1 punto ogni 15 min, idempotente)
    -- NB: date_bin richiede Postgres 14+. Se non lo hai, dimmelo e lo faccio con floor(epoch)
    v_bucket_ts := date_bin(INTERVAL '15 minutes', v_ts, '2024-01-01'::timestamptz);



    -- D. PARSING, MAPPING & SCRITTURA
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- 1. Salta i metadati che non sono sensori
        CONTINUE WHEN lower(v_json_key) IN ('mac', 'model', 'msgid', 'deviceid', 'timestamp', 'token');

        -- 2. TRADUZIONE (MAPPING)
        -- Collega le tue chiavi MQTT a quelle standard del Frontend (useRealTimeData.ts)
        CASE upper(v_json_key)
            WHEN 'TEMP'   THEN v_mapped_metric := 'env.temperature';
            WHEN 'HUM'    THEN v_mapped_metric := 'env.humidity';
            WHEN 'CO2'    THEN v_mapped_metric := 'iaq.co2';
            WHEN 'VOC'    THEN v_mapped_metric := 'iaq.voc';
            WHEN 'PM2.5'  THEN v_mapped_metric := 'iaq.pm25';
            WHEN 'PM10'   THEN v_mapped_metric := 'iaq.pm10';
            WHEN 'CO'     THEN v_mapped_metric := 'iaq.co';
            WHEN 'O3'     THEN v_mapped_metric := 'iaq.o3';
            ELSE v_mapped_metric := lower(v_json_key);
        END CASE;

        -- 3. ESTRAZIONE VALORE (Gestione Oggetto vs Numero)
        v_raw_val := NEW.payload->v_json_key;
        
        BEGIN
            -- Se è un oggetto (es. {"value": 20.5, "udm": "C"}), estrai "value"
            IF jsonb_typeof(v_raw_val) = 'object' AND v_raw_val ? 'value' THEN
                v_json_value := (v_raw_val->>'value')::NUMERIC;
            -- Se è già un numero, usalo direttamente
            ELSIF jsonb_typeof(v_raw_val) = 'number' THEN
                v_json_value := (v_raw_val::text)::NUMERIC;
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
            
            -- B) STORICO (Sempre, ma 1 punto per bucket 15 min per metrica)
            INSERT INTO telemetry (device_id, site_id, ts, metric, value, quality, raw_payload)
            VALUES (v_device_uuid, v_site_uuid, v_bucket_ts, v_mapped_metric, v_json_value, 'good', NEW.payload)
            ON CONFLICT (device_id, metric, ts)
            DO UPDATE SET
                value = EXCLUDED.value,
                quality = EXCLUDED.quality,
                raw_payload = EXCLUDED.raw_payload;

        EXCEPTION WHEN OTHERS THEN
            -- Log senza spam: scrive solo se error_message è nullo (o vuoto)
            UPDATE mqtt_messages_raw
            SET error_message = COALESCE(NULLIF(error_message, ''), SQLERRM)
            WHERE id = NEW.id;
        
            CONTINUE;
        END;
    END LOOP;

    -- E. FINE
    UPDATE mqtt_messages_raw
    SET processed = TRUE
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


