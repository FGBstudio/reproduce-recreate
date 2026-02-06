-- Fix: prevent device collapse when many devices share the same MQTT topic (e.g. 'fosensor/iaq')
-- Strategy: resolve device strictly by device_external_id when present; only fall back to topic when external id is missing.

CREATE OR REPLACE FUNCTION public.process_mqtt_message_trigger()
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
    v_ext_id TEXT;
BEGIN
    -- Normalize external id (avoid blanks/spaces)
    v_ext_id := NULLIF(btrim(NEW.device_external_id), '');

    -- A. DEVICE LOOKUP (STRICT)
    -- IMPORTANT: many devices share the same topic; matching by topic would collapse them into 1 random device.
    IF v_ext_id IS NOT NULL THEN
        SELECT id, site_id
        INTO v_device_uuid, v_site_uuid
        FROM public.devices
        WHERE device_id = v_ext_id
        LIMIT 1;
    END IF;

    -- Fallback to topic ONLY if we truly don't have an external id
    IF v_device_uuid IS NULL AND v_ext_id IS NULL THEN
        SELECT id, site_id
        INTO v_device_uuid, v_site_uuid
        FROM public.devices
        WHERE topic = NEW.topic
        ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        LIMIT 1;
    END IF;

    IF v_device_uuid IS NULL THEN
        UPDATE public.mqtt_messages_raw
        SET processed = TRUE,
            error_message = 'Device not found: ' || COALESCE(v_ext_id, NEW.topic, 'Unknown')
        WHERE id = NEW.id;
        RETURN NEW;
    END IF;

    -- B. TIMESTAMP: ALWAYS use server receive time (reliable)
    v_ts := NEW.received_at;

    -- C. 15-MINUTE BUCKET for idempotent history writes
    v_bucket_ts := date_bin(INTERVAL '15 minutes', v_ts, '2024-01-01'::timestamptz);

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

        -- VALUE EXTRACTION
        v_raw_val := NEW.payload->v_json_key;

        BEGIN
            IF jsonb_typeof(v_raw_val) = 'object' AND v_raw_val ? 'value' THEN
                v_json_value := (v_raw_val->>'value')::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'number' THEN
                v_json_value := (v_raw_val::text)::NUMERIC;
            ELSIF jsonb_typeof(v_raw_val) = 'string' AND (v_raw_val::text) ~ '^"?-?[0-9]+\.?[0-9]*"?$' THEN
                v_json_value := (v_raw_val#>>'{}')::NUMERIC;
            ELSE
                CONTINUE;
            END IF;

            -- VALIDATION: Skip placeholder values
            IF v_json_value < -50000 OR v_json_value > 1e12 THEN
                CONTINUE;
            END IF;

            -- WRITE: LIVE
            INSERT INTO public.telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric)
            DO UPDATE SET
                value = EXCLUDED.value,
                ts = EXCLUDED.ts,
                site_id = EXCLUDED.site_id,
                quality = EXCLUDED.quality;

            -- WRITE: HISTORY (bucketed)
            INSERT INTO public.telemetry (device_id, site_id, ts, metric, value, unit, quality, raw_payload)
            VALUES (v_device_uuid, v_site_uuid, v_bucket_ts, v_mapped_metric, v_json_value, v_unit, 'good', NEW.payload)
            ON CONFLICT (device_id, metric, ts)
            DO UPDATE SET
                value = EXCLUDED.value,
                unit = COALESCE(EXCLUDED.unit, telemetry.unit),
                quality = EXCLUDED.quality,
                raw_payload = EXCLUDED.raw_payload;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.mqtt_messages_raw
            SET error_message = COALESCE(NULLIF(error_message, ''), '') || v_json_key || ': ' || SQLERRM || '; '
            WHERE id = NEW.id;
            CONTINUE;
        END;
    END LOOP;

    -- E. MARK AS PROCESSED
    UPDATE public.mqtt_messages_raw
    SET processed = TRUE
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_process_mqtt_message ON public.mqtt_messages_raw;
CREATE TRIGGER trg_process_mqtt_message
    AFTER INSERT ON public.mqtt_messages_raw
    FOR EACH ROW
    EXECUTE FUNCTION public.process_mqtt_message_trigger();

-- Ensure unique constraint exists for idempotent writes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'telemetry_device_metric_ts_key'
    ) THEN
        ALTER TABLE public.telemetry
            ADD CONSTRAINT telemetry_device_metric_ts_key UNIQUE (device_id, metric, ts);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;
