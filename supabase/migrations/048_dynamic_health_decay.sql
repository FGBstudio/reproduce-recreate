-- Migration: Dynamic Health Decay for Trust Layer
-- Version: 048
-- Description: Implement gradual decay for flatlining trust scores and linear scaling for packet loss.

-- 1. Add state tracking column
ALTER TABLE public.sensor_health 
ADD COLUMN IF NOT EXISTS flatline_started_at TIMESTAMPTZ;

-- 2. Update the evaluation logic with dynamic decay
CREATE OR REPLACE FUNCTION public.evaluate_sensor_health()
RETURNS void AS $$
DECLARE
    v_hour TIMESTAMPTZ := date_trunc('hour', now() - INTERVAL '1 hour');
    v_device RECORD;
    v_sample_count INTEGER;
    v_is_flatline BOOLEAN;
    v_new_offline BOOLEAN;
    v_new_flapping INTEGER;
    v_packet_loss FLOAT;
    v_actual_last_seen TIMESTAMPTZ;
    v_flatline_metadata JSONB;
    v_health_msg TEXT;
    v_prev_flatline_start TIMESTAMPTZ;
    v_flatline_duration_hours FLOAT;
    v_dynamic_score INTEGER;
BEGIN
    FOR v_device IN SELECT id, site_id, device_type, name FROM public.devices LOOP
        
        -- A. Fetch Sample Count
        SELECT COALESCE(MAX(sample_count), 0) INTO v_sample_count
        FROM (
            SELECT sample_count FROM public.telemetry_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
            UNION ALL
            SELECT sample_count FROM public.energy_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
        ) s;

        -- B. Check for Flatlining
        v_is_flatline := false;
        v_flatline_metadata := NULL;
        SELECT jsonb_build_object('metric', metric, 'value', value_max, 'samples', sample_count) INTO v_flatline_metadata
        FROM (
            SELECT metric, value_max, sample_count FROM public.telemetry_hourly 
            WHERE device_id = v_device.id AND ts_hour = v_hour 
              AND value_min = value_max AND sample_count > 2 AND value_max > 0
              AND metric NOT IN ('iaq.o3', 'iaq.co', 'status', 'battery', 'voltage', 'rssi', 'signal_strength')
            UNION ALL
            SELECT metric, value_max, sample_count FROM public.energy_hourly 
            WHERE device_id = v_device.id AND ts_hour = v_hour 
              AND value_min = value_max AND sample_count > 2 AND value_max > 0
              AND metric NOT IN ('status', 'battery', 'voltage', 'rssi', 'signal_strength')
        ) f LIMIT 1;
        IF v_flatline_metadata IS NOT NULL THEN v_is_flatline := true; END IF;

        -- C. Get Previous Flatline State
        SELECT flatline_started_at INTO v_prev_flatline_start 
        FROM public.sensor_health WHERE sensor_id = v_device.id;

        -- D. Manage Flatline Start Timestamp
        IF v_is_flatline THEN
            IF v_prev_flatline_start IS NULL THEN
                v_prev_flatline_start := now(); -- Just started flatlining
            END IF;
        ELSE
            v_prev_flatline_start := NULL; -- Reset
        END IF;

        -- E. Pull Actual Last Seen
        IF v_device.device_type = 'energy_monitor' THEN
            SELECT MAX(ts) INTO v_actual_last_seen FROM public.energy_latest WHERE device_id = v_device.id;
        ELSE
            SELECT MAX(ts) INTO v_actual_last_seen FROM public.telemetry_latest WHERE device_id = v_device.id;
        END IF;

        -- F. Base Statuses
        v_new_offline := (v_sample_count = 0) OR CASE 
            WHEN v_device.device_type = 'air_quality' THEN (v_actual_last_seen IS NULL OR v_actual_last_seen < now() - INTERVAL '30 minutes')
            ELSE (v_actual_last_seen IS NULL OR v_actual_last_seen < now() - INTERVAL '4 hours')
        END;
        v_new_flapping := CASE WHEN NOT v_new_offline AND v_sample_count BETWEEN 1 AND 2 THEN 1 ELSE 0 END;
        
        -- G. Packet Loss Logic
        IF v_new_offline THEN 
            v_packet_loss := 100.0;
        ELSE 
            v_packet_loss := GREATEST(0.0, LEAST(100.0, (1.0 - (v_sample_count::float / 4.0)) * 100.0));
        END IF;

        -- H. Dynamic Trust Score Calculation
        IF v_new_offline THEN
            v_dynamic_score := 0;
        ELSIF v_is_flatline THEN
            -- Decay logic: Start at 80, drop 20 points per hour down to 20
            v_flatline_duration_hours := EXTRACT(EPOCH FROM (now() - v_prev_flatline_start)) / 3600.0;
            v_dynamic_score := GREATEST(20, ROUND(80 - (v_flatline_duration_hours * 20)))::integer;
        ELSIF v_packet_loss > 0 THEN
            -- High resolution loss logic: Linear deduction (e.g., 25% loss = 75 score)
            v_dynamic_score := (100 - v_packet_loss)::integer;
        ELSE
            v_dynamic_score := 100;
        END IF;

        -- I. Build Friendly Mirror Message
        v_health_msg := CASE
            WHEN v_new_offline THEN 
                'Offline'
            WHEN v_is_flatline THEN 
                'Stuck value detected (' || (v_flatline_metadata->>'metric') || ').'
            WHEN v_packet_loss > 0 THEN 
                'Data Loss: ' || v_packet_loss::integer || '%.'
            ELSE 'Healthy'
        END;

        -- J. Upsert Diagnostic Snapshot
        INSERT INTO public.sensor_health (
            sensor_id, site_id, last_seen, is_offline, is_flatlining, is_degraded, 
            health_message, flapping_count_24h, packet_loss_pct, trust_score, 
            flatline_started_at, last_evaluated_at, metadata
        )
        VALUES (
            v_device.id, v_device.site_id, v_actual_last_seen, v_new_offline, v_is_flatline, (v_packet_loss > 0),
            v_health_msg, v_new_flapping, v_packet_loss, v_dynamic_score,
            v_prev_flatline_start, now(),
            jsonb_build_object(
                'offline_since', v_actual_last_seen,
                'packet_loss_summary', jsonb_build_object('lost', (4 - v_sample_count), 'total', 4, 'pct', v_packet_loss),
                'flatline_details', v_flatline_metadata,
                'flatline_duration_h', ROUND(EXTRACT(EPOCH FROM (now() - COALESCE(v_prev_flatline_start, now()))) / 3600.0, 1)
            )
        )
        ON CONFLICT (sensor_id) DO UPDATE SET 
            last_seen = EXCLUDED.last_seen,
            is_offline = EXCLUDED.is_offline,
            is_flatlining = EXCLUDED.is_flatlining,
            is_degraded = EXCLUDED.is_degraded,
            health_message = EXCLUDED.health_message,
            flapping_count_24h = EXCLUDED.flapping_count_24h,
            packet_loss_pct = EXCLUDED.packet_loss_pct,
            trust_score = EXCLUDED.trust_score,
            flatline_started_at = EXCLUDED.flatline_started_at,
            metadata = EXCLUDED.metadata,
            last_evaluated_at = now();
            
    END LOOP;
END;
$$ LANGUAGE plpgsql;
