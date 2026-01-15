-- Migration: Create energy power view
-- Version: 014
-- Description: Materialized view for computed power from raw I/V measurements

-- View to get latest phase measurements per device
CREATE OR REPLACE VIEW energy_phase_latest AS
WITH phase_data AS (
    SELECT 
        device_id,
        site_id,
        ts,
        metric,
        value,
        ROW_NUMBER() OVER (PARTITION BY device_id, metric ORDER BY ts DESC) as rn
    FROM telemetry
    WHERE metric IN (
        'energy.current_l1', 'energy.current_l2', 'energy.current_l3',
        'energy.voltage_l1', 'energy.voltage_l2', 'energy.voltage_l3',
        'energy.pf_l1', 'energy.pf_l2', 'energy.pf_l3',
        'energy.current_a'  -- Single phase
    )
    AND ts > now() - INTERVAL '1 hour'
)
SELECT 
    device_id,
    site_id,
    MAX(ts) as ts,
    MAX(CASE WHEN metric = 'energy.current_l1' THEN value END) as i1,
    MAX(CASE WHEN metric = 'energy.current_l2' THEN value END) as i2,
    MAX(CASE WHEN metric = 'energy.current_l3' THEN value END) as i3,
    MAX(CASE WHEN metric = 'energy.voltage_l1' THEN value END) as v1,
    MAX(CASE WHEN metric = 'energy.voltage_l2' THEN value END) as v2,
    MAX(CASE WHEN metric = 'energy.voltage_l3' THEN value END) as v3,
    MAX(CASE WHEN metric = 'energy.pf_l1' THEN value END) as pf1,
    MAX(CASE WHEN metric = 'energy.pf_l2' THEN value END) as pf2,
    MAX(CASE WHEN metric = 'energy.pf_l3' THEN value END) as pf3,
    MAX(CASE WHEN metric = 'energy.current_a' THEN value END) as current_a
FROM phase_data
WHERE rn = 1
GROUP BY device_id, site_id;

-- Computed power view (real-time)
CREATE OR REPLACE VIEW energy_power_computed AS
SELECT 
    epl.device_id,
    epl.site_id,
    epl.ts,
    CASE 
        WHEN epl.i1 IS NOT NULL OR epl.i2 IS NOT NULL OR epl.i3 IS NOT NULL THEN
            (SELECT power_w FROM compute_power_w(
                epl.i1::DOUBLE PRECISION,
                epl.i2::DOUBLE PRECISION,
                epl.i3::DOUBLE PRECISION,
                epl.v1::DOUBLE PRECISION,
                epl.v2::DOUBLE PRECISION,
                epl.v3::DOUBLE PRECISION,
                epl.pf1::DOUBLE PRECISION,
                epl.pf2::DOUBLE PRECISION,
                epl.pf3::DOUBLE PRECISION,
                COALESCE(pc.wiring_type, 'WYE'),
                COALESCE(pc.pf_default, 0.95),
                COALESCE(pc.vln_default, 230.0),
                COALESCE(pc.vll_default, 400.0)
            ))
        WHEN epl.current_a IS NOT NULL THEN
            (SELECT power_w FROM compute_power_w_single(
                epl.current_a::DOUBLE PRECISION,
                NULL,  -- No measured voltage for single phase
                NULL,  -- No measured PF
                COALESCE(pc.vln_default, 230.0),
                COALESCE(pc.pf_default, 0.95)
            ))
        ELSE NULL
    END as power_w,
    CASE 
        WHEN epl.i1 IS NOT NULL OR epl.i2 IS NOT NULL OR epl.i3 IS NOT NULL THEN
            (SELECT power_source FROM compute_power_w(
                epl.i1::DOUBLE PRECISION,
                epl.i2::DOUBLE PRECISION,
                epl.i3::DOUBLE PRECISION,
                epl.v1::DOUBLE PRECISION,
                epl.v2::DOUBLE PRECISION,
                epl.v3::DOUBLE PRECISION,
                epl.pf1::DOUBLE PRECISION,
                epl.pf2::DOUBLE PRECISION,
                epl.pf3::DOUBLE PRECISION,
                COALESCE(pc.wiring_type, 'WYE'),
                COALESCE(pc.pf_default, 0.95),
                COALESCE(pc.vln_default, 230.0),
                COALESCE(pc.vll_default, 400.0)
            ))
        WHEN epl.current_a IS NOT NULL THEN
            (SELECT power_source FROM compute_power_w_single(
                epl.current_a::DOUBLE PRECISION,
                NULL,
                NULL,
                COALESCE(pc.vln_default, 230.0),
                COALESCE(pc.pf_default, 0.95)
            ))
        ELSE 'no_data'
    END as power_source,
    CASE 
        WHEN epl.i1 IS NOT NULL OR epl.i2 IS NOT NULL OR epl.i3 IS NOT NULL THEN 'three_phase'
        WHEN epl.current_a IS NOT NULL THEN 'single_phase'
        ELSE NULL
    END as phase_type,
    pc.wiring_type,
    epl.i1, epl.i2, epl.i3,
    epl.v1, epl.v2, epl.v3,
    epl.current_a
