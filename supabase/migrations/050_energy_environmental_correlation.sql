-- Migration: Performance Hardening for Correlation Analytics
-- Version: 050 (Amended)

-- 1. Schema Alignment for site_kpis (Ensuring Master Architect generic schema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'site_kpis' AND column_name = 'metric') THEN
        ALTER TABLE public.site_kpis ADD COLUMN metric TEXT;
        ALTER TABLE public.site_kpis ADD COLUMN value NUMERIC;
        ALTER TABLE public.site_kpis ADD COLUMN ts TIMESTAMPTZ DEFAULT now();
        ALTER TABLE public.site_kpis ADD COLUMN period TEXT DEFAULT 'daily';
        ALTER TABLE public.site_kpis ADD COLUMN metadata JSONB DEFAULT '{}';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_kpis_lookup ON public.site_kpis (site_id, metric, period);

-- 2. Indexing for sub-second retrieval
CREATE INDEX IF NOT EXISTS idx_weather_data_site_ts ON public.weather_data(site_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_weather_data_ts ON public.weather_data("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_site_kpis_m_ts ON public.site_kpis (metric, ts DESC) WHERE metric IS NOT NULL;

-- 3. Physical Cache Tables (Hourly and Daily)
CREATE TABLE IF NOT EXISTS public.site_weather_energy_hourly (
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    ts_hour TIMESTAMPTZ NOT NULL,
    energy_kwh NUMERIC,
    temp_c NUMERIC,
    humidity_pct NUMERIC,
    PRIMARY KEY (site_id, ts_hour)
);

CREATE TABLE IF NOT EXISTS public.site_weather_energy_daily (
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    ts_day DATE NOT NULL,
    energy_kwh NUMERIC,
    temp_c NUMERIC,
    humidity_pct NUMERIC,
    PRIMARY KEY (site_id, ts_day)
);

CREATE INDEX IF NOT EXISTS idx_sweh_ts ON public.site_weather_energy_hourly(ts_hour DESC);
CREATE INDEX IF NOT EXISTS idx_swed_ts ON public.site_weather_energy_daily(ts_day DESC);

-- 4. Instant Backfill Functions (Low CPU)
DROP FUNCTION IF EXISTS public.backfill_correlation_cache(INTEGER);
DROP FUNCTION IF EXISTS public.backfill_correlation_cache(INTEGER, UUID);

CREATE OR REPLACE FUNCTION public.backfill_correlation_cache(
    p_days INTEGER DEFAULT 30,
    p_site_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Hourly Backfill
    INSERT INTO public.site_weather_energy_hourly (site_id, ts_hour, energy_kwh, temp_c, humidity_pct)
    SELECT 
        w.site_id,
        w.bucket,
        COALESCE(e.total_power, 0)::numeric,
        w.avg_temp::numeric,
        w.avg_hum::numeric
    FROM (
        SELECT site_id, date_trunc('hour', "timestamp") as bucket, AVG(temperature_c) as avg_temp, AVG(humidity_percent) as avg_hum
        FROM public.weather_data
        WHERE "timestamp" > now() - (p_days || ' days')::interval
          AND (p_site_id IS NULL OR site_id = p_site_id)
        GROUP BY 1, 2
    ) w
    LEFT JOIN (
        SELECT e.site_id, e.ts_hour as bucket, SUM(e.value_sum) as total_power
        FROM public.energy_hourly e
        JOIN public.devices d ON e.device_id = d.id
        WHERE d.category = 'general'
          AND e.metric = 'energy.active_energy' 
          AND e.ts_hour > now() - (p_days || ' days')::interval
          AND (p_site_id IS NULL OR e.site_id = p_site_id)
        GROUP BY 1, 2
    ) e ON w.site_id = e.site_id AND w.bucket = e.bucket
    ON CONFLICT (site_id, ts_hour) DO UPDATE SET 
        energy_kwh = EXCLUDED.energy_kwh,
        temp_c = EXCLUDED.temp_c,
        humidity_pct = EXCLUDED.humidity_pct;

    -- Daily Backfill
    INSERT INTO public.site_weather_energy_daily (site_id, ts_day, energy_kwh, temp_c, humidity_pct)
    SELECT 
        site_id,
        ts_hour::DATE,
        SUM(energy_kwh),
        AVG(temp_c),
        AVG(humidity_pct)
    FROM public.site_weather_energy_hourly
    WHERE (p_site_id IS NULL OR site_id = p_site_id)
    GROUP BY 1, 2
    ON CONFLICT (site_id, ts_day) DO UPDATE SET 
        energy_kwh = EXCLUDED.energy_kwh,
        temp_c = EXCLUDED.temp_c,
        humidity_pct = EXCLUDED.humidity_pct;

    -- Instant Insight Generation (Calculate Correlation Score)
    DECLARE
        v_corr NUMERIC;
        v_insight TEXT;
        v_site_rec RECORD;
    BEGIN
        FOR v_site_rec IN SELECT id FROM public.sites WHERE (p_site_id IS NULL OR id = p_site_id) LOOP
            v_corr := public.calculate_site_weather_correlation(v_site_rec.id, p_days);
            
            IF v_corr IS NOT NULL THEN
                v_insight := CASE 
                    WHEN v_corr > 0.7 THEN 'Strong Thermal Coupling: Energy consumption is locked to outdoor temperature. Review HVAC insulation.'
                    WHEN v_corr > 0.4 THEN 'High Weather Sensitivity: Recommend optimizing HVAC setpoints.'
                    WHEN v_corr > 0.1 THEN 'Moderate Influence: Weather contributes to peak loads.'
                    WHEN v_corr < -0.4 THEN 'Negative Correlation: Heating load detected.'
                    ELSE 'Low Thermal Impact: Independent of weather.'
                END;

                INSERT INTO public.site_kpis (site_id, ts, metric, value, period, metadata)
                VALUES (
                    v_site_rec.id, now(), 'energy.temp_correlation', v_corr, 'daily', 
                    jsonb_build_object('insight', v_insight, 'last_run', now())
                )
                ON CONFLICT (site_id, metric, period) DO UPDATE SET 
                    value = EXCLUDED.value,
                    metadata = EXCLUDED.metadata,
                    ts = now();
            END IF;
        END LOOP;
    END;
END;
$$ LANGUAGE plpgsql;

-- 5. Statistical Engine: Pearson Correlation Coefficient ($r$)
CREATE OR REPLACE FUNCTION public.calculate_site_weather_correlation(
    p_site_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS NUMERIC AS $$
DECLARE
    v_corr NUMERIC;
BEGIN
    SELECT corr(energy_kwh::double precision, temp_c::double precision)::numeric INTO v_corr
    FROM public.site_weather_energy_hourly
    WHERE site_id = p_site_id
      AND ts_hour > now() - (p_days || ' days')::interval
      AND energy_kwh IS NOT NULL 
      AND temp_c IS NOT NULL;
      
    RETURN v_corr;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. RPC Switch: Auto-Switching Tier (Hourly vs Daily)
DROP FUNCTION IF EXISTS public.get_energy_weather_correlation_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.get_energy_weather_correlation_data(
    p_site_id UUID, 
    p_start_date TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
    p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
    ts TIMESTAMPTZ,
    energy_kwh NUMERIC,
    temp_c NUMERIC,
    humidity_pct NUMERIC
) AS $$
DECLARE
    v_diff INTERVAL;
BEGIN
    v_diff := p_end_date - p_start_date;

    IF v_diff > INTERVAL '31 days' THEN
        -- Return Daily Data for large ranges (Month, Year)
        RETURN QUERY
        SELECT 
            c.ts_day::TIMESTAMPTZ,
            c.energy_kwh,
            c.temp_c,
            c.humidity_pct
        FROM public.site_weather_energy_daily c
        WHERE c.site_id = p_site_id
          AND c.ts_day BETWEEN p_start_date::DATE AND p_end_date::DATE
        ORDER BY c.ts_day ASC;
    ELSE
        -- Return Hourly Data for small ranges (Day, Week)
        RETURN QUERY
        SELECT 
            c.ts_hour,
            c.energy_kwh,
            c.temp_c,
            c.humidity_pct
        FROM public.site_weather_energy_hourly c
        WHERE c.site_id = p_site_id
          AND c.ts_hour BETWEEN p_start_date AND p_end_date
        ORDER BY c.ts_hour ASC;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Security (Row Level Security)
ALTER TABLE public.site_weather_energy_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_weather_energy_daily ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can view weather analytics for their sites" ON public.site_weather_energy_hourly;
    CREATE POLICY "Users can view weather analytics for their sites"
        ON public.site_weather_energy_hourly FOR SELECT
        TO authenticated
        USING (public.can_access_site(auth.uid(), site_id));

    DROP POLICY IF EXISTS "Users can view weather daily analytics for their sites" ON public.site_weather_energy_daily;
    CREATE POLICY "Users can view weather daily analytics for their sites"
        ON public.site_weather_energy_daily FOR SELECT
        TO authenticated
        USING (public.can_access_site(auth.uid(), site_id));
END $$;

-- 6. Dynamic ROI Insight Generator (The "Brain")
CREATE OR REPLACE FUNCTION public.refresh_weather_impact_insights()
RETURNS void AS $$
DECLARE
    v_site RECORD;
    v_corr NUMERIC;
    v_insight TEXT;
BEGIN
    FOR v_site IN SELECT id, name FROM public.sites LOOP
        -- Calculate 30-day correlation
        v_corr := public.calculate_site_weather_correlation(v_site.id, 30);
        
        -- Only proceed if we have enough data to compute a correlation
        IF v_corr IS NOT NULL THEN
            v_insight := CASE 
                WHEN v_corr > 0.7 THEN 'Critical Thermal Coupling: Energy consumption is locked to outdoor temperature. Review HVAC insulation.'
                WHEN v_corr > 0.4 THEN 'High Weather Sensitivity: Recommend optimizing HVAC setpoints and economizer cycles.'
                WHEN v_corr > 0.1 THEN 'Moderate Influence: Weather contributes to peak loads.'
                WHEN v_corr < -0.4 THEN 'Negative correlation: Energy increases as temperature drops (Heating Load).'
                ELSE 'Low Thermal Impact: Site loads are process or lighting driven, independent of weather.'
            END;

            INSERT INTO public.site_kpis (site_id, ts, metric, value, period, metadata)
            VALUES (
                v_site.id, now(), 'energy.temp_correlation', v_corr, 'daily', 
                jsonb_build_object('insight', v_insight, 'last_run', now())
            )
            ON CONFLICT (site_id, metric, period) DO UPDATE SET 
                value = EXCLUDED.value,
                metadata = EXCLUDED.metadata,
                ts = now();
                
            RAISE NOTICE 'Updated weather insight for site: % (Corr: %)', v_site.name, v_corr;
        ELSE
            RAISE NOTICE 'Skipping site %: Not enough data for correlation calculation.', v_site.name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily refresh (2:30 AM)
SELECT cron.schedule('daily-weather-correlation', '30 2 * * *', $$SELECT public.refresh_weather_impact_insights()$$);
