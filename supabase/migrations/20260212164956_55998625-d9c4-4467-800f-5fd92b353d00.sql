
-- Migration: Virtual Meter aggregation for PAN12 energy monitors
-- Rewrites process_mqtt_message_trigger to:
-- 1. Detect energy_monitor devices with a category
-- 2. Calculate kW from current_a (P = I * 230V * 1.0 / 1000)
-- 3. Store individual device calc in telemetry_latest (scratchpad)
-- 4. Sum all devices in same site+category into a Virtual Meter
-- 5. Write aggregated kW to energy_latest + energy_telemetry
-- 6. Suppress individual PAN12 writes to energy_telemetry

CREATE OR REPLACE FUNCTION public.process_mqtt_message_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_device_uuid UUID;
    v_site_uuid UUID;
    v_device_type TEXT;
    v_device_category TEXT;
    v_json_key TEXT;
    v_mapped_metric TEXT;
    v_json_value NUMERIC;
    v_ts TIMESTAMPTZ;
    v_bucket_ts TIMESTAMPTZ;
    v_raw_val JSONB;
    v_unit TEXT;
    v_ext_id TEXT;
    -- Virtual Meter variables
    v_is_energy_device BOOLEAN := FALSE;
    v_has_current BOOLEAN := FALSE;
    v_current_a NUMERIC;
    v_calc_kw NUMERIC;
    v_sum_kw NUMERIC;
    v_virtual_uuid UUID;
    v_virtual_name TEXT;
    -- Constants
    v_voltage_ln CONSTANT NUMERIC := 230.0;
    v_power_factor CONSTANT NUMERIC := 1.0;
