-- Migration: Process MQTT Smart Throttling + Metric Translation
-- Version: 024

-- 1. Indice per velocità
CREATE INDEX IF NOT EXISTS idx_telemetry_device_ts_desc 
ON telemetry (device_id, ts DESC);

-- 2. Funzione Trigger
CREATE OR REPLACE FUNCTION process_mqtt_message_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_device_uuid UUID;
    v_site_uuid UUID;
    v_json_key TEXT;         -- Chiave originale nel JSON (es. "t_amb")
    v_mapped_metric TEXT;    -- Chiave tradotta per il Frontend (es. "env.temperature")
    v_json_value NUMERIC;
    v_ts TIMESTAMPTZ;
    v_last_history_ts TIMESTAMPTZ;
    v_should_save_history BOOLEAN;
BEGIN
    -- A. TROVA DISPOSITIVO
    SELECT id, site_id INTO v_device_uuid, v_site_uuid
    FROM devices
    WHERE device_id = NEW.device_external_id OR topic = NEW.topic
    LIMIT 1;

    IF v_device_uuid IS NULL THEN
        UPDATE mqtt_messages_raw 
        SET processed = TRUE, error_message = 'Device not found: ' || COALESCE(NEW.device_external_id, NEW.topic, 'Unknown')
        WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    -- B. TIMESTAMP
    v_ts := COALESCE(
        (NEW.payload->>'timestamp')::TIMESTAMPTZ, 
        (NEW.payload->>'ts')::TIMESTAMPTZ,
        NEW.received_at
    );

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

    -- D. PARSING & TRADUZIONE
    FOR v_json_key IN SELECT * FROM jsonb_object_keys(NEW.payload)
    LOOP
        -- Salta chiavi tecniche
        CONTINUE WHEN v_json_key IN ('timestamp', 'ts', 'time', 'device_id', 'id', 'token', 'status');

        -- === SEZIONE MAPPING (TRADUZIONE) ===
        -- Qui definiamo come trasformare i nomi grezzi nei nomi che vuole il Frontend
        CASE v_json_key
            -- Esempi di traduzione (Adatta questi ai tuoi sensori reali!)
            WHEN 'temp', 'temperature', 't_amb'  THEN v_mapped_metric := 'env.temperature';
            WHEN 'co2', 'carbon_dioxide'         THEN v_mapped_metric := 'iaq.co2';
            WHEN 'hum', 'humidity', 'rh'         THEN v_mapped_metric := 'env.humidity';
            WHEN 'power', 'pow', 'w', 'active_power' THEN v_mapped_metric := 'energy.power_kw';
            WHEN 'hvac_p', 'ac_power'            THEN v_mapped_metric := 'energy.hvac_kw';
            WHEN 'light_p', 'lights'             THEN v_mapped_metric := 'energy.lighting_kw';
            
            -- Default: Se non conosciamo la chiave, usiamo quella originale (o prefissata 'raw.')
            ELSE v_mapped_metric := v_json_key; 
        END CASE;
        -- ====================================

        BEGIN
            v_json_value := (NEW.payload->>v_json_key)::NUMERIC;
            
            -- 1) LIVE
            INSERT INTO telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric) 
            DO UPDATE SET 
                value = EXCLUDED.value, 
                ts = EXCLUDED.ts,
                site_id = EXCLUDED.site_id;

            -- 2) STORICO (15 min)
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

DROP TRIGGER IF EXISTS trg_process_mqtt_message ON mqtt_messages_raw;
CREATE TRIGGER trg_process_mqtt_message
    AFTER INSERT ON mqtt_messages_raw
    FOR EACH ROW
    EXECUTE FUNCTION process_mqtt_message_trigger();