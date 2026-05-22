-- Migration: Automate Site Climate Zones, Programmatic Seeding, and Breakdown Calculation Engine
-- Version: 052
-- Description: Sets up lat-based climate zone lookup, backfills sites, sets up automatic trigger, seeds custom typologies, and creates the calculation RPC.

-- =====================================================================
-- 1. CREATE THE LATITUDE-BASED LOOKUP FUNCTION
-- =====================================================================
CREATE OR REPLACE FUNCTION lookup_climate_zone(p_lat numeric, p_lng numeric)
RETURNS text AS $$
BEGIN
    IF p_lat IS NULL OR p_lng IS NULL THEN
        RETURN '4A'; -- Default mid-latitude climate zone
    END IF;

    -- Hardcoded latitude bands instead of querying a table
    IF abs(p_lat) <= 15 THEN 
        RETURN '1A'; -- Very Hot (Equatorial)
    ELSIF abs(p_lat) > 15 AND abs(p_lat) <= 30 THEN 
        RETURN '2A'; -- Hot (Subtropical)
    ELSIF abs(p_lat) > 30 AND abs(p_lat) <= 37 THEN 
        RETURN '3A'; -- Warm (Mediterranean/Southern US)
    ELSIF abs(p_lat) > 37 AND abs(p_lat) <= 45 THEN 
        RETURN '4A'; -- Mixed/Temperate (Central Europe, Mid US)
    ELSIF abs(p_lat) > 45 AND abs(p_lat) <= 54 THEN 
        RETURN '5A'; -- Cool (UK, Northern Europe, Northern US)
    ELSE 
        RETURN '6A'; -- Cold/Subarctic (Canada, Scandinavia)
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================================
-- 2. BACKFILL EXISTING SITES
-- =====================================================================
UPDATE sites 
SET climate_zone = lookup_climate_zone(lat, lng) 
WHERE climate_zone IS NULL;

-- =====================================================================
-- 3. CREATE AUTOMATIC TRIGGER FOR FUTURE SITE INSERTS/UPDATES
-- =====================================================================
CREATE OR REPLACE FUNCTION trigger_set_site_climate_zone()
RETURNS TRIGGER AS $$
BEGIN
    -- Update climate zone if coordinates changed or climate_zone is not yet set
    IF (TG_OP = 'INSERT') OR 
       (OLD.lat IS DISTINCT FROM NEW.lat) OR 
       (OLD.lng IS DISTINCT FROM NEW.lng) OR
       (NEW.climate_zone IS NULL) THEN
        NEW.climate_zone := lookup_climate_zone(NEW.lat, NEW.lng);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind Trigger to Sites Table
DROP TRIGGER IF EXISTS tr_set_site_climate_zone ON sites;
CREATE TRIGGER tr_set_site_climate_zone
    BEFORE INSERT OR UPDATE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_site_climate_zone();

-- =====================================================================
-- 4. PROGRAMMATIC SEEDING OF ENERGY_BENCHMARKS
-- =====================================================================
DO $$
DECLARE
    v_typology text;
    v_climate_zone text;
    v_month integer;
    v_day_type text;
    v_hour integer;
    v_raw_hvac numeric;
    v_raw_lighting numeric;
    v_raw_plugs numeric;
    v_raw_other numeric;
    v_sum numeric;
    v_hvac_pct numeric;
    v_lighting_pct numeric;
    v_plugs_pct numeric;
    v_other_pct numeric;
    v_is_occupied boolean;
    v_cooling_need numeric;
    v_heating_need numeric;
    v_hvac_season_factor numeric;
    v_hvac_hour_factor numeric;
