-- Migration: Sensor Health Trust Layer
-- Version: 041
-- Description: Establishes the trust layer and sensor health tracking for the Enterprise Alert Engine

-- 1. Create the sensor_health table
CREATE TABLE IF NOT EXISTS public.sensor_health (
    sensor_id UUID PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
    
    -- State Columns
    last_seen TIMESTAMPTZ,
    is_offline BOOLEAN DEFAULT false,
    is_flatlining BOOLEAN DEFAULT false,
    flapping_count_24h INTEGER DEFAULT 0,
    
    -- Metrics
    packet_loss_pct FLOAT DEFAULT 0,
    
    -- The Unified Output
    trust_score INTEGER DEFAULT 100 CHECK (trust_score >= 0 AND trust_score <= 100),
    
    -- Metadata
    last_evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- 2. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_sensor_health_site_id ON public.sensor_health(site_id);
CREATE INDEX IF NOT EXISTS idx_sensor_health_score ON public.sensor_health(trust_score);
-- Indexing the sensor_id with an offline filter for fast active-outage lookups
CREATE INDEX IF NOT EXISTS idx_sensor_health_offline ON public.sensor_health(sensor_id) WHERE is_offline = true;

-- 3. Row Level Security (RLS)
ALTER TABLE public.sensor_health ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view sensor health for their sites" ON public.sensor_health;
    CREATE POLICY "Users can view sensor health for their sites"
        ON public.sensor_health FOR SELECT
        TO authenticated
        USING (public.can_access_site(auth.uid(), site_id));
END $$;

-- 4. Initial Seed (Link existing devices)
INSERT INTO public.sensor_health (sensor_id, site_id)
SELECT id, site_id FROM public.devices
ON CONFLICT (sensor_id) DO NOTHING;

-- 5. Logic: Sensor Health Evaluation (Optimized for Robustness)
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
BEGIN
    FOR v_device IN SELECT id, site_id, device_type FROM public.devices LOOP
        
        -- A. Fetch Sample Count (Max across all metrics for this device)
        SELECT COALESCE(MAX(sample_count), 0) INTO v_sample_count
        FROM (
            SELECT sample_count FROM public.telemetry_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
            UNION ALL
            SELECT sample_count FROM public.energy_hourly WHERE device_id = v_device.id AND ts_hour = v_hour
        ) s;

        -- B. Check for Flatlining (min == max AND max > 0 to ignore lights-off/empty rooms)
        -- Explicitly omitting expected-flat metrics like O3 and CO.
        v_is_flatline := false;
        v_flatline_metadata := NULL;

        SELECT jsonb_build_object(
            'metric', metric,
            'value', value_max,
            'samples', sample_count
        ) INTO v_flatline_metadata
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
        ) f
        LIMIT 1;

        IF v_flatline_metadata IS NOT NULL THEN
            v_is_flatline := true;
        END IF;

        -- C. Pull Actual Last Seen Timestamp strictly routing Air to telemetry and Energy to energy_latest
        IF v_device.device_type = 'energy_monitor' THEN
            SELECT MAX(ts) INTO v_actual_last_seen FROM public.energy_latest WHERE device_id = v_device.id;
        ELSE
            SELECT MAX(ts) INTO v_actual_last_seen FROM public.telemetry_latest WHERE device_id = v_device.id;
        END IF;

        -- D. Base Statuses
        -- A device is offline if its last_seen timestamp is older than 3 hours, or if it has never been seen
        v_new_offline := (v_actual_last_seen IS NULL OR v_actual_last_seen < now() - INTERVAL '3 hours');
        
        -- Flapping only applies if it's technically online but dropped packets in the previous hour
        v_new_flapping := CASE WHEN NOT v_new_offline AND v_sample_count BETWEEN 1 AND 2 THEN 1 ELSE 0 END;
        
        -- E. Clamp Packet Loss between 0% and 100% (Only calculate if online)
        IF v_new_offline THEN
            v_packet_loss := 100.0;
        ELSE
            v_packet_loss := GREATEST(0.0, LEAST(100.0, (1.0 - (v_sample_count::float / 4.0)) * 100.0));
        END IF;

        -- F. Upsert Data (Handles newly added devices and updates existing seamlessly)
        INSERT INTO public.sensor_health (
            sensor_id, site_id, last_seen, is_offline, is_flatlining, 
            flapping_count_24h, packet_loss_pct, trust_score, last_evaluated_at, metadata
        )
        VALUES (
            v_device.id, 
            v_device.site_id, 
            v_actual_last_seen, 
            v_new_offline, 
            v_is_flatline, 
            v_new_flapping, 
            v_packet_loss, 
            100, -- Placeholder, recalibrated in DO UPDATE
            now(),
            COALESCE(v_flatline_metadata, '{}'::JSONB)
        )
        ON CONFLICT (sensor_id) DO UPDATE 
        SET 
            -- Only update last_seen if we actually saw it recently, otherwise keep historical
            last_seen = COALESCE(EXCLUDED.last_seen, sensor_health.last_seen),
            is_offline = EXCLUDED.is_offline,
            is_flatlining = EXCLUDED.is_flatlining,
            flapping_count_24h = sensor_health.flapping_count_24h + EXCLUDED.flapping_count_24h,
            packet_loss_pct = EXCLUDED.packet_loss_pct,
            metadata = EXCLUDED.metadata,
            last_evaluated_at = now(),
            
            -- Dynamic Trust Score Math (Realistic FGB Logic)
            trust_score = CASE 
                WHEN EXCLUDED.is_offline THEN 0
                ELSE GREATEST(0, 100 
                    - (CASE WHEN EXCLUDED.is_flatlining THEN 20 ELSE 0 END)
                    - ((sensor_health.flapping_count_24h + EXCLUDED.flapping_count_24h) * 5)
                )
            END;
            
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 6. Logic: Daily Reset (Optimized)
CREATE OR REPLACE FUNCTION public.reset_sensor_health_daily()
RETURNS void AS $$
BEGIN
    UPDATE public.sensor_health
    SET flapping_count_24h = 0,
        last_evaluated_at = now()
    WHERE flapping_count_24h > 0;
END;
$$ LANGUAGE plpgsql;

-- 7. Grant Permissions
GRANT EXECUTE ON FUNCTION public.evaluate_sensor_health TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_sensor_health_daily TO service_role;

COMMENT ON TABLE public.sensor_health IS 'Trust Layer: Tracks device connectivity and data plausibility for the alert engine.';