FROM energy_phase_latest epl
LEFT JOIN panel_config pc ON (
    (pc.device_id = epl.device_id) OR 
    (pc.device_id IS NULL AND pc.site_id = epl.site_id)
)
ORDER BY epl.ts DESC;

-- Function to compute power for historical data
CREATE OR REPLACE FUNCTION compute_historical_power(
    p_device_id UUID,
    p_start TIMESTAMPTZ,
    p_end TIMESTAMPTZ
) RETURNS TABLE (
    ts TIMESTAMPTZ,
    power_w DOUBLE PRECISION,
    power_source TEXT,
    phase_type TEXT
) AS $$
DECLARE
    v_config RECORD;
BEGIN
    -- Get device config
    SELECT * INTO v_config FROM get_panel_config(p_device_id, NULL) LIMIT 1;
    
    RETURN QUERY
    WITH phase_measurements AS (
        SELECT 
            date_trunc('minute', t.ts) as ts_bucket,
            MAX(CASE WHEN t.metric = 'energy.current_l1' THEN t.value END) as i1,
            MAX(CASE WHEN t.metric = 'energy.current_l2' THEN t.value END) as i2,
            MAX(CASE WHEN t.metric = 'energy.current_l3' THEN t.value END) as i3,
            MAX(CASE WHEN t.metric = 'energy.voltage_l1' THEN t.value END) as v1,
            MAX(CASE WHEN t.metric = 'energy.voltage_l2' THEN t.value END) as v2,
            MAX(CASE WHEN t.metric = 'energy.voltage_l3' THEN t.value END) as v3,
            MAX(CASE WHEN t.metric = 'energy.current_a' THEN t.value END) as current_a
        FROM telemetry t
        WHERE t.device_id = p_device_id
          AND t.ts BETWEEN p_start AND p_end
          AND t.metric IN (
              'energy.current_l1', 'energy.current_l2', 'energy.current_l3',
              'energy.voltage_l1', 'energy.voltage_l2', 'energy.voltage_l3',
              'energy.current_a'
          )
        GROUP BY date_trunc('minute', t.ts)
    )
    SELECT 
        pm.ts_bucket,
        CASE 
            WHEN pm.i1 IS NOT NULL OR pm.i2 IS NOT NULL OR pm.i3 IS NOT NULL THEN
                (SELECT cpw.power_w FROM compute_power_w(
                    pm.i1::DOUBLE PRECISION, pm.i2::DOUBLE PRECISION, pm.i3::DOUBLE PRECISION,
                    pm.v1::DOUBLE PRECISION, pm.v2::DOUBLE PRECISION, pm.v3::DOUBLE PRECISION,
                    NULL, NULL, NULL,
                    v_config.wiring_type,
                    v_config.pf_default,
                    v_config.vln_default,
                    v_config.vll_default
                ) cpw)
            WHEN pm.current_a IS NOT NULL THEN
                (SELECT cps.power_w FROM compute_power_w_single(
                    pm.current_a::DOUBLE PRECISION,
                    NULL, NULL,
                    v_config.vln_default,
                    v_config.pf_default
                ) cps)
        END as power_w,
        CASE 
            WHEN pm.i1 IS NOT NULL OR pm.i2 IS NOT NULL OR pm.i3 IS NOT NULL THEN 'three_phase'
            WHEN pm.current_a IS NOT NULL THEN 'single_phase'
        END as power_source,
        CASE 
            WHEN pm.i1 IS NOT NULL OR pm.i2 IS NOT NULL OR pm.i3 IS NOT NULL THEN 'measured'
            WHEN pm.current_a IS NOT NULL THEN 'voltage_default'
        END as phase_type
    FROM phase_measurements pm
    ORDER BY pm.ts_bucket;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION compute_historical_power TO anon, authenticated, service_role;

COMMENT ON VIEW energy_phase_latest IS 'Latest phase measurements per energy device';
COMMENT ON VIEW energy_power_computed IS 'Real-time computed power from I/V measurements';
COMMENT ON FUNCTION compute_historical_power IS 'Compute power time series for a device';