BEGIN
    TRUNCATE TABLE energy_benchmarks;

    -- Array matches exact site typologies (lowercased)
    FOREACH v_typology IN ARRAY ARRAY['office', 'retail', 'warehouse', 'logistic', 'office+retail'] LOOP
        FOREACH v_climate_zone IN ARRAY ARRAY['1A', '2A', '3A', '4A', '5A', '6A'] LOOP
            FOR v_month IN 1..12 LOOP
                FOREACH v_day_type IN ARRAY ARRAY['weekday', 'weekend', 'holiday'] LOOP
                    FOR v_hour IN 0..23 LOOP
                        
                        -- A. DETERMINE OCCUPANCY HOURS BY TYPOLOGY
                        IF v_typology = 'office' THEN
                            v_is_occupied := (v_day_type = 'weekday') AND (v_hour BETWEEN 8 AND 18);
                        ELSIF v_typology = 'retail' THEN
                            v_is_occupied := (v_day_type IN ('weekday', 'weekend')) AND (v_hour BETWEEN 9 AND 21);
                        ELSIF v_typology IN ('warehouse', 'logistic') THEN
                            v_is_occupied := (v_day_type IN ('weekday', 'weekend')) AND (v_hour BETWEEN 6 AND 22);
                        ELSIF v_typology = 'office+retail' THEN
                            v_is_occupied := (v_day_type IN ('weekday', 'weekend')) AND (v_hour BETWEEN 8 AND 21);
                        END IF;

                        -- B. BASE LIGHTING SPLITS
                        IF v_is_occupied THEN
                            IF v_typology IN ('warehouse', 'logistic') THEN v_raw_lighting := 0.60;
                            ELSIF v_typology = 'retail' THEN v_raw_lighting := 0.35;
                            ELSIF v_typology = 'office+retail' THEN v_raw_lighting := 0.32;
                            ELSE v_raw_lighting := 0.30; -- office
                            END IF;
                        ELSE
                            v_raw_lighting := 0.05; 
                        END IF;

                        -- C. BASE PLUGS SPLITS
                        IF v_is_occupied THEN
                            IF v_typology IN ('warehouse', 'logistic') THEN v_raw_plugs := 0.10;
                            ELSIF v_typology = 'retail' THEN v_raw_plugs := 0.25;
                            ELSIF v_typology = 'office+retail' THEN v_raw_plugs := 0.30;
                            ELSE v_raw_plugs := 0.35; -- office
                            END IF;
                        ELSE
                            v_raw_plugs := 0.10; 
                        END IF;

                        -- D. SEASONAL HVAC FACTORS MODELING
                        v_cooling_need := greatest(0, sin((v_month - 4) * pi() / 6));
                        v_heating_need := greatest(0, cos((v_month - 1) * pi() / 6));

                        IF v_climate_zone = '1A' THEN v_hvac_season_factor := 0.45; 
                        ELSIF v_climate_zone = '2A' THEN v_hvac_season_factor := 0.35 + (0.15 * v_cooling_need);
                        ELSIF v_climate_zone = '3A' THEN v_hvac_season_factor := 0.25 + (0.15 * v_cooling_need) + (0.10 * v_heating_need);
                        ELSIF v_climate_zone = '4A' THEN v_hvac_season_factor := 0.20 + (0.15 * v_cooling_need) + (0.15 * v_heating_need);
                        ELSIF v_climate_zone = '5A' THEN v_hvac_season_factor := 0.15 + (0.05 * v_cooling_need) + (0.25 * v_heating_need);
                        ELSE v_hvac_season_factor := 0.10 + (0.35 * v_heating_need);
                        END IF;

                        IF v_hour BETWEEN 8 AND 20 THEN
                            v_hvac_hour_factor := 0.70 + (0.30 * sin((v_hour - 8) * pi() / 12));
                        ELSE
                            v_hvac_hour_factor := 0.45;
                        END IF;

                        v_raw_hvac := v_hvac_season_factor * v_hvac_hour_factor * (CASE WHEN v_is_occupied THEN 1.2 ELSE 0.8 END);

                        -- Warehouse HVAC Penalty: They are mostly unconditioned
                        IF v_typology IN ('warehouse', 'logistic') THEN
                            v_raw_hvac := v_raw_hvac * 0.25; 
                        END IF;

                        -- E. OTHER BASE LOAD
                        v_raw_other := 0.12;

                        -- F. NORMALIZATION & DECIMAL ROUNDING
                        v_sum := v_raw_hvac + v_raw_lighting + v_raw_plugs + v_raw_other;

                        v_hvac_pct     := round(v_raw_hvac / v_sum, 3);
                        v_lighting_pct := round(v_raw_lighting / v_sum, 3);
                        v_plugs_pct    := round(v_raw_plugs / v_sum, 3);
                        v_other_pct    := 1.000 - (v_hvac_pct + v_lighting_pct + v_plugs_pct);

                        -- G. INSERT TO DATABASE
                        INSERT INTO energy_benchmarks (
                            typology, climate_zone, month_num, day_type, hour_num,
                            hvac_pct, lighting_pct, plugs_pct, other_pct
                        ) VALUES (
                            v_typology, v_climate_zone, v_month, v_day_type, v_hour,
                            v_hvac_pct, v_lighting_pct, v_plugs_pct, v_other_pct
                        );

                    END LOOP;
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- =====================================================================
-- 5. CREATE THE CALCULATION ENGINE RPC FUNCTION
-- =====================================================================
CREATE OR REPLACE FUNCTION get_simulated_consumption_breakdown(
    p_site_id uuid,
    p_start_time timestamptz,
    p_end_time timestamptz
)
RETURNS TABLE (
    ts_hour timestamptz,
    total_kwh numeric,
    hvac_kwh numeric,
    lighting_kwh numeric,
    plugs_kwh numeric,
    other_kwh numeric,
    typology text,
    climate_zone text
) AS $$
DECLARE
    v_typology text;
    v_climate_zone text;