BEGIN
    -- Normalize external id
    v_ext_id := NULLIF(btrim(NEW.device_external_id), '');

    -- A. DEVICE LOOKUP (STRICT: by external id first)
    IF v_ext_id IS NOT NULL THEN
        SELECT id, site_id, device_type::text, category
        INTO v_device_uuid, v_site_uuid, v_device_type, v_device_category
        FROM public.devices
        WHERE device_id = v_ext_id
        LIMIT 1;
    END IF;

    -- Fallback to topic ONLY if no external id
    IF v_device_uuid IS NULL AND v_ext_id IS NULL THEN
        SELECT id, site_id, device_type::text, category
        INTO v_device_uuid, v_site_uuid, v_device_type, v_device_category
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

    -- Determine if this is an energy monitor with a valid category
    v_is_energy_device := (v_device_type = 'energy_monitor' AND v_device_category IS NOT NULL AND v_site_uuid IS NOT NULL);

    -- B. TIMESTAMP
    v_ts := NEW.received_at;
    v_bucket_ts := date_bin(INTERVAL '15 minutes', v_ts, '2024-01-01'::timestamptz);

    -- C. PARSE, MAP & WRITE METRICS
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
            -- Energy
            WHEN 'CURRENT_A' THEN v_mapped_metric := 'energy.current_a'; v_unit := 'A';
            WHEN 'I1' THEN v_mapped_metric := 'energy.current_l1'; v_unit := 'A';
            WHEN 'I2' THEN v_mapped_metric := 'energy.current_l2'; v_unit := 'A';
            WHEN 'I3' THEN v_mapped_metric := 'energy.current_l3'; v_unit := 'A';
            WHEN 'V1' THEN v_mapped_metric := 'energy.voltage_l1'; v_unit := 'V';
            WHEN 'V2' THEN v_mapped_metric := 'energy.voltage_l2'; v_unit := 'V';
            WHEN 'V3' THEN v_mapped_metric := 'energy.voltage_l3'; v_unit := 'V';
            WHEN 'PF1' THEN v_mapped_metric := 'energy.pf_l1'; v_unit := '';
            WHEN 'PF2' THEN v_mapped_metric := 'energy.pf_l2'; v_unit := '';
            WHEN 'PF3' THEN v_mapped_metric := 'energy.pf_l3'; v_unit := '';
            WHEN 'POWER_W'  THEN v_mapped_metric := 'energy.power_w'; v_unit := 'W';
            WHEN 'POWER_KW' THEN v_mapped_metric := 'energy.power_kw'; v_unit := 'kW';
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

            -- Skip placeholder values
            IF v_json_value < -50000 OR v_json_value > 1e12 THEN
                CONTINUE;
            END IF;

            -- ================================================================
            -- ENERGY MONITOR WITH CATEGORY: VIRTUAL METER AGGREGATION
            -- ================================================================
            IF v_is_energy_device AND v_mapped_metric = 'energy.current_a' THEN
                -- A. Calculate single-device power (kW)
                v_calc_kw := (v_json_value * v_voltage_ln * v_power_factor) / 1000.0;

                -- B. Store individual device kW in telemetry_latest (scratchpad)
                --    This allows summing all devices in the same category later
                INSERT INTO public.telemetry_latest (device_id, site_id, metric, value, ts, quality)
                VALUES (v_device_uuid, v_site_uuid, 'internal.calc_kw', v_calc_kw, v_ts, 'good')
                ON CONFLICT (device_id, metric) DO UPDATE SET
                    value = EXCLUDED.value, ts = EXCLUDED.ts, site_id = EXCLUDED.site_id;

                -- Also store raw current_a for diagnostics
                INSERT INTO public.telemetry_latest (device_id, site_id, metric, value, ts, quality)
                VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
                ON CONFLICT (device_id, metric) DO UPDATE SET
                    value = EXCLUDED.value, ts = EXCLUDED.ts, site_id = EXCLUDED.site_id;

                -- C. Find or create Virtual Meter for this site+category
                v_virtual_name := 'VIRT-' || v_site_uuid::text || '-' || v_device_category;
                
                SELECT id INTO v_virtual_uuid
                FROM public.devices
                WHERE device_id = v_virtual_name AND site_id = v_site_uuid
                LIMIT 1;

                IF v_virtual_uuid IS NULL THEN
                    INSERT INTO public.devices (
                        device_id, name, device_type, site_id, status, category,
                        model, metadata
                    ) VALUES (
                        v_virtual_name,
                        'Virtual Meter - ' || INITCAP(v_device_category),
                        'energy_monitor',
                        v_site_uuid,
                        'online',
                        v_device_category,
                        'VirtualMeter',
                        jsonb_build_object('virtual', true, 'aggregation', 'sum_by_category')
                    )
                    RETURNING id INTO v_virtual_uuid;
                END IF;

                -- D. Aggregate: sum kW of ALL devices in this site+category
                SELECT COALESCE(SUM(tl.value), 0) INTO v_sum_kw
                FROM public.telemetry_latest tl
                JOIN public.devices d ON d.id = tl.device_id
                WHERE d.site_id = v_site_uuid
                  AND d.category = v_device_category
                  AND d.model IS DISTINCT FROM 'VirtualMeter'  -- exclude virtual devices from sum
                  AND tl.metric = 'internal.calc_kw';

                -- E. Write aggregated power to ENERGY tables (Virtual Meter only)

                -- E1. energy_latest (live view)
                INSERT INTO public.energy_latest (device_id, site_id, metric, value, ts, unit, quality)
                VALUES (v_virtual_uuid, v_site_uuid, 'energy.power_kw', v_sum_kw, v_ts, 'kW', 'good')
                ON CONFLICT (device_id, metric) DO UPDATE SET
                    value = EXCLUDED.value, ts = EXCLUDED.ts, quality = EXCLUDED.quality;

                -- E2. energy_telemetry (historical, 15-min bucketed)
                INSERT INTO public.energy_telemetry (device_id, site_id, ts, metric, value, unit, quality)
                VALUES (v_virtual_uuid, v_site_uuid, v_bucket_ts, 'energy.power_kw', v_sum_kw, 'kW', 'good')
                ON CONFLICT (device_id, ts, metric) DO UPDATE SET
                    value = EXCLUDED.value, quality = EXCLUDED.quality;

                -- Update virtual device last_seen
                UPDATE public.devices SET last_seen = v_ts, status = 'online' WHERE id = v_virtual_uuid;

                -- SUPPRESS: Do NOT write individual PAN12 to energy_telemetry
                CONTINUE;
            END IF;

            -- ================================================================
            -- STANDARD PATH: All non-energy or non-categorized metrics
            -- ================================================================

            -- WRITE: LIVE (telemetry_latest)
            INSERT INTO public.telemetry_latest (device_id, site_id, metric, value, ts, quality)
            VALUES (v_device_uuid, v_site_uuid, v_mapped_metric, v_json_value, v_ts, 'good')
            ON CONFLICT (device_id, metric)
            DO UPDATE SET
                value = EXCLUDED.value,
                ts = EXCLUDED.ts,
                site_id = EXCLUDED.site_id,
                quality = EXCLUDED.quality;

            -- WRITE: HISTORY (telemetry, bucketed)
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

    -- Update physical device last_seen
    UPDATE public.devices SET last_seen = v_ts, status = 'online' WHERE id = v_device_uuid;

    -- MARK AS PROCESSED
    UPDATE public.mqtt_messages_raw
    SET processed = TRUE
    WHERE id = NEW.id;

    RETURN NEW;
END;
$function$;