BEGIN
    -- 1. Grab the site's typology and climate zone (with fallbacks if null)
    SELECT 
        COALESCE(s.typology, 'office'),
        COALESCE(s.climate_zone, '4A')
    INTO v_typology, v_climate_zone
    FROM sites s
    WHERE s.id = p_site_id;

    -- If site doesn't exist, return empty set
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- 2. Fetch the raw/aggregated general power and calculate breakdown
    RETURN QUERY
    WITH site_hourly_totals AS (
        -- Sum up power_kw values from general meter (value_avg in kW over 1 hour = kWh)
        SELECT 
            eh.ts_hour,
            SUM(eh.value_avg) AS total_power
        FROM energy_hourly eh
        WHERE eh.site_id = p_site_id
          AND eh.metric = 'energy.power_kw'
          AND eh.ts_hour >= p_start_time
          AND eh.ts_hour < p_end_time
        GROUP BY eh.ts_hour
    )
    SELECT 
        t.ts_hour,
        round(t.total_power, 3) AS total_kwh,
        round(t.total_power * b.hvac_pct, 3) AS hvac_kwh,
        round(t.total_power * b.lighting_pct, 3) AS lighting_kwh,
        round(t.total_power * b.plugs_pct, 3) AS plugs_kwh,
        round(t.total_power * b.other_pct, 3) AS other_kwh,
        v_typology AS typology,
        v_climate_zone AS climate_zone
    FROM site_hourly_totals t
    LEFT JOIN energy_benchmarks b ON 
        b.typology = v_typology
        AND b.climate_zone = v_climate_zone
        AND b.month_num = EXTRACT(MONTH FROM t.ts_hour)::integer
        AND b.hour_num = EXTRACT(HOUR FROM t.ts_hour)::integer
        AND b.day_type = CASE 
            -- Simple fallback: map Saturday/Sunday to weekend, others to weekday
            WHEN EXTRACT(DOW FROM t.ts_hour) IN (0, 6) THEN 'weekend'
            ELSE 'weekday'
        END
    ORDER BY t.ts_hour ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions to frontend users
GRANT EXECUTE ON FUNCTION get_simulated_consumption_breakdown TO authenticated;
GRANT EXECUTE ON FUNCTION get_simulated_consumption_breakdown TO service_role;

COMMENT ON FUNCTION get_simulated_consumption_breakdown IS 'Calculation engine that joins a site''s general meter hourly aggregates with regional building profile benchmarks to simulate sub-metered splits.';
